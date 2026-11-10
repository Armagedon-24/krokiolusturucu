// Yeni 3D araç modeli tasarımı — test sürümü (pure three.js)
// Ölçüler cm; u = e*H (sahne birimine çevirme çarpanı), t/h sahne birimi (zaten cm*e)
import * as THREE from './three.module.js';

const _glass = new THREE.MeshPhysicalMaterial({ color: '#0e151d', metalness: .05, roughness: .06, clearcoat: 1, clearcoatRoughness: .08 });
const _trim = new THREE.MeshStandardMaterial({ color: '#191c20', roughness: .55, metalness: .25 });
const _tire = new THREE.MeshStandardMaterial({ color: '#151517', roughness: .95 });
const _rim = new THREE.MeshStandardMaterial({ color: '#c9cdd3', metalness: .85, roughness: .28 });
const _chrome = new THREE.MeshStandardMaterial({ color: '#d6dade', metalness: .9, roughness: .18 });
const _head = new THREE.MeshPhysicalMaterial({ color: '#f3efdc', emissive: '#fff2ac', emissiveIntensity: .75, roughness: .15 });
const _tail = new THREE.MeshPhysicalMaterial({ color: '#a11418', emissive: '#ff2020', emissiveIntensity: .35 });
const _plate = new THREE.MeshStandardMaterial({ color: '#e8eaee', roughness: .5 });

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
function matBody(color) {
  return new THREE.MeshPhysicalMaterial({ color, metalness: .15, roughness: .32, clearcoat: .65, clearcoatRoughness: .18 });
}

function shapeFrom(steps) {
  const s = new THREE.Shape();
  for (const st of steps) {
    if (st[0] === 'm') s.moveTo(st[1], st[2]);
    else if (st[0] === 'l') s.lineTo(st[1], st[2]);
    else if (st[0] === 'q') s.quadraticCurveTo(st[1], st[2], st[3], st[4]);
  }
  s.closePath();
  return s;
}
// profil: X fraksiyon*t, Y cm*u
function profile(steps, t, u) {
  return steps.map(s => {
    if (s[0] === 'q') return ['q', s[1] * t, s[2] * u, s[3] * t, s[4] * u];
    return [s[0], s[1] * t, s[2] * u];
  });
}

function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (cast) { m.castShadow = true; m.receiveShadow = true; }
  return m;
}
function extrudeMesh(shape, opts, mat, zOff, cast = true) {
  const geo = new THREE.ExtrudeGeometry(shape, opts);
  return mesh(geo, mat, 0, 0, zOff, cast);
}
function box(w, h, d, mat, x, y, z, cast = true) {
  return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, cast);
}

function wheel(R, W, u, px, pz) {
  const g = new THREE.Group();
  g.position.set(px, R * u, pz);
  g.rotation.x = Math.PI / 2;
  g.add(mesh(new THREE.CylinderGeometry(R * u, R * u, W * u, 28), _tire));
  g.add(mesh(new THREE.CylinderGeometry(R * u * .58, R * u * .58, W * u * 1.04, 24), _rim));
  g.add(mesh(new THREE.CylinderGeometry(R * u * .13, R * u * .13, W * u * 1.12, 12), _trim));
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    const sp = mesh(new THREE.BoxGeometry(R * u * .48, R * u * .085, W * u * .34), _rim,
      Math.cos(a) * R * u * .3, Math.sin(a) * R * u * .3, 0);
    sp.rotation.z = a;
    g.add(sp);
  }
  return g;
}

