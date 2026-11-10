/**
 * Arac3DModel.jsx — Arac3D V2 araç sistemi (React bileşen sarmalayıcısı)
 * Kroki Oluşturucu — "3D Olay Yeri Modeli"
 *
 * Kullanım:
 *   1. Bu dosyayı ve aynı klasördeki Arac3DV2.js dosyasını projenize kopyalayın
 *      (ör. src/components/three/).
 *   2. Aşağıdaki SCALE sabitini uygulamanızdaki cm→sahne ölçeğiyle değiştirin
 *      (yayındaki sürümde 0.55).
 *   3. ThreeDPreview içinde aracı çizen bileşeni (yayında adı `Mr`, sarmalayıcı
 *      `ur`) bununla değiştirin. Prop arayüzü birebir aynıdır:
 *      { x, y, width, height, rad, type, fill, zOffset, zHeight, rollOver }
 *
 * Sınıf tespiti otomatiktir: type metni ("v-police Polis Aracı" gibi id+ad)
 * içinden araç sınıfı çözülür; polis/jandarma/ambulans/itfaiye/taksi/belediye/
 * TOMA/zırhlı sınıfları için görev renkleri kullanıcı renginden bağımsızdır.
 */
import React from 'react';
import * as THREE from 'three';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { makeArac3DV2 } from './Arac3DV2.js';

/** cm -> sahne birimi çarpanı (uygulamadaki `s` ile aynı olmalı) */
const SCALE = 0.55;

const Arac3D = makeArac3DV2({
  e: { jsx, jsxs, Fragment },
  O: React,
  s: SCALE,
  qe: THREE.Shape,
  rs: THREE.ExtrudeGeometry,
});

export default Arac3D;
export { Arac3D };
