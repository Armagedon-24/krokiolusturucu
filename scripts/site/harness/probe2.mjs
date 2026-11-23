// Diff fonksiyonu izolasyon testi: aynı kapıyı Konva + eski PDF + yeni PDF ile çiz, bbox + diff yaz
import { g as Konva } from '../assets/vendor-konva-Bl4nmkC5.js';

const DOOR_SVG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="0" y="85" width="100" height="15" fill="white" stroke="black" stroke-width="4"/><line x1="95" y1="85" x2="95" y2="10" stroke="black" stroke-width="6"/><path d="M 95 10 A 85 85 0 0 0 10 85" stroke="black" stroke-width="2" fill="none" stroke-dasharray="5"/></svg>';
const img = new Image();
img.src = DOOR_SVG;
await new Promise((r) => { img.onload = r; });

const W = 1000, H = 1400;

function bbox(cv) {
  const n = cv._canvas || cv;
  const d = n.getContext('2d').getImageData(0, 0, W, H).data;
  let minx = 1e9, maxx = -1, miny = 1e9, maxy = -1, cnt = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (d[i + 3] > 10 && (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200)) {
      cnt++; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
  }
  return { minx, maxx, miny, maxy, cnt };
}

function diff(c1, c2) {
  const a = (c1._canvas || c1).getContext('2d').getImageData(0, 0, W, H).data;
  const b = (c2._canvas || c2).getContext('2d').getImageData(0, 0, W, H).data;
  let bad = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) > 8 || Math.abs(a[i + 1] - b[i + 1]) > 8 || Math.abs(a[i + 2] - b[i + 2]) > 8) bad++;
  }
  return bad;
}

// Konva
const stage = new Konva.Stage({ container: document.createElement('div'), width: W, height: H });
const layer = new Konva.Layer();
stage.add(layer);
layer.add(new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: '#ffffff' }));
const grp = new Konva.Group({ x: 400, y: 300, rotation: 0 });
layer.add(grp);
grp.add(new Konva.Rect({ x: 0, y: 51, width: 60, height: 9, fill: 'white' }));
grp.add(new Konva.Image({ image: img, width: 60, height: 60, scaleX: -1, offsetX: 60 }));
stage.draw();
const konvaCv = stage.toCanvas({ pixelRatio: 1 });

// Eski PDF
function pdf(oldMode) {
  const oe = document.createElement('canvas');
  oe.width = W; oe.height = H;
  const tt = oe.getContext('2d');
  tt.fillStyle = '#fff'; tt.fillRect(0, 0, W, H);
  if (oldMode) tt.translate(400 + 60, 300 + 0); else tt.translate(400, 300);
  tt.scale(-1, 1);
  tt.translate(-60, 0);
  tt.fillStyle = '#fff'; tt.fillRect(0, 60 * 0.85, 60, 60 * 0.15);
  tt.drawImage(img, 0, 0, 60, 60);
  return oe;
}

const eski = pdf(true), yeni = pdf(false);
const res = {
  konvaBBox: bbox(konvaCv),
  eskiBBox: bbox(eski),
  yeniBBox: bbox(yeni),
  diffKonvaEski: diff(konvaCv, eski),
  diffKonvaYeni: diff(konvaCv, yeni),
  diffEskiYeni: diff(eski, yeni),
};
window.__PROBE2 = res;
document.getElementById('out').textContent = JSON.stringify(res, null, 1);
