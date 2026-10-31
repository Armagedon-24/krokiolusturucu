// KROKİLİ ÖRNEK OLAYLAR — 4 olay türü × 5 senaryo (toplam 20).
// Her senaryo; uygulamadaki GERÇEK sembollerden (src/constants/symbols.ts) oluşan
// nesne yerleşimleriyle tanımlanır. "Tuvale Aktar" işlemi önce Olay Yeri Krokisi
// şablonunu (createKrokiTemplate) kurar, ardından senaryo nesnelerini çizim alanına
// yerleştirir. Yüklenen her nesne standart tuval nesnesi olduğundan kullanıcı
// taşayabilir, ölçekleyebilir, silebilir ve yeni nesneler ekleyebilir.
//
// Tasarım koordinat sistemi: manzara (landscape) kroki şablonu (1400x1000) çizim alanı
// ~1366x706. Yerleşimler bu yerleşim alanına göredir; builder gerçek çizim alanına göre
// konumlandırır. Sağ üst köşe (Bulgu Listesi tablosu) boş bırakılmıştır.

import { v4 as uuidv4 } from 'uuid';
import { SYMBOL_CATEGORIES } from '../constants/symbols';
import { calculateCalloutSize } from '../utils/canvasUtils';
import type { CanvasObject } from '../types';

/* ------------------------------------------------------------------ */
/* Tipler                                                              */
/* ------------------------------------------------------------------ */

export interface KrokiPlacement {
  /** Sembol kimliği (SYMBOL_CATEGORIES içindeki id) */
  s?: string;
  /** Metin nesnesi */
  text?: string;
  /** Açıklama balonu (ev-callout) metni — x,y balon MERKEZİdır */
  callout?: string;
  /** Ölçü oku (a-4, çift uçlu) — [x1,y1,x2,y2] mutlak koordinatlar */
  arrow?: [number, number, number, number];
  /** Yön oku (a-5, tek uçlu) — [x1,y1,x2,y2] mutlak koordinatlar */
  dashArrow?: [number, number, number, number];
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rot?: number;
  /** Bulgu numarası (Bulgu Listesi'ne işlenir) */
  findingNo?: string;
  /** Bulgu açıklaması */
  findingDesc?: string;
  /** Ölçü oku etiketi ("3,5 m" vb.) veya balon yazı punto boyutu */
  distance?: string;
  size?: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  color?: string;
  name?: string;
}

export interface KrokiScenario {
  id: string;
  /** Kart başlığı — aynı zamanda formdaki "Olay Adı" */
  title: string;
  /** Formdaki "Adres" alanı */
  address: string;
  /** Senaryo özeti (kart üzerinde görünür) */
  story: string;
  /** Ölçek notu (kartta küçük yazıyla) */
  scaleNote?: string;
  /** Bulgu listesi (kartta numaralı liste; kroki numaratörleriyle eşleşir) */
  bulgular: { no: string; desc: string }[];
  objects: KrokiPlacement[];
}

export interface KrokiCaseGroup {
  id: string;
  name: string;
  desc: string;
  /** luc-react ikon adı (ExampleCaseIndex içinde eşlenir) */
  icon: string;
  scenarios: KrokiScenario[];
}

/* ------------------------------------------------------------------ */
/* Yerleşim yardımcıları (duvarlar, kapılar, numaratörler, yollar)     */
/* ------------------------------------------------------------------ */

/** Dikdörtgen oda: iç alan (x,y,w,h) — 8px kalınlıkta duvarlar sınırda. */
const room = (x: number, y: number, w: number, h: number): KrokiPlacement[] => [
  { s: 'arch-w1i', x: x - 4, y: y - 4, w: w + 8, h: 8 },
  { s: 'arch-w1i', x: x - 4, y: y + h - 4, w: w + 8, h: 8 },
  { s: 'arch-w1vi', x: x - 4, y: y + 4, w: 8, h: h - 8 },
  { s: 'arch-w1vi', x: x + w - 4, y: y + 4, w: 8, h: h - 8 },
];

/** Dikey iç duvar (x = duvar merkez çizgisi, y..y+h) */
const innerV = (x: number, y: number, h: number): KrokiPlacement => ({ s: 'arch-w1vi', x: x - 4, y, w: 8, h });

/** Yatay iç duvar (y = duvar merkez çizgisi, x..x+w) */
const innerH = (x: number, y: number, w: number): KrokiPlacement => ({ s: 'arch-w1i', x, y: y - 4, w, h: 8 });

/** Pencere (duvar üzerine) */
const win = (x: number, y: number, w = 80, rot = 0): KrokiPlacement => ({ s: 'arch-win', x, y, w, h: 12, rot });

/** Kapı (kanat + açılım yayı). (hx,hy) = MENTEŞE/jamb noktası: duvar MERKEZ ÇİZGİSİ üzerinde.
 *  arch-d1l imgesi yeniden çizildi: kanat bandının MERKEZİ kutunun alt kenarından %7,5
 *  yukarısındadır (0.925h) ve alt %15'lik bant BEYAZ açıklıktır (tuvalde duvarı keser).
 *  Yerleşim, kanat bandının merkezi tam duvar merkez çizgisine gelecek şekilde ofsetlenir:
 *  rot 0 = kanat menteşeden SAĞA, yay YUKARI; 90 = kanat AŞAĞI, yay SAĞA;
 *  180 = kanat SOLA, yay AŞAĞI; 270 = kanat YUKARI, yay SOLA. */
const door = (hx: number, hy: number, w = 56, rot: 0 | 90 | 180 | 270 = 0): KrokiPlacement => {
  const off = Math.round(w * 0.075); // kanat bandı merkezi ↔ duvar merkez çizgisi hizası
  if (rot === 90) return { s: 'arch-d1l', x: hx + w - off, y: hy, w, h: w, rot };
  if (rot === 180) return { s: 'arch-d1l', x: hx, y: hy + w - off, w, h: w, rot };
  if (rot === 270) return { s: 'arch-d1l', x: hx - w + off, y: hy, w, h: w, rot };
  return { s: 'arch-d1l', x: hx, y: hy - w + off, w, h: w, rot };
};

/** Çift kanatlı kapı / balkon kapısı. (hx,hy) = kanat diziliminin duvar merkez çizgisine
 *  oturan uç noktası: rot 0 → sol menteşe, kanatlar sağa; rot 90 → üst menteşe, kanatlar aşağı. */
const doubleDoor = (hx: number, hy: number, w = 70, rot: 0 | 90 = 0): KrokiPlacement => {
  const off = Math.round(w * 0.075);
  return rot === 90
    ? { s: 'arch-d2', x: hx + w - off, y: hy, w, h: w, rot }
    : { s: 'arch-d2', x: hx, y: hy - w + off, w, h: w, rot };
};

/** Sarı numaratör (Bulgu Listesi'ne işlenir). cx,cy = merkez. */
const marker = (no: string, desc: string, cx: number, cy: number, size = 34): KrokiPlacement => ({
  s: 'ev-circle', x: cx - size / 2, y: cy - size / 2, w: size, h: size, findingNo: no, findingDesc: desc,
});

/** Ortalanmış kısa etiket */
const lbl = (text: string, cx: number, cy: number, size = 11): KrokiPlacement => ({
  text, x: cx - 120, y: cy - 10, w: 240, size, bold: true, align: 'center',
});

/** Tek satırlık not (sol hizalı, normal ağırlık) */
const note = (text: string, x: number, y: number, w = 230, size = 10): KrokiPlacement => ({
  text, x, y, w, size, bold: false, align: 'left',
});

/** Ölçü oku (çift uçlu, siyah, etiketli) */
const arrow = (x1: number, y1: number, x2: number, y2: number, distance: string): KrokiPlacement => ({
  arrow: [x1, y1, x2, y2], distance,
});

/** Yön/kaçış oku (tek uçlu) */
const dash = (x1: number, y1: number, x2: number, y2: number, distance?: string): KrokiPlacement => ({
  dashArrow: [x1, y1, x2, y2], distance,
});

/** Açıklama balonu (cx,cy = merkez) */
const callout = (text: string, cx: number, cy: number, size = 11): KrokiPlacement => ({ callout: text, x: cx, y: cy, size });

/** Koli/kutu gösterimi (boş dikdörtgen) */
const box = (x: number, y: number, w = 65, h = 45, label?: string): KrokiPlacement[] => {
  const out: KrokiPlacement[] = [{ s: 'ev-rect-hollow', x, y, w, h }];
  if (label) out.push({ text: label, x: x + w / 2 - 30, y: y + h / 2 - 6, w: 60, size: 9, bold: true, align: 'center' });
  return out;
};

/** Yatay yol bandı — merkez çizgisi cy, x0..x1. Tuvaldeki dinamik yol motoru bandı
 *  h genişliğinde çizer; bu yüzden h doğrudan bant genişliğidir (bw). */
const roadH = (x0: number, x1: number, cy: number, bw = 150): KrokiPlacement => ({
  s: 'st-1', x: x0, y: Math.round(cy - bw / 2), w: x1 - x0, h: bw,
});

/** Dikey yol bandı — merkez çizgisi cx, y0..y1 (90° döndürülmüş). Motor bant genişliği h:
 *  90° döndürmede bandın cx üzerinde ortalanması için x = cx + bw/2. */
const roadV = (cx: number, y0: number, y1: number, bw = 150): KrokiPlacement => {
  const L = y1 - y0;
  return { s: 'st-1', x: Math.round(cx + bw / 2), y: y0, w: L, h: bw, rot: 90 };
};

/* ------------------------------------------------------------------ */
/* Sembol dizini + nesne üretici (builder)                             */
/* ------------------------------------------------------------------ */

interface SymbolEntry { id: string; name?: string; src: string; type: string; categoryId?: string; [k: string]: unknown }
const SYMBOL_INDEX: Record<string, SymbolEntry & { categoryId: string }> = {};
SYMBOL_CATEGORIES.forEach((cat) => {
  (cat.symbols as unknown as SymbolEntry[]).forEach((sym) => {
    SYMBOL_INDEX[sym.id] = { ...sym, categoryId: cat.id } as SymbolEntry & { categoryId: string };
  });
});

/**
 * Kroki çizimlerinde kullanılacak sembol görselini seçer.
 * Varsa sembolün uygulamanın KARAKALEM (çizgi teknikli, şeffaf zeminli) görseli
 * tercih edilir: renkli/realistik PNG ve basit SVG dolgular yerine klasik kroki
 * görünümü sağlar; üst üste binen sembollerde okunabilirliği korur.
 * İstisna: st-1 (Düz Yol) — büyük ölçekte vektör SVG netliği korur.
 */
const KROKI_SRC_VECTOR = new Set(['st-1']);
const krokiSrc = (sym: SymbolEntry): string => {
  const th = (sym as { thumbnail?: unknown }).thumbnail;
  if (typeof th === 'string' && th.includes('/karakalem/') && !KROKI_SRC_VECTOR.has(sym.id)) return th;
  return sym.src;
};

/**
 * Realistik/iz ailesi semboller (kan, fren izi, ıslak zemin, krater, enkaz, cam,
 * duman, alev, lastik izi vb.) kroki çizimlerinde hafif saydam (kurşun kalem tarama
 * etkisi) kullanılır: altlarındaki nesneleri kapatmadan klasik kroki okunabilirliği sağlar.
 * 0.7 seçildi: 0.5 krokide zor seçiliyordu; 0.7 hem saydamlığı korur hem belirginleştirir.
 */
const KROKI_SOFT_RE = /realistic|blood|skid|tire[_-]?track|liquid|mud|fingerprint|crack|crater|blast|debris|shattered|broken[_-]?wall|smoke|fire/i;
const KROKI_SOFT_IDS = new Set(['st-wet', 'st-ice']);
const krokiOpacity = (sym: SymbolEntry): number | undefined => {
  const hay = `${sym.id} ${sym.src} ${String((sym as { thumbnail?: unknown }).thumbnail ?? '')}`;
  return KROKI_SOFT_RE.test(hay) || KROKI_SOFT_IDS.has(sym.id) ? 0.7 : undefined;
};

/**
 * Minik delil/iz sembolleri (ayakkabı, telefon, anahtar, kovan, mermi izi vb.)
 * kroki okunabilirliği için asgari boyuta büyütülür (en uzun kenar < 34 px ise 34'e).
 * Yapısal semboller (duvar/kapı/pencere, yol, ip, kutu, numaratör, ok) muaf tutulur.
 */
const KROKI_MIN_SIZE = 34;
const KROKI_MIN_EXEMPT_PREFIX = ['arch-', 'st-', 'ev-rope', 'ev-rect-hollow', 'ev-circle', 'ev-square', 'ev-callout', 'a-4', 'a-5'];
const krokiMinSizeExempt = (id: string): boolean =>
  KROKI_MIN_EXEMPT_PREFIX.some((p) => id === p || id.startsWith(p));

/**
 * Kroki senaryolarında dolgulu (silüet) görünen sembollerin, uygulamanın mevcut
 * ÇİZGİ (karakalem) karşılıklarıyla değiştirilmesi — üst üste binmede okunabilirlik
 * ve klasik kroki görünümü için. Değiştirilen nesne orijinal sembol adını korur.
 */
const KROKI_SYMBOL_SUBSTITUTE: Record<string, string> = {
  'v-sedan': 'v-hatchback',     // Binek otomobil → çizgi binek otomobil
  'v-police': 'v-gendarmerie',  // Polis aracı → çizgi jandarma aracı (ışık barlı)
  'v-ambulance': 'v-panelvan',  // Ambulans → çizgi panelvan gövdeli ambulans
  'v-truck': 'v-dump',          // Kamyon → çizgi damperli kamyon
};

