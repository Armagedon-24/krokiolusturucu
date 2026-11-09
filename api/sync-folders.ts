import type { VercelRequest, VercelResponse } from './_vercel-shim';
import crypto from 'crypto';
import { verifyAuth, secretsMatch } from './_auth.js';

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
const PREFIX_CONST = 'kroki-olusturucu/';

// GEÇİCİ tek kullanımlık işlem anahtarı: ilk kurulum döngüsünü tetiklemek için.
// Kurulum doğrulanınca HEMEN sonraki commit ile kaldırılır (uç nokta kalıcı olarak
// verifyAuth ile korunur).
const ONCE_TOKEN = 'a3f9c2e58b17d64a0e8c31f52b7d9046e1a5c8f30b62d47985ea10c3d6f42b78';

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

/**
 * KRİTİK: Cloudinary teslim adresi = kayıtlı public_id + '.' + biçim uzantısı.
 * publicIdFromUrl bu ADRESTEN türettiği için sonuç her zaman GERÇEK kayıtlı
 * id'nin BİR biçim uzantı fazlasıdır ('Merdivenli.png.png' adresi → kayıtlı id
 * 'Merdivenli.png'). RENAME/DELETE/ karşılaştırma bu GERÇEK id ile yapılmalı;
 * aksi halde rename 'bulunamadı' ile düşer, kopya yolu devreye girer ve eski
 * kopyalar asla temizlenemez. (Kanıt: v1'li CDN istekleriyle doğrulandı.)
 */
const IMG_FORMAT_EXT = /\.(png|jpe?g|webp|gif|svg|avif|tiff?|bmp)$/i;
function storedPid(deliveredPid: string): string {
  return deliveredPid.replace(IMG_FORMAT_EXT, '');
}

/** Eşleştirme anahtarı: dosya adındaki TÜM ardışık biçim uzantıları atılır
 *  ('X.png' ve 'X.png.png' → 'X') — eski kopya ile yeni kopyanın adı, uzantı
 *  kalıntılarına takılmadan eşleşir. ('.png' ↔ '.jpg' çakışmaları 2 eşleşme
 *  üretir → temizlik yerine koruma tercih edilir.) */
function nameKey(basename: string): string {
  let b = basename;
  while (IMG_FORMAT_EXT.test(b)) b = b.replace(IMG_FORMAT_EXT, '');
  return b;
}

/**
 * BOŞ KLASÖR TARAMASI: kroki-olusturucu/** altındaki klasör düğümlerini
 * (Folders Admin API) BFS ile listeler; hiç varlık içermeyenleri (ne kendisi
 * ne alt dalları) döndürür. Bunlar eski isimlendirmelerin kabuklarıdır
 * ('CG\'ler', 'kantı' gibi) — Media Library'de 'boş klasör' kirliliğidir.
 * Folders API'nin iki istek biçimi de denenir (path-sonda / of_folder_path).
 */
