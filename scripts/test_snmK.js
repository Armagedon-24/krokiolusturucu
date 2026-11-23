// snmK mıknatıs matematiği birim testi — gerçek yamalı koddan çıkarılır
const fs = require('fs');
const data = fs.readFileSync('/home/z/my-project/scripts/site/assets/index-BzregFHY.js', 'utf8');

// gerçek snmK + ws/ba tanımlarını dosyadan çek
const wsM = data.match(/ws=(\["[^\]]+\"])/); const baM = data.match(/ba=(\["[^\]]+\"])/);
const snmStart = data.indexOf(',snmK=(sym,xp,yp');
const snmEnd = data.indexOf('},fr=', snmStart);
if (snmStart < 0 || snmEnd < 0 || !wsM) { console.error('kaynak bulunamadi'); process.exit(1); }
const snmSrc0 = data.slice(snmStart + 1, snmEnd + 1); // snmK=(...)=>{...}
const snmSrc = snmSrc0.replace(/^snmK=/, '');
const ws = JSON.parse(wsM[1]);
const ba = JSON.parse(baM[1]);
const snmK = eval('(' + snmSrc + ')');

let pass = 0, fail = 0;
function T(name, got, exp, tol) {
  tol = tol === undefined ? 1e-6 : tol;
  let ok;
  if (exp === null) ok = got === null;
  else if (typeof exp === 'object') {
    ok = Math.abs(got.rotation - exp.rotation) <= tol &&
         Math.abs(got.x - exp.x) <= tol &&
         Math.abs(got.y - exp.y) <= tol;
  } else ok = Math.abs(got - exp) <= tol;
  if (ok) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name, 'got=', JSON.stringify(got), 'exp=', JSON.stringify(exp)); }
}

// ---- T1: yatay duvar (250x10 @ 100,200), kapı 60x60, kasa hattı merkezi duvar çizgisine 3 px ----
// duvar çizgisi y=205, x∈[100..350]
const walls = [{ id: 'w1', symbolId: 'arch-w1i', x: 100, y: 200, width: 250, height: 10, rotation: 0 }];
// kapı kasa merkezi (frame anchor) = (250, 208) — duvar çizgisinden 3px aşağıda
let r = snmK('arch-d1r', 250, 208, 60, 60, 0, walls, 'x', 1);
// beklenen: rotasyon 0, kasa merkezi (250,205) -> x = 250-30 = 220, y = 205-55.5 = 149.5
T('T1 yatay duvara yapışma', r, { rotation: 0, x: 220, y: 149.5 });

// ---- T2: dikey duvar (10x250 @ 400,100), çizgi x=405, y∈[100..350] ----
const walls2 = [{ id: 'w2', symbolId: 'arch-w1vi', x: 400, y: 100, width: 10, height: 250, rotation: 0 }];
r = snmK('arch-d1l', 410, 200, 60, 60, 0, walls2, 'x', 1);
// phi = 0 + 90 = 90° ; nokta (410,200) -> t=0, p=+5 -> yakınlık 5 < 30
// projeksyon (405,200); nd=90 (0'a daha yakın taraf seçilir: 90 vs 270 -> 90)
// kapı pos: pX-(30*cos90-55.5*sin90)=405-(-55.5)=460.5 ; y=200-(30*sin90+55.5*cos90)=200-30=170
T('T2 dikey duvara yapışma', r, { rotation: 90, x: 460.5, y: 170 });

// ---- T3: pencere merkez hattı (anchor .5) ----
r = snmK('arch-win', 250, 208, 50, 10, 0, walls, 'x', 1);
// pencere yükseklik 10 -> anchor (25,5) verildi zaten merkez; projeksyon (250,205) rot 0
T('T3 pencere merkez yapışma', r, { rotation: 0, x: 225, y: 200 });

// ---- T4: uzak nesne -> snap yok ----
r = snmK('arch-d1r', 250, 400, 60, 60, 0, walls, 'x', 1);
T('T4 uzakta snap yok', r, null);

