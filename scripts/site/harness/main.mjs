/* Arac3D v2 test düzeneği — gerçek uygulama chunk'larıyla (vendor-react / vendor-three) */
import { c as ReactMod, i as JsxMod, a as CreateRoot } from './assets/vendor-react-DINcDvCS.js';
import * as V3 from './assets/vendor-three-B9PNK1h0.js';
import { makeMr } from '../mr_v2.js';

const React = ReactMod();
const jsxrt = JsxMod();
const j = (t, p, k) => jsxrt.jsx(t, p, k);
const js = (t, p, k) => jsxrt.jsxs(t, p, k);


const Mr = makeMr({ e: jsxrt, O: React, s: 0.55, qe: V3.w, rs: V3.g });

/* ---------- araç ölçüleri (cm) ---------- */
const DIMS = {
  'v-sedan': [460, 180], 'v-suv': [480, 195], 'v-truck': [900, 250], 'v-bus': [1100, 255],
  'v-motor': [220, 70], 'v-police': [470, 185], 'v-ambulance': [560, 200], 'v-firetruck': [950, 250],
  'v-taxi': [460, 180], 'v-gendarmerie': [490, 200], 'v-pickup': [530, 195], 'v-panelvan': [540, 200],
  'v-minibus': [700, 220], 'v-trailer': [1400, 260], 'v-trailer-only': [900, 260], 'v-dump': [900, 250],
  'v-tow': [900, 250], 'v-crane': [1000, 250], 'v-concrete': [950, 250], 'v-toma': [900, 250],
  'v-armored': [600, 240], 'v-tractor': [420, 190], 'v-forklift': [300, 130], 'v-excavator': [600, 230],
  'v-loader': [550, 220], 'v-quad': [210, 110], 'v-golf': [300, 140], 'v-hatchback': [410, 175],
  'v-station': [490, 180], 'v-coupe': [450, 185], 'v-cabrio': [450, 180], 'v-limousine': [600, 190],
  'v-classic': [470, 180], 'v-burned': [460, 180], 'v-damaged-front': [460, 180], 'v-motor-fallen': [220, 70],
  'v-minivan': [500, 195], 'v-caravan': [550, 205], 'v-municipal': [560, 200], 'v-tram': [1200, 240],
  'v-train': [1200, 280], 'v-bicycle': [180, 50],
};
const NAMES = {
  'v-sedan': 'Binek Otomobil', 'v-suv': 'SUV Jeep', 'v-truck': 'Kamyon (itfaiye)', 'v-bus': 'Otobüs',
  'v-motor': 'Motosiklet', 'v-police': 'Polis Aracı', 'v-ambulance': 'Ambulans', 'v-firetruck': 'İtfaiye Aracı',
  'v-taxi': 'Taksi', 'v-gendarmerie': 'Jandarma Aracı', 'v-pickup': 'Kamyonet (Pickup)', 'v-panelvan': 'Panelvan',
  'v-minibus': 'Minibüs', 'v-trailer': 'Tır (Çekici + Dorse)', 'v-trailer-only': 'Dorse (Ayrı)', 'v-dump': 'Damperli Kamyon',
  'v-tow': 'Çekici (Tow Truck)', 'v-crane': 'Vinç', 'v-concrete': 'Beton Mikseri', 'v-toma': 'TOMA',
  'v-armored': 'Zırhlı Araç', 'v-tractor': 'Traktör', 'v-forklift': 'Forklift', 'v-excavator': 'Ekskavatör (Paletli)',
  'v-loader': 'Dozer / Yükleyici', 'v-quad': 'ATV (Quad)', 'v-golf': 'Golf Aracı', 'v-hatchback': 'Hatchback',
  'v-station': 'Station Wagon', 'v-coupe': 'Spor Otomobil', 'v-cabrio': 'Üstü Açık', 'v-limousine': 'Limuzin',
  'v-classic': 'Klasik Otomobil', 'v-burned': 'Yanmış Araç', 'v-damaged-front': 'Ağır Hasarlı Araç',
  'v-motor-fallen': 'Yatık Motosiklet', 'v-minivan': 'Minivan', 'v-caravan': 'Karavan',
  'v-municipal': 'Belediye Görev Aracı', 'v-tram': 'Tramvay', 'v-train': 'Lokomotif', 'v-bicycle': 'Bisiklet',
};

const q = new URLSearchParams(location.search);
const kind = q.get('kind') || 'v-sedan';
const view = q.get('view') || 'bird';
const color = q.get('color') || '';
const zh = q.get('zh') ? Number(q.get('zh')) : undefined;
const [Lcm, Wcm] = DIMS[kind] || [460, 180];
const L = Lcm * 0.55, W = Wcm * 0.55;
const radDeg = q.get('rot') ? Number(q.get('rot')) : 0;

const CAMS = {
  bird: [L * 0.95, L * 1.35, L * 1.25],
  side: [0, L * 0.42, L * 1.9],
  front: [L * 1.85, L * 0.45, L * 0.05],
  threeq: [L * 0.9, L * 0.72, L * 0.9],
  frontneg: [0, L * 0.42, -L * 1.9],
};
const camPos = CAMS[view] || CAMS.bird;

function Scene() {
  return js(V3.c, {
    camera: { fov: 45, position: camPos, near: 1, far: 8000 },
    gl: { antialias: true },
    shadows: true,
    onCreated: ({ camera, gl, scene }) => {
      camera.lookAt(0, L * 0.1, 0);
      try {
        const pmrem = new V3.f(gl);
        const env = pmrem.fromScene(new V3.t(), 0.04);
        scene.environment = env.texture;
        pmrem.dispose();
      } catch (err) { console.log('env fail', err.message); }
      setTimeout(() => { window.__done = true; }, 120);
    },
    children: [
      j('color', { attach: 'background', args: ['#bcd4e8'] }),
      j('hemisphereLight', { intensity: 0.65, color: '#e3edf7', groundColor: '#8f9296' }),
      j('ambientLight', { intensity: 0.5 }),
      j('directionalLight', {
        position: [100, 200, 100], intensity: 1, castShadow: true,
        'shadow-camera-left': -400, 'shadow-camera-right': 400,
        'shadow-camera-top': 400, 'shadow-camera-bottom': -400,
      }),
      j('mesh', {
        position: [0, -0.2, 0], rotation: [-Math.PI / 2, 0, 0], receiveShadow: true,
        children: [
          j('planeGeometry', { args: [6000, 6000] }),
          j('meshStandardMaterial', { color: '#cfd3d6', roughness: 0.95 }),
        ],
      }),
      j(Mr, {
        x: 0, y: 0, width: W, height: L, rad: radDeg * Math.PI / 180,
        type: kind + ' ' + (NAMES[kind] || ''), fill: color || undefined, zHeight: zh,
      }),
    ],
  });
}

CreateRoot().createRoot(document.getElementById('root')).render(j(Scene, {}));
