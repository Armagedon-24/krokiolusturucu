import React from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { nrRaw } from './nr_module.js';
import { Shape as Vs } from 'three';
import { jsx as _j, jsxs as _js } from 'react/jsx-runtime';

const s = { jsx: _j, jsxs: _js, Fragment: React.Fragment };
const e = 0.55;
const nr = nrRaw({ s, Vs, e });

function Probe() {
  return React.createElement(Canvas, {
    camera: { fov: 45, position: [190, 240, 266], near: 1, far: 5000 },
    onCreated: ({ scene, camera }) => { window.__scene = scene;
      camera.lookAt(0, 30, 0);
      setTimeout(() => {
        let meshes = 0, groups = 0, others = [];
        scene.traverse(o => {
          if (o.isMesh) meshes++;
          else if (o.isGroup && o.parent) groups++;
          if (o.geometry && o.geometry.type) others.push(o.geometry.type + '@' + JSON.stringify(o.position.toArray().map(v => Math.round(v))));
        });
        window.__report = { meshes, groups, others: others.slice(0, 12), total: others.length };
        window.__done = true;
      }, 300);
    },
  },
    React.createElement(nr, { x: 0, y: 0, width: 253, height: 99, rad: 0, type: 'v-sedan Binek otomobil (mağdur aracı)', fill: '#2a2e33', zOffset: 0, zHeight: undefined, rollOver: false }),
  );
}
createRoot(document.getElementById('root')).render(React.createElement(Probe));
