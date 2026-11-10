import React from 'react';
import * as THREE from 'three';

/**
 * ANIMAL3D — PROSEDÜREL 3B HAYVAN MODELLERİ
 * ------------------------------------------
 * 2B tuvaldeki hayvan sembolleri (an-*) 3B görünümde PNG siluetinden ekstrüze
 * düz tabakalar olarak çizildiği için "2B ve bozuk" görünüyordu. Bu modül
 * her tür için GERÇEK HACİMLİ, ayakta duran 3B modeller üretir:
 * gövde + göğüs + sağrı, boyun, baş + burun, kulaklar, 4 bacak (üst/alt/toynak
 * veya pati), kuyruk, tür bazlı boynuz/antler/yele/sakal/uzver/azı dişi/ibik.
 *
 * Ölçü kuralları (2B kroki ile birebir uyum):
 *   width  (L) = 2B çizim genişliği → hayvanın BOY UZUNLUĞU (X ekseni)
 *   height (H) = 2B çizim yüksekliği → hayvanın AYAKTA DURMA YÜKSEKLİĞİ (Y ekseni)
 * Gövde genişliği (Z) türe özgü orandan gelir. Model +X yönüne bakar;
 * konum/dönüş üst bileşen (Symbol3D) tarafından verilir.
 */

/* ----------------------------- Yardımcılar ----------------------------- */

/** Küre → ölçekli elipsoid (p: merkez [x,y,z], r: yarıçaplar [rx,ry,rz]). */
type V3 = [number, number, number];
const Ell = ({ p, r, color, rough = 0.82, seg = 22, opacity }: {
  p: V3; r: V3; color: string; rough?: number; seg?: number; opacity?: number;
}) => (
  <mesh position={p} scale={r} castShadow receiveShadow>
    <sphereGeometry args={[1, seg, Math.max(10, Math.round(seg * 0.6))]} />
    <meshStandardMaterial color={color} roughness={rough} metalness={0.02} transparent={opacity !== undefined} opacity={opacity ?? 1} />
  </mesh>
);

/** İki nokta arasına konik (uçlara doğru incelen) silindir "kemik". */
const Bone = ({ from, to, r1, r2, color, rough = 0.82, seg = 14 }: {
  from: V3; to: V3; r1: number; r2: number; color: string; rough?: number; seg?: number;
}) => {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = (to[2] || 0) - (from[2] || 0);
  const len = Math.hypot(dx, dy, dz) || 0.0001;
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(dx / len, dy / len, dz / len),
  );
  return (
    <mesh
      position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, ((from[2] || 0) + (to[2] || 0)) / 2]}
      quaternion={[q.x, q.y, q.z, q.w]}
      castShadow
    >
      <cylinderGeometry args={[Math.max(0.001, r2), Math.max(0.001, r1), len, seg]} />
      <meshStandardMaterial color={color} roughness={rough} metalness={0.02} />
    </mesh>
  );
};

/** Taban merkezli kon (kulak, gaga, boynuz ucu, tüy...). */
const Cone = ({ p, len, r, rotZ = 0, rotX = 0, color, rough = 0.8, seg = 12, flat = 1 }: {
  p: V3; len: number; r: number; rotZ?: number; rotX?: number; color: string; rough?: number; seg?: number; flat?: number;
}) => (
  <mesh position={p} rotation={[rotX, 0, rotZ]} scale={[flat, 1, 1]} castShadow>
    <coneGeometry args={[r, len, seg]} />
    <meshStandardMaterial color={color} roughness={rough} metalness={0.02} />
  </mesh>
);

/** Kuadratik Bezier ile örüt pürüzsüz kuyruk: kökten uca incelen 3 eklem. */
const CurvedTail = ({ base, len, ang, lift, r1, r2, color, segs = 3, droop = 0.22 }: {
  base: V3; len: number; ang: number; lift: number; r1: number; r2: number; color: string; segs?: number; droop?: number;
}) => {
  const a = (ang * Math.PI) / 180;
  const bx = base[0], by = base[1];
  const P0: [number, number] = [bx, by];
  const P2: [number, number] = [bx - Math.cos(a) * len, by + len * lift * 0.75];
  const P1: [number, number] = [bx - Math.cos(a) * len * 0.45, by - len * droop];
  const q = (t: number): [number, number] => [
    (1 - t) * (1 - t) * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0],
    (1 - t) * (1 - t) * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1],
  ];
  const pts: [number, number][] = [];
  for (let i = 0; i <= segs; i++) pts.push(q(i / segs));
  const bones = [];
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const rA = r1 + (r2 - r1) * t0;
    const rB = r1 + (r2 - r1) * t1;
    bones.push(
      <Bone key={i} from={[pts[i][0], pts[i][1], 0]} to={[pts[i + 1][0], pts[i + 1][1], 0]} r1={rA} r2={rB} color={color} seg={10} />,
    );
  }
  return <group>{bones}</group>;
};

