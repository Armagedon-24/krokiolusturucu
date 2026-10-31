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

/** Kapı (kanat + açılım yayı) */
const door = (x: number, y: number, w = 56, rot = 0): KrokiPlacement => ({ s: 'arch-d1l', x, y, w, h: w, rot });

/** Çift kanatlı kapı / balkon kapısı */
const doubleDoor = (x: number, y: number, w = 70, rot = 0): KrokiPlacement => ({ s: 'arch-d2', x, y, w, h: w, rot });

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

/** Yatay yol bandı — merkez çizgisi cy, bant genişliği bw, x0..x1 (st-1 SVG oranına göre) */
const roadH = (x0: number, x1: number, cy: number, bw = 150): KrokiPlacement => {
  const h = Math.round(bw / 0.3);
  return { s: 'st-1', x: x0, y: Math.round(cy - h / 2), w: x1 - x0, h };
};

/** Dikey yol bandı — merkez çizgisi cx, y0..y1 (st-1 rotasyonu 90°) */
const roadV = (cx: number, y0: number, y1: number, bw = 150): KrokiPlacement => {
  const h = Math.round(bw / 0.3);
  const L = y1 - y0;
  return { s: 'st-1', x: Math.round(cx + h / 2), y: y0, w: L, h, rot: 90 };
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
      const sym = SYMBOL_INDEX[p.s];
      if (!sym) continue; // bilinmeyen sembol atlanır (uygulama güncellendiğinde dayanıklılık)
      const w = p.w ?? (typeof sym.width === 'number' ? sym.width : 100);
      const h = p.h ?? (typeof sym.height === 'number' ? sym.height : 100);
      out.push({
        id: uuidv4(), type: 'symbol', name: p.name || sym.name || p.s,
        symbolId: sym.id, categoryId: sym.categoryId, src: sym.src,
        x: ox + (p.x ?? 0), y: oy + (p.y ?? 0),
        width: w, height: h,
        rotation: p.rot ?? 0, scaleX: 1, scaleY: 1,
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
      // Giriş kapısı (alt duvar, salon)
      door(100, 422, 56, 0),
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
      { s: 'tr-footprint', x: 300, y: 378, w: 20, h: 36, rot: -15 },
      { s: 'tr-footprint', x: 346, y: 390, w: 20, h: 36, rot: 8 },
      { s: 'tr-footprint', x: 392, y: 376, w: 20, h: 36, rot: -5 },
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
      door(304, 328, 56, 0),
      // Arka pencere (giriş noktası) — sol duvar
      { s: 'arch-win', x: 128, y: 120, w: 80, h: 12, rot: 90 },
      // Arka kapı — sağ duvar
      door(650, 460, 56, 90),
      // ---- Mobilya
      { s: 'f-2', x: 500, y: 70, w: 140, h: 190, name: 'Çift Kişilik Yatak' },
      { s: 'f-7', x: 330, y: 56, w: 150, h: 55, name: 'Gardırop (3 Kapılı)' },
      { s: 'f-5', x: 180, y: 80, w: 86, h: 84, name: 'Koltuk' },
      { s: 'f-3', x: 140, y: 470, w: 150, h: 55, name: 'Mutfak Tezgahı' },
      { s: 'f-11', x: 322, y: 468, w: 70, h: 45, name: 'Paspas' },
      // ---- İzler ve deliller
      { s: 'tr-mud', x: 158, y: 148, w: 70, h: 45, rot: 15 },
      { s: 'tr-footprint', x: 240, y: 180, w: 20, h: 38, rot: 20 },
      { s: 'tr-footprint', x: 282, y: 212, w: 20, h: 38, rot: -10 },
      { s: 'tr-footprint', x: 322, y: 252, w: 20, h: 38, rot: 5 },
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
      // Kiler kapıları (koridor tarafına)
      door(140, 318, 48, 180),
      door(400, 318, 48, 180),
      door(660, 318, 48, 180),
      door(920, 318, 48, 180),
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
      { s: 'tr-footprint', x: 610, y: 415, w: 20, h: 36, rot: -10 },
      { s: 'tr-footprint', x: 650, y: 428, w: 20, h: 36, rot: 6 },
      { s: 'tr-footprint', x: 690, y: 414, w: 20, h: 36, rot: -4 },
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
      callout('Koridor kamerası şüpheliyi kaydetti', 950, 560, 11),
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
      // Teras kapısı (alt duvar) + giriş
      doubleDoor(490, 462, 72, 0),
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
      { s: 'tr-footprint', x: 330, y: 118, w: 20, h: 36, rot: 8 },
      marker('2', 'Çit altında çamur izleri', 402, 96),
      { s: 'tr-footprint', x: 520, y: 424, w: 20, h: 36, rot: -8 },
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
      callout('Teras kapısı camı kırılarak sürgü kaldırıldı', 560, 300, 11),
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
      door(620, 228, 48, 0),
      lbl('Banyo', 690, 150, 10),
      // Balkon kapısı — sağ duvar (rot 90)
      doubleDoor(786, 370, 66, 90),
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
      { s: 'tr-footprint', x: 300, y: 402, w: 20, h: 36, rot: 6 },
      { s: 'tr-footprint', x: 344, y: 414, w: 20, h: 36, rot: -10 },
      marker('5', 'Zeminde ayakkabı taban izleri', 396, 418),
      { s: 'ev-rect-hollow', x: 630, y: 90, w: 40, h: 34 },
      lbl('Kombi', 650, 107, 9),
      // ---- Ölçüler ve açıklamalar
      arrow(750, 404, 508, 180, '≈ 3,4 m'),
      callout('Balkon kapısı sürgüsü dışarıdan kaldırılmış', 640, 240, 11),
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
      door(150, 432, 56, 0),
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
      door(556, 256, 44, 0),
      lbl('Banyo', 645, 150, 10),
      door(350, 470, 54, 0),
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
      { s: 'tr-footprint', x: 470, y: 82, w: 20, h: 36, rot: -10 },
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
      door(620, 424, 54, 0),
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
      { s: 'tr-footprint', x: 198, y: 380, w: 20, h: 36, rot: 10 },
      { s: 'tr-footprint', x: 244, y: 394, w: 20, h: 36, rot: -12 },
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
      door(300, 404, 54, 0),
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
      door(560, 452, 54, 0),
      win(320, 56, 80, 0),
      // Gardırop + ip
      { s: 'f-13', x: 116, y: 76, w: 130, h: 55, name: 'Gardırop' },
      { s: 'ev-rope', x: 240, y: 120, w: 120, h: 30, rot: 90, name: 'İp' },
      lbl('Bağlantı noktası', 300, 108, 9),
      // Mağdur (ipin altında, asılı konum)
      { s: 'p-9', x: 240, y: 140, w: 100, h: 50, rot: 90, name: 'Mağdur (asılı)' },
      // Devrik tabure
      { s: 'f-5', x: 280, y: 176, w: 80, h: 75, rot: 35, name: 'Devrik tabure' },
      // Deliller
      { s: 'cl-shoe', x: 150, y: 382, w: 24, h: 24 },
      { s: 'cl-shoe', x: 186, y: 392, w: 24, h: 24, rot: 20 },
      { s: 'ei-phone', x: 330, y: 330, w: 24, h: 36 },
      { s: 'ei-documents', x: 380, y: 300, w: 46, h: 40 },
      { s: 'f-9', x: 420, y: 240, w: 200, h: 140, name: 'Halı' },
      // Numaratörler
      marker('1', 'Mağdur (asılı konum)', 200, 210),
      marker('2', 'İp bağlantı noktası', 330, 70, 30),
      marker('3', 'El yazısı intihar notu', 452, 282, 30),
      marker('4', 'Telefon (veda mesajı taslağı)', 376, 372),
      marker('5', 'Çıkarılmış ayakkabılar', 128, 430, 30),
      marker('6', 'Devrik tabure', 402, 190, 30),
      // Ölçüler
      arrow(320, 200, 260, 170, '≈ 60 cm'),
      arrow(116, 430, 116, 130, '≈ 3,1 m'),
      // Açıklamalar
      callout('Mağdur ayakları yerden 8 cm yukarıda (asılı)', 520, 220, 11),
      callout('Kapı içeriden kilitli — 112 ekibi kırdı', 560, 480, 11),
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
      door(360, 388, 50, 0),
      // Duş teknesi
      { s: 'ev-rect-hollow', x: 230, y: 100, w: 90, h: 60 },
      lbl('Duş teknesi', 275, 130, 9),
      // Lavabo dolabı (sağ duvar)
      { s: 'f-3', x: 564, y: 110, w: 90, h: 50, rot: 90, name: 'Lavabo dolabı' },
      // İp + mağdur
      { s: 'ev-rope', x: 352, y: 86, w: 55, h: 22, rot: 90, name: 'İp' },
      { s: 'p-9', x: 348, y: 118, w: 90, h: 46, rot: 90, name: 'Mağdur (asılı)' },
      // Deliller
      { s: 'ei-documents', x: 505, y: 226, w: 42, h: 36 },
      { s: 'ei-phone', x: 528, y: 138, w: 22, h: 34 },
      { s: 'tr-liquid-pool', x: 276, y: 260, w: 70, h: 45 },
      { s: 'cl-shoe', x: 376, y: 428, w: 24, h: 24 },
      { s: 'cl-shoe', x: 408, y: 434, w: 24, h: 24, rot: 15 },
      // Numaratörler
      marker('1', 'Mağdur (asılı konum)', 300, 190),
      marker('2', 'İp bağlantı noktası: duş teli', 380, 70, 30),
      marker('3', 'Katlanmış intihar notu', 560, 260, 30),
      marker('4', 'Telefon (lavabo üstü)', 580, 120, 30),
      marker('5', 'Çıkarılmış ayakkabılar', 450, 440, 30),
      marker('6', 'Duş suyu birikintisi', 240, 330, 30),
      // Ölçüler
      arrow(345, 170, 385, 395, '≈ 2,3 m'),
      arrow(200, 80, 200, 396, '≈ 3,3 m'),
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
      // İp + mağdur
      { s: 'ev-rope', x: 455, y: 152, w: 70, h: 24, rot: 90, name: 'İp' },
      { s: 'p-9', x: 452, y: 180, w: 95, h: 48, rot: 90, name: 'Mağdur (asılı)' },
      // Deliller
      { s: 'ei-phone', x: 250, y: 396, w: 24, h: 36 },
      { s: 'ei-keys', x: 300, y: 424, w: 20, h: 26 },
      { s: 'ei-documents', x: 196, y: 414, w: 44, h: 38 },
      { s: 'cl-shoe', x: 330, y: 148, w: 22, h: 22 },
      { s: 'cl-shoe', x: 356, y: 156, w: 22, h: 22, rot: 25 },
      lbl('Alt kat holü', 250, 540, 10),
      door(600, 500, 54, 0),
      lbl('Giriş kapısı', 660, 520, 9),
      // Numaratörler
      marker('1', 'Mağdur (asılı konum)', 500, 230),
      marker('2', 'İp bağlantı noktası: korkuluk', 380, 110, 30),
      marker('3', 'Katlanmış intihar notu', 150, 470, 30),
      marker('4', 'Telefon ve anahtarlar (sahanlık)', 330, 460, 30),
      marker('5', 'Çıkarılmış ayakkabılar', 310, 200, 30),
      // Ölçüler
      arrow(460, 240, 250, 420, '≈ 3,1 m'),
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
      { s: 'arch-w1i', x: 200, y: 238, w: 420, h: 6 },
      lbl('Çatı kirişi', 410, 224, 9),
      // İp + mağdur
      { s: 'ev-rope', x: 410, y: 244, w: 110, h: 26, rot: 90, name: 'İp' },
      { s: 'p-9', x: 406, y: 300, w: 100, h: 50, rot: 90, name: 'Mağdur (asılı)' },
      // Devrik tabure
      { s: 'f-5', x: 436, y: 336, w: 80, h: 75, rot: 40, name: 'Devrik tabure' },
      // Deliller
      { s: 'ei-documents', x: 250, y: 330, w: 46, h: 40 },
      { s: 'ei-id-card', x: 320, y: 350, w: 24, h: 24 },
      { s: 'ei-keys', x: 508, y: 300, w: 20, h: 26 },
      { s: 'ei-phone', x: 560, y: 326, w: 24, h: 36 },
      { s: 'tr-footprint', x: 300, y: 200, w: 20, h: 36 },
      { s: 'tr-footprint', x: 346, y: 190, w: 20, h: 36, rot: 12 },
      // Koliler
      ...box(680, 120, 70, 50, 'Koli'),
      ...box(772, 140, 60, 45),
      ...box(706, 220, 65, 48),
      // Numaratörler
      marker('1', 'Mağdur (asılı konum)', 340, 330),
      marker('2', 'İp bağlantı noktası: kiriş', 330, 250, 30),
      marker('3', 'İntihar notu', 210, 370, 30),
      marker('4', 'Kimlik ve anahtarlar', 300, 420, 30),
      marker('5', 'Devrik tabure', 540, 400, 30),
      marker('6', 'Toz tabakada ayakkabı izleri', 380, 170, 30),
      // Ölçüler
      arrow(480, 360, 420, 330, '≈ 45 cm'),
      arrow(60, 250, 200, 250, '1,5 m'),
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
      door(1020, 488, 52, 0),
      lbl('Ev (arka cephe)', 1160, 90, 10),
      // Sokak lambası
      { s: 'out-street-light', x: 856, y: 176, w: 40, h: 54 },
      // Ağaç + ip + mağdur
      { s: 'out-tree-1', x: 500, y: 216, w: 90, h: 90, name: 'Ceviz ağacı' },
      { s: 'ev-rope', x: 545, y: 240, w: 120, h: 24, rot: 90, name: 'İp' },
      { s: 'p-9', x: 540, y: 286, w: 95, h: 48, rot: 90, name: 'Mağdur (asılı)' },
      // Devrik bahçe taburesi
      { s: 'out-bench', x: 620, y: 256, w: 80, h: 36, rot: 25, name: 'Devrik tabure' },
      // Deliller
      { s: 'cl-shoe', x: 450, y: 336, w: 24, h: 24 },
      { s: 'cl-shoe', x: 482, y: 346, w: 24, h: 24, rot: 18 },
      { s: 'ei-documents', x: 598, y: 396, w: 44, h: 38 },
      { s: 'out-bench', x: 700, y: 420, w: 90, h: 38, name: 'Bank' },
      { s: 'ei-phone', x: 726, y: 394, w: 24, h: 36 },
      { s: 'tr-mud', x: 300, y: 420, w: 80, h: 50 },
      { s: 'tr-footprint', x: 380, y: 400, w: 20, h: 36 },
      { s: 'tr-footprint', x: 420, y: 384, w: 20, h: 36, rot: -10 },
      // Numaratörler
      marker('1', 'Mağdur (asılı konum)', 470, 250),
      marker('2', 'İp bağlantı noktası: ana dal', 560, 190, 30),
      marker('3', 'Katlanmış intihar notu', 670, 370, 30),
      marker('4', 'Telefon (bank üstü)', 790, 380, 30),
      marker('5', 'Çıkarılmış ayakkabılar', 418, 372, 30),
      marker('6', 'Bahçede çamur izleri', 320, 480, 30),
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
];

export const KROKI_SCENARIO_COUNT = KROKI_CASE_GROUPS.reduce((n, g) => n + g.scenarios.length, 0);
