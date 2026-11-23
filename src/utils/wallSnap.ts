/** =====================================================================================
 *  DUVARA MIKNATISLANMA (SNAP) MOTORU
 *  -------------------------------------------------------------------------------------
 *  Kapı / pencere / kepenk gibi duvar sembolleri, sürüklenirken veya yerleştirilirken
 *  en yakın duvar çizgisine TAM DÜZ oturtulur:
 *    • açı duvar çizgisinin açısına kilitlenir (yatay duvara 0°, dikey duvara 90°),
 *    • kapının KASA HATTI MERKEZİ (alt bandın ortası) duvar merkez çizgisiyle
 *      birebir üst üste gelir (0 px kayma),
 *    • duvarın uçlarından taşmaz (duvar boyu içine çekilir),
 *    • kapı hangi açıda ise duvara EN YAKIN YÜZÜ seçilir (180° ters çevrilmez).
 *  Mıknatıslanma aralık: duvara dik ~30 px, uç taşması ~40 px.
 *
 *  NOT: Bu hesap, canlı derlemeye uygulanan snmK yamasının birebir kaynağa
 *  işlenmiş hâlidir (bkz. workspace scripts/patch_kapi_yama.py P2).
 *  ===================================================================================== */

/** Snap'e uyan semboller (kapı / pencere / kepenk ailesi) */
export const DOORLIKE_SNAP_IDS = [
  'arch-d1r', 'arch-d1l', 'arch-win', 'arch-d2', 'arch-d3-slide',
  'arch-garden-gate', 'arch-kepenk', 'arch-opening',
];

/** Snap HEDEFİ olan duvar sembolleri (uç uca yapışma da bunlarla) */
export const WALLLIKE_IDS = [
  'arch-w1', 'arch-w1v', 'arch-w1i', 'arch-w1vi', 'arch-w-square',
  'arch-garden-wall', 'arch-parapet',
];

/** Kasa bandı pivotu alt %15'in ortasında (0.925h) olan semboller */
const CASING_IDS = ['arch-d1r', 'arch-d1l', 'arch-d2', 'arch-garden-gate'];

export interface WallSnapResult {
  x: number;
  y: number;
  rotation: number;
}

/**
 * Verilen nesne için en yakın duvara tam düz oturma sonucunu hesaplar.
 *
 * @param symbolId   sembol kimliği (DOORLIKE_SNAP_IDS içinde olmalı)
 * @param x,y        anchorMode=0 → nesne ORIGIN'i (sol-üst); anchorMode=1 → pivotun
 *                   kendisi (kasa hattı merkezi) — sayfa koordinatı
 * @param w,h        nesne boyutu
 * @param rotation   nesnenin mevcut açısı (derece)
 * @param objects    sahnedeki tüm nesneler
 * @param skipId     kendini hariç tutmak için nesne kimliği
 * @param anchorMode 0: origin girdisi, 1: pivot girdisi
 * @returns snap varsa {x, y, rotation} (x,y = ORIGIN konumu), yoksa null
 */
export const computeWallSnap = (
  symbolId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number,
  objects: any[],
  skipId?: string,
  anchorMode = 0,
): WallSnapResult | null => {
  if (!symbolId || !objects || !DOORLIKE_SNAP_IDS.includes(symbolId)) return null;

  const isCasing = CASING_IDS.includes(symbolId);
  const ay = isCasing ? 0.925 : 0.5;
  const axp = w / 2;
  const ayp = h * ay;
  const rr = ((rotation || 0) * Math.PI) / 180;
  const fx = anchorMode ? x : x + axp * Math.cos(rr) - ayp * Math.sin(rr);
  const fy = anchorMode ? y : y + axp * Math.sin(rr) + ayp * Math.cos(rr);

  let best: { phi: number; t: number; len: number; cx: number; cy: number; ux: number; uy: number } | null = null;
  let bd = 1e9;

  for (const S of objects) {
    if (!S || S.id === skipId || S.hidden || S.isTemplate) continue;
    if (!WALLLIKE_IDS.includes(S.symbolId || '') || S.symbolId === 'arch-w-square') continue;
    const sw = Number(S.width) || 0;
    const sh = Number(S.height) || 0;
    if (!sw || !sh) continue;
    const sr = ((Number(S.rotation) || 0) * Math.PI) / 180;
    const vert = sh > sw;
    const phi = sr + (vert ? Math.PI / 2 : 0);
    const len = Math.max(sw, sh);
    const cx = S.x + sw / 2 * Math.cos(sr) - sh / 2 * Math.sin(sr);
    const cy = S.y + sw / 2 * Math.sin(sr) + sh / 2 * Math.cos(sr);
    const dx = fx - cx;
    const dy = fy - cy;
    const ux = Math.cos(phi);
    const uy = Math.sin(phi);
    const nx = -uy;
    const ny = ux;
    const t = dx * ux + dy * uy;                       // duvar ekseni boyunca izdüşüm
    const p = dx * nx + dy * ny;                       // duvara dik uzaklık
    const over = Math.max(0, Math.abs(t) - len / 2);   // uçlardan taşma
    if (Math.abs(p) >= 30 || over >= 40) continue;
    const dist = Math.hypot(over, p);
    if (dist < bd) {
      bd = dist;
      best = { phi, t, len, cx, cy, ux, uy };
    }
  }

  if (!best) return null;

  // Duvar boyu içine çek (uçlardan taşma)
  const tc = Math.max(-best.len / 2, Math.min(best.len / 2, best.t));
  const pX = best.cx + best.ux * tc;
  const pY = best.cy + best.uy * tc;

  // Açı duvarın açısına kilitlenir; en yakın yüz seçilir (180° ters çevrilmez)
  let nd = ((best.phi * 180 / Math.PI) % 360 + 360) % 360;
  const cur = (((rotation || 0) % 360) + 360) % 360;
  let d1 = Math.abs(nd - cur) % 360;
  let d2 = Math.abs((nd + 180) % 360 - cur) % 360;
  d1 = Math.min(d1, 360 - d1);
  d2 = Math.min(d2, 360 - d2);
  if (d2 < d1) nd = (nd + 180) % 360;

  const nr = nd * Math.PI / 180;
  return {
    rotation: nd,
    x: pX - (axp * Math.cos(nr) - ayp * Math.sin(nr)),
    y: pY - (axp * Math.sin(nr) + ayp * Math.cos(nr)),
  };
};