/* ------------------------- Tür parametre tablosu ------------------------ */
/**
 * Tüm değerler H (yükseklik) veya L (boy) çarpanıdır.
 * bl: gövde yarısının uzunluğu (×L) · br: gövde dikey yarıçapı (×H)
 * bz: gövde genişlik yarıçapı (×H) · by: gövde merkez yüksekliği (×H)
 * bd: göğüs çökmesi / rr: sağrı kalkması (×H)
 * leg: {x1 ön konum(×L), x2 arka konum(×L), top(×H), r(×H), hoof(×H), paw?}
 * neck: {len, ang (yataydan derece), r} · head: {len (×H), r (×H), sn, snR, snY}
 * ear: {len, r, ang (geriye yatma), spread} · tail: {len, r, ang, lift}
 */
type Colors = { body: string; belly: string; dark: string; snout: string; hoof: string; extra?: string };
type QuadDef = {
  bl: number; br: number; bz: number; by: number; bd: number; rr: number;
  leg: { x1: number; x2: number; top: number; r: number; hoof: number; paw?: boolean };
  neck: { len: number; ang: number; r: number };
  head: { len: number; r: number; sn: number; snR: number; snY: number };
  ear: { len: number; r: number; ang: number; spread: number; side?: boolean };
  tail: { len: number; r: number; ang: number; lift: number; mode: 'bushy' | 'thin' | 'down' | 'stub' | 'tuft' };
  horns?: 'goat' | 'cow' | 'deer';
  mane?: boolean; beard?: boolean; udder?: boolean; tusks?: boolean; woolly?: boolean;
  colors: Colors;
};

