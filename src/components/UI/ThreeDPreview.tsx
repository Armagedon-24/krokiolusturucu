import React, { Suspense, useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  PerspectiveCamera, 
  useTexture, 
  TransformControls,
  PointerLockControls
} from '@react-three/drei';
// NOT: drei <Environment preset=...> kaldırıldı — dış CDN'den (raw.githack.com) HDR indirmeye
// çalışıyordu. İstek başarısız olduğunda hata sınırı olmadığı için TÜM UYGULAMA çöküyordu
// (boş siyah ekran). Artık sahne tamamen yerel ışıklarla aydınlatılıyor; çevrimdışı da çalışır.
import { X, Rotate3D, Footprints, RotateCw, ArrowDown, Camera, Video, Square, FolderOpen, Images, Download, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { withBase } from '../../utils/assetMigration';
import * as THREE from 'three';
import { Animal3D } from './Animal3D';
// @ts-ignore
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';

/**
 * 3D PREVIEW ENGINE - FORENSIC INTEGRITY STANDARDS:
 * 1. SPATIAL OCCLUSION: All impact markers (holes/wounds) MUST use THREE.FrontSide to ensure they are 
 *    hidden by solid geometry (walls/doors/bodies) when viewed from the opposite side.
 * 2. GROUNDED ASSETS: Non-architectural objects (Mannequins, Furniture) MUST default to zHeight: 0 
 *    to prevent floating artifacts.
 * 3. METRIC PARITY: 1 unit = 2cm (SCALE = 0.5) to maintain 1:1 parity with the 2D grid.
 */
const SCALE = 0.55;

interface ThreeDPreviewProps {
  isOpen: boolean;
  onClose: () => void;
}

const getSymbolId = (o: any) => {
  if (!o) return '';
  if (typeof o === 'string') return o.toLowerCase();
  return (o.symbolId || o.id || '').toLowerCase();
};

const isDoor = (o: any) => {
  if (!o) return false;
  const s = getSymbolId(o);
  return s.includes('door') || s.includes('kapı') || s.includes('kapi') || s.startsWith('arch-d');
};

const isWindow = (o: any) => {
  if (!o) return false;
  const s = getSymbolId(o);
  return s.includes('win') || s.includes('pencere') || s.startsWith('arch-win');
};

const getEffectiveSize = (obj: any) => {
  const w = (obj.width || 0) * (obj.scaleX || 1);
  const h = (obj.height || 0) * (obj.scaleY || 1);
  return { width: w, height: h };
};

/**
 * 2D KAĞIT / ŞABLON NESNELERİ 3B'YE TAŞINMAZ.
 * Kağıt zemini, form tabloları, çizgi ölçüleri, metinler, bulgu listesi tablosu ve
 * ölçü/açıklama okları yalnızca 2D kroki dökümanına ait ekran öğeleridir; 3B sahnede
 * dev kutular/barlar olarak çizilmeleri sahneyi bozuyordu. Ayrıca gizli (hidden)
 * nesneler de 3B'de gösterilmez.
 */
const NON_3D_OBJECT_TYPES = ['text', 'rect', 'line', 'finding-list'];
const NON_3D_SYMBOL_IDS = [
  'a-5',                           // yön oku (2D şema) — mesafe oku (a-4) artık 3B'de havada gösterilir
  'ev-callout',                    // açıklama balonu
  'ev-arrow-desc',                 // açıklama oku (çerçeveli)
  'ev-arrow-desc-ellipse',
  'ev-arrowhead',
  'ev-north-arrow',                // kuzey oku (kağıt işareti)
  'ev-camera-link',
];
interface Non3DCheckable { hidden?: boolean; type?: string; symbolId?: string; isDistanceArrow?: boolean }
const isNon3DObject = (o?: Non3DCheckable | null): boolean => {
  if (!o) return true;
  if (o.hidden) return true;
  // Mesafe oku (isDistanceArrow) 3B sahneye alınır: ok + mesafe etiketi havada süzülür.
  if (o.isDistanceArrow) return false;
  if (NON_3D_OBJECT_TYPES.includes(o.type || '')) return true;
  const s = (o.symbolId || '').toLowerCase();
  if (!s) return true; // symbolId taşımayan her nesne kağıt/form öğesidir
  return NON_3D_SYMBOL_IDS.some((n) => s === n || s.startsWith(n));
};

/**
 * ZEMİN DECAL'LERİ — iz, delil ve işaret sembolleri 3B'de kutu olarak değil,
 * zeminde neredeyse düz bir levha olarak çizilmelidir (2D konumla birebir okunur).
 */
const FLAT_DECAL_PREFIXES = [
  'tr-', 'ei-', 'ex-',
  'ev-circle', 'ev-square', 'ev-rect', 'ev-lshape', 'ev-crack', 'ev-rope',
  'ev-ruler', 'ev-scale', 'ev-abfo', 'ev-angle', 'ev-bpa', 'ev-shoe', 'ev-tool',
];
const isFlatDecalId = (sId: string): boolean =>
  FLAT_DECAL_PREFIXES.some((p) => sId.startsWith(p));
/** Zemin decal kalınlığı (cm) — 3B'de ince bir tabaka gibi durur */
const FLAT_DECAL_HEIGHT_CM = 2.5;

const Wall = ({ x, y, width, rotation, h = 250, yOffset = 0, wallColor, wallThickness }: any) => {
  const thickness = wallThickness || (10 * SCALE);
  const rad = -rotation * (Math.PI / 180);
  
  // 1:1 POSITIONING: x and y are already the scaled center coordinates
  const posX = x;
  const posZ = y;

  return (
    <mesh position={[posX, (h * SCALE) / 2 + yOffset, posZ]} rotation={[0, rad, 0]}>
      <boxGeometry args={[width, h * SCALE, thickness]} />
      <meshStandardMaterial color={wallColor || "#2c3e50"} metalness={0.1} roughness={0.8} />
    </mesh>
  );
};

const Door3D = ({ x, y, width, h, rad, thickness = 10 * SCALE, zOffset }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const openAngle = isOpen ? -Math.PI / 2 : 0;
  const frameColor = "#4d2e14"; 
  const frameThickness = 3 * SCALE;
  const panelWidth = width - frameThickness * 2;
  const realW = width;

  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, rad, 0]}>
      {/* Frame Left */}
      <mesh position={[-realW / 2 + frameThickness / 2, h / 2, 0]}>
        <boxGeometry args={[frameThickness, h, thickness + 1 * SCALE]} />
        <meshStandardMaterial color={frameColor} />
      </mesh>
      {/* Frame Right */}
      <mesh position={[realW / 2 - frameThickness / 2, h / 2, 0]}>
        <boxGeometry args={[frameThickness, h, thickness + 1 * SCALE]} />
        <meshStandardMaterial color={frameColor} />
      </mesh>
      {/* Frame Top */}
      <mesh position={[0, h - frameThickness / 2, 0]}>
        <boxGeometry args={[realW, frameThickness, thickness + 1 * SCALE]} />
        <meshStandardMaterial color={frameColor} />
      </mesh>

      {/* Door Leaf */}
      <group position={[realW / 2 - frameThickness, 0, 0]} rotation={[0, openAngle, 0]}>
        <mesh position={[-panelWidth / 2, h / 2, 0]} onClick={() => setIsOpen(!isOpen)}>
          <boxGeometry args={[panelWidth, h - frameThickness, 2.5 * SCALE]} />
          <meshStandardMaterial color="#c19a6b" />
        </mesh>
      </group>
    </group>
  );
};

const Window3D = ({ obj, updateObject, x, y, width, h, rad, sillH, thickness, zOffset }: any) => {
  const isOpen = obj?.customData?.isOpen || false;
  const setIsOpen = (val: boolean) => {
    if (obj && updateObject) {
      updateObject(obj.id, { customData: { ...(obj.customData || {}), isOpen: val } });
    }
  };
  const openAngle = isOpen ? -Math.PI / 3 : 0; 
  
  const frameColor = "#333333";
  const frameThickness = 3 * SCALE;
  const sashThickness = 2 * SCALE;
  const glassWidth = (width - frameThickness * 3) / 2; 
  const glassHeight = h - frameThickness * 2;
  const pervazW = 4 * SCALE;
  const pervazT = 1 * SCALE;
  
  return (
    <group position={[x, sillH + (zOffset || 0), y]} rotation={[0, rad, 0]}>
      {/* Outer Frame */}
      <mesh position={[-width / 2 + frameThickness / 2, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[frameThickness, h, thickness + 0.5 * SCALE]} />
        <meshStandardMaterial color={frameColor} roughness={0.3} />
      </mesh>
      <mesh position={[width / 2 - frameThickness / 2, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[frameThickness, h, thickness + 0.5 * SCALE]} />
        <meshStandardMaterial color={frameColor} roughness={0.3} />
      </mesh>
      <mesh position={[0, frameThickness / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, frameThickness, thickness + 0.5 * SCALE]} />
        <meshStandardMaterial color={frameColor} roughness={0.3} />
      </mesh>
      <mesh position={[0, h - frameThickness / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, frameThickness, thickness + 0.5 * SCALE]} />
        <meshStandardMaterial color={frameColor} roughness={0.3} />
      </mesh>
      
      {/* Kayıtlar (Orta Direkler) */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[frameThickness, h, thickness + 0.5 * SCALE]} />
        <meshStandardMaterial color={frameColor} roughness={0.3} />
      </mesh>

      {/* Pervazlar */}
      {[-(thickness/2 + pervazT/2), (thickness/2 + pervazT/2)].map((zPos, i) => (
        <group key={i} position={[0, 0, zPos]}>
          <mesh position={[-width/2 - pervazW/2 + frameThickness/2, h/2, 0]} castShadow>
            <boxGeometry args={[pervazW, h + pervazW*2, pervazT]} />
            <meshStandardMaterial color={frameColor} />
          </mesh>
          <mesh position={[width/2 + pervazW/2 - frameThickness/2, h/2, 0]} castShadow>
            <boxGeometry args={[pervazW, h + pervazW*2, pervazT]} />
            <meshStandardMaterial color={frameColor} />
          </mesh>
          <mesh position={[0, h + pervazW/2 - frameThickness/2, 0]} castShadow>
            <boxGeometry args={[width + pervazW*2, pervazW, pervazT]} />
            <meshStandardMaterial color={frameColor} />
          </mesh>
          <mesh position={[0, -pervazW/2 + frameThickness/2, 0]} castShadow>
            <boxGeometry args={[width + pervazW*2, pervazW, pervazT]} />
            <meshStandardMaterial color={frameColor} />
          </mesh>
        </group>
      ))}
      
      {/* Left Glass & Sash (Fixed) */}
      <group position={[-(glassWidth + frameThickness) / 2, h / 2, 0]}>
        {/* Sash Bars */}
        <mesh position={[-(glassWidth/2), 0, 0]} castShadow>
          <boxGeometry args={[1 * SCALE, glassHeight, sashThickness]} />
          <meshStandardMaterial color={frameColor} />
        </mesh>
        <mesh position={[glassWidth/2, 0, 0]} castShadow>
          <boxGeometry args={[1 * SCALE, glassHeight, sashThickness]} />
          <meshStandardMaterial color={frameColor} />
        </mesh>
        <mesh position={[0, glassHeight/2, 0]} castShadow>
          <boxGeometry args={[glassWidth + 1 * SCALE, 1 * SCALE, sashThickness]} />
          <meshStandardMaterial color={frameColor} />
        </mesh>
        <mesh position={[0, -glassHeight/2, 0]} castShadow>
          <boxGeometry args={[glassWidth + 1 * SCALE, 1 * SCALE, sashThickness]} />
          <meshStandardMaterial color={frameColor} />
        </mesh>
        {/* Glass */}
        <mesh>
          <boxGeometry args={[glassWidth, glassHeight, 0.5 * SCALE]} />
          <meshStandardMaterial color="#add8e6" transparent opacity={0.3} roughness={0.1} metalness={0.9} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
      
      {/* Right Glass & Sash (Openable) */}
      <group position={[width / 2 - frameThickness, h / 2, 0]} rotation={[0, openAngle, 0]}>
        <group position={[-glassWidth / 2, 0, 0]} onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
          {/* Sash Bars */}
          <mesh position={[-(glassWidth/2), 0, 0]} castShadow>
            <boxGeometry args={[1 * SCALE, glassHeight, sashThickness]} />
            <meshStandardMaterial color={frameColor} />
          </mesh>
          <mesh position={[glassWidth/2, 0, 0]} castShadow>
            <boxGeometry args={[1 * SCALE, glassHeight, sashThickness]} />
            <meshStandardMaterial color={frameColor} />
          </mesh>
          <mesh position={[0, glassHeight/2, 0]} castShadow>
            <boxGeometry args={[glassWidth + 1 * SCALE, 1 * SCALE, sashThickness]} />
            <meshStandardMaterial color={frameColor} />
          </mesh>
          <mesh position={[0, -glassHeight/2, 0]} castShadow>
            <boxGeometry args={[glassWidth + 1 * SCALE, 1 * SCALE, sashThickness]} />
            <meshStandardMaterial color={frameColor} />
          </mesh>
          {/* Glass */}
          <mesh>
            <boxGeometry args={[glassWidth, glassHeight, 0.5 * SCALE]} />
            <meshStandardMaterial color="#add8e6" transparent opacity={0.4} roughness={0.1} metalness={0.9} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
};

const WOUND_IN_SVG = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iMTUiIGZpbGw9IiMwMDAwMDAiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSIxMiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOTkwMDAwIiBzdHJva2Utd2lkdGg9IjQiLz48L3N2Zz4=`;
const WOUND_OUT_SVG = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHBhdGggZD0iTSA1MCAyMCBMIDYwIDQwIEwgODAgNDUgIEwgNjUgNjAgIEwgNzAgODAgIEwgNTAgNzAgIEwgMzAgODAgIEwgMzUgNjAgIEwgMjAgNDUgIEwgNDAgNDAgWiIgZmlsbD0iIzk5MDAwMCIgc3Ryb2tlPSIjNjYwMDAwIiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=`;

class SafeComponent extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(_error: any, _errorInfo: any) {
    // Silently recover — errors logged in dev by React DevTools
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    // Her sembol kendi Suspense sınırına sarılır: bir sembolün dokusu yüklenirken
    // (useTexture suspend) yalnızca O sembol gizlenir, tüm sahne kararmaz.
    return <Suspense fallback={null}>{this.props.children}</Suspense>;
  }
}

/**
 * SAHNE KALKANI: Canvas İÇİNDEKİ herhangi bir hata (ör. bozuk doku, beklenmeyen geometri)
 * burada yakalanır ve hata dışarı sızdırılarak uygulamanın tamamı çökertilmez.
 * R3F ayrı bir React kökü kullandığı için hata sınırı Canvas DIŞINDA olsa bile
 * iç kökten gelen hata tüm ağacı düşürebilir — bu nedenle sınır içeridedir.
 */
class SceneErrorShield extends React.Component<{ children: React.ReactNode; onError?: (err: Error) => void }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error('3D sahne hatası yakalandı (uygulama korunudu):', error);
    this.props.onError?.(error);
  }
  render() {
    if (this.state.hasError) return null;
    return <Suspense fallback={null}>{this.props.children}</Suspense>;
  }
}

/**
 * TUVAL HATA SINIRI: <Canvas>'ın kendisinde (dış kök) oluşan hatalar için son savunma hattı.
 * Uygulama yerine kullanıcıya anlaşılır bir hata kartı gösterir — BOŞ EKRAN ASLA GÖRÜNMEZ.
 */
class CanvasErrorBoundary extends React.Component<{ children: React.ReactNode; onRetry: () => void }, { error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('3D tuval hatası yakalandı:', error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] z-10">
          <div className="max-w-md bg-[#1a1a1a] border border-red-500/30 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
            <div className="text-4xl">⚠️</div>
            <h3 className="text-white font-black text-sm uppercase tracking-widest">3D Görünüm Yüklenemedi</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              Sahne oluşturulurken beklenmeyen bir hata oluştu. Tekrar deneyebilirsiniz;
              sorun sürerse çiziminizi kaydedip sayfayı yenileyin.
            </p>
            <p className="text-red-400/60 text-[10px] font-mono break-words max-h-16 overflow-hidden">{this.state.error.message}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-5 py-2 bg-[#3a7ca5] hover:bg-[#4a8cb5] text-white rounded-lg text-xs font-black tracking-wider transition-colors"
            >
              TEKRAR DENE
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const Player = ({ isWalkMode, contentRef }: { isWalkMode: boolean; contentRef?: React.RefObject<THREE.Group | null> }) => {
  const { camera } = useThree();
  const moveState = useRef({ forward: false, backward: false, left: false, right: false });

  useEffect(() => {
    if (!isWalkMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': moveState.current.forward = true; break;
        case 'KeyS': moveState.current.backward = true; break;
        case 'KeyA': moveState.current.left = true; break;
        case 'KeyD': moveState.current.right = true; break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': moveState.current.forward = false; break;
        case 'KeyS': moveState.current.backward = false; break;
        case 'KeyA': moveState.current.left = false; break;
        case 'KeyD': moveState.current.right = false; break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    // Başlangıç noktası: sahnenin GERÇEK içerik kutusundan türetilir. Sabit (0, z)
    // noktası oda dışına düşebiliyor ve açılışta duvar yüzü gösteriyordu.
    let sx = 0, sz = 150 * SCALE, tx = 0, tz = 0;
    const g = contentRef?.current;
    if (g) {
      const box = new THREE.Box3().setFromObject(g);
      if (isFinite(box.min.x)) {
        const c = new THREE.Vector3(); box.getCenter(c);
        const s = new THREE.Vector3(); box.getSize(s);
        sx = c.x;
        sz = c.z + Math.min(s.z * 0.28, 80);
        tx = c.x;
        tz = c.z - s.z * 0.5;
      }
    }
    // Set starting position at eye level of 175cm looking forward
    camera.position.set(sx, 175 * SCALE, sz);
    camera.lookAt(tx, 175 * SCALE, tz);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isWalkMode, camera, contentRef]);

  useFrame((_, delta) => {
    if (!isWalkMode) return;
    const speed = 180 * delta;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();

    const side = new THREE.Vector3().crossVectors(camera.up, dir).normalize();

    if (moveState.current.forward) camera.position.addScaledVector(dir, speed);
    if (moveState.current.backward) camera.position.addScaledVector(dir, -speed);
    if (moveState.current.left) camera.position.addScaledVector(side, speed);
    if (moveState.current.right) camera.position.addScaledVector(side, -speed);
    
    camera.position.y = 175 * SCALE;
  });

  return isWalkMode ? <PointerLockControls /> : null;
};

const Humanoid3D = ({ obj, zOffset }: any) => {
  const scale = SCALE; 
  
  const effSymbolId = obj.symbolId || (obj.id ? obj.id.split('-').slice(0, 2).join('-') : '');
  
  const isHumanSrc = obj.src && typeof obj.src === 'string' && (
    obj.src.includes('standing-woman.png') || 
    obj.src.includes('woman')
  );
  const isFemale = effSymbolId === 'p-2' || isHumanSrc;
  
  const skinColor = "#e0ac69";
  const shirtColor = isFemale ? "#d87093" : "#3a7ca5";
  const pantsColor = "#2f4f4f";
  const hairColor = isFemale ? "#4a3018" : "#2b1d14";
  const shoeColor = "#1a1a1a";

  const pose = obj.pose || 'standing';
  const isProne = pose === 'prone';
  const isSupine = pose === 'supine';

  // If lying down, base height is much lower
  const baseCenterHeight = (isProne || isSupine) ? (10 * scale) : (80 * scale);
  const poseRotation: [number, number, number] = isProne ? [Math.PI / 2, 0, 0] : isSupine ? [-Math.PI / 2, 0, 0] : [0, 0, 0];

  return (
    <group position={[0, baseCenterHeight + (zOffset || 0), 0]} rotation={poseRotation}>
      
      {/* --- HEAD & FACE --- */}
      <group position={[0, 80 * scale, 0]}>
        {/* Head Base */}
        <mesh castShadow>
          <sphereGeometry args={[10 * scale, 32, 32]} />
          <meshStandardMaterial color={skinColor} roughness={0.4} />
        </mesh>
        {/* Hair */}
        <mesh position={[0, 4 * scale, -2 * scale]} scale={[1.05, 0.9, 1.05]} castShadow>
          <sphereGeometry args={[10 * scale, 32, 32]} />
          <meshStandardMaterial color={hairColor} roughness={0.8} />
        </mesh>
        {/* Eyes */}
        <mesh position={[-3.5 * scale, 2 * scale, 8.5 * scale]} castShadow>
          <sphereGeometry args={[1.2 * scale, 16, 16]} />
          <meshStandardMaterial color="#111" roughness={0.2} />
        </mesh>
        <mesh position={[3.5 * scale, 2 * scale, 8.5 * scale]} castShadow>
          <sphereGeometry args={[1.2 * scale, 16, 16]} />
          <meshStandardMaterial color="#111" roughness={0.2} />
        </mesh>
        {/* Nose */}
        <mesh position={[0, -1 * scale, 10 * scale]} castShadow>
          <sphereGeometry args={[1.5 * scale, 16, 16]} />
          <meshStandardMaterial color="#c28b55" roughness={0.5} />
        </mesh>
        {/* Mouth */}
        <mesh position={[0, -4 * scale, 9 * scale]} castShadow>
          <boxGeometry args={[5 * scale, 1 * scale, 1 * scale]} />
          <meshStandardMaterial color="#aa5555" roughness={0.6} />
        </mesh>
      </group>

      {/* --- NECK --- */}
      <mesh position={[0, 65 * scale, 0]} castShadow>
        <cylinderGeometry args={[4 * scale, 5 * scale, 10 * scale, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.4} />
      </mesh>

      {/* --- TORSO --- */}
      <mesh position={[0, 30 * scale, 0]} castShadow>
        <capsuleGeometry args={isFemale ? [13 * scale, 35 * scale, 16, 16] : [15 * scale, 32 * scale, 16, 16]} />
        <meshStandardMaterial color={shirtColor} roughness={0.8} />
      </mesh>

      {/* --- ARMS --- */}
      {/* Left Shoulder */}
      <mesh position={[-17 * scale, 52 * scale, 0]} castShadow>
        <sphereGeometry args={[6.5 * scale, 32, 32]} />
        <meshStandardMaterial color={shirtColor} roughness={0.8} />
      </mesh>
      {/* Left Upper Arm */}
      <mesh position={[-18 * scale, 35 * scale, 0]} castShadow>
        <capsuleGeometry args={[4 * scale, 22 * scale, 8, 16]} />
        <meshStandardMaterial color={shirtColor} roughness={0.8} />
      </mesh>
      {/* Left Elbow */}
      <mesh position={[-18 * scale, 20 * scale, 0]} castShadow>
        <sphereGeometry args={[4 * scale, 16, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.5} />
      </mesh>
      {/* Left Forearm */}
      <mesh position={[-18 * scale, 8 * scale, 2 * scale]} rotation={[Math.PI / 16, 0, 0]} castShadow>
        <capsuleGeometry args={[3.5 * scale, 20 * scale, 8, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.5} />
      </mesh>

      {/* Right Shoulder */}
      <mesh position={[17 * scale, 52 * scale, 0]} castShadow>
        <sphereGeometry args={[6.5 * scale, 32, 32]} />
        <meshStandardMaterial color={shirtColor} roughness={0.8} />
      </mesh>
      {/* Right Upper Arm */}
      <mesh position={[19 * scale, 35 * scale, 0]} castShadow>
        <capsuleGeometry args={[4 * scale, 22 * scale, 8, 16]} />
        <meshStandardMaterial color={shirtColor} roughness={0.8} />
      </mesh>

      {/* --- LEGS --- */}
      {/* Left Thigh */}
      <mesh position={[-8 * scale, -22 * scale, 0]} castShadow>
        <capsuleGeometry args={[6 * scale, 30 * scale, 8, 16]} />
        <meshStandardMaterial color={pantsColor} roughness={0.9} />
      </mesh>
      {/* Left Calf */}
      <mesh position={[-8 * scale, -58 * scale, 0]} castShadow>
        <capsuleGeometry args={[4.5 * scale, 30 * scale, 8, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.5} />
      </mesh>
      {/* Left Shoe */}
      <mesh position={[-8 * scale, -77 * scale, 3 * scale]} castShadow>
        <boxGeometry args={[8.5 * scale, 6 * scale, 15 * scale]} />
        <meshStandardMaterial color={shoeColor} roughness={0.7} />
      </mesh>

      {/* Right Thigh */}
      <mesh position={[8 * scale, -22 * scale, 0]} castShadow>
        <capsuleGeometry args={[6 * scale, 30 * scale, 8, 16]} />
        <meshStandardMaterial color={pantsColor} roughness={0.9} />
      </mesh>
      {/* Right Calf */}
      <mesh position={[8 * scale, -58 * scale, 0]} castShadow>
        <capsuleGeometry args={[4.5 * scale, 30 * scale, 8, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.5} />
      </mesh>
      {/* Right Shoe */}
      <mesh position={[8 * scale, -77 * scale, 3 * scale]} castShadow>
        <boxGeometry args={[8.5 * scale, 6 * scale, 15 * scale]} />
        <meshStandardMaterial color={shoeColor} roughness={0.7} />
      </mesh>
    </group>
  );
};

const ModernHandgun3D = ({ position, target }: any) => {
  // lookAt makes -Z point to target.
  const matrix = new THREE.Matrix4().lookAt(position, target, new THREE.Vector3(0, 1, 0));
  const quat = new THREE.Quaternion().setFromRotationMatrix(matrix);
  
  const gunLength = 18 * SCALE;

  return (
    <group position={[position.x, position.y, position.z]} quaternion={quat}>
      {/* Since lookAt makes -Z point to target, our model should extend into +Z from the muzzle at [0,0,0] */}
      <group position={[0, 0, 0]}>
        {/* Slide - extending back along +Z */}
        <mesh position={[0, 0, gunLength / 2]} castShadow>
          <boxGeometry args={[3.2 * SCALE, 4.2 * SCALE, gunLength]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Barrel Tip (Muzzle) at Origin */}
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.9 * SCALE, 0.9 * SCALE, 0.5 * SCALE, 16]} />
          <meshBasicMaterial color="#000" />
        </mesh>
        {/* Rear Sight (at the back) */}
        <mesh position={[0, 2.5 * SCALE, gunLength - 2 * SCALE]}>
          <boxGeometry args={[2 * SCALE, 1 * SCALE, 0.5 * SCALE]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        {/* Front Sight (near the muzzle) */}
        <mesh position={[0, 2.5 * SCALE, 1 * SCALE]}>
          <boxGeometry args={[0.8 * SCALE, 1 * SCALE, 0.5 * SCALE]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        {/* Grip */}
        <mesh position={[0, -6 * SCALE, gunLength - 6 * SCALE]} rotation={[-Math.PI / 6, 0, 0]} castShadow>
          <boxGeometry args={[3 * SCALE, 11 * SCALE, 5 * SCALE]} />
          <meshStandardMaterial color="#111" roughness={0.9} />
        </mesh>
        {/* Trigger Guard */}
        <mesh position={[0, -2.5 * SCALE, gunLength - 10 * SCALE]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[2.2 * SCALE, 0.4 * SCALE, 8, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>
    </group>
  );
};

const ShootingTrajectory3D = ({ obj, allWalls, visualObjects, uploadedImages }: any) => {
  // Use stable static paths for textures — avoids hook-order violations from dynamic store reads
  const isabetIziSrc = uploadedImages?.find((img: any) => {
    if (!img || typeof img.name !== 'string') return false;
    const name = img.name.toLowerCase().replace(/[-_\s]/g, '');
    return name === 'isabetizipng' || name === 'isabetizi';
  })?.src;

  // Stable texture sources — never change between renders to preserve hook order
  const GLASS_TEX_SRC = '/assets/symbols/bullet_hole_1.png';
  const WALL_TEX_SRC_DEFAULT = '/assets/symbols/bullet_hole_2.webp';

  const glassTex = useTexture(withBase(GLASS_TEX_SRC)) as THREE.Texture;
  // Always load static wall texture - hook must always be called with the same arg
  const wallTex = useTexture(withBase(WALL_TEX_SRC_DEFAULT)) as THREE.Texture;
  const woundInTex = useTexture(WOUND_IN_SVG) as THREE.Texture;
  const woundOutTex = useTexture(WOUND_OUT_SVG) as THREE.Texture;

  // If an uploaded İsabet İzi image is available, create a Three.js texture from it (no hook)
  const effectiveWallTex = React.useMemo(() => {
    if (isabetIziSrc && typeof isabetIziSrc === 'string' && isabetIziSrc.trim() !== '') {
      const loader = new THREE.TextureLoader();
      return loader.load(isabetIziSrc);
    }
    return wallTex;
  }, [isabetIziSrc, wallTex]);

  
  const { visualSettings } = useStore();
  const wallThicknessFromStore = ((visualSettings as any)?.wallThickness || 10) * SCALE;

  const lSx = obj.wSx;
  const lSy = obj.wSz;
  const lEx = obj.wEx;
  const lEy = obj.wEz;

  // Memoize all expensive coordinate math — only recomputes when coords/tilt change
  const trajCalc = useMemo(() => {
    if (lSx === undefined || lEx === undefined || isNaN(lSx) || isNaN(lEx)) return null;
    const zH = (obj.zHeight || 120) * SCALE;
    const tilt = obj.tilt || 0;
    const wSx = lSx, wSz = lSy, wEx = lEx, wEz = lEy;
    const dx_world = wEx - wSx;
    const dz_world = wEz - wSz;
    const distance2D = Math.sqrt(dx_world * dx_world + dz_world * dz_world);
    const dy_world = distance2D * Math.tan(tilt * Math.PI / 180);
    const targetZH = zH + dy_world;
    const distance3D = Math.sqrt(distance2D * distance2D + dy_world * dy_world);
    if (isNaN(distance3D) || distance3D === 0) return null;
    const mx = (wSx + wEx) / 2;
    const my = (zH + targetZH) / 2;
    const mz = (wSz + wEz) / 2;
    if (isNaN(mx) || isNaN(my) || isNaN(mz)) return null;
    const direction = new THREE.Vector3(wEx - wSx, targetZH - zH, wEz - wSz).normalize();
    const quaternion = new THREE.Quaternion();
    if (direction.lengthSq() > 0.001) {
      quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    }
    return { zH, targetZH, distance2D, distance3D, direction, quaternion, wSx, wSz, wEx, wEz, relSx: lSx, relSy: lSy, relEx: lEx, relEy: lEy };
  }, [lSx, lSy, lEx, lEy, obj.zHeight, obj.tilt]);

  if (!trajCalc) return null;
  const { zH, targetZH, distance3D, direction, quaternion, wSx, wSz, wEx, wEz, relSx, relSy, relEx, relEy } = trajCalc;
  
  const holes: any[] = [];
  
  const checkIntersections = (items: any[], isWindowObj: boolean) => {
    // 3D extend direction of the ray
    const dir3D = new THREE.Vector3(wEx - wSx, targetZH - zH, wEz - wSz).normalize();
    const extStart = new THREE.Vector3(wSx, zH, wSz).addScaledVector(dir3D, -100 * SCALE);
    const extEnd = new THREE.Vector3(wEx, targetZH, wEz).addScaledVector(dir3D, 100 * SCALE);

    const extWSx = extStart.x;
    const extWSz = extStart.z;
    const extZHStart = extStart.y;
    
    const extWEx = extEnd.x;
    const extWEz = extEnd.z;
    const extZHEnd = extEnd.y;

    items.forEach((item: any, idx: number) => {
        const r = (item.rotation || 0) * (Math.PI / 180);
        const cos = Math.cos(r);
        const sin = Math.sin(r);
        
        const dx1 = extWSx - item.x;
        const dy1 = extWSz - item.y;
        const lx1 = dx1 * cos - dy1 * sin;
        const lz1 = dx1 * sin + dy1 * cos;
        
        const dx2 = extWEx - item.x;
        const dy2 = extWEz - item.y;
        const lx2 = dx2 * cos - dy2 * sin;
        const lz2 = dx2 * sin + dy2 * cos;
      
      // ── PHYSICS-BASED INTERSECTION ─────────────────────────────────────
      // Helper: get traj_param (0 = barrel, distance3D = endpoint) for a world hit
      const trajParam = (hx: number, hy: number, hz: number) =>
        dir3D.x * (hx - wSx) + dir3D.y * (hy - zH) + dir3D.z * (hz - wSz);

      const pushHole = (hitX: number, finalHitY: number, hitZ: number, faceDir: number, hitIdx: number) => {
        const wallRotRad = (item.rotation || 0) * Math.PI / 180;
        const fnX = -Math.sin(wallRotRad);
        const fnZ = Math.cos(wallRotRad);
        const normalOffset = 0.4 * SCALE * faceDir;
        const q = new THREE.Quaternion();
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(fnX, 0, fnZ).multiplyScalar(faceDir));
        holes.push({
          id: `hole-${isWindowObj ? 'win' : 'wall'}-${idx}-${hitIdx}`,
          x: hitX + fnX * normalOffset,
          y: finalHitY,
          z: hitZ + fnZ * normalOffset,
          isWindow: isWindowObj, rotY: item.rotation || 0, faceDir, quaternion: q,
        });
      };

      if (isWindowObj) {
        // Windows: single decal, always shown when hit
        const tVal = lz1 / (lz1 - lz2 || 1);
        if (tVal >= 0 && tVal <= 1) {
          const tHit = tVal;
          const ix = lx1 + tHit * (lx2 - lx1);
          if (Math.abs(ix) <= item.width / 2) {
            const iy = extZHStart + tHit * (extZHEnd - extZHStart);
            const rawZHeight = item.zHeight || 120;
            const rawSillH = item.sillH !== undefined ? item.sillH : Math.max(0, 125 - rawZHeight / 2);
            const yOff = (item.yOffset || 0) * SCALE;
            const minY = rawSillH * SCALE + yOff;
            const maxY = minY + rawZHeight * SCALE;
            if (iy >= minY && iy <= maxY) {
              const hitX = extWSx + tHit * (extWEx - extWSx);
              const hitZ = extWSz + tHit * (extWEz - extWSz);
              const tp = trajParam(hitX, iy, hitZ);
              if (tp >= 0 && tp <= distance3D) {
                pushHole(hitX, iy, hitZ, lz1 > 0 ? 1 : -1, 0);
              }
            }
          }
        }
      } else {
        // Walls: physics-based — entry always, exit only if bullet passes through
        const wallThickness = wallThicknessFromStore;
        // Original working formulas (explicit, no destructuring)
        const tPos = (lz1 - wallThickness / 2) / (lz1 - lz2 || 1); // front face
        const tNeg = (lz1 + wallThickness / 2) / (lz1 - lz2 || 1); // back face

        const rawHits: { t: number; faceDir: number }[] = [];
        if (tPos >= 0 && tPos <= 1) rawHits.push({ t: tPos, faceDir: 1 });
        if (tNeg >= 0 && tNeg <= 1) rawHits.push({ t: tNeg, faceDir: -1 });
        // Sort so the first hit is closest to the gun barrel
        rawHits.sort((a, b) => a.t - b.t);

        rawHits.forEach((hit, hitIdx) => {
          const tHit = hit.t;
          const ix = lx1 + tHit * (lx2 - lx1);
          if (Math.abs(ix) > item.width / 2) return;
          const iy = extZHStart + tHit * (extZHEnd - extZHStart);
          const minY = (item.yOffset || 0) * SCALE;
          const maxY = minY + (item.h || 250) * SCALE;
          if (iy < minY || iy > maxY) return;
          const hitX = extWSx + tHit * (extWEx - extWSx);
          const hitZ = extWSz + tHit * (extWEz - extWSz);
          // Distance along trajectory (0 = barrel tip, distance3D = endpoint)
          const tp = dir3D.x * (hitX - wSx) + dir3D.y * (iy - zH) + dir3D.z * (hitZ - wSz);
          if (hitIdx === 0) {
            // Entry: bullet must reach this face
            if (tp < 0 || tp > distance3D) return;
          } else {
            // Exit: only show if bullet endpoint is past this face
            if (tp > distance3D) return;
          }
          pushHole(hitX, iy, hitZ, hit.faceDir, hitIdx);
        });
      }
    });
  };

if (allWalls) checkIntersections(allWalls, false);

  // ── DEDUPLICATION: camda hem cam hem duvar izi oluşmasını önle ──────────
  // Cam izi 2. passtan geldiği için bu deduplication daha sonra yeniden uygulanacak.
  // İlk geçişte tüm duvar izlerini al (henüz cam izi eklenmedi)
  const dedupedHoles: any[] = holes.filter(() => true); // tüm 1.pass izleri

  // ── TRAJECTORY LINE: silah namlu ucundan çıkarak tüm isabet izlerinin merkezinden geçer ──
  const rayDir3D = direction.clone(); // already normalized above
  const gunBarrelOrigin = new THREE.Vector3(relSx, zH, relSy); // barrel tip in world space

  // Project each hole onto the ray to get its t parameter
  // Use raw intersection point (before surfaceOffset) = hole minus the tiny normal offset
  let minT = 0;
  let maxT = distance3D;
  dedupedHoles.forEach((hole: any) => {
    const hv = new THREE.Vector3(hole.x - gunBarrelOrigin.x, hole.y - gunBarrelOrigin.y, hole.z - gunBarrelOrigin.z);
    const t = hv.dot(rayDir3D);
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
  });

  // 2nd pass: glass marks projected exactly onto ray; mannequin wounds at correct body height
  const addedWindowObjectIds = new Set<string>();
  // Collect mannequin wounds separately so we can order entry/exit by t
  const mankWounds: { t: number; x: number; y: number; z: number; isEntry: boolean; quaternion: any }[] = [];

  if (visualObjects) {
    visualObjects.forEach((h: any) => {
      const sId = (h.symbolId || '').toLowerCase();
      const isGlassMark = sId === 'tr-bullet-glass';
      const isWallMark  = sId === 'tr-bullet-wall';
      const isMankIn    = sId === 'in-bullet-in';
      const isMankOut   = sId === 'in-bullet-out';

      const hasParent = !!h.parentId;
      if (!hasParent && !isGlassMark && !isWallMark && !isMankIn && !isMankOut) return;

      // ── GLASS ────────────────────────────────────────────────────────────
      if (isGlassMark) {
        if (addedWindowObjectIds.has(h.id)) return;
        addedWindowObjectIds.add(h.id);

        // Calculate exact intersection of the ray with the window's vertical plane
        const vRotRad = -(h.rotation || 0) * Math.PI / 180;
        const faceNormal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), vRotRad);
        
        const denom = rayDir3D.dot(faceNormal);
        let t = 0;
        if (Math.abs(denom) > 0.0001) {
          // A point on the window vertical plane (Y is free, we use gunBarrelOrigin.y for simple XZ plane math)
          const winPlanePoint = new THREE.Vector3(h.x, gunBarrelOrigin.y, h.y);
          t = winPlanePoint.clone().sub(gunBarrelOrigin).dot(faceNormal) / denom;
        } else {
          // Fallback to closest projection on the ray if parallel
          const markPos = new THREE.Vector3(h.x, (h.zHeight !== undefined ? h.zHeight : 120) * SCALE, h.y);
          t = markPos.clone().sub(gunBarrelOrigin).dot(rayDir3D);
        }

        // Only place where ray actually goes
        if (t < -10 * SCALE || t > distance3D + 10 * SCALE) return;

        // Exact point on the ray at that intersection depth
        const hitOnRay = gunBarrelOrigin.clone().addScaledVector(rayDir3D, t);

        // Calculate local X to see if it's on the right (openable) glass
        const dx = hitOnRay.x - h.x;
        const dz = hitOnRay.z - h.y;
        const localX = dx * Math.cos(-vRotRad) - dz * Math.sin(-vRotRad);

        let finalX = hitOnRay.x;
        let finalZ = hitOnRay.z;
        let rotY = h.rotation || 0;
        let finalFaceNormal = faceNormal.clone();

        if (localX > 0 && h.customData?.isOpen) {
           const width = (h.width || 100) * SCALE;
           const frameThickness = 3 * SCALE;
           const pivotX = width / 2 - frameThickness;
           const openAngle = -Math.PI / 3;
           
           const relX = localX - pivotX;
           const relZ = 0; // The glass is at local Z=0
           
           const rotRelX = relX * Math.cos(openAngle) - relZ * Math.sin(openAngle);
           const rotRelZ = relX * Math.sin(openAngle) + relZ * Math.cos(openAngle);
           
           const newLocalX = rotRelX + pivotX;
           const newLocalZ = rotRelZ;
           
           finalX = h.x + newLocalX * Math.cos(vRotRad) - newLocalZ * Math.sin(vRotRad);
           finalZ = h.y + newLocalX * Math.sin(vRotRad) + newLocalZ * Math.cos(vRotRad);
           
           rotY += (openAngle * 180 / Math.PI);
           finalFaceNormal.applyAxisAngle(new THREE.Vector3(0, 1, 0), openAngle);
        }

        // Small offset along the face normal to avoid z-fighting with the window glass mesh
        const faceDir = finalFaceNormal.dot(rayDir3D) > 0 ? 1 : -1;
        const normalOffset = 0.3 * SCALE;

        if (t < minT) minT = t;
        if (t > maxT) maxT = t;

        // Deduplicate spatially
        const isNear = dedupedHoles.some((dh: any) => {
          if (!dh.isWindow) return false;
          return hitOnRay.distanceTo(new THREE.Vector3(dh.x, dh.y, dh.z)) < 5 * SCALE;
        });
        if (isNear) return;

        dedupedHoles.push({
          id: `proj-glass-${h.id}`,
          x: finalX + finalFaceNormal.x * normalOffset * faceDir,
          y: hitOnRay.y + finalFaceNormal.y * normalOffset * faceDir,
          z: finalZ + finalFaceNormal.z * normalOffset * faceDir,
          isWindow: true,
          isMannequin: false,
          isFurniture: false,
          rotY,
          faceDir,
          quaternion: null
        });
        return;
      }

      // ── WALL MARK ─────────────────────────────────────────────────────────
      if (isWallMark) {
        const zh = (h.zHeight !== undefined ? h.zHeight : 120) * SCALE;
        const hv = new THREE.Vector3(h.x - gunBarrelOrigin.x, zh - gunBarrelOrigin.y, h.y - gunBarrelOrigin.z);
        const t = hv.dot(rayDir3D);
        if (t < 0 || t > distance3D + 10 * SCALE) return;

        const projX = gunBarrelOrigin.x + t * rayDir3D.x;
        const projY = gunBarrelOrigin.y + t * rayDir3D.y;
        const projZ = gunBarrelOrigin.z + t * rayDir3D.z;

        // Only create hole if projected point lies on a wall surface
        let hitWall: any = null;
        if (allWalls) {
          for (const wall of allWalls) {
            const wr = (wall.rotation || 0) * Math.PI / 180;
            const cos = Math.cos(wr);
            const sin = Math.sin(wr);
            const dx = projX - wall.x;
            const dz = projZ - wall.y;
            const lx = dx * cos - dz * sin;
            const lz = dx * sin + dz * cos;
            const halfW = (wall.width || 100 * SCALE) / 2;
            const halfT = wallThicknessFromStore / 2;
            if (Math.abs(lx) > halfW) continue;
            if (Math.abs(lz) > halfT + 3 * SCALE) continue;
            const baseY = (wall.yOffset || 0) * SCALE;
            const wallH = (wall.h || 250) * SCALE;
            if (projY < baseY || projY > baseY + wallH) continue;
            hitWall = wall;
            break;
          }
        }
        if (!hitWall) return;

        const wallRotRad = -(hitWall.rotation || 0) * Math.PI / 180;
        const faceNormal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), wallRotRad);
        const faceDir = faceNormal.dot(rayDir3D) > 0 ? 1 : -1;

        const normalOffset = (wallThicknessFromStore / 2 + 0.2 * SCALE) * faceDir;
        const oX = projX + faceNormal.x * normalOffset;
        const oY = projY + faceNormal.y * normalOffset;
        const oZ = projZ + faceNormal.z * normalOffset;

        const isNear = dedupedHoles.some((dh: any) => {
          const ddx = dh.x - oX, ddy = dh.y - oY, ddz = dh.z - oZ;
          return Math.sqrt(ddx*ddx + ddy*ddy + ddz*ddz) < 3 * SCALE;
        });
        if (isNear) return;

        const q = new THREE.Quaternion();
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), faceNormal.clone().multiplyScalar(faceDir));

        dedupedHoles.push({
          id: `proj-wall-${h.id}`,
          x: oX, y: oY, z: oZ,
          isWindow: false, isMannequin: false, isFurniture: false,
          rotY: hitWall.rotation || 0, faceDir, quaternion: q,
        });
        return;
      }

      // ── MANNEQUIN WOUNDS ──────────────────────────────────────────────────
      if (isMankIn || isMankOut) {
        const torsoH = h.zHeight !== undefined && h.zHeight > 0
          ? h.zHeight * SCALE
          : 80 * SCALE;

        const hv = new THREE.Vector3(
          h.x - gunBarrelOrigin.x,
          torsoH - gunBarrelOrigin.y,
          h.y - gunBarrelOrigin.z
        );
        const t = hv.dot(rayDir3D);
        if (t < -10 * SCALE || t > distance3D + 10 * SCALE) return;

        const projX = gunBarrelOrigin.x + t * rayDir3D.x;
        const projY = gunBarrelOrigin.y + t * rayDir3D.y;
        const projZ = gunBarrelOrigin.z + t * rayDir3D.z;

        mankWounds.push({ t, x: projX, y: projY, z: projZ, isEntry: isMankIn, quaternion: null });
      }
    });

    // Auto-detect mannequin body intersection along the trajectory
    visualObjects.forEach((h: any) => {
      const sId = (h.symbolId || '').toLowerCase();
      const isHumanSrc = h.src && typeof h.src === 'string' && (h.src.includes('manken') || h.src.includes('human') || h.src.includes('person') || h.src.includes('p-1') || h.src.includes('p-2'));
      const isMannequin = sId.startsWith('p-') || isHumanSrc || sId === 'ev-human-poseable' || h.isMannequin;
      if (!isMannequin) return;

      const mx = h.x, mz = h.y;
      const isLying = (h.pose || 'standing') === 'prone' || h.pose === 'supine';
      const bodyCenterY = isLying ? 10 * SCALE : 80 * SCALE;
      const bodyRadius = isLying ? 30 * SCALE : 20 * SCALE;
      const bodyHalfH = isLying ? 10 * SCALE : 45 * SCALE;

      const vx = gunBarrelOrigin.x - mx, vz = gunBarrelOrigin.z - mz;
      const rdx = rayDir3D.x, rdz = rayDir3D.z;
      const a = rdx*rdx + rdz*rdz;
      if (a < 1e-10) return;
      const halfB = vx*rdx + vz*rdz;
      const c = vx*vx + vz*vz - bodyRadius*bodyRadius;
      const disc = halfB*halfB - a*c;
      if (disc < 0) return;
      const sqrtDisc = Math.sqrt(disc);
      [(-halfB - sqrtDisc)/a, (-halfB + sqrtDisc)/a].forEach((t, hitIdx) => {
        if (t < -10 * SCALE || t > distance3D + 10 * SCALE) return;
        const hitY = gunBarrelOrigin.y + t * rayDir3D.y;
        if (hitY < bodyCenterY - bodyHalfH || hitY > bodyCenterY + bodyHalfH) return;
        const projX = gunBarrelOrigin.x + t * rayDir3D.x;
        const projY = hitY;
        const projZ = gunBarrelOrigin.z + t * rayDir3D.z;
        const isEntry = hitIdx === 0;
        // dedupe against manually-placed wounds
        const isNear = mankWounds.some((w: any) => {
          const ddx = w.x - projX, ddy = w.y - projY, ddz = w.z - projZ;
          return Math.sqrt(ddx*ddx + ddy*ddy + ddz*ddz) < 8 * SCALE;
        });
        if (isNear) return;
        mankWounds.push({
          t, x: projX, y: projY, z: projZ, isEntry, quaternion: null,
        });
      });
    });
  }

  // Sort mannequin wounds by t (ascending = closer to gun barrel first)
  mankWounds.sort((a, b) => a.t - b.t);
  mankWounds.forEach((w, idx) => {
    const isEntry = w.isEntry;

    const q = new THREE.Quaternion();
    const sourceVec = new THREE.Vector3(0, 0, 1);
    const targetDir = isEntry ? rayDir3D.clone().negate() : rayDir3D.clone();
    
    // Safe quaternion generation to prevent NaN when vectors are colinear or opposite
    const dot = sourceVec.dot(targetDir);
    if (dot < -0.9999) {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    } else if (dot > 0.9999) {
      q.identity();
    } else {
      q.setFromUnitVectors(sourceVec, targetDir);
    }

    if (w.t < minT) minT = w.t;
    if (w.t > maxT) maxT = w.t;

    // Offset wound slightly along its normal direction so the plane sits
    // in front of the mannequin body surface instead of being hidden
    // inside the capsule by depth testing.
    const offsetAmt = 0.5 * SCALE;
    const woundPos = {
      x: w.x + targetDir.x * offsetAmt,
      y: w.y + targetDir.y * offsetAmt,
      z: w.z + targetDir.z * offsetAmt,
    };

    dedupedHoles.push({
      id: `mank-${isEntry ? 'in' : 'out'}-${idx}`,
      x: woundPos.x, y: woundPos.y, z: woundPos.z,
      isWindow: false,
      isMannequin: true,
      isEntry,
      isFurniture: false,
      rotY: 0,
      faceDir: isEntry ? -1 : 1,
      size: 15 * SCALE,
      quaternion: q
    });
  });


  // Fallback projected holes for wall/furniture objects near the ray path
  // (when checkIntersections/checkFurnitureIntersections miss due to rotation math)
  if (visualObjects) {
    visualObjects.forEach((h: any) => {
      const sId = (h.symbolId || '').toLowerCase();
      const name = (h.name || '').toLowerCase();
      const src = (h.src || '').toLowerCase();
      
      if (sId.includes('shooting') || sId.includes('atış') || sId.includes('ateş')) return;
      if (!h.parentId && (sId === 'tr-bullet-glass' || sId === 'tr-bullet-wall')) return;
      
      const isFurniture = sId.startsWith('f-') || sId.includes('yatak') || sId.includes('bed') || 
        name.includes('yatak') || sId.includes('koltuk') || sId.includes('sofa') ||
        name.includes('koltuk') || sId.includes('masa') || sId.includes('sehpa') ||
        sId.includes('table') || sId.includes('sandalye') || sId.includes('chair') ||
        sId.includes('mutfak') || sId.includes('tezgah') || src.includes('kitchen') ||
        sId.includes('gardırop') || sId.includes('gardrop') || name.includes('gardırop') ||
        name.includes('dolap') || sId.includes('tv') || sId.includes('televizyon') ||
        sId.includes('ekran') || sId.startsWith('v-') || sId.includes('car');
      
      if (!isFurniture) return;
      
      const objZH = (h.zHeight || 0) * SCALE;
      const hv = new THREE.Vector3(h.x - gunBarrelOrigin.x, objZH - gunBarrelOrigin.y, h.y - gunBarrelOrigin.z);
      const t = hv.dot(rayDir3D);
      if (t < 0) return;
      
      const projX = gunBarrelOrigin.x + t * rayDir3D.x;
      const projY = gunBarrelOrigin.y + t * rayDir3D.y;
      const projZ = gunBarrelOrigin.z + t * rayDir3D.z;
      
      const r = (h.rotation || 0) * (Math.PI / 180);
      const cos = Math.cos(r);
      const sin = Math.sin(r);
      const dx = projX - h.x;
      const dz = projZ - h.y;
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      
      const halfW = (h.width || 50 * SCALE) / 2;
      const halfD = (h.height || 50 * SCALE) / 2;
      if (Math.abs(lx) > halfW || Math.abs(lz) > halfD) return;
      
      const isNearExisting = dedupedHoles.some((dh: any) => {
        const ddx = dh.x - projX, ddy = dh.y - projY, ddz = dh.z - projZ;
        return Math.sqrt(ddx*ddx + ddy*ddy + ddz*ddz) < 8 * SCALE;
      });
      
      if (!isNearExisting) {
        const q = new THREE.Quaternion();
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-Math.sin(r), 0, Math.cos(r)).multiplyScalar(1));
        dedupedHoles.push({
          id: `fallback-${h.id}`,
          x: projX, y: projY, z: projZ,
          isWindow: false,
          isMannequin: false,
          isFurniture: isFurniture,
          rotY: h.rotation || 0,
          faceDir: 1,
          quaternion: q,
        });
      }
    });
  }

  // ── FINAL GLASS DEDUP: cam izlerine yakın tüm duvar izlerini sil ──────────
  // 2. passtan sonra cam izi eklendi — şimdi glass bölgesindeki wall/furniture izleri temizlenir
  const finalGlassHoles = dedupedHoles.filter((h: any) => h.isWindow);
  const GLASS_DEDUP_DIST = 60 * SCALE;
  const finalHoles = dedupedHoles.filter((h: any) => {
    if (h.isWindow || h.isMannequin) return true; // cam ve yara izleri korunur
    // cam izine yakın duvar/fürnity izlerini at
    return !finalGlassHoles.some((gh: any) => {
      const dx = h.x - gh.x;
      const dy = h.y - gh.y;
      const dz = h.z - gh.z;
      return Math.sqrt(dx*dx + dy*dy + dz*dz) < GLASS_DEDUP_DIST;
    });
  });

  // Re-run the maxT update loop to include all fallback and 2nd pass holes
  finalHoles.forEach((hole: any) => {
    const hv = new THREE.Vector3(hole.x - gunBarrelOrigin.x, hole.y - gunBarrelOrigin.y, hole.z - gunBarrelOrigin.z);
    const t = hv.dot(rayDir3D);
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
  });

  // Line starts at gun barrel (minT clamped to 0) and goes past the last impact
  // Allow a small overshoot beyond the last impact mark (10 * SCALE ≈ 5.5 cm)
  const lineOvershoot = 10 * SCALE;
  const lineStartT = 0;               // always start from gun barrel tip
  const lineEndT   = maxT + lineOvershoot;
  const lineLength = lineEndT - lineStartT;
  const lineCenterT = lineLength / 2; // center from barrel tip
  const lcx = gunBarrelOrigin.x + rayDir3D.x * lineCenterT;
  const lcy = gunBarrelOrigin.y + rayDir3D.y * lineCenterT;
  const lcz = gunBarrelOrigin.z + rayDir3D.z * lineCenterT;
  
  return (
    <group>
      {/* Modern 3D Handgun at Start Point */}
      <ModernHandgun3D position={new THREE.Vector3(relSx, zH, relSy)} target={new THREE.Vector3(relEx, targetZH, relEy)} />
      
      {/* Laser Trajectory Line — namlu ucundan çıkar, isabet izlerinin tam merkezinden geçer */}
      {lineLength > 0 && (
        <mesh position={[lcx, lcy, lcz]} quaternion={quaternion} renderOrder={5}>
          <cylinderGeometry args={[0.5 * SCALE, 0.5 * SCALE, lineLength, 8]} />
          <meshStandardMaterial 
            color="#cc0000" 
            transparent 
            opacity={0.92} 
            metalness={0.4}
            roughness={0.2}
            depthTest={true}
          />
        </mesh>
      )}
      
      {/* Bullet Holes — cam bölgesinde sadece cam izi gösterilir */}
      {finalHoles.map((hole: any) => {
        
        if (hole.isMannequin) {
           const woundSize = hole.size || (15 * SCALE);
           return (
             <mesh 
               key={hole.id} 
               position={[hole.x, hole.y, hole.z]} 
               quaternion={hole.quaternion}
               onUpdate={(self) => {
                 if (hole.quaternion) {
                   self.quaternion.copy(hole.quaternion);
                 }
               }}
               renderOrder={100}
             >
               <planeGeometry args={[woundSize, woundSize]} />
               <meshBasicMaterial 
                 map={hole.isEntry ? woundInTex : woundOutTex} 
                 transparent 
                 alphaTest={0.001} 
                 side={THREE.DoubleSide} 
                 polygonOffset 
                 polygonOffsetFactor={-10} 
                 polygonOffsetUnits={-10}
                 depthWrite={false}
               />
             </mesh>
           );
        }

        const baseRot = -(hole.rotY || 0) * Math.PI / 180;
        const localRot = baseRot + (hole.faceDir === -1 ? Math.PI : 0);
        
        if (hole.isWindow) {
           return (
             <mesh key={hole.id} position={[hole.x, hole.y, hole.z]} rotation={[0, localRot, 0]} renderOrder={20}>
               <planeGeometry args={[30 * SCALE, 30 * SCALE]} />
               <meshBasicMaterial 
                 map={glassTex} 
                 transparent 
                 alphaTest={0.01} 
                 side={THREE.DoubleSide} 
                 polygonOffset 
                 polygonOffsetFactor={-20} 
                 polygonOffsetUnits={-20}
                 depthWrite={true}
               />
             </mesh>
           );
        } else {
           return (
             <mesh 
               key={hole.id} 
               position={[hole.x, hole.y, hole.z]} 
               {...(hole.quaternion ? { quaternion: hole.quaternion } : { rotation: [0, localRot, 0] as any })}
               onUpdate={(self) => {
                 if (hole.quaternion) {
                   self.quaternion.copy(hole.quaternion);
                 }
               }}
               renderOrder={50}
             >
               <planeGeometry args={[35 * SCALE, 35 * SCALE]} />
               <meshBasicMaterial 
                 map={effectiveWallTex} 
                 transparent 
                 alphaTest={0.005} 
                 side={THREE.DoubleSide} 
                 polygonOffset 
                 polygonOffsetFactor={-4} 
                 polygonOffsetUnits={-4}
                 depthWrite={false}
               />
             </mesh>
           );
        }
      })}
    </group>
  );
};

/** Bulgu numarası tenti için dikdörtgen yüz dokusu (sarı zemin + siyah çerçeve + numara). */
const useTentTexture = (no?: string) => {
  return React.useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 192;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#F5C518';
    ctx.fillRect(0, 0, 256, 192);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 246, 182);
    ctx.fillStyle = '#111111';
    ctx.font = `800 ${String(no || '').length > 2 ? 88 : 120}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(no || '•', 128, 104);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [no]);
};

/**
 * Bulgu numaratörü (ev-circle / ev-square) — 3B çadır işaretçi.
 * Klasik olay yeri delil tenti gibi yerde durur; numara her iki eğik yüzde de okunur.
 */
const FindingMarker3D = ({ no, width, height, rad, square }: { no?: string; width: number; height: number; rad: number; square?: boolean }) => {
  const tex = useTentTexture(no);
  useEffect(() => () => { tex?.dispose(); }, [tex]);
  const baseW = Math.max(width, 12 * SCALE);
  const baseD = Math.max(height, 12 * SCALE);
  const ridgeH = Math.min(Math.max(0.55 * Math.min(baseW, baseD), 10 * SCALE), 24 * SCALE);
  const slopeLen = Math.sqrt((baseD / 2) ** 2 + ridgeH ** 2);
  const slopeAng = Math.atan2(baseD / 2, ridgeH);
  const capGeo = React.useMemo(() => {
    const s = new THREE.Shape([
      new THREE.Vector2(-baseD / 2, 0),
      new THREE.Vector2(baseD / 2, 0),
      new THREE.Vector2(0, ridgeH),
    ]);
    const g = new THREE.ShapeGeometry(s);
    g.rotateY(Math.PI / 2); // YZ düzlemine dik
    return g;
  }, [baseD, ridgeH]);
  useEffect(() => () => { capGeo?.dispose(); }, [capGeo]);
  const slopeMat = React.useMemo(() => (
    <meshStandardMaterial map={tex || undefined} side={THREE.DoubleSide} roughness={0.55} metalness={0.02} />
  ), [tex]);
  return (
    <group position={[0, 0, 0]} rotation={[0, rad, 0]}>
      {/* ön eğik yüz */}
      <mesh position={[0, ridgeH / 2, baseD / 4]} rotation={[-slopeAng, 0, 0]} castShadow>
        <planeGeometry args={[baseW, slopeLen]} />
        {slopeMat}
      </mesh>
      {/* arka eğik yüz (yarım tur döndürülmüş grup — numara aynalanmaz) */}
      <group rotation={[0, Math.PI, 0]}>
        <mesh position={[0, ridgeH / 2, baseD / 4]} rotation={[-slopeAng, 0, 0]} castShadow>
          <planeGeometry args={[baseW, slopeLen]} />
          {slopeMat}
        </mesh>
      </group>
      {/* yan üçgen kapaklar */}
      <mesh geometry={capGeo} position={[baseW / 2, 0, 0]}>
        <meshStandardMaterial color={square ? '#F5C518' : '#e8b90f'} side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
      <mesh geometry={capGeo} position={[-baseW / 2, 0, 0]}>
        <meshStandardMaterial color={square ? '#F5C518' : '#e8b90f'} side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
    </group>
  );
};

const _stdHeightCache = new Map<string, number>();
const getStandardHeight = (symbolId: string): number => {
  const s = symbolId?.toLowerCase() || '';
  if (_stdHeightCache.has(s)) return _stdHeightCache.get(s)!;
  let h = 40;
  if (s.includes('yatak') || s.includes('bed')) h = 55;
  else if (s.includes('koltuk') || s.includes('sofa') || s.includes('oturma')) h = 80;
  else if (s.includes('masa') || s.includes('table') || s.includes('sehpa')) h = 75;
  else if (s.includes('sandalye') || s.includes('chair')) h = 90;
  else if (s.includes('tv') || s.includes('televizyon')) h = 120;
  else if (s.includes('gardırop') || s.includes('gardrop') || s.includes('wardrobe')) h = 220;
  else if (s.includes('cabinet') || s.includes('dolap')) h = 210;
  else if (s.includes('mutfak') || s.includes('tezgah') || s.includes('kitchen') || s.includes('counter')) h = 90;
  else if (s.includes('buzdolabı') || s.includes('fridge')) h = 180;
  else if (s.includes('ocak') || s.includes('fırın')) h = 85;
  else if (s.includes('pistol') || s.includes('knife') || s.includes('rifle') || s.includes('weapon') || s.startsWith('w-')) h = 4;
  else if (s.includes('duba') || s.includes('cone') || s.startsWith('ts-cone')) h = 50;
  else if (s.includes('bariyer') || s.includes('barrier') || s.startsWith('ts-barrier')) h = 80;
  else if (s.includes('direk') || s.includes('pole') || s.startsWith('out-pole')) h = 300;
  else if (s.includes('hydrant') || s.includes('musluk') || s.startsWith('out-hydrant')) h = 60;
  else if (s.includes('bench') || s.includes('bank') || s.startsWith('out-bench')) h = 80;
  _stdHeightCache.set(s, h);
  return h;
};

/* ------------------------------------------------------------------ */
/* ALFA EKSTRÜZYON MOTORU                                              */
/* Sembol PNG'sinin şeffaf silueti kontur çıkarımıyla 3B hacme         */
/* dönüştürülür: üst yüz orijinal dokuyu taşır, yanlar nötr gövde.     */
/* Böylece elde, yerde yatan ama gerçekten 3 boyutlu nesneler olur.    */
/* ------------------------------------------------------------------ */

const MAX_EXTRACT_SIDE = 224;   // kontur çıkarımı için çözünürlük sınırı (128 → pürüzsüz kenar)
const ALPHA_THRESHOLD = 64;

const _alphaMaskCache = new Map<string, { w: number; h: number; mask: Uint8Array; color: string } | null>();
const _extrudeGeoCache = new Map<string, THREE.BufferGeometry>();

/**
 * Görselin alfa kanalından ikili maske çıkarır (kenar/CORS hatalarına karşı null).
 * Ek adımlar:
 *  1. MORFOLOJİK KAPANMA — 1px boşluklar (tarama/çıizim greni) doldurulur,
 *     böylece karakalem PNG'ler yüzlerce minik ada üretmez.
 *  2. BAĞLI BİLEŞEN FİLTRESİ — alanı toplam dolunun %0.4'ünden küçük adacıklar
 *     (tüy kırpıntıları, ot yaprakları, gren) atılır; kontur tek temiz siluet olur.
 *  3. ORTALAMA RENK — opak piksellerin ortalamasından yan yüzey rengi türetilir
 *     (eski sabit gri #62676e yerine, nesne rengiyle uyumlu gövde).
 */
function extractAlphaMask(img: HTMLImageElement): { w: number; h: number; mask: Uint8Array; color: string } | null {
  try {
    const iw = (img as any).naturalWidth || img.width;
    const ih = (img as any).naturalHeight || img.height;
    if (!iw || !ih) return null;
    const k = Math.min(1, MAX_EXTRACT_SIDE / Math.max(iw, ih));
    const w = Math.max(2, Math.round(iw * k));
    const h = Math.max(2, Math.round(ih * k));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const mask = new Uint8Array(w * h);
    let rSum = 0, gSum = 0, bSum = 0, nSum = 0;
    for (let i = 0; i < w * h; i++) {
      if (data[i * 4 + 3] > ALPHA_THRESHOLD) {
        mask[i] = 1;
        rSum += data[i * 4]; gSum += data[i * 4 + 1]; bSum += data[i * 4 + 2]; nSum++;
      }
    }
    // 1) 1px delik kapatma
    const filled = new Uint8Array(mask);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (mask[i]) continue;
        const n = mask[i - 1] + mask[i + 1] + mask[i - w] + mask[i + w]
          + mask[i - w - 1] + mask[i - w + 1] + mask[i + w - 1] + mask[i + w + 1];
        if (n >= 5) filled[i] = 1;
      }
    }
    // 2) bağlı bileşenler → minik adacıkları at
    const lbl = new Int32Array(w * h).fill(-1);
    const areas: number[] = [];
    const stack: number[] = [];
    for (let s = 0; s < w * h; s++) {
      if (!filled[s] || lbl[s] >= 0) continue;
      const id = areas.length;
      let area = 0;
      stack.push(s); lbl[s] = id;
      while (stack.length) {
        const p = stack.pop()!;
        area++;
        const cx = p % w, cy = (p / w) | 0;
        if (cx > 0 && filled[p - 1] && lbl[p - 1] < 0) { lbl[p - 1] = id; stack.push(p - 1); }
        if (cx < w - 1 && filled[p + 1] && lbl[p + 1] < 0) { lbl[p + 1] = id; stack.push(p + 1); }
        if (cy > 0 && filled[p - w] && lbl[p - w] < 0) { lbl[p - w] = id; stack.push(p - w); }
        if (cy < h - 1 && filled[p + w] && lbl[p + w] < 0) { lbl[p + w] = id; stack.push(p + w); }
      }
      areas.push(area);
    }
    const totalArea = areas.reduce((a, b) => a + b, 0);
    const minArea = Math.max(16, totalArea * 0.004);
    for (let i = 0; i < w * h; i++) mask[i] = (filled[i] === 1 && areas[lbl[i]] >= minArea) ? 1 : 0;
    // 3) ortalama renk (yan yüzeyler için hafif koyulaştırılmış)
    const shade = (v: number) => Math.max(0, Math.min(255, Math.round((v / Math.max(1, nSum)) * 0.72)));
    const color = nSum > 0
      ? '#' + [shade(rSum), shade(gSum), shade(bSum)].map((v) => v.toString(16).padStart(2, '0')).join('')
      : '#62676e';
    return { w, h, mask, color };
  } catch {
    return null; // tainted canvas / CORS
  }
}

/** İkili maskeden sınır takibi ile kapalı kontur halkaları çıkarır (saat yönü, ızgara düğümleri). */
function traceContourLoops(mask: Uint8Array, w: number, h: number): Array<Array<[number, number]>> {
  const next = new Map<number, number>();
  const key = (x: number, y: number) => y * (w + 1) + x;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : mask[y * w + x];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue;
      // Dolu hücrenin boş komşularına bakan kenarları tutarlı yönlendir (içerik solda)
      if (!at(x, y - 1)) next.set(key(x, y), key(x + 1, y));
      if (!at(x + 1, y)) next.set(key(x + 1, y), key(x + 1, y + 1));
      if (!at(x, y + 1)) next.set(key(x + 1, y + 1), key(x, y + 1));
      if (!at(x - 1, y)) next.set(key(x, y + 1), key(x, y));
    }
  }
  const loops: Array<Array<[number, number]>> = [];
  const visited = new Set<number>();
  for (const [start] of next) {
    if (visited.has(start)) continue;
    const loop: Array<[number, number]> = [];
    let cur: number | undefined = start;
    while (cur !== undefined && next.has(cur) && !visited.has(cur)) {
      visited.add(cur);
      loop.push([cur % (w + 1), Math.floor(cur / (w + 1))]);
      cur = next.get(cur);
    }
    if (loop.length >= 8) loops.push(loop);
  }
  loops.sort((a, b) => b.length - a.length);
  return loops;
}

/** Chaikin köşe kesme: konturu pürüzsüzleştirir (testere dişi jaggy'leri yok eder). */
function chaikinSmooth(loop: Array<[number, number]>, iterations = 1): Array<[number, number]> {
  let cur = loop;
  for (let it = 0; it < iterations; it++) {
    if (cur.length < 3) return cur;
    const out: Array<[number, number]> = [];
    const n = cur.length;
    for (let i = 0; i < n; i++) {
      const p = cur[i], q = cur[(i + 1) % n];
      out.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25]);
      out.push([p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]);
    }
    cur = out;
  }
  return cur;
}

/** Düz devam eden ızgara noktalarını atarak konturu sadeleştirir. */
function decimateLoop(loop: Array<[number, number]>): Array<[number, number]> {
  if (loop.length < 6) return loop;
  const out: Array<[number, number]> = [];
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const p = loop[(i - 1 + n) % n], c = loop[i], q = loop[(i + 1) % n];
    const cross = (c[0] - p[0]) * (q[1] - p[1]) - (c[1] - p[1]) * (q[0] - p[0]);
    const dot = (c[0] - p[0]) * (q[0] - p[0]) + (c[1] - p[1]) * (q[1] - p[1]);
    if (cross === 0 && dot > 0) continue; // aynı doğru üzerinde
    out.push(c);
  }
  return out.length >= 3 ? out : loop;
}

/** Maskeden ekstrüzyon geometrisi üretir; çok karmaşık/asılsız maskelerde null döner. */
function buildExtrudedGeometry(
  maskData: { w: number; h: number; mask: Uint8Array },
  worldW: number, worldH: number, depthWorld: number,
): THREE.BufferGeometry | null {
  const { w, h, mask } = maskData;
  const loops = traceContourLoops(mask, w, h);
  if (!loops.length) return null;
  const totalPts = loops.reduce((s, l) => s + l.length, 0);
  if (totalPts > 5200 || loops.length > 28) return null; // aşırı karmaşık → kutu düşüşü
  const sx = worldW / w, sy = worldH / h;
  const toVec = ([gx, gy]: [number, number]) => new THREE.Vector2((gx - w / 2) * sx, -(gy - h / 2) * sy);
  // Pürüzsüzleştirme hattı: sadeleştir → köşe kes → sadeleştir → köşe kes → sadeleştir
  const refine = (l: Array<[number, number]>) =>
    decimateLoop(chaikinSmooth(decimateLoop(chaikinSmooth(decimateLoop(l), 1)), 1));
  const main = refine(loops[0]);
  if (main.length < 3) return null;
  const shape = new THREE.Shape(main.map(toVec));
  for (let i = 1; i < Math.min(loops.length, 9); i++) {
    const l = refine(loops[i]);
    if (l.length < 3) continue;
    shape.holes.push(new THREE.Path(l.map(toVec)));
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depthWorld,
    bevelEnabled: true,
    bevelThickness: depthWorld * 0.18,
    bevelSize: Math.max(0.15, Math.min(worldW, worldH) * 0.015),
    bevelSegments: 1,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2); // XY düzlemi → XZ, ekstrüzyon +Y (yukarı)
  geo.translate(0, depthWorld * 0.18, 0); // pah payı: taban yerde kalsın
  return geo;
}

/* ------------------------------------------------------------------ */
/* SVG YÜKSEK ÇÖZÜNÜRLÜK RASTERİZASYONU                                */
/* SVG semboller WebGL'e intrinsic boyutta (örn. 200×200) yüklenir ve  */
/* büyük zemin decallerine gerilince bulanıklaşır (2B Konva, çizim      */
/* boyutunda rasterize ettiği için net kalır). Bu hook SVG'yi hedef     */
/* çözünürlükte canvas'a yeniden çizip net bir doku üretir; PNG/JPEG    */
/* için no-op'tur.                                                      */
/* ------------------------------------------------------------------ */
const _svgHiResCache = new Map<string, THREE.Texture>();
const useSvgHiResTexture = (src: string | undefined, target = 1400): THREE.Texture | null => {
  const [tex, setTex] = useState<THREE.Texture | null>(() => (src ? _svgHiResCache.get(src) || null : null));
  useEffect(() => {
    if (!src) return;
    const isSvg = src.startsWith('data:image/svg') || src.toLowerCase().includes('.svg');
    if (!isSvg) return;
    const cached = _svgHiResCache.get(src);
    if (cached) { setTex(cached); return; }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const iw = img.naturalWidth || img.width || 300;
        const ih = img.naturalHeight || img.height || 300;
        const s = Math.max(1, Math.min(10, target / Math.max(iw, ih)));
        const c = document.createElement('canvas');
        c.width = Math.max(2, Math.round(iw * s));
        c.height = Math.max(2, Math.round(ih * s));
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const t = new THREE.CanvasTexture(c);
        t.anisotropy = 8;
        t.colorSpace = THREE.SRGBColorSpace;
        // Sınır aşılırsa en eski kaydıreferansı bırak (dispose YAPMA — kullanımda olabilir)
        if (_svgHiResCache.size > 60) {
          const k0 = _svgHiResCache.keys().next().value as string | undefined;
          if (k0) _svgHiResCache.delete(k0);
        }
        _svgHiResCache.set(src, t);
        setTex(t);
      } catch { /* tainted canvas vb. — orijinal dokuyla devam */ }
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src, target]);
  return tex;
};

/** Fiziksel nesnelerin 3B yüksekliği (cm) — kategori bazlı gerçekçi kalınlık. */
const getExtrudeHeightCm = (sId: string): number => {
  if (sId.startsWith('v-')) {                                 // kara taşıtları (SVG üst görünüm ekstrüzyonu)
    if (sId.includes('trailer')) return 380;
    if (sId.includes('minibus')) return 240;
    if (sId.includes('bus')) return 310;
    if (sId.includes('forklift')) return 220;
    if (sId.includes('crane') || sId.includes('excavator') || sId.includes('loader') || sId.includes('tractor')) return 280;
    if (sId.includes('truck') || sId.includes('dump') || sId.includes('concrete') || sId.includes('firetruck') || sId.includes('tow') || sId.includes('municipal')) return 300;
    if (sId.includes('panelvan') || sId.includes('minivan') || sId.includes('ambulance') || sId.includes('armored')) return 200;
    if (sId.includes('suv') || sId.includes('station') || sId.includes('pickup') || sId.includes('quad')) return 175;
    return 150; // binek otolar (sedan, hatchback, coupe, taksi, polis...)
  }
  if (sId.startsWith('ht-')) return 9;                       // el aletleri
  if (sId.startsWith('w-')) return 7;                        // silahlar
  if (sId.startsWith('an-')) return (sId.includes('chicken') || sId.includes('tavuk') || sId.includes('bird')) ? 25 : 40; // hayvanlar (yedek — an-* artık Animal3D)
  if (sId.startsWith('cl-')) {                               // giysi / kişisel eşya
    if (sId.includes('helmet') || sId.includes('kask')) return 20;
    if (sId.includes('boot') || sId.includes('bot')) return 22;
    if (sId.includes('shoe') || sId.includes('ayak')) return 12;
    if (sId.includes('backpack') || sId.includes('çanta') || sId.includes('canta')) return 24;
    if (sId.includes('jacket') || sId.includes('mont')) return 14;
    if (sId.includes('vest') || sId.includes('yelek')) return 10;
    if (sId.includes('cap')) return 10;
    if (sId.includes('wallet')) return 3;
    if (sId.includes('glove') || sId.includes('eldiven')) return 4;
    return 12;
  }
  if (sId.startsWith('ex-')) {                               // katı olay yeri nesneleri
    if (sId.includes('lpg')) return 60;
    if (sId.includes('extinguisher') || sId.includes('söndürücü')) return 55;
    if (sId.includes('kombi')) return 70;
    if (sId.includes('gas-meter') || sId.includes('sayaç')) return 60;
    if (sId.includes('fuse') || sId.includes('sigorta')) return 30;
    if (sId.includes('detector') || sId.includes('dedektör')) return 8;
    if (sId === 'ex-9' || sId.includes('varil')) return 88;
    if (sId.startsWith('ex-rb')) return 40;
    return 20;
  }
  if (sId.startsWith('tr-casing')) return 2.5;               // fişek kovanı
  if (sId === 'tr-bullet-deformed') return 2;                // deforme mermi
  if (sId === 'tr-magazine') return 6;                       // şarjör
  if (sId.startsWith('ei-')) return (sId.includes('card') || sId.includes('paper') || sId.includes('zarf') || sId.includes('kağıt')) ? 2 : 11; // delil nesneleri
  return 12;
};

/**
 * Alfa siluetinden ekstrüde edilmiş 3B sembol.
 * Geometri üretilemezse (karmaşık maske, CORS, boş doku) `fallback`'a düşer.
 */
const ExtrudedSymbol3D = ({ x, y, rad, width, height, textureSrc, heightCm, zOffset, fallback, hiResTexture }: any) => {
  const tMain = useTexture(textureSrc) as THREE.Texture;
  const hWorld = Math.max(1.5, (heightCm || 10) * SCALE);

  const geo = React.useMemo(() => {
    const img: HTMLImageElement | undefined = (tMain as any).image;
    if (!img || !width || !height) return null;
    const geoKey = `${textureSrc}|${width.toFixed(2)}|${height.toFixed(2)}|${hWorld.toFixed(2)}`;
    const cached = _extrudeGeoCache.get(geoKey);
    if (cached !== undefined) return cached;
    const maskKey = textureSrc;
    if (!_alphaMaskCache.has(maskKey)) {
      _alphaMaskCache.set(maskKey, extractAlphaMask(img));
    }
    const m = _alphaMaskCache.get(maskKey) || null;
    let g: THREE.BufferGeometry | null = null;
    if (m && m.w >= 2 && m.h >= 2) g = buildExtrudedGeometry(m, width, height, hWorld);
    // Önbellek sınırı: en eski girdiyi bırak
    if (_extrudeGeoCache.size > 120) {
      const oldest = _extrudeGeoCache.keys().next().value as string | undefined;
      if (oldest !== undefined) {
        _extrudeGeoCache.get(oldest)?.dispose();
        _extrudeGeoCache.delete(oldest);
      }
    }
    _extrudeGeoCache.set(geoKey, g as THREE.BufferGeometry);
    return g;
  }, [tMain, textureSrc, width, height, hWorld]);

  // Üst yüz dokusu: şekil koordinatları (−w/2..w/2) → UV 0..1
  // hiResTexture varsa (SVG yüksek çözünürlük rasteri) üst yüz o dokudan çizilir
  const topTex = React.useMemo(() => {
    const t = (hiResTexture || tMain).clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.repeat.set(1 / Math.max(width, 0.01), 1 / Math.max(height, 0.01));
    t.offset.set(0.5, 0.5);
    return t;
  }, [tMain, hiResTexture, width, height]);
  useEffect(() => () => { topTex.dispose(); }, [topTex]);

  const materials = React.useMemo(() => ([
    new THREE.MeshStandardMaterial({ map: topTex, transparent: true, alphaTest: 0.15, roughness: 0.75, metalness: 0.05 }),
    // Yan yüzey: dokunun ortalama renginden türetilmiş gövde rengi (nötr gri değil)
    new THREE.MeshStandardMaterial({ color: (_alphaMaskCache.get(textureSrc)?.color) || '#62676e', roughness: 0.78, metalness: 0.05 }),
  ]), [topTex, textureSrc]);
  useEffect(() => () => { materials.forEach((m: THREE.Material) => m.dispose()); }, [materials]);

  if (!geo) return fallback;
  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, rad, 0]}>
      <mesh geometry={geo} material={materials} castShadow receiveShadow />
    </group>
  );
};

/* ------------------------------------------------------------------ */
/* ZEMİN DECAL KATMANI (WYSIWYG 2B→3B)                                */
/* Ölçü okları, metin notları, açıklama balonları ve numaratörler      */
/* 3B'de hacimli kutular olarak değil, 2B çizimdeki gibi zeminde      */
/* düz afiş/decal olarak render edilir. Böylece kuşbakışında tuvalle  */
/* birebir aynı görünüm elde edilir.                                  */
/* ------------------------------------------------------------------ */

// Nesne kimliğinden 0..1 arası kararlı bir değer üretir (z-fighting önleme
// için üst üste binen decallere farklı yükseklik vermek amacıyla).
const stableHash01 = (id: string): number => {
  let h = 0;
  const str = String(id || '');
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 997;
  return h / 997;
};

// 2B (canvas) içeriğinden doku üretir; bileşen kaldırıldığında temizler.
const useCanvasTexture = (draw: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void, w: number, h: number, deps: any[]) => {
  const tex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.min(4096, Math.round(w)));
    canvas.height = Math.max(2, Math.min(4096, Math.round(h)));
    const ctx = canvas.getContext('2d')!;
    draw(ctx, canvas);
    const t = new THREE.CanvasTexture(canvas);
    t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => () => { tex.dispose(); }, [tex]);
  return tex;
};

const px = (n: number) => Math.max(1, Math.round(n));

/** Zemin afişi: verilen dokuyu yerden ~0 düzlemde, verilen boyutta yatırır. */
const FlatDecal3D = ({ x, y, rad, wWorld, hWorld, texture, elev = 0.08, renderOrder = 2 }: any) => (
  <group position={[x, elev, y]} rotation={[0, rad || 0, 0]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={renderOrder}>
      <planeGeometry args={[wWorld, hWorld]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.02} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  </group>
);

// st-1 / st-cadde / st-sokak — 2B Bezier yol motorunun 3B aynası.
// Bu yollar 2B'de vektör motoruyla çizilir (SVG dokuya düşmez); 3B'de SVG doku
// yerine AYNI geometriyi (Q Bezier gövde + siyah kenarlar + [20,20] kesikli orta
// çizgi + yol adı etiketi) yüksek çözünürlükte canvas'a çizip zemine yatırır.
// Böylece kıvrım, kesikli çizgi periyodu ve yol adı 2B görünümle birebir olur.
const ROAD_ENGINE_IDS_3D = new Set(['st-1', 'st-cadde', 'st-sokak']);
const RoadDecal3D = ({ obj, width, height }: any) => {
  const w2d = Math.max(20, width / SCALE);
  const h2d = Math.max(20, height / SCALE);
  const res = Math.min(4, Math.max(1.2, 2048 / Math.max(w2d, h2d)));
  const tex = useCanvasTexture((ctx) => {
    ctx.scale(res, res);
    const w = w2d, h = h2d;
    const curv = obj.curvature || 0;
    const curvX = obj.curvatureX !== undefined ? obj.curvatureX : w / 2;
    const controlY = h / 2 + curv * 2;
    const p = new Path2D(`M 0 ${h / 2} Q ${curvX} ${controlY} ${w} ${h / 2}`);
    const e = Math.max(1.5, h / 20);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = h + 2 * e; // siyah taban → iki yanda e kalınlığında yol kenarı
    ctx.stroke(p);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = h;
    ctx.stroke(p);
    const showMid = obj.roadMiddleLine !== undefined ? !!obj.roadMiddleLine : String(obj.symbolId || '') === 'st-1';
    if (showMid) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = e;
      ctx.setLineDash([20, 20]);
      ctx.stroke(p);
      ctx.setLineDash([]);
    }
    const sname = String(obj.streetName || '').trim();
    if (sname) {
      const sfs = obj.streetFontSize || Math.max(11, Math.min(30, h * 0.32));
      ctx.fillStyle = obj.distanceColor || '#000000';
      ctx.font = `bold ${sfs}px ${obj.fontFamily || 'Inter'}, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sname, w / 2, h / 2);
    }
  }, Math.round(w2d * res), Math.round(h2d * res), [w2d, h2d, res, obj.curvature, obj.curvatureX, obj.roadMiddleLine, obj.streetName, obj.streetFontSize, obj.distanceColor, obj.symbolId, obj.fontFamily]);
  return <FlatDecal3D x={0} y={0} rad={0} wWorld={w2d * SCALE} hWorld={h2d * SCALE} texture={tex} elev={0.07 + stableHash01(String(obj.id || 'road')) * 0.03} />;
};

/** Ölçü/yön oku (a-4 çift uçlu, a-5 tek uçlu) — mesafe etiketiyle birlikte. */
const ArrowDecal3D = ({ obj, stageWidth, stageHeight }: any) => {
  const scale = SCALE;
  const centerX = stageWidth / 2;
  const centerY = stageHeight / 2;
  const sId = String(obj.symbolId || '').toLowerCase();
  const isDistance = obj.isDistanceArrow || sId === 'a-4';
  let sx = obj.startX, sy = obj.startY, ex = obj.endX, ey = obj.endY;
  if ([sx, sy, ex, ey].some((v: any) => typeof v !== 'number' || isNaN(v))) {
    // Eski nesnelerde uç koordinatı yoksa: merkez + width/rotation'dan türet
    const len = (obj.width || 0);
    const r = (obj.rotation || 0) * (Math.PI / 180);
    sx = obj.x - (len / 2) * Math.cos(r); sy = obj.y - (len / 2) * Math.sin(r);
    ex = obj.x + (len / 2) * Math.cos(r); ey = obj.y + (len / 2) * Math.sin(r);
  }
  const dx = ex - sx, dy = ey - sy;
  const len2d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const ang = Math.atan2(dy, dx);
  // Nesnenin kendi rotasyonu InteractiveSymbol dış gruba uygulanır; mutlak açıyı
  // korumak için fark kadar iç dönüş uygulanır.
  const innerRot = ((obj.rotation || 0) * Math.PI / 180) - ang;

  const label = String(obj.distance || '');
  const pxPerUnit = 8;                      // 1 dünya birimi = 8 canvas px
  const bandWorld = label ? 26 : 12;        // ok bandı + etiket dünyada kaç birim
  const cW = px(len2d * scale * pxPerUnit);
  const cH = px(bandWorld * scale * pxPerUnit);
  const lineY = cH - px(4 * scale * pxPerUnit); // ok çizgisi bandın alt kısmında
  const color = obj.fill || obj.stroke || '#000000';

  const tex = useCanvasTexture((ctx) => {
    ctx.clearRect(0, 0, cW, cH);
    const lw = px(1.6 * scale * pxPerUnit);
    const head = px(Math.min(len2d * 0.22, 13) * scale * pxPerUnit);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    // gövde
    const bodyFrom = isDistance ? head : 0;
    const bodyTo = isDistance ? cW - head : cW - head;
    ctx.beginPath();
    ctx.moveTo(bodyFrom, lineY);
    ctx.lineTo(bodyTo, lineY);
    ctx.stroke();
    // uçlar
    const drawHead = (tipX: number, dir: number) => {
      ctx.beginPath();
      ctx.moveTo(tipX, lineY);
      ctx.lineTo(tipX - dir * head, lineY - head * 0.42);
      ctx.lineTo(tipX - dir * head, lineY + head * 0.42);
      ctx.closePath();
      ctx.fill();
    };
    drawHead(isDistance ? cW : cW, 1);
    if (isDistance) drawHead(0, -1);
    // etiket (okunabilirlik için alt şerit üzerine)
    if (label) {
      const fPx = px(15 * scale * pxPerUnit);
      ctx.font = `700 ${fPx}px Inter, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = color;
      ctx.fillText(label, cW / 2, px(1 * scale * pxPerUnit), cW * 0.96);
    }
  }, cW, cH, [cW, cH, label, color, isDistance, lineY]);

  const midWx = ((sx + ex) / 2 - centerX) * scale;
  const midWy = ((sy + ey) / 2 - centerY) * scale;
  const localX = midWx - (obj.x ?? 0);
  const localY = midWy - (obj.y ?? 0);
  const wWorld = len2d * scale;
  const hWorld = bandWorld * scale;

  // HIZ (kullanıcı): ölçü oku zeminde değil, ~120 cm yükseklikte havada süzülür;
  // iki ucundan yere ince kılavuz çizgileri iner (ölçümün hangi noktalar
  // arasında olduğu 3B perspektifte de okunur).
  const FLOAT_ELEV = 120 * SCALE;
  const headWorld = Math.min(len2d * 0.22, 13) * scale;
  const tipInset = Math.max(0, wWorld / 2 - headWorld * 0.45);
  return (
    <group position={[localX, FLOAT_ELEV, localY]} rotation={[0, innerRot, 0]}>
      <FlatDecal3D x={0} y={0} rad={0} wWorld={wWorld} hWorld={hWorld} texture={tex} elev={0} />
      {[tipInset, -tipInset].map((lx, i) => (
        <group key={i}>
          <mesh position={[lx, -FLOAT_ELEV / 2, 0]}>
            <cylinderGeometry args={[0.18, 0.18, FLOAT_ELEV, 6]} />
            <meshStandardMaterial color={color} transparent opacity={0.55} roughness={0.6} />
          </mesh>
          <mesh position={[lx, -FLOAT_ELEV + 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.1, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.65} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/** Serbest metin nesnesi (type:'text') — satır kaydırmalı zemin yazısı. */
const TextDecal3D = ({ obj }: any) => {
  const scale = SCALE;
  const text = String(obj.text ?? '');
  const fontSize = obj.fontSize || 12;
  const bold = obj.fontStyle === 'bold';
  const w2d = Math.max(20, obj.width || 220);
  const color = obj.fill || '#000000';
  const pxPerUnit = 8;
  const cW = px(w2d * scale * pxPerUnit);
  const fPx = px(fontSize * scale * pxPerUnit);

  const tex = useCanvasTexture((ctx) => {
    ctx.clearRect(0, 0, cW, 4000);
    ctx.font = `${bold ? '700' : '400'} ${fPx}px Inter, Arial, sans-serif`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    // kelime kelime kaydır
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    const maxW = cW;
    for (const wd of words) {
      const test = cur ? cur + ' ' + wd : wd;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = wd; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    (ctx as any).__krokiLines = lines;
    const lh = px(fontSize * 1.35 * scale * pxPerUnit);
    lines.forEach((ln, i) => {
      const tw = ctx.measureText(ln).width;
      const tx = obj.align === 'center' ? (cW - tw) / 2 : obj.align === 'right' ? cW - tw : 0;
      ctx.fillText(ln, tx, i * lh);
    });
  }, cW, 4000, [cW, fPx, text, bold, color, obj.align]);

  const lines: string[] = (tex as any).__krokiLines || [text];
  const lhWorld = fontSize * 1.35;
  const hWorld = Math.max(fontSize * 1.6, lines.length * lhWorld);
  // CanvasTexture alt-üst akışı: doku boyu 4000px sabit; gerçek içerik üstte.
  // Doku uzayını içeriğe kırpıp düzlemi içerik boyutuna göre konumlandır.
  const usedPx = px(hWorld * scale * pxPerUnit);
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(1, usedPx / tex.image.height);
  t.offset.set(0, 1 - usedPx / tex.image.height);

  const wWorld = w2d * scale;
  // obj.x/y dünya merkezidir (InteractiveSymbol grubu); Local 0 noktasına çiz
  return <FlatDecal3D x={0} y={0} rad={0} wWorld={wWorld} hWorld={hWorld} texture={t} elev={0.12 + stableHash01(obj.id) * 0.04} />;
};

/** Açıklama balonu (ev-callout) — beyaz balon + siyah çerçeve + metin, zeminde. */
const CalloutDecal3D = ({ obj }: any) => {
  const scale = SCALE;
  const text = String(obj.distance ?? '');
  const fontSize = obj.distanceFontSize || 12;
  const w2d = Math.max(60, obj.width || 160);
  const h2d = Math.max(30, obj.height || 50);
  const pxPerUnit = 6;
  const cW = px(w2d * pxPerUnit);
  const cH = px(h2d * pxPerUnit);

  const tex = useCanvasTexture((ctx) => {
    ctx.clearRect(0, 0, cW, cH);
    const bw = cW;
    const bh = px(cH * 0.75); // kuyruk için alt %25 boş
    const r = px(6 * pxPerUnit * 0.5);
    // balon gövdesi
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(bw - r, 0);
    ctx.quadraticCurveTo(bw, 0, bw, r);
    ctx.lineTo(bw, bh - r);
    ctx.quadraticCurveTo(bw, bh, bw - r, bh);
    ctx.lineTo(px(bw * 0.22), bh);
    ctx.lineTo(px(bw * 0.30), cH - 1);
    ctx.lineTo(px(bw * 0.34), bh);
    ctx.lineTo(r, bh);
    ctx.quadraticCurveTo(0, bh, 0, bh - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = px(0.9 * pxPerUnit * 0.6);
    ctx.strokeStyle = '#000000';
    ctx.stroke();
    // metin (balon içinde ortalı, satır kaydırmalı)
    const fPx = px(fontSize * pxPerUnit);
    ctx.font = `500 ${fPx}px Inter, Arial, sans-serif`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const wd of words) {
      const test = cur ? cur + ' ' + wd : wd;
      if (ctx.measureText(test).width > bw - fPx * 1.4 && cur) { lines.push(cur); cur = wd; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    const lh = fPx * 1.3;
    const startY = bh / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((ln, i) => ctx.fillText(ln, bw / 2, startY + i * lh, bw * 0.94));
  }, cW, cH, [cW, cH, text, fontSize]);

  return <FlatDecal3D x={0} y={0} rad={0} wWorld={w2d * scale} hWorld={h2d * scale} texture={tex} elev={0.14 + stableHash01(obj.id) * 0.04} />;
};

const Symbol3D = ({ obj, wallThickness, realObj, allWalls, visualObjects, uploadedImages, stageWidth, stageHeight }: any) => {
  const actualObj = realObj || obj;
  const { x, y, rotation, symbolId, src, fill } = obj;

  // 1. Dimensions and Identifiers
  const width = (actualObj.width || 0) * (actualObj.scaleX || 1);
  const height = (actualObj.height || 0) * (actualObj.scaleY || 1);
  const effSymbolId = symbolId || actualObj.symbolId || (actualObj.id ? actualObj.id.split('-').slice(0, 2).join('-') : '');
  const sIdLower = effSymbolId?.toLowerCase() || '';
  const nameLower = (actualObj.name || '').toLowerCase();
  const srcLower = (actualObj.src || '').toLowerCase();

  // 2. Recognition Flags
  const isHumanSrc = src && typeof src === 'string' && (src.includes('manken') || src.includes('human') || src.includes('person') || src.includes('p-1') || src.includes('p-2'));
  // kk-* figürleri (çocuk/yaralı) da gerçek insan modeliyle çizilir
  const isHuman = effSymbolId?.startsWith('p-') || isHumanSrc || effSymbolId === 'ev-human-poseable' || actualObj.isMannequin || sIdLower.startsWith('kk-');
  const isWall = effSymbolId?.startsWith('arch-w1') || effSymbolId === 'arch-7' || effSymbolId === 'arch-w-square' || effSymbolId?.includes('fake');
  const isTraj = sIdLower.includes('shooting') || sIdLower.includes('atış');
  
  // Wound covers all wounds, blood pools, blood splatters, blood smears, and flat body markers
  const isWound = sIdLower.startsWith('in-') || sIdLower.includes('blood') || nameLower.includes('yara') || nameLower.includes('kan');
  const isImpactMark = sIdLower === 'tr-bullet-glass' || sIdLower === 'tr-bullet-wall';
  
  // Custom volumetric mappings (furniture, etc.)
  // isBed: f-1, f-2 ve varyantları (f-1x, f-2x) — ama f-10/f-11 (halı/yolluk/paspas) ve
  // f-12/f-13 (gardırop) HARIÇ. "f-10".startsWith("f-1") tuzağına karşı rakam sınırı:
  // /^f-1(\D|$)/ yalnızca f-1, f-1-... eşleşir; f-10..f-19 eşleşmez.
  const isBed = (sIdLower === 'f-1' || sIdLower === 'f-2' || (/^f-1(\D|$)/.test(sIdLower) && !sIdLower.startsWith('f-12') && !sIdLower.startsWith('f-13'))) || sIdLower.includes('yatak') || sIdLower.includes('bed') || nameLower.includes('yatak');
  const isSofa = sIdLower.startsWith('f-5') || sIdLower.startsWith('f-8') || sIdLower.includes('koltuk') || sIdLower.includes('sofa') || nameLower.includes('koltuk');
  const isTable = sIdLower.includes('masa') || sIdLower.includes('sehpa') || sIdLower.includes('table');
  const isChair = sIdLower.includes('sandalye') || sIdLower.includes('chair');
  const isKitchen = sIdLower === 'f-3' || sIdLower === 'f-4' || sIdLower.startsWith('f-3') || sIdLower.startsWith('f-4') || sIdLower.includes('mutfak') || sIdLower.includes('tezgah') || srcLower.includes('kitchen');
  // isWardrobe: f-12, f-12-f, f-13, f-13-f, f-7, f-7-f
  const isWardrobe = sIdLower.startsWith('f-12') || sIdLower.startsWith('f-13') || sIdLower === 'f-7' || sIdLower.startsWith('f-7') || sIdLower.includes('gardırop') || sIdLower.includes('gardrop') || nameLower.includes('gardırop') || nameLower.includes('dolap');
  const isCabinet = !isWardrobe && (sIdLower.includes('dolap') || nameLower.includes('dolap'));
  const isTV = sIdLower.includes('tv') || sIdLower.includes('televizyon') || sIdLower.includes('ekran');
  
  // Flat floor items (roads, carpets, tracks, fingerprints, ruler, etc.)
  const isFloorItem = sIdLower.startsWith('f-9') || sIdLower.startsWith('f-10') || sIdLower.startsWith('f-11') || sIdLower.includes('halı') || sIdLower.includes('carpet') || sIdLower.startsWith('st-1') || sIdLower.startsWith('st-2') || sIdLower.startsWith('st-3') || sIdLower.startsWith('st-4') || sIdLower.startsWith('st-5') || sIdLower.startsWith('st-6') || sIdLower.startsWith('st-7') || sIdLower.startsWith('st-8') || sIdLower.startsWith('st-9') || sIdLower.startsWith('st-cadde') || sIdLower.startsWith('st-sokak') || sIdLower === 'st-drain' || sIdLower.startsWith('tr-2') || sIdLower.startsWith('tr-3') || sIdLower.includes('iz') || sIdLower.includes('rögar') || sIdLower.includes('zebra') || sIdLower.includes('gecit') || sIdLower.includes('geçit');
  // Küçük delil/iz nesneleri (ei-*/tr-*/an-*) ve düz ev- açıklama araçları:
  // 3B kutu yerine zemin decali olarak çizilir (WYSIWYG).
  const isMarkerAnn = sIdLower === 'ev-circle' || sIdLower === 'ev-square';
  const isCalloutAnn = sIdLower === 'ev-callout';
  const isFlatEvAnn = sIdLower.startsWith('ev-') && !isMarkerAnn && !isCalloutAnn && !sIdLower.startsWith('ev-rect') && sIdLower !== 'ev-human-poseable';
  const isFlatEvidence = sIdLower.startsWith('ei-') || sIdLower.startsWith('tr-') || sIdLower.startsWith('an-') || sIdLower.startsWith('ex-');
  const isArrowAnn = sIdLower === 'a-4' || sIdLower === 'a-5' || !!actualObj.isDistanceArrow;
  const isTextAnn = actualObj.type === 'text';
  // Buildings rendered as 3D extruded boxes
  const isBuilding = sIdLower.startsWith('arch-b') || sIdLower === 'arch-house';
  // Mimari anıt yapılar (karakalem): havaalanı ve demiryolu istasyonu —
  // 3B'de düz decal yerine prosedürel hacimli model (Airport3D / Station3D)
  const isAirport = sIdLower === 'arch-airport' || nameLower.includes('havaalan') || srcLower.includes('airport');
  const isStation = sIdLower === 'arch-trainstation' || nameLower.includes('istasyon') || srcLower.includes('station');

  // Interactive 3D Objects
  // HAVA / DENİZ taşıtları: v-* öneki tüm taşıtları kapsıyor; uçak, helikopter,
  // balon ve tekne otomobil kutusu DEĞİL, kendi gerçek 3B modelleriyle çizilir
  // (kullanıcı raporu: 2B'de uçak ekleyene 3B'de basit araba çıkıyordu).
  const isPlane = sIdLower === 'v-plane' || sIdLower === 'v-jet' || sIdLower === 'v-privatejet' || sIdLower === 'v-cessna';
  const isHeli = sIdLower === 'v-helicopter' || sIdLower === 'v-atak';
  const isBalloon = sIdLower === 'v-balloon';
  const isBoat = sIdLower === 'v-rowboat' || sIdLower === 'v-motorboat' || sIdLower === 'v-jetski';
  const isVehicle = (sIdLower.startsWith('v-') || sIdLower.includes('car') || sIdLower.includes('sedan') || sIdLower.includes('suv') || sIdLower.includes('truck') || sIdLower.includes('bus') || sIdLower.includes('motor') || sIdLower.includes('police') || sIdLower.includes('ambulance') || sIdLower.includes('itfaiye') || sIdLower.includes('kepçe') || nameLower.includes('araç') || nameLower.includes('otomobil') || nameLower.includes('kamyon') || nameLower.includes('motosiklet') || nameLower.includes('otobüs') || nameLower.includes('ambulans') || nameLower.includes('polis') || nameLower.includes('itfaiye') || nameLower.includes('kepçe') || nameLower.includes('traktör') || nameLower.includes('çekici') || nameLower.includes('araba') || nameLower.includes('taksi') || nameLower.includes('minibüs')) && !isPlane && !isHeli && !isBalloon && !isBoat;
  const isTree = sIdLower.startsWith('out-tree') || sIdLower.includes('tree') || sIdLower.includes('ağaç') || nameLower.includes('ağaç') || nameLower.includes('çam');
  const isCone = sIdLower === 'ts-cone' || sIdLower.includes('cone') || nameLower.includes('duba');
  const isBarrier = sIdLower === 'ts-barrier' || sIdLower.includes('barrier') || nameLower.includes('bariyer');
  const isHydrant = sIdLower === 'out-hydrant' || sIdLower.includes('hydrant') || nameLower.includes('yangın musluğu');
  const isPole = sIdLower === 'out-pole' || sIdLower.includes('pole') || nameLower.includes('direk');
  const isBench = sIdLower === 'out-bench' || sIdLower.includes('bench') || nameLower.includes('bank') || nameLower.includes('oturak');
  const isTrafficSign = sIdLower.startsWith('ts-') && sIdLower !== 'ts-cone' && sIdLower !== 'ts-barrier';

  // 3. Coordinate Sync (1:1 Metric)
  const rad = -rotation * (Math.PI / 180);
  const currentWallThickness = wallThickness || 10 * SCALE;
  const zHeight = obj.zHeight !== undefined ? obj.zHeight : 0;
  const yOff = (actualObj.yOffset || 0) * SCALE;
  const posX = isWall ? x : 0;
  const posZ = isWall ? y : 0;
  const totalOffset = (zHeight * SCALE) + yOff;

  // 4. Structural Dispatch
  if (isWall) {
    return <Wall x={x} y={y} width={width} height={height} rotation={rotation} h={actualObj.h || 250} yOffset={actualObj.yOffset || 0} wallThickness={currentWallThickness} />;
  }
  if (isDoor(effSymbolId)) {
    // Kesit modunda (alçak duvar) kapı yüksekliği de duvarla kırpılır
    const doorH = Math.min(actualObj.zHeight || 210, actualObj.hCap || 250);
    return <Door3D x={x} y={y} width={width} h={doorH * SCALE} rad={rad} thickness={currentWallThickness} zOffset={yOff} />;
  }
  if (isWindow(effSymbolId)) {
    // Kesit modunda pencere yüksekliği VE denizlik yüksekliği duvara göre kırpılır
    // (yoksa pencere alçak duvarın üzerinde havada süzülür)
    const wCap = actualObj.hCap || 250;
    const rawZHeight = Math.min(actualObj.zHeight || 120, wCap);
    const rawSillH = Math.max(0, Math.min(actualObj.sillH || Math.max(0, 125 - rawZHeight / 2), wCap - rawZHeight));
    return <Window3D obj={actualObj} updateObject={obj.updateObject} x={x} y={y} width={width} h={rawZHeight * SCALE} rad={rad} sillH={rawSillH * SCALE} thickness={currentWallThickness} zOffset={yOff} />;
  }
  if (isTraj) {
    return (
      <Suspense fallback={null}>
        <ShootingTrajectory3D obj={obj} realObj={actualObj} allWalls={allWalls} visualObjects={visualObjects} uploadedImages={uploadedImages} />
      </Suspense>
    );
  }

  // 4b. Zemin decal katmanı: ölçü/yön okları, metinler, balonlar, numaratörler.
  // Bunlar 2B çizimdeki düz gösterimlerini 3B'de de korur (hacimli kutu OLMAZ).
  const annStageW = stageWidth || 1000;
  const annStageH = stageHeight || 1400;
  if (isArrowAnn) {
    return <ArrowDecal3D obj={actualObj} stageWidth={annStageW} stageHeight={annStageH} />;
  }
  if (isTextAnn) {
    return <TextDecal3D obj={{ ...actualObj, width: width / SCALE, height: height / SCALE }} />;
  }
  if (isCalloutAnn) {
    return <CalloutDecal3D obj={{ ...actualObj, width: width / SCALE, height: height / SCALE }} />;
  }
  if (isMarkerAnn) {
    // Yüzeye yapışmış numaratör (pencere/duvardaki izin yanındaysa):
    // çadır yerine aynı yüzeyde, izin yüksekliğinde sarı numara plakası.
    if ((actualObj as any).surfaceDecal) {
      return <FindingPlate3D no={String(actualObj.findingNo || '')} width={width} height={height} zHeight={zHeight} thickness={currentWallThickness} />;
    }
    // Bulgu numaratörü: klasik 3B çadır delil işaretçisi (numara iki yüzde de okunur)
    return <FindingMarker3D no={String(actualObj.findingNo || '')} width={width} height={height} rad={rad} square={sIdLower === 'ev-square'} />;
  }

  // 5. Texture Prep
  const isabetIziImg = uploadedImages?.find((img: any) => {
    if (!img || typeof img.name !== 'string') return false;
    const name = img.name.toLowerCase().replace(/[-_\s]/g, '');
    return name === 'isabetizipng' || name === 'isabetizi';
  });

  let textureSrcRaw = (src && typeof src === 'string' && !src.startsWith('data:text')) ? src : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  
  if (sIdLower === 'tr-bullet-wall' && isabetIziImg?.src && typeof isabetIziImg.src === 'string' && isabetIziImg.src.trim() !== '') {
    textureSrcRaw = isabetIziImg.src;
  }

  const textureSrc = textureSrcRaw.startsWith('data:image/svg+xml') ? textureSrcRaw.replace(/#/g, '%23') : withBase(textureSrcRaw);

  // Dikey yüzey decalleri: pencere/duvara yapışan parmak izi vb. izler —
  // zemin decali yerine yüzeyde dikey olarak çizilir.
  if ((actualObj as any).surfaceDecal) {
    return <VerticalDecal3D textureSrc={textureSrc} width={width} height={height} zHeight={zHeight} thickness={currentWallThickness} />;
  }

  // st-1 / st-cadde / st-sokak: 2B Bezier yol motorunun 3B aynası — SVG dokuya
  // düşmez; kıvrım, kesikli orta çizgi ve yol adı 2B ile birebir çizilir.
  if (ROAD_ENGINE_IDS_3D.has(sIdLower)) {
    return <RoadDecal3D obj={actualObj} width={width} height={height} />;
  }

  const autoHeight = getStandardHeight(effSymbolId);

  // 6. Volumetric Rendering
  if (isImpactMark) {
    const allSymbols = useStore.getState().allSymbols || [];
    const flatSymbols = allSymbols.flatMap((c: any) => c.symbols || []);
    const glassDef = flatSymbols.find((s: any) => s.id === 'tr-bullet-glass');
    const wallDef = flatSymbols.find((s: any) => s.id === 'tr-bullet-wall');

    const pngSrc = sIdLower === 'tr-bullet-wall'
      ? ((isabetIziImg?.src && typeof isabetIziImg.src === 'string' && isabetIziImg.src.trim() !== '') ? isabetIziImg.src : (wallDef?.src || withBase('/assets/symbols/bullet_hole_2.webp')))
      : (glassDef?.src || withBase('/assets/symbols/bullet_hole_1.png'));
    return (
      <GlassImpact3D
        textureSrc={pngSrc}
        zHeight={zHeight || 120}
        wallThickness={currentWallThickness}
      />
    );
  }
  
  if (isWound) {
    let woundTexture = textureSrc;
    if (sIdLower === 'in-bullet-in') {
      woundTexture = WOUND_IN_SVG;
    } else if (sIdLower === 'in-bullet-out') {
      woundTexture = WOUND_OUT_SVG;
    }
    return (
      <ImpactOrWound3D 
        textureSrc={woundTexture} 
        width={width} 
        height={height} 
        zHeight={zHeight} 
        isWound={isWound} 
        zOffset={yOff}
      />
    );
  }

  if (isHuman) {
    // kk-* çocuk/yaralı figürleri: ölçekli insan modeli + uygun duruş
    const isKk = sIdLower.startsWith('kk-');
    const kkPose = (sIdLower === 'kk-child-lying' || sIdLower === 'kk-injured') ? 'supine' : 'standing';
    const humanScale = isKk ? Math.max(0.25, Math.min(2.5, height / (172 * SCALE))) : 1;
    return (
      <group position={[posX, totalOffset, posZ]} rotation={[0, rad, 0]} scale={[humanScale, humanScale, humanScale]}>
        <Humanoid3D obj={isKk ? { ...actualObj, pose: kkPose } : actualObj} zOffset={0} />
      </group>
    );
  }

  const finalW = width;
  const finalH = height;

  if (isBed) return <Bed3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} zOffset={totalOffset} />;
  if (isSofa) return <Sofa3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} zOffset={totalOffset} />;
  if (isTable) return <Table3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} zHeight={(actualObj.zHeight || 75) * SCALE} textureSrc={textureSrc} zOffset={yOff} />;
  if (isChair) return <Chair3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} zHeight={(actualObj.zHeight || 90) * SCALE} textureSrc={textureSrc} zOffset={yOff} />;
  if (isTV) return <TV3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} zHeight={(actualObj.zHeight || 120) * SCALE} textureSrc={textureSrc} zOffset={yOff} />;
  if (isKitchen) return <KitchenCounter3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} isL={sIdLower === 'f-4' || srcLower.includes('l_shape') || srcLower.includes('kitchen-l') || srcLower.includes('kitchen_l')} zOffset={yOff} />;
  if (isWardrobe) return <Wardrobe3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} doors={sIdLower.startsWith('f-7') ? 3 : sIdLower.startsWith('f-13') ? 2 : 1} zOffset={yOff} />;
  if (isCabinet) return <Cabinet3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} zHeight={(actualObj.zHeight || 210) * SCALE} zOffset={yOff} />;
  
  // Custom realistic objects
  // UÇAK / HELİKOPTER / BALON / TEKNE: kendi prosedürel modelleri (araba DEĞİL)
  if (isPlane) {
    const variant = sIdLower === 'v-plane' ? 'airliner' : sIdLower === 'v-jet' ? 'fighter' : sIdLower === 'v-privatejet' ? 'business' : 'cessna';
    return <Aircraft3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} variant={variant} fill={fill} zOffset={yOff} />;
  }
  if (isHeli) return <Helicopter3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} attack={sIdLower === 'v-atak'} fill={fill} zOffset={yOff} />;
  if (isBalloon) return <Balloon3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} fill={fill} zOffset={yOff} />;
  if (isBoat) return <Boat3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} variant={sIdLower === 'v-rowboat' ? 'rowboat' : sIdLower === 'v-motorboat' ? 'motorboat' : 'jetski'} fill={fill} zOffset={yOff} />;
  if (isVehicle) {
    // Kara taşıtları: 2B semboller karakalem YAN/¾ görünüş çizimlerdir; alfa
    // siluetini yukarı presleyen ekstrüzyon tepede yatık araç çizimi bırakıyordu
    // ("araç 3B'de yan yatmış gibi görünüyor" — kullanıcı raporu). Bu yüzden
    // TÜM kara taşıtları gerçekçi prosedürel 3B modelle çizilir; gövde rengi
    // 2B çiziminin mürekkep renginden türetilir (2B'deki araç rengiyle uyumlu).
    // Devrilmiş/yatık araçlar kendi uzun ekseni etrafında çevrilerek çizilir.
    return (
      <InkVehicle3D
        x={posX}
        y={posZ}
        width={finalW}
        height={finalH}
        rad={rad}
        type={sIdLower + ' ' + nameLower}
        fill={fill}
        textureSrc={textureSrc}
        zOffset={yOff}
        zHeight={actualObj.zHeight}
      />
    );
  }
  if (isTree) return <Tree3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} type={sIdLower} zOffset={yOff} />;
  if (isCone) return <TrafficCone3D x={posX} y={posZ} zOffset={yOff} />;
  if (isBarrier) return <SecurityBarrier3D x={posX} y={posZ} width={finalW} rad={rad} zOffset={yOff} />;
  if (isHydrant) return <FireHydrant3D x={posX} y={posZ} zOffset={yOff} />;
  if (isPole) return <UtilityPole3D x={posX} y={posZ} zOffset={yOff} />;
  if (isBench) return <Bench3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} zOffset={yOff} />;
  if (isTrafficSign) return <TrafficSign3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} type={sIdLower} textureSrc={textureSrc} zOffset={yOff} />;

  // HAYVANLAR (an-*): PNG siluetinden ekstrüzyon yerine PROSEDÜREL AYAKTA DURAN
  // 3B modeller (gövde/boyun/bacak/kuyruk/boynuz). Düz tabaka 3B'de "2B ve bozuk"
  // göründüğü için tamamen değiştirildi (kullanıcı raporu).
  if (sIdLower.startsWith('an-')) {
    return (
      <Animal3D
        x={posX}
        y={posZ}
        rad={rad}
        width={finalW}
        height={finalH}
        zOffset={totalOffset}
        symbolId={sIdLower}
      />
    );
  }

  // MİMARİ ANIT YAPILAR (arch-airport / arch-trainstation): karakalem cephe
  // çizimi ana gövdenin ön yüzüne dokulanır; hacim için gerçek 3B çatı ve
  // kontrol kulesi eklenir. Düz decal "2B ve bozuk" göründüğü için (kullanıcı
  // raporu) hayvan figürlerindeki gibi prosedürel hacimli model çizilir.
  if (isAirport) {
    return <Airport3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} textureSrc={textureSrc} />;
  }
  if (isStation) {
    return <Station3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} textureSrc={textureSrc} />;
  }

  // Fiziksel nesneler (el aletleri, silahlar, delil nesneleri, giysi/kişisel eşya,
  // katı patlama nesneleri, kovan/şarjör) yerde yatan düz decal yerine alfa
  // siluetinden ekstrüde edilmiş GERÇEK 3B hacim: üst yüz orijinal çizimi taşar,
  // yanlar dokunun ortalama renginden boyanmış katı gövdedir.
  const SOLID_EX_IDS = ['ex-9', 'ex-lpg', 'ex-kombi', 'ex-fire-extinguisher', 'ex-fuse-box', 'ex-gas-meter', 'ex-smoke-detector', 'ex-rb-1'];
  const isSolidEx = SOLID_EX_IDS.some((w) => sIdLower === w || sIdLower.startsWith(w + '-'));
  const isPhysicalEvidence = sIdLower.startsWith('ei-') || sIdLower.startsWith('an-')
    || sIdLower.startsWith('ht-') || sIdLower.startsWith('w-')
    || sIdLower.startsWith('cl-')
    || sIdLower.startsWith('tr-casing') || sIdLower === 'tr-magazine' || sIdLower === 'tr-bullet-deformed'
    || isSolidEx;

  if (isPhysicalEvidence) {
    return (
      <ExtrudedSymbol3D
        x={posX}
        y={posZ}
        rad={rad}
        width={finalW}
        height={finalH}
        textureSrc={textureSrc}
        heightCm={getExtrudeHeightCm(sIdLower)}
        zOffset={totalOffset}
        fallback={<FloorItem3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} textureSrc={textureSrc} zOffset={totalOffset} />}
      />
    );
  }

  if (isFloorItem || isFlatEvAnn || isFlatEvidence) return <FloorItem3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} textureSrc={textureSrc} zOffset={totalOffset} />;
  if (isBuilding) {
    const floors = sIdLower === 'arch-house' ? 1 : parseInt(sIdLower.replace('arch-b', ''), 10) || 1;
    return <Building3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} floors={floors} textureSrc={textureSrc} />;
  }

  // İz / delil / işaret sembolleri zeminde ince decal olarak çizilir (2D konumla birebir)
  const flatDecal = isFlatDecalId(effSymbolId);
  const bodyHeightCm = flatDecal ? FLAT_DECAL_HEIGHT_CM : (actualObj.zHeight || autoHeight);

  return <SymbolWithTexture x={posX} y={posZ} width={finalW} height={finalH} rad={rad} fill={fill} textureSrc={textureSrc} zHeight={bodyHeightCm * SCALE} isVertical={actualObj.isVertical} isWound={isWound} zOffset={yOff} />;
};

const Sofa3D = ({ width, height, rad, x, y, zOffset }: any) => {
  const w = width; // already scaled
  const d = height; // already scaled
  const h = 80 * SCALE;
  const seatH = 45 * SCALE;
  const legH = 10 * SCALE;

  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, rad, 0]}>
      {/* Legs */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([mx, mz], i) => (
        <mesh key={i} position={[(w / 2 - 4 * SCALE) * mx, legH / 2, (d / 2 - 4 * SCALE) * mz]}>
          <boxGeometry args={[4 * SCALE, legH, 4 * SCALE]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
      ))}
      {/* Seat */}
      <mesh position={[0, legH + seatH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, seatH, d]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.9} />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, legH + h - (h - seatH) / 2, -d / 2 + 5 * SCALE]} castShadow>
        <boxGeometry args={[w, h - seatH + 10 * SCALE, 10 * SCALE]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
      {/* Arms */}
      <mesh position={[-w / 2 + 5 * SCALE, legH + seatH / 2 + 5 * SCALE, 0]} castShadow>
        <boxGeometry args={[10 * SCALE, seatH + 10 * SCALE, d]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
      <mesh position={[w / 2 - 5 * SCALE, legH + seatH / 2 + 5 * SCALE, 0]} castShadow>
        <boxGeometry args={[10 * SCALE, seatH + 10 * SCALE, d]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
    </group>
  );
};

const Bed3D = ({ width, height, rad, x, y, zOffset }: any) => {
  const w = width;
  const d = height;
  const h = 45 * SCALE;
  const headH = 100 * SCALE;

  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, rad, 0]}>
      {/* Base/Frame */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* Headboard */}
      <mesh position={[0, headH / 2, -d / 2 + 2 * SCALE]} castShadow>
        <boxGeometry args={[w, headH, 4 * SCALE]} />
        <meshStandardMaterial color="#dcdcdc" />
      </mesh>
      {/* Pillows */}
      <mesh position={[-w / 4, h + 2 * SCALE, -d / 2 + 15 * SCALE]} castShadow>
        <boxGeometry args={[w / 3, 6 * SCALE, 20 * SCALE]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>
      <mesh position={[w / 4, h + 2 * SCALE, -d / 2 + 15 * SCALE]} castShadow>
        <boxGeometry args={[w / 3, 6 * SCALE, 20 * SCALE]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>
      {/* Duvet/Blanket */}
      <mesh position={[0, h + 1 * SCALE, 10 * SCALE]} castShadow>
        <boxGeometry args={[w + 2 * SCALE, 2 * SCALE, d - 30 * SCALE]} />
        <meshStandardMaterial color="#4682b4" roughness={0.7} />
      </mesh>
    </group>
  );
};

const KitchenCounter3D = ({ x, y, width, height, rad, isL, zOffset }: any) => {
  const baseH = 90 * SCALE;
  const upperH = 70 * SCALE;
  const upperY = 150 * SCALE;
  const w = width;
  const d = height;
  const upperD = 35 * SCALE;

  const depth_x = isL ? w * (56 / 180) : 0;
  const depth_z = isL ? d * (56 / 180) : d;

  const mainDoorsWidth = w - depth_x;
  const mainDoorCount = Math.max(1, Math.round(mainDoorsWidth / (50 * SCALE)));
  const mainDoorW = mainDoorsWidth / mainDoorCount;
  const mainFrontZ = isL ? -d / 2 + depth_z : d / 2;

  const lBaseDepth = d - depth_z;
  const lBaseDoorCount = isL ? Math.max(1, Math.round(lBaseDepth / (50 * SCALE))) : 0;
  const lBaseDoorW = isL ? lBaseDepth / lBaseDoorCount : 0;

  const upperWidth = w - (isL ? upperD : 0);
  const mainUpperDoorCount = Math.max(1, Math.round(upperWidth / (50 * SCALE)));
  const upperDoorW = upperWidth / mainUpperDoorCount;

  const lUpperDepth = d - upperD;
  const lUpperDoorCount = isL ? Math.max(1, Math.round(lUpperDepth / (50 * SCALE))) : 0;
  const lUpperDoorW = isL ? lUpperDepth / lUpperDoorCount : 0;

  const bodyColor = "#a0781e";
  const shelfColor = "#d4a855";
  const doorColorClosed = "#d4a855";
  const doorColorOpen = "#e8d5a3";

  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const toggleOpen = (key: string, e: any) => {
    e.stopPropagation();
    setOpenStates(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const hasMainOven = !isL;
  const hasLOven = isL;

  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, rad, 0]}>
      {isL ? (
        <group>
          <mesh position={[0, baseH / 2, -d / 2 + 1 * SCALE]} castShadow>
            <boxGeometry args={[w, baseH, 2 * SCALE]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          <mesh position={[0, 1 * SCALE, -d / 2 + depth_z / 2]} castShadow>
            <boxGeometry args={[w, 2 * SCALE, depth_z]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          <mesh position={[w / 2 - 1 * SCALE, baseH / 2, -d / 2 + depth_z / 2]} castShadow>
            <boxGeometry args={[2 * SCALE, baseH, depth_z]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          <mesh position={[0, baseH * 0.38, -d / 2 + depth_z / 2]}>
            <boxGeometry args={[w - 4 * SCALE, 1.5 * SCALE, depth_z - 4 * SCALE]} />
            <meshStandardMaterial color={shelfColor} roughness={0.6} />
          </mesh>
          <mesh position={[-w / 2 + 1 * SCALE, baseH / 2, -d / 2 + depth_z + (d - depth_z) / 2]} castShadow>
            <boxGeometry args={[2 * SCALE, baseH, d - depth_z]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          <mesh position={[-w / 2 + depth_x / 2, 1 * SCALE, -d / 2 + depth_z + (d - depth_z) / 2]} castShadow>
            <boxGeometry args={[depth_x, 2 * SCALE, d - depth_z]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          <mesh position={[-w / 2 + depth_x / 2, baseH * 0.38, -d / 2 + depth_z + (d - depth_z) / 2]}>
            <boxGeometry args={[depth_x - 4 * SCALE, 1.5 * SCALE, d - depth_z - 4 * SCALE]} />
            <meshStandardMaterial color={shelfColor} roughness={0.6} />
          </mesh>
          <mesh position={[-w / 2 + depth_x / 2, baseH / 2, d / 2 - 1 * SCALE]} castShadow>
            <boxGeometry args={[depth_x, baseH, 2 * SCALE]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
        </group>
      ) : (
        <group>
          <mesh position={[0, baseH / 2, -d / 2 + 1 * SCALE]} castShadow>
            <boxGeometry args={[w, baseH, 2 * SCALE]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          <mesh position={[-w / 2 + 1 * SCALE, baseH / 2, 0]} castShadow>
            <boxGeometry args={[2 * SCALE, baseH, d]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          <mesh position={[w / 2 - 1 * SCALE, baseH / 2, 0]} castShadow>
            <boxGeometry args={[2 * SCALE, baseH, d]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          <mesh position={[0, 1 * SCALE, 0]} castShadow>
            <boxGeometry args={[w, 2 * SCALE, d]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          <mesh position={[0, baseH * 0.38, 0]}>
            <boxGeometry args={[w - 4 * SCALE, 1.5 * SCALE, d - 4 * SCALE]} />
            <meshStandardMaterial color={shelfColor} roughness={0.6} />
          </mesh>
        </group>
      )}
      <group position={[0, 0, mainFrontZ - 0.5 * SCALE]}>
        <mesh position={[-w / 2 + depth_x + mainDoorsWidth / 2, baseH - 1 * SCALE, 0]}>
          <boxGeometry args={[mainDoorsWidth, 2 * SCALE, 1 * SCALE]} />
          <meshStandardMaterial color={bodyColor} roughness={0.5} />
        </mesh>
        <mesh position={[-w / 2 + depth_x + mainDoorsWidth / 2, baseH * 0.71, 0]}>
          <boxGeometry args={[mainDoorsWidth, 2 * SCALE, 1 * SCALE]} />
          <meshStandardMaterial color={bodyColor} roughness={0.5} />
        </mesh>
        <mesh position={[-w / 2 + depth_x + mainDoorsWidth / 2, 1 * SCALE, 0]}>
          <boxGeometry args={[mainDoorsWidth, 2 * SCALE, 1 * SCALE]} />
          <meshStandardMaterial color={bodyColor} roughness={0.5} />
        </mesh>
        {Array.from({ length: mainDoorCount + 1 }).map((_, j) => {
          const xPos = -w / 2 + depth_x + mainDoorW * j;
          return (
            <mesh key={j} position={[xPos, baseH / 2, 0]}>
              <boxGeometry args={[1.5 * SCALE, baseH, 1 * SCALE]} />
              <meshStandardMaterial color={bodyColor} roughness={0.5} />
            </mesh>
          );
        })}
      </group>
      {isL && (
        <group position={[-w / 2 + depth_x - 0.5 * SCALE, 0, 0]}>
          <mesh position={[0, baseH - 1 * SCALE, -d / 2 + depth_z + lBaseDepth / 2]}>
            <boxGeometry args={[1 * SCALE, 2 * SCALE, lBaseDepth]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          <mesh position={[0, baseH * 0.71, -d / 2 + depth_z + lBaseDepth / 2]}>
            <boxGeometry args={[1 * SCALE, 2 * SCALE, lBaseDepth]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          <mesh position={[0, 1 * SCALE, -d / 2 + depth_z + lBaseDepth / 2]}>
            <boxGeometry args={[1 * SCALE, 2 * SCALE, lBaseDepth]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          {Array.from({ length: lBaseDoorCount + 1 }).map((_, j) => {
            const zPos = -d / 2 + depth_z + lBaseDoorW * j;
            return (
              <mesh key={j} position={[0, baseH / 2, zPos]}>
                <boxGeometry args={[1 * SCALE, baseH, 1.5 * SCALE]} />
                <meshStandardMaterial color={bodyColor} roughness={0.5} />
              </mesh>
            );
          })}
        </group>
      )}
      {isL ? (
        <group>
          <mesh position={[0, baseH + 1.25 * SCALE, -d / 2 + depth_z / 2]} castShadow receiveShadow>
            <boxGeometry args={[w, 2.5 * SCALE, depth_z]} />
            <meshStandardMaterial color="#2c3e50" metalness={0.8} roughness={0.1} />
          </mesh>
          <mesh position={[-w / 2 + depth_x / 2, baseH + 1.25 * SCALE, -d / 2 + depth_z + (d - depth_z) / 2]} castShadow receiveShadow>
            <boxGeometry args={[depth_x, 2.5 * SCALE, d - depth_z]} />
            <meshStandardMaterial color="#2c3e50" metalness={0.8} roughness={0.1} />
          </mesh>
        </group>
      ) : (
        <mesh position={[0, baseH + 1.25 * SCALE, 0]} castShadow receiveShadow>
          <boxGeometry args={[w + 1 * SCALE, 2.5 * SCALE, d + 1 * SCALE]} />
          <meshStandardMaterial color="#2c3e50" metalness={0.8} roughness={0.1} />
        </mesh>
      )}
      <mesh position={[isL ? w * 0.25 : 0, baseH + 2.5 * SCALE, isL ? -d / 2 + depth_z * 0.5 : 0]} castShadow>
        <boxGeometry args={[isL ? w * 0.3 : w * 0.35, 4 * SCALE, isL ? depth_z * 0.4 : d * 0.3]} />
        <meshStandardMaterial color="#7f8c8d" metalness={0.95} roughness={0.15} />
      </mesh>
      <mesh position={[isL ? w * 0.25 : 0, baseH + 4 * SCALE, isL ? -d / 2 + depth_z * 0.5 : 0]}>
        <boxGeometry args={[isL ? w * 0.24 : w * 0.28, 1 * SCALE, isL ? depth_z * 0.3 : d * 0.22]} />
        <meshStandardMaterial color="#555" metalness={1} roughness={0.05} />
      </mesh>
      <mesh position={[isL ? w * 0.25 : 0, baseH + 6 * SCALE, isL ? -d / 2 + depth_z * 0.25 : -d * 0.1]}>
        <cylinderGeometry args={[0.8 * SCALE, 0.8 * SCALE, 6 * SCALE, 8]} />
        <meshStandardMaterial color="#aaa" metalness={1} roughness={0.1} />
      </mesh>
      <mesh position={[isL ? w * 0.25 : 0, baseH + 9 * SCALE, isL ? -d / 2 + depth_z * 0.35 : 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.6 * SCALE, 0.6 * SCALE, 4 * SCALE, 8]} />
        <meshStandardMaterial color="#aaa" metalness={1} roughness={0.1} />
      </mesh>
      <group position={[isL ? -w / 2 + depth_x * 0.5 : -w * 0.2, baseH + 2.5 * SCALE, isL ? -d / 2 + depth_z + (d - depth_z) * 0.5 : d * 0.15]}>
        <mesh castShadow>
          <boxGeometry args={[isL ? depth_x * 0.7 : w * 0.3, 2 * SCALE, isL ? (d - depth_z) * 0.55 : d * 0.3]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.05} metalness={0.9} />
        </mesh>
        {[-1, 1].map((bx) =>
          [-1, 1].map((bz) => (
            <mesh key={`b${bx}${bz}`} position={[bx * (isL ? depth_x * 0.15 : w * 0.07), 1.1 * SCALE, bz * (isL ? (d - depth_z) * 0.12 : d * 0.07)]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.2 * SCALE, 3.5 * SCALE, 16]} />
              <meshBasicMaterial color="#e74c3c" />
            </mesh>
          ))
        )}
      </group>
      {/* ===== MAIN SEGMENT: Oven (slot 0) or Drawers (other slots) ===== */}
      {Array.from({ length: mainDoorCount }).map((_, i) => {
        const slotX = -w / 2 + depth_x + mainDoorW * i;
        const slotCenterX = slotX + mainDoorW / 2;

        // For straight counter: front face is at +d/2 in local Z (facing +Z).
        // For L counter: main segment front face is at mainFrontZ facing +Z.
        const faceZ = mainFrontZ; // already correct for both types

        if (hasMainOven && i === 0) {
          const key = `oven-main`;
          const open = openStates[key] || false;
          const ovenDepth = isL ? depth_z * 0.7 : d * 0.7;
          const ovenBodyZ = faceZ - ovenDepth / 2;
          return (
            <group key={`oven-main-gp`}>
              {/* Oven body cavity */}
              <mesh position={[slotCenterX, baseH * 0.45, ovenBodyZ]}>
                <boxGeometry args={[mainDoorW - 4 * SCALE, baseH * 0.5, ovenDepth]} />
                <meshStandardMaterial color="#1e1e1e" roughness={0.8} />
              </mesh>
              {/* Oven grill */}
              <mesh position={[slotCenterX, baseH * 0.45, ovenBodyZ]}>
                <boxGeometry args={[mainDoorW - 6 * SCALE, 0.5 * SCALE, ovenDepth - 2 * SCALE]} />
                <meshStandardMaterial color="#555" metalness={0.9} />
              </mesh>
              {/* Control panel (face plate behind door) */}
              <mesh position={[slotCenterX, baseH * 0.5, faceZ + 0.6 * SCALE]} castShadow>
                <boxGeometry args={[mainDoorW - 0.8 * SCALE, baseH - 4 * SCALE, 1.2 * SCALE]} />
                <meshStandardMaterial color="#111" roughness={0.1} metalness={0.9} />
              </mesh>
              {/* Knob rail */}
              <mesh position={[slotCenterX, baseH * 0.85, faceZ + 1.3 * SCALE]} castShadow>
                <boxGeometry args={[mainDoorW - 1.2 * SCALE, 10 * SCALE, 0.4 * SCALE]} />
                <meshStandardMaterial color="#7f8c8d" metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Knobs */}
              {[-1.5, 0, 1.5].map((kx) => (
                <mesh key={kx} position={[slotCenterX + kx * 4 * SCALE, baseH * 0.85, faceZ + 1.6 * SCALE]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.8 * SCALE, 0.8 * SCALE, 0.8 * SCALE, 8]} />
                  <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
                </mesh>
              ))}
              {/* Digital display */}
              <mesh position={[slotCenterX - 5 * SCALE, baseH * 0.85, faceZ + 1.55 * SCALE]}>
                <boxGeometry args={[4 * SCALE, 2.5 * SCALE, 0.1 * SCALE]} />
                <meshStandardMaterial color="#000" emissive="#ff3300" emissiveIntensity={0.5} />
              </mesh>
              {/* Oven door (hinged at bottom, drops down) */}
              <group position={[slotCenterX, baseH * 0.2, faceZ + 1.25 * SCALE]} rotation={[open ? Math.PI * 0.45 : 0, 0, 0]}>
                <mesh position={[0, baseH * 0.25, 0.05 * SCALE]} onClick={(e) => toggleOpen(key, e)} castShadow>
                  <boxGeometry args={[mainDoorW - 2 * SCALE, baseH * 0.5, 0.8 * SCALE]} />
                  <meshStandardMaterial color="#111" roughness={0.1} metalness={0.9} />
                </mesh>
                {/* Glass window */}
                <mesh position={[0, baseH * 0.25, 0.46 * SCALE]} onClick={(e) => toggleOpen(key, e)}>
                  <boxGeometry args={[mainDoorW - 6 * SCALE, baseH * 0.35, 0.1 * SCALE]} />
                  <meshStandardMaterial color="#222" roughness={0.05} metalness={0.95} transparent opacity={0.7} />
                </mesh>
                {/* Handle */}
                <mesh position={[0, baseH * 0.45, 0.6 * SCALE]} onClick={(e) => toggleOpen(key, e)}>
                  <boxGeometry args={[mainDoorW * 0.7, 1.2 * SCALE, 0.8 * SCALE]} />
                  <meshStandardMaterial color="#eee" metalness={0.95} roughness={0.05} />
                </mesh>
              </group>
            </group>
          );
        }

        // Drawer for this slot
        const key = `drawer-${i}`;
        const open = openStates[key] || false;
        const drawerH = baseH * 0.20 - 2 * SCALE;
        const drawerBodyDepth = isL ? depth_z * 0.7 : d * 0.7;
        // Slide direction: for straight counter, drawers slide in +Z; for L counter, they also slide in +Z
        const drawerSlide = open ? 22 * SCALE : 0;
        return (
          <group key={`drawer-gp-${i}`} onClick={(e) => toggleOpen(key, e)}>
            {/* Inner drawer body */}
            <mesh position={[slotCenterX, baseH * 0.82, faceZ - drawerBodyDepth / 2]}>
              <boxGeometry args={[mainDoorW - 4 * SCALE, drawerH - 2 * SCALE, drawerBodyDepth]} />
              <meshStandardMaterial color={shelfColor} roughness={0.6} />
            </mesh>
            {/* Front panel */}
            <mesh position={[slotCenterX, baseH * 0.82, faceZ + 0.6 * SCALE + drawerSlide]} castShadow>
              <boxGeometry args={[mainDoorW - 0.8 * SCALE, drawerH, 1.2 * SCALE]} />
              <meshStandardMaterial color={open ? doorColorOpen : doorColorClosed} roughness={0.4} />
            </mesh>
            {/* Horizontal handle */}
            <mesh position={[slotCenterX, baseH * 0.82, faceZ + 1.4 * SCALE + drawerSlide]} onClick={(e) => toggleOpen(key, e)}>
              <boxGeometry args={[mainDoorW * 0.4, 1.5 * SCALE, 1 * SCALE]} />
              <meshStandardMaterial color="#ccc" metalness={0.95} roughness={0.05} />
            </mesh>
          </group>
        );
      })}

      {/* ===== L SEGMENT: Oven (slot 0) or Drawers (other slots) ===== */}
      {isL && Array.from({ length: lBaseDoorCount }).map((_, i) => {
        const pivotZ = -d / 2 + depth_z + lBaseDoorW * i;
        const cz = pivotZ + lBaseDoorW / 2;
        // L-segment front face is at -w/2+depth_x in local X, facing -X direction
        const faceX = -w / 2 + depth_x;

        if (hasLOven && i === 0) {
          const key = `oven-l`;
          const open = openStates[key] || false;
          const ovenDepth = depth_x * 0.7;
          const ovenBodyX = faceX - ovenDepth / 2;
          return (
            <group key={`oven-l-gp`}>
              {/* Oven body cavity */}
              <mesh position={[ovenBodyX, baseH * 0.45, cz]}>
                <boxGeometry args={[ovenDepth, baseH * 0.5, lBaseDoorW - 4 * SCALE]} />
                <meshStandardMaterial color="#1e1e1e" roughness={0.8} />
              </mesh>
              {/* Oven grill */}
              <mesh position={[ovenBodyX, baseH * 0.45, cz]}>
                <boxGeometry args={[ovenDepth - 2 * SCALE, 0.5 * SCALE, lBaseDoorW - 6 * SCALE]} />
                <meshStandardMaterial color="#555" metalness={0.9} />
              </mesh>
              {/* Control panel face plate */}
              <mesh position={[faceX + 0.6 * SCALE, baseH * 0.5, cz]} castShadow>
                <boxGeometry args={[1.2 * SCALE, baseH - 4 * SCALE, lBaseDoorW - 0.8 * SCALE]} />
                <meshStandardMaterial color="#111" roughness={0.1} metalness={0.9} />
              </mesh>
              {/* Knob rail */}
              <mesh position={[faceX + 1.3 * SCALE, baseH * 0.85, cz]} castShadow>
                <boxGeometry args={[0.4 * SCALE, 10 * SCALE, lBaseDoorW - 1.2 * SCALE]} />
                <meshStandardMaterial color="#7f8c8d" metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Knobs */}
              {[-1.5, 0, 1.5].map((kx) => (
                <mesh key={kx} position={[faceX + 1.6 * SCALE, baseH * 0.85, cz + kx * 4 * SCALE]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.8 * SCALE, 0.8 * SCALE, 0.8 * SCALE, 8]} />
                  <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
                </mesh>
              ))}
              {/* Oven door (hinged at bottom, drops in -X direction) */}
              <group position={[faceX + 1.25 * SCALE, baseH * 0.2, cz]} rotation={[0, 0, open ? -Math.PI * 0.45 : 0]}>
                <mesh position={[0.05 * SCALE, baseH * 0.25, 0]} onClick={(e) => toggleOpen(key, e)} castShadow>
                  <boxGeometry args={[0.8 * SCALE, baseH * 0.5, lBaseDoorW - 2 * SCALE]} />
                  <meshStandardMaterial color="#111" roughness={0.1} metalness={0.9} />
                </mesh>
                <mesh position={[0.46 * SCALE, baseH * 0.25, 0]} onClick={(e) => toggleOpen(key, e)}>
                  <boxGeometry args={[0.1 * SCALE, baseH * 0.35, lBaseDoorW - 6 * SCALE]} />
                  <meshStandardMaterial color="#222" roughness={0.05} metalness={0.95} transparent opacity={0.7} />
                </mesh>
                <mesh position={[0.6 * SCALE, baseH * 0.45, 0]} onClick={(e) => toggleOpen(key, e)}>
                  <boxGeometry args={[0.8 * SCALE, 1.2 * SCALE, lBaseDoorW * 0.7]} />
                  <meshStandardMaterial color="#eee" metalness={0.95} roughness={0.05} />
                </mesh>
              </group>
            </group>
          );
        }

        // L-segment drawer
        const key = `ldrawer-${i}`;
        const open = openStates[key] || false;
        const drawerH = baseH * 0.20 - 2 * SCALE;
        const drawerBodyDepth = depth_x * 0.7;
        // Slide direction: L-drawers slide in -X direction (outward from face)
        const drawerSlide = open ? 22 * SCALE : 0;
        return (
          <group key={`ldrawer-gp-${i}`} onClick={(e) => toggleOpen(key, e)}>
            {/* Inner drawer body */}
            <mesh position={[faceX - drawerBodyDepth / 2, baseH * 0.82, cz]}>
              <boxGeometry args={[drawerBodyDepth, drawerH - 2 * SCALE, lBaseDoorW - 4 * SCALE]} />
              <meshStandardMaterial color={shelfColor} roughness={0.6} />
            </mesh>
            {/* Front panel */}
            <mesh position={[faceX + 0.6 * SCALE - drawerSlide, baseH * 0.82, cz]} castShadow>
              <boxGeometry args={[1.2 * SCALE, drawerH, lBaseDoorW - 0.8 * SCALE]} />
              <meshStandardMaterial color={open ? doorColorOpen : doorColorClosed} roughness={0.4} />
            </mesh>
            {/* Horizontal handle */}
            <mesh position={[faceX + 1.4 * SCALE - drawerSlide, baseH * 0.82, cz]} onClick={(e) => toggleOpen(key, e)}>
              <boxGeometry args={[1 * SCALE, 1.5 * SCALE, lBaseDoorW * 0.4]} />
              <meshStandardMaterial color="#ccc" metalness={0.95} roughness={0.05} />
            </mesh>
          </group>
        );
      })}
      {Array.from({ length: mainDoorCount }).map((_, i) => {
        if (hasMainOven && i === 0) return null;
        const key = `base-${i}`;
        const open = openStates[key] || false;
        const pivotX = -w / 2 + depth_x + mainDoorW * i;
        const doorH = baseH * 0.68 - 2 * SCALE;
        return (
          <group key={`door-gp-${i}`} position={[pivotX, baseH * 0.38, mainFrontZ]} onClick={(e) => toggleOpen(key, e)}>
            <group rotation={[0, open ? -Math.PI * 0.5 : 0, 0]}>
              <mesh position={[mainDoorW / 2, 0, 0.6 * SCALE]} castShadow>
                <boxGeometry args={[mainDoorW - 0.8 * SCALE, doorH, 1.2 * SCALE]} />
                <meshStandardMaterial color={open ? doorColorOpen : doorColorClosed} roughness={0.4} />
              </mesh>
              <mesh position={[mainDoorW * 0.8, 0, 1.3 * SCALE]} onClick={(e) => toggleOpen(key, e)}>
                <boxGeometry args={[1.5 * SCALE, doorH * 0.3, 1 * SCALE]} />
                <meshStandardMaterial color="#ccc" metalness={0.95} roughness={0.05} />
              </mesh>
            </group>
          </group>
        );
      })}
      {isL && Array.from({ length: lBaseDoorCount }).map((_, i) => {
        if (hasLOven && i === 0) return null;
        const key = `lbase-${i}`;
        const open = openStates[key] || false;
        const pivotZ = -d / 2 + depth_z + lBaseDoorW * i;
        const swingDir = 1;
        const doorCenterZ = lBaseDoorW / 2;
        const handleZ = lBaseDoorW * 0.75;
        const doorH = baseH * 0.68 - 2 * SCALE;
        return (
          <group key={`lbase-gp-${i}`} position={[-w / 2 + depth_x, baseH * 0.38, pivotZ]} onClick={(e) => toggleOpen(key, e)}>
            <group rotation={[0, open ? swingDir * Math.PI * 0.5 : 0, 0]}>
              <mesh position={[0.6 * SCALE, 0, doorCenterZ]} castShadow>
                <boxGeometry args={[1.2 * SCALE, doorH, lBaseDoorW - 0.8 * SCALE]} />
                <meshStandardMaterial color={open ? doorColorOpen : doorColorClosed} roughness={0.4} />
              </mesh>
              <mesh position={[1.3 * SCALE, 0, handleZ]} onClick={(e) => toggleOpen(key, e)}>
                <boxGeometry args={[1 * SCALE, doorH * 0.3, 1.5 * SCALE]} />
                <meshStandardMaterial color="#ccc" metalness={0.95} roughness={0.05} />
              </mesh>
            </group>
          </group>
        );
      })}
      {/* Upper Cabinet Main Segment Body & Shelves */}
      <mesh position={[(isL ? upperD : 0) / 2, upperY + upperH / 2, -d / 2 + 1 * SCALE]} castShadow>
        <boxGeometry args={[w - (isL ? upperD : 0), upperH, 2 * SCALE]} />
        <meshStandardMaterial color={bodyColor} roughness={0.5} />
      </mesh>
      <mesh position={[(isL ? upperD : 0) / 2, upperY + upperH - 1 * SCALE, -d / 2 + upperD / 2]} castShadow>
        <boxGeometry args={[w - (isL ? upperD : 0), 2 * SCALE, upperD]} />
        <meshStandardMaterial color={bodyColor} roughness={0.5} />
      </mesh>
      <mesh position={[(isL ? upperD : 0) / 2, upperY + 1 * SCALE, -d / 2 + upperD / 2]} castShadow>
        <boxGeometry args={[w - (isL ? upperD : 0), 2 * SCALE, upperD]} />
        <meshStandardMaterial color={bodyColor} roughness={0.5} />
      </mesh>
      <mesh position={[w / 2 - 1 * SCALE, upperY + upperH / 2, -d / 2 + upperD / 2]} castShadow>
        <boxGeometry args={[2 * SCALE, upperH, upperD]} />
        <meshStandardMaterial color={bodyColor} roughness={0.5} />
      </mesh>
      {!isL && (
        <mesh position={[-w / 2 + 1 * SCALE, upperY + upperH / 2, -d / 2 + upperD / 2]} castShadow>
          <boxGeometry args={[2 * SCALE, upperH, upperD]} />
          <meshStandardMaterial color={bodyColor} roughness={0.5} />
        </mesh>
      )}
      {/* Mid shelf for main segment */}
      <mesh position={[(isL ? upperD : 0) / 2, upperY + upperH * 0.5, -d / 2 + upperD / 2]}>
        <boxGeometry args={[w - (isL ? upperD : 0) - 2 * SCALE, 1.5 * SCALE, upperD - 2 * SCALE]} />
        <meshStandardMaterial color={shelfColor} roughness={0.6} />
      </mesh>

      {/* Upper Cabinet L Segment Body & Shelves */}
      {isL && (
        <group>
          <mesh position={[-w / 2 + 1 * SCALE, upperY + upperH / 2, upperD / 2]} castShadow>
            <boxGeometry args={[2 * SCALE, upperH, d - upperD]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          <mesh position={[-w / 2 + upperD / 2, upperY + upperH - 1 * SCALE, upperD / 2]} castShadow>
            <boxGeometry args={[upperD, 2 * SCALE, d - upperD]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          <mesh position={[-w / 2 + upperD / 2, upperY + 1 * SCALE, upperD / 2]} castShadow>
            <boxGeometry args={[upperD, 2 * SCALE, d - upperD]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          <mesh position={[-w / 2 + upperD / 2, upperY + upperH / 2, d / 2 - 1 * SCALE]} castShadow>
            <boxGeometry args={[upperD, upperH, 2 * SCALE]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          {/* Mid shelf for L segment */}
          <mesh position={[-w / 2 + upperD / 2, upperY + upperH * 0.5, upperD / 2]}>
            <boxGeometry args={[upperD - 2 * SCALE, 1.5 * SCALE, d - upperD - 2 * SCALE]} />
            <meshStandardMaterial color={shelfColor} roughness={0.6} />
          </mesh>
        </group>
      )}

      {/* Main Upper Stiles and Horizontal Rails */}
      <group position={[0, 0, -d / 2 + upperD - 0.5 * SCALE]}>
        {/* Horizontal rails */}
        <mesh position={[(isL ? upperD : 0) / 2, upperY + upperH - 1 * SCALE, 0]}>
          <boxGeometry args={[w - (isL ? upperD : 0), 2 * SCALE, 1 * SCALE]} />
          <meshStandardMaterial color={bodyColor} roughness={0.5} />
        </mesh>
        <mesh position={[(isL ? upperD : 0) / 2, upperY + 1 * SCALE, 0]}>
          <boxGeometry args={[w - (isL ? upperD : 0), 2 * SCALE, 1 * SCALE]} />
          <meshStandardMaterial color={bodyColor} roughness={0.5} />
        </mesh>
        {/* Vertical stiles */}
        {Array.from({ length: mainUpperDoorCount + 1 }).map((_, j) => {
          const xPos = -w / 2 + (isL ? upperD : 0) + upperDoorW * j;
          return (
            <mesh key={j} position={[xPos, upperY + upperH / 2, 0]}>
              <boxGeometry args={[1.5 * SCALE, upperH, 1 * SCALE]} />
              <meshStandardMaterial color={bodyColor} roughness={0.5} />
            </mesh>
          );
        })}
      </group>

      {/* L Upper Stiles and Horizontal Rails */}
      {isL && (
        <group position={[-w / 2 + upperD - 0.5 * SCALE, 0, 0]}>
          {/* Horizontal rails */}
          <mesh position={[0, upperY + upperH - 1 * SCALE, upperD / 2]}>
            <boxGeometry args={[1 * SCALE, 2 * SCALE, d - upperD]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          <mesh position={[0, upperY + 1 * SCALE, upperD / 2]}>
            <boxGeometry args={[1 * SCALE, 2 * SCALE, d - upperD]} />
            <meshStandardMaterial color={bodyColor} roughness={0.5} />
          </mesh>
          {/* Vertical stiles */}
          {Array.from({ length: lUpperDoorCount + 1 }).map((_, j) => {
            const zPos = -d / 2 + upperD + lUpperDoorW * j;
            return (
              <mesh key={j} position={[0, upperY + upperH / 2, zPos]}>
                <boxGeometry args={[1 * SCALE, upperH, 1.5 * SCALE]} />
                <meshStandardMaterial color={bodyColor} roughness={0.5} />
              </mesh>
            );
          })}
        </group>
      )}
      {Array.from({ length: mainUpperDoorCount }).map((_, i) => {
        const key = `upper-${i}`;
        const open = openStates[key] || false;
        const pivotX = -w / 2 + (isL ? upperD : 0) + upperDoorW * i;
        return (
          <group key={i} position={[pivotX, upperY + upperH / 2, -d / 2 + upperD]} onClick={(e) => toggleOpen(key, e)}>
            <group rotation={[0, open ? -Math.PI * 0.5 : 0, 0]}>
              <mesh position={[upperDoorW / 2, 0, 0.6 * SCALE]} castShadow>
                <boxGeometry args={[upperDoorW - 0.8 * SCALE, upperH - 3 * SCALE, 1.2 * SCALE]} />
                <meshStandardMaterial color={open ? doorColorOpen : doorColorClosed} roughness={0.3} />
              </mesh>
              <mesh position={[upperDoorW * 0.8, 0, 1.4 * SCALE]} onClick={(e) => toggleOpen(key, e)}>
                <boxGeometry args={[1.2 * SCALE, (upperH - 3 * SCALE) * 0.3, 0.8 * SCALE]} />
                <meshStandardMaterial color="#ccc" metalness={0.95} roughness={0.05} />
              </mesh>
            </group>
          </group>
        );
      })}
      {isL && Array.from({ length: lUpperDoorCount }).map((_, i) => {
        const key = `lupper-${i}`;
        const open = openStates[key] || false;
        const pivotZ = -d / 2 + upperD + lUpperDoorW * i;
        const swingDir = 1;
        const doorCenterZ = lUpperDoorW / 2;
        const handleZ = lUpperDoorW * 0.75;
        return (
          <group key={i} position={[-w / 2 + upperD, upperY + upperH / 2, pivotZ]} onClick={(e) => toggleOpen(key, e)}>
            <group rotation={[0, open ? swingDir * Math.PI * 0.5 : 0, 0]}>
              <mesh position={[0.6 * SCALE, 0, doorCenterZ]} castShadow>
                <boxGeometry args={[1.2 * SCALE, upperH - 3 * SCALE, lUpperDoorW - 0.8 * SCALE]} />
                <meshStandardMaterial color={open ? doorColorOpen : doorColorClosed} roughness={0.3} />
              </mesh>
              {/* Vertical Handle */}
              <mesh position={[1.4 * SCALE, 0, handleZ]} onClick={(e) => toggleOpen(key, e)}>
                <boxGeometry args={[0.8 * SCALE, (upperH - 3 * SCALE) * 0.3, 1.2 * SCALE]} />
                <meshStandardMaterial color="#ccc" metalness={0.95} roughness={0.05} />
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
  );
};

// Wardrobe3D — dedicated wardrobe with individually clickable sliding/swinging doors
const Wardrobe3D = ({ x, y, width, height, rad, doors, zOffset }: any) => {
  const numDoors = doors || 2;
  const h = 220 * SCALE;
  const w = width;
  const d = height;
  const frameT = 2.5 * SCALE;
  const doorW = (w - frameT * 2) / numDoors;

  const [openDoors, setOpenDoors] = useState<boolean[]>(() => Array(numDoors).fill(false));
  const toggleDoor = (i: number, e: any) => {
    e.stopPropagation();
    e.nativeEvent?.stopPropagation?.();
    setOpenDoors(prev => prev.map((v, idx) => idx === i ? !v : v));
  };

  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, rad, 0]}>
      {/* Back panel */}
      <mesh position={[0, h / 2, -d / 2 + frameT / 2]} castShadow>
        <boxGeometry args={[w, h, frameT]} />
        <meshStandardMaterial color="#b8860b" roughness={0.5} />
      </mesh>
      {/* Left side panel */}
      <mesh position={[-w / 2 + frameT / 2, h / 2, 0]} castShadow>
        <boxGeometry args={[frameT, h, d]} />
        <meshStandardMaterial color="#a0781e" roughness={0.5} />
      </mesh>
      {/* Right side panel */}
      <mesh position={[w / 2 - frameT / 2, h / 2, 0]} castShadow>
        <boxGeometry args={[frameT, h, d]} />
        <meshStandardMaterial color="#a0781e" roughness={0.5} />
      </mesh>
      {/* Top panel */}
      <mesh position={[0, h - frameT / 2, 0]}>
        <boxGeometry args={[w, frameT, d]} />
        <meshStandardMaterial color="#a0781e" roughness={0.5} />
      </mesh>
      {/* Bottom panel */}
      <mesh position={[0, frameT / 2, 0]}>
        <boxGeometry args={[w, frameT, d]} />
        <meshStandardMaterial color="#a0781e" roughness={0.5} />
      </mesh>
      {/* Interior shelves */}
      {[0.3, 0.55, 0.75].map((level, i) => (
        <mesh key={i} position={[0, h * level, 0]}>
          <boxGeometry args={[w - frameT * 2 - 0.5 * SCALE, 1.5 * SCALE, d - frameT - 1 * SCALE]} />
          <meshStandardMaterial color="#d4a855" roughness={0.6} />
        </mesh>
      ))}
      {/* Hanging rail */}
      <mesh position={[0, h * 0.85, 0]}>
        <cylinderGeometry args={[0.8 * SCALE, 0.8 * SCALE, w - frameT * 2, 8]} />
        <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Doors — swinging outward */}
      {openDoors.map((open, i) => {
        const isLeftHinge = i % 2 === 0;
        const pivotX = -w / 2 + frameT + doorW * (isLeftHinge ? i : i + 1);
        const swingDir = isLeftHinge ? -1 : 1;
        const panelOffsetX = isLeftHinge ? doorW / 2 : -doorW / 2;
        const handleOffsetX = isLeftHinge ? doorW - 5 * SCALE : -doorW + 5 * SCALE;
        return (
          <group key={i} position={[pivotX, h / 2, d / 2]}>
            <group rotation={[0, open ? swingDir * Math.PI * 0.5 : 0, 0]}>
              <mesh position={[panelOffsetX, 0, 0.8 * SCALE]} castShadow onClick={(e) => toggleDoor(i, e)}>
                <boxGeometry args={[doorW - 0.3 * SCALE, h - frameT * 2 - 0.5 * SCALE, 2 * SCALE]} />
                <meshStandardMaterial color={open ? "#e8d5a3" : "#d4a855"} roughness={0.35} metalness={0.05} />
              </mesh>
              {/* Door handle */}
              <mesh position={[handleOffsetX, 0, 1.9 * SCALE]}>
                <boxGeometry args={[1.2 * SCALE, 14 * SCALE, 1 * SCALE]} />
                <meshStandardMaterial color="#ccc" metalness={0.95} roughness={0.05} />
              </mesh>
              {/* Door frame outline (darker border) */}
              <mesh position={[panelOffsetX, 0, 0.2 * SCALE]}>
                <boxGeometry args={[doorW - 1 * SCALE, h - frameT * 2 - 3 * SCALE, 0.3 * SCALE]} />
                <meshStandardMaterial color="#8b6914" roughness={0.6} />
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
  );
};

const Cabinet3D = ({ x, y, width, height, rad, zHeight, zOffset }: any) => {
  const [open, setOpen] = useState(false);
  const h = zHeight || 210 * SCALE;
  const w = width;
  const d = height;
  const frameT = 3 * SCALE;

  const handleOpenClose = (e: any) => {
    e.stopPropagation();
    e.nativeEvent?.stopPropagation?.();
    setOpen(v => !v);
  };

  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, rad, 0]}>
      {/* Back Wall */}
      <mesh position={[0, h / 2, -d / 2 + frameT / 2]} castShadow>
        <boxGeometry args={[w, h, frameT]} />
        <meshStandardMaterial color="#d2b48c" />
      </mesh>
      {/* Side Walls */}
      <mesh position={[-w / 2 + frameT / 2, h / 2, 0]} castShadow>
        <boxGeometry args={[frameT, h, d]} />
        <meshStandardMaterial color="#c3a07a" />
      </mesh>
      <mesh position={[w / 2 - frameT / 2, h / 2, 0]} castShadow>
        <boxGeometry args={[frameT, h, d]} />
        <meshStandardMaterial color="#c3a07a" />
      </mesh>
      {/* Top & Bottom */}
      <mesh position={[0, h - frameT / 2, 0]}>
        <boxGeometry args={[w, frameT, d]} />
        <meshStandardMaterial color="#c3a07a" />
      </mesh>
      <mesh position={[0, frameT / 2, 0]}>
        <boxGeometry args={[w, frameT, d]} />
        <meshStandardMaterial color="#c3a07a" />
      </mesh>
      
      {/* Internal Shelves */}
      {[0.25, 0.5, 0.75].map((level, i) => (
        <mesh key={i} position={[0, h * level, 0]}>
          <boxGeometry args={[w - frameT * 2, 2 * SCALE, d - frameT]} />
          <meshStandardMaterial color="#e6d5b8" />
        </mesh>
      ))}

      {/* Left Door */}
      <group position={[-w / 2, h / 2, d / 2]}>
        <group rotation={[0, open ? -Math.PI * 0.5 : 0, 0]}>
          <mesh position={[w / 4, 0, 0]} castShadow onClick={handleOpenClose}>
            <boxGeometry args={[w / 2 - 0.2, h - frameT * 2, 2 * SCALE]} />
            <meshStandardMaterial color="#f0f0f0" />
          </mesh>
          {/* Handle */}
          <mesh position={[w / 2 - 5 * SCALE, 0, 2 * SCALE]}>
            <boxGeometry args={[1 * SCALE, 15 * SCALE, 1 * SCALE]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        </group>
      </group>
      
      {/* Right Door */}
      <group position={[w / 2, h / 2, d / 2]}>
        <group rotation={[0, open ? Math.PI * 0.5 : 0, 0]}>
          <mesh position={[-w / 4, 0, 0]} castShadow onClick={handleOpenClose}>
            <boxGeometry args={[w / 2 - 0.2, h - frameT * 2, 2 * SCALE]} />
            <meshStandardMaterial color="#f0f0f0" />
          </mesh>
          {/* Handle */}
          <mesh position={[-w / 2 + 5 * SCALE, 0, 2 * SCALE]}>
            <boxGeometry args={[1 * SCALE, 15 * SCALE, 1 * SCALE]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        </group>
      </group>
    </group>
  );
};

const Table3D = ({ x, y, width, height, rad, zHeight, textureSrc, zOffset }: any) => {
  const tMain = useTexture(textureSrc) as THREE.Texture;
  const w = width;
  const d = height;
  const h = zHeight;
  const legT = 3 * SCALE;
  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, rad, 0]}>
      {/* Legs */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([mx, mz], i) => (
        <mesh key={i} position={[(w/2 - legT)*mx, h/2, (d/2 - legT)*mz]}>
          <boxGeometry args={[legT, h, legT]} />
          <meshStandardMaterial color="#444" />
        </mesh>
      ))}
      {/* Top */}
      <mesh position={[0, h, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 3 * SCALE, d]} />
        <meshStandardMaterial map={tMain} />
      </mesh>
    </group>
  );
};

const Chair3D = ({ x, y, width, height, rad, zHeight, textureSrc, zOffset }: any) => {
  const tMain = useTexture(textureSrc) as THREE.Texture;
  const w = width;
  const d = height;
  const h = zHeight;
  const seatH = h * 0.5;
  const legT = 2.5 * SCALE;
  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, rad, 0]}>
      {/* Legs */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([mx, mz], i) => (
        <mesh key={i} position={[(w/2 - legT)*mx, seatH/2, (d/2 - legT)*mz]}>
          <boxGeometry args={[legT, seatH, legT]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      ))}
      {/* Seat */}
      <mesh position={[0, seatH, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 2 * SCALE, d]} />
        <meshStandardMaterial map={tMain} />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, h * 0.75, -d/2 + 2 * SCALE]} castShadow>
        <boxGeometry args={[w, h * 0.5, 3 * SCALE]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </group>
  );
};

const TV3D = ({ x, y, width, height, rad, zHeight, textureSrc }: any) => {
  const tMain = useTexture(textureSrc) as THREE.Texture;
  const w = width;
  const d = 5 * SCALE; // Thin screen
  const h = height; // Use 2D height for screen height
  return (
    <group position={[x, zHeight, y]} rotation={[0, rad, 0]}>
      <mesh castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#000" />
      </mesh>
      <mesh position={[0, 0, d/2 + 0.1]}>
        <planeGeometry args={[w * 0.95, h * 0.95]} />
        <meshBasicMaterial map={tMain} />
      </mesh>
    </group>
  );
};

const FloorItem3D = ({ x, y, width, height, rad, textureSrc, zOffset }: any) => {
  const tMain = useTexture(textureSrc) as THREE.Texture;
  const tHi = useSvgHiResTexture(textureSrc); // SVG dokuları yüksek çözünürlükte rasterize et (bulanıklık düzeltmesi)
  const t = tHi || tMain;
  const w = width; // already scaled
  const d = height; // already scaled
  return (
    <group position={[x, 0.05 + (zOffset || 0), y]} rotation={[0, rad, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={t} transparent alphaTest={0.05} />
      </mesh>
    </group>
  );
};

// Building3D: renders extruded building matching 2D footprint
// --- MİMARİ ANIT YAPILAR (karakalem): Havaalanı & Demiryolu İstasyonu ---
// arch-airport / arch-trainstation 3B'de düz decal bırakılırsa "2B ve bozuk"
// görünür (kullanıcı raporu). Bu yüzden hayvan figürlerindeki gibi PROSEDÜREL
// hacimli modeller çizilir: karakalem cephe çizimi ana gövdenin ön yüzüne
// dokulanır (dokunun altındaki yer/çim/peron şeridi doku dönüşümüyle kırpılır),
// üstüne gerçek 3B çatı / kontrol kulesi eklenir.

/** Cephe dokusunu kırpıp hazırlar: cropBottom → dokunun ALTUNDAN kırpılan oran
 *  (yer çizgileri, çim, peron). v ∈ [cropBottom, 1] aralığı gösterilir. */
const makeLandmarkFacadeTexture = (tFacade: THREE.Texture, cropBottom: number): THREE.Texture => {
  const t = tFacade.clone();
  t.needsUpdate = true;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1, 1 - cropBottom);
  t.offset.set(0, cropBottom);
  return t;
};

const LANDMARK_BODY_COLOR = '#f4f2ec';

const Airport3D = ({ x, y, width, height, rad, textureSrc }: any) => {
  const tFacade = useTexture(textureSrc) as THREE.Texture;
  // Yeni karakalem görsel: üst %48 bina, alt %52 pist. Cephe dokusu yalnızca
  // bina bölgesini gösterir (alttaki pist kırpılır); pist 3B'de gerçek Geniş
  // zemin geometrisiyle (apron + pist + işaretler + taksi yolu) çizilir.
  const facTex = useMemo(() => makeLandmarkFacadeTexture(tFacade, 0.52), [tFacade]);
  const w = width;
  const d = Math.max(height, 40 * SCALE);
  const bodyH = 66 * SCALE;          // terminal gövdesi ~6.6 m (2 kat)
  const roofThick = 3 * SCALE;
  const shaftH = 96 * SCALE;         // kule gövdesi
  const towerR = Math.max(4.5 * SCALE, w * 0.045);
  const cabH = 20 * SCALE;           // kabin
  const cabR = towerR * 1.8;
  const towerX = w * 0.15;           // çizimdeki kule konumu (sağ-orta)

  // --- Pist (runway) ölçüleri: cephenin önünde, izleyiciye doğru uzanır ---
  const apronD = d * 0.14;                       // terminal önü apron şeridi
  const runwayW = w * 0.55;                      // pist genişliği
  const runwayLen = Math.max(w * 1.6, d * 2.2);  // pist uzunluğu
  const runwayZ0 = d / 2 + apronD;               // pist başlangıcı (lokal Z)
  const roadY = 0.05;                            // zemin decal yüksekliği (z-fighting önleme)
  const markY = roadY + 0.12;
  const dashCount = 12;
  const dashLen = runwayLen * 0.05;
  const keyCount = 8;

  return (
    <group position={[x, 0, y]} rotation={[0, rad, 0]}>
      {/* Terminal gövdesi */}
      <mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, bodyH, d]} />
        <meshStandardMaterial color={LANDMARK_BODY_COLOR} roughness={0.9} metalness={0.02} />
      </mesh>
      {/* Karakalem cephe dokusu (ön yüz) */}
      <mesh position={[0, bodyH / 2, d / 2 + 0.3]}>
        <planeGeometry args={[w * 0.995, bodyH * 0.995]} />
        <meshBasicMaterial map={facTex} transparent alphaTest={0.03} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* Düz çatı plakası */}
      <mesh position={[0, bodyH + roofThick / 2, 0]} castShadow>
        <boxGeometry args={[w + SCALE, roofThick, d + SCALE]} />
        <meshStandardMaterial color="#555555" roughness={0.9} />
      </mesh>
      {/* Hava trafik kontrol kulesi (çizimdeki konumda, gövde içinden yükselir) */}
      <group position={[towerX, 0, -d * 0.05]}>
        <mesh position={[0, shaftH / 2, 0]} castShadow>
          <cylinderGeometry args={[towerR, towerR * 1.3, shaftH, 20]} />
          <meshStandardMaterial color="#e8e6df" roughness={0.85} />
        </mesh>
        <mesh position={[0, shaftH + cabH / 2, 0]} castShadow>
          <cylinderGeometry args={[cabR, cabR, cabH, 20]} />
          <meshStandardMaterial color="#2e4653" roughness={0.25} metalness={0.5} />
        </mesh>
        <mesh position={[0, shaftH + cabH + 2.2 * SCALE, 0]} castShadow>
          <coneGeometry args={[cabR * 1.02, 4.4 * SCALE, 20]} />
          <meshStandardMaterial color="#555555" roughness={0.9} />
        </mesh>
        <mesh position={[0, shaftH + cabH + 7.5 * SCALE, 0]}>
          <cylinderGeometry args={[0.3 * SCALE, 0.3 * SCALE, 7 * SCALE, 8]} />
          <meshStandardMaterial color="#333333" roughness={0.7} />
        </mesh>
      </group>

      {/* --- PİST: apron + pist + işaretler (2B çizimdeki gibi cephenin önünde) --- */}
      {/* Apron şeridi (terminal önü beton zemin) */}
      <mesh position={[0, roadY / 2, d / 2 + apronD / 2]} receiveShadow>
        <boxGeometry args={[w * 1.02, roadY, apronD]} />
        <meshStandardMaterial color="#c9c6bd" roughness={0.95} />
      </mesh>
      {/* Pist gövdesi */}
      <mesh position={[0, roadY / 2, runwayZ0 + runwayLen / 2]} receiveShadow>
        <boxGeometry args={[runwayW, roadY, runwayLen]} />
        <meshStandardMaterial color="#a3a09a" roughness={0.95} />
      </mesh>
      {/* Pist kenar çizgileri */}
      {[-1, 1].map((sgn) => (
        <mesh key={`edge${sgn}`} position={[sgn * (runwayW / 2 - runwayW * 0.025), markY, runwayZ0 + runwayLen / 2]}>
          <boxGeometry args={[runwayW * 0.012, 0.05, runwayLen * 0.98]} />
          <meshStandardMaterial color="#f2f1ed" roughness={0.8} />
        </mesh>
      ))}
      {/* Kesikli orta çizgi */}
      {Array.from({ length: dashCount }).map((_, i) => (
        <mesh
          key={`dash${i}`}
          position={[0, markY, runwayZ0 + runwayLen * (0.08 + (0.84 * i) / (dashCount - 1))]}
        >
          <boxGeometry args={[runwayW * 0.02, 0.05, dashLen]} />
          <meshStandardMaterial color="#f2f1ed" roughness={0.8} />
        </mesh>
      ))}
      {/* Yakın uç eşik işaretleri (piyano tuşları) */}
      {Array.from({ length: keyCount }).map((_, i) => (
        <mesh
          key={`key${i}`}
          position={[
            -runwayW / 2 + runwayW * (0.09 + (0.82 * i) / (keyCount - 1)),
            markY,
            runwayZ0 + runwayLen - runwayW * 0.06,
          ]}
        >
          <boxGeometry args={[runwayW * 0.05, 0.05, runwayW * 0.09]} />
          <meshStandardMaterial color="#f2f1ed" roughness={0.8} />
        </mesh>
      ))}
      {/* Taksi yolu (apronu pista bağlar) */}
      <mesh position={[w * 0.36, roadY / 2, runwayZ0 + runwayLen * 0.3]} receiveShadow>
        <boxGeometry args={[Math.max(w * 0.36 - runwayW / 2, 2), roadY, runwayW * 0.16]} />
        <meshStandardMaterial color="#b4b1a9" roughness={0.95} />
      </mesh>
    </group>
  );
};

const Station3D = ({ x, y, width, height, rad, textureSrc }: any) => {
  const tFacade = useTexture(textureSrc) as THREE.Texture;
  // Yeni karakalem görsel: üst %80 bina + peron, alt %20 raylar. Cephe dokusu
  // bina + peronu gösterir; raylar 3B'de gerçek zemin geometrisiyle (peron,
  // balast, traversler, çift ray) cephenin önünde çizilir.
  const facTex = useMemo(() => makeLandmarkFacadeTexture(tFacade, 0.2), [tFacade]);
  const w = width;
  const d = Math.max(height, 40 * SCALE);
  const bodyH = 66 * SCALE;          // ana bina ~6.6 m (2 kat)
  const ridgeH = 16 * SCALE;         // beşik çatı mahya yüksekliği
  const pavW = w * 0.34;             // saatlı orta pavyon
  const pavD = d * 0.62;
  const pavH = 18 * SCALE;
  const pavRidge = 10 * SCALE;

  // Mahya X ekseni boyunca koşan beşik çatı prizması:
  // üçgen kesit shape'i (x=derinlik, y=yükseklik) X boyunca ekstrüde edilir.
  const roofShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-d / 2 - SCALE, 0);
    s.lineTo(d / 2 + SCALE, 0);
    s.lineTo(0, ridgeH);
    s.closePath();
    return s;
  }, [d, ridgeH]);

  const pavRoofShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-pavD / 2 - SCALE, 0);
    s.lineTo(pavD / 2 + SCALE, 0);
    s.lineTo(0, pavRidge);
    s.closePath();
    return s;
  }, [pavD, pavRidge]);

  // --- Ray ölçüleri: cephenin önünde, cepheye paralel (X boyunca) çift hat ---
  const platD = d * 0.1;                         // peron derinliği
  const platH = bodyH * 0.1;                     // peron yüksekliği
  const railLen = w * 1.35;                      // ray uzunluğu (bina genişliğinden biraz fazla)
  const railSpan = 3.4;                          // bir hattın iki rayı arası (demişgen)
  const trackGap = Math.max(d * 0.09, 7);        // iki hat arası mesafe
  const track1Z = d / 2 + platD + railSpan;      // 1. hat merkezi
  const track2Z = track1Z + trackGap;            // 2. hat merkezi
  const ballastZ0 = d / 2 + platD;
  const ballastD = (track2Z - track1Z) + railSpan * 2;
  const sleeperStep = 5.5;
  const sleeperCount = Math.max(6, Math.floor(railLen / sleeperStep));

  return (
    <group position={[x, 0, y]} rotation={[0, rad, 0]}>
      {/* Ana bina gövdesi */}
      <mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, bodyH, d]} />
        <meshStandardMaterial color={LANDMARK_BODY_COLOR} roughness={0.9} metalness={0.02} />
      </mesh>
      {/* Karakalem cephe dokusu (ön yüz) */}
      <mesh position={[0, bodyH / 2, d / 2 + 0.3]}>
        <planeGeometry args={[w * 0.995, bodyH * 0.995]} />
        <meshBasicMaterial map={facTex} transparent alphaTest={0.03} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* Ana beşik çatı */}
      <mesh position={[w / 2 + SCALE, bodyH, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow>
        <extrudeGeometry args={[roofShape, { depth: w + 2 * SCALE, bevelEnabled: false }]} />
        <meshStandardMaterial color="#4a4a48" roughness={0.9} />
      </mesh>
      {/* Orta pavyon (çizimdeki yüksek çekim bölümü) + kendi beşik çatısı */}
      <mesh position={[0, bodyH + pavH / 2, 0]} castShadow>
        <boxGeometry args={[pavW, pavH, pavD]} />
        <meshStandardMaterial color="#efece4" roughness={0.9} />
      </mesh>
      <mesh position={[pavW / 2 + SCALE, bodyH + pavH, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow>
        <extrudeGeometry args={[pavRoofShape, { depth: pavW + 2 * SCALE, bevelEnabled: false }]} />
        <meshStandardMaterial color="#4a4a48" roughness={0.9} />
      </mesh>

      {/* --- DEMİRYOLU: peron + balast + traversler + çift ray --- */}
      {/* Peron (bina önü, güvenlik çizgili) */}
      <mesh position={[0, platH / 2, d / 2 + platD / 2]} receiveShadow castShadow>
        <boxGeometry args={[w * 1.05, platH, platD]} />
        <meshStandardMaterial color="#c9c4b8" roughness={0.95} />
      </mesh>
      <mesh position={[0, platH + 0.02, d / 2 + platD - 0.5]} receiveShadow>
        <boxGeometry args={[w * 1.05, 0.04, 0.7]} />
        <meshStandardMaterial color="#efede6" roughness={0.8} />
      </mesh>
      {/* Balast yatağı (her iki hattı kapsar) */}
      <mesh position={[0, 0.3, ballastZ0 + ballastD / 2]} receiveShadow>
        <boxGeometry args={[railLen, 0.6, ballastD]} />
        <meshStandardMaterial color="#b5b0a6" roughness={1} />
      </mesh>
      {[track1Z, track2Z].map((tz, ti) => (
        <group key={`track${ti}`}>
          {/* Traversler */}
          {Array.from({ length: sleeperCount }).map((_, i) => (
            <mesh
              key={`sl${ti}-${i}`}
              position={[-railLen / 2 + (railLen / (sleeperCount - 1)) * i, 0.72, tz]}
              castShadow
            >
              <boxGeometry args={[1.4, 0.24, railSpan * 1.6]} />
              <meshStandardMaterial color="#8a7a66" roughness={0.95} />
            </mesh>
          ))}
          {/* Raylar */}
          {[-1, 1].map((sgn) => (
            <mesh key={`rail${ti}-${sgn}`} position={[0, 0.95, tz + sgn * (railSpan / 2)]} castShadow>
              <boxGeometry args={[railLen, 0.28, 0.5]} />
              <meshStandardMaterial color="#5a5a5c" roughness={0.35} metalness={0.75} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};

const Building3D = ({ x, y, width, height, rad, floors, textureSrc }: any) => {
  const tFacade = useTexture(textureSrc) as THREE.Texture;
  const floorH = 33 * SCALE; // ~3.3m per floor
  const totalH = floors * floorH;
  const w = width;
  const d = height;
  const roofThick = 3 * SCALE;

  // Repeat facade texture per floor
  const facTex = tFacade.clone();
  facTex.needsUpdate = true;
  facTex.repeat.set(1, floors);
  facTex.wrapS = THREE.RepeatWrapping;
  facTex.wrapT = THREE.RepeatWrapping;

  return (
    <group position={[x, 0, y]} rotation={[0, rad, 0]}>
      {/* Main body */}
      <mesh position={[0, totalH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, totalH, d]} />
        <meshStandardMaterial map={facTex} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Flat roof */}
      <mesh position={[0, totalH + roofThick / 2, 0]} castShadow>
        <boxGeometry args={[w + SCALE, roofThick, d + SCALE]} />
        <meshStandardMaterial color="#555555" roughness={0.9} />
      </mesh>
      {/* Window rows per floor */}
      {Array.from({ length: floors }).map((_, fi) => {
        const floorY = fi * floorH + floorH * 0.55;
        const winW = Math.min(20 * SCALE, w * 0.18);
        const winH = floorH * 0.35;
        const numWinsX = Math.max(1, Math.floor(w / (winW * 2.2)));
        const numWinsZ = Math.max(1, Math.floor(d / (winW * 2.2)));
        return (
          <React.Fragment key={fi}>
            {/* Front / Back windows */}
            {Array.from({ length: numWinsX }).map((_, wi) => {
              const xPos = (wi - (numWinsX - 1) / 2) * (w / numWinsX);
              return (
                <React.Fragment key={wi}>
                  {[-(d / 2 + 0.05), (d / 2 + 0.05)].map((zPos, si) => (
                    <mesh key={si} position={[xPos, floorY, zPos]}>
                      <planeGeometry args={[winW, winH]} />
                      <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} metalness={0.6} roughness={0.1} side={THREE.DoubleSide} />
                    </mesh>
                  ))}
                </React.Fragment>
              );
            })}
            {/* Side windows */}
            {Array.from({ length: numWinsZ }).map((_, wi) => {
              const zPos = (wi - (numWinsZ - 1) / 2) * (d / numWinsZ);
              return (
                <React.Fragment key={wi}>
                  {[-(w / 2 + 0.05), (w / 2 + 0.05)].map((xPos, si) => (
                    <mesh key={si} position={[xPos, floorY, zPos]} rotation={[0, Math.PI / 2, 0]}>
                      <planeGeometry args={[winW, winH]} />
                      <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} metalness={0.6} roughness={0.1} side={THREE.DoubleSide} />
                    </mesh>
                  ))}
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      })}
    </group>
  );
};

const ImpactOrWound3D = ({ textureSrc, width, height, zHeight, zOffset }: any) => {
  const tex = useTexture(textureSrc) as THREE.Texture;
  const hUnits = (zHeight || 0) * SCALE;
  
  return (
    <mesh position={[0, hUnits + (zOffset || 0), 0.1 * SCALE]} renderOrder={100}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial 
        map={tex} 
        transparent 
        alphaTest={0.005} 
        side={THREE.DoubleSide} 
        polygonOffset 
        polygonOffsetFactor={-4} 
        polygonOffsetUnits={-4}
        depthWrite={false}
      />
    </mesh>
  );
};

// Cam / Duvar üzerinde isabet izi — gerçek PNG dosyası ile render edilir
// Decal, InteractiveSymbol grubunun lokal Z'si boyunca offsetlenir (duvar kalınlığının yarısı ≈ 2.75 birim)
// böylece duvar/gönye içinde kalıp görünmez olmaz. depthTest=false ile z-fighting önlenir.
const GlassImpact3D = ({ textureSrc, zHeight, wallThickness }: any) => {
  const tex = useTexture(textureSrc) as THREE.Texture;

  const hUnits = (zHeight || 120) * SCALE;
  const size = 35 * SCALE;
  const offsetZ = (wallThickness ? (wallThickness / 2) : 5 * SCALE) + 0.2 * SCALE;

  return (
    <group position={[0, hUnits, offsetZ]}>
      <mesh position={[0, 0, 0]} renderOrder={999}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          map={tex}
          transparent
          alphaTest={0.01}
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </group>
  );
};

// Dikey yüzey decali — parmak izi/el izi/alet izi gibi izler 2B'de pencere veya
// duvar üzerine konulduysa 3B'de zeminde yatay decal yerine, o yüzeyin üzerinde
// DİKEY plane olarak çizilir. GlassImpact3D ile aynı offset/depth mantığı
// (depthTest=false sayesinde cam arkasından da görünür).
const VerticalDecal3D = ({ textureSrc, width, height, zHeight, thickness }: any) => {
  const tex = useTexture(textureSrc) as THREE.Texture;
  const hUnits = (zHeight || 120) * SCALE;
  const offsetZ = (thickness ? thickness / 2 : 5 * SCALE) + 0.2 * SCALE;
  return (
    <group position={[0, hUnits, offsetZ]}>
      <mesh renderOrder={999}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          map={tex}
          transparent
          alphaTest={0.01}
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </group>
  );
};

// Bulgu numarası plakası — iz pencere/duvara yapışmışsa numaratör çadırı yerine
// aynı yüzeyde, izin yüksekliğinde sarı numara plakası olarak görünür.
const FindingPlate3D = ({ no, width, height, zHeight, thickness }: any) => {
  const tex = useTentTexture(no);
  useEffect(() => () => { tex?.dispose(); }, [tex]);
  const w = Math.max(width, 16 * SCALE);
  const h = Math.max(height, 12 * SCALE);
  const hUnits = (zHeight || 120) * SCALE;
  const offsetZ = (thickness ? thickness / 2 : 5 * SCALE) + 0.2 * SCALE;
  return (
    <group position={[0, hUnits, offsetZ]}>
      <mesh renderOrder={999}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial
          map={tex || undefined}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
    </group>
  );
};

const SymbolWithTexture = ({ x, y, width, height, rad, fill, textureSrc, zHeight, isVertical, zOffset }: any) => {
  const tMain = useTexture(textureSrc) as THREE.Texture;
  
  const hUnits = (zHeight || 40) * SCALE;
  const wUnits = width;
  const dUnits = height;

  const bodyColor = !fill || fill === 'transparent' || fill === 'none' ? "#ffffff" : fill;
  const groupY = (isVertical ? (hUnits / 2) : 0) + (zOffset || 0);
  const meshRotX = isVertical ? 0 : -Math.PI / 2;

  return (
    <group position={[x, groupY, y]} rotation={[0, rad, 0]}>
      {/* Opaque Body (The "Dolgu") */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[wUnits, hUnits, dUnits]} />
        <meshStandardMaterial color={bodyColor} metalness={0.1} roughness={0.8} />
      </mesh>
      
      {/* Texture Overlay (Top/Front Surface) */}
      <mesh 
        position={[0, isVertical ? 0 : hUnits / 2 + 0.1, isVertical ? dUnits / 2 + 0.1 : 0]} 
        rotation={[meshRotX, 0, 0]}
      >
        <planeGeometry args={[wUnits * 0.95, isVertical ? hUnits * 0.95 : dUnits * 0.95]} />
        <meshBasicMaterial map={tMain} transparent alphaTest={0.05} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// --- CUSTOM HIGH-FIDELITY 3D COMPONENTS FOR REALISM ---

interface WindowProps {
  width: number;
  height: number;
  thick: number;
  onClick?: (e: any) => void;
}

// Door window: width = car-length (X), height = vertical (Y), glass faces Z (outward)
const WindowFrameAndGlass = ({ width, height, thick, onClick }: WindowProps) => {
  const ft = 1.2 * SCALE; // frame thickness in X/Y
  const glassW = width - ft * 2;
  const glassH = height - ft * 2;
  const depth = thick; // Z depth (glass depth, 0 = flat plane)

  return (
    <group>
      {/* Top Frame bar (runs along X) */}
      <mesh position={[0, height / 2 - ft / 2, 0]} onClick={onClick} castShadow>
        <boxGeometry args={[width, ft, depth]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
      </mesh>
      {/* Bottom Frame bar (runs along X) */}
      <mesh position={[0, -height / 2 + ft / 2, 0]} onClick={onClick} castShadow>
        <boxGeometry args={[width, ft, depth]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
      </mesh>
      {/* Left Frame bar (runs along Y) */}
      <mesh position={[-width / 2 + ft / 2, 0, 0]} onClick={onClick} castShadow>
        <boxGeometry args={[ft, glassH, depth]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
      </mesh>
      {/* Right Frame bar (runs along Y) */}
      <mesh position={[width / 2 - ft / 2, 0, 0]} onClick={onClick} castShadow>
        <boxGeometry args={[ft, glassH, depth]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
      </mesh>
      {/* Glass Pane — dark tinted, clearly visible as closed glass */}
      <mesh position={[0, 0, 0]} onClick={onClick}>
        <boxGeometry args={[glassW, glassH, depth * 0.5]} />
        <meshPhysicalMaterial
          color="#1e3a4a"
          roughness={0.05}
          metalness={0.0}
          transparent
          opacity={0.88}
          side={THREE.DoubleSide}
          envMapIntensity={1.2}
        />
      </mesh>
      {/* Specular highlight stripe */}
      <mesh position={[-glassW * 0.2, 0, depth * 0.26]} rotation={[0, 0, Math.PI / 4]} onClick={onClick}>
        <boxGeometry args={[glassW * 0.06, glassH * 1.3, 0.015 * SCALE]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.22} />
      </mesh>
    </group>
  );
};

/** Mürekkep rengini 3B boya rengine çevirir: simsiyah çizimler için koyu
 *  antrasit (metalik boya parlaklığı kaybolmasın), bembeyaz için açık gri. */
const liftInkColor = (c?: string | null): string | null => {
  if (!c || !/^#[0-9a-fA-F]{6}$/.test(c)) return null;
  const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum < 0.075) return '#2a2e33';
  if (lum > 0.93) return '#e8eaec';
  return c;
};

/** Sembol görselinin mürekkep (opak piksellerin ortalama) rengini çıkarır;
 *  sonucu _alphaMaskCache'e yazar (ekstrüzyon yoluyla paylaşılır). */
const useInkColor = (src: string): string | null => {
  const [color, setColor] = useState<string | null>(() => _alphaMaskCache.get(src)?.color ?? null);
  useEffect(() => {
    const cached = _alphaMaskCache.get(src);
    if (cached !== undefined) { setColor(cached?.color ?? null); return; }
    let alive = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!alive) return;
      const m = extractAlphaMask(img);
      _alphaMaskCache.set(src, m);
      setColor(m?.color ?? null);
    };
    img.onerror = () => { if (alive) setColor(null); };
    img.src = src;
    return () => { alive = false; };
  }, [src]);
  return color;
};

/** Kara taşıtı sarmalayıcı: gövde rengini 2B çizimin mürekkepinden alır ve
 *  devrilmiş/yatık taşıtları (takla, yatık motosiklet...) kendi uzun ekseni
 *  etrafında çevirerek gerçekçi çizer. */
const InkVehicle3D = (props: any) => {
  const ink = useInkColor(props.textureSrc || '');
  const t = String(props.type || '').toLowerCase();
  const rollOver = t.includes('overturned') || t.includes('fallen') || t.includes('devrilmi') || t.includes('takla') || t.includes('yatık') || t.includes('devrik');
  return <Vehicle3D {...props} fill={props.fill || liftInkColor(ink) || undefined} rollOver={rollOver} />;
};

const Vehicle3D = ({ x, y, width, height, rad, type, fill, zOffset, zHeight, rollOver }: any) => {
  const isVerticalIn2D = height > width;
  const w = isVerticalIn2D ? height : width;
  const d = isVerticalIn2D ? width : height;
  const adjustedRad = isVerticalIn2D ? rad - Math.PI / 2 : rad;

  const typeLower = (type || '').toLowerCase();
  
  let color = fill || "#3a4046";
  if (typeLower.includes('itfaiye') || typeLower.includes('fire')) {
    color = "#cc0000";
  } else if (typeLower.includes('taksi') || typeLower.includes('taxi')) {
    color = "#f5c518";
  } else if (typeLower.includes('polis') || typeLower.includes('police')) {
    color = "#0033aa";
  }

  // Base height properties
  const isMotorcycle = typeLower.includes('motor') || typeLower.includes('moto') || typeLower.includes('bisiklet');
  const isTruck = typeLower.includes('truck') || typeLower.includes('kamyon') || typeLower.includes('v-truck') || typeLower.includes('itfaiye') || typeLower.includes('kepçe') || typeLower.includes('çekici') || typeLower.includes('traktör');
  const isBus = typeLower.includes('bus') || typeLower.includes('otobüs') || typeLower.includes('v-bus') || typeLower.includes('minibüs');
  const isSiren = typeLower.includes('police') || typeLower.includes('police-car') || typeLower.includes('ambulance') || typeLower.includes('v-police') || typeLower.includes('v-ambulance') || typeLower.includes('ambulans') || typeLower.includes('polis') || typeLower.includes('itfaiye');
  const isSUV = typeLower.includes('suv') || typeLower.includes('jeep') || typeLower.includes('ambulance') || typeLower.includes('ambulans') || typeLower.includes('police') || typeLower.includes('polis');

  // Interactive Door States
  const [leftDoorOpen, setLeftDoorOpen] = useState(false);
  const [rightDoorOpen, setRightDoorOpen] = useState(false);
  const [leftRearDoorOpen, setLeftRearDoorOpen] = useState(false);
  const [rightRearDoorOpen, setRightRearDoorOpen] = useState(false);
  const [truckDoorOpen, setTruckDoorOpen] = useState(false);
  const [busDoorOpen, setBusDoorOpen] = useState(false);

  const leftDoorRef = useRef<THREE.Group>(null);
  const rightDoorRef = useRef<THREE.Group>(null);
  const leftRearDoorRef = useRef<THREE.Group>(null);
  const rightRearDoorRef = useRef<THREE.Group>(null);
  const truckDoorLeftRef = useRef<THREE.Group>(null);
  const truckDoorRightRef = useRef<THREE.Group>(null);
  const busDoorRef = useRef<THREE.Group>(null);

  const leftDoorRot = useRef(0);
  const rightDoorRot = useRef(0);
  const leftRearDoorRot = useRef(0);
  const rightRearDoorRot = useRef(0);
  const truckDoorLeftRot = useRef(0);
  const truckDoorRightRot = useRef(0);
  const busDoorRot = useRef(0);

  // Click Helpers
  const toggleLeft = (e: any) => { e.stopPropagation(); setLeftDoorOpen(!leftDoorOpen); };
  const toggleRight = (e: any) => { e.stopPropagation(); setRightDoorOpen(!rightDoorOpen); };
  const toggleLeftRear = (e: any) => { e.stopPropagation(); setLeftRearDoorOpen(!leftRearDoorOpen); };
  const toggleRightRear = (e: any) => { e.stopPropagation(); setRightRearDoorOpen(!rightRearDoorOpen); };
  const toggleTruck = (e: any) => { e.stopPropagation(); setTruckDoorOpen(!truckDoorOpen); };
  const toggleBus = (e: any) => { e.stopPropagation(); setBusDoorOpen(!busDoorOpen); };

  useFrame(() => {
    // Left Door (Swing wide 82 degrees for high visibility - Outward)
    const targetLeft = leftDoorOpen ? Math.PI / 2.2 : 0;
    leftDoorRot.current += (targetLeft - leftDoorRot.current) * 0.15;
    if (leftDoorRef.current) leftDoorRef.current.rotation.y = leftDoorRot.current;

    // Right Door (Swing wide 82 degrees for high visibility - Outward)
    const targetRight = rightDoorOpen ? -Math.PI / 2.2 : 0;
    rightDoorRot.current += (targetRight - rightDoorRot.current) * 0.15;
    if (rightDoorRef.current) rightDoorRef.current.rotation.y = rightDoorRot.current;

    // Left Rear Door (Outward)
    const targetLeftRear = leftRearDoorOpen ? Math.PI / 2.2 : 0;
    leftRearDoorRot.current += (targetLeftRear - leftRearDoorRot.current) * 0.15;
    if (leftRearDoorRef.current) leftRearDoorRef.current.rotation.y = leftRearDoorRot.current;

    // Right Rear Door (Outward)
    const targetRightRear = rightRearDoorOpen ? -Math.PI / 2.2 : 0;
    rightRearDoorRot.current += (targetRightRear - rightRearDoorRot.current) * 0.15;
    if (rightRearDoorRef.current) rightRearDoorRef.current.rotation.y = rightRearDoorRot.current;

    // Truck Cabin Doors (Swing wide 82 degrees for high visibility - Outward)
    const targetTruckL = truckDoorOpen ? Math.PI / 2.2 : 0;
    const targetTruckR = truckDoorOpen ? -Math.PI / 2.2 : 0;
    truckDoorLeftRot.current += (targetTruckL - truckDoorLeftRot.current) * 0.15;
    truckDoorRightRot.current += (targetTruckR - truckDoorRightRot.current) * 0.15;
    if (truckDoorLeftRef.current) truckDoorLeftRef.current.rotation.y = truckDoorLeftRot.current;
    if (truckDoorRightRef.current) truckDoorRightRef.current.rotation.y = truckDoorRightRot.current;

    // Bus Entrance Door (Swing wide 120 degrees for high visibility)
    const targetBus = busDoorOpen ? Math.PI / 1.5 : 0;
    busDoorRot.current += (targetBus - busDoorRot.current) * 0.15;
    if (busDoorRef.current) busDoorRef.current.rotation.y = busDoorRot.current;
  });

  // Determine standard default height in cm for scaling
  const defaultHeightCm = isTruck ? 300 : isBus ? 320 : isMotorcycle ? 100 : 150;
  const targetHeightCm = zHeight || defaultHeightCm;
  const heightScale = targetHeightCm / defaultHeightCm;

  let bodyH = (isTruck ? 80 : isBus ? 110 : isSUV ? 80 : 65) * SCALE * heightScale;
  let cabinH = (isTruck ? 70 : isBus ? 0 : isSUV ? 45 : 55) * SCALE * heightScale;
  let groundClearance = (isTruck ? 25 : isBus ? 20 : isMotorcycle ? 20 : 15) * SCALE * heightScale;
  const wheelR = (isTruck ? 22 : isBus ? 22 : isMotorcycle ? 20 : 20) * SCALE * heightScale;
  const wheelW = (isTruck ? 12 : isBus ? 12 : isMotorcycle ? 8 : 12) * SCALE * heightScale;

  // Custom Shape Profiles with Cutout Holes for realistic interiors
  // WINDING ORDER WARNING: Main shape MUST be clockwise, holes MUST be counter-clockwise!
  const bodyProfileShape = useMemo(() => {
    const shape = new THREE.Shape();
    if (isTruck) {
      // Truck Lower Body Profile (Clockwise)
      shape.moveTo(-w / 2, groundClearance);
      shape.lineTo(-w / 2, groundClearance + bodyH * 0.95);
      shape.lineTo(w * 0.1, groundClearance + bodyH * 0.95);
      shape.lineTo(w * 0.12, groundClearance + bodyH);
      shape.lineTo(w * 0.35, groundClearance + bodyH);
      shape.lineTo(w * 0.42, groundClearance + bodyH * 0.8);
      shape.lineTo(w * 0.5, groundClearance + bodyH * 0.75);
      shape.lineTo(w * 0.5, groundClearance);
      shape.lineTo(-w / 2, groundClearance);
    } else if (isBus) {
      // Bus Lower Body Profile (Clockwise)
      shape.moveTo(-w / 2, groundClearance);
      shape.lineTo(-w / 2, groundClearance + bodyH * 0.55);
      shape.lineTo(w / 2, groundClearance + bodyH * 0.55);
      shape.lineTo(w / 2, groundClearance + bodyH * 0.2);
      shape.lineTo(w / 2 - w * 0.02, groundClearance);
      shape.lineTo(-w / 2, groundClearance);
    } else if (isMotorcycle) {
      shape.moveTo(0, 0);
    } else if (typeLower.includes('suv') || typeLower.includes('jeep') || typeLower.includes('ambulance') || typeLower.includes('ambulans')) {
      // SUV / Ambulance Lower Body Profile (Clockwise) - curved
      shape.moveTo(-w / 2, groundClearance);
      shape.lineTo(-w / 2, groundClearance + 2 * SCALE);
      shape.quadraticCurveTo(-w / 2 + 3 * SCALE, groundClearance + bodyH * 0.8, -w / 2 + 4 * SCALE, groundClearance + bodyH);
      shape.lineTo(w * 0.2, groundClearance + bodyH);
      shape.quadraticCurveTo(w * 0.3, groundClearance + bodyH, w * 0.38, groundClearance + bodyH * 0.85);
      shape.quadraticCurveTo(w * 0.45, groundClearance + bodyH * 0.78, w * 0.5, groundClearance + bodyH * 0.72);
      shape.lineTo(w * 0.5, groundClearance + 2 * SCALE);
      shape.quadraticCurveTo(w * 0.5, groundClearance, w * 0.48, groundClearance);
      shape.lineTo(-w / 2, groundClearance);
    } else {
      // Sedan Lower Body Profile (Clockwise) - aerodynamic curves
      const c = groundClearance;
      const b = bodyH;
      shape.moveTo(-w / 2, c);
      // Rear bumper lower lip
      shape.lineTo(-w / 2 + 0.5 * SCALE, c);
      shape.lineTo(-w / 2 + 0.5 * SCALE, c + b * 0.55);
      // Rear bumper curve up to decklid
      shape.quadraticCurveTo(-w / 2 + 4 * SCALE, c + b * 0.95, -w * 0.25, c + b);
      // Trunk deck / rear roofline
      shape.lineTo(-w * 0.08, c + b);
      // Rear windshield base to roof (slight dip)
      shape.quadraticCurveTo(-w * 0.03, c + b * 0.97, 0, c + b * 0.96);
      shape.lineTo(w * 0.04, c + b * 0.96);
      // Roof to front windshield base
      shape.quadraticCurveTo(w * 0.08, c + b, w * 0.12, c + b);
      // Hood top
      shape.lineTo(w * 0.22, c + b);
      // Hood front curve down to nose
      shape.quadraticCurveTo(w * 0.32, c + b * 0.95, w * 0.38, c + b * 0.82);
      // Front nose curve
      shape.quadraticCurveTo(w * 0.45, c + b * 0.75, w * 0.5, c + b * 0.7);
      // Front bumper
      shape.lineTo(w * 0.5, c + 0.5 * SCALE);
      shape.quadraticCurveTo(w * 0.5, c, w * 0.48, c);
      shape.lineTo(-w / 2, c);
    }
    return shape;
  }, [isTruck, isBus, typeLower, w, bodyH, cabinH, groundClearance]);

  // Extrude settings - Larger bevel values for rounded car edges
  const extrudeSettings = useMemo(() => ({
    depth: d,
    bevelEnabled: true,
    bevelSegments: 5,
    steps: 1,
    bevelSize: 2.2 * SCALE,
    bevelThickness: 2.2 * SCALE
  }), [d]);

  if (isMotorcycle) {
    // Devrilmiş/yatık motosiklet: tüm içerik uzun eksen (X) etrafında çevrilir
    const motoShift = groundClearance + 45 * SCALE * heightScale + wheelR;
    return (
      <group position={[x, zOffset || 0, y]} rotation={[0, adjustedRad, 0]}>
        <group position={[0, rollOver ? motoShift : 0, 0]} rotation={[rollOver ? Math.PI : 0, 0, 0]}>
        {/* Wheels */}
        <mesh position={[-w / 3, wheelR, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[wheelR, wheelR, wheelW, 16]} />
          <meshStandardMaterial color="#111111" roughness={0.9} />
        </mesh>
        <mesh position={[w / 3, wheelR, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[wheelR, wheelR, wheelW, 16]} />
          <meshStandardMaterial color="#111111" roughness={0.9} />
        </mesh>
        {/* Frame/Body */}
        <mesh position={[0, groundClearance + 10 * SCALE * heightScale, 0]} castShadow>
          <boxGeometry args={[w * 0.7, 15 * SCALE * heightScale, 12 * SCALE]} />
          <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[-w / 10, groundClearance + 18 * SCALE * heightScale, 0]} castShadow>
          <boxGeometry args={[w * 0.4, 4 * SCALE * heightScale, 10 * SCALE]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh position={[w / 4, groundClearance + 25 * SCALE * heightScale, 0]} rotation={[0, 0, -Math.PI / 6]} castShadow>
          <cylinderGeometry args={[1.5 * SCALE, 1.5 * SCALE, 20 * SCALE * heightScale]} />
          <meshStandardMaterial color="#7f8c8d" metalness={0.9} />
        </mesh>
        <mesh position={[w / 4, groundClearance + 35 * SCALE * heightScale, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1 * SCALE, 1 * SCALE, 30 * SCALE]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        </group>
      </group>
    );
  }

  const headlightR = 3 * SCALE;
  const taillightR = 2.5 * SCALE;

  // Ensure car is proportionally sized vs the road canvas
  const minLengthUnits = Math.max(100, (targetHeightCm || 150) * 0.7 * SCALE);
  const sizeScale = w < minLengthUnits ? minLengthUnits / w : 1;

  // Devrilmiş araç: gövde uzun eksen (X) etrafında tavana çevrilir;
  // kaydırma, model yüksekliği × ölçek kadardır ki tekerlekler yukarı bakarken
  // çatı yere değsin (kullanıcı: "devrilmiş araç" sembolleri normal park
  // edilmiş araç gibi çiziliyordu).
  const rollShift = (groundClearance + bodyH + cabinH + 4 * SCALE) * sizeScale;

  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, adjustedRad, 0]}>
      <group position={[0, rollOver ? rollShift : 0, 0]} rotation={[rollOver ? Math.PI : 0, 0, 0]} scale={[sizeScale, sizeScale, sizeScale]}>
      {/* Chassis */}
      <mesh position={[0, groundClearance - 2 * SCALE, 0]}>
        <boxGeometry args={[w * 0.98, 4 * SCALE, d * 0.98]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>

      {/* Extruded Body Shell */}
      <group position={[0, 0, -d / 2]}>
        <mesh castShadow receiveShadow>
          <extrudeGeometry args={[bodyProfileShape, extrudeSettings]} />
          <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
        </mesh>
      </group>

      {/* Body Panel Gap Lines (Hood & Trunk) */}
      {!isTruck && !isBus && !isMotorcycle && (
        <group>
          {/* Hood gap */}
          <mesh position={[w * 0.19, groundClearance + bodyH * 1.01, 0]}>
            <boxGeometry args={[0.3 * SCALE, 0.3 * SCALE, d * 0.85]} />
            <meshBasicMaterial color="#111" />
          </mesh>
          {/* Trunk gap */}
          <mesh position={[-w * 0.18, groundClearance + bodyH * 1.01, 0]}>
            <boxGeometry args={[0.3 * SCALE, 0.3 * SCALE, d * 0.85]} />
            <meshBasicMaterial color="#111" />
          </mesh>
        </group>
      )}

      {/* Wheel Arch Fenders & Side Details */}
      {!isTruck && !isBus && !isMotorcycle && (
        <>
          {/* Front wheel arch (left side) */}
          <group position={[w / 3.2, groundClearance + bodyH * 0.65, d / 2 - 0.5 * SCALE]}>
            <mesh>
              <boxGeometry args={[8 * SCALE, wheelR * 1.1, 0.8 * SCALE]} />
              <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
            </mesh>
          </group>
          {/* Front wheel arch (right side) */}
          <group position={[w / 3.2, groundClearance + bodyH * 0.65, -d / 2 + 0.5 * SCALE]}>
            <mesh>
              <boxGeometry args={[8 * SCALE, wheelR * 1.1, 0.8 * SCALE]} />
              <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
            </mesh>
          </group>
          {/* Rear wheel arch (left side) */}
          <group position={[-w / 3.2, groundClearance + bodyH * 0.65, d / 2 - 0.5 * SCALE]}>
            <mesh>
              <boxGeometry args={[8 * SCALE, wheelR * 1.1, 0.8 * SCALE]} />
              <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
            </mesh>
          </group>
          {/* Rear wheel arch (right side) */}
          <group position={[-w / 3.2, groundClearance + bodyH * 0.65, -d / 2 + 0.5 * SCALE]}>
            <mesh>
              <boxGeometry args={[8 * SCALE, wheelR * 1.1, 0.8 * SCALE]} />
              <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
            </mesh>
          </group>
          {/* Side sill / rocker panel strip (left) */}
          <mesh position={[0, groundClearance + 3 * SCALE, d / 2 - 0.3 * SCALE]}>
            <boxGeometry args={[w * 0.7, 1.5 * SCALE, 0.6 * SCALE]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
          </mesh>
          {/* Side sill / rocker panel strip (right) */}
          <mesh position={[0, groundClearance + 3 * SCALE, -d / 2 + 0.3 * SCALE]}>
            <boxGeometry args={[w * 0.7, 1.5 * SCALE, 0.6 * SCALE]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
          </mesh>
          {/* Exhaust pipe (rear left) */}
          <mesh position={[-w / 2 + 2 * SCALE, groundClearance + 3 * SCALE, d * 0.25]}>
            <cylinderGeometry args={[1.5 * SCALE, 2 * SCALE, 3 * SCALE, 12]} />
            <meshStandardMaterial color="#7f8c8d" metalness={0.9} roughness={0.2} />
          </mesh>
        </>
      )}

      {/* Sedan Cabin Frame & Windshields */}
      {!isTruck && !isBus && !isMotorcycle && !isSUV && (
        <group>
          {/* Roof */}
          <mesh position={[-w * 0.025, groundClearance + bodyH + cabinH - 1 * SCALE, 0]} castShadow>
            <boxGeometry args={[w * 0.45, 2 * SCALE, d * 0.95]} />
            <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>
          {/* Front windshield — glass + top/bottom frames, A-pillars are the side edges */}
          <group position={[w * 0.275, groundClearance + bodyH + cabinH * 0.5, 0]} rotation={[0, 0, Math.PI / 4.5]}>
            {/* Top Frame */}
            <mesh position={[0, cabinH * 0.65, 0]}>
              <boxGeometry args={[w * 0.03, 1.5 * SCALE, d * 0.92]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
            </mesh>
            {/* Bottom Frame */}
            <mesh position={[0, -cabinH * 0.65, 0]}>
              <boxGeometry args={[w * 0.03, 1.5 * SCALE, d * 0.92]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
            </mesh>
            {/* Glass Pane */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[w * 0.02, cabinH * 1.28, d * 0.92]} />
              <meshPhysicalMaterial
                color="#1e3a4a"
                roughness={0.05}
                metalness={0.0}
                transparent
                opacity={0.85}
                side={THREE.DoubleSide}
                envMapIntensity={1.5}
              />
            </mesh>
          </group>

          {/* A-Pillars (Front Frame — left and right edges of windshield) */}
          <mesh position={[w * 0.275, groundClearance + bodyH + cabinH * 0.5, d / 2 - 0.15 * SCALE]} rotation={[0, 0, Math.PI / 4.5]}>
            <boxGeometry args={[w * 0.04, cabinH * 1.4, 1.5 * SCALE]} />
            <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>
          <mesh position={[w * 0.275, groundClearance + bodyH + cabinH * 0.5, -d / 2 + 0.15 * SCALE]} rotation={[0, 0, Math.PI / 4.5]}>
            <boxGeometry args={[w * 0.04, cabinH * 1.4, 1.5 * SCALE]} />
            <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>

          {/* Rear windshield — glass + top/bottom frames, C-pillars are the side edges */}
          <group position={[-w * 0.315, groundClearance + bodyH + cabinH * 0.5, 0]} rotation={[0, 0, -Math.PI / 4]}>
            {/* Top Frame */}
            <mesh position={[0, cabinH * 0.65, 0]}>
              <boxGeometry args={[w * 0.03, 1.5 * SCALE, d * 0.92]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
            </mesh>
            {/* Bottom Frame */}
            <mesh position={[0, -cabinH * 0.65, 0]}>
              <boxGeometry args={[w * 0.03, 1.5 * SCALE, d * 0.92]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
            </mesh>
            {/* Glass Pane */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[w * 0.02, cabinH * 1.28, d * 0.92]} />
              <meshPhysicalMaterial
                color="#1e3a4a"
                roughness={0.05}
                metalness={0.0}
                transparent
                opacity={0.85}
                side={THREE.DoubleSide}
                envMapIntensity={1.5}
              />
            </mesh>
          </group>

          {/* C-Pillars (Rear Frame — left and right edges of rear windshield) */}
          <mesh position={[-w * 0.315, groundClearance + bodyH + cabinH * 0.5, d / 2 - 0.15 * SCALE]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[w * 0.05, cabinH * 1.4, 1.5 * SCALE]} />
            <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>
          <mesh position={[-w * 0.315, groundClearance + bodyH + cabinH * 0.5, -d / 2 + 0.15 * SCALE]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[w * 0.05, cabinH * 1.4, 1.5 * SCALE]} />
            <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>

          {/* B-Pillars (Center vertical posts) */}
          <mesh position={[-w * 0.025, groundClearance + bodyH + cabinH * 0.5, d / 2 - 0.15 * SCALE]}>
            <boxGeometry args={[w * 0.03, cabinH, 1.5 * SCALE]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
          </mesh>
          <mesh position={[-w * 0.025, groundClearance + bodyH + cabinH * 0.5, -d / 2 + 0.15 * SCALE]}>
            <boxGeometry args={[w * 0.03, cabinH, 1.5 * SCALE]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
          </mesh>
        </group>
      )}

      {/* SUV / Ambulance Cabin Frame & Windshields */}
      {isSUV && !isTruck && !isBus && !isMotorcycle && (
        <group>
          {/* Roof */}
          <mesh position={[-w * 0.075, groundClearance + bodyH + cabinH - 1 * SCALE, 0]} castShadow>
            <boxGeometry args={[w * 0.8, 2 * SCALE, d * 0.95]} />
            <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>
          {/* Front windshield — glass + top/bottom frames */}
          <group position={[w * 0.387, groundClearance + bodyH + cabinH * 0.5, 0]} rotation={[0, 0, Math.PI / 4.2]}>
            <mesh position={[0, cabinH * 0.65, 0]}>
              <boxGeometry args={[w * 0.03, 1.5 * SCALE, d * 0.92]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
            </mesh>
            <mesh position={[0, -cabinH * 0.65, 0]}>
              <boxGeometry args={[w * 0.03, 1.5 * SCALE, d * 0.92]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[w * 0.02, cabinH * 1.28, d * 0.92]} />
              <meshPhysicalMaterial color="#1e3a4a" roughness={0.05} metalness={0.0} transparent opacity={0.85} side={THREE.DoubleSide} envMapIntensity={1.5} />
            </mesh>
          </group>

          {/* A-Pillars */}
          <mesh position={[w * 0.387, groundClearance + bodyH + cabinH * 0.5, d / 2 - 0.15 * SCALE]} rotation={[0, 0, Math.PI / 4.2]}>
            <boxGeometry args={[w * 0.04, cabinH * 1.4, 1.5 * SCALE]} />
            <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>
          <mesh position={[w * 0.387, groundClearance + bodyH + cabinH * 0.5, -d / 2 + 0.15 * SCALE]} rotation={[0, 0, Math.PI / 4.2]}>
            <boxGeometry args={[w * 0.04, cabinH * 1.4, 1.5 * SCALE]} />
            <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>

          {/* Rear windshield — flat back glass */}
          <group position={[-w * 0.485, groundClearance + bodyH + cabinH * 0.5, 0]}>
            <mesh position={[0, cabinH * 0.475, 0]}>
              <boxGeometry args={[w * 0.03, 1.5 * SCALE, d * 0.92]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
            </mesh>
            <mesh position={[0, -cabinH * 0.475, 0]}>
              <boxGeometry args={[w * 0.03, 1.5 * SCALE, d * 0.92]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[w * 0.02, cabinH * 0.93, d * 0.92]} />
              <meshPhysicalMaterial color="#1e3a4a" roughness={0.05} metalness={0.0} transparent opacity={0.85} side={THREE.DoubleSide} envMapIntensity={1.5} />
            </mesh>
          </group>

          {/* D-Pillars (Rear Flat Pillars) */}
          <mesh position={[-w * 0.485, groundClearance + bodyH + cabinH * 0.5, d / 2 - 0.15 * SCALE]}>
            <boxGeometry args={[w * 0.04, cabinH * 0.95, 1.5 * SCALE]} />
            <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>
          <mesh position={[-w * 0.485, groundClearance + bodyH + cabinH * 0.5, -d / 2 + 0.15 * SCALE]}>
            <boxGeometry args={[w * 0.04, cabinH * 0.95, 1.5 * SCALE]} />
            <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>

          {/* B-Pillars */}
          <mesh position={[w * 0.05, groundClearance + bodyH + cabinH * 0.5, d / 2 - 0.15 * SCALE]}>
            <boxGeometry args={[w * 0.03, cabinH, 1.5 * SCALE]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
          </mesh>
          <mesh position={[w * 0.05, groundClearance + bodyH + cabinH * 0.5, -d / 2 + 0.15 * SCALE]}>
            <boxGeometry args={[w * 0.03, cabinH, 1.5 * SCALE]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
          </mesh>

          {/* C-Pillars (Rear Quarter Pillars) */}
          <mesh position={[-w * 0.22, groundClearance + bodyH + cabinH * 0.5, d / 2 - 0.15 * SCALE]}>
            <boxGeometry args={[w * 0.03, cabinH, 1.5 * SCALE]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
          </mesh>
          <mesh position={[-w * 0.22, groundClearance + bodyH + cabinH * 0.5, -d / 2 + 0.15 * SCALE]}>
            <boxGeometry args={[w * 0.03, cabinH, 1.5 * SCALE]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
          </mesh>
        </group>
      )}

      {/* Truck Cabin Frame & Windshields */}
      {isTruck && (
        <group>
          {/* Cab Roof */}
          <mesh position={[w * 0.235, groundClearance + bodyH + cabinH - 1 * SCALE, 0]} castShadow>
            <boxGeometry args={[w * 0.23, 2 * SCALE, d * 0.95]} />
            <meshPhysicalMaterial color={color} metalness={0.7} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>
          {/* Front windshield — glass + top/bottom frames */}
          <group position={[w * 0.39, groundClearance + bodyH + cabinH * 0.5, 0]} rotation={[0, 0, Math.PI / 5]}>
            <mesh position={[0, cabinH * 0.6, 0]}>
              <boxGeometry args={[w * 0.03, 1.5 * SCALE, d * 0.92]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
            </mesh>
            <mesh position={[0, -cabinH * 0.6, 0]}>
              <boxGeometry args={[w * 0.03, 1.5 * SCALE, d * 0.92]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[w * 0.02, cabinH * 1.18, d * 0.92]} />
              <meshPhysicalMaterial color="#1e3a4a" roughness={0.05} metalness={0.0} transparent opacity={0.85} side={THREE.DoubleSide} envMapIntensity={1.5} />
            </mesh>
          </group>
          {/* Rear Cab Wall & Window */}
          <mesh position={[w * 0.11, groundClearance + bodyH + cabinH * 0.5, 0]}>
            <boxGeometry args={[w * 0.02, cabinH, d * 0.9]} />
            <meshPhysicalMaterial color={color} metalness={0.7} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>
          <mesh position={[w * 0.11, groundClearance + bodyH + cabinH * 0.6, 0]}>
            <boxGeometry args={[w * 0.025, cabinH * 0.5, d * 0.5]} />
            <meshPhysicalMaterial color="#1e3a4a" roughness={0.05} metalness={0.0} transparent opacity={0.85} side={THREE.DoubleSide} envMapIntensity={1.5} />
          </mesh>
          {/* A-Pillars (Front Frame) */}
          <mesh position={[w * 0.39, groundClearance + bodyH + cabinH * 0.5, d / 2 - 0.15 * SCALE]} rotation={[0, 0, Math.PI / 5]}>
            <boxGeometry args={[w * 0.04, cabinH * 1.3, 1.5 * SCALE]} />
            <meshPhysicalMaterial color={color} metalness={0.7} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>
          <mesh position={[w * 0.39, groundClearance + bodyH + cabinH * 0.5, -d / 2 + 0.15 * SCALE]} rotation={[0, 0, Math.PI / 5]}>
            <boxGeometry args={[w * 0.04, cabinH * 1.3, 1.5 * SCALE]} />
            <meshPhysicalMaterial color={color} metalness={0.7} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>
        </group>
      )}

      {/* Bus Cabin Structure */}
      {isBus && (
        <group>
          {/* Bus Roof */}
          <mesh position={[0, groundClearance + bodyH - 1 * SCALE, 0]} castShadow>
            <boxGeometry args={[w * 0.98, 2 * SCALE, d * 0.95]} />
            <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>
          {/* Bus Rear Glass & Frame */}
          <mesh position={[-w / 2 + 1 * SCALE, groundClearance + bodyH * 0.775, 0]}>
            <boxGeometry args={[0.2 * SCALE, bodyH * 0.45, d * 0.9]} />
            <meshStandardMaterial 
              color="#00d2d3" 
              roughness={0.01} 
              metalness={0.95} 
              transparent 
              opacity={0.65} 
              side={THREE.DoubleSide} 
            />
          </mesh>
          {/* Bus Corner Pillars */}
          {/* Rear Left Corner Pillar */}
          <mesh position={[-w / 2 + 1 * SCALE, groundClearance + bodyH * 0.775, d / 2 - 0.2 * SCALE]}>
            <boxGeometry args={[w * 0.03, bodyH * 0.45, 0.4 * SCALE]} />
            <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>
          {/* Rear Right Corner Pillar */}
          <mesh position={[-w / 2 + 1 * SCALE, groundClearance + bodyH * 0.775, -d / 2 + 0.2 * SCALE]}>
            <boxGeometry args={[w * 0.03, bodyH * 0.45, 0.4 * SCALE]} />
            <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>
          {/* Front Left Corner Pillar */}
          <mesh position={[w / 2 - 1 * SCALE, groundClearance + bodyH * 0.775, d / 2 - 0.2 * SCALE]}>
            <boxGeometry args={[w * 0.03, bodyH * 0.45, 0.4 * SCALE]} />
            <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>
          {/* Front Right Corner Pillar */}
          <mesh position={[w / 2 - 1 * SCALE, groundClearance + bodyH * 0.775, -d / 2 + 0.2 * SCALE]}>
            <boxGeometry args={[w * 0.03, bodyH * 0.45, 0.4 * SCALE]} />
            <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
          </mesh>
        </group>
      )}

      {/* Interior seats and steering wheel */}
      {!isBus && !isTruck && (
        <group>
          {/* Dashboard */}
          <mesh position={[w * 0.22, groundClearance + bodyH * 0.52, 0]} castShadow>
            <boxGeometry args={[w * 0.05, bodyH * 0.3, d * 0.82]} />
            <meshStandardMaterial color="#1e272e" roughness={0.7} />
          </mesh>

          {/* Front Left Seat */}
          {/* Cushion */}
          <mesh position={[w * 0.02, groundClearance + 4 * SCALE, d * 0.22]} castShadow>
            <boxGeometry args={[w * 0.12, 6 * SCALE, d * 0.28]} />
            <meshStandardMaterial color="#2d3436" roughness={0.8} />
          </mesh>
          {/* Backrest */}
          <mesh position={[-w * 0.035, groundClearance + 12 * SCALE, d * 0.22]} rotation={[0, 0, -Math.PI / 18]} castShadow>
            <boxGeometry args={[w * 0.03, 16 * SCALE, d * 0.26]} />
            <meshStandardMaterial color="#2d3436" roughness={0.8} />
          </mesh>
          {/* Headrest */}
          <mesh position={[-w * 0.045, groundClearance + 21 * SCALE, d * 0.22]} castShadow>
            <boxGeometry args={[w * 0.025, 4 * SCALE, d * 0.14]} />
            <meshStandardMaterial color="#1e272e" roughness={0.9} />
          </mesh>

          {/* Front Right Seat */}
          {/* Cushion */}
          <mesh position={[w * 0.02, groundClearance + 4 * SCALE, -d * 0.22]} castShadow>
            <boxGeometry args={[w * 0.12, 6 * SCALE, d * 0.28]} />
            <meshStandardMaterial color="#2d3436" roughness={0.8} />
          </mesh>
          {/* Backrest */}
          <mesh position={[-w * 0.035, groundClearance + 12 * SCALE, -d * 0.22]} rotation={[0, 0, -Math.PI / 18]} castShadow>
            <boxGeometry args={[w * 0.03, 16 * SCALE, d * 0.26]} />
            <meshStandardMaterial color="#2d3436" roughness={0.8} />
          </mesh>
          {/* Headrest */}
          <mesh position={[-w * 0.045, groundClearance + 21 * SCALE, -d * 0.22]} castShadow>
            <boxGeometry args={[w * 0.025, 4 * SCALE, d * 0.14]} />
            <meshStandardMaterial color="#1e272e" roughness={0.9} />
          </mesh>

          {/* Rear Bench Seat */}
          {/* Cushion */}
          <mesh position={[-w * 0.16, groundClearance + 4 * SCALE, 0]} castShadow>
            <boxGeometry args={[w * 0.12, 6 * SCALE, d * 0.82]} />
            <meshStandardMaterial color="#2d3436" roughness={0.8} />
          </mesh>
          {/* Backrest */}
          <mesh position={[-w * 0.21, groundClearance + 13 * SCALE, 0]} rotation={[0, 0, -Math.PI / 12]} castShadow>
            <boxGeometry args={[w * 0.03, 18 * SCALE, d * 0.8]} />
            <meshStandardMaterial color="#2d3436" roughness={0.8} />
          </mesh>

          {/* Steering Wheel & Column */}
          <group position={[w * 0.12, groundClearance + bodyH * 0.62, d * 0.22]}>
            {/* Column */}
            <mesh position={[w * 0.05, -bodyH * 0.07, 0]} rotation={[0, 0, Math.PI / 4.5]}>
              <cylinderGeometry args={[1 * SCALE, 1 * SCALE, 10 * SCALE, 8]} />
              <meshStandardMaterial color="#2d3436" roughness={0.6} />
            </mesh>
            {/* Torus Wheel */}
            <mesh rotation={[0, 0, Math.PI / 4]}>
              <torusGeometry args={[5 * SCALE, 1.2 * SCALE, 8, 16]} />
              <meshStandardMaterial color="#111" roughness={0.7} />
            </mesh>
          </group>
        </group>
      )}

      {/* Truck Cabin Interior */}
      {isTruck && (
        <group>
          {/* Dashboard */}
          <mesh position={[w * 0.38, groundClearance + bodyH * 0.65, 0]} castShadow>
            <boxGeometry args={[w * 0.04, bodyH * 0.25, d * 0.82]} />
            <meshStandardMaterial color="#1e272e" roughness={0.7} />
          </mesh>

          {/* Front Left Seat */}
          {/* Cushion */}
          <mesh position={[w * 0.26, groundClearance + 4 * SCALE, d * 0.2]} castShadow>
            <boxGeometry args={[w * 0.09, 6 * SCALE, d * 0.28]} />
            <meshStandardMaterial color="#2d3436" roughness={0.8} />
          </mesh>
          {/* Backrest */}
          <mesh position={[w * 0.21, groundClearance + 12 * SCALE, d * 0.2]} rotation={[0, 0, -Math.PI / 18]} castShadow>
            <boxGeometry args={[w * 0.025, 16 * SCALE, d * 0.26]} />
            <meshStandardMaterial color="#2d3436" roughness={0.8} />
          </mesh>
          {/* Headrest */}
          <mesh position={[w * 0.20, groundClearance + 21 * SCALE, d * 0.2]} castShadow>
            <boxGeometry args={[w * 0.02, 4 * SCALE, d * 0.14]} />
            <meshStandardMaterial color="#1e272e" roughness={0.9} />
          </mesh>

          {/* Front Right Seat */}
          {/* Cushion */}
          <mesh position={[w * 0.26, groundClearance + 4 * SCALE, -d * 0.2]} castShadow>
            <boxGeometry args={[w * 0.09, 6 * SCALE, d * 0.28]} />
            <meshStandardMaterial color="#2d3436" roughness={0.8} />
          </mesh>
          {/* Backrest */}
          <mesh position={[w * 0.21, groundClearance + 12 * SCALE, -d * 0.2]} rotation={[0, 0, -Math.PI / 18]} castShadow>
            <boxGeometry args={[w * 0.025, 16 * SCALE, d * 0.26]} />
            <meshStandardMaterial color="#2d3436" roughness={0.8} />
          </mesh>
          {/* Headrest */}
          <mesh position={[w * 0.20, groundClearance + 21 * SCALE, -d * 0.2]} castShadow>
            <boxGeometry args={[w * 0.02, 4 * SCALE, d * 0.14]} />
            <meshStandardMaterial color="#1e272e" roughness={0.9} />
          </mesh>

          {/* Steering Wheel & Column */}
          <group position={[w * 0.36, groundClearance + bodyH * 0.72, d * 0.2]}>
            {/* Column */}
            <mesh position={[w * 0.015, -bodyH * 0.07, 0]} rotation={[0, 0, Math.PI / 4.5]}>
              <cylinderGeometry args={[1 * SCALE, 1 * SCALE, 6 * SCALE, 8]} />
              <meshStandardMaterial color="#2d3436" roughness={0.6} />
            </mesh>
            {/* Torus Wheel */}
            <mesh rotation={[0, 0, Math.PI / 4.5]}>
              <torusGeometry args={[5 * SCALE, 1.2 * SCALE, 8, 16]} />
              <meshStandardMaterial color="#111" roughness={0.7} />
            </mesh>
          </group>
        </group>
      )}

      {/* Interactive Sedan / SUV Side Doors */}
      {!isBus && !isTruck && (
        <>
          {/* Front Left Door */}
          <group 
            ref={leftDoorRef} 
            position={[w * 0.2, 0, d / 2]} 
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
          >
            {/* Door Outer Panel (Car Color) */}
            <mesh position={[-w * 0.11, groundClearance + bodyH * 0.275, 0.5 * SCALE]} castShadow onClick={toggleLeft}>
              <boxGeometry args={[w * 0.22, bodyH * 0.55, 0.6 * SCALE]} />
              <meshPhysicalMaterial color={color} metalness={0.7} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
            </mesh>
            
            {/* Door Inner Lining Panel */}
            <mesh position={[-w * 0.11, groundClearance + bodyH * 0.275, -0.2 * SCALE]} onClick={toggleLeft}>
              <boxGeometry args={[w * 0.21, bodyH * 0.5, 0.4 * SCALE]} />
              <meshStandardMaterial color="#2d3436" roughness={0.8} />
            </mesh>

            {/* Red Warning Reflector Light */}
            {leftDoorOpen && (
              <mesh position={[-w * 0.215, groundClearance + bodyH * 0.25, -0.2 * SCALE]} onClick={toggleLeft}>
                <boxGeometry args={[w * 0.015, 3 * SCALE, 0.4 * SCALE]} />
                <meshBasicMaterial color="#ff2222" />
              </mesh>
            )}

            {/* Door Window Frame & Glass — at outer face of door */}
            <group position={[-w * 0.11, groundClearance + bodyH * 0.55 + cabinH * 0.35, 0.55 * SCALE]}>
              <WindowFrameAndGlass 
                width={w * 0.20} 
                height={cabinH * 0.68} 
                thick={4 * SCALE} 
                onClick={toggleLeft} 
              />
            </group>

            {/* Door Handle */}
            <mesh position={[-w * 0.19, groundClearance + bodyH * 0.4, 0.8 * SCALE]} onClick={toggleLeft}>
              <boxGeometry args={[w * 0.03, 2 * SCALE, 0.5 * SCALE]} />
              <meshStandardMaterial color="#dcdde1" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Side Mirror */}
            <mesh position={[-w * 0.02, groundClearance + bodyH * 0.57, 1.2 * SCALE]} rotation={[0, 0.2, 0]} onClick={toggleLeft}>
              <boxGeometry args={[w * 0.05, 3 * SCALE, 2 * SCALE]} />
              <meshPhysicalMaterial color={color} metalness={0.7} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
            </mesh>
          </group>

          {/* Front Left Door Sill Neon Warning Light */}
          <mesh position={[w * 0.09, groundClearance + 0.6 * SCALE, d / 2 - 0.2 * SCALE]}>
            <boxGeometry args={[w * 0.22, 1.2 * SCALE, 0.4 * SCALE]} />
            <meshBasicMaterial color={leftDoorOpen ? "#ff3838" : "#2ed573"} />
          </mesh>

          {/* Rear Left Door */}
          <group 
            ref={leftRearDoorRef} 
            position={[-w * 0.02, 0, d / 2]} 
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
          >
            {/* Door Outer Panel (Car Color) */}
            <mesh position={[-w * 0.115, groundClearance + bodyH * 0.275, 0.5 * SCALE]} castShadow onClick={toggleLeftRear}>
              <boxGeometry args={[w * 0.23, bodyH * 0.55, 0.6 * SCALE]} />
              <meshPhysicalMaterial color={color} metalness={0.7} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
            </mesh>
            
            {/* Door Inner Lining Panel */}
            <mesh position={[-w * 0.115, groundClearance + bodyH * 0.275, -0.2 * SCALE]} onClick={toggleLeftRear}>
              <boxGeometry args={[w * 0.22, bodyH * 0.5, 0.4 * SCALE]} />
              <meshStandardMaterial color="#2d3436" roughness={0.8} />
            </mesh>

            {/* Red Warning Reflector Light */}
            {leftRearDoorOpen && (
              <mesh position={[-w * 0.225, groundClearance + bodyH * 0.25, -0.2 * SCALE]} onClick={toggleLeftRear}>
                <boxGeometry args={[w * 0.015, 3 * SCALE, 0.4 * SCALE]} />
                <meshBasicMaterial color="#ff2222" />
              </mesh>
            )}

            {/* Door Window Frame & Glass — at outer face of door */}
            <group position={[-w * 0.115, groundClearance + bodyH * 0.55 + cabinH * 0.35, 0.55 * SCALE]}>
              <WindowFrameAndGlass 
                width={w * 0.21} 
                height={cabinH * 0.68} 
                thick={4 * SCALE} 
                onClick={toggleLeftRear} 
              />
            </group>

            {/* Door Handle */}
            <mesh position={[-w * 0.2, groundClearance + bodyH * 0.4, 0.8 * SCALE]} onClick={toggleLeftRear}>
              <boxGeometry args={[w * 0.03, 2 * SCALE, 0.5 * SCALE]} />
              <meshStandardMaterial color="#dcdde1" metalness={0.9} roughness={0.1} />
            </mesh>
          </group>

          {/* Rear Left Door Sill Neon Warning Light */}
          <mesh position={[-w * 0.135, groundClearance + 0.6 * SCALE, d / 2 - 0.2 * SCALE]}>
            <boxGeometry args={[w * 0.23, 1.2 * SCALE, 0.4 * SCALE]} />
            <meshBasicMaterial color={leftRearDoorOpen ? "#ff3838" : "#2ed573"} />
          </mesh>

          {/* Front Right Door */}
          <group 
            ref={rightDoorRef} 
            position={[w * 0.2, 0, -d / 2]} 
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
          >
            {/* Door Outer Panel (Car Color) */}
            <mesh position={[-w * 0.11, groundClearance + bodyH * 0.275, -0.5 * SCALE]} castShadow onClick={toggleRight}>
              <boxGeometry args={[w * 0.22, bodyH * 0.55, 0.6 * SCALE]} />
              <meshPhysicalMaterial color={color} metalness={0.7} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
            </mesh>

            {/* Door Inner Lining Panel */}
            <mesh position={[-w * 0.11, groundClearance + bodyH * 0.275, 0.2 * SCALE]} onClick={toggleRight}>
              <boxGeometry args={[w * 0.21, bodyH * 0.5, 0.4 * SCALE]} />
              <meshStandardMaterial color="#2d3436" roughness={0.8} />
            </mesh>

            {/* Red Warning Reflector Light */}
            {rightDoorOpen && (
              <mesh position={[-w * 0.215, groundClearance + bodyH * 0.25, 0.2 * SCALE]} onClick={toggleRight}>
                <boxGeometry args={[w * 0.015, 3 * SCALE, 0.4 * SCALE]} />
                <meshBasicMaterial color="#ff2222" />
              </mesh>
            )}

            {/* Door Window Frame & Glass — at outer face of door */}
            <group position={[-w * 0.11, groundClearance + bodyH * 0.55 + cabinH * 0.35, -0.55 * SCALE]}>
              <WindowFrameAndGlass 
                width={w * 0.20} 
                height={cabinH * 0.68} 
                thick={4 * SCALE} 
                onClick={toggleRight} 
              />
            </group>

            {/* Door Handle */}
            <mesh position={[-w * 0.19, groundClearance + bodyH * 0.4, -0.8 * SCALE]} onClick={toggleRight}>
              <boxGeometry args={[w * 0.03, 2 * SCALE, 0.5 * SCALE]} />
              <meshStandardMaterial color="#dcdde1" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Side Mirror */}
            <mesh position={[-w * 0.02, groundClearance + bodyH * 0.57, -1.2 * SCALE]} rotation={[0, -0.2, 0]} onClick={toggleRight}>
              <boxGeometry args={[w * 0.05, 3 * SCALE, 2 * SCALE]} />
              <meshPhysicalMaterial color={color} metalness={0.7} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
            </mesh>
          </group>

          {/* Front Right Door Sill Neon Warning Light */}
          <mesh position={[w * 0.09, groundClearance + 0.6 * SCALE, -d / 2 + 0.2 * SCALE]}>
            <boxGeometry args={[w * 0.22, 1.2 * SCALE, 0.4 * SCALE]} />
            <meshBasicMaterial color={rightDoorOpen ? "#ff3838" : "#2ed573"} />
          </mesh>

          {/* Rear Right Door */}
          <group 
            ref={rightRearDoorRef} 
            position={[-w * 0.02, 0, -d / 2]} 
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
          >
            {/* Door Outer Panel (Car Color) */}
            <mesh position={[-w * 0.115, groundClearance + bodyH * 0.275, -0.5 * SCALE]} castShadow onClick={toggleRightRear}>
              <boxGeometry args={[w * 0.23, bodyH * 0.55, 0.6 * SCALE]} />
              <meshPhysicalMaterial color={color} metalness={0.7} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
            </mesh>

            {/* Door Inner Lining Panel */}
            <mesh position={[-w * 0.115, groundClearance + bodyH * 0.275, 0.2 * SCALE]} onClick={toggleRightRear}>
              <boxGeometry args={[w * 0.22, bodyH * 0.5, 0.4 * SCALE]} />
              <meshStandardMaterial color="#2d3436" roughness={0.8} />
            </mesh>

            {/* Red Warning Reflector Light */}
            {rightRearDoorOpen && (
              <mesh position={[-w * 0.225, groundClearance + bodyH * 0.25, 0.2 * SCALE]} onClick={toggleRightRear}>
                <boxGeometry args={[w * 0.015, 3 * SCALE, 0.4 * SCALE]} />
                <meshBasicMaterial color="#ff2222" />
              </mesh>
            )}

            {/* Door Window Frame & Glass — at outer face of door */}
            <group position={[-w * 0.115, groundClearance + bodyH * 0.55 + cabinH * 0.35, -0.55 * SCALE]}>
              <WindowFrameAndGlass 
                width={w * 0.21} 
                height={cabinH * 0.68} 
                thick={4 * SCALE} 
                onClick={toggleRightRear} 
              />
            </group>

            {/* Door Handle */}
            <mesh position={[-w * 0.2, groundClearance + bodyH * 0.4, -0.8 * SCALE]} onClick={toggleRightRear}>
              <boxGeometry args={[w * 0.03, 2 * SCALE, 0.5 * SCALE]} />
              <meshStandardMaterial color="#dcdde1" metalness={0.9} roughness={0.1} />
            </mesh>
          </group>

          {/* Rear Right Door Sill Neon Warning Light */}
          <mesh position={[-w * 0.135, groundClearance + 0.6 * SCALE, -d / 2 + 0.2 * SCALE]}>
            <boxGeometry args={[w * 0.23, 1.2 * SCALE, 0.4 * SCALE]} />
            <meshBasicMaterial color={rightRearDoorOpen ? "#ff3838" : "#2ed573"} />
          </mesh>
        </>
      )}

      {/* Interactive Truck Cabin Doors */}
      {isTruck && (
        <>
          {/* Left Door */}
          <group 
            ref={truckDoorLeftRef} 
            position={[w * 0.35, 0, d / 2]} 
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
          >
            {/* Lower Panel */}
            <mesh position={[-w * 0.1, groundClearance + bodyH * 0.35, 0.5 * SCALE]} castShadow onClick={toggleTruck}>
              <boxGeometry args={[w * 0.2, bodyH * 0.7, 0.6 * SCALE]} />
              <meshPhysicalMaterial color={color} metalness={0.7} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
            </mesh>
            {/* Inner Lining Panel */}
            <mesh position={[-w * 0.1, groundClearance + bodyH * 0.35, -0.2 * SCALE]} onClick={toggleTruck}>
              <boxGeometry args={[w * 0.18, bodyH * 0.65, 0.4 * SCALE]} />
              <meshStandardMaterial color="#2d3436" roughness={0.8} />
            </mesh>
            {/* Red Warning Reflector */}
            {truckDoorOpen && (
              <mesh position={[-w * 0.19, groundClearance + bodyH * 0.35, -0.2 * SCALE]} onClick={toggleTruck}>
                <boxGeometry args={[w * 0.015, 3 * SCALE, 0.4 * SCALE]} />
                <meshBasicMaterial color="#ff2222" />
              </mesh>
            )}
            {/* Window Frame & Glass */}
            <group position={[-w * 0.1, groundClearance + bodyH + cabinH * 0.35, 0.1 * SCALE]}>
              <WindowFrameAndGlass 
                width={w * 0.2} 
                height={cabinH * 0.7} 
                thick={0.6 * SCALE} 
                onClick={toggleTruck} 
              />
            </group>
            {/* Side Mirror */}
            <group position={[0, groundClearance + bodyH * 0.7, 1.5 * SCALE]}>
              <mesh onClick={toggleTruck}>
                <boxGeometry args={[2 * SCALE, 10 * SCALE, 1 * SCALE]} />
                <meshStandardMaterial color="#111" roughness={0.8} />
              </mesh>
              <mesh position={[-0.1, 0, -0.4 * SCALE]} onClick={toggleTruck}>
                <boxGeometry args={[1.8 * SCALE, 9.6 * SCALE, 0.1]} />
                <meshStandardMaterial color="#dcdde1" metalness={0.9} roughness={0.1} />
              </mesh>
            </group>
          </group>

          {/* Left Truck Sill Neon Plate */}
          <mesh position={[w * 0.35 - w * 0.1, groundClearance + 0.6 * SCALE, d / 2 - 0.2 * SCALE]}>
            <boxGeometry args={[w * 0.2, 1.2 * SCALE, 0.4 * SCALE]} />
            <meshBasicMaterial color={truckDoorOpen ? "#ff3838" : "#2ed573"} />
          </mesh>

          {/* Right Door */}
          <group 
            ref={truckDoorRightRef} 
            position={[w * 0.35, 0, -d / 2]} 
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
          >
            {/* Lower Panel */}
            <mesh position={[-w * 0.1, groundClearance + bodyH * 0.35, -0.5 * SCALE]} castShadow onClick={toggleTruck}>
              <boxGeometry args={[w * 0.2, bodyH * 0.7, 0.6 * SCALE]} />
              <meshPhysicalMaterial color={color} metalness={0.7} roughness={0.15} clearcoat={0.3} clearcoatRoughness={0.25} />
            </mesh>
            {/* Inner Lining Panel */}
            <mesh position={[-w * 0.1, groundClearance + bodyH * 0.35, 0.2 * SCALE]} onClick={toggleTruck}>
              <boxGeometry args={[w * 0.18, bodyH * 0.65, 0.4 * SCALE]} />
              <meshStandardMaterial color="#2d3436" roughness={0.8} />
            </mesh>
            {/* Red Warning Reflector */}
            {truckDoorOpen && (
              <mesh position={[-w * 0.19, groundClearance + bodyH * 0.35, 0.2 * SCALE]} onClick={toggleTruck}>
                <boxGeometry args={[w * 0.015, 3 * SCALE, 0.4 * SCALE]} />
                <meshBasicMaterial color="#ff2222" />
              </mesh>
            )}
            {/* Window Frame & Glass */}
            <group position={[-w * 0.1, groundClearance + bodyH + cabinH * 0.35, -0.1 * SCALE]}>
              <WindowFrameAndGlass 
                width={w * 0.2} 
                height={cabinH * 0.7} 
                thick={0.6 * SCALE} 
                onClick={toggleTruck} 
              />
            </group>
            {/* Side Mirror */}
            <group position={[0, groundClearance + bodyH * 0.7, -1.5 * SCALE]}>
              <mesh onClick={toggleTruck}>
                <boxGeometry args={[2 * SCALE, 10 * SCALE, 1 * SCALE]} />
                <meshStandardMaterial color="#111" roughness={0.8} />
              </mesh>
              <mesh position={[-0.1, 0, 0.4 * SCALE]} onClick={toggleTruck}>
                <boxGeometry args={[1.8 * SCALE, 9.6 * SCALE, 0.1]} />
                <meshStandardMaterial color="#dcdde1" metalness={0.9} roughness={0.1} />
              </mesh>
            </group>
          </group>

          {/* Right Truck Sill Neon Plate */}
          <mesh position={[w * 0.35 - w * 0.1, groundClearance + 0.6 * SCALE, -d / 2 + 0.2 * SCALE]}>
            <boxGeometry args={[w * 0.2, 1.2 * SCALE, 0.4 * SCALE]} />
            <meshBasicMaterial color={truckDoorOpen ? "#ff3838" : "#2ed573"} />
          </mesh>
        </>
      )}

      {/* Interactive Bus Entrance Door */}
      {isBus && (
        <>
          <group 
            ref={busDoorRef} 
            position={[w * 0.38, 0, -d / 2]} 
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
          >
            {/* Entrance Door Panel */}
            <mesh position={[-w * 0.05, groundClearance + bodyH * 0.45, -0.2 * SCALE]} castShadow onClick={toggleBus}>
              <boxGeometry args={[w * 0.1, bodyH * 0.85, 0.6 * SCALE]} />
              <meshStandardMaterial color="#2d3436" roughness={0.5} />
            </mesh>
            {/* Glass panel inside entrance door */}
            <group position={[-w * 0.05, groundClearance + bodyH * 0.65, -0.2 * SCALE]}>
              <WindowFrameAndGlass 
                width={w * 0.08} 
                height={bodyH * 0.4} 
                thick={0.7 * SCALE} 
                onClick={toggleBus} 
              />
            </group>
          </group>

          {/* Bus Door Sill Neon Light */}
          <mesh position={[w * 0.38 - w * 0.05, groundClearance + 0.3 * SCALE, -d / 2 + 0.2 * SCALE]}>
            <boxGeometry args={[w * 0.1, 0.6 * SCALE, 0.4 * SCALE]} />
            <meshBasicMaterial color={busDoorOpen ? "#ff3838" : "#2ed573"} />
          </mesh>

          {/* Bus Side Windows - Beautiful hollow frames with tinted refractive glass! */}
          {[-w/3.5, -w/6, 0, w/6, w/3.5].map((wx, idx) => (
            <group key={idx}>
              <group position={[wx, groundClearance + bodyH * 0.6, d / 2 - 0.15 * SCALE]}>
                <WindowFrameAndGlass 
                  width={w * 0.12} 
                  height={bodyH * 0.4} 
                  thick={0.3 * SCALE} 
                />
              </group>
              <group position={[wx, groundClearance + bodyH * 0.6, -d / 2 + 0.15 * SCALE]}>
                <WindowFrameAndGlass 
                  width={w * 0.12} 
                  height={bodyH * 0.4} 
                  thick={0.3 * SCALE} 
                />
              </group>
            </group>
          ))}

          {/* Bus Front Windshield - Large Tinted Specular Pane */}
          <mesh position={[w / 2 - 1 * SCALE, groundClearance + bodyH * 0.55, 0]}>
            <boxGeometry args={[0.2 * SCALE, bodyH * 0.6, d * 0.9]} />
            <meshStandardMaterial 
              color="#00d2d3" 
              roughness={0.01} 
              metalness={0.95} 
              transparent 
              opacity={0.65} 
              side={THREE.DoubleSide} 
            />
          </mesh>
        </>
      )}

      {/* Realistic Wheels with Spoked Rims */}
      {[
        { px: w / 3.2, pz: d / 2 - wheelW / 4 },
        { px: w / 3.2, pz: -d / 2 + wheelW / 4 },
        { px: -w / 3.2, pz: d / 2 - wheelW / 4 },
        { px: -w / 3.2, pz: -d / 2 + wheelW / 4 },
        ...(isTruck ? [
          { px: -w / 8, pz: d / 2 - wheelW / 4 },
          { px: -w / 8, pz: -d / 2 + wheelW / 4 }
        ] : [])
      ].map((pos, idx) => (
        <group key={idx} position={[pos.px, wheelR, pos.pz]} rotation={[Math.PI / 2, 0, 0]}>
          {/* Tire */}
          <mesh castShadow>
            <cylinderGeometry args={[wheelR, wheelR, wheelW, 24]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
          </mesh>
          {/* Tire sidewall ring */}
          <mesh position={[0, 0, wheelW * 0.46]}>
            <torusGeometry args={[wheelR * 0.82, wheelR * 0.08, 8, 24]} />
            <meshStandardMaterial color="#222" roughness={0.9} />
          </mesh>
          {/* Rim outer lip (front) */}
          <mesh position={[0, 0, -wheelW * 0.42]}>
            <torusGeometry args={[wheelR * 0.58, wheelR * 0.06, 8, 24]} />
            <meshStandardMaterial color="#bdc3c7" metalness={0.85} roughness={0.15} />
          </mesh>
          {/* Rim outer lip (back) */}
          <mesh position={[0, 0, wheelW * 0.42]}>
            <torusGeometry args={[wheelR * 0.58, wheelR * 0.06, 8, 24]} />
            <meshStandardMaterial color="#bdc3c7" metalness={0.85} roughness={0.15} />
          </mesh>
          {/* Rim barrel */}
          <mesh>
            <cylinderGeometry args={[wheelR * 0.58, wheelR * 0.58, wheelW * 0.45, 20]} />
            <meshStandardMaterial color="#95a5a6" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Spokes (5-spoke design) */}
          {(() => {
            const spokeLen = wheelR * 0.42;
            const spokeW = wheelR * 0.06;
            const spokes = [];
            for (let si = 0; si < 5; si++) {
              const ang = (si / 5) * Math.PI * 2;
              const cx = Math.cos(ang) * spokeLen * 0.45;
              const cy = Math.sin(ang) * spokeLen * 0.45;
              spokes.push(
                <group key={si}>
                  {/* Spoke arm */}
                  <mesh position={[cy, cx, 0]} rotation={[0, 0, ang]}>
                    <boxGeometry args={[spokeW, spokeLen * 0.8, wheelW * 0.25]} />
                    <meshStandardMaterial color="#bdc3c7" metalness={0.85} roughness={0.15} />
                  </mesh>
                  {/* Spoke split (Y-shape toward rim) */}
                  <mesh position={[cy * 1.7, cx * 1.7, 0]} rotation={[0, 0, ang + 0.25]}>
                    <boxGeometry args={[spokeW * 0.7, spokeLen * 0.35, wheelW * 0.18]} />
                    <meshStandardMaterial color="#bdc3c7" metalness={0.85} roughness={0.15} />
                  </mesh>
                  <mesh position={[cy * 1.7, cx * 1.7, 0]} rotation={[0, 0, ang - 0.25]}>
                    <boxGeometry args={[spokeW * 0.7, spokeLen * 0.35, wheelW * 0.18]} />
                    <meshStandardMaterial color="#bdc3c7" metalness={0.85} roughness={0.15} />
                  </mesh>
                </group>
              );
            }
            return spokes;
          })()}
          {/* Center hub cap */}
          <mesh position={[0, 0, -wheelW * 0.1]}>
            <cylinderGeometry args={[wheelR * 0.1, wheelR * 0.12, wheelW * 0.35, 16]} />
            <meshStandardMaterial color="#7f8c8d" metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Lug nuts */}
          {[0, 1, 2, 3, 4].map(li => {
            const lang = (li / 5) * Math.PI * 2;
            return (
              <mesh key={li} position={[Math.sin(lang) * wheelR * 0.16, Math.cos(lang) * wheelR * 0.16, -wheelW * 0.2]}>
                <cylinderGeometry args={[wheelR * 0.025, wheelR * 0.03, wheelW * 0.12, 8]} />
                <meshStandardMaterial color="#dcdde1" metalness={0.9} roughness={0.1} />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* Headlights - Emissive */}
      <mesh position={[w * 0.5 - 1 * SCALE, groundClearance + bodyH * 0.35, d * 0.35]}>
        <sphereGeometry args={[headlightR, 12, 12]} />
        <meshPhysicalMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={1.5} roughness={0.1} metalness={0.0} />
      </mesh>
      <mesh position={[w * 0.5 - 1 * SCALE, groundClearance + bodyH * 0.35, -d * 0.35]}>
        <sphereGeometry args={[headlightR, 12, 12]} />
        <meshPhysicalMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={1.5} roughness={0.1} metalness={0.0} />
      </mesh>
      {/* Headlight housings */}
      <mesh position={[w * 0.5 - 0.5 * SCALE, groundClearance + bodyH * 0.35, d * 0.35]}>
        <boxGeometry args={[0.8 * SCALE, headlightR * 2.5, headlightR * 2.5]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>
      <mesh position={[w * 0.5 - 0.5 * SCALE, groundClearance + bodyH * 0.35, -d * 0.35]}>
        <boxGeometry args={[0.8 * SCALE, headlightR * 2.5, headlightR * 2.5]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>

      {/* Front Radiator Grille */}
      <group position={[w * 0.5 - 0.2 * SCALE, groundClearance + bodyH * 0.35, 0]}>
        {/* Grille Backing */}
        <mesh>
          <boxGeometry args={[0.4 * SCALE, bodyH * 0.3, d * 0.5]} />
          <meshStandardMaterial color="#1e272e" roughness={0.9} />
        </mesh>
        {/* Chrome Center Bar */}
        <mesh position={[0.1 * SCALE, 0, 0]}>
          <boxGeometry args={[0.3 * SCALE, 1 * SCALE, d * 0.48]} />
          <meshStandardMaterial color="#dcdde1" metalness={0.95} roughness={0.05} />
        </mesh>
      </group>

      {/* Taillights - Emissive */}
      <mesh position={[-w * 0.5 + 1 * SCALE, groundClearance + bodyH * 0.4, d * 0.35]}>
        <boxGeometry args={[2 * SCALE, taillightR * 2, taillightR * 2]} />
        <meshBasicMaterial color="#ff2222" />
      </mesh>
      <mesh position={[-w * 0.5 + 1 * SCALE, groundClearance + bodyH * 0.4, -d * 0.35]}>
        <boxGeometry args={[2 * SCALE, taillightR * 2, taillightR * 2]} />
        <meshBasicMaterial color="#ff2222" />
      </mesh>

      {/* Rear License Plate (White/Blue European style) */}
      <group position={[-w * 0.5 + 0.2 * SCALE, groundClearance + bodyH * 0.3, 0]}>
        {/* White Plate Plate */}
        <mesh>
          <boxGeometry args={[0.2 * SCALE, 4 * SCALE, 12 * SCALE]} />
          <meshStandardMaterial color="#ffffff" roughness={0.7} />
        </mesh>
        {/* Blue TR-Style Strip */}
        <mesh position={[-0.05 * SCALE, 0, -5.5 * SCALE]}>
          <boxGeometry args={[0.3 * SCALE, 4 * SCALE, 1 * SCALE]} />
          <meshBasicMaterial color="#0984e3" />
        </mesh>
      </group>

      {/* Siren Module */}
      {isSiren && (
        <group position={[isTruck ? w * 0.22 : 0, groundClearance + bodyH + cabinH + 2 * SCALE, 0]}>
          <mesh>
            <boxGeometry args={[w * 0.08, 4 * SCALE, d * 0.45]} />
            <meshStandardMaterial color="#222" metalness={0.8} />
          </mesh>
          <mesh position={[0, 3 * SCALE, d * 0.12]}>
            <boxGeometry args={[w * 0.06, 3 * SCALE, d * 0.16]} />
            <meshBasicMaterial color="#0055ff" />
          </mesh>
          <mesh position={[0, 3 * SCALE, -d * 0.12]}>
            <boxGeometry args={[w * 0.06, 3 * SCALE, d * 0.16]} />
            <meshBasicMaterial color="#ff0000" />
          </mesh>
        </group>
      )}

      {/* Police decals */}
      {typeLower.includes('police') && (
        <group>
          <mesh position={[0, groundClearance + bodyH / 2, d / 2 + 0.15]}>
            <boxGeometry args={[w * 0.5, bodyH * 0.3, 0.1]} />
            <meshStandardMaterial color="#0033aa" metalness={0.5} />
          </mesh>
          <mesh position={[0, groundClearance + bodyH / 2, -d / 2 - 0.15]}>
            <boxGeometry args={[w * 0.5, bodyH * 0.3, 0.1]} />
            <meshStandardMaterial color="#0033aa" metalness={0.5} />
          </mesh>
        </group>
      )}

      {/* Ambulance decals */}
      {typeLower.includes('ambulance') && (
        <group>
          <mesh position={[0, groundClearance + bodyH / 2, d / 2 + 0.15]}>
            <boxGeometry args={[w * 0.7, bodyH * 0.25, 0.1]} />
            <meshStandardMaterial color="#cc0000" />
          </mesh>
          <mesh position={[0, groundClearance + bodyH / 2, -d / 2 - 0.15]}>
            <boxGeometry args={[w * 0.7, bodyH * 0.25, 0.1]} />
            <meshStandardMaterial color="#cc0000" />
          </mesh>
        </group>
      )}

      {/* Interior dome point light that turns on when any door is open */}
      {(leftDoorOpen || rightDoorOpen || truckDoorOpen || busDoorOpen) && (
        <pointLight 
          position={[0, groundClearance + bodyH * 0.7, 0]} 
          intensity={4} 
          distance={30 * SCALE} 
          color="#ffeb3b" 
        />
      )}
      </group>
    </group>
  );
};

// --- HAVA / DENİZ TAŞITLARI: prosedürel gerçek modeller ---
// 2B'de uçak/helikopter/balon/tekne ekleyen kullanıcı 3B'de basit otomobil
// kutusu görüyordu (kullanıcı raporu). v-* öneki tüm taşıtları kapsadığı için
// bu sınıflar Vehicle3D'den AYRILDI; her sınıf kendi hacimli modeliyle çizilir.

const AIRCRAFT_VARIANTS: any = {
  airliner: { body: '#eef0f3', accent: '#1f5fa8', dark: '#37474f', metal: '#a7b6bd', wingY: -0.28, sweep: 0.42, winglet: true, windows: true },
  fighter: { body: '#7d8994', accent: '#57646e', dark: '#222c33', metal: '#8fa1ad', wingY: -0.02, sweep: 0.62, winglet: false, windows: false },
  business: { body: '#f6f8fa', accent: '#37474f', dark: '#37474f', metal: '#b0bec5', wingY: -0.22, sweep: 0.46, winglet: true, windows: true },
  cessna: { body: '#f2f4f6', accent: '#c62828', dark: '#37474f', metal: '#b0bec5', wingY: 0.68, sweep: 0.05, winglet: false, windows: false },
};

const Aircraft3D = ({ x, y, width, height, rad, variant, fill, zOffset }: any) => {
  const cfg = AIRCRAFT_VARIANTS[variant] || AIRCRAFT_VARIANTS.airliner;
  const isVert = height > width;
  const w = isVert ? height : width;   // gövde boyu (burun +X yönünde)
  const d = isVert ? width : height;
  const adjRad = isVert ? rad - Math.PI / 2 : rad;
  const bodyColor = fill && fill !== '#000000' ? fill : cfg.body;

  const fuseL = w * 0.94;
  const fuseR = variant === 'fighter' ? Math.max(d * 0.11, w * 0.022) : Math.max(d * 0.15, w * 0.028);
  const fuseY = fuseR * 1.5 + 1.2;                 // iniş takımı yüksekliği
  const cylLen = fuseL * (variant === 'fighter' ? 0.66 : 0.56);
  const noseLen = fuseL * 0.16;
  const tailLen = fuseL * (variant === 'fighter' ? 0.2 : 0.3);
  const wingSpan = Math.max(d * 1.9, w * 0.52);
  const halfSpan = wingSpan / 2;
  const wingChord = variant === 'fighter' ? w * 0.17 : w * 0.12;
  const wingThick = Math.max(fuseR * 0.2, 0.5);
  const wingX = variant === 'fighter' ? -fuseL * 0.04 : fuseL * 0.03;
  const wingY = fuseY + fuseR * cfg.wingY;
  const sweepAng = Math.atan(cfg.sweep);
  const dihedral = variant === 'fighter' ? 0 : 0.07;
  const tailX = -fuseL * 0.42;
  const finH = variant === 'fighter' ? fuseR * 2.1 : fuseR * 2.4;
  const stabSpan = w * 0.3;
  const wheelR = fuseR * 0.3;

  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, adjRad, 0]}>
      {/* Gövde: orta silindir + burun konisi + kuyruk konisi */}
      <mesh position={[0, fuseY, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[fuseR, fuseR, cylLen, 20]} />
        <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.25} />
      </mesh>
      <mesh position={[cylLen / 2 + noseLen / 2, fuseY, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <coneGeometry args={[fuseR, noseLen, 20]} />
        <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.25} />
      </mesh>
      <mesh position={[-(cylLen / 2 + tailLen / 2), fuseY + fuseR * 0.12, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[fuseR * (variant === 'fighter' ? 0.16 : 0.3), fuseR, tailLen, 20]} />
        <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.25} />
      </mesh>

      {/* Kokpit */}
      {variant === 'fighter' ? (
        <mesh position={[fuseL * 0.24, fuseY + fuseR * 0.72, 0]} scale={[2.2, 0.75, 1.35]} castShadow>
          <sphereGeometry args={[fuseR * 0.62, 16, 12]} />
          <meshStandardMaterial color={cfg.dark} roughness={0.15} metalness={0.6} />
        </mesh>
      ) : (
        <mesh position={[fuseL * 0.26, fuseY + fuseR * 0.4, 0]} rotation={[0, 0, -0.18]} castShadow>
          <boxGeometry args={[fuseR * 0.6, fuseR * 0.55, fuseR * 1.85]} />
          <meshStandardMaterial color={cfg.dark} roughness={0.15} metalness={0.6} />
        </mesh>
      )}
      {/* Cabin window line */}
      {cfg.windows && (
        <mesh position={[-fuseL * 0.02, fuseY + fuseR * 0.28, 0]}>
          <boxGeometry args={[fuseL * 0.42, fuseR * 0.14, fuseR * 2.02]} />
          <meshStandardMaterial color={cfg.dark} roughness={0.3} />
        </mesh>
      )}

      {/* Wings (swept + dihedral) */}
      {[-1, 1].map((sgn) => (
        <group key={`wg${sgn}`} position={[wingX, wingY, sgn * fuseR * 0.7]} rotation={[-sgn * dihedral, -sgn * sweepAng, 0]}>
          <mesh position={[0, 0, sgn * halfSpan * 0.48]} castShadow>
            <boxGeometry args={[wingChord, wingThick, halfSpan * 0.94]} />
            <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.2} />
          </mesh>
          {cfg.winglet && (
            <mesh position={[wingChord * 0.1, wingThick * 1.6, sgn * halfSpan * 0.94]} castShadow>
              <boxGeometry args={[wingChord * 0.45, wingThick * 3.2, wingChord * 0.16]} />
              <meshStandardMaterial color={cfg.accent} roughness={0.4} />
            </mesh>
          )}
        </group>
      ))}

      {/* Engines */}
      {variant === 'airliner' && [-1, 1].map((sgn) => (
        <group key={`eng${sgn}`} position={[wingX + wingChord * 0.15, wingY - fuseR * 0.85, sgn * halfSpan * 0.42]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[fuseR * 0.42, fuseR * 0.36, fuseR * 1.5, 16]} />
            <meshStandardMaterial color={cfg.metal} roughness={0.35} metalness={0.55} />
          </mesh>
          <mesh position={[fuseR * 0.76, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[fuseR * 0.34, fuseR * 0.34, fuseR * 0.1, 16]} />
            <meshStandardMaterial color={cfg.dark} roughness={0.4} />
          </mesh>
          <mesh position={[-fuseR * 0.2, fuseR * 0.5, 0]}>
            <boxGeometry args={[fuseR * 0.5, fuseR * 0.6, fuseR * 0.24]} />
            <meshStandardMaterial color={bodyColor} />
          </mesh>
        </group>
      ))}
      {variant === 'business' && [-1, 1].map((sgn) => (
        <mesh key={`beng${sgn}`} position={[tailX + fuseL * 0.16, fuseY + fuseR * 0.3, sgn * fuseR * 1.15]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[fuseR * 0.36, fuseR * 0.3, fuseR * 1.2, 16]} />
          <meshStandardMaterial color={cfg.metal} roughness={0.35} metalness={0.55} />
        </mesh>
      ))}
      {variant === 'fighter' && (
        <mesh position={[-(cylLen / 2 + tailLen) - 0.2, fuseY + fuseR * 0.15, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[fuseR * 0.55, fuseR * 0.34, fuseR * 0.7, 16]} />
          <meshStandardMaterial color={cfg.dark} roughness={0.3} metalness={0.7} />
        </mesh>
      )}
      {variant === 'cessna' && (
        <group position={[cylLen / 2 + noseLen + 0.4, fuseY, 0]}>
          <mesh rotation={[0, 0, -Math.PI / 2]} castShadow>
            <coneGeometry args={[fuseR * 0.2, fuseR * 0.4, 12]} />
            <meshStandardMaterial color={cfg.metal} metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh castShadow>
            <boxGeometry args={[fuseR * 0.1, fuseR * 2.6, fuseR * 0.3]} />
            <meshStandardMaterial color={cfg.dark} roughness={0.4} />
          </mesh>
        </group>
      )}

      {/* Tail fin + horizontal stabilizer */}
      <mesh position={[tailX, fuseY + fuseR + finH / 2, 0]} rotation={[0, 0, variant === 'fighter' ? 0.25 : 0.18]} castShadow>
        <boxGeometry args={[fuseL * 0.13, finH, fuseR * 0.16]} />
        <meshStandardMaterial color={cfg.accent} roughness={0.4} />
      </mesh>
      {(variant === 'business' ? [fuseY + fuseR + finH] : [fuseY + fuseR * 0.3]).map((sy, si) => (
        <group key={`stab${si}`} position={[tailX - fuseL * 0.02, sy, 0]}>
          {[-1, 1].map((sgn) => (
            <mesh key={sgn} position={[0, 0, sgn * stabSpan * 0.26]} castShadow>
              <boxGeometry args={[fuseL * 0.1, wingThick * 0.8, stabSpan * 0.5]} />
              <meshStandardMaterial color={bodyColor} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Landing gear */}
      {[[fuseL * 0.3, 0, 0.8], [-fuseL * 0.06, fuseR * 0.8, 1], [-fuseL * 0.06, -fuseR * 0.8, 1]].map(([gx, gz, wr], gi) => (
        <group key={`gear${gi}`} position={[gx, 0, gz]}>
          <mesh position={[0, fuseY / 2, 0]}>
            <cylinderGeometry args={[fuseR * 0.07, fuseR * 0.07, fuseY, 8]} />
            <meshStandardMaterial color={cfg.dark} roughness={0.5} />
          </mesh>
          <mesh position={[0, wheelR * wr, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[wheelR * wr, wheelR * wr, fuseR * 0.18, 14]} />
            <meshStandardMaterial color="#1c1c1c" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const Helicopter3D = ({ x, y, width, height, rad, attack, fill, zOffset }: any) => {
  const isVert = height > width;
  const w = isVert ? height : width;
  const d = isVert ? width : height;
  const adjRad = isVert ? rad - Math.PI / 2 : rad;
  const bodyColor = fill && fill !== '#000000' ? fill : (attack ? '#5c6650' : '#e8eef0');
  const dark = '#263238';

  const bodyL = w * 0.42;
  const bodyH = d * 0.46;
  const bodyW = d * 0.4;
  const gc = d * 0.12 + 1;
  const bodyY = gc + bodyH / 2;
  const bodyX = bodyL * 0.18;
  const boomL = w * 0.5;
  const boomX = bodyX - bodyL / 2 - boomL / 2 + bodyL * 0.1;
  const mastH = bodyH * 0.32;
  const bladeLen = w * 0.95;
  const wheelR = Math.max(d * 0.055, 1.2);

  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, adjRad, 0]}>
      {/* Cabin */}
      <mesh position={[bodyX, bodyY, 0]} castShadow receiveShadow>
        <boxGeometry args={[bodyL, bodyH, bodyW]} />
        <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Nose */}
      <mesh position={[bodyX + bodyL / 2, bodyY - bodyH * 0.05, 0]} scale={[0.75, 0.8, 0.92]} castShadow>
        <sphereGeometry args={[bodyH * 0.5, 16, 12]} />
        <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Cockpit glass */}
      {attack ? (
        [0.32, 0.05].map((_off, i) => (
          <mesh key={i} position={[bodyX + bodyL * (0.3 - i * 0.22), bodyY + bodyH * (0.3 - i * 0.08), 0]} scale={[0.9, 0.55, 0.8]}>
            <sphereGeometry args={[bodyH * 0.42, 14, 10]} />
            <meshStandardMaterial color={dark} roughness={0.15} metalness={0.6} />
          </mesh>
        ))
      ) : (
        <mesh position={[bodyX + bodyL * 0.4, bodyY + bodyH * 0.3, 0]} scale={[0.62, 0.55, 0.82]}>
          <sphereGeometry args={[bodyH * 0.5, 14, 10]} />
          <meshStandardMaterial color={dark} roughness={0.15} metalness={0.6} />
        </mesh>
      )}
      {/* Tail boom + fin */}
      <mesh position={[boomX, bodyY + bodyH * 0.12, 0]} rotation={[0, 0, -0.05]} castShadow>
        <boxGeometry args={[boomL, bodyH * 0.2, bodyW * 0.26]} />
        <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[boomX - boomL / 2 + bodyH * 0.08, bodyY + bodyH * 0.38, 0]} rotation={[0, 0, -0.28]} castShadow>
        <boxGeometry args={[bodyH * 0.12, bodyH * 0.62, bodyW * 0.16]} />
        <meshStandardMaterial color={bodyColor} roughness={0.4} />
      </mesh>
      {/* Tail rotor */}
      <group position={[boomX - boomL / 2 + bodyH * 0.1, bodyY + bodyH * 0.34, bodyW * 0.16]}>
        <mesh>
          <boxGeometry args={[bodyH * 0.04, bodyH * 0.5, bodyH * 0.04]} />
          <meshStandardMaterial color={dark} roughness={0.5} />
        </mesh>
        <mesh>
          <boxGeometry args={[bodyH * 0.5, bodyH * 0.04, bodyH * 0.04]} />
          <meshStandardMaterial color={dark} roughness={0.5} />
        </mesh>
      </group>
      {/* Main rotor */}
      <group position={[bodyX + bodyL * 0.05, 0, 0]}>
        <mesh position={[0, bodyY + bodyH / 2 + mastH / 2, 0]}>
          <cylinderGeometry args={[bodyH * 0.05, bodyH * 0.06, mastH, 10]} />
          <meshStandardMaterial color={dark} roughness={0.5} />
        </mesh>
        <mesh position={[0, bodyY + bodyH / 2 + mastH, 0]} castShadow>
          <boxGeometry args={[bladeLen, bodyH * 0.035, bodyW * 0.14]} />
          <meshStandardMaterial color={dark} roughness={0.5} />
        </mesh>
        <mesh position={[0, bodyY + bodyH / 2 + mastH, 0]} castShadow>
          <boxGeometry args={[bodyW * 0.14, bodyH * 0.035, bladeLen]} />
          <meshStandardMaterial color={dark} roughness={0.5} />
        </mesh>
      </group>
      {/* ATAK: stub wings + weapon pods */}
      {attack && (
        <group position={[bodyX - bodyL * 0.05, bodyY, 0]}>
          <mesh castShadow>
            <boxGeometry args={[bodyL * 0.22, bodyH * 0.08, bodyW * 1.5]} />
            <meshStandardMaterial color={bodyColor} roughness={0.4} />
          </mesh>
          {[-1, 1].map((sgn) => (
            <mesh key={sgn} position={[0, -bodyH * 0.1, sgn * bodyW * 0.75]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[bodyH * 0.09, bodyH * 0.09, bodyL * 0.24, 10]} />
              <meshStandardMaterial color={dark} roughness={0.4} />
            </mesh>
          ))}
        </group>
      )}
      {/* Wheels */}
      {[[bodyX + bodyL * 0.32, 0, 0.9], [bodyX - bodyL * 0.25, bodyW * 0.34, 1], [bodyX - bodyL * 0.25, -bodyW * 0.34, 1]].map(([wx, wz, wr], wi) => (
        <group key={`wh${wi}`} position={[wx, 0, wz]}>
          <mesh position={[0, gc * 0.55, 0]}>
            <cylinderGeometry args={[bodyH * 0.03, bodyH * 0.03, gc, 8]} />
            <meshStandardMaterial color={dark} roughness={0.5} />
          </mesh>
          <mesh position={[0, wheelR * wr, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[wheelR * wr, wheelR * wr, wheelR * 0.6, 12]} />
            <meshStandardMaterial color="#1c1c1c" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const Balloon3D = ({ x, y, width, height, rad, fill, zOffset }: any) => {
  const w = width;
  const d = height;
  const adjRad = rad;
  const envR = Math.min(w * 0.44, d * 0.34);
  const envColor = fill && fill !== '#000000' ? fill : '#d9534f';

  const basketW = w * 0.28;
  const basketH = d * 0.1;
  const ropeGap = d * 0.13;
  const envY = basketH + ropeGap + envR * 1.12;

  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, adjRad, 0]}>
      {/* Envelope */}
      <mesh position={[0, envY, 0]} scale={[1, 1.12, 1]} castShadow>
        <sphereGeometry args={[envR, 22, 18]} />
        <meshStandardMaterial color={envColor} roughness={0.6} />
      </mesh>
      {/* Equator stripes */}
      {[0.35, -0.25].map((k, i) => (
        <mesh key={i} position={[0, envY + envR * 1.12 * k, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[envR * Math.sqrt(Math.max(0.05, 1 - k * k * 1.25)), envR * 0.045, 10, 28]} />
          <meshStandardMaterial color="#f4f0e6" roughness={0.6} />
        </mesh>
      ))}
      {/* Skirt */}
      <mesh position={[0, envY - envR * 1.12 - envR * 0.1, 0]} castShadow>
        <coneGeometry args={[envR * 0.34, envR * 0.26, 14]} />
        <meshStandardMaterial color="#8d3b32" roughness={0.7} />
      </mesh>
      {/* Burner frame */}
      <mesh position={[0, basketH + ropeGap * 0.45, 0]}>
        <cylinderGeometry args={[basketW * 0.16, basketW * 0.16, ropeGap * 0.5, 10]} />
        <meshStandardMaterial color="#37474f" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Ropes */}
      {[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * basketW * 0.38, basketH + ropeGap / 2, sz * basketW * 0.38]} rotation={[sz * 0.18, 0, -sx * 0.18]}>
          <cylinderGeometry args={[0.14, 0.14, ropeGap, 6]} />
          <meshStandardMaterial color="#5d4a36" roughness={0.9} />
        </mesh>
      ))}
      {/* Wicker basket */}
      <mesh position={[0, basketH / 2, 0]} castShadow>
        <boxGeometry args={[basketW, basketH, basketW]} />
        <meshStandardMaterial color="#8d6e4a" roughness={0.95} />
      </mesh>
      <mesh position={[0, basketH + 0.15, 0]}>
        <boxGeometry args={[basketW * 1.12, 0.3, basketW * 1.12]} />
        <meshStandardMaterial color="#6d543a" roughness={0.95} />
      </mesh>
    </group>
  );
};

const Boat3D = ({ x, y, width, height, rad, variant, fill, zOffset }: any) => {
  const isVert = height > width;
  const w = isVert ? height : width;   // tekne boyu (X)
  const d = isVert ? width : height;
  const adjRad = isVert ? rad - Math.PI / 2 : rad;

  const hullColor = fill && fill !== '#000000' ? fill : (variant === 'rowboat' ? '#b3906b' : variant === 'motorboat' ? '#e9eef2' : '#e4572e');
  const hullH = variant === 'jetski' ? d * 0.24 : d * 0.3;
  const beam = Math.max(d * (variant === 'jetski' ? 0.34 : 0.42), w * 0.1);

  const hullShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-w * 0.48, 0);
    s.lineTo(w * 0.3, 0);
    s.quadraticCurveTo(w * 0.44, 0.02, w * 0.48, hullH * 0.72);
    s.lineTo(w * 0.48, hullH);
    s.quadraticCurveTo(w * 0.12, hullH * 0.58, -w * 0.48, hullH * 0.52);
    s.lineTo(-w * 0.48, 0);
    return s;
  }, [w, hullH]);

  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, adjRad, 0]}>
      {/* Hull (side profile extruded along Z) */}
      <group position={[0, 0, -beam / 2]}>
        <mesh castShadow receiveShadow>
          <extrudeGeometry args={[hullShape, { depth: beam, bevelEnabled: true, bevelSize: Math.min(0.8, beam * 0.06), bevelThickness: Math.min(0.8, beam * 0.06), bevelSegments: 3, steps: 1 }]} />
          <meshStandardMaterial color={hullColor} roughness={0.55} metalness={0.15} />
        </mesh>
      </group>
      {/* Interior floor line */}
      <mesh position={[w * 0.02, hullH * 0.42, 0]}>
        <boxGeometry args={[w * 0.62, 0.25, beam * 0.78]} />
        <meshStandardMaterial color={variant === 'rowboat' ? '#8a6d4f' : '#37474f'} roughness={0.85} />
      </mesh>

      {variant === 'rowboat' && (
        <group>
          {[-w * 0.24, 0, w * 0.2].map((bx, i) => (
            <mesh key={i} position={[bx, hullH * 0.52, 0]} castShadow>
              <boxGeometry args={[w * 0.045, hullH * 0.09, beam * 0.88]} />
              <meshStandardMaterial color="#9c7a55" roughness={0.9} />
            </mesh>
          ))}
          {[-1, 1].map((sgn) => (
            <mesh key={`oar${sgn}`} position={[w * 0.08, hullH * 0.55, sgn * beam * 0.62]} rotation={[0, sgn * -0.35, sgn * 1.42]} castShadow>
              <cylinderGeometry args={[0.3, 0.42, w * 0.52, 8]} />
              <meshStandardMaterial color="#a1887f" roughness={0.9} />
            </mesh>
          ))}
        </group>
      )}

      {variant === 'motorboat' && (
        <group position={[-w * 0.5 - w * 0.02, 0, 0]}>
          <mesh position={[0, hullH * 0.72, 0]} castShadow>
            <boxGeometry args={[w * 0.07, hullH * 0.42, beam * 0.22]} />
            <meshStandardMaterial color="#37474f" roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh position={[0, hullH * 0.34, 0]}>
            <cylinderGeometry args={[0.22, 0.22, hullH * 0.5, 8]} />
            <meshStandardMaterial color="#455a64" roughness={0.5} metalness={0.4} />
          </mesh>
          {/* Windshield */}
          <mesh position={[w * 0.3, hullH * 0.78, 0]} rotation={[0, 0, -0.5]} castShadow>
            <boxGeometry args={[w * 0.1, hullH * 0.32, beam * 0.7]} />
            <meshStandardMaterial color="#263238" roughness={0.15} metalness={0.6} />
          </mesh>
        </group>
      )}

      {variant === 'jetski' && (
        <group>
          <mesh position={[-w * 0.12, hullH * 0.95, 0]} castShadow>
            <boxGeometry args={[w * 0.36, hullH * 0.55, beam * 0.52]} />
            <meshStandardMaterial color="#2b2f33" roughness={0.6} />
          </mesh>
          <mesh position={[w * 0.2, hullH * 1.05, 0]} rotation={[0, 0, -0.25]} castShadow>
            <boxGeometry args={[w * 0.14, hullH * 0.5, beam * 0.5]} />
            <meshStandardMaterial color="#2b2f33" roughness={0.5} />
          </mesh>
          <mesh position={[w * 0.26, hullH * 1.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.22, 0.22, beam * 0.56, 8]} />
            <meshStandardMaterial color="#455a64" roughness={0.4} metalness={0.5} />
          </mesh>
        </group>
      )}
    </group>
  );
};

const Tree3D = ({ x, y, width, height, rad, type, zOffset }: any) => {
  const isConiferous = type.includes('tree-2') || type.includes('pine') || type.includes('çam') || type.includes('coniferous');
  const size = Math.max(width, height);
  const trunkH = size * 0.4 * SCALE;
  const trunkR = size * 0.08 * SCALE;
  const canopyH = size * 1.2 * SCALE;
  const canopyR = size * 0.5 * SCALE;

  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, rad, 0]}>
      <mesh position={[0, trunkH / 2, 0]} castShadow>
        <cylinderGeometry args={[trunkR, trunkR * 1.2, trunkH, 8]} />
        <meshStandardMaterial color="#5c4033" roughness={0.9} />
      </mesh>
      {isConiferous ? (
        <group position={[0, trunkH, 0]}>
          {[0, 1, 2].map((level) => {
            const levelR = canopyR * (1 - level * 0.25);
            const levelH = canopyH * 0.4;
            const levelY = level * levelH * 0.6 + levelH / 2;
            return (
              <mesh key={level} position={[0, levelY, 0]} castShadow>
                <coneGeometry args={[levelR, levelH, 8]} />
                <meshStandardMaterial color="#1b4d3e" roughness={0.8} />
              </mesh>
            );
          })}
        </group>
      ) : (
        <mesh position={[0, trunkH + canopyR * 0.8, 0]} castShadow>
          <sphereGeometry args={[canopyR, 12, 12]} />
          <meshStandardMaterial color="#2d7f34" roughness={0.8} />
        </mesh>
      )}
    </group>
  );
};

const TrafficCone3D = ({ x, y, zOffset }: any) => {
  const baseSize = 25 * SCALE;
  const baseH = 2 * SCALE;
  const coneH = 45 * SCALE;

  return (
    <group position={[x, zOffset || 0, y]}>
      <mesh position={[0, baseH / 2, 0]} castShadow>
        <boxGeometry args={[baseSize, baseH, baseSize]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      <mesh position={[0, baseH + coneH / 4, 0]} castShadow>
        <coneGeometry args={[7 * SCALE, coneH / 2, 16]} />
        <meshStandardMaterial color="#ff4500" roughness={0.6} />
      </mesh>
      <mesh position={[0, baseH + coneH * 0.6, 0]}>
        <coneGeometry args={[4.5 * SCALE, coneH * 0.2, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
      </mesh>
      <mesh position={[0, baseH + coneH * 0.85, 0]}>
        <coneGeometry args={[2.5 * SCALE, coneH * 0.3, 16]} />
        <meshStandardMaterial color="#ff4500" roughness={0.6} />
      </mesh>
    </group>
  );
};

const SecurityBarrier3D = ({ x, y, width, rad, zOffset }: any) => {
  const w = width;
  const h = 80 * SCALE;
  const barH = 15 * SCALE;
  const legT = 3 * SCALE;

  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, rad, 0]}>
      <mesh position={[-w / 2.2, h / 2, 0]} castShadow>
        <boxGeometry args={[legT, h, legT]} />
        <meshStandardMaterial color="#7f8c8d" metalness={0.8} />
      </mesh>
      <mesh position={[-w / 2.2, legT / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[legT * 1.2, legT, 30 * SCALE]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      <mesh position={[w / 2.2, h / 2, 0]} castShadow>
        <boxGeometry args={[legT, h, legT]} />
        <meshStandardMaterial color="#7f8c8d" metalness={0.8} />
      </mesh>
      <mesh position={[w / 2.2, legT / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[legT * 1.2, legT, 30 * SCALE]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      <mesh position={[0, h * 0.8, 0]} castShadow>
        <boxGeometry args={[w, barH, 2.5 * SCALE]} />
        <meshStandardMaterial color="#ffcc00" roughness={0.5} />
      </mesh>
      {[-0.3, -0.1, 0.1, 0.3].map((pos, idx) => (
        <mesh key={idx} position={[w * pos, h * 0.8, 1.35 * SCALE]}>
          <boxGeometry args={[w * 0.08, barH * 0.98, 0.1 * SCALE]} />
          <meshBasicMaterial color="#cc0000" />
        </mesh>
      ))}
    </group>
  );
};

const FireHydrant3D = ({ x, y, zOffset }: any) => {
  const bodyH = 60 * SCALE;
  const bodyR = 10 * SCALE;

  return (
    <group position={[x, zOffset || 0, y]}>
      <mesh position={[0, bodyH / 2, 0]} castShadow>
        <cylinderGeometry args={[bodyR, bodyR * 1.1, bodyH, 16]} />
        <meshStandardMaterial color="#cc0000" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, bodyH + 3 * SCALE, 0]}>
        <sphereGeometry args={[bodyR * 1.05, 16, 8]} />
        <meshStandardMaterial color="#cc0000" metalness={0.5} />
      </mesh>
      <mesh position={[0, bodyH * 0.6, bodyR * 0.8]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[4 * SCALE, 4 * SCALE, 8 * SCALE, 12]} />
        <meshStandardMaterial color="#bdc3c7" metalness={0.9} />
      </mesh>
      <mesh position={[bodyR * 0.8, bodyH * 0.6, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[3 * SCALE, 3 * SCALE, 8 * SCALE, 12]} />
        <meshStandardMaterial color="#bdc3c7" metalness={0.9} />
      </mesh>
      <mesh position={[-bodyR * 0.8, bodyH * 0.6, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[3 * SCALE, 3 * SCALE, 8 * SCALE, 12]} />
        <meshStandardMaterial color="#bdc3c7" metalness={0.9} />
      </mesh>
    </group>
  );
};

const UtilityPole3D = ({ x, y, zOffset }: any) => {
  const h = 350 * SCALE;
  const poleR = 6 * SCALE;

  return (
    <group position={[x, zOffset || 0, y]}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[poleR * 0.7, poleR, h, 12]} />
        <meshStandardMaterial color="#4a4030" roughness={0.9} />
      </mesh>
      <mesh position={[0, h - 20 * SCALE, 0]}>
        <boxGeometry args={[80 * SCALE, 6 * SCALE, 6 * SCALE]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0, h - 45 * SCALE, 0]}>
        <boxGeometry args={[60 * SCALE, 5 * SCALE, 5 * SCALE]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {[-30, 30].map((px, idx) => (
        <mesh key={idx} position={[px * SCALE, h - 16 * SCALE, 0]}>
          <cylinderGeometry args={[2.5 * SCALE, 2.5 * SCALE, 5 * SCALE, 8]} />
          <meshStandardMaterial color="#e0f7fa" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
    </group>
  );
};

const Bench3D = ({ x, y, width, height, rad, zOffset }: any) => {
  const w = width;
  const d = height;
  const seatH = 45 * SCALE;
  const legT = 3 * SCALE;
  const backH = 80 * SCALE;

  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, rad, 0]}>
      {[0.2, 0.5, 0.8].map((pos, idx) => (
        <mesh key={idx} position={[0, seatH, -d / 2 + d * pos]} castShadow>
          <boxGeometry args={[w, 2 * SCALE, d * 0.2]} />
          <meshStandardMaterial color="#8b5a2b" roughness={0.8} />
        </mesh>
      ))}
      {[0.7, 0.9].map((pos, idx) => (
        <mesh key={idx} position={[0, backH * pos, -d / 2 + 1 * SCALE]} castShadow>
          <boxGeometry args={[w, backH * 0.15, 2 * SCALE]} />
          <meshStandardMaterial color="#8b5a2b" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[-w / 2.1, seatH / 2, 0]}>
        <boxGeometry args={[legT, seatH, d * 0.95]} />
        <meshStandardMaterial color="#2c3e50" metalness={0.8} />
      </mesh>
      <mesh position={[-w / 2.1, backH * 0.6, -d / 2 + 1 * SCALE]}>
        <boxGeometry args={[legT, backH * 0.8, legT]} />
        <meshStandardMaterial color="#2c3e50" metalness={0.8} />
      </mesh>
      <mesh position={[w / 2.1, seatH / 2, 0]}>
        <boxGeometry args={[legT, seatH, d * 0.95]} />
        <meshStandardMaterial color="#2c3e50" metalness={0.8} />
      </mesh>
      <mesh position={[w / 2.1, backH * 0.6, -d / 2 + 1 * SCALE]}>
        <boxGeometry args={[legT, backH * 0.8, legT]} />
        <meshStandardMaterial color="#2c3e50" metalness={0.8} />
      </mesh>
    </group>
  );
};

const TrafficSign3D = ({ x, y, width, height, rad, type, textureSrc, zOffset }: any) => {
  const poleH = 200 * SCALE;
  const poleR = 2 * SCALE;
  const signSize = Math.max(width, height) * 1.2;
  const tMain = useTexture(textureSrc) as THREE.Texture;

  const isStop = type.includes('stop');
  const isYield = type.includes('yield');

  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, rad, 0]}>
      <mesh position={[0, poleH / 2, 0]} castShadow>
        <cylinderGeometry args={[poleR, poleR, poleH, 8]} />
        <meshStandardMaterial color="#95a5a6" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {isStop ? (
        <mesh position={[0, poleH + signSize / 2, -0.2 * SCALE]} rotation={[0, 0, Math.PI / 8]}>
          <cylinderGeometry args={[signSize / 2, signSize / 2, 0.4 * SCALE, 8]} />
          <meshStandardMaterial color="#7f8c8d" metalness={0.9} roughness={0.1} />
        </mesh>
      ) : isYield ? (
        <mesh position={[0, poleH + signSize / 2, -0.2 * SCALE]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[signSize / 2, signSize, 3]} />
          <meshStandardMaterial color="#7f8c8d" metalness={0.9} roughness={0.1} />
        </mesh>
      ) : (
        <mesh position={[0, poleH + signSize / 2, -0.2 * SCALE]}>
          <planeGeometry args={[signSize, signSize]} />
          <meshStandardMaterial color="#7f8c8d" metalness={0.9} roughness={0.1} />
        </mesh>
      )}

      <mesh position={[0, poleH + signSize / 2, 0]}>
        <planeGeometry args={[signSize * 0.98, signSize * 0.98]} />
        <meshBasicMaterial map={tMain} transparent alphaTest={0.05} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

const InteractiveSymbol = React.memo(({ obj, onSelect, isSelected, stageWidth, stageHeight, wallThickness, wallHOpt, allWalls, visualObjects, uploadedImages }: any) => {
  const { updateObject } = useStore();
  const groupRef = useRef<THREE.Group>(null!);

  const handleTransform = (e: any) => {
    if (!e || !e.target || !isSelected) return;
    const { position, rotation } = e.target.object;
    e.target.object.rotation.set(0, rotation.y, 0); // No slant
    
    const deg = (-rotation.y * (180 / Math.PI) + 360) % 360;
    const cx = (position.x / SCALE) + stageWidth / 2;
    const cy = (position.z / SCALE) + stageHeight / 2;
    const czHeight = (position.y / SCALE); // Convert 3D Y to cm
    
    const w = (obj.width || 0) * (obj.scaleX || 1);
    const h = (obj.height || 0) * (obj.scaleY || 1);
    const rad = deg * (Math.PI / 180);

    updateObject(obj.id, { 
      x: cx - (w / 2) * Math.cos(rad) + (h / 2) * Math.sin(rad), 
      y: cy - (w / 2) * Math.sin(rad) - (h / 2) * Math.cos(rad), 
      rotation: deg,
      zHeight: Math.round(czHeight)
    });
  };

  return (
    <>
      {isSelected && <TransformControls object={groupRef} mode="translate" onMouseUp={handleTransform} makeDefault />}
      <group ref={groupRef} position={[obj.x, 0, obj.y]} rotation={[0, -(obj.rotation || 0) * (Math.PI / 180), 0]}>
        <group onPointerDown={(e) => { e.stopPropagation(); onSelect(obj.id); }}>
          <Symbol3D obj={{...obj, x: 0, y: 0, rotation: 0, updateObject}} realObj={{ ...obj, hCap: wallHOpt }} wallThickness={wallThickness} allWalls={allWalls} visualObjects={visualObjects} uploadedImages={uploadedImages} stageWidth={stageWidth} stageHeight={stageHeight} />
        </group>
      </group>
    </>
  );
});


const SceneCaptureController = ({ onCaptureRef }: { onCaptureRef: React.MutableRefObject<any> }) => {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    (window as any).export3DScene = () => {
      const exporter = new GLTFExporter();
      exporter.parse(scene, (result: any) => {
        const output = result instanceof ArrayBuffer ? result : JSON.stringify(result);
        const blob = new Blob([output], { type: result instanceof ArrayBuffer ? 'model/gltf-binary' : 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = url;
        link.download = 'olay-yeri-3d-model.glb';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, { binary: true });
    };

    // DEV: sahne/kamera teşhisi (tarayıcı konsolundan inceleme için)
    if (import.meta.env.DEV) {
      (window as any).__scene3d = { scene, camera, THREE };
    }

    onCaptureRef.current = {
      takeScreenshot: () => {
        gl.render(scene, camera);
        return gl.domElement.toDataURL('image/png', 1.0);
      },
      getCanvasElement: () => {
        return gl.domElement;
      }
    };
  }, [gl, scene, camera, onCaptureRef]);

  return null;
};

const Scene = ({ objects, viewMode, selectedId, setSelectedId, onCaptureRef }: any) => {
  const { visualSettings, canvasOrientation, uploadedImages } = useStore();
  const stageWidth = canvasOrientation === 'landscape' ? 1400 : 1000;
  const stageHeight = canvasOrientation === 'landscape' ? 1000 : 1400;

  const toLocal = (obj: any, wall: any, scale: number) => {
    const dx = (obj.cx - wall.cx) * scale;
    const dy = (obj.cy - wall.cy) * scale;
    // Kanonik duvar ekseni: dikey duvarlar (w1v/w1vi) +90° döndürülmüş kabul edilir
    const r = ((wall.wallRot !== undefined ? wall.wallRot : (wall.rotation || 0))) * (Math.PI / 180);
    return {
      x: dx * Math.cos(-r) - dy * Math.sin(-r),
      y: dx * Math.sin(-r) + dy * Math.cos(-r)
    };
  };

  const fromLocal = (lx: number, ly: number, wall: any, centerX: number, centerY: number, scale: number) => {
    const r = ((wall.wallRot !== undefined ? wall.wallRot : (wall.rotation || 0))) * (Math.PI / 180);
    const wX = (wall.cx - centerX) * scale;
    const wY = (wall.cy - centerY) * scale;
    return {
      x: wX + lx * Math.cos(r) - ly * Math.sin(r),
      z: wY + lx * Math.sin(r) + ly * Math.cos(r)
    };
  };

  const { visualObjects, allWalls, wallThickness, wallHOpt } = useMemo(() => {
    const scale = SCALE;
    const thickness = ((visualSettings as any)?.wallThickness || 10) * scale;
    // Kuşbakışı kesit (cutaway): orbit modunda duvar yüksekliği kullanıcı seçimi;
    // yürüme modunda her zaman tam yükseklik (gerçekçi mekân deneyimi).
    const wallHOpt = viewMode === 'walk' ? 250 : (Number((visualSettings as any)?.wallHeight3D) || 250);
    
    // Fixed Origin for Absolute Parity: Anchor to stage center to prevent drift
    const centerX = stageWidth / 2;
    const centerY = stageHeight / 2;

    // 2B kağıt/form/ölçü nesneleri ve gizli nesneler 3B sahneye alınmaz
    const renderable = (objects || []).filter((o: Non3DCheckable) => !isNon3DObject(o));

    const objectsWithCenters = renderable.map((o: any) => {
      const sId = o.symbolId?.toLowerCase() || '';
      const isTraj = sId.includes('shooting') || sId.includes('atış') || sId.includes('ateş');
      const { width: w, height: h } = getEffectiveSize(o);
      const r = (o.rotation || 0) * (Math.PI / 180);
      const cx = o.x + (w / 2) * Math.cos(r) - (h / 2) * Math.sin(r);
      const cy = o.y + (w / 2) * Math.sin(r) + (h / 2) * Math.cos(r);

      let extraProps = {};
      if (isTraj) {
        let sX = o.startX;
        let sY = o.startY;
        let eX = o.endX;
        let eY = o.endY;
        const pts = o.points || o.attrs?.points;
        if (sX === undefined && pts && pts.length >= 4) { sX = pts[0]; sY = pts[1]; eX = pts[2]; eY = pts[3]; }
        
        // Match CanvasArea.tsx individual coordinate defaults
        if (sX === undefined) sX = 0;
        if (sY === undefined) sY = 150;
        if (eX === undefined) eX = 150;
        if (eY === undefined) eY = 0;

        sX = Number(sX); sY = Number(sY); eX = Number(eX); eY = Number(eY);
        if (isNaN(sX)) sX = 0; if (isNaN(sY)) sY = 150; if (isNaN(eX)) eX = 150; if (isNaN(eY)) eY = 0;
        const w2Sx = o.x + (sX * Math.cos(r) - sY * Math.sin(r));
        const w2Sy = o.y + (sX * Math.sin(r) + sY * Math.cos(r));
        const w2Ex = o.x + (eX * Math.cos(r) - eY * Math.sin(r));
        const w2Ey = o.y + (eX * Math.sin(r) + eY * Math.cos(r));
        extraProps = {
          wSx: (w2Sx - centerX) * scale, wSz: (w2Sy - centerY) * scale,
          wEx: (w2Ex - centerX) * scale, wEz: (w2Ey - centerY) * scale
        };
      }
      return { ...o, ...extraProps, cx, cy };
    });

    const roomWalls = objectsWithCenters.filter((o: any) => o.symbolId?.startsWith('arch-w1') || o.symbolId === 'arch-7' || o.symbolId === 'arch-w-square');
    const openings = objectsWithCenters.filter((o: any) => isDoor(o) || isWindow(o));
    const others = objectsWithCenters.filter((o: any) => !roomWalls.find((rw: any) => rw.id === o.id) && !openings.find((op: any) => op.id === o.id));

    const processedWalls: any[] = [];
    roomWalls.forEach((w: any) => {
      if (w.symbolId === 'arch-w-square') {
        const { width: wW, height: wH } = getEffectiveSize(w);
        const r = (w.rotation || 0) * (Math.PI / 180);
        const rotate = (px: number, py: number) => ({
          x: w.x + px * Math.cos(r) - py * Math.sin(r),
          y: w.y + px * Math.sin(r) + py * Math.cos(r)
        });
        processedWalls.push({ ...w, id: `${w.id}-t`, cx: rotate(wW/2, 0).x, cy: rotate(wW/2, 0).y, width: wW + 10, height: 10, wallLen: wW + 10, rotation: w.rotation, wallRot: w.rotation, symbolId: 'arch-w1-fake' });
        processedWalls.push({ ...w, id: `${w.id}-b`, cx: rotate(wW/2, wH).x, cy: rotate(wW/2, wH).y, width: wW + 10, height: 10, wallLen: wW + 10, rotation: w.rotation, wallRot: w.rotation, symbolId: 'arch-w1-fake' });
        processedWalls.push({ ...w, id: `${w.id}-l`, cx: rotate(0, wH/2).x, cy: rotate(0, wH/2).y, width: wH + 10, height: 10, wallLen: wH + 10, rotation: w.rotation + 90, wallRot: w.rotation + 90, symbolId: 'arch-w1-fake' });
        processedWalls.push({ ...w, id: `${w.id}-r`, cx: rotate(wW, wH/2).x, cy: rotate(wW, wH/2).y, width: wH + 10, height: 10, wallLen: wH + 10, rotation: w.rotation + 90, wallRot: w.rotation + 90, symbolId: 'arch-w1-fake' });
      } else {
        // DİKEY DUVAR DÜZELTMESİ: 2B'de dikey duvarlar (arch-w1vi vb.) genişlik=8px,
        // yükseklik=duvar boyu olarak saklanır. 3B'de kutunun X boyutu "duvar boyu",
        // kalınlık ise ayrı tutulmalıdır. Etkin yükseklik > etkin genişlik ise duvar
        // dikeydir: boyu yükseklikten alınır ve 3B ekseni için +90° döndürülür.
        const { width: ww, height: wh } = getEffectiveSize(w);
        if (wh > ww) {
          processedWalls.push({ ...w, width: wh, height: ww, wallLen: wh, rotation: (w.rotation || 0) + 90, wallRot: (w.rotation || 0) + 90 });
        } else {
          processedWalls.push({ ...w, wallLen: ww, wallRot: w.rotation || 0 });
        }
      }
    });

    const openingsWithWalls = openings.map((op: any) => {
      let bestWallId = null;
      let minLY = 250;
      processedWalls.forEach((wall: any) => {
        const local = toLocal(op, wall, scale);
        const wWidth = (wall.wallLen ?? getEffectiveSize(wall).width) * scale;
        const wallRot = wall.wallRot !== undefined ? wall.wallRot : (wall.rotation || 0);
        const rotDiff = Math.abs(((wallRot) - (op.rotation || 0)) % 180);
        const rotationMatch = rotDiff < 20 || rotDiff > 160;
        if (rotationMatch && Math.abs(local.x) < (wWidth/2 + 20) && Math.abs(local.y) < minLY) {
          minLY = Math.abs(local.y);
          bestWallId = wall.id;
        }
      });
      return { ...op, bestWallId };
    });

    const finalWalls: any[] = [];
    processedWalls.forEach((wall: any) => {
      const wX = (wall.cx - centerX) * scale;
      const wY = (wall.cy - centerY) * scale;
      const wWidth = (wall.wallLen ?? getEffectiveSize(wall).width) * scale;
      const wHeight = thickness; 
      const wallRot = wall.wallRot !== undefined ? wall.wallRot : (wall.rotation || 0);
      const wRad = wallRot * (Math.PI / 180);
      const wallOpenings = openingsWithWalls.filter((op: any) => op.bestWallId === wall.id)
        .map((op: any) => {
          const local = toLocal(op, wall, scale);
          const { width: opWidthRaw } = getEffectiveSize(op);
          const isD = isDoor(op);
          // Kapı boşluğu 2B'deki gerçek kanat genişliğidir (eski davranıştaki 80px
          // zorlaması, kanattan geniş boşluklar açıyordu). Aşırı küçük değerlere karşı
          // 50px alt sınır koruması korunur.
          return { ...op, localX: local.x, localY: local.y, effectiveWidth: (isD ? Math.max(50, opWidthRaw) : opWidthRaw) * scale };
        })
        .sort((a: any, b: any) => a.localX - b.localX);

      if (wallOpenings.length === 0) {
        finalWalls.push({ ...wall, x: wX, y: wY, width: wWidth, height: wHeight, rotation: wallRot, h: wallHOpt, yOffset: 0 });
      } else {
        const wallH = wallHOpt;
        let currentX = -wWidth / 2;
        wallOpenings.forEach((op: any, idx: number) => {
          const opW = op.effectiveWidth;
          const gapStart = op.localX - opW / 2;
          const gapEnd = op.localX + opW / 2;
          if (gapStart > currentX + 0.1) {
            const segW = gapStart - currentX; 
            const segCenterX = currentX + segW / 2;
            finalWalls.push({ ...wall, id: `${wall.id}-seg-${idx}`, x: wX + segCenterX * Math.cos(wRad), y: wY + segCenterX * Math.sin(wRad), width: segW, height: wHeight, rotation: wallRot, h: wallH, yOffset: 0 });
          }
          const isD = isDoor(op);
          const rawZHeight = isD ? (op.zHeight || 210) : (op.zHeight || 120);
          const rawSillH = isD ? 0 : Math.max(0, 125 - rawZHeight / 2);
          const opWorldX = wX + op.localX * Math.cos(wRad);
          const opWorldY = wY + op.localX * Math.sin(wRad);
          
          if (rawSillH + rawZHeight < wallH - 1) {
            const lintH = wallH - (rawSillH + rawZHeight);
            const opH = rawZHeight * scale;
            const opSill = rawSillH * scale;
            finalWalls.push({ 
              ...wall, 
              id: `${wall.id}-lintel-${idx}`, 
              x: opWorldX, 
              y: opWorldY, 
              width: opW + 0.2, 
              height: wHeight, 
              rotation: wallRot, 
              h: lintH, 
              yOffset: opSill + opH 
            });
          }
          if (!isD && rawSillH > 1) {
            finalWalls.push({ 
              ...wall, 
              id: `${wall.id}-sill-${idx}`, 
              x: opWorldX, 
              y: opWorldY, 
              width: opW + 0.2, 
              height: wHeight, 
              rotation: wallRot, 
              h: rawSillH, 
              yOffset: 0 
            });
          }
          currentX = gapEnd;
        });
        if (currentX < wWidth / 2 - 0.1) {
          const segW = wWidth / 2 - currentX;
          const segCenterX = currentX + segW / 2;
          finalWalls.push({ ...wall, id: `${wall.id}-final`, x: wX + segCenterX * Math.cos(wRad), y: wY + segCenterX * Math.sin(wRad), width: segW, height: wHeight, rotation: wallRot, h: wallH, yOffset: 0 });
        }
      }
    });

    // --- DİKEY YÜZEY İZLERİ (pencere/duvara yapışan parmak izi vb.) ---
    // 2B'de pencere/duvar üzerine konulan parmak izi, kanlı el izi, eldiven izi ve
    // alet izi 3B'de zeminde DEĞİL, bulunduğu yüzeyin üzerinde dikey decal olarak
    // çizilir. Böyle bir izin yakınına konan bulgu numaratörü (ev-circle/ev-square)
    // de aynı yüzeye, izin yüksekliğine asılır — "penceredeki parmak izi + bulgu
    // numarası" 3B'de birlikte ve doğru yerde görünür.
    const VERTICAL_TRACE_IDS = new Set(['tr-3', 'tr-bloody-handprint', 'tr-glove-print', 'tr-tool-mark']);
    const TRACE_ATTACH_DIST = 35;   // cm — iz, yüzeyin üzerinde sayılma mesafesi
    const MARKER_LINK_DIST = 160;   // cm — numaratör, izin bu kadar yakınındaysa yüzeye asılır
    const surfaceTraceAttach = new Map<string, any>();
    others.forEach((o: any) => {
      const sIdL = o.symbolId?.toLowerCase() || '';
      if (!VERTICAL_TRACE_IDS.has(sIdL)) return;
      let best: any = null; let bestDist = Infinity; let bestIsWindow = false;
      openings.forEach((op: any) => {
        if (!isWindow(op)) return;
        const d = Math.hypot(o.cx - op.cx, o.cy - op.cy);
        if (d < bestDist) { bestDist = d; best = op; bestIsWindow = true; }
      });
      processedWalls.forEach((w: any) => {
        const d = Math.hypot(o.cx - w.cx, o.cy - w.cy);
        if (d < bestDist) { bestDist = d; best = w; bestIsWindow = false; }
      });
      if (!best || bestDist > TRACE_ATTACH_DIST) return;
      const rot = best.wallRot !== undefined ? best.wallRot : (best.rotation || 0);
      let zCm: number;
      if (bestIsWindow) {
        const wh = best.zHeight !== undefined ? best.zHeight : 120;
        const sill = best.sillH !== undefined ? best.sillH : Math.max(0, 125 - wh / 2);
        zCm = sill + wh / 2; // cam yüzeyinin dikey merkezi
      } else {
        zCm = 120;
      }
      if (o.zHeight !== undefined && o.zHeight > 5) zCm = o.zHeight; // kullanıcı yüksekliği önceliklidir
      zCm = Math.max(10, Math.min(zCm, wallHOpt - 5));
      // İz, yüzey ekseni üzerine projeksiyonlanır (cam/duvar düzleminde kalır)
      const local = toLocal(o, best, scale);
      const pos = fromLocal(local.x, 0, best, centerX, centerY, scale);
      const { width: refW } = getEffectiveSize(best);
      const { width: trW } = getEffectiveSize(o);
      surfaceTraceAttach.set(o.id, {
        rotation: rot, zHeight: zCm, x: pos.x, y: pos.z,
        ref: best, refHalfW: (refW * scale) / 2,
        traceLX: local.x, traceHalfW: (trW * scale) / 2
      });
    });

    // Bulgu numaratörleri: yakınında yüzeye yapışmış bir iz varsa aynı yüzeye,
    // izin yüksekliğine asılır; plaka iz decaliyle çakışmasın diye eksen boyunca kaydırılır
    const surfaceMarkerAttach = new Map<string, any>();
    if (surfaceTraceAttach.size > 0) {
      others.forEach((o: any) => {
        const sIdL = o.symbolId?.toLowerCase() || '';
        if (sIdL !== 'ev-circle' && sIdL !== 'ev-square') return;
        let bestAtt: any = null; let bestD = Infinity;
        others.forEach((t: any) => {
          const att = surfaceTraceAttach.get(t.id);
          if (!att) return;
          const d = Math.hypot(o.cx - t.cx, o.cy - t.cy);
          if (d < bestD) { bestD = d; bestAtt = att; }
        });
        if (!bestAtt || bestD > MARKER_LINK_DIST) return;
        const local = toLocal(o, bestAtt.ref, scale);
        const maxLX = Math.max(10 * scale, bestAtt.refHalfW - 8 * scale);
        let lx = Math.max(-maxLX, Math.min(local.x, maxLX));
        const { width: mW } = getEffectiveSize(o);
        const mHalfW = Math.max(mW * scale, 16 * scale) / 2;
        const clearW = bestAtt.traceHalfW + mHalfW + 1 * scale;
        if (Math.abs(lx - bestAtt.traceLX) < clearW) {
          const dir = lx >= bestAtt.traceLX ? 1 : -1;
          let cand = bestAtt.traceLX + dir * clearW;
          if (cand > maxLX || cand < -maxLX) cand = bestAtt.traceLX - dir * clearW;
          lx = Math.max(-maxLX, Math.min(cand, maxLX));
        }
        const pos = fromLocal(lx, 0, bestAtt.ref, centerX, centerY, scale);
        surfaceMarkerAttach.set(o.id, { ...bestAtt, x: pos.x, y: pos.z });
      });
    }

    // --- DIRECT 1:1 MIRROR MAPPING ---
    // Zero-physics, zero-drift positioning for absolute parity
    const resolvedObjects = [...others, ...openings].map((obj: any) => {
      const { width: effW, height: effH } = getEffectiveSize(obj);
      const isAperture = isDoor(obj) || isWindow(obj);

      const sIdL = obj.symbolId?.toLowerCase() || '';
      const isW = sIdL === 'in-bullet-in' || sIdL === 'in-bullet-out';
      const isI = sIdL === 'tr-bullet-glass' || sIdL === 'tr-bullet-wall';
      const isForensicDecal = isW || isI;

      if (isForensicDecal) {
        let closestTarget: any = null;
        let minDistance = Infinity;

        // A. Check mannequins from others
        others.forEach((o: any) => {
          const oIdL = o.symbolId?.toLowerCase() || '';
          const isHumanSrc = o.src && typeof o.src === 'string' && (o.src.includes('manken') || o.src.includes('human') || o.src.includes('person') || o.src.includes('p-1') || o.src.includes('p-2'));
          const isMannequin = oIdL.startsWith('p-') || isHumanSrc || oIdL === 'ev-human-poseable' || o.isMannequin;
          if (isMannequin) {
            const dx = obj.cx - o.cx;
            const dy = obj.cy - o.cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDistance) {
              minDistance = dist;
              closestTarget = { type: 'mannequin', ref: o };
            }
          }
        });

        // B. Check windows from openings
        openings.forEach((o: any) => {
          if (isWindow(o)) {
            const dx = obj.cx - o.cx;
            const dy = obj.cy - o.cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDistance) {
              minDistance = dist;
              closestTarget = { type: 'window', ref: o };
            }
          }
        });

        // C. Check walls
        processedWalls.forEach((w: any) => {
          const dx = obj.cx - w.cx;
          const dy = obj.cy - w.cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) {
            minDistance = dist;
            closestTarget = { type: 'wall', ref: w };
          }
        });

        if (closestTarget && minDistance < 500) {
          const target = closestTarget.ref;
          
          if (closestTarget.type === 'mannequin') {
            const dx = obj.cx - target.cx;
            const dy = obj.cy - target.cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const R_torso = 15; // 15cm radius in 2D
            if (dist > 0) {
              const projCx = target.cx + (dx / dist) * R_torso;
              const projCy = target.cy + (dy / dist) * R_torso;
              const fX = (projCx - centerX) * scale;
              const fY = (projCy - centerY) * scale;
              const angleRad = Math.atan2(dx, dy);
              const fRot = angleRad * (180 / Math.PI);

              return {
                ...obj,
                x: fX,
                y: fY,
                rotation: fRot,
                width: effW * scale,
                height: effH * scale,
                zHeight: obj.zHeight !== undefined ? obj.zHeight : 0,
                yOffset: obj.yOffset || 0
              };
            }
          } else {
            // Hedef yüzeyine (pencere/duvar) hizala
            const fX = (obj.cx - centerX) * scale;
            const fY = (obj.cy - centerY) * scale;
            const fRot = target.rotation || 0;

            return {
              ...obj,
              x: fX,
              y: fY,
              rotation: fRot,
              width: effW * scale,
              height: effH * scale,
              zHeight: obj.zHeight !== undefined ? obj.zHeight : 120,
              yOffset: obj.yOffset || 0
            };
          }
        }
      }

      // Pencere/duvara yapışan yüzey izleri ve bağlı numaratörler: konum, rotasyon
      // ve yükseklik yüzeyden alınır; render dikey decal/plaka olarak yapılır.
      if (surfaceTraceAttach.has(obj.id)) {
        const att = surfaceTraceAttach.get(obj.id);
        return {
          ...obj,
          x: att.x, y: att.y, rotation: att.rotation,
          width: effW * scale, height: effH * scale,
          zHeight: att.zHeight,
          yOffset: obj.yOffset || 0,
          surfaceDecal: true
        };
      }
      if (surfaceMarkerAttach.has(obj.id)) {
        const att = surfaceMarkerAttach.get(obj.id);
        return {
          ...obj,
          x: att.x, y: att.y, rotation: att.rotation,
          width: effW * scale, height: effH * scale,
          zHeight: att.zHeight,
          yOffset: obj.yOffset || 0,
          surfaceDecal: true
        };
      }

      let fX = (obj.cx - centerX) * scale;
      let fY = (obj.cy - centerY) * scale;
      let fRot = obj.rotation || 0;
      
      if (isAperture) {
        let bestWall = null;
        let minDist = 125;
        for (const wall of processedWalls) {
          const local = toLocal(obj, wall, scale);
          const wW = (wall.wallLen ?? getEffectiveSize(wall).width) * scale;
          const wallRot2 = wall.wallRot !== undefined ? wall.wallRot : (wall.rotation || 0);
          const rotDiff = Math.abs(((wallRot2) - (obj.rotation || 0)) % 180);
          if (local.x > -wW/2 - 10 && local.x < wW/2 + 10 && Math.abs(local.y) < minDist && (rotDiff < 20 || rotDiff > 160)) {
            minDist = Math.abs(local.y);
            bestWall = { wall, local };
          }
        }
        if (bestWall) {
          const pos = fromLocal(bestWall.local.x, 0, bestWall.wall, centerX, centerY, scale);
          fX = pos.x; fY = pos.z; fRot = bestWall.wall.wallRot !== undefined ? bestWall.wall.wallRot : (bestWall.wall.rotation || 0);
        }
      }
      
      const isD = isDoor(obj);
      const isW_ap = isWindow(obj);
      const defaultZH = isD ? 210 : (isW_ap ? 120 : 0);
      
      return { 
        ...obj, x: fX, y: fY, rotation: fRot,
        // 2B efektif boyutlar aynen korunur (eski "kapı=80px" zorlaması kaldırıldı —
        // kanat, duvardaki boşluktan geniş olup komşu duvar segmentlerinin üstüne biniyordu)
        width: effW * scale, height: effH * scale,
        zHeight: (obj.zHeight !== undefined) ? obj.zHeight : defaultZH, 
        yOffset: obj.yOffset || 0,
        hCap: wallHOpt
      };
    });

    return { visualObjects: resolvedObjects, allWalls: finalWalls, wallThickness: thickness, wallHOpt };
  }, [objects, stageWidth, stageHeight, visualSettings, viewMode]);

  const contentGroupRef = useRef<THREE.Group>(null!);

  return (
    <>
      <SceneCaptureController onCaptureRef={onCaptureRef} />
      <PerspectiveCamera makeDefault position={[0, 400, 400]} fov={50} />
      {viewMode === 'orbit' ? (
        <>
          <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} minDistance={30} maxDistance={2000} />
          {/* Kuşbakışı otomatik çerçeveleme yalnızca orbit modunda çalışır; gezinti
              modunda kendi başlangıç noktasını (Player) kurar, çakışmaz. */}
          <AutoFitCamera contentRef={contentGroupRef} />
        </>
      ) : (
        <Player isWalkMode={true} contentRef={contentGroupRef} />
      )}
      {/* Yerel gökyüzü/zemin dolgu ışığı — eski <Environment preset="city"> CDN bağımlılığının yerine */}
      {viewMode === 'walk' && <color attach="background" args={['#bcd4e8']} />}
      <hemisphereLight intensity={0.65} color="#e3edf7" groundColor="#8f9296" />
      <ambientLight intensity={0.5} />
      <directionalLight position={[100, 200, 100]} intensity={1} castShadow />
      
      <group ref={contentGroupRef}>
        {allWalls.map((wall: any, idx: number) => (
          <SafeComponent key={wall.id || `wall-${idx}`}>
            <Symbol3D obj={wall} wallThickness={wallThickness} uploadedImages={uploadedImages} />
          </SafeComponent>
        ))}
        {/* Standard Objects Pass */}
        {visualObjects.filter((o: any) => {
          const sId = o.symbolId?.toLowerCase() || '';
          const hasParent = !!o.parentId;
          const isAutoDecal = (sId === 'tr-bullet-glass' || sId === 'tr-bullet-wall' || sId === 'in-bullet-in' || sId === 'in-bullet-out') && hasParent;
          return !sId.includes('shooting') && !sId.includes('atış') && !sId.includes('ateş') && !isAutoDecal;
        }).map((obj: any) => (
          <SafeComponent key={obj.id}>
            <InteractiveSymbol 
              obj={obj} 
              isSelected={selectedId === obj.id} 
              onSelect={setSelectedId}
              stageWidth={stageWidth}
              stageHeight={stageHeight}
              wallThickness={wallThickness}
              wallHOpt={wallHOpt}
              allWalls={allWalls}
              visualObjects={visualObjects}
              uploadedImages={uploadedImages}
            />
          </SafeComponent>
        ))}

        {/* Global Trajectory Pass */}
        {visualObjects.filter((o: any) => {
          const sId = o.symbolId?.toLowerCase() || '';
          return sId.includes('shooting') || sId.includes('atış') || sId.includes('ateş');
        }).map((obj: any) => (
          <SafeComponent key={obj.id}>
            <Suspense fallback={null}>
              <ShootingTrajectory3D 
                obj={obj} 
                realObj={obj} 
                allWalls={allWalls} 
                visualObjects={visualObjects}
                uploadedImages={uploadedImages}
              />
            </Suspense>
          </SafeComponent>
        ))}
      </group>
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial color="#ffffff" metalness={0.1} roughness={0.9} />
      </mesh>
      <gridHelper args={[4000, 200, "#cccccc", "#eeeeee"]} position={[0, -0.05, 0]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[100, 200, 100]} intensity={1} castShadow />
    </>
  );
};

// Standalone auto-fit — içerik yüklendikçe her karede sahneye uyan, içerik kararlı
// kalınca (15 ardışık değişmez kare) son yerleşimini yapıp kilitleyen kamera.
// Eski sürüm İLK karede (içerik daha mount olmadan) fit yapıp kilitliyordu; bu,
// kameranın duvarın içine/çok yakınına kilitlenip KARA EKRAN görmesine yol açıyordu.
const AutoFitCamera = ({ contentRef }: { contentRef: React.RefObject<THREE.Group | null> }) => {
  const camera = useThree((s) => s.camera as THREE.PerspectiveCamera);
  const get = useThree((s) => s.get);
  const stableFrames = useRef(0);
  const frameCount = useRef(0);
  const lastSize = useRef<THREE.Vector3 | null>(null);
  const fitted = useRef(false);

  const applyFit = (center: THREE.Vector3, hExtent: number, yExtent: number = 0) => {
    // Portal içinde açılan Canvas'ta camera.aspect güncel kalmayabiliyor (drei
    // PerspectiveCamera + R3F resize uyumsuzluğu) → her fit'te doğrula.
    const gl = get().gl as THREE.WebGLRenderer | null;
    const el = gl?.domElement as HTMLCanvasElement | undefined;
    if (el && el.clientWidth > 0 && el.clientHeight > 0) {
      const a = el.clientWidth / el.clientHeight;
      if (Math.abs(camera.aspect - a) > 0.01) {
        camera.aspect = a;
        camera.updateProjectionMatrix();
      }
    }
    const vHalf = Math.tan((camera.fov * Math.PI) / 360);
    const hHalf = vHalf * Math.max(0.5, camera.aspect);
    // Kuşbakışı açı: ~55° yüksekten bakış — 2B kroki okunuşuna en yakın görünüm.
    // Düşük açıda ön duvar, oda içini ve zemin delillerini tamamen kapatıyor.
    const elevDeg = 55;
    const cosE = Math.cos((elevDeg * Math.PI) / 180);
    const sinE = Math.sin((elevDeg * Math.PI) / 180);
    // Tek bina gibi DİKEY sahnelerde (4-5 katlı işyeri/okul) yatay genişlik yetmez;
    // yükseklik de çerçevelenecek ölçüye katılır.
    const fitExtent = Math.max(hExtent, yExtent * 2);
    const dist = Math.max(140, (fitExtent / (2 * Math.min(vHalf, hHalf))) * 1.6);
    camera.position.set(center.x, Math.max(dist * sinE, 140), center.z + dist * cosE);
    camera.lookAt(center.x, 20, center.z);
    const ctrls = get().controls as any;
    if (ctrls) {
      ctrls.target.set(center.x, 20, center.z);
      ctrls.update();
    }
  };

  useFrame(() => {
    if (fitted.current) return;
    const ctrls = get().controls as any;
    if (!ctrls || !contentRef.current) return;
    frameCount.current++;
    if (frameCount.current > 900) { fitted.current = true; return; } // ~15 sn güvenlik stopu

    const box = new THREE.Box3().setFromObject(contentRef.current);
    if (!isFinite(box.min.x)) return; // içerik henüz yok
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const hExtent = Math.max(size.x, size.z);
    if (hExtent < 10 || size.y < 5) return; // gerçek içerik (duvar/mobilya) gelene kadar bekle

    const ls = lastSize.current;
    const stable = ls && Math.abs(ls.x - size.x) < 0.5 && Math.abs(ls.y - size.y) < 0.5 && Math.abs(ls.z - size.z) < 0.5;
    stableFrames.current = stable ? stableFrames.current + 1 : 0;
    lastSize.current = size.clone();

    // Yükleme sırasında canlı önizleme fit'i; en az ~2,5 sn VE içerik 10 kare
    // boyunca büyümeyince kilitle (asenkron doku/model yükleme sonrası büyümeleri
    // kaçırıp yarım sahneyle kilitlenmenin önüne geçer).
    applyFit(center, hExtent, size.y);
    if (frameCount.current > 150 && stableFrames.current >= 10) fitted.current = true;
  });
  return null;
};

// Camera preset view switcher - animates camera to predefined positions
const CameraPresets = ({ preset }: { preset: string | null }) => {
  const { camera } = useThree();
  const get = useThree((s) => s.get);
  const prevPreset = useRef<string | null>(null);

  useEffect(() => {
    if (!preset || preset === prevPreset.current) return;
    prevPreset.current = preset;

    const ctrls = get().controls as any;
    if (!ctrls) return;

    const t = ctrls.target;
    let pos: [number, number, number];
    switch (preset) {
      case 'top':    pos = [t.x, 500, t.z + 0.01]; break;
      case 'front':  pos = [t.x, 80, t.z + 400];   break;
      case 'side':   pos = [t.x + 400, 80, t.z];    break;
      case 'back':   pos = [t.x, 80, t.z - 400];    break;
      default: return;
    }
    camera.position.set(pos[0], pos[1], pos[2]);
    ctrls.update();
  }, [preset, camera, get]);

  return null;
};

export const ThreeDPreview: React.FC<ThreeDPreviewProps> = ({ isOpen, onClose }) => {
  const { objects, updateObject, visualSettings, updateVisualSettings } = useStore();
  const [viewMode, setViewMode] = useState<'orbit' | 'walk'>('orbit');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cameraPreset] = useState<string | null>(null);

  const captureRef = useRef<any>(null);
  const [capturedMedia, setCapturedMedia] = useState<{ id: string; type: 'photo' | 'video'; url: string; timestamp: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Sahne içi beklenmeyen hatalarda kullanıcıya görünür kart göstermek için (boş ekran yerine)
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [sceneRetry, setSceneRetry] = useState(0);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  // Önizleme her açıldığında hata durumunu sıfırla
  useEffect(() => {
    if (isOpen) {
      setSceneError(null);
      setSceneRetry(0);
    }
  }, [isOpen]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const takePhoto = () => {
    if (!captureRef.current) return;
    try {
      const dataUrl = captureRef.current.takeScreenshot();
      setCapturedMedia(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          type: 'photo',
          url: dataUrl,
          timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }
      ]);
    } catch (err) {
      console.error("Screenshot error:", err);
    }
  };

  const startVideoRecording = () => {
    if (!captureRef.current) return;
    const canvas = captureRef.current.getCanvasElement();
    if (!canvas) return;

    try {
      const stream = canvas.captureStream(30);
      let options = { mimeType: 'video/webm' };
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        options = { mimeType: 'video/webm;codecs=vp9' };
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        options = { mimeType: 'video/webm;codecs=vp8' };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      videoChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          videoChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(blob);
        setCapturedMedia(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            type: 'video',
            url: videoUrl,
            timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          }
        ]);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Video recording start error:", err);
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  if (!isOpen) return null;

  const handleFlip = () => {
    if (!selectedId) return;
    const obj = objects.find(o => o.id === selectedId);
    if (obj) {
      updateObject(selectedId, { rotation: ((obj.rotation || 0) + 180) % 360 });
    }
  };

  const selectedObj = objects.find(o => o.id === selectedId);
  const isMannequinSelected = selectedObj && (selectedObj.symbolId?.startsWith('p-') || selectedObj.symbolId === 'ev-human-poseable');

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0a0a0a]">
      <div className="h-16 bg-[#1a1a1a] border-b border-[#333] flex items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <Rotate3D size={20} className="text-white" />
            <h2 className="text-sm font-black text-white uppercase tracking-widest">3D OLAY YERİ MODELİ</h2>
          </div>
          
          <div className="h-8 w-px bg-white/10" />

          <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
            <button 
              onClick={() => setViewMode('orbit')}
              className={`px-4 py-1.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-2 ${viewMode === 'orbit' ? 'bg-[#3a7ca5] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              <Rotate3D size={14} /> KUŞBAKIŞI
            </button>
            <button 
              onClick={() => setViewMode('walk')}
              className={`px-4 py-1.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-2 ${viewMode === 'walk' ? 'bg-[#3a7ca5] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              <Footprints size={14} /> MEKANDA GEZ (WASD)
            </button>
          </div>

          {/* Kuşbakışı kesit: alçak duvarla 2B kroki okunuşu; yürüme modunda tam yükseklik */}
          {viewMode === 'orbit' && (
            <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Duvar</span>
              <select
                value={String((visualSettings as any)?.wallHeight3D || 250)}
                onChange={(e) => updateVisualSettings({ wallHeight3D: Number(e.target.value) } as any)}
                className="bg-transparent text-[11px] font-bold text-white outline-none cursor-pointer [&>option]:bg-[#1a1a1a]"
                title="Kuşbakışında duvar yüksekliği — alçalttıkça oda içi ve zemin delilleri net görünür"
              >
                <option value="250">TAM (250 cm)</option>
                <option value="125">YARIM (125 cm)</option>
                <option value="60">ALÇAK (60 cm)</option>
                <option value="10">KROKİ (10 cm)</option>
              </select>
            </div>
          )}

          {isMannequinSelected && (
            <button 
              onClick={handleFlip}
              className="px-4 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-md text-[11px] font-bold text-red-100 transition-all flex items-center gap-2"
            >
              <RotateCw size={14} /> ÖN/ARKA ÇEVİR (180°)
            </button>
          )}

          {isMannequinSelected && (selectedObj?.zHeight || 0) !== 0 && (
            <button 
              onClick={() => updateObject(selectedId!, { zHeight: 0 })}
              className="px-4 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-md text-[11px] font-bold text-blue-100 transition-all flex items-center gap-2"
            >
              <ArrowDown size={14} /> ZEMİNE OTURT
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-6 w-px bg-white/10 mx-1" />
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
        </div>
      </div>
      {/* AÇIK YÜKSEKLİK ŞART: flex-1 tek başına bazı ortamlarda uygulanmıyor ve
          R3F canvas'ı kendi yüksekliğini sonsuz döngüde büyütüyor (aspect bozulması,
          yakın kamera). header h-16 = 4rem → kalan alan = calc(100vh - 4rem). */}
      <div className="relative min-h-0 w-full" style={{ height: 'calc(100vh - 4rem)', overflow: 'hidden' }}>
        <CanvasErrorBoundary onRetry={() => { setSceneError(null); setSceneRetry(r => r + 1); }}>
          <Canvas shadows gl={{ preserveDrawingBuffer: true }} camera={{ position: [0, 400, 400], fov: 50 }}>
            <SceneErrorShield onError={(err) => setSceneError(err.message || 'Bilinmeyen hata')} key={sceneRetry}>
              <Scene objects={objects} viewMode={viewMode} selectedId={selectedId} setSelectedId={setSelectedId} onCaptureRef={captureRef} />
              <CameraPresets preset={cameraPreset} />
            </SceneErrorShield>
          </Canvas>
        </CanvasErrorBoundary>

        {sceneError && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[100000] max-w-md bg-[#1a1a1a]/95 backdrop-blur-md border border-amber-500/40 rounded-xl px-5 py-4 shadow-2xl space-y-2">
            <p className="text-amber-300 text-xs font-black uppercase tracking-wider">⚠️ Sahnenin bir bölümü gösterilemiyor</p>
            <p className="text-gray-400 text-[11px] leading-relaxed">Çiziminizin geri kalanı güvenli. Kapatıp yeniden açmayı deneyin.</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setSceneRetry(r => r + 1)} className="px-3 py-1.5 bg-[#3a7ca5] hover:bg-[#4a8cb5] text-white rounded-md text-[10px] font-black tracking-wider transition-colors">YENİDEN DENE</button>
              <button onClick={() => setSceneError(null)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-md text-[10px] font-bold transition-colors">KAPAT</button>
            </div>
          </div>
        )}
        
        {viewMode === 'walk' && (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-center">
              <p className="text-white text-xs font-bold mb-2">GEZİ MODU AKTİF</p>
              <div className="flex gap-2 justify-center opacity-70">
                <kbd className="px-2 py-1 bg-white/10 rounded text-[10px] text-white border border-white/20">W</kbd>
                <kbd className="px-2 py-1 bg-white/10 rounded text-[10px] text-white border border-white/20">A</kbd>
                <kbd className="px-2 py-1 bg-white/10 rounded text-[10px] text-white border border-white/20">S</kbd>
                <kbd className="px-2 py-1 bg-white/10 rounded text-[10px] text-white border border-white/20">D</kbd>
              </div>
            </div>
          </div>
        )}

        {/* Floating Capture & Record Controls */}
        <div className="absolute bottom-8 right-8 z-[99999] flex flex-col items-end gap-3">
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-600/90 text-white rounded-full text-[10px] font-black animate-pulse shadow-lg border border-red-500/30">
              <span className="w-2 h-2 bg-white rounded-full animate-ping" />
              <span>KAYIT: {formatTime(recordingSeconds)}</span>
            </div>
          )}
          
          <div className="bg-[#1a1a1a]/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-2 flex items-center gap-2 ring-1 ring-white/5">
            <button
              onClick={takePhoto}
              className="p-3 bg-white/5 hover:bg-[#3a7ca5] text-white rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md group border border-white/5"
              title="Fotoğraf Çek"
            >
              <Camera size={18} className="group-hover:rotate-6 transition-transform" />
            </button>
            
            {isRecording ? (
              <button
                onClick={stopVideoRecording}
                className="p-3 bg-red-600 text-white rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md animate-pulse border border-red-500"
                title="Kaydı Durdur"
              >
                <Square size={18} />
              </button>
            ) : (
              <button
                onClick={startVideoRecording}
                className="p-3 bg-white/5 hover:bg-red-600 text-white rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md group border border-white/5"
                title="Video Kaydet"
              >
                <Video size={18} className="group-hover:scale-110 transition-transform" />
              </button>
            )}

            <div className="w-px h-6 bg-white/10 mx-1" />

            <button
              onClick={() => setIsGalleryOpen(true)}
              className="p-3 bg-white/5 hover:bg-[#3a7ca5] text-white rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md relative group border border-white/5"
              title="Medyalarım"
            >
              <FolderOpen size={18} />
              {capturedMedia.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#3a7ca5] text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border border-[#1a1a1a]">
                  {capturedMedia.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Media Gallery Sidebar (Slide-over) */}
        {isGalleryOpen && (
          <div className="absolute inset-y-0 right-0 w-96 bg-[#121212]/95 backdrop-blur-xl border-l border-white/10 z-[100000] flex flex-col shadow-2xl transition-all duration-300">
            {/* Header */}
            <div className="h-16 border-b border-white/10 flex items-center justify-between px-6">
              <div className="flex items-center gap-2.5">
                <Images size={16} className="text-[#3a7ca5]" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">MEDYALARIM ({capturedMedia.length})</h3>
              </div>
              <button
                onClick={() => setIsGalleryOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-white/10"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {capturedMedia.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <Images size={36} className="text-gray-700" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-400">Henüz Medya Yok</p>
                    <p className="text-[10px] text-gray-600 max-w-[200px]">Mekanda gezerken fotoğraf veya video çekerek buraya ekleyebilirsiniz.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {capturedMedia.map((media) => (
                    <div key={media.id} className="bg-[#1e1e1e] border border-white/5 rounded-xl overflow-hidden shadow-lg group relative">
                      {/* Media Display */}
                      {media.type === 'photo' ? (
                        <img 
                          src={media.url} 
                          alt="Captured Scene" 
                          className="w-full h-44 object-cover hover:scale-102 transition-transform duration-300 cursor-pointer"
                          onClick={() => window.open(media.url, '_blank')}
                        />
                      ) : (
                        <video 
                          src={media.url} 
                          controls 
                          className="w-full h-44 object-cover"
                        />
                      )}
                      
                      {/* Media Details */}
                      <div className="p-3 bg-[#161616] flex items-center justify-between border-t border-white/5">
                        <div className="space-y-0.5">
                          <p className="text-[9px] font-black text-[#3a7ca5] uppercase">{media.type === 'photo' ? 'FOTOĞRAF' : 'VİDEO KAYDI'}</p>
                          <p className="text-[10px] text-gray-500">{media.timestamp}</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <a 
                            href={media.url} 
                            download={`Olay_Yeri_${media.type}_${media.id}.${media.type === 'photo' ? 'png' : 'webm'}`}
                            className="p-2 bg-white/5 hover:bg-[#3a7ca5]/20 text-gray-400 hover:text-white rounded-lg transition-colors border border-white/5"
                            title="İndir"
                          >
                            <Download size={12} />
                          </a>
                          <button
                            onClick={() => {
                              setCapturedMedia(prev => prev.filter(m => m.id !== media.id));
                              if (media.type === 'video') {
                                URL.revokeObjectURL(media.url);
                              }
                            }}
                            className="p-2 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors border border-white/5"
                            title="Sil"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
};
