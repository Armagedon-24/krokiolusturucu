import type { VercelRequest, VercelResponse } from './_vercel-shim';
import { verifyAuth } from './_auth.js';

/**
 * Cloudinary URL'sinden sürüm/uzantı bağımsız public_id türetir.
 * Dönüşüm zinciri (f_auto,q_auto,w_80 gibi) ve sürüm segmenti (/v123/) atlanır —
 * böylece optimize görüntü URL'leri ile ham secure_url aynı public_id'ye düşer
 * (istemci tarafındaki publicIdFromUrl ile aynı amaç, dönüşüm toleranslı hali).
 */
const pidFromUrl = (url?: string): string | null => {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) return null;
  const idx = url.indexOf('/upload/');
  if (idx === -1) return null;
  const rest = url.substring(idx + 8).split('?')[0];
  const parts = rest.split('/').filter(Boolean);
  // Dönüşüm segmentlerini at: virgül zincirli (f_auto,q_auto) veya bilinen bayrak önekli (w_80, c_fill...)
  while (
    parts.length > 1 &&
    (parts[0].includes(',') || /^(f_|q_|w_|h_|c_|fl_|d_|r_|o_|e_|b_|a_|g_)[a-z0-9_.-]*$/i.test(parts[0]))
  ) {
    parts.shift();
  }
  if (parts.length > 0 && /^v\d+$/.test(parts[0])) parts.shift();
  if (parts.length === 0) return null;
  return parts.join('/').replace(/\.[a-zA-Z0-9]+$/, '') || null;
};

/**
 * Bulut yapılandırmasından (kroki_config_v2) public_id -> { isim, kategori } haritası çıkarır.
 * - İSİM: admin semboller panelinde verdiği isim bulut galerisinde/eksik taramada görünür.
 * - KATEGORİ (klasör aynası): admin uygulamada görseli hangi kategoriye aldıysa o
 *   kategori bulut listesinde de geçerli sayılır — fiziksel klasör adı değil,
 *   kullanıcının atadığı kategori esastır ('uncategorized' olmayan gerçek atamalar).
 * Yapılandırma okunamazsa boş haritalar döner — mevcut davranış korunur.
 */
const buildLibraryMaps = async (cloudName: string): Promise<{ nameByPid: Map<string, string>, catByPid: Map<string, string> }> => {
  const nameByPid = new Map<string, string>();
  const catByPid = new Map<string, string>();
  const urls = [
    `https://res.cloudinary.com/${cloudName}/raw/upload/kroki_config_v2`,
    `https://res.cloudinary.com/${cloudName}/raw/upload/kroki_config_v2.json`,
  ];
  for (const u of urls) {
    try {
      const res = await fetch(u);
      if (!res.ok) continue;
      const cfg = await res.json();
      const add = (src?: string, name?: string, category?: string) => {
        const pid = pidFromUrl(src);
        const n = typeof name === 'string' ? name.trim() : '';
        const c = typeof category === 'string' ? category.trim() : '';
        if (pid && n && !nameByPid.has(pid)) nameByPid.set(pid, n);
        // 'uncategorized' gerçek bir atama değildir: klasör bilgisi geçerli kalır
        if (pid && c && c !== 'uncategorized' && !catByPid.has(pid)) catByPid.set(pid, c);
      };
      (cfg?.uploadedImages || []).forEach((img: { src?: string; name?: string; category?: string }) => add(img?.src, img?.name, img?.category));
      (cfg?.allSymbols || []).forEach((cat: { id?: string; symbols?: { src?: string; name?: string }[] }) =>
        (cat?.symbols || []).forEach((s: { src?: string; name?: string }) => add(s?.src, s?.name, cat?.id))
      );
      if (nameByPid.size > 0 || catByPid.size > 0) break; // ilk okunan yapılandırma yeterli
    } catch {
      continue;
    }
  }
  return { nameByPid, catByPid };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

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
    
    // Sadece gerekli alanları döndür.
    // 'kroki-olusturucu/objects/' klasörü: senkronun ağır base64 görselleri için içerik
    // adresli YEDEK deposudur — galeride sembol/görsel olarak gösterilmemeli,
    // Bulutu Tara ile kütüphaneye de alınmamalı (sadece sahne yedeği olarak yaşar).
    const assets = allResources
      .filter((r: any) => !(r.public_id || '').startsWith('kroki-olusturucu/objects/'))
      .map((r: any) => {
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

    // ADMİN İSİMLERİ + KATEGORİLER BİRLEŞTİR: semboller panelinde verilen isim ve
    // uygulamada atanan kategori, bulut kaydının da ismi/kategorisi olur.
    // KATEGORİ KURALI (klasör aynası): yapılandırmada GERÇEK bir kategori ataması
    // varsa (uncategorized değilse) o kazanır — admin uygulamada taşıdıysa bulut
    // listesi de yeni kategoriyi gösterir. Yapılandırmada atama yoksa/yok sayılırsa
    // Cloudinary klasör adı (klasör = kategori) esas alınır.
    try {
      const { nameByPid, catByPid } = await buildLibraryMaps(CLOUD_NAME);
      if (nameByPid.size > 0 || catByPid.size > 0) {
        assets.forEach((a: { id: string; name: string; category: string }) => {
          const libName = nameByPid.get(a.id);
          if (libName) a.name = libName;
          const libCat = catByPid.get(a.id);
          if (libCat) a.category = libCat;
        });
      }
    } catch (mergeErr) {
      console.error('Bulut isim/kategori birleştirme başarısız (klasör adlarıyla devam):', mergeErr);
    }

    return res.status(200).json({ assets });
  } catch (error: unknown) {
    console.error('Cloudinary List Error:', error);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
}
