import type { TileMode } from '../types';

/**
 * UZATMA MOTORU — görsel tabanlı semboller esnetilirken desenin bozulmasını önler.
 *
 * Üç fiziksel mod:
 *  - 'strip-x'  : Yatay şerit. Desen X ekseninde tekrar eder; desenin yüksekliği
 *                 nesne yüksekliğine ölçeklenir (kesit-fit). Uzatma bozulması olmaz.
 *  - 'strip-y'  : Dikey şerit. Desen Y ekseninde tekrar eder; desenin genişliği
 *                 nesne genişliğine ölçeklenir (kesit-fit). Dikey yollar/refüjler için.
 *  - 'tile'     : 2D karo. Desen hem X hem Y'de tekrar eder; karo ölçeği
 *                 min(w/imgW, h/imgH, 1) — yani doku asla büyütülmez, nesnenin
 *                 en dar ekseni kesit olarak alınır. Çukur/islak zemin/buz gibi
 *                 zemin dokuları için.
 *
 *  - 'strip-auto': şerit ama yön otomatik: yerel w >= h ise strip-x, değilse strip-y.
 *                  (Rotasyondan bağımsızdır — desen düğümün yerel koordinatında
 *                  döndüğüyle birlikte döner.)
 *
 * 'auto' (nesnede açık seçim) = kütüphane metadata'sına (SYMBOL_TILE_MODES) düş;
 * metadata yoksa normal esnetme ('stretch').
 */

/** Kütüphane sembolleri için desen modu metadata'sı (symbolId → mod). */
export const SYMBOL_TILE_MODES: Record<string, TileMode> = {
  // ——— Şerit semboller (uzatılabilir çizgiler) ———
  'tr-2': 'strip-auto',              // Lastik izi
  'tr-skid-straight': 'strip-auto',  // Fren izi
  'st-median': 'strip-auto',         // Orta refüj
  'st-sidewalk': 'strip-auto',       // Kaldırım
  'f-10': 'strip-auto',              // Yolluk
  'ei-security-tape': 'strip-auto',  // Güvenlik şeridi
  // ——— 2D zemin dokuları (karolar) ———
  'st-pothole': 'tile',              // Yol çukuru
  'st-wet': 'tile',                  // Islak zemin
  'st-ice': 'tile',                  // Buzlanma
  'st-parking-lot': 'tile',          // Otopark alanı
};

export interface TileModeSource {
  tileMode?: TileMode;
  symbolId?: string;
}

/**
 * Nesnenin etkin desen modunu çözümler:
 * 1) Nesnede açık seçim varsa ('auto' dahil) o kazanır.
 * 2) 'auto' veya tanımsızsa kütüphane metadata'sına bak.
 * 3) Metadata yoksa 'stretch' (klasik esnetme).
 */
export function resolveTileMode(obj: TileModeSource | null | undefined): TileMode {
  if (!obj) return 'stretch';
  const explicit = obj.tileMode;
  if (explicit && explicit !== 'auto') return explicit;
  const meta = obj.symbolId ? SYMBOL_TILE_MODES[obj.symbolId] : undefined;
  return meta || 'stretch';
}

/** 'strip-auto'yu yerel en/boy oranına göre somut yöne çevirir. */
export function orientStripMode(mode: TileMode, w: number, h: number): TileMode {
  if (mode !== 'strip-auto') return mode;
  return w >= h ? 'strip-x' : 'strip-y';
}

/**
 * Desen tekrarıyla çizer. Başarılıysa true döner; ctx.drawingPath üstünde
 * çağrıldığını varsayar (çıkış motorundaki translate/scale sonrası).
 */
export function drawTiledImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  mode: TileMode
): boolean {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih || !w || !h) return false;

  const concrete = orientStripMode(mode, w, h);
  let repeat: 'repeat' | 'repeat-x' | 'repeat-y';
  let s: number;
  let fw: number;
  let fh: number;
  if (concrete === 'strip-x') {
    // Kesit-fit: desen yüksekliği = nesne yüksekliği; X'te tekrar.
    s = h / ih;
    repeat = 'repeat-x';
    fw = w / s;
    fh = ih;
  } else if (concrete === 'strip-y') {
    // Kesit-fit: desen genişliği = nesne genişliği; Y'de tekrar.
    s = w / iw;
    repeat = 'repeat-y';
    fw = iw;
    fh = h / s;
  } else if (concrete === 'tile') {
    // Karo: tekdüze ölçek — doku asla büyütülmez, en dar eksen kesit olur.
    s = Math.min(w / iw, h / ih, 1);
    repeat = 'repeat';
    fw = w / s;
    fh = h / s;
  } else {
    return false;
  }

  const pat = ctx.createPattern(img, repeat);
  if (!pat) return false;
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, fw, fh);
  ctx.restore();
  return true;
}

/** Ekran (Konva) tarafı için desen parametreleri. */
export function tilePatternParams(
  mode: TileMode,
  w: number,
  h: number,
  imgW: number,
  imgH: number
): { repeat: 'repeat' | 'repeat-x' | 'repeat-y'; scale: number } {
  const concrete = orientStripMode(mode, w, h);
  if (concrete === 'strip-x') {
    return { repeat: 'repeat-x', scale: imgH > 0 ? h / imgH : 1 };
  }
  if (concrete === 'strip-y') {
    return { repeat: 'repeat-y', scale: imgW > 0 ? w / imgW : 1 };
  }
  // tile
  return { repeat: 'repeat', scale: Math.min(imgW > 0 ? w / imgW : 1, imgH > 0 ? h / imgH : 1, 1) };
}
