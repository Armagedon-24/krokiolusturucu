// Konva (editör) vs PDF offscreen (yamalı + eski) çizim parite testi
// Gerçek uygulama sembolü: arch-d1r (kapı sağ) — Group + beyaz kasa Rect + aynalı Image
import { g as Konva } from '../assets/vendor-konva-Bl4nmkC5.js';

const out = document.getElementById('out');
const tbl = document.getElementById('tbl');
const log = (s) => { out.textContent += s + '\n'; };

const DOOR_SVG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="0" y="85" width="100" height="15" fill="white" stroke="black" stroke-width="4"/><line x1="95" y1="85" x2="95" y2="10" stroke="black" stroke-width="6"/><path d="M 95 10 A 85 85 0 0 0 10 85" stroke="black" stroke-width="2" fill="none" stroke-dasharray="5"/></svg>';

const img = new Image();
img.src = DOOR_SVG;
await new Promise((res) => { img.onload = res; img.onerror = () => { log('SVG yuklenemedi'); }; });

const W = 1000, H = 1400;

// ---- editör (Konva) çizimi: uygulamanın _s kapı dalının birebir aynısı ----
function drawKonva({ x, y, rot, sx, sy }) {
  const stage = new Konva.Stage({ container: document.createElement('div'), width: W, height: H });
  const layer = new Konva.Layer();
  stage.add(layer);
  layer.add(new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: '#ffffff', listening: false }));
  const group = new Konva.Group({ x, y, rotation: rot, width: 60, height: 60, draggable: false });
  layer.add(group);
  // beyaz kasa (grup uzayında, her zaman .85h'de — flip'ten etkilenmez)
  group.add(new Konva.Rect({ x: 0, y: 60 * 0.85, width: 60, height: 60 * 0.15, fill: 'white', listening: false }));
  // kapı görseli (flip offset telafisi ile)
  group.add(new Konva.Image({
    image: img, width: 60, height: 60, draggable: false,
    scaleX: sx, scaleY: sy,
    offsetX: sx === -1 ? 60 : 0, offsetY: sy === -1 ? 60 : 0
  }));
  stage.draw();
  const cv = stage.toCanvas({ pixelRatio: 1 });
  stage.destroy();
  return cv;
}

// ---- PDF offscreen çizimi: uygulamanın ve() transformu + vs() kapı dalı ----
function drawPdf({ x, y, rot, sx, sy }, mode) {
  const oe = document.createElement('canvas');
  oe.width = W; oe.height = H;
  const tt = oe.getContext('2d');
  tt.fillStyle = '#ffffff';
  tt.fillRect(0, 0, W, H);
  const Ue = x, Qe = y, Dt = 60, Et = 60;
  const Tt = rot * Math.PI / 180;
  const St = sx === -1 ? Dt : 0, jt = sy === -1 ? Et : 0;
  if (Tt !== 0 || St !== 0 || jt !== 0) {
    if (mode === 'yeni') tt.translate(Ue, Qe);          // P8 yaması
    else tt.translate(Ue + St, Qe + jt);                 // eski (hatalı) davranış
    tt.rotate(Tt);
    tt.scale(sx, sy);
    tt.translate(-St, -jt);
  } else {
    tt.translate(Ue, Qe);
    tt.scale(sx, sy);
  }
  // vs() kapı dalı (P9 yaması: dikey flip'te kasa y=0)
  tt.fillStyle = '#ffffff';
  tt.fillRect(0, sy === -1 ? 0 : 60 * 0.85, 60, 60 * 0.15);
  tt.drawImage(img, 0, 0, 60, 60);
  return oe;
}

function diff(c1, c2) {
  // Konva toCanvas() bir sarmalayıcı döndürür — doğal canvas'ı aç
  const n1 = c1._canvas || c1, n2 = c2._canvas || c2;
  const a = n1.getContext('2d').getImageData(0, 0, W, H).data;
  const b = n2.getContext('2d').getImageData(0, 0, W, H).data;
  let bad = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) > 8 || Math.abs(a[i + 1] - b[i + 1]) > 8 || Math.abs(a[i + 2] - b[i + 2]) > 8) bad++;
  }
  return bad;
}

function bboxOf(cv) {
  const n = cv._canvas || cv;
  const d = n.getContext('2d').getImageData(0, 0, W, H).data;
  let minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (d[i + 3] > 10 && (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200)) {
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
  }
  return [minx, maxx, miny, maxy];
}

const CASES = [
  { name: 'rot0 duz',            x: 400, y: 300, rot: 0,   sx: 1,  sy: 1 },
  { name: 'rot90',               x: 400, y: 300, rot: 90,  sx: 1,  sy: 1 },
  { name: 'rot45',               x: 400, y: 300, rot: 45,  sx: 1,  sy: 1 },
  { name: 'yatay flip',          x: 400, y: 300, rot: 0,   sx: -1, sy: 1 },
  { name: 'dikey flip',          x: 400, y: 300, rot: 0,   sx: 1,  sy: -1 },
  { name: 'cift flip',           x: 400, y: 300, rot: 0,   sx: -1, sy: -1 },
  { name: 'rot90+yatay flip',    x: 400, y: 300, rot: 90,  sx: -1, sy: 1 },
  { name: 'rot90+dikey flip',    x: 400, y: 300, rot: 90,  sx: 1,  sy: -1 },
  { name: 'rot120+cift flip',    x: 400, y: 300, rot: 120, sx: -1, sy: -1 },
  { name: 'rot33+yatay flip',    x: 400, y: 300, rot: 33,  sx: -1, sy: 1 },
];

log('Kapı (60x60 @ 400,300) Konva vs PDF piksel farkları:');
const rows = [];
for (const c of CASES) {
  const k = drawKonva(c);
  const pN = drawPdf(c, 'yeni');
  const pO = drawPdf(c, 'eski');
  const dNew = diff(k, pN);
  const dOld = diff(k, pO);
  log(`${c.name}: konva=${JSON.stringify(bboxOf(k))} yeni=${JSON.stringify(bboxOf(pN))} eski=${JSON.stringify(bboxOf(pO))}`);
  const tot = W * H;
  const pcN = (dNew / tot * 100), pcO = (dOld / tot * 100);
  const okN = dNew === 0;
  rows.push({ c: c.name, pN: pcN.toFixed(4) + "%", okN, pO: pcO.toFixed(4) + "%", dN: dNew, dO: dOld });
  log(`${c.name.padEnd(18)}  yeni=${pcN.toFixed(4)}%  eski=${pcO.toFixed(4)}%  ${okN ? 'OK' : 'FARK VAR'}`);
}

// tabloyu doldur
const tb = document.createElement('tbody');
for (const r of rows) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${r.c}</td><td class="${r.okN ? 'ok' : 'bad'}">${r.dN} px</td><td>${r.dO} px</td>`;
  tb.appendChild(tr);
}
tbl.appendChild(tb);

const allOk = rows.every(r => r.dN === 0);
const anyOldDiff = rows.some(r => r.dO > 0 && (r.c.includes('flip') || r.c.includes('rot90')));
window.__PARITY_RESULT = { allOk, anyOldDiff, rows };
log('');
log(allOk ? 'PARITE SONUCU: TÜM VAKALAR BİREBİR EŞLEŞİYOR (yamalı PDF çizimi)' : 'PARITE SONUCU: FARK VAR — kontrol gerekli');
log('eski matematikte fark üreten vakalar: ' + rows.filter(r => r.dO > 1000).map(r => r.c).join(', '));
