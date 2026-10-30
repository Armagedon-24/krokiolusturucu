import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { verifyAuth } from './_auth.js';

/** public_id karakter beyaz listesi: harf, rakam, boşluk, tire, alt çizgi, nokta, slash (.. yok) */
function isValidPublicId(pid: string): boolean {
  if (!pid || pid.includes('..') || pid.startsWith('/')) return false;
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

    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const url = (body as { url?: unknown }).url;

    const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dzen3qvgp';

    // Girdi doğrulaması, ortam yapılandırması kontrolünden ÖNCE yapılır:
    // bozuk istek her zaman 400 döner (500 değil).
    if (!url || typeof url !== 'string' ||
        !(url.startsWith('http://res.cloudinary.com/') || url.startsWith('https://res.cloudinary.com/')) ||
        !url.includes(`/image/upload/`)) {
      return res.status(400).json({ error: 'Geçerli bir Cloudinary görsel URL\'si gerekli' });
    }

    // Sadece bu hesabın CDN adresleri silinebilsin (hesap dışı public_id tahmin edilip silinemesin)
    if (!url.includes(`res.cloudinary.com/${CLOUD_NAME}/`)) {
      return res.status(400).json({ error: 'URL bu Cloudinary hesabına ait değil' });
    }

    const API_KEY = process.env.CLOUDINARY_API_KEY;
    const API_SECRET = process.env.CLOUDINARY_API_SECRET;

    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ error: 'Cloudinary API anahtarları eksik. Lütfen Vercel üzerinden CLOUDINARY_API_KEY ve CLOUDINARY_API_SECRET tanımlayın.' });
    }

    // URL'den public_id'yi çıkar
    // Örnek: https://res.cloudinary.com/dzen3qvgp/image/upload/v1714489000/kroki-olusturucu/folder/image.png
    const uploadIndex = url.indexOf('/upload/');
    const pathAfterUpload = url.substring(uploadIndex + 8); // "/upload/" sonrası
    const pathParts = pathAfterUpload.split('/');

    // Eğer ilk parça 'v' ile başlıyorsa ve rakamlardan oluşuyorsa, o bir versiyon kısmıdır, atla.
    if (pathParts[0].match(/^v\d+$/)) {
      pathParts.shift();
    }

    const publicIdWithExt = pathParts.join('/');
    const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.')) || publicIdWithExt;

    if (!isValidPublicId(publicId)) {
      return res.status(400).json({ error: 'Geçersiz public_id' });
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    // invalidate=true: CDN önbelleğindeki silinen görselin hemen geçersiz kılınması için
    // İmza parametreleri alfabetik sırada: invalidate, public_id, timestamp
    const signature = crypto
      .createHash('sha1')
      .update(`invalidate=true&public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`)
      .digest('hex');

    const params = new URLSearchParams();
    params.append('public_id', publicId);
    params.append('timestamp', timestamp.toString());
    params.append('invalidate', 'true');
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

    const data = await response.json().catch(() => null);

    if (!response.ok || !data || (data as { error?: { message?: string } }).error) {
      const msg = (data as { error?: { message?: string } })?.error?.message || 'Cloudinary silme işlemi başarısız';
      console.error('Cloudinary Delete Error:', msg);
      return res.status(response.ok ? 502 : (response.status || 502)).json({ error: msg });
    }

    return res.status(200).json({ result: (data as { result?: string }).result || 'ok' });
  } catch (error: unknown) {
    console.error('Cloudinary Delete Error:', error);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}
