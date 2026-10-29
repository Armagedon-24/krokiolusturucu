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

    // Cloudinary'deki TÜM yüklenmiş görselleri listele (klasör öneki bağımsız).
    // Eski yüklemeler 'kroki-olusturucu' klasörü dışında kalabildiği için prefix
    // filtresi kullanmıyoruz; aksi halde bazı bulut görselleri uygulamada görünmez.
    // Admin API sayfalama limiti: istek başına max 500 kaynak, next_cursor ile devam.
    const authHeader = 'Basic ' + Buffer.from(API_KEY + ':' + API_SECRET).toString('base64');
    let allResources: any[] = [];
    let nextCursor: string | undefined = undefined;
    let pageCount = 0;
    do {
      const listUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image/upload?max_results=500${nextCursor ? `&next_cursor=${encodeURIComponent(nextCursor)}` : ''}`;
      const response = await fetch(listUrl, {
        method: 'GET',
        headers: { 'Authorization': authHeader },
      });

      const data = await response.json();

      if (data.error) {
        console.error('Cloudinary API Error Response:', data.error);
        return res.status(500).json({ error: data.error.message || 'Cloudinary API hatası' });
      }

      if (!data.resources || !Array.isArray(data.resources)) {
        return res.status(500).json({ error: 'Geçersiz Cloudinary API yanıtı' });
      }

      allResources = allResources.concat(data.resources);
      nextCursor = data.next_cursor;
      pageCount++;
    } while (nextCursor && pageCount < 10); // güvenlik sınırı: en fazla 5000 görsel
    
    // Sadece gerekli alanları döndür
    const assets = allResources.map((r: any) => {
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
