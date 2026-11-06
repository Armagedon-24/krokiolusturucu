import React, { useRef, useEffect, useState, lazy, Suspense } from 'react';
import { Stage, Layer, Image as KonvaImage, Text, Transformer, Rect, Arrow, Group, Line, Path, Circle, Ellipse, Arc, Label, Tag } from 'react-konva';
import { useStore } from '../../store/useStore';
import useImage from 'use-image';
import { 
  Trash2, 
  Upload, 
  Target, 
  Grid, 
  Camera, 
  User, 
  Info,
  Activity,
  Copy,
  ClipboardPaste,
  CopyPlus,
  X,
  FlipHorizontal2,
  FlipVertical2,
  RotateCw,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignLeft,
  AlignCenter,
  AlignRight,
  MoveUp,
  MoveDown
} from 'lucide-react';
import Konva from 'konva';
const DistanceModal = lazy(() => import('../UI/DistanceModal').then(m => ({ default: m.DistanceModal })));
const EvidencePhotoModal = lazy(() => import('../UI/EvidencePhotoModal').then(m => ({ default: m.EvidencePhotoModal })));
const BodyMapModal = lazy(() => import('../UI/BodyMapModal').then(m => ({ default: m.BodyMapModal })));
const FindingModal = lazy(() => import('../UI/Modal').then(m => ({ default: m.FindingModal })));
const PromptModal = lazy(() => import('../UI/Modal').then(m => ({ default: m.PromptModal })));
const DistanceMatrixModal = lazy(() => import('../UI/DistanceMatrixModal').then(m => ({ default: m.DistanceMatrixModal })));
import { AccidentAnimation } from './AccidentAnimation';
import { FallAnimationCanvas } from './FallAnimationCanvas';
import { PedestrianLaunchCanvas } from './PedestrianLaunchCanvas';
import { PageControlBar } from './PageControlBar';
import type { CanvasObject } from '../../types';
import { drawTiledImage, tilePatternParams, SYMBOL_TILE_MODES, getTextureInfo, resolveConcreteTileMode, drawStripCaps, composeStripCanvas } from '../../utils/tiledRender';
import { migrateLegacyAssetUrl, withBase } from '../../utils/assetMigration';

const RemoveWhiteFilter = (imageData: any) => {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // If pixel is white or very close to white (tolerance increased to 225), make it transparent
    if (r > 225 && g > 225 && b > 225) {
      data[i + 3] = 0;
    }
  }
};

import { v4 as uuidv4 } from 'uuid';
import { SYMBOL_CATEGORIES } from '../../constants/symbols';
// HIZ: jsPDF ağır bir pakettir (~350KB gz). Tip tanımı dışında çalışma anı kullanımı
// PDF dışa aktarma fonksiyonunda dinamik import ile yapılır — açılış paketine girmez.
import type { jsPDF } from 'jspdf';

import { calculateCalloutSize, getEffectiveZIndex, compressAndResizeImage, processUploadedSymbolImage } from '../../utils/canvasUtils';

const useSmartImage = (src: string | undefined) => {
  // CORS dostu yükleme ('anonymous'): kanvası lekelemez → toDataURL (PDF/önizleme
  // yedek yolu) SecurityError atmaz. Kullanılan tüm dış hostlar (Cloudinary, Yandex
  // static-maps, Esri World_Imagery) Access-Control-Allow-Origin: * gönderir.
  // ACAO göndermeyen nadir bir kaynakta yükleme 'failed' olursa CORS'suz yeniden
  // denenir — görsel görünür kalır ama kanvas lekelenebilir (eski davranış).
  // PNG→WebP varlık optimizasyonu sonrası eski kayıtlı projelerdeki .png yolları
  // için: /assets/*.png yüklenemezse bir kez .webp karşılığı denenir.
  const [webpRetrySrc, setWebpRetrySrc] = useState<string | null>(null);
  const migrated = migrateLegacyAssetUrl(src);
  const effective = withBase(webpRetrySrc || migrated || '');
  const [corsImage, corsStatus] = useImage(effective, 'anonymous');
  const [plainImage] = useImage(corsStatus === 'failed' ? effective : '');
  useEffect(() => {
    if (
      corsStatus === 'failed' &&
      !webpRetrySrc &&
      migrated &&
      /^\/assets\/.+\.png$/i.test(migrated)
    ) {
      setWebpRetrySrc(migrated.replace(/\.png$/i, '.webp'));
    }
  }, [corsStatus, migrated, webpRetrySrc]);
  return corsImage || plainImage;
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF/Önizleme export çizici (ekran render'ının canvas-2D aynası).
// Ekranla aynı dalları çizer: a-4/a-5 ölçüm okları, ev-callout balonu,
// ev-arrow-desc açıklama balonu, Bulgu Listesi tablosu, mesafe/bulgu etiketleri.
// Ayna (scaleX/scaleY === -1) ofseti çağıran taraf uygular; bu fonksiyon node
// orijinine translate edilmiş bağlamda çizer.
// ─────────────────────────────────────────────────────────────────────────────
// ═══ AÇIK CHEVRON OK UCU (st-5 tarzı) ═══
// Kullanıcı isteği: a-4 (Mesafe Oku) ve a-5 (Ok) uçlarındaki İÇİ DOLU üçgen
// başlar kaldırıldı; her iki sembolün ucu artık st-5 yol yön okundaki gibi
// İÇİ BOŞ (stroke-only) chevron. Ekran (Konva Line) ve export
// (drawArrowHeadExport) aynı geometriyi paylaşır; headLen ('arrowHead')
// resize'da orantılı büyüyüp küçülmeye devam eder.
const ARROW_CHEVRON_SPREAD = Math.PI / 7;
const chevronHeadPoints = (fromX: number, fromY: number, toX: number, toY: number, headLen: number, spread: number = ARROW_CHEVRON_SPREAD): number[] => {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  return [
    toX - headLen * Math.cos(angle - spread), toY - headLen * Math.sin(angle - spread),
    toX, toY,
    toX - headLen * Math.cos(angle + spread), toY - headLen * Math.sin(angle + spread),
  ];
};

const drawArrowHeadExport = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, headLen: number, openChevron: boolean = false) => {
  const p = chevronHeadPoints(fromX, fromY, toX, toY, headLen);
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(p[2], p[3]);
  ctx.lineTo(p[4], p[5]);
  if (openChevron) {
    // st-5 tarzı açık baş: dolgusuz, yuvarlak uçlu iki çizgi
    ctx.stroke();
  } else {
    ctx.closePath();
    ctx.fill();
  }
};

// ═══ MESAFE ETİKETİ EXPORT ÇİZİCİ ═══
// Ekran (Konva Group+Text) ile aynı geometri: çizgi orta noktası + labelOffset +
// açı normalizasyonu + hız satırı. drawExportObject'in ok dalı (erken return
// yüzünden etiket bölümüne hiç ulaşmıyordu — kullanıcı raporu: önizleme ve
// PDF'te mesafe oku rakamları görünmüyor) ve genel etiket bölümü (8. adım)
// bu tek yardımcıyı paylaşır → ekran = çıktı birebir.
const drawDistanceLabelExport = (ctx: CanvasRenderingContext2D, obj: any, symbolId: string, w: number, h: number) => {
  if (!obj.distance) return;
  const isDistanceTool = obj.isDistanceArrow || symbolId === 'a-4';
  const angle = isDistanceTool && obj.startX !== undefined
    ? Math.atan2(obj.endY - obj.startY, obj.endX - obj.startX) * (180 / Math.PI)
    : 0;
  let textRotation = angle;
  if (textRotation > 90) textRotation -= 180;
  if (textRotation < -90) textRotation += 180;
  const fontSize = obj.distanceFontSize || (isDistanceTool ? 10 : 14);
  const hasArrowCoords = obj.startX !== undefined && obj.endX !== undefined;
  // Ekranla aynı kural: koordinatlı oklarda grup orijini = çizgi orta noktası → (0,0);
  // koordinatsız oklarda çizgi 0..w aralığında → (w/2, h/2).
  const gx = isDistanceTool ? (hasArrowCoords ? 0 : w / 2) : 0;
  const gy = isDistanceTool ? (hasArrowCoords ? 0 : h / 2) : (symbolId === 'ev-arrow-text' ? -20 : (h ? h + 5 : 50));
  // RAKAM KONUM OFSETİ: ekrandaki sürükleme/konum butonları ofseti çıktıda aynen uygulanır
  const lo = obj.labelOffset || { dx: 0, dy: 0 };
  ctx.save();
  ctx.translate(gx + (lo.dx || 0), gy + (lo.dy || 0));
  ctx.rotate((textRotation * Math.PI) / 180);
  ctx.font = `bold ${fontSize}px Inter, Arial`;
  ctx.fillStyle = obj.distanceColor || '#000000';
  ctx.textAlign = 'center';
  // ÇOK SATIRLI ETİKET + SATIR ARALIĞI (ekrandaki kuralın aynısı): ilk satır eski
  // konumunda kalır, sonraki satırlar punto × satır aralığı ilerlemeyle altına yazılır.
  const labelLinesPdf = String(obj.text || obj.distance || '').split('\n');
  const labelLhPdf = obj.lineHeight || 1;
  labelLinesPdf.forEach((ln: string, li: number) => ctx.fillText(ln, 0, -fontSize - 8 + fontSize * labelLhPdf * li));
  if (obj.showSpeedInfo) {
    const rawText = String(obj.text || obj.distance || '');
    const match = rawText.match(/\d+(\.\d+)?/);
    const cm = match ? parseFloat(match[0]) : NaN;
    if (!isNaN(cm) && cm > 0) {
      const meters = rawText.toLowerCase().includes('metre') ? cm : cm / 100;
      const mu = obj.mu || 0.75;
      const efficiency = obj.efficiency || 100;
      const speed = Math.round(15.94 * Math.sqrt(mu * meters * (efficiency / 100)));
      ctx.font = `italic bold ${fontSize * 0.85}px Inter, Arial`;
      ctx.fillStyle = '#059669';
      ctx.fillText(`(~${speed} km/s)`, 0, 5 + fontSize * 0.85);
    }
  }
  ctx.restore();
};

// ═══ OK MOTORU — ORANTILI BAŞ ÖLÇEĞİ ═══
// Kullanıcı isteği: oklar kenar/köşe tutamağından büyütülüp küçültüldüğünde
// ok başları (pointer) da orantılı büyüyüp küçülmeli. Baş boyutu objeye
// 'arrowHead' alanıyla yazılır; ekran (Konva Arrow pointer*) ve export
// (drawArrowHeadExport) aynı değeri okur.
const ARROW_HEAD_MIN = 5;
const ARROW_HEAD_MAX = 120;
const ARROW_HEAD_DEFAULT = 12;

// ═══ DÜZ YOL BİRLEŞİM MOTORU — ELİPS GEÇİŞ PEDİ ═══
// Kullanıcı isteği: iki st-1 düz yol birleştiğinde (uç portları çakıştığında)
// birleşim yeri sert ek yeri değil, YUMUŞAK ELİPS geçişle birleşsin.
// Ped: bisektör yönünde yönlendirilmiş elips (siyah kenar + beyaz gövde +
// kesikli orta çizgi köprüsü). Ekran (IndividualObject) ve export
// (drawExportObject) aynı geometriyi üretir.
const ROAD_JUNCTION_TOL = 24; // px — port çakışma toleransı (snap eşiğiyle uyumlu)

// ═══ YOL MOTORU AİLESİ ═══
// st-1 (Düz Yol) Bezier yol motorunu paylaşan semboller. st-cadde / st-sokak:
// kullanici isteği — düz yol görselinden orta çizgisiz, sokak/cadde adı yazılabilen
// bantlar; birleşim yerleri yuvarlak yumuşak geçiş (elips pedi) ile birleşir.
const ROAD_ENGINE_IDS = ['st-1', 'st-cadde', 'st-sokak'];
const isRoadEngineSymbol = (sid?: string | null): boolean => !!sid && ROAD_ENGINE_IDS.includes(sid);

/** Yol motoru grubunun GERÇEK mürekkep sınırlarını Transformer'a bildirir.
 *  Konva Path.getClientRect çizgi kalınlığını (strokeWidth/2) TÜM yönlere ekler;
 *  yatay yol için bu ±(h/2) yanlış genişleme demektir — seçim çerçevesi sembolün
 *  her iki yanından ~55px taşardı (kullanıcı raporu: çerçeve sembolü tam
 *  çevrelesin). Yama, yol bandının gerçek kutusunu (kavis/kıvrım dahil) döndürür. */
function patchRoadEngineBounds(g: any, props: any) {
  if (!g) return;
  const w = Number(props?.width) || 0;
  const h = Number(props?.height) || 0;
  if (!w || !h) return;
  const edge = Math.max(1.5, h / 20);
  const curv = Number(props?.curvature) || 0;
  const curvX = props?.curvatureX !== undefined ? Number(props.curvatureX) : w / 2;
  const x0 = Math.min(0, w, curvX);
  const x1 = Math.max(0, w, curvX);
  const y0 = Math.min(-edge, curv - edge);
  const y1 = Math.max(h + edge, h + curv + edge);
  if (!g.__origGetClientRect) g.__origGetClientRect = g.getClientRect;
  g.getClientRect = (config: any = {}) => {
    const tight = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    if (config.skipTransform) return tight;
    return g._transformedRect(tight, config.relativeTo);
  };
}
/** Orta kesikli şerit çizgisi görünür mü? (st-1: varsayılan açık; cadde/sokak: varsayılan kapalı) */
const roadShowsMiddleLine = (o: any): boolean =>
  o.roadMiddleLine !== undefined ? !!o.roadMiddleLine : (o.symbolId || '') === 'st-1';
/** Yol adı punto boyutu — yükseklik orantılı varsayılan */
const roadNameFontSize = (o: any): number =>
  o.streetFontSize || Math.max(11, Math.min(30, (o.height || 40) * 0.32));

/** st-1 yolunun uç port (kısa kenar orta noktası) merkezini CANVAS uzayında döndürür. */
const roadPortPoint = (o: any, which: 0 | 1) => {
  const r = ((o.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(r), sin = Math.sin(r);
  const lx = which === 0 ? 0 : (o.width || 0);
  const ly = (o.height || 0) / 2;
  return { x: (o.x || 0) + lx * cos - ly * sin, y: (o.y || 0) + lx * sin + ly * cos };
};

// ═══ YOL BİRLEŞİM MOTORU v2 — YARIM DAİRE + FİLLET GEÇİŞLERİ ═══
// Kullanıcı isteği: iki st-1 düz yol PORTLARINDAN birleştiğinde birleşim yeri
// YARIM DAİRE (yuvarlak balgun) geçişle birleşsin; yollar gövdeleriyle
// kesiştiğinde veya biri diğerinin gövdesine bindiğinde kenarlar karşı gövde
// içinde kesilip köşeler YUMUŞAK FİLLET yaylarıyla bağlansın.
// Tüm geometri tek yerde op listesi (JxOp) olarak üretilir; ekran (Konva) ve
// export (canvas 2D) aynı listeyi çizer → birebir aynı görünüm.

interface JxPt { x: number; y: number }
type JxOp =
  | { op:'clip'; cx:number; cy:number; r:number; ops:JxOp[] }                       // daire içine kırp
  | { op:'fc'; cx:number; cy:number; r:number }                                     // beyaz dolu daire
  | { op:'sc'; cx:number; cy:number; r:number; w:number }                           // siyah halka
  | { op:'fr'; x:number; y:number; w:number; h:number; rot:number }                 // beyaz dikdörtgen (x,y)=kısa kenar ortası
  | { op:'ln'; x1:number; y1:number; x2:number; y2:number; w:number; dash?:boolean }// dash→kesikli siyah; değilse beyaz silgi
  | { op:'lnk'; x1:number; y1:number; x2:number; y2:number; w:number }              // DOLU siyah çizgi (kenar köprüsü)
  | { op:'arc'; x1:number; y1:number; x2:number; y2:number; r:number; ref:JxPt; w:number }; // fillet yayı (siyah)

const jxPerp = (u: JxPt): JxPt => ({ x: -u.y, y: u.x });
const jxCross = (a: JxPt, b: JxPt): number => a.x * b.y - a.y * b.x;

interface JxSeg { p0: JxPt; p1: JxPt; u: JxPt; len: number; wh: number; e: number; mid: boolean; obj: any }

const jxSeg = (o: any): JxSeg => {
  const p0 = roadPortPoint(o, 0), p1 = roadPortPoint(o, 1);
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const h = o.height || 40;
  return { p0, p1, u: { x: dx / len, y: dy / len }, len, wh: h / 2, e: Math.max(1.5, h / 20), mid: roadShowsMiddleLine(o), obj: o };
};

const jxNorm2pi = (a: number): number => { let x = a % (2 * Math.PI); if (x < 0) x += 2 * Math.PI; return x; };

/** T1→T2 yayı (yarıçap r); yay ref noktasına doğru bükey. SVG path (y-down). */
const jxArcPath = (T1: JxPt, T2: JxPt, r: number, ref: JxPt): string => {
  const dx = T2.x - T1.x, dy = T2.y - T1.y;
  const len = Math.hypot(dx, dy);
  if (!isFinite(len) || len < 1e-6) return '';
  const rr = Math.max(r, len / 2 + 0.01);
  const d = Math.sqrt(Math.max(0, rr * rr - (len * len) / 4)); // merkez apotemi
  const mx = (T1.x + T2.x) / 2, my = (T1.y + T2.y) / 2;
  const nx = -dy / len, ny = dx / len;
  const h = rr - d;
  const m1 = { x: mx + nx * h, y: my + ny * h }, m2 = { x: mx - nx * h, y: my - ny * h };
  const pickM1 = ((m1.x - ref.x) ** 2 + (m1.y - ref.y) ** 2) <= ((m2.x - ref.x) ** 2 + (m2.y - ref.y) ** 2);
  const M = pickM1 ? m1 : m2;
  const sM = pickM1 ? 1 : -1;
  const ctr = { x: mx - nx * sM * d, y: my - ny * sM * d };
  const a1 = Math.atan2(T1.y - ctr.y, T1.x - ctr.x);
  const a2 = Math.atan2(T2.y - ctr.y, T2.x - ctr.x);
  const am = Math.atan2(M.y - ctr.y, M.x - ctr.x);
  const sweep = jxNorm2pi(am - a1) < jxNorm2pi(a2 - a1) ? 1 : 0;
  return `M ${T1.x.toFixed(2)} ${T1.y.toFixed(2)} A ${rr.toFixed(2)} ${rr.toFixed(2)} 0 0 ${sweep} ${T2.x.toFixed(2)} ${T2.y.toFixed(2)}`;
};

/** Köşe C'de kesişen iki kenara teğet fillet yayı.
 *  n1/n2: kenarların gövde içine bakan birim normalleri.
 *  DÜZELTME (st-2 görünümü): yay merkezi iki gövdenin DIŞINDAKİ beyaz köşeye
 *  konur → kenarlar köşede DIŞA doğru yumuşak açıyla flarflanır (ağız içinde
 *  kanca/çiçek kıvrımı oluşmaz). */
const jxFillet = (C: JxPt, u1: JxPt, n1: JxPt, u2: JxPt, n2: JxPt, f: number) => {
  const den = jxCross(u1, u2);
  if (Math.abs(den) < 1e-6) return null;
  const m = { x: -f * (n2.x - n1.x), y: -f * (n2.y - n1.y) };
  const t = jxCross(m, u2) / den;
  const ctr = { x: C.x + u1.x * t - f * n1.x, y: C.y + u1.y * t - f * n1.y };
  const T1 = { x: ctr.x + f * n1.x, y: ctr.y + f * n1.y };
  const T2 = { x: ctr.x + f * n2.x, y: ctr.y + f * n2.y };
  return { T1, T2, d: jxArcPath(T1, T2, f, C) };
};

const jxFilletRadius = (S: JxSeg, X: JxSeg): number =>
  Math.max(4, Math.min(14, 0.22 * Math.min(S.obj.height || 40, X.obj.height || 40)));

/** S'in (ep başlangıçlı, uS yönlü) çizgisinin X gövdesi içinde kaldığı t aralığı.
 *  Uçlar bant (kenar çizgisi) sınırından mı, X'in boyu sınırından mı gelir bildirir. */
const jxBodyInterval = (ep: JxPt, uS: JxPt, X: JxSeg) => {
  const nX = jxPerp(X.u);
  const c0 = (ep.x - X.p0.x) * nX.x + (ep.y - X.p0.y) * nX.y;
  const cu = uS.x * nX.x + uS.y * nX.y;
  const s0 = (ep.x - X.p0.x) * X.u.x + (ep.y - X.p0.y) * X.u.y;
  const su = uS.x * X.u.x + uS.y * X.u.y;
  const lim = X.wh + X.e / 2;
  let a = -Infinity, b = Infinity, aBand = false, bBand = false;
  if (Math.abs(cu) < 1e-9) {
    if (Math.abs(c0) > lim) return null;
  } else {
    const ta = (-lim - c0) / cu, tb = (lim - c0) / cu;
    a = Math.min(ta, tb); b = Math.max(ta, tb); aBand = true; bBand = true;
  }
  if (Math.abs(su) < 1e-9) {
    if (s0 < -1e-6 || s0 > X.len + 1e-6) return null;
  } else {
    const sa = (0 - s0) / su, sb = (X.len - s0) / su;
    const lo = Math.min(sa, sb), hi = Math.max(sa, sb);
    if (lo > a) { a = lo; aBand = false; }
    if (hi < b) { b = hi; bBand = false; }
  }
  if (b <= a) return null;
  return { a, b, aBand, bBand };
};

/** PORT-PORT BİRLEŞME — TEMİZ DEVAM (balgun/daire YOK — st-2 görünümü).
 *  Portlar çakışık/açık yakınsa ve yollar karşı karşıya (düz devam) ise yalnızca
 *  portlar arasındaki olası boşluk/ek yeri beyaz yamayla kapatılır ve kenar
 *  çizgileri boşluk boyunca DOLU SİYAH köprülerle uzatılır. Kesikli orta
 *  çizgilere dokunulmaz; fazlar kendi doğal düzeniyle buluşur. Açılı
 *  birleşmeler overlap motoruna (fillet ağızları) bırakılır. */
const jxPortGapOps = (A: JxSeg, B: JxSeg, portA: 0 | 1, portB: 0 | 1): JxOp[] => {
  const pa = portA === 0 ? A.p0 : A.p1;
  const pb = portB === 0 ? B.p0 : B.p1;
  const sgnA = portA === 0 ? 1 : -1;
  const uA = { x: A.u.x * sgnA, y: A.u.y * sgnA }; // A gövdesine doğru
  const dx = pb.x - pa.x, dy = pb.y - pa.y;
  const axial = dx * uA.x + dy * uA.y;             // pb'nin eksen konumu (negatif = A'nın arkasında boşluk)
  const lateral = Math.abs(-dx * uA.y + dy * uA.x);
  const eM = Math.max(A.e, B.e);
  if (axial >= -0.75 || lateral > eM + 2) return []; // çakışık/çakışma veya yanal kayma → yama gereksiz
  const gap = -axial;
  const W = Math.max(A.obj.height || 40, B.obj.height || 40);
  const rot = (Math.atan2(uA.y, uA.x) * 180) / Math.PI;
  const ops: JxOp[] = [
    // boşluk şeridi yaması: iki gövde arasındaki boşluğu tam gövde genişliğinde kapat
    { op: 'fr', x: pb.x, y: pb.y, w: gap + 3, h: W + 2 * eM + 1, rot },
  ];
  // kenar köprüleri: her iki yolun kenar çizgilerini boşluk boyunca DOLU SİYAH uzat
  const nA = jxPerp(uA);
  for (const S of [A, B] as const) {
    for (const sd of [-1, 1]) {
      const ox = nA.x * sd * (S.wh + S.e / 2), oy = nA.y * sd * (S.wh + S.e / 2);
      ops.push({
        op: 'lnk',
        x1: pb.x - uA.x * 2 + ox, y1: pb.y - uA.y * 2 + oy,
        x2: pb.x + uA.x * (gap + 4) + ox, y2: pb.y + uA.y * (gap + 4) + oy,
        w: eM,
      });
    }
  }
  return ops;
};

/** GÖVDE ÇAKIŞMASI — S'in kenar/orta çizgilerini X'in gövdesi içinde keser;
 *  bant sınırlı uçlarda köşeleri fillet yaylarıyla yuvarlatır. Hem X kesişmesi
 *  hem T ağzı hem kısmi bindirmeler bu tek rutinle çözülür. */
const jxOverlapOps = (S: JxSeg, X: JxSeg): JxOp[] => {
  if (Math.abs(jxCross(S.u, X.u)) < 0.25) return []; // yaklaşık paralel → dokunma
  const ops: JxOp[] = [];
  const nS = jxPerp(S.u);
  const nX = jxPerp(X.u);
  const f = jxFilletRadius(S, X);
  for (const sA of [-1, 0, 1] as const) {
    const isDash = sA === 0;
    const off = sA * (S.wh + S.e / 2);
    const ep = { x: S.p0.x + nS.x * off, y: S.p0.y + nS.y * off };
    const iv = jxBodyInterval(ep, S.u, X);
    if (!iv) continue;
    const a = Math.max(iv.a, 0), b = Math.min(iv.b, S.len);
    if (b - a < 0.5) continue;
    if (isDash) {
      // orta kesikli çizgiyi gövde içinde düz kes
      ops.push({ op: 'ln', x1: ep.x + S.u.x * a, y1: ep.y + S.u.y * a, x2: ep.x + S.u.x * b, y2: ep.y + S.u.y * b, w: S.e + 1 });
      continue;
    }
    let ea = a, eb = b;
    // bant sınırlı uçlarda fillet yayı + silmeyi teğet noktasına geri çek
    const ends = [
      { t: a, band: iv.aBand && iv.a >= -1e-6, first: true },
      { t: b, band: iv.bBand && iv.b <= S.len + 1e-6, first: false },
    ];
    for (const en of ends) {
      if (!en.band) continue;
      const C = { x: ep.x + S.u.x * en.t, y: ep.y + S.u.y * en.t };
      const perpAtC = (C.x - X.p0.x) * nX.x + (C.y - X.p0.y) * nX.y;
      const sideX = perpAtC >= 0 ? 1 : -1;
      const n1 = { x: -nS.x * sA, y: -nS.y * sA };
      const n2 = { x: -nX.x * sideX, y: -nX.y * sideX };
      const fl = jxFillet(C, S.u, n1, X.u, n2, f);
      if (!fl) continue;
      const tT = (fl.T1.x - ep.x) * S.u.x + (fl.T1.y - ep.y) * S.u.y;
      // DÜZELTME: teğet noktası artık köşenin DIŞINDA (korunan kenar tarafında).
      // Silgi teğet noktasına kadar UZATILIR → yay oradan kenara devreder.
      if (en.first) {
        if (tT >= b - 0.25 || a - tT > 3 * f + 4) continue;
        ea = tT;
      } else {
        if (tT <= a + 0.25 || tT - b > 3 * f + 4) continue;
        eb = tT;
      }
      ops.push({ op: 'arc', x1: fl.T1.x, y1: fl.T1.y, x2: fl.T2.x, y2: fl.T2.y, r: f, ref: C, w: Math.max(S.e, X.e) });
    }
    if (eb - ea > 0.25) {
      ops.push({ op: 'ln', x1: ep.x + S.u.x * ea, y1: ep.y + S.u.y * ea, x2: ep.x + S.u.x * eb, y2: ep.y + S.u.y * eb, w: S.e + 1 });
    }
  }
  return ops;
};

/** Bir yol için tüm birleşim op'larını üretir (ekran + export ortak). */
const computeRoadJunctionOps = (self: any, all: any[]): JxOp[] => {
  if (!self || !isRoadEngineSymbol(self.symbolId) || (self.curvature || 0) !== 0) return [];
  const A = jxSeg(self);
  if (A.len < 8) return [];
  const ops: JxOp[] = [];
  for (const other of (all || [])) {
    if (!other || other.id === self.id || other.hidden) continue;
    if (!isRoadEngineSymbol(other.symbolId) || (other.curvature || 0) !== 0) continue;
    const B = jxSeg(other);
    if (B.len < 8) continue;
    // 1) port-port yakınlık → düz devam birleşmesi: yalnız boşluk/ek yeri yaması
    //    (balgun/daire kaldırıldı — kenarlar artık kesintisiz düz devam eder).
    //    Açılı port birleşmeleri aşağıdaki overlap motorunda fillet ağızlarıyla çözülür.
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const pa = i === 0 ? A.p0 : A.p1;
        const pb = j === 0 ? B.p0 : B.p1;
        if (Math.hypot(pb.x - pa.x, pb.y - pa.y) <= ROAD_JUNCTION_TOL) {
          const sgnA = i === 0 ? 1 : -1, sgnB = j === 0 ? 1 : -1;
          const uAi = { x: A.u.x * sgnA, y: A.u.y * sgnA };
          const uBi = { x: B.u.x * sgnB, y: B.u.y * sgnB };
          if ((uAi.x * uBi.x + uAi.y * uBi.y) < -0.95) {
            ops.push(...jxPortGapOps(A, B, i as 0 | 1, j as 0 | 1));
          }
        }
      }
    }
    // 2) gövde çakışması (X kesişmesi / T ağzı / bindirme) → fillet geçişleri
    ops.push(...jxOverlapOps(A, B));
    ops.push(...jxOverlapOps(B, A));
  }
  return ops;
};

/** Canvas uzayındaki op'ları yolun LOKAL (grup) uzayına çevirir. */
const jxOpsToLocal = (ops: JxOp[], obj: any): JxOp[] => {
  const rot = ((obj.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(-rot), sin = Math.sin(-rot);
  const ox = obj.x || 0, oy = obj.y || 0;
  const tp = (x: number, y: number): JxPt => ({ x: (x - ox) * cos - (y - oy) * sin, y: (x - ox) * sin + (y - oy) * cos });
  const map = (op: JxOp): JxOp => {
    switch (op.op) {
      case 'clip': { const p = tp(op.cx, op.cy); return { ...op, cx: p.x, cy: p.y, ops: op.ops.map(map) }; }
      case 'fc': case 'sc': { const p = tp(op.cx, op.cy); return { ...op, cx: p.x, cy: p.y }; }
      case 'fr': { const p = tp(op.x, op.y); return { ...op, x: p.x, y: p.y, rot: op.rot - (obj.rotation || 0) }; }
      case 'ln': { const p1 = tp(op.x1, op.y1), p2 = tp(op.x2, op.y2); return { ...op, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }; }
      case 'lnk': { const p1 = tp(op.x1, op.y1), p2 = tp(op.x2, op.y2); return { ...op, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }; }
      case 'arc': { const p1 = tp(op.x1, op.y1), p2 = tp(op.x2, op.y2), rf = tp(op.ref.x, op.ref.y); return { ...op, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, ref: rf }; }
    }
  };
  return ops.map(map);
};

/** Op listesini canvas 2D bağlamına çizer (export — lokal uzayda). */
const jxDrawOpsCtx = (ctx: CanvasRenderingContext2D, ops: JxOp[]) => {
  for (const op of ops) {
    switch (op.op) {
      case 'clip':
        ctx.save(); ctx.beginPath(); ctx.arc(op.cx, op.cy, op.r, 0, Math.PI * 2); ctx.clip();
        jxDrawOpsCtx(ctx, op.ops);
        ctx.restore();
        break;
      case 'fc':
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(op.cx, op.cy, op.r, 0, Math.PI * 2); ctx.fill();
        break;
      case 'sc':
        ctx.strokeStyle = '#000000'; ctx.lineWidth = op.w; ctx.beginPath(); ctx.arc(op.cx, op.cy, op.r, 0, Math.PI * 2); ctx.stroke();
        break;
      case 'fr':
        ctx.save(); ctx.translate(op.x, op.y); ctx.rotate((op.rot * Math.PI) / 180);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, -op.h / 2, op.w, op.h);
        ctx.restore();
        break;
      case 'ln':
        ctx.lineCap = 'butt';
        if (op.dash) { ctx.strokeStyle = '#000000'; ctx.setLineDash([20, 20]); } else { ctx.strokeStyle = '#ffffff'; }
        ctx.lineWidth = op.w;
        ctx.beginPath(); ctx.moveTo(op.x1, op.y1); ctx.lineTo(op.x2, op.y2); ctx.stroke();
        if (op.dash) ctx.setLineDash([]);
        break;
      case 'lnk':
        ctx.lineCap = 'butt';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = op.w;
        ctx.beginPath(); ctx.moveTo(op.x1, op.y1); ctx.lineTo(op.x2, op.y2); ctx.stroke();
        break;
      case 'arc': {
        const d = jxArcPath({ x: op.x1, y: op.y1 }, { x: op.x2, y: op.y2 }, op.r, op.ref);
        if (d) { ctx.strokeStyle = '#000000'; ctx.lineWidth = op.w; ctx.lineCap = 'butt'; ctx.stroke(new Path2D(d)); }
        break;
      }
    }
  }
};

/** Op listesini Konva elemanlarına çevirir (ekran — lokal uzayda). */
const jxRenderKonva = (ops: JxOp[]): any[] =>
  ops.map((op, i) => {
    switch (op.op) {
      case 'clip':
        return (
          <Group
            key={`jxc-${i}`}
            clipFunc={(ctx: any) => {
              ctx.beginPath();
              ctx.arc(op.cx, op.cy, op.r, 0, Math.PI * 2);
              ctx.clip();
            }}
            listening={false}
          >
            {jxRenderKonva(op.ops)}
          </Group>
        );
      case 'fc':
        return <Circle key={`jxf-${i}`} x={op.cx} y={op.cy} radius={op.r} fill="#ffffff" listening={false} perfectDrawEnabled={false} />;
      case 'sc':
        return <Circle key={`jxs-${i}`} x={op.cx} y={op.cy} radius={op.r} stroke="#000000" strokeWidth={op.w} listening={false} perfectDrawEnabled={false} />;
      case 'fr':
        return <Rect key={`jxr-${i}`} x={op.x} y={op.y} width={op.w} height={op.h} offsetX={0} offsetY={op.h / 2} rotation={op.rot} fill="#ffffff" listening={false} perfectDrawEnabled={false} />;
      case 'ln':
        return op.dash ? (
          <Line key={`jxd-${i}`} points={[op.x1, op.y1, op.x2, op.y2]} stroke="#000000" strokeWidth={op.w} dash={[20, 20]} lineCap="butt" listening={false} perfectDrawEnabled={false} />
        ) : (
          <Line key={`jxe-${i}`} points={[op.x1, op.y1, op.x2, op.y2]} stroke="#ffffff" strokeWidth={op.w} lineCap="butt" listening={false} perfectDrawEnabled={false} />
        );
      case 'lnk':
        return <Line key={`jxk-${i}`} points={[op.x1, op.y1, op.x2, op.y2]} stroke="#000000" strokeWidth={op.w} lineCap="butt" listening={false} perfectDrawEnabled={false} />;
      case 'arc': {
        const d = jxArcPath({ x: op.x1, y: op.y1 }, { x: op.x2, y: op.y2 }, op.r, op.ref);
        if (!d) return null;
        return <Path key={`jxa-${i}`} data={d} stroke="#000000" strokeWidth={op.w} lineCap="butt" listening={false} />;
      }
    }
  });

const wrapTextByWidth = (text: string, fontSize: number, maxWidth: number): string[] => {
  const out: string[] = [];
  const charW = fontSize * 0.58;
  text.split('\n').forEach((paragraph) => {
    let line = '';
    paragraph.split(' ').forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length * charW > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    out.push(line);
  });
  return out;
};

// UZATMA MOTORU — görsel semboller esnetilirken desen tekrarıyla çizilir (bozulma olmaz).
// Mod çözümlemesi: obj.tileMode (özellik çubuğundan açık seçim) → kütüphane metadata'sı → esnetme.
// (Kaynak PNG'ler tekrarlanabilir üretildi; ekran + export aynı motoru kullanır.)

// st-3 Y KAVŞAK — siyah yol kenar segmentleri (ekran + export ortak geometrisi).
// 6 kenar döndürür: gövdenin iki kenarı + iki dalın dörder kenarının birleşimi.
// Kenarlar birleşim bölgelerinde fillet noktalarında buluşur (klasik kroki görünümü);
// dal kenarları hub çemberine teğettir, fillet noktaları daima çemberin dışında kalır.
const st3EdgeSegments = (w: number, h: number, roadWidth: number): number[][] => {
  const cx = w / 2, cy = h / 2, s = roadWidth / 2;
  const Ld = Math.sqrt(cx * cx + cy * cy); // merkez→köşe yarısı uzunluğu
  if (!Ld || !cx) return [];
  const yFc = Math.min(s * cx / Ld + ((Ld * (cx - s) + s * cy) * cy) / (cx * Ld), h); // gövde fillet Y (clamp'li)
  // Dal uçlarındaki kenar başlangıç noktaları (köşe dışına taşar, canvas kırpılır)
  const A1x = -s * cy / Ld, A1y = s * cx / Ld;    // sol dal gövde-arası kenar ucu
  const A2x = w + s * cy / Ld, A2y = s * cx / Ld; // sağ dal gövde-arası kenar ucu
  const B1x = s * cy / Ld, B1y = -s * cx / Ld;    // sol dal V çanağı kenar ucu
  const B2x = w - s * cy / Ld, B2y = -s * cx / Ld;// sağ dal V çanağı kenar ucu
  // V çanağı filleti: iki dalın çanak kenarlarının kesişimi
  const t3 = (w * Ld - 2 * s * cy) / (2 * cx);
  const F3x = s * cy / Ld + t3 * cx / Ld;
  const F3y = -s * cx / Ld + t3 * cy / Ld;
  return [
    [cx - s, h, cx - s, yFc],       // gövde sol kenarı
    [cx + s, h, cx + s, yFc],       // gövde sağ kenarı
    [A1x, A1y, cx - s, yFc],        // sol dalın gövdeye bakan kenarı
    [A2x, A2y, cx + s, yFc],        // sağ dalın gövdeye bakan kenarı
    [B1x, B1y, F3x, F3y],           // sol dalın çanak kenarı
    [B2x, B2y, F3x, F3y],           // sağ dalın çanak kenarı
  ];
};

// st-2 T KAVŞAK / st-4 ARTI KAVŞAK — ortak kenar geometrisi (ekran + export).
// Merkez halka/hub YOK; yol kenarları kavşak ağızlarında YUMUŞAK KAVİS
// (fillet) yaylarıyla birleşir. Kavisler SVG yay komutuyla ('M … A …') ifade
// edilir: hem Konva <Path> hem Path2D aynı metni çizer → birebir uyum.
//  - fills  : fillet bölgelerini gövdeye katan beyaz köşe yamaları
//  - edges  : siyah düz kenar segmentleri (uçları teğet noktalarında)
//  - arcPaths: fillet yayları (sweep=1, çeyrek çember)
//  - dashes : kavşak ağzında kesilen kesikli orta çizgiler
interface JunctionGeom {
  fills: number[][];
  edges: number[][];
  arcPaths: string[];
  dashes: number[][];
}

const st4JunctionGeometry = (w: number, h: number, roadWidth: number): JunctionGeom => {
  const cx = w / 2, cy = h / 2, s = roadWidth / 2, f = roadWidth * 0.35;
  const A = (x1: number, y1: number, x2: number, y2: number) => `M ${x1} ${y1} A ${f} ${f} 0 0 1 ${x2} ${y2}`;
  return {
    fills: [
      [cx - s - f, cy - s - f, f, f], [cx + s, cy - s - f, f, f],
      [cx - s - f, cy + s, f, f], [cx + s, cy + s, f, f],
    ],
    edges: [
      [cx - s, 0, cx - s, cy - s - f], [cx - s, cy + s + f, cx - s, h],
      [cx + s, 0, cx + s, cy - s - f], [cx + s, cy + s + f, cx + s, h],
      [0, cy - s, cx - s - f, cy - s], [cx + s + f, cy - s, w, cy - s],
      [0, cy + s, cx - s - f, cy + s], [cx + s + f, cy + s, w, cy + s],
    ],
    arcPaths: [
      A(cx - s, cy - s - f, cx - s - f, cy - s), // sol üst
      A(cx + s + f, cy - s, cx + s, cy - s - f), // sağ üst
      A(cx - s - f, cy + s, cx - s, cy + s + f), // sol alt
      A(cx + s, cy + s + f, cx + s + f, cy + s), // sağ alt
    ],
    dashes: [
      [cx, 0, cx, cy - s], [cx, cy + s, cx, h],
      [0, cy, cx - s, cy], [cx + s, cy, w, cy],
    ],
  };
};

const st2JunctionGeometry = (w: number, h: number, roadWidth: number): JunctionGeom => {
  const cx = w / 2, cy = h / 2, s = roadWidth / 2, f = roadWidth * 0.35;
  const A = (x1: number, y1: number, x2: number, y2: number) => `M ${x1} ${y1} A ${f} ${f} 0 0 1 ${x2} ${y2}`;
  return {
    fills: [
      [cx - s - f, cy + s, f, f], [cx + s, cy + s, f, f],
    ],
    edges: [
      [0, cy - s, w, cy - s],              // üst kenar (tam genişlik)
      [0, cy + s, cx - s - f, cy + s],     // alt kenar sol
      [cx + s + f, cy + s, w, cy + s],     // alt kenar sağ
      [cx - s, h, cx - s, cy + s + f],     // gövde sol
      [cx + s, h, cx + s, cy + s + f],     // gövde sağ
    ],
    arcPaths: [
      A(cx - s - f, cy + s, cx - s, cy + s + f), // sol alt fillet
      A(cx + s, cy + s + f, cx + s + f, cy + s), // sağ alt fillet
    ],
    dashes: [
      [0, cy, cx - s, cy], [cx + s, cy, w, cy], // yatay orta (gövde ağzında kesilir)
      [cx, cy, cx, h],                          // gövde orta çizgisi
    ],
  };
};

/* =====================================================================================
 * MİMARİ EK SEMBOLLER MOTORU (kepenk, sürgülü kapı, asansör, geçit, parapet, kolon,
 * bahçe duvarı/kapısı, balkon, havuz, kuyu, bina kesiti)
 * Tümü prosedürel çizilir: sarı/görsel dokuya düşmez, uzatınca desen boyuta göre
 * yeniden hesaplanır → görünüm bozulmaz. Ekran (ExtraArchShapes) ve export
 * (drawExtraArch) aynı geometriyi paylaşır.
 * ===================================================================================== */
const EXTRA_ARCH_IDS = [
  'arch-kepenk', 'arch-d3-slide', 'arch-elevator', 'arch-opening', 'arch-parapet',
  'arch-colon-k', 'arch-colon-y', 'arch-garden-wall', 'arch-garden-gate',
  'arch-balcony', 'arch-pool', 'arch-well', 'arch-bsection',
];
/** Kapı/pencere gibi duvara hizalanan semboller (sürükleme sırasında rotasyon duvara uyar) */
const DOORLIKE_SNAP_IDS = ['arch-d1r', 'arch-d1l', 'arch-win', 'arch-d2', 'arch-d3-slide', 'arch-garden-gate', 'arch-kepenk', 'arch-opening'];
/** Duvar gibi uç uca yapışan semboller */
const WALLLIKE_IDS = ['arch-w1', 'arch-w1v', 'arch-w1i', 'arch-w1vi', 'arch-w-square', 'arch-garden-wall', 'arch-parapet'];

/** Export (ctx) tarafı — ekrandaki ExtraArchShapes ile birebir aynı geometri. */
const drawExtraArch = (ctx: CanvasRenderingContext2D, symbolId: string, w: number, h: number): boolean => {
  switch (symbolId) {
    case 'arch-kepenk': {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, w, h);
      ctx.lineWidth = 1;
      for (let x = 6; x < w; x += 6) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      return true;
    }
    case 'arch-d3-slide': {
      const ph = Math.max(3, h * 0.42);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, 0, w * 0.55, ph);
      ctx.strokeRect(0, 0, w * 0.55, ph);
      ctx.fillRect(w * 0.45, h - ph, w * 0.55, ph);
      ctx.strokeRect(w * 0.45, h - ph, w * 0.55, ph);
      return true;
    }
    case 'arch-elevator': {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(0, h); ctx.stroke();
      return true;
    }
    case 'arch-opening': {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(0, 0, w, h);
      ctx.setLineDash([]);
      return true;
    }
    case 'arch-parapet': {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
      ctx.setLineDash([]);
      return true;
    }
    case 'arch-colon-k': {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      return true;
    }
    case 'arch-colon-y': {
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      return true;
    }
    case 'arch-garden-wall': {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);
      return true;
    }
    case 'arch-garden-gate': {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, h * 0.85, w, h * 0.15);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(5, h * 0.85); ctx.lineTo(5, h * 0.1); ctx.stroke();
      ctx.lineWidth = 1.5;
      for (const y of [h * 0.33, h * 0.55, h * 0.77]) {
        ctx.beginPath(); ctx.moveTo(1.5, y); ctx.lineTo(8.5, y); ctx.stroke();
      }
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(5, h * 0.85, h * 0.75, -Math.PI / 2, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      return true;
    }
    case 'arch-balcony': {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, h); ctx.lineTo(w, h); ctx.lineTo(w, 0);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.stroke();
      ctx.setLineDash([]);
      for (let x = 10; x <= w - 5; x += 10) {
        ctx.beginPath(); ctx.moveTo(x, h - 5); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 10; y <= h - 5; y += 10) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(5, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(w - 5, y); ctx.lineTo(w, y); ctx.stroke();
      }
      return true;
    }
    case 'arch-pool': {
      const rr = Math.min(10, h * 0.15);
      ctx.beginPath();
      ctx.moveTo(1.5 + rr, 1.5);
      ctx.arcTo(1.5 + (w - 3), 1.5, 1.5 + (w - 3), 1.5 + (h - 3), rr);
      ctx.arcTo(1.5 + (w - 3), 1.5 + (h - 3), 1.5, 1.5 + (h - 3), rr);
      ctx.arcTo(1.5, 1.5 + (h - 3), 1.5, 1.5, rr);
      ctx.arcTo(1.5, 1.5, 1.5 + (w - 3), 1.5, rr);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.lineWidth = 1.2;
      const x0 = w * 0.1;
      const qw = (w * 0.8) / 4;
      const amp = h * 0.05;
      for (let i = 1; i <= 3; i++) {
        const y = (h * i) / 4;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        for (let s = 0; s < 4; s++) {
          const sgn = s % 2 === 0 ? -1 : 1;
          ctx.quadraticCurveTo(x0 + qw * (s + 0.5), y + sgn * amp, x0 + qw * (s + 1), y);
        }
        ctx.stroke();
      }
      return true;
    }
    case 'arch-well': {
      const rx = w / 2;
      const ry = h / 2;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(rx, ry, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const irx = rx * 0.6;
      const iry = ry * 0.6;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(rx, ry, irx, iry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(rx - irx, ry - iry); ctx.lineTo(rx + irx, ry + iry); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rx + irx, ry - iry); ctx.lineTo(rx - irx, ry + iry); ctx.stroke();
      return true;
    }
    case 'arch-bsection': {
      const floors = Math.max(2, Math.round(h / 40));
      const slabH = Math.max(2, h * 0.025);
      const groundH = Math.max(3, h * 0.03);
      ctx.fillStyle = '#000';
      for (let i = 0; i < floors; i++) {
        ctx.fillRect(0, (i * h) / floors, w, slabH);
      }
      ctx.fillRect(0, h - groundH, w, groundH);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, w, h);
      return true;
    }
    default:
      return false;
  }
};

/** Ekran (Konva) tarafı — drawExtraArch ile birebir aynı geometri. */
const ExtraArchShapes = ({ symbolId, width: w, height: h }: { symbolId: string; width: number; height: number }) => {
  switch (symbolId) {
    case 'arch-kepenk':
      return (
        <Group>
          <Rect width={w} height={h} stroke="#000" strokeWidth={2} />
          {Array.from({ length: Math.max(0, Math.ceil((w - 6) / 6)) }).map((_, i) => (
            <Line key={i} points={[6 + i * 6, 0, 6 + i * 6, h]} stroke="#000" strokeWidth={1} />
          ))}
        </Group>
      );
    case 'arch-d3-slide': {
      const ph = Math.max(3, h * 0.42);
      return (
        <Group>
          <Rect width={w * 0.55} height={ph} fill="#fff" stroke="#000" strokeWidth={1.5} />
          <Rect x={w * 0.45} y={h - ph} width={w * 0.55} height={ph} fill="#fff" stroke="#000" strokeWidth={1.5} />
        </Group>
      );
    }
    case 'arch-elevator':
      return (
        <Group>
          <Rect width={w} height={h} fill="#fff" stroke="#000" strokeWidth={2} />
          <Line points={[0, 0, w, h]} stroke="#000" strokeWidth={1.5} />
          <Line points={[w, 0, 0, h]} stroke="#000" strokeWidth={1.5} />
        </Group>
      );
    case 'arch-opening':
      return <Rect width={w} height={h} stroke="#000" strokeWidth={1.5} dash={[5, 4]} />;
    case 'arch-parapet':
      return (
        <Group>
          <Rect width={w} height={h} fill="#fff" stroke="#000" strokeWidth={1.5} />
          <Line points={[0, h / 2, w, h / 2]} stroke="#000" strokeWidth={1} dash={[6, 4]} />
        </Group>
      );
    case 'arch-colon-k':
      return <Rect width={w} height={h} fill="#000" />;
    case 'arch-colon-y':
      return <Ellipse x={w / 2} y={h / 2} radiusX={w / 2} radiusY={h / 2} fill="#000" />;
    case 'arch-garden-wall':
      return <Rect width={w} height={h} fill="#fff" stroke="#000" strokeWidth={1.5} />;
    case 'arch-garden-gate':
      return (
        <Group>
          <Rect y={h * 0.85} width={w} height={h * 0.15} fill="#fff" />
          <Line points={[5, h * 0.85, 5, h * 0.1]} stroke="#000" strokeWidth={3} />
          {[0.33, 0.55, 0.77].map((f, i) => (
            <Line key={i} points={[1.5, h * f, 8.5, h * f]} stroke="#000" strokeWidth={1.5} />
          ))}
          <Path
            data={`M 5 ${h * 0.1} A ${h * 0.75} ${h * 0.75} 0 0 1 ${5 + h * 0.75} ${h * 0.85}`}
            stroke="#000"
            strokeWidth={1}
            dash={[5, 4]}
            fill="none"
          />
        </Group>
      );
    case 'arch-balcony':
      return (
        <Group>
          <Path data={`M 0 0 L 0 ${h} L ${w} ${h} L ${w} 0`} stroke="#000" strokeWidth={1.5} fill="none" />
          <Line points={[0, 0, w, 0]} stroke="#000" strokeWidth={1.5} dash={[5, 4]} />
          {Array.from({ length: Math.max(0, Math.floor((w - 15) / 10) + 1) }).map((_, i) => (
            <Line key={`b-${i}`} points={[10 + i * 10, h - 5, 10 + i * 10, h]} stroke="#000" strokeWidth={1} />
          ))}
          {Array.from({ length: Math.max(0, Math.floor((h - 15) / 10) + 1) }).map((_, i) => (
            <Group key={`s-${i}`}>
              <Line points={[0, 10 + i * 10, 5, 10 + i * 10]} stroke="#000" strokeWidth={1} />
              <Line points={[w - 5, 10 + i * 10, w, 10 + i * 10]} stroke="#000" strokeWidth={1} />
            </Group>
          ))}
        </Group>
      );
    case 'arch-pool': {
      const waveData = (y: number) => {
        const x0 = w * 0.1;
        const qw = (w * 0.8) / 4;
        const amp = h * 0.05;
        let d = `M ${x0} ${y}`;
        for (let s = 0; s < 4; s++) {
          const sgn = s % 2 === 0 ? -1 : 1;
          d += ` Q ${x0 + qw * (s + 0.5)} ${y + sgn * amp}, ${x0 + qw * (s + 1)} ${y}`;
        }
        return d;
      };
      return (
        <Group>
          <Rect x={1.5} y={1.5} width={Math.max(1, w - 3)} height={Math.max(1, h - 3)} cornerRadius={Math.min(10, h * 0.15)} fill="#fff" stroke="#000" strokeWidth={2} />
          {[1, 2, 3].map((i) => (
            <Path key={i} data={waveData((h * i) / 4)} stroke="#000" strokeWidth={1.2} fill="none" />
          ))}
        </Group>
      );
    }
    case 'arch-well': {
      const rx = w / 2;
      const ry = h / 2;
      const irx = rx * 0.6;
      const iry = ry * 0.6;
      return (
        <Group>
          <Ellipse x={rx} y={ry} radiusX={rx} radiusY={ry} fill="#fff" stroke="#000" strokeWidth={2} />
          <Ellipse x={rx} y={ry} radiusX={irx} radiusY={iry} stroke="#000" strokeWidth={1.5} />
          <Line points={[rx - irx, ry - iry, rx + irx, ry + iry]} stroke="#000" strokeWidth={1.2} />
          <Line points={[rx + irx, ry - iry, rx - irx, ry + iry]} stroke="#000" strokeWidth={1.2} />
        </Group>
      );
    }
    case 'arch-bsection': {
      const floors = Math.max(2, Math.round(h / 40));
      const slabH = Math.max(2, h * 0.025);
      const groundH = Math.max(3, h * 0.03);
      return (
        <Group>
          {Array.from({ length: floors }).map((_, i) => (
            <Rect key={i} y={(i * h) / floors} width={w} height={slabH} fill="#000" />
          ))}
          <Rect y={h - groundH} width={w} height={groundH} fill="#000" />
          <Rect width={w} height={h} stroke="#000" strokeWidth={2} />
        </Group>
      );
    }
    default:
      return null;
  }
};

export const drawExportObject = (ctx: CanvasRenderingContext2D, obj: any, img: HTMLImageElement | null, sceneObjects: any[]) => {
  const w = obj.width ?? 50;
  const h = obj.height ?? 50;
  const symbolId: string = obj.symbolId || '';

  // 1) ev-callout — dinamik balon (ekrandaki Path + Text ile aynı geometri)
  //    Kullanıcı isteği: kenar/köşe tutamağıyla balon büyütülüp küçültüldüğünde
  //    ÇERÇEVESİ genişler/daralır; punto sabit kalır, metin yeniden sarılır → bozulma yok.
  //    Efektif boyut = max(otomatik metin sığma boyutu, nesnenin width/height'ı).
  if (symbolId === 'ev-callout') {
    const text = String(obj.distance || '');
    const fontSize = obj.distanceFontSize || 14;
    const auto = calculateCalloutSize(text, fontSize);
    const cw = Math.max(auto.w, obj.width || 0);
    const ch = Math.max(auto.h, obj.height || 0);
    const r = 4;
    const tailH = ch * 0.25;
    const boxH = ch - tailH;
    const tailW = Math.min(cw * 0.2, 20);
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(cw - r, 0); ctx.arcTo(cw, 0, cw, r, r);
    ctx.lineTo(cw, boxH - r); ctx.arcTo(cw, boxH, cw - r, boxH, r);
    ctx.lineTo(r + tailW * 1.5, boxH);
    ctx.lineTo(r, ch);
    ctx.lineTo(r + tailW * 0.5, boxH);
    ctx.lineTo(r, boxH); ctx.arcTo(0, boxH, 0, boxH - r, r);
    ctx.lineTo(0, r); ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath();
    ctx.strokeStyle = obj.fill === 'transparent' || !obj.fill ? '#000000' : obj.fill;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    // Metin (kutu ortası)
    ctx.fillStyle = obj.distanceColor || '#000000';
    ctx.font = `bold ${fontSize}px Inter, Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    const lineH = fontSize * 1.1;
    const startY = boxH / 2 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((ln: string, i: number) => ctx.fillText(ln, cw / 2, startY + i * lineH));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    return;
  }

  // 2) ev-arrow-desc / ev-arrow-desc-ellipse — ok + çerçeve + çok satırlı metin
  if (symbolId === 'ev-arrow-desc' || symbolId === 'ev-arrow-desc-ellipse') {
    const mx = obj.markerX !== undefined ? obj.markerX : 0;
    const my = obj.markerY !== undefined ? obj.markerY : 0;
    const tx = obj.textX !== undefined ? obj.textX : 120;
    const ty = obj.textY !== undefined ? obj.textY : 0;
    const isEllipse = symbolId === 'ev-arrow-desc-ellipse';
    const text = String(obj.distance || '');
    const fontSize = obj.distanceFontSize || 12;

    const lines = text.split('\n');
    const charWidth = fontSize * 0.6;
    const padding = 12;
    const maxLineLength = Math.max(...lines.map((l: string) => l.length), 1);
    const autoW = maxLineLength * charWidth + padding * 2;
    const autoH = lines.length * (fontSize * 1.2) + padding * 2;
    const frameW = obj.frameWidth !== undefined ? obj.frameWidth : autoW;
    const frameH = obj.frameHeight !== undefined ? obj.frameHeight : autoH;

    const centerX = tx + frameW / 2;
    const centerY = ty + frameH / 2;
    const dx = mx - centerX;
    const dy = my - centerY;
    let ax = centerX;
    let ay = centerY;
    if (dx !== 0 || dy !== 0) {
      if (isEllipse) {
        const t = 1 / Math.sqrt((dx * dx) / ((frameW / 2) ** 2) + (dy * dy) / ((frameH / 2) ** 2));
        ax = centerX + dx * t;
        ay = centerY + dy * t;
      } else {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const sc = Math.min((frameW / 2) / (absDx || 1e-6), (frameH / 2) / (absDy || 1e-6));
        ax = centerX + dx * sc;
        ay = centerY + dy * sc;
      }
    }
    // Ok
    ctx.strokeStyle = obj.fill || '#000000';
    ctx.fillStyle = obj.fill || '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(mx, my); ctx.stroke();
    drawArrowHeadExport(ctx, ax, ay, mx, my, obj.arrowHead || 10);
    // Çerçeve
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    if (isEllipse) {
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, frameW / 2, frameH / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(tx, ty, frameW, frameH);
    }
    // Metin (dikey ortalanmış, satır kaydırma ile)
    const wrapped = wrapTextByWidth(text, fontSize, frameW - 8);
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${fontSize}px Inter, Arial`;
    ctx.textAlign = 'center';
    const lineH = fontSize * 1.2;
    const startY = ty + frameH / 2 - ((wrapped.length - 1) * lineH) / 2;
    wrapped.forEach((ln, i) => ctx.fillText(ln, centerX, startY + i * lineH));
    ctx.textAlign = 'left';
    return;
  }

  // 3) Bulgu Listesi tablosu (ekrandaki hesapla birebir)
  if (obj.type === 'finding-list') {
    const findings = (sceneObjects || [])
      .filter((o: any) => o.findingNo)
      .sort((a: any, b: any) => String(a.findingNo || '').localeCompare(String(b.findingNo || ''), undefined, { numeric: true }));

    // Ekrandaki davranışın aynısı: hiç bulgu yoksa liste tuvalde gizlenir;
    // PDF'te de boş kutu çizilmez (boş kutu kullanıcının bıraktığı izlenimi bozar).
    if (!findings.length) return;

    const textWidth = w - 16;
    const charWidth = 4.5;
    const prefixWidth = 54;
    const descWidth = textWidth - prefixWidth;
    const charsPerDescLine = descWidth / charWidth;

    let currentY = 0;
    const items: { prefix: string; descLines: string[]; y: number }[] = [];
    findings.forEach((f: any) => {
      const prefix = `Bulgu No. ${f.findingNo}:`;
      const desc = f.findingDesc || f.name || '';
      const nLines = Math.max(1, Math.ceil(desc.length / charsPerDescLine));
      items.push({ prefix, descLines: wrapTextByWidth(desc, 9, descWidth), y: currentY });
      currentY += nLines * 11 + 6;
    });
    const totalHeight = Math.max(100, currentY + 40);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(0, 0, w, totalHeight);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, totalHeight);

    ctx.fillStyle = '#000';
    ctx.font = 'bold 11px Inter, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BULGU LISTESI', w / 2, 15);
    ctx.textAlign = 'left';
    ctx.beginPath(); ctx.moveTo(5, 20); ctx.lineTo(w - 5, 20); ctx.stroke();

    items.forEach((it) => {
      ctx.font = 'bold 9px Inter, Arial';
      ctx.fillText(it.prefix, 8, 25 + it.y + 9);
      ctx.font = '9px Inter, Arial';
      it.descLines.forEach((ln, i) => ctx.fillText(ln, 8 + prefixWidth, 25 + it.y + 9 + i * 11));
    });
    return;
  }

  // 4) Ölçüm/yön okları — a-4, a-5, isDistanceArrow (iki yönlü uçlu)
  const isNativeArrow = obj.isDistanceArrow || symbolId === 'a-4' || symbolId === 'a-5';
  if (isNativeArrow) {
    const hasCoords = obj.startX !== undefined && obj.endX !== undefined;
    const pts = hasCoords
      ? [obj.startX - obj.x, obj.startY - obj.y, obj.endX - obj.x, obj.endY - obj.y]
      : [0, h / 2, w, h / 2];
    const isMeasurement = obj.isDistanceArrow || symbolId === 'a-4';
    ctx.strokeStyle = isMeasurement ? '#000000' : (obj.fill || obj.stroke || '#000000');
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = isMeasurement ? 5 : (obj.strokeWidth || 5);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); ctx.lineTo(pts[2], pts[3]); ctx.stroke();
    ctx.lineJoin = 'round';
    const arrowHeadLen = obj.arrowHead || 12; // resize'da orantılı büyüyen/küçülen baş
    // st-5 tarzı AÇIK chevron uçlar (içi dolu üçgen değil)
    drawArrowHeadExport(ctx, pts[0], pts[1], pts[2], pts[3], arrowHeadLen, true);
    if (isMeasurement) drawArrowHeadExport(ctx, pts[2], pts[3], pts[0], pts[1], arrowHeadLen, true);
    // MESAFE ETİKETİ: ok çizgisi erken return ile çıkmadan rakam da çizilmeli
    // (yoksa önizleme/PDF'te rakam görünmüyordu — kullanıcı raporu).
    drawDistanceLabelExport(ctx, obj, symbolId, w, h);
    return;
  }

  // 4b) DUVAR MOTORU — ekrandaki düz koyu çubuğun aynası. (Karakalem duvar PNG'si
  //     %92 şeffaf olduğundan drawImage ile basılırsa PDF/print'te duvar görünmez.)
  if (symbolId === 'arch-w1i' || symbolId === 'arch-w1vi') {
    ctx.fillStyle = '#2e2e2e';
    ctx.fillRect(0, 0, w, h);
    return;
  }

  // 4c) KAPI MOTORU — ekrandakiyle aynı: alt %15 beyaz açıklık bandı (duvarı keser)
  //     + kapı imajı kutuyu birebir doldurur (kaydırma yok → duvar çizgisiyle hizalı).
  if (symbolId === 'arch-d1r' || symbolId === 'arch-d1l' || symbolId === 'arch-d2') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, h * 0.85, w, h * 0.15);
    if (obj.src && img) ctx.drawImage(img, 0, 0, w, h);
    return;
  }

  // 4d) PENCERE MOTORU — ekrandakiyle aynı: beyaz zemin + çift kenar + sarı cam çizgisi.
  if (symbolId === 'arch-win') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 0.5); ctx.lineTo(w, 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h - 0.5); ctx.lineTo(w, h - 0.5); ctx.stroke();
    ctx.strokeStyle = obj.fill || '#F5C518';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    return;
  }

  // 4e) MERDİVEN MOTORU — ekrandaki Dynamic Stairs Engine'in birebir aynası.
  //     Prosedürel çizim: sarı SVG dokusuna düşmez (renk klasik siyah), basamak
  //     sayısı boyuta göre yeniden hesaplandığından uzatmada görünüm bozulmaz.
  if (['arch-6', 'arch-6-v4'].includes(symbolId)) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);
    ctx.strokeStyle = '#666666';
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(2, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w - 2, 0); ctx.lineTo(w - 2, h); ctx.stroke();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    for (let i = 0; i < Math.floor(h / 15); i++) {
      ctx.beginPath(); ctx.moveTo(0, (i + 1) * 15); ctx.lineTo(w, (i + 1) * 15); ctx.stroke();
    }
    return;
  }
  if (['arch-6l', 'arch-6l-v4'].includes(symbolId)) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(w - 40, h); ctx.lineTo(w - 40, 40); ctx.lineTo(0, 40);
    ctx.closePath(); ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 0; i < Math.floor((w - 40) / 15); i++) {
      ctx.beginPath(); ctx.moveTo((i + 1) * 15, 0); ctx.lineTo((i + 1) * 15, 40); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(w - 40, 0); ctx.lineTo(w, 40); ctx.stroke();
    for (let i = 0; i < Math.floor((h - 40) / 15); i++) {
      ctx.beginPath(); ctx.moveTo(w - 40, 40 + (i + 1) * 15); ctx.lineTo(w, 40 + (i + 1) * 15); ctx.stroke();
    }
    return;
  }
  if (['arch-6u', 'arch-6u-v4'].includes(symbolId)) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(35, 0); ctx.lineTo(35, h - 35); ctx.lineTo(w - 35, h - 35); ctx.lineTo(w - 35, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(0, h);
    ctx.closePath(); ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 0; i < Math.floor((h - 35) / 15); i++) {
      ctx.beginPath(); ctx.moveTo(0, (i + 1) * 15); ctx.lineTo(35, (i + 1) * 15); ctx.stroke();
    }
    for (let i = 0; i < Math.floor((h - 35) / 15); i++) {
      ctx.beginPath(); ctx.moveTo(w - 35, (i + 1) * 15); ctx.lineTo(w, (i + 1) * 15); ctx.stroke();
    }
    for (let i = 0; i < Math.floor((w - 70) / 20); i++) {
      ctx.beginPath(); ctx.moveTo(35 + (i + 1) * 20, h - 35); ctx.lineTo(35 + (i + 1) * 20, h); ctx.stroke();
    }
    return;
  }

  // 4e-2) KARE DUVAR (arch-w-square) — ekrandakiyle aynı (merdiven motoru grubunda
  //       strokeScaleEnabled={false} ile çizilir): kenar KALINLIĞI SABİT 10 birim.
  //       Dal yoktu → export SVG'yi drawImage ile esnetiyordu; SVG'nin iç stroke'u
  //       nesneyle oranlı büyüdüğünden bina PDF'te tuvaldekinin kat kat kalın
  //       çıkıyordu (kullanıcı raporu: PDF'te bina duvarları kalın).
  if (symbolId === 'arch-w-square') {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, w, h);
    return;
  }

  // 4f) MİMARİ EK SEMBOLLER MOTORU — ekranla birebir aynı prosedürel çizim.
  if (EXTRA_ARCH_IDS.includes(symbolId) && drawExtraArch(ctx, symbolId, w, h)) {
    return;
  }

  // 5) Bulgu işaretleyicileri — görsel çiziminden ÖNCE yakalanmalı (numaratörün
  //    karakalem PNG'si boş daire olduğundan drawImage'a düşerse sarı daire ve
  //    bulgu numarası çıktıda kaybolur).
  if (symbolId === 'ev-circle') {
    ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#F5C518'; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
    if (obj.findingNo) {
      ctx.font = `bold ${w * 0.4}px Arial`; ctx.fillStyle = '#000';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(obj.findingNo), w / 2, h / 2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    return;
  }
  if (symbolId === 'ev-square') {
    ctx.fillStyle = '#F5C518'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, w, h);
    if (obj.findingNo) {
      ctx.font = `bold ${w * 0.4}px Arial`; ctx.fillStyle = '#000';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(obj.findingNo), w / 2, h / 2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    return;
  }

  // 5e) UZATMA MOTORU v4 — desen tekrarı (ekrandaki fillPattern'in aynası).
  //     Metadata'lı kütüphane dokuları bütün-görsel tiling; metadata'sız yüklemelerde
  //     KAPAK+KESİT (3-slice): uçlar sabit, orta bant tekrar eder → parçalanma yok.
  //     st-1..st-4 vektör yol/kavşak motorlarında çizilir (aşağıda) — dokuya düşmez;
  //     aksi halde kayıtlı tileMode eski SVG dokusunu fayanslayıp siyah dikiş bırakır.
  //     st-cadde / st-sokak da aynı yol motorunda çizilir — doku motoruna düşmez.
  if (obj.src && img && symbolId !== 'st-1' && symbolId !== 'st-2' && symbolId !== 'st-3' && symbolId !== 'st-4' && !isRoadEngineSymbol(symbolId)) {
    const tex = getTextureInfo(img);
    const resolved = resolveConcreteTileMode(
      obj,
      w,
      h,
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      tex
    );
    if (resolved.mode !== 'stretch') {
      if (
        resolved.caps &&
        (resolved.mode === 'strip-x' || resolved.mode === 'strip-y') &&
        drawStripCaps(ctx, img, w, h, resolved.mode, tex)
      ) {
        return;
      }
      if (drawTiledImage(ctx, img, w, h, resolved.mode)) return;
    }
  }

  // 5f) YOL MOTORU (st-1 / st-cadde / st-sokak) — ekrandaki Bezier vektör yol
  //     motorunun aynası. Sabit [20,20] kesikli orta çizgi periyoduyla uzatma
  //     bozulması olmaz. st-cadde/st-sokak: orta çizgisiz + yol adı etiketli.
  //     Ek olarak: diğer yol motoru sembolleriyle uç uca gelen portlarda ELİPS
  //     BİRLEŞİM PEDİ çizilir (ekrandaki motorla aynı geometri → PDF birebir aynı).
  if (isRoadEngineSymbol(symbolId)) {
    const curv = obj.curvature || 0;
    const curvX = obj.curvatureX !== undefined ? obj.curvatureX : w / 2;
    const controlY = h / 2 + curv * 2;
    const p = new Path2D(`M 0 ${h / 2} Q ${curvX} ${controlY} ${w} ${h / 2}`);
    const e = Math.max(1.5, h / 20); // kenar kalınlığı — st-3/st-4 motoruyla aynı oran
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = h + 2 * e; // siyah taban → iki yanda e kalınlığında yol kenarı
    ctx.stroke(p);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = h;
    ctx.stroke(p);
    if (roadShowsMiddleLine(obj)) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = e;
      ctx.setLineDash([20, 20]);
      ctx.stroke(p);
      ctx.setLineDash([]);
    }
    // ── YOL BİRLEŞİM GEÇİŞLERİ (export) — yarım daire + fillet, ekranla birebir aynı ──
    jxDrawOpsCtx(ctx, jxOpsToLocal(computeRoadJunctionOps(obj, sceneObjects || []), obj));
    // ── CADDE/SOKAK ADI ETİKETİ (export) — ekranla birebir aynı konum/punto ──
    const sname = String(obj.streetName || '').trim();
    if (sname) {
      const sfs = roadNameFontSize(obj);
      ctx.fillStyle = obj.distanceColor || '#000000';
      ctx.font = `bold ${sfs}px ${obj.fontFamily || 'Inter'}, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sname, w / 2, h / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
    return;
  }

  // 5g) KAVŞAK MOTORU (st-2 T / st-3 Y / st-4 Artı) — ekrandaki vektör kavşak motorunun aynası
  if (symbolId === 'st-2' || symbolId === 'st-3' || symbolId === 'st-4') {
    const roadWidth = Math.min(w, h) * 0.35;
    const lineW = Math.max(1.5, roadWidth / 20);
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    };
    if (symbolId === 'st-2') {
      // T Kavşak motoru — ekrandakiyle aynı: gövdeler → fillet yamaları →
      // kesikli (gövde ağzında kesilir) → siyah kenarlar → yumuşak kavisler
      const g = st2JunctionGeometry(w, h, roadWidth);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, h / 2 - roadWidth / 2, w, roadWidth);
      ctx.fillRect(w / 2 - roadWidth / 2, h / 2 - roadWidth / 2, roadWidth, h - (h / 2 - roadWidth / 2));
      for (const fl of g.fills) ctx.fillRect(fl[0], fl[1], fl[2], fl[3]);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = lineW;
      ctx.setLineDash([20, 20]);
      ctx.lineCap = 'butt';
      for (const d of g.dashes) line(d[0], d[1], d[2], d[3]);
      ctx.setLineDash([]);
      for (const sg of g.edges) line(sg[0], sg[1], sg[2], sg[3]);
      for (const d of g.arcPaths) ctx.stroke(new Path2D(d));
      return;
    }
    if (symbolId === 'st-3') {
      // Y Kavşak — ekrandaki katman sırasıyla: gövde → hub → kesikli → SİYAH kenarlar
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = roadWidth;
      ctx.lineCap = 'butt';
      line(w / 2, h, w / 2, h / 2);
      ctx.lineCap = 'round';
      line(w / 2, h / 2, 0, 0);
      line(w / 2, h / 2, w, 0);
      ctx.beginPath(); ctx.arc(w / 2, h / 2, roadWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = lineW;
      ctx.setLineDash([20, 20]);
      line(w / 2, h, w / 2, h / 2);
      line(w / 2, h / 2, 0, 0);
      line(w / 2, h / 2, w, 0);
      ctx.setLineDash([]);
      // SİYAH yol kenarları — Konva motoruyla aynı ortak geometri (fillet birleşimli)
      ctx.lineCap = 'butt';
      ctx.lineWidth = lineW;
      ctx.globalAlpha = 1;
      for (const sg of st3EdgeSegments(w, h, roadWidth)) {
        ctx.beginPath(); ctx.moveTo(sg[0], sg[1]); ctx.lineTo(sg[2], sg[3]); ctx.stroke();
      }
      return;
    }
    // st-4 Artı kavşak — MERKEZ HALKA YOK; beyaz gövdeler → fillet yamaları →
    // kesikli (kavşak ağzında kesilir) → siyah kenarlar → yumuşak kavis filletler.
    // (Kullanıcı isteği: ortadaki yuvarlak daire kaldırıldı, birleşimlere kavis)
    const g4 = st4JunctionGeometry(w, h, roadWidth);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w / 2 - roadWidth / 2, 0, roadWidth, h);
    ctx.fillRect(0, h / 2 - roadWidth / 2, w, roadWidth);
    for (const fl of g4.fills) ctx.fillRect(fl[0], fl[1], fl[2], fl[3]);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = lineW;
    ctx.setLineDash([20, 20]);
    ctx.lineCap = 'butt';
    for (const d of g4.dashes) line(d[0], d[1], d[2], d[3]);
    ctx.setLineDash([]);
    for (const sg of g4.edges) line(sg[0], sg[1], sg[2], sg[3]);
    for (const d of g4.arcPaths) ctx.stroke(new Path2D(d));
    return;
  }

  // 6) Görsel tabanlı sembol/fotoğraf
  if (obj.src && img) {
    ctx.drawImage(img, 0, 0, w, h);
    return;
  }

  // 6) Dikdörtgen / çizgi / metin
  if (obj.type === 'rect') {
    ctx.fillStyle = obj.fill || 'transparent';
    ctx.strokeStyle = obj.stroke || 'black';
    ctx.lineWidth = obj.strokeWidth || 1;
    if (obj.fill && obj.fill !== 'transparent') ctx.fillRect(0, 0, w, h);
    ctx.strokeRect(0, 0, w, h);
    return;
  }
  if (obj.type === 'line') {
    ctx.strokeStyle = obj.fill || 'black';
    ctx.lineWidth = obj.strokeWidth || Math.min(w, h) || 1;
    if (obj.dash) ctx.setLineDash(obj.dash);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w > h ? w : 0, w > h ? 0 : h); ctx.stroke();
    ctx.setLineDash([]);
    return;
  }
  if (obj.type === 'text' || obj.type === 'template-text') {
    const fontSize = obj.fontSize || 12;
    ctx.font = `${obj.fontStyle || 'normal'} ${fontSize}px ${obj.fontFamily || 'Arial'}`;
    ctx.fillStyle = obj.fill || '#000';
    ctx.textAlign = (obj.align as CanvasTextAlign) || 'left';
    const textX = obj.align === 'right' ? w : (obj.align === 'center' ? w / 2 : 0);
    // EKRANLA AYNI SARIM: ekranda Konva Text wrap="word" + width ile kelime bazında
    // satır kaydırılır; export düz fillText çizdiği için uzun metinler PDF'te TEK
    // satır olarak taşıyordu (örn. bina adı duvarın dışına taşıyordu). Aynı kural:
    // kutu genişliğine göre kelime sarımı + tek kelime sığmazsa karakter kırılımı.
    const boxW = obj.width && obj.width > 0 ? obj.width : 0;
    const paragraphs = String(obj.text || '').split('\n');
    const lines: string[] = [];
    for (const para of paragraphs) {
      if (boxW <= 0) { lines.push(para); continue; }
      let cur = '';
      for (const word of para.split(' ')) {
        const cand = cur ? `${cur} ${word}` : word;
        if (ctx.measureText(cand).width <= boxW || !cur) {
          if (!cur && ctx.measureText(word).width > boxW) {
            // Tek kelime bile satıra sığmıyor → karakter bazında kır (Konva davranışı)
            let chunk = '';
            for (const ch of word) {
              if (chunk && ctx.measureText(chunk + ch).width > boxW) { lines.push(chunk); chunk = ch; }
              else chunk += ch;
            }
            cur = chunk;
          } else {
            cur = cand;
          }
        } else {
          lines.push(cur);
          cur = word;
        }
      }
      lines.push(cur);
    }
    // SATIR ARALIĞI + DİKEY YAZI KONUMU (ekrandaki Konva lineHeight/verticalAlign ile
    // aynı kural): satır ilerlemesi = punto × satır aralığı; blok kutu içinde üst/
    // orta/alta hizalanır. varsayılan (1 / üst) eski çıktıyla birebir aynıdır.
    const expLh = obj.lineHeight || 1;
    const expBoxH = obj.height && obj.height > 0 ? obj.height : 0;
    const expBlockH = lines.length * fontSize * expLh;
    const expVa = obj.vAlign || 'top';
    const vOffset = expBoxH > 0
      ? (expVa === 'bottom' ? expBoxH - expBlockH : expVa === 'middle' ? (expBoxH - expBlockH) / 2 : 0)
      : 0;
    lines.forEach((line: string, idx: number) => ctx.fillText(line, textX, vOffset + fontSize + idx * fontSize * expLh));
    ctx.textAlign = 'left';
    return;
  }

  // 7) Bulgu işaretleyicileri yukarıda (5. adım) ele alınıyor — drawImage'dan önce
  //    yakalanmazsa sarı daire yerine boş karakalem PNG basılıyordu.

  // 8) Mesafe/hız etiketi (ev-callout vb. hariç — ekrandaki kuralla aynı).
  // Çizim mantığı drawDistanceLabelExport'ta (ok dalıyla paylaşımlı — tek kaynak).
  const labelExcluded = ['ev-arrow-desc', 'ev-arrow-desc-ellipse', 'ev-callout', 'ev-shooting-trajectory'];
  if (obj.distance && !labelExcluded.includes(symbolId)) {
    drawDistanceLabelExport(ctx, obj, symbolId, w, h);
  }

  // 9) Bulgu numarası madalyonu (sembol üstünde küçük sarı rozet)
  if (obj.findingNo && !['ev-circle', 'ev-square', 'finding-list'].includes(symbolId)) {
    ctx.beginPath(); ctx.arc(w / 2, -15, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#F5C518'; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = 'bold 10px Inter, Arial';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(obj.findingNo), w / 2, -15);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
};

/** Döndürülmüş kutuyu sayfa sınırına göre orantılı kırpar (AABB taşma testi).
 *  Yerel kutunun 4 köşesi sayfa uzayına proje edilir; taşma varsa kutu orijin
 *  etrafında s oranıyla küçültülür. Döndürmemiş kutuda (0°) eski davranış birebir
 *  korunur (Sağ/Taşma = (P.w - x)/w). Manuel boyutlandırma motoru ile
 *  Transformer boundBoxFunc bu tek yardımcıyı paylaşır. */
function clampRotatedDims(
  x: number, y: number, w: number, h: number,
  rotationDeg: number, P: { w: number; h: number }
): { w: number; h: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const corners = [[0, 0], [w, 0], [0, h], [w, h]].map(([lx, ly]) => [
    x + lx * cos - ly * sin,
    y + lx * sin + ly * cos,
  ]);
  const minX = Math.min(...corners.map(c => c[0]));
  const maxX = Math.max(...corners.map(c => c[0]));
  const minY = Math.min(...corners.map(c => c[1]));
  const maxY = Math.max(...corners.map(c => c[1]));
  let s = 1;
  if (maxX > 0 && x < P.w && maxX > P.w - x) s = Math.min(s, (P.w - x) / maxX);
  if (minX < 0 && x > 0 && -minX > x) s = Math.min(s, x / -minX);
  if (maxY > 0 && y < P.h && maxY > P.h - y) s = Math.min(s, (P.h - y) / maxY);
  if (minY < 0 && y > 0 && -minY > y) s = Math.min(s, y / -minY);
  if (s < 1) return { w: Math.max(5, w * s), h: Math.max(5, h * s) };
  return { w, h };
}

/** MANÜEL DÖNDÜRMELİ BOYUTLANDIRMA ADIMI — mouse'un ham sayfa deltasını nesnenin
 *  YEREL eksenine çevirir, width/height/x/y'yi doğrudan yazar. Konva'nın
 *  Transformer delta zincirini tamamen bypass eder (frame kayması yok).
 *  - Kenar tutamaçlar tek ekseni, köşeler iki ekseni büyütür/küçültür.
 *  - Sol/üst tutamaçlarda orijin, sabit kalacak karşı kenar boyunca kaydırılır.
 *  - keepRatio'lu köşelerde iki eksen aynı faktörle ölçeklenir.
 *  - Sayfa sınırı clampRotatedDims ile (AABB) uygulanır. */
function manualResizeStep(tr: any, mr: any, evt: any) {
  const node = mr.node;
  const stage = mr.stage;
  stage.setPointersPositions(evt);
  const pp = stage.getPointerPosition();
  if (!pp) return;
  const dx = pp.x - mr.startPointer.x;
  const dy = pp.y - mr.startPointer.y;
  // Sayfa deltasını nesnenin yerel eksenine döndür (rotasyonu geri al)
  const ldx = dx * mr.cos + dy * mr.sin;
  const ldy = -dx * mr.sin + dy * mr.cos;
  const an: string = mr.anchorName || '';
  let w: number;
  let h: number;
  if (mr.isEdge || !mr.keepRatio) {
    const dw = an.includes('right') ? ldx : an.includes('left') ? -ldx : 0;
    const dh = an.includes('bottom') ? ldy : an.includes('top') ? -ldy : 0;
    w = Math.max(5, mr.start.w + dw);
    h = Math.max(5, mr.start.h + dh);
  } else {
    // Köşe + oran koruma: iki ekseni aynı faktörle ölçekle
    const dw = an.includes('right') ? ldx : an.includes('left') ? -ldx : 0;
    const dh = an.includes('bottom') ? ldy : an.includes('top') ? -ldy : 0;
    const f = Math.max(
      (mr.start.w + dw) / (mr.start.w || 1),
      (mr.start.h + dh) / (mr.start.h || 1),
      0.02
    );
    w = Math.max(5, mr.start.w * f);
    h = Math.max(5, mr.start.h * f);
  }
  // Sol/üst tutamaç: karşı kenar sabit kalsın → orijin yerel eksende kayar
  let ox = an.includes('left') ? mr.start.w - w : 0;
  let oy = an.includes('top') ? mr.start.h - h : 0;
  // Sayfa sınırı: taşan kutuyu orantılı kırp (AABB)
  const rawX = mr.start.x + (ox * mr.cos - oy * mr.sin);
  const rawY = mr.start.y + (ox * mr.sin + oy * mr.cos);
  const clamped = clampRotatedDims(rawX, rawY, w, h, mr.rotDeg, mr.paper);
  if (clamped.w !== w) { if (an.includes('left')) ox = mr.start.w - clamped.w; w = clamped.w; }
  if (clamped.h !== h) { if (an.includes('top')) oy = mr.start.h - clamped.h; h = clamped.h; }
  const px = mr.start.x + (ox * mr.cos - oy * mr.sin);
  const py = mr.start.y + (ox * mr.sin + oy * mr.cos);
  node.setAttrs({ width: w, height: h, x: px, y: py, scaleX: 1, scaleY: 1 });
  // Transformer çerçevesini gerçek kutuya tazele (anchor'lar mouse'u izler)
  try { tr._resetTransformCache?.(); } catch { /* yoksa önemsemiyoruz */ }
  try { tr.forceUpdate?.(); } catch { /* yoksa önemsemiyoruz */ }
  try { node.getLayer()?.batchDraw(); } catch { /* yoksa önemsemiyoruz */ }
}

const IndividualObject = ({ 
  shapeProps, 
  isSelected, 
  onSelect, 
  drawingArea, 
  onChange,
  isAdmin,
  allObjects,
  onDragMove,
  onDragEnd,
  onOpenDistanceModal,
  onMouseEnter,
  onMouseLeave,
  onTrajectoryUpdate,
  paperArea,
}: any) => {
  // ─── ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS (Rules of Hooks) ───
  const [showTooltip, setShowTooltip] = useState(false);
  const groupRef = useRef<any>(null);
  const imgRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const transformAnchorRef = useRef<string | null>(null);
  const manualResizeRef = useRef<any>(null);
  const image = useSmartImage(shapeProps?.src);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      // MANÜEL BOYUTLANDIRMA KÖPRÜSÜ (bir kez kurulur): Konva 10.2.5 Transformer'ın
      // delta matematiği DÖNDÜRÜLMÜŞ nesnelerde çerçeve kaymasına neden oluyor —
      // kutu mouse'u takip etmiyor, bırakınca en/boy bozuluyor (kullanıcı raporu:
      // döndürülmüş kaldırım uzatması tutamak bırakılınca siliniyor).
      // Köprü: döndürmeli sürükleme başladığında (__manualResizeState doluysa)
      // mouse hareketini KENDİ eksen matematiğimizle işleriz; eksen hizalı
      // nesnelerde Konva'nın sağlam akışı aynen çalışır.
      const tr: any = trRef.current;
      if (tr && !tr.__manualResizeInstalled) {
        tr.__manualResizeInstalled = true;
        const origMove = tr._handleMouseMove;
        const origUp = tr._handleMouseUp;
        // DİKKAT: window dinleyicisi çağırırken `this` = window olur (Konva
        // addEventListener'a instance metodunu verir); transformer'ı closure ile
        // yakala, `this`e asla güvenme.
        const trSelf: any = tr;
        tr._handleMouseMove = function (evt: any) {
          const mr = trSelf.__manualResizeState;
          if (mr) { manualResizeStep(trSelf, mr, evt); return; }
          origMove.call(trSelf, evt);
        };
        tr._handleMouseUp = function (evt: any) {
          const mr = trSelf.__manualResizeState;
          if (mr) {
            trSelf.__manualResizeState = null;
            // Orijinal up: window dinleyicilerini temizler + 'transformend' fırlatır
            // → react-konva onTransformEnd → handleTransformEnd (manualResizeRef hâlâ
            // set — commit node attr'larından okur). Flag'i commit'ten SONRA temizle!
            origUp.call(trSelf, evt);
            manualResizeRef.current = null;
            return;
          }
          origUp.call(trSelf, evt);
        };
      }
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  // Uzatma niyeti: hangi tutamaçla başladı? Kenar (orta) tutamaçlar tek ekseni
  // uzatır → yol/refüj/şerit dokularında "uzatma" eylemi budur.
  const handleTransformStart = () => {
    try {
      transformAnchorRef.current = trRef.current?.getActiveAnchor?.() || null;
    } catch {
      transformAnchorRef.current = null;
    }
    // DÖNDÜRMELİ NESNE → manuel boyutlandırma motorunu devreye al.
    // Eksen hizalı (0°/180°) nesnelerde Konva akışı kanıtlanmış şekilde sağlamdır.
    const node = groupRef.current;
    const tr: any = trRef.current;
    if (!node || !tr) return;
    const rotNorm = ((node.rotation() % 180) + 180) % 180;
    if (rotNorm < 0.5 || rotNorm > 179.5) return;
    const stage = node.getStage();
    if (!stage) return;
    const startPointer = stage.getPointerPosition();
    if (!startPointer) return;
    const anchorName = transformAnchorRef.current || '';
    if (!anchorName || anchorName === 'rotater') return;
    const rotDeg = node.rotation();
    const rad = (rotDeg * Math.PI) / 180;
    const startState = {
      x: node.x(),
      y: node.y(),
      w: node.width(),
      h: node.height(),
    };
    manualResizeRef.current = {
      active: true,
      start: startState,
      cos: Math.cos(rad),
      sin: Math.sin(rad),
    };
    tr.__manualResizeState = {
      node,
      stage,
      startPointer: { x: startPointer.x, y: startPointer.y },
      rotDeg,
      cos: Math.cos(rad),
      sin: Math.sin(rad),
      start: startState,
      anchorName,
      keepRatio: !!tr.keepRatio(),
      isEdge: anchorName === 'middle-left' || anchorName === 'middle-right' ||
              anchorName === 'top-center' || anchorName === 'bottom-center',
      paper: paperArea || { w: 1000, h: 1400 },
    };
  };

  useEffect(() => {
    if (imgRef.current && image) {
      try {
        imgRef.current.cache();
        imgRef.current.getLayer()?.batchDraw();
      } catch {
        // cache() failed (e.g. CORS). Image still renders without filters.
        try { imgRef.current.clearCache(); } catch { /* ignore */ }
        imgRef.current.getLayer()?.batchDraw();
      }
    }
  }, [image, shapeProps?.fill, shapeProps?.scaleX, shapeProps?.scaleY, shapeProps?.width, shapeProps?.height, shapeProps?.categoryId, shapeProps?.symbolId]);

  // Force redraw when visual properties change to ensure instant visual updates
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.getLayer()?.batchDraw();
    }
  }, [shapeProps.distance, shapeProps.distanceColor, shapeProps.distanceFontSize, shapeProps.fill, shapeProps.strokeWidth, shapeProps.opacity, shapeProps.text, shapeProps.width, shapeProps.height]);

  useEffect(() => {
    if (image && shapeProps.type === 'image' && !shapeProps.ratioFixed) {
      const isWallH = shapeProps.symbolId === 'arch-w1' || shapeProps.symbolId === 'arch-w1i';
      const isWallV = shapeProps.symbolId === 'arch-w1v' || shapeProps.symbolId === 'arch-w1vi';
      const isWindow = shapeProps.symbolId === 'arch-win';
      const ratio = image.width / image.height;
      
      let initialWidth, initialHeight;
      const maxSize = 120;

      if (isWallH) {
        initialWidth = 250;
        initialHeight = 10;
      } else if (isWallV) {
        initialWidth = 10;
        initialHeight = 250;
      } else if (isWindow) {
        // Pencereler için varsayılan: boy 50, en 10
        initialWidth = 50;
        initialHeight = 10;
      } else if (['arch-d1r', 'arch-d1l', 'arch-d2'].includes(shapeProps.symbolId || '')) {
        // Kapılar için standart başlangıç boyutu
        initialWidth = 60;
        initialHeight = 60;
      } else if (['arch-6', 'arch-6-v4', 'arch-6l', 'arch-6l-v4', 'arch-6u', 'arch-6u-v4'].includes(shapeProps.symbolId || '') || EXTRA_ARCH_IDS.includes(shapeProps.symbolId || '')) {
        // Prosedürel merdivenler ve mimari ek semboller: yerleştirme boyutu korunur —
        // motorlar boyuta göre çizildiğinden oran sabitlemeye gerek yoktur.
        initialWidth = shapeProps.width;
        initialHeight = shapeProps.height;
      } else {
        // Diğer tüm mimari ve sokak objeleri için (kapılar, merdivenler, binalar)
        // En geniş kenarı maxSize (120px) yap ve oranı koru
        if (ratio > 1) {
          initialWidth = maxSize;
          initialHeight = maxSize / ratio;
        } else {
          initialHeight = maxSize;
          initialWidth = maxSize * ratio;
        }
      }

      onChange({
        ...shapeProps,
        width: initialWidth,
        height: initialHeight,
        ratioFixed: true // Oranı bir kez hesapla ve sabitle
      });
    }
  }, [image, shapeProps.ratioFixed]);

  const isNativeArrow = shapeProps.isDistanceArrow || shapeProps.symbolId === 'a-4' || shapeProps.symbolId === 'a-5';

  // Kurumsal logo sığdırma ve oran koruma mantığı
  useEffect(() => {
    if (image && shapeProps.id === 'corporate-logo' && !shapeProps.logoAdjusted) {
      const containerW = shapeProps.width;
      const containerH = shapeProps.height;
      const imgRatio = image.width / image.height;
      const containerRatio = containerW / containerH;

      let newW = containerW;
      let newH = containerH;

      if (imgRatio > containerRatio) {
        // Görsel daha geniş, genişliği baz al
        newH = containerW / imgRatio;
      } else {
        // Görsel daha dar, yüksekliği baz al
        newW = containerH * imgRatio;
      }

      onChange({
        ...shapeProps,
        width: newW,
        height: newH,
        logoAdjusted: true // Sadece bir kez ayarla
      });
    }
  }, [image, shapeProps.id, shapeProps.logoAdjusted]);

  useEffect(() => {
    if (image && imgRef.current && shapeProps.id === 'corporate-logo') {
      imgRef.current.cache();
    }
  }, [image]);

  const handleTransformEnd = () => {
    const node = groupRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    node.scaleX(1);
    node.scaleY(1);

    // MANÜEL MOTOR (döndürülmüş nesneler): en/boy konum doğrudan node attr'larına
    // yazıldı (ölçek hep 1) — commit'i node'un gerçek durumundan oku.
    if (manualResizeRef.current?.active) {
      const mr = manualResizeRef.current;
      manualResizeRef.current = null;
      const updates: any = {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: Math.max(1, node.width()),
        height: Math.max(1, node.height()),
        scaleX: 1,
        scaleY: 1,
      };
      // Koordinatlı oklar (MESAFE ÖLÇ vb.): uçları eski kutudan yeni kutuya haritala
      if (shapeProps.startX !== undefined && shapeProps.endX !== undefined && mr.start) {
        const sx = updates.width / (mr.start.w || 1);
        const sy = updates.height / (mr.start.h || 1);
        const mapPoint = (px_: number, py_: number) => {
          const rx = px_ - mr.start.x;
          const ry = py_ - mr.start.y;
          const lx = rx * mr.cos + ry * mr.sin;
          const ly = -rx * mr.sin + ry * mr.cos;
          const nlx = lx * sx;
          const nly = ly * sy;
          return {
            x: node.x() + nlx * mr.cos - nly * mr.sin,
            y: node.y() + nlx * mr.sin + nly * mr.cos,
          };
        };
        const s0 = mapPoint(shapeProps.startX, shapeProps.startY);
        const e0 = mapPoint(shapeProps.endX, shapeProps.endY);
        updates.startX = s0.x;
        updates.startY = s0.y;
        updates.endX = e0.x;
        updates.endY = e0.y;
        // Ok başı: eksen oranlarının ortalamasıyla orantılı büyüsün/küçülsün
        const baseHead = shapeProps.arrowHead || ARROW_HEAD_DEFAULT;
        updates.arrowHead = Math.min(
          ARROW_HEAD_MAX,
          Math.max(ARROW_HEAD_MIN, baseHead * ((sx + sy) / 2))
        );
      }
      onChange({
        ...shapeProps,
        ...updates,
      });
      return;
    }
    
    if (shapeProps.type === 'text') {
      // Kullanıcı isteği: tutamaçla ölçekleme puntoyu DEĞİŞTİRMESİN.
      // Köşe/kenar tutamaçlar kutu boyutunu değiştirir; yazı aynı puntoyla yeniden sarılır.
      // Punto yalnızca özellik panelindeki 'Punto' alanından büyütülür/küçültülür.
      const newWidth = Math.max(20, node.width() * scaleX);
      // Yükseklik: yerel (ölçeksiz) istemci kutusunun yüksekliği * scaleY — köşe tutamacıyla
      // dikey büyütme/küçültme de kalıcı olur (yerel kutu sarımın otomatik yüksekliğini içerir).
      let localH = 0;
      try { localH = groupRef.current.getClientRect({ skipTransform: true }).height || 0; } catch { localH = 0; }
      const baseH = Math.max(20, shapeProps.height || localH || 20);
      const newHeight = Math.max(20, baseH * scaleY);

      onChange({
        ...shapeProps,
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: newWidth,
        height: newHeight,
        fontSize: shapeProps.fontSize || 20,
        scaleX: 1,
        scaleY: 1,
      });
    } else {
      const updates: any = {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: Math.max(1, shapeProps.width * scaleX),
        height: Math.max(1, shapeProps.height * scaleY),
      };

      // OTO ŞERİT GEÇİŞİ — görsel tabanlı sembol KENAR (orta) tutamağıyla belirgin
      // şekilde TEK YÖNLÜ uzatıldıysa bu bir "şerit uzatma" eylemidir (yol/refüj/
      // kaldırım/şerit). Metadata'sı olmayan görsellerde (kullanıcı yüklemeleri
      // dahil) desen tekrarına otomatik geçilir; böylece uzatınca form bozulmaz.
      // Kullanıcının açık seçimi (Doku: NORMAL vb.) ve kütüphane metadata'sı
      // her zaman öncelikli tutulur.
      const anchor = transformAnchorRef.current;
      const isEdgeAnchor = anchor === 'middle-left' || anchor === 'middle-right' ||
                           anchor === 'top-center' || anchor === 'bottom-center';
      if (
        isEdgeAnchor &&
        shapeProps.src &&
        (shapeProps.type === 'symbol' || shapeProps.type === 'image') &&
        image &&
        (!shapeProps.tileMode || shapeProps.tileMode === 'auto') &&
        !(shapeProps.symbolId && SYMBOL_TILE_MODES[shapeProps.symbolId])
      ) {
        const sx = updates.width / (image.width || 1);
        const sy = updates.height / (image.height || 1);
        const anisotropy = Math.max(sx, sy) / Math.max(0.01, Math.min(sx, sy));
        if (anisotropy >= 1.6) {
          updates.tileMode = 'strip-auto';
        }
      }

      // Eğer objenin bir açıklaması/mesafesi varsa, yazı boyutunu da ölçekle
      // NOT: Kullanıcı isteği üzerine 'a-4' (Mesafe Oku) için yazı boyutu sabit kalmalı.
      // NOT: 'ev-callout' balonunda da punto sabit kalmalı — tutamaç yalnızca balon
      // çerçevesini büyütür/küçültür, metin aynı puntoyla yeniden sarılır (bozulma yok).
      if (shapeProps.distance !== undefined && shapeProps.symbolId !== 'a-4' && shapeProps.symbolId !== 'ev-callout' && !shapeProps.isDistanceArrow) {
        const scale = Math.max(Math.abs(scaleX), Math.abs(scaleY));
        updates.distanceFontSize = Math.max(2, (shapeProps.distanceFontSize || 14) * scale);
      }

      // ── OK MOTORU: baş orantılı büyüsün/küçülsün + koordinatlı ok boyutlanması ──
      // Kullanıcı isteği: oklar kenar/köşe tutamağıyla büyütülürken/küçültülürken
      // OK BAŞLARI da ölçekle orantılı değişmeli. Ayrıca koordinatlı oklarda
      // (MESAFE ÖLÇ vb. — startX/endX taşıyanlar) koordinatlar ölçeklenmezse
      // ok görsel olarak boyutlanmazdı; artık uçlar da ölçeklenir ve seçim
      // çerçevesi (transformer) okla birebir uyumlu oluşur.
      if (isNativeArrow) {
        const hasArrowCoords = shapeProps.startX !== undefined && shapeProps.endX !== undefined;
        let headScale: number;
        if (hasArrowCoords) {
          updates.startX = node.x() + (shapeProps.startX - shapeProps.x) * scaleX;
          updates.startY = node.y() + (shapeProps.startY - shapeProps.y) * scaleY;
          updates.endX = node.x() + (shapeProps.endX - shapeProps.x) * scaleX;
          updates.endY = node.y() + (shapeProps.endY - shapeProps.y) * scaleY;
          // Baş ölçeği = ok EKSENİNDEKİ uzunluk değişimi (yön bağımlı doğru hesap;
          // max(|sx|,|sy|) yatay küçültmede scaleY=1'den dolayı 1 çıkıp başı donuk
          // bırakıyordu — kullanıcı testinde yakalandı).
          const adx = shapeProps.endX - shapeProps.startX;
          const ady = shapeProps.endY - shapeProps.startY;
          const oldLen = Math.hypot(adx, ady) || 1;
          headScale = Math.hypot(adx * scaleX, ady * scaleY) / oldLen;
        } else {
          // Kütüphaneden gelen oklar lokal x ekseninde yataydır → uzunluk scaleX ile ölçeklenir
          headScale = Math.abs(scaleX);
        }
        const baseHead = shapeProps.arrowHead || ARROW_HEAD_DEFAULT;
        updates.arrowHead = Math.min(ARROW_HEAD_MAX, Math.max(ARROW_HEAD_MIN, baseHead * headScale));
      }

      // ── AÇIKLAMA OKU (ev-arrow-desc / -ellipse): çerçeve + tutamaklar ölçeklensin ──
      // Çerçeve (frameWidth/Height) ve alt tutamak noktaları (textX/Y, markerX/Y)
      // nesne ölçeğiyle birlikte büyür/küçülür; ok başı da orantılı değişir.
      if (shapeProps.symbolId === 'ev-arrow-desc' || shapeProps.symbolId === 'ev-arrow-desc-ellipse') {
        if (shapeProps.frameWidth !== undefined) updates.frameWidth = Math.max(24, shapeProps.frameWidth * scaleX);
        if (shapeProps.frameHeight !== undefined) updates.frameHeight = Math.max(16, shapeProps.frameHeight * scaleY);
        if (shapeProps.textX !== undefined) updates.textX = shapeProps.textX * scaleX;
        if (shapeProps.textY !== undefined) updates.textY = shapeProps.textY * scaleY;
        if (shapeProps.markerX !== undefined) updates.markerX = shapeProps.markerX * scaleX;
        if (shapeProps.markerY !== undefined) updates.markerY = shapeProps.markerY * scaleY;
        const headScale = Math.sqrt(Math.abs(scaleX * scaleY));
        updates.arrowHead = Math.min(ARROW_HEAD_MAX, Math.max(ARROW_HEAD_MIN, (shapeProps.arrowHead || 10) * headScale));
      }

      // ── AÇIKLAMA BALONU (ev-callout): çerçeve alt sınırı ──
      // Balon, metnin otomatik sığma boyutunun altına küçültülürse metin taşardı;
      // bu yüzden efektif çerçeve en az otomatik boyut kadar kalır (bozulma yok).
      if (shapeProps.symbolId === 'ev-callout') {
        const autoCallout = calculateCalloutSize(String(shapeProps.distance || ''), shapeProps.distanceFontSize || 14);
        updates.width = Math.max(autoCallout.w, updates.width);
        updates.height = Math.max(autoCallout.h, updates.height);
      }

      onChange({
        ...shapeProps,
        ...updates
      });
    }
  };

  const isStretchable = 
    shapeProps.type === 'rect' || 
    shapeProps.type === 'line' || 
    shapeProps.type === 'text' ||
    shapeProps.type === 'finding-list' ||
    isNativeArrow ||
    // Mimari, sokak ve ölçü araçları sündürülebilir olmalı
    (
      shapeProps.symbolId?.startsWith('arch-') || 
      shapeProps.symbolId?.startsWith('st-') || 
      shapeProps.symbolId?.startsWith('ev-') ||
      shapeProps.symbolId === 'ev-rope' ||
      shapeProps.symbolId === 'ev-noose' ||
      shapeProps.categoryId === 'outdoor' ||
      shapeProps.categoryId === 'arrows' ||
      shapeProps.categoryId === 'furniture' ||
      ['arch-1', 'arch-1v', 'arch-6', 'arch-6l', 'arch-6u', 'arch-6s', 'arch-6sf',
       'arch-6-spiral-f', 'arch-6-spiral-s', 'arch-6-spiral-s-top',
       'st-1', 'st-2', 'st-3', 'st-4', 
       'ev-arrow-l', 'ev-arrow-r', 'ev-arrowhead',
       'ev-ruler-straight', 'ev-ruler-l', 'ev-rect-hollow'
      ].includes(shapeProps.symbolId || '') ||
      shapeProps.categoryId === 'injuries' ||
      shapeProps.symbolId === 'kk-child-stand' ||
      shapeProps.symbolId === 'kk-child-lying' ||
      shapeProps.symbolId === 'kk-injured' ||
      shapeProps.symbolId?.startsWith('in-blood-') ||
      shapeProps.categoryId === 'explosion' ||
      shapeProps.categoryId === 'traces'
    );

  // Guard conditions checked after all hooks are called
  if (!shapeProps) return null;
  // Bulgu Listesi için özel durum: Eğer hiç bulgu yoksa tabloyu gizle
  if (shapeProps.type === 'finding-list' && !allObjects?.some((o: CanvasObject) => o.findingNo)) {
    return null;
  }

  // UZATMA MOTORU v4 (ekran) — somut desen modu + KAPAK+KESİT kompoziti.
  // Metadata'lı kütüphane dokuları bütün-görsel fillPattern ile; metadata'sız
  // yüklemelerde uçlar sabit tutulup yalnızca orta bant tekrar eder (parçalanma yok).
  const texInfo = image ? getTextureInfo(image) : null;
  const resolvedTile = resolveConcreteTileMode(
    shapeProps,
    shapeProps.width || 0,
    shapeProps.height || 0,
    image?.width || 0,
    image?.height || 0,
    texInfo
  );
  const effectiveTileMode = resolvedTile.mode;
  const tilePattern = tilePatternParams(
    effectiveTileMode,
    shapeProps.width || 0,
    shapeProps.height || 0,
    image?.width || 0,
    image?.height || 0
  );
  const composedStrip =
    resolvedTile.caps && image && (effectiveTileMode === 'strip-x' || effectiveTileMode === 'strip-y')
      ? composeStripCanvas(image, shapeProps.width || 0, shapeProps.height || 0, effectiveTileMode)
      : null;

  return (
    <React.Fragment>
      <Group
        ref={groupRef}
        x={shapeProps.x}
        y={shapeProps.y}
        rotation={shapeProps.rotation}
        width={shapeProps.width}
        height={shapeProps.type === 'text' || shapeProps.type === 'finding-list' ? undefined : shapeProps.height}
        draggable={!shapeProps.isTemplate || (shapeProps.id === 'corporate-logo' && isAdmin) || shapeProps.type === 'finding-list'}
        listening={!shapeProps.isTemplate || (shapeProps.id === 'corporate-logo' && isAdmin) || shapeProps.type === 'finding-list'}
        onDragMove={(e) => {
          if (onDragMove) onDragMove(e);
          
          // Mimari Snapping (Kapı/Pencere rotasyonunu duvara uydur)
          const isSnapTarget = DOORLIKE_SNAP_IDS.includes(shapeProps.symbolId || '');
          const isWall = WALLLIKE_IDS.includes(shapeProps.symbolId || '');

          if (allObjects && e.target === groupRef.current) {
            const threshold = 15; // Snapping etki alanı
            const myX = e.target.x();
            const myY = e.target.y();

            if (isSnapTarget) {
              for (const other of allObjects) {
                if (other.id === shapeProps.id) continue;
                const isOtherWall = WALLLIKE_IDS.includes(other.symbolId || '');
                if (!isOtherWall) continue;

                const dx = myX - other.x;
                const dy = myY - other.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist < 100) {
                  const isWallVertical = other.symbolId?.includes('v');
                  const wallBaseRot = (other.rotation || 0);
                  const wallLineAngle = (wallBaseRot + (isWallVertical ? 90 : 0)) % 360;
                  const currentRot = (e.target.rotation() % 360 + 360) % 360;
                  const relAngle = (currentRot - wallLineAngle + 360) % 360;
                  let targetRot = wallLineAngle;
                  if (relAngle > 90 && relAngle < 270) targetRot = (wallLineAngle + 180) % 360;
                  e.target.rotation(targetRot);
                  break;
                }
              }
            } else if (isWall) {
              // Duvar-Duvar Yapışma (Uç uca ekleme)
              for (const other of allObjects) {
                if (other.id === shapeProps.id) continue;
                const isOtherWall = WALLLIKE_IDS.includes(other.symbolId || '');
                if (!isOtherWall) continue;

                // Diğer duvarın köşelerini hesapla
                const oW = other.width || 0;
                const oH = other.height || 0;
                const oRad = (other.rotation || 0) * (Math.PI / 180);
                const oCos = Math.cos(oRad);
                const oSin = Math.sin(oRad);

                const otherCorners = [
                  { x: other.x, y: other.y }, // Start
                  { x: other.x + oW * oCos, y: other.y + oW * oSin }, // End-Width
                  { x: other.x - oH * oSin, y: other.y + oH * oCos }, // End-Height
                  { x: other.x + oW * oCos - oH * oSin, y: other.y + oH * oSin + oH * oCos } // Opposite
                ];

                for (const corner of otherCorners) {
                  const dx = myX - corner.x;
                  const dy = myY - corner.y;
                  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
                    e.target.x(corner.x);
                    e.target.y(corner.y);
                    return; // Snap gerçekleşti
                  }
                }
              }
            }
          }
        }}
        onDragEnd={(e) => {
          if (onDragEnd) onDragEnd(e);
          if (e.target !== groupRef.current) return;
          onChange({
            ...shapeProps,
            x: e.target.x(),
            y: e.target.y(),
            rotation: e.target.rotation(), // Rotasyonu da kaydet (snap desteği için)
          });
          e.target.getLayer()?.batchDraw();
        }}
        onMouseEnter={(e) => {
          if (['ev-bpa-drop', 'ev-camera-link'].includes(shapeProps.symbolId) || (shapeProps.photos && shapeProps.photos.length > 0)) {
            setShowTooltip(true);
            if (onMouseEnter) onMouseEnter(e);
          }
          const container = e.target.getStage()?.container();
          if (container) {
            container.style.cursor = ((shapeProps.id === 'corporate-logo' && isAdmin) || shapeProps.type === 'finding-list') ? 'pointer' : 'move';
          }
        }}
        onMouseLeave={(e) => {
          setShowTooltip(false);
          if (onMouseLeave) onMouseLeave(e);
          const container = e.target.getStage()?.container();
          if (container) {
            container.style.cursor = 'default';
          }
        }}
        // KIRPMA = TÜM SAYFA: seçim kaldırıldığında nesne, çizim alanı kenar boşlukları
        // yerine yalnızca sayfa sınırında kırpılır. PDF dışa aktarımı zaten tam sayfaya
        // çizdiği için bu tutarlıdır; aksi halde kenara taşan uzatmalar seçim kalkınca
        // kaybolurdu (kullanıcı raporu: uzatma siliniyor).
        clipX={!shapeProps.isTemplate && !isSelected ? -(shapeProps.x || 0) : undefined}
        clipY={!shapeProps.isTemplate && !isSelected ? -(shapeProps.y || 0) : undefined}
        clipWidth={!shapeProps.isTemplate && !isSelected ? (paperArea?.w || 1000) : undefined}
        clipHeight={!shapeProps.isTemplate && !isSelected ? (paperArea?.h || 1400) : undefined}
        dragBoundFunc={(pos) => {
          let newX = pos.x;
          let newY = pos.y;

          if (drawingArea && !shapeProps.isTemplate) {
            // Grid Snapping (20px) - Önce grid'e oturt
            const gridSize = 10; // Daha hassas bir grid
            newX = Math.round((newX - drawingArea.x) / gridSize) * gridSize + drawingArea.x;
            newY = Math.round((newY - drawingArea.y) / gridSize) * gridSize + drawingArea.y;
          }

          // Road & Wall Snapping Logic — yol motoru ailesi (st-1/cadde/sokak) snap'e dahil
          const isRoad = shapeProps.symbolId?.startsWith('st-') && ['st-1', 'st-2', 'st-3', 'st-4'].includes(shapeProps.symbolId);
          const isRoadEngine = isRoadEngineSymbol(shapeProps.symbolId);
          const isWall = WALLLIKE_IDS.includes(shapeProps.symbolId || '');
          const isSnapTarget = DOORLIKE_SNAP_IDS.includes(shapeProps.symbolId || '');

          if ((isRoad || isRoadEngine || isWall || isSnapTarget) && allObjects) {
            const threshold = 20;
            for (const other of allObjects) {
              if (other.id === shapeProps.id) continue;
              
              const isOtherRoad = other.symbolId?.startsWith('st-');
              const isOtherWall = other.symbolId === 'arch-1' || other.symbolId === 'arch-1v';

              if ((isRoad || isRoadEngine) && isOtherRoad) {
                // Road to Road Snapping
                const otherW = other.width || 0;
                const otherH = other.height || 0;
                const myW = shapeProps.width || 0;
                const myH = shapeProps.height || 0;

                if (Math.abs(newX - other.x) < threshold) newX = other.x;
                else if (Math.abs(newX - (other.x + otherW)) < threshold) newX = other.x + otherW;
                else if (Math.abs((newX + myW) - other.x) < threshold) newX = other.x - myW;
                else if (Math.abs((newX + myW) - (other.x + otherW)) < threshold) newX = other.x + otherW - myW;

                if (Math.abs(newY - other.y) < threshold) newY = other.y;
                else if (Math.abs(newY - (other.y + otherH)) < threshold) newY = other.y + otherH;
                else if (Math.abs((newY + myH) - other.y) < threshold) newY = other.y - myH;
                else if (Math.abs((newY + myH) - (other.y + otherH)) < threshold) newY = other.y + otherH - myH;
                
                if (Math.abs((newX + myW/2) - (other.x + otherW/2)) < threshold) newX = other.x + otherW/2 - myW/2;
                if (Math.abs((newY + myH/2) - (other.y + otherH/2)) < threshold) newY = other.y + otherH/2 - myH/2;
              } else if ((isWall || isSnapTarget) && isOtherWall) {
                // Wall to Wall Endpoint Snapping (Advanced Geometric Magnet)
                const otherW = other.width || 0;
                const otherRad = (other.rotation || 0) * (Math.PI / 180);
                const myW = shapeProps.width || 0;
                const myRad = (shapeProps.rotation || 0) * (Math.PI / 180);

                const threshold = 25; // Daha güçlü mıknatıslanma

                // Other wall endpoints
                const oP1 = { x: other.x, y: other.y };
                const oP2 = { 
                  x: other.x + otherW * Math.cos(otherRad), 
                  y: other.y + otherW * Math.sin(otherRad) 
                };

                if (isWall) {
                  // Current wall candidate endpoints (based on current newX, newY)
                  const mP1 = { x: newX, y: newY };
                  const mP2 = { 
                    x: newX + myW * Math.cos(myRad), 
                    y: newY + myW * Math.sin(myRad) 
                  };

                  const dist = (p1: any, p2: any) => Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);

                  // 4 Snapping combinations
                  if (dist(mP1, oP1) < threshold) {
                    newX = oP1.x; newY = oP1.y;
                  } else if (dist(mP1, oP2) < threshold) {
                    newX = oP2.x; newY = oP2.y;
                  } else if (dist(mP2, oP1) < threshold) {
                    newX = oP1.x - myW * Math.cos(myRad);
                    newY = oP1.y - myW * Math.sin(myRad);
                  } else if (dist(mP2, oP2) < threshold) {
                    newX = oP2.x - myW * Math.cos(myRad);
                    newY = oP2.y - myW * Math.sin(myRad);
                  }
                } else {
                  // Door/Window Snap to Wall Line Center
                  const wallCenterX = (oP1.x + oP2.x) / 2;
                  const wallCenterY = (oP1.y + oP2.y) / 2;
                  
                  const myH = shapeProps.height || 0;
                  const dx = newX + myW / 2 - wallCenterX;
                  const dy = newY + myH / 2 - wallCenterY;
                  if (Math.sqrt(dx*dx + dy*dy) < threshold * 2) {
                    newX = wallCenterX - myW / 2;
                    newY = wallCenterY - myH / 2;
                  }
                }
              }
            }
          }

          // SÜRÜKLEME SINIRI = TÜM SAYFA — GERÇEK DÖNDÜRÜLMÜŞ ÇERÇEVEYLE (kullanıcı raporu:
          // "mesafe okunu çevirdiğimde grid kareli alanda kısıtlanıyor"). Eski kod yalnızca
          // 90/270°'de en-boy takası yapıyordu; ara açılarda (örn. 30-45°) nesnenin gerçek
          // kapladığı alan hesaplanmadığı için döndürülmüş semboller/oklar kenarlara
          // yaklaşamıyor ve sayfa içinde her noktaya gidemiyordu. Artık yerel köşeler
          // döndürülerek gerçek AABB çıkarılır; nesne sayfaya sığıyorsa TAMAMI sayfa içinde
          // kalacak şekilde her konuma taşınabilir, sayfadan büyükse (uzun yol/sokak) o
          // eksende serbesttir.
          if (!shapeProps.isTemplate) {
            const P = paperArea || { w: 1000, h: 1400 };
            const w = shapeProps.width || 0;
            const h = (shapeProps.type === 'text' || shapeProps.type === 'finding-list') ? 20 : (shapeProps.height || 0);

            const rad = ((shapeProps.rotation || 0) * Math.PI) / 180;
            const cosR = Math.cos(rad);
            const sinR = Math.sin(rad);
            // Yerel köşeler (0,0)(w,0)(w,h)(0,h) döndürülür — Konva'da (x,y) düğüm orijinidir,
            // pozitif açı saat yönüdür (ekranda x sağa, y aşağı).
            const cornerXs = [0, w, w, 0];
            const cornerYs = [0, 0, h, h];
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (let ci = 0; ci < 4; ci++) {
              const cxAbs = cornerXs[ci] * cosR - cornerYs[ci] * sinR;
              const cyAbs = cornerXs[ci] * sinR + cornerYs[ci] * cosR;
              if (cxAbs < minX) minX = cxAbs;
              if (cxAbs > maxX) maxX = cxAbs;
              if (cyAbs < minY) minY = cyAbs;
              if (cyAbs > maxY) maxY = cyAbs;
            }
            // Düğüm (x,y) = yerel (0,0) → AABB'nin sol-üst köşesi (x+minX, y+minY).
            // Sınır: x+minX >= 0 ve x+maxX <= P.w (aynısı y için).
            if (maxX - minX <= P.w) {
              newX = Math.max(-minX, Math.min(newX, P.w - maxX));
            }
            if (maxY - minY <= P.h) {
              newY = Math.max(-minY, Math.min(newY, P.h - maxY));
            }
          }
          
          return { x: newX, y: newY };
        }}
        onClick={() => {
          onSelect();
        }}
        onTap={() => {
          onSelect();
        }}
        onTransformStart={handleTransformStart}
        onTransformEnd={(e) => {
          handleTransformEnd();
          e.target.getLayer()?.batchDraw();
        }}
      >
        {shapeProps.symbolId === 'ev-human-poseable' ? (
          // Professional Forensic Poseable Mannequin Engine (Joint-based)
          <Group>
            {(() => {
              const w = Number(shapeProps.width) || 200;
              const h = Number(shapeProps.height) || 400;
              // Default Joint Positions (scaled to width/height)
              const joints = (shapeProps.joints && Array.isArray(shapeProps.joints) && shapeProps.joints.length === 13) 
                ? shapeProps.joints 
                : [
                  { id: 'head', x: w/2, y: h*0.1 },        // 0
                  { id: 'neck', x: w/2, y: h*0.2 },        // 1
                  { id: 'l_shoulder', x: w*0.3, y: h*0.25 }, // 2
                  { id: 'r_shoulder', x: w*0.7, y: h*0.25 }, // 3
                  { id: 'l_elbow', x: w*0.2, y: h*0.45 },   // 4
                  { id: 'r_elbow', x: w*0.8, y: h*0.45 },   // 5
                  { id: 'l_wrist', x: w*0.15, y: h*0.65 },  // 6
                  { id: 'r_wrist', x: w*0.85, y: h*0.65 },  // 7
                  { id: 'pelvis', x: w/2, y: h*0.55 },     // 8
                  { id: 'l_knee', x: w*0.35, y: h*0.75 },   // 9
                  { id: 'r_knee', x: w*0.65, y: h*0.75 },   // 10
                  { id: 'l_ankle', x: w*0.35, y: h*0.95 },  // 11
                  { id: 'r_ankle', x: w*0.65, y: h*0.95 }   // 12
                ];

              const drawBone = (idx1: number, idx2: number, thickness: number) => {
                const p1 = joints[idx1];
                const p2 = joints[idx2];
                if (!p1 || !p2) return null;
                return (
                  <Line 
                    points={[p1.x, p1.y, p2.x, p2.y]} 
                    stroke="#000" strokeWidth={thickness} lineCap="round" 
                  />
                );
              };

              return (
                <Group>
                  {/* Anatomical Silhouette Rendering */}
                  <Group opacity={0.9}>
                    {/* Diagnostic background */}
                    <Rect width={w} height={h} fill="rgba(0,0,0,0.02)" stroke="#ccc" strokeWidth={0.5} dash={[5,5]} />
                    
                    {/* Torso & Head */}
                    {drawBone(1, 8, 30)} {/* Torso */}
                    <Circle x={joints[0].x} y={joints[0].y} radius={20} fill="white" stroke="#000" strokeWidth={2} />
                    
                    {/* Arms */}
                    {drawBone(1, 2, 16)}
                    {drawBone(1, 3, 16)}
                    {drawBone(2, 4, 13)}
                    {drawBone(4, 6, 10)}
                    {drawBone(3, 5, 13)}
                    {drawBone(5, 7, 10)}
                    
                    {/* Legs */}
                    {drawBone(8, 9, 20)}
                    {drawBone(9, 11, 16)}
                    {drawBone(8, 10, 20)}
                    {drawBone(10, 12, 16)}
                  </Group>

                  {/* Interactive Joint Handles (Visible when selected) */}
                  {isSelected && joints.map((j: {id: string; x: number; y: number}, i: number) => (
                    <Circle
                      key={j.id}
                      x={j.x}
                      y={j.y}
                      radius={10}
                      fill="#F5C518"
                      stroke="white"
                      strokeWidth={2}
                      draggable
                      onDragMove={(e) => {
                        const newJoints = [...joints];
                        newJoints[i] = { ...j, x: e.target.x(), y: e.target.y() };
                        onChange({ ...shapeProps, joints: newJoints });
                      }}
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'move';
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                      shadowBlur={5}
                      shadowColor="black"
                      shadowOpacity={0.5}
                    />
                  ))}
                </Group>
              );
            })()}
          </Group>
        ) : shapeProps.type === 'text' ? (
          <Text
            text={String(shapeProps.text || '')}
            fontSize={shapeProps.fontSize}
            fontFamily={String(shapeProps.fontFamily || 'Inter')}
            fontStyle={shapeProps.fontStyle}
            fill={shapeProps.fill}
            x={0}
            y={0}
            width={shapeProps.width > 0 ? shapeProps.width : undefined}
            height={shapeProps.height && shapeProps.height > 0 ? shapeProps.height : undefined}
            wrap="word"
            align={shapeProps.align}
            // SATIR ARALIĞI (kullanıcı isteği: satır ayarlama) + DİKEY YAZI KONUMU:
            // özellik panelinden ayarlanır; PDF dışa aktarımı aynı kuralı izler.
            lineHeight={shapeProps.lineHeight || 1}
            verticalAlign={shapeProps.vAlign || 'top'}
            rotation={0}
            draggable={false}
          />
        ) : isNativeArrow ? (
          (() => {
            const hasCoords = shapeProps.startX !== undefined && shapeProps.endX !== undefined;
            const pts = hasCoords 
              ? [shapeProps.startX - shapeProps.x, shapeProps.startY - shapeProps.y, shapeProps.endX - shapeProps.x, shapeProps.endY - shapeProps.y]
              : [0, shapeProps.height / 2, shapeProps.width, shapeProps.height / 2];
              
            const isMeasurement = shapeProps.isDistanceArrow || shapeProps.symbolId === 'a-4';

            const headLen = shapeProps.arrowHead || ARROW_HEAD_DEFAULT;
            const arrowColor = isMeasurement ? '#000000' : (shapeProps.stroke || shapeProps.fill || '#000000');
            const arrowWidth = isMeasurement ? 5 : (shapeProps.strokeWidth || 5);
            return (
              <Group>
                {/* Gövde çizgisi */}
                <Line
                  points={pts}
                  stroke={arrowColor}
                  strokeWidth={arrowWidth}
                  lineCap="round"
                  opacity={1}
                  perfectDrawEnabled={false}
                  draggable={false}
                />
                {/* Uç başı — st-5 tarzı İÇİ BOŞ chevron (dolu üçgen değil);
                    headLen resize'da orantılı büyüyüp küçülür (OK MOTORU) */}
                <Line
                  points={chevronHeadPoints(pts[0], pts[1], pts[2], pts[3], headLen)}
                  stroke={arrowColor}
                  strokeWidth={arrowWidth}
                  lineCap="round"
                  lineJoin="round"
                  opacity={1}
                  perfectDrawEnabled={false}
                  draggable={false}
                />
                {isMeasurement && (
                  <Line
                    points={chevronHeadPoints(pts[2], pts[3], pts[0], pts[1], headLen)}
                    stroke={arrowColor}
                    strokeWidth={arrowWidth}
                    lineCap="round"
                    lineJoin="round"
                    opacity={1}
                    perfectDrawEnabled={false}
                    draggable={false}
                  />
                )}
              </Group>
            );
          })()
        ) : ['arch-6', 'arch-6-v4', 'arch-6l', 'arch-6l-v4', 'arch-6u', 'arch-6u-v4', 'arch-6s', 'arch-6sf', 'arch-6-spiral-f', 'arch-6-spiral-s', 'arch-6-spiral-s-top', 'arch-w-square'].includes(shapeProps.symbolId || '') ? (
          // Dynamic Stairs Engine — v4 merdivenler de burada prosedürel çizilir:
          // siyah kalem stili + basamak sayısı boyuta göre otomatik → uzatma bozulması yok.
          <Group>
            {['arch-6', 'arch-6-v4'].includes(shapeProps.symbolId || '') && (
              <Group>
                <Rect width={shapeProps.width} height={shapeProps.height} stroke="#000" strokeWidth={2} />
                <Line points={[2, 0, 2, shapeProps.height]} stroke="#666" strokeWidth={2} />
                <Line points={[shapeProps.width - 2, 0, shapeProps.width - 2, shapeProps.height]} stroke="#666" strokeWidth={2} />
                {Array.from({ length: Math.floor(shapeProps.height / 15) }).map((_, i) => (
                  <Line key={i} points={[0, (i + 1) * 15, shapeProps.width, (i + 1) * 15]} stroke="#000" strokeWidth={1} />
                ))}
              </Group>
            )}
            {['arch-6l', 'arch-6l-v4'].includes(shapeProps.symbolId || '') && (
              <Group>
                <Path data={`M 0 0 L ${shapeProps.width} 0 L ${shapeProps.width} ${shapeProps.height} L ${shapeProps.width - 40} ${shapeProps.height} L ${shapeProps.width - 40} 40 L 0 40 Z`} stroke="#000" strokeWidth={2} />
                {/* Horizontal steps */}
                {Array.from({ length: Math.floor((shapeProps.width - 40) / 15) }).map((_, i) => (
                  <Line key={`h-${i}`} points={[(i + 1) * 15, 0, (i + 1) * 15, 40]} stroke="#000" strokeWidth={1} />
                ))}
                {/* Corner step */}
                <Line points={[shapeProps.width - 40, 0, shapeProps.width, 40]} stroke="#000" strokeWidth={1} />
                {/* Vertical steps */}
                {Array.from({ length: Math.floor((shapeProps.height - 40) / 15) }).map((_, i) => (
                  <Line key={`v-${i}`} points={[shapeProps.width - 40, 40 + (i + 1) * 15, shapeProps.width, 40 + (i + 1) * 15]} stroke="#000" strokeWidth={1} />
                ))}
              </Group>
            )}
            {['arch-6u', 'arch-6u-v4'].includes(shapeProps.symbolId || '') && (
              <Group>
                <Path data={`M 0 0 L 35 0 L 35 ${shapeProps.height - 35} L ${shapeProps.width - 35} ${shapeProps.height - 35} L ${shapeProps.width - 35} 0 L ${shapeProps.width} 0 L ${shapeProps.width} ${shapeProps.height} L 0 ${shapeProps.height} Z`} stroke="#000" strokeWidth={2} />
                {/* Steps left */}
                {Array.from({ length: Math.floor((shapeProps.height - 35) / 15) }).map((_, i) => (
                  <Line key={`l-${i}`} points={[0, (i + 1) * 15, 35, (i + 1) * 15]} stroke="#000" strokeWidth={1} />
                ))}
                {/* Steps right */}
                {Array.from({ length: Math.floor((shapeProps.height - 35) / 15) }).map((_, i) => (
                  <Line key={`r-${i}`} points={[shapeProps.width - 35, (i + 1) * 15, shapeProps.width, (i + 1) * 15]} stroke="#000" strokeWidth={1} />
                ))}
                {/* Steps bottom (landing) */}
                {Array.from({ length: Math.floor((shapeProps.width - 70) / 20) }).map((_, i) => (
                  <Line key={`b-${i}`} points={[35 + (i + 1) * 20, shapeProps.height - 35, 35 + (i + 1) * 20, shapeProps.height]} stroke="#000" strokeWidth={0.5} />
                ))}
              </Group>
            )}
            {['arch-6s', 'arch-6sf', 'arch-6-spiral-f'].includes(shapeProps.symbolId || '') && (
              <Group>
                {/* Outer Ring */}
                <Circle x={shapeProps.width / 2} y={shapeProps.height / 2} radius={Math.min(shapeProps.width, shapeProps.height) / 2} stroke="#000" strokeWidth={2} />
                {/* Central Pole (The black circle in the middle) */}
                <Circle x={shapeProps.width / 2} y={shapeProps.height / 2} radius={Math.min(shapeProps.width, shapeProps.height) / 8} fill="#000" />
                {/* Steps */}
                {Array.from({ length: 16 }).map((_, i) => {
                  const angle = (i * 360) / 16;
                  const rad = (angle * Math.PI) / 180;
                  const rOut = Math.min(shapeProps.width, shapeProps.height) / 2;
                  const rIn = Math.min(shapeProps.width, shapeProps.height) / 8;
                  return (
                    <Line
                      key={i}
                      points={[
                        shapeProps.width / 2 + rIn * Math.cos(rad),
                        shapeProps.height / 2 + rIn * Math.sin(rad),
                        shapeProps.width / 2 + rOut * Math.cos(rad),
                        shapeProps.height / 2 + rOut * Math.sin(rad)
                      ]}
                      stroke="#000"
                      strokeWidth={1}
                    />
                  );
                })}
              </Group>
            )}
            {shapeProps.symbolId === 'arch-6-spiral-s-top' && (
              <Group>
                {/* Dubleks Yandan - Üst Görünümü (270 Derece Spiral) */}
                <Arc
                  x={shapeProps.width / 2}
                  y={shapeProps.height / 2}
                  innerRadius={Math.min(shapeProps.width, shapeProps.height) / 10}
                  outerRadius={Math.min(shapeProps.width, shapeProps.height) / 2}
                  angle={270}
                  rotation={0}
                  stroke="#000"
                  strokeWidth={2}
                />
                <Circle x={shapeProps.width / 2} y={shapeProps.height / 2} radius={Math.min(shapeProps.width, shapeProps.height) / 10} fill="#333" />
                {Array.from({ length: 12 }).map((_, i) => {
                  const angle = (i * 270) / 12;
                  const rad = (angle * Math.PI) / 180;
                  const rOut = Math.min(shapeProps.width, shapeProps.height) / 2;
                  const rIn = Math.min(shapeProps.width, shapeProps.height) / 10;
                  return (
                    <Line
                      key={i}
                      points={[
                        shapeProps.width / 2 + rIn * Math.cos(rad),
                        shapeProps.height / 2 + rIn * Math.sin(rad),
                        shapeProps.width / 2 + rOut * Math.cos(rad),
                        shapeProps.height / 2 + rOut * Math.sin(rad)
                      ]}
                      stroke="#000"
                      strokeWidth={1}
                    />
                  );
                })}
              </Group>
            )}
            {shapeProps.symbolId === 'arch-w-square' && (
              <Rect
                width={shapeProps.width}
                height={shapeProps.height}
                stroke="#000"
                strokeWidth={10}
                strokeScaleEnabled={false}
              />
            )}
            {['arch-6-spiral-s'].includes(shapeProps.symbolId || '') && (
              <Group>
                {/* Central Pole */}
                <Rect x={shapeProps.width / 2 - 1.5} y={0} width={3} height={shapeProps.height} fill="#000" />
                {Array.from({ length: 15 }).map((_, i) => {
                  const t = i / 14;
                  const angle = t * Math.PI * 4;
                  const xOffset = (Math.sin(angle) * shapeProps.width) / 2;
                  const isFront = Math.cos(angle) > 0;
                  const y = t * (shapeProps.height - 10);
                  return (
                    <Group key={i}>
                      <Line
                        points={[shapeProps.width / 2, y, shapeProps.width / 2 + xOffset, y]}
                        stroke={isFront ? "#000" : "#888"}
                        strokeWidth={2}
                      />
                      <Line
                        points={[shapeProps.width / 2 + xOffset, y, shapeProps.width / 2 + xOffset, y + 5]}
                        stroke={isFront ? "#000" : "#aaa"}
                        strokeWidth={1}
                      />
                    </Group>
                  );
                })}
                {/* Handrail */}
                <Path
                  data={(() => {
                    let path = `M ${shapeProps.width/2} 0`;
                    for(let i=0; i<=20; i++) {
                      const t = i/20;
                      const angle = t * Math.PI * 4;
                      const x = shapeProps.width/2 + (Math.sin(angle) * shapeProps.width)/2;
                      const y = t * (shapeProps.height - 10);
                      path += ` L ${x} ${y}`;
                    }
                    return path;
                  })()}
                  stroke="#000"
                  strokeWidth={1.5}
                  opacity={0.6}
                />
              </Group>
            )}
          </Group>
        ) : EXTRA_ARCH_IDS.includes(shapeProps.symbolId || '') ? (
          // MİMARİ EK SEMBOLLER — prosedürel çizim (uzatmaya dayanıklı)
          <ExtraArchShapes
            symbolId={shapeProps.symbolId || ''}
            width={shapeProps.width}
            height={shapeProps.height}
          />
        ) : shapeProps.type === 'rect' ? (
          <Rect
            width={shapeProps.width}
            height={shapeProps.height}
            fill={shapeProps.fill || "transparent"}
            stroke={shapeProps.stroke || "black"}
            strokeWidth={shapeProps.strokeWidth || 1}
            draggable={false}
          />
        ) : shapeProps.type === 'line' ? (
          shapeProps.dash ? (
            <Line
              points={shapeProps.width > shapeProps.height 
                ? [0, 0, shapeProps.width, 0] 
                : [0, 0, 0, shapeProps.height]}
              stroke={shapeProps.fill || "black"}
              strokeWidth={Math.max(shapeProps.width, shapeProps.height) > 1 ? Math.min(shapeProps.width, shapeProps.height) : 1}
              dash={shapeProps.dash}
              draggable={false}
            />
          ) : (
            <Rect
              width={shapeProps.width}
              height={shapeProps.height}
              fill={shapeProps.fill || "black"}
              draggable={false}
            />
          )
        ) : shapeProps.symbolId === 'ev-noose' ? (
          // Ultra-Realistic Forensic Noose Engine
          <Group>
            {(() => {
              const sw = shapeProps.width / 80;
              const sh = shapeProps.height / 120;
              const rWidth = Math.max(2, shapeProps.width / 12);
              
              return (
                <Group>
                  {/* Top Rope Segment */}
                  <Line
                    points={[40 * sw, 0, 40 * sw, 30 * sh]}
                    stroke="#000"
                    strokeWidth={rWidth}
                    lineCap="round"
                  />
                  {/* Texture on top segment */}
                  <Line
                    points={[40 * sw, 5 * sh, 40 * sw, 25 * sh]}
                    stroke="white"
                    strokeWidth={rWidth * 0.3}
                    dash={[4, 6]}
                    opacity={0.3}
                  />

                  {/* The Hangman's Knot (Multi-wrap) */}
                  <Rect 
                    x={28 * sw} 
                    y={30 * sh} 
                    width={24 * sw} 
                    height={32 * sh} 
                    cornerRadius={4 * sw} 
                    fill="#000" 
                  />
                  {/* Knot Wraps details */}
                  {[35, 40, 45, 50, 55].map(y => (
                    <Line 
                      key={y}
                      points={[29 * sw, y * sh, 51 * sw, y * sh]}
                      stroke="white"
                      strokeWidth={1 * sw}
                      opacity={0.3}
                    />
                  ))}

                  {/* Main Teardrop Loop */}
                  <Path
                    data="M40 62 Q 80 62, 80 95 Q 80 118, 40 118 Q 0 118, 0 95 Q 0 62, 40 62"
                    stroke="#000"
                    strokeWidth={rWidth}
                    lineCap="round"
                    scaleX={sw}
                    scaleY={sh}
                  />
                  {/* Braid Texture on Loop */}
                  <Path
                    data="M40 62 Q 80 62, 80 95 Q 80 118, 40 118 Q 0 118, 0 95 Q 0 62, 40 62"
                    stroke="white"
                    strokeWidth={rWidth * 0.4}
                    dash={[6, 10]}
                    opacity={0.3}
                    scaleX={sw}
                    scaleY={sh}
                    lineCap="round"
                  />
                </Group>
              );
            })()}
          </Group>
        ) : shapeProps.symbolId === 'ev-rope' ? (
          // Advanced 6-Point Spline Rope Engine
          <Group>
            {(() => {
              const w = shapeProps.width;
              const h = shapeProps.height;
              // Default 6 points relative to group if not set
              const pts = shapeProps.points || [
                0, h / 2, 
                w * 0.2, h / 2 - 30, 
                w * 0.4, h / 2 + 30, 
                w * 0.6, h / 2 - 30, 
                w * 0.8, h / 2 + 30, 
                w, h / 2
              ];
              
              return (
                <Group>
                  {/* Rope Shadow Layer */}
                  <Line
                    points={pts}
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth={10}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                  />
                  {/* Main Braided Rope Body */}
                  <Line
                    points={pts}
                    stroke="#000"
                    strokeWidth={7}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                  />
                  {/* Texture Layer (Braid highlights) */}
                  <Line
                    points={pts}
                    stroke="white"
                    strokeWidth={3}
                    tension={0.5}
                    dash={[6, 10]}
                    opacity={0.3}
                    lineCap="round"
                  />
                  
                  {/* 6 Multi-Point Shaping Handles */}
                  {isSelected && Array.from({ length: 6 }).map((_, i) => (
                    <Circle
                      key={i}
                      x={pts[i * 2]}
                      y={pts[i * 2 + 1]}
                      radius={9}
                      fill="#F5C518"
                      stroke="white"
                      strokeWidth={2}
                      draggable
                      onDragMove={(e) => {
                        const newPts = [...pts];
                        newPts[i * 2] = e.target.x();
                        newPts[i * 2 + 1] = e.target.y();
                        onChange({ ...shapeProps, points: newPts });
                      }}
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'move';
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                      shadowBlur={5}
                      shadowColor="black"
                      shadowOpacity={0.5}
                    />
                  ))}
                </Group>
              );
            })()}
          </Group>
        ) : shapeProps.symbolId === 'st-2' ? (
          // T KAVŞAK MOTORU — beyaz gövdeler + kavşak ağzında yumuşak kavis
          // filletleri + siyah kenarlar (st-3/st-4 motoruyla aynı stil)
          <Group>
            {(() => {
              const w = shapeProps.width;
              const h = shapeProps.height;
              const roadWidth = Math.min(w, h) * 0.35;
              const edgeWidth = Math.max(1.5, roadWidth / 20);
              const g = st2JunctionGeometry(w, h, roadWidth);
              return (
                <Group>
                  {/* Gövdeler: yatay yol + gövde */}
                  <Rect x={0} y={h/2 - roadWidth/2} width={w} height={roadWidth} fill="#ffffff" />
                  <Rect x={w/2 - roadWidth/2} y={h/2 - roadWidth/2} width={roadWidth} height={h - h/2 + roadWidth/2} fill="#ffffff" />
                  {/* Fillet köşe yamaları */}
                  {g.fills.map((fl, i) => (
                    <Rect key={`st2-f${i}`} x={fl[0]} y={fl[1]} width={fl[2]} height={fl[3]} fill="#ffffff" />
                  ))}
                  {/* Kesikli orta çizgiler — gövde ağzında kesilir */}
                  {g.dashes.map((d, i) => (
                    <Line key={`st2-d${i}`} points={d} stroke="#000000" strokeWidth={edgeWidth} dash={[20, 20]} lineCap="butt" />
                  ))}
                  {/* Siyah yol kenarları */}
                  {g.edges.map((sg, i) => (
                    <Line key={`st2-e${i}`} points={sg} stroke="#000000" strokeWidth={edgeWidth} lineCap="butt" />
                  ))}
                  {/* Yumuşak kavis filletleri */}
                  {g.arcPaths.map((d, i) => (
                    <Path key={`st2-a${i}`} data={d} stroke="#000000" strokeWidth={edgeWidth} lineCap="butt" />
                  ))}
                </Group>
              );
            })()}
          </Group>
        ) : (shapeProps.symbolId === 'st-3' || shapeProps.symbolId === 'st-4') ? (
          // Advanced Vector Road Junction Engine (Matched to st-1 Style)
          <Group>
            {(() => {
              const w = shapeProps.width;
              const h = shapeProps.height;
              const roadWidth = Math.min(w, h) * 0.35;
              const roadColor = "#ffffff"; // Klasik kroki: beyaz yol gövdesi (st-1 ile uyumlu)
              const lineColor = "#000000";
              const centerDash = [20, 20]; // Matched to st-1
              const centerLineWidth = Math.max(1.5, roadWidth / 20);
              
              if (shapeProps.symbolId === 'st-3') {
                // Y-Junction (st-1 style) — SİYAH yol kenarları: gövde + iki dal,
                // birleşimlerde fillet noktalarında buluşur (st-4 ile aynı stil)
                const edgeWidth = centerLineWidth; // max(1.5, roadWidth/20)
                const edgeSegs = st3EdgeSegments(w, h, roadWidth);
                return (
                  <Group>
                    {/* Road Backgrounds */}
                    <Line points={[w/2, h, w/2, h/2]} stroke={roadColor} strokeWidth={roadWidth} lineCap="butt" />
                    <Line points={[w/2, h/2, 0, 0]} stroke={roadColor} strokeWidth={roadWidth} lineCap="round" />
                    <Line points={[w/2, h/2, w, 0]} stroke={roadColor} strokeWidth={roadWidth} lineCap="round" />
                    
                    {/* Asphalt Hub */}
                    <Circle x={w/2} y={h/2} radius={roadWidth/2} fill={roadColor} />
                    
                    {/* Center Dashed Lines (st-1 style) */}
                    <Line points={[w/2, h, w/2, h/2]} stroke={lineColor} strokeWidth={centerLineWidth} dash={centerDash} lineCap="butt" />
                    <Line points={[w/2, h/2, 0, 0]} stroke={lineColor} strokeWidth={centerLineWidth} dash={centerDash} lineCap="butt" />
                    <Line points={[w/2, h/2, w, 0]} stroke={lineColor} strokeWidth={centerLineWidth} dash={centerDash} lineCap="butt" />
                    
                    {/* Road Edge Lines — siyah yol kenarları (tam opak, ortak geometri) */}
                    {edgeSegs.map((sg, i) => (
                      <Line key={`st3-edge-${i}`} points={sg} stroke={lineColor} strokeWidth={edgeWidth} lineCap="butt" />
                    ))}
                  </Group>
                );
              } else {
                // Artı kavşak (st-4) — MERKEZ HALKA YOK; beyaz gövdeler + kavşak
                // ağızlarında yumuşak kavis filletleri + siyah kenarlar
                // (kullanıcı isteği: ortadaki yuvarlak daire kaldırıldı)
                const edgeWidth = centerLineWidth;
                const g = st4JunctionGeometry(w, h, roadWidth);
                return (
                  <Group>
                    {/* Gövdeler */}
                    <Rect x={w/2 - roadWidth/2} y={0} width={roadWidth} height={h} fill={roadColor} />
                    <Rect x={0} y={h/2 - roadWidth/2} width={w} height={roadWidth} fill={roadColor} />
                    {/* Fillet köşe yamaları */}
                    {g.fills.map((fl, i) => (
                      <Rect key={`st4-f${i}`} x={fl[0]} y={fl[1]} width={fl[2]} height={fl[3]} fill={roadColor} />
                    ))}
                    {/* Kesikli orta çizgiler — kavşak ağzında kesilir */}
                    {g.dashes.map((d, i) => (
                      <Line key={`st4-d${i}`} points={d} stroke={lineColor} strokeWidth={centerLineWidth} dash={centerDash} lineCap="butt" />
                    ))}
                    {/* Siyah yol kenarları */}
                    {g.edges.map((sg, i) => (
                      <Line key={`st4-e${i}`} points={sg} stroke={lineColor} strokeWidth={edgeWidth} lineCap="butt" />
                    ))}
                    {/* Yumuşak kavis filletleri */}
                    {g.arcPaths.map((d, i) => (
                      <Path key={`st4-a${i}`} data={d} stroke={lineColor} strokeWidth={edgeWidth} lineCap="butt" />
                    ))}
                  </Group>
                );
              }
            })()}
          </Group>
        ) : isRoadEngineSymbol(shapeProps.symbolId) ? (
          // Advanced Vector Road Engine with Curvature & Inflection Support
          // (st-1 Düz Yol + st-cadde Cadde + st-sokak Sokak aynı motoru paylaşır)
          <Group ref={(g: any) => patchRoadEngineBounds(g, shapeProps)}>
            {(() => {
              const curv = shapeProps.curvature || 0;
              const w = shapeProps.width;
              const h = shapeProps.height;
              const curvX = shapeProps.curvatureX !== undefined ? shapeProps.curvatureX : w / 2;
              const edgeBase = Math.max(1.5, h / 20); // kenar kalınlığı — st-3/st-4 ile aynı oran
              
              // Quadratic Bezier adjustment:
              // Peak Y follows the handle directly.
              const controlY = h / 2 + (curv * 2);
              const pathData = `M 0 ${h / 2} Q ${curvX} ${controlY} ${w} ${h / 2}`;
              
              return (
                <Group>
                  {/* Road Edge (siyah taban → iki yanda edgeBase kalınlığında yol kenarı) */}
                  <Path
                    data={pathData}
                    stroke="#000000"
                    strokeWidth={h + 2 * edgeBase}
                    lineCap="butt"
                    lineJoin="round"
                  />
                  {/* Road Surface (Beyaz kroki zemini) */}
                  <Path
                    data={pathData}
                    stroke="#ffffff"
                    strokeWidth={h}
                    lineCap="butt"
                    lineJoin="round"
                  />
                  {/* Center Dashed Line (Siyah şerit çizgisi) — cadde/sokakta ve
                      kullanıcı kapatırsa çizilmez (roadMiddleLine) */}
                  {roadShowsMiddleLine(shapeProps) && (
                    <Path
                      data={pathData}
                      stroke="#000000"
                      strokeWidth={edgeBase}
                      dash={[20, 20]}
                      lineCap="butt"
                      lineJoin="round"
                    />
                  )}
                  {/* ── CADDE/SOKAK ADI ETİKETİ ── Yol bandının ortasına yazılır;
                      özellik panelinden girilir. Birleşim geçişlerinin ÜSTÜNE çizilir. */}
                  {!!(shapeProps.streetName || '').trim() && (
                    <Text
                      text={String(shapeProps.streetName)}
                      x={0}
                      y={0}
                      width={w}
                      height={h}
                      align="center"
                      verticalAlign="middle"
                      fontSize={roadNameFontSize(shapeProps)}
                      fontStyle="bold"
                      fontFamily={shapeProps.fontFamily || 'Inter'}
                      fill={shapeProps.distanceColor || '#000000'}
                      listening={false}
                    />
                  )}
                  {/* Curvature & Inflection Handle (Free Move) */}
                  {isSelected && (
                    <Circle
                      x={curvX}
                      y={h / 2 + curv}
                      radius={10}
                      fill="#F5C518"
                      stroke="white"
                      strokeWidth={2}
                      draggable
                      onDragMove={(e) => {
                        const newCurv = e.target.y() - h / 2;
                        const newCurvX = e.target.x();
                        onChange({ 
                          ...shapeProps, 
                          curvature: newCurv,
                          curvatureX: newCurvX
                        });
                      }}
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'move';
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                      shadowBlur={5}
                      shadowColor="black"
                      shadowOpacity={0.5}
                    />
                  )}
                </Group>
              );
            })()}
          </Group>
        ) : shapeProps.symbolId === 'arch-7' ? (
          <Group>
            {(() => {
              const curv = shapeProps.curvature !== undefined ? shapeProps.curvature : 40;
              const w = shapeProps.width;
              const h = shapeProps.height;
              const curvX = shapeProps.curvatureX !== undefined ? shapeProps.curvatureX : w / 2;
              
              // We'll use a Quadratic Bezier path for the curved wall
              const pathData = `M 0 ${h} Q ${curvX} ${h - (curv * 2)} ${w} ${h}`;
              
              return (
                <Group>
                  {/* The Wall Shadow/Base for thickness */}
                  <Path
                    data={pathData}
                    stroke="rgba(0,0,0,0.1)"
                    strokeWidth={12}
                    lineCap="round"
                  />
                  {/* The Actual Wall Line */}
                  <Path
                    data={pathData}
                    stroke="#000000"
                    strokeWidth={8}
                    lineCap="round"
                    lineJoin="round"
                  />
                  
                  {/* Curvature Control Handle */}
                  {isSelected && (
                    <Circle
                      x={curvX}
                      y={h - curv}
                      radius={8}
                      fill="#F5C518"
                      stroke="white"
                      strokeWidth={2}
                      draggable
                      onDragMove={(e) => {
                        const newCurv = h - e.target.y();
                        const newCurvX = e.target.x();
                        onChange({ 
                          ...shapeProps, 
                          curvature: newCurv,
                          curvatureX: newCurvX
                        });
                      }}
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'pointer';
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                      shadowBlur={5}
                      shadowColor="black"
                      shadowOpacity={0.3}
                    />
                  )}
                </Group>
              );
            })()}
          </Group>
        ) : ['arch-w1i', 'arch-w1vi'].includes(shapeProps.symbolId || '') ? (
          // Duvar motoru: karakalem duvar PNG'si %92 şeffaf olduğundan (sadece ince bir
          // çizgi içerir) duvar, klasik kroki görünümüyle DÜZ KOYU ÇUBUK olarak çizilir.
          // Önizlemedeki (KrokiPreview) duvar çubuklarıyla birebir aynı görünüm.
          <Group>
            <Rect
              width={shapeProps.width}
              height={shapeProps.height}
              fill="#2e2e2e"
              strokeEnabled={false}
            />
          </Group>
        ) : ['arch-d1r', 'arch-d1l', 'arch-win', 'arch-d2'].includes(shapeProps.symbolId || '') ? (
          <Group>
            {shapeProps.symbolId === 'arch-win' ? (
              <Group>
                {/* Opaque white background to perfectly cover the wall line */}
                <Rect
                  width={shapeProps.width}
                  height={shapeProps.height}
                  fill="white"
                  strokeEnabled={false}
                />
                {/* Window Detail */}
                <Line
                  points={[0, 0.5, shapeProps.width, 0.5]}
                  stroke="#000"
                  strokeWidth={1}
                />
                <Line
                  points={[0, shapeProps.height - 0.5, shapeProps.width, shapeProps.height - 0.5]}
                  stroke="#000"
                  strokeWidth={1}
                />
                <Line
                  points={[0, shapeProps.height / 2, shapeProps.width, shapeProps.height / 2]}
                  stroke={shapeProps.fill || "#F5C518"}
                  strokeWidth={1.5}
                />
              </Group>
            ) : (
            <>
            {/* KAPI MOTORU (duvar hizası): imaj, nesne kutusunu BİREBİR doldurur
                (offsetY YOK — eski 0.8h kaydırma kapıyı duvardan ~45 px yukarı
                koparıyordu). Kapı görselinin alt %15'lik BEYAZ bandı kutunun
                altına denk gelir; kapı duvar merkez çizgisine oturtulduğunda bu
                bant duvarın üzerinden geçer ve kapı boşluğunu (açıklığı) çizer.
                Emin olmak için bandın bulunduğu bölge ayrıca beyaz vektör olarak
                boyanır (görsel yüklenemezse bile boşluk korunur). */}
            <Rect
              x={0}
              y={shapeProps.height * 0.85}
              width={shapeProps.width}
              height={shapeProps.height * 0.15}
              fill="white"
              listening={false}
            />
            <KonvaImage
              ref={imgRef}
              image={image}
              width={shapeProps.width}
              height={shapeProps.height}
              draggable={false}
              scaleX={shapeProps.scaleX || 1}
              scaleY={shapeProps.scaleY || 1}
              offsetX={(shapeProps.scaleX === -1) ? shapeProps.width : 0}
              offsetY={(shapeProps.scaleY === -1) ? shapeProps.height : 0}
              brightness={0}
            />
            </>
            )}
          </Group>
        ) : ['arch-w1', 'arch-w1v', 'arch-w1i', 'arch-w1vi'].includes(shapeProps.symbolId || '') ? (
          <Rect
            width={shapeProps.width}
            height={shapeProps.height}
            fill={shapeProps.fill || "#000000"}
            strokeWidth={0}
          />
        ) : (shapeProps.symbolId === 'ev-arrow-l' || shapeProps.symbolId === 'ev-arrow-r') ? (
          <Group>
            {/* Dynamic Hollow Arrow Vector - Head size stays relatively consistent */}
            <Path
              data={(() => {
                const w = shapeProps.width;
                const h = shapeProps.height;
                const headSize = Math.min(w * 0.5, 30); // Ok ucu boyutu maksimum 30px
                const stemY1 = h * 0.3;
                const stemY2 = h * 0.7;
                
                if (shapeProps.symbolId === 'ev-arrow-l') {
                  return `M ${w} ${stemY1} L ${w} ${stemY2} L ${headSize} ${stemY2} L ${headSize} ${h} L 0 ${h/2} L ${headSize} 0 L ${headSize} ${stemY1} Z`;
                } else {
                  return `M 0 ${stemY1} L 0 ${stemY2} L ${w - headSize} ${stemY2} L ${w - headSize} ${h} L ${w} ${h/2} L ${w - headSize} 0 L ${w - headSize} ${stemY1} Z`;
                }
              })()}
              fill="rgba(255, 255, 255, 0.1)"
              stroke={shapeProps.fill || "#F5C518"}
              strokeWidth={3}
              lineJoin="round"
              scaleX={shapeProps.scaleX || 1}
              scaleY={shapeProps.scaleY || 1}
              offsetX={(shapeProps.scaleX === -1) ? shapeProps.width : 0}
              offsetY={(shapeProps.scaleY === -1) ? shapeProps.height : 0}
            />
          </Group>
        ) : shapeProps.symbolId === 'ev-callout' ? (
          <Group>
            {/* Dynamic Callout Balloon Vector — Kullanıcı isteği: kenar/köşe
                tutamağıyla balon büyütülüp küçültüldüğünde çerçevesi bozulmadan
                değişir; punto sabit kalır, metin yeniden sarılır. Efektif boyut
                = max(otomatik metin sığma boyutu, nesnenin width/height'ı). */}
            {(() => {
              const text = String(shapeProps.distance || '');
              const fontSize = shapeProps.distanceFontSize || 14;
              const auto = calculateCalloutSize(text, fontSize);
              const w = Math.max(auto.w, shapeProps.width || 0);
              const h = Math.max(auto.h, shapeProps.height || 0);
              const r = 4; // Tight corner radius
              const tailH = h * 0.25;
              const boxH = h - tailH;
              const tailW = Math.min(w * 0.2, 20);
              
              return (
                <Group>
                  <Path
                    data={`
                      M ${r} 0 
                      L ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r}
                      L ${w} ${boxH - r} A ${r} ${r} 0 0 1 ${w - r} ${boxH}
                      L ${r + tailW * 1.5} ${boxH}
                      L ${r} ${h}
                      L ${r + tailW * 0.5} ${boxH}
                      L ${r} ${boxH} A ${r} ${r} 0 0 1 0 ${boxH - r}
                      L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 Z
                    `}
                    fill="transparent"
                    stroke={shapeProps.fill === 'transparent' ? "#000000" : (shapeProps.fill || "#000000")}
                    strokeWidth={2}
                    lineJoin="round"
                    shadowColor="black"
                    shadowBlur={2}
                    shadowOpacity={0.2}
                  />
                  <Text
                    text={text}
                    fontSize={fontSize}
                    fontStyle="bold"
                    fill={shapeProps.distanceColor || '#000000'}
                    width={w}
                    height={boxH}
                    align="center"
                    verticalAlign="middle"
                    lineHeight={1.1}
                    padding={5}
                    listening={false}
                  />
                </Group>
              );
            })()}
          </Group>
        ) : (shapeProps.symbolId === 'ev-arrow-desc' || shapeProps.symbolId === 'ev-arrow-desc-ellipse') ? (
          <Group>
            {/* Dual-Handle Dynamic Arrow Engine with Multi-line Support & Resizing Handles */}
            {(() => {
              const mx = shapeProps.markerX !== undefined ? shapeProps.markerX : 0;
              const my = shapeProps.markerY !== undefined ? shapeProps.markerY : 0;
              const tx = shapeProps.textX !== undefined ? shapeProps.textX : 120;
              const ty = shapeProps.textY !== undefined ? shapeProps.textY : 0;
              const isEllipse = shapeProps.symbolId === 'ev-arrow-desc-ellipse';
              
              const text = String(shapeProps.distance || '');
              const fontSize = shapeProps.distanceFontSize || 12;
              
              // Base measurement
              const lines = text.split('\n');
              const charWidth = fontSize * 0.6;
              const padding = 12;
              const maxLineLength = Math.max(...lines.map(l => l.length), 1);
              
              // If user manually resized, use those values
              const autoW = maxLineLength * charWidth + padding * 2;
              const autoH = lines.length * (fontSize * 1.2) + padding * 2;
              
              const frameW = shapeProps.frameWidth !== undefined ? shapeProps.frameWidth : autoW;
              const frameH = shapeProps.frameHeight !== undefined ? shapeProps.frameHeight : autoH;
              
              // Arrow intersection logic
              const centerX = tx + frameW / 2;
              const centerY = ty + frameH / 2;
              const dx = mx - centerX;
              const dy = my - centerY;
              
              let arrowStartX = centerX;
              let arrowStartY = centerY;
              
              if (dx !== 0 || dy !== 0) {
                if (isEllipse) {
                  // Ellipse intersection logic
                  const rw = frameW / 2;
                  const rh = frameH / 2;
                  const t = 1 / Math.sqrt((dx * dx) / (rw * rw) + (dy * dy) / (rh * rh));
                  arrowStartX = centerX + dx * t;
                  arrowStartY = centerY + dy * t;
                } else {
                  // AABB intersection logic
                  const absDx = Math.abs(dx);
                  const absDy = Math.abs(dy);
                  const halfW = frameW / 2;
                  const halfH = frameH / 2;
                  const scaleX = halfW / absDx;
                  const scaleY = halfH / absDy;
                  const scale = Math.min(scaleX, scaleY);
                  arrowStartX = centerX + dx * scale;
                  arrowStartY = centerY + dy * scale;
                }
              }

              return (
                <Group>
                  {/* The Dynamic Arrow — baş, arrowHead ile orantılı (resize'da büyür/küçülür) */}
                  <Arrow
                    points={[arrowStartX, arrowStartY, mx, my]}
                    pointerLength={shapeProps.arrowHead || 10}
                    pointerWidth={(shapeProps.arrowHead || 10) * 0.8}
                    fill={shapeProps.fill || "#000000"}
                    stroke={shapeProps.fill || "#000000"}
                    strokeWidth={2}
                  />
                  
                  {/* The Frame (Rect or Ellipse) */}
                  {isEllipse ? (
                    <Ellipse
                      x={centerX}
                      y={centerY}
                      radiusX={frameW / 2}
                      radiusY={frameH / 2}
                      fill="transparent"
                      stroke="#000000"
                      strokeWidth={1.5}
                    />
                  ) : (
                    <Rect
                      x={tx}
                      y={ty}
                      width={frameW}
                      height={frameH}
                      fill="transparent"
                      stroke="#000000"
                      strokeWidth={1.5}
                      cornerRadius={0}
                    />
                  )}
                  
                  {/* Centered Text */}
                  <Text
                    x={tx}
                    y={ty}
                    width={frameW}
                    height={frameH}
                    text={text}
                    fontSize={fontSize}
                    fontStyle="bold"
                    lineHeight={1.2}
                    fill="#000000"
                    align="center"
                    verticalAlign="middle"
                    listening={false}
                  />
                  
                  {/* Handles (Visible only when selected) */}
                  {isSelected && (
                    <>
                      {/* Sub-Handle 1: Marker Point (Transparent Zone) */}
                      <Circle
                        x={mx}
                        y={my}
                        radius={15}
                        fill="rgba(245, 197, 24, 0.2)"
                        opacity={0.3}
                        draggable
                        onDragMove={(e) => {
                          onChange({ ...shapeProps, markerX: e.target.x(), markerY: e.target.y() });
                        }}
                        onMouseEnter={(e) => {
                          const s = e.target.getStage();
                          if (s) s.container().style.cursor = 'crosshair';
                        }}
                      />
                      
                      {/* Sub-Handle 2: Center Position (Draggable) */}
                      <Circle
                        x={centerX}
                        y={centerY}
                        radius={15}
                        fill="rgba(59, 130, 246, 0.2)"
                        opacity={0.3}
                        draggable
                        onDragMove={(e) => {
                          onChange({ 
                            ...shapeProps, 
                            textX: e.target.x() - frameW / 2,
                            textY: e.target.y() - frameH / 2
                          });
                        }}
                        onMouseEnter={(e) => {
                          const s = e.target.getStage();
                          if (s) s.container().style.cursor = 'move';
                        }}
                      />

                      {/* Corner Handles for Resizing */}
                      {[
                        { x: tx, y: ty, cursor: 'nw-resize' },
                        { x: tx + frameW, y: ty, cursor: 'ne-resize' },
                        { x: tx, y: ty + frameH, cursor: 'sw-resize' },
                        { x: tx + frameW, y: ty + frameH, cursor: 'se-resize' }
                      ].map((h, i) => (
                        <Rect
                          key={i}
                          x={h.x - 4}
                          y={h.y - 4}
                          width={8}
                          height={8}
                          fill="white"
                          stroke="#000"
                          strokeWidth={1}
                          draggable
                          onDragMove={(e) => {
                            const newX = e.target.x() + 4;
                            const newY = e.target.y() + 4;
                            let newTX = tx;
                            let newTY = ty;
                            let newFW = frameW;
                            let newFH = frameH;

                            if (i === 0) { // NW
                              newTX = newX; newTY = newY;
                              newFW = tx + frameW - newX; newFH = ty + frameH - newY;
                            } else if (i === 1) { // NE
                              newTY = newY;
                              newFW = newX - tx; newFH = ty + frameH - newY;
                            } else if (i === 2) { // SW
                              newTX = newX;
                              newFW = tx + frameW - newX; newFH = newY - ty;
                            } else { // SE
                              newFW = newX - tx; newFH = newY - ty;
                            }
                            
                            onChange({ 
                              ...shapeProps, 
                              textX: newTX, textY: newTY,
                              frameWidth: Math.max(20, newFW),
                              frameHeight: Math.max(20, newFH)
                            });
                          }}
                          onMouseEnter={(e) => {
                            const s = e.target.getStage();
                            if (s) s.container().style.cursor = h.cursor;
                          }}
                          onMouseLeave={(e) => {
                            const s = e.target.getStage();
                            if (s) s.container().style.cursor = 'default';
                          }}
                        />
                      ))}
                    </>
                  )}
                </Group>
              );
            })()}
          </Group>
        ) : shapeProps.symbolId === 'ev-arrowhead' ? (
          <Group>
            {/* Hollow Arrowhead Vector */}
            <Path
              data={`M 0 0 L ${shapeProps.width} ${shapeProps.height / 2} L 0 ${shapeProps.height} Z`}
              fill="rgba(255, 255, 255, 0.01)"
              stroke={shapeProps.fill || "#000000"}
              strokeWidth={3}
              lineJoin="round"
              scaleX={shapeProps.scaleX || 1}
              scaleY={shapeProps.scaleY || 1}
              offsetX={(shapeProps.scaleX === -1) ? shapeProps.width : 0}
              offsetY={(shapeProps.scaleY === -1) ? shapeProps.height : 0}
            />
          </Group>
        ) : (shapeProps.symbolId?.startsWith('ev-rect-') || shapeProps.symbolId?.startsWith('ev-square-') || shapeProps.symbolId?.startsWith('ev-triangle-') || shapeProps.symbolId?.startsWith('ev-lshape-') || shapeProps.symbolId === 'ev-star' || shapeProps.symbolId === 'ev-crack') ? (
          <Group>
            {/* Geometric & Forensic Shape Engine (Rect, Square, Triangle, L-Shape, Star, Crack) */}
            {shapeProps.symbolId === 'ev-star' ? (
              <Path
                data="M50 5L63.5 35.5L95 40L72 62.5L77.5 94L50 79L22.5 94L28 62.5L5 40L36.5 35.5L50 5Z"
                fill={shapeProps.fill || "#000000"}
                scaleX={shapeProps.width / 100}
                scaleY={shapeProps.height / 100}
              />
            ) : shapeProps.symbolId === 'ev-crack' ? (
              <Path
                data="M50 50L60 20L55 10M50 50L80 60L90 55M50 50L40 85L45 95M50 50L15 40L5 45M50 50L70 80L75 70M50 50L25 20L20 30"
                stroke={shapeProps.fill || "#000000"}
                strokeWidth={2}
                lineCap="round"
                lineJoin="round"
                scaleX={shapeProps.width / 100}
                scaleY={shapeProps.height / 100}
              />
            ) : shapeProps.symbolId?.startsWith('ev-lshape') ? (
              <Path
                data="M10 10V90H90V70H30V10H10Z"
                fill={(shapeProps.symbolId?.includes('solid')) ? (shapeProps.fill || "#000000") : "transparent"}
                stroke={shapeProps.fill || "#000000"}
                strokeWidth={shapeProps.symbolId?.includes('hollow') ? 3 : 0}
                lineJoin="round"
                scaleX={shapeProps.width / 100}
                scaleY={shapeProps.height / 100}
              />
            ) : shapeProps.symbolId?.includes('triangle') ? (
              <Line
                points={[shapeProps.width / 2, 0, shapeProps.width, shapeProps.height, 0, shapeProps.height]}
                closed
                fill={(shapeProps.symbolId?.includes('solid')) ? (shapeProps.fill || "#000000") : "transparent"}
                stroke={shapeProps.fill || "#000000"}
                strokeWidth={shapeProps.symbolId?.includes('hollow') ? 3 : 0}
              />
            ) : (
              <Rect
                width={shapeProps.width}
                height={shapeProps.height}
                fill={(shapeProps.symbolId?.includes('solid')) ? (shapeProps.fill || "#000000") : "transparent"}
                stroke={shapeProps.fill || "#000000"}
                strokeWidth={shapeProps.symbolId?.includes('hollow') ? 3 : 0}
              />
            )}
          </Group>
        ) : shapeProps.symbolId === 'ev-ruler-straight' ? (
          <Group
            scaleX={shapeProps.scaleX || 1}
            scaleY={shapeProps.scaleY || 1}
            offsetX={(shapeProps.scaleX === -1) ? shapeProps.width : 0}
            offsetY={(shapeProps.scaleY === -1) ? shapeProps.height : 0}
          >
            {(() => {
              const w = shapeProps.width;
              const h = shapeProps.height;
              const tickSpacing = 20;
              const elements = [];
              const flipX = shapeProps.scaleX === -1;
              const flipY = shapeProps.scaleY === -1;

              elements.push(
                <Rect
                  key="bg"
                  width={w}
                  height={h}
                  fill={shapeProps.fill || "#F5C518"}
                  stroke="#000"
                  strokeWidth={1}
                  shadowColor="black"
                  shadowBlur={2}
                  shadowOpacity={0.3}
                />
              );

              for (let i = 0; i <= w / tickSpacing; i++) {
                const isMajor = i % 5 === 0;
                const tickLen = isMajor ? h * 0.4 : h * 0.2;
                elements.push(
                  <Line key={`tick-${i}`} points={[i * tickSpacing, 0, i * tickSpacing, tickLen]} stroke="#000" strokeWidth={1} />
                );
                if (isMajor && i > 0) {
                  elements.push(
                    <Text 
                      key={`num-${i}`} 
                      text={`${i}`} 
                      x={i * tickSpacing - 4} 
                      y={tickLen + 2} 
                      fontSize={10} 
                      fill="#000" 
                      scaleX={flipX ? -1 : 1}
                      scaleY={flipY ? -1 : 1}
                      offsetX={flipX ? 10 : 0}
                      offsetY={flipY ? 10 : 0}
                    />
                  );
                }
              }
              return elements;
            })()}
          </Group>
        ) : shapeProps.symbolId === 'ev-ruler-l' ? (
          <Group
            scaleX={shapeProps.scaleX || 1}
            scaleY={shapeProps.scaleY || 1}
            offsetX={(shapeProps.scaleX === -1) ? shapeProps.width : 0}
            offsetY={(shapeProps.scaleY === -1) ? shapeProps.height : 0}
          >
            {(() => {
              const w = shapeProps.width;
              const h = shapeProps.height;
              const thick = 20;
              const tickSpacing = 20;
              const elements = [];
              const flipX = shapeProps.scaleX === -1;
              const flipY = shapeProps.scaleY === -1;

              elements.push(
                <Path
                  key="bg"
                  data={`M 0 0 L ${thick} 0 L ${thick} ${h - thick} L ${w} ${h - thick} L ${w} ${h} L 0 ${h} Z`}
                  fill={shapeProps.fill || "#F5C518"}
                  stroke="#000"
                  strokeWidth={1}
                  shadowColor="black"
                  shadowBlur={2}
                  shadowOpacity={0.3}
                />
              );

              for (let x = thick; x <= w; x += tickSpacing) {
                const val = (x - thick) / tickSpacing;
                const isMajor = val % 5 === 0;
                const tickLen = isMajor ? 8 : 4;
                elements.push(
                  <Line key={`hx-${x}`} points={[x, h - thick, x, h - thick + tickLen]} stroke="#000" strokeWidth={1} />
                );
                if (isMajor && val > 0) {
                  elements.push(
                    <Text 
                      key={`hn-${x}`} 
                      text={`${val}`} 
                      x={x - 4} 
                      y={h - thick + tickLen + 1} 
                      fontSize={8} 
                      fill="#000" 
                      scaleX={flipX ? -1 : 1}
                      scaleY={flipY ? -1 : 1}
                      offsetX={flipX ? 8 : 0}
                      offsetY={flipY ? 8 : 0}
                    />
                  );
                }
              }

              for (let y = h - thick; y >= 0; y -= tickSpacing) {
                const val = (h - thick - y) / tickSpacing;
                if (val === 0) continue;
                const isMajor = val % 5 === 0;
                const tickLen = isMajor ? 8 : 4;
                elements.push(
                  <Line key={`vy-${y}`} points={[thick - tickLen, y, thick, y]} stroke="#000" strokeWidth={1} />
                );
                if (isMajor) {
                  elements.push(
                    <Text 
                      key={`vn-${y}`} 
                      text={`${val}`} 
                      x={2} 
                      y={y - 4} 
                      fontSize={8} 
                      fill="#000"
                      scaleX={flipX ? -1 : 1}
                      scaleY={flipY ? -1 : 1}
                      offsetX={flipX ? 8 : 0}
                      offsetY={flipY ? 8 : 0}
                    />
                  );
                }
              }
              
              return elements;
            })()}
          </Group>
        ) : shapeProps.symbolId === 'ev-camera-link' ? (
          <Group
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {(() => {
              const w = shapeProps.width;
              const h = shapeProps.height;
              const hasPhoto = !!shapeProps.photo || (shapeProps.photos && shapeProps.photos.length > 0);
              
              return (
                <Group>
                  {/* Camera Icon Base */}
                  <KonvaImage
                    image={image}
                    width={w}
                    height={h}
                    filters={hasPhoto ? [] : [Konva.Filters.Grayscale]}
                    ref={imgRef}
                  />
                  
                  {/* Directional Indicator (Arrow) */}
                  <Arrow
                    points={[w/2, 0, w/2, -15]}
                    pointerLength={10}
                    pointerWidth={8}
                    fill={hasPhoto ? "#3b82f6" : "#F5C518"}
                    stroke={hasPhoto ? "#3b82f6" : "#F5C518"}
                    strokeWidth={2}
                  />

                  {/* Photo Badge */}
                  {hasPhoto && (
                    <Circle
                      x={w}
                      y={0}
                      radius={6}
                      fill="#3b82f6"
                      stroke="white"
                      strokeWidth={1}
                    />
                  )}

                  {/* Yardım Baloncuğu - Sadece fotoğraf yoksa göster */}
                  {showTooltip && !hasPhoto && (
                    <Label x={w / 2} y={-50} listening={false}>
                      <Tag fill="#000" pointerDirection="down" pointerWidth={10} pointerHeight={8} lineJoin="round" shadowColor="black" shadowBlur={10} shadowOpacity={0.6} />
                      <Text text="Tıklayarak fotoğraf yükleyin veya görüntüleyin" fill="white" fontSize={12} padding={8} fontStyle="bold" />
                    </Label>
                  )}
                </Group>
              );
            })()}
          </Group>
        ) : shapeProps.symbolId === 'ev-bpa-drop' ? (
          <Group
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {(() => {
              const w = shapeProps.width;
              const h = shapeProps.height;
              const tailLen = shapeProps.tailLength || 100;
              
              return (
                <Group>
                  {/* The Trajectory Tail (Projecting back to origin) */}
                  <Line
                    points={[w / 2, h, w / 2, h + tailLen]}
                    stroke="#990000"
                    strokeWidth={2}
                    dash={[5, 5]}
                    opacity={0.6}
                  />
                  
                  {/* The Blood Drop Shape (Vector Path) */}
                  <Path
                    data={`M ${w/2} 0 C ${w/6} ${h/2} ${w/6} ${h} ${w/2} ${h} C ${5*w/6} ${h} ${5*w/6} ${h/2} ${w/2} 0`}
                    fill="#990000"
                    stroke="white"
                    strokeWidth={1}
                    onMouseEnter={() => setShowTooltip(true)}
                  />

                  {/* Tail Length Handle */}
                  {isSelected && (
                    <Circle
                      x={w / 2}
                      y={h + tailLen}
                      radius={6}
                      fill="white"
                      stroke="#990000"
                      strokeWidth={2}
                      draggable
                      onDragMove={(e) => {
                        const newLen = Math.max(20, e.target.y() - h);
                        onChange({ ...shapeProps, tailLength: newLen });
                      }}
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'ns-resize';
                        setShowTooltip(true);
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                    />
                  )}


                </Group>
              );
            })()}
          </Group>
        ) : shapeProps.symbolId === 'ev-shooting-trajectory' ? (
          <Group>
            {/* Interactive Shooting Trajectory Engine */}
            {(() => {
              const sx = shapeProps.startX !== undefined ? shapeProps.startX : 0;
              const sy = shapeProps.startY !== undefined ? shapeProps.startY : 150;
              const ex = shapeProps.endX !== undefined ? shapeProps.endX : 150;
              const ey = shapeProps.endY !== undefined ? shapeProps.endY : 0;
              
              const dx = ex - sx;
              const dy = ey - sy;
              const angle = Math.atan2(dy, dx) * 180 / Math.PI;
              const dist = Math.sqrt(dx*dx + dy*dy);

              return (
                <Group>
                  {/* Trajectory Line */}
                  <Line
                    points={[sx, sy, ex, ey]}
                    stroke="#ff0000"
                    strokeWidth={2.5}
                    dash={[10, 5]}
                    lineCap="round"
                  />
                  
                  {/* Origin Point (Muzzle/Source) */}
                  <Group x={sx} y={sy}>
                    <Circle radius={10} stroke="#ff0000" strokeWidth={1.5} fill="white" />
                    <Line points={[-8, 0, 8, 0]} stroke="#ff0000" strokeWidth={1} />
                    <Line points={[0, -8, 0, 8]} stroke="#ff0000" strokeWidth={1} />
                  </Group>

                  {/* Impact Point (Bullet Hole) */}
                  <Group x={ex} y={ey}>
                    <Circle radius={6} fill="#ff0000" />
                    <Circle radius={12} stroke="#ff0000" strokeWidth={1.5} dash={[2, 2]} />
                  </Group>

                  {/* Angle and Distance Label - Parallel to the line */}
                  {(() => {
                    let displayAngle = angle;
                    // Flip text if it's upside down (between 90 and 270 degrees)
                    if (displayAngle > 90 || displayAngle < -90) {
                      displayAngle += 180;
                    }
                    
                    const displayDist = shapeProps.distance || `${Math.round(dist)}cm`;
                    const az = shapeProps.azimuth;
                    const tl = shapeProps.tilt;
                    
                    const hasTechnicalData = (az !== undefined && az !== 0) || (tl !== undefined && tl !== 0);
                    const labelText = hasTechnicalData 
                      ? `${Math.round(Math.abs(angle))}° / ${displayDist}\nYa: ${az || 0}° Di: ${tl || 0}°`
                      : `${Math.round(Math.abs(angle))}° / ${displayDist}`;

                    return (
                      <Group 
                        x={(sx + ex) / 2} 
                        y={(sy + ey) / 2} 
                        rotation={displayAngle}
                        onClick={(e) => {
                          e.cancelBubble = true;
                          onOpenDistanceModal(shapeProps.id, shapeProps.distance || Math.round(dist).toString());
                        }}
                        onTap={(e) => {
                          e.cancelBubble = true;
                          onOpenDistanceModal(shapeProps.id, shapeProps.distance || Math.round(dist).toString());
                        }}
                      >
                        <Rect 
                          width={hasTechnicalData ? 90 : 74} 
                          height={hasTechnicalData ? 32 : 18} 
                          fill="rgba(0,0,0,0.8)" 
                          cornerRadius={4}
                          offsetX={hasTechnicalData ? 45 : 37} 
                          offsetY={hasTechnicalData ? 35 : 20}
                        />
                        <Text 
                          text={labelText} 
                          fill="#ffffff" 
                          fontSize={hasTechnicalData ? 9 : 10} 
                          fontStyle="bold" 
                          align="center" 
                          verticalAlign="middle"
                          width={hasTechnicalData ? 90 : 74} 
                          offsetX={hasTechnicalData ? 45 : 37} 
                          offsetY={hasTechnicalData ? 31 : 16}
                          lineHeight={1.2}
                        />
                      </Group>
                    );
                  })()}

                  {/* Drag Handles */}
                  {isSelected && (
                    <>
                      <Circle
                        x={sx} y={sy} radius={12} fill="rgba(255,0,0,0.1)" stroke="#ff0000" strokeWidth={1} draggable
                        onDragMove={(e) => {
                          const newSx = e.target.x();
                          const newSy = e.target.y();
                          const dx = ex - newSx;
                          const dy = ey - newSy;
                          const newAz = Math.round(Math.atan2(dy, dx) * 180 / Math.PI + 90);
                          const newLen = Math.round(Math.sqrt(dx*dx + dy*dy));
                          onChange({ 
                            ...shapeProps, 
                            startX: newSx, 
                            startY: newSy,
                            azimuth: (newAz + 360) % 360,
                            length: newLen
                          });
                        }}
                        onMouseEnter={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'crosshair';
                        }}
                        onMouseLeave={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'default';
                        }}
                        onDragEnd={() => {
                          if (onTrajectoryUpdate) onTrajectoryUpdate(shapeProps.id);
                        }}
                      />
                      <Circle
                        x={ex} y={ey} radius={12} fill="rgba(255,0,0,0.1)" stroke="#ff0000" strokeWidth={1} draggable
                        onDragMove={(e) => {
                          const newEx = e.target.x();
                          const newEy = e.target.y();
                          const dx = newEx - sx;
                          const dy = newEy - sy;
                          const newAz = Math.round(Math.atan2(dy, dx) * 180 / Math.PI + 90);
                          const newLen = Math.round(Math.sqrt(dx*dx + dy*dy));
                          onChange({ 
                            ...shapeProps, 
                            endX: newEx, 
                            endY: newEy,
                            azimuth: (newAz + 360) % 360,
                            length: newLen
                          });
                        }}
                        onMouseEnter={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'crosshair';
                        }}
                        onMouseLeave={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'default';
                        }}
                        onDragEnd={() => {
                          if (onTrajectoryUpdate) onTrajectoryUpdate(shapeProps.id);
                        }}
                      />
                    </>
                  )}
                </Group>
              );
            })()}
          </Group>
        ) : shapeProps.symbolId === 'ev-angle-ruler' ? (
          <Group>
            {(() => {
              const w = shapeProps.width;
              const h = shapeProps.height;
              
              // Points logic: Vertex is always at [0, h], Arm1 is horizontal, Arm2 is angled
              // We use rotation and scaling for overall placement, 
              // but the 'angle' itself is a property.
              const angleVal = shapeProps.angle || 45;
              const armLength = Math.max(w, h);
              
              // Calculate Arm 2 end point based on angle
              const rad = (angleVal * Math.PI) / 180;
              const p2x = Math.cos(-rad) * armLength;
              const p2y = h + Math.sin(-rad) * armLength;

              return (
                <Group>
                  {/* Arm 1 (Base - Horizontal) */}
                  <Line
                    points={[0, h, armLength, h]}
                    stroke="#F5C518"
                    strokeWidth={4}
                    lineCap="round"
                  />
                  {/* Arm 2 (Angled) */}
                  <Line
                    points={[0, h, p2x, p2y]}
                    stroke="#F5C518"
                    strokeWidth={4}
                    lineCap="round"
                  />
                  {/* Angle Arc */}
                  <Arc
                    x={0}
                    y={h}
                    innerRadius={30}
                    outerRadius={35}
                    angle={angleVal}
                    rotation={-angleVal}
                    fill="#F5C518"
                    opacity={0.4}
                  />
                  {/* Angle Text */}
                  <Text
                    x={40}
                    y={h - 30}
                    text={`${Math.round(angleVal)}°`}
                    fontSize={18}
                    fontStyle="bold"
                    fill="#F5C518"
                    align="center"
                  />

                  {/* Interactive Angle Handle */}
                  {isSelected && (
                    <Circle
                      x={p2x}
                      y={p2y}
                      radius={10}
                      fill="white"
                      stroke="#F5C518"
                      strokeWidth={2}
                      draggable
                      onDragMove={(e) => {
                        const dx = e.target.x() - 0;
                        const dy = e.target.y() - h;
                        let newAngle = Math.atan2(-dy, dx) * 180 / Math.PI;
                        if (newAngle < 0) newAngle += 360;
                        onChange({
                          ...shapeProps,
                          angle: newAngle
                        });
                      }}
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'crosshair';
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                      shadowBlur={5}
                      shadowColor="black"
                      shadowOpacity={0.5}
                    />
                  )}
                </Group>
              );
            })()}
          </Group>
        ) : shapeProps.type === 'finding-list' ? (
          <Group>
            {(() => {
              const findings = allObjects
                ?.filter((o: any) => o.findingNo)
                .sort((a: any, b: any) => (a.findingNo || '').localeCompare(b.findingNo || '', undefined, { numeric: true })) || [];

              const itemsWithPosition: any[] = [];
              let currentY = 0;
              const textWidth = shapeProps.width - 16;
              const charWidth = 4.5; // average width per char for font size 9
              const prefixWidth = 54;
              const descWidth = textWidth - prefixWidth;
              const charsPerDescLine = descWidth / charWidth;

              findings.forEach((obj: any) => {
                const prefix = `Bulgu No. ${obj.findingNo}:`;
                const desc = obj.findingDesc || obj.name || '';
                const lines = Math.max(1, Math.ceil(desc.length / charsPerDescLine));
                const itemHeight = lines * 11 + 6;
                
                itemsWithPosition.push({ obj, prefix, desc, y: currentY, prefixWidth, descWidth });
                currentY += itemHeight;
              });

              const totalHeight = Math.max(100, currentY + 40);

              return (
                <>
                  <Rect 
                    width={shapeProps.width}
                    height={totalHeight}
                    fill="rgba(255, 255, 255, 0.9)"
                    stroke="#000"
                    strokeWidth={1}
                  />
                  <Text 
                    text="BULGU LİSTESİ"
                    width={shapeProps.width}
                    y={5}
                    align="center"
                    fontSize={11}
                    fontStyle="bold"
                    fill="#000"
                  />
                  <Line points={[5, 20, shapeProps.width - 5, 20]} stroke="#000" strokeWidth={1} />
                  
                  <Group y={25}>
                    {itemsWithPosition.map((item) => (
                      <Group key={item.obj.id}>
                        <Text
                          text={item.prefix}
                          y={item.y}
                          x={8}
                          fontSize={9}
                          fontStyle="bold"
                          fill="#000"
                          width={item.prefixWidth}
                          wrap="none"
                        />
                        <Text
                          text={item.desc}
                          y={item.y}
                          x={8 + item.prefixWidth}
                          fontSize={9}
                          fill="#000"
                          width={item.descWidth}
                          wrap="word"
                        />
                      </Group>
                    ))}
                  </Group>
                </>
              );
            })()}
          </Group>
        ) : (shapeProps.symbolId === 'ev-circle' || shapeProps.symbolId === 'ev-square') ? (
          <Group>
            {shapeProps.symbolId === 'ev-circle' ? (
              <Circle
                width={shapeProps.width}
                height={shapeProps.height}
                x={shapeProps.width / 2}
                y={shapeProps.height / 2}
                fill="#F5C518"
                stroke="#000"
                strokeWidth={2}
                shadowBlur={5}
                shadowOpacity={0.3}
              />
            ) : (
              <Rect
                width={shapeProps.width}
                height={shapeProps.height}
                fill="#F5C518"
                stroke="#000"
                strokeWidth={2}
                shadowBlur={5}
                shadowOpacity={0.3}
              />
            )}
            <Text
              text={String(shapeProps.findingNo ?? '')}
              width={shapeProps.width}
              height={shapeProps.height}
              align="center"
              verticalAlign="middle"
              fontSize={shapeProps.width * 0.4}
              fontStyle="bold"
              fill="#000"
            />
          </Group>
        ) : shapeProps.symbolId === 'a-4' ? (
          <Group>
            <Line
              points={[0, shapeProps.height / 2, shapeProps.width, shapeProps.height / 2]}
              stroke="#000000"
              strokeWidth={3}
              lineCap="round"
              opacity={1}
            />
            {/* st-5 tarzı İÇİ BOŞ chevron uçlar (dolu üçgen değil) */}
            <Line
              points={chevronHeadPoints(0, shapeProps.height / 2, shapeProps.width, shapeProps.height / 2, shapeProps.arrowHead || 10)}
              stroke="#000000"
              strokeWidth={3}
              lineCap="round"
              lineJoin="round"
              opacity={1}
            />
            <Line
              points={chevronHeadPoints(shapeProps.width, shapeProps.height / 2, 0, shapeProps.height / 2, shapeProps.arrowHead || 10)}
              stroke="#000000"
              strokeWidth={3}
              lineCap="round"
              lineJoin="round"
              opacity={1}
            />
          </Group>
        ) : effectiveTileMode !== 'stretch' && image ? (
          // UZATMA MOTORU v4 (ekran) — desen tekrarı: uzatınca desen bozulmaz.
          // composedStrip varsa KAPAK+KESİT kompoziti (uçlar sabit, orta bant tekrar);
          // değilse metadata'lı bütün-görsel karo (strip-x/strip-y/tile).
          <Rect
            width={shapeProps.width}
            height={shapeProps.height}
            fillPatternImage={(composedStrip || image) as HTMLImageElement}
            fillPatternRepeat={composedStrip ? 'no-repeat' : tilePattern.repeat}
            fillPatternScale={composedStrip ? { x: 1, y: 1 } : { x: tilePattern.scale, y: tilePattern.scale }}
            opacity={shapeProps.opacity ?? 1}
            scaleX={shapeProps.scaleX || 1}
            scaleY={shapeProps.scaleY || 1}
            offsetX={(shapeProps.scaleX === -1) ? shapeProps.width : 0}
            offsetY={(shapeProps.scaleY === -1) ? shapeProps.height : 0}
            filters={shapeProps.symbolId === 'tr-2' ? [Konva.Filters.Grayscale, RemoveWhiteFilter] : undefined}
            onMouseMove={() => {
              if (shapeProps.symbolId === 'tr-2' && imgRef.current) imgRef.current.cache();
            }}
          />
        ) : (
           <KonvaImage
            ref={imgRef}
            image={image}
            width={shapeProps.width}
            height={shapeProps.height}
            opacity={shapeProps.opacity ?? 1}
            globalCompositeOperation="source-over"
            draggable={false}
            imageSmoothingEnabled={true}
            scaleX={shapeProps.scaleX || 1}
            scaleY={shapeProps.scaleY || 1}
            offsetX={(shapeProps.scaleX === -1) ? shapeProps.width : 0}
            offsetY={(shapeProps.scaleY === -1) ? shapeProps.height : 0}
          />
        )}

        {shapeProps.distance && !['ev-arrow-desc', 'ev-arrow-desc-ellipse', 'ev-callout', 'ev-shooting-trajectory'].includes(shapeProps.symbolId || '') && (
          (() => {
            const isDistanceTool = shapeProps.isDistanceArrow || shapeProps.symbolId === 'a-4';

            // Etiket çizgi ORTASINA konumlanır: koordinatlı oklarda (startX/endX tanımlı)
            // grup orijini zaten çizginin orta noktasıdır → yerel (0,0). Koordinatsız
            // (kütüphaneden sürüklenmiş) oklarda çizgi 0..w yayılımındadır → (w/2, h/2).
            // ESKİ DAVRANIŞ (hata): koordinatlı oklarda da (w/2, h/2) kullanılıyordu;
            // etiket orta nokta yerine ok ucuna düşüyordu.
            const hasArrowCoords = shapeProps.startX !== undefined && shapeProps.endX !== undefined;
            const textX = isDistanceTool ? (hasArrowCoords ? 0 : shapeProps.width / 2) : 0;
            const textY = isDistanceTool ? (hasArrowCoords ? 0 : shapeProps.height / 2) : 0;

            const angle = isDistanceTool && shapeProps.startX !== undefined
              ? Math.atan2(shapeProps.endY - shapeProps.startY, shapeProps.endX - shapeProps.startX) * (180 / Math.PI)
              : 0;

            // Normalize angle for readability
            let textRotation = angle;
            if (textRotation > 90) textRotation -= 180;
            if (textRotation < -90) textRotation += 180;

            const fontSize = shapeProps.distanceFontSize || ((shapeProps.isDistanceArrow || shapeProps.symbolId === 'a-4') ? 10 : 14);

            // RAKAM KONUM OFSETİ: kullanıcı etiketi sürükleyebilir (kullanıcı isteği).
            // Ofset nesne-yerel uzaydadır; PDF dışa aktarımı aynı ofseti kullanır.
            const lo = shapeProps.labelOffset || { dx: 0, dy: 0 };
            // ÇOK SATIRLI ETİKET (kullanıcı isteği: satır ayarlama): Enter ile alt alta
            // satırlar; en uzun satır genişliği belirler. SATIR ARALIĞI lh ile uygulanır.
            const labelFull = String(shapeProps.text || shapeProps.distance || '');
            const labelLines = labelFull.split('\n');
            const labelLongest = labelLines.reduce((m: number, l: string) => Math.max(m, l.length), 1);
            const labelLh = shapeProps.lineHeight || 1;
            const labelW = Math.max(30, Math.min(420, labelLongest * fontSize * 0.75 + 12));
            const autoGX = isDistanceTool ? textX : 0;
            const autoGY = isDistanceTool ? textY : (
              shapeProps.symbolId === 'ev-arrow-text' ? -20 : 
              shapeProps.symbolId === 'ev-callout' ? 0 :
              (shapeProps.isDistanceArrow || shapeProps.symbolId === 'a-4') 
                ? (shapeProps.height / 2)
                : (shapeProps.height ? Number(shapeProps.height) + 5 : 50)
            );

            return (
              <Group 
                x={autoGX + lo.dx} 
                y={autoGY + lo.dy}
                rotation={textRotation}
                draggable
                onDragEnd={(e: any) => {
                  const nd = e.target;
                  onChange({
                    ...shapeProps,
                    labelOffset: { dx: nd.x() - autoGX, dy: nd.y() - autoGY },
                  });
                }}
                onMouseEnter={(e: any) => {
                  const stg = e.target.getStage?.();
                  if (stg) stg.container().style.cursor = 'move';
                }}
                onMouseLeave={(e: any) => {
                  const stg = e.target.getStage?.();
                  if (stg) stg.container().style.cursor = 'default';
                }}
              >
                {/* Distance Text (Above Line) — genişlik METNE göre: sabit 400px
                    kutu grup sınırlarını şişirip seçim çerçevesini oktan uzun
                    yapıyordu (kullanıcı raporu: çerçeve ok boyunda olsun). */}
                {/* GÖRİNMEZ TIKLAMA BÖLGESİ: metin listening=false olduğu için grup
                    tıklanamazdı (kullanıcı rakamı sürükleyemiyordu). Şeffaf dolgulu Rect
                    hit-test'i grup üstüne taşır (ekranda görünmez). Yükseklik çok
                    satırlı etiketlerde tüm satırları kapsar. */}
                <Rect
                  x={-(labelW + 10) / 2}
                  y={-fontSize - 11}
                  width={labelW + 10}
                  height={fontSize * labelLh * Math.max(1, labelLines.length - 1) + fontSize + 19}
                  fill="transparent"
                />
                <Text
                  text={labelFull}
                  fontSize={fontSize}
                  fontStyle="bold"
                  fill={shapeProps.distanceColor || '#000000'}
                  x={0}
                  y={-fontSize - 8}
                  width={labelW}
                  align="center"
                  padding={0}
                  listening={false}
                  offsetX={labelW / 2}
                  lineHeight={labelLh}
                  wrap="none"
                />
                
                {/* Speed Text (Below Line) - Conditional */}
                {shapeProps.showSpeedInfo && (() => {
                  const rawText = String(shapeProps.text || shapeProps.distance || '');
                  // Extract numbers from text (e.g. "45 metre" -> 45)
                  const match = rawText.match(/\d+(\.\d+)?/);
                  const cm = match ? parseFloat(match[0]) : NaN;
                  
                  if (!isNaN(cm) && cm > 0) {
                    // If the user wrote something like "45 metre", assume they mean meters?
                    // No, usually the system works in CM (50px = 1m).
                    // If the value is small (e.g. < 50), they might be typing meters.
                    // But for consistency, we'll follow the canvas scale.
                    const meters = rawText.toLowerCase().includes('metre') ? cm : cm / 100;
                    const mu = shapeProps.mu || 0.75;
                    const efficiency = shapeProps.efficiency || 100;
                    const speed = Math.round(15.94 * Math.sqrt(mu * meters * (efficiency / 100)));
                    return (
                      <Text
                        text={`(~${speed} km/s)`}
                        fontSize={fontSize * 0.85}
                        fontStyle="italic bold"
                        fill="#059669" // Emerald-600
                        x={0}
                        y={5}
                        width={Math.max(40, fontSize * 0.85 * 10)}
                        align="center"
                        padding={0}
                        listening={false}
                        offsetX={Math.max(20, fontSize * 0.85 * 5)}
                        wrap="none"
                      />
                    );
                  }
                  return null;
                })()}
              </Group>
            );
          })()
        )}

        {/* Finding No Label for all symbols */}
        {shapeProps.findingNo && !['ev-circle', 'ev-square', 'finding-list'].includes(shapeProps.symbolId || '') && (
          <Group 
            x={shapeProps.width / 2} 
            y={-15}
          >
            <Circle
              radius={8}
              fill="#F5C518"
              stroke="#000"
              strokeWidth={1}
            />
            <Text
              text={String(shapeProps.findingNo)}
              fontSize={9}
              fontStyle="bold"
              fill="#000"
              width={16}
              height={16}
              align="center"
              verticalAlign="middle"
              offsetX={8}
              offsetY={8}
            />
          </Group>
        )}

      </Group>

      {/* ── YOL BİRLEŞİM GEÇİŞLERİ (kanvas uzayı, ana grubun DIŞINDA) ──
          Ana grubun içinde dursaydı kırpılmış ped içerikleri Transformer
          sınırlarını yoldan uzun gösterirdi (kullanıcı raporu). Ayrı grup:
          hem sınırları bozmaz hem de lokal dönüşüm gerektirmez. Her iki yol
          aynı op listesini çizer (idempotent) → sıra fark etmez. */}
      {isRoadEngineSymbol(shapeProps.symbolId) && allObjects && (() => {
        const jxOps = computeRoadJunctionOps(shapeProps, allObjects);
        if (!jxOps.length) return null;
        return <Group listening={false}>{jxRenderKonva(jxOps)}</Group>;
      })()}

      {isSelected && (!shapeProps.isTemplate || (shapeProps.id === 'corporate-logo' && isAdmin)) && (
        <Transformer
          ref={trRef}
          rotateEnabled={
            shapeProps.type !== 'rect' && 
            shapeProps.type !== 'line' && 
            !['arch-1', 'arch-1v'].includes(shapeProps.symbolId || '')
          }
          enabledAnchors={
            // TÜM nesnelerde (metin kutuları dahil) köşe + kenar (orta) tutamaçları aktif
            // (kullanıcı isteği: tüm sembollerin çerçevesinde köşe ve kenar tutamaçları olsun).
            // Metinde punto tutamaçla değişmez: kutu boyutlanır, yazı aynı puntoyla yeniden sarılır.
            [
              'top-left', 'top-center', 'top-right',
              'middle-left', 'middle-right',
              'bottom-left', 'bottom-center', 'bottom-right',
            ]
          }
          keepRatio={shapeProps.categoryId === 'furniture' ? true : !isStretchable}
          boundBoxFunc={(oldBox, newBox) => {
            // NEGATİF KUTU = KONVA FLIP'İ: tutamaç karşı kenarın ötesine taşınırsa Konva
            // nesneyi aynalar (scaleX/scaleY negatife döner). TransformEnd kaydı negatif
            // ölçeği yazmadığı için nesne 1px'e çöküyordu (kullanıcı raporu: uzatma
            // siliniyor). Flip yerine çerçeve eski hâlinde sabitlenir.
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }

            // DÖNDÜRME JESTİ = SERBEST (kullanıcı raporu: "mesafe okunu çevirdiğimde grid
            // kareli alanda kısıtlanıyor"). Döndürürken nesnenin çerçevesi büyür; sayfa
            // sınırı kelepçesi bu büyümeyi küçültme (scale) olarak geri yazıyor, ok
            // çevrildikçe kısalıp deforme oluyordu. Açı değiştiyse (döndürme jesti)
            // kelepçe hiç uygulanmaz — kullanıcı nesneyi istediği açıda çevirir.
            // Büyütme/küçültme jestlerinde (açı sabit) aşağıdaki sayfa sınırı aynen korunur.
            if (Math.abs((newBox.rotation || 0) - (oldBox.rotation || 0)) > 0.001) {
              return newBox;
            }
            
            // KÂĞIT SINIRI — DÖNDÜRME FARKINDALIKLI: Transformer kutusu nesnenin YEREL
            // çerçevesindedir; döndürülmüş nesnede bu çerçeve sayfa düzlemiyle çakışmaz.
            // Eski kod yerel kutuyu doğrudan P.w/P.h ile kıyaslıyordu: 90° döndürülmüş
            // kaldırımda yerel genişlik sayfanın DİKEY eksenine karşılık geldiği halde
            // P.w ile kıyaslanıp (1000 - node.x) kadar sessizce kırpılıyordu — uzatma
            // sürüklerken görünüyor, bırakınca eski boyutuna dönüyordu (kullanıcı
            // raporu: kaldırım uzatması seçim kalkınca siliniyor).
            // Doğru kural: yerel kutunun 4 köşesini sayfa uzayına çevir (AABB), taşma
            // varsa kutuyu orantılı kırp. Eksen hizalı (0°/180°) nesnede eski davranış
            // birebir korunur (orijin kenara çekilir, kenar sayfada kalır).
            if (!shapeProps.isTemplate) {
              const P = paperArea || { w: 1000, h: 1400 };
              const rotNorm = ((newBox.rotation || 0) % 180 + 180) % 180;
              const axisAligned = rotNorm < 0.5 || rotNorm > 179.5;
              if (axisAligned) {
                if (newBox.x < 0) {
                  newBox.width += newBox.x;
                  newBox.x = 0;
                }
                if (newBox.y < 0) {
                  newBox.height += newBox.y;
                  newBox.y = 0;
                }
                if (newBox.x + newBox.width > P.w) {
                  newBox.width = P.w - newBox.x;
                }
                if (newBox.y + newBox.height > P.h) {
                  newBox.height = P.h - newBox.y;
                }
              } else {
                // Döndürülmüş: köşeleri sayfa uzayına projecte et, AABB taşmasını ölç
                const rad = ((newBox.rotation || 0) * Math.PI) / 180;
                const cos = Math.cos(rad), sin = Math.sin(rad);
                const corners = [
                  [0, 0], [newBox.width, 0], [0, newBox.height], [newBox.width, newBox.height],
                ].map(([lx, ly]) => [newBox.x + lx * cos - ly * sin, newBox.y + lx * sin + ly * cos]);
                const minX = Math.min(...corners.map(c => c[0]));
                const maxX = Math.max(...corners.map(c => c[0]));
                const minY = Math.min(...corners.map(c => c[1]));
                const maxY = Math.max(...corners.map(c => c[1]));
                // Oran s ile kutu orijin etrafında küçülünce köşe ofsetleri de s ile ölçeklenir;
                // her taşan kenar için izin veren en büyük s bulunur.
                let s = 1;
                if (maxX > 0 && newBox.x < P.w && maxX > P.w - newBox.x) s = Math.min(s, (P.w - newBox.x) / maxX);
                if (minX < 0 && newBox.x > 0 && -minX > newBox.x) s = Math.min(s, newBox.x / -minX);
                if (maxY > 0 && newBox.y < P.h && maxY > P.h - newBox.y) s = Math.min(s, (P.h - newBox.y) / maxY);
                if (minY < 0 && newBox.y > 0 && -minY > newBox.y) s = Math.min(s, newBox.y / -minY);
                if (s < 1) {
                  newBox.width = Math.max(5, newBox.width * s);
                  newBox.height = Math.max(5, newBox.height * s);
                }
              }

              // Kırpmadan sonra çok küçüldüyse iptal et
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
            }
            return newBox;
          }}
        />
      )}
    </React.Fragment>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SEÇİM ARAÇ PANELİ YARDIMCILARI — gruplu, düzenli, kolay erişilir panel
// ─────────────────────────────────────────────────────────────────────────────
const ToolbarSection = ({ title, color = '#F5C518', children }: { title: string; color?: string; children: React.ReactNode }) => (
  <div>
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[8px] font-black uppercase tracking-widest" style={{ color }}>{title}</span>
      <span className="flex-1 h-px bg-[#2a2a2a]" />
    </div>
    {children}
  </div>
);

const ToolbarField = ({ label, accent, children }: { label: string; accent?: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1 min-w-0">
    <span className="text-[8px] font-black uppercase tracking-wider truncate" style={{ color: accent || '#9ca3af' }}>{label}</span>
    {children}
  </label>
);

const ChipToggle = ({ id, label, checked, onChange, activeClass = 'border-purple-500/50 bg-purple-500/10 text-purple-300' }: {
  id: string; label: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; activeClass?: string;
}) => (
  <label htmlFor={id} className={`flex items-center justify-center gap-1.5 px-2 py-[7px] rounded-md border cursor-pointer text-[9px] font-bold transition-colors ${checked ? activeClass : 'border-[#333] text-gray-400 hover:border-gray-600'}`}>
    <input type="checkbox" id={id} checked={checked} onChange={onChange} className="sr-only" />
    {label}
  </label>
);

export const CanvasArea: React.FC = () => {
  const { 
    objects,
    backgroundImage, 
    backgroundOpacity, 
    backgroundGrayscale, 
    backgroundTransform, 
    selectedId, 
    setSelectedId, 
    updateObject, 
    addObject, 
    saveHistory, 
    removeObject,
    removeObjects,
    canvasBgColor,
    canvasOrientation,
    setCanvasBgColor,
    setCanvasOrientation,
    addNotification,
    drawingArea,
    projectInfo,
    isAdmin,
    updateProjectInfo,
    scaleCalibration,
    scenes,
    clipboard,
    copyObject,
    pasteClipboard,
    duplicateObject,
    allSymbols,
    uploadedImages,
  } = useStore();

  // BULGU LİSTESİ SAYFALAR ARASI TOPLAMA: liste, tüm sayfalardaki bulguları
  // toplayan ana tablodur (kullanıcı akışı: bulgular detay sayfalarında,
  // ana liste özet sayfasında). Aktif sayfada zaten var olan bulgu tekrar
  // eklenmez; böylece ekranda ve PDF'te liste her zaman dolu görünür.
  const crossPageFindings = React.useMemo(() => {
    const ownIds = new Set(objects.filter((o) => o.findingNo).map((o) => o.id));
    const extra: CanvasObject[] = [];
    (scenes || []).forEach((s) => (s.objects || []).forEach((o) => {
      if (o?.findingNo && !ownIds.has(o.id)) {
        ownIds.add(o.id);
        extra.push(o);
      }
    }));
    return extra;
  }, [objects, scenes]);
  // IndividualObject'in bulgu listesi dalı bu diziyi okur (görünürlük + satırlar).
  // Diğer dallar (yol/duvar snapping) symbolId filtreli olduğundan yabancı
  // bulgular davranışı etkilemez.
  const allFindingsSource = React.useMemo(
    () => [...objects, ...crossPageFindings] as CanvasObject[],
    [objects, crossPageFindings]
  );

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredPos, setHoveredPos] = useState<{ x: number, y: number } | null>(null);
  
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Aynı dosya tekrar seçilince onChange tetiklensin diye input her zaman sıfırlanır
    e.target.value = '';
    if (file && isAdmin) {
      // SIKIŞTIRMA: Logo ham base64 olarak depolanıyordu (2.5MB PNG → 2.2MB data URI);
      // projectInfo her sahneye kopyalandığından localStorage kotası ve bulut payload'ı
      // katlanarak şişiyordu. Artık 512px şeffaf PNG'e işlenir (ondolarca KB).
      processUploadedSymbolImage(file, 512, 512).then((src) => {
        if (!src) {
          addNotification({
            type: 'error',
            message: 'Logo Okunamadı',
            description: 'Seçilen dosya işlenemedi. Lütfen PNG/JPG formatında bir logo deneyin.'
          });
          return;
        }

        // Yeni bir Image nesnesi oluşturup boyutlarını alalım ki kutuya tam otursun
        const img = new Image();
        img.onload = () => {
          const logo = objects.find(o => o.id === 'corporate-logo');
          const boxW = logo?.width || 50;
          const boxH = logo?.height || 40;
          
          const imgRatio = img.width / img.height;
          const boxRatio = boxW / boxH;
          
          let finalW, finalH;
          if (imgRatio > boxRatio) {
            // Resim daha geniş: Genişliği kutuya uydur, yüksekliği küçült
            finalW = boxW;
            finalH = boxW / imgRatio;
          } else {
            // Resim daha dar: Yüksekliği kutuya uydur, genişliği küçült
            finalH = boxH;
            finalW = boxH * imgRatio;
          }
          
          updateProjectInfo({ corporateLogo: src });
          updateObject('corporate-logo', { 
            src,
            width: finalW,
            height: finalH,
            // Kutunun merkezine ortalayalım
            x: (logo?.x || 0) + (boxW - finalW) / 2,
            y: (logo?.y || 0) + (boxH - finalH) / 2
          });
          
        };
        img.onerror = () => {
          addNotification({
            type: 'error',
            message: 'Logo Yüklenemedi',
            description: 'İşlenen görsel gösterilemedi. Lütfen başka bir dosya deneyin.'
          });
        };
        img.src = src;
      });
    }
  };
  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    title: string;
    label: string;
    value: string;
    onConfirm: (val: string) => void;
    multiline?: boolean;
  }>({
    isOpen: false,
    title: '',
    label: '',
    value: '',
    onConfirm: () => {},
    multiline: false
  });

  const [isDistanceMatrixOpen, setIsDistanceMatrixOpen] = useState(false);

  const [findingModalState, setFindingModalState] = useState({
    isOpen: false,
    symbol: null as any,
    pos: { x: 0, y: 0 }
  });


  const [isDistanceModalOpen, setIsDistanceModalOpen] = useState(false);
  const [distanceModalTarget, setDistanceModalTarget] = useState<string | null>(null);
  const [initialDistance, setInitialDistance] = useState('');

  const [isEvidencePhotoModalOpen, setIsEvidencePhotoModalOpen] = useState(false);
  const [evidencePhotoTarget, setEvidencePhotoTarget] = useState<string | null>(null);

  const [isBodyMapModalOpen, setIsBodyMapModalOpen] = useState(false);
  const [bodyMapTarget, setBodyMapTarget] = useState<string | null>(null);

  const bgImage = useSmartImage(backgroundImage || undefined);
  const stageRef = useRef<any>(null);
  const bgImageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [previousScale] = useState(1);
  const [gridVisible, setGridVisible] = useState(true);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Keep stage positioned at { x: 0, y: 0 } when orientation changes
    setStagePos({ x: 0, y: 0 });
  }, [canvasOrientation]);

  const handleWheel = (e: any) => {
    // Only zoom if Ctrl key is pressed
    if (!e.evt.ctrlKey) return;
    
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const scaleBy = 1.1;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    // Limit zoom
    const limitedScale = Math.max(0.1, Math.min(newScale, 5));
    
    setScale(limitedScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * limitedScale,
      y: pointer.y - mousePointTo.y * limitedScale,
    });
  };

  const handleTriangulate = (objId: string) => {
    const obj = objects.find(o => o.id === objId);
    if (!obj) return;

    const centerX = obj.x + (obj.width * (obj.scaleX || 1)) / 2;
    const centerY = obj.y + (obj.height * (obj.scaleY || 1)) / 2;
    const radius = (obj.width * (obj.scaleX || 1)) / 2;

    // 1. First, look for manually placed Fixed Points (isTriangulation)
    const fixedPoints = objects.filter(o => 
      (o.isTriangulation || o.symbolId === 'out-fixed-point' || o.symbolId === 'out-pole') && 
      o.id !== objId && 
      o.symbolId !== 'a-4'
    ).map(fp => ({
      ...fp,
      centerX: fp.x + (fp.width * (fp.scaleX || 1)) / 2,
      centerY: fp.y + (fp.height * (fp.scaleY || 1)) / 2,
      dist: Math.sqrt(Math.pow((fp.x + (fp.width * (fp.scaleX || 1)) / 2) - centerX, 2) + Math.pow((fp.y + (fp.height * (fp.scaleY || 1)) / 2) - centerY, 2))
    })).sort((a, b) => a.dist - b.dist);

    if (fixedPoints.length >= 2) {
      // Professional Outdoor Triangulation: Measure from the 2 nearest fixed points
      const nearestPoints = fixedPoints.slice(0, 2);
      const arrowColor = '#000000'; // Siyah renk

      nearestPoints.forEach((fp) => {
        const dx = fp.centerX - centerX;
        const dy = fp.centerY - centerY;
        const angle = Math.atan2(dy, dx);
        
        // Offset start/end to be outside the icons
        const startX = centerX + Math.cos(angle) * radius;
        const startY = centerY + Math.sin(angle) * radius;
        const endX = fp.centerX - Math.cos(angle) * 20; // 20 is half fixed point width
        const endY = fp.centerY - Math.sin(angle) * 20;

        addObject({
          type: 'symbol',
          symbolId: 'a-4',
          categoryId: 'arrows',
          x: (startX + endX) / 2,
          y: (startY + endY) / 2,
          startX: startX,
          startY: startY,
          endX: endX,
          endY: endY,
          width: Math.abs(endX - startX),
          height: Math.abs(endY - startY),
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          distance: `${Math.round(fp.dist * (scaleCalibration.realDistance / scaleCalibration.pixelDistance))} ${scaleCalibration.unit}`,
          distanceColor: arrowColor,
          distanceFontSize: 14,
          fill: '#000000',
          stroke: '#000000',
          isDistanceArrow: true,
          isTriangulation: true,
          measuredIds: [obj.id, fp.id],
          name: `Nirengi (${obj.findingNo || 'Bulgu'} - ${fp.findingNo || 'Sabit Nokta'})`
        });
      });

      return;
    }

    // 2. Fallback to Architecture (Indoor mode)
    const walls = objects.filter(o => 
      (o.categoryId === 'architecture' || o.type === 'line' || o.type === 'rect') && 
      o.id !== objId && 
      !o.isTemplate
    );

    if (walls.length === 0) {
      addNotification({
        type: 'warning',
        message: 'Ölçüm Noktası Bulunamadı',
        description: 'Nirengi hesabı için ya en az 2 sabit nokta (elektrik direği vb.) eklemeli ya da mimari hatlar (duvar) çizmelisiniz.'
      });
      return;
    }

    // Helper to find nearest orthogonal point on any wall
    const findNearestX = (dir: number) => {
      let nearestDist = Infinity;
      let nearestPoint = 0;
      
      objects.forEach(other => {
        const isWall = ['arch-w1', 'arch-w1v', 'arch-w1i', 'arch-w1vi', 'arch-w-square', 'ev-rect-hollow'].includes(other.symbolId || '');
        if (!isWall) return;

        const otherW = other.width * (other.scaleX || 1);
        const otherH = other.height * (other.scaleY || 1);
        const otherX1 = other.x;
        const otherX2 = other.x + otherW;
        const otherY1 = other.y;
        const otherY2 = other.y + otherH;

        // Check if wall is in the path along X axis
        if (centerY >= otherY1 && centerY <= otherY2) {
          const edges = [otherX1, otherX2];
          edges.forEach(ex => {
            const d = (ex - centerX) * dir;
            // d > 0 means the edge is in the specified direction
            if (d > 0.01 && d < nearestDist) {
              nearestDist = d;
              nearestPoint = ex;
            }
          });
        }
      });
      return { dist: nearestDist, point: nearestPoint };
    };

    const findNearestY = (dir: number) => {
      let nearestDist = Infinity;
      let nearestPoint = 0;
      
      objects.forEach(other => {
        const isWall = ['arch-w1', 'arch-w1v', 'arch-w1i', 'arch-w1vi', 'arch-w-square', 'ev-rect-hollow'].includes(other.symbolId || '');
        if (!isWall) return;

        const otherW = other.width * (other.scaleX || 1);
        const otherH = other.height * (other.scaleY || 1);
        const otherX1 = other.x;
        const otherX2 = other.x + otherW;
        const otherY1 = other.y;
        const otherY2 = other.y + otherH;

        // Check if wall is in the path along Y axis
        if (centerX >= otherX1 && centerX <= otherX2) {
          const edges = [otherY1, otherY2];
          edges.forEach(ey => {
            const d = (ey - centerY) * dir;
            // d > 0 means the edge is in the specified direction
            if (d > 0.01 && d < nearestDist) {
              nearestDist = d;
              nearestPoint = ey;
            }
          });
        }
      });
      return { dist: nearestDist, point: nearestPoint };
    };

    // Find best X (Left vs Right)
    const left = findNearestX(-1);
    const right = findNearestX(1);
    const xRes = left.dist < right.dist ? { ...left, dir: -1 } : { ...right, dir: 1 };

    // Find best Y (Up vs Down)
    const up = findNearestY(-1);
    const down = findNearestY(1);
    const yRes = up.dist < down.dist ? { ...up, dir: -1 } : { ...down, dir: 1 };

    const arrowColor = '#000000'; // Siyah renk 
    
    // Create X Arrow
    if (xRes.dist !== Infinity && xRes.dist > radius) {
      const startX = centerX + xRes.dir * radius;
      addObject({
        type: 'symbol',
        symbolId: 'a-4',
        categoryId: 'arrows',
        x: (startX + xRes.point) / 2,
        y: centerY,
        startX: startX,
        startY: centerY,
        endX: xRes.point,
        endY: centerY,
        width: Math.abs(xRes.point - startX),
        height: 6,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
          distance: `${Math.round(xRes.dist * (scaleCalibration.realDistance / scaleCalibration.pixelDistance))} ${scaleCalibration.unit}`,
        distanceColor: arrowColor,
        distanceFontSize: 10,
        fill: arrowColor,
        stroke: arrowColor,
        isDistanceArrow: true,
        isTriangulation: true,
        name: `Nirengi X (${obj.findingNo || 'Bulgu'})`
      });
    }

    // Create Y Arrow
    if (yRes.dist !== Infinity && yRes.dist > radius) {
      const startY = centerY + yRes.dir * radius;
      addObject({
        type: 'symbol',
        symbolId: 'a-4',
        categoryId: 'arrows',
        x: centerX,
        y: (startY + yRes.point) / 2,
        startX: centerX,
        startY: startY,
        endX: centerX,
        endY: yRes.point,
        width: 6,
        height: Math.abs(yRes.point - startY),
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
          distance: `${Math.round(yRes.dist * (scaleCalibration.realDistance / scaleCalibration.pixelDistance))} ${scaleCalibration.unit}`,
        distanceColor: arrowColor,
        distanceFontSize: 10,
        fill: arrowColor,
        stroke: arrowColor,
        isDistanceArrow: true,
        isTriangulation: true,
        name: `Nirengi Y (${obj.findingNo || 'Bulgu'})`
      });
    }

  };

  const handleDrawMeasurement = (f1: any, f2: any) => {
    const getCenter = (obj: any) => {
      if (obj.symbolId === 'ev-shooting-trajectory') {
        const sx = obj.startX || 0;
        const sy = obj.startY || 0;
        const ex = obj.endX || 0;
        const ey = obj.endY || 0;
        return { x: obj.x + (sx + ex) / 2, y: obj.y + (sy + ey) / 2 };
      }
      return { x: obj.x + (obj.width * (obj.scaleX || 1)) / 2, y: obj.y + (obj.height * (obj.scaleY || 1)) / 2 };
    };

    const p1 = getCenter(f1);
    const p2 = getCenter(f2);
    const r1 = (f1.width * (f1.scaleX || 1)) / 2;
    const r2 = (f2.width * (f2.scaleX || 1)) / 2;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const totalDist = Math.sqrt(dx * dx + dy * dy);

    if (totalDist <= r1 + r2) {
      addNotification({
        type: 'warning',
        message: 'Mesafe Çok Kısa',
        description: 'Bulgular birbirine çok yakın olduğu için ölçü okları çizilemedi.'
      });
      return;
    }

    // Birim vektör (p1 -> p2 yönünde)
    const ux = dx / totalDist;
    const uy = dy / totalDist;

    // Kenarlara kadar offsetle
    const startX = p1.x + ux * r1;
    const startY = p1.y + uy * r1;
    const endX = p2.x - ux * r2;
    const endY = p2.y - uy * r2;
    
    const actualDist = totalDist - r1 - r2;
    const arrowColor = '#000000'; // Siyah renk

    addObject({
      type: 'symbol',
      symbolId: 'a-4',
      categoryId: 'arrows',
      x: (startX + endX) / 2,
      y: (startY + endY) / 2,
      startX: startX,
      startY: startY,
      endX: endX,
      endY: endY,
      width: actualDist,
      height: 6,
      scaleX: 1,
      scaleY: 1,
      isDistanceArrow: true,
      isTriangulation: false,
      measuredIds: [f1.id, f2.id],
          distance: `${Math.round(totalDist * (scaleCalibration.realDistance / scaleCalibration.pixelDistance))} ${scaleCalibration.unit}`,
      distanceColor: arrowColor,
      distanceFontSize: 12,
      fill: arrowColor,
      stroke: arrowColor,
      name: `Mesafe (${f1.findingNo}-${f2.findingNo})`
    });
    
    setIsDistanceMatrixOpen(false);
  };




  useEffect(() => {
    if (bgImage && bgImageRef.current) {
      bgImageRef.current.cache();
    }
  }, [bgImage, backgroundGrayscale, backgroundOpacity]);

  useEffect(() => {
    const handleExportPDF = async () => {
      const state = useStore.getState();
      if (!stageRef.current) return;

      // 1. Keep track of current active scene so we can restore it at the end
      const originalSceneId = state.activeSceneId;
      
      // Save current active canvas state into the active scene first
      const currentActiveId = state.activeSceneId;
      const updatedScenes = state.scenes.map((s: any) => 
        s.id === currentActiveId 
          ? { 
              ...s, 
              type: state.projectInfo.type, 
              objects: [...state.objects], 
              backgroundImage: state.backgroundImage, 
              projectInfo: { ...state.projectInfo }, 
              drawingArea: state.drawingArea 
            } 
          : s
      );

      const scenesToExport = updatedScenes.length > 0 ? updatedScenes : [
        {
          id: 'temp-current',
          name: 'Sayfa 1',
          type: state.projectInfo.type,
          objects: [...state.objects],
          backgroundImage: state.backgroundImage,
          projectInfo: { ...state.projectInfo },
          drawingArea: state.drawingArea
        }
      ];


      // Deselect objects to hide transformers
      setSelectedId(null);
      // Hide grid for export
      setGridVisible(false);
      
      // Small delay to ensure grid hiding is applied
      await new Promise(resolve => setTimeout(resolve, 150));

      try {
        const orientation = canvasOrientation === 'landscape' ? 'l' : 'p';
        // Dinamik import: jsPDF yalnızca kullanıcı PDF ürettiğinde indirilir
        const { jsPDF: JsPDFCtor } = await import('jspdf');
        let pdf: jsPDF | null = null;
        let pageWidth = 1000;
        let pageHeight = 1400;

        // Helper: load an image to HTMLImageElement, resolves null on error.
        // CORS'suz yeniden deneme YOK: lekelmiş kanvas toDataURL'i SecurityError ile
        // öldürür ve tüm PDF dışa aktarımı çöker. ACAO'suz kaynak → görsel atlanır.
        const loadImg = (src: string): Promise<HTMLImageElement | null> => new Promise(resolve => {
          if (!src) return resolve(null);
          // data: and blob: URLs don't need crossOrigin
          const isDataOrBlob = src.startsWith('data:') || src.startsWith('blob:');
          const img = new Image();
          if (!isDataOrBlob) img.crossOrigin = 'Anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        });

        // Helper: draw a single scene to an off-screen canvas and return dataURL
        // BULGU LİSTESİ: her sayfadaki liste TÜM sayfalardaki bulguları gösterir
        // (ekrandaki davranışın aynısı). foreignFindings yalnızca liste kaynağı
        // olarak kullanılır; sayfaya çizim sırası/z-index değişmez.
        const allFindingsMap = new Map<string, CanvasObject>();
        scenesToExport.forEach((s: { objects?: CanvasObject[] }) => (s.objects || []).forEach((o) => {
          if (o?.findingNo && !allFindingsMap.has(o.id)) allFindingsMap.set(o.id, o);
        }));
        const renderSceneToDataURL = async (scene: any, bgColorVal: string): Promise<string | null> => {
          const sceneObjects: CanvasObject[] = scene.objects || [];
          const listSourceObjects = (() => {
            const own = new Set(sceneObjects.map((o) => o.id));
            const foreign = [...allFindingsMap.values()].filter((f) => !own.has(f.id));
            return foreign.length ? [...sceneObjects, ...foreign] : sceneObjects;
          })();
          const W = canvasOrientation === 'landscape' ? 1400 : 1000;
          const H = canvasOrientation === 'landscape' ? 1000 : 1400;
          const PIXEL_RATIO = 2;

          const offCanvas = document.createElement('canvas');
          offCanvas.width = W * PIXEL_RATIO;
          offCanvas.height = H * PIXEL_RATIO;
          const ctx = offCanvas.getContext('2d')!;
          ctx.scale(PIXEL_RATIO, PIXEL_RATIO);

          // Background
          ctx.fillStyle = bgColorVal || '#ffffff';
          ctx.fillRect(0, 0, W, H);

          // Background image
          if (scene.backgroundImage) {
            const bgImg = await loadImg(scene.backgroundImage);
            if (bgImg) {
              const da = scene.drawingArea || { x: 0, y: 0, width: W, height: H };
              ctx.save();
              ctx.beginPath();
              ctx.rect(da.x, da.y, da.width, da.height);
              ctx.clip();
              ctx.globalAlpha = 1;
              // Aktif sahnede Transformer ile yapılan arka plan dönüşümünü aynala
              // (store'dan güncel okunur — stale closure olmasın)
              const bt = (scene.id === currentActiveId) ? useStore.getState().backgroundTransform : undefined;
              if (bt && (bt.scaleX !== 1 || bt.scaleY !== 1 || bt.rotation || bt.x || bt.y)) {
                ctx.translate(da.x + (bt.x || 0), da.y + (bt.y || 0));
                ctx.rotate(bt.rotation || 0);
                ctx.scale(bt.scaleX || 1, bt.scaleY || 1);
                ctx.drawImage(bgImg, 0, 0, da.width, da.height);
              } else {
                ctx.drawImage(bgImg, da.x, da.y, da.width, da.height);
              }
              ctx.restore();
            }
          }

          // Preload all object images in parallel
          const srcList = sceneObjects.map((o: any) => o.src || '').filter(Boolean);
          const imgMap = new Map<string, HTMLImageElement | null>();
          await Promise.all(srcList.map(async (src: string) => {
            if (!imgMap.has(src)) {
              imgMap.set(src, await loadImg(src));
            }
          }));

          // Sort objects by z-index (template first, then user objects)
          const sorted = [...sceneObjects].sort((a, b) => {
            const az = a.zIndex ?? (a.isTemplate ? -1 : 0);
            const bz = b.zIndex ?? (b.isTemplate ? -1 : 0);
            return az - bz;
          });

          for (const obj of sorted) {
            if (!obj || obj.hidden) continue;
            ctx.save();

            const x = obj.x ?? 0;
            const y = obj.y ?? 0;
            const w = obj.width ?? 50;
            const h = obj.height ?? 50;
            const rot = ((obj.rotation ?? 0) * Math.PI) / 180;
            // Ayna (flip) ofseti: ekrandaki Konva node'ları offsetX/offsetY ile
            // scaleX/scaleY === -1'i telafi eder; export bunu birebir kopyalamalı,
            // aksi halde çevrilmiş nesneler PDF'te tam genişlik/yükseklik kayar.
            const ox = (obj.scaleX === -1) ? w : 0;
            const oy = (obj.scaleY === -1) ? h : 0;

            // Apply transform matching Konva node origin
            if (rot !== 0 || ox !== 0 || oy !== 0) {
              ctx.translate(x + ox, y + oy);
              ctx.rotate(rot);
              ctx.scale(obj.scaleX ?? 1, obj.scaleY ?? 1);
              ctx.translate(-ox, -oy);
            } else {
              ctx.translate(x, y);
              ctx.scale(obj.scaleX ?? 1, obj.scaleY ?? 1);
            }

            const img = obj.src ? (imgMap.get(obj.src) || null) : null;
            drawExportObject(ctx, obj, img, listSourceObjects);

            ctx.restore();
          }

          try {
            return offCanvas.toDataURL('image/jpeg', 0.92);
          } catch (err) {
            console.warn('offCanvas toDataURL failed, using stage fallback if active scene:', err);
            // Yedek yollar da lekeleme nedeniyle SecurityError atabilir — her biri korunur.
            try {
              if (scene.id === currentActiveId && stageRef.current) {
                const fallbackUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
                if (fallbackUrl) return fallbackUrl;
              }
            } catch (stageErr) {
              console.warn('Stage fallback de başarısız (lekeleme):', stageErr);
            }
            try {
              return offCanvas.toDataURL('image/png');
            } catch (pngErr) {
              console.error('Sahne veri URL\'si üretilemedi (kanvas lekeleşmiş):', pngErr);
              return null;
            }
          }
        };

        // Loop through all scenes, render each to off-screen canvas (no React dependency)
        for (let i = 0; i < scenesToExport.length; i++) {
          const scene = scenesToExport[i];

          const dataURL = await renderSceneToDataURL(scene, canvasBgColor);
          // Lekeleme vb. nedeniyle render edilemeyen sahne PDF'i bozmadan atlanır
          if (!dataURL) {
            console.warn('PDF: sahne render edilemedi, atlanıyor:', scene?.id);
            continue;
          }
          const W = canvasOrientation === 'landscape' ? 1400 : 1000;
          const H = canvasOrientation === 'landscape' ? 1000 : 1400;
          pageWidth = W;
          pageHeight = H;

          if (!pdf) {
            pdf = new JsPDFCtor({
              orientation: orientation,
              unit: 'px',
              format: [pageWidth, pageHeight]
            });
          } else {
            pdf.addPage([pageWidth, pageHeight], orientation);
          }

          if (pdf) {
            pdf.addImage(dataURL, 'JPEG', 0, 0, pageWidth, pageHeight);
          }
        }

        if (!pdf) {
          throw new Error('PDF nesnesi oluşturulamadı.');
        }

        // --- APPENDIX: Finding Photos ---
        const allFindingsWithPhotos: any[] = [];
        const findingToScenePageMap: Record<string, number> = {};

        scenesToExport.forEach((scene, sceneIndex) => {
          const sceneFindings = (scene.objects || []).filter((o: any) => o.findingNo && o.photos && o.photos.length > 0);
          sceneFindings.forEach((f: any) => {
            if (!allFindingsWithPhotos.some(existing => existing.id === f.id)) {
              allFindingsWithPhotos.push(f);
              findingToScenePageMap[f.id] = sceneIndex + 1; // 1-based page index of the scene in the PDF
            }
          });
        });

        if (allFindingsWithPhotos.length > 0) {
          const loadImage = (url: string): Promise<HTMLImageElement | null> => {
            return new Promise((resolve) => {
              const isDataOrBlob = url.startsWith('data:') || url.startsWith('blob:');
              const img = new Image();
              if (!isDataOrBlob) img.crossOrigin = 'Anonymous';
              img.onload = () => resolve(img);
              // CORS'suz yeniden deneme YOK — lekelemiş fotoğraf toDataURL'i çökertir.
              img.onerror = () => resolve(null);
              img.src = url;
            });
          };

          const findingPageMap: Record<string, number> = {};

          for (const obj of allFindingsWithPhotos) {
            const photos = obj.photos || [];
            findingPageMap[obj.id] = pdf.getNumberOfPages() + 1;

            for (let i = 0; i < photos.length; i++) {
              const photoUrl = photos[i];
              try {
                const img = await loadImage(photoUrl);
                // Yüklenemeyen fotoğraf (CORS/ağ hatası) boş sayfa eklemadan atlanır
                if (!img) {
                  console.warn('PDF eki: fotoğraf yüklenemedi, atlanıyor:', photoUrl);
                  continue;
                }
                
                pdf.addPage([pageWidth, pageHeight], orientation);
                
                // Header for the photo page
                pdf.setFillColor(245, 197, 24); // #F5C518
                pdf.rect(0, 0, pageWidth, 40, 'F');
                
                pdf.setFontSize(14);
                pdf.setTextColor(0, 0, 0);
                pdf.setFont('helvetica', 'bold');
                pdf.text(`BULGU FOTOGRAFI - BULGU NO: ${obj.findingNo}`, 20, 25);
                
                pdf.setFontSize(10);
                pdf.text(`Dosya Eki: ${i + 1}/${photos.length}`, pageWidth - 20, 25, { align: 'right' });

                // Info Box
                pdf.setFillColor(240, 240, 240);
                pdf.rect(20, 50, pageWidth - 40, 30, 'F');
                pdf.setTextColor(60, 60, 60);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Tanim: ${obj.findingDesc || obj.name || 'Belirtilmedi'}`, 30, 68);

                // Calculate dimensions
                const margin = 40;
                const maxWidth = pageWidth - (margin * 2);
                const maxHeight = pageHeight - 120;
                
                let finalW = img.width;
                let finalH = img.height;
                const ratio = img.width / img.height;

                if (finalW > maxWidth) {
                  finalW = maxWidth;
                  finalH = finalW / ratio;
                }
                if (finalH > maxHeight) {
                  finalH = maxHeight;
                  finalW = finalH * ratio;
                }

                const x = (pageWidth - finalW) / 2;
                const y = 100 + (maxHeight - finalH) / 2;

                pdf.setDrawColor(200, 200, 200);
                pdf.rect(x - 2, y - 2, finalW + 4, finalH + 4, 'S');
                pdf.addImage(img, 'JPEG', x, y, finalW, finalH);
                
                // Add "Go Back to the correct Drawing Page" link
                const backPage = findingToScenePageMap[obj.id] || 1;
                pdf.setFontSize(8);
                pdf.setTextColor(0, 0, 255);
                pdf.textWithLink('<< KROKIYE GERI DON', 20, pageHeight - 20, { pageNumber: backPage });
                
              } catch (err) {
                console.error('Error adding photo to PDF:', photoUrl, err);
              }
            }
          }
          
          // Go back to the correct page to add clickable areas over finding markers
          allFindingsWithPhotos.forEach(obj => {
            const markerPage = findingToScenePageMap[obj.id];
            if (markerPage && findingPageMap[obj.id]) {
              pdf.setPage(markerPage);
              pdf.link(obj.x, obj.y, obj.width, obj.height, { pageNumber: findingPageMap[obj.id] });
            }
          });
        }

        // Format the report number cleanly, replacing backslashes and forwardslashes with dashes
        // so that Windows doesn't reject the filename and fall back to Blob UUIDs.
        const cleanReportNo = (state.projectInfo.reportNo || '')
          .replace(/[/\\]/g, '-') // Replace both '/' and '\' with '-'
          .replace(/[:*?"<>|]/g, '_') // Replace other invalid Windows characters with '_'
          .trim();

        const reportSuffix = cleanReportNo ? ` ${cleanReportNo}` : '';
        const baseName = state.projectInfo.type === 'diagram' 
          ? `Olay Yeri Diyagramı${reportSuffix}`
          : `Olay Yeri Krokisi${reportSuffix}`;
          
        // 1. Save PDF directly to Downloads folder (İndirilenler)
        pdf.save(`${baseName}.pdf`);

        // 2. Open PDF in a new tab simultaneously for instant preview
        try {
          const pdfBlob = pdf.output('blob');
          const pdfUrl = URL.createObjectURL(pdfBlob);
          window.open(pdfUrl, '_blank');
          // Blob URL sızıntısını önle (sekme açıldıktan sonra geri alınabilir)
          setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
        } catch (openErr) {
          console.error('Error opening PDF in new tab:', openErr);
        }

        // Restore the original active scene
        if (originalSceneId) {
          useStore.getState().switchScene(originalSceneId);
        }

        setGridVisible(true);
      } catch (error: any) {
        console.error('PDF Export Error:', error);
        
        // Make sure to restore original scene even on error
        if (originalSceneId) {
          useStore.getState().switchScene(originalSceneId);
        }

        addNotification({
          type: 'error',
          message: 'PDF Hatası',
          description: 'PDF oluşturulurken bir hata oluştu: ' + error.message
        });
        setGridVisible(true);
      }
    };

    // Register both local callback ref in the store and event listener for window
    useStore.setState({ exportPDFRef: handleExportPDF });
    window.addEventListener('export-pdf', handleExportPDF);

    // Register fall animation canvas export handler
    const handleFallExport = async () => {
      if (!stageRef.current) return;

      const state = useStore.getState();
      const { duration } = state.fallAnimation;
      if (!duration || duration <= 0) {
        addNotification({ type: 'warning', message: 'Animasyon verisi bulunamadı', description: 'Lütfen önce bir düşme analizi yapın.' });
        return;
      }

      useStore.getState().setFallAnimation({ currentTime: 0, isPlaying: true, speed: 1, loop: false });

      const stageContainer = stageRef.current.getContent();
      const canvasEl = stageContainer.querySelector('canvas');
      if (!canvasEl || typeof MediaRecorder === 'undefined') {
        const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `dusme-animasyonu-${Date.now()}.png`,
            types: [{ description: 'PNG Resim', accept: { 'image/png': ['.png'] } }],
          });
          const blob = await (await fetch(dataURL)).blob();
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch {
          const link = document.createElement('a');
          link.download = `dusme-animasyonu-${Date.now()}.png`;
          link.href = dataURL;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        return;
      }

      await new Promise(r => setTimeout(r, 100));

      const stream = canvasEl.captureStream(30);
      const mp4Types = ['video/mp4;codecs=h264,aac', 'video/mp4;codecs=avc1', 'video/mp4'];
      const mimeType = mp4Types.find(t => MediaRecorder.isTypeSupported(t))
        || (MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm');
      const isMp4 = mimeType.startsWith('video/mp4');
      const ext = isMp4 ? 'mp4' : 'webm';
      const baseMimeType = isMp4 ? 'video/mp4' : 'video/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.start(1000 / 30);

      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const animState = useStore.getState().fallAnimation;
          if (!animState.isPlaying && animState.currentTime >= (duration - 0.01)) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
        setTimeout(() => { clearInterval(checkInterval); resolve(); }, (duration * 1000) + 3000);
      });

      mediaRecorder.stop();
      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => resolve();
      });

      const blob = new Blob(chunks, { type: baseMimeType });

      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `dusme-animasyonu-${state.fallAnimation.canvasData?.height || ''}m.${ext}`,
          types: [{ description: isMp4 ? 'MP4 Video' : 'WebM Video', accept: { [baseMimeType]: [`.${ext}`] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `dusme-animasyonu-${state.fallAnimation.canvasData?.height || ''}m.${ext}`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    };
    useStore.setState({ fallAnimationExportRef: handleFallExport });

    const handleGeneratePreview = async () => {
      if (!stageRef.current) return;
      setSelectedId(null);
      setGridVisible(false);

      try {
        const state = useStore.getState();
        const W = canvasOrientation === 'landscape' ? 1400 : 1000;
        const H = canvasOrientation === 'landscape' ? 1000 : 1400;
        const PIXEL_RATIO = 2;

        // Build a list of all scenes to render (current active canvas state)
        const currentObjects = state.objects || [];
        const currentBg = state.backgroundImage;

        // BULGU LİSTESİ SAYFALAR ARASI TOPLAMA: önizleme de PDF ile aynı kuralı izler —
        // listede tüm sayfalardaki bulgular görünür.
        const previewFindingIds = new Set(currentObjects.filter((o) => o.findingNo).map((o) => o.id));
        const previewForeignFindings: CanvasObject[] = [];
        (state.scenes || []).forEach((s) => (s.objects || []).forEach((o) => {
          if (o?.findingNo && !previewFindingIds.has(o.id)) {
            previewFindingIds.add(o.id);
            previewForeignFindings.push(o);
          }
        }));
        const previewListSource = previewForeignFindings.length ? [...currentObjects, ...previewForeignFindings] : currentObjects;

        // Helper: load image to HTMLImageElement
        const loadImg = (src: string): Promise<HTMLImageElement | null> => new Promise(resolve => {
          if (!src) return resolve(null);
          const isLocal = src.startsWith('data:') || src.startsWith('blob:');
          const img = new Image();
          if (!isLocal) img.crossOrigin = 'Anonymous';
          img.onload = () => resolve(img);
          // CORS'suz yeniden deneme YOK — lekelemiş görsel toDataURL'i SecurityError ile
          // çökertir. Başarısız kaynak null döner ve çizimde atlanır.
          img.onerror = () => resolve(null);
          img.src = src;
        });

        const offCanvas = document.createElement('canvas');
        offCanvas.width = W * PIXEL_RATIO;
        offCanvas.height = H * PIXEL_RATIO;
        const ctx = offCanvas.getContext('2d')!;
        ctx.scale(PIXEL_RATIO, PIXEL_RATIO);

        // Background color
        ctx.fillStyle = canvasBgColor || '#ffffff';
        ctx.fillRect(0, 0, W, H);

        // Background image
        if (currentBg) {
          const bgImg = await loadImg(currentBg);
          if (bgImg) {
            const da = state.drawingArea || { x: 0, y: 0, width: W, height: H };
            ctx.save();
            ctx.beginPath();
            ctx.rect(da.x, da.y, da.width, da.height);
            ctx.clip();
            // Transformer ile yapılan arka plan dönüşümünü aynala
            const bt = state.backgroundTransform;
            if (bt && (bt.scaleX !== 1 || bt.scaleY !== 1 || bt.rotation || bt.x || bt.y)) {
              ctx.translate(da.x + (bt.x || 0), da.y + (bt.y || 0));
              ctx.rotate(bt.rotation || 0);
              ctx.scale(bt.scaleX || 1, bt.scaleY || 1);
              ctx.drawImage(bgImg, 0, 0, da.width, da.height);
            } else {
              ctx.drawImage(bgImg, da.x, da.y, da.width, da.height);
            }
            ctx.restore();
          }
        }

        // Preload all symbol images in parallel
        const srcList = [...new Set(currentObjects.map((o: any) => o.src).filter(Boolean))] as string[];
        const imgMap = new Map<string, HTMLImageElement | null>();
        await Promise.all(srcList.map(async (src: string) => {
          imgMap.set(src, await loadImg(src));
        }));

        // Sort and draw all objects
        const sorted = [...currentObjects].sort((a: any, b: any) => {
          const az = a.zIndex ?? (a.isTemplate ? -1 : 0);
          const bz = b.zIndex ?? (b.isTemplate ? -1 : 0);
          return az - bz;
        });

        for (const obj of sorted) {
          if (!obj || (obj as any).hidden || (obj as any).hidden2D) continue;
          ctx.save();
          const x = obj.x ?? 0;
          const y = obj.y ?? 0;
          const w = obj.width ?? 50;
          const h = obj.height ?? 50;
          const rot = ((obj.rotation ?? 0) * Math.PI) / 180;
          // Ayna (flip) ofseti — PDF export ile aynı kural
          const ox = (obj.scaleX === -1) ? w : 0;
          const oy = (obj.scaleY === -1) ? h : 0;

          if (rot !== 0 || ox !== 0 || oy !== 0) {
            ctx.translate(x + ox, y + oy);
            ctx.rotate(rot);
            ctx.scale(obj.scaleX ?? 1, obj.scaleY ?? 1);
            ctx.translate(-ox, -oy);
          } else {
            ctx.translate(x, y);
            ctx.scale(obj.scaleX ?? 1, obj.scaleY ?? 1);
          }

          const img = obj.src ? (imgMap.get(obj.src) || null) : null;
          drawExportObject(ctx, obj, img, previewListSource);
          ctx.restore();
        }

        const dataURL = offCanvas.toDataURL('image/png');
        window.dispatchEvent(new CustomEvent('preview-ready', { detail: dataURL }));
      } catch (err) {
        console.error('Preview generation failed, falling back to stage capture:', err);
        // Fallback: use stage directly (lekeleme nedeniyle bu da atabilir — korunur)
        await new Promise(resolve => setTimeout(resolve, 150));
        try {
          const dataURL = stageRef.current?.toDataURL({ pixelRatio: 2 });
          if (dataURL) window.dispatchEvent(new CustomEvent('preview-ready', { detail: dataURL }));
          else {
            addNotification({
              type: 'error',
              message: 'Önizleme Oluşturulamadı',
              description: 'Kanvastaki dış görseller güvenlik kısıtı nedeniyle önizlemeye alınamadı.'
            });
          }
        } catch (stageErr) {
          console.error('Stage preview fallback failed:', stageErr);
          addNotification({
            type: 'error',
            message: 'Önizleme Oluşturulamadı',
            description: 'Kanvastaki dış görseller güvenlik kısıtı nedeniyle önizlemeye alınamadı.'
          });
        }
      } finally {
        setGridVisible(true);
      }
    };

    const handleClosePreview = () => {
      setScale(previousScale);
    };

    window.addEventListener('generate-preview', handleGeneratePreview);
    window.addEventListener('close-preview', handleClosePreview);

    return () => {
      useStore.setState({ exportPDFRef: null, fallAnimationExportRef: null });
      window.removeEventListener('export-pdf', handleExportPDF);
      window.removeEventListener('generate-preview', handleGeneratePreview);
      window.removeEventListener('close-preview', handleClosePreview);
    };
  }, [canvasOrientation, setSelectedId, addNotification, scale, previousScale, objects, backgroundImage, projectInfo, drawingArea]);



  const stagePosRef = useRef(stagePos);
  stagePosRef.current = stagePos;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const savedPosRef = useRef({ x: 0, y: 0 });
  const savedScaleRef = useRef(1);

  useEffect(() => {
    const handleBeforePrint = () => {
      setGridVisible(false);
      setSelectedId(null);
      savedPosRef.current = stagePosRef.current;
      savedScaleRef.current = scaleRef.current;
      setStagePos({ x: 0, y: 0 });
      setScale(1);
    };

    const handleAfterPrint = () => {
      setGridVisible(true);
      setStagePos(savedPosRef.current);
      setScale(savedScaleRef.current);
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [setGridVisible, setSelectedId]);

  // DEV SADECE: otomasyon testleri için stage + store erişim köprüsü (üretim derlemesine girmez)
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).__kroki_debug = {
        getStage: () => stageRef.current,
        store: useStore,
      };
    }
  }, []);


  useEffect(() => {
    const handleGlobalMouseUp = () => {
      // Force stop any active Konva drag operation
      if (Konva.DD.isDragging) {
        (Konva.DD as any).stopDrag();
      }
      if (stageRef.current) {
        stageRef.current.getLayer()?.batchDraw();
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    if (stageRef.current) {
      stageRef.current.setPointersPositions(e);
    }
    const symbolData = e.dataTransfer.getData('symbol');
    if (symbolData && stageRef.current) {
      const symbol = JSON.parse(symbolData);
      
      // Compute exact canvas coordinate using inverse transform (accounts for pan & zoom)
      const pointer = stageRef.current.getPointerPosition();
      if (!pointer) return;
      const transform = stageRef.current.getAbsoluteTransform().copy().invert();
      const pos = transform.point(pointer);

      const isDistanceObject = symbol.isDistanceArrow || 
                               symbol.name?.toLowerCase().includes('mesafe') ||
                               symbol.id?.toLowerCase().includes('distance');

      const isArchitecture = symbol.categoryId === 'architecture' || symbol.id?.startsWith('arch-');

      const isTriangulationPoint = (symbol as any).isTriangulation || symbol.id === 'out-fixed-point' || symbol.id === 'out-pole' || symbol.id === 'out-hydrant';
      const isFindingMarker = symbol.id === 'ev-circle' || symbol.id === 'ev-square';

      if (isFindingMarker || isTriangulationPoint) {
        setFindingModalState({
          isOpen: true,
          symbol,
          pos
        });
      } else if (isDistanceObject) {
        setPromptState({
          isOpen: true,
          title: 'Mesafe Girin',
          label: 'Ölçülen mesafeyi yazın (örn: 5.40 m):',
          value: '',
          onConfirm: (input) => {
            if (input) {
              const w = symbol.width || 100;
              const h = symbol.height || 100;
              addObject({
                ...symbol,
                symbolId: symbol.id,
                categoryId: symbol.categoryId,
                id: uuidv4(),
                x: pos.x - w / 2,
                y: pos.y - h / 2,
                distance: input,
                distanceColor: '#000000',
                width: w,
                height: h,
                rotation: 0,
                scaleX: 1,
                scaleY: 1
              });
            }
            setPromptState(prev => ({ ...prev, isOpen: false }));
          }
        });
      } else if (isArchitecture || symbol.categoryId === 'shapes' || symbol.categoryId === 'outdoor' || symbol.categoryId === 'arrows' || symbol.id?.startsWith('ev-rect-') || symbol.id?.startsWith('ev-square-')) {
        const w = symbol.width || 100;
        const h = symbol.height || 100;
        let finalX = pos.x - w / 2;
        let finalY = pos.y - h / 2;

        if (drawingArea) {
          finalX = Math.max(drawingArea.x, Math.min(finalX, drawingArea.x + drawingArea.width - w));
          finalY = Math.max(drawingArea.y, Math.min(finalY, drawingArea.y + drawingArea.height - h));
        }

        addObject({
          ...symbol,
          symbolId: symbol.id,
          categoryId: symbol.categoryId || 'architecture',
          id: uuidv4(),
          fill: '#000000',
          x: finalX,
          y: finalY,
          width: w,
          height: h,
          rotation: 0,
          scaleX: 1,
          scaleY: 1
        });
      } else if (symbol.id === 'ev-human-poseable') {
        const w = symbol.width || 100;
        const h = symbol.height || 200;
        addObject({
          ...symbol,
          symbolId: symbol.id,
          categoryId: symbol.categoryId,
          id: uuidv4(),
          x: pos.x - w / 2,
          y: pos.y - h / 2,
          width: w,
          height: h,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          joints: [
            { id: 'head', x: w/2, y: h*0.1 },
            { id: 'neck', x: w/2, y: h*0.2 },
            { id: 'l_shoulder', x: w*0.3, y: h*0.25 },
            { id: 'r_shoulder', x: w*0.7, y: h*0.25 },
            { id: 'l_elbow', x: w*0.2, y: h*0.45 },
            { id: 'r_elbow', x: w*0.8, y: h*0.45 },
            { id: 'l_wrist', x: w*0.15, y: h*0.65 },
            { id: 'r_wrist', x: w*0.85, y: h*0.65 },
            { id: 'pelvis', x: w/2, y: h*0.55 },
            { id: 'l_knee', x: w*0.35, y: h*0.75 },
            { id: 'r_knee', x: w*0.65, y: h*0.75 },
            { id: 'l_ankle', x: w*0.35, y: h*0.95 },
            { id: 'r_ankle', x: w*0.65, y: h*0.95 }
          ]
        });
      } else if (symbol.id === 'ev-callout') {
        setPromptState({
          isOpen: true,
          multiline: true,
          title: 'Balon Açıklaması Girin',
          label: 'Balon İçinde Yazacak Metin:',
          value: '',
          onConfirm: (input) => {
            if (input) {
              const size = calculateCalloutSize(input, 14);
              addObject({
                ...symbol,
                symbolId: symbol.id,
                categoryId: symbol.categoryId,
                id: uuidv4(),
                x: pos.x - (size.w / 2),
                y: pos.y - (size.h / 2),
                distance: input,
                width: size.w,
                height: size.h,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                fill: 'transparent',
                distanceColor: '#000000',
              });
            }
            setPromptState(prev => ({ ...prev, isOpen: false }));
          }
        });
      } else if (symbol.id === 'ev-arrow-text') {
        setPromptState({
          isOpen: true,
          title: 'Ok Ucuna Açıklama Girin',
          label: 'Açıklama (örn. Plaka No):',
          value: '',
          onConfirm: (input) => {
            if (input) {
              addObject({
                ...symbol,
                id: uuidv4(),
                symbolId: symbol.id,
                categoryId: symbol.categoryId,
                x: pos.x - 75,
                y: pos.y - 15,
                distance: input,
                width: 150,
                height: 30,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                fill: '#000000',
                distanceColor: '#000000',
                distanceFontSize: 12,
              });
            }
            setPromptState(prev => ({ ...prev, isOpen: false }));
          }
        });
      } else if (symbol.id === 'ev-arrow-desc' || symbol.id === 'ev-arrow-desc-ellipse') {
        setPromptState({
          isOpen: true,
          multiline: true,
          title: 'Delil Açıklaması Girin',
          label: 'Delil/Bulgu Açıklaması (Örn: Boş Kovan, Kan Lekesi):',
          value: '',
          onConfirm: (input) => {
            if (input) {
              let finalX = pos.x - 100;
              let finalY = pos.y - 20;
              if (drawingArea) {
                finalX = Math.max(drawingArea.x, Math.min(finalX, drawingArea.x + drawingArea.width - 200));
                finalY = Math.max(drawingArea.y, Math.min(finalY, drawingArea.y + drawingArea.height - 40));
              }
              addObject({
                ...symbol,
                id: uuidv4(),
                symbolId: symbol.id,
                categoryId: symbol.categoryId,
                x: finalX,
                y: finalY,
                markerX: 0,
                markerY: 0,
                textX: 120,
                textY: 0,
                distance: input,
                width: 200,
                height: 40,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                distanceColor: '#000000',
                distanceFontSize: 12,
              });
            }
            setPromptState(prev => ({ ...prev, isOpen: false }));
          }
        });
      } else if (symbol.id === 'st-1' || symbol.id === 'st-cadde' || symbol.id === 'st-sokak') {
          // Yol motoru ailesi: st-1 (Düz Yol) + st-cadde (Cadde) + st-sokak (Sokak).
          // Cadde/sokak: orta çizgisiz bant; özellik panelinden sokak/cadde adı yazılır.
          const isCadde = symbol.id === 'st-cadde';
          const isSokak = symbol.id === 'st-sokak';
          const defW = isSokak ? 300 : 400;
          const defH = isSokak ? 52 : 80;
          let finalX = pos.x - defW / 2;
          let finalY = pos.y - defH / 2;
          if (drawingArea) {
            finalX = Math.max(drawingArea.x, Math.min(finalX, drawingArea.x + drawingArea.width - defW));
            finalY = Math.max(drawingArea.y, Math.min(finalY, drawingArea.y + drawingArea.height - defH));
          }
          addObject({
            ...symbol,
            id: uuidv4(),
            symbolId: symbol.id,
            categoryId: 'streets',
            name: isCadde ? 'Cadde' : (isSokak ? 'Sokak' : 'Düz Yol'),
            x: finalX,
            y: finalY,
            width: defW,
            height: defH,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            curvature: 0,
            ratioFixed: false,
            // Orta kesikli çizgi: yalnız st-1'de varsayılan açık; cadde/sokakta kapalı
            roadMiddleLine: symbol.id === 'st-1',
            streetName: '',
            zIndex: objects.length,
        });
      } else if (symbol.id === 'ev-rope') {
        addObject({
          ...symbol,
          id: uuidv4(),
          symbolId: 'ev-rope',
          categoryId: 'shapes',
          x: pos.x - 100,
          y: pos.y - 20,
          width: 200,
          height: 40,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          curvature: 0,
          zIndex: objects.length,
        });
      } else if (symbol.id === 'ev-noose') {
        addObject({
          ...symbol,
          id: uuidv4(),
          symbolId: 'ev-noose',
          categoryId: 'shapes',
          x: pos.x - 40,
          y: pos.y - 60,
          width: 80,
          height: 120,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          zIndex: objects.length,
        });
      } else {
        const doorIds = ['arch-d1r', 'arch-d1l', 'arch-d2'];
        const isDoor = doorIds.includes(symbol.id);
        const isWindow = symbol.id === 'arch-win';
        const isWall = ['arch-w1', 'arch-w1v', 'arch-w1i', 'arch-w1vi'].includes(symbol.id);
        
        let finalWidth = symbol.id === 'arch-d2' ? 120 : (isDoor ? 60 : (symbol.width || 100));
        let finalHeight = isDoor ? 60 : (symbol.height || 100);

        if (isWindow) {
          finalWidth = 50;
          finalHeight = 10; 
        } else if (isWall) {
          if (symbol.id === 'arch-w1') { finalWidth = 200; finalHeight = 10; }
          else if (symbol.id === 'arch-w1v') { finalWidth = 10; finalHeight = 200; }
          else if (symbol.id === 'arch-w1i') { finalWidth = 250; finalHeight = 10; }
          else if (symbol.id === 'arch-w1vi') { finalWidth = 10; finalHeight = 250; }
        }

        let finalX = pos.x - finalWidth / 2;
        let finalY = pos.y - finalHeight / 2;

        if (drawingArea) {
          finalX = Math.max(drawingArea.x, Math.min(finalX, drawingArea.x + drawingArea.width - finalWidth));
          finalY = Math.max(drawingArea.y, Math.min(finalY, drawingArea.y + drawingArea.height - finalHeight));
        }

        const newObjId = uuidv4();
        addObject({
          ...symbol,
          symbolId: symbol.id,
          id: newObjId,
          x: finalX,
          y: finalY,
          width: finalWidth,
          height: finalHeight,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          distanceColor: '#000000',
          zIndex: objects.length,
        });

        if (symbol.id === 'ev-shooting-trajectory') {
          checkShootingTrajectoryIntersections(newObjId);
        }
      }
      saveHistory();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Input/Textarea içindeysen engelle
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (!selectedId) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      removeObject(selectedId);
      saveHistory();
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const obj = objects.find(o => o.id === selectedId);
      if (obj) {
        let newX = obj.x;
        let newY = obj.y;
        if (e.key === 'ArrowUp') newY -= step;
        if (e.key === 'ArrowDown') newY += step;
        if (e.key === 'ArrowLeft') newX -= step;
        if (e.key === 'ArrowRight') newX += step;
        
        updateObject(selectedId, { x: newX, y: newY });
        saveHistory();
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, objects, updateObject, saveHistory]);



  const renderGrid = () => {
    if (!gridVisible || projectInfo.type === 'diagram') return null;
    const lines = [];
    
    // Use drawingArea if available, otherwise fallback to full canvas
    const gridBounds = drawingArea || {
      x: 0,
      y: 0,
      width: canvasOrientation === 'landscape' ? 1200 : 800,
      height: canvasOrientation === 'landscape' ? 800 : 1200
    };

    const startX = Math.floor(gridBounds.x / 20) * 20;
    const endX = gridBounds.x + gridBounds.width;
    const startY = Math.floor(gridBounds.y / 20) * 20;
    const endY = gridBounds.y + gridBounds.height;
    
    // Vertical lines
    for (let x = startX; x <= endX; x += 20) {
      if (x < gridBounds.x) continue;
      lines.push(
        <Rect
          key={`v-${x}`}
          x={x}
          y={gridBounds.y}
          width={0.5}
          height={gridBounds.height}
          fill="#333333"
          listening={false}
          opacity={0.35}
        />
      );
    }
    // Horizontal lines
    for (let y = startY; y <= endY; y += 20) {
      if (y < gridBounds.y) continue;
      lines.push(
        <Rect
          key={`h-${y}`}
          x={gridBounds.x}
          y={y}
          width={gridBounds.width}
          height={0.5}
          fill="#333333"
          listening={false}
          opacity={0.35}
        />
      );
    }
    return lines;
  };

  const [guidelines, setGuidelines] = useState<{ x?: number, y?: number, type: 'h' | 'v' }[]>([]);

  const handleDragMove = (e: any) => {
    const stage = e.target.getStage();
    const layer = e.target.getLayer();
    const item = e.target;
    const GUIDELINE_OFFSET = 5;

    const otherNodes = layer.getChildren().filter((node: any) => 
      node.className === 'Group' && node !== item && node.id() !== 'drawing-area' && node.name() !== 'background-rect'
    );

    const stops = {
      vertical: [0, stage.width() / 2, stage.width()],
      horizontal: [0, stage.height() / 2, stage.height()],
    };

    otherNodes.forEach((node: any) => {
      const box = node.getClientRect();
      stops.vertical.push(box.x, box.x + box.width / 2, box.x + box.width);
      stops.horizontal.push(box.y, box.y + box.height / 2, box.y + box.height);
    });

    const itemBox = item.getClientRect();
    const itemStops = {
      vertical: [itemBox.x, itemBox.x + itemBox.width / 2, itemBox.x + itemBox.width],
      horizontal: [itemBox.y, itemBox.y + itemBox.height / 2, itemBox.y + itemBox.height],
    };

    const newGuides: any[] = [];
    let snappedX = item.x();
    let snappedY = item.y();

    itemStops.vertical.forEach((is) => {
      stops.vertical.forEach((s) => {
        if (Math.abs(is - s) < GUIDELINE_OFFSET) {
          const diff = is - s;
          snappedX -= diff;
          newGuides.push({ x: s, type: 'v' });
        }
      });
    });

    itemStops.horizontal.forEach((is) => {
      stops.horizontal.forEach((s) => {
        if (Math.abs(is - s) < GUIDELINE_OFFSET) {
          const diff = is - s;
          snappedY -= diff;
          newGuides.push({ y: s, type: 'h' });
        }
      });
    });

    if (newGuides.length > 0) {
      item.position({ x: snappedX, y: snappedY });
    }
    setGuidelines(newGuides);
  };

  const handleDragEnd = () => {
    setGuidelines([]);
  };

  const checkShootingTrajectoryIntersections = (trajId: string) => {
    // Use live store state so the function works even when called right after addObject
    const traj = useStore.getState().objects.find(o => o.id === trajId);
    if (!traj) return;

    // 1. Remove previous auto-created symbols for this trajectory
    const oldWoundIds = objects
      .filter((o: any) => o.parentId === trajId)
      .map(o => o.id);
    if (oldWoundIds.length > 0) {
      removeObjects(oldWoundIds);
    }

    const mannequins = objects.filter(o => o.id !== trajId && (o.symbolId?.startsWith('p-') || o.symbolId === 'ev-human-poseable'));
    const windows = objects.filter(o => o.id !== trajId && o.symbolId === 'arch-win');
    const walls = objects.filter(o => o.id !== trajId && (o.symbolId?.startsWith('arch-w1') || o.symbolId === 'arch-7' || o.symbolId === 'arch-w-square'));

    if (mannequins.length === 0 && windows.length === 0 && walls.length === 0) return;

    const r = (traj.rotation || 0) * Math.PI / 180;
    const sX = traj.startX !== undefined ? traj.startX : 0;
    const sY = traj.startY !== undefined ? traj.startY : 150;
    const eX = traj.endX !== undefined ? traj.endX : 150;
    const eY = traj.endY !== undefined ? traj.endY : 0;

    const tsx = traj.x + (sX * Math.cos(r) - sY * Math.sin(r));
    const tsy = traj.y + (sX * Math.sin(r) + sY * Math.cos(r));
    const tex = traj.x + (eX * Math.cos(r) - eY * Math.sin(r));
    const tey = traj.y + (eX * Math.sin(r) + eY * Math.cos(r));

    const trajDx = tex - tsx;
    const trajDy = tey - tsy;
    const trajLen = Math.sqrt(trajDx*trajDx + trajDy*trajDy);
    if (trajLen === 0) return;

    let newObjects: any[] = [];
    const addedPoints = new Set<string>();

    const allSyms = useStore.getState().allSymbols;
    const allFlatSymbols = allSyms ? allSyms.flatMap(c => c.symbols) : [];
    const wallDef = allFlatSymbols.find(s => s?.id === 'tr-bullet-wall');
    const glassDef = allFlatSymbols.find(s => s?.id === 'tr-bullet-glass');
    const woundInDef = allFlatSymbols.find(s => s?.id === 'in-bullet-in');
    const woundOutDef = allFlatSymbols.find(s => s?.id === 'in-bullet-out');

    const zH = traj.zHeight || 120;
    const tilt = traj.tilt || 0;
    const dz = trajLen > 0 ? (trajLen * Math.tan(tilt * Math.PI / 180)) : 0;

    // A. Mannequins (Entrance / Exit wounds)
    mannequins.forEach(mObj => {
      const w = mObj.width * (mObj.scaleX || 1);
      const h = mObj.height * (mObj.scaleY || 1);
      const rotRad = (mObj.rotation || 0) * Math.PI / 180;
      const cosR = Math.cos(-rotRad);
      const sinR = Math.sin(-rotRad);

      const toLocal = (px: number, py: number) => {
        const dx = px - mObj.x;
        const dy = py - mObj.y;
        return {
          x: dx * cosR - dy * sinR,
          y: dx * sinR + dy * cosR
        };
      };

      const lStart = toLocal(tsx, tsy);
      const lEnd = toLocal(tex, tey);

      const lx0 = lStart.x;
      const ly0 = lStart.y;
      const ldx = lEnd.x - lStart.x;
      const ldy = lEnd.y - lStart.y;

      const p = [-ldx, ldx, -ldy, ldy];
      const q = [lx0, w - lx0, ly0, h - ly0];

      let tNear = -Infinity;
      let tFar = Infinity;

      for (let i = 0; i < 4; i++) {
        if (p[i] === 0) {
          if (q[i] < 0) return;
        } else {
          let t = q[i] / p[i];
          if (p[i] < 0) {
            if (t > tNear) tNear = t;
          } else {
            if (t < tFar) tFar = t;
          }
        }
      }

      if (tNear > tFar || tFar < 0 || tNear > 1) return;

      if (tNear >= 0 && tNear <= 1) {
        const pHitX = tsx + tNear * trajDx;
        const pHitY = tsy + tNear * trajDy;
        const key = `mank-in-${Math.round(pHitX)}-${Math.round(pHitY)}`;
        if (!addedPoints.has(key)) {
          addedPoints.add(key);
          newObjects.push({
            ...(woundInDef || {}),
            type: 'symbol',
            symbolId: 'in-bullet-in',
            categoryId: 'injuries',
            src: woundInDef?.src || '',
            id: uuidv4(),
            parentId: trajId,
            x: pHitX - 10,
            y: pHitY - 10,
            width: 20,
            height: 20,
            rotation: mObj.rotation || 0,
            scaleX: 1, scaleY: 1,
            zHeight: Math.max(0, zH + tNear * dz),
            isVertical: true,
            hidden2D: true,
            zIndex: objects.length + newObjects.length + 1
          });
        }
      }

      if (tFar >= 0 && tFar <= 1 && Math.abs(tFar - tNear) > 0.01) {
        const pHitX = tsx + tFar * trajDx;
        const pHitY = tsy + tFar * trajDy;
        const key = `mank-out-${Math.round(pHitX)}-${Math.round(pHitY)}`;
        if (!addedPoints.has(key)) {
          addedPoints.add(key);
          newObjects.push({
            ...(woundOutDef || {}),
            type: 'symbol',
            symbolId: 'in-bullet-out',
            categoryId: 'injuries',
            src: woundOutDef?.src || '',
            id: uuidv4(),
            parentId: trajId,
            x: pHitX - 10,
            y: pHitY - 10,
            width: 20,
            height: 20,
            rotation: mObj.rotation || 0,
            scaleX: 1, scaleY: 1,
            zHeight: Math.max(0, zH + tFar * dz),
            isVertical: true,
            hidden2D: true,
            zIndex: objects.length + newObjects.length + 1
          });
        }
      }
    });

    // B. Windows (Glass impact)
    windows.forEach(winObj => {
      const w = winObj.width * (winObj.scaleX || 1);
      const h = winObj.height * (winObj.scaleY || 1);
      const rotRad = (winObj.rotation || 0) * Math.PI / 180;
      const cosR = Math.cos(-rotRad);
      const sinR = Math.sin(-rotRad);

      const toLocal = (px: number, py: number) => {
        const dx = px - winObj.x;
        const dy = py - winObj.y;
        return {
          x: dx * cosR - dy * sinR,
          y: dx * sinR + dy * cosR
        };
      };

      const lStart = toLocal(tsx, tsy);
      const lEnd = toLocal(tex, tey);

      const lx0 = lStart.x;
      const ly0 = lStart.y;
      const ldx = lEnd.x - lStart.x;
      const ldy = lEnd.y - lStart.y;

      const p = [-ldx, ldx, -ldy, ldy];
      const q = [lx0, w - lx0, ly0, h - ly0];

      let tNear = -Infinity;
      let tFar = Infinity;

      for (let i = 0; i < 4; i++) {
        if (p[i] === 0) {
          if (q[i] < 0) return;
        } else {
          let t = q[i] / p[i];
          if (p[i] < 0) {
            if (t > tNear) tNear = t;
          } else {
            if (t < tFar) tFar = t;
          }
        }
      }

      if (tNear > tFar || tFar < 0 || tNear > 1) return;

      if (tNear >= 0 && tNear <= 1) {
        const pHitX = tsx + tNear * trajDx;
        const pHitY = tsy + tNear * trajDy;
        const key = `win-${Math.round(pHitX)}-${Math.round(pHitY)}`;
        if (!addedPoints.has(key)) {
          addedPoints.add(key);
          newObjects.push({
            ...(glassDef || {}),
            type: 'symbol',
            symbolId: 'tr-bullet-glass',
            categoryId: 'traces',
            src: glassDef?.src || '/assets/symbols/bullet_hole_1.png',
            id: uuidv4(),
            parentId: trajId,
            x: pHitX - 12.5,
            y: pHitY - 12.5,
            width: 25,
            height: 25,
            rotation: winObj.rotation || 0,
            scaleX: 1, scaleY: 1,
            zHeight: Math.max(0, zH + tNear * dz),
            isVertical: true,
            hidden2D: true,
            zIndex: objects.length + newObjects.length + 1
          });
        }
      }
    });

    // C. Walls
    walls.forEach(wObj => {
      const w = wObj.width * (wObj.scaleX || 1);
      const h = wObj.height * (wObj.scaleY || 1);
      const rotRad = (wObj.rotation || 0) * Math.PI / 180;
      const cosR = Math.cos(-rotRad);
      const sinR = Math.sin(-rotRad);

      const toLocal = (px: number, py: number) => {
        const dx = px - wObj.x;
        const dy = py - wObj.y;
        return {
          x: dx * cosR - dy * sinR,
          y: dx * sinR + dy * cosR
        };
      };

      const lStart = toLocal(tsx, tsy);
      const lEnd = toLocal(tex, tey);

      const lx0 = lStart.x;
      const ly0 = lStart.y;
      const ldx = lEnd.x - lStart.x;
      const ldy = lEnd.y - lStart.y;

      const p = [-ldx, ldx, -ldy, ldy];
      const q = [lx0, w - lx0, ly0, h - ly0];

      let tNear = -Infinity;
      let tFar = Infinity;

      for (let i = 0; i < 4; i++) {
        if (p[i] === 0) {
          if (q[i] < 0) return;
        } else {
          let t = q[i] / p[i];
          if (p[i] < 0) {
            if (t > tNear) tNear = t;
          } else {
            if (t < tFar) tFar = t;
          }
        }
      }

      if (tNear > tFar || tFar < 0 || tNear > 1) return;

      if (tNear >= 0 && tNear <= 1) {
        const pHitX = tsx + tNear * trajDx;
        const pHitY = tsy + tNear * trajDy;
        const key = `wall-in-${Math.round(pHitX)}-${Math.round(pHitY)}`;
        if (!addedPoints.has(key)) {
          addedPoints.add(key);
          newObjects.push({
            ...(wallDef || {}),
            type: 'symbol',
            symbolId: 'tr-bullet-wall',
            categoryId: 'traces',
            src: wallDef?.src || '/assets/symbols/bullet_hole_2.webp',
            id: uuidv4(),
            parentId: trajId,
            x: pHitX - 12.5,
            y: pHitY - 12.5,
            width: 25,
            height: 25,
            rotation: wObj.rotation || 0,
            scaleX: 1, scaleY: 1,
            zHeight: Math.max(0, zH + tNear * dz),
            isVertical: true,
            hidden2D: true,
            zIndex: objects.length + newObjects.length + 1
          });
        }
      }

      if (tFar >= 0 && tFar <= 1 && Math.abs(tFar - tNear) > 0.01) {
        const pHitX = tsx + tFar * trajDx;
        const pHitY = tsy + tFar * trajDy;
        const key = `wall-out-${Math.round(pHitX)}-${Math.round(pHitY)}`;
        if (!addedPoints.has(key)) {
          addedPoints.add(key);
          newObjects.push({
            ...(wallDef || {}),
            type: 'symbol',
            symbolId: 'tr-bullet-wall',
            categoryId: 'traces',
            src: wallDef?.src || '/assets/symbols/bullet_hole_2.webp',
            id: uuidv4(),
            parentId: trajId,
            x: pHitX - 12.5,
            y: pHitY - 12.5,
            width: 25,
            height: 25,
            rotation: wObj.rotation || 0,
            scaleX: 1, scaleY: 1,
            zHeight: Math.max(0, zH + tFar * dz),
            isVertical: true,
            hidden2D: true,
            zIndex: objects.length + newObjects.length + 1
          });
        }
      }
    });

    if (newObjects.length > 0) {
      newObjects.forEach(obj => addObject(obj));
      
    }
  };


  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleCameraPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;

    try {
      const compressedSrc = await compressAndResizeImage(file, 600, 600, 0.45);
      updateObject(selectedId, { photo: compressedSrc });
      saveHistory();
    } catch (err) {
      console.error('Camera photo optimization error:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#111111] relative canvas-area-container">
      <div
        ref={containerRef}
        className="flex-1 overflow-auto custom-scrollbar relative p-0"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="min-w-full min-h-full flex items-center justify-center p-1">
          <Stage
            ref={stageRef}
            width={canvasOrientation === 'landscape' ? 1400 : 1000}
            height={canvasOrientation === 'landscape' ? 1000 : 1400}
            scaleX={scale}
            scaleY={scale}
            x={stagePos.x}
            y={stagePos.y}
            onWheel={handleWheel}
            draggable={false}
            onDragEnd={(e) => {
              if (e.target === stageRef.current) {
                setStagePos({ x: e.target.x(), y: e.target.y() });
              }
            }}
            dragDistance={3}
            className="bg-white shadow-2xl transition-all duration-300"
            onMouseDown={(e) => {
              // deselect when clicked on empty area
              const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'background-rect';
              if (clickedOnEmpty) {
                setSelectedId(null);
              }
            }}
            onMouseUp={() => {
              if (Konva.DD.isDragging) {
                (Konva.DD as any).stopDrag();
              }
            }}
          >
            <Layer>
          {/* Snap Guidelines */}
          {projectInfo.type !== 'diagram' && guidelines.map((g, i) => (
            <Line
              key={i}
              points={g.type === 'v' ? [g.x!, -5000, g.x!, 5000] : [-5000, g.y!, 5000, g.y!]}
              stroke="#3b82f6"
              strokeWidth={1}
              dash={[4, 4]}
              opacity={0.6}
            />
          ))}
              <Rect
                x={0}
                y={0}
                width={canvasOrientation === 'landscape' ? 1400 : 1000}
                height={canvasOrientation === 'landscape' ? 1000 : 1400}
                fill={canvasBgColor}
                name="background-rect"
              />
              {renderGrid()}
              {bgImage && (
                <Group
                  x={drawingArea?.x || 0}
                  y={drawingArea?.y || 0}
                  width={drawingArea?.width || 1000}
                  height={drawingArea?.height || 1400}
                  clipFunc={(ctx) => {
                    if (drawingArea) {
                      ctx.rect(0, 0, drawingArea.width, drawingArea.height);
                    }
                  }}
                >
                  <KonvaImage
                    image={bgImage}
                    x={backgroundTransform?.x ?? 0}
                    y={backgroundTransform?.y ?? 0}
                    width={drawingArea?.width || 1000}
                    height={drawingArea?.height || 1400}
                    scaleX={backgroundTransform?.scaleX ?? 1}
                    scaleY={backgroundTransform?.scaleY ?? 1}
                    rotation={backgroundTransform?.rotation ?? 0}
                    name="background-image"
                    ref={bgImageRef}
                    opacity={backgroundOpacity}
                    filters={backgroundGrayscale ? [Konva.Filters.Grayscale] : []}
                    onClick={() => setSelectedId('background-image')}
                    onTap={() => setSelectedId('background-image')}
                    onTransformEnd={() => {
                      // Transformer değişikliklerini kalıcı hale getir: node değerlerini
                      // oku, node'u sıfırla ve store'a yaz (yoksa export/yenileme kaybeder)
                      const node = bgImageRef.current;
                      if (!node) return;
                      const bt = {
                        x: node.x(),
                        y: node.y(),
                        scaleX: node.scaleX(),
                        scaleY: node.scaleY(),
                        rotation: node.rotation(),
                      };
                      node.scaleX(1);
                      node.scaleY(1);
                      node.rotation(0);
                      useStore.setState({ backgroundTransform: bt });
                    }}
                  />
                </Group>
              )}
              
              {/* Background Transformer (if selected) */}
              {selectedId === 'background-image' && bgImageRef.current && (
                <Transformer
                  nodes={[bgImageRef.current]}
                  enabledAnchors={[
                    // Arka plan görselinde de köşe + kenar (orta) tutamaçları aktif.
                    'top-left', 'top-center', 'top-right',
                    'middle-left', 'middle-right',
                    'bottom-left', 'bottom-center', 'bottom-right',
                  ]}
                  boundBoxFunc={(oldBox, newBox) => {
                    // Optional: limit scaling
                    if (newBox.width < 50 || newBox.height < 50) return oldBox;
                    return newBox;
                  }}
                  rotateEnabled={true}
                  anchorSize={8}
                  anchorCornerRadius={4}
                  anchorFill="#F5C518"
                  anchorStroke="white"
                  borderStroke="#F5C518"
                />
              )}
              
              {objects
                .slice()
                .filter((obj: any) => !obj.hidden2D)
                .sort((a, b) => {
                  if (a.id === hoveredId) return 1;
                  if (b.id === hoveredId) return -1;
                  return getEffectiveZIndex(a) - getEffectiveZIndex(b);
                })
                .map((obj) => {
                  // Admin için Logo Placeholder Mantığı
                  if (obj.id === 'corporate-logo' && isAdmin) {
                    return (
                      <Group 
                        key={obj.id} 
                        x={obj.x} y={obj.y} 
                        width={obj.width} height={obj.height}
                        rotation={obj.rotation}
                        onClick={() => {
                          setSelectedId(obj.id);
                          logoInputRef.current?.click();
                        }}
                        onDblClick={() => logoInputRef.current?.click()}
                      >
                        {/* Daima görünür olan admin çerçevesi - Sadece logo yoksa veya seçiliyken görünür */}
                        <Rect 
                          width={obj.width} height={obj.height}
                          fill={obj.src ? "transparent" : "#1a1a1a"}
                          stroke={selectedId === obj.id ? "#F5C518" : (obj.src ? "transparent" : "#444")}
                          strokeWidth={obj.src ? 1 : 2}
                          dash={obj.src ? [2, 2] : [5, 5]}
                          cornerRadius={4}
                          opacity={obj.src && selectedId !== obj.id ? 0 : 1}
                        />
                        
                        {!obj.src && (
                          <Text 
                            text="KURUMSAL\nLOGO YÜKLE"
                            width={obj.width}
                            height={obj.height}
                            align="center"
                            verticalAlign="middle"
                            fontSize={10}
                            fontStyle="bold"
                            fill="#F5C518"
                          />
                        )}

                        {obj.src && (
                          <IndividualObject
                            shapeProps={obj}
                            isSelected={obj.id === selectedId}
                            onSelect={() => setSelectedId(obj.id)}
                            drawingArea={drawingArea}
                            isAdmin={isAdmin}
                            allObjects={objects}
                            paperArea={{ w: canvasOrientation === 'landscape' ? 1400 : 1000, h: canvasOrientation === 'landscape' ? 1000 : 1400 }}
                            onChange={(newAttrs: any) => {
                              updateObject(obj.id, newAttrs);
                              saveHistory();
                            }}
                          />
                        )}
                        
                        {/* Üstüne gelince çıkan admin etiketi */}
                        {selectedId === obj.id && (
                          <Text
                            text="Logo Alanı"
                            y={-15}
                            fontSize={10}
                            fill="#F5C518"
                            fontStyle="bold"
                          />
                        )}
                      </Group>
                    );
                  }

                  // Admin değilse ve logo yoksa hiçbir şey çizme
                  if (obj.id === 'corporate-logo' && !obj.src && !isAdmin) return null;

                  return (
                    <IndividualObject
                      key={obj.id}
                      shapeProps={obj}
                      isSelected={obj.id === selectedId}
                      onSelect={() => setSelectedId(obj.id)}
                      drawingArea={drawingArea}
                      isAdmin={isAdmin}
                      allObjects={allFindingsSource}
                      onDragMove={(e: any) => {
                        setHoveredId(null);
                        handleDragMove(e);
                      }}
                      onDragEnd={() => {
                        handleDragEnd();
                        if (obj.symbolId === 'ev-shooting-trajectory') {
                          checkShootingTrajectoryIntersections(obj.id);
                        }
                      }}
                      onTrajectoryUpdate={(id: string) => checkShootingTrajectoryIntersections(id)}
                      onMouseEnter={(e: any) => {
                        if ((obj.photos?.length || 0) > 0 || ['ev-camera-link', 'ev-bpa-drop'].includes(obj.symbolId || '')) {
                          setHoveredId(obj.id);
                          // Calculate position for HTML overlay
                          const stage = e.target.getStage();
                          const pos = e.target.getAbsolutePosition();
                          // No need to apply transform as absolute position is already in stage coordinates
                          // but we need to account for stage's own position/scale on page
                          const rect = stage.container().getBoundingClientRect();
                          setHoveredPos({
                            x: rect.left + pos.x + (obj.width * scale) / 2,
                            y: rect.top + pos.y
                          });
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredId(null);
                        setHoveredPos(null);
                      }}
                      onOpenDistanceModal={(id: string, initial: string) => {
                        setDistanceModalTarget(id);
                        setInitialDistance(initial);
                        setIsDistanceModalOpen(true);
                      }}
                      paperArea={{ w: canvasOrientation === 'landscape' ? 1400 : 1000, h: canvasOrientation === 'landscape' ? 1000 : 1400 }}
                      onChange={(newAttrs: any) => {
                        updateObject(obj.id, newAttrs);
                        saveHistory();
                      }}
                    />
                  );
                })}
            </Layer>
            {/* Accident Reconstruction Animation Layer */}
            <Layer>
              <AccidentAnimation />
            </Layer>
            {/* Fall Animation Canvas Layer */}
            <Layer>
              <FallAnimationCanvas />
            </Layer>
            {/* Pedestrian Launch Canvas Layer */}
            <Layer>
              <PedestrianLaunchCanvas />
            </Layer>
          </Stage>


        </div>

        {selectedId && (
          <div className="fixed top-[76px] right-4 w-[330px] max-h-[calc(100vh-96px)] overflow-y-auto bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {(() => {
              const selectedObj = objects.find(o => o.id === selectedId);
              if (!selectedObj) return null;

              const isLogo = selectedObj.id === 'corporate-logo';
              const canCopy = !isLogo && selectedObj.type !== 'finding-list';
              const symMeta = (allSymbols as any).flatMap((c: any) => (c.symbols || [])).find((s: any) => s.id === selectedObj.symbolId)
                || SYMBOL_CATEGORIES.flatMap((c: any) => (c.symbols || [])).find((s: any) => s.id === selectedObj.symbolId);
              const upMeta = (uploadedImages || []).find((u: any) => u.id === selectedObj.symbolId);
              const symName = selectedObj.name || symMeta?.name || upMeta?.name || (selectedObj.type === 'text' ? 'Metin Kutusu' : selectedObj.symbolId || 'Nesne');

              const handleCopyClick = () => {
                if (!canCopy) {
                  addNotification({ type: 'warning', message: 'Kopyalanamaz', description: 'Kurumsal logo ve bulgu listesi gibi özel öğeler kopyalanamaz.' });
                  return;
                }
                copyObject(selectedObj.id);
                addNotification({ type: 'success', message: 'Kopyalandı', description: 'Ctrl+V ile yapıştırın veya ÇOĞALT düğmesini kullanın.' });
              };

              return (
                <>
                  {/* ═══ BAŞLIK: sembol adı + ana eylemler (kopyala / yapıştır / çoğalt / bırak) ═══ */}
                  <div className="sticky top-0 z-10 bg-[#1a1a1a]/95 backdrop-blur px-3 py-2 border-b border-[#333] flex items-center justify-between gap-2 rounded-t-xl">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 bg-[#F5C518] rounded-full shrink-0" />
                      <span className="text-[10px] font-black text-white uppercase tracking-wider truncate" title={symName}>{symName}</span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={handleCopyClick} className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#2a2a2a] transition-colors" title="Kopyala (Ctrl+C)"><Copy size={14} /></button>
                      <button onClick={() => pasteClipboard()} disabled={!clipboard} title={clipboard ? 'Yapıştır (Ctrl+V)' : 'Pano boş — önce Kopyala'} className={`p-1.5 rounded-md transition-colors ${clipboard ? 'text-gray-400 hover:text-white hover:bg-[#2a2a2a]' : 'text-gray-600 cursor-not-allowed'}`}><ClipboardPaste size={14} /></button>
                      <button onClick={() => { if (canCopy) duplicateObject(selectedObj.id); }} disabled={!canCopy} title={canCopy ? 'Çoğalt (Ctrl+D)' : 'Bu öğe çoğaltılamaz'} className={`p-1.5 rounded-md transition-colors ${canCopy ? 'text-gray-400 hover:text-white hover:bg-[#2a2a2a]' : 'text-gray-600 cursor-not-allowed'}`}><CopyPlus size={14} /></button>
                      <span className="w-px h-4 bg-[#333] mx-1" />
                      <button onClick={() => setSelectedId(null)} className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#2a2a2a] transition-colors" title="Seçimi Bırak (Esc)"><X size={14} /></button>
                    </div>
                  </div>

                  <div className="p-3 space-y-4">
                  {/* Group 1: Text Editing (for type='text' only) */}
                  {selectedObj.type === 'text' && (
                    <ToolbarSection title="METİN">
                      {['ev-callout', 'ev-arrow-desc', 'ev-arrow-desc-ellipse'].includes(selectedObj.symbolId || '') ? (
                        <textarea
                          value={selectedObj.distance || ''}
                          onChange={(e) => updateObject(selectedId, { distance: e.target.value }, true)}
                          onBlur={() => saveHistory()}
                          onKeyDown={(e) => e.stopPropagation()}
                          rows={2}
                          className="w-full border border-[#333] bg-[#111] rounded-md px-2 py-1.5 text-[11px] text-gray-200 focus:ring-1 focus:ring-[#F5C518]/40 outline-none resize-none leading-tight"
                        />
                      ) : (
                        // ÇOK SATIRLI METİN: Enter ile satır eklenir (kullanıcı isteği:
                        // satırları ayarlayabileyim). Sarım ekranda ve PDF'te aynı kuraldadır.
                        <textarea
                          autoFocus
                          rows={3}
                          value={selectedObj.text || selectedObj.distance || ''}
                          onChange={(e) => updateObject(selectedId, { 
                            [selectedObj.distance !== undefined ? 'distance' : 'text']: e.target.value 
                          }, true)}
                          onBlur={() => saveHistory()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="w-full border border-[#333] bg-[#111] rounded-md px-2 py-1.5 text-[11px] text-gray-200 focus:ring-1 focus:ring-[#F5C518]/40 outline-none resize-none leading-snug"
                        />
                      )}
                      <div className="flex gap-1.5 mt-2">
                        <select
                          value={selectedObj.fontFamily || 'Inter'}
                          onChange={(e) => updateObject(selectedId, { fontFamily: e.target.value })}
                          className="flex-1 min-w-0 bg-[#111] border border-[#333] text-white text-[10px] rounded-md px-1.5 py-1.5 outline-none"
                        >
                          <option value="Arial">Arial</option>
                          <option value="Times New Roman">Times New Roman</option>
                          <option value="Courier New">Courier New</option>
                          <option value="Georgia">Georgia</option>
                          <option value="Verdana">Verdana</option>
                          <option value="Tahoma">Tahoma</option>
                          <option value="Impact">Impact</option>
                        </select>
                        <ToolbarField label="PUNTO">
                          <input
                            type="number"
                            value={Math.round(selectedObj.fontSize || 20)}
                            onChange={(e) => updateObject(selectedId, { fontSize: parseInt(e.target.value) || 12 }, true)}
                            onBlur={() => saveHistory()}
                            className="w-14 bg-[#111] border border-[#333] text-white text-[10px] rounded-md px-1 py-1.5 text-center outline-none"
                          />
                        </ToolbarField>
                        <button
                          onClick={() => updateObject(selectedId, { fontStyle: selectedObj.fontStyle === 'bold' ? 'normal' : 'bold' })}
                          className={`w-8 h-[30px] self-end rounded-md flex items-center justify-center font-bold text-xs transition-colors ${
                            selectedObj.fontStyle === 'bold' ? 'bg-[#F5C518] text-black' : 'bg-[#111] text-gray-400 border border-[#333] hover:border-gray-500'
                          }`}
                          title="Kalın"
                        >
                          B
                        </button>
                      </div>
                      {/* HİZALAMA (kullanıcı isteği: ortalama ayarlaması) — ekran ve PDF aynı kuralı izler */}
                      <div className="flex gap-1 mt-2">
                        {([
                          { v: 'left', I: AlignLeft, t: 'Sola hizala' },
                          { v: 'center', I: AlignCenter, t: 'Ortala' },
                          { v: 'right', I: AlignRight, t: 'Sağa hizala' },
                        ] as const).map(({ v, I, t }) => (
                          <button
                            key={v}
                            onClick={() => updateObject(selectedId, { align: v })}
                            className={`flex-1 h-[28px] rounded-md flex items-center justify-center transition-colors ${
                              (selectedObj.align || 'left') === v
                                ? 'bg-[#F5C518] text-black'
                                : 'bg-[#111] text-gray-400 border border-[#333] hover:border-gray-500'
                            }`}
                            title={t}
                          >
                            <I size={13} />
                          </button>
                        ))}
                      </div>
                      {/* YAZI KONUMU (kullanıcı isteği): yazının kutu içindeki DİKEY konumu —
                          üst / orta / alt. Ekran (Konva verticalAlign) ve PDF aynı kuralı izler. */}
                      <div className="flex gap-1 mt-2">
                        <span className="text-[8px] font-black text-gray-500 uppercase self-center mr-0.5 shrink-0">YAZI KONUMU</span>
                        {([
                          { v: 'top', t: 'ÜST' },
                          { v: 'middle', t: 'ORTA' },
                          { v: 'bottom', t: 'ALT' },
                        ] as const).map(({ v, t }) => (
                          <button
                            key={v}
                            onClick={() => updateObject(selectedId, { vAlign: v })}
                            className={`flex-1 h-[26px] rounded-md flex items-center justify-center text-[9px] font-bold transition-colors ${
                              (selectedObj.vAlign || 'top') === v
                                ? 'bg-[#F5C518] text-black'
                                : 'bg-[#111] text-gray-400 border border-[#333] hover:border-gray-500'
                            }`}
                            title={`Yazıyı kutuda ${t === 'ÜST' ? 'üste' : t === 'ORTA' ? 'ortala' : 'alta'} al`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      {/* KONUM (kullanıcı isteği: yazı konumunu ayarlama) + SATIR AYARI:
                          kutunun sayfadaki X/Y konumu hassas girilir; SATIR ARALIĞI çok
                          satırlı metinlerde satırlar arası boşluğu belirler (1 = normal). */}
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <ToolbarField label="KONUM X">
                          <input
                            type="number"
                            value={Math.round(selectedObj.x || 0)}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (isNaN(v)) return;
                              const P = canvasOrientation === 'landscape' ? 1400 : 1000;
                              updateObject(selectedId, { x: Math.max(0, Math.min(v, P)) });
                            }}
                            className="w-full bg-[#111] border border-[#333] text-white text-[10px] rounded-md px-1 py-1.5 text-center outline-none"
                          />
                        </ToolbarField>
                        <ToolbarField label="KONUM Y">
                          <input
                            type="number"
                            value={Math.round(selectedObj.y || 0)}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (isNaN(v)) return;
                              const P = canvasOrientation === 'landscape' ? 1000 : 1400;
                              updateObject(selectedId, { y: Math.max(0, Math.min(v, P)) });
                            }}
                            className="w-full bg-[#111] border border-[#333] text-white text-[10px] rounded-md px-1 py-1.5 text-center outline-none"
                          />
                        </ToolbarField>
                        <ToolbarField label="SATIR ARALIĞI">
                          <input
                            type="number"
                            step="0.1"
                            min="0.8"
                            max="3"
                            value={selectedObj.lineHeight ?? 1}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (isNaN(v)) return;
                              updateObject(selectedId, { lineHeight: Math.max(0.8, Math.min(3, v)) }, true);
                            }}
                            onBlur={() => saveHistory()}
                            className="w-full bg-[#111] border border-[#333] text-white text-[10px] rounded-md px-1 py-1.5 text-center outline-none"
                          />
                        </ToolbarField>
                      </div>
                    </ToolbarSection>
                  )}

                  {/* Group 2: Dimension Inputs (Architecture, Streets, Symbols, Images) */}
                  {(selectedObj.categoryId === 'architecture' || selectedObj.categoryId === 'streets' || selectedObj.type === 'image' || ['ev-ruler-straight', 'ev-ruler-l'].includes(selectedObj.symbolId || '')) && (
                    <ToolbarSection title="BOYUT" color="#fb923c">
                      <div className="grid grid-cols-3 gap-2">
                        <ToolbarField label={selectedObj.symbolId === 'arch-1v' ? 'EN' : 'BOY'} accent="#fb923c">
                          <input
                            type="number"
                            value={Math.round(selectedObj.width || 100)}
                            onChange={(e) => updateObject(selectedId, { width: parseInt(e.target.value) || 1 })}
                            className="w-full bg-[#111] border border-[#333] rounded-md px-1 py-1.5 text-[10px] text-gray-200 text-center outline-none focus:border-[#F5C518]/50"
                          />
                        </ToolbarField>
                        <ToolbarField label={selectedObj.symbolId === 'arch-1v' ? 'BOY' : 'EN'} accent="#fb923c">
                          <input
                            type="number"
                            value={Math.round(selectedObj.height || 10)}
                            onChange={(e) => updateObject(selectedId, { height: parseInt(e.target.value) || 1 })}
                            className="w-full bg-[#111] border border-[#333] rounded-md px-1 py-1.5 text-[10px] text-gray-200 text-center outline-none focus:border-[#F5C518]/50"
                          />
                        </ToolbarField>
                        <ToolbarField label="YÜKSEKLİK" accent="#34d399">
                          <input
                            type="number"
                            value={Math.round(selectedObj.zHeight || (selectedObj.symbolId === 'arch-win' ? 120 : 210))}
                            onChange={(e) => updateObject(selectedId, { zHeight: parseInt(e.target.value) || 0 })}
                            className="w-full bg-[#111] border border-[#333] rounded-md px-1 py-1.5 text-[10px] text-gray-200 text-center outline-none focus:border-[#F5C518]/50"
                          />
                        </ToolbarField>
                      </div>
                      {!selectedObj.symbolId?.startsWith('arch-') && !selectedObj.symbolId?.startsWith('p-') && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <ChipToggle
                            id="isVertical"
                            label="DİK DUR (3D)"
                            checked={!!(selectedObj as any).isVertical}
                            onChange={(e) => updateObject(selectedId, { isVertical: e.target.checked } as any)}
                            activeClass="border-purple-500/50 bg-purple-500/10 text-purple-300"
                          />
                          <ChipToggle
                            id="isMannequin"
                            label="3D CESET"
                            checked={!!(selectedObj as any).isMannequin}
                            onChange={(e) => updateObject(selectedId, { isMannequin: e.target.checked } as any)}
                            activeClass="border-blue-500/50 bg-blue-500/10 text-blue-300"
                          />
                        </div>
                      )}
                    </ToolbarSection>
                  )}

                  {/* Group 2.5: YOL ADI + ORTA ÇİZGİ (Yol motoru ailesi: st-1/cadde/sokak) */}
                  {['st-1', 'st-cadde', 'st-sokak'].includes(selectedObj.symbolId || '') && (
                    <ToolbarSection title={selectedObj.symbolId === 'st-cadde' ? 'CADDE' : selectedObj.symbolId === 'st-sokak' ? 'SOKAK' : 'YOL'} color="#fb923c">
                      <input
                        type="text"
                        placeholder={selectedObj.symbolId === 'st-cadde' ? 'Örn. Atatürk Caddesi' : selectedObj.symbolId === 'st-sokak' ? 'Örn. 5. Sokak' : 'Örn. İstasyon Yolu'}
                        value={selectedObj.streetName || ''}
                        onChange={(e) => updateObject(selectedId, { streetName: e.target.value } as any, true)}
                        onBlur={() => saveHistory()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="w-full border border-[#333] bg-[#111] rounded-md px-2 py-1.5 text-[11px] text-gray-200 focus:ring-1 focus:ring-[#F5C518]/40 outline-none"
                      />
                      <div className="flex items-end gap-2 mt-2">
                        <ToolbarField label="PUNTO">
                          <input
                            type="number"
                            value={Math.round(selectedObj.streetFontSize || Math.max(11, Math.min(30, (selectedObj.height || 40) * 0.32)))}
                            onChange={(e) => updateObject(selectedId, { streetFontSize: parseInt(e.target.value) || undefined } as any, true)}
                            onBlur={() => saveHistory()}
                            className="w-14 bg-[#111] border border-[#333] text-white text-[10px] rounded-md px-1 py-1.5 text-center outline-none"
                          />
                        </ToolbarField>
                        <div className="flex-1">
                          <ChipToggle
                            id="roadMidLine"
                            label="ORTA ÇİZGİ"
                            checked={selectedObj.roadMiddleLine !== undefined ? !!selectedObj.roadMiddleLine : selectedObj.symbolId === 'st-1'}
                            onChange={(e) => updateObject(selectedId, { roadMiddleLine: e.target.checked } as any)}
                            activeClass="border-orange-500/50 bg-orange-500/10 text-orange-300"
                          />
                        </div>
                      </div>
                    </ToolbarSection>
                  )}

                  {/* Group 3: Label/Annotation (Available for everything that isn't raw text) */}
                  {selectedObj.type !== 'text' && selectedObj.symbolId !== 'ev-shooting-trajectory' && (
                    <ToolbarSection title="ETİKET" color="#60a5fa">
                      {/* ÇOK SATIRLI ETİKET (kullanıcı isteği: satır ayarlama): Enter ile
                          yeni satır eklenir; ekran ve PDF aynı satır kırılımını kullanır. */}
                      <textarea
                        rows={2}
                        placeholder="Açıklama..."
                        value={selectedObj.distance || ''}
                        onChange={(e) => {
                          const newText = e.target.value;
                          if (selectedObj.symbolId === 'ev-callout') {
                            // Balon çerçevesi KORUNUR: kullanıcı balonu tutamaçla büyüttüyse
                            // metin düzenlemek çerçeveyi otomatik sığma boyutuna küçültmez.
                            const size = calculateCalloutSize(newText, selectedObj.distanceFontSize || 14);
                            updateObject(selectedId, {
                              distance: newText,
                              width: Math.max(size.w, selectedObj.width || 0),
                              height: Math.max(size.h, selectedObj.height || 0),
                            }, true);
                          } else {
                            updateObject(selectedId, { distance: newText }, true);
                          }
                        }}
                        onBlur={() => saveHistory()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="w-full border border-[#333] bg-[#111] rounded-md px-2 py-1.5 text-[11px] text-gray-200 focus:ring-1 focus:ring-[#F5C518]/40 outline-none resize-none leading-snug"
                      />
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <ToolbarField label="YAZI BOYU">
                          <input
                            type="number"
                            value={Math.round(selectedObj.distanceFontSize || 14)}
                            onChange={(e) => updateObject(selectedId, { distanceFontSize: parseInt(e.target.value) || 12 }, true)}
                            onBlur={() => saveHistory()}
                            className="w-full bg-[#111] border border-[#333] text-white text-[10px] rounded-md px-1 py-1.5 text-center outline-none"
                          />
                        </ToolbarField>
                        <ToolbarField label="SATIR ARALIĞI">
                          <input
                            type="number"
                            step="0.1"
                            min="0.8"
                            max="3"
                            value={selectedObj.lineHeight ?? 1}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (isNaN(v)) return;
                              updateObject(selectedId, { lineHeight: Math.max(0.8, Math.min(3, v)) }, true);
                            }}
                            onBlur={() => saveHistory()}
                            className="w-full bg-[#111] border border-[#333] text-white text-[10px] rounded-md px-1 py-1.5 text-center outline-none"
                          />
                        </ToolbarField>
                      </div>
                      {/* YAZI KONUMU (kullanıcı isteği): etiketin sembole göre konum ofseti.
                          Etiket tuvalde sürüklenebilir; buradan da hassas sayısal değer
                          girilir. PDF dışa aktarımı aynı ofseti kullanır. */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <ToolbarField label="ETİKET X">
                          <input
                            type="number"
                            step="1"
                            value={Math.round(selectedObj.labelOffset?.dx || 0)}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (isNaN(v)) return;
                              updateObject(selectedId, { labelOffset: { dx: v, dy: selectedObj.labelOffset?.dy || 0 } }, true);
                            }}
                            onBlur={() => saveHistory()}
                            className="w-full bg-[#111] border border-[#333] text-white text-[10px] rounded-md px-1 py-1.5 text-center outline-none"
                          />
                        </ToolbarField>
                        <ToolbarField label="ETİKET Y">
                          <input
                            type="number"
                            step="1"
                            value={Math.round(selectedObj.labelOffset?.dy || 0)}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (isNaN(v)) return;
                              updateObject(selectedId, { labelOffset: { dx: selectedObj.labelOffset?.dx || 0, dy: v } }, true);
                            }}
                            onBlur={() => saveHistory()}
                            className="w-full bg-[#111] border border-[#333] text-white text-[10px] rounded-md px-1 py-1.5 text-center outline-none"
                          />
                        </ToolbarField>
                      </div>
                      <button
                        onClick={() => updateObject(selectedId, { labelOffset: { dx: 0, dy: 0 } })}
                        className="w-full mt-2 px-2 py-1.5 bg-[#111] border border-[#333] rounded-md text-[9px] font-bold text-gray-400 hover:border-[#60a5fa]/50 hover:text-[#60a5fa] transition-colors"
                        title="Etiketi otomatik konumuna geri getir"
                      >
                        ETİKET KONUMUNU SIFIRLA
                      </button>
                      {/* RAKAM KONUMU BUTONLARI (kullanıcı isteği): mesafe oku rakamını
                          sürüklemek yerine tek tıkla çizginin üstüne/ortasına/altına
                          yerleştir. Ofset nesne-yerel uzaydadır (labelOffset) — ekran,
                          önizleme ve PDF aynı konumu çizer. SIFIRLA hem yatay hem
                          dikey ofseti başlangıca döndürür. */}
                      {(selectedObj.isDistanceArrow || selectedObj.symbolId === 'a-4' || selectedObj.symbolId === 'a-5') && (
                        <div className="mt-2">
                          <div className="text-[8px] font-black text-gray-500 uppercase tracking-wider mb-1">Rakam Konumu</div>
                          <div className="grid grid-cols-4 gap-1">
                            {(() => {
                              const fs = selectedObj.distanceFontSize || 10;
                              const step = fs + 12;
                              const keepDx = selectedObj.labelOffset?.dx || 0;
                              const presets: Array<[string, number, string]> = [
                                ['ÜST', 0, 'Rakam çizginin üstünde'],
                                ['ORTA', step, 'Rakam çizginin ortasında'],
                                ['ALT', step * 2, 'Rakam çizginin altında'],
                              ];
                              return (
                                <>
                                  {presets.map(([lbl, dy, tip]) => (
                                    <button
                                      key={lbl}
                                      title={tip}
                                      onClick={() => updateObject(selectedId, { labelOffset: { dx: keepDx, dy } })}
                                      className={`px-1 py-1.5 rounded-md border text-[9px] font-black transition-colors ${
                                        (selectedObj.labelOffset?.dy || 0) === dy
                                          ? 'bg-[#F5C518]/15 border-[#F5C518]/50 text-[#F5C518]'
                                          : 'bg-[#111] border-[#333] text-gray-300 hover:border-[#F5C518]/50'
                                      }`}
                                    >
                                      {lbl}
                                    </button>
                                  ))}
                                  <button
                                    title="Rakam konumunu başlangıca döndür"
                                    onClick={() => updateObject(selectedId, { labelOffset: { dx: 0, dy: 0 } })}
                                    className="px-1 py-1.5 rounded-md border bg-[#111] border-[#333] text-gray-300 text-[9px] font-black hover:border-red-500/50 hover:text-red-400 transition-colors"
                                  >
                                    ↺
                                  </button>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </ToolbarSection>
                  )}

                  {/* Group 4: Visual Style (Renk, Doku, Çevirme, Döndürme, Ortalama) */}
                  <ToolbarSection title="GÖRÜNÜM" color="#22d3ee">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={selectedObj.distanceColor || selectedObj.fill || '#000000'}
                        onInput={(e: any) => updateObject(selectedId, { distanceColor: e.target.value, fill: e.target.value }, true)}
                        onChange={() => saveHistory()}
                        className="w-8 h-8 rounded-md cursor-pointer border border-[#333] p-0.5 bg-transparent shrink-0"
                        title="Renk"
                      />
                      {/* DOKU MODU — görsel semboller uzatıldığında desen bozulmasın.
                          Şerit: desen uzun eksende tekrar eder (yol/refüj/iz şeritleri).
                          Karo: desen iki eksende tekrar eder (çukur/islak zemin dokuları).
                          Yüklenen görsellerde de çalışır. */}
                      {!!selectedObj.src && (selectedObj.type === 'symbol' || selectedObj.type === 'image') && (
                        <select
                          value={selectedObj.tileMode || 'auto'}
                          onChange={(e) => updateObject(selectedId, { tileMode: e.target.value as CanvasObject['tileMode'] })}
                          title="Uzatma modu: Şerit/Karo seçiliyken görsel uzatıldığında desen bozulmadan tekrar eder"
                          className="flex-1 min-w-0 bg-[#111] border border-[#333] text-white text-[10px] rounded-md px-1.5 py-2 outline-none"
                        >
                          <option value="auto">DOKU: OTO</option>
                          <option value="stretch">NORMAL</option>
                          <option value="strip-auto">ŞERİT (OTO)</option>
                          <option value="strip-x">ŞERİT YATAY</option>
                          <option value="strip-y">ŞERİT DİKEY</option>
                          <option value="tile">KARO (2D)</option>
                        </select>
                      )}
                    </div>
                    {(selectedObj.type === 'symbol' || selectedObj.type === 'image') && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {/* Door Specific Orientation Controls */}
                        {['arch-d1r', 'arch-d1l', 'arch-d2'].includes(selectedObj.symbolId || '') && (
                          <>
                            <span className="text-[8px] font-black text-gray-500 uppercase">Kapı:</span>
                            <button
                              onClick={() => updateObject(selectedId, { scaleX: (selectedObj.scaleX || 1) * -1 })}
                              className="w-8 h-8 bg-[#111] border border-[#333] rounded-md hover:border-[#F5C518] flex items-center justify-center text-[11px] text-gray-300"
                              title="Yönü Değiştir (Sağ/Sol)"
                            >
                              ⇄
                            </button>
                            <button
                              onClick={() => updateObject(selectedId, { scaleY: (selectedObj.scaleY || 1) * -1 })}
                              className="w-8 h-8 bg-[#111] border border-[#333] rounded-md hover:border-[#F5C518] flex items-center justify-center text-[11px] text-gray-300"
                              title="Açılış Yönü (İç/Dış)"
                            >
                              ⇅
                            </button>
                            <span className="w-px h-5 bg-[#333] mx-0.5" />
                          </>
                        )}
                        <button onClick={() => updateObject(selectedId, { scaleX: (selectedObj.scaleX || 1) * -1 })} className="w-8 h-8 bg-[#111] border border-[#333] rounded-md hover:border-[#F5C518] flex items-center justify-center text-gray-300" title="Yatay Çevir"><FlipHorizontal2 size={13} /></button>
                        <button onClick={() => updateObject(selectedId, { scaleY: (selectedObj.scaleY || 1) * -1 })} className="w-8 h-8 bg-[#111] border border-[#333] rounded-md hover:border-[#F5C518] flex items-center justify-center text-gray-300" title="Dikey Çevir"><FlipVertical2 size={13} /></button>
                        {!['arch-1', 'arch-1v'].includes(selectedObj.symbolId || '') && (
                          <button onClick={() => updateObject(selectedId, { rotation: ((selectedObj.rotation || 0) + 90) % 360 })} className="w-8 h-8 bg-[#111] border border-[#333] rounded-md hover:border-[#F5C518] flex items-center justify-center text-gray-300" title="90 Derece Döndür"><RotateCw size={13} /></button>
                        )}
                        <span className="w-px h-5 bg-[#333] mx-0.5" />
                        <button
                          onClick={() => {
                            if (drawingArea) {
                              updateObject(selectedId, { x: drawingArea.x + (drawingArea.width - (selectedObj.width || 0)) / 2 });
                            }
                          }}
                          className="w-8 h-8 bg-[#111] border border-[#333] rounded-md hover:border-[#F5C518] flex items-center justify-center text-gray-300"
                          title="Yatayda Ortala"
                        >
                          <AlignCenterHorizontal size={13} />
                        </button>
                        <button
                          onClick={() => {
                            if (drawingArea) {
                              updateObject(selectedId, { y: drawingArea.y + (drawingArea.height - (selectedObj.height || 0)) / 2 });
                            }
                          }}
                          className="w-8 h-8 bg-[#111] border border-[#333] rounded-md hover:border-[#F5C518] flex items-center justify-center text-gray-300"
                          title="Dikeyde Ortala"
                        >
                          <AlignCenterVertical size={13} />
                        </button>
                      </div>
                    )}
                    {isLogo && isAdmin && (
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        className="w-full mt-2 px-2 py-1.5 bg-[#F5C518]/10 text-[#F5C518] border border-[#F5C518]/30 rounded-md text-[9px] font-bold hover:bg-[#F5C518]/20 transition-all flex items-center justify-center gap-1"
                      >
                        <Upload size={10} />
                        {objects.find(o => o.id === 'corporate-logo')?.src ? 'LOGOYU DEĞİŞTİR' : 'LOGO YÜKLE'}
                      </button>
                    )}
                  </ToolbarSection>

                  {/* Ballistic Analysis Controls */}
                  {selectedObj.symbolId === 'ev-shooting-trajectory' && (
                    <ToolbarSection title="ATIŞ YÖNÜ" color="#f87171">
                      <div className="grid grid-cols-3 gap-2">
                        <ToolbarField label="YATAY AÇI" accent="#f87171">
                          <input
                            type="number"
                            value={selectedObj.azimuth || 0}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '-' || val === '.' || val === '') return;
                              const newAz = parseFloat(val);
                              if (isNaN(newAz)) return;

                              const sx = selectedObj.startX ?? 0;
                              const sy = selectedObj.startY ?? 0;
                              const ex = selectedObj.endX ?? 150;
                              const ey = selectedObj.endY ?? 0;
                              const dx = ex - sx;
                              const dy = ey - sy;
                              const len = Math.sqrt(dx*dx + dy*dy) || 100;
                              const rad = (newAz - 90) * (Math.PI / 180);
                              const nEx = sx + len * Math.cos(rad);
                              const nEy = sy + len * Math.sin(rad);

                              if (isNaN(nEx) || isNaN(nEy)) return;

                              updateObject(selectedId, {
                                azimuth: newAz,
                                endX: nEx,
                                endY: nEy,
                                x: (sx + nEx) / 2,
                                y: (sy + nEy) / 2
                              });
                            }}
                            className="w-full bg-[#111] border border-[#333] rounded-md px-1 py-1.5 text-[10px] text-gray-200 text-center outline-none focus:border-[#F5C518]/50"
                          />
                        </ToolbarField>
                        <ToolbarField label="DİKEY AÇI" accent="#f87171">
                          <input
                            type="number"
                            value={selectedObj.tilt || 0}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '-' || val === '.' || val === '') return;
                              const valNum = parseFloat(val);
                              if (!isNaN(valNum)) {
                                updateObject(selectedId, { tilt: valNum });
                              }
                            }}
                            className="w-full bg-[#111] border border-[#333] rounded-md px-1 py-1.5 text-[10px] text-gray-200 text-center outline-none focus:border-[#F5C518]/50"
                          />
                        </ToolbarField>
                        <ToolbarField label="UZUNLUK" accent="#f87171">
                          <input
                            type="number"
                            value={(selectedObj as any).length || Math.round(Math.sqrt(Math.pow((selectedObj.endX || 0) - (selectedObj.startX || 0), 2) + Math.pow((selectedObj.endY || 0) - (selectedObj.startY || 0), 2)))}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') return;
                              const newLen = parseFloat(val);
                              if (isNaN(newLen) || newLen <= 0) return;

                              const sx = selectedObj.startX || 0;
                              const sy = selectedObj.startY || 0;
                              const ex = selectedObj.endX || 150;
                              const ey = selectedObj.endY || 0;
                              const dx = ex - sx;
                              const dy = ey - sy;
                              const currentLen = Math.sqrt(dx*dx + dy*dy);
                              const ratio = newLen / (currentLen || 1);
                              const nEx = sx + dx * ratio;
                              const nEy = sy + dy * ratio;
                              updateObject(selectedId, {
                                length: newLen,
                                endX: nEx,
                                endY: nEy,
                                x: (sx + nEx) / 2,
                                y: (sy + nEy) / 2
                              } as any);
                            }}
                            className="w-full bg-[#111] border border-[#333] rounded-md px-1 py-1.5 text-[10px] text-gray-200 text-center outline-none focus:border-[#F5C518]/50"
                          />
                        </ToolbarField>
                      </div>
                      <p className="text-[8px] text-gray-600 mt-1.5">Açı değerleri derece (°), uzunluk cm cinsindendir.</p>
                    </ToolbarSection>
                  )}

                  {/* Analiz Araçları: hız analizi, hız göstergesi, BPA kuyruğu */}
                  {(selectedObj.symbolId === 'tr-2' || selectedObj.symbolId === 'ev-bpa-drop' || selectedObj.symbolId === 'a-4' || selectedObj.isDistanceArrow) && (
                    <ToolbarSection title="ANALİZ" color="#34d399">
                      {selectedObj.symbolId === 'ev-bpa-drop' && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[8px] font-black text-red-400 uppercase shrink-0">Kuyruk</span>
                          <input
                            type="range"
                            min="20" max="800"
                            value={selectedObj.tailLength || 100}
                            onChange={(e) => updateObject(selectedId, { tailLength: parseInt(e.target.value) })}
                            className="flex-1 h-1 rounded-lg appearance-none bg-[#333] cursor-pointer accent-red-500"
                          />
                        </div>
                      )}
                      {(selectedObj.symbolId === 'tr-2' || selectedObj.symbolId === 'ev-bpa-drop') && (
                        <button
                          onClick={() => {
                            const meters = (selectedObj.width * (selectedObj.scaleX || 1)) / 50;
                            window.dispatchEvent(new CustomEvent('open-skid-calculator', {
                              detail: { distance: meters.toFixed(2) }
                            }));
                          }}
                          className="w-full px-2 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md text-[9px] font-black hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-1"
                        >
                          <Activity size={10} />
                          HIZ ANALİZİ YAP
                        </button>
                      )}
                      {(selectedObj.symbolId === 'a-4' || selectedObj.isDistanceArrow) && (
                        <label className="flex items-center gap-1.5 cursor-pointer group mt-1.5">
                          <div className="relative">
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={selectedObj.showSpeedInfo || false}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                updateObject(selectedId, { showSpeedInfo: checked });
                                if (checked) {
                                  // Extract distance and open calculator
                                  const rawText = String(selectedObj.text || selectedObj.distance || '');
                                  const match = rawText.match(/\d+(\.\d+)?/);
                                  const cm = match ? parseFloat(match[0]) : 0;
                                  const meters = rawText.toLowerCase().includes('metre') ? cm : cm / 100;
                                  window.dispatchEvent(new CustomEvent('open-skid-calculator', {
                                    detail: {
                                      distance: meters.toFixed(2),
                                      objectId: selectedId
                                    }
                                  }));
                                }
                              }}
                            />
                            <div className={`w-6 h-3.5 rounded-full transition-colors ${selectedObj.showSpeedInfo ? 'bg-emerald-500' : 'bg-gray-700'}`}></div>
                            <div className={`absolute left-0.5 top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${selectedObj.showSpeedInfo ? 'translate-x-2.5' : ''}`}></div>
                          </div>
                          <span className="text-[9px] font-bold text-gray-400 group-hover:text-emerald-400 transition-colors uppercase">HIZ GÖSTER</span>
                        </label>
                      )}
                    </ToolbarSection>
                  )}

                  {/* Triangulation and Matrix Tools */}
                  {(selectedObj.findingNo || selectedObj.isTriangulation) && (
                    <ToolbarSection title="BULGU ARAÇLARI" color="#F5C518">
                      <button
                        onClick={() => setFindingModalState({
                          isOpen: true,
                          symbol: selectedObj,
                          pos: { x: selectedObj.x, y: selectedObj.y }
                        })}
                        className="w-full px-2 py-1.5 bg-[#F5C518]/10 text-[#F5C518] border border-[#F5C518]/30 rounded-md text-[9px] font-bold hover:bg-[#F5C518]/20 transition-all flex items-center justify-center gap-1"
                        title="Bulgu numarasını veya açıklamasını düzenle"
                      >
                        <Info size={10} />
                        {selectedObj.isTriangulation ? 'NO DÜZENLE' : 'BİLGİ DÜZENLE'}
                      </button>
                      <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                        <button
                          onClick={() => handleTriangulate(selectedId)}
                          className="px-2 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-md text-[9px] font-bold hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-1"
                          title="En yakın duvarlara veya sabit noktalara olan mesafeyi otomatik hesapla"
                        >
                          <Target size={10} />
                          SABİT NOKTA
                        </button>
                        <button
                          onClick={() => setIsDistanceMatrixOpen(true)}
                          className="px-2 py-1.5 bg-blue-500/10 text-blue-500 border border-blue-500/30 rounded-md text-[9px] font-bold hover:bg-blue-500/20 transition-all flex items-center justify-center gap-1"
                          title="Tüm bulguların birbirine olan mesafesini gör"
                        >
                          <Grid size={10} />
                          MESAFE ÖLÇ
                        </button>
                      </div>
                    </ToolbarSection>
                  )}

                  {/* Evidence Photo Management for any finding */}
                  {selectedObj.findingNo && (
                    <ToolbarSection title="FOTOĞRAFLAR" color="#60a5fa">
                      <button
                        onClick={() => {
                          setEvidencePhotoTarget(selectedId);
                          setIsEvidencePhotoModalOpen(true);
                        }}
                        className={`w-full px-2 py-1.5 border rounded-md text-[9px] font-bold transition-all flex items-center justify-center gap-1 ${
                          (selectedObj.photos?.length || 0) > 0
                            ? 'bg-[#F5C518]/10 text-[#F5C518] border-[#F5C518]/30'
                            : 'bg-white/5 text-gray-400 border-[#333] hover:border-gray-500'
                        }`}
                      >
                        <Camera size={10} />
                        FOTOĞRAFLAR {(selectedObj.photos?.length || 0) > 0 && `(${selectedObj.photos?.length})`}
                      </button>
                    </ToolbarSection>
                  )}

                  {/* Camera Link Anchor Controls */}
                  {selectedObj.symbolId === 'ev-camera-link' && (
                    <ToolbarSection title="KAMERA" color="#60a5fa">
                      <button
                        onClick={() => cameraInputRef.current?.click()}
                        className="w-full px-2 py-1.5 bg-blue-500/10 text-blue-500 border border-blue-500/30 rounded-md text-[9px] font-bold hover:bg-blue-500/20 transition-all flex items-center justify-center gap-1"
                      >
                        <Upload size={10} />
                        {selectedObj.photo ? 'FOTOĞRAFI DEĞİŞTİR' : 'FOTOĞRAF BAĞLA'}
                      </button>
                      {selectedObj.photo && (
                        <button
                          onClick={() => {
                            const win = window.open();
                            if (win) {
                              win.document.title = 'Fotoğraf Görüntüleme';
                              const body = win.document.body;
                              body.style.cssText = 'margin:0; background:#000; display:flex; align-items:center; justify-content:center;';
                              const img = win.document.createElement('img');
                              img.src = selectedObj.photo || '';
                              img.style.cssText = 'max-width:100%; max-height:100%; box-shadow: 0 0 50px rgba(0,0,0,0.5);';
                              img.alt = '';
                              body.appendChild(img);
                            }
                          }}
                          className="w-full mt-1.5 px-2 py-1.5 bg-green-500/10 text-green-500 border border-green-500/30 rounded-md text-[9px] font-bold hover:bg-green-500/20 transition-all flex items-center justify-center gap-1"
                        >
                          FOTOĞRAFI GÖR
                        </button>
                      )}
                    </ToolbarSection>
                  )}

                  {/* Body Map Analysis */}
                  {selectedObj.symbolId === 'ev-body-map' && (
                    <ToolbarSection title="VÜCUT ANALİZİ" color="#f87171">
                      <button
                        onClick={() => {
                          setBodyMapTarget(selectedId);
                          setIsBodyMapModalOpen(true);
                        }}
                        className="w-full px-2 py-1.5 bg-red-500/10 text-red-500 border border-red-500/30 rounded-md text-[9px] font-bold hover:bg-red-500/20 transition-all flex items-center justify-center gap-1"
                      >
                        <User size={10} />
                        VÜCUT ANALİZİ {(selectedObj.injuries?.length || 0) > 0 && `(${selectedObj.injuries?.length})`}
                      </button>
                    </ToolbarSection>
                  )}

                  {/* Group 5: Arrows Specifics */}
                  {(selectedObj.isDistanceArrow || selectedObj.symbolId?.startsWith('a-5')) && (
                    <ToolbarSection title="OK KALINLIĞI" color="#F5C518">
                      <input
                        type="range"
                        min="1" max="15"
                        value={selectedObj.strokeWidth || 4}
                        onChange={(e) => updateObject(selectedId, { strokeWidth: parseInt(e.target.value) })}
                        className="w-full h-1 rounded-lg appearance-none bg-[#333] cursor-pointer accent-[#F5C518]"
                      />
                    </ToolbarSection>
                  )}

                  {/* Group 6: DÜZEN — katman sırası ve silme */}
                  <ToolbarSection title="DÜZEN" color="#9ca3af">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => {
                        const maxZ = Math.max(...objects.map(o => getEffectiveZIndex(o)), 0);
                        updateObject(selectedId, { zIndex: maxZ + 1 });
                      }} className="flex-1 px-2 py-1.5 bg-[#111] border border-[#333] rounded-md text-gray-300 text-[9px] font-bold hover:border-[#F5C518] transition-colors flex items-center justify-center gap-1" title="Öne Getir"><MoveUp size={11} /> ÖNE</button>
                      <button onClick={() => {
                        const minZ = Math.min(...objects.filter(o => !o.isTemplate).map(o => getEffectiveZIndex(o)), 0);
                        updateObject(selectedId, { zIndex: Math.max(0, minZ - 1) });
                      }} className="flex-1 px-2 py-1.5 bg-[#111] border border-[#333] rounded-md text-gray-300 text-[9px] font-bold hover:border-[#F5C518] transition-colors flex items-center justify-center gap-1" title="Arka Getir"><MoveDown size={11} /> ARKA</button>
                      <button onClick={() => removeObject(selectedId)} className="p-2 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 hover:bg-red-500/20 transition-colors" title="Sil (Delete)"><Trash2 size={14} /></button>
                    </div>
                  </ToolbarSection>
                  </div>
                </>
              );
            })()}
          </div>
        )}


        {/* Logo yükleme düğmesi artık seçim panelinin GÖRÜNÜM bölümünde (logoInputRef aşağıda) */}

        <input 
          type="file" 
          ref={cameraInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleCameraPhotoUpload} 
        />

        <input 
          type="file" 
          ref={logoInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleLogoUpload} 
        />
      </div>


      <Suspense fallback={null}>
        <FindingModal
          isOpen={findingModalState.isOpen}
          onClose={() => setFindingModalState(s => ({ ...s, isOpen: false }))}
          title={
            objects.some(o => o.id === findingModalState.symbol?.id) 
              ? (findingModalState.symbol?.id === 'out-fixed-point' ? "SABİT NOKTAYI DÜZENLE" : "BULGUYU DÜZENLE")
              : (findingModalState.symbol?.id === 'out-fixed-point' ? "YENİ NİRENGİ / SABİT NOKTA EKLE" : "YENİ BULGU EKLE")
          }
        defaultNo={findingModalState.symbol?.findingNo || ''}
        defaultDesc={findingModalState.symbol?.findingDesc || ''}
        onConfirm={(no, desc) => {
          if (no) {
            const existingId = findingModalState.symbol?.id;
            const isEditing = objects.some(o => o.id === existingId);

            if (isEditing) {
              updateObject(existingId, {
                findingNo: no,
                findingDesc: desc
              });
            } else {
              addObject({
                ...findingModalState.symbol,
                id: uuidv4(),
                x: findingModalState.pos.x - 20,
                y: findingModalState.pos.y - 20,
                width: 40,
                height: 40,
                zIndex: objects.length,
                findingNo: no,
                findingDesc: desc,
                symbolId: findingModalState.symbol.id,
                categoryId: 'evidence'
              });
            }
          }
        }}
        />

        <PromptModal
          isOpen={promptState.isOpen}
          onClose={() => setPromptState(s => ({ ...s, isOpen: false }))}
          title={promptState.title}
          label={promptState.label}
          defaultValue={promptState.value}
          onConfirm={promptState.onConfirm}
          multiline={promptState.multiline}
        />
      </Suspense>

      <Suspense fallback={null}>
        <DistanceModal
          isOpen={isDistanceModalOpen}
          onClose={() => setIsDistanceModalOpen(false)}
          onConfirm={(value) => {
            if (distanceModalTarget) {
              updateObject(distanceModalTarget, { distance: value });
              saveHistory();
            }
            setIsDistanceModalOpen(false);
          }}
          initialValue={initialDistance}
          title="ATIŞ MESAFESİ"
        />

        <EvidencePhotoModal
          isOpen={isEvidencePhotoModalOpen}
          onClose={() => setIsEvidencePhotoModalOpen(false)}
          object={objects.find(o => o.id === evidencePhotoTarget) || null}
          onUpdatePhotos={(newPhotos: string[]) => {
            if (evidencePhotoTarget) {
              updateObject(evidencePhotoTarget, { photos: newPhotos });
              saveHistory();
            }
          }}
        />

        <BodyMapModal
          isOpen={isBodyMapModalOpen}
          onClose={() => setIsBodyMapModalOpen(false)}
          object={objects.find(o => o.id === bodyMapTarget) || null}
          onUpdateInjuries={(newInjuries: any[]) => {
            if (bodyMapTarget) {
              updateObject(bodyMapTarget, { injuries: newInjuries });
              saveHistory();
            }
          }}
        />

        <DistanceMatrixModal
          isOpen={isDistanceMatrixOpen}
          onClose={() => setIsDistanceMatrixOpen(false)}
          objects={objects}
          onDrawMeasurement={handleDrawMeasurement}
        />
      </Suspense>

      {/* Fixed Bottom status bar (merged with pages) */}
      <div className="h-12 bg-[#1a1a1a] border-t border-[#2a2a2a] flex items-center px-4 gap-1 z-10 flex-shrink-0 bottom-bar">
        <button
          onClick={() => setGridVisible(!gridVisible)}
          className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${
            gridVisible
              ? 'bg-[#F5C518] text-black'
              : 'bg-[#242424] text-gray-500 border border-[#333] hover:border-[#444]'
          }`}
        >
          KILAVUZ: {gridVisible ? 'AÇIK' : 'KAPALI'}
        </button>

        <button 
          onClick={() => setCanvasBgColor(canvasBgColor === '#0a0a0a' ? '#ffffff' : '#0a0a0a')}
          className={`px-3 py-1 text-[10px] font-bold rounded transition-all border ${
            canvasBgColor === '#ffffff' 
              ? 'bg-white text-black border-gray-300' 
              : 'bg-[#242424] text-gray-400 border-[#333] hover:border-[#444]'
          }`}
        >
          ZEMİN: {canvasBgColor === '#ffffff' ? 'BEYAZ' : 'SİYAH'}
        </button>

        <div className="h-4 w-px bg-[#333] mx-2" />

        <div className="flex-1 flex items-center gap-1 overflow-x-auto custom-scrollbar">
          <PageControlBar variant="inline" />
        </div>

        <div className="flex items-center gap-1 bg-[#242424] rounded border border-[#333] px-1 py-0.5">
          <button 
            onClick={() => {
              if (containerRef.current) {
                const containerWidth = containerRef.current.offsetWidth - 4;
                const containerHeight = containerRef.current.offsetHeight - 4;
                const stageWidth = canvasOrientation === 'landscape' ? 1400 : 1000;
                const stageHeight = canvasOrientation === 'landscape' ? 1000 : 1400;
                const newScale = Math.min(containerWidth / stageWidth, containerHeight / stageHeight, 2);
                setScale(newScale);
                setStagePos({ x: 0, y: 0 });
              }
            }}
            className="px-2 py-0.5 text-[9px] font-bold text-gray-400 hover:text-[#F5C518] hover:bg-[#333] rounded transition-all"
          >
            SIĞDIR
          </button>
          <div className="w-px h-3 bg-[#333]" />
          <button 
            onClick={() => {
              setScale(1);
              setStagePos({ x: 0, y: 0 });
            }}
            className="px-2 py-0.5 text-[9px] font-bold text-gray-400 hover:text-[#F5C518] hover:bg-[#333] rounded transition-all"
          >
            %100
          </button>
          <div className="w-px h-3 bg-[#333]" />
          <button 
            onClick={() => setCanvasOrientation(canvasOrientation === 'landscape' ? 'portrait' : 'landscape')}
            className="px-3 py-1 text-[10px] font-bold rounded bg-[#242424] text-gray-200 border border-[#333] hover:border-[#F5C518] hover:text-[#F5C518] transition-all uppercase"
          >
            TUVAL: A4 ({canvasOrientation === 'landscape' ? 'YATAY' : 'DİKEY'})
          </button>
          <span className="px-2 text-[9px] font-black text-[#F5C518] min-w-[35px] text-center">
            %{Math.round(scale * 100)}
          </span>
        </div>

        <div className="h-4 w-px bg-[#333] mx-2" />

        <span className="text-[9px] text-gray-300 font-semibold italic whitespace-nowrap">
          Resmi Makamlar İçin Olay Yeri Dokümantasyonu
        </span>
      </div>

      {/* HTML-based High Priority Photo Preview Overlay (Overflows canvas) */}
      {hoveredId && hoveredPos && (
        <div 
          className="fixed z-[99999] pointer-events-none transition-all duration-200"
          style={{ 
            left: `${hoveredPos.x}px`, 
            top: `${hoveredPos.y - 20}px`,
            transform: 'translateX(-50%) translateY(-100%)'
          }}
        >
          {(() => {
            const obj = objects.find(o => o.id === hoveredId);
            if (!obj || !obj.photos || obj.photos.length === 0) return null;
            
            return (
              <div className="flex flex-col items-center">
                <div className="bg-[#1a1a1a]/95 backdrop-blur-xl border-2 border-[#F5C518] rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex gap-4 ring-1 ring-white/10 animate-in zoom-in-95 duration-200">
                  {obj.photos.slice(0, 3).map((url, i) => (
                    <div key={i} className="relative group">
                      <img 
                        src={url} 
                        className="w-[150px] h-[150px] object-contain bg-[#111] rounded-lg border border-[#333] shadow-inner" 
                        alt="Evidence" 
                      />
                      <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[8px] font-black text-[#F5C518] border border-[#F5C518]/30">
                        #{i+1}
                      </div>
                    </div>
                  ))}
                  {obj.photos.length > 3 && (
                    <div className="flex items-center justify-center min-w-[40px] text-xl font-black text-[#F5C518] animate-pulse">
                      +{obj.photos.length - 3}
                    </div>
                  )}
                </div>
                {/* Speech bubble arrow */}
                <div 
                  className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[15px] border-t-[#F5C518]"
                />
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