const SPECIES: Record<string, QuadDef> = {
  dog: {
    bl: 0.30, br: 0.185, bz: 0.165, by: 0.565, bd: 0.045, rr: 0.02,
    leg: { x1: 0.19, x2: -0.20, top: 0.50, r: 0.042, hoof: 0.045, paw: true },
    neck: { len: 0.26, ang: 44, r: 0.085 },
    head: { len: 0.21, r: 0.145, sn: 0.17, snR: 0.058, snY: 0.045 },
    ear: { len: 0.155, r: 0.052, ang: 12, spread: 0.55 },
    tail: { len: 0.32, r: 0.055, ang: 30, lift: 0.5, mode: 'bushy' },
    colors: { body: '#9a7b4f', belly: '#c4a97e', dark: '#4a3a26', snout: '#6f5836', hoof: '#3d2f1f' },
  },
  wolf: {
    bl: 0.31, br: 0.175, bz: 0.155, by: 0.585, bd: 0.045, rr: 0.02,
    leg: { x1: 0.20, x2: -0.21, top: 0.52, r: 0.038, hoof: 0.04, paw: true },
    neck: { len: 0.27, ang: 38, r: 0.082 },
    head: { len: 0.22, r: 0.14, sn: 0.20, snR: 0.05, snY: 0.05 },
    ear: { len: 0.15, r: 0.05, ang: 8, spread: 0.5 },
    tail: { len: 0.36, r: 0.05, ang: 34, lift: 0.45, mode: 'bushy' },
    colors: { body: '#878b92', belly: '#c3c7cd', dark: '#3f4247', snout: '#5e6167', hoof: '#33363b' },
  },
  fox: {
    bl: 0.30, br: 0.155, bz: 0.14, by: 0.55, bd: 0.04, rr: 0.02,
    leg: { x1: 0.19, x2: -0.20, top: 0.49, r: 0.032, hoof: 0.035, paw: true },
    neck: { len: 0.22, ang: 40, r: 0.07 },
    head: { len: 0.20, r: 0.125, sn: 0.22, snR: 0.042, snY: 0.045 },
    ear: { len: 0.19, r: 0.06, ang: 10, spread: 0.6 },
    tail: { len: 0.46, r: 0.075, ang: 40, lift: 0.75, mode: 'bushy' },
    colors: { body: '#bd6a20', belly: '#e6d9bf', dark: '#2f2620', snout: '#8f4d16', hoof: '#2f2620' },
  },
  cat: {
    bl: 0.27, br: 0.16, bz: 0.13, by: 0.50, bd: 0.035, rr: 0.015,
    leg: { x1: 0.16, x2: -0.17, top: 0.44, r: 0.030, hoof: 0.032, paw: true },
    neck: { len: 0.14, ang: 55, r: 0.065 },
    head: { len: 0.155, r: 0.135, sn: 0.10, snR: 0.045, snY: 0.04 },
    ear: { len: 0.13, r: 0.055, ang: 14, spread: 0.65 },
    tail: { len: 0.52, r: 0.028, ang: 46, lift: 0.85, mode: 'thin' },
    colors: { body: '#8b8b92', belly: '#c9c9ce', dark: '#3f3f45', snout: '#77777e', hoof: '#54545a' },
  },
  horse: {
    bl: 0.30, br: 0.185, bz: 0.16, by: 0.635, bd: 0.04, rr: 0.03,
    leg: { x1: 0.21, x2: -0.22, top: 0.58, r: 0.035, hoof: 0.045 },
    neck: { len: 0.30, ang: 52, r: 0.095 },
    head: { len: 0.24, r: 0.115, sn: 0.20, snR: 0.05, snY: 0.085 },
    ear: { len: 0.10, r: 0.032, ang: 14, spread: 0.5 },
    tail: { len: 0.40, r: 0.05, ang: 52, lift: 0, mode: 'down' },
    mane: true,
    colors: { body: '#7a5230', belly: '#9a6d43', dark: '#352414', snout: '#5d3d21', hoof: '#241c12' },
  },
  donkey: {
    bl: 0.30, br: 0.175, bz: 0.15, by: 0.60, bd: 0.035, rr: 0.03,
    leg: { x1: 0.20, x2: -0.21, top: 0.55, r: 0.033, hoof: 0.04 },
    neck: { len: 0.24, ang: 55, r: 0.08 },
    head: { len: 0.23, r: 0.115, sn: 0.20, snR: 0.05, snY: 0.085 },
    ear: { len: 0.24, r: 0.05, ang: 8, spread: 0.45 },
    tail: { len: 0.36, r: 0.022, ang: 46, lift: 0.25, mode: 'tuft' },
    mane: true,
    colors: { body: '#8f8d94', belly: '#d8d6dc', dark: '#3a3630', snout: '#cfcdd4', hoof: '#262626' },
  },
  cow: {
    bl: 0.31, br: 0.21, bz: 0.185, by: 0.60, bd: 0.05, rr: 0.04,
    leg: { x1: 0.21, x2: -0.22, top: 0.545, r: 0.045, hoof: 0.05 },
    neck: { len: 0.20, ang: 34, r: 0.10 },
    head: { len: 0.20, r: 0.135, sn: 0.17, snR: 0.075, snY: 0.05 },
    ear: { len: 0.12, r: 0.045, ang: 74, spread: 0.9, side: true },
    tail: { len: 0.36, r: 0.02, ang: 44, lift: 0, mode: 'tuft' },
    horns: 'cow', udder: true,
    colors: { body: '#e6e1d5', belly: '#efeadf', dark: '#38332c', snout: '#c99a90', hoof: '#28241f', extra: '#38332c' },
  },
  sheep: {
    bl: 0.29, br: 0.20, bz: 0.17, by: 0.575, bd: 0.05, rr: 0.045,
    leg: { x1: 0.19, x2: -0.20, top: 0.52, r: 0.032, hoof: 0.04 },
    neck: { len: 0.15, ang: 38, r: 0.085 },
    head: { len: 0.17, r: 0.115, sn: 0.14, snR: 0.05, snY: 0.04 },
    ear: { len: 0.10, r: 0.035, ang: 80, spread: 0.85, side: true },
    tail: { len: 0.12, r: 0.05, ang: 20, lift: 0, mode: 'stub' },
    woolly: true,
    colors: { body: '#ece7d8', belly: '#f2eee2', dark: '#3c352c', snout: '#4a4238', hoof: '#2c2822' },
  },
  goat: {
    bl: 0.29, br: 0.175, bz: 0.15, by: 0.585, bd: 0.045, rr: 0.035,
    leg: { x1: 0.20, x2: -0.21, top: 0.535, r: 0.033, hoof: 0.045 },
    neck: { len: 0.21, ang: 46, r: 0.078 },
    head: { len: 0.185, r: 0.115, sn: 0.16, snR: 0.05, snY: 0.05 },
    ear: { len: 0.13, r: 0.04, ang: 70, spread: 0.8, side: true },
    tail: { len: 0.14, r: 0.035, ang: 30, lift: 0.5, mode: 'stub' },
    horns: 'goat', beard: true,
    colors: { body: '#a3906f', belly: '#c8b997', dark: '#4d4232', snout: '#8a7a5c', hoof: '#332b1e', extra: '#8f8570' },
  },
  deer: {
    bl: 0.29, br: 0.175, bz: 0.15, by: 0.625, bd: 0.04, rr: 0.035,
    leg: { x1: 0.20, x2: -0.21, top: 0.575, r: 0.028, hoof: 0.04 },
    neck: { len: 0.30, ang: 58, r: 0.075 },
    head: { len: 0.20, r: 0.10, sn: 0.17, snR: 0.042, snY: 0.07 },
    ear: { len: 0.14, r: 0.038, ang: 22, spread: 0.6 },
    tail: { len: 0.10, r: 0.03, ang: 24, lift: 0, mode: 'stub' },
    horns: 'deer',
    colors: { body: '#a5793f', belly: '#d8c39c', dark: '#4a351c', snout: '#7c5a2e', hoof: '#2c2418', extra: '#6e5433' },
  },
  bear: {
    bl: 0.31, br: 0.23, bz: 0.20, by: 0.52, bd: 0.05, rr: 0.05,
    leg: { x1: 0.21, x2: -0.22, top: 0.44, r: 0.062, hoof: 0.06, paw: true },
    neck: { len: 0.14, ang: 26, r: 0.12 },
    head: { len: 0.20, r: 0.15, sn: 0.13, snR: 0.075, snY: 0.045 },
    ear: { len: 0.075, r: 0.055, ang: 6, spread: 0.75 },
    tail: { len: 0.06, r: 0.03, ang: 20, lift: 0, mode: 'stub' },
    colors: { body: '#5c4632', belly: '#6d5540', dark: '#2e2218', snout: '#8a6d50', hoof: '#26201a' },
  },
  pig: {
    bl: 0.32, br: 0.195, bz: 0.175, by: 0.50, bd: 0.04, rr: 0.035,
    leg: { x1: 0.22, x2: -0.23, top: 0.425, r: 0.038, hoof: 0.045 },
    neck: { len: 0.10, ang: 20, r: 0.10 },
    head: { len: 0.21, r: 0.14, sn: 0.16, snR: 0.075, snY: 0.02 },
    ear: { len: 0.12, r: 0.05, ang: 30, spread: 0.55 },
    tail: { len: 0.16, r: 0.014, ang: 40, lift: 0.6, mode: 'thin' },
    tusks: true,
    colors: { body: '#4d4239', belly: '#5c5045', dark: '#26201b', snout: '#6b5a4c', hoof: '#211c18', extra: '#e8e2d2' },
  },
};

