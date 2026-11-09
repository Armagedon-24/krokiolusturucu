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
    const metaUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/raw/kroki_config_v2`;
    const metaResp = await fetch(metaUrl, { headers: { Authorization: authHeader } });
    if (metaResp.status === 404) {
      return res.status(200).json({ moved: 0, remaining: 0, total: 0, movedEntries: [], failed: [] });
    }
    if (!metaResp.ok) {
      return res.status(502).json({ error: 'Bulut metadata okunamadı' });
    }
    const meta = await metaResp.json().catch(() => null);
    let contentUrl: string = meta?.secure_url || '';
    if (!contentUrl || !contentUrl.includes('/v')) {
      const base = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload`;
      contentUrl = meta?.version ? `${base}/v${meta.version}/kroki_config_v2` : `${base}/kroki_config_v2`;
    }
    const contentResp = await fetch(contentUrl);
    if (!contentResp.ok) return res.status(502).json({ error: 'Bulut içeriği okunamadı' });
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

    const moveOne = async (item: { idx: number; id: string; fromPid: string; toPid: string }) => {
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
      });
      const writeData = await writeResp.json().catch(() => null);
      if (!writeResp.ok || !writeData || (writeData as { error?: { message?: string } }).error) {
        // Yapılandırma yazılamadı: taşımalar fiziksel olarak yapıldı ama src işlenmedi.
        // Sonraki çağrıda aynı taşımalar overwrite ile tekrarlanır (idempotent) — hata döndürmek yerine bildir.
        console.error('sync-folders: config geri yazılamadı:', (writeData as { error?: { message?: string } })?.error?.message);
      }
    }

    return res.status(200).json({
      moved: movedEntries.length,
      remaining: Math.max(0, total - movedEntries.length),
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
