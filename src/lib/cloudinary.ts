const CLOUD_NAME = 'dzen3qvgp';
const UPLOAD_PRESET = 'kroki-olusturucu';

export const getOptimizedCloudinaryUrl = (url: string, width = 300): string => {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('res.cloudinary.com')) return url;
  if (url.includes('/f_auto,q_auto')) return url;
  return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${width},c_limit/`);
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
