import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth } from './_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Secure centralized authentication check
    if (!verifyAuth(req, res)) {
      return;
    }

    const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dzen3qvgp';
    const API_KEY = process.env.CLOUDINARY_API_KEY;
    const API_SECRET = process.env.CLOUDINARY_API_SECRET;

    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ error: 'Cloudinary API anahtarları eksik.' });
    }

    // "kroki-olusturucu" tag'ine sahip tüm görselleri listele
    // Admin API limitlerine dikkat edilmeli (500 per request max)
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(API_KEY + ':' + API_SECRET).toString('base64'),
        },
        body: JSON.stringify({
          expression: 'folder:kroki-olusturucu/*',
          max_results: 500
        }),
      }
    );

    const data = await response.json();
    
    if (data.error) {
      console.error('Cloudinary API Error Response:', data.error);
      return res.status(500).json({ error: data.error.message || 'Cloudinary API hatası' });
    }

    if (!data.resources || !Array.isArray(data.resources)) {
      return res.status(500).json({ error: 'Geçersiz Cloudinary API yanıtı' });
    }
    
    // Sadece gerekli alanları döndür
    const assets = data.resources.map((r: any) => {
      const parts = r.public_id.split('/');
      const fileNameRaw = parts.pop() || r.public_id;
      const folderName = parts.length > 1 ? parts.pop() : (parts.length === 1 && parts[0] !== 'kroki-olusturucu' ? parts[0] : 'uncategorized');
      
      let fileName = fileNameRaw;
      // Geriye dönük uyumluluk: Eğer eskiden 'kroki_123456_isim' formatında kaydedilmişse, o öneki temizle.
      if (fileName.match(/^kroki_\d+_/)) {
        fileName = fileName.replace(/^kroki_\d+_/, '');
      }
      
      return {
        id: r.public_id,
        src: r.secure_url,
        name: fileName,
        category: folderName || 'uncategorized'
      };
    });

    return res.status(200).json({ assets });
  } catch (error: any) {
    console.error('Cloudinary List Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
