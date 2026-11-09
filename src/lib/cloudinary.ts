const CLOUD_NAME = 'dzen3qvgp';

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
 * Birleştirilen/eski kategori kimlik ve adları → yeni kategori kimliği.
 * 'Delil İşaretleri' (evidence) ile 'Delil Nesneleri' (evidence-items) tek sekmede
 * birleştirildi (id: delil-isaretleri). Bulutta eski klasörlere ('evidence',
 * 'evidence-items', 'Delil Nesneleri') yüklenmiş görseller kaybolmasın diye
 * hepsi yeni kategoriye eşlenir; yeni yüklemeler 'delil-isaretleri' klasörüne gider.
 */
const LEGACY_CATEGORY_ALIASES: Record<string, string> = {
  'evidence': 'delil-isaretleri',
  'evidence items': 'delil-isaretleri',
  'delil nesneleri': 'delil-isaretleri',
  'delil isaretleri': 'delil-isaretleri',
};

/**
 * Bulut klasör/kategori adını uygulamadaki kategori kimliğine (cat.id) eşler.
 * Örn: 'ARAÇLAR' -> 'vehicles', 'Delil İşaretleri' -> 'delil-isaretleri', 'vehicles' -> 'vehicles'.
 * Eşleşme yoksa 'uncategorized' döner — böylece buluttan yüklenen görseller
 * hayalet/uydurma kategorilere düşmez, kategori sistemi bozulmaz.
 */
export const mapCloudCategoryToId = (
  raw: string | undefined,
  allSymbols: readonly { id: string, name: string }[]
): string => {
  const key = normKey(raw);
  if (!key || key === 'uncategorized' || key === 'kroki olusturucu') return 'uncategorized';
  const alias = LEGACY_CATEGORY_ALIASES[key];
  if (alias) return alias;
  const hit = allSymbols.find((c) => normKey(c.name) === key || normKey(c.id) === key);
  return hit ? hit.id : 'uncategorized';
};

/** Kategori başlığı güzelleştirme: 'OKUL_FOTOGRALARI' / 'okul-fotograflari' -> 'Okul Fotograflari' */
const prettifyFolderName = (raw: string): string =>
  raw
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/(^|\s)([a-zçğıöşü])/g, (_m, p1, p2) => p1 + p2.toUpperCase());

/**
 * Bulut klasör adı güvenli hale getirme: Türkçe karakterler katlanır (ç→c, ğ→g...)
 * ve public_id beyaz listesi dışındaki karakterler alt çizgiye düşürülür. Klasör adı
 * dosya adıyla AYNI kuralla temizlenir ki /api/upload-to-cloudinary ve
 * /api/move-cloudinary doğrulamasından güvenle geçsin. Uygulama içi eşleştirme
 * normKey üzerinden yapıldığı için (ARACLAR ~ ARAÇLAR) kategori eşleşmesi bozulmaz.
 */
