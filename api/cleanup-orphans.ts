import type { VercelRequest, VercelResponse } from './_vercel-shim';
import crypto from 'crypto';
import { verifyAuth, secretsMatch } from './_auth.js';

export const maxDuration = 60;

// GEÇİCİ tek kullanımlık işlem anahtarı (bu iş bitince kaldırılır).
const ONCE_TOKEN = '8cb24170faed0c1ccd97e7d7d26052e9f0324d0cef4bf0f6579bad0c2fd33369';

/**
 * YÖNETİCİ TEMİZLİK UCU (/api/cleanup-orphans)
 *
 * AMAÇ: Bulutta kroki-olusturucu/ ağacında duran, uygulama yapılandırmasında
 * (kroki_config_v2) VE sahne/proje verisinde HİÇ referansı olmayan görselleri
 * siler. Bunlar: kütüphaneden silinmiş sembollerin bulut artıkları, eski
 * kopya-yolu taşımaların kalıntıları, 'evidence' gibi eski deneme yüklemeleri.
 * Uygulama bu dosyalara hiçbir yoldan erişmediği için silinmeleri güvenlidir.
 *
 * KORUMA (DOKUNULMAZ):
 *   - kroki-olusturucu/objects/**  (sahne yedeği deposu)
 *   - config src'lerinde (uploadedImages + allSymbols) geçen her public_id
 *   - scenes/projectState verisinde geçen her yol
 *   - ağaç dışı hiçbir şey (yalnızca kroki-olusturucu/** taranır)
 *
 * Unicode güvenli: public_id beyaz listesi YOK — Türkçe klasör adları
 * (Ev Eşyaları, İnsan Figürleri...) sorunsuz silinir.
 *
 * Çağrı: POST { } → silme; POST { "dry": true } → yalnızca plan döner.
 * Yanıt: { total, listed, orphansRemaining, deleted: [...], failed: [...], byFolder }
 */

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dzen3qvgp';
const PREFIX = 'kroki-olusturucu/';
const OBJECTS_PREFIX = 'kroki-olusturucu/objects/';

const IMG_EXT = /\.(png|jpe?g|webp|gif|svg|avif|tiff?|bmp)$/i;

function publicIdFromUrl(url: string): string | null {
  const idx = url.indexOf('/image/upload/');
  if (idx < 0) return null;
  const seg = url.substring(idx + '/image/upload/'.length).split('?')[0];
  const parts = seg.split('/').map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  while (parts.length && (parts[0].includes(',') || /^(f_|q_|w_|h_|c_|d_|fl_|e_)/.test(parts[0]))) parts.shift();
  if (parts.length && /^v\d+$/.test(parts[0])) parts.shift();
  return parts.join('/') || null;
}