// ---------------- SEDAN ----------------
export function buildSedan(t, h, u, color) {
  const g = new THREE.Group();
  const body = matBody(color);
  const bump = new THREE.MeshPhysicalMaterial({ color: shade(color, .8), metalness: .15, roughness: .4, clearcoat: .4 });
  const halfD = (h - 2) / 2;

  const bodySteps = profile([
    ['m', -0.500, 16], ['l', -0.500, 42],
    ['q', -0.500, 58, -0.472, 66],
    ['q', -0.430, 82, -0.360, 95],
    ['q', -0.330, 100.5, -0.280, 101.5],
    ['l', 0.160, 101],
    ['q', 0.225, 100, 0.270, 97],
    ['l', 0.445, 93],
    ['q', 0.490, 91.5, 0.500, 82],
    ['l', 0.500, 42], ['l', 0.490, 16],
  ], t, u);
  g.add(extrudeMesh(shapeFrom(bodySteps), { depth: h - 2, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 1.2 * u, bevelThickness: 1.2 * u }, body, -(h - 2) / 2));

  const cabSteps = profile([
    ['m', -0.265, 99], ['l', -0.255, 103],
    ['l', -0.185, 141],
    ['q', -0.170, 144.8, -0.140, 145],
    ['l', 0.105, 145],
    ['q', 0.128, 144.6, 0.138, 140.5],
    ['l', 0.195, 98],
    ['l', 0.185, 98],
  ], t, u);
  g.add(extrudeMesh(shapeFrom(cabSteps), { depth: h - 16 * u, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .8 * u, bevelThickness: .8 * u }, _glass, -(h - 16 * u) / 2));

  const roofSteps = profile([
    ['m', -0.175, 143.5], ['l', -0.158, 148.8],
    ['l', 0.118, 148.8], ['l', 0.132, 143.5],
  ], t, u);
  g.add(extrudeMesh(shapeFrom(roofSteps), { depth: h - 8 * u, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 1.1 * u, bevelThickness: 1.1 * u }, body, -(h - 8 * u) / 2));

  g.add(box(t * .045, 13 * u, h - 9 * u, bump, t * .4935, 24 * u, 0));
  g.add(box(t * .040, 13 * u, h - 9 * u, bump, -t * .4905, 24 * u, 0));
  g.add(box(t * .62, 5 * u, (h - 2) + 1.2 * u, _trim, 0, 18.5 * u, 0));
  g.add(box(2 * u, 11 * u, h * .42, _trim, t * .5 + .4 * u, 52 * u, 0));
  g.add(box(2.2 * u, 8.5 * u, h * .19, _head, t * .5 + .3 * u, 66 * u, h * .30));
  g.add(box(2.2 * u, 8.5 * u, h * .19, _head, t * .5 + .3 * u, 66 * u, -h * .30));
  g.add(box(2.2 * u, 9 * u, h * .20, _tail, -t * .487 - .3 * u, 50 * u, h * .30));
  g.add(box(2.2 * u, 9 * u, h * .20, _tail, -t * .487 - .3 * u, 50 * u, -h * .30));
  g.add(box(1.2 * u, 11 * u, h * .24, _plate, -t * .5 - .9 * u, 38 * u, 0));
  for (const s of [1, -1]) {
    const mg = new THREE.Group();
    mg.position.set(t * .175, 103 * u, s * (halfD + 5 * u));
    mg.add(box(4 * u, 2.5 * u, 6 * u, body));
    mg.add(box(5 * u, 10 * u, 13 * u, body, 0, 5 * u, s * 7 * u));
    g.add(mg);
  }
  for (const s of [1, -1]) {
    g.add(box(.5 * u, 27 * u, .5 * u, _trim, t * .055, 74 * u, s * (halfD + .35 * u)));
    g.add(box(7 * u, 2.4 * u, 1.3 * u, _chrome, t * .135, 88 * u, s * (halfD + .8 * u)));
    g.add(box(7 * u, 2.4 * u, 1.3 * u, _chrome, -t * .075, 88 * u, s * (halfD + .8 * u)));
  }
  const wz = h / 2 - 17 * u * .3;
  for (const [px, pz] of [[t * .31, wz], [t * .31, -wz], [-t * .31, wz], [-t * .31, -wz]])
    g.add(wheel(28, 17, u, px, pz));
  return g;
}