const sanitizeFolderName = (category?: string): string =>
  (category || 'uncategorized')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[^A-Za-z0-9._\-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .trim() || 'uncategorized';

/**
 * Bulut alt klasör adını uygulamadaki alt kategori (grup) etiketine eşler.
 * ALT KATEGORİ ↔ BULUT ALTKLASÖRÜ AYNASI: bilinen etiketlerden normKey ile eşleşen
 * varsa ONUN birebir etiketi kullanılır ('Ucaklar' klasörü -> uygulamadaki 'Uçaklar'
 * etiketi); bilinmeyense klasör adı güzelleştirilip etiket olur. Boş/eksik girdi ''
 * döner — uygulamada DİĞER başlığına düşer.
 */
export const mapCloudGroupLabel = (raw: string | undefined, knownGroups: readonly string[]): string => {
  const key = normKey(raw);
  if (!key) return '';
  const hit = knownGroups.find((g) => normKey(g) === key);
  if (hit) return hit;
  return prettifyFolderName(String(raw)) || String(raw).trim();
};

/**
 * KATEGORİ ↔ BULUT KLASÖRÜ AYNASI: bulut klasör adını kategori kimliğine eşler;
 * eşleşen kategori YOKSA YENİ KATEGORİ OLUŞTURUR (id = klasörün birebir adı).
 *
 * Kullanıcı bulutta klasör yarattıysa ('OKULLAR' gibi) görselleri o klasörde
 * kalmalıdır: tarama/galeri aktarımı bilinmeyen klasörleri 'uncategorized'a
 * DÜŞÜRMEZ, klasörün aynısı adlı bir kategori açar. id klasör adının birebir
 * kendisi tutulur ki sonraki yüklemeler de AYNI bulut klasörüne yazılsın
 * (cloud.upload klasör olarak kategori kimliğini kullanır). Eşleşme normKey
 * üzerinden yapıldığı için Türkçe karakter/büyük-küçük farkları tolere edilir.
 *
 * created=true dönerse çağıran allSymbols'ı store'a uygulamalı ve senkronlamalıdır.
 */
export const ensureCategoryForFolder = (
  raw: string | undefined,
  allSymbols: readonly { id: string, name: string, symbols?: any[] }[]
): { id: string, name: string, created: boolean, allSymbols: any[] } => {
  const key = normKey(raw);
  if (!key || key === 'uncategorized' || key === 'kroki olusturucu') {
    return { id: 'uncategorized', name: 'Uncategorized', created: false, allSymbols: allSymbols as any[] };
  }
  const alias = LEGACY_CATEGORY_ALIASES[key];
  if (alias) {
    const aliasCat = allSymbols.find((c) => c.id === alias);
    if (aliasCat) return { id: alias, name: aliasCat.name, created: false, allSymbols: allSymbols as any[] };
  }
  const hit = allSymbols.find((c) => normKey(c.name) === key || normKey(c.id) === key);
  if (hit) return { id: hit.id, name: hit.name, created: false, allSymbols: allSymbols as any[] };

  // Yeni kategori: kimlik = bulut klasör adının birebir kendisi (klasör aynası korunur)
  const rawName = (raw || '').toString().trim();
  const id = rawName || key;
  const name = prettifyFolderName(id) || id;
  return {
    id,
    name,
    created: true,
    allSymbols: [...(allSymbols as any[]), { id, name, symbols: [] }],
  };
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
  upload: async (file: Blob | string, fileName: string, category?: string, authToken?: string, group?: string): Promise<string> => {
    try {
      // Blob'ları data URI'ye çevir (imzalı API veri URI bekler)
      let dataUri: string;
      if (typeof file === 'string') {
        dataUri = file;
      } else {
        dataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Dosya okunamadı'));
          reader.readAsDataURL(file);
        });
      }
      if (!dataUri || !dataUri.startsWith('data:')) {
        throw new Error('Geçersiz görsel verisi');
      }

      // İmzasız preset Cloudinary'de beyaz listede olmadığı için ("Upload preset must be
      // whitelisted for unsigned uploads") yükleme artık imzalı sunucu API'si üzerinden yapılır.
      // Türkçe karakterler katlanır (ç→c, ğ→g...) ki dosya adları aramada/mükerrer kontrolde tutarlı olsun.
      const safeName = (fileName || 'gorsel')
        .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
        .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
        .replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const catFolder = sanitizeFolderName(
        (category && category !== 'uncategorized') ? category : 'uncategorized'
      );
      // ALT KATEGORİ ↔ BULUT ALTKLASÖRÜ AYNASI: alt kategorisi olan görsel, kategori
      // klasörü İÇİNDE kendi alt kategori klasörüne yazılır
      // (kroki-olusturucu/<Kategori>/<Alt Kategori>/<dosya>) — bulut klasör ağacı
      // uygulamadaki başlık düzenini birebir yansıtır. Alt kategori boşsa (DİĞER)
      // görsel kategori klasörünün kökünde kalır.
      const groupFolder = sanitizeFolderName(group || '');
      const publicId = groupFolder
        ? `kroki-olusturucu/${catFolder}/${groupFolder}/${safeName}`
        : `kroki-olusturucu/${catFolder}/${safeName}`;

      const response = await fetch('/api/upload-to-cloudinary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authToken || '',
        },
        body: JSON.stringify({ publicId, dataUri, tag: 'kroki-olusturucu' }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Cloudinary yükleme hatası (HTTP ${response.status})`);
      }

      const data = await response.json();
      if (!data.secure_url) throw new Error('Bulut adresi alınamadı');
      return data.secure_url;
    } catch (error) {
      console.error('Cloudinary Upload Error:', error);
      throw error;
    }
  },

  /**
   * KATEGORİ ↔ BULUT KLASÖRÜ AYNASI: görseli bulutta hedef kategorinin klasörüne
   * TAŞIR (imzalı /api/move-cloudinary ile kopyalar). Eski kopya bilinçli olarak
   * silinmez — tuvale eklenmiş nesneler eski URL ile çizmeye devam eder.
   * Başarılıysa yeni secure_url döner; taşıma gerekmez/başarısızsa null.
   */
  move: async (url: string, category?: string, authToken?: string, group?: string): Promise<{ publicId: string, secureUrl: string } | null> => {
    try {
      const fromPid = publicIdFromUrl(url);
      if (!fromPid) return null;
      const catFolder = sanitizeFolderName(
        (category && category !== 'uncategorized') ? category : 'uncategorized'
      );
      // Hedef: kategori klasörü + varsa alt kategori alt klasörü (klasör aynası)
      const groupFolder = sanitizeFolderName(group || '');
      const fileName = fromPid.split('/').pop() || 'gorsel';
      const toPid = groupFolder
        ? `kroki-olusturucu/${catFolder}/${groupFolder}/${fileName}`
        : `kroki-olusturucu/${catFolder}/${fileName}`;
      if (toPid === fromPid) return null; // zaten doğru klasörde

      const response = await fetch('/api/move-cloudinary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authToken || '',
        },
        body: JSON.stringify({ fromPublicId: fromPid, toPublicId: toPid }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Klasör taşıma başarısız (HTTP ${response.status})`);
      }
      const data = await response.json();
      if (!data.secure_url) return null;
      return { publicId: data.public_id || toPid, secureUrl: data.secure_url };
    } catch (error) {
      console.error('Cloudinary Move Error:', error);
      return null;
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
        throw new Error(errorData.error || `Yedekleme başarısız (HTTP ${response.status})`);
      }

      return await response.json();
    } catch (error) {
      console.error('Cloudinary Save Error:', error);
      throw error;
    }
  },

  // Verileri geri yükle
  load: async (authToken?: string): Promise<any> => {
    // Zaman aşımı: CDN yanıtsız kalırsa uygulama açılışı sonsuza dek spinner'da kalmasın
    const fetchWithTimeout = (url: string, ms = 12000): Promise<Response> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
    };
    // 1) YETKİLİ YOL (tercih edilen): /api/load-config, Cloudinary Admin API üzerinden
    //    kaydın SÜRÜMLÜ adresini alır ve içeriği sunucu tarafında çeker. Sürümlü URL
    //    önbellek anahtarı benzersiz olduğu için invalidate=true gecikmesinden ETKİLENMEZ —
    //    bayat kopya riski kalmaz. Yetki yoksa / API yoksa (electron) CDN'e düşer.
    if (authToken) {
      try {
        const apiRes = await fetchWithTimeout('/api/load-config');
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData && apiData.config) return apiData.config;
        }
      } catch {
        // Aşağıdaki CDN yollarına düş
      }
    }
    try {
      // Hem .json uzantılı hem uzantısız deniyoruz (Cloudinary raw dosyaları bazen otomatik uzantı ekler)
      // Not: '?v=' sorgusu Cloudinary CDN önbellek anahtarına dahil DEĞİLDİR; gerçek tazelik
      // store tarafındaki _revAt/timestamp kontrolü ile sağlanır.
      const urls = [
        `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/kroki_config_v2`,
        `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/kroki_config_v2.json`
      ];

      for (const url of urls) {
        try {
          const response = await fetchWithTimeout(url);
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
  delete: async (url: string, authToken?: string): Promise<{ success: boolean; error?: string }> => {
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
        const data = await response.json().catch(() => ({} as any));
        if (!response.ok || data?.error) {
          console.error('Cloudinary delete error:', data?.error || response.status);
          return { success: false, error: data?.error || `Silme başarısız (HTTP ${response.status})` };
        }
        return { success: true };
      } catch (error) {
        console.error('Cloudinary delete error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Silme başarısız' };
      }
    }
    
    return { success: true };
  }
};
