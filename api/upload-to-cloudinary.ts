import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { verifyAuth } from './_auth.js';

/**
 * Signed Cloudinary yükleme: sunucu tarafında imza üretilir.
 * Gövde: { publicId: string, dataUri: "data:image/...;base64,...", tag?: string }
 * Uygulama sembollerinin buluta aynı kategori/isimle yedeklenmesi için kullanılır.
 */

/** public_id karakter beyaz listesi: harf, rakam, boşluk, tire, alt çizgi, nokta, slash (.. ve başında / yok) */
function isValidPublicId(pid: string): boolean {
  if (!pid || pid.includes('..') || pid.startsWith('/') || pid.length > 256) return false;
  return /^[A-Za-z0-9 _\-./]+$/.test(pid);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!verifyAuth(req, res)) {
      return;
    }

    // Platform HTML 413 yerine temiz JSON hatası
    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > 4_000_000) {
      return res.status(413).json({ error: 'Görsel çok büyük (>4MB). Lütfen daha küçük bir görsel kullanın.' });
    }

    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const { publicId, dataUri, tag } = body as { publicId?: unknown; dataUri?: unknown; tag?: unknown };

    if (!publicId || typeof publicId !== 'string' || !isValidPublicId(publicId)) {
      return res.status(400).json({ error: 'Geçersiz publicId' });
    }
    if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:')) {
      return res.status(400).json({ error: 'dataUri (data:...) gerekli' });
    }
    if (tag !== undefined && typeof tag !== 'string') {
      return res.status(400).json({ error: 'Geçersiz tag' });
    }

    const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dzen3qvgp';
    const API_KEY = process.env.CLOUDINARY_API_KEY;
    const API_SECRET = process.env.CLOUDINARY_API_SECRET;

    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ error: 'Cloudinary API anahtarları eksik.' });
    }

    const timestamp = Math.round(Date.now() / 1000);

    // İmza: file/api_key/resource_type/cloud_name hariç parametreler alfabetik + secret
    const signParams: Record<string, string> = {
      public_id: publicId,
      timestamp: String(timestamp),
    };
    if (tag) signParams.tags = tag;
    const toSign = Object.keys(signParams)
      .sort()
      .map((k) => `${k}=${signParams[k]}`)
      .join('&');
    const signature = crypto.createHash('sha1').update(toSign + API_SECRET).digest('hex');

    const form = new URLSearchParams();
    form.append('file', dataUri);
    form.append('public_id', publicId);
    if (tag) form.append('tags', tag);
    form.append('api_key', API_KEY);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);

    const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const data = await resp.json().catch(() => null);

    if (!resp.ok || !data || (data as { error?: { message?: string } }).error) {
      const msg = (data as { error?: { message?: string } })?.error?.message || 'Cloudinary yükleme hatası';
      console.error('Upload To Cloudinary Error:', msg);
      return res.status(resp.ok ? 502 : (resp.status || 502)).json({ error: msg });
    }

    const d = data as { public_id?: string; secure_url?: string; format?: string };
    return res.status(200).json({
      public_id: d.public_id,
      secure_url: d.secure_url,
      format: d.format,
    });
  } catch (error: unknown) {
    console.error('Upload To Cloudinary Error:', error);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}