/** Tasarım koordinatlarını gerçek çizim alanına çevirip tuval nesnelerini üretir. */
export function buildScenarioObjects(
  sc: KrokiScenario,
  drawingArea: { x: number; y: number; width: number; height: number },
): CanvasObject[] {
  const out: CanvasObject[] = [];
  let z = 12; // şablon (z<=10) üstünde, bulgu listesi (z=50) altında
  const ox = drawingArea.x;
  const oy = drawingArea.y;

  for (const p of sc.objects) {
    if (p.text !== undefined) {
      out.push({
        id: uuidv4(), type: 'text', name: p.name || 'Etiket',
        x: ox + (p.x ?? 0), y: oy + (p.y ?? 0),
        width: p.w ?? 220, height: 20,
        text: p.text, fontSize: p.size ?? 10, fontFamily: 'Inter',
        fontStyle: p.bold ? 'bold' : 'normal', fill: p.color || '#000000', align: p.align || 'left',
        rotation: p.rot ?? 0, scaleX: 1, scaleY: 1, zIndex: z++,
      });
      continue;
    }
    if (p.callout !== undefined) {
      const size = calculateCalloutSize(p.callout, p.size ?? 12);
      out.push({
        id: uuidv4(), type: 'symbol', name: 'Açıklama Balonu',
        symbolId: 'ev-callout', categoryId: 'evidence',
        src: SYMBOL_INDEX['ev-callout']?.src || '',
        x: ox + (p.x ?? 0) - size.w / 2, y: oy + (p.y ?? 0) - size.h / 2,
        width: size.w, height: size.h,
        distance: p.callout, distanceColor: '#000000', distanceFontSize: p.size ?? 12,
        fill: 'transparent', rotation: 0, scaleX: 1, scaleY: 1, zIndex: z++,
      });
      continue;
    }
    if (p.arrow) {
      const [x1, y1, x2, y2] = p.arrow;
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      out.push({
        id: uuidv4(), type: 'symbol', name: p.name || 'Ölçü Oku',
        symbolId: 'a-4', categoryId: 'arrows',
        src: SYMBOL_INDEX['a-4']?.src || '',
        x: ox + (x1 + x2) / 2, y: oy + (y1 + y2) / 2,
        startX: ox + x1, startY: oy + y1, endX: ox + x2, endY: oy + y2,
        width: len, height: 6,
        isDistanceArrow: true,
        distance: p.distance || '', distanceColor: '#000000', distanceFontSize: 11,
        fill: '#000000', stroke: '#000000', rotation: 0, scaleX: 1, scaleY: 1, zIndex: z++,
      });
      continue;
    }
    if (p.dashArrow) {
      const [x1, y1, x2, y2] = p.dashArrow;
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      out.push({
        id: uuidv4(), type: 'symbol', name: p.name || 'Yön Oku',
        symbolId: 'a-5', categoryId: 'arrows',
        src: SYMBOL_INDEX['a-5']?.src || '',
        x: ox + (x1 + x2) / 2, y: oy + (y1 + y2) / 2,
        startX: ox + x1, startY: oy + y1, endX: ox + x2, endY: oy + y2,
        width: len, height: 8,
        distance: p.distance || '', distanceColor: '#000000', distanceFontSize: 10,
        fill: p.color || '#000000', stroke: p.color || '#000000', strokeWidth: 4,
        rotation: 0, scaleX: 1, scaleY: 1, zIndex: z++,
      });
      continue;
    }
    if (p.s) {
      const origSym = SYMBOL_INDEX[p.s];
      const subId = KROKI_SYMBOL_SUBSTITUTE[p.s];
      const sym = (subId ? SYMBOL_INDEX[subId] : undefined) || origSym;
      if (!sym) continue; // bilinmeyen sembol atlanır (uygulama güncellendiğinde dayanıklılık)
      let w = p.w ?? (typeof sym.width === 'number' ? sym.width : 100);
      let h = p.h ?? (typeof sym.height === 'number' ? sym.height : 100);
      let px = p.x ?? 0;
      let py = p.y ?? 0;
      if (!krokiMinSizeExempt(sym.id)) {
        const m = Math.max(w, h);
        if (m > 0 && m < KROKI_MIN_SIZE) {
          const k = KROKI_MIN_SIZE / m;
          const nw = Math.round(w * k), nh = Math.round(h * k);
          px += (w - nw) / 2; py += (h - nh) / 2; // merkez sabit
          w = nw; h = nh;
        }
      }
      out.push({
        id: uuidv4(), type: 'symbol', name: p.name || origSym?.name || sym.name || p.s,
        symbolId: sym.id, categoryId: sym.categoryId, src: krokiSrc(sym),
        x: ox + px, y: oy + py,
        width: w, height: h,
        rotation: p.rot ?? 0, scaleX: 1, scaleY: 1,
        opacity: krokiOpacity(sym),
        findingNo: p.findingNo, findingDesc: p.findingDesc,
        distanceColor: '#000000', zIndex: z++,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* GRUP 1 — İKAMETTEN HIRSIZLIK                                        */
/* ------------------------------------------------------------------ */

const hirsizlik: KrokiScenario[] = [
  {
    id: 'hir-1',
    title: 'Kapı kilidi zorlanarak girilen 2+1 daire hırsızlığı',
    address: 'Konya / Selçuklu — Gül Sokak No:14, Daire 5 (2. kat)',
    story:
      'İş yerinden dönen mağdur, giriş kapısının kilit dilinden zorlandığını ve evin karıştırıldığını gördü. Kapı kırılmış asma kilitle kapanmıştı; yatak odası çekmeceleri boşaltılmış, takı ve nakit para alınmıştı. Komşu, öğle saatlerinde kapı önünde levye gördüğünü beyan etti.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Kapı önünde kırılmış asma kilit' },
      { no: '2', desc: 'Kapı sökülmesinde kullanıldığı değerlendirilen levye' },
      { no: '3', desc: 'Salon pencere kasasından toplanan parmak izi' },
      { no: '4', desc: 'Salon zemininde toz tabaka üzerinde ayakkabı izleri' },
      { no: '5', desc: 'Giriş kapısı yanında sigara izmariti (DNA örneği)' },
      { no: '6', desc: 'Yatak odasında boşaltılmış belge ve çekmeceler' },
    ],
    objects: [
      // ---- Plan: salon + yatak odası
      ...room(30, 30, 1096, 420),
      innerV(652, 30, 420),
      // Giriş kapısı (alt duvar, salon) — kanat duvar merkez çizgisinde
      door(104, 450, 56, 0),
      // Pencereler
      win(330, 24, 90, 0),
      { s: 'arch-win', x: 1134, y: 180, w: 80, h: 12, rot: 90 },
      // ---- Salon mobilyası
      { s: 'f-8', x: 60, y: 60, w: 170, h: 80, name: 'İkili Koltuk' },
      { s: 'f-5', x: 62, y: 172, w: 88, h: 86, name: 'Tekli Koltuk' },
      { s: 'f-9', x: 175, y: 225, w: 240, h: 150, name: 'Halı' },
      // ---- Yatak odası
      { s: 'f-1', x: 682, y: 62, w: 105, h: 190, name: 'Tek Kişilik Yatak' },
      { s: 'f-13', x: 860, y: 46, w: 130, h: 55, name: 'Gardırop' },
      { s: 'f-10', x: 700, y: 300, w: 260, h: 80, name: 'Yolluk' },
      // ---- Karıştırılmış çekmeceler
      { s: 'ei-documents', x: 700, y: 330, w: 64, h: 54, rot: -8 },
      { s: 'ei-documents', x: 792, y: 348, w: 54, h: 46, rot: 12 },
      { s: 'ei-watch', x: 878, y: 318, w: 28, h: 28 },
      { s: 'ei-glasses', x: 940, y: 338, w: 28, h: 28 },
      // ---- Deliller
      { s: 'ei-lock-broken', x: 84, y: 476, w: 30, h: 30 },
      marker('1', 'Kapı önünde kırılmış asma kilit', 136, 492),
      { s: 'ei-crowbar', x: 214, y: 488, w: 18, h: 46, rot: 20 },
      marker('2', 'Kapı sökülmesinde kullanılan levye', 260, 502),
      { s: 'tr-3', x: 345, y: 6, w: 26, h: 26 },
      marker('3', 'Pencere kasasından parmak izi', 396, 14),
      { s: 'tr-footprint', x: 297, y: 375, w: 26, h: 42, rot: -15 },
      { s: 'tr-footprint', x: 343, y: 387, w: 26, h: 42, rot: 8 },
      { s: 'tr-footprint', x: 389, y: 373, w: 26, h: 42, rot: -5 },
      marker('4', 'Salon zemininde toz ayak izleri', 442, 386),
      { s: 'ei-cigarette', x: 528, y: 416, w: 32, h: 14, rot: 10 },
      marker('5', 'Kapı yanında sigara izmariti', 578, 424),
      marker('6', 'Boşaltılmış çekmeceler ve belgeler', 836, 316),
      // ---- Ölçüler
      arrow(120, 508, 232, 508, '110 cm'),
      arrow(370, 44, 370, 438, '≈ 410 cm'),
      // ---- Açıklamalar
      callout('Ganimet: takı ve 8.500 TL nakit alındı', 300, 570, 11),
      callout('Gardırop ve komodin çekmeceleri boşaltılmış', 890, 240, 11),
      note('Şüpheli kapıdan çıkıp merdiven sahanlığına kaçtı.', 560, 545, 260),
      dash(140, 545, 55, 620),
      lbl('Merdiven', 128, 652, 9),
    ],
  },
  {
    id: 'hir-2',
    title: 'Pencereden girilen müstakil köy evi hırsızlığı',
    address: 'Aydın / Kuyucak — Cumhuriyet Mah. 12. Sokak (müstakil ev)',
    story:
      'Gece saatlerinde arka penceredeki cam kırılarak eve girildi. Bahçedeki bekçi köpeğinin havlamadığı, hayvana yem atılan izleri bulunan mağdur, evde 2 altın bilezik ve nakit paranın kayıp olduğunu bildirdi. Zeminde çamur ve ayakkabı izleri tespit edildi.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Kırılan arka pencere camı parçaları' },
      { no: '2', desc: 'Pencere önünde camı kırmak için kullanılan taş/tuğla' },
      { no: '3', desc: 'Pencere kasasından parmak izi' },
      { no: '4', desc: 'İçeride çamur izi ve ayakkabı taban izleri' },
      { no: '5', desc: 'Yerde kalan para destesi ve anahtar takımı' },
      { no: '6', desc: 'Bahçede yem artığı bulunan köpek maması kabı' },
    ],
    objects: [
      // ---- Ev gövdesi
      ...room(120, 40, 520, 520),
      innerH(120, 340, 180),
      { s: 'arch-w1i', x: 380, y: 336, w: 260, h: 8 },
      door(306, 340, 56, 0),
      // Arka pencere (giriş noktası) — sol duvar
      { s: 'arch-win', x: 128, y: 120, w: 80, h: 12, rot: 90 },
      // Arka kapı — sağ duvar (kanat duvar çizgisinde, yay odaya)
      door(640, 516, 56, 270),
      // ---- Mobilya
      { s: 'f-2', x: 500, y: 70, w: 140, h: 190, name: 'Çift Kişilik Yatak' },
      { s: 'f-7', x: 330, y: 56, w: 150, h: 55, name: 'Gardırop (3 Kapılı)' },
      { s: 'f-5', x: 180, y: 80, w: 86, h: 84, name: 'Koltuk' },
      { s: 'f-3', x: 140, y: 470, w: 150, h: 55, name: 'Mutfak Tezgahı' },
      { s: 'f-11', x: 322, y: 468, w: 70, h: 45, name: 'Paspas' },
      // ---- İzler ve deliller
      { s: 'tr-mud', x: 158, y: 148, w: 70, h: 45, rot: 15 },
      { s: 'tr-footprint', x: 237, y: 176, w: 26, h: 46, rot: 20 },
      { s: 'tr-footprint', x: 279, y: 208, w: 26, h: 46, rot: -10 },
      { s: 'tr-footprint', x: 319, y: 248, w: 26, h: 46, rot: 5 },
      { s: 'tr-3', x: 124, y: 214, w: 22, h: 22 },
      { s: 'ex-4', x: 58, y: 138, w: 46, h: 32 },
      { s: 'ei-brick', x: 52, y: 206, w: 30, h: 22 },
      { s: 'ei-money', x: 398, y: 296, w: 42, h: 30 },
      { s: 'ei-keys', x: 452, y: 318, w: 22, h: 28 },
      { s: 'an-dog', x: 62, y: 606, w: 44, h: 26 },
      { s: 'tr-liquid-pool', x: 118, y: 610, w: 46, h: 30, name: 'Yem kabı' },
      // ---- Numaratörler
      marker('1', 'Pencere önünde kırık cam parçaları', 92, 128),
      marker('2', 'Camı kırmak için kullanılan taş', 92, 252),
      marker('3', 'Pencere kasasından parmak izi', 170, 222),
      marker('4', 'İçeride çamur ve ayakkabı izleri', 372, 262),
      marker('5', 'Yerde kalan para ve anahtarlar', 478, 300),
      marker('6', 'Yem atılmış köpek maması kabı', 190, 632),
      // ---- Ölçüler ve açıklamalar
      arrow(120, 160, 498, 164, '≈ 385 cm'),
      callout('Ganimet: 2 altın bilezik ve 1.200 TL', 300, 590, 11),
      callout('Cam kırılarak pencereden girildi', 208, 314, 11),
      note('Bekçi köpeğine yem atıldığı değerlendirildi.', 260, 660, 250),
      dash(648, 560, 760, 660),
      lbl('Kaçış yönü', 790, 640, 10),
    ],
  },
  {
    id: 'hir-3',
    title: 'Apartman bodrumunda kiler hırsızlığı',
    address: 'Eskişehir / Odunpazarı — Zafer Mah. Ada Apt. bodrum katı',
    story:
      'Apartman yöneticisi, bodrum koridorundaki 2 numaralı kilerin kilitinin kırıldığını ve içeriden bisiklet ile elektrikli el aletlerinin çalındığını bildirdi. Koridor kamerası şüpheliyi kaydetmişti; koridor zemininde ayakkabı izleri ve düşen bir levye bulundu.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Kapı kancasında kırılmış asma kilit (2 no.lu kiler)' },
      { no: '2', desc: 'Koridorda bulunan levye' },
      { no: '3', desc: 'Kapı kasasından parmak izi' },
      { no: '4', desc: 'Koridor zemininde ayakkabı taban izleri' },
      { no: '5', desc: 'Koridorda terk edilmiş bisiklet' },
      { no: '6', desc: 'Koridor güvenlik kamerası kayıt noktası' },
    ],
    objects: [
      // ---- 4 kiler hücresi
      ...room(40, 90, 240, 240),
      ...room(300, 90, 240, 240),
      ...room(560, 90, 240, 240),
      ...room(820, 90, 240, 240),
      lbl('Kiler 1', 160, 200, 11),
      lbl('Kiler 2', 420, 200, 11),
      lbl('Kiler 3', 680, 200, 11),
      lbl('Kiler 4', 940, 200, 11),
      // Kiler kapıları (koridor tarafına) — kanatlar koridor üst duvar çizgisinde
      door(140, 380, 48, 180),
      door(400, 380, 48, 180),
      door(660, 380, 48, 180),
      door(920, 380, 48, 180),
      // ---- Koridor
      ...room(40, 380, 1060, 130),
      // ---- Kiler 2 içi (soygun yeri)
      ...box(320, 110, 60, 42, 'Koli'),
      ...box(390, 116, 52, 38),
      { s: 'ev-rect-hollow', x: 470, y: 108, w: 56, h: 40 },
      lbl('Koli', 498, 128, 9),
      { s: 'ei-lock-broken', x: 352, y: 366, w: 30, h: 30 },
      marker('1', 'Kapı kancasında kırılmış asma kilit', 404, 378),
      { s: 'tr-3', x: 430, y: 330, w: 20, h: 20 },
      marker('3', 'Kapı kasasından parmak izi', 462, 336),
      // ---- Koridor delilleri
      { s: 'ei-crowbar', x: 520, y: 420, w: 18, h: 44, rot: 30 },
      marker('2', 'Koridorda bulunan levye', 560, 430),
      { s: 'tr-footprint', x: 607, y: 412, w: 26, h: 42, rot: -10 },
      { s: 'tr-footprint', x: 647, y: 425, w: 26, h: 42, rot: 6 },
      { s: 'tr-footprint', x: 687, y: 411, w: 26, h: 42, rot: -4 },
      marker('4', 'Koridor zemininde ayakkabı izleri', 738, 424),
      { s: 'v-bicycle', x: 780, y: 420, w: 95, h: 32 },
      marker('5', 'Koridorda terk edilmiş bisiklet', 900, 430),
      { s: 'out-cctv', x: 1056, y: 336, w: 28, h: 40 },
      marker('6', 'Koridor güvenlik kamerası', 1058, 396, 30),
      // Diğer kilerlerde kalan eşyalar
      ...box(70, 120, 62, 44, 'Koli'),
      { s: 'ei-bottle', x: 160, y: 130, w: 18, h: 40 },
      ...box(600, 120, 60, 42, 'Koli'),
      ...box(880, 126, 58, 42),
      // ---- Ölçüler ve açıklamalar
      arrow(420, 396, 520, 420, '105 cm'),
      callout('Çalınan: bisiklet ve elektrikli el aletleri', 240, 610, 11),
      callout('Koridor kamerası şüpheliyi kaydetti', 900, 592, 11),
      note('Merdiven boşluğu', 1010, 520, 130),
      dash(980, 470, 1060, 545),
      lbl('Bodrum kat planı', 120, 660, 10),
    ],
  },
  {
    id: 'hir-4',
    title: 'Villada cam teras kapısından girilen hırsızlık',
    address: 'Antalya / Muratpaşa — Liman Mah. 42. Cadde (villa, zemin kat)',
    story:
      'Villa sahibi sabah teras kapısının camının kırıldığını ve salonun karıştırıldığını fark etti. Bahçe çitinden atlayan şüphelinin çamur izleri ve bahçe kamerası kaydı mevcut. Çekmeceler boşaltılmış, şüphelinin geride bıraktığı şişe ve izmarit delil olarak alındı.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Kırılan teras kapısı camı ve sürgü' },
      { no: '2', desc: 'Bahçede çit altında çamur izleri' },
      { no: '3', desc: 'Salon zemininde ayakkabı taban izleri' },
      { no: '4', desc: 'Teras kapısı kasasından parmak izi' },
      { no: '5', desc: 'Mutfak zemininde şüpheliye ait şişe' },
      { no: '6', desc: 'Bahçe güvenlik kamerası kayıt noktası' },
    ],
    objects: [
      // ---- Bahçe çiti
      { s: 'out-fence', x: 240, y: 22, w: 160, h: 50 },
      { s: 'out-fence', x: 430, y: 22, w: 160, h: 50 },
      { s: 'out-fence', x: 620, y: 22, w: 160, h: 50 },
      lbl('Bahçe duvarı', 530, 47, 9),
      // ---- Ev planı (açık mutfak + salon)
      ...room(240, 120, 760, 380),
      innerV(770, 120, 380),
      // Teras kapısı (alt duvar) + giriş — kanatlar duvar çizgisinde
      doubleDoor(490, 500, 72, 0),
      // ---- Salon
      { s: 'f-8', x: 300, y: 160, w: 180, h: 80, name: 'İkili Koltuk' },
      { s: 'f-5', x: 302, y: 270, w: 88, h: 86, name: 'Tekli Koltuk' },
      { s: 'f-9', x: 480, y: 250, w: 250, h: 155, name: 'Halı' },
      // ---- Mutfak
      { s: 'f-4', x: 782, y: 128, w: 210, h: 165, name: 'L Tezgah' },
      { s: 'f-10', x: 800, y: 330, w: 180, h: 70, name: 'Yolluk' },
      // ---- Deliller
      { s: 'ex-4', x: 512, y: 424, w: 60, h: 40 },
      marker('1', 'Kırılan teras kapısı camı', 596, 442),
      { s: 'tr-mud', x: 292, y: 62, w: 80, h: 50, rot: 10 },
      { s: 'tr-footprint', x: 327, y: 115, w: 26, h: 42, rot: 8 },
      marker('2', 'Çit altında çamur izleri', 402, 96),
      { s: 'tr-footprint', x: 517, y: 421, w: 26, h: 42, rot: -8 },
      marker('3', 'Salon zemininde ayakkabı izleri', 468, 430),
      { s: 'tr-3', x: 478, y: 448, w: 22, h: 22 },
      marker('4', 'Teras kapısı kasasından parmak izi', 636, 500),
      { s: 'ei-bottle', x: 700, y: 330, w: 18, h: 44 },
      marker('5', 'Zeminde şüpheliye ait şişe', 744, 352),
      { s: 'ei-cigarette', x: 742, y: 392, w: 32, h: 14, rot: 12 },
      { s: 'out-cctv', x: 986, y: 92, w: 30, h: 42 },
      marker('6', 'Bahçe güvenlik kamerası', 996, 150, 30),
      { s: 'ei-documents', x: 556, y: 424, w: 58, h: 48, rot: -8 },
      { s: 'ei-documents', x: 640, y: 438, w: 50, h: 42, rot: 10 },
      { s: 'ei-money', x: 442, y: 428, w: 40, h: 28 },
      // ---- Ölçüler ve açıklamalar
      arrow(340, 52, 530, 460, '≈ 6,1 m'),
      callout('Teras kapısı camı kırılarak sürgü kaldırıldı', 660, 300, 11),
      callout('Çekmeceler boşaltıldı; nakit ve takı alındı', 250, 540, 11),
      note('Ganimet: 1 adet dizüstü bilgisayar, takı, 12.000 TL', 680, 560, 280),
      dash(520, 500, 640, 620),
      lbl('Kaçış yönü', 680, 610, 10),
    ],
  },
  {
    id: 'hir-5',
    title: 'Çatı katı stüdyo dairede balkon kapısından giriş',
    address: 'İstanbul / Kadıköy — Fikirtepe Mah. Yıldız Blok, kat 7 / çatı katı',
    story:
      'Çatı katı stüdyo dairede balkon kapısı sürgüsü kaldırılarak içeri girildi. Şüphelinin kaçarken unuttuğu telefon ve şapkası olay yerinde bulundu. Yangın merdiveni üzerinden kaçan şüpheli, komşu blok kameralarına takılmıştı. Banyo karıştırılmamıştı.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Sürgüsü kaldırılan balkon kapısı' },
      { no: '2', desc: 'Kapı kasasından parmak izi' },
      { no: '3', desc: 'Zeminde şüpheliye ait şapka' },
      { no: '4', desc: 'Şüphelinin unuttuğu cep telefonu' },
      { no: '5', desc: 'Zeminde ayakkabı taban izleri' },
      { no: '6', desc: 'Yangın merdiveni kaçış güzergâhı' },
    ],
    objects: [
      // ---- Stüdyo + banyo
      ...room(90, 60, 680, 420),
      innerV(610, 60, 180),
      innerH(610, 240, 160),
      door(622, 240, 48, 0),
      lbl('Banyo', 690, 150, 10),
      // Balkon kapısı — sağ duvar (kanat duvar çizgisinde, yay balkona)
      doubleDoor(770, 370, 66, 90),
      // Pencere — üst duvar
      win(300, 56, 80, 0),
      // ---- Mobilya
      { s: 'f-3', x: 102, y: 70, w: 160, h: 55, name: 'Mutfak Tezgahı' },
      { s: 'f-1', x: 400, y: 80, w: 105, h: 190, name: 'Tek Kişilik Yatak' },
      { s: 'f-5', x: 120, y: 300, w: 88, h: 86, name: 'Koltuk' },
      { s: 'f-9', x: 250, y: 290, w: 220, h: 140, name: 'Halı' },
      { s: 'f-10', x: 620, y: 300, w: 120, h: 70, name: 'Yolluk' },
      // ---- Deliller
      { s: 'tr-3', x: 756, y: 362, w: 22, h: 22 },
      marker('2', 'Balkon kapısı kasasından parmak izi', 800, 340, 30),
      { s: 'cl-cap', x: 258, y: 178, w: 30, h: 26 },
      marker('3', 'Zeminde şüpheliye ait şapka', 306, 190),
      { s: 'ei-phone', x: 538, y: 298, w: 24, h: 36 },
      marker('4', 'Şüphelinin unuttuğu telefon', 584, 312),
      { s: 'tr-footprint', x: 297, y: 399, w: 26, h: 42, rot: 6 },
      { s: 'tr-footprint', x: 341, y: 411, w: 26, h: 42, rot: -10 },
      marker('5', 'Zeminde ayakkabı taban izleri', 396, 418),
      { s: 'ev-rect-hollow', x: 630, y: 90, w: 40, h: 34 },
      lbl('Kombi', 650, 107, 9),
      // ---- Ölçüler ve açıklamalar
      arrow(750, 404, 508, 180, '≈ 3,4 m'),
      callout('Balkon kapısı sürgüsü dışarıdan kaldırılmış', 780, 262, 11),
      note('Banyo karıştırılmamış.', 640, 210, 140, 9),
      note('Yangın merdiveni üzerinden kaçış', 850, 480, 200),
      dash(820, 440, 950, 560),
      lbl('Yangın merdiveni', 1010, 600, 10),
      marker('1', 'Giriş noktası: balkon kapısı', 742, 470, 30),
      marker('6', 'Kaçış güzergâhı: yangın merdiveni', 960, 520, 30),
    ],
  },
];

/* ------------------------------------------------------------------ */
/* GRUP 2 — KAVŞAKTA ÖLÜMLÜ TRAFİK KAZASI                              */
/* ------------------------------------------------------------------ */

/** Standart kavşak iskeleti: yatay ana yol (merkez y=360) + dikey ikincil yol (merkez x=680). */
const intersection = (): KrokiPlacement[] => [
  roadH(20, 1346, 360, 150),
  roadV(680, 20, 690, 150),
  // Yatay yolun ucunda yol çizgisi notu
  lbl('Ana yol (çift şerit)', 190, 272, 9),
  lbl('Kavşağa bağlanan yol', 680, 668, 9),
];

