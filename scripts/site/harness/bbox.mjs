// Eski vs yeni PDF matematiği — kapı bbox ölçümü (aynalı, döndürüsüz durum)
const DOOR_SVG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="0" y="85" width="100" height="15" fill="white" stroke="black" stroke-width="4"/><line x1="95" y1="85" x2="95" y2="10" stroke="black" stroke-width="6"/><path d="M 95 10 A 85 85 0 0 0 10 85" stroke="black" stroke-width="2" fill="none" stroke-dasharray="5"/></svg>';
const img = new Image();
img.src = DOOR_SVG;
await new Promise((r) => { img.onload = r; });

function bbox(cv) {
  const d = cv.getContext('2d').getImageData(0, 0, 1000, 1400).data;
  let minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
  for (let y = 0; y < 1400; y++) for (let x = 0; x < 1000; x++) {
    const i = (y * 1000 + x) * 4;
    if (d[i + 3] > 10 && (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200)) {
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
  }
  return [minx, maxx, miny, maxy];
}

function make(mode, rotDeg) {
  const oe = document.createElement('canvas');
  oe.width = 1000; oe.height = 1400;
  const tt = oe.getContext('2d');
  tt.fillStyle = '#fff'; tt.fillRect(0, 0, 1000, 1400);
  const Ue = 400, Qe = 300, Dt = 60, Et = 60;
  const Tt = rotDeg * Math.PI / 180;
  const St = -1 === -1 ? Dt : 0, jt = 0; // scaleX=-1 sabit
  if (Tt !== 0 || St !== 0 || jt !== 0) {
    if (mode === 'yeni') tt.translate(Ue, Qe); else tt.translate(Ue + St, Qe + jt);
    tt.rotate(Tt); tt.scale(-1, 1); tt.translate(-St, -jt);
  }
  tt.fillStyle = '#fff'; tt.fillRect(0, 60 * 0.85, 60, 60 * 0.15);
  tt.drawImage(img, 0, 0, 60, 60);
  return oe;
}

// Konva referansı
const { g: Konva } = await import('../assets/vendor-konva-Bl4nmkC5.js');
const stage = new Konva.Stage({ container: document.createElement('div'), width: 1000, height: 1400 });
const layer = new Konva.Layer();
stage.add(layer);
layer.add(new Konva.Rect({ x: 0, y: 0, width: 1000, height: 1400, fill: '#fff' }));
const grp = new Konva.Group({ x: 400, y: 300, rotation: 0 });
layer.add(grp);
grp.add(new Konva.Rect({ x: 0, y: 51, width: 60, height: 9, fill: 'white' }));
grp.add(new Konva.Image({ image: img, width: 60, height: 60, scaleX: -1, offsetX: 60 }));
stage.draw();
const kb = bbox(stage.toCanvas({ pixelRatio: 1 }));

const res = {
  konva: kb,
  eski: bbox(make('eski', 0)),
  yeni: bbox(make('yeni', 0)),
  eskiRot90: bbox(make('eski', 90)),
  yeniRot90: bbox(make('yeni', 90)),
};
window.__BBOX = res;
document.getElementById('out').textContent = JSON.stringify(res, null, 1);
