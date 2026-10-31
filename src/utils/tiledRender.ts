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
  'st-1': 'strip-auto',              // Düz Yol (şerit çizgileri X'te tekrar eder)
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
  type?: string;
}

/** Göreli eşik: nesne, görselin doğal en-boy oranına göre bu kadar uzar/sıkışırsa şerit moduna geçer. */
export const ADAPTIVE_ASPECT_THRESHOLD = 2.0;
/** Mutlak eşik: uzun eksen görselin doğal piksel boyutunun bu katına çıkarsa… */
export const ADAPTIVE_LEN_SCALE = 2.4;
/** …ve kesit (kısa eksen) doğal boyutunun bu katını aşmıyorsa şerit moduna geç. */
export const ADAPTIVE_CROSS_SCALE = 1.35;

/**
 * Nesnenin etkin desen modunu çözümler:
 * 1) Nesnede açık seçim varsa ('auto' dahil) o kazanır.
 * 2) 'auto' veya tanımsızsa kütüphane metadata'sına bak.
 * 3) Metadata yoksa ADAPTİF kural: görsel, doğal oranına/boyutuna göre belirgin bir
 *    uzun şerit haline geldiyse (yol/refüj/şerit dokularının tipik uzatması) desen
 *    tekrarına geç; değilse klasik esnetme ('stretch').
 *    → Kullanıcının yüklediği yol/refüj dokuları için metadata gerekmez.
 */
