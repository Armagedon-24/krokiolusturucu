import type { VercelRequest, VercelResponse } from './_vercel-shim';
import { verifyAuth } from './_auth.js';

/**
 * YETKİLİ BULUT YAPILANDIRMA OKUMA (/api/load-config)
 *
 * Sorun: istemci, kroki_config_v2 kaydını doğrudan Cloudinary CDN'inden okurken
 * invalidate=true komutuna rağmen dakikalarca (nadiren saatlerce) BAYAT kopya
 * dönebiliyor. Bayat kopya uygulandığında adminin taşıdığı kategoriler eski
 * yerlerine kayıyor, silinen semboller geri geliyordu.
 *
 * Çözüm: Admin API "asset by public id" ucu kaydın GÜNCEL version bilgisini verir.
 * Sürümlü teslim URL'si (/raw/upload/v<version>/kroki_config_v2) benzersiz bir
 * önbellek anahtarıdır → invalidate gecikmesinden bağımsız olarak HER ZAMAN en
 * güncel içerik döner. İçerik sunucu tarafında çekilip istemciye aynen aktarılır.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  try {
    if (!verifyAuth(req, res)) {
      return;
    }

    const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dzen3qvgp';
    const API_KEY = process.env.CLOUDINARY_API_KEY;
    const API_SECRET = process.env.CLOUDINARY_API_SECRET;

    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ error: 'Cloudinary API anahtarları eksik.' });
    }

    const authHeader = 'Basic ' + Buffer.from(API_KEY + ':' + API_SECRET).toString('base64');

    // 1) Admin API: kaydın güncel metadata'sı (version, secure_url)
    // DİKKAT: tek varlık okuma ucu '/resources/{resource_type}/{type}/{public_id}'
    // biçimindedir — '{type}' segmenti (upload) ZORUNLUDUR. Daha önce
    // '/resources/raw/kroki_config_v2' deneniyordu; segment eksik olduğu için istek
    // her seferinde reddediliyor ve uç nokta sürekli CDN yedeğine düşüyordu.
    const metaUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/raw/upload/kroki_config_v2`;
    const metaResp = await fetch(metaUrl, { headers: { Authorization: authHeader } });

    if (metaResp.status === 404) {
      // Kayıt henüz yok — istemci CDN yollarına düşerek null alır (boş bulut durumu)
      return res.status(404).json({ error: 'Bulutta kayıt bulunamadı' });
    }

    if (!metaResp.ok) {
      return res.status(502).json({ error: `Bulut metadata okunamadı (Cloudinary HTTP ${metaResp.status})` });
    }

    const meta = await metaResp.json().catch(() => null);
    if (!meta || (!meta.secure_url && !meta.version)) {
      return res.status(502).json({ error: 'Bulut metadata geçersiz' });
    }

    // 2) Sürümlü URL: önbellek anahtarı sürüme bağlı → bayat kopya imkânsız
    let contentUrl: string = meta.secure_url;
    if (!contentUrl || !contentUrl.includes('/v')) {
      const base = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload`;
      contentUrl = meta.version
        ? `${base}/v${meta.version}/kroki_config_v2`
        : `${base}/kroki_config_v2`;
    }

    const contentResp = await fetch(contentUrl);
    if (!contentResp.ok) {
      return res.status(502).json({ error: 'Bulut içeriği okunamadı' });
    }
    const config = await contentResp.json().catch(() => null);
    if (!config) {
      return res.status(502).json({ error: 'Bulut içeriği ayrıştırılamadı' });
    }

    // _revAt: save-config'in yazdığı sunucu damgası (bayatlık kontrolünde kullanılır)
    return res.status(200).json({
      config,
      _revAt: Number((config as { _revAt?: number })._revAt || 0) || null,
      fetchedAt: Date.now(),
    });
  } catch (error: unknown) {
    console.error('Load Config Error:', error);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}