// ---- T5: 45° döndürülmüş duvara yapışma ----
// duvar 250x10, rotation 45, merkezi (500,500); çizgi yönü 45°
const walls3 = [{ id: 'w3', symbolId: 'arch-w1i', x: 500 - (250 / 2 * Math.cos(Math.PI / 4) - 10 / 2 * Math.sin(Math.PI / 4)),
  y: 500 - (250 / 2 * Math.sin(Math.PI / 4) + 10 / 2 * Math.cos(Math.PI / 4)), width: 250, height: 10, rotation: 45 }];
// (x,y) öyle ki duvar merkezi (500,500) olsun
// duvar çizgisi: C=(500,500), u=(cos45,sin45)
// kapı kasa merkezi duvar merkezinden u boyunca 20px ileride ve n yönünde 4px kaymış olsun:
const ux = Math.cos(Math.PI / 4), uy = Math.sin(Math.PI / 4), nx = -uy, ny = ux;
const px = 500 + ux * 20 + nx * 4, py = 500 + uy * 20 + ny * 4;
r = snmK('arch-d1r', px, py, 60, 60, 0, walls3, 'x', 1);
// beklenen: rotasyon 45 (0'a en yakın taraf: |45-0|=45 vs |225-0|=225 -> 45)
// pos = P - R45*(30,55.5)
const nd = 45, nr = nd * Math.PI / 180;
const expX = (500 + ux * 20) - (30 * Math.cos(nr) - 55.5 * Math.sin(nr));
const expY = (500 + uy * 20) - (30 * Math.sin(nr) + 55.5 * Math.cos(nr));
T('T5 eğik duvara yapışma', r, { rotation: 45, x: expX, y: expY }, 1e-4);

// ---- T6: duvar üzerinde konum korunur (t < len/2) ----
r = snmK('arch-d1r', 340, 208, 60, 60, 0, walls, 'x', 1); // C=(225,205) -> t=115 < 125
T('T6 duvar üzerinde konum korunur', r, { rotation: 0, x: 310, y: 149.5 });

// ---- T7: çift kapı da 60x60 mıknatıslaşır ----
r = snmK('arch-d2', 250, 208, 60, 60, 0, walls, 'x', 1);
T('T7 çift kapı yatay duvar', r, { rotation: 0, x: 220, y: 149.5 });

// ---- T8: ters taraf seçimi: kapı 175° dururken dikey duvara snap -> 90 yerine 270 ----
r = snmK('arch-d1r', 410, 200, 60, 60, 175, walls2, 'x', 1);
// 90 vs 270: |90-175|=85, |270-175|=95 -> 90 seçilir. 185'de denersek:
T('T8 taraf seçimi 175', r, { rotation: 90, x: 460.5, y: 170 });
r = snmK('arch-d1r', 410, 200, 60, 60, 185, walls2, 'x', 1);
// |90-185|=95 vs |270-185|=85 -> 270
// pos: pX-(30cos270-55.5sin270)=405-(0+55.5)=349.5 ; y=200-(30sin270+55.5cos270)=200-(-30)=230
T('T9 taraf seçimi 185', r, { rotation: 270, x: 349.5, y: 230 });

// ---- T10: bahçe kapısı (garden-gate) 0.925 anchor ----
r = snmK('arch-garden-gate', 250, 208, 60, 60, 0, walls, 'x', 1);
T('T10 bahçe kapısı', r, { rotation: 0, x: 220, y: 149.5 });

// ---- T11: kepenk (anchor .5, 120x12) ----
r = snmK('arch-kepenk', 250, 203, 120, 12, 0, walls, 'x', 1);
// anchor zaten merkez: (250,203) -> duvar çizgisi 205, p=2 -> projeksyon (250,205)
T('T11 kepenk merkez', r, { rotation: 0, x: 190, y: 199 });

// ---- T12: ws dışı sembol snap edilmez ----
r = snmK('v-sedan', 250, 205, 60, 60, 0, walls, 'x', 1);
T('T12 ws dışı snap yok', r, null);

// ---- T13: kapı boyutu değişmişse (kullanıcı ayarı) yine 0.925 kullanılır ----
r = snmK('arch-d1r', 250, 208, 80, 80, 0, walls, 'x', 1);
// anchor 0.925*80=74 ; pos = 250-40=210 ; y=205-74=131
T('T13 özel boyut', r, { rotation: 0, x: 210, y: 131 });

console.log('\nSONUC: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
