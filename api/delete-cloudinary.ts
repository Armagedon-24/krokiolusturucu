import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { verifyAuth } from './_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Secure centralized authentication check
    if (!verifyAuth(req, res)) {
      return;
    }

    const { url } = req.body;
    
    if (!url || !url.includes('cloudinary.com')) {
      return res.status(400).json({ error: 'Geçerli bir Cloudinary URL\'si gerekli' });
    }

    const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dzen3qvgp';
    const API_KEY = process.env.CLOUDINARY_API_KEY;
    const API_SECRET = process.env.CLOUDINARY_API_SECRET;

    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ error: 'Cloudinary API anahtarları eksik. Lütfen Vercel üzerinden CLOUDINARY_API_KEY ve CLOUDINARY_API_SECRET tanımlayın.' });
    }

    // URL'den public_id'yi çıkar
    // Örnek: https://res.cloudinary.com/dzen3qvgp/image/upload/v1714489000/kroki-olusturucu/folder/image.png
    // Veya: https://res.cloudinary.com/dzen3qvgp/image/upload/kroki-olusturucu/folder/image.png
    const uploadIndex = url.indexOf('/upload/');
    if (uploadIndex === -1) {
      return res.status(400).json({ error: 'Geçersiz Cloudinary URL\'si' });
    }

    const pathAfterUpload = url.substring(uploadIndex + 8); // "/upload/" sonrası
    const pathParts = pathAfterUpload.split('/');
    
    // Eğer ilk parça 'v' ile başlıyorsa ve rakamlardan oluşuyorsa, o bir versiyon kısmıdır, atla.
    if (pathParts[0].match(/^v\d+$/)) {
      pathParts.shift();
    }
    
    const publicIdWithExt = pathParts.join('/');
    const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.')) || publicIdWithExt;

    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = crypto
      .createHash('sha1')
      .update(`public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`)
      .digest('hex');

    const params = new URLSearchParams();
    params.append('public_id', publicId);
    params.append('timestamp', timestamp.toString());
    params.append('api_key', API_KEY);
    params.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Cloudinary Delete Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
