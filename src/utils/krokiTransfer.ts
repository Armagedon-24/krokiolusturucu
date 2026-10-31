import type { CanvasObject } from '../types';
import { KROKI_SRC, KROKI_NAME, KROKI_RATIO, type KrokiObj, type KrokiScenario } from '../data/krokiExamples';

/** Sembolün kategorisi (store symbolUsage ve özellik paneli için). */
const CATEGORY: Record<string, string> = {
  'p-3': 'people', 'p-4': 'people', 'p-9': 'people', 'p-13': 'people',
  'kk-child-lying': 'people', 'kk-injured': 'people',
  'v-sedan': 'vehicles', 'v-truck': 'vehicles', 'v-hatchback': 'vehicles', 'v-taxi': 'vehicles',
  'v-damaged-front': 'vehicles', 'v-overturned': 'vehicles', 'v-motor': 'vehicles',
  'v-motor-fallen': 'vehicles', 'v-ambulance': 'vehicles',
  'arch-w1i': 'architecture', 'arch-w1vi': 'architecture', 'arch-d1r': 'architecture',
  'arch-d1l': 'architecture', 'arch-d2': 'architecture', 'arch-win': 'architecture',
  'arch-w-square': 'architecture',
  'f-1': 'furniture', 'f-2': 'furniture', 'f-3': 'furniture', 'f-4': 'furniture',
  'f-5': 'furniture', 'f-8': 'furniture', 'f-9': 'furniture', 'f-10': 'furniture',
  'f-12': 'furniture', 'f-13': 'furniture',
  'w-1': 'weapons', 'w-2': 'weapons', 'w-3': 'weapons', 'w-5': 'weapons',
  'ei-lock-broken': 'evidence-items', 'ei-crowbar': 'evidence-items', 'ei-money': 'evidence-items',
  'ei-documents': 'evidence-items', 'ei-phone': 'evidence-items', 'ei-evidence-tag': 'evidence-items',
  'ei-evidence-bag': 'evidence-items', 'ei-hammer': 'evidence-items', 'ei-id-card': 'evidence-items',
  'ei-keys': 'evidence-items', 'ei-brick': 'evidence-items',
  'tr-skid-straight': 'traces', 'tr-skid-curved': 'traces', 'tr-liquid-pool': 'traces',
  'tr-bloody-footprint': 'traces', 'tr-footprint': 'traces', 'tr-casing-pistol': 'traces',
  'tr-bullet-wall': 'traces', 'tr-bullet-glass': 'traces', 'tr-mud': 'traces',
  'ev-circle': 'evidence', 'ev-square': 'evidence', 'ev-callout': 'evidence',
  'ev-camera-link': 'evidence', 'ev-scale-bar': 'evidence', 'ev-bpa-drop': 'evidence',
  'ev-shooting-trajectory': 'evidence',
  'a-4': 'arrows', 'a-5': 'arrows',
  'st-5': 'arrows',
  'ts-stop': 'traffic-signs', 'ts-cone': 'traffic-signs', 'ts-crossroads': 'traffic-signs',
  'ts-pedestrian': 'traffic-signs',
  'out-zebra': 'outdoor', 'out-traffic-light': 'outdoor', 'out-tree-1': 'outdoor',
  'out-cctv': 'outdoor', 'out-bench': 'outdoor', 'out-fixed-point': 'outdoor', 'out-pole': 'outdoor',
  'cl-helmet': 'clothing', 'cl-wallet': 'clothing', 'cl-shoe': 'clothing', 'cl-backpack': 'clothing',
};

const DEG = Math.PI / 180;
/** Kroki çerçevesi ile çizim alanı kenarı arasındaki boşluk (tasarım birimi). */
const PAD = 16;
/** Büyütme üst sınırı: çizim alanı tasarım alanından büyükse fazla büyütme. */
const MAX_SCALE = 1.6;

/** Sembol kutusunu orana göre sığdır (contain). ratio null/undefined → kutu aynen korunur. */
function fitBox(symId: string, w: number, h: number): { w: number; h: number } {
  const r = KROKI_RATIO[symId];
  if (r === undefined || r === null || !h || !w) return { w, h };
  const cur = w / h;
  if (cur > r) return { w: h * r, h };
  return { w, h: w / r };
}

