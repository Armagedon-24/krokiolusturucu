/* ============================================================
 * Arac3D v2 — "Kroki Oluşturucu" 3D araç sistemi
 * ------------------------------------------------------------
 * Her araç sınıfı AYRI ve TANINIR tasarıma sahiptir:
 *   sedan ailesi (sedan/hatchback/coupe/cabrio/limuzin/klasik/
 *   yanmış/hasarlı/taksi/polis), jandarma, SUV/minivan, pickup,
 *   panelvan/karavan/ambulans/belediye, minibüs, otobüs, tramvay,
 *   lokomotif, kamyon, damperli, çekici, vinç, beton mikseri,
 *   itfaiye, tır/dorse, TOMA, zırhlı, traktör, forklift,
 *   ekskavatör, dozer, ATV, golf aracı, motosiklet ailesi
 *
 * Fabrika: makeMr({ e, O, s, qe, rs })
 *   e = jsx runtime, O = React, s = cm->sahne ölçeği (0.55),
 *   qe = THREE.Shape, rs = THREE.ExtrudeGeometry
 * ============================================================ */
export function makeMr({ e, O, s, qe, rs }) {
  // j(): material prop'u React element ise children'a taşınır (r3f gereği)
  const j = (t, p, k) => {
    if (p && p.material && p.material.$$typeof) {
      const { material, ...rest } = p;
      const ch = rest.children;
      rest.children = ch === undefined ? material : (Array.isArray(ch) ? [...ch, material] : [ch, material]);
      return e.jsx(t, rest, k);
    }
    return e.jsx(t, p, k);
  };
  const js = (t, p, k) => e.jsxs(t, p, k);
  const Fr = e.Fragment;

  /* ---------- renk yardımcıları ---------- */
  function lum(hex) {
    const n = parseInt(hex.slice(1), 16);
    return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round((n >> 16 & 255) * f));
    const g = Math.min(255, Math.round((n >> 8 & 255) * f));
    const b = Math.min(255, Math.round((n & 255) * f));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  /* ---------- geometri / ağ yardımcıları ---------- */
  // adımlar: ['m',xFrac,yCm] | ['l',xFrac,yCm] | ['q',cxFrac,cyCm,xFrac,yCm]
  function shapeFrom(steps, t, u) {
    const sh = new qe();
    for (const st of steps) {
      if (st[0] === 'm') sh.moveTo(st[1] * t, st[2] * u);
      else if (st[0] === 'l') sh.lineTo(st[1] * t, st[2] * u);
      else sh.quadraticCurveTo(st[1] * t, st[2] * u, st[3] * t, st[4] * u);
    }
    sh.closePath();
    return sh;
  }
  // X = ekstrüde gövde (yan profil), mat = material element, bev = bevel cm
  const X = (steps, t, u, depth, mat, bev) =>
    j('mesh', {
      position: [0, 0, -depth / 2],
      castShadow: true, receiveShadow: true,
      geometry: new rs(shapeFrom(steps, t, u), {
        depth, bevelEnabled: !!bev, bevelSegments: 3, steps: 1,
        bevelSize: (bev || 0) * u, bevelThickness: (bev || 0) * u,
      }),
      material: mat,
    });
  // B = kutu; pos = [x, yCm, z]; hCm = yükseklik cm
  const B = (w, hCm, d, mat, pos, u, opt) => {
    const o = opt || {};
    return j('mesh', {
      position: [pos[0], pos[1] * u, pos[2]],
      rotation: o.rot || [0, 0, 0],
      castShadow: o.noShadow ? false : true,
      receiveShadow: true,
      children: j('boxGeometry', { args: [w, hCm * u, d] }),
      material: mat,
    });
  };
  const Cy = (rCm, h, mat, pos, u, rot) =>
    j('mesh', {
      position: [pos[0], pos[1] * u, pos[2]],
      rotation: rot || [0, 0, 0],
      castShadow: true,
      children: j('cylinderGeometry', { args: [rCm * u, rCm * u, h, 24] }),
      material: mat,
    });

  /* ---------- malzemeler ---------- */
  const mBody = (c) => j('meshPhysicalMaterial', { color: c, metalness: 0.22, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.16, envMapIntensity: 1.1 });
  const mGlass = () => j('meshPhysicalMaterial', { color: '#1d3040', metalness: 0.15, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 2.2 });
  const mTrim = () => j('meshStandardMaterial', { color: '#1a1d21', roughness: 0.5, metalness: 0.35 });
  const mDark = () => j('meshStandardMaterial', { color: '#101113', roughness: 0.85 });
  const mSilver = () => j('meshStandardMaterial', { color: '#c6ccd2', metalness: 0.85, roughness: 0.28 });
  const mChrome = () => j('meshStandardMaterial', { color: '#dfe3e7', metalness: 0.95, roughness: 0.14 });
  const mWhite = () => j('meshStandardMaterial', { color: '#eef0f2', roughness: 0.45, metalness: 0.08 });
  const mRed = () => j('meshStandardMaterial', { color: '#c1121a', roughness: 0.42, metalness: 0.12 });
  const mBlue = () => j('meshStandardMaterial', { color: '#0b3d91', roughness: 0.42, metalness: 0.12 });
  const mOrange = () => j('meshStandardMaterial', { color: '#e87511', roughness: 0.45, metalness: 0.1 });
  const mHead = () => j('meshBasicMaterial', { color: '#00ff00' }); // TEST
  const mTail = () => j('meshBasicMaterial', { color: '#ff00ff' }); // TEST
  const mPlate = () => j('meshStandardMaterial', { color: '#eceef2', roughness: 0.5 });
  const mLedR = () => j('meshBasicMaterial', { color: '#ff2222' });
  const mLedB = () => j('meshBasicMaterial', { color: '#2a5cff' });
  const mLedA = () => j('meshBasicMaterial', { color: '#ffb300' });

  /* ---------- tekerlek ---------- */
  function Wheel({ R, W, px, pz }) {
    const spokes = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      spokes.push(j('mesh', {
        key: 'sp' + i,
        position: [Math.cos(a) * R * s * 0.32, Math.sin(a) * R * s * 0.32, 0],
        rotation: [0, 0, a],
        material: mSilver(),
        children: j('boxGeometry', { args: [R * s * 0.5, R * s * 0.09, W * s * 0.36] }),
      }));
    }
    return js('group', {
      position: [px, R * s, pz],
      rotation: [Math.PI / 2, 0, 0],
      children: [
        j('mesh', { castShadow: true, material: mDark(), children: j('cylinderGeometry', { args: [R * s, R * s, W * s, 28] }) }),
        j('mesh', { material: mSilver(), children: j('cylinderGeometry', { args: [R * s * 0.6, R * s * 0.6, W * s * 1.06, 24] }) }),
        j('mesh', { material: mTrim(), children: j('cylinderGeometry', { args: [R * s * 0.14, R * s * 0.14, W * s * 1.14, 12] }) }),
        ...spokes,
      ],
    });
  }

  /* ---------- tepe lambası ---------- */
  function Lightbar({ n, y, u, ly, half, lx = 0 }) {
    const L = n * (half ? 0.07 : 0.09);
    return js('group', {
      position: [lx * n, ly * u, 0],
      children: [
        j('mesh', { castShadow: true, material: mTrim(), children: j('boxGeometry', { args: [L, 4 * u, y * 0.52] }) }),
        j('mesh', { material: mLedB(), position: [0, 3.4 * u, y * 0.14], children: j('boxGeometry', { args: [L * 0.82, 3.4 * u, y * 0.17] }) }),
        j('mesh', { material: mLedR(), position: [0, 3.4 * u, -y * 0.14], children: j('boxGeometry', { args: [L * 0.82, 3.4 * u, y * 0.17] }) }),
      ],
    });
  }
  function Beacon({ n, u, lx, ly }) {
    return js('group', {
      position: [lx * n, ly * u, 0],
      children: [
        j('mesh', { material: mTrim(), children: j('cylinderGeometry', { args: [3 * u, 3 * u, 2.4 * u, 12] }) }),
        j('mesh', { material: mLedA(), position: [0, 2.6 * u, 0], children: j('cylinderGeometry', { args: [2.6 * u, 2.8 * u, 3 * u, 12] }) }),
      ],
    });
  }

  /* ---------- far/stop/plaka ---------- */
  function Face({ n, y, u, hy, ty, py, plate = true }) {
    return js(Fr, {
      children: [
        j('mesh', { material: mHead(), position: [n / 2 + 3.2 * u, hy * u, y * 0.28], children: j('boxGeometry', { args: [5 * u, 12 * u, y * 0.24] }) }),
        j('mesh', { material: mHead(), position: [n / 2 + 3.2 * u, hy * u, -y * 0.28], children: j('boxGeometry', { args: [5 * u, 12 * u, y * 0.24] }) }),
        j('mesh', { material: mTail(), position: [-n / 2 - 3.2 * u, ty * u, y * 0.28], children: j('boxGeometry', { args: [5 * u, 11 * u, y * 0.22] }) }),
        j('mesh', { material: mTail(), position: [-n / 2 - 3.2 * u, ty * u, -y * 0.28], children: j('boxGeometry', { args: [5 * u, 11 * u, y * 0.22] }) }),
        plate ? j('mesh', { material: mPlate(), position: [-n / 2 - 2.6 * u, py * u, 0], children: j('boxGeometry', { args: [2.4 * u, 12 * u, y * 0.24] }) }) : null,
      ],
    });
  }
  function FaceTruck({ n, y, u, hy, ty, py, back }) {
    return js(Fr, {
      children: [
        j('mesh', { material: mHead(), position: [n / 2 + 3.4 * u, hy * u, y * 0.28], children: j('boxGeometry', { args: [5 * u, 15 * u, y * 0.22] }) }),
        j('mesh', { material: mHead(), position: [n / 2 + 3.4 * u, hy * u, -y * 0.28], children: j('boxGeometry', { args: [5 * u, 15 * u, y * 0.22] }) }),
        j('mesh', { material: mTail(), position: [-n / 2 - 3.4 * u, ty * u, y * 0.28], children: j('boxGeometry', { args: [5 * u, 14 * u, y * 0.22] }) }),
        j('mesh', { material: mTail(), position: [-n / 2 - 3.4 * u, ty * u, -y * 0.28], children: j('boxGeometry', { args: [5 * u, 14 * u, y * 0.22] }) }),
        back ? j('mesh', { material: mPlate(), position: [-n / 2 - 3 * u, py * u, 0], children: j('boxGeometry', { args: [2.6 * u, 16 * u, y * 0.26] }) }) : null,
      ],
    });
  }

  /* ---------- aynalar ---------- */
  function Mirrors({ n, y, u, lx, ly, stick }) {
    return js(Fr, {
      children: [1, -1].map((sg) => js('group', {
        key: 'mir' + sg,
        position: [lx * n, ly * u, sg * (y / 2 + 1.2 * u)],
        children: [
          stick
            ? j('mesh', { material: mTrim(), position: [0, 7 * u, sg * 3.2 * u], children: j('boxGeometry', { args: [1.5 * u, 15 * u, 1.4 * u] }) })
            : j('mesh', { material: mTrim(), children: j('boxGeometry', { args: [3 * u, 2.4 * u, 4.5 * u] }) }),
          j('mesh', { castShadow: true, material: mTrim(), position: [0, stick ? 16 * u : 4.6 * u, sg * 5 * u], children: j('boxGeometry', { args: [5.5 * u, 11 * u, 2.2 * u] }) }),
        ],
      })),
    });
  }

  /* ---------- yan şerit (livery bandı) ---------- */
  function SideBand({ n, y, u, mat, yCm, hCm, lenF = 0.92, xf = 0 }) {
    return js(Fr, {
      children: [1, -1].map((sg) => j('mesh', {
        key: 'band' + sg,
        material: mat,
        position: [xf * n, yCm * u, sg * (y / 2 + 0.35 * u)],
        children: j('boxGeometry', { args: [n * lenF, hCm * u, 0.9 * u] }),
      })),
    });
  }

  /* ================================================================
   * SEDAN SİLÜETİ
   * ================================================================ */
  const sedanProf = (o) => {
    const roofF = o.roof, belt = 99;
    return {
      body: [
        ['m', -0.5, 17], ['l', -0.5, 44],
        ['q', -0.5, 62, -0.478, 70],
        ['q', -0.452, 90, -0.372, 97.5],
        ['q', -0.338, belt + 1.5, -0.29, belt + 2.5],
        ['l', 0.14, belt + 2],
        ['q', 0.222, belt + 1, 0.268, belt - 2],
        ['l', 0.448, 94],
        ['q', 0.49, 92.5, 0.5, 84],
        ['l', 0.5, 44], ['l', 0.49, 17],
      ],
      cabin: [
        ['m', o.rX, belt + 1], ['l', o.rTx - 0.012, roofF - 3.5],
        ['q', o.rTx, roofF, o.rTx + 0.035, roofF],
        ['l', o.fTx, roofF],
        ['q', o.fTx + 0.025, roofF - 0.3, o.fTx + 0.042, roofF - 4.5],
        ['l', o.fTx + 0.085, belt + 1],
      ],
      roof: [
        ['m', o.rTx - 0.005, roofF - 1.5], ['l', o.rTx + 0.012, roofF + 3.6],
        ['l', o.fTx + 0.028, roofF + 3.6], ['l', o.fTx + 0.052, roofF - 1.5],
      ],
    };
  };

  /* ================================================================
   * SINIF TASARIMLARI — { kids, top, wheels?, wheelPos?, wheelRF?, wheelRB? }
   * ================================================================ */
  const D = {};

  /* ---- SEDAN ailesi ---- */
  D.car = (c, o) => {
    const { n, y, u, col } = c;
    const op = o || {};
    const prof = sedanProf({
      roof: op.roof || 147,
      rX: op.rX !== undefined ? op.rX : -0.235,
      rTx: op.rTx !== undefined ? op.rTx : -0.165,
      fTx: op.fTx !== undefined ? op.fTx : 0.095,
    });
    const bodyD = y - 3 * u, cabD = y - 24 * u, roofD = y - 6 * u;
    const half = (y - 3 * u) / 2 + 0.2 * u;
    const kids = [
      X(prof.body, n, u, bodyD, mBody(col), 1.2),
      X(prof.cabin, n, u, cabD, mGlass(), 0.8),
      X(prof.roof, n, u, roofD, mBody(col), 1),
      B(n * 0.05, 15, y - 7 * u, op.chromeBump ? mChrome() : mTrim(), [n * 0.491, 24, 0], u),
      B(n * 0.046, 15, y - 7 * u, op.chromeBump ? mChrome() : mTrim(), [-n * 0.489, 24, 0], u),
      B(n * 0.6, 5, y - 2.6 * u, mTrim(), [0, 19, 0], u),
      B(2 * u, 11, y * 0.44, mTrim(), [n / 2 + 1.1 * u, 56, 0], u),
      Face({ n, y, u, hy: 68, ty: 56, py: 40 }),
      Mirrors({ n, y, u, lx: 0.175, ly: 104 }),
      ...[1, -1].map((sg) => js(Fr, {
        key: 'door' + sg,
        children: [
          B(0.6 * u, 26, 0.6 * u, mTrim(), [n * 0.045, 76, sg * half], u),
          B(8 * u, 2.6, 1.4 * u, mChrome(), [n * 0.115, 90, sg * (half + 0.7 * u)], u),
          B(8 * u, 2.6, 1.4 * u, mChrome(), [-n * 0.095, 90, sg * (half + 0.7 * u)], u),
        ],
      })),
      Cy(2.2, 4, mChrome(), [-n * 0.487, 22, y * 0.28], u, [Math.PI / 2, 0, 0]),
    ];
    return { kids, top: (op.roof || 147) + 5, wheels: true };
  };

  /* ---- TAKSİ ---- */
  D.taxi = (c) => {
    const r = D.car(c, { roof: 147 });
    const { n, y, u } = c;
    r.kids.push(
      B(n * 0.11, 5, y * 0.34, mWhite(), [n * 0.02, 150, 0], u),
      B(n * 0.09, 7, y * 0.3, mLedA(), [n * 0.02, 161, 0], u),
      SideBand({ n, y, u, mat: mTrim(), yCm: 52, hCm: 7, lenF: 0.8 }),
    );
    r.top = 172;
    return r;
  };

  /* ---- POLİS (sedan) ---- */
  D.police = (c) => {
    const r = D.car(c, { roof: 147 });
    const { n, y, u } = c;
    r.kids.push(
      SideBand({ n, y, u, mat: mBlue(), yCm: 66, hCm: 16, lenF: 0.86 }),
      B(n * 0.16, 1.2, y * 0.6, mBlue(), [n * 0.33, 96.5, 0], u),
      B(n * 0.1, 1.2, y * 0.6, mBlue(), [-n * 0.36, 100, 0], u),
      Lightbar({ n, y, u, ly: 155 }),
      B(n * 0.03, 18, y * 0.7, mTrim(), [n * 0.507, 34, 0], u),
      B(n * 0.026, 4, y * 0.72, mSilver(), [n * 0.509, 44, 0], u),
    );
    r.top = 172;
    return r;
  };

  /* ---- SUV / MİNİVAN ---- */
  D.suv = (c, o) => {
    const { n, y, u, col } = c;
    const op = o || {};
    const belt = 108, roof = op.van ? 176 : 172;
    const body = [
      ['m', -0.5, 20], ['l', -0.5, 46],
      ['q', -0.5, 68, -0.468, 80],
      ['l', -0.408, 96],
      ['q', -0.375, belt, -0.325, belt + 3],
      ['l', 0.15, belt + 3.5],
      ['q', 0.212, belt + 3, 0.262, belt],
      ['l', 0.452, 100],
      ['q', 0.492, 98, 0.5, 90],
      ['l', 0.5, 46], ['l', 0.49, 20],
    ];
    const cabin = [
      ['m', op.van ? -0.36 : -0.335, belt + 2], ['l', op.van ? -0.345 : -0.325, belt + 6],
      ['l', op.van ? -0.33 : -0.312, roof - 6],
      ['q', op.van ? -0.322 : -0.306, roof - 0.5, op.van ? -0.292 : -0.276, roof],
      ['l', op.van ? -0.02 : 0.012, roof],
      ['q', 0.045, roof - 0.5, 0.06, roof - 6],
      ['l', 0.158, belt + 2],
    ];
    const roofP = [
      ['m', op.van ? -0.325 : -0.312, roof - 2.5], ['l', op.van ? -0.312 : -0.299, roof + 3],
      ['l', 0.028, roof + 3], ['l', 0.048, roof - 2.5],
    ];
    const bodyD = y - 3 * u, cabD = y - 24 * u, roofD = y - 6 * u;
    const half = (y - 3 * u) / 2 + 0.2 * u;
    const kids = [
      X(body, n, u, bodyD, mBody(col), 1.2),
      X(cabin, n, u, cabD, mGlass(), 0.8),
      X(roofP, n, u, roofD, mBody(col), 1.2),
      B(n * 0.5, 2.6, 2.2 * u, mTrim(), [-n * 0.13, roof + 6, y * 0.32], u),
      B(n * 0.5, 2.6, 2.2 * u, mTrim(), [-n * 0.13, roof + 6, -y * 0.32], u),
      B(n * 0.046, 14, y - 7 * u, mTrim(), [n * 0.492, 27, 0], u),
      B(n * 0.042, 14, y - 7 * u, mTrim(), [-n * 0.49, 27, 0], u),
      B(n * 0.62, 5, y - 2.6 * u, mTrim(), [0, 22, 0], u),
      B(2 * u, 11, y * 0.44, mTrim(), [n / 2 + 1.1 * u, 62, 0], u),
      Face({ n, y, u, hy: 76, ty: 60, py: 44 }),
      Mirrors({ n, y, u, lx: 0.145, ly: belt + 4 }),
      ...[1, -1].map((sg) => js(Fr, {
        key: 'door' + sg,
        children: [
          B(0.6 * u, 30, 0.6 * u, mTrim(), [n * 0.05, 84, sg * half], u),
          B(7 * u, 2.4, 1.4 * u, mChrome(), [n * 0.13, 98, sg * (half + 0.7 * u)], u),
          B(7 * u, 2.4, 1.4 * u, mChrome(), [-n * 0.08, 98, sg * (half + 0.7 * u)], u),
        ],
      })),
      Cy(2.4, 4, mChrome(), [-n * 0.487, 26, y * 0.28], u, [Math.PI / 2, 0, 0]),
    ];
    return { kids, top: roof + 9, wheels: true };
  };

  /* ---- JANDARMA (SUV) ---- */
  D.gendSuv = (c) => {
    const r = D.suv(c);
    const { n, y, u } = c;
    r.kids.push(
      SideBand({ n, y, u, mat: mBlue(), yCm: 74, hCm: 18, lenF: 0.82 }),
      Lightbar({ n, y, u, ly: 179 }),
      B(n * 0.03, 20, y * 0.7, mTrim(), [n * 0.507, 36, 0], u),
    );
    r.top = 196;
    return r;
  };

  /* ---- PICKUP ---- */
  D.pickup = (c) => {
    const { n, y, u, col } = c;
    const belt = 104;
    const cab = [
      ['m', 0.02, 30], ['l', 0.02, belt],
      ['q', 0.1, belt + 2, 0.13, belt + 3],
      ['l', 0.14, belt + 62],
      ['q', 0.15, belt + 66, 0.19, belt + 66],
      ['l', 0.33, belt + 66],
      ['q', 0.36, belt + 65, 0.37, belt + 60],
      ['l', 0.4, belt + 3],
      ['l', 0.44, belt],
      ['q', 0.47, belt - 4, 0.475, belt - 20],
      ['l', 0.48, 34], ['l', 0.475, 30],
    ];
    const bedCx = -0.23 * n;
    const kids = [
      X(cab, n, u, y - 6 * u, mBody(col), 1.2),
      X([
        ['m', 0.145, belt + 4], ['l', 0.155, belt + 60],
        ['q', 0.16, belt + 63, 0.19, belt + 63],
        ['l', 0.325, belt + 63],
        ['q', 0.35, belt + 62, 0.355, belt + 58],
        ['l', 0.383, belt + 4],
      ], n, u, y - 16 * u, mGlass()),
      X([
        ['m', 0.155, belt + 60], ['l', 0.165, belt + 69],
        ['l', 0.33, belt + 69], ['l', 0.352, belt + 60],
      ], n, u, y - 9 * u, mBody(col), 1),
      B(n * 0.46, 4, y - 12 * u, mDark(), [bedCx, 78, 0], u),
      B(n * 0.48, 44, 3.5 * u, mBody(col), [bedCx, 100, (y - 12 * u) / 2], u),
      B(n * 0.48, 44, 3.5 * u, mBody(col), [bedCx, 100, -(y - 12 * u) / 2], u),
      B(3.5 * u, 44, y - 12 * u, mBody(col), [0, 100, 0], u),
      B(3.5 * u, 44, y - 12 * u, mBody(col), [-0.46 * n + 1.8 * u, 100, 0], u),
      B(n * 0.94, 9, y * 0.44, mTrim(), [0, 26, 0], u),
      B(n * 0.05, 16, y - 4 * u, mSilver(), [n * 0.492, 30, 0], u),
      B(n * 0.05, 16, y - 4 * u, mSilver(), [-n * 0.492, 32, 0], u),
      B(2.4 * u, 12, y * 0.5, mTrim(), [n / 2 + 1.6 * u, 66, 0], u),
      Face({ n, y, u, hy: 80, ty: 62, py: 44, plate: false }),
      j('mesh', { material: mPlate(), position: [-n / 2 - 2.4 * u, 46 * u, 0], children: j('boxGeometry', { args: [1.6 * u, 12 * u, y * 0.24] }) }),
      Mirrors({ n, y, u, lx: 0.4, ly: belt + 8, stick: true }),
    ];
    return { kids, top: belt + 74, wheels: true };
  };

  /* ---- PANELVAN / KARAVAN / BELEDİYE / AMBULANS tabanı ---- */
  D.van = (c, o) => {
    const { n, y, u, col } = c;
    const op = o || {};
    const belt = 112, roof = op.amb ? 258 : op.high ? 245 : 232;
    const body = [
      ['m', -0.5, 22], ['l', -0.5, 46],
      ['q', -0.5, 64, -0.472, 74],
      ['q', -0.4, 100, -0.32, belt + 2],
      ['l', -0.3, belt + 4],
      ['l', 0.46, belt + 5],
      ['q', 0.493, belt + 4, 0.5, belt - 12],
      ['l', 0.5, 46], ['l', 0.492, 22],
    ];
    const bodyTop = [
      ['m', -0.3, belt + 4], ['l', -0.288, roof - 5],
      ['q', -0.282, roof, -0.255, roof],
      ['l', 0.44, roof],
      ['q', 0.465, roof - 1, 0.47, roof - 14],
      ['l', 0.472, belt + 5],
      ['l', -0.3, belt + 4],
    ];
    const bodyD = y - 3 * u;
    const kids = [
      X(body, n, u, bodyD, mBody(col), 1.2),
      X(bodyTop, n, u, bodyD - 0.6 * u, mBody(col), 1),
      B(3 * u, 52, y - 16 * u, mGlass(), [n * 0.398, (belt + roof) / 2 - 10, 0], u, { rot: [0, 0, -0.1] }),
      B(n * 0.16, 40, y + 0.5 * u, mGlass(), [n * 0.21, belt + 42, 0], u),
      ...(op.amb || op.caravan || op.mini ? [] : [B(n * 0.4, 34, y + 0.5 * u, mGlass(), [-n * 0.12, belt + 38, 0], u)]),
      B(n * 0.045, 15, y - 5 * u, mTrim(), [n * 0.493, 33, 0], u),
      B(n * 0.045, 15, y - 5 * u, mTrim(), [-n * 0.493, 36, 0], u),
      B(2.4 * u, 12, y * 0.46, mTrim(), [n / 2 + 1.5 * u, 70, 0], u),
      ...[1, -1].map((sg) => B(0.7 * u, 62, 0.6 * u, mTrim(), [-n * 0.02, belt - 12, sg * ((y - 3 * u) / 2 + 0.2 * u)], u)),
      Face({ n, y, u, hy: 84, ty: 62, py: 46 }),
      Mirrors({ n, y, u, lx: 0.33, ly: belt + 10, stick: true }),
      B(n * 0.1, 4, y * 0.3, mSilver(), [-n * 0.05, roof + 4, 0], u),
    ];
    return { kids, top: roof + 8, wheels: true };
  };

  /* ---- AMBULANS ---- */
  D.ambulance = (c) => {
    const r = D.van(c, { amb: true });
    const { n, y, u } = c;
    r.kids.push(
      SideBand({ n, y, u, mat: mOrange(), yCm: 128, hCm: 26, lenF: 0.6, xf: -0.19 }),
      B(0.9 * u, 26, y - 2 * u, mOrange(), [-n * 0.5, 128, 0], u),
      // tavan kırmızı haç
      B(n * 0.11, 2, y * 0.07, mRed(), [-n * 0.08, 258, 0], u),
      B(n * 0.055, 2, y * 0.3, mRed(), [-n * 0.08, 258, 0], u),
      Lightbar({ n, y, u, ly: 262, half: true, lx: 0.26 }),
      Beacon({ n, u, lx: -0.42, ly: 260 }),
    );
    r.top = 278;
    return r;
  };

  /* ---- BELEDİYE GÖREV ARACI ---- */
  D.municipal = (c) => {
    const r = D.van(c, { high: true });
    const { n, y, u } = c;
    r.kids.push(
      SideBand({ n, y, u, mat: mWhite(), yCm: 90, hCm: 30, lenF: 0.94 }),
      Beacon({ n, u, lx: 0.02, ly: 252 }),
    );
    r.top = 262;
    return r;
  };

  /* ---- MİNİBÜS ---- */
  D.minibus = (c) => {
    const { n, y, u, col } = c;
    const belt = 130, roof = 278;
    const kids = [
      X([
        ['m', -0.5, 26], ['l', -0.5, 50],
        ['q', -0.5, 96, -0.478, belt - 18],
        ['l', -0.47, belt + 4],
        ['l', -0.455, roof - 6],
        ['q', -0.448, roof, -0.42, roof],
        ['l', 0.43, roof],
        ['q', 0.462, roof - 2, 0.468, roof - 22],
        ['l', 0.472, belt + 4],
        ['q', 0.478, belt - 16, 0.482, belt - 40],
        ['l', 0.49, 52], ['l', 0.485, 26],
      ], n, u, y - 3 * u, mBody(col), 1.4),
      B(n * 0.84, 56, y + 1 * u, mGlass(), [-n * 0.015, belt + 40, 0], u),
      B(3.4 * u, 72, y - 16 * u, mGlass(), [n * 0.445, belt + 36, 0], u, { rot: [0, 0, -0.08] }),
      B(n * 0.05, 18, y - 4 * u, mTrim(), [n * 0.492, 40, 0], u),
      B(n * 0.05, 18, y - 4 * u, mTrim(), [-n * 0.492, 42, 0], u),
      ...[1, -1].map((sg) => js(Fr, { key: 'dd' + sg, children: [
        B(0.7 * u, 74, 0.6 * u, mTrim(), [n * 0.24, belt + 8, sg * ((y - 2 * u) / 2 + 0.2 * u)], u),
        B(0.7 * u, 74, 0.6 * u, mTrim(), [-n * 0.12, belt + 8, sg * ((y - 2 * u) / 2 + 0.2 * u)], u),
      ] })),
      Face({ n, y, u, hy: 96, ty: 70, py: 52 }),
      B(n * 0.7, 2.6, 2.2 * u, mTrim(), [0, roof + 4, y * 0.3], u),
      B(n * 0.7, 2.6, 2.2 * u, mTrim(), [0, roof + 4, -y * 0.3], u),
    ];
    return { kids, top: roof + 8, wheels: true };
  };

  /* ---- OTOBÜS ---- */
  D.bus = (c) => {
    const { n, y, u, col } = c;
    const roof = 318, belt = 138;
    const kids = [
      X([
        ['m', -0.5, 30], ['l', -0.5, 258],
        ['q', -0.494, 288, -0.46, 296],
        ['l', -0.42, 304],
        ['l', 0.3, 304],
        ['q', 0.4, 302, 0.435, 288],
        ['q', 0.472, 262, 0.478, 232],
        ['q', 0.49, 206, 0.495, 180],
        ['l', 0.5, 30],
      ], n, u, y - 3 * u, mBody(col), 1.6),
      B(n * 0.74, 92, y + 1.2 * u, mGlass(), [-n * 0.045, belt + 88, 0], u),
      B(3.6 * u, 88, y - 14 * u, mGlass(), [n * 0.452, belt + 60, 0], u, { rot: [0, 0, -0.08] }),
      B(2.6 * u, 14, y * 0.5, mTrim(), [n * 0.47, roof - 26, 0], u),
      ...[1, -1].map((sg) => js(Fr, { key: 'busd' + sg, children: [
        B(0.8 * u, 92, 0.7 * u, mTrim(), [n * 0.26, belt + 40, sg * ((y - 1.6 * u) / 2 + 0.2 * u)], u),
        B(0.8 * u, 92, 0.7 * u, mTrim(), [-n * 0.3, belt + 40, sg * ((y - 1.6 * u) / 2 + 0.2 * u)], u),
      ] })),
      B(n * 0.045, 20, y - 4 * u, mTrim(), [n * 0.492, 42, 0], u),
      B(n * 0.045, 20, y - 4 * u, mTrim(), [-n * 0.494, 44, 0], u),
      Face({ n, y, u, hy: 104, ty: 76, py: 56 }),
      B(n * 0.12, 10, y * 0.36, mWhite(), [n * 0.1, roof + 7, 0], u),
      B(n * 0.12, 10, y * 0.36, mWhite(), [-n * 0.18, roof + 7, 0], u),
    ];
    return { kids, top: roof + 14, wheels: true };
  };

  /* ---- TRAMVAY ---- */
  D.tram = (c) => {
    const r = D.bus(c);
    const { n, y, u } = c;
    r.kids.push(
      B(2 * u, 12, 2.4 * u, mTrim(), [n * 0.05, 326, 0], u),
      B(2 * u, 3, y * 0.5, mTrim(), [n * 0.05, 338, 0], u),
    );
    r.top = 356;
    return r;
  };

  /* ---- LOKOMOTİF ---- */
  D.train = (c) => {
    const { n, y, u, col } = c;
    const roof = 350;
    const kids = [
      X([
        ['m', -0.5, 40], ['l', -0.5, 300],
        ['l', -0.44, 336], ['q', -0.4, roof, -0.3, roof],
        ['l', 0.4, roof], ['q', 0.48, roof - 6, 0.5, roof - 40],
        ['l', 0.5, 40],
      ], n, u, y - 3 * u, mBody(col), 1.6),
      B(n * 0.7, 70, y + 1 * u, mGlass(), [0, roof - 60, 0], u),
      B(3 * u, 40, y - 18 * u, mGlass(), [n * 0.47, roof - 60, 0], u),
      B(n * 0.3, 26, y * 0.4, mTrim(), [-n * 0.3, roof + 14, 0], u),
      B(n * 0.05, 26, y - 6 * u, mSilver(), [n * 0.495, 60, 0], u),
      B(n * 0.05, 26, y - 6 * u, mSilver(), [-n * 0.495, 60, 0], u),
      ...[1, -1].map((sg) => j('mesh', { key: 'hl' + sg, material: mHead(), position: [n / 2 + 1.4 * u, 90 * u, sg * y * 0.3], children: j('boxGeometry', { args: [1.6 * u, 14 * u, y * 0.2] }) })),
    ];
    return { kids, top: roof + 30, wheels: true };
  };

  /* ---- KAMYON (kapalı kasa) ---- */
  const truckWheelPos = [[0.34, 1], [0.34, -1], [-0.2, 1], [-0.2, -1], [-0.37, 1], [-0.37, -1]];
  D.truck = (c) => {
    const { n, y, u, col } = c;
    const boxR = 265;
    const kids = [
      B(n * 0.96, 10, y * 0.46, mTrim(), [0, 48, 0], u),
      X([
        ['m', 0.3, 46], ['l', 0.302, 186],
        ['l', 0.306, 222], ['q', 0.31, 248, 0.35, 249],
        ['l', 0.42, 248], ['q', 0.458, 244, 0.462, 226],
        ['l', 0.468, 130], ['q', 0.472, 100, 0.49, 96],
        ['l', 0.496, 60], ['l', 0.5, 46],
      ], n, u, y - 4 * u, mBody(col), 1.4),
      X([
        ['m', 0.318, 190], ['l', 0.322, 222], ['q', 0.325, 244, 0.352, 244.5],
        ['l', 0.414, 244], ['q', 0.446, 240, 0.452, 224],
        ['l', 0.458, 190],
      ], n, u, y - 13 * u, mGlass()),
      X([
        ['m', 0.322, 240], ['l', 0.335, 250], ['l', 0.415, 250],
        ['l', 0.448, 242], ['l', 0.444, 236], ['l', 0.335, 236.5],
      ], n, u, y - 7 * u, mBody(col), 1),
      // deflektör (tavan arkası eğim)
      B(n * 0.055, 34, y - 8 * u, mBody(col), [0.397 * n, 262, 0], u, { rot: [0, 0, -0.5] }),
      B(2.6 * u, 40, y * 0.6, mTrim(), [n / 2 + 1.4 * u, 130, 0], u),
      B(n * 0.045, 22, y - 2 * u, mSilver(), [n * 0.493, 54, 0], u),
      B(n * 0.56, boxR - 70, y - 4 * u, mBody(col), [-n * 0.2, (boxR + 62) / 2, 0], u),
      ...[1, -1].map((sg) => js(Fr, { key: 'pp' + sg, children: [-0.38, -0.2, -0.02].map((fx) =>
        B(1.4 * u, boxR - 90, 0.8 * u, mTrim(), [fx * n, (boxR + 62) / 2, sg * ((y - 4 * u) / 2 + 0.3 * u)], u)
      ) })),
      B(1.6 * u, boxR - 90, y * 0.6, mTrim(), [-n * 0.48 + 0.4 * u, (boxR + 62) / 2, 0], u),
      B(n * 0.42, 36, y * 0.28, mTrim(), [-n * 0.2, 62, y * 0.3], u),
      B(n * 0.42, 36, y * 0.28, mTrim(), [-n * 0.2, 62, -y * 0.3], u),
      B(n * 0.03, 14, y - 4 * u, mSilver(), [-n * 0.487, 46, 0], u),
      FaceTruck({ n, y, u, hy: 140, ty: 130, py: 90, back: true }),
      Mirrors({ n, y, u, lx: 0.44, ly: 180, stick: true }),
      Cy(3.2, 150, mSilver(), [0.285 * n, 165, y * 0.36], u),
    ];
    return { kids, top: 285, wheels: true, wheelPos: truckWheelPos };
  };

  /* ---- DAMPERLİ KAMYON ---- */
  const truckCab2 = (c, rh) => {
    const { n, y, u, col } = c;
    const R = rh || 250;
    return [
      B(n * 0.96, 10, y * 0.46, mTrim(), [0, 48, 0], u),
      X([
        ['m', 0.3, 46], ['l', 0.302, 186],
        ['l', 0.306, R - 28], ['q', 0.31, R - 2, 0.35, R - 1],
        ['l', 0.42, R - 2], ['q', 0.458, R - 6, 0.462, R - 24],
        ['l', 0.468, 130], ['q', 0.472, 100, 0.49, 96],
        ['l', 0.496, 60], ['l', 0.5, 46],
      ], n, u, y - 4 * u, mBody(col), 1.4),
      X([
        ['m', 0.318, 190], ['l', 0.322, R - 28], ['q', 0.325, R - 6, 0.352, R - 5.5],
        ['l', 0.414, R - 6], ['q', 0.446, R - 10, 0.452, R - 26],
        ['l', 0.458, 190],
      ], n, u, y - 13 * u, mGlass()),
      X([
        ['m', 0.322, R - 10], ['l', 0.335, R - 0.5], ['l', 0.415, R - 0.5],
        ['l', 0.448, R - 8], ['l', 0.444, R - 14], ['l', 0.335, R - 13.5],
      ], n, u, y - 7 * u, mBody(col), 1),
      B(2.6 * u, 40, y * 0.6, mTrim(), [n / 2 + 1.4 * u, 130, 0], u),
      B(n * 0.045, 22, y - 2 * u, mSilver(), [n * 0.493, 54, 0], u),
      Mirrors({ n, y, u, lx: 0.44, ly: R - 80, stick: true }),
    ];
  };
  D.dump = (c) => {
    const { n, y, u } = c;
    const kids = [
      ...truckCab2(c, 250),
      B(n * 0.56, 5, y + 2 * u, mDark(), [-n * 0.2, 92, 0], u),
      B(n * 0.56, 78, 4 * u, mBody(c.col), [-n * 0.2, 128, (y + 2 * u) / 2], u),
      B(n * 0.56, 78, 4 * u, mBody(c.col), [-n * 0.2, 128, -(y + 2 * u) / 2], u),
      B(4 * u, 78, y + 2 * u, mBody(c.col), [0.075 * n, 128, 0], u),
      B(4 * u, 66, y + 2 * u, mBody(c.col), [-n * 0.472, 122, 0], u),
      FaceTruck({ n, y, u, hy: 140, ty: 110, py: 70, back: false }),
    ];
    return { kids, top: 265, wheels: true, wheelPos: truckWheelPos };
  };

  /* ---- ÇEKİCİ (TOW) ---- */
  D.tow = (c) => {
    const r = D.dump(c);
    const { n, y, u } = c;
    r.kids.push(
      B(n * 0.52, 5, y - 8 * u, mDark(), [-n * 0.19, 78, 0], u),
      B(n * 0.14, 4, y - 8 * u, mDark(), [-n * 0.44, 56, 0], u, { rot: [0, 0, 0.32] }),
      B(n * 0.1, 8, 6 * u, mOrange(), [-n * 0.02, 110, 0], u, { rot: [0, 0, 0.5] }),
      B(n * 0.07, 6, 5 * u, mOrange(), [-n * 0.09, 150, 0], u, { rot: [0, 0, -0.25] }),
    );
    return r;
  };

  /* ---- VİNÇ ---- */
  D.crane = (c) => {
    const r = D.dump(c);
    const { n, y, u } = c;
    r.kids.push(
      B(n * 0.72, 10, 7 * u, mOrange(), [-n * 0.08, 170, 0], u, { rot: [0, 0, 0.16] }),
      B(n * 0.3, 8, 5.6 * u, mOrange(), [-n * 0.35, 226, 0], u, { rot: [0, 0, 0.16] }),
      Cy(7, 18, mTrim(), [0.05 * n, 96, 0], u, [Math.PI / 2, 0, 0]),
      B(10 * u, 6, y * 0.8, mTrim(), [-n * 0.44, 40, 0], u),
    );
    r.top = 300;
    return r;
  };

  /* ---- BETON MİKSERİ ---- */
  D.mixer = (c) => {
    const r = D.dump(c);
    const { n, y, u } = c;
    r.kids.push(
      j('mesh', {
        position: [-n * 0.18, 175 * u, 0],
        rotation: [0, 0, Math.PI / 2 - 0.14],
        castShadow: true,
        material: mSilver(),
        children: j('cylinderGeometry', { args: [58 * u, 40 * u, n * 0.42, 26] }),
      }),
      Cy(12, 10, mTrim(), [0.02 * n, 120, 0], u),
      // tambur uç konileri
      j('mesh', {
        position: [-n * 0.355, 158 * u, 0],
        rotation: [0, 0, Math.PI / 2 - 0.14],
        material: mSilver(),
        children: j('cylinderGeometry', { args: [40 * u, 12 * u, n * 0.09, 22] }),
      }),
    );
    r.top = 280;
    return r;
  };

  /* ---- İTFAİYE ---- */
  D.fire = (c) => {
    const { n, y, u } = c;
    const red = '#c1121a';
    const kids = [
      B(n * 0.96, 10, y * 0.46, mTrim(), [0, 48, 0], u),
      X([
        ['m', 0.27, 46], ['l', 0.272, 200],
        ['l', 0.276, 262], ['q', 0.28, 288, 0.32, 289],
        ['l', 0.41, 288], ['q', 0.448, 284, 0.452, 266],
        ['l', 0.458, 134], ['q', 0.462, 102, 0.482, 98],
        ['l', 0.49, 60], ['l', 0.494, 46],
      ], n, u, y - 4 * u, mBody(red), 1.4),
      X([
        ['m', 0.284, 204], ['l', 0.288, 262], ['q', 0.291, 284, 0.318, 284.5],
        ['l', 0.402, 284], ['q', 0.436, 280, 0.442, 264],
        ['l', 0.448, 204],
      ], n, u, y - 13 * u, mGlass()),
      X([
        ['m', 0.288, 278], ['l', 0.301, 289.5], ['l', 0.408, 289.5],
        ['l', 0.444, 280], ['l', 0.441, 274], ['l', 0.301, 274.5],
      ], n, u, y - 7 * u, mBody(red), 1),
      // ekipman gövdesi (kırmızı) — kabin hemen arkasında
      B(n * 0.68, 218, y - 2 * u, mBody(red), [-n * 0.14, 172, 0], u),
      ...[1, -1].map((sg) => js(Fr, { key: 'roll' + sg, children: [-0.4, -0.24, -0.08].map((fx) =>
        B(n * 0.13, 150, 0.8 * u, mSilver(), [fx * n, 130, sg * ((y - 2 * u) / 2 + 0.35 * u)], u)
      ) })),
      B(n * 0.03, 16, y - 2 * u, mSilver(), [-n * 0.488, 48, 0], u),
      B(6 * u, 4, y - 10 * u, mTrim(), [-n * 0.47, 34, 0], u),
      // tavan merdiveni (gövde boyunca)
      B(n * 0.6, 6, y * 0.56, mSilver(), [-n * 0.14, 288, 0], u),
      B(n * 0.6, 3, 2.4 * u, mSilver(), [-n * 0.14, 296, y * 0.24], u),
      B(n * 0.6, 3, 2.4 * u, mSilver(), [-n * 0.14, 296, -y * 0.24], u),
      ...[-0.42, -0.3, -0.18, -0.06].map((fx, i) =>
        j('mesh', { key: 'rung' + i, material: mChrome(), position: [fx * n, 297 * u, 0], children: j('boxGeometry', { args: [1.8 * u, 2.6 * u, y * 0.48] }) })
      ),
      // hortum yuvası
      B(n * 0.09, 26, y * 0.62, mTrim(), [-n * 0.45, 292, 0], u),
      Cy(14, y * 0.5, mDark(), [-n * 0.45, 296, 0], u, [0, 0, Math.PI / 2]),
      Lightbar({ n, y, u, ly: 293, half: true, lx: 0.36 }),
      Beacon({ n, u, lx: 0.42, ly: 294 }),
      B(2.8 * u, 24, y * 0.7, mChrome(), [n / 2 + 2 * u, 60, 0], u),
      B(2.6 * u, 30, y * 0.62, mTrim(), [n / 2 + 1.4 * u, 122, 0], u),
      FaceTruck({ n, y, u, hy: 148, ty: 130, py: 80, back: true }),
      Mirrors({ n, y, u, lx: 0.42, ly: 200, stick: true }),
    ];
    return { kids, top: 312, wheels: true, wheelPos: truckWheelPos };
  };

  /* ---- TIR (çekici + dorse) ---- */
  D.semi = (c) => {
    const { n, y, u, col } = c;
    const kids = [
      B(n * 0.3, 10, y * 0.46, mTrim(), [n * 0.33, 46, 0], u),
      X([
        ['m', 0.38, 42], ['l', 0.382, 176],
        ['l', 0.386, 198], ['q', 0.39, 214, 0.428, 215],
        ['l', 0.47, 214], ['q', 0.494, 210, 0.496, 192],
        ['l', 0.498, 120], ['q', 0.499, 96, 0.5, 90],
        ['l', 0.5, 42],
      ], n, u, y - 4 * u, mBody(col), 1.4),
      X([
        ['m', 0.394, 178], ['l', 0.397, 198], ['q', 0.4, 210, 0.428, 210.5],
        ['l', 0.462, 210], ['q', 0.484, 206, 0.487, 190],
        ['l', 0.489, 178],
      ], n, u, y - 13 * u, mGlass()),
      X([
        ['m', 0.397, 207], ['l', 0.407, 215.5], ['l', 0.465, 215.5],
        ['l', 0.486, 208], ['l', 0.483, 202], ['l', 0.407, 202.5],
      ], n, u, y - 7 * u, mBody(col), 1),
      B(2.6 * u, 34, y * 0.6, mTrim(), [n * 0.501, 116, 0], u),
      B(n * 0.02, 20, y - 2 * u, mSilver(), [n * 0.499, 50, 0], u),
      B(n * 0.62, 250, y - 2 * u, mSilver(), [-n * 0.17, 190, 0], u),
      ...[1, -1].map((sg) => js(Fr, { key: 'tp' + sg, children: [-0.34, -0.16, 0.02].map((fx) =>
        B(1.4 * u, 230, 0.8 * u, mTrim(), [fx * n, 190, sg * ((y - 2 * u) / 2 + 0.3 * u)], u)
      ) })),
      B(n * 0.64, 9, y * 0.4, mTrim(), [-n * 0.17, 58, 0], u),
      B(n * 0.03, 14, y - 4 * u, mSilver(), [-n * 0.483, 48, 0], u),
      FaceTruck({ n, y, u, hy: 128, ty: 120, py: 84, back: true }),
      Mirrors({ n, y, u, lx: 0.47, ly: 172, stick: true }),
    ];
    return { kids, top: 325, wheels: true };
  };

  /* ---- DORSE (ayrı) ---- */
  D.trailerOnly = (c) => {
    const { n, y, u } = c;
    const kids = [
      B(n * 0.9, 250, y - 2 * u, mSilver(), [-n * 0.02, 190, 0], u),
      B(n * 0.92, 9, y * 0.4, mTrim(), [-n * 0.02, 58, 0], u),
      B(6 * u, 90, 8 * u, mTrim(), [n * 0.4, 100, y * 0.24], u),
      B(6 * u, 90, 8 * u, mTrim(), [n * 0.4, 100, -y * 0.24], u),
      ...[1, -1].map((sg) => js(Fr, { key: 'trp' + sg, children: [-0.36, -0.18, 0, 0.18].map((fx) =>
        B(1.4 * u, 230, 0.8 * u, mTrim(), [fx * n, 190, sg * ((y - 2 * u) / 2 + 0.3 * u)], u)
      ) })),
      FaceTruck({ n, y, u, hy: 120, ty: 120, py: 80, back: true }),
    ];
    return { kids, top: 320, wheels: true };
  };

  /* ---- TOMA ---- */
  D.toma = (c) => {
    const r = D.truck(c);
    const { n, y, u } = c;
    r.kids.push(
      B(n * 0.1, 60, y * 0.8, mTrim(), [n * 0.44, 40, 0], u),
      Cy(9, 20, mTrim(), [-n * 0.2, 285, 0], u),
    );
    r.top = 310;
    return r;
  };

  /* ---- ZIRHLI ARAÇ ---- */
  D.armored = (c) => {
    const { n, y, u } = c;
    const col = '#3d4a42';
    const kids = [
      X([
        ['m', -0.5, 44], ['l', -0.46, 130], ['q', -0.44, 160, -0.38, 172],
        ['l', 0.36, 176], ['q', 0.46, 174, 0.485, 150],
        ['l', 0.5, 96], ['q', 0.5, 60, 0.47, 50], ['l', -0.44, 44],
      ], n, u, y - 2 * u, mBody(col), 1.6),
      B(n * 0.24, 44, y - 20 * u, mBody(col), [n * 0.05, 200, 0], u),
      B(n * 0.12, 1.4, 3 * u, mTrim(), [n * 0.14, 226, 0], u),
      ...[1, -1].map((sg) => js(Fr, { key: 'slit' + sg, children: [
        B(n * 0.16, 9, 1 * u, mTrim(), [n * 0.05, 150, sg * ((y - 2 * u) / 2 + 0.4 * u)], u),
        B(n * 0.1, 8, 1 * u, mTrim(), [-n * 0.3, 138, sg * ((y - 2 * u) / 2 + 0.4 * u)], u),
      ] })),
      B(n * 0.05, 22, y - 4 * u, mTrim(), [n * 0.493, 48, 0], u),
      B(n * 0.05, 22, y - 4 * u, mTrim(), [-n * 0.493, 52, 0], u),
    ];
    return { kids, top: 235, wheels: true };
  };

  /* ---- TRAKTÖR ---- */
  D.tractor = (c) => {
    const { n, y, u, col } = c;
    const kids = [
      B(n * 0.38, 62, y * 0.5, mBody(col), [n * 0.26, 76, 0], u),
      B(n * 0.42, 3, y * 0.56, mTrim(), [n * 0.24, 108, 0], u),
      B(n * 0.24, 88, y - 12 * u, mGlass(), [0, 150, 0], u),
      B(n * 0.24, 6, y - 8 * u, mBody(col), [0, 196, 0], u),
      B(n * 0.2, 52, y - 16 * u, mBody(col), [-n * 0.06, 130, 0], u),
      Cy(3.4, 70, mTrim(), [n * 0.12, 120, y * 0.28], u),
      B(n * 0.7, 14, y * 0.42, mTrim(), [-n * 0.05, 40, 0], u),
      B(6 * u, 8, 6 * u, mTrim(), [-n * 0.47, 52, 0], u),
    ];
    return { kids, top: 205, wheelRF: 36, wheelRB: 62, wheelPos: [[0.3, 1], [0.3, -1], [-0.3, 1], [-0.3, -1]] };
  };

  /* ---- FORKLIFT ---- */
  D.forklift = (c) => {
    const { n, y, u, col } = c;
    const kids = [
      B(n * 0.44, 70, y - 16 * u, mBody(col), [n * 0.14, 66, 0], u),
      B(n * 0.18, 56, y - 12 * u, mTrim(), [-n * 0.24, 62, 0], u),
      B(n * 0.26, 3, y - 14 * u, mTrim(), [n * 0.13, 172, 0], u),
      ...[[-0.02, 1], [-0.02, -1], [0.26, 1], [0.26, -1]].map((pp, i) =>
        B(3 * u, 80, 3 * u, mTrim(), [pp[0] * n, 132, pp[1] * (y / 2 - 9 * u)], u)
      ),
      B(4 * u, 160, y * 0.34, mTrim(), [n * 0.34, 90, 0], u),
      B(4 * u, 160, y * 0.34, mTrim(), [n * 0.34, 90, -y * 0.1], u),
      B(n * 0.2, 3, 4 * u, mChrome(), [n * 0.42, 10, y * 0.14], u),
      B(n * 0.2, 3, 4 * u, mChrome(), [n * 0.42, 10, -y * 0.14], u),
      B(n * 0.08, 10, y * 0.3, mDark(), [n * 0.05, 106, 0], u),
    ];
    return { kids, top: 180, wheelRF: 22, wheelRB: 30, wheelPos: [[0.33, 1], [0.33, -1], [-0.26, 1], [-0.26, -1]] };
  };

  /* ---- EKSKAVATÖR ---- */
  D.excavator = (c) => {
    const { n, y, u, col } = c;
    const col2 = shade(col, 0.9);
    const kids = [
      B(n * 0.62, 36, y * 0.28, mDark(), [0, 20, y * 0.33], u),
      B(n * 0.62, 36, y * 0.28, mDark(), [0, 20, -y * 0.33], u),
      B(n * 0.4, 86, y * 0.74, mBody(col2), [-n * 0.04, 82, 0], u),
      B(n * 0.16, 46, y * 0.6, mGlass(), [n * 0.12, 110, 0], u),
      B(n * 0.34, 12, 8 * u, mBody(col2), [n * 0.26, 130, 0], u, { rot: [0, 0, 0.5] }),
      B(n * 0.3, 10, 7 * u, mBody(col2), [n * 0.45, 178, 0], u, { rot: [0, 0, -0.35] }),
      B(n * 0.09, 34, 16 * u, mSilver(), [n * 0.55, 160, 0], u, { rot: [0, 0, 0.2] }),
    ];
    return { kids, top: 200 };
  };

  /* ---- DOZER / YÜKLEYİCİ ---- */
  D.loader = (c) => {
    const { n, y, u, col } = c;
    const col2 = shade(col, 0.9);
    const kids = [
      B(n * 0.6, 38, y * 0.26, mDark(), [0, 22, y * 0.33], u),
      B(n * 0.6, 38, y * 0.26, mDark(), [0, 22, -y * 0.33], u),
      B(n * 0.36, 78, y * 0.6, mBody(col2), [n * 0.04, 90, 0], u),
      B(n * 0.12, 44, y * 0.5, mGlass(), [n * 0.16, 116, 0], u),
      B(n * 0.16, 52, y * 0.94, mSilver(), [n * 0.44, 62, 0], u),
      ...[1, -1].map((sg) => B(n * 0.3, 8, 5 * u, mBody(col2), [n * 0.3, 96, sg * y * 0.36], u, { rot: [0, 0, 0.35] })),
    ];
    return { kids, top: 150 };
  };

  /* ---- ATV (QUAD) ---- */
  D.quad = (c) => {
    const { n, y, u, col } = c;
    const kids = [
      B(n * 0.6, 34, y - 10 * u, mBody(col), [0, 66, 0], u),
      B(n * 0.2, 26, y - 22 * u, mTrim(), [n * 0.2, 90, 0], u),
      B(n * 0.3, 5, y - 6 * u, mTrim(), [-n * 0.1, 86, 0], u),
      B(6 * u, 22, 3 * u, mTrim(), [n * 0.42, 80, y * 0.3], u),
      B(6 * u, 22, 3 * u, mTrim(), [n * 0.42, 80, -y * 0.3], u),
      B(n * 0.14, 10, y - 18 * u, mDark(), [-n * 0.3, 88, 0], u),
    ];
    return { kids, top: 105, wheelRF: 24, wheelRB: 26, wheelPos: [[0.34, 1], [0.34, -1], [-0.34, 1], [-0.34, -1]] };
  };

  /* ---- GOLF ARACI ---- */
  D.golf = (c) => {
    const { n, y, u, col } = c;
    const kids = [
      B(n * 0.86, 30, y - 8 * u, mBody(col), [0, 44, 0], u),
      B(n * 0.3, 26, y - 18 * u, mDark(), [-n * 0.08, 62, 0], u),
      B(n * 0.3, 22, y - 18 * u, mDark(), [-n * 0.38, 58, 0], u),
      B(n * 0.6, 4, y - 8 * u, mWhite(), [-n * 0.05, 168, 0], u),
      ...[[0.22, 1], [0.22, -1], [-0.32, 1], [-0.32, -1]].map((pp, i) =>
        B(2.6 * u, 110, 2.6 * u, mTrim(), [pp[0] * n, 116, pp[1] * (y / 2 - 7 * u)], u)
      ),
      B(n * 0.2, 16, y - 12 * u, mTrim(), [n * 0.38, 58, 0], u),
    ];
    return { kids, top: 174, wheelRF: 22, wheelRB: 22, wheelPos: [[0.36, 1], [0.36, -1], [-0.36, 1], [-0.36, -1]] };
  };

  /* ---- MOTOSİKLET ---- */
  D.moto = (c) => {
    const { n, u, col } = c;
    const R = 22;
    const kids = [
      j('mesh', { position: [-n * 0.34, R * u, 0], rotation: [Math.PI / 2, 0, 0], material: mDark(), children: j('cylinderGeometry', { args: [R * u, R * u, 7 * u, 20] }) }),
      j('mesh', { position: [n * 0.34, R * u, 0], rotation: [Math.PI / 2, 0, 0], material: mDark(), children: j('cylinderGeometry', { args: [R * u, R * u, 7 * u, 20] }) }),
      j('mesh', { position: [-n * 0.34, R * u, 0], rotation: [Math.PI / 2, 0, 0], material: mSilver(), children: j('cylinderGeometry', { args: [R * u * 0.5, R * u * 0.5, 7.4 * u, 14] }) }),
      j('mesh', { position: [n * 0.34, R * u, 0], rotation: [Math.PI / 2, 0, 0], material: mSilver(), children: j('cylinderGeometry', { args: [R * u * 0.5, R * u * 0.5, 7.4 * u, 14] }) }),
      B(n * 0.52, 22, 11 * u, mBody(col), [0, R + 26, 0], u),
      B(n * 0.2, 30, 9 * u, mBody(col), [-n * 0.2, R + 38, 0], u),
      B(n * 0.24, 8, 13 * u, mDark(), [-n * 0.1, R + 42, 0], u),
      B(n * 0.16, 10, 12 * u, mBody(col), [n * 0.08, R + 42, 0], u),
      B(3 * u, 3, 24 * u, mTrim(), [n * 0.26, R + 62, 0], u),
      Cy(1.2, 18, mTrim(), [n * 0.27, R + 48, 0], u),
      B(n * 0.14, 3, 9 * u, mBody(col), [n * 0.34, R + 12, 0], u),
      j('mesh', { material: mHead(), position: [n * 0.35, (R + 40) * u, 0], children: j('sphereGeometry', { args: [3.4 * u, 12, 12] }) }),
    ];
    return { kids, top: R + 70 };
  };

  /* ================================================================
   * SINIF TABLOSU
   * ================================================================ */
  const CLASSES = {
    car:       { h: 152, r: 33, w: 17, build: D.car, defCol: '#8fa3b8' },
    hatch:     { h: 152, r: 32, w: 17, build: D.car, defCol: '#9aa7ad', opt: { roof: 150, rX: -0.29, rTx: -0.21, fTx: 0.1 } },
    coupe:     { h: 134, r: 33, w: 18, build: D.car, defCol: '#7c8ea6', opt: { roof: 134, rX: -0.24, rTx: -0.16, fTx: 0.12 } },
    cabrio:    { h: 138, r: 33, w: 17, build: D.car, defCol: '#b0483f', opt: { roof: 138 } },
    limo:      { h: 150, r: 33, w: 17, build: D.car, defCol: '#14171c', opt: { roof: 148, rX: -0.3, rTx: -0.22, fTx: 0.24 } },
    classic:   { h: 156, r: 34, w: 17, build: D.car, defCol: '#7a8f77', opt: { roof: 154, rX: -0.28, rTx: -0.2, fTx: 0.1, chromeBump: true } },
    burned:    { h: 152, r: 33, w: 17, build: D.car, defCol: '#232324', opt: { roof: 147 } },
    damaged:   { h: 150, r: 32, w: 17, build: D.car, defCol: '#6b7480', opt: { roof: 146 } },
    taxi:      { h: 152, r: 33, w: 17, build: D.taxi, defCol: '#f2c230', fixedCol: '#f2c230' },
    police:    { h: 152, r: 33, w: 17, build: D.police, defCol: '#eef0f2', fixedCol: '#eef0f2' },
    gend:      { h: 174, r: 37, w: 18, build: D.gendSuv, defCol: '#eef0f2', fixedCol: '#eef0f2' },
    suv:       { h: 174, r: 37, w: 18, build: D.suv, defCol: '#77848e' },
    minivan:   { h: 178, r: 36, w: 18, build: D.suv, defCol: '#98a2ab', opt: { van: true } },
    pickup:    { h: 186, r: 39, w: 19, build: D.pickup, defCol: '#7c6a55' },
    van:       { h: 236, r: 37, w: 18, build: D.van, defCol: '#e8eaee' },
    caravan:   { h: 250, r: 36, w: 18, build: D.van, defCol: '#e3e7ea', opt: { high: true } },
    municipal: { h: 250, r: 37, w: 18, build: D.municipal, defCol: '#e87511', fixedCol: '#e87511' },
    ambulance: { h: 262, r: 38, w: 18, build: D.ambulance, defCol: '#f2f4f6', fixedCol: '#f2f4f6' },
    minibus:   { h: 282, r: 42, w: 19, build: D.minibus, defCol: '#d7dbe0' },
    bus:       { h: 322, r: 46, w: 21, build: D.bus, defCol: '#3d7ab5' },
    tram:      { h: 352, r: 40, w: 21, build: D.tram, defCol: '#c8d4dc' },
    train:     { h: 382, r: 42, w: 22, build: D.train, defCol: '#8e2f38' },
    truck:     { h: 300, r: 44, w: 21, build: D.truck, defCol: '#4a7dc0' },
    dump:      { h: 300, r: 44, w: 21, build: D.dump, defCol: '#c8a428' },
    tow:       { h: 300, r: 44, w: 21, build: D.tow, defCol: '#b0483f' },
    crane:     { h: 320, r: 44, w: 21, build: D.crane, defCol: '#e87511' },
    mixer:     { h: 320, r: 44, w: 21, build: D.mixer, defCol: '#c8a428' },
    fire:      { h: 315, r: 44, w: 21, build: D.fire, defCol: '#c1121a', fixedCol: '#c1121a' },
    semi:      { h: 330, r: 45, w: 21, build: D.semi, defCol: '#2f6fb0' },
    trailer:   { h: 330, r: 42, w: 20, build: D.trailerOnly, defCol: '#c3c9cf' },
    toma:      { h: 315, r: 44, w: 21, build: D.toma, defCol: '#2f6fb0', fixedCol: '#2f6fb0' },
    armored:   { h: 240, r: 40, w: 20, build: D.armored, defCol: '#3d4a42', fixedCol: '#3d4a42' },
    tractor:   { h: 210, r: 0, w: 20, build: D.tractor, defCol: '#4d7a3a' },
    forklift:  { h: 190, r: 0, w: 16, build: D.forklift, defCol: '#d8a018' },
    excavator: { h: 205, r: 0, w: 0, build: D.excavator, defCol: '#d8a018' },
    loader:    { h: 155, r: 0, w: 0, build: D.loader, defCol: '#d8a018' },
    quad:      { h: 110, r: 0, w: 14, build: D.quad, defCol: '#b0483f' },
    golf:      { h: 180, r: 0, w: 13, build: D.golf, defCol: '#eef0f2' },
    moto:      { h: 110, r: 0, w: 0, build: D.moto, defCol: '#b0483f' },
  };

  /* ---------- tip çözümleme ---------- */
  const ID2CLS = {
    'v-sedan': 'car', 'v-suv': 'suv', 'v-truck': 'truck', 'v-bus': 'bus', 'v-motor': 'moto',
    'v-police': 'police', 'v-ambulance': 'ambulance', 'v-firetruck': 'fire', 'v-taxi': 'taxi',
    'v-hatchback': 'hatch', 'v-station': 'suv', 'v-coupe': 'coupe', 'v-cabrio': 'cabrio',
    'v-limousine': 'limo', 'v-classic': 'classic', 'v-pickup': 'pickup', 'v-panelvan': 'van',
    'v-minivan': 'minivan', 'v-minibus': 'minibus', 'v-trailer': 'semi', 'v-dump': 'dump',
    'v-concrete': 'mixer', 'v-tow': 'tow', 'v-crane': 'crane', 'v-excavator': 'excavator',
    'v-loader': 'loader', 'v-forklift': 'forklift', 'v-tractor': 'tractor', 'v-bicycle': 'moto',
    'v-scooter': 'moto', 'v-quad': 'quad', 'v-golf': 'golf', 'v-gendarmerie': 'gend',
    'v-municipal': 'municipal', 'v-toma': 'toma', 'v-armored': 'armored', 'v-tram': 'tram',
    'v-train': 'train', 'v-caravan': 'caravan', 'v-burned': 'burned', 'v-overturned': 'car',
    'v-damaged-front': 'damaged', 'v-motor-fallen': 'moto', 'v-bicyclist': 'moto',
    'v-trailer-only': 'trailer',
  };
  function resolveClass(t) {
    const id = t.split(' ')[0];
    if (ID2CLS[id]) return ID2CLS[id];
    if (t.includes('motor') || t.includes('moto') || t.includes('bisiklet') || t.includes('bicycle') || t.includes('skuter') || t.includes('scooter')) return 'moto';
    if (t.includes('quad') || t.includes('atv')) return 'quad';
    if (t.includes('golf')) return 'golf';
    if (t.includes('forklift')) return 'forklift';
    if (t.includes('ekskavat') || t.includes('excavator')) return 'excavator';
    if (t.includes('dozer') || t.includes('loader') || t.includes('yükleyici')) return 'loader';
    if (t.includes('vinç') || t.includes('crane')) return 'crane';
    if (t.includes('firetruck') || t.includes('itfaiye') || t.includes('fire')) return 'fire';
    if (t.includes('ambulan')) return 'ambulance';
    if (t.includes('jandarma') || t.includes('gendarmerie')) return 'gend';
    if (t.includes('police') || t.includes('polis')) return 'police';
    if (t.includes('taksi') || t.includes('taxi')) return 'taxi';
    if (t.includes('toma')) return 'toma';
    if (t.includes('zırhlı') || t.includes('armored')) return 'armored';
    if (t.includes('beton') || t.includes('mikser') || t.includes('mixer') || t.includes('concrete')) return 'mixer';
    if (t.includes('damperli') || t.includes('dump')) return 'dump';
    if (t.includes('dorse')) return 'trailer';
    if (t.includes('trailer') || t.includes('tır')) return 'semi';
    if (t.includes('tow') || t.includes('çekici')) return 'tow';
    if (t.includes('truck') || t.includes('kamyon')) return 'truck';
    if (t.includes('minibüs') || t.includes('minibus')) return 'minibus';
    if (t.includes('otobüs') || t.includes('bus')) return 'bus';
    if (t.includes('tram')) return 'tram';
    if (t.includes('lokomotif') || t.includes('train')) return 'train';
    if (t.includes('municipal') || t.includes('belediye')) return 'municipal';
    if (t.includes('caravan') || t.includes('karavan')) return 'caravan';
    if (t.includes('panelvan') || t.includes('van')) return 'van';
    if (t.includes('minivan')) return 'minivan';
    if (t.includes('pickup') || t.includes('kamyonet')) return 'pickup';
    if (t.includes('limuzin') || t.includes('limo')) return 'limo';
    if (t.includes('hatchback')) return 'hatch';
    if (t.includes('coupe') || t.includes('spor')) return 'coupe';
    if (t.includes('cabrio')) return 'cabrio';
    if (t.includes('station')) return 'suv';
    if (t.includes('klasik') || t.includes('classic')) return 'classic';
    if (t.includes('yanm') || t.includes('burned')) return 'burned';
    if (t.includes('hasarlı') || t.includes('damaged')) return 'damaged';
    if (t.includes('traktör') || t.includes('tractor')) return 'tractor';
    if (t.includes('suv') || t.includes('jeep')) return 'suv';
    return 'car';
  }

  /* ================================================================
   * ANA BİLEŞEN — eski Mr ile birebir aynı prop arayüzü
   * ================================================================ */
  const Mr = ({ x: px, y: pz, width, height, rad = 0, type = '', fill, zOffset = 0, zHeight, rollOver = false }) => {
    const alongY = height > width;
    const n = alongY ? height : width;
    const y = alongY ? width : height;
    const rot = alongY ? rad - Math.PI / 2 : rad;
    const t = String(type || '').toLowerCase();
    const cls = resolveClass(t);
    const C = CLASSES[cls];

    const col = C.fixedCol || (fill && lum(fill) > 0.16 ? fill : C.defCol);

    const hCm = zHeight || C.h;
    const N = hCm / C.h;
    const u = s * N;

    const minLen = Math.max(100, hCm * 0.7 * s);
    const grow = n < minLen ? minLen / n : 1;

    const out = C.build({ n, y, u, col, s }, C.opt);

    // tekerlekler
    const kids = [...out.kids];
    const wPos = out.wheelPos;
    if (wPos) {
      for (const [fx, side] of wPos) {
        const R = fx > 0 ? (out.wheelRF || C.r || 22) : (out.wheelRB || C.r || 30);
        kids.push(j(Wheel, { key: 'w' + fx + '_' + side, R, W: C.w || 14, px: fx * n, pz: side * (y / 2 - (C.w || 14) * s * 0.18) }));
      }
    } else if (out.wheels) {
      const wheelZ = y / 2 - C.w * s * 0.18;
      const pos = [[0.31, 1], [0.31, -1], [-0.31, 1], [-0.31, -1]];
      for (const [fx, side] of pos) kids.push(j(Wheel, { key: 'w' + fx + '_' + side, R: C.r, W: C.w, px: fx * n, pz: side * wheelZ }));
    }

    const flipY = out.top * u * grow + 2 * s;

    return j('group', {
      position: [px, zOffset || 0, pz],
      rotation: [0, rot, 0],
      children: js('group', {
        position: [0, rollOver ? flipY : 0, 0],
        rotation: [rollOver ? Math.PI : 0, 0, 0],
        scale: [grow, grow, grow],
        children: kids,
      }),
    });
  };
  return Mr;
}