async function collectEmptyFolders(authHeader: string, prelisted?: string[]): Promise<{ nodes: number; empties: string[]; error: string | null }> {
  let listed: string[] = [];
  if (prelisted && prelisted.length) {
    listed = prelisted;
  } else {
    // GÖRSEL DIŞI KAYNAKLAR DA SAYILIR (raw/video): klasörde eski bir JSON/ses
    // kalıntısı varsa yalnızca image listelesek klasörü 'boş' sanıp silmeye
    // çalışırduk; Cloudinary ise 'Folder is not empty' ile reddederdi ve budama
    // o klasörde SONSUZA DEK başarısız olurdu. (Kanıt: 'symbols', 'Kategorisiz'
    // gibi 5 klasör tam bu tuzağa düşmüştü.)
    for (const rtype of ['image', 'raw', 'video'] as const) {
      let cursor: string | undefined = undefined;
      for (let page = 0; page < 20; page++) {
        const u = new URL(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/${rtype}/upload`);
        u.searchParams.set('prefix', PREFIX_CONST);
        u.searchParams.set('max_results', '500');
        if (cursor) u.searchParams.set('next_cursor', cursor);
        const lr = await fetch(u.toString(), { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(8000) });
        if (!lr.ok) return { nodes: 0, empties: [], error: `varlık listeleme HTTP ${lr.status} (${rtype})` };
        const ld = await lr.json().catch(() => null);
        if (!ld || !Array.isArray(ld.resources)) return { nodes: 0, empties: [], error: 'varlık listeleme yanıtı geçersiz' };
        for (const r of ld.resources) listed.push(String(r.public_id));
        cursor = ld.next_cursor;
        if (!cursor) break;
      }
    }
  }
  const assetFolders = new Set<string>();
  for (const p of listed) {
    // NFC NORMALİZASYONU: aynı Türkçe ad iki farklı bayt dizisiyle yazılabilir
    // ('ş' U+015F ↔ 's'+U+0327). Folders API düğümü ile varlık yolu farklı
    // normalizasyonda ise startsWith eşleşmez → klasör HATALI 'boş' sayılır,
    // silmeye çalışılır, Cloudinary 'not empty' ile reddeder (kanıt:
    // 'Trafik işaretleri' altındaki görünmez kaynak). Her iki taraf NFC'ye çevrilir.
    const parts = p.normalize('NFC').split('/');
    parts.pop();
    for (let i = 1; i <= parts.length; i++) assetFolders.add(parts.slice(0, i).join('/'));
  }

  const encPath = (p: string) => p.split('/').map(encodeURIComponent).join('/');
  let queryShape: boolean | null = null; // hangi istek biçimi çalıştı?
  const listSub = async (path: string): Promise<string[]> => {
    const enc = encPath(path);
    const queryUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/folders?of_folder_path=${encodeURIComponent(path)}&max_results=500`;
    const pathUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/folders/${enc}?max_results=500`;
    // SDK dokümanındaki biçim (path sonda) önce denenir; bilinen-iyi biçim varsa o önce.
    const urls = queryShape === true ? [queryUrl, pathUrl] : [pathUrl, queryUrl];
    let lastErr = '';
    for (const u of urls) {
      try {
        const r = await fetch(u, { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(8000) });
        if (!r.ok) { lastErr = `HTTP ${r.status}`; continue; }
        const d = await r.json().catch(() => null);
        if (!d || !Array.isArray(d.folders)) { lastErr = 'yanıt geçersiz'; continue; }
        queryShape = u.includes('of_folder_path');
        return (d.folders as { path?: string; name?: string }[]).map((f) => String(f.path || f.name || ''));
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
    throw new Error(`klasör listeleme başarısız (path=${path}): ${lastErr}`);
  };

  // SEVİYE PARALEL BFS: her seviyedeki klasör istekleri aynı anda atılır —
  // sıralı tarama ~50 düğümde dakikalar sürüyordu; paralel tarama saniyelerde biter.
  const nodes: string[] = [];
  let error: string | null = null;
  let level: string[] = ['kroki-olusturucu'];
  for (let depth = 0; level.length && depth < 8; depth++) {
    const results = await Promise.all(level.map(async (cur) => {
      try {
        return { cur, subs: await listSub(cur), err: null as string | null };
      } catch (e) {
        return { cur, subs: [] as string[], err: e instanceof Error ? e.message : String(e) };
      }
    }));
    const next: string[] = [];
    for (const r of results) {
      if (r.err) { error = r.err; continue; }
      for (const s of r.subs) {
        const full = s.startsWith(PREFIX_CONST) ? s : `${r.cur}/${s}`;
        if (!full.startsWith(PREFIX_CONST) || full === 'kroki-olusturucu') continue;
        if (full.startsWith('kroki-olusturucu/objects')) continue; // sahne yedeği deposu yönetilmez
        if (nodes.includes(full) || next.includes(full)) continue;
        nodes.push(full);
        next.push(full);
      }
    }
    if (error && nodes.length === 0) return { nodes: 0, empties: [], error };
    level = next;
  }
  if (nodes.length === 0) {
    return { nodes: 0, empties: [], error: error || 'klasör ağacı boş döndü (Folders API biçimi uyuşmadı)' };
  }
  const empties = nodes.filter((n) => {
    const nn = n.normalize('NFC');
    return !assetFolders.has(nn) && ![...assetFolders].some((a) => a.startsWith(nn + '/'));
  });
  empties.sort((a, b) => b.split('/').length - a.split('/').length); // aşağıdan yukarıya silme sırası
  return { nodes: nodes.length, empties, error: null };
}

/** Silme reddi ARAŞTIRMASI: klasörün altında standart listelemenin görmediği
 *  kaynak/klasör var mı? Somut public_id'ler + alt klasör yolları raporlanır —
 *  Unicode normalizasyonu (NFC/NFD) veya eşleşme farkı gizli kaynakları böyle görünür kılar. */
async function probeFolderAssets(authHeader: string, folder: string): Promise<string> {
  const combos: [string, string][] = [
    ['image', 'upload'], ['image', 'authenticated'], ['image', 'private'],
    ['raw', 'upload'], ['raw', 'authenticated'],
    ['video', 'upload'], ['video', 'authenticated'],
  ];
  const found: string[] = [];
  const encF = encodeURIComponent(folder);
  for (const [rt, ty] of combos) {
    try {
      const u = new URL(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/${rt}/${ty}`);
      u.searchParams.set('prefix', folder + '/');
      u.searchParams.set('max_results', '10');
      const r = await fetch(u.toString(), { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(6000) });
      if (!r.ok) continue;
      const d = await r.json().catch(() => null);
      const rs = d && Array.isArray((d as { resources?: unknown[] }).resources) ? (d as { resources: { public_id?: string }[] }).resources : [];
      if (rs.length > 0) found.push(`${rt}/${ty}:${rs.length} [${rs.slice(0, 5).map((x) => JSON.stringify(x?.public_id || '?')).join(', ')}]`);
    } catch { /* alt tip sorgusu başarısız — yok say */ }
  }
  // Doğrudan alt klasör listesi (BFS'in gördüklerinden bağımsız ikinci görüş)
  try {
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/folders/${encF}?max_results=100`, { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(6000) });
    if (r.ok) {
      const d = await r.json().catch(() => null);
      const fs = d && Array.isArray((d as { folders?: unknown[] }).folders) ? (d as { folders: { path?: string }[] }).folders : [];
      if (fs.length > 0) found.push(`alt klasör:${fs.length} [${fs.slice(0, 5).map((x) => JSON.stringify(x?.path || '?')).join(', ')}]`);
    }
  } catch { /* yok say */ }
  return found.length ? found.join(' ; ') : 'kaynak yok';
}

/** DERİN BUDAMA: 'Folder is not empty' red yiyecek klasörün Folders API'nin
 *  BFS'te atladığı hayalet alt klasörleri olabilir. Doğrudan alt klasörleri
 *  sorar, derinlik önceliğiyle siler, sayısını döndürür. Sınır: derinlik 4. */
async function deepPrune(authHeader: string, root: string, deadline: number, log: { folder: string; error: string }[]): Promise<number> {
  const encP = (p: string) => p.split('/').map(encodeURIComponent).join('/');
  const subs = async (p: string): Promise<string[]> => {
    try {
      const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/folders/${encP(p)}?max_results=500`, { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) return [];
      const d = await r.json().catch(() => null);
      return d && Array.isArray((d as { folders?: unknown[] }).folders)
        ? (d as { folders: { path?: string }[] }).folders.map((f) => String(f?.path || '')).filter(Boolean)
        : [];
    } catch { return []; }
  };
  const del = async (p: string): Promise<boolean> => {
    try {
      const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/folders/${encP(p)}`, { method: 'DELETE', headers: { Authorization: authHeader }, signal: AbortSignal.timeout(8000) });
      const d = await r.json().catch(() => null);
      return r.ok && d && !(d as { error?: unknown }).error;
    } catch { return false; }
  };
  let count = 0;
  const walk = async (p: string, depth: number): Promise<void> => {
    if (Date.now() >= deadline || depth > 4) return;
    for (const s of await subs(p)) {
      await walk(s, depth + 1);
      if (await del(s)) count++;
      else log.push({ folder: s, error: 'derin budama reddi' });
    }
  };
  await walk(root, 0);
  return count;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  try {
    // Auth: ya app admin token'ı (x-auth-token) ya da GEÇİCİ tek kullanımlık
    // işlem anahtarı (x-once-token — ilk kurulum tetiklemesi için; sonradan
    // kaldırılacak). İkisi de yoksa 401.
    const onceHdr = req.headers['x-once-token'];
    const onceStr = Array.isArray(onceHdr) ? onceHdr[0] : onceHdr;
    if (!onceStr || !secretsMatch(onceStr, ONCE_TOKEN)) {
      if (!verifyAuth(req, res)) return;
    }

    const API_KEY = process.env.CLOUDINARY_API_KEY;
    const API_SECRET = process.env.CLOUDINARY_API_SECRET;
    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ error: 'Cloudinary API anahtarları eksik.' });
    }
    const authHeader = 'Basic ' + Buffer.from(API_KEY + ':' + API_SECRET).toString('base64');
    const dry = Boolean((req.body as { dry?: boolean } | undefined)?.dry);

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
    const queue: { idx: number; id: string; fromPid: string; toPid: string; deliveredPid: string }[] = [];
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
      // GERÇEK depo id'leri: teslim adresindeki biçim uzantısı atılır (bkz. storedPid).
      // Böylece RENAME gerçek kayıttan yapılır ve hedef adı orijinal dosya adı kalır;
      // zaten taşınmış (uzantısı şişmiş) kayıtlar toPid==fromPid ile ATLANIR (idempotent).
      const fromPid = storedPid(pid);
      const fileName = storedPid(pid.split('/').pop() || '') || 'gorsel';
      const toPid = grp && grp !== 'uncategorized'
        ? `kroki-olusturucu/${catFolder}/${grp}/${fileName}`
        : `kroki-olusturucu/${catFolder}/${fileName}`;
      if (toPid === fromPid) return; // zaten yerinde
      if (!isValidPublicId(toPid)) return; // geçersiz hedef adı — kayıt korunur
      if (claimedTargets.has(toPid)) return; // aynı hedefe iki kaynak: çakışmayı önle
      claimedTargets.add(toPid);
      queue.push({ idx, id: String(im.id || pid), fromPid, toPid, deliveredPid: pid });
    });

    const total = queue.length;

    // TANI MODU (dry): hiçbir işlem yapmadan yalnızca plan döner — taşıma kuyruğu
    // boyutu + boş klasör listesi. İstemci kullanmaz; kurulum doğrulaması içindir.
    if (dry) {
      const scan = await collectEmptyFolders(authHeader);
      return res.status(200).json({
        moved: 0, cleaned: 0, remaining: total, total,
        movedEntries: [], failed: [],
        orphansRemaining: 0,
        prunedFolders: 0,
        prunedFolderList: scan.empties.slice(0, 300),
        emptyFoldersRemaining: scan.error && scan.nodes === 0 ? -1 : scan.empties.length,
        folderNodes: scan.nodes,
        folderScanError: scan.error || undefined,
        dry: true,
      });
    }

    // 3) Yumuşak süre bütçesiyle taşı (eşzamanlılık 3)
    const movedEntries: { id: string; secureUrl: string }[] = [];
    const failed: { id: string; error: string }[] = [];
    // Yumuşak süre bütçesi: uç nokta maxDuration=60 bildirir; taşıma + süpürme +
    // budama fazlarının tamamı 45 sn'lik tek bütçede çalışır. Her fetch ayrıca
    // kendi zaman aşımıyla korunur (asılı istek yok).
    const deadline = Date.now() + 45000;
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

    const moveOne = async (item: { idx: number; id: string; fromPid: string; toPid: string; deliveredPid: string }) => {
      // Önce RENAME (referans yoksa): anında, eski kopya kalmaz.
      if (!isReferencedElsewhere(item.fromPid)) {
        const r = await renameOnCloudinary(item);
        if (r.ok && r.secureUrl) return { ok: true as const, secureUrl: r.secureUrl };
        // rename başarısızsa (ör. kaynak biçimi) kopya yoluyla dene
      }
      try {
        // KAYNAK OKUMA teslim adresiyle (üretilmiş id) yapılır: depo id'si tek başına
        // teslim adresi değildir (biçim uzantısı eksik → 404, bkz. storedPid notu).
        const srcUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${item.deliveredPid}`;
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
      if (!dry && Date.now() < deadline) {
        // GERÇEK kayıtlı id'ler: teslim adresinden türetilen id'den biçim uzantısı
        // atılır (bkz. storedPid). Admin API listelemesi de GERÇEK id'leri döndürür —
        // iki taraf ancak böyle eşleşir; aksi halde temizlik HİÇ çalışmaz.
        const referenced = new Set<string>();
        for (const u of uploads) {
          const p = publicIdFromUrl(String(u?.src || ''));
          if (p) referenced.add(storedPid(p));
        }
        for (const c of (config.allSymbols || []) as { symbols?: { src?: string }[] }[]) {
          for (const s of (c?.symbols || []) as { src?: string }[]) {
            const p = publicIdFromUrl(String(s?.src || ''));
            if (p) referenced.add(storedPid(p));
          }
        }
        const baseMap = new Map<string, string[]>();
        for (const p of referenced) {
          const b = nameKey(p.split('/').pop() || '');
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
          const b = nameKey(p.split('/').pop() || '');
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

    // 3c) BOŞ KLASÖR BUDAMA: taşımalar + eski kopya süpürmesinden sonra varlıksız
    // kalan klasör düğümleri (eski isimlendirmelerin kabukları — 'CG\'ler', 'kantı'
    // gibi) Media Library'de 'boş klasör' kirliliği yaratır. Varlık İÇERMEYEN
    // düğümler aşağıdan yukarıya silinir; silme öncesi alt ağaç varlık sayısı
    // yeniden doğrulanır, kroki-olusturucu kökü ve objects/ ASLA silinmez.
    let prunedFolders = 0;
    let emptyFoldersRemaining = 0;
    const prunedFolderList: string[] = [];
    let pruneErrors: { folder: string; error: string }[] = [];
    try {
      if (!dry && Date.now() < deadline) {
        const scan = await collectEmptyFolders(authHeader);
        emptyFoldersRemaining = scan.error && scan.nodes === 0 ? -1 : scan.empties.length;
        for (const n of scan.empties) {
          if (Date.now() >= deadline) break;
          if (n === 'kroki-olusturucu' || n.startsWith('kroki-olusturucu/objects')) continue;
          const attempt = async (): Promise<{ ok: boolean; error: string }> => {
            try {
              const fr = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/folders/${n.split('/').map(encodeURIComponent).join('/')}`, {
                method: 'DELETE',
                headers: { Authorization: authHeader },
                signal: AbortSignal.timeout(8000),
              });
              const fd = await fr.json().catch(() => null);
              if (fr.ok && fd && !(fd as { error?: unknown }).error) return { ok: true, error: '' };
              return { ok: false, error: (fd as { error?: { message?: string } })?.error?.message || `HTTP ${fr.status}` };
            } catch (delErr) {
              return { ok: false, error: delErr instanceof Error ? delErr.message : 'silme hatası' };
            }
          };
          let res1 = await attempt();
          if (!res1.ok) {
            // RED ARAŞTIRMASI: (1) görünmez kaynak tipleri, (2) hayalet alt klasörler.
            const detail = await probeFolderAssets(authHeader, n);
            const recovered = await deepPrune(authHeader, n, deadline, pruneErrors);
            if (recovered > 0) res1 = await attempt();
            if (!res1.ok) {
              // Sebep görünür olur: 'Folder is not empty | image/upload:3' gibi.
              // Kardeşlere devam edilir — tek klasör diğerlerini kilitlemez.
              pruneErrors.push({ folder: n, error: `${res1.error} | araştırma: ${detail}` });
              continue;
            }
          }
          prunedFolders++;
          prunedFolderList.push(n);
          emptyFoldersRemaining = Math.max(0, (emptyFoldersRemaining || 0) - 1);
        }
      }
    } catch (pruneErr) {
      console.warn('sync-folders: boş klasör budama atlandı:', pruneErr);
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
      prunedFolders,
      prunedFolderList,
      pruneErrors,
      emptyFoldersRemaining,
      _revAt: revAt || undefined,
    });
  } catch (error: unknown) {
    console.error('Sync Folders Error:', error);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}