// ---------------- SUV ----------------
export function buildSUV(t, h, u, color) {
  const g = new THREE.Group();
  const body = matBody(color);
  const bump = new THREE.MeshPhysicalMaterial({ color: shade(color, .8), metalness: .15, roughness: .4, clearcoat: .4 });
  const halfD = (h - 2) / 2;
  const bodySteps = profile([
    ['m', -0.500, 19], ['l', -0.500, 42],
    ['q', -0.500, 66, -0.470, 78],
    ['l', -0.410, 92],
    ['q', -0.380, 100, -0.330, 103],
    ['l', 0.150, 103.5],
    ['q', 0.210, 103, 0.260, 100.5],
    ['l', 0.450, 97],
    ['q', 0.492, 95.5, 0.500, 88],
    ['l', 0.500, 42], ['l', 0.490, 19],
  ], t, u);
  g.add(extrudeMesh(shapeFrom(bodySteps), { depth: h - 2, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 1.2 * u, bevelThickness: 1.2 * u }, body, -(h - 2) / 2));
  const cabSteps = profile([
    ['m', -0.335, 101], ['l', -0.325, 105],
    ['l', -0.310, 160],
    ['q', -0.305, 165.5, -0.275, 166],
    ['l', 0.010, 166],
    ['q', 0.045, 165.5, 0.060, 160],
    ['l', 0.155, 100.5], ['l', 0.145, 101],
  ], t, u);
  g.add(extrudeMesh(shapeFrom(cabSteps), { depth: h - 16 * u, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .8 * u, bevelThickness: .8 * u }, _glass, -(h - 16 * u) / 2));
  const roofSteps = profile([
    ['m', -0.310, 163.5], ['l', -0.298, 169],
    ['l', 0.022, 169], ['l', 0.045, 163.5],
  ], t, u);
  g.add(extrudeMesh(shapeFrom(roofSteps), { depth: h - 8 * u, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 1.1 * u, bevelThickness: 1.1 * u }, body, -(h - 8 * u) / 2));
  g.add(box(t * .04, 13 * u, h - 9 * u, bump, t * .4925, 27 * u, 0));
  g.add(box(t * .04, 13 * u, h - 9 * u, bump, -t * .4925, 27 * u, 0));
  g.add(box(t * .60, 5.5 * u, (h - 2) + 1.2 * u, _trim, 0, 21.5 * u, 0));
  g.add(box(2 * u, 11 * u, h * .40, _trim, t * .5 + .4 * u, 58 * u, 0));
  g.add(box(2.2 * u, 9 * u, h * .18, _head, t * .5 + .3 * u, 72 * u, h * .29));
  g.add(box(2.2 * u, 9 * u, h * .18, _head, t * .5 + .3 * u, 72 * u, -h * .29));
  g.add(box(2.2 * u, 10 * u, h * .18, _tail, -t * .487 - .3 * u, 62 * u, h * .29));
  g.add(box(2.2 * u, 10 * u, h * .18, _tail, -t * .487 - .3 * u, 62 * u, -h * .29));
  g.add(box(1.2 * u, 11 * u, h * .24, _plate, -t * .5 - .9 * u, 42 * u, 0));
  for (const s of [1, -1]) {
    const mg = new THREE.Group();
    mg.position.set(t * .145, 106 * u, s * (halfD + 5 * u));
    mg.add(box(4 * u, 2.5 * u, 6 * u, body));
    mg.add(box(5 * u, 10 * u, 13 * u, body, 0, 5 * u, s * 7 * u));
    g.add(mg);
    g.add(box(.5 * u, 30 * u, .5 * u, _trim, t * .05, 78 * u, s * (halfD + .35 * u)));
    g.add(box(7 * u, 2.4 * u, 1.3 * u, _chrome, t * .125, 95 * u, s * (halfD + .8 * u)));
    g.add(box(7 * u, 2.4 * u, 1.3 * u, _chrome, -t * .10, 95 * u, s * (halfD + .8 * u)));
  }
  const wz = h / 2 - 17.5 * u * .3;
  for (const [px, pz] of [[t * .31, wz], [t * .31, -wz], [-t * .31, wz], [-t * .31, -wz]])
    g.add(wheel(30, 17.5, u, px, pz));
  return g;
}

// ---------------- OTOBÜS / MİNİBÜS ----------------
export function buildBus(t, h, u, color) {
  const g = new THREE.Group();
  const body = matBody(color);
  const bodySteps = profile([
    ['m', -0.500, 25], ['l', -0.500, 272],
    ['q', -0.495, 286, -0.470, 292],
    ['l', -0.420, 300],
    ['l', 0.300, 300],
    ['q', 0.390, 299, 0.430, 288],
    ['q', 0.470, 262, 0.478, 230],
    ['q', 0.490, 205, 0.495, 180],
    ['l', 0.500, 25],
  ], t, u);
  g.add(extrudeMesh(shapeFrom(bodySteps), { depth: h - 2, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: 1.4 * u, bevelThickness: 1.4 * u }, body, -(h - 2) / 2));
  const bandSteps = profile([
    ['m', -0.430, 138], ['l', -0.415, 232],
    ['l', 0.310, 232],
    ['q', 0.355, 230, 0.375, 205],
    ['l', 0.385, 140],
  ], t, u);
  g.add(extrudeMesh(shapeFrom(bandSteps), { depth: h + 1.4 * u, bevelEnabled: false }, _glass, -(h + 1.4 * u) / 2));
  const ws = box(3 * u, 62 * u, h - 10 * u, _glass, t * .474 + .6 * u, 202 * u, 0);
  ws.rotation.z = -0.08;
  g.add(ws);
  g.add(box(2.2 * u, 9 * u, h * .18, _head, t * .5 + .3 * u, 96 * u, h * .30));
  g.add(box(2.2 * u, 9 * u, h * .18, _head, t * .5 + .3 * u, 96 * u, -h * .30));
  g.add(box(2.2 * u, 12 * u, h * .16, _tail, -t * .5 - .3 * u, 92 * u, h * .30));
  g.add(box(2.2 * u, 12 * u, h * .16, _tail, -t * .5 - .3 * u, 92 * u, -h * .30));
  g.add(box(1.2 * u, 11 * u, h * .24, _plate, -t * .5 - .9 * u, 70 * u, 0));
  const wz = h / 2 - 22 * u * .3;
  for (const [px, pz] of [[t * .31, wz], [t * .31, -wz], [-t * .31, wz], [-t * .31, -wz]])
    g.add(wheel(42, 22, u, px, pz));
  return g;
}

