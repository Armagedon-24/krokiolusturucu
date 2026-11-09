import type { VercelRequest, VercelResponse } from './_vercel-shim';
import crypto from 'crypto';
import { verifyAuth } from './_auth.js';

export const maxDuration = 60;

/**
 * SUNUCU TARAFI KLASÖR EŞİTLEYİCİ (/api/sync-folders)
 *
 * SORUN: Klasör aynası istemcide tek tek /api/move-cloudinary çağrılarıyla
 * çalışıyordu. Her çağrı bir Vercel fonksiyonunda (10 sn limit) kaynağı
 * indirip yeniden yükler; büyük PNG'lerde ve soğuk başlangıçlarda RASTGELE
 * zaman aşımı hataları oluşuyor, her senkronda farklı görseller eksik
 * kalıyordu. Sonuç: bulutta onlarca görsel 'uncategorized'/'evidence' gibi
 * alakasız klasörlerde kalıyordu.
 *
 * ÇÖZÜM: Tek uç nokta, kroki_config_v2'yi SUNUCUDA okur (her zaman taze
 * sürümlü adres), yapılandırmadaki her görselin fiziksel klasörünü
 * uygulamanın (kategori, alt kategori) hedefiyle karşılaştırır ve
 * uyuşmayanları KENDİ indirme/yükleme döngüsüyle taşır. Yumuşak süre
 * bütçesi (soft deadline) ile çalışır: plan limitine takılmadan döner ve
 * kalan sayıyı bildirir — istemci remaining=0 olana dek çağrıyı tekrarlar.
 * Taşınanların src'si yapılandırmaya işlenip (config) geri yazılır; böylece
 * sonraki okumalarda görsel 'yerinde' görünür ve yeniden taşınmaz.
 *
 * Gövde: {} (parametre yok). Yanıt:
 * { moved, remaining, total, movedEntries: [{id, secureUrl}], failed: [{id, error}] }
 */

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dzen3qvgp';

/** İstemcideki publicIdFromUrl ile aynı kurallar: transform + sürüm segmentlerini at. */
function publicIdFromUrl(url: string): string | null {
  const idx = url.indexOf('/image/upload/');
  if (idx < 0) return null;
  const seg = url.substring(idx + '/image/upload/'.length).split('?')[0];
  let parts = seg.split('/').map(decodeURIComponent);
  while (parts.length && (parts[0].includes(',') || /^(f_|q_|w_|h_|c_|d_|fl_|e_)/.test(parts[0]))) {
    parts = parts.slice(1);
  }
  if (parts.length && /^v\d+$/.test(parts[0])) parts = parts.slice(1);
  const pid = parts.join('/');
  return pid || null;
}

/** src/lib/cloudinary.ts > safeCloudFolder ile BİREBİR aynı kurallar. */
function safeFolder(s: string): string {
  let out = '';
  for (const ch of String(s || '')) {
    if (ch === '/' || ch === '\\') out += ' ';
    else if (ch < ' ' || ch === '<' || ch === '>' || ch === '"' || ch === ':' || ch === '|' || ch === '?' || ch === '*') {
      // kontrol ve klasör ayacı karakterleri atılır
    } else out += ch;
  }
  const joined = out.split(/\s+/).filter(Boolean).join(' ');
  return joined || 'uncategorized';
}