export function resolveTileMode(
  obj: TileModeSource | null | undefined,
  w?: number,
  h?: number,
  imgW?: number,
  imgH?: number
): TileMode {
  if (!obj) return 'stretch';
  const explicit = obj.tileMode;
  if (explicit && explicit !== 'auto') return explicit;
  const meta = obj.symbolId ? SYMBOL_TILE_MODES[obj.symbolId] : undefined;
  if (meta) return meta;

  // ADAPTİF: kütüphane metadata'sı olmayan görseller (kullanıcı yüklemeleri dahil)
  if (w && h && imgW && imgH && (obj.type === 'symbol' || obj.type === 'image' || !obj.type)) {
    const nativeRatio = imgW / imgH;
    if (nativeRatio > 0) {
      const rel = w / h / nativeRatio;
      if (rel >= ADAPTIVE_ASPECT_THRESHOLD) return 'strip-x';
      if (rel <= 1 / ADAPTIVE_ASPECT_THRESHOLD) return 'strip-y';
    }
    const sx = w / imgW;
    const sy = h / imgH;
    if (sx >= ADAPTIVE_LEN_SCALE && sy <= ADAPTIVE_CROSS_SCALE) return 'strip-x';
    if (sy >= ADAPTIVE_LEN_SCALE && sx <= ADAPTIVE_CROSS_SCALE) return 'strip-y';
  }
  return 'stretch';
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

/* =====================================================================================
 * UZATMA MOTORU v4 — KAPAK+KESİT (3-slice) ve TAHIL YÖNÜ (grain) FARKINDALIĞI
 *
 * v2/v3'ün iki zaafı kullanıcı yüklemelerinde ortaya çıktı:
 *  1) BÜTÜN görsel karo olarak tekrarlıyordu → yolun UÇLARI (kapak bölgeleri) yolun
 *     ortasında da tekrar edince görsel "parçalanıyor" görünüyordu.
 *  2) Şerit yönü yalnızca nesne en/boy oranına bakarak seçiliyordu → dikey yollu
 *     (portre) dokuya yatay uzatma uygulandığında desen yanlış eksende tekrar
 *     edip yine parçalanıyordu.
 *
 * v4 çözümü:
 *  - getTextureInfo(): dokuyu bir kez küçük bir tuvalde analiz eder —
 *      • grain: yolun/çizgilerin hangi eksende uzandığı (yatay kenar enerjisi EH,
 *        dikey kenar enerjisi EV karşılaştırılır),
 *      • cutA/cutB: kesit bandının kesilme noktaları — geçiş maliyeti (kenar
 *        gradyanı) en düşük sütun/satır seçilir → kesikli çizgiler bozulmaz.
 *  - resolveConcreteTileMode(): metadata'sız yüklemelerde şerit yönü TAHIL yönüne
 *    göre atanır; nesne tahıla dik uzatılmışsa esnetmeye döner (parçalanma yok).
 *  - drawStripCaps(): uçlar SABİT çizilir, yalnızca orta bant kesit-fit ölçekle
 *    tekrar eder → yol uçları ortada tekrar etmez, kesikli çizgiler bozulmaz.
 * ===================================================================================== */

export interface TexInfo {
  grain: 'x' | 'y';
  /** Kesit bandı başlangıcı (grain ekseninde, kaynak px) */
  cutA: number;
  /** Kesit bandı sonu (grain ekseninde, kaynak px) */
  cutB: number;
  iw: number;
  ih: number;
}

const texInfoCache = new Map<string, TexInfo>();
const ANALYSIS_SIZE = 96;

/** Dokuyu bir kez analiz eder ve önbelleğe alır (img.src başına). */
export function getTextureInfo(img: HTMLImageElement): TexInfo | null {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;
  const key = img.src || '';
  const cached = key ? texInfoCache.get(key) : undefined;
  if (cached) return cached;
  const info = analyzeTexture(img, iw, ih);
  if (key) {
    texInfoCache.set(key, info);
    if (texInfoCache.size > 60) {
      const first = texInfoCache.keys().next().value;
      if (first) texInfoCache.delete(first);
    }
  }
  return info;
}

function analyzeTexture(img: HTMLImageElement, iw: number, ih: number): TexInfo {
  const dimGrain: 'x' | 'y' = iw >= ih ? 'x' : 'y';
  const fallback = (): TexInfo =>
    dimGrain === 'x'
      ? { grain: 'x', cutA: Math.round(iw * 0.25), cutB: Math.round(iw * 0.75), iw, ih }
      : { grain: 'y', cutA: Math.round(ih * 0.25), cutB: Math.round(ih * 0.75), iw, ih };
  try {
    const W = Math.max(8, Math.min(ANALYSIS_SIZE, iw));
    const H = Math.max(8, Math.round(ih * (W / iw)));
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const cx = c.getContext('2d', { willReadFrequently: true });
    if (!cx) return fallback();
    cx.drawImage(img, 0, 0, W, H);
    const d = cx.getImageData(0, 0, W, H).data; // CORS-taint durumunda fırlatır → fallback
    const N = W * H;
    const L = new Float32Array(N);
    const A = new Float32Array(N);
    for (let i = 0, p = 0; i < N; i++, p += 4) {
      L[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
      A[i] = d[p + 3];
    }
    // Kenar enerjileri: EH büyük → yatay çizgiler → grain X; EV büyük → dikey çizgiler → grain Y
    let EH = 0;
    let EV = 0;
    for (let y = 1; y < H; y++) {
      for (let x = 0; x < W; x++) EH += Math.abs(L[y * W + x] - L[(y - 1) * W + x]);
    }
    for (let y = 0; y < H; y++) {
      for (let x = 1; x < W; x++) EV += Math.abs(L[y * W + x] - L[y * W + x - 1]);
    }
    let grain: 'x' | 'y';
    if (EH > EV * 1.12) grain = 'x';
    else if (EV > EH * 1.12) grain = 'y';
    else grain = dimGrain;

    // Kesit bant kesim noktaları — BİRLEŞİK seçim: iki kesim sütunu/satırı BİRBİRİNE
    // benzemeli (join maliyeti) → karo dikişsiz devam eder; ayrıca her iki kesim
    // noktasının kendi geçiş maliyeti de düşük olmalı (kesikli çizgi bozulmaz).
    const colSig = (k: number): Float32Array | null => {
      const sig = new Float32Array(grain === 'x' ? H : W);
      if (grain === 'x') {
        for (let y = 0; y < H; y++) sig[y] = L[y * W + k] * 1.4 + (A[y * W + k] / 255) * 0.6;
      } else {
        for (let x = 0; x < W; x++) sig[x] = L[k * W + x] * 1.4 + (A[k * W + x] / 255) * 0.6;
      }
      return sig;
    };
    const quietCost = (k: number): number => {
      let q = 0;
      if (grain === 'x') {
        for (let y = 0; y < H; y++) {
          q += Math.abs(L[y * W + k] - L[y * W + k - 1]) + 0.6 * Math.abs(A[y * W + k] - A[y * W + k - 1]);
        }
      } else {
        for (let x = 0; x < W; x++) {
          q += Math.abs(L[k * W + x] - L[(k - 1) * W + x]) + 0.6 * Math.abs(A[k * W + x] - A[(k - 1) * W + x]);
        }
      }
      return q;
    };
    const axisMax = grain === 'x' ? W : H;
    const pickCuts = (): { a: number; b: number } => {
      const fromA = Math.max(1, Math.round(0.15 * axisMax));
      const toA = Math.round(0.35 * axisMax);
      const fromB = Math.round(0.65 * axisMax);
      const toB = Math.min(axisMax - 2, Math.round(0.85 * axisMax));
      let best = { a: fromA, b: fromB };
      let bestCost = Infinity;
      for (let ka = fromA; ka <= toA; ka++) {
        const sa = colSig(ka);
        if (!sa) continue;
        for (let kb = fromB; kb <= toB; kb++) {
          const sb = colSig(kb);
          if (!sb) continue;
          let join = 0;
          for (let i = 0; i < sb.length; i++) join += Math.abs(sa[i] - sb[i]);
          const total = join + 0.35 * (quietCost(ka) + quietCost(kb));
          if (total < bestCost) {
            bestCost = total;
            best = { a: ka, b: kb };
          }
        }
      }
      return best;
    };

    let cutA: number;
    let cutB: number;
    const picked = pickCuts();
    if (grain === 'x') {
      cutA = Math.round((picked.a * iw) / W);
      cutB = Math.round((picked.b * iw) / W);
      if (cutB - cutA < iw * 0.25) {
        cutA = Math.round(iw * 0.25);
        cutB = Math.round(iw * 0.75);
      }
    } else {
      cutA = Math.round((picked.a * ih) / H);
      cutB = Math.round((picked.b * ih) / H);
      if (cutB - cutA < ih * 0.25) {
        cutA = Math.round(ih * 0.25);
        cutB = Math.round(ih * 0.75);
      }
    }
    return { grain, cutA, cutB, iw, ih };
  } catch {
    return fallback();
  }
}

export interface ResolvedTile {
  mode: TileMode;
  /** true → uçlar sabit, orta bant tekrar eder (kapak+kesit çizimi) */
  caps: boolean;
}

/**
 * Somut desen modunu çözümler (v4). Metadata'lı kütüphane dokuları eskisi gibi
 * bütün-görsel tiling kullanır; metadata'sız yüklemeler grain-farkındalıklı
 * kapak+kesit moduna geçer.
 */
export function resolveConcreteTileMode(
  obj: TileModeSource | null | undefined,
  w: number,
  h: number,
  imgW: number,
  imgH: number,
  tex: TexInfo | null
): ResolvedTile {
  if (!obj || !w || !h) return { mode: 'stretch', caps: false };
  const explicit = obj.tileMode;
  const meta = obj.symbolId ? SYMBOL_TILE_MODES[obj.symbolId] : undefined;

  if (explicit === 'strip-x') return { mode: 'strip-x', caps: !meta };
  if (explicit === 'strip-y') return { mode: 'strip-y', caps: !meta };
  if (explicit === 'tile') return { mode: 'tile', caps: false };

  // Kütüphane metadata'sı — güvenilir, kusursuz karo dokular: eski davranış.
  if (meta) {
    if (meta === 'strip-auto') return { mode: w >= h ? 'strip-x' : 'strip-y', caps: false };
    return { mode: meta, caps: false };
  }

  // ——— Metadata yok (kullanıcı yüklemeleri / bilinmeyen görseller) ———
  const iw = imgW || (tex ? tex.iw : 0);
  const ih = imgH || (tex ? tex.ih : 0);
  if (!iw || !ih) return { mode: 'stretch', caps: false };
  const grain: 'x' | 'y' = tex ? tex.grain : iw >= ih ? 'x' : 'y';
  const E: 'x' | 'y' = w >= h ? 'x' : 'y';

  // Boyutlandırma sırasında işaretlenmiş strip-auto: yalnızca tahıl yönünde uzama varsa şerit.
  if (explicit === 'strip-auto') {
    if (E !== grain) return { mode: 'stretch', caps: false };
    const elong = grain === 'x' ? (w / h) / (iw / ih) : (h / w) / (ih / iw);
    if (elong < 1.3) return { mode: 'stretch', caps: false };
    return { mode: grain === 'x' ? 'strip-x' : 'strip-y', caps: true };
  }

  // 'auto' / tanımsız → adaptif kural (grain kapısıyla)
  if (obj.type === 'symbol' || obj.type === 'image' || !obj.type) {
    if (grain === 'x') {
      const rel = (w / h) / (iw / ih);
      if (rel >= ADAPTIVE_ASPECT_THRESHOLD) return { mode: 'strip-x', caps: true };
      const sx = w / iw;
      const sy = h / ih;
      if (sx >= ADAPTIVE_LEN_SCALE && sy <= ADAPTIVE_CROSS_SCALE) return { mode: 'strip-x', caps: true };
    } else {
      const rel = (h / w) / (ih / iw);
      if (rel >= ADAPTIVE_ASPECT_THRESHOLD) return { mode: 'strip-y', caps: true };
      const sy = h / ih;
      const sx = w / iw;
      if (sy >= ADAPTIVE_LEN_SCALE && sx <= ADAPTIVE_CROSS_SCALE) return { mode: 'strip-y', caps: true };
    }
  }
  return { mode: 'stretch', caps: false };
}

/**
 * KAPAK+KESİT çizimi: uç bölgeleri sabit, orta bant kesit-fit ölçekle tekrar eder.
 * ctx, çıkış motorunun translate/scale dönüşümü altındadır (0,0 — nesne köşesi).
 * Başarılıysa true döner.
 */
export function drawStripCaps(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  mode: 'strip-x' | 'strip-y',
  tex: TexInfo | null
): boolean {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih || !w || !h) return false;
  const t = tex || getTextureInfo(img);

  if (mode === 'strip-x') {
    const s = h / ih;
    const cutA = t ? t.cutA : Math.round(iw * 0.25);
    const cutB = t ? t.cutB : Math.round(iw * 0.75);
    const srcMid = cutB - cutA;
    // TAM SAYI konumlandırma: alt-piksel boşlukları (beyaz çizgi artefaktı) olmasın.
    const capAi = Math.round(cutA * s);
    const capBi = Math.round((iw - cutB) * s);
    const avail = w - capAi - capBi;
    const midW = srcMid * s;
    if (avail < midW * 0.45 || avail < 2) return false;
    const n = Math.max(1, Math.round(avail / midW));
    const tileWi = Math.round(avail / n);
    for (let i = 0; i < n; i++) {
      const x = capAi + i * tileWi;
      const drawW = Math.min(tileWi, w - capBi - x);
      if (drawW <= 0) break;
      ctx.drawImage(img, cutA, 0, srcMid, ih, x, 0, drawW, h);
    }
    // Kapaklar en üste (bant taşmalarını örter)
    if (capAi > 0) ctx.drawImage(img, 0, 0, cutA, ih, 0, 0, capAi, h);
    if (capBi > 0) ctx.drawImage(img, cutB, 0, iw - cutB, ih, w - capBi, 0, capBi, h);
    return true;
  }

  // strip-y
  const s = w / iw;
  const cutA = t ? t.cutA : Math.round(ih * 0.25);
  const cutB = t ? t.cutB : Math.round(ih * 0.75);
  const srcMid = cutB - cutA;
  const capAi = Math.round(cutA * s);
  const capBi = Math.round((ih - cutB) * s);
  const avail = h - capAi - capBi;
  const midH = srcMid * s;
  if (avail < midH * 0.45 || avail < 2) return false;
  const n = Math.max(1, Math.round(avail / midH));
  const tileHi = Math.round(avail / n);
  for (let i = 0; i < n; i++) {
    const y = capAi + i * tileHi;
    const drawH = Math.min(tileHi, h - capBi - y);
    if (drawH <= 0) break;
    ctx.drawImage(img, 0, cutA, iw, srcMid, 0, y, w, drawH);
  }
  if (capAi > 0) ctx.drawImage(img, 0, 0, iw, cutA, 0, 0, w, capAi);
  if (capBi > 0) ctx.drawImage(img, 0, cutB, iw, ih - cutB, 0, h - capBi, w, capBi);
  return true;
}

/** Ekran (Konva) tarafı: kapak+kesit kompozitini tuval olarak üretir. */
const composedCache = new Map<string, HTMLCanvasElement>();

export function composeStripCanvas(
  img: HTMLImageElement,
  w: number,
  h: number,
  mode: 'strip-x' | 'strip-y'
): HTMLCanvasElement | null {
  const W = Math.round(w);
  const H = Math.round(h);
  if (!W || !H || W > 4096 || H > 4096) return null;
  const key = `${img.src || ''}|${W}x${H}|${mode}`;
  const cached = composedCache.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const cx = c.getContext('2d');
  if (!cx) return null;
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = 'high';
  if (!drawStripCaps(cx, img, W, H, mode, getTextureInfo(img))) return null;
  composedCache.set(key, c);
  if (composedCache.size > 12) {
    const first = composedCache.keys().next().value;
    if (first) composedCache.delete(first);
  }
  return c;
}
