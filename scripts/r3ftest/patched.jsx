import React from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { patchedFactory } from './nr_patched_module.js';
import * as THREE from 'three';

const jsx2 = (t, p, k) => React.createElement(t, { ...p, ...(k !== undefined ? { key: k } : {}) });
const eRt = { jsx: jsx2, jsxs: jsx2, Fragment: React.Fragment };
const nr = patchedFactory({ e: eRt, O: React, THREE });

const q = new URLSearchParams(location.search);
const kind = q.get('kind') || 'sedan';
const view = q.get('view') || 'bird';
const fill = q.get('color') || '#2a2e33';
const DIMS = {
  sedan: { L: 460, W: 180, type: 'v-sedan Binek otomobil (mağdur aracı)' },
  suv: { L: 480, W: 195, type: 'v-suv Jeep' },
  bus: { L: 1100, W: 255, type: 'v-bus Otobüs' },
  truck: { L: 900, W: 250, type: 'v-truck Kamyon (itfaiye)' },
};
const D = DIMS[kind];
const t = D.L * 0.55, h = D.W * 0.55;
const CAMS = { bird: [t * .75, t * .95, t * 1.05], side: [t * .05, t * .30, t * 1.25], front: [t * 1.15, t * .38, t * .75], top: [0.001, t * 1.6, 0.001] };

function App() {
  return React.createElement(Canvas, {
    camera: { fov: 45, position: CAMS[view], near: 1, far: 5000 },
    gl: { antialias: true },
    onCreated: ({ camera }) => { camera.lookAt(0, t * .12, 0); setTimeout(() => { window.__done = true; }, 100); },
  },
    React.createElement('color', { attach: 'background', args: ['#bcd4e8'] }),
    React.createElement('hemisphereLight', { intensity: .65, color: '#e3edf7', groundColor: '#8f9296' }),
    React.createElement('ambientLight', { intensity: .5 }),
    React.createElement('directionalLight', { position: [100, 200, 100], intensity: 1, castShadow: true }),
    React.createElement('group', { rotation: [0, 0, 0] },
      React.createElement(nr, { x: 0, y: 0, width: t, height: h, rad: 0, type: D.type, fill, zOffset: 0, zHeight: undefined, rollOver: false })),
    React.createElement('mesh', { rotation: [-Math.PI / 2, 0, 0], receiveShadow: true },
      React.createElement('planeGeometry', { args: [4000, 4000] }),
      React.createElement('meshStandardMaterial', { color: '#cfd3d6', roughness: .95 })),
    React.createElement('mesh', { position: [0, .5, 0], receiveShadow: true },
      React.createElement('boxGeometry', { args: [1400, 1, 260] }),
      React.createElement('meshStandardMaterial', { color: '#f2f2f0', roughness: .9 })),
  );
}
createRoot(document.getElementById('root')).render(React.createElement(App));
