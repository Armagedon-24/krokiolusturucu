import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { verifyAuth } from './_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    // Platform HTML 413 yerine temiz JSON hatası döndürmek için erken boyut kontrolü
    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > 4_000_000) {
      return res.status(413).json({ error: 'Yedek çok büyük (>4MB). Ağır görsellerin buluta taşınmasını bekleyip tekrar deneyin.' });
    }

    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const config = (body as { config?: unknown }).config;
    if (!config) {
      return res.status(400).json({ error: 'Config verisi eksik.' });
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    const publicId = 'kroki_config_v2';

    // Cloudinary signed upload signature calculation
    const paramsToSign = `invalidate=true&public_id=${publicId}&timestamp=${timestamp}`;
    const signature = crypto.createHash('sha1').update(paramsToSign + API_SECRET).digest('hex');

    const fileDataUri = "data:application/json;base64," + Buffer.from(JSON.stringify(config)).toString('base64');

    const formData = new URLSearchParams();
    formData.append('file', fileDataUri);
    formData.append('public_id', publicId);
    formData.append('timestamp', timestamp.toString());
    formData.append('api_key', API_KEY);
    formData.append('signature', signature);
    formData.append('resource_type', 'raw');
    formData.append('invalidate', 'true');

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`,
      { method: 'POST', body: formData }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok || !data || (data as { error?: { message?: string } }).error) {
      const msg = (data as { error?: { message?: string } })?.error?.message || 'Cloudinary kayıt hatası';
      console.error('Cloudinary Save Error:', msg);
      return res.status(response.ok ? 502 : (response.status || 502)).json({ error: msg });
    }

    // İstemciye yalnızca gerekli alanlar döndürülür (api_key/signature sızdırılmaz)
    const d = data as { public_id?: string; secure_url?: string; bytes?: number; created_at?: string };
    return res.status(200).json({
      public_id: d.public_id,
      secure_url: d.secure_url,
      bytes: d.bytes,
      timestamp: timestamp * 1000,
    });
  } catch (error: unknown) {
    console.error('Config Save Error:', error);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}
