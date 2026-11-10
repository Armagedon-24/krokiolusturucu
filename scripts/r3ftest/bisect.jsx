import React from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { nrRaw } from './nr_module.js';
import { Shape as Vs } from 'three';
import { jsx as _j, jsxs as _js } from 'react/jsx-runtime';

const s = { jsx: _j, jsxs: _js, Fragment: React.Fragment };
const e = 0.55;
const nr = nrRaw({ s, Vs, e });
const t = 460 * e, h = 180 * e;
const MODE = new URLSearchParams(location.search).get('mode') || '1';

function App() {
  const children = [];
  if (MODE >= '2') children.push(React.createElement('color', { attach: 'background', args: ['#bcd4e8'] }));
  if (MODE >= '3') {
    children.push(React.createElement('hemisphereLight', { intensity: .65, color: '#e3edf7', groundColor: '#8f9296' }));
    children.push(React.createElement('ambientLight', { intensity: .5 }));
    children.push(React.createElement('directionalLight', { position: [100, 200, 100], intensity: 1, castShadow: true }));
  }
  const car = React.createElement(nr, { x: 0, y: 0, width: t, height: h, rad: 0, type: 'v-sedan Binek otomobil (mağdur aracı)', fill: '#2a2e33', zOffset: 0, zHeight: undefined, rollOver: false });
  children.push(MODE >= '4' ? React.createElement('group', { rotation: [0, 0, 0] }, car) : car);
  if (MODE >= '5') {
    children.push(React.createElement('mesh', { rotation: [-Math.PI / 2, 0, 0], receiveShadow: true },
      React.createElement('planeGeometry', { args: [4000, 4000] }),
      React.createElement('meshStandardMaterial', { color: '#cfd3d6', roughness: .95 })));
    children.push(React.createElement('mesh', { position: [0, .5, 0], receiveShadow: true },
      React.createElement('boxGeometry', { args: [1400, 1, 260] }),
      React.createElement('meshStandardMaterial', { color: '#f2f2f0', roughness: .9 })));
  }
  return React.createElement(Canvas, {
    camera: { fov: 45, position: [190, 240, 266], near: 1, far: 5000 },
    shadows: true,
    gl: { antialias: true },
    onCreated: ({ camera, scene }) => { window.__scene = scene; camera.lookAt(0, 30, 0); setTimeout(() => { window.__done = true; }, 100); },
  }, ...children);
}
createRoot(document.getElementById('root')).render(React.createElement(App));