const kaza: KrokiScenario[] = [
  {
    id: 'kaza-1',
    title: 'Işıklı kavşakta T-bone (dik açı) çarpışma — sürücü ölümlü',
    address: 'Ankara / Çankaya — Atatürk Bulvarı × Ziya Gökalp Caddesi sinyalize kavşak',
    story:
      'Ana yoldan batıya seyreden hafif ticari araç, kavşakta yeşil ışıkta geçerken; dikey yoldan gelen binek otomobil kırmızı ışıkta kavşağa girdi. Dik açıdaki çarpışma ile binek sürücü hayatını kaybetti, araçlar sürüklenerek durdu. Kavşak kamerası ve tanık beyanı ışık ihlalini doğruladı.',
    scaleNote: '≈ 1 m = 12 piksel',
    bulgular: [
      { no: '1', desc: 'Binek sürücü cenazesi (araçtan çıkarılmış hâli)' },
      { no: '2', desc: 'Sürücünün savrulduğu bölgede kan birikintisi' },
      { no: '3', desc: 'Binek aracının kavşak öncesi fren izi (≈ 18 m)' },
      { no: '4', desc: 'Çarpışma sonrası dağılan cam ve torpido parçaları' },
      { no: '5', desc: 'Sinyalizasyon: binek yönü kırmızı (kamera kaydı)' },
    ],
    objects: [
      ...intersection(),
      // Sinyalizasyon (dikey yol için)
      { s: 'out-traffic-light', x: 800, y: 186, w: 24, h: 48 },
      { s: 'out-traffic-light', x: 536, y: 486, w: 24, h: 48 },
      lbl('Trafik ışığı', 850, 200, 9),
      // Yaya geçitleri
      { s: 'out-zebra', x: 615, y: 176, w: 130, h: 55 },
      { s: 'out-zebra', x: 615, y: 486, w: 130, h: 55 },
      // ---- Araç A: hafif ticari (yeşil ışıkta, batıya doğru)
      { s: 'v-sedan', x: 430, y: 322, w: 150, h: 66, rot: 0, name: 'Hafif ticari araç (A)' },
      // ---- Araç B: binek (kırmızı ışıkta, kuzeyden)
      { s: 'v-damaged-front', x: 640, y: 176, w: 78, h: 150, rot: 0, name: 'Ağır hasarlı binek (B)' },
      // Fren izi (B aracının kavşak öncesi)
      { s: 'tr-skid-straight', x: 741, y: 20, w: 190, h: 88, rot: 90, name: 'Fren izi' },
      // ---- Kazazede ve kan
      { s: 'p-9', x: 560, y: 428, w: 115, h: 52, name: 'Sürücü (cenaze)' },
      { s: 'in-blood-pool', x: 612, y: 470, w: 115, h: 85 },
      { s: 'ex-4', x: 610, y: 366, w: 55, h: 40 },
      { s: 'ex-4', x: 545, y: 388, w: 42, h: 30 },
      // ---- Olay yeri ekipleri
      { s: 'v-police', x: 1130, y: 250, w: 130, h: 56 },
      { s: 'v-ambulance', x: 1120, y: 340, w: 150, h: 60 },
      lbl('Olay yeri ekipleri', 1195, 420, 9),
      // ---- Numaratörler
      marker('1', 'Binek sürücü cenazesi (araçtan çıkarılmış)', 520, 400),
      marker('2', 'Savrulma bölgesinde kan birikintisi', 672, 512),
      marker('3', 'Binek aracının fren izi (≈ 18 m)', 800, 80, 30),
      marker('4', 'Çarpışma sonrası dağılan cam parçaları', 600, 352),
      marker('5', 'Binek yönü sinyal: kırmızı (kamera)', 828, 240, 30),
      // ---- Ölçüler
      arrow(745, 30, 745, 200, '≈ 18 m'),
      arrow(605, 556, 755, 556, '15 m'),
      // ---- Açıklamalar
      callout('Işık ihlali: B aracı kırmızıda kavşağa girdi', 300, 150, 11),
      callout('Çarpışma açısı ≈ 90° (T-bone)', 940, 470, 11),
      note('Kamera kaydı: 18:42:07 — tanık beyanıyla uyumlu.', 60, 620, 280),
    ],
  },
  {
    id: 'kaza-2',
    title: 'Kavşak yaya geçidinde ölümlü yaya çarpışması',
    address: 'Bursa / Nilüfer — İzmir Yolu × Nilüferköy Kavşağı (yaya geçidi)',
    story:
      'Alacakaranlıkta ana yoldan seyreden binek otomobil, kavşak yaya geçidinde karşıdan karşıya geçen yayaya çarptı. Yaya olay yerinde hayatını kaybetti. Sürücünün fren izi ≈ 26 m ölçüldü; araç yasal hız sınırında seyrediyordu, yaya aniden geçide girmişti.',
    scaleNote: '≈ 1 m = 12 piksel',
    bulgular: [
      { no: '1', desc: 'Yaya cenazesi (yaya geçidi üzerinde)' },
      { no: '2', desc: 'Savrulan ayakkabı (yayanın sağ ayakkabısı)' },
      { no: '3', desc: 'Çarpma bölgesinde kan birikintisi' },
      { no: '4', desc: 'Aracın fren izi (≈ 26 m, kavşak yaklaşımı)' },
      { no: '5', desc: 'Yaya geçidi uyarı tabelası (her iki yönde)' },
    ],
    objects: [
      ...intersection(),
      // Yaya geçitleri (yatay yol üzerinde, iki yönde)
      { s: 'out-zebra', x: 460, y: 295, w: 130, h: 55, rot: 90 },
      { s: 'out-zebra', x: 905, y: 295, w: 130, h: 55, rot: 90 },
      // Araç (fren izi bitiminde, geçit üzerinde)
      { s: 'v-sedan', x: 505, y: 318, w: 140, h: 62, name: 'Binek otomobil' },
      // Fren izi (sağ yaklaşım)
      { s: 'tr-skid-straight', x: 960, y: 318, w: 210, h: 92, name: 'Fren izi' },
      // ---- Yaya ve deliller
      { s: 'p-3', x: 415, y: 322, w: 34, h: 76, name: 'Yaya (cenaze)' },
      { s: 'in-blood-pool', x: 462, y: 386, w: 105, h: 78 },
      { s: 'cl-shoe', x: 342, y: 252, w: 24, h: 24, rot: 30 },
      { s: 'cl-shoe', x: 560, y: 428, w: 24, h: 24, rot: 70 },
      // Tabelalar
      { s: 'ts-pedestrian', x: 902, y: 220, w: 30, h: 30 },
      { s: 'ts-pedestrian', x: 452, y: 502, w: 30, h: 30 },
      lbl('Yaya geçidi tabelası', 962, 236, 9),
      // Ekipler
      { s: 'v-police', x: 1120, y: 420, w: 130, h: 56 },
      { s: 'p-13', x: 750, y: 470, w: 26, h: 34 },
      // ---- Numaratörler
      marker('1', 'Yaya cenazesi (geçit üzerinde)', 392, 300),
      marker('2', 'Savrulan ayakkabı', 320, 268),
      marker('3', 'Çarpma bölgesinde kan birikintisi', 520, 470),
      marker('4', 'Fren izi başlangıcı (≈ 26 m)', 1160, 330, 30),
      marker('5', 'Yaya geçidi uyarı tabelası', 878, 190, 30),
      // ---- Ölçüler
      arrow(900, 350, 660, 350, '≈ 26 m'),
      arrow(500, 480, 590, 480, '≈ 8 m'),
      // ---- Açıklamalar
      callout('Araç hız sınırında (kamera/fren izi uyumlu)', 250, 200, 11),
      callout('Yaya aniden geçide girdi (tanık beyanı)', 820, 560, 11),
      note('Işık koşulu: alacakaranlık, araç farları açıktı.', 60, 620, 270),
    ],
  },
  {
    id: 'kaza-3',
    title: 'Kavşakta motosiklet–otomobil çarpışması (motosikletli ölümlü)',
    address: 'İzmir / Buca — Şirinyer Kavşağı (ana yol × bağlantı yolu)',
    story:
      'Ana yoldan seyreden binek otomobil, bağlantı yolundan sola dönmekte olan motosikletle kavşak içinde çarpıştı. Motosikletli savrularak ≈ 12 m uzakta hayatını kaybetti; kask savrulmuş, motosiklet devrilmiş hâlde bulundu.',
    scaleNote: '≈ 1 m = 12 piksel',
    bulgular: [
      { no: '1', desc: 'Motosikletli cenazesi (≈ 12 m savrulma)' },
      { no: '2', desc: 'Savrulma hattında kan birikintisi' },
      { no: '3', desc: 'Savrulan motosiklet kaskı' },
      { no: '4', desc: 'Devrilmiş motosiklet' },
      { no: '5', desc: 'Otomobilin kavşak içinde sürtünme/fren izi' },
    ],
    objects: [
      ...intersection(),
      // Araç (dikey yoldan inen, dönüş manevrasında)
      { s: 'v-sedan', x: 726, y: 210, w: 60, h: 132, rot: 90, name: 'Binek otomobil' },
      // Devrilmiş motosiklet
      { s: 'v-motor-fallen', x: 596, y: 286, w: 150, h: 50, rot: 20, name: 'Devrilmiş motosiklet' },
      // Kask ve parçalar
      { s: 'cl-helmet', x: 556, y: 236, w: 26, h: 26 },
      { s: 'ex-4', x: 648, y: 246, w: 40, h: 28 },
      // ---- Kazazede
      { s: 'p-9', x: 486, y: 428, w: 115, h: 52, name: 'Motosikletli (cenaze)' },
      { s: 'in-blood-pool', x: 540, y: 470, w: 110, h: 80 },
      { s: 'in-blood-smear', x: 600, y: 430, w: 120, h: 50, rot: -10 },
      // Sürtünme izi
      { s: 'tr-skid-curved', x: 780, y: 400, w: 190, h: 105, rot: -20, name: 'Fren izi (kavisli)' },
      // Tabela ve ekipler
      { s: 'ts-crossroads', x: 926, y: 156, w: 32, h: 30 },
      lbl('Kavşak uyarı tabelası', 990, 170, 9),
      { s: 'v-ambulance', x: 1120, y: 310, w: 150, h: 60 },
      { s: 'v-police', x: 1130, y: 400, w: 130, h: 56 },
      // ---- Numaratörler
      marker('1', 'Motosikletli cenazesi (≈ 12 m savrulma)', 450, 400),
      marker('2', 'Savrulma hattında kan birikintisi', 600, 560),
      marker('3', 'Savrulan kask', 532, 224),
      marker('4', 'Devrilmiş motosiklet', 700, 260),
      marker('5', 'Otomobilin sürtünme/fren izi', 960, 480, 30),
      // ---- Ölçüler
      arrow(640, 296, 520, 420, '≈ 12 m'),
      arrow(590, 540, 700, 540, '≈ 9 m'),
      // ---- Açıklamalar
      callout('Motosiklet sola dönerken çarpıştı', 260, 150, 11),
      callout('Kask takılıydı; darbe kafes bölgesine', 950, 580, 11),
      note('Otomobil sürücüsü alkollü değil (0,00 promil).', 60, 620, 270),
    ],
  },
  {
    id: 'kaza-4',
    title: 'Dur işaretli kavşakta devrilme kazası — alkollü sürücü (ölümlü)',
    address: 'Adana / Seyhan — Turhan Cemal Beriker Bulvarı × 51011. Sokak',
    story:
      'Yağmur sonrası ıslak zeminde, dikey yoldan gelen kamyonet dur işaretine uymayarak kavşağa girdi; ana yoldan gelen binek otomobilin çarpmasıyla kamyonet devrildi, sürücü savrularak hayatını kaybetti. Kan testinde sürücünün %1,32 alkol aldığı belirlendi.',
    scaleNote: '≈ 1 m = 12 piksel',
    bulgular: [
      { no: '1', desc: 'Devrilmiş kamyonet (kavşak içinde)' },
      { no: '2', desc: 'Savrulan sürücü cenazesi ve kan birikintisi' },
      { no: '3', desc: 'Kamyonetin fren izi (ıslak zeminde, ≈ 14 m)' },
      { no: '4', desc: 'Dur işareti (dikey yol, her iki yaklaşım)' },
      { no: '5', desc: 'Islak zemin bölgeleri (kaza nedeni işareti)' },
    ],
    objects: [
      ...intersection(),
      // Islak zemin
      { s: 'st-wet', x: 380, y: 300, w: 120, h: 84 },
      { s: 'st-wet', x: 840, y: 380, w: 120, h: 84 },
      lbl('Islak zemin', 420, 420, 9),
      // Dur tabelaları (dikey yol)
      { s: 'ts-stop', x: 598, y: 168, w: 30, h: 30 },
      { s: 'ts-stop', x: 732, y: 556, w: 30, h: 30 },
      lbl('Dur', 636, 180, 9),
      // Hız sınırı
      { s: 'ts-speed', x: 598, y: 120, w: 30, h: 30 },
      // ---- Kamyonet (dikey yoldan iniyor)
      { s: 'v-pickup', x: 642, y: 60, w: 66, h: 150, name: 'Kamyonet (girilen araç)' },
      // ---- Devrilmiş araç
      { s: 'v-overturned', x: 760, y: 312, w: 145, h: 72, name: 'Devrilmiş kamyonet' },
      { s: 'v-sedan', x: 470, y: 322, w: 140, h: 62, name: 'Binek otomobil (çarpan)' },
      // Fren izi (kamyonet yaklaşımı)
      { s: 'tr-skid-straight', x: 715, y: 60, w: 150, h: 80, rot: 90, name: 'Fren izi' },
      // ---- Kazazede
      { s: 'p-4', x: 884, y: 440, w: 34, h: 76, name: 'Sürücü (cenaze)' },
      { s: 'in-blood-pool', x: 848, y: 500, w: 105, h: 78 },
      { s: 'ex-4', x: 800, y: 400, w: 42, h: 30 },
      // Ekipler
      { s: 'v-police', x: 1140, y: 240, w: 130, h: 56 },
      { s: 'v-ambulance', x: 1130, y: 330, w: 150, h: 60 },
      // ---- Numaratörler
      marker('1', 'Devrilmiş kamyonet', 820, 290),
      marker('2', 'Sürücü cenazesi ve kan birikintisi', 950, 560),
      marker('3', 'Fren izi (≈ 14 m)', 830, 100, 30),
      marker('4', 'Dur işareti (uyulmamış)', 566, 140, 30),
      marker('5', 'Islak zemin bölgesi', 350, 280, 30),
      // ---- Ölçüler
      arrow(745, 70, 745, 210, '≈ 14 m'),
      arrow(870, 470, 780, 380, '≈ 1,4 m'),
      // ---- Açıklamalar
      callout('Sürücü kanda %1,32 alkol (adli rapor)', 240, 480, 11),
      callout('Binek araçta kilitli fren izi yok — sağlam duruma geçti', 300, 590, 11),
      note('Zemin: ıslak asfalt, μ ≈ 0,45.', 60, 640, 220),
    ],
  },
  {
    id: 'kaza-5',
    title: 'Kavşak girişinde traktör–kamyon çarpışması (traktör sürücü ölümlü)',
    address: 'Konya / Karatay — Konya-Aksaray Karayolu 14. km, köy kavşağı',
    story:
      'Köy yolundan ana karayola çıkan traktör, yol vermediği için ana yoldan gelen yüklü kamyonun fren izine rağmen çarpışmanın etkisiyle savruldu. Traktör sürücü olay yerinde hayatını kaybetti, yükün bir kısmı yola döküldü.',
    scaleNote: '≈ 1 m = 12 piksel',
    bulgular: [
      { no: '1', desc: 'Traktör sürücüsü cenazesi ve kan birikintisi' },
      { no: '2', desc: 'Savrulan traktör (kavşak içinde, devrik hâlde)' },
      { no: '3', desc: 'Yola dökülen yük (enkaz yığını)' },
      { no: '4', desc: 'Kamyonun fren izi (≈ 19 m)' },
      { no: '5', desc: 'Kavşak uyarı ve hız sınırı tabelaları' },
    ],
    objects: [
      // Dar ikincil yol (bant 120)
      roadH(20, 1346, 360, 150),
      roadV(680, 20, 690, 120),
      lbl('Konya-Aksaray karayolu', 200, 272, 9),
      lbl('Köy yolu', 680, 668, 9),
      // Tabelalar
      { s: 'ts-crossroads', x: 896, y: 150, w: 32, h: 30 },
      { s: 'ts-speed-90', x: 1236, y: 236, w: 30, h: 30 },
      lbl('Hız sınırı 90', 1244, 206, 9),
      // ---- Kamyon (ana yoldan, fren izi)
      { s: 'tr-skid-straight', x: 960, y: 318, w: 200, h: 92, name: 'Fren izi' },
      { s: 'v-truck', x: 700, y: 322, w: 190, h: 64, name: 'Yüklü kamyon' },
      // ---- Traktör (devrilmiş/savrilmiş)
      { s: 'v-tractor', x: 618, y: 180, w: 62, h: 124, name: 'Traktör (savrulmuş)' },
      // Dökülen yük
      { s: 'ex-3', x: 756, y: 356, w: 70, h: 50 },
      { s: 'ex-3', x: 820, y: 380, w: 52, h: 38 },
      // ---- Kazazede
      { s: 'p-9', x: 600, y: 470, w: 110, h: 50, name: 'Traktör sürücüsü (cenaze)' },
      { s: 'in-blood-pool', x: 640, y: 506, w: 105, h: 78 },
      { s: 'tr-liquid-pool', x: 560, y: 430, w: 70, h: 45, name: 'Dizel yakıt birikintisi' },
      // Ekipler
      { s: 'v-police', x: 1140, y: 420, w: 130, h: 56 },
      { s: 'v-ambulance', x: 1120, y: 320, w: 150, h: 60 },
      // ---- Numaratörler
      marker('1', 'Traktör sürücüsü cenazesi', 566, 450),
      marker('2', 'Savrulan traktör', 560, 200),
      marker('3', 'Dökülen yük (enkaz)', 800, 330),
      marker('4', 'Kamyonun fren izi (≈ 19 m)', 1170, 300, 30),
      marker('5', 'Kavşak uyarı tabelası', 872, 190, 30),
      // ---- Ölçüler
      arrow(1150, 300, 960, 300, '≈ 19 m'),
      arrow(640, 250, 680, 300, '≈ 4,5 m'),
      // ---- Açıklamalar
      callout('Traktör yol vermedi (tanık + izler)', 260, 150, 11),
      callout('Kamyon yasal hızda, frenleme yetersiz', 950, 590, 11),
      note('Traktörde ROPS kabini yoktu; sürücü fırladı.', 60, 640, 260),
    ],
  },
];

/* ------------------------------------------------------------------ */
/* GRUP 3 — İKAMETTE CİNAYET                                           */
/* ------------------------------------------------------------------ */

