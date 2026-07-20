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