const SPECIES_ALIASES: Record<string, string> = {
  'an-dog': 'dog', 'an-wolf': 'wolf', 'an-fox': 'fox', 'an-cat': 'cat', 'an-horse': 'horse',
  'an-donkey': 'donkey', 'an-cow': 'cow', 'an-sheep': 'sheep', 'an-goat': 'goat',
  'an-deer': 'deer', 'an-bear': 'bear', 'an-pig': 'pig',
};

/* --------------------------- Dört ayaklı gövde -------------------------- */

const Quadruped = ({ L, H, p }: { L: number; H: number; p: QuadDef }) => {
  const c = p.colors;
  const by = p.by * H;             // gövde merkez yüksekliği
  const br = p.br * H;             // gövde dikey yarıçap
  const bLen = p.bl * L;           // gövde yarısının uzunluğu
  const bz = p.bz * H;             // gövde genişlik yarıçapı
  const belly = by - br * 0.55;    // karın alt sınırı (bacak üst bağlantısı)

  // Boyun + baş zinciri
  const neckBase: [number, number, number] = [bLen * 0.72, by + br * 0.5, 0];
  const na = (p.neck.ang * Math.PI) / 180;
  const neckLen = p.neck.len * H;
  const headC: [number, number, number] = [
    neckBase[0] + Math.cos(na) * neckLen,
    neckBase[1] + Math.sin(na) * neckLen,
    0,
  ];
  const hLen = p.head.len * H;
  const hRad = p.head.r * H;
  const headCtr: [number, number, number] = [headC[0] + hLen * 0.3, headC[1] + hRad * 0.15, 0];
  const snoutC: [number, number, number] = [headCtr[0] + hLen * 0.55 + p.head.sn * H * 0.35, headCtr[1] - p.head.snY * H, 0];

  // Kuyruk (eğri) — CurvedTail kökten uca örütlenir
  const tailBase: [number, number, number] = [-bLen * 0.94, by + br * 0.45, 0];
  const tl = p.tail.len * H;

  return (
    <group>
      {/* ---- GÖVDE ---- */}
      <Ell p={[0, by, 0]} r={[bLen, br, bz]} color={c.body} />
      {/* göğüs (ön) */}
      <Ell p={[bLen * 0.52, by - p.bd * H * 0.6, 0]} r={[bLen * 0.55, br * 0.92, bz * 0.96]} color={c.body} />
      {/* sağrı (arka) */}
      <Ell p={[-bLen * 0.55, by + p.rr * H * 0.6, 0]} r={[bLen * 0.5, br * 0.9, bz * 0.94]} color={c.body} />
      {/* karın (daha açık ton) */}
      <Ell p={[bLen * 0.05, by - br * 0.45, 0]} r={[bLen * 0.72, br * 0.72, bz * 0.9]} color={c.belly} />

      {/* ---- BACAKLAR ---- */}
      {([[p.leg.x1 * L, 1], [p.leg.x1 * L, -1], [p.leg.x2 * L, 1], [p.leg.x2 * L, -1]] as [number, number][]).map(([lx, s], i) => {
        const lz = bz * 0.78 * s;
        const top = Math.max(p.leg.top * H, belly - br * 0.1);
        const hoofH = p.leg.hoof * H;
        return (
          <group key={i}>
            <Bone from={[lx, top, lz]} to={[lx, hoofH + 0.02 * H, lz]} r1={p.leg.r * H * 1.35} r2={p.leg.r * H * 0.85} color={c.body} />
            {p.leg.paw ? (
              <Ell p={[lx + 0.012 * L, hoofH * 0.6, lz]} r={[p.leg.r * H * 1.7, hoofH * 0.75, p.leg.r * H * 1.5]} color={c.hoof} rough={0.7} />
            ) : (
              <mesh position={[lx, hoofH * 0.5, lz]} castShadow>
                <cylinderGeometry args={[p.leg.r * H * 0.95, p.leg.r * H * 1.05, hoofH, 10]} />
                <meshStandardMaterial color={c.hoof} roughness={0.55} metalness={0.05} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* ---- BOYUN ---- */}
      <Bone from={neckBase} to={headC} r1={p.neck.r * H * 1.25} r2={p.neck.r * H * 0.85} color={c.body} />

      {/* ---- BAŞ ---- */}
      <Ell p={headCtr} r={[hLen, hRad, hRad * 0.9]} color={c.body} />
      {/* burun / ağız */}
      <Ell p={snoutC} r={[p.head.sn * H * 0.62, p.head.snR * H * 1.15, p.head.snR * H]} color={c.snout} />
      {/* burun ucu */}
      <Ell p={[snoutC[0] + p.head.sn * H * 0.5, snoutC[1] + p.head.snR * H * 0.3, 0]} r={[p.head.snR * H * 0.55, p.head.snR * H * 0.55, p.head.snR * H * 0.5]} color={c.dark} rough={0.5} />
      {/* gözler */}
      {[1, -1].map((s) => (
        <Ell key={s} p={[headCtr[0] + hLen * 0.42, headCtr[1] + hRad * 0.3, s * hRad * 0.62]} r={[hRad * 0.13, hRad * 0.13, hRad * 0.13]} color="#141210" rough={0.3} />
      ))}

      {/* ---- KULAKLAR ---- */}
      {[1, -1].map((s) => {
        const ex = headCtr[0] - hLen * 0.15;
        const ey = headCtr[1] + hRad * 0.8;
        const ez = s * (p.ear.side ? hRad * 0.95 : hRad * p.ear.spread);
        const ea = (p.ear.side ? p.ear.ang : p.ear.ang) * (Math.PI / 180);
        const earLen = p.ear.len * H;
        const tip: [number, number, number] = [
          ex - Math.sin(ea) * earLen * 0.35,
          ey + Math.cos(ea) * earLen * (p.ear.side ? 0.35 : 0.85),
          ez * (p.ear.side ? 1.6 : 1.25),
        ];
        return <Bone key={s} from={[ex, ey, ez]} to={tip} r1={p.ear.r * H * 1.15} r2={p.ear.r * H * 0.15} color={c.body} seg={10} />;
      })}

      {/* ---- KUYRUK ---- */}
      {p.tail.mode === 'stub' ? (
        <Ell p={[tailBase[0] - tl * 0.4, tailBase[1] + tl * 0.2, 0]} r={[tl * 0.6, tl * 0.55, tl * 0.5]} color={c.body} />
      ) : p.tail.mode === 'down' ? (
        <group>
          <Bone from={tailBase} to={[tailBase[0] - tl * 0.18, tailBase[1] - tl * 0.9, 0]} r1={p.tail.r * H * 1.1} r2={p.tail.r * H * 0.7} color={c.dark} />
          <Ell p={[tailBase[0] - tl * 0.22, tailBase[1] - tl * 1.0, 0]} r={[tl * 0.12, tl * 0.2, tl * 0.11]} color={c.dark} />
        </group>
      ) : p.tail.mode === 'tuft' ? (
        <group>
          <Bone from={tailBase} to={[tailBase[0] - tl * 0.3, tailBase[1] - tl * 0.85, 0]} r1={p.tail.r * H} r2={p.tail.r * H * 0.6} color={c.body} />
          <Ell p={[tailBase[0] - tl * 0.33, tailBase[1] - tl * 0.95, 0]} r={[tl * 0.13, tl * 0.17, tl * 0.13]} color={c.dark} />
        </group>
      ) : (
        <CurvedTail
          base={tailBase}
          len={tl}
          ang={p.tail.ang}
          lift={p.tail.lift}
          r1={p.tail.r * H * (p.tail.mode === 'bushy' ? 1.55 : 1)}
          r2={p.tail.r * H * (p.tail.mode === 'bushy' ? 0.45 : 0.5)}
          color={c.body}
        />
      )}

      {/* ---- TÜRE ÖZGÜ EKLER ---- */}
      {p.horns === 'cow' && [1, -1].map((s) => (
        <Bone key={s} from={[headCtr[0] - hLen * 0.05, headCtr[1] + hRad * 0.85, s * hRad * 0.75]} to={[headCtr[0] - hLen * 0.28, headCtr[1] + hRad * 1.35, s * hRad * 2.1]} r1={hRad * 0.22} r2={hRad * 0.05} color={c.extra || '#d9cfb8'} seg={8} />
      ))}
      {p.horns === 'goat' && [1, -1].map((s) => (
        <group key={s}>
          <Bone from={[headCtr[0] - hLen * 0.1, headCtr[1] + hRad * 0.85, s * hRad * 0.45]} to={[headCtr[0] - hLen * 0.55, headCtr[1] + hRad * 2.0, s * hRad * 0.55]} r1={hRad * 0.18} r2={hRad * 0.12} color={c.extra || '#8f8570'} seg={8} />
          <Bone from={[headCtr[0] - hLen * 0.55, headCtr[1] + hRad * 2.0, s * hRad * 0.55]} to={[headCtr[0] - hLen * 1.35, headCtr[1] + hRad * 2.35, s * hRad * 0.5]} r1={hRad * 0.12} r2={hRad * 0.02} color={c.extra || '#8f8570'} seg={8} />
        </group>
      ))}
      {p.horns === 'deer' && [1, -1].map((s) => {
        const ab: [number, number, number] = [headCtr[0] - hLen * 0.05, headCtr[1] + hRad * 0.85, s * hRad * 0.4];
        const am: [number, number, number] = [headCtr[0] - hLen * 0.35, headCtr[1] + hRad * 2.4, s * hRad * 0.6];
        const at: [number, number, number] = [headCtr[0] - hLen * 1.05, headCtr[1] + hRad * 3.1, s * hRad * 0.65];
        const t1: [number, number, number] = [am[0] + hLen * 0.42, am[1] + hRad * 0.9, s * hRad * 0.5];
        const t2: [number, number, number] = [at[0] + hLen * 0.3, at[1] + hRad * 0.7, s * hRad * 0.5];
        return (
          <group key={s}>
            <Bone from={ab} to={am} r1={hRad * 0.14} r2={hRad * 0.09} color={c.extra || '#6e5433'} seg={8} />
            <Bone from={am} to={at} r1={hRad * 0.09} r2={hRad * 0.03} color={c.extra || '#6e5433'} seg={8} />
            <Bone from={am} to={t1} r1={hRad * 0.07} r2={hRad * 0.02} color={c.extra || '#6e5433'} seg={6} />
            <Bone from={at} to={t2} r1={hRad * 0.05} r2={hRad * 0.02} color={c.extra || '#6e5433'} seg={6} />
          </group>
        );
      })}
      {p.mane && (
        <group>
          <Bone from={[neckBase[0], neckBase[1] + p.neck.r * H * 0.7, 0]} to={[headC[0] - hLen * 0.1, headC[1] + hRad * 0.75, 0]} r1={p.neck.r * H * 0.42} r2={p.neck.r * H * 0.3} color={c.dark} />
          <Ell p={[headCtr[0] - hLen * 0.55, headCtr[1] + hRad * 0.6, 0]} r={[hLen * 0.3, hRad * 0.35, hRad * 0.4]} color={c.dark} />
        </group>
      )}
      {p.beard && (
        <Cone p={[headCtr[0] + hLen * 0.4, headCtr[1] - hRad * 1.1, 0]} len={hRad * 0.9} r={hRad * 0.16} rotZ={Math.PI} color={c.dark} />
      )}
      {p.udder && (
        <Ell p={[-bLen * 0.42, by - br * 0.95, 0]} r={[H * 0.085, H * 0.065, H * 0.09]} color="#e0b3ac" rough={0.65} />
      )}
      {p.tusks && [1, -1].map((s) => (
        <Bone key={s} from={[snoutC[0] + p.head.sn * H * 0.2, snoutC[1] - p.head.snR * H * 0.4, s * p.head.snR * H * 0.7]} to={[snoutC[0] + p.head.sn * H * 0.45, snoutC[1] + p.head.snR * H * 0.7, s * p.head.snR * H * 0.85]} r1={hRad * 0.07} r2={hRad * 0.015} color={c.extra || '#e8e2d2'} seg={6} />
      ))}
      {p.woolly && (
        <group>
          <Ell p={[bLen * 0.35, by + br * 0.35, bz * 0.4]} r={[bLen * 0.42, br * 0.6, bz * 0.62]} color={c.body} rough={0.95} />
          <Ell p={[-bLen * 0.3, by + br * 0.4, -bz * 0.45]} r={[bLen * 0.45, br * 0.62, bz * 0.62]} color={c.body} rough={0.95} />
          <Ell p={[0, by + br * 0.55, -bz * 0.3]} r={[bLen * 0.5, br * 0.55, bz * 0.6]} color={c.body} rough={0.95} />
        </group>
      )}
    </group>
  );
};

/* ------------------------- Kümes hayvanları ---------------------------- */

const Chicken3D = ({ L, H }: { L: number; H: number }) => {
  const body: [number, number, number] = [-0.02 * L, 0.52 * H, 0];
  const bodyR: [number, number, number] = [0.24 * L, 0.26 * H, 0.19 * H];
  const headC: [number, number, number] = [0.27 * L, 0.90 * H, 0];
  const beakC: [number, number, number] = [headC[0] + 0.085 * H, headC[1] - 0.015 * H, 0];
  return (
    <group>
      {/* gövde — öne eğik */}
      <group position={body} rotation={[0, 0, -0.18]}>
        <Ell p={[0, 0, 0]} r={bodyR} color="#7d4f28" />
        {/* kanatlar */}
        {[1, -1].map((s) => (
          <Ell key={s} p={[0.01 * L, -0.02 * H, s * bodyR[2] * 0.85]} r={[bodyR[0] * 0.82, bodyR[1] * 0.72, bodyR[2] * 0.28]} color="#93602f" rough={0.9} />
        ))}
        {/* kuyruk tüyleri */}
        {[0, 1, 2].map((i) => (
          <Cone key={i} p={[-bodyR[0] * 0.75, bodyR[1] * 0.5, (i - 1) * bodyR[2] * 0.32]} len={0.3 * H} r={0.05 * H} rotZ={Math.PI / 3 + i * 0.14} flat={0.45} color="#3d5232" rough={0.85} />
        ))}
      </group>
      {/* boyun */}
      <Bone from={[0.10 * L, 0.66 * H, 0]} to={[headC[0], headC[1] - 0.05 * H, 0]} r1={0.085 * H} r2={0.06 * H} color="#a06a33" />
      {/* baş */}
      <Ell p={headC} r={[0.075 * H, 0.085 * H, 0.075 * H]} color="#a06a33" />
      {/* ibik */}
      <Ell p={[headC[0] + 0.01 * L, headC[1] + 0.085 * H, 0]} r={[0.045 * H, 0.045 * H, 0.03 * H]} color="#c0392b" rough={0.6} />
      <Ell p={[headC[0] + 0.055 * L, headC[1] + 0.075 * H, 0]} r={[0.03 * H, 0.035 * H, 0.025 * H]} color="#c0392b" rough={0.6} />
      {/* gaga */}
      <Cone p={[beakC[0] + 0.03 * H, beakC[1], 0]} len={0.11 * H} r={0.032 * H} rotZ={-Math.PI / 2} color="#d98e2b" rough={0.5} />
      {/* sakal (wattle) */}
      <Ell p={[headC[0] + 0.05 * L, headC[1] - 0.09 * H, 0]} r={[0.022 * H, 0.035 * H, 0.02 * H]} color="#c0392b" rough={0.6} />
      {/* gözler */}
      {[1, -1].map((s) => (
        <Ell key={s} p={[headC[0] + 0.02 * L, headC[1] + 0.02 * H, s * 0.055 * H]} r={[0.012 * H, 0.012 * H, 0.012 * H]} color="#161311" rough={0.3} />
      ))}
      {/* bacaklar */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Bone from={[0.05 * L, 0.34 * H, s * 0.07 * H]} to={[0.05 * L, 0.05 * H, s * 0.075 * H]} r1={0.02 * H} r2={0.014 * H} color="#c9962e" seg={8} />
          <mesh position={[0.065 * L, 0.025 * H, s * 0.075 * H]} castShadow>
            <boxGeometry args={[0.09 * H, 0.022 * H, 0.05 * H]} />
            <meshStandardMaterial color="#c9962e" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const Duck3D = ({ L, H }: { L: number; H: number }) => {
  const bodyY = 0.36 * H;
  const headC: [number, number, number] = [0.30 * L, 0.80 * H, 0];
  return (
    <group>
      {/* gövde */}
      <Ell p={[-0.02 * L, bodyY, 0]} r={[0.27 * L, 0.22 * H, 0.17 * H]} color="#ece9e0" />
      {/* kuyruk */}
      <Cone p={[-0.26 * L, bodyY + 0.12 * H, 0]} len={0.16 * H} r={0.05 * H} rotZ={Math.PI / 2.6} flat={0.5} color="#cfc9ba" />
      {/* kanatlar */}
      {[1, -1].map((s) => (
        <Ell key={s} p={[0, bodyY + 0.03 * H, s * 0.145 * H]} r={[0.20 * L, 0.14 * H, 0.04 * H]} color="#dfdbd0" rough={0.9} />
      ))}
      {/* boyun */}
      <Bone from={[0.16 * L, bodyY + 0.12 * H, 0]} to={[headC[0], headC[1] - 0.05 * H, 0]} r1={0.075 * H} r2={0.055 * H} color="#3f7a52" />
      {/* baş */}
      <Ell p={headC} r={[0.075 * H, 0.085 * H, 0.075 * H]} color="#2e6b45" />
      {/* gaga (yassı) */}
      <mesh position={[headC[0] + 0.13 * H, headC[1] - 0.02 * H, 0]} castShadow>
        <boxGeometry args={[0.13 * H, 0.035 * H, 0.075 * H]} />
        <meshStandardMaterial color="#d9a03c" roughness={0.5} />
      </mesh>
      {/* gözler */}
      {[1, -1].map((s) => (
        <Ell key={s} p={[headC[0] + 0.02 * L, headC[1] + 0.02 * H, s * 0.055 * H]} r={[0.012 * H, 0.012 * H, 0.012 * H]} color="#161311" rough={0.3} />
      ))}
      {/* bacaklar + perdeli ayak */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Bone from={[0.06 * L, bodyY - 0.14 * H, s * 0.06 * H]} to={[0.06 * L, 0.035 * H, s * 0.065 * H]} r1={0.018 * H} r2={0.012 * H} color="#d97f2b" seg={8} />
          <mesh position={[0.075 * L, 0.02 * H, s * 0.065 * H]} castShadow>
            <boxGeometry args={[0.11 * H, 0.018 * H, 0.055 * H]} />
            <meshStandardMaterial color="#d97f2b" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/* ------------------------------- Yılan --------------------------------- */

const Snake3D = ({ L, H }: { L: number; H: number }) => {
  const geo = React.useMemo(() => {
    const r = Math.min(H * 0.16, L * 0.045);
    const pts = [
      new THREE.Vector3(-0.50 * L, r * 0.9, -0.02 * L),
      new THREE.Vector3(-0.34 * L, r * 0.9, 0.10 * L),
      new THREE.Vector3(-0.14 * L, r * 0.9, -0.13 * L),
      new THREE.Vector3(0.08 * L, r * 0.9, 0.12 * L),
      new THREE.Vector3(0.27 * L, r * 0.9, -0.07 * L),
      new THREE.Vector3(0.40 * L, r * 0.9, 0.04 * L),
      new THREE.Vector3(0.47 * L, r * 0.9, 0),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    return new THREE.TubeGeometry(curve, 72, r, 12, false);
  }, [L, H]);
  React.useEffect(() => () => geo.dispose(), [geo]);
  const r = Math.min(H * 0.16, L * 0.045);
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color="#6f7f4c" roughness={0.55} metalness={0.02} />
      </mesh>
      {/* baş */}
      <Ell p={[0.495 * L, r * 1.05, 0]} r={[r * 2.1, r * 1.25, r * 1.35]} color="#647445" rough={0.5} />
      {/* burun ucu */}
      <Ell p={[0.495 * L + r * 1.7, r * 0.9, 0]} r={[r * 0.9, r * 0.8, r * 0.85]} color="#7d8d58" rough={0.5} />
      {/* gözler */}
      {[1, -1].map((s) => (
        <Ell key={s} p={[0.495 * L + r * 0.7, r * 1.6, s * r * 1.05]} r={[r * 0.22, r * 0.22, r * 0.22]} color="#1c1a10" rough={0.25} />
      ))}
    </group>
  );
};

/* ------------------------------ Tavşan ---------------------------------- */

const Rabbit3D = ({ L, H }: { L: number; H: number }) => {
  return (
    <group>
      {/* sağrı (oturan) */}
      <Ell p={[-0.12 * L, 0.34 * H, 0]} r={[0.17 * L, 0.27 * H, 0.14 * H]} color="#a89a86" />
      {/* göğüs */}
      <Ell p={[0.06 * L, 0.44 * H, 0]} r={[0.115 * L, 0.21 * H, 0.105 * H]} color="#a89a86" />
      {/* karın */}
      <Ell p={[-0.02 * L, 0.28 * H, 0]} r={[0.14 * L, 0.16 * H, 0.115 * H]} color="#d6cbb8" />
      {/* baş */}
      <Ell p={[0.11 * L, 0.73 * H, 0]} r={[0.09 * L, 0.105 * H, 0.09 * H]} color="#a89a86" />
      {/* burun */}
      <Ell p={[0.16 * L, 0.70 * H, 0]} r={[0.045 * L, 0.05 * H, 0.05 * H]} color="#8d8070" />
      {/* burun ucu */}
      <Ell p={[0.20 * L, 0.71 * H, 0]} r={[0.018 * L, 0.02 * H, 0.022 * H]} color="#3a3129" rough={0.5} />
      {/* gözler */}
      {[1, -1].map((s) => (
        <Ell key={s} p={[0.145 * L, 0.77 * H, s * 0.062 * H]} r={[0.014 * L, 0.016 * H, 0.016 * H]} color="#171310" rough={0.3} />
      ))}
      {/* kulaklar (uzun, dik) */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Bone from={[0.09 * L, 0.82 * H, s * 0.035 * H]} to={[0.065 * L, 1.0 * H, s * 0.075 * H]} r1={0.035 * H} r2={0.018 * H} color="#a89a86" seg={10} />
          <Ell p={[0.062 * L, 0.99 * H, s * 0.078 * H]} r={[0.02 * L, 0.035 * H, 0.012 * H]} color="#c9b9a2" />
        </group>
      ))}
      {/* ön patiler */}
      {[1, -1].map((s) => (
        <Ell key={s} p={[0.15 * L, 0.05 * H, s * 0.05 * H]} r={[0.06 * L, 0.045 * H, 0.038 * H]} color="#8d8070" />
      ))}
      {/* arka ayaklar */}
      {[1, -1].map((s) => (
        <Ell key={s} p={[-0.03 * L, 0.05 * H, s * 0.115 * H]} r={[0.115 * L, 0.05 * H, 0.045 * H]} color="#8d8070" />
      ))}
      {/* kuyruk (pofuduk) */}
      <Ell p={[-0.27 * L, 0.36 * H, 0]} r={[0.055 * L, 0.06 * H, 0.055 * H]} color="#efeade" rough={0.95} />
    </group>
  );
};

/* ------------------------------ Ana bileşen ----------------------------- */

export const Animal3D = ({ x, y, rad, width, height, zOffset, symbolId }: {
  x: number; y: number; rad: number; width: number; height: number; zOffset?: number; symbolId?: string;
}) => {
  const L = Math.max(width, 1);
  const H = Math.max(height, 1);
  const key = (symbolId || '').toLowerCase();
  const quadKey = SPECIES_ALIASES[key];

  let body: React.ReactNode;
  if (key === 'an-snake') body = <Snake3D L={L} H={H} />;
  else if (key === 'an-chicken' || key.includes('tavuk')) body = <Chicken3D L={L} H={H} />;
  else if (key === 'an-duck') body = <Duck3D L={L} H={H} />;
  else if (key === 'an-rabbit') body = <Rabbit3D L={L} H={H} />;
  else body = <Quadruped L={L} H={H} p={SPECIES[quadKey || 'dog'] || SPECIES.dog} />;

  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, rad, 0]}>
      {body}
    </group>
  );
};

export default Animal3D;
