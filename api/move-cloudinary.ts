import type { VercelRequest, VercelResponse } from './_vercel-shim';
import crypto from 'crypto';
import { verifyAuth } from './_auth.js';

/**
 * Signed Cloudinary KLASÖR TAŞIMA: bir görseli başka klasöre (kategori) kopyalar.
 * Gövde: { fromPublicId: "kroki-olusturucu/eski/gorsel", toPublicId: "kroki-olusturucu/araclar/gorsel" }
 *
 * Kategori ↔ bulut klasörü aynası: uygulamada bir görsel başka kategoriye
 * taşındığında bu API ile buluttaki kopyası da yeni kategorinin klasörüne
 * yazılır. ESKİ kopya bilinçli olarak SİLİNMEZ: tuvale daha önce eklenmiş
 * nesneler eski URL ile çizilir; silinmesi sahnelerdeki görselleri kırar.
 * (Eski kopya galeri/taramada isim eşleşmesiyle zaten mükerrer sayılmaz.)
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

    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const { fromPublicId, toPublicId } = body as { fromPublicId?: unknown; toPublicId?: unknown };

    if (!fromPublicId || typeof fromPublicId !== 'string' || !isValidPublicId(fromPublicId)) {
      return res.status(400).json({ error: 'Geçersiz fromPublicId' });
    }
    if (!toPublicId || typeof toPublicId !== 'string' || !isValidPublicId(toPublicId)) {
      return res.status(400).json({ error: 'Geçersiz toPublicId' });
    }
    if (fromPublicId === toPublicId) {
      return res.status(400).json({ error: 'Kaynak ve hedef aynı' });
    }

    const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dzen3qvgp';
    const API_KEY = process.env.CLOUDINARY_API_KEY;
    const API_SECRET = process.env.CLOUDINARY_API_SECRET;

    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ error: 'Cloudinary API anahtarları eksik.' });
    }

    // 1) Orijinal görseli DÖNÜŞÜMSÜZ teslim adresinden çek (transform/vsürüm segmenti yok)
    const srcUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${fromPublicId}`;
    const fileResp = await fetch(srcUrl, { redirect: 'follow' });
    if (!fileResp.ok) {
      return res.status(404).json({ error: `Kaynak görsel bulutta bulunamadı (HTTP ${fileResp.status})` });
    }
    const buf = Buffer.from(await fileResp.arrayBuffer());
    if (!buf || buf.length === 0) {
      return res.status(404).json({ error: 'Kaynak görsel içeriği boş döndü' });
    }
    if (buf.length > 8_000_000) {
      return res.status(413).json({ error: 'Görsel çok büyük (>8MB), klasör taşıma yapılamadı. Kategoriniz yine de kaydedildi.' });
    }
    const mime = fileResp.headers.get('content-type') || 'image/png';
    if (!/^image\//i.test(mime)) {
      return res.status(400).json({ error: 'Kaynak görsel bir resim dosyası değil' });
    }
    const dataUri = `data:${mime};base64,${buf.toString('base64')}`;

    // 2) Hedef public_id'ye imzalı yükleme (overwrite + invalidate ile idempotent)
    const timestamp = Math.round(Date.now() / 1000);
    const signParams: Record<string, string> = {
      invalidate: 'true',
      overwrite: 'true',
      public_id: toPublicId,
      tags: 'kroki-olusturucu',
      timestamp: String(timestamp),
    };
    const toSign = Object.keys(signParams)
      .sort()
      .map((k) => `${k}=${signParams[k]}`)
      .join('&');
    const signature = crypto.createHash('sha1').update(toSign + API_SECRET).digest('hex');

    const form = new URLSearchParams();
    form.append('file', dataUri);
    form.append('public_id', toPublicId);
    form.append('tags', 'kroki-olusturucu');
    form.append('overwrite', 'true');
    form.append('invalidate', 'true');
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
      const msg = (data as { error?: { message?: string } })?.error?.message || 'Cloudinary klasör taşıma hatası';
      console.error('Move Cloudinary Error:', msg);
      return res.status(resp.ok ? 502 : (resp.status || 502)).json({ error: msg });
    }

    const d = data as { public_id?: string; secure_url?: string };
    return res.status(200).json({
      public_id: d.public_id,
      secure_url: d.secure_url,
    });
  } catch (error: unknown) {
    console.error('Move Cloudinary Error:', error);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}