function isValidPublicId(pid: string): boolean {
  if (!pid || pid.includes('..') || pid.startsWith('/') || pid.length > 256) return false;
  return /^[\p{L}\p{N} _\-./]+$/u.test(pid);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  try {
    if (!verifyAuth(req, res)) return;

    const API_KEY = process.env.CLOUDINARY_API_KEY;
    const API_SECRET = process.env.CLOUDINARY_API_SECRET;
    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ error: 'Cloudinary API anahtarları eksik.' });
    }
    const authHeader = 'Basic ' + Buffer.from(API_KEY + ':' + API_SECRET).toString('base64');

    // 1) Yaplandırmayı SUNUCUDA oku (sürümlü adres → her zaman taze)
    // DİKKAT: tek varlık okuma ucu '/resources/{resource_type}/{type}/{public_id}'
    // biçimindedir — '{type}' segmenti (upload) ZORUNLUDUR. Daha önce
    // '/resources/raw/kroki_config_v2' deneniyordu; segment eksik olduğu için Admin
    // API isteği HER SEFERİNDE reddediliyordu ve eşitleme hiç taşımadan
    // 'Bulut metadata okunamadı' ile çıkıyordu (taşınma kuyruğu hiç kurulamıyordu).
    const metaUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/raw/upload/kroki_config_v2`;
    const metaResp = await fetch(metaUrl, { headers: { Authorization: authHeader } });
    if (metaResp.status === 404) {
      return res.status(200).json({ moved: 0, remaining: 0, total: 0, movedEntries: [], failed: [] });
    }
    const meta = metaResp.ok ? await metaResp.json().catch(() => null) : null;

    // İçerik adresi: öncelik Admin API'nin verdiği sürümlü secure_url (taze garantisi).
    // Admin API geçici olarak reddederse (rate limit 429/420, kısa süreli 5xx vb.)
    // eşitleme TAMAMEN bloke olmasın: yapılandırma herkese açık CDN adresinden
    // okunur. Sürümsüz adres nadiren bayat kopya servis edebilir; taşıma işlemleri
    // idempotenttir (rename overwrite / upload overwrite=true) — en kötü durumda
    // bazı taşımalar 'failed' sayılır ve sonraki çağrıda kendiliğinden düzelir.
    let contentUrl: string = meta?.secure_url || '';
    if (!contentUrl || !contentUrl.includes('/v')) {
      const base = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload`;
      contentUrl = meta?.version ? `${base}/v${meta.version}/kroki_config_v2` : `${base}/kroki_config_v2`;
    }
    const contentResp = await fetch(contentUrl);
    if (!contentResp.ok) {
      return res.status(502).json({
        error: `Bulut metadata okunamadı (Admin API HTTP ${metaResp.status}, CDN HTTP ${contentResp.status})`,
      });
    }
    const config = await contentResp.json().catch(() => null);
    if (!config) return res.status(502).json({ error: 'Bulut içeriği ayrıştırılamadı' });

    // 2) Hedef klasörler: yapılandırmadaki (kategori, alt kategori) ikilisi
    const nameById: Record<string, string> = {};
    for (const c of (config.allSymbols || []) as { id?: string; name?: string }[]) {
      if (c && c.id) nameById[c.id] = c.name || c.id;
    }

    const uploads = (config.uploadedImages || []) as { id?: string; src?: string; category?: string; group?: string }[];
    const seen = new Set<string>();
    const queue: { idx: number; id: string; fromPid: string; toPid: string }[] = [];
    const claimedTargets = new Set<string>();

    uploads.forEach((im, idx) => {
      const src = String(im?.src || '');
      if (!/^https?:\/\/res\.cloudinary\.com\//i.test(src)) return;
      const pid = publicIdFromUrl(src);
      if (!pid || !pid.startsWith('kroki-olusturucu/')) return;
      if (pid.startsWith('kroki-olusturucu/objects/')) return; // sahne yedeği deposu dokunulmaz
      if (seen.has(pid)) return;
      seen.add(pid);

      const catId = im.category || 'uncategorized';
      const catFolder = safeFolder(nameById[catId] || catId);
      const grp = safeFolder(String(im.group || ''));
      const fileName = pid.split('/').pop() || 'gorsel';
      const toPid = grp && grp !== 'uncategorized'
        ? `kroki-olusturucu/${catFolder}/${grp}/${fileName}`
        : `kroki-olusturucu/${catFolder}/${fileName}`;
      if (toPid === pid) return; // zaten yerinde
      if (!isValidPublicId(toPid)) return; // geçersiz hedef adı — kayıt korunur
      if (claimedTargets.has(toPid)) return; // aynı hedefe iki kaynak: çakışmayı önle
      claimedTargets.add(toPid);
      queue.push({ idx, id: String(im.id || pid), fromPid: pid, toPid });
    });

    const total = queue.length;

    // 3) Yumuşak süre bütçesiyle taşı (eşzamanlılık 3)
    const movedEntries: { id: string; secureUrl: string }[] = [];
    const failed: { id: string; error: string }[] = [];
    // Yumuşak süre bütçesi: plan 10 sn ile sınırlıysa bile son dalga bitmeden
    // dönülür. Her fetch ayrıca kendi zaman aşımıyla korunur (asılı istek yok).
    const deadline = Date.now() + 5000;
    let cursor = 0;

    // REFERANS DENETİMİ: eski public_id sahne/verilerde geçiyorsa eski kopya
    // SİLİNEMEZ-TAŞINAMAZ (tuval nesneleri o URL ile çizer) → KOPYA yolu kullanılır.
    // Hiç referans yoksa Cloudinary RENAME (sunucu tarafı anında taşıma) kullanılır:
    // eski kopya kalmaz (Cloudinary'de 'alakasız klasörde resim' kirliliği biter) ve
    // indirme/yükleme yaplmadığı için çok hızlıdır.
    const scenesBlob = JSON.stringify(config.scenes || []) + JSON.stringify(config.projectState || {});
    const uploadsSrcBlob = JSON.stringify(uploads.map((u) => String(u?.src || '')));
    const isReferencedElsewhere = (fromPid: string): boolean =>
      scenesBlob.includes(fromPid) || uploadsSrcBlob.split(fromPid).length - 1 > 1;

    const renameOnCloudinary = async (item: { fromPid: string; toPid: string }): Promise<{ ok: boolean; secureUrl?: string; error?: string }> => {
      try {
        const timestamp = Math.round(Date.now() / 1000);
        const signParams: Record<string, string> = {
          from_public_id: item.fromPid,
          invalidate: 'true',
          overwrite: 'true',
          timestamp: String(timestamp),
          to_public_id: item.toPid,
        };
        const toSign = Object.keys(signParams).sort().map((k) => `${k}=${signParams[k]}`).join('&');
        const signature = crypto.createHash('sha1').update(toSign + API_SECRET).digest('hex');
        const form = new URLSearchParams();
        form.append('from_public_id', item.fromPid);
        form.append('to_public_id', item.toPid);
        form.append('overwrite', 'true');
        form.append('invalidate', 'true');
        form.append('api_key', API_KEY);
        form.append('timestamp', String(timestamp));
        form.append('signature', signature);
        const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/rename`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
          signal: AbortSignal.timeout(8000),
        });
        const data = await resp.json().catch(() => null);
        if (!resp.ok || !data || (data as { error?: { message?: string } }).error) {
          return { ok: false, error: (data as { error?: { message?: string } })?.error?.message || `HTTP ${resp.status}` };
        }
        const secureUrl = (data as { secure_url?: string }).secure_url;
        return secureUrl
          ? { ok: true, secureUrl }
          : { ok: false, error: 'Rename yanıtı URL içermiyor' };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Rename hatası' };
      }
    };

    const moveOne = async (item: { idx: number; id: string; fromPid: string; toPid: string }) => {
      // Önce RENAME (referans yoksa): anında, eski kopya kalmaz.
      if (!isReferencedElsewhere(item.fromPid)) {
        const r = await renameOnCloudinary(item);
        if (r.ok && r.secureUrl) return { ok: true as const, secureUrl: r.secureUrl };
        // rename başarısızsa (ör. kaynak biçimi) kopya yoluyla dene
      }
      try {
        const srcUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${item.fromPid}`;
        const fileResp = await fetch(srcUrl, { redirect: 'follow', signal: AbortSignal.timeout(8000) });
        if (!fileResp.ok) return { ok: false as const, error: `Kaynak okunamadı (HTTP ${fileResp.status})` };
        const buf = Buffer.from(await fileResp.arrayBuffer());
        if (!buf || buf.length === 0) return { ok: false as const, error: 'Kaynak içerik boş' };
        if (buf.length > 8_000_000) return { ok: false as const, error: 'Görsel çok büyük (>8MB)' };
        const mime = fileResp.headers.get('content-type') || 'image/png';
        if (!/^image\//i.test(mime)) return { ok: false as const, error: 'Kaynak bir resim değil' };

        const timestamp = Math.round(Date.now() / 1000);
        const signParams: Record<string, string> = {
          invalidate: 'true',
          overwrite: 'true',
          public_id: item.toPid,
          tags: 'kroki-olusturucu',
          timestamp: String(timestamp),
        };
        const toSign = Object.keys(signParams).sort().map((k) => `${k}=${signParams[k]}`).join('&');
        const signature = crypto.createHash('sha1').update(toSign + API_SECRET).digest('hex');

        const form = new URLSearchParams();
        form.append('file', `data:${mime};base64,${buf.toString('base64')}`);
        form.append('public_id', item.toPid);
        form.append('tags', 'kroki-olusturucu');
        form.append('overwrite', 'true');
        form.append('invalidate', 'true');
        form.append('api_key', API_KEY);
        form.append('timestamp', String(timestamp));
        form.append('signature', signature);

        const upResp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
          signal: AbortSignal.timeout(8000),
        });
        const data = await upResp.json().catch(() => null);
        if (!upResp.ok || !data || (data as { error?: { message?: string } }).error) {
          const msg = (data as { error?: { message?: string } })?.error?.message || `HTTP ${upResp.status}`;
          return { ok: false as const, error: msg };
        }
        const secureUrl = (data as { secure_url?: string }).secure_url;
        if (!secureUrl) return { ok: false as const, error: 'Yükleme yanıtı URL içermiyor' };
        return { ok: true as const, secureUrl };
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : 'Taşıma hatası' };
      }
    };

    while (cursor < queue.length && Date.now() < deadline) {
      const wave = queue.slice(cursor, cursor + 3);
      cursor += wave.length;
      const results = await Promise.all(wave.map(moveOne));
      results.forEach((r, i) => {
        const item = wave[i];
        if (r.ok) {
          movedEntries.push({ id: item.id, secureUrl: r.secureUrl });
          // Config içindeki src'yi yeni adrese işle (sonraki okumalarda 'yerinde' sayılır)
          const entry = (config.uploadedImages || [])[item.idx];
          if (entry) entry.src = r.secureUrl;
        } else {
          failed.push({ id: item.id, error: r.error });
        }
      });
    }

    // 3b) ESKİ KOPYA TEMİZLİĞİ (orphan sweep): önceki kopya-yolu taşımalar eski
    // klasörde GÖRSEL bırakıyordu — Cloudinary'de 'alakasız kategoride resim'
    // kirliliğinin asıl kaynağı buydu. Kural son derece tutucudur:
    //   - kroki-olusturucu/objects/ ve kroki_config_v2 HİÇ dokunulmaz,
    //   - yapılandırmada (uploads/allSymbols src) veya sahne/proje verisinde
    //     referansı olan her dosya KORUNUR,
    //   - referansı olmayan bir dosya, yalnızca adı TEK bir referanslı dosyanın
    //     adıyla birebir aynıysa (yani bilinen bir taşınmanın eski kopyasıysa) silinir,
    //   - kökeni bilinmeyen dosyalara DOKUNULMAZ (kullanıcının elle yüklediği
    //     olabilecek varlıklar güvenliktedir).
    let cleaned = 0;
    let orphansRemaining = 0;
    try {
      if (Date.now() < deadline) {
        const referenced = new Set<string>();
        for (const u of uploads) {
          const p = publicIdFromUrl(String(u?.src || ''));
          if (p) referenced.add(p);
        }
        for (const c of (config.allSymbols || []) as { symbols?: { src?: string }[] }[]) {
          for (const s of (c?.symbols || []) as { src?: string }[]) {
            const p = publicIdFromUrl(String(s?.src || ''));
            if (p) referenced.add(p);
          }
        }
        const baseMap = new Map<string, string[]>();
        for (const p of referenced) {
          const b = p.split('/').pop() || '';
          if (!b) continue;
          if (!baseMap.has(b)) baseMap.set(b, []);
          baseMap.get(b)!.push(p);
        }

        // Bulut ağacını listele (en fazla 2 sayfa = 1000 varlık yeterli)
        const listed: string[] = [];
        let nextCursor: string | undefined = undefined;
        let listedAnyPage = false; // en az bir sayfa başarıyla listelendi mi?
        for (let page = 0; page < 2 && Date.now() < deadline; page++) {
          const listUrl = new URL(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image/upload`);
          listUrl.searchParams.set('prefix', 'kroki-olusturucu/');
          listUrl.searchParams.set('max_results', '500');
          if (nextCursor) listUrl.searchParams.set('next_cursor', nextCursor);
          const lr = await fetch(listUrl.toString(), {
            headers: { Authorization: authHeader },
            signal: AbortSignal.timeout(8000),
          });
          if (!lr.ok) break;
          listedAnyPage = true;
          const ld = await lr.json().catch(() => null);
          if (!ld || !Array.isArray(ld.resources)) break;
          for (const r of ld.resources) listed.push(String(r.public_id));
          nextCursor = ld.next_cursor;
          if (!nextCursor) break;
        }

        const orphans: string[] = [];
        for (const p of listed) {
          if (!p.startsWith('kroki-olusturucu/') || p.startsWith('kroki-olusturucu/objects/')) continue;
          if (referenced.has(p) || scenesBlob.includes(p)) continue; // referanslı → kesinlikle korunur
          const b = p.split('/').pop() || '';
          const matches = baseMap.get(b) || [];
          if (matches.length === 1 && matches[0] !== p) orphans.push(p); // bilinen taşınmanın eski kopyası
        }
        orphansRemaining = orphans.length;

        for (const p of orphans) {
          if (Date.now() >= deadline) break;
          const timestamp = Math.round(Date.now() / 1000);
          const signParams: Record<string, string> = {
            invalidate: 'true',
            public_id: p,
            timestamp: String(timestamp),
          };
          const toSign = Object.keys(signParams).sort().map((k) => `${k}=${signParams[k]}`).join('&');
          const signature = crypto.createHash('sha1').update(toSign + API_SECRET).digest('hex');
          const form = new URLSearchParams();
          form.append('public_id', p);
          form.append('invalidate', 'true');
          form.append('api_key', API_KEY);
          form.append('timestamp', String(timestamp));
          form.append('signature', signature);
          const dr = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form.toString(),
            signal: AbortSignal.timeout(8000),
          });
          const dd = await dr.json().catch(() => null);
          if (dr.ok && dd && !dd.error) {
            cleaned++;
          } else {
            break; // silme reddedildiyse kalanı sonraki çağrıya bırak
          }
        }
        orphansRemaining = Math.max(0, orphans.length - cleaned);
        if (!listedAnyPage && listed.length === 0) {
          // Listeleme hiç yapılamadı (rate limit / ağ hatası): '0 yetim' raporlamak
          // temizliğin yarım kaldığını GİZLERDİ. -1 = 'bilinmiyor' → istemci döngüsü
          // temizlik tamam sanmadan sürer; liste toparlanınca temizlik kaldığı yerden
          // devam eder.
          orphansRemaining = -1;
        }
      }
    } catch (sweepErr) {
      console.warn('sync-folders: eski kopya temizliği atlandı:', sweepErr);
    }

    // 4) Taşınanlar varsa yapılandırmayı geri yaz (save-config ile aynı format)
    let revAt = 0;
    if (movedEntries.length > 0) {
      revAt = Date.now();
      (config as { _revAt?: number })._revAt = revAt;
      const timestamp = Math.round(revAt / 1000);
      const publicId = 'kroki_config_v2';
      const paramsToSign = `invalidate=true&public_id=${publicId}&timestamp=${timestamp}`;
      const signature = crypto.createHash('sha1').update(paramsToSign + API_SECRET).digest('hex');
      const fileDataUri = 'data:application/json;base64,' + Buffer.from(JSON.stringify(config)).toString('base64');
      const formData = new URLSearchParams();
      formData.append('file', fileDataUri);
      formData.append('public_id', publicId);
      formData.append('timestamp', String(timestamp));
      formData.append('api_key', API_KEY);
      formData.append('signature', signature);
      formData.append('resource_type', 'raw');
      formData.append('invalidate', 'true');
      const writeResp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(8000),
      });
      const writeData = await writeResp.json().catch(() => null);
      if (!writeResp.ok || !writeData || (writeData as { error?: { message?: string } }).error) {
        // Yapılandırma yazılamadı: taşımalar fiziksel olarak yapıldı ama src işlenmedi.
        // Sonraki çağrıda aynı taşımalar overwrite/rename ile tekrarlanır (idempotent).
        console.error('sync-folders: config geri yazılamadı:', (writeData as { error?: { message?: string } })?.error?.message);
      }
    }

    return res.status(200).json({
      moved: movedEntries.length,
      cleaned,
      remaining: Math.max(0, total - movedEntries.length),
      orphansRemaining,
      total,
      movedEntries,
      failed,
      _revAt: revAt || undefined,
    });
  } catch (error: unknown) {
    console.error('Sync Folders Error:', error);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}
