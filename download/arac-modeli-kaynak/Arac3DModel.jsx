/**
 * Arac3DModel.jsx — Yeniden tasarlanmış 3D araç modeli
 * Kroki Oluşturucu — "3D Olay Yeri Modeli" aracı bileşeni
 *
 * ESKİ MODELİN SORUNLARI (düzeltildi):
 *  - Kabin, eğik kutulardan oluşturuluyordu (ön cam "rampa" gibi dışarı taşıyordu)
 *  - Gövde metalness 0.6 idi; sahnede ortam haritası (environment map) olmadığı için
 *    araç düz siyah bir leke gibi görünüyordu
 *  - Tekerlekler çok küçüktü ve gövdenin içine gömük duruyordu
 *  - Kapı panelleri/parçalar gövdeden dışarı taşan ince plakalar gibi duruyordu
 *
 * YENİ YAKLAŞIM:
 *  - Gövde, kaput/bagaj/bel hattı dahil TEK parça ExtrudeGeometry (yumuşak silüet)
 *  - Kabin; cam malzemeli tek extrude + üzerine gövde renginde tavan plakası
 *  - Gerçek otomobil oranları: yüksek bel hattı, kısa ön/arka cam eğimleri
 *  - Daha büyük tekerlekler (sedan 28 cm yarıçap), jant + jant kolları
 *  - Farlar (hafif emissive), stoplar, ızgara, tamponlar, aynalar, plaka, kapı çizgileri
 *  - metalness 0.15 + clearcoat 0.65: ortam haritası olmadan da parlak boya görünümü
 *
 * ÖZELLİKLER (korundu):
 *  - 2D çizimden gelen width/height (ayak izi) ve rotation (rad) ile konumlanma
 *  - zHeight prop'u ile yükseklik ölçekleme (H = zHeight/varsayılan)
 *  - Araç sınıfına göre otomatik biçim: sedan / SUV(jeep,polis,ambulans) /
 *    otobüs(minibüs) / kamyon(kamyon, itfaiye, kepçe, çekici, traktör) / motosiklet
 *  - Renk: fill prop → yoksa sembol resminden çıkarılan renk (dolgu rengi
 *    çıkaran sarmalayıcı bileşen halleder; yayındaki sürümde adı `ur`)
 *  - Polis/ambulans/itfaiye için tepe lambası (lightbar), taksi/itfaiye/polis renk kuralları
 *  - Devrilme (rollOver) durumu: araç ters çevrilerek çizilir
 *  - Çok küçük çizilmiş araçları otomatik büyütme (min. ~100 cm görünürlük)
 *
 * KALDIRILDI: Tıklayınca açılan kapı etkileşimi (kayıt altına alınmayan yerel
 * durumdu; görsel karmaşanın ana kaynağıydı). İstenirse ayrıca eklenebilir.
 *
 * BAĞLAMA (kaynak projede):
 *  - Bu bileşeni ThreeDPreview kaynak dosyanıza ekleyin ve araç dağıtıcısındaki
 *    araç dalını bunu kullanacak şekilde değiştirin:
 *      if (v) return <AracSarmalayici {...obj} ... />  // mevcut sarmalayıcı
 *    (Sarmalayıcı: textureSrc'ten renk çıkarır + "devrilmiş" tipini algılar.)
 *  - Bağımlılıklar: react-three-fiber JSX öğeleri + THREE.Shape
 */
import React from 'react';
import * as THREE from 'three';

const SCALE = 0.55; // 1 cm = 0.55 sahne birimi (uygulamanızdaki e değeriyle aynısını kullanın)

// Basit renk koyulaştırıcı (tamponlar için gövde renginin %80'i)
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/* ---------- profil yardımcıları ---------- */

// Adım listesinden THREE.Shape üretir: ['m',x,y] | ['l',x,y] | ['q',cx,cy,x,y]
function shapeFrom(steps) {
  const s = new THREE.Shape();
  for (const st of steps) {
    if (st[0] === 'm') s.moveTo(st[1], st[2]);
    else if (st[0] === 'l') s.lineTo(st[1], st[2]);
    else s.quadraticCurveTo(st[1], st[2], st[3], st[4]);
  }
  s.closePath();
  return s;
}