// ---------------- KAMYON ----------------
export function buildTruck(t, h, u, color) {
  const g = new THREE.Group();
  const body = matBody(color);
  const cargoSteps = [
    ['m', -0.500 * t, 55 * u], ['l', 0.260 * t, 55 * u],
    ['l', 0.260 * t, 252 * u], ['l', -0.500 * t, 252 * u],
  ];
  g.add(extrudeMesh(shapeFrom(cargoSteps), { depth: h - 8 * u, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 1.5 * u, bevelThickness: 1.5 * u }, body, -(h - 8 * u) / 2));
  g.add(box(t * .92, 12 * u, h * .42, _trim, 0, 44 * u, 0));
  const cabSteps = [
    ['m', 0.270 * t, 46 * u], ['l', 0.270 * t, 148 * u],
    ['l', 0.300 * t, 152 * u], ['l', 0.330 * t, 206 * u],
    ['q', 0.345 * t, 211 * u, 0.380 * t, 211.5 * u],
    ['l', 0.430 * t, 211 * u],
    ['q', 0.470 * t, 208 * u, 0.483 * t, 192 * u],
    ['l', 0.495 * t, 150 * u], ['l', 0.500 * t, 146 * u],
    ['l', 0.500 * t, 46 * u],
  ];
  g.add(extrudeMesh(shapeFrom(cabSteps), { depth: h - 4 * u, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 1.2 * u, bevelThickness: 1.2 * u }, body, -(h - 4 * u) / 2));
  const cabGlassSteps = [
    ['m', 0.315 * t, 150 * u], ['l', 0.335 * t, 204 * u],
    ['q', 0.350 * t, 208 * u, 0.375 * t, 208.5 * u],
    ['l', 0.420 * t, 208 * u],
    ['q', 0.452 * t, 205.5 * u, 0.462 * t, 192 * u],
    ['l', 0.472 * t, 150 * u],
  ];
  g.add(extrudeMesh(shapeFrom(cabGlassSteps), { depth: h - 12 * u, bevelEnabled: false }, _glass, -(h - 12 * u) / 2));
  const cabRoofSteps = [
    ['m', 0.335 * t, 206 * u], ['l', 0.350 * t, 210.5 * u],
    ['l', 0.425 * t, 210.5 * u], ['l', 0.440 * t, 206 * u],
  ];
  g.add(extrudeMesh(shapeFrom(cabRoofSteps), { depth: h - 6 * u, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 1 * u, bevelThickness: 1 * u }, body, -(h - 6 * u) / 2));
  g.add(box(t * .03, 16 * u, h - 6 * u, _trim, t * .4965, 34 * u, 0));
  g.add(box(t * .03, 16 * u, h - 6 * u, _trim, -t * .4965, 40 * u, 0));
  g.add(box(2 * u, 10 * u, h * .16, _head, t * .5 + .3 * u, 100 * u, h * .30));
  g.add(box(2 * u, 10 * u, h * .16, _head, t * .5 + .3 * u, 100 * u, -h * .30));
  g.add(box(2.2 * u, 12 * u, h * .16, _tail, -t * .5 - .3 * u, 120 * u, h * .30));
  g.add(box(2.2 * u, 12 * u, h * .16, _tail, -t * .5 - .3 * u, 120 * u, -h * .30));
  g.add(box(1.2 * u, 11 * u, h * .24, _plate, -t * .5 - .9 * u, 95 * u, 0));
  for (const s of [1, -1]) {
    const mg = new THREE.Group();
    mg.position.set(t * .44, 178 * u, s * (h / 2 + 4 * u));
    mg.add(box(4 * u, 3 * u, 6 * u, _trim));
    mg.add(box(4.5 * u, 22 * u, 12 * u, body, 0, 11 * u, s * 8 * u));
    g.add(mg);
  }
  const wz = h / 2 - 22 * u * .3;
  for (const [px, pz] of [[t * .34, wz], [t * .34, -wz], [-t * .26, wz], [-t * .26, -wz], [-t * .44, wz], [-t * .44, -wz]])
    g.add(wheel(36, 22, u, px, pz));
  return g;
}