const cinayet: KrokiScenario[] = [
  {
    id: 'cin-1',
    title: 'Salonda bıçakla işlenen cinayet (kanlı terk izi)',
    address: 'Samsun / Atakum — Bahçelievler Mah. 401. Sk. No:8, D:3',
    story:
      'Komşuların sesleri bildirmesi üzerine gelen ekipler, salonda sırtüstü yatan erkek cesedi ve yanında kan birikintisi buldu. Olası silah mutfak bıçağı cesedin yakınında; kanlı ayakkabı izleri kapıya doğru terk güzergâhı oluşturuyor. Kapı kilidi zorlanmamış, mağdur tanıdığını içeri almış olmalı.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur cesedi (sırtüstü, salon halısı üstünde)' },
      { no: '2', desc: 'Ceset altında ve çevresinde kan birikintisi' },
      { no: '3', desc: 'Olası silah: mutfak bıçağı' },
      { no: '4', desc: 'Duvar dibinde kan sıçrama paterni' },
      { no: '5', desc: 'Kapıya giden kanlı ayakkabı izleri (terk yönü)' },
      { no: '6', desc: 'Zeminde sürtünme (sürükleme) izi' },
    ],
    objects: [
      ...room(60, 50, 760, 420),
      win(400, 46, 80, 0),
      door(150, 470, 56, 0),
      // Mobilya
      { s: 'f-8', x: 100, y: 90, w: 170, h: 80, name: 'İkili Koltuk' },
      { s: 'f-5', x: 102, y: 212, w: 88, h: 86, name: 'Tekli Koltuk' },
      { s: 'f-9', x: 280, y: 240, w: 260, h: 160, name: 'Halı' },
      { s: 'f-12', x: 660, y: 66, w: 110, h: 52, name: 'Gardırop' },
      // Ceset ve kan
      { s: 'p-3', x: 428, y: 296, w: 38, h: 84, name: 'Mağdur (ceset)' },
      { s: 'in-blood-pool', x: 462, y: 346, w: 130, h: 95 },
      { s: 'in-blood-splatter', x: 614, y: 296, w: 70, h: 70 },
      { s: 'in-blood-smear', x: 470, y: 408, w: 150, h: 55, rot: -8 },
      // Silah
      { s: 'w-2', x: 396, y: 274, w: 26, h: 26, rot: 40, name: 'Bıçak' },
      // Kanlı ayak izleri (terk güzergâhı)
      { s: 'tr-bloody-footprint', x: 296, y: 438, w: 26, h: 34, rot: 15 },
      { s: 'tr-bloody-footprint', x: 338, y: 428, w: 26, h: 34, rot: -5 },
      { s: 'tr-bloody-footprint', x: 378, y: 418, w: 26, h: 34, rot: 8 },
      // Numaratörler
      marker('1', 'Mağdur cesedi (sırtüstü)', 392, 268),
      marker('2', 'Kan birikintisi', 620, 380),
      marker('3', 'Olası silah: mutfak bıçağı', 366, 254, 30),
      marker('4', 'Duvar dibinde kan sıçraması', 712, 330, 30),
      marker('5', 'Kanlı ayakkabı izleri', 268, 452),
      marker('6', 'Zeminde sürükleme izi', 648, 428),
      // Ölçüler
      arrow(462, 330, 640, 330, '≈ 1,7 m'),
      arrow(180, 452, 428, 350, '≈ 2,9 m'),
      // Açıklamalar
      callout('Olası silah: 25 cm mutfak bıçağı', 250, 180, 11),
      note('Şüpheli kapıdan çıkış (tanık: 22:40).', 620, 520, 230),
      dash(200, 500, 90, 590),
      lbl('Kaçış yönü', 120, 620, 10),
    ],
  },
  {
    id: 'cin-2',
    title: 'Yatak odasında silahlı cinayet (3 kovan, duvar isabet izi)',
    address: 'Diyarbakır / Bağlar — Kaynartepe Mah. 6. Sk. No:21',
    story:
      'Yatak odasında başından vurulmuş kadın cesedi bulundu. Yerde 3 adet boş 9 mm kovan, yatak başlığında kan sıçraması ve sol duvarda iki mermi isabet izi tespit edildi. Tabanca olay yerinden alınmamış; pencere kapalı, kapı zorlanmamış.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur cesedi (yatak yanı, yüzüstü)' },
      { no: '2', desc: 'Zeminde 3 adet boş kovan (9 mm)' },
      { no: '3', desc: 'Yatak başlığında kan sıçrama paterni' },
      { no: '4', desc: 'Sol duvarda 2 adet mermi isabet izi' },
      { no: '5', desc: 'Pencere altında ayakkabı taban izi' },
      { no: '6', desc: 'Zeminde kan birikintisi' },
    ],
    objects: [
      // Yatak odası + banyo
      ...room(80, 50, 460, 460),
      innerV(540, 50, 220),
      innerH(540, 270, 200),
      door(556, 270, 44, 0),
      lbl('Banyo', 645, 150, 10),
      door(350, 510, 54, 0),
      win(440, 46, 70, 0),
      // Mobilya
      { s: 'f-2', x: 110, y: 80, w: 150, h: 200, name: 'Çift Kişilik Yatak' },
      { s: 'f-13', x: 300, y: 64, w: 130, h: 55, name: 'Gardırop' },
      { s: 'f-11', x: 280, y: 300, w: 80, h: 150, name: 'Yolluk' },
      // Ceset ve kan
      { s: 'p-4', x: 200, y: 336, w: 36, h: 80, name: 'Mağdur (ceset)' },
      { s: 'in-blood-pool', x: 236, y: 356, w: 120, h: 90 },
      { s: 'in-blood-splatter', x: 226, y: 150, w: 55, h: 55 },
      { s: 'in-bullet-in', x: 214, y: 352, w: 14, h: 14 },
      // Kovanlar
      { s: 'tr-casing-pistol', x: 348, y: 398, w: 16, h: 16 },
      { s: 'tr-casing-pistol', x: 374, y: 414, w: 16, h: 16 },
      { s: 'tr-casing-pistol', x: 394, y: 396, w: 16, h: 16 },
      // Duvar isabet izleri (sol duvar iç yüzü)
      { s: 'tr-bullet-wall', x: 92, y: 148, w: 16, h: 16 },
      { s: 'tr-bullet-wall', x: 92, y: 190, w: 16, h: 16 },
      // Ayakkabı izi (pencere altı)
      { s: 'tr-footprint', x: 467, y: 79, w: 26, h: 42, rot: -10 },
      // Numaratörler
      marker('1', 'Mağdur cesedi (yüzüstü)', 168, 320),
      marker('2', '3 adet boş kovan (9 mm)', 428, 428),
      marker('3', 'Yatak başlığında kan sıçraması', 292, 172, 30),
      marker('4', 'Duvar isabet izleri', 130, 172, 30),
      marker('5', 'Pencere altında ayakkabı izi', 520, 96, 30),
      marker('6', 'Kan birikintisi', 356, 330),
      // Ölçüler
      arrow(402, 406, 100, 172, '2,6 m'),
      arrow(258, 180, 230, 328, '1,5 m'),
      // Açıklamalar
      callout('3 boş kovan — 9 mm tabanca', 660, 300, 11),
      callout('Atış mesafesi yakın (< 1 m) — adli tıp', 680, 360, 11),
      note('Kapı zorlanmamış; mağdur tanıdığını içeri almış olabilir.', 560, 430, 260),
    ],
  },
  {
    id: 'cin-3',
    title: 'Misafir odasında boğulma (mekanik asfiksi) cinayeti',
    address: 'Kayseri / Melikgazi — Alpaslan Mah. Şehit Yüzbaşı Sk. No:4',
    story:
      'Misafir odasında yatağın yanında yan pozisyonda erkek cesedi bulundu. Boyun bölgesinde belirgin ekimozlar ve tırnak sıyrıkları var; adli tıp ilk raporunda mekanik asfiksi (boğma) değerlendirmesi yapıldı. Oda düzenli, kapı ve pencere sağlam; mağdur son aramayı gece 23:12 yapmış.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur cesedi (yan pozisyon, yatak yanı)' },
      { no: '2', desc: 'Boyun bölgesinde ekimoz ve tırnak sıyrıkları' },
      { no: '3', desc: 'Mağdurun telefonu (son arama 23:12)' },
      { no: '4', desc: 'Zeminde ayakkabı taban izleri (bilinmeyen kişi)' },
      { no: '5', desc: 'Yatak üstünde mücadele izi (yatak örtüsü dağınık)' },
    ],
    objects: [
      ...room(100, 60, 640, 400),
      win(300, 56, 80, 0),
      door(620, 460, 54, 0),
      // Mobilya
      { s: 'f-1', x: 140, y: 90, w: 110, h: 200, name: 'Tek Kişilik Yatak' },
      { s: 'f-5', x: 300, y: 100, w: 88, h: 86, name: 'Koltuk' },
      { s: 'f-9', x: 260, y: 260, w: 220, h: 150, name: 'Halı' },
      { s: 'f-12', x: 470, y: 76, w: 90, h: 50, name: 'Komodin' },
      // Ceset + yaralanmalar
      { s: 'p-9', x: 376, y: 178, w: 110, h: 50, name: 'Mağdur (ceset)' },
      { s: 'in-bruise', x: 420, y: 172, w: 24, h: 18 },
      { s: 'in-scratch', x: 448, y: 196, w: 18, h: 12 },
      // Deliller
      { s: 'ei-phone', x: 248, y: 318, w: 24, h: 36 },
      { s: 'ei-keys', x: 518, y: 298, w: 20, h: 26 },
      { s: 'ei-watch', x: 500, y: 338, w: 24, h: 24 },
      { s: 'tr-footprint', x: 195, y: 377, w: 26, h: 42, rot: 10 },
      { s: 'tr-footprint', x: 241, y: 391, w: 26, h: 42, rot: -12 },
      // Numaratörler
      marker('1', 'Mağdur cesedi (yan pozisyon)', 342, 160),
      marker('2', 'Boyun bölgesinde ekimozlar', 486, 150, 30),
      marker('3', 'Mağdurun telefonu', 288, 350),
      marker('4', 'Bilinmeyen kişiye ait ayakkabı izleri', 296, 430),
      marker('5', 'Yatak üstünde mücadele izi', 195, 112, 30),
      // Ölçüler
      arrow(252, 190, 374, 192, '1,3 m'),
      arrow(200, 130, 200, 288, '≈ 1,6 m'),
      // Açıklamalar
      callout('Ölüm mekaniği: mekanik asfiksi (adli tıp ilk raporu)', 350, 560, 11),
      callout('Oda düzenli; tanıdık ziyaret olasılığı', 700, 300, 11),
      note('Şüpheli: mağdurun tanıdığı (ifade aşamasında).', 420, 610, 260),
    ],
  },
  {
    id: 'cin-4',
    title: 'Mutfakta zehirli içecek cinayeti şüphesi',
    address: 'Gaziantep / Şahinbey — Yamaçtepe Mah. 83014. Cd. No:17',
    story:
      'Mutfakta masanın başında oturan hâlde hayatını kaybeden kadın cesedi bulundu. Masada dökülmüş içecek, boş şişe ve yabancıya ait parmak izi toplanan şırınga bulundu. Mide içeriğinde toksik madde tespit edildi; şüpheli aynı gün evden ayrılmış.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur cesedi (masa başında, yan pozisyon)' },
      { no: '2', desc: 'Zeminde dökülen içecek birikintisi' },
      { no: '3', desc: 'Şüpheli boş şişe (ağız çevresinde parmak izi yok)' },
      { no: '4', desc: 'Zeminde şırınga (toksik madde kalıntısı)' },
      { no: '5', desc: 'Mağdurun gözlüğü (masa altında)' },
    ],
    objects: [
      ...room(80, 60, 620, 380),
      win(300, 56, 80, 0),
      door(300, 440, 54, 0),
      // Mutfak dolapları
      { s: 'f-4', x: 100, y: 80, w: 230, h: 160, name: 'L Tezgah' },
      { s: 'f-3', x: 480, y: 80, w: 180, h: 55, name: 'Tezgah' },
      // Masa (boş dikdörtgen)
      { s: 'ev-rect-hollow', x: 350, y: 240, w: 130, h: 85 },
      lbl('Masa', 415, 282, 10),
      { s: 'f-5', x: 300, y: 120, w: 70, h: 68, name: 'Sandalye yeri' },
      { s: 'f-5', x: 460, y: 120, w: 70, h: 68, name: 'Sandalye yeri' },
      // Ceset
      { s: 'p-9', x: 300, y: 376, w: 110, h: 50, name: 'Mağdur (ceset)' },
      { s: 'in-bruise', x: 330, y: 396, w: 20, h: 14 },
      // Deliller
      { s: 'tr-liquid-pool', x: 430, y: 348, w: 70, h: 45 },
      { s: 'ei-bottle', x: 398, y: 292, w: 18, h: 44 },
      { s: 'ei-syringe', x: 452, y: 328, w: 50, h: 26, rot: -15 },
      { s: 'tr-3', x: 392, y: 284, w: 18, h: 18 },
      { s: 'ei-glasses', x: 328, y: 338, w: 26, h: 26 },
      // Numaratörler
      marker('1', 'Mağdur cesedi (masa başında)', 272, 350),
      marker('2', 'Dökülen içecek birikintisi', 530, 370),
      marker('3', 'Şüpheli boş şişe', 358, 268, 30),
      marker('4', 'Zeminde şırınga', 540, 300, 30),
      marker('5', 'Mağdurun gözlüğü', 296, 320, 30),
      // Ölçüler
      arrow(410, 290, 356, 384, '1,1 m'),
      arrow(100, 140, 660, 140, '≈ 5,9 m'),
      // Açıklamalar
      callout('Mide içeriğinde toksik madde (ilk tahlil)', 240, 500, 11),
      callout('Şişe üzerinde mağdura ait iz yok', 680, 460, 11),
      note('Şüpheli olay günü 14:30 sıralarında evden ayrılmış.', 480, 560, 270),
    ],
  },
  {
    id: 'cin-5',
    title: 'Doğalgaz patlamasıyla örtbas edilmeye çalışılan cinayet',
    address: 'Mersin / Yenişehir — Deniz Mah. 4531. Sk. No:9 (daire, patlama sonrası)',
    story:
      'Dairede doğalgaz patlaması meydana geldi; itfaiye söndürme sırasında göğsünde kurşun yarası bulunan bir ceset tespit etti. Patlama merkezi mutfak değil oturma odasıydı; gaz vanası dışarıdan kapatılmıştı. Otopside patlamadan önce silahla vurulduğu belirlendi.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur cesedi (göğüste kurşun yarası)' },
      { no: '2', desc: 'Duvar üstünde mermi isabet izi' },
      { no: '3', desc: 'Patlama merkezi (oturma odası — anormal)' },
      { no: '4', desc: 'Enkaz ve moloz yığını' },
      { no: '5', desc: 'Dışarıdan kapatılmış gaz vana bölgesi (kombi)' },
      { no: '6', desc: 'Yıkılan duvar bölümü' },
    ],
    objects: [
      // Kısmi kalan dış duvarlar
      { s: 'arch-w1i', x: 56, y: 46, w: 310, h: 8 },
      { s: 'arch-w1i', x: 410, y: 46, w: 210, h: 8 },
      { s: 'arch-w1i', x: 60, y: 466, w: 700, h: 8 },
      { s: 'arch-w1vi', x: 56, y: 54, w: 8, h: 412 },
      // Yıkılan sağ duvar
      { s: 'ex-5', x: 620, y: 60, w: 60, h: 290, name: 'Yıkılan duvar' },
      lbl('Yıkılan duvar', 640, 370, 9),
      // Patlama etkileri
      { s: 'ex-2', x: 396, y: 236, w: 180, h: 180, name: 'Patlama merkezi' },
      { s: 'ex-3', x: 296, y: 316, w: 120, h: 90 },
      { s: 'ex-4', x: 244, y: 176, w: 80, h: 60 },
      { s: 'ex-4', x: 470, y: 180, w: 60, h: 45 },
      // Kombi
      { s: 'ev-rect-hollow', x: 130, y: 70, w: 64, h: 42 },
      lbl('Kombi', 162, 91, 9),
      // Ceset + yara
      { s: 'p-4', x: 418, y: 344, w: 36, h: 78, name: 'Mağdur (ceset)' },
      { s: 'in-bullet-in', x: 432, y: 360, w: 14, h: 14 },
      // Duvar isabet izi
      { s: 'tr-bullet-wall', x: 106, y: 196, w: 16, h: 16 },
      { s: 'tr-bullet-wall', x: 106, y: 230, w: 16, h: 16 },
      // Numaratörler
      marker('1', 'Mağdur cesedi (kurşun yarası)', 376, 320),
      marker('2', 'Duvar üstü mermi izleri', 146, 216, 30),
      marker('3', 'Patlama merkezi (oturma odası)', 560, 300, 30),
      marker('4', 'Enkaz yığını', 250, 380, 30),
      marker('5', 'Gaz vanası / kombi bölgesi', 100, 140, 30),
      marker('6', 'Yıkılan duvar bölümü', 720, 420, 30),
      // Ölçüler
      arrow(400, 240, 200, 100, '≈ 2,9 m'),
      arrow(470, 250, 470, 350, '≈ 1,1 m'),
      // Açıklamalar
      callout('Otopsi: patlamadan ÖNCE silahla vurulmuş', 260, 550, 11),
      callout('Gaz vanası dışarıdan kapatılmış — şüpheli eylem', 700, 520, 11),
      { s: 'v-firetruck', x: 860, y: 300, w: 150, h: 64, name: 'İtfaiye aracı' },
      lbl('İtfaiye', 935, 390, 9),
      note('Patlama merkezi mutfak değil (adli inceleme).', 60, 620, 260),
    ],
  },
];

/* ------------------------------------------------------------------ */
/* GRUP 4 — ASI SURETİYLE İNTİHAR                                      */
/* ------------------------------------------------------------------ */

