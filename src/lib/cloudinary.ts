const CLOUD_NAME = 'dzen3qvgp';
const UPLOAD_PRESET = 'kroki-olusturucu';

/**
 * İsim/kategori karşılaştırması için ortak normalizasyon:
 * uzantı, özel karakter ve boşluk farklarını yok sayar; Türkçe karakterleri katlar
 * (ç→c, ğ→g, ı→i, ö→o, ş→s, ü→u). Böylece bulut klasör adları ile uygulama
 * kategori başlıkları/sembol adları güvenle eşleştirilir.
 */
export const normKey = (s?: string): string =>
  (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\?v=\d+$/, '')
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

/**
 * Bulut klasör/kategori adını uygulamadaki kategori kimliğine (cat.id) eşler.
 * Örn: 'ARAÇLAR' -> 'vehicles', 'Delil İşaretleri' -> 'evidence', 'vehicles' -> 'vehicles'.
 * Eşleşme yoksa 'uncategorized' döner — böylece buluttan yüklenen görseller
 * hayalet/uydurma kategorilere düşmez, kategori sistemi bozulmaz.
 */
export const mapCloudCategoryToId = (
  raw: string | undefined,
  allSymbols: readonly { id: string, name: string }[]
): string => {
  const key = normKey(raw);
  if (!key || key === 'uncategorized' || key === 'kroki olusturucu') return 'uncategorized';
  const hit = allSymbols.find((c) => normKey(c.name) === key || normKey(c.id) === key);
  return hit ? hit.id : 'uncategorized';
};

/**
 * Cloudinary URL'sinden transform parametrelerinden bağımsız benzersiz public_id türetir.
 * Mükerrer kontrolü ve silinen görsellerin yeniden gelmemesi için kullanılır.
 * Ör: https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto,w_80/v123/kroki-olusturucu/uncategorized/kedi.png
 *   -> 'kroki-olusturucu/uncategorized/kedi'
 */
export const publicIdFromUrl = (url: string): string | null => {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) return null;
  const idx = url.indexOf('/upload/');
  if (idx === -1) return null;
  const rest = url.substring(idx + 8).split('?')[0];
  const parts = rest.split('/').filter(Boolean);
  if (parts.length > 0 && /^v\d+$/.test(parts[0])) parts.shift();
  if (parts.length === 0) return null;
  const joined = parts.join('/');
  return joined.replace(/\.[a-zA-Z0-9]+$/, '') || joined;
};

export const getOptimizedCloudinaryUrl = (url: string, width = 80, height?: number): string => {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('res.cloudinary.com')) return url;
  if (url.includes('/f_auto,q_auto')) {
    // already optimized – update width if different
    return url.replace(/w_\d+/, `w_${width}`);
  }
  const transforms = height
    ? `f_auto,q_auto:low,w_${width},h_${height},c_fill`
    : `f_auto,q_auto:low,w_${width},c_limit`;
  return url.replace('/image/upload/', `/image/upload/${transforms}/`);
};

export const cloudinary = {
  upload: async (file: Blob | string, fileName: string, category?: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    // Kullanıcının isteği üzerine dosya adını birebir aynı tutuyoruz
    const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    formData.append('public_id', safeName); 
    
    // Kategoriye göre bulutta klasörleme yapıyoruz ve tag ekliyoruz
    formData.append('tags', 'kroki-olusturucu');
    if (category && category !== 'uncategorized') {
      formData.append('folder', `kroki-olusturucu/${category}`);
    } else {
      formData.append('folder', `kroki-olusturucu/uncategorized`);
    }

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Cloudinary yükleme hatası');
      }

      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error('Cloudinary Upload Error:', error);
      throw error;
    }
  },

  // Verileri senkronize et (Raw JSON olarak)
  save: async (uploadedImages: any[], allSymbols: readonly any[], projectState?: any, scenes?: any[], activeSceneId?: string | null, visualSettings?: any, authToken?: string) => {
    const config = { 
      uploadedImages, 
      allSymbols, 
      projectState, 
      scenes,
      activeSceneId,
      visualSettings,
      timestamp: Date.now() 
    };
    
    try {
      const response = await fetch('/api/save-config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-token': authToken || ''
        },
        body: JSON.stringify({ config })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Yapılandırma yedeklenemedi');
      }

      return await response.json();
    } catch (error) {
      console.error('Cloudinary Save Error:', error);
      throw error;
    }
  },

  // Verileri geri yükle
  load: async (): Promise<any> => {
    try {
      // Hem .json uzantılı hem uzantısız deniyoruz (Cloudinary raw dosyaları bazen otomatik uzantı ekler)
      const urls = [
        `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/kroki_config_v2?v=${Date.now()}`,
        `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/kroki_config_v2.json?v=${Date.now()}`
      ];

      for (const url of urls) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
  
            return data;
          }
        } catch {
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Cloudinary Load Error:', error);
      return null;
    }
  },

  // Silme işlemi
  delete: async (url: string, authToken?: string) => {
    // Cloudinary için backend API üzerinden sil
    if (url.includes('cloudinary.com')) {
      try {
        const response = await fetch('/api/delete-cloudinary', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-auth-token': authToken || ''
          },
          body: JSON.stringify({ url }),
        });
        return await response.json();
      } catch (error) {
        console.error('Cloudinary delete error:', error);
      }
    }
    
    return { success: true };
  }
};
