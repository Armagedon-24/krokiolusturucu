/**
 * Forensic Sketching Canvas Utilities
 */

/**
 * Calculates the bounding box size for an annotation callout based on text content.
 */
export const calculateCalloutSize = (text: string, fontSize: number = 14) => {
  const lines = text.split('\n');
  const maxChars = Math.max(...lines.map(l => l.length), 1);
  const charWidth = fontSize * 0.6;
  const lineHeight = fontSize * 1.3;
  
  const w = Math.max(60, maxChars * charWidth + 20); // Minimal padding
  const boxH = Math.max(30, lines.length * lineHeight + 15);
  const h = boxH * 1.33; // Add tail height proportionally
  
  return { w, h };
};

/**
 * Determines the effective Z-Index for an object, accounting for template layers.
 */
export const getEffectiveZIndex = (obj: any) => {
  if (obj.isTemplate) {
    if (obj.zIndex < 0) return obj.zIndex; 
    return (obj.zIndex || 0) + 100000; 
  }
  return obj.zIndex || 0;
};

/**
 * Resizes and aggressively compresses an image (File, Blob, or Data URL) to optimize performance on weak computers.
 * Reduces dimensions to max 600px and compresses quality to 0.45 JPEG (ultra lightweight, ~20-50KB per image).
 */
export const compressAndResizeImage = (
  input: File | Blob | string,
  maxWidth: number = 600,
  maxHeight: number = 600,
  quality: number = 0.45
): Promise<string> => {
  return new Promise((resolve) => {
    const processImage = (src: string) => {
      const img = new Image();
      const isDataOrBlob = src.startsWith('data:') || src.startsWith('blob:');
      if (!isDataOrBlob) img.crossOrigin = 'Anonymous';

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Downscale dimensions if larger than maxWidth/maxHeight
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        } else if (width > 400 || height > 400) {
          // Downscale medium images by 30% for ultra-fast rendering on weak PCs
          width = Math.round(width * 0.7);
          height = Math.round(height * 0.7);
        }

        width = Math.max(width, 40);
        height = Math.max(height, 40);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          return resolve(src);
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(img, 0, 0, width, height);

        // Export highly compressed image as JPEG data URL at quality 0.45 (ultra-lightweight ~20-50KB)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        resolve(typeof input === 'string' ? input : src);
      };

      img.src = src;
    };

    if (typeof input === 'string') {
      processImage(input);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          processImage(e.target.result as string);
        } else {
          resolve('');
        }
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(input);
    }
  });
};

/**
 * Sembol yükleme işleyicisi: görseli yeniden boyutlandırır, hangi formatta gelirse gelsin
 * PNG olarak dışa aktarır ve beyaz arka planı şeffaf yapar.
 *
 * Yöntem (kenarlardan flood-fill): sadece görüntü kenarlarına bağlı beyaz alanlar
 * şeffaflaşır; çizim içindeki beyazlar (iç boşluklar) korunur. JPEG artefaktlarına
 * karşı eşik + kenar yumuşatma + izole gürültü noktası temizliği uygulanır.
 */
export const processUploadedSymbolImage = (
  input: File | Blob | string,
  maxWidth: number = 600,
  maxHeight: number = 600
): Promise<string> => {
  return new Promise((resolve) => {
    const processImage = (src: string) => {
      const img = new Image();
      const isDataOrBlob = src.startsWith('data:') || src.startsWith('blob:');
      if (!isDataOrBlob) img.crossOrigin = 'Anonymous';

      img.onload = () => {
        try {
          let width = img.width || img.naturalWidth;
          let height = img.height || img.naturalHeight;
          if (!width || !height) {
            width = 600; height = 600;
          }

          // compressAndResizeImage ile aynı boyutlandırma politikası
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          } else if (width > 400 || height > 400) {
            width = Math.round(width * 0.7);
            height = Math.round(height * 0.7);
          }
          width = Math.max(width, 40);
          height = Math.max(height, 40);

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return resolve(typeof input === 'string' ? input : src);

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'medium';
          // DİKKAT: beyaz zemin doldurulmaz — şeffaf zemin üzerine çizilir
          ctx.drawImage(img, 0, 0, width, height);

          const imageData = ctx.getImageData(0, 0, width, height);
          removeWhiteBackgroundInPlace(imageData);
          ctx.putImageData(imageData, 0, 0);

          resolve(canvas.toDataURL('image/png'));
        } catch (err) {
          console.error('processUploadedSymbolImage error:', err);
          resolve(typeof input === 'string' ? input : src);
        }
      };

      img.onerror = () => resolve(typeof input === 'string' ? input : src);
      img.src = src;
    };

    if (typeof input === 'string') {
      processImage(input);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          processImage(e.target.result as string);
        } else {
          resolve('');
        }
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(input);
    }
  });
};

