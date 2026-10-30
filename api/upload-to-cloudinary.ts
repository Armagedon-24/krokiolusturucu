import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { verifyAuth } from './_auth.js';

/**
 * Signed Cloudinary yükleme: sunucu tarafında imza üretilir.
 * Gövde: { publicId: string, dataUri: "data:image/...;base64,...", tag?: string }
 * Uygulama sembollerinin buluta aynı kategori/isimle yedeklenmesi için kullanılır.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!verifyAuth(req, res)) {
      return;
    }

    const { publicId, dataUri, tag } = req.body || {};

    if (!publicId || typeof publicId !== 'string') {
      return res.status(400).json({ error: 'publicId gerekli' });
    }
    if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:')) {
      return res.status(400).json({ error: 'dataUri (data:...) gerekli' });
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

    const data = await resp.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'Cloudinary yükleme hatası' });
    }

    return res.status(200).json({
      public_id: data.public_id,
      secure_url: data.secure_url,
      format: data.format,
    });
  } catch (error: any) {
    console.error('Upload To Cloudinary Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