const intihar: KrokiScenario[] = [
  {
    id: 'int-1',
    title: 'Yatak odasında gardırop kancasına asılma',
    address: 'Trabzon / Ortahisar — Kalkınma Mah. Şht. Recep Cd. No:32, D:7',
    story:
      'Anne, oğlunu yatak odasında gardırop yan kancasına bağlanmış ip ile asılı buldu; 112 ekibi kapıyı kırarak girdi. Devrik tabure, çıkarılmış ayakkabılar ve telefonda veda mesajı taslağı tespit edildi. Kapı içeriden kilitliydi.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur (asılı hâli; yere indirilmeden önce konumu)' },
      { no: '2', desc: 'İp bağlantı noktası: gardırop yan kancası' },
      { no: '3', desc: 'El yazısı intihar notu (çekmecede)' },
      { no: '4', desc: 'Telefon (veda mesajı taslağı açık)' },
      { no: '5', desc: 'Çıkarılmış ayakkabılar' },
      { no: '6', desc: 'Devrik tabure' },
    ],
    objects: [
      ...room(100, 60, 600, 440),
      door(560, 500, 54, 0),
      win(320, 56, 80, 0),
      // Gardırop + ip
      { s: 'f-13', x: 116, y: 76, w: 130, h: 55, name: 'Gardırop' },
      lbl('Bağlantı noktası', 430, 88, 9),
      // Mağdur (ipin ucunda, asılı konum — uygulama içi ASILI İNSAN FİGÜRÜ; ip figürle birlikte çizilir)
      { s: 'p-hanged', x: 278, y: 92, w: 47, h: 245, name: 'Mağdur (asılı)' },
      // Devrik tabure
      { s: 'f-5', x: 336, y: 330, w: 80, h: 75, rot: 35, name: 'Devrik tabure' },
      // Deliller
      { s: 'cl-shoe', x: 150, y: 382, w: 24, h: 24 },
      { s: 'cl-shoe', x: 186, y: 392, w: 24, h: 24, rot: 20 },
      { s: 'ei-phone', x: 242, y: 324, w: 30, h: 44 },
      { s: 'ei-documents', x: 380, y: 300, w: 46, h: 40 },
      { s: 'f-9', x: 420, y: 240, w: 200, h: 140, name: 'Halı' },
      // Numaratörler
      marker('1', 'Mağdur (asılı konum)', 200, 210),
      marker('2', 'İp bağlantı noktası', 368, 106, 30),
      marker('3', 'El yazısı intihar notu', 452, 282, 30),
      marker('4', 'Telefon (veda mesajı taslağı)', 262, 364),
      marker('5', 'Çıkarılmış ayakkabılar', 128, 430, 30),
      marker('6', 'Devrik tabure', 452, 386, 30),
      // Ölçüler
      arrow(246, 132, 294, 132, '≈ 50 cm'),
      arrow(116, 430, 116, 130, '≈ 3,1 m'),
      // Açıklamalar
      callout('Mağdur ayakları yerden 8 cm yukarıda (asılı)', 520, 220, 11),
      callout('Kapı içeriden kilitli — 112 ekibi kırdı', 500, 552, 11),
      note('112 ekibin girişi sonrası kapı kanadı kırıldı.', 60, 560, 230, 9),
    ],
  },
  {
    id: 'int-2',
    title: 'Banyoda duş teline asılma (kapı içeriden kilitli)',
    address: 'Denizli / Merkezefendi — Gülendam Mah. 1255. Sk. No:6, D:11',
    story:
      'Eve geç dönen eş, banyo kapısının içeriden kilitli olduğunu fark etti; kapıyı tornavida ile açtığında eşini duş teline bağlı ip ile asılı buldu. Lavabo üstünde telefon ve banyo zemininde katlanmış intihar notu bulundu; ayakkabılar banyo kapısı önüne düzgün bırakılmıştı.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur (asılı hâli; duş teknesi üzerinde)' },
      { no: '2', desc: 'İp bağlantı noktası: duş teli' },
      { no: '3', desc: 'Banyo zemininde katlanmış intihar notu' },
      { no: '4', desc: 'Lavabo üstünde telefon (mesaj kaydı alındı)' },
      { no: '5', desc: 'Banyo kapısı önünde çıkarılmış ayakkabılar' },
      { no: '6', desc: 'Duş suyu birikintisi (olay zamanı göstergesi)' },
    ],
    objects: [
      ...room(200, 80, 360, 320),
      door(360, 400, 50, 0),
      // Duş teknesi
      { s: 'ev-rect-hollow', x: 230, y: 100, w: 90, h: 60 },
      lbl('Duş teknesi', 275, 130, 9),
      // Lavabo dolabı (sağ duvar)
      { s: 'f-3', x: 564, y: 110, w: 90, h: 50, rot: 90, name: 'Lavabo dolabı' },
      // Mağdur (duş teline bağlı, asılı insan figürü — ip figürle birlikte çizilir)
      { s: 'p-hanged', x: 268, y: 90, w: 47, h: 245, name: 'Mağdur (asılı)' },
      // Deliller
      { s: 'ei-documents', x: 505, y: 226, w: 42, h: 36 },
      { s: 'ei-phone', x: 522, y: 132, w: 28, h: 42 },
      { s: 'tr-liquid-pool', x: 330, y: 300, w: 70, h: 45 },
      { s: 'cl-shoe', x: 376, y: 428, w: 24, h: 24 },
      { s: 'cl-shoe', x: 408, y: 434, w: 24, h: 24, rot: 15 },
      // Numaratörler
      marker('1', 'Mağdur (asılı konum)', 300, 190),
      marker('2', 'İp bağlantı noktası: duş teli', 352, 84, 30),
      marker('3', 'Katlanmış intihar notu', 560, 260, 30),
      marker('4', 'Telefon (lavabo üstü)', 580, 120, 30),
      marker('5', 'Çıkarılmış ayakkabılar', 480, 448, 30),
      marker('6', 'Duş suyu birikintisi', 330, 330, 30),
      // Ölçüler
      arrow(345, 170, 385, 395, '≈ 2,3 m'),
      arrow(214, 84, 214, 392, '≈ 3,3 m'),
      // Açıklamalar
      callout('Kapı içeriden kilitli, tornavida ile açıldı', 640, 340, 11),
      callout('Bağlantı noktası: duş teli (metal)', 260, 560, 11),
      note('Banyo kapısı dıştan kilit dili tornavida ile itildi.', 480, 560, 240, 9),
    ],
  },
  {
    id: 'int-3',
    title: 'Villa merdiven sahanlığında korkuluğa asılma',
    address: 'Muğla / Bodrum — Gölköy Mah. Yalıkavak Yolu No:41 (villa)',
    story:
      'Villa sahibi, gece alt kattan gelen ses üzerine merdiven sahanlığında oğlunu korkuluk demirine bağlı ip ile asılı buldu. Sahanlıkta telefon ve anahtarlar; merdiven başında çıkarılmış ayakkabılar vardı. Cebinden katlanmış intihar notu çıktı.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur (asılı hâli; sahanlık korkuluğu önü)' },
      { no: '2', desc: 'İp bağlantı noktası: korkuluk demiri' },
      { no: '3', desc: 'Katlanmış intihar notu (mağdur cebinden)' },
      { no: '4', desc: 'Sahanlıkta telefon ve anahtarlar' },
      { no: '5', desc: 'Merdiven başında çıkarılmış ayakkabılar' },
    ],
    objects: [
      // Üst merdiven uçuşu (yatay) + alt uçuş (dikey) + sahanlık
      { s: 'arch-6-v4', x: 150, y: 80, w: 110, h: 260, name: 'Merdiven (alt uçuş)' },
      { s: 'ev-rect-hollow', x: 150, y: 340, w: 210, h: 130 },
      lbl('Sahanlık', 255, 405, 10),
      { s: 'arch-6-v4', x: 290, y: 250, w: 110, h: 220, rot: -90, name: 'Merdiven (üst uçuş)' },
      // Korkuluk
      { s: 'out-fence', x: 390, y: 136, w: 130, h: 50, name: 'Korkuluk' },
      // Mağdur (korkuluğa bağlı, asılı insan figürü — ip figürle birlikte çizilir)
      { s: 'p-hanged', x: 448, y: 148, w: 47, h: 245, name: 'Mağdur (asılı)' },
      // Deliller
      { s: 'ei-phone', x: 244, y: 390, w: 30, h: 44 },
      { s: 'ei-keys', x: 300, y: 424, w: 20, h: 26 },
      { s: 'ei-documents', x: 196, y: 414, w: 44, h: 38 },
      { s: 'cl-shoe', x: 330, y: 148, w: 22, h: 22 },
      { s: 'cl-shoe', x: 356, y: 156, w: 22, h: 22, rot: 25 },
      lbl('Alt kat holü', 250, 540, 10),
      door(600, 500, 54, 0),
      lbl('Giriş kapısı', 660, 520, 9),
      // Numaratörler
      marker('1', 'Mağdur (asılı konum)', 585, 250),
      marker('2', 'İp bağlantı noktası: korkuluk', 380, 110, 30),
      marker('3', 'Katlanmış intihar notu', 150, 470, 30),
      marker('4', 'Telefon ve anahtarlar (sahanlık)', 356, 458, 30),
      marker('5', 'Çıkarılmış ayakkabılar', 310, 200, 30),
      // Ölçüler
      arrow(470, 402, 280, 452, '≈ 3,1 m'),
      arrow(150, 80, 150, 340, '≈ 2,7 m'),
      // Açıklamalar
      callout('Mağdur korkuluk demirine ip bağlamış', 700, 200, 11),
      callout('Aile bireyi buldu; 112 ekipleri geldi', 700, 260, 11),
      note('Sahanlık yüksekliği ≈ 2,7 m.', 60, 600, 220, 9),
    ],
  },
  {
    id: 'int-4',
    title: 'Çatı katı depoda kirişe asılma',
    address: 'Malatya / Battalgazi — Kernek Mah. İstasyon Cd. arka depo (çatı katı)',
    story:
      'İş yeri sahibi, iki gün boyunca kendisinden haber alamadığı çalışanın çatı katı deposunda kirişe bağlı ip ile asılı olduğunu gördü. Depo kapısı sürgüsü dışarıdan kilitliydi; anahtar mağdurun cebindeydi. Masada intihar notu, yerde devrik tabure bulundu.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur (asılı hâli; çatı kirişi altında)' },
      { no: '2', desc: 'İp bağlantı noktası: çatı kirişi' },
      { no: '3', desc: 'Depo masasından intihar notu' },
      { no: '4', desc: 'Mağdurun kimliği ve anahtarları' },
      { no: '5', desc: 'Devrik tabure' },
      { no: '6', desc: 'Toz tabakada ayakkabı taban izleri' },
    ],
    objects: [
      ...room(60, 80, 900, 340),
      win(500, 76, 80, 0),
      // Çatı kirişi
      { s: 'arch-w1i', x: 200, y: 180, w: 420, h: 6 },
      lbl('Çatı kirişi', 410, 166, 9),
      // Mağdur (kirişe bağlı, asılı insan figürü — ip figürle birlikte çizilir)
      { s: 'p-hanged', x: 410, y: 188, w: 44, h: 230, name: 'Mağdur (asılı)' },
      // Devrik tabure
      { s: 'f-5', x: 560, y: 340, w: 80, h: 75, rot: 40, name: 'Devrik tabure' },
      // Deliller
      { s: 'ei-documents', x: 250, y: 330, w: 46, h: 40 },
      { s: 'ei-id-card', x: 320, y: 350, w: 24, h: 24 },
      { s: 'ei-keys', x: 508, y: 300, w: 20, h: 26 },
      { s: 'ei-phone', x: 520, y: 330, w: 30, h: 44 },
      { s: 'tr-footprint', x: 297, y: 197, w: 26, h: 42 },
      { s: 'tr-footprint', x: 343, y: 187, w: 26, h: 42, rot: 12 },
      // Koliler
      ...box(680, 120, 70, 50, 'Koli'),
      ...box(772, 140, 60, 45),
      ...box(706, 220, 65, 48),
      // Numaratörler
      marker('1', 'Mağdur (asılı konum)', 378, 330),
      marker('2', 'İp bağlantı noktası: kiriş', 472, 212, 30),
      marker('3', 'İntihar notu', 210, 370, 30),
      marker('4', 'Kimlik ve anahtarlar', 300, 420, 30),
      marker('5', 'Devrik tabure', 668, 400, 30),
      marker('6', 'Toz tabakada ayakkabı izleri', 390, 225, 30),
      // Ölçüler
      arrow(496, 390, 556, 390, '≈ 45 cm'),
      arrow(60, 183, 200, 183, '1,5 m'),
      // Açıklamalar
      callout('Depo kapısı sürgüsü dışarıdan kilitli; anahtar mağdurda', 700, 420, 11),
      callout('Pencere içeriden kilitli', 600, 120, 11),
      note('İntihar notu adli belge incelemesine gönderildi.', 60, 620, 260, 9),
    ],
  },
  {
    id: 'int-5',
    title: 'Bahçedeki ağaca asılma (arka bahçe)',
    address: 'Van / Edremit — Sahil Mah. 4. Cd. No:66 (müstakil ev arka bahçesi)',
    story:
      'Komşu, sabah evin arka bahçesindeki ceviz ağacına ip bağlı olarak asılı duran kişiyi görünce polisi aradı. Bank üzerinde veda mesajı açık telefon, ağaç dibinde katlanmış not bulundu. Ayakkabılar düzgün bırakılmış, zeminde çamur izleri mevcut.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur (asılı hâli; ceviz ağacı altında)' },
      { no: '2', desc: 'İp bağlantı noktası: sağ ana dal' },
      { no: '3', desc: 'Ağaç dibinde katlanmış intihar notu' },
      { no: '4', desc: 'Bank üzerinde telefon (veda mesajı)' },
      { no: '5', desc: 'Çıkarılmış ayakkabılar' },
      { no: '6', desc: 'Bahçede çamur izleri (gece ayak sesi)' },
    ],
    objects: [
      // Bahçe sınırları
      { s: 'out-fence', x: 200, y: 56, w: 160, h: 50 },
      { s: 'out-fence', x: 380, y: 56, w: 160, h: 50 },
      { s: 'out-fence', x: 150, y: 240, w: 140, h: 50, rot: 90 },
      lbl('Bahçe duvarı', 460, 80, 9),
      // Ev (sağda, kısmi cephe)
      ...room(1000, 120, 320, 380),
      door(1020, 500, 52, 0),
      lbl('Ev (arka cephe)', 1160, 90, 10),
      // Sokak lambası
      { s: 'out-street-light', x: 856, y: 176, w: 40, h: 54 },
      // Ağaç + ip + mağdur
      { s: 'out-tree-1', x: 500, y: 216, w: 90, h: 90, name: 'Ceviz ağacı' },
      // Mağdur (ağaç ana dalına bağlı, asılı insan figürü — ip figürle birlikte çizilir)
      { s: 'p-hanged', x: 538, y: 246, w: 47, h: 245, name: 'Mağdur (asılı)' },
      // Devrik bahçe taburesi
      { s: 'out-bench', x: 660, y: 260, w: 80, h: 36, rot: 25, name: 'Devrik tabure' },
      // Deliller
      { s: 'cl-shoe', x: 416, y: 340, w: 24, h: 24 },
      { s: 'cl-shoe', x: 448, y: 352, w: 24, h: 24, rot: 18 },
      { s: 'ei-documents', x: 645, y: 412, w: 44, h: 38 },
      { s: 'out-bench', x: 700, y: 420, w: 90, h: 38, name: 'Bank' },
      { s: 'ei-phone', x: 722, y: 386, w: 30, h: 44 },
      { s: 'tr-mud', x: 300, y: 420, w: 80, h: 50 },
      { s: 'tr-footprint', x: 377, y: 397, w: 26, h: 42 },
      { s: 'tr-footprint', x: 417, y: 381, w: 26, h: 42, rot: -10 },
      // Numaratörler
      marker('1', 'Mağdur (asılı konum)', 430, 262),
      marker('2', 'İp bağlantı noktası: ana dal', 560, 190, 30),
      marker('3', 'Katlanmış intihar notu', 670, 380, 30),
      marker('4', 'Telefon (bank üstü)', 790, 380, 30),
      marker('5', 'Çıkarılmış ayakkabılar', 390, 330, 30),
      marker('6', 'Bahçede çamur izleri', 340, 500, 30),
      // Ölçüler
      arrow(545, 260, 1005, 300, '≈ 5,2 m'),
      arrow(200, 300, 500, 280, '≈ 3,2 m'),
      // Açıklamalar
      callout('Ayaklar yerden 25 cm — ölüm mekaniği ası (adli tıp)', 260, 560, 11),
      callout('Bahçe kapısı içeriden sürgülüydü', 780, 560, 11),
      note('Hava: açık, gece sıcaklığı 11°C.', 60, 640, 220, 9),
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Grup 5: OTODAN HIRSIZLIK (araç içi / araçtan hırsızlık)             */
/* ------------------------------------------------------------------ */
const otoHirsizligi: KrokiScenario[] = [
  {
    id: 'oto-1',
    title: 'Sokak kenarında park halindeki araçtan cam kırma hırsızlığı',
    address: 'Ankara / Çankaya — Kızılırmak Mah. Dikmen Cd. No:144 kenarı park yeri',
    story:
      'Mağdur aracını gece 22.30-07.00 arasında sokak kenarına park etti; sabah sağ arka camın taşla kırıldığını, bagajdaki dizüstü bilgisayar çantasının alındığını gördü. Yerinde cam kırıkları, kopan bagaj kilidi ve şüpheliye ait ayak izleri tespit edildi.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur aracı (sağ arka cam kırık)' },
      { no: '2', desc: 'Zemindeki cam kırıkları' },
      { no: '3', desc: 'Bagajda kalan belgeler (çalıntı: dizüstü bilgisayar)' },
      { no: '4', desc: 'Şüpheliye ait ayak izleri' },
      { no: '5', desc: 'Şüphelinin kaçış yönü' },
      { no: '6', desc: 'Karşı bina güvenlik kamerası görüntü noktası' },
    ],
    objects: [
      roadH(20, 1346, 300, 150),
      { s: 'out-fence', x: 160, y: 60, w: 160, h: 50 },
      { s: 'out-fence', x: 340, y: 60, w: 160, h: 50 },
      lbl('Apartman bahçe duvarı', 340, 85, 9),
      { s: 'out-street-light', x: 100, y: 130, w: 40, h: 54 },
      // Mağdur araç + kırık cam
      { s: 'v-sedan', x: 600, y: 240, w: 180, h: 78, name: 'Binek otomobil (mağdur aracı)' },
      { s: 'ex-4', x: 740, y: 330, w: 64, h: 42, name: 'Kırılan camlar (sağ arka kapı önü)' },
      { s: 'ei-keys', x: 688, y: 334, w: 30, h: 42, name: 'Kopan bagaj kilidi (yerde)' },
      { s: 'ei-documents', x: 830, y: 330, w: 44, h: 38, name: 'Bagajda kalan belgeler' },
      // Şüpheli izleri + kaçış
      { s: 'tr-footprint', x: 980, y: 330, w: 26, h: 42 },
      { s: 'tr-footprint', x: 1024, y: 318, w: 26, h: 42, rot: -12 },
      dash(1100, 340, 1300, 240, 'Kaçış yönü'),
      // Kamera
      { s: 'out-cctv', x: 1180, y: 110, w: 52, h: 40, name: 'Güvenlik kamerası' },
      lbl('Kamera görüş alanı', 1180, 175, 9),
      // Numaratörler
      marker('1', 'Mağdur araç', 560, 272),
      marker('2', 'Cam kırıkları', 772, 400),
      marker('3', 'Bagajda kalan belgeler', 880, 400),
      marker('4', 'Şüpheli ayak izleri', 1002, 408),
      marker('5', 'Kaçış yönü', 1240, 205),
      marker('6', 'Güvenlik kamerası', 1252, 145, 30),
      // Ölçüler + açıklamalar
      arrow(600, 430, 780, 430, '≈ 4,5 m'),
      callout('Sağ arka cam taş ile kırıldı', 420, 175, 11),
      callout('Olay 22.30 - 07.00 arasında gerçekleşti', 900, 160, 11),
      note('Kamera kaydı komşu apartman yönetiminden talep edildi.', 40, 640, 270, 9),
    ],
  },
  {
    id: 'oto-2',
    title: 'AVM kapalı otoparkında araç içinden hırsızlık',
    address: 'İstanbul / Kadıköy — Caferağa Mah. AVM kapalı otopark B1 katı',
    story:
      'Araç sahibi akşam aracına döndüğünde ön sol camın kırıldığını, kapı kilidi zorlanmadan konsol ses sisteminin söküldüğünü fark etti. Otopark kamerası şüphelinin B-14 slotuna yaklaştığını gösteriyor; yerde kırıcı alet ve cam kırıkları bulundu.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur araç (B-14 slotu, ön sol cam kırık)' },
      { no: '2', desc: 'Zemindeki cam kırıkları' },
      { no: '3', desc: 'Kırıcı alet (sopa — şüpheliye ait)' },
      { no: '4', desc: 'Mağdurun düşen gözlüğü' },
      { no: '5', desc: 'Şüpheli ayak izleri (merdiven yönü)' },
      { no: '6', desc: 'Otopark güvenlik kamerası' },
    ],
    objects: [
      // Park sıraları
      { s: 'ev-rect-hollow', x: 240, y: 160, w: 200, h: 100 },
      { s: 'ev-rect-hollow', x: 470, y: 160, w: 200, h: 100 },
      { s: 'ev-rect-hollow', x: 700, y: 160, w: 200, h: 100 },
      lbl('B-12', 340, 210, 10),
      lbl('B-13', 570, 210, 10),
      lbl('B-14', 800, 210, 10),
      // Araçlar
      { s: 'v-panelvan', x: 485, y: 172, w: 175, h: 76, name: 'Komşu araç (B-13)' },
      { s: 'v-sedan', x: 715, y: 172, w: 170, h: 74, name: 'Mağdur araç (B-14)' },
      // Deliller
      { s: 'ex-4', x: 700, y: 290, w: 60, h: 40, name: 'Cam kırıkları (ön sol kapı önü)' },
      { s: 'w-5', x: 610, y: 316, w: 52, h: 16, name: 'Kırıcı alet (sopa)' },
      { s: 'ei-glasses', x: 540, y: 310, w: 30, h: 26, name: 'Düşen gözlük' },
      { s: 'tr-footprint', x: 770, y: 400, w: 26, h: 42 },
      { s: 'tr-footprint', x: 812, y: 418, w: 26, h: 42, rot: 15 },
      { s: 'tr-footprint', x: 854, y: 438, w: 26, h: 42, rot: 32 },
      dash(900, 470, 1090, 560, 'Kaçış (merdiven yönü)'),
      // Altyapı
      { s: 'out-cctv', x: 1200, y: 110, w: 52, h: 40, name: 'Otopark kamerası' },
      { s: 'ts-parking', x: 160, y: 110, w: 40, h: 40 },
      lbl('Otopark B1', 300, 125, 10),
      // Numaratörler
      marker('1', 'Mağdur araç (B-14)', 760, 320),
      marker('2', 'Cam kırıkları', 700, 370),
      marker('3', 'Kırıcı alet', 610, 370),
      marker('4', 'Düşen gözlük', 540, 370),
      marker('5', 'Şüpheli ayak izleri', 830, 480),
      marker('6', 'Otopark kamerası', 1252, 180, 30),
      // Ölçüler + açıklamalar
      arrow(240, 560, 900, 560, 'Park sırası ≈ 7 m'),
      callout('Konsoldan ses sistemi sökülmüş', 380, 400, 11),
      callout('Kapı kilidi zorlanmamış — cam kırılmış', 950, 640, 11),
      note('Kamera görüntüleri 21.00-23.00 arası incelendi.', 60, 640, 250, 9),
    ],
  },
  {
    id: 'oto-3',
    title: 'Sitede otoparkta motorsiklet hırsızlığı (zincir kilit kırılarak)',
    address: 'İzmir / Buca — Şirinyer sitesi kapalı otoparkı, slot M-07',
    story:
      'Site sakininin kilitli motosikleti gece otoparktan alındı; yerde kesilmiş zincir kilidi ve mağdura ait kask bulundu. Kamera görüntülerinde motosikletin iki kişi tarafından itilerek çıkarıldığı görüldü.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Motosiklet park yeri M-07 (boş)' },
      { no: '2', desc: 'Kesilmiş zincir kilidi (yerde)' },
      { no: '3', desc: 'Mağdura ait kask (yerde)' },
      { no: '4', desc: 'Şüpheli ayak izleri' },
      { no: '5', desc: 'Motosikletin itildiği yön' },
      { no: '6', desc: 'Site güvenlik kamerası' },
    ],
    objects: [
      // Otopark düzeni
      { s: 'ev-rect-hollow', x: 320, y: 200, w: 130, h: 280 },
      { s: 'ev-rect-hollow', x: 480, y: 200, w: 130, h: 280 },
      { s: 'ev-rect-hollow', x: 640, y: 200, w: 130, h: 280 },
      lbl('M-06', 385, 340, 10),
      lbl('M-07', 545, 340, 10),
      lbl('M-08', 705, 340, 10),
      { s: 'v-motor', x: 355, y: 320, w: 110, h: 44, name: 'Komşu motosiklet (M-06)' },
      // Boş slot + deliller
      lbl('Motosiklet (çalındı)', 545, 250, 10),
      { s: 'ei-keys', x: 520, y: 430, w: 30, h: 42, name: 'Kesilmiş zincir kilidi' },
      { s: 'cl-helmet', x: 600, y: 300, w: 44, h: 40, name: 'Mağdurun kaskı (yerde)' },
      // İzler + kaçış
      { s: 'tr-footprint', x: 700, y: 520, w: 26, h: 42 },
      { s: 'tr-footprint', x: 744, y: 536, w: 26, h: 42, rot: 18 },
      dash(800, 560, 1000, 620, 'Motosikletin itildiği yön'),
      // Altyapı
      { s: 'out-fence', x: 200, y: 60, w: 160, h: 50 },
      { s: 'out-fence', x: 380, y: 60, w: 160, h: 50 },
      lbl('Site duvarı', 380, 85, 9),
      { s: 'out-street-light', x: 880, y: 80, w: 40, h: 54 },
      { s: 'out-cctv', x: 1100, y: 120, w: 52, h: 40, name: 'Site kamerası' },
      // Numaratörler
      marker('1', 'Boş park yeri M-07', 545, 460),
      marker('2', 'Kesilmiş zincir kilidi', 520, 500),
      marker('3', 'Kask (yerde)', 600, 268),
      marker('4', 'Şüpheli ayak izleri', 730, 500),
      marker('5', 'İtiliş yönü', 1010, 600),
      marker('6', 'Site kamerası', 1160, 190, 30),
      // Ölçüler + açıklamalar
      arrow(320, 620, 770, 620, 'Park sırası ≈ 4,7 m'),
      callout('Zincir kesici aletle kesilmiş', 240, 460, 11),
      callout('Olay 02.00-03.30 arasında', 950, 160, 11),
      note('Kamera kaydında iki şahıs motosikleti iterek çıkardı.', 60, 660, 280, 9),
    ],
  },
  {
    id: 'oto-4',
    title: 'Takside bırakılan valizin bagajdan alınması',
    address: 'Antalya / Muratpaşa — Şirinyalı Mah. taksi durağı',
    story:
      'Taksi şoförü yolcusunu indirdikten sonra bagajda unutulan valizin yok olduğunu fark etti; durak kameralarında bir şahsın bagajı açıp valizi aldığı görüldü. Bagajda valize ait kilit parçası ve dökülen belgeler kaldı.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Taksi (bagaj kapağı açık)' },
      { no: '2', desc: 'Valiz kilidi parçası (yerde)' },
      { no: '3', desc: 'Valizden dökülen belgeler' },
      { no: '4', desc: 'Şüpheli ayak izleri' },
      { no: '5', desc: 'Şüphelinin kaçış yönü' },
      { no: '6', desc: 'Durak güvenlik kamerası' },
    ],
    objects: [
      roadH(20, 1346, 280, 150),
      { s: 'ts-stop', x: 120, y: 120, w: 40, h: 40 },
      lbl('Taksi durağı', 240, 140, 10),
      // Taksi + açık bagaj
      { s: 'v-taxi', x: 400, y: 226, w: 190, h: 84, name: 'Taksi (bagaj kapağı açık)' },
      { s: 'ev-rect-hollow', x: 610, y: 240, w: 70, h: 48, name: 'Açık bagaj bölmesi' },
      { s: 'ei-keys', x: 640, y: 320, w: 30, h: 42, name: 'Valiz kilidi parçası' },
      { s: 'ei-documents', x: 700, y: 316, w: 44, h: 38, name: 'Dökülen belgeler' },
      { s: 'ei-id-card', x: 760, y: 322, w: 34, h: 34, name: 'Kimlik (valizden dökülen)' },
      // Şüpheli izleri
      { s: 'tr-footprint', x: 850, y: 310, w: 26, h: 42 },
      { s: 'tr-footprint', x: 896, y: 300, w: 26, h: 42, rot: -15 },
      dash(960, 290, 1160, 200, 'Kaçış yönü'),
      // Kamera + ışık
      { s: 'out-cctv', x: 1080, y: 110, w: 52, h: 40, name: 'Durak kamerası' },
      { s: 'out-street-light', x: 950, y: 100, w: 40, h: 54 },
      // Numaratörler
      marker('1', 'Taksi (bagaj açık)', 470, 340),
      marker('2', 'Valiz kilidi parçası', 655, 400),
      marker('3', 'Dökülen belgeler', 722, 400),
      marker('4', 'Şüpheli ayak izleri', 870, 390),
      marker('5', 'Kaçış yönü', 1180, 175),
      marker('6', 'Durak kamerası', 1120, 180, 30),
      // Ölçüler + açıklamalar
      arrow(400, 400, 590, 400, '≈ 4,2 m'),
      callout('Valiz 23.40 sıralarında alınmış', 300, 442, 11),
      callout('Şoför bagajı kontrol etmeden kalktı', 900, 480, 11),
      note('Kamera kaydında şüpheli yürüyerek istikamet değiştirdi.', 40, 560, 280, 9),
    ],
  },
  {
    id: 'oto-5',
    title: 'Bahçe kapısı önündeki kamyonetten akü ve alet hırsızlığı',
    address: 'Bursa / Nilüfer — Akçalar Mah. müstakil ev bahçe girişi',
    story:
      'Ev sahibi sabah bahçe kapısının önüne park ettiği kamyonetin kaputunun açık olduğunu, akünün ve araç içindeki alet çantasının alındığını gördü. Çamurlu zeminde ayak izleri ve bahçe duvarına tırmanma izleri mevcut.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Kamyonet (kaput açık, akü sökülmüş)' },
      { no: '2', desc: 'Alet çantası yeri (çalındı)' },
      { no: '3', desc: 'Çamurlu zemindeki ayak izleri' },
      { no: '4', desc: 'Bahçe duvarındaki tırmanma izleri' },
      { no: '5', desc: 'Şüphelinin kaçış yönü' },
      { no: '6', desc: 'Sokak güvenlik kamerası' },
    ],
    objects: [
      // Bahçe sınırı + ev
      { s: 'out-fence', x: 240, y: 60, w: 180, h: 50 },
      { s: 'out-fence', x: 440, y: 60, w: 180, h: 50 },
      lbl('Bahçe duvarı', 430, 85, 9),
      ...room(700, 60, 400, 300),
      lbl('Ev (ön cephe)', 900, 90, 10),
      door(880, 360, 52, 0),
      // Kamyonet (kaput açık — sökülmüş akü)
      { s: 'v-pickup', x: 420, y: 150, w: 80, h: 200, name: 'Kamyonet (kaput açık)' },
      lbl('Akü sökülmüş', 470, 130, 9),
      { s: 'ev-rect-hollow', x: 300, y: 200, w: 90, h: 60, name: 'Alet çantası (çalındı)' },
      // İzler
      { s: 'tr-mud', x: 300, y: 420, w: 90, h: 55 },
      { s: 'tr-footprint', x: 420, y: 420, w: 26, h: 42 },
      { s: 'tr-footprint', x: 466, y: 436, w: 26, h: 42, rot: 20 },
      dash(540, 470, 740, 560, 'Kaçış yönü'),
      // Kamera
      { s: 'out-street-light', x: 120, y: 300, w: 40, h: 54 },
      { s: 'out-cctv', x: 620, y: 90, w: 52, h: 40, name: 'Sokak kamerası' },
      // Numaratörler
      marker('1', 'Kamyonet', 460, 390),
      marker('2', 'Alet çantası yeri', 345, 300),
      marker('3', 'Çamur ayak izleri', 350, 500),
      marker('4', 'Tırmanma izleri', 530, 130, 30),
      marker('5', 'Kaçış yönü', 760, 540),
      marker('6', 'Sokak kamerası', 656, 160, 30),
      // Ölçüler + açıklamalar
      arrow(300, 560, 520, 560, '≈ 2,3 m'),
      callout('Bahçe kapısı kilitli bulundu', 200, 200, 11),
      callout('Olay 23.00 - 06.30 arasında', 900, 440, 11),
      note('Çamur izleri lastik taban deseniyle eşleştirilecek.', 40, 640, 270, 9),
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Grup 6: İŞYERİNDEN HIRSIZLIK                                        */
/* ------------------------------------------------------------------ */
const isyeriHirsizligi: KrokiScenario[] = [
  {
    id: 'isy-1',
    title: 'Ofis dairesinden kasaya giriş (kapı kilidi zorlanarak)',
    address: 'İstanbul / Şişli — Mecidiyeköy Yolu Cd. No:12, 4. kat ofis',
    story:
      'Pazartesi sabah ofis çalışanı kapı kilidinin zorlandığını, iç kapının açık olduğunu ve kasada bulunan tahsilat paralarının alındığını fark etti. Kapıdan kasaya uzanan ayak izleri ve dağınık evraklar tespit edildi.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Giriş kapısı (kilit zorlanmış)' },
      { no: '2', desc: 'Kasa (boşaltılmış)' },
      { no: '3', desc: 'Şüpheli ayak izleri (kapıdan kasaya)' },
      { no: '4', desc: 'Dağıtılmış evraklar' },
      { no: '5', desc: 'Gardırop (çekmeceler boşaltılmış)' },
      { no: '6', desc: 'Ofis güvenlik kamerası' },
    ],
    objects: [
      ...room(200, 80, 820, 480),
      innerV(700, 80, 480),
      // Giriş kapısı (alt duvar) — kanat duvar çizgisinde
      door(300, 560, 56, 0),
      lbl('Giriş', 330, 520, 10),
      win(400, 76, 80, 0),
      // Masa grubu (sol oda)
      { s: 'ev-rect-hollow', x: 260, y: 160, w: 120, h: 60 },
      { s: 'ev-rect-hollow', x: 260, y: 300, w: 120, h: 60 },
      { s: 'ev-rect-hollow', x: 480, y: 220, w: 120, h: 60 },
      lbl('Masa 1', 320, 190, 9),
      lbl('Masa 2', 320, 330, 9),
      lbl('Masa 3', 540, 250, 9),
      // Dağıtılmış evraklar
      { s: 'ei-documents', x: 420, y: 380, w: 46, h: 40, name: 'Dağıtılan evrak 1' },
      { s: 'ei-documents', x: 470, y: 420, w: 46, h: 40, rot: 25, name: 'Dağıtılan evrak 2' },
      // İç oda: kasa + gardırop
      { s: 'ev-rect-hollow', x: 820, y: 160, w: 100, h: 65, name: 'Kasa (boşaltıldı)' },
      lbl('Kasa', 870, 145, 10),
      { s: 'f-13', x: 740, y: 300, w: 130, h: 55, name: 'Gardırop' },
      { s: 'ei-keys', x: 880, y: 280, w: 30, h: 42, name: 'Kasa anahtarı (yerde)' },
      // İzler: kapıdan iç odaya
      { s: 'tr-footprint', x: 350, y: 470, w: 26, h: 42 },
      { s: 'tr-footprint', x: 396, y: 440, w: 26, h: 42, rot: -25 },
      { s: 'tr-footprint', x: 640, y: 380, w: 26, h: 42, rot: -55 },
      { s: 'tr-footprint', x: 690, y: 330, w: 26, h: 42, rot: -70 },
      // Kamera
      { s: 'out-cctv', x: 230, y: 110, w: 52, h: 40, name: 'Ofis kamerası' },
      // Numaratörler
      marker('1', 'Giriş kapısı', 390, 470),
      marker('2', 'Kasa', 930, 220),
      marker('3', 'Ayak izleri hattı', 520, 415),
      marker('4', 'Dağıtılan evraklar', 445, 470),
      marker('5', 'Gardırop', 805, 330),
      marker('6', 'Ofis kamerası', 300, 155, 30),
      // Ölçüler + açıklamalar
      arrow(350, 520, 850, 520, 'Kapı - kasa ≈ 5,3 m'),
      callout('Kilit tezgahla zorlanmış, kanat sağlam', 480, 620, 11),
      callout('Kamera kaydında şahıs 02.10 da girdi', 1000, 620, 11),
      note('Kasa hasar kaydı tutanağa eklendi.', 60, 650, 230, 9),
    ],
  },
  {
    id: 'isy-2',
    title: 'Marketten gece ön cam kırılarak giriş — kasa boşaltıldı',
    address: 'Ankara / Keçiören — Etlik Cd. No:88 market şubesi',
    story:
      'Gece güvenlik alarmı üzerine gelen ekip marketin ön camının kırıldığını, kasanın boşaltıldığını ve raftan sigara ürünlerinin alındığını tespit etti. Yerde cam kırıkları, kırıcı alet ve şüpheli ayak izleri bulundu.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Kırılan ön cam (giriş yanı)' },
      { no: '2', desc: 'Yazar kasa (boşaltıldı)' },
      { no: '3', desc: 'Kırıcı alet (yerde)' },
      { no: '4', desc: 'Raf (sigara ürünleri boşaltılmış)' },
      { no: '5', desc: 'Şüpheli ayak izleri' },
      { no: '6', desc: 'Market güvenlik kamerası' },
    ],
    objects: [
      ...room(160, 100, 940, 460),
      // Ön kapı + kırılan cam
      door(360, 560, 56, 0),
      { s: 'ex-4', x: 430, y: 520, w: 70, h: 46, name: 'Kırılan ön cam (giriş yanı)' },
      lbl('Giriş', 388, 520, 9),
      // Raflar
      { s: 'ev-rect-hollow', x: 240, y: 200, w: 90, h: 280 },
      { s: 'ev-rect-hollow', x: 380, y: 200, w: 90, h: 280 },
      { s: 'ev-rect-hollow', x: 520, y: 200, w: 90, h: 280 },
      lbl('Raf 1', 285, 470, 9),
      lbl('Raf 2 (sigara)', 425, 470, 9),
      lbl('Raf 3', 565, 470, 9),
      // Kasa
      { s: 'ev-rect-hollow', x: 900, y: 160, w: 110, h: 65, name: 'Yazar kasa (boşaltıldı)' },
      lbl('Yazar Kasa', 955, 145, 10),
      { s: 'ei-documents', x: 880, y: 260, w: 46, h: 40, name: 'Kasa fişleri (dağılmış)' },
      // Deliller
      { s: 'w-5', x: 640, y: 470, w: 52, h: 16, name: 'Kırıcı alet (bilyalı çekiç)' },
      { s: 'tr-footprint', x: 560, y: 500, w: 26, h: 42 },
      { s: 'tr-footprint', x: 620, y: 480, w: 26, h: 42, rot: -30 },
      dash(700, 540, 900, 620, 'Kaçış yönü'),
      // Kamera
      { s: 'out-cctv', x: 1000, y: 120, w: 52, h: 40, name: 'Market kamerası' },
      // Numaratörler
      marker('1', 'Kırılan ön cam', 465, 600),
      marker('2', 'Yazar kasa', 955, 260),
      marker('3', 'Kırıcı alet', 640, 520),
      marker('4', 'Raf 2 (sigara)', 425, 520),
      marker('5', 'Şüpheli ayak izleri', 560, 560),
      marker('6', 'Market kamerası', 1070, 190, 30),
      // Ölçüler + açıklamalar
      arrow(160, 620, 1100, 620, 'Cephe ≈ 10 m'),
      callout('Cam taşla kırıldı; alarm 03.12 de çaldı', 700, 170, 11),
      callout('Kasada 4.850 TL bulunduğu bildirildi', 500, 660, 11),
      note('Raf 2 deki ürünlerin ENVANTER farkı tutanağa geçirildi.', 60, 660, 300, 9),
    ],
  },
  {
    id: 'isy-3',
    title: 'Oto elektrik servisinde arka pencereden girilerek parça hırsızlığı',
    address: 'Bursa / Osmangazi — Sanayi Mah. 4. Sk. oto elektrik servisi',
    story:
      'Servis sahibi sabah arka pencerenin kırıldığını, servisteki aracın katalitik konvertörü ile raf araç parçalarının alındığını fark etti. Pencereden içeri giriş izleri ve parça raflarında dağınıklık mevcut.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Servisteki araç (katalitik konvertör sökülmüş)' },
      { no: '2', desc: 'Kırılan arka pencere' },
      { no: '3', desc: 'Parça rafı (dağınık, eksikler var)' },
      { no: '4', desc: 'Şüpheli ayak izleri (pencereden rafa)' },
      { no: '5', desc: 'Alet dolabı (açık)' },
      { no: '6', desc: 'Servis güvenlik kamerası' },
    ],
    objects: [
      ...room(120, 80, 1000, 480),
      // Arka pencere (sağ duvar, kırılan)
      { s: 'arch-win', x: 1116, y: 200, w: 80, h: 12, rot: 90 },
      { s: 'ex-4', x: 1040, y: 240, w: 64, h: 44, name: 'Pencere camı kırıkları (içeride)' },
      // Platform + araç
      { s: 'ev-rect-hollow', x: 320, y: 180, w: 240, h: 140, name: 'Yükseltici platform' },
      lbl('Yükseltici', 440, 165, 9),
      { s: 'v-sedan', x: 340, y: 210, w: 200, h: 88, name: 'Servisteki araç (konvertör sökülmüş)' },
      lbl('Katalitik konvertör sökülmüş', 440, 330, 9),
      // Parça rafları
      { s: 'ev-rect-hollow', x: 700, y: 140, w: 90, h: 300 },
      { s: 'ev-rect-hollow', x: 820, y: 140, w: 90, h: 300 },
      lbl('Parça Rafı 1', 745, 470, 9),
      lbl('Parça Rafı 2', 865, 470, 9),
      { s: 'ei-documents', x: 760, y: 330, w: 46, h: 40, name: 'Yerdeki parça kutusu' },
      // Alet dolabı
      { s: 'ev-rect-hollow', x: 200, y: 420, w: 110, h: 65, name: 'Alet dolabı (açık)' },
      lbl('Alet Dolabı', 255, 405, 9),
      // İzler
      { s: 'tr-footprint', x: 1020, y: 320, w: 26, h: 42 },
      { s: 'tr-footprint', x: 970, y: 360, w: 26, h: 42, rot: 40 },
      { s: 'tr-footprint', x: 900, y: 390, w: 26, h: 42, rot: 60 },
      // Kamera
      { s: 'out-cctv', x: 150, y: 110, w: 52, h: 40, name: 'Servis kamerası' },
      // Numaratörler
      marker('1', 'Servisteki araç', 440, 380),
      marker('2', 'Kırılan pencere', 1060, 280),
      marker('3', 'Parça rafı', 745, 250),
      marker('4', 'Ayak izleri hattı', 960, 410),
      marker('5', 'Alet dolabı', 255, 520),
      marker('6', 'Servis kamerası', 220, 155, 30),
      // Ölçüler + açıklamalar
      arrow(320, 560, 560, 560, 'Platform ≈ 2,5 m'),
      callout('Pencere kelepçesi içeriden açılmış', 900, 590, 11),
      callout('Konvertör sökümünde alet izi var', 200, 600, 11),
      note('Raf envanteri ile eksik parça listesi tutanağa eklendi.', 60, 650, 300, 9),
    ],
  },
  {
    id: 'isy-4',
    title: 'Kuaför salonundan kepenk zorlanarak giriş — kasa hırsızlığı',
    address: 'İzmir / Karşıyaka — Bostanlı Mah. Cemal Gürsel Cd. No:51 kuaför',
    story:
      'Salon sahibi sabah cephe kepenğinin zorlanarak açıldığını, resepsiyondaki kasadaki günübirlik tahsilatın alındığını fark etti. Kepenk kilit kırıkları, devrik sandalye ve ayak izleri tespit edildi.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Kepenk kilidi (zorlanmış)' },
      { no: '2', desc: 'Resepsiyon kasası (boşaltıldı)' },
      { no: '3', desc: 'Devrik sandalye' },
      { no: '4', desc: 'Şüpheli ayak izleri' },
      { no: '5', desc: 'Yerdeki tarak/makas dağınıklığı' },
      { no: '6', desc: 'Salon güvenlik kamerası' },
    ],
    objects: [
      ...room(200, 100, 800, 440),
      // Kepenk + giriş kapısı (alt duvar)
      door(380, 540, 56, 0),
      { s: 'arch-w1i', x: 340, y: 536, w: 170, h: 8, name: 'Kepenk (zorlanarak kaldırılmış)' },
      lbl('Kepenk', 425, 520, 9),
      // Çalışma istasyonları
      { s: 'ev-rect-hollow', x: 260, y: 180, w: 110, h: 60 },
      { s: 'ev-rect-hollow', x: 260, y: 320, w: 110, h: 60 },
      { s: 'ev-rect-hollow', x: 700, y: 180, w: 110, h: 60 },
      lbl('Çalışma Ünitesi 1', 315, 165, 9),
      lbl('Çalışma Ünitesi 2', 315, 405, 9),
      lbl('Yıkama Ünitesi', 755, 165, 9),
      // Resepsiyon kasası
      { s: 'ev-rect-hollow', x: 520, y: 380, w: 100, h: 60, name: 'Resepsiyon kasası (boşaltıldı)' },
      lbl('Kasa', 570, 365, 10),
      // Dağınıklık + deliller
      { s: 'f-5', x: 640, y: 300, w: 80, h: 75, rot: 35, name: 'Devrik sandalye' },
      { s: 'ei-documents', x: 460, y: 300, w: 46, h: 40, name: 'Randevu defteri (yerde)' },
      { s: 'ei-keys', x: 300, y: 440, w: 30, h: 42, name: 'Kepenk kilidi kırıkları' },
      { s: 'tr-footprint', x: 420, y: 460, w: 26, h: 42 },
      { s: 'tr-footprint', x: 470, y: 440, w: 26, h: 42, rot: -20 },
      // Kamera
      { s: 'out-cctv', x: 230, y: 130, w: 52, h: 40, name: 'Salon kamerası' },
      // Numaratörler
      marker('1', 'Kepenk kilidi', 320, 480),
      marker('2', 'Resepsiyon kasası', 570, 480),
      marker('3', 'Devrik sandalye', 680, 280),
      marker('4', 'Şüpheli ayak izleri', 445, 500),
      marker('5', 'Dağılan malzeme', 460, 270),
      marker('6', 'Salon kamerası', 300, 175, 30),
      // Ölçüler + açıklamalar
      arrow(200, 620, 1000, 620, 'Cephe ≈ 8,4 m'),
      callout('Kilit sökme aletiyle zorlanmış', 700, 658, 11),
      callout('Kasada ≈ 3.200 TL bulunuyordu', 470, 658, 11),
      note('Kamera kaydı 01.40-02.05 arası inceleniyor.', 60, 655, 270, 9),
    ],
  },
  {
    id: 'isy-5',
    title: 'Şantiye deposundan kablo makarası hırsızlığı (forklift izi)',
    address: 'Konya / Selçuklu — Feritpaşa Mah. şantiye deposu',
    story:
      'Şantiye amiri depo konteynerinin kilidinin kırıldığını, 3 kablo makarasının ve el aletlerinin alındığını bildirdi. Zeminde forklifte ait lastik izi ve yaya ayak izleri; tel örgüde kesik mevcut.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Konteiner (kilit kırılmış, boşaltılmış)' },
      { no: '2', desc: 'Boş makara yeri (3 adet eksik)' },
      { no: '3', desc: 'Forklift lastik izi' },
      { no: '4', desc: 'Tel örgüdeki kesik (geçiş noktası)' },
      { no: '5', desc: 'Şüpheli ayak izleri' },
      { no: '6', desc: 'Şantiye projeksiyon kamerası' },
    ],
    objects: [
      // Tel örgü çevre
      { s: 'out-fence', x: 160, y: 60, w: 180, h: 50 },
      { s: 'out-fence', x: 360, y: 60, w: 180, h: 50 },
      { s: 'out-fence', x: 560, y: 60, w: 180, h: 50 },
      lbl('Tel örgü (kesik: 620-680 arası)', 620, 85, 9),
      // Konteiner depo
      { s: 'ev-rect-hollow', x: 300, y: 180, w: 240, h: 120, name: 'Konteiner depo (kilit kırık)' },
      lbl('Konteiner', 420, 165, 10),
      // Boş makara yeri
      { s: 'ev-rect-hollow', x: 340, y: 210, w: 70, h: 60 },
      { s: 'ev-rect-hollow', x: 430, y: 210, w: 70, h: 60 },
      lbl('Boş makara yeri', 420, 280, 9),
      // Forklift + lastik izi
      { s: 'v-forklift', x: 640, y: 220, w: 130, h: 95, name: 'Forklift (şantiyeden)' },
      { s: 'tr-skid-straight', x: 480, y: 360, w: 200, h: 36, name: 'Forklift lastik izi' },
      // Tel örgü kesik + ayak izleri
      { s: 'out-fence', x: 600, y: 620, w: 160, h: 50 },
      lbl('Kesik bölge', 680, 600, 9),
      { s: 'tr-footprint', x: 560, y: 520, w: 26, h: 42 },
      { s: 'tr-footprint', x: 606, y: 540, w: 26, h: 42, rot: 25 },
      dash(680, 580, 880, 620, 'Kaçış yönü (kesikten)'),
      // Kamera + ışık
      { s: 'out-cctv', x: 1060, y: 120, w: 52, h: 40, name: 'Şantiye kamerası' },
      { s: 'out-street-light', x: 900, y: 400, w: 40, h: 54 },
      // Numaratörler
      marker('1', 'Konteiner', 420, 330),
      marker('2', 'Boş makara yeri', 465, 190),
      marker('3', 'Forklift lastik izi', 580, 410),
      marker('4', 'Tel örgü kesik', 680, 660),
      marker('5', 'Şüpheli ayak izleri', 590, 480),
      marker('6', 'Şantiye kamerası', 1130, 190, 30),
      // Ölçüler + açıklamalar
      arrow(300, 480, 540, 480, 'Konteiner ≈ 2,5 m'),
      callout('3 makara (yaklaşık 1.200 m kablo)', 820, 300, 11),
      callout('Forklift anahtarı konteynerdeydi', 820, 360, 11),
      note('Kesik tel örgü fotoğraflanarak numunesi alındı.', 60, 660, 280, 9),
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Grup 7: BIÇAKLA YARALAMA                                            */
/* ------------------------------------------------------------------ */
const bicaklaYaralama: KrokiScenario[] = [
  {
    id: 'bic-1',
    title: 'Lokantada çıkan kavgada bıçakla yaralama',
    address: 'Ankara / Yenimahalle — Demetevler Mah. lokanta',
    story:
      'Müşteriler arasında çıkan tartışma bıçaklı kavgaya dönüştü; mağdur yerde yaralı bulundu, şüpheli masa ve sandalyeleri devirerek lokantadan kaçtı. Yerde bıçak, kan birikintisi ve şüpheliye ait kanlı ayak izleri mevcut.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur (yerde, karın bölgesinden yaralı)' },
      { no: '2', desc: 'Olayda kullanılan bıçak' },
      { no: '3', desc: 'Kan birikintisi' },
      { no: '4', desc: 'Devrik sandalye (mücadele)' },
      { no: '5', desc: 'Şüphelinin kanlı ayak izleri' },
      { no: '6', desc: 'Şüphelinin kaçış yönü' },
    ],
    objects: [
      ...room(140, 80, 940, 480),
      // Masalar + tezgah
      { s: 'ev-rect-hollow', x: 240, y: 160, w: 110, h: 70 },
      { s: 'ev-rect-hollow', x: 240, y: 320, w: 110, h: 70 },
      { s: 'ev-rect-hollow', x: 420, y: 240, w: 110, h: 70 },
      lbl('Masa 1', 295, 145, 9),
      lbl('Masa 2', 295, 415, 9),
      lbl('Masa 3', 475, 225, 9),
      { s: 'f-3', x: 160, y: 100, w: 180, h: 55, name: 'Kasa Tezgahı' },
      // Devrik sandalye (mücadele)
      { s: 'f-5', x: 560, y: 200, w: 80, h: 75, rot: 30, name: 'Devrik sandalye' },
      // Mağdur + yara + kan
      { s: 'p-9', x: 700, y: 300, w: 115, h: 52, name: 'Mağdur (yerde)' },
      { s: 'in-stab', x: 716, y: 318, w: 44, h: 16, name: 'Kesici alet yarası (karın)' },
      { s: 'in-stab', x: 742, y: 336, w: 40, h: 14, rot: 20, name: 'Kesici alet yarası (kol)' },
      { s: 'in-blood-pool', x: 680, y: 360, w: 110, h: 70 },
      // Bıçak + ayakkabı
      { s: 'w-2', x: 830, y: 282, w: 46, h: 20, rot: -25, name: 'Olayda kullanılan bıçak' },
      { s: 'cl-shoe', x: 648, y: 408, w: 26, h: 26 },
      // Kaçış izleri
      { s: 'tr-bloody-footprint', x: 520, y: 460, w: 26, h: 42 },
      { s: 'tr-bloody-footprint', x: 470, y: 486, w: 26, h: 42, rot: -18 },
      dash(420, 520, 230, 610, 'Şüphelinin kaçış yönü'),
      // Kapı (kanat duvar çizgisinde)
      door(200, 560, 56, 0),
      // Numaratörler
      marker('1', 'Mağdur', 700, 260),
      marker('2', 'Bıçak', 853, 320),
      marker('3', 'Kan birikintisi', 735, 450),
      marker('4', 'Devrik sandalye', 600, 175),
      marker('5', 'Kanlı ayak izleri', 495, 540),
      marker('6', 'Kaçış yönü', 215, 590),
      // Ölçüler + açıklamalar
      arrow(700, 480, 830, 480, '≈ 1,4 m'),
      callout('Mağdur karın ve kol bölgesinden yaralandı', 460, 652, 11),
      callout('Şüpheli tanıdı; görüntü çalışması sürüyor', 800, 620, 11),
      note('Bıçak 12 cm bıçak boyu, mutfak tipi.', 60, 650, 230, 9),
    ],
  },
  {
    id: 'bic-2',
    title: 'Sokak ortasında bıçaklı saldırı (yol kenarı)',
    address: 'İstanbul / Fatih — Aksaray Yolu kenarı otobüs durağı yanı',
    story:
      'Gece saat 01.20 sıralarında yol kenarında iki şahıs arasındaki tartışma bıçaklı saldırıyla sonuçlandı. Mağdur yol kenarında yüzüstü bulundu; saldırgan kaçarken kepi ve bıçağı düştü. Kanlı sürüklenme izi mevcut.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur (yüzüstü, sırt bölgesinden yaralı)' },
      { no: '2', desc: 'Kanlı sürüklenme izi' },
      { no: '3', desc: 'Saldırıda kullanılan bıçak (yerde)' },
      { no: '4', desc: 'Şüpheliden düşen kep' },
      { no: '5', desc: 'Şüpheli ayak izleri' },
      { no: '6', desc: 'Şüphelinin kaçış yönü' },
    ],
    objects: [
      roadH(20, 1346, 240, 140),
      { s: 'out-street-light', x: 200, y: 100, w: 40, h: 54 },
      { s: 'ts-pedestrian', x: 350, y: 110, w: 40, h: 40 },
      // Mağdur + yara + kan
      { s: 'p-4', x: 620, y: 360, w: 36, h: 80, name: 'Mağdur (yüzüstü)' },
      { s: 'in-stab', x: 628, y: 390, w: 44, h: 16, name: 'Kesici alet yarası (sırt)' },
      { s: 'in-blood-smear', x: 540, y: 420, w: 95, h: 40, name: 'Kanlı sürüklenme izi' },
      // Bıçak + kep
      { s: 'w-2', x: 720, y: 408, w: 46, h: 20, rot: 30, name: 'Bıçak (yerde)' },
      { s: 'cl-cap', x: 775, y: 385, w: 30, h: 26, name: 'Şüpheliden düşen kep' },
      // İzler + kaçış
      { s: 'tr-footprint', x: 850, y: 430, w: 26, h: 42 },
      { s: 'tr-footprint', x: 900, y: 446, w: 26, h: 42, rot: 25 },
      dash(960, 470, 1160, 560, 'Kaçış yönü'),
      // Kamera
      { s: 'out-cctv', x: 1100, y: 100, w: 52, h: 40, name: 'Sokak kamerası' },
      // Numaratörler
      marker('1', 'Mağdur', 638, 330),
      marker('2', 'Sürükleme izi', 585, 490),
      marker('3', 'Bıçak', 745, 450),
      marker('4', 'Kep', 775, 355),
      marker('5', 'Şüpheli ayak izleri', 875, 500),
      marker('6', 'Kaçış yönü', 1180, 545),
      // Ölçüler + açıklamalar
      arrow(560, 540, 700, 540, '≈ 1,5 m'),
      callout('Sırt bölgesine tek bıçak darbesi', 300, 400, 11),
      callout('Olay 01.20 de kamera kaydında', 850, 200, 11),
      note('Kep ve bıçak delil olarak alındı.', 40, 640, 230, 9),
    ],
  },
  {
    id: 'bic-3',
    title: 'Mutfakta aile içi bıçaklı yaralama',
    address: 'Kayseri / Melikgazi — Hunat Mah. apartman daire içi',
    story:
      'Aile bireyleri arasındaki tartışma mutfakta bıçaklı yaralanmayla sonuçlandı; mağdur mutfak zemininde yarı kalkmış durumda bulundu. Tezgah üstünde olayda kullanılan bıçak, zeminde kan sürüntüsü tespit edildi.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur (yaralı, yarı kalkmış)' },
      { no: '2', desc: 'Kesici alet yarası (ön kol)' },
      { no: '3', desc: 'Kan sürüntüsü (zemin)' },
      { no: '4', desc: 'Olayda kullanılan bıçak (tezgahta)' },
      { no: '5', desc: 'Devrik tabure' },
      { no: '6', desc: 'Mağdurun ayakkabısı' },
    ],
    objects: [
      ...room(160, 80, 760, 460),
      // Mutfak dolapları
      { s: 'f-4', x: 180, y: 100, w: 230, h: 160, name: 'L Tezgah' },
      { s: 'f-3', x: 620, y: 100, w: 180, h: 55, name: 'Mutfak Tezgahı' },
      // Masa + tabure
      { s: 'ev-rect-hollow', x: 420, y: 240, w: 130, h: 85, name: 'Yemek Masası' },
      lbl('Masa', 485, 225, 9),
      { s: 'f-5', x: 590, y: 260, w: 80, h: 75, rot: 35, name: 'Devrik tabure' },
      // Bıçak (tezgahta bırakılmış)
      { s: 'w-2', x: 690, y: 118, w: 46, h: 20, name: 'Olayda kullanılan bıçak' },
      // Mağdur + yara + kan
      { s: 'kk-injured', x: 350, y: 400, w: 105, h: 70, name: 'Mağdur (yaralı, yarı kalkmış)' },
      { s: 'in-stab', x: 380, y: 428, w: 44, h: 16, name: 'Kesici alet yarası (ön kol)' },
      { s: 'in-blood-smear', x: 450, y: 470, w: 90, h: 36, name: 'Kan sürüntüsü' },
      // Ayakkabı
      { s: 'cl-shoe', x: 300, y: 490, w: 26, h: 26 },
      // Kapı (kanat duvar çizgisinde)
      door(700, 540, 54, 0),
      // Numaratörler
      marker('1', 'Mağdur', 330, 380),
      marker('2', 'Kol yarası', 402, 405),
      marker('3', 'Kan sürüntüsü', 495, 530),
      marker('4', 'Bıçak (tezgahta)', 713, 90),
      marker('5', 'Devrik tabure', 630, 245),
      marker('6', 'Ayakkabı', 300, 530),
      // Ölçüler + açıklamalar
      arrow(180, 620, 560, 620, 'Mutfak genişliği ≈ 4 m'),
      callout('Tartışma tezgah başında başladı', 260, 300, 11),
      callout('Şüpheli olay sonrası daireden ayrıldı', 700, 300, 11),
      note('Mağdur 112 ekiyle hastaneye kaldırıldı.', 60, 650, 250, 9),
    ],
  },
  {
    id: 'bic-4',
    title: 'Park içinde gençler arasında bıçaklı kavga',
    address: 'İzmir / Bornova — Üniversite Mah. çocuk parkı yanı',
    story:
      'Parkta buluşan iki grup arasında çıkan kavga bıçaklı yaralanmayla sonuçlandı; mağdur bank yanında yarı kalkmış bulundu, sırt çantası yırtıldı. Çalılar arasında bıçak ve ayak izleri tespit edildi.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur (yaralı, bank yanı)' },
      { no: '2', desc: 'Kesici alet yarası (bacak)' },
      { no: '3', desc: 'Yırtık sırt çantası' },
      { no: '4', desc: 'Bıçak (çalı arasında)' },
      { no: '5', desc: 'Şüpheli ayak izleri' },
      { no: '6', desc: 'Şüphelinin kaçış yönü' },
    ],
    objects: [
      // Park düzeni
      { s: 'out-fence', x: 200, y: 60, w: 180, h: 50 },
      { s: 'out-fence', x: 400, y: 60, w: 180, h: 50 },
      lbl('Park çevre duvarı', 390, 85, 9),
      { s: 'out-tree-1', x: 240, y: 160, w: 90, h: 90, name: 'Ağaç 1' },
      { s: 'out-tree-1', x: 880, y: 160, w: 90, h: 90, name: 'Ağaç 2' },
      { s: 'out-bench', x: 400, y: 300, w: 90, h: 38, name: 'Bank' },
      // Mağdur + yara + kan
      { s: 'kk-injured', x: 620, y: 320, w: 105, h: 70, name: 'Mağdur (yaralı)' },
      { s: 'in-stab', x: 640, y: 348, w: 44, h: 16, name: 'Kesici alet yarası (bacak)' },
      { s: 'in-blood-pool', x: 600, y: 400, w: 85, h: 50 },
      // Çanta + bıçak
      { s: 'cl-backpack', x: 520, y: 340, w: 50, h: 44, name: 'Yırtık sırt çantası' },
      { s: 'w-2', x: 730, y: 380, w: 46, h: 20, rot: -15, name: 'Bıçak (çalı arasında)' },
      // İzler + kaçış
      { s: 'tr-footprint', x: 800, y: 440, w: 26, h: 42 },
      { s: 'tr-footprint', x: 846, y: 458, w: 26, h: 42, rot: 20 },
      dash(900, 490, 1100, 560, 'Kaçış yönü'),
      { s: 'out-street-light', x: 1000, y: 200, w: 40, h: 54 },
      // Numaratörler
      marker('1', 'Mağdur', 600, 290),
      marker('2', 'Bacak yarası', 660, 310),
      marker('3', 'Yırtık çanta', 520, 300),
      marker('4', 'Bıçak (çalıda)', 760, 420),
      marker('5', 'Şüpheli ayak izleri', 820, 500),
      marker('6', 'Kaçış yönü', 1110, 545),
      // Ölçüler + açıklamalar
      arrow(400, 380, 500, 380, '≈ 1 m'),
      callout('Kavga bank çevresinde başladı', 300, 420, 11),
      callout('Olay 18.40 sıralarında', 950, 300, 11),
      note('Çantanın içinde ders kitapları hasarlı.', 40, 640, 240, 9),
    ],
  },
  {
    id: 'bic-5',
    title: 'Otoparkta park yeri tartışması sonucu bıçakla yaralama',
    address: 'Adana / Seyhan — Kurtuluş Mah. sokak otoparkı',
    story:
      'Park yeri paylaşımı nedeniyle çıkan tartışmada araç sahibi bıçakla yaralandı; saldırgan aracından inerek kaçtı. Yerde bıçak, kan birikintisi ve ayak izleri bulundu; şüpheli aracı kameraya takıldı.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Saldırganın aracı (A-01)' },
      { no: '2', desc: 'Mağdurun aracı (A-02)' },
      { no: '3', desc: 'Mağdur (yerde, bacak bölgesinden yaralı)' },
      { no: '4', desc: 'Bıçak (yerde)' },
      { no: '5', desc: 'Kan birikintisi' },
      { no: '6', desc: 'Şüphelinin kaçış yönü' },
    ],
    objects: [
      // Park slotları
      { s: 'ev-rect-hollow', x: 240, y: 160, w: 200, h: 100 },
      { s: 'ev-rect-hollow', x: 470, y: 160, w: 200, h: 100 },
      lbl('A-01', 340, 210, 10),
      lbl('A-02', 570, 210, 10),
      { s: 'v-sedan', x: 255, y: 172, w: 170, h: 74, name: 'Saldırganın aracı (A-01)' },
      { s: 'v-panelvan', x: 485, y: 170, w: 175, h: 76, name: 'Mağdurun aracı (A-02)' },
      { s: 'ts-parking', x: 140, y: 110, w: 40, h: 40 },
      // Mağdur + yara + kan
      { s: 'p-3', x: 700, y: 330, w: 38, h: 84, name: 'Mağdur (yerde)' },
      { s: 'in-stab', x: 706, y: 372, w: 44, h: 16, name: 'Kesici alet yarası (bacak)' },
      { s: 'in-blood-pool', x: 760, y: 380, w: 90, h: 55 },
      // Bıçak + ayakkabı
      { s: 'w-2', x: 640, y: 372, w: 46, h: 20, rot: 20, name: 'Bıçak (yerde)' },
      { s: 'cl-shoe', x: 662, y: 438, w: 26, h: 26 },
      // Kaçış
      dash(820, 470, 1020, 550, 'Saldırganın kaçış yönü'),
      { s: 'tr-footprint', x: 770, y: 480, w: 26, h: 42 },
      { s: 'tr-footprint', x: 816, y: 496, w: 26, h: 42, rot: 22 },
      { s: 'out-street-light', x: 120, y: 300, w: 40, h: 54 },
      { s: 'out-cctv', x: 1080, y: 120, w: 52, h: 40, name: 'Sokak kamerası' },
      // Numaratörler
      marker('1', 'Saldırganın aracı', 340, 320),
      marker('2', 'Mağdurun aracı', 570, 320),
      marker('3', 'Mağdur', 700, 300),
      marker('4', 'Bıçak', 640, 420),
      marker('5', 'Kan birikintisi', 805, 460),
      marker('6', 'Kaçış yönü', 1040, 530),
      // Ölçüler + açıklamalar
      arrow(240, 560, 670, 560, 'Park sırası ≈ 4,5 m'),
      callout('Tartışma kapı önünde başladı', 300, 400, 11),
      callout('Şüpheli araçla uzaklaştı (34 ABC 123)', 900, 250, 11),
      note('Plaka bilgisi kamera kaydından alındı.', 40, 640, 250, 9),
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Grup 8: SILAHLA YARALAMA                                            */
/* ------------------------------------------------------------------ */
const silahlaYaralama: KrokiScenario[] = [
  {
    id: 'sil-1',
    title: 'Sokakta silahlı saldırı sonucu ölüm',
    address: 'Şanlıurfa / Haliliye — Bahçelievler Mah. sokak',
    story:
      'Gece yürüyen mağdura araçtan inen şahıs tarafından ateş edildi; mağdur yerde ölü bulundu. Yerde 2 boş kovan, deforme mermi ve mağdura ait tabanca tespit edildi; şüpheli araçla kaçtı.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur (yüzüstü, yaşamını yitirmiş)' },
      { no: '2', desc: 'Giriş yarası (sırt bölgesi)' },
      { no: '3', desc: 'Boş kovanlar (2 adet, saldırgana ait)' },
      { no: '4', desc: 'Mağdurun tabancası (yerde)' },
      { no: '5', desc: 'Kan birikintisi' },
      { no: '6', desc: 'Atış yönü / şüphelinin kaçışı' },
    ],
    objects: [
      roadH(20, 1346, 260, 150),
      { s: 'out-street-light', x: 150, y: 100, w: 40, h: 54 },
      { s: 'out-cctv', x: 1150, y: 100, w: 52, h: 40, name: 'Sokak kamerası' },
      // Mağdur + yara + kan
      { s: 'p-4', x: 560, y: 360, w: 36, h: 80, name: 'Mağdur (yüzüstü)' },
      { s: 'in-bullet-in', x: 566, y: 396, w: 28, h: 28, name: 'Giriş yarası (sırt)' },
      { s: 'in-blood-pool', x: 500, y: 440, w: 110, h: 65 },
      // Silah + kovanlar + mermi
      { s: 'w-1', x: 660, y: 396, w: 44, h: 30, rot: 15, name: 'Mağdurun tabancası (yerde)' },
      { s: 'tr-casing-pistol', x: 470, y: 356, w: 26, h: 26 },
      { s: 'tr-casing-pistol', x: 506, y: 346, w: 26, h: 26, rot: 20 },
      { s: 'tr-bullet-deformed', x: 720, y: 350, w: 30, h: 30, name: 'Deforme mermi (zeminde)' },
      // Kaçış yönü
      dash(790, 330, 1000, 230, 'Atış yönü / kaçış'),
      { s: 'p-13', x: 320, y: 400, w: 26, h: 34, name: 'İlk müdahale ekibi' },
      { s: 'v-police', x: 180, y: 220, w: 130, h: 56, name: 'Polis aracı' },
      // Numaratörler
      marker('1', 'Mağdur', 578, 330),
      marker('2', 'Giriş yarası', 620, 400),
      marker('3', 'Boş kovanlar', 488, 320),
      marker('4', 'Tabanca', 705, 450),
      marker('5', 'Kan birikintisi', 555, 530),
      marker('6', 'Atış yönü', 1010, 200),
      // Ölçüler + açıklamalar
      arrow(470, 520, 670, 520, '≈ 2,1 m'),
      callout('İki el ateş edildi (2 kovan)', 300, 200, 11),
      callout('Şüpheli koyu renk araçla uzaklaştı', 900, 160, 11),
      note('Olay 22.45 te; kamera kaydı inceleniyor.', 40, 620, 260, 9),
    ],
  },
  {
    id: 'sil-2',
    title: 'Araçtan ateş edilerek yaralama (trafik tartışması)',
    address: 'Mersin / Yenişehir — Adana-Ankara karayolu kavşağı yaklaşısı',
    story:
      'Trafik tartışması sonrası şüpheli araçtan mağdur aracına ateş edildi; arka camdan giren mermi sürücüyü omzundan yaraladı. Mağdur araç frende durdu; yol üstünde boş kovan bulundu, şüpheli araç hızla uzaklaştı.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur aracı (arka cam isabet izi)' },
      { no: '2', desc: 'Şüpheli aracı (kaçtı)' },
      { no: '3', desc: 'Boş kovan (yol üstü)' },
      { no: '4', desc: 'Mağdur aracının fren izi' },
      { no: '5', desc: 'Araçtan taşan kan' },
      { no: '6', desc: 'Şüpheli aracın kaçış yönü' },
    ],
    objects: [
      roadH(20, 1346, 300, 150),
      // Mağdur aracı + isabet
      { s: 'v-sedan', x: 300, y: 240, w: 180, h: 78, name: 'Mağdur aracı (frende durdu)' },
      { s: 'tr-bullet-glass', x: 428, y: 252, w: 30, h: 30, name: 'Arka camda isabet izi' },
      { s: 'in-blood-smear', x: 340, y: 330, w: 85, h: 36, name: 'Araçtan taşan kan' },
      { s: 'tr-skid-straight', x: 490, y: 300, w: 130, h: 34, name: 'Fren izi' },
      // Şüpheli aracı + kovan
      { s: 'v-sedan', x: 900, y: 240, w: 180, h: 78, name: 'Şüpheli aracı (uzaklaşıyor)' },
      { s: 'tr-casing-pistol', x: 700, y: 350, w: 26, h: 26, name: 'Boş kovan (yol üstü)' },
      // Kaçış
      dash(1150, 300, 1320, 220, 'Kaçış yönü'),
      { s: 'out-cctv', x: 1200, y: 110, w: 52, h: 40, name: 'Kavşak kamerası' },
      { s: 'out-street-light', x: 150, y: 120, w: 40, h: 54 },
      // Numaratörler
      marker('1', 'Mağdur aracı', 390, 350),
      marker('2', 'Şüpheli aracı', 990, 350),
      marker('3', 'Boş kovan', 713, 400),
      marker('4', 'Fren izi', 555, 400),
      marker('5', 'Kan (yol üstü)', 382, 400),
      marker('6', 'Kaçış yönü', 1290, 190),
      // Ölçüler + açıklamalar
      arrow(480, 400, 900, 400, 'Araçlar arası ≈ 4,4 m'),
      callout('Sürücü omzundan yaralandı', 250, 170, 11),
      callout('Atış arka camdan içeri girdi', 650, 170, 11),
      note('Kavşak kamerası 19.20 de plakayı okudu.', 40, 620, 270, 9),
    ],
  },
  {
    id: 'sil-3',
    title: 'Kafe önünde pompalı silahla yaralama',
    address: 'Gaziantep / Şehitkamil — Batıkent Mah. kafe önü',
    story:
      'Kafe çıkışı mağdura pompalı silahla ateş edildi; mağdur kaçarken bacağından yaralandı ve kafe önünde yarı kalkmış bulundu. Yerde pompalı tüfek, 2 kovan ve kafe camına isabet eden saçma izleri mevcut.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Mağdur (yaralı, kafe önü)' },
      { no: '2', desc: 'Giriş yarası (bacak)' },
      { no: '3', desc: 'Pompalı tüfek (yerde bırakıldı)' },
      { no: '4', desc: 'Pompalı kovanlar (2 adet)' },
      { no: '5', desc: 'Kafe camındaki saçma isabet izi' },
      { no: '6', desc: 'Saldırganın kaçış yönü' },
    ],
    objects: [
      // Kafe
      ...room(160, 80, 500, 360),
      win(220, 76, 80, 0),
      win(400, 76, 80, 0),
      door(300, 440, 56, 0),
      lbl('Kafe', 410, 300, 11),
      // Cam isabet izi (sağ pencere kenarı duvar üstü)
      { s: 'tr-bullet-glass', x: 590, y: 300, w: 28, h: 28, name: 'Cam isabet izi (sağ pencere)' },
      // Mağdur + yara + kan
      { s: 'kk-injured', x: 760, y: 400, w: 105, h: 70, name: 'Mağdur (yaralı, kaçarken)' },
      { s: 'in-bullet-in', x: 792, y: 430, w: 28, h: 28, name: 'Giriş yarası (bacak)' },
      { s: 'in-blood-pool', x: 820, y: 480, w: 90, h: 55 },
      // Silah + kovanlar
      { s: 'w-3', x: 660, y: 470, w: 60, h: 22, rot: -10, name: 'Pompalı tüfek (yerde)' },
      { s: 'tr-casing-rifle', x: 600, y: 430, w: 26, h: 26 },
      { s: 'tr-casing-rifle', x: 632, y: 444, w: 26, h: 26, rot: 15 },
      // Kaçış
      dash(950, 500, 1150, 580, 'Saldırganın kaçış yönü'),
      { s: 'out-street-light', x: 950, y: 180, w: 40, h: 54 },
      { s: 'out-cctv', x: 1080, y: 120, w: 52, h: 40, name: 'Sokak kamerası' },
      // Numaratörler
      marker('1', 'Mağdur', 760, 370),
      marker('2', 'Bacak yarası', 830, 420),
      marker('3', 'Pompalı tüfek', 690, 520),
      marker('4', 'Kovanlar', 616, 400),
      marker('5', 'Cam isabet izi', 604, 340),
      marker('6', 'Kaçış yönü', 1160, 560),
      // Ölçüler + açıklamalar
      arrow(700, 580, 900, 580, '≈ 2,1 m'),
      callout('Saldırgan tüfekli, yüzü maskeli', 300, 620, 11),
      callout('Olay 21.05 te; 2 saçma kafe camına isabet etti', 750, 200, 11),
      note('Tüfek otopsi ve balistik incelemeye sevk edildi.', 40, 650, 290, 9),
    ],
  },
  {
    id: 'sil-4',
    title: 'Ev baskını sırasında savunma amaçlı silah kullanımı',
    address: 'Antalya / Konyaaltı — Liman Mah. müstakil ev',
    story:
      'Gece kapıyı kırarak giren maskeli şahıs, ev sahibinin bacak bölgesine ateş etmesiyle yaralanarak yerde kaldı. Ev sahibinin ruhsatlı tabancası, bir boş kovan ve kan sürüntüsü tespit edildi.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Saldırgan (yaralı, yerde)' },
      { no: '2', desc: 'Giriş yarası (bacak bölgesi)' },
      { no: '3', desc: 'Ev sahibinin ruhsatlı tabancası' },
      { no: '4', desc: 'Boş kovan' },
      { no: '5', desc: 'Kan sürüntüsü (hol girişine)' },
      { no: '6', desc: 'Kırılan giriş kapısı' },
    ],
    objects: [
      ...room(120, 80, 860, 480),
      // Kırılan giriş kapısı (alt duvar) — kanat duvar çizgisinde
      door(200, 560, 56, 0),
      lbl('Kapı zorlanarak açıldı', 250, 520, 9),
      win(500, 76, 80, 0),
      // Mobilya
      { s: 'f-2', x: 160, y: 120, w: 140, h: 190, name: 'Yatak' },
      { s: 'f-13', x: 700, y: 100, w: 130, h: 55, name: 'Gardırop' },
      { s: 'f-9', x: 420, y: 200, w: 220, h: 140, name: 'Halı' },
      // Saldırgan + yara + kan
      { s: 'p-4', x: 400, y: 360, w: 36, h: 80, name: 'Saldırgan (yaralı, yerde)' },
      { s: 'in-bullet-in', x: 406, y: 396, w: 28, h: 28, name: 'Giriş yarası (bacak)' },
      { s: 'in-blood-smear', x: 460, y: 440, w: 90, h: 36, name: 'Kan sürüntüsü' },
      // Silah + kovan
      { s: 'w-1', x: 540, y: 440, w: 44, h: 30, rot: -15, name: 'Ev sahibinin tabancası' },
      { s: 'tr-casing-pistol', x: 590, y: 470, w: 26, h: 26, name: 'Boş kovan' },
      // Kolluk
      { s: 'p-13', x: 300, y: 480, w: 26, h: 34, name: 'İlk müdahale ekibi' },
      // Numaratörler
      marker('1', 'Saldırgan', 418, 330),
      marker('2', 'Bacak yarası', 452, 380),
      marker('3', 'Tabanca', 562, 410),
      marker('4', 'Boş kovan', 603, 500),
      marker('5', 'Kan sürüntüsü', 505, 520),
      marker('6', 'Kırılan kapı', 228, 470),
      // Ölçüler + açıklamalar
      arrow(200, 620, 460, 620, 'Kapı - saldırgan ≈ 2,7 m'),
      callout('Saldırgan maskeli; kimliği tespit çalışması var', 700, 620, 11),
      callout('Ev sahibi ifadede savunma hakkı kapsamında', 200, 200, 11),
      note('Tabanca balistiğe sevk edildi; kovan tek atım.', 60, 650, 280, 9),
    ],
  },
  {
    id: 'sil-5',
    title: 'Benzin istasyonunda silahlı soygun — görevli ayağından yaralandı',
    address: 'Eskişehir / Tepebaşı — Çankaya Mah. benzin istasyonu',
    story:
      'Silahlı şahıs istasyon marketine girip kasadaki parayı istedi; görevlinin direnmesi üzerine ayağına ateş ederek yaya olarak kaçtı. Pompa önünde bekleyen şüpheli araç kamera kaydına girdi.',
    scaleNote: '≈ 1 m = 95 piksel',
    bulgular: [
      { no: '1', desc: 'Market kasası (boşaltıldı)' },
      { no: '2', desc: 'Görevli (yaralı, ayağından)' },
      { no: '3', desc: 'Giriş yarası (ayak bileği)' },
      { no: '4', desc: 'Kan birikintisi' },
      { no: '5', desc: 'Şüphelinin kaçış yönü (yaya)' },
      { no: '6', desc: 'Şüpheli araç (pompa önü, kamera kaydında)' },
    ],
    objects: [
      // Market binası
      ...room(300, 160, 500, 300),
      lbl('Market', 550, 190, 11),
      // Kasa
      { s: 'ev-rect-hollow', x: 340, y: 200, w: 100, h: 60, name: 'Kasa (boşaltıldı)' },
      lbl('Kasa', 390, 185, 9),
      // Market kapısı (alt duvar) — kanat duvar çizgisinde
      door(420, 460, 56, 0),
      // Pompa adaları
      { s: 'ev-rect-hollow', x: 900, y: 240, w: 110, h: 60 },
      { s: 'ev-rect-hollow', x: 900, y: 400, w: 110, h: 60 },
      lbl('Pompa 1', 955, 225, 9),
      lbl('Pompa 2', 955, 385, 9),
      // Görevli + yara + kan
      { s: 'kk-injured', x: 500, y: 520, w: 105, h: 70, name: 'Görevli (yaralı)' },
      { s: 'in-bullet-in', x: 528, y: 548, w: 28, h: 28, name: 'Giriş yarası (ayak bileği)' },
      { s: 'in-blood-pool', x: 570, y: 570, w: 80, h: 50 },
      // Kaçış + şüpheli araç
      dash(700, 600, 900, 640, 'Kaçış yönü (yaya)'),
      { s: 'v-sedan', x: 1000, y: 540, w: 180, h: 78, name: 'Şüpheli araç (pompa önü)' },
      // Kamera + dubalar
      { s: 'out-cctv', x: 350, y: 110, w: 52, h: 40, name: 'İstasyon kamerası' },
      { s: 'ts-traffic-cone', x: 820, y: 300, w: 24, h: 24 },
      { s: 'ts-traffic-cone', x: 860, y: 320, w: 24, h: 24 },
      // Numaratörler
      marker('1', 'Kasa', 390, 290),
      marker('2', 'Görevli', 500, 490),
      marker('3', 'Ayak bileği yarası', 560, 540),
      marker('4', 'Kan birikintisi', 610, 650),
      marker('5', 'Kaçış yönü', 880, 620),
      marker('6', 'Şüpheli araç', 1090, 500),
      // Ölçüler + açıklamalar
      arrow(300, 700, 480, 700, 'Kapı - görevli ≈ 1,9 m'),
      callout('Şahıs yüzü maskeli, tabancalı', 200, 300, 11),
      callout('Olay 03.40 te; kasa 2.900 TL alındı', 900, 130, 11),
      note('Görevli 112 ekiyle hastaneye kaldırıldı.', 40, 680, 270, 9),
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Dışa aktarım                                                        */
/* ------------------------------------------------------------------ */

export const KROKI_CASE_GROUPS: KrokiCaseGroup[] = [
  {
    id: 'hirsizlik',
    name: 'İkametten Hırsızlık',
    desc: 'Konut içi hırsızlık olayları: giriş yöntemi, iz ve delil yerleşimli kroki senaryoları.',
    icon: 'Home',
    scenarios: hirsizlik,
  },
  {
    id: 'kaza',
    name: 'Kavşakta Ölümlü Trafik Kazası',
    desc: 'Kavşak kazaları: araç yerleşimi, fren izleri, savrulma ve ölçülerle krokiler.',
    icon: 'Car',
    scenarios: kaza,
  },
  {
    id: 'cinayet',
    name: 'İkamette Cinayet',
    desc: 'Konutta işlenen cinayet olayları: ceset konumu, kan paternleri ve delil krokipleri.',
    icon: 'Skull',
    scenarios: cinayet,
  },
  {
    id: 'intihar',
    name: 'Ası Suretiyle İntihar',
    desc: 'Ası sonucu ölümler: bağlantı noktası, ip, mağdur konumu ve bulgu yerleşimleri.',
    icon: 'HeartCrack',
    scenarios: intihar,
  },
  {
    id: 'oto-hirsizlik',
    name: 'Otodan Hırsızlık',
    desc: 'Araç içi ve araçtan hırsızlık olayları: kırma yöntemi, iz ve delil yerleşimli kroki senaryoları.',
    icon: 'Car',
    scenarios: otoHirsizligi,
  },
  {
    id: 'isyeri-hirsizlik',
    name: 'İşyerinden Hırsızlık',
    desc: 'Ofis, market ve işyeri hırsızlıkları: giriş yöntemi, kasa ve delil yerleşimli kroki senaryoları.',
    icon: 'Briefcase',
    scenarios: isyeriHirsizligi,
  },
  {
    id: 'bicakla-yaralama',
    name: 'Bıçakla Yaralama',
    desc: 'Kesici aletle yaralama olayları: yara, kan paterni ve delil yerleşimli kroki senaryoları.',
    icon: 'Slice',
    scenarios: bicaklaYaralama,
  },
  {
    id: 'silahla-yaralama',
    name: 'Silahla Yaralama',
    desc: 'Ateşli silahla yaralama olayları: kovan, isabet ve delil yerleşimli kroki senaryoları.',
    icon: 'Crosshair',
    scenarios: silahlaYaralama,
  },
];

export const KROKI_SCENARIO_COUNT = KROKI_CASE_GROUPS.reduce((n, g) => n + g.scenarios.length, 0);