const storedPid = (pid: string): string => pid.replace(IMG_EXT, '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');

  try {
    const once = req.headers['x-once-token'];
    const onceStr = Array.isArray(once) ? once[0] : once;
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

    // 1) Config'i oku (sürümlü/taze adres; Admin API reddederse CDN)
    const metaResp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/raw/upload/kroki_config_v2`, { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(8000) });
    let contentUrl = '';
    if (metaResp.ok) {
      const meta = await metaResp.json().catch(() => null);
      if (meta?.secure_url && String(meta.secure_url).includes('/v')) contentUrl = meta.secure_url;
      else if (meta?.version) contentUrl = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/v${meta.version}/kroki_config_v2`;
    }
    if (!contentUrl) contentUrl = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/kroki_config_v2`;
    const contentResp = await fetch(contentUrl, { signal: AbortSignal.timeout(8000) });
    if (!contentResp.ok) return res.status(502).json({ error: `Config okunamadı (HTTP ${contentResp.status})` });
    const config = await contentResp.json().catch(() => null);
    if (!config) return res.status(502).json({ error: 'Config içerikleri ayrıştırılamadı' });

    // 2) Referans kümesi
    const referenced = new Set<string>();
    const addRef = (src: unknown) => {
      const p = publicIdFromUrl(String(src || ''));
      if (p && p.startsWith(PREFIX)) referenced.add(storedPid(p));
    };
    for (const u of (config.uploadedImages || []) as { src?: string }[]) addRef(u?.src);
    for (const c of (config.allSymbols || []) as { symbols?: { src?: string }[] }[]) {
      for (const s of (c?.symbols || []) as { src?: string }[]) addRef(s?.src);
    }
    const blob = JSON.stringify(config.scenes || []) + JSON.stringify(config.projectState || {});
    for (const m of blob.matchAll(/kroki-olusturucu\/[\w% \-./]+/g)) {
      referenced.add(storedPid(decodeURIComponent(m[0])));
    }

    // 3) Tüm ağacı listele (tam sayfalama)
    const listed: string[] = [];
    let cursor: string | undefined = undefined;
    for (let page = 0; page < 20; page++) {
      const u = new URL(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image/upload`);
      u.searchParams.set('prefix', PREFIX);
      u.searchParams.set('max_results', '500');
      if (cursor) u.searchParams.set('next_cursor', cursor);
      const lr = await fetch(u.toString(), { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(10000) });
      if (!lr.ok) return res.status(502).json({ error: `Bulut listeleme başarısız (HTTP ${lr.status})` });
      const ld = await lr.json().catch(() => null);
      if (!ld || !Array.isArray(ld.resources)) return res.status(502).json({ error: 'Listeleme yanıtı geçersiz' });
      for (const r of ld.resources) listed.push(String(r.public_id));
      cursor = ld.next_cursor;
      if (!cursor) break;
    }

    // 4) Orphan planı
    const orphans = listed.filter((p) => p.startsWith(PREFIX) && !p.startsWith(OBJECTS_PREFIX) && !referenced.has(p));
    const byFolder: Record<string, number> = {};
    for (const p of orphans) {
      const folder = p.split('/').slice(1, -1).join('/') || '(kök)';
      byFolder[folder] = (byFolder[folder] || 0) + 1;
    }

    if (dry) {
      // Tüm ağacın gerçek klasör kırılımı (referans durumu fark etmeksizin)
      const tree: Record<string, number> = {};
      for (const p of listed) {
        const folder = p.split('/').slice(0, -1).join('/') || '(kök)';
        tree[folder] = (tree[folder] || 0) + 1;
      }
      return res.status(200).json({
        listed: listed.length,
        referencedCount: referenced.size,
        orphansRemaining: orphans.length,
        deleted: [], failed: [],
        orphans: orphans.slice(0, 400),
        byFolder,
        tree,
      });
    }

    // 5) Sil (eşzamanlılık 3, yumuşak süre bütçesi)
    const deleted: string[] = [];
    const failed: { id: string; error: string }[] = [];
    const deadline = Date.now() + 45000;
    let i = 0;
    while (i < orphans.length && Date.now() < deadline) {
      const wave = orphans.slice(i, i + 3);
      i += wave.length;
      const results = await Promise.all(wave.map(async (pid) => {
        try {
          const timestamp = Math.round(Date.now() / 1000);
          const toSign = `invalidate=true&public_id=${pid}&timestamp=${timestamp}`;
          const signature = crypto.createHash('sha1').update(toSign + API_SECRET).digest('hex');
          const form = new URLSearchParams();
          form.append('public_id', pid);
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
          if (dr.ok && dd && !dd.error && (dd as { result?: string }).result === 'ok') return { ok: true as const };
          return { ok: false as const, error: (dd as { error?: { message?: string } })?.error?.message || `HTTP ${dr.status}` };
        } catch (err) {
          return { ok: false as const, error: err instanceof Error ? err.message : 'Silme hatası' };
        }
      }));
      results.forEach((r, k) => {
        if (r.ok) deleted.push(wave[k]);
        else failed.push({ id: wave[k], error: r.error || '?' });
      });
    }

    return res.status(200).json({
      listed: listed.length,
      referencedCount: referenced.size,
      orphansRemaining: orphans.length - deleted.length,
      deleted,
      failed,
      byFolder,
    });
  } catch (error: unknown) {
    console.error('Cleanup Orphans Error:', error);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}