/** Bir tasarım nesnesinin rotasyon dahil sınırlayıcı kutusu (tasarım uzayı). */
function bboxOf(o: KrokiObj): { x: number; y: number; w: number; h: number } {
  if (o.t === 'rect' || o.t === 'line') {
    return { x: o.x ?? 0, y: o.y ?? 0, w: o.w, h: o.h ?? o.w };
  }
  // sembol / metin: merkez tabanlı
  const w = o.w, h = o.h ?? o.w;
  const rad = (o.rot ?? 0) * DEG;
  const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
  const bw = w * c + h * s;
  const bh = w * s + h * c;
  return { x: (o.cx ?? 0) - bw / 2, y: (o.cy ?? 0) - bh / 2, w: bw, h: bh };
}

export interface KrokiArea { x: number; y: number; width: number; height: number }

/**
 * Kroki senaryosunu tuval nesnelerine dönüştürür.
 * Tasarım uzayı (900x1000) önce senaryonun kendi sınırlarına göre kırpılır,
 * sonra verilen çizim alanına (drawingArea) orantılı biçimde sığdırılır.
 * Çıkan her nesne tuvalde tek tek seçilip düzenlenebilir.
 */
export function buildKrokiObjects(sc: KrokiScenario, area: KrokiArea): Partial<CanvasObject>[] {
  const boxes = sc.objects.map(bboxOf);
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);

  const scale = Math.min((area.width - PAD * 2) / bw, (area.height - PAD * 2) / bh, MAX_SCALE);
  const ox = area.x + (area.width - bw * scale) / 2 - minX * scale;
  const oy = area.y + (area.height - bh * scale) / 2 - minY * scale;

  return sc.objects.map((o) => {
    if (o.t === 'rect') {
      return {
        type: 'rect' as const,
        x: (o.x ?? 0) * scale + ox,
        y: (o.y ?? 0) * scale + oy,
        width: o.w * scale,
        height: (o.h ?? o.w) * scale,
        rotation: o.rot ?? 0,
        fill: o.fill ?? 'transparent',
        stroke: o.stroke ?? '#000000',
        strokeWidth: o.sw ?? 1.5,
        ...(o.dash ? { dash: o.dash } : {}),
      };
    }
    if (o.t === 'line') {
      return {
        type: 'line' as const,
        x: (o.x ?? 0) * scale + ox,
        y: (o.y ?? 0) * scale + oy,
        width: o.w * scale,
        height: (o.h ?? o.w) * scale,
        rotation: o.rot ?? 0,
        fill: o.fill ?? '#000000',
        ...(o.dash ? { dash: o.dash } : {}),
      };
    }
    if (o.t === 'text') {
      const fs = Math.max(7, Math.round((o.fs ?? 10) * scale * 10) / 10);
      const width = o.w * scale;
      return {
        type: 'text' as const,
        text: o.text ?? '',
        x: (o.cx ?? 0) * scale + ox - width / 2,
        y: (o.cy ?? 0) * scale + oy - (fs * 0.7),
        width,
        fontSize: fs,
        fontStyle: o.bold ? 'bold' : 'normal',
        fill: o.fill ?? '#000000',
        fontFamily: 'Inter',
        align: o.align ?? 'center',
      };
    }
    // ---- sembol
    const symId = o.sym ?? '';
    const fitted = fitBox(symId, o.w, o.h ?? o.w);
    const w = fitted.w * scale;
    const h = fitted.h * scale;
    const cx = (o.cx ?? 0) * scale + ox;
    const cy = (o.cy ?? 0) * scale + oy;
    const rad = (o.rot ?? 0) * DEG;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const dx = (w / 2) * cos - (h / 2) * sin;
    const dy = (w / 2) * sin + (h / 2) * cos;

    const base: Partial<CanvasObject> = {
      type: 'symbol',
      symbolId: symId,
      categoryId: CATEGORY[symId] ?? 'evidence',
      src: KROKI_SRC[symId],
      name: KROKI_NAME[symId],
      x: cx - dx,
      y: cy - dy,
      width: w,
      height: h,
      rotation: o.rot ?? 0,
      fill: o.fill,
    };
    if (symId === 'ev-callout') {
      // Açıklama balonu: metni distance alanından alır, boyu otomatiktir
      return {
        ...base,
        x: cx - w / 2,
        y: cy - h / 2,
        rotation: 0,
        distance: o.dist ?? '',
        distanceFontSize: Math.max(8, Math.round((o.fs ?? 9.5) * scale)),
        fill: '#000000',
      };
    }
    if (symId === 'a-4' || symId === 'a-5') {
      return {
        ...base,
        isDistanceArrow: symId === 'a-4' ? true : undefined,
        distance: o.dist,
        distanceFontSize: o.dist ? Math.max(8, Math.round((o.fs ?? 9) * scale)) : undefined,
        distanceColor: '#000000',
      };
    }
    return base;
  });
}