// Yan profil: X fraksiyonları araç boyu (t) ile, Y değerleri cm*unit ile çarpılır
function profile(steps, t, unit) {
  return steps.map(s =>
    s[0] === 'q'
      ? ['q', s[1] * t, s[2] * unit, s[3] * t, s[4] * unit]
      : [s[0], s[1] * t, s[2] * unit],
  );
}

/* ---------- ana bileşen ---------- */

export function Arac3D({
  x, y, width, height, rad = 0, type = '', fill,
  zOffset = 0, zHeight, rollOver = false,
}) {
  const length = height > width ? height : width; // araç boyu (sahne birimi)
  const w = height > width ? width : height;      // araç genişliği
  const rotation = height > width ? rad - Math.PI / 2 : rad;
  const t = String(type).toLowerCase();

  // Sınıf tespiti (eski bileşenle aynı kurallar)
  const isMoto = t.includes('motor') || t.includes('moto') || t.includes('bisiklet');
  const isTruck = t.includes('truck') || t.includes('kamyon') || t.includes('v-truck') ||
    t.includes('itfaiye') || t.includes('kepçe') || t.includes('çekici') || t.includes('traktör');
  const isBus = t.includes('bus') || t.includes('otobüs') || t.includes('v-bus') || t.includes('minibüs');
  const isSuv = t.includes('suv') || t.includes('jeep') || t.includes('ambulance') ||
    t.includes('ambulans') || t.includes('police') || t.includes('polis');
  const isEmergency = t.includes('police') || t.includes('ambulance') || t.includes('v-police') ||
    t.includes('v-ambulance') || t.includes('ambulans') || t.includes('polis') || t.includes('itfaiye');

  // Renk: fill → tip bazlı kurallar → varsayılan
  let bodyColor = fill || '#3a4046';
  if (t.includes('itfaiye') || t.includes('fire')) bodyColor = '#cc0000';
  else if (t.includes('taksi') || t.includes('taxi')) bodyColor = '#f5c518';
  else if (t.includes('polis') || t.includes('police')) bodyColor = '#0033aa';

  // Yükseklik ölçeği: sınıf başına varsayılan toplam yükseklik (cm)
  const defaultHeightCm = isTruck ? 300 : isBus ? 320 : isMoto ? 100 : isSuv ? 165 : 150;
  const heightCm = zHeight || defaultHeightCm;
  const H = heightCm / defaultHeightCm;
  const unit = SCALE * H; // cm -> sahne birimi

  /* ---- malzemeler (R3F bunları her mount'ta instance yapar) ---- */
  const matBody = <meshPhysicalMaterial color={bodyColor} metalness={0.15} roughness={0.32} clearcoat={0.65} clearcoatRoughness={0.18} />;
  const matBumper = <meshPhysicalMaterial color={shade(bodyColor, 0.8)} metalness={0.15} roughness={0.4} clearcoat={0.4} clearcoatRoughness={0.2} />;
  const matGlass = <meshPhysicalMaterial color="#0e151d" metalness={0.05} roughness={0.06} clearcoat={1} clearcoatRoughness={0.08} />;
  const matTrim = <meshStandardMaterial color="#191c20" roughness={0.55} metalness={0.25} />;
  const matTire = <meshStandardMaterial color="#151517" roughness={0.95} />;
  const matRim = <meshStandardMaterial color="#c9cdd3" metalness={0.85} roughness={0.28} />;
  const matChrome = <meshStandardMaterial color="#d6dade" metalness={0.9} roughness={0.18} />;
  const matHeadlight = <meshPhysicalMaterial color="#f3efdc" emissive="#fff2ac" emissiveIntensity={0.75} roughness={0.15} />;
  const matTail = <meshPhysicalMaterial color="#a11418" emissive="#ff2020" emissiveIntensity={0.35} />;
  const matPlate = <meshStandardMaterial color="#e8eaee" roughness={0.5} />;

  /* ---- tekerlek ---- */
  function Wheel({ R, W, px, pz }) {
    const spokes = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      spokes.push(
        <mesh key={i} position={[Math.cos(a) * R * unit * 0.3, Math.sin(a) * R * unit * 0.3, 0]} rotation={[0, 0, a]}>
          <boxGeometry args={[R * unit * 0.48, R * unit * 0.085, W * unit * 0.34]} />
          {matRim}
        </mesh>,
      );
    }
    return (
      <group position={[px, R * unit, pz]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh castShadow><cylinderGeometry args={[R * unit, R * unit, W * unit, 28]} />{matTire}</mesh>
        <mesh><cylinderGeometry args={[R * unit * 0.58, R * unit * 0.58, W * unit * 1.04, 24]} />{matRim}</mesh>
        <mesh><cylinderGeometry args={[R * unit * 0.13, R * unit * 0.13, W * unit * 1.12, 12]} />{matTrim}</mesh>
        {spokes}
      </group>
    );
  }

  // Motosiklet: eski tasarım korundu (basit silüet)
  if (isMoto) {
    const M = 20 * unit, R = 20 * unit, W = 8 * unit;
    const flipY = M + 45 * unit + R;
    return (
      <group position={[x, zOffset, y]} rotation={[0, rotation, 0]}>
        <group position={[0, rollOver ? flipY : 0, 0]} rotation={[rollOver ? Math.PI : 0, 0, 0]}>
          <mesh position={[-length / 3, R, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[R, R, W, 16]} />
            <meshStandardMaterial color="#111111" roughness={0.9} />
          </mesh>
          <mesh position={[length / 3, R, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[R, R, W, 16]} />
            <meshStandardMaterial color="#111111" roughness={0.9} />
          </mesh>
          <mesh position={[0, M + 10 * unit, 0]} castShadow>
            <boxGeometry args={[length * 0.7, 15 * unit, 12 * SCALE]} />
            <meshStandardMaterial color={bodyColor} metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[-length / 10, M + 18 * unit, 0]} castShadow>
            <boxGeometry args={[length * 0.4, 4 * unit, 10 * SCALE]} />
            <meshStandardMaterial color="#222222" />
          </mesh>
          <mesh position={[length / 4, M + 25 * unit, 0]} rotation={[0, 0, -Math.PI / 6]} castShadow>
            <cylinderGeometry args={[1.5 * SCALE, 1.5 * SCALE, 20 * unit, 16]} />
            <meshStandardMaterial color="#7f8c8d" metalness={0.9} />
          </mesh>
          <mesh position={[length / 4, M + 35 * unit, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1 * SCALE, 1 * SCALE, 30 * SCALE]} />
            <meshStandardMaterial color="#222222" />
          </mesh>
        </group>
      </group>
    );
  }

  /* ---- sınıf parametreleri ---- */
  const P = isTruck ? { M: 30, R: 36, W: 22, TH: 255 }
    : isBus ? { M: 25, R: 42, W: 22, TH: 302 }
    : isSuv ? { M: 19, R: 30, W: 17.5, TH: 170 }
    : { M: 15, R: 28, W: 17, TH: 151 };

  // Çok küçük çizilmiş araçları büyüt (eski davranış)
  const minLen = Math.max(100, heightCm * 0.7 * SCALE);
  const grow = length < minLen ? minLen / length : 1;
  const flipY = P.TH * unit * grow;

  const halfBody = (w - 2) / 2; // gövde yan yüzü
  const wheelZ = w / 2 - P.W * unit * 0.3;

  /* ---- gövde profilleri (yan görünüm; X fraksiyon × boy, Y cm) ---- */

  // SEDAN
  const sedanBody = [
    ['m', -0.500, 16], ['l', -0.500, 42],
    ['q', -0.500, 58, -0.472, 66],
    ['q', -0.430, 82, -0.360, 95],
    ['q', -0.330, 100.5, -0.280, 101.5],
    ['l', 0.160, 101],
    ['q', 0.225, 100, 0.270, 97],
    ['l', 0.445, 93],
    ['q', 0.490, 91.5, 0.500, 82],
    ['l', 0.500, 42], ['l', 0.490, 16],
  ];
  const sedanCabin = [
    ['m', -0.265, 99], ['l', -0.255, 103],
    ['l', -0.185, 141],
    ['q', -0.170, 144.8, -0.140, 145],
    ['l', 0.105, 145],
    ['q', 0.128, 144.6, 0.138, 140.5],
    ['l', 0.195, 98],
    ['l', 0.185, 98],
  ];
  const sedanRoof = [['m', -0.175, 143.5], ['l', -0.158, 148.8], ['l', 0.118, 148.8], ['l', 0.132, 143.5]];

  // SUV (station-wagon arka hat)
  const suvBody = [
    ['m', -0.500, 19], ['l', -0.500, 42],
    ['q', -0.500, 66, -0.470, 78],
    ['l', -0.410, 92],
    ['q', -0.380, 100, -0.330, 103],
    ['l', 0.150, 103.5],
    ['q', 0.210, 103, 0.260, 100.5],
    ['l', 0.450, 97],
    ['q', 0.492, 95.5, 0.500, 88],
    ['l', 0.500, 42], ['l', 0.490, 19],
  ];
  const suvCabin = [
    ['m', -0.335, 101], ['l', -0.325, 105],
    ['l', -0.310, 160],
    ['q', -0.305, 165.5, -0.275, 166],
    ['l', 0.010, 166],
    ['q', 0.045, 165.5, 0.060, 160],
    ['l', 0.155, 100.5], ['l', 0.145, 101],
  ];
  const suvRoof = [['m', -0.310, 163.5], ['l', -0.298, 169], ['l', 0.022, 169], ['l', 0.045, 163.5]];

  // OTOBÜS
  const busBody = [
    ['m', -0.500, 25], ['l', -0.500, 272],
    ['q', -0.495, 286, -0.470, 292],
    ['l', -0.420, 300],
    ['l', 0.300, 300],
    ['q', 0.390, 299, 0.430, 288],
    ['q', 0.470, 262, 0.478, 230],
    ['q', 0.490, 205, 0.495, 180],
    ['l', 0.500, 25],
  ];
  const busGlassBand = [
    ['m', -0.430, 138], ['l', -0.415, 232],
    ['l', 0.310, 232],
    ['q', 0.355, 230, 0.375, 205],
    ['l', 0.385, 140],
  ];

  const bodyDepth = w - 2;
  const cabinDepth = w - 16 * unit;
  const roofDepth = w - 8 * unit;

  /* ---- sınıfa göre içerik ---- */

  let content;
  if (isTruck) {
    content = (
      <group>
        {/* kasa */}
        <mesh position={[0, 0, -(w - 8 * unit) / 2]} castShadow receiveShadow>
          <extrudeGeometry args={[shapeFrom([['m', -0.5 * length, 55 * unit], ['l', 0.26 * length, 55 * unit], ['l', 0.26 * length, 252 * unit], ['l', -0.5 * length, 252 * unit]]), { depth: w - 8 * unit, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 1.5 * unit, bevelThickness: 1.5 * unit }]} />
          {matBody}
        </mesh>
        {/* şasi */}
        <mesh position={[0, 44 * unit, 0]} castShadow receiveShadow><boxGeometry args={[length * 0.92, 12 * unit, w * 0.42]} />{matTrim}</mesh>
        {/* kabin */}
        <mesh position={[0, 0, -(w - 4 * unit) / 2]} castShadow receiveShadow>
          <extrudeGeometry args={[shapeFrom([['m', 0.27 * length, 46 * unit], ['l', 0.27 * length, 148 * unit], ['l', 0.30 * length, 152 * unit], ['l', 0.33 * length, 206 * unit], ['q', 0.345 * length, 211 * unit, 0.38 * length, 211.5 * unit], ['l', 0.43 * length, 211 * unit], ['q', 0.47 * length, 208 * unit, 0.483 * length, 192 * unit], ['l', 0.495 * length, 150 * unit], ['l', 0.5 * length, 146 * unit], ['l', 0.5 * length, 46 * unit]]), { depth: w - 4 * unit, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 1.2 * unit, bevelThickness: 1.2 * unit }]} />
          {matBody}
        </mesh>
        {/* kabin camı */}
        <mesh position={[0, 0, -(w - 12 * unit) / 2]}>
          <extrudeGeometry args={[shapeFrom([['m', 0.315 * length, 150 * unit], ['l', 0.335 * length, 204 * unit], ['q', 0.35 * length, 208 * unit, 0.375 * length, 208.5 * unit], ['l', 0.42 * length, 208 * unit], ['q', 0.452 * length, 205.5 * unit, 0.462 * length, 192 * unit], ['l', 0.472 * length, 150 * unit]]), { depth: w - 12 * unit, bevelEnabled: false }]} />
          {matGlass}
        </mesh>
        {/* kabin tavanı */}
        <mesh position={[0, 0, -(w - 6 * unit) / 2]} castShadow receiveShadow>
          <extrudeGeometry args={[shapeFrom([['m', 0.335 * length, 206 * unit], ['l', 0.35 * length, 210.5 * unit], ['l', 0.425 * length, 210.5 * unit], ['l', 0.44 * length, 206 * unit]]), { depth: w - 6 * unit, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 1 * unit, bevelThickness: 1 * unit }]} />
          {matBody}
        </mesh>
        {/* tamponlar */}
        <mesh position={[length * 0.4965, 34 * unit, 0]} castShadow receiveShadow><boxGeometry args={[length * 0.03, 16 * unit, w - 6 * unit]} />{matTrim}</mesh>
        <mesh position={[-length * 0.4965, 40 * unit, 0]} castShadow receiveShadow><boxGeometry args={[length * 0.03, 16 * unit, w - 6 * unit]} />{matTrim}</mesh>
        {/* farlar / stoplar / plaka */}
        <mesh position={[length * 0.5 + 0.3 * unit, 100 * unit, w * 0.3]}><boxGeometry args={[2 * unit, 10 * unit, w * 0.16]} />{matHeadlight}</mesh>
        <mesh position={[length * 0.5 + 0.3 * unit, 100 * unit, -w * 0.3]}><boxGeometry args={[2 * unit, 10 * unit, w * 0.16]} />{matHeadlight}</mesh>
        <mesh position={[-length * 0.5 - 0.3 * unit, 120 * unit, w * 0.3]}><boxGeometry args={[2.2 * unit, 12 * unit, w * 0.16]} />{matTail}</mesh>
        <mesh position={[-length * 0.5 - 0.3 * unit, 120 * unit, -w * 0.3]}><boxGeometry args={[2.2 * unit, 12 * unit, w * 0.16]} />{matTail}</mesh>
        <mesh position={[-length * 0.5 - 0.9 * unit, 95 * unit, 0]}><boxGeometry args={[1.2 * unit, 11 * unit, w * 0.24]} />{matPlate}</mesh>
        {/* aynalar */}
        {[1, -1].map(s => (
          <group key={s} position={[length * 0.44, 178 * unit, s * (w / 2 + 4 * unit)]}>
            <mesh castShadow receiveShadow><boxGeometry args={[4 * unit, 3 * unit, 6 * unit]} />{matTrim}</mesh>
            <mesh position={[0, 11 * unit, s * 8 * unit]} castShadow receiveShadow><boxGeometry args={[4.5 * unit, 22 * unit, 12 * unit]} />{matBody}</mesh>
          </group>
        ))}
        {/* 6 teker */}
        <Wheel R={36} W={22} px={length * 0.34} pz={wheelZ} />
        <Wheel R={36} W={22} px={length * 0.34} pz={-wheelZ} />
        <Wheel R={36} W={22} px={-length * 0.26} pz={wheelZ} />
        <Wheel R={36} W={22} px={-length * 0.26} pz={-wheelZ} />
        <Wheel R={36} W={22} px={-length * 0.44} pz={wheelZ} />
        <Wheel R={36} W={22} px={-length * 0.44} pz={-wheelZ} />
        {isEmergency && <Lightbar lx={length * 0.36} ly={216} />}
      </group>
    );
  } else if (isBus) {
    content = (
      <group>
        <mesh position={[0, 0, -bodyDepth / 2]} castShadow receiveShadow>
          <extrudeGeometry args={[shapeFrom(profile(busBody, length, unit)), { depth: bodyDepth, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 1.4 * unit, bevelThickness: 1.4 * unit }]} />
          {matBody}
        </mesh>
        {/* yan cam bandı (gövdeden 1.4 birim taşar) */}
        <mesh position={[0, 0, -(w + 1.4 * unit) / 2]}>
          <extrudeGeometry args={[shapeFrom(profile(busGlassBand, length, unit)), { depth: w + 1.4 * unit, bevelEnabled: false }]} />
          {matGlass}
        </mesh>
        {/* ön cam */}
        <mesh position={[length * 0.474 + 0.6 * unit, 202 * unit, 0]} rotation={[0, 0, -0.08]} castShadow>
          <boxGeometry args={[3 * unit, 62 * unit, w - 10 * unit]} />
          {matGlass}
        </mesh>
        <mesh position={[length * 0.5 + 0.3 * unit, 96 * unit, w * 0.3]}><boxGeometry args={[2.2 * unit, 9 * unit, w * 0.18]} />{matHeadlight}</mesh>
        <mesh position={[length * 0.5 + 0.3 * unit, 96 * unit, -w * 0.3]}><boxGeometry args={[2.2 * unit, 9 * unit, w * 0.18]} />{matHeadlight}</mesh>
        <mesh position={[-length * 0.5 - 0.3 * unit, 92 * unit, w * 0.3]}><boxGeometry args={[2.2 * unit, 12 * unit, w * 0.16]} />{matTail}</mesh>
        <mesh position={[-length * 0.5 - 0.3 * unit, 92 * unit, -w * 0.3]}><boxGeometry args={[2.2 * unit, 12 * unit, w * 0.16]} />{matTail}</mesh>
        <mesh position={[-length * 0.5 - 0.9 * unit, 70 * unit, 0]}><boxGeometry args={[1.2 * unit, 11 * unit, w * 0.24]} />{matPlate}</mesh>
        <Wheel R={42} W={22} px={length * 0.31} pz={wheelZ} />
        <Wheel R={42} W={22} px={length * 0.31} pz={-wheelZ} />
        <Wheel R={42} W={22} px={-length * 0.31} pz={wheelZ} />
        <Wheel R={42} W={22} px={-length * 0.31} pz={-wheelZ} />
      </group>
    );
  } else {
    // SEDAN ve SUV ortak yapı: gövde + cam kabin + tavan plakası
    const bodySteps = isSuv ? suvBody : sedanBody;
    const cabinSteps = isSuv ? suvCabin : sedanCabin;
    const roofSteps = isSuv ? suvRoof : sedanRoof;
    const yMirror = isSuv ? { head: 72, tail: 62, grille: 58, plate: 42, mirror: 106, handle: 95, seam: 78, rocker: 21.5 }
      : { head: 66, tail: 50, grille: 52, plate: 38, mirror: 103, handle: 88, seam: 74, rocker: 18.5 };

    content = (
      <group>
        <mesh position={[0, 0, -bodyDepth / 2]} castShadow receiveShadow>
          <extrudeGeometry args={[shapeFrom(profile(bodySteps, length, unit)), { depth: bodyDepth, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 1.2 * unit, bevelThickness: 1.2 * unit }]} />
          {matBody}
        </mesh>
        <mesh position={[0, 0, -cabinDepth / 2]} castShadow receiveShadow>
          <extrudeGeometry args={[shapeFrom(profile(cabinSteps, length, unit)), { depth: cabinDepth, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.8 * unit, bevelThickness: 0.8 * unit }]} />
          {matGlass}
        </mesh>
        <mesh position={[0, 0, -roofDepth / 2]} castShadow receiveShadow>
          <extrudeGeometry args={[shapeFrom(profile(roofSteps, length, unit)), { depth: roofDepth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 1.1 * unit, bevelThickness: 1.1 * unit }]} />
          {matBody}
        </mesh>
        {/* tamponlar */}
        <mesh position={[length * 0.4935, (isSuv ? 27 : 24) * unit, 0]} castShadow receiveShadow><boxGeometry args={[length * 0.045, 13 * unit, w - 9 * unit]} />{matBumper}</mesh>
        <mesh position={[-length * 0.4905, (isSuv ? 27 : 24) * unit, 0]} castShadow receiveShadow><boxGeometry args={[length * 0.04, 13 * unit, w - 9 * unit]} />{matBumper}</mesh>
        {/* rok paneli */}
        <mesh position={[0, yMirror.rocker * unit, 0]} castShadow receiveShadow><boxGeometry args={[length * 0.62, 5 * unit, bodyDepth + 1.2 * unit]} />{matTrim}</mesh>
        {/* ızgara + farlar + stoplar + plaka */}
        <mesh position={[length * 0.5 + 0.4 * unit, yMirror.grille * unit, 0]}><boxGeometry args={[2 * unit, 11 * unit, w * 0.42]} />{matTrim}</mesh>
        <mesh position={[length * 0.5 + 0.3 * unit, yMirror.head * unit, w * 0.3]}><boxGeometry args={[2.2 * unit, 8.5 * unit, w * 0.19]} />{matHeadlight}</mesh>
        <mesh position={[length * 0.5 + 0.3 * unit, yMirror.head * unit, -w * 0.3]}><boxGeometry args={[2.2 * unit, 8.5 * unit, w * 0.19]} />{matHeadlight}</mesh>
        <mesh position={[-length * 0.487 - 0.3 * unit, yMirror.tail * unit, w * 0.3]}><boxGeometry args={[2.2 * unit, 9 * unit, w * 0.2]} />{matTail}</mesh>
        <mesh position={[-length * 0.487 - 0.3 * unit, yMirror.tail * unit, -w * 0.3]}><boxGeometry args={[2.2 * unit, 9 * unit, w * 0.2]} />{matTail}</mesh>
        <mesh position={[-length * 0.5 - 0.9 * unit, yMirror.plate * unit, 0]}><boxGeometry args={[1.2 * unit, 11 * unit, w * 0.24]} />{matPlate}</mesh>
        {/* aynalar */}
        {[1, -1].map(s => (
          <group key={s} position={[length * (isSuv ? 0.145 : 0.175), yMirror.mirror * unit, s * (halfBody + 5 * unit)]}>
            <mesh castShadow receiveShadow><boxGeometry args={[4 * unit, 2.5 * unit, 6 * unit]} />{matBody}</mesh>
            <mesh position={[0, 5 * unit, s * 7 * unit]} castShadow receiveShadow><boxGeometry args={[5 * unit, 10 * unit, 13 * unit]} />{matBody}</mesh>
          </group>
        ))}
        {/* kapı çizgileri + kollar */}
        {[1, -1].map(s => (
          <group key={s}>
            <mesh position={[length * 0.055, yMirror.seam * unit, s * (halfBody + 0.35 * unit)]}><boxGeometry args={[0.5 * unit, 27 * unit, 0.5 * unit]} />{matTrim}</mesh>
            <mesh position={[length * 0.135, yMirror.handle * unit, s * (halfBody + 0.8 * unit)]}><boxGeometry args={[7 * unit, 2.4 * unit, 1.3 * unit]} />{matChrome}</mesh>
            <mesh position={[-length * 0.075, yMirror.handle * unit, s * (halfBody + 0.8 * unit)]}><boxGeometry args={[7 * unit, 2.4 * unit, 1.3 * unit]} />{matChrome}</mesh>
          </group>
        ))}
        <Wheel R={P.R} W={P.W} px={length * 0.31} pz={wheelZ} />
        <Wheel R={P.R} W={P.W} px={length * 0.31} pz={-wheelZ} />
        <Wheel R={P.R} W={P.W} px={-length * 0.31} pz={wheelZ} />
        <Wheel R={P.R} W={P.W} px={-length * 0.31} pz={-wheelZ} />
        {isEmergency && !isBus && <Lightbar lx={0} ly={isSuv ? 172 : 151} />}
      </group>
    );
  }

  // Tepe lambası (polis / ambulans / itfaiye)
  function Lightbar({ lx, ly }) {
    return (
      <group position={[lx, ly * unit, 0]}>
        <mesh castShadow receiveShadow><boxGeometry args={[length * 0.08, 4 * unit, w * 0.45]} />{matTrim}</mesh>
        <mesh position={[0, 3.5 * unit, w * 0.12]}><boxGeometry args={[length * 0.06, 3 * unit, w * 0.14]} /><meshBasicMaterial color="#0055ff" /></mesh>
        <mesh position={[0, 3.5 * unit, -w * 0.12]}><boxGeometry args={[length * 0.06, 3 * unit, w * 0.14]} /><meshBasicMaterial color="#ff0000" /></mesh>
      </group>
    );
  }

  return (
    <group position={[x, zOffset, y]} rotation={[0, rotation, 0]}>
      <group position={[0, rollOver ? flipY : 0, 0]} rotation={[rollOver ? Math.PI : 0, 0, 0]} scale={[grow, grow, grow]}>
        {content}
      </group>
    </group>
  );
}

export default Arac3D;