/**
 * ImageData üzerinde beyaz arka planı şeffaflaştırır (yerinde düzenleme).
 * - min(r,g,b) >= 240 → beyaz adayı
 * - kenarlardan bağlantılı beyaz bölgeler → tamamen şeffaf
 * - 60px'ten küçük izolasyonlu parçalar (JPEG gürültüsü) → şeffaf
 * - çizim çekirdeği → tam opak; kenar bandı → beyazlığa bağlı yumuşak alpha
 */
const removeWhiteBackgroundInPlace = (imageData: ImageData): void => {
  const { width: w, height: h, data } = imageData;
  const n = w * h;

  // min kanal değeri (beyazlık ölçütü)
  const minc = new Uint8Array(n);
  const nearWhite = new Uint8Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const m = Math.min(data[p], data[p + 1], data[p + 2]);
    minc[i] = m;
    nearWhite[i] = m >= 240 ? 1 : 0;
  }

  // 1) Kenarlardan flood-fill (stack tabanlı BFS)
  const bg = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const push = (idx: number) => {
    if (!nearWhite[idx] || bg[idx]) return;
    bg[idx] = 1;
    stack[sp++] = idx;
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }

  while (sp > 0) {
    const idx = stack[--sp];
    const x = idx % w;
    const y = (idx - x) / w;
    if (x > 0) push(idx - 1);
    if (x < w - 1) push(idx + 1);
    if (y > 0) push(idx - w);
    if (y < h - 1) push(idx + w);
  }

  // 2) İzole küçük parçaları (gürültü) temizle: fg bileşenlerini etiketle
  const fg = new Uint8Array(n);
  for (let i = 0; i < n; i++) fg[i] = bg[i] ? 0 : 1;

  const label = new Int32Array(n).fill(-1);
  const compStack = new Int32Array(n);
  let compCount = 0;
  const compSizes: number[] = [];
  for (let seed = 0; seed < n; seed++) {
    if (!fg[seed] || label[seed] !== -1) continue;
    const id = compCount++;
    let size = 0;
    let csp = 0;
    compStack[csp++] = seed;
    label[seed] = id;
    while (csp > 0) {
      const idx = compStack[--csp];
      size++;
      const x = idx % w;
      const y = (idx - x) / w;
      const tryPush = (nx: number, ny: number) => {
        const nidx = ny * w + nx;
        if (fg[nidx] && label[nidx] === -1) {
          label[nidx] = id;
          compStack[csp++] = nidx;
        }
      };
      if (x > 0) tryPush(x - 1, y);
      if (x < w - 1) tryPush(x + 1, y);
      if (y > 0) tryPush(x, y - 1);
      if (y < h - 1) tryPush(x, y + 1);
    }
    compSizes.push(size);
  }

  // Ana çizim = en büyük bileşen; 60px altı diğerleri gürültü → şeffaf
  let mainId = 0;
  for (let i = 1; i < compSizes.length; i++) {
    if (compSizes[i] > compSizes[mainId]) mainId = i;
  }
  const isNoise = new Uint8Array(compSizes.length);
  for (let i = 0; i < compSizes.length; i++) {
    isNoise[i] = i !== mainId && compSizes[i] < 60 ? 1 : 0;
  }
  for (let i = 0; i < n; i++) {
    if (fg[i] && isNoise[label[i]]) { fg[i] = 0; }
  }

  // 3) Alpha kanalını yaz: çekirdek opak, kenar bandı yumuşak geçiş
  for (let i = 0, p = 3; i < n; i++, p += 4) {
    if (!fg[i]) { data[p] = 0; continue; }
    // kenar bandı tespiti: fg ve komşularından biri bg
    const x = i % w;
    const y = (i - x) / w;
    const isEdge =
      (x > 0 && !fg[i - 1]) || (x < w - 1 && !fg[i + 1]) ||
      (y > 0 && !fg[i - w]) || (y < h - 1 && !fg[i + w]);
    if (isEdge) {
      // minc 200 → tam opak, 255 → tam şeffaf doğrusal geçiş
      const t = Math.min(Math.max((minc[i] - 200) / 55, 0), 1);
      data[p] = Math.round(255 * (1 - t));
    } else {
      data[p] = 255;
    }
  }
};
