import React, { Suspense, useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  PerspectiveCamera, 
  Environment, 
  useTexture, 
  TransformControls,
  PointerLockControls
} from '@react-three/drei';
import { X, Rotate3D, Footprints, RotateCw, ArrowDown, Camera, Video, Square, FolderOpen, Images, Download, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import * as THREE from 'three';
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

const Wall = ({ x, y, width, rotation, h = 250, yOffset = 0, wallColor, wallThickness }: any) => {
  const thickness = wallThickness || (10 * SCALE);
  const rad = -rotation * (Math.PI / 180);
  
  // 1:1 POSITIONING: x and y are already the scaled center coordinates
  const posX = x;
  const posZ = y;

  return (
    <mesh position={[posX, (h * SCALE) / 2 + yOffset, posZ]} rotation={[0, -rad, 0]}>
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

const Window3D = ({ x, y, width, h, rad, sillH, thickness, zOffset }: any) => {
  const [isOpen, setIsOpen] = useState(false);
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

// --- ADVANCED AI COMMAND ENGINE ---
const processForensicCommand = (command: string, objects: any[], selectedId: string | null, updateObject: any, addObject: any, removeObject: any) => {
  const cmd = command.toLowerCase().trim();
  const selected = selectedId ? objects.find(o => o.id === selectedId) : null;
  
  // 1. ADDITION LOGIC
  if (cmd.includes('ekle') || cmd.includes('koy') || cmd.includes('yerleştir')) {
    let symbolId = 'ev-human-poseable';
    let name = 'Yeni Nesne';
    let w = 60, h = 60;

    if (cmd.includes('manken') || cmd.includes('insan') || cmd.includes('ceset')) {
      symbolId = 'ev-human-poseable';
      name = 'Adli Ceset';
    } else if (cmd.includes('pencere')) {
      symbolId = 'arch-win';
      name = 'Pencere';
      w = 100; h = 15;
    } else if (cmd.includes('duvar')) {
      symbolId = 'arch-w1';
      name = 'Duvar';
      w = 200; h = 15;
    } else if (cmd.includes('kapı')) {
      symbolId = 'arch-d1r';
      name = 'Kapı';
      w = 90; h = 15;
    } else if (cmd.includes('yatak')) {
      symbolId = 'f-bed-1';
      name = 'Yatak';
      w = 120; h = 200;
    } else if (cmd.includes('masa')) {
      symbolId = 'f-table-1';
      name = 'Masa';
      w = 120; h = 80;
    }

    addObject({
      type: 'symbol',
      symbolId,
      x: 500,
      y: 500,
      width: w,
      height: h,
      name,
      rotation: 0,
      zHeight: 0
    });
    return `${name} sahneye eklendi.`;
  }

  // 2. DELETION LOGIC
  if (cmd.includes('sil') || cmd.includes('kaldır') || cmd.includes('yok et')) {
    if (selected) {
      removeObject(selected.id);
      return "Seçili nesne kaldırıldı.";
    }
    return "Lütfen silmek istediğiniz nesneyi önce seçin.";
  }

  // 3. TRANSFORMATION LOGIC (Move, Rotate, Resize)
  if (selected) {
    // Movement
    if (cmd.includes('sağ')) {
      updateObject(selected.id, { x: selected.rawX + 50 });
      return "Sağa kaydırıldı.";
    }
    if (cmd.includes('sol')) {
      updateObject(selected.id, { x: selected.rawX - 50 });
      return "Sola kaydırıldı.";
    }
    if (cmd.includes('yukarı') || cmd.includes('ileri')) {
      updateObject(selected.id, { y: selected.rawY - 50 });
      return "İleri kaydırıldı.";
    }
    if (cmd.includes('aşağı') || cmd.includes('geri')) {
      updateObject(selected.id, { y: selected.rawY + 50 });
      return "Geri kaydırıldı.";
    }

    // Rotation
    if (cmd.includes('döndür') || cmd.includes('çevir')) {
      updateObject(selected.id, { rotation: (selected.rotation + 45) % 360 });
      return "45 derece döndürüldü.";
    }

    // Mannequin Specific
    if (selected.isMannequin || selected.symbolId === 'ev-human-poseable') {
      if (cmd.includes('yüzüstü')) {
        updateObject(selected.id, { pose: 'prone' });
        return "Ceset yüzüstü yatırıldı.";
      }
      if (cmd.includes('sırtüstü')) {
        updateObject(selected.id, { pose: 'supine' });
        return "Ceset sırtüstü yatırıldı.";
      }
      if (cmd.includes('ayakta')) {
        updateObject(selected.id, { pose: 'standing' });
        return "Ceset ayağa kaldırıldı.";
      }
      if (cmd.includes('zemine') || cmd.includes('yere') || cmd.includes('indir')) {
        updateObject(selected.id, { zHeight: 0 });
        return "Nesne zemine indirildi.";
      }
    }
  }

  return "Komut anlaşılamadı. 'Masa ekle', 'Sola kaydır', 'Döndür' gibi komutlar kullanabilirsiniz.";
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
    return this.props.children;
  }
}

const Player = ({ isWalkMode }: { isWalkMode: boolean }) => {
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
    
    // Set starting position at eye level of 175cm at center of room looking forward
    camera.position.set(0, 175 * SCALE, 150 * SCALE);
    camera.lookAt(0, 175 * SCALE, 0);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isWalkMode, camera]);

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
  const isabetIziSrc = uploadedImages?.find((img: any) => {
    if (!img || typeof img.name !== 'string') return false;
    const name = img.name.toLowerCase().replace(/[-_\s]/g, '');
    return name === 'isabetizipng' || name === 'isabetizi';
  })?.src;
  const glassTexSrc = (isabetIziSrc && typeof isabetIziSrc === 'string' && isabetIziSrc.trim() !== '')
    ? isabetIziSrc : '/assets/symbols/bullet_hole_1.png';
  const glassTex = useTexture(glassTexSrc) as THREE.Texture;
  const wallTex = useTexture('/assets/symbols/bullet_hole_2.png') as THREE.Texture;
  const woundInTex = useTexture(WOUND_IN_SVG) as THREE.Texture;
  const woundOutTex = useTexture(WOUND_OUT_SVG) as THREE.Texture;
  
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
      const actualRotation = isWindowObj ? -r : r;
      const cos = Math.cos(-actualRotation);
      const sin = Math.sin(-actualRotation);
      
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
        const rayOffset = 0.4 * SCALE * faceDir;
        holes.push({
          id: `hole-${isWindowObj ? 'win' : 'wall'}-${idx}-${hitIdx}`,
          x: hitX + dir3D.x * rayOffset,
          y: finalHitY + dir3D.y * rayOffset,
          z: hitZ + dir3D.z * rayOffset,
          isWindow: isWindowObj, rotY: item.rotation || 0, faceDir
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

  const checkMannequinIntersections = (mannequins: any[]) => {
    mannequins.forEach((m) => {
      const mRotY = -(m.rotation || 0) * (Math.PI / 180);
      const pose = m.pose || 'standing';
      let poseRot = new THREE.Quaternion();
      
      const zHeight = m.zHeight !== undefined ? m.zHeight : 0;
      const yOff = (m.yOffset || 0) * SCALE;
      const totalOffset = (zHeight * SCALE) + yOff;

      let posePos = new THREE.Vector3(0, totalOffset + 45 * SCALE, 0); 

      if (pose === 'prone') {
        poseRot.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        posePos.set(0, totalOffset + 10 * SCALE, 0);
      } else if (pose === 'supine') {
        poseRot.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
        posePos.set(0, totalOffset + 10 * SCALE, 0);
      } else {
        // standing
        posePos.set(0, totalOffset + 80 * SCALE, 0);
      }

      const worldPos = new THREE.Vector3(m.x, 0, m.y).add(posePos.clone().applyAxisAngle(new THREE.Vector3(0,1,0), mRotY));
      const worldQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), mRotY).multiply(poseRot);
      const worldMatrix = new THREE.Matrix4().compose(worldPos, worldQuat, new THREE.Vector3(1,1,1));
      const invWorldMatrix = worldMatrix.clone().invert();

      const rayStart = new THREE.Vector3(wSx, zH, wSz);
      const rayEnd = new THREE.Vector3(wEx, targetZH, wEz);
      
      const dir3D = new THREE.Vector3().subVectors(rayEnd, rayStart).normalize();
      const extStart = rayStart.clone().addScaledVector(dir3D, -100 * SCALE);
      const extEnd = rayEnd.clone().addScaledVector(dir3D, 100 * SCALE);

      const localRayStart = extStart.clone().applyMatrix4(invWorldMatrix);
      const localRayEnd = extEnd.clone().applyMatrix4(invWorldMatrix);

      // Helper for cylinder intersection in local space
      const intersectCylinder = (lStart: THREE.Vector3, lEnd: THREE.Vector3, radius: number, minY: number, maxY: number) => {
        const dx = lEnd.x - lStart.x;
        const dz = lEnd.z - lStart.z;
        
        const A = dx*dx + dz*dz;
        if (A === 0) return null;
        
        const B = 2 * (dx*lStart.x + dz*lStart.z);
        const C = lStart.x*lStart.x + lStart.z*lStart.z - radius*radius;
        const det = B*B - 4*A*C;
        if (det < 0) return null;
        
        const t1 = (-B - Math.sqrt(det)) / (2*A);
        const t2 = (-B + Math.sqrt(det)) / (2*A);
        
        const hits: number[] = [];
        [t1, t2].forEach(t => {
          if (t >= 0 && t <= 1) {
            const y = lStart.y + t * (lEnd.y - lStart.y);
            if (y >= minY && y <= maxY) {
              hits.push(t);
            }
          }
        });
        return hits.length > 0 ? hits : null;
      };

      // Helper for sphere intersection in local space
      const intersectSphere = (lStart: THREE.Vector3, lEnd: THREE.Vector3, center: THREE.Vector3, radius: number) => {
        const d = new THREE.Vector3().subVectors(lEnd, lStart);
        const f = new THREE.Vector3().subVectors(lStart, center);
        
        const A = d.lengthSq();
        if (A === 0) return null;
        const B = 2 * f.dot(d);
        const C = f.lengthSq() - radius*radius;
        const det = B*B - 4*A*C;
        if (det < 0) return null;
        
        const t1 = (-B - Math.sqrt(det)) / (2*A);
        const t2 = (-B + Math.sqrt(det)) / (2*A);
        
        const hits: number[] = [];
        [t1, t2].forEach(t => {
          if (t >= 0 && t <= 1) {
            hits.push(t);
          }
        });
        return hits.length > 0 ? hits : null;
      };

      const allHits: { t: number; type: 'torso' | 'legs' | 'head' }[] = [];

      // 1. Torso & Arms (15 * SCALE matches the humanoid's actual torso mesh capsule radius)
      const torsoHits = intersectCylinder(localRayStart, localRayEnd, 15 * SCALE, 0, 70 * SCALE);
      if (torsoHits) torsoHits.forEach(t => allHits.push({ t, type: 'torso' }));

      // 2. Legs (12 * SCALE matches the bounding boundaries of left/right legs)
      const legsHits = intersectCylinder(localRayStart, localRayEnd, 12 * SCALE, -80 * SCALE, 0);
      if (legsHits) legsHits.forEach(t => allHits.push({ t, type: 'legs' }));

      // 3. Head
      const headHits = intersectSphere(localRayStart, localRayEnd, new THREE.Vector3(0, 80 * SCALE, 0), 10 * SCALE);
      if (headHits) headHits.forEach(t => allHits.push({ t, type: 'head' }));



      if (allHits.length > 0) {
        // Sort by t (ray parameter) to find entry and exit
        allHits.sort((a, b) => a.t - b.t);
        const tNear = allHits[0].t;
        const tFar = allHits[allHits.length - 1].t;

        const isThrough = allHits.length >= 2;

        [tNear, tFar].forEach((t, hitIdx) => {
          // If only 1 hit, only render the entry wound
          if (!isThrough && hitIdx === 1) return;

          const localHit = new THREE.Vector3().lerpVectors(localRayStart, localRayEnd, t);
          const hitType = allHits[hitIdx === 0 ? 0 : allHits.length - 1].type;
          
          const worldHit = localHit.clone().applyMatrix4(worldMatrix);

          // Calculate local normal
          let localNormal = new THREE.Vector3();
          if (hitType === 'head') {
            const headCenter = new THREE.Vector3(0, 80 * SCALE, 0);
            localNormal.subVectors(localHit, headCenter).normalize();
          } else {
            localNormal.set(localHit.x, 0, localHit.z).normalize();
          }

          // Transform normal to world space
          const worldNormal = localNormal.clone().applyQuaternion(worldQuat).normalize();
          
          // Calculate quaternion that aligns Z-axis with worldNormal
          const impactQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), worldNormal);

          // Offset reduced to 0.015 * SCALE (0.75 cm) so decals touch the mannequin body skin perfectly
          const newHole = {
            id: `hole-mannequin-${m.id}-${hitIdx}`,
            x: worldHit.x + worldNormal.x * 0.015 * SCALE,
            y: worldHit.y + worldNormal.y * 0.015 * SCALE,
            z: worldHit.z + worldNormal.z * 0.015 * SCALE,
            isMannequin: true,
            isEntry: hitIdx === 0,
            quaternion: impactQuat,
            size: (hitIdx === 0 ? 12 : 18) * SCALE, // Slightly increased sizes to match visual representation
            faceDir: 1
          };

          holes.push(newHole);
        });
      }
    });
  };

  const isMannequinObject = (o: any) => {
    if (!o) return false;
    const sIdLower = o.symbolId?.toLowerCase() || '';
    const srcLower = (o.src && typeof o.src === 'string') ? o.src.toLowerCase() : '';
    const nameLower = (o.name && typeof o.name === 'string') ? o.name.toLowerCase() : '';
    const labelLower = (o.label && typeof o.label === 'string') ? o.label.toLowerCase() : '';
    const textLower = (o.text && typeof o.text === 'string') ? o.text.toLowerCase() : '';

    const isHumanSrc = srcLower.includes('manken') || 
                       srcLower.includes('human') || 
                       srcLower.includes('person') || 
                       srcLower.includes('p-1') || 
                       srcLower.includes('p-2') ||
                       srcLower.includes('standing-man') ||
                       srcLower.includes('standing-woman') ||
                       srcLower.includes('body') ||
                       srcLower.includes('ceset') ||
                       nameLower.includes('ceset') ||
                       labelLower.includes('ceset') ||
                       textLower.includes('ceset') ||
                       nameLower.includes('manken') ||
                       labelLower.includes('manken') ||
                       textLower.includes('manken');

    return sIdLower.startsWith('p-') || isHumanSrc || sIdLower === 'ev-human-poseable' || o.isMannequin;
  };

  const isFurnitureObject = (o: any) => {
    if (!o) return false;
    const sId = (o.symbolId || '').toLowerCase();
    const name = (o.name || '').toLowerCase();
    const src = (o.src || '').toLowerCase();
    
    if (isWindow(o) || isDoor(o) || sId.startsWith('arch-w1') || sId === 'arch-7' || sId === 'arch-w-square' || sId.includes('shooting') || sId.includes('atış') || sId.includes('ateş') || isMannequinObject(o)) {
      return false;
    }
    
    return sId.startsWith('f-') || 
           sId.includes('yatak') || sId.includes('bed') || name.includes('yatak') ||
           sId.includes('koltuk') || sId.includes('sofa') || name.includes('koltuk') ||
           sId.includes('masa') || sId.includes('sehpa') || sId.includes('table') ||
           sId.includes('sandalye') || sId.includes('chair') ||
           sId.includes('mutfak') || sId.includes('tezgah') || src.includes('kitchen') ||
           sId.includes('gardırop') || sId.includes('gardrop') || name.includes('gardırop') || name.includes('dolap') ||
           sId.includes('tv') || sId.includes('televizyon') || sId.includes('ekran') ||
           sId.startsWith('v-') || sId.includes('car');
  };

  const checkFurnitureIntersections = (furnitureItems: any[]) => {
    furnitureItems.forEach((item: any, idx: number) => {
      const r = (item.rotation || 0) * (Math.PI / 180);
      const cos = Math.cos(r);
      const sin = -Math.sin(r);
      
      const w = item.width || 0;
      const d = item.height || 0;
      const autoH = getStandardHeight(item.symbolId);
      
      const isBedOrSofaOrFloor = item.symbolId?.toLowerCase().includes('bed') || 
                                 item.symbolId?.toLowerCase().includes('yatak') || 
                                 item.symbolId?.toLowerCase().includes('koltuk') || 
                                 item.symbolId?.toLowerCase().includes('sofa') ||
                                 item.symbolId?.toLowerCase().includes('floor') ||
                                 item.symbolId?.toLowerCase().includes('zemin');

      const zHeight = item.zHeight !== undefined ? item.zHeight : 0;
      const yOff = (item.yOffset || 0) * SCALE;
      const totalOffset = isBedOrSofaOrFloor ? (zHeight * SCALE) + yOff : yOff;
      const h = (isBedOrSofaOrFloor ? autoH : (zHeight > 0 ? zHeight : autoH)) * SCALE;
      
      // Transform ray segment to local coordinates
      const lx1 = (wSx - item.x) * cos - (wSz - item.y) * sin;
      const lz1 = (wSx - item.x) * sin + (wSz - item.y) * cos;
      const ly1 = zH - totalOffset;
      
      const lx2 = (wEx - item.x) * cos - (wEz - item.y) * sin;
      const lz2 = (wEx - item.x) * sin + (wEz - item.y) * cos;
      const ly2 = targetZH - totalOffset;
      
      // Liang-Barsky / Slab method for Segment-OBB intersection
      const dx = lx2 - lx1;
      const dy = ly2 - ly1;
      const dz = lz2 - lz1;
      
      let tMin = 0;
      let tMax = 1;
      
      const bounds = [
        { min: -w / 2, max: w / 2, p: -dx, q: lx1 - (-w / 2) },
        { min: -w / 2, max: w / 2, p: dx, q: w / 2 - lx1 },
        { min: 0, max: h, p: -dy, q: ly1 - 0 },
        { min: 0, max: h, p: dy, q: h - ly1 },
        { min: -d / 2, max: d / 2, p: -dz, q: lz1 - (-d / 2) },
        { min: -d / 2, max: d / 2, p: dz, q: d / 2 - lz1 }
      ];
      
      let possible = true;
      for (let i = 0; i < 6; i++) {
        const { p, q } = bounds[i];
        if (p === 0) {
          if (q < 0) { possible = false; break; }
        } else {
          const t = q / p;
          if (p < 0) {
            if (t > tMin) tMin = t;
          } else {
            if (t < tMax) tMax = t;
          }
        }
      }
      
      if (possible && tMin <= tMax && tMin >= 0 && tMin <= 1) {
        const hitT = tMin;
        const hitX = wSx + hitT * (wEx - wSx);
        const hitY = zH + hitT * (targetZH - zH);
        const hitZ = wSz + hitT * (wEz - wSz);
        
        let faceDir = 1;
        const localHitZ = lz1 + hitT * dz;
        
        if (Math.abs(localHitZ + d / 2) < 0.5 * SCALE) {
          faceDir = -1;
        }
        
        const tp = direction.x * (hitX - wSx) + direction.y * (hitY - zH) + direction.z * (hitZ - wSz);
        if (tp >= 0 && tp <= distance3D) {
          const rayOffset = 0.4 * SCALE * faceDir;
          holes.push({
            id: `hole-furniture-${item.id}-${idx}`,
            x: hitX + direction.x * rayOffset,
            y: hitY + direction.y * rayOffset,
            z: hitZ + direction.z * rayOffset,
            isWindow: false,
            isMannequin: false,
            isFurniture: true,
            rotY: item.rotation || 0,
            faceDir
          });
        }
      }
    });
  };

  if (allWalls) checkIntersections(allWalls, false);
  if (visualObjects) {
    checkIntersections(visualObjects.filter((o: any) => isWindow(o)), true);
    checkMannequinIntersections(visualObjects.filter(isMannequinObject));
    checkFurnitureIntersections(visualObjects.filter(isFurnitureObject));
  }

  // ── DEDUPLICATION: camda hem cam hem duvar izi oluşmasını önle ──────────
  // Pencere isabet izine yakın (30 SCALE birim) olan duvar izlerini sil
  const windowHoles = holes.filter((h: any) => h.isWindow);
  const dedupedHoles = holes.filter((h: any) => {
    if (!h.isWindow && !h.isMannequin) {
      const DEDUP_THRESHOLD = 30 * SCALE;
      return !windowHoles.some((wh: any) => {
        const dx = h.x - wh.x;
        const dy = h.y - wh.y;
        const dz = h.z - wh.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz) < DEDUP_THRESHOLD;
      });
    }
    return true;
  });

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

  // 2nd pass: project visualObject positions onto the ray and create guaranteed-on-ray holes
  // This ensures every auto-created impact mark aligns with the trajectory line
  if (visualObjects) {
    visualObjects.forEach((h: any) => {
      const sId = (h.symbolId || '').toLowerCase();
      if (sId === 'tr-bullet-glass' || sId === 'tr-bullet-wall') {
        const hasParent = !!h.parentId;
        if (!hasParent) return; // only auto-created marks, skip user-placed ones
        
        const zh = (h.zHeight || 120) * SCALE;
        const hv = new THREE.Vector3(h.x - gunBarrelOrigin.x, zh - gunBarrelOrigin.y, h.y - gunBarrelOrigin.z);
        const t = hv.dot(rayDir3D);
        if (t < minT) minT = t;
        if (t > maxT) maxT = t;
        
        // Project the visualObject position onto the ray for a guaranteed-on-ray hole
        const projX = gunBarrelOrigin.x + t * rayDir3D.x;
        const projY = gunBarrelOrigin.y + t * rayDir3D.y;
        const projZ = gunBarrelOrigin.z + t * rayDir3D.z;
        
        // Determine face direction from visualObject rotation vs ray direction
        const vRotRad = -(h.rotation || 0) * Math.PI / 180;
        const faceNormal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), vRotRad);
        const faceDir = faceNormal.dot(rayDir3D) > 0 ? 1 : -1;
        
        // Check if this projected position is close to an existing deduped hole
        const isNearExisting = dedupedHoles.some((dh: any) => {
          const dx = dh.x - projX;
          const dy = dh.y - projY;
          const dz = dh.z - projZ;
          return Math.sqrt(dx*dx + dy*dy + dz*dz) < 5 * SCALE;
        });
        
        if (!isNearExisting && t >= 0) {
          dedupedHoles.push({
            id: `proj-${sId}-${h.id}`,
            x: projX,
            y: projY,
            z: projZ,
            isWindow: sId === 'tr-bullet-glass',
            isMannequin: false,
            isFurniture: sId === 'tr-bullet-wall' && h.isFurniture,
            rotY: h.rotation || 0,
            faceDir
          });
        }
      }
    });
  }

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
      
      {/* Bullet Holes — deduplicated (cam üzerinde sadece cam izi) */}
      {dedupedHoles.map((hole: any) => {
        
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

        const baseRot = (hole.isWindow || hole.isFurniture)
          ? -(hole.rotY || 0) * Math.PI / 180
          : (hole.rotY || 0) * Math.PI / 180;
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
             <mesh key={hole.id} position={[hole.x, hole.y, hole.z]} rotation={[0, localRot, 0]} renderOrder={50}>
               <planeGeometry args={[35 * SCALE, 35 * SCALE]} />
               <meshBasicMaterial 
                 map={wallTex} 
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

const Symbol3D = ({ obj, wallThickness, realObj, allWalls, visualObjects, uploadedImages }: any) => {
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
  const isHuman = effSymbolId?.startsWith('p-') || isHumanSrc || effSymbolId === 'ev-human-poseable' || actualObj.isMannequin;
  const isWall = effSymbolId?.startsWith('arch-w1') || effSymbolId === 'arch-7' || effSymbolId === 'arch-w-square' || effSymbolId?.includes('fake');
  const isTraj = sIdLower.includes('shooting') || sIdLower.includes('atış');
  
  // Wound covers all wounds, blood pools, blood splatters, blood smears, and flat body markers
  const isWound = sIdLower.startsWith('in-') || sIdLower.includes('blood') || nameLower.includes('yara') || nameLower.includes('kan');
  const isImpactMark = sIdLower === 'tr-bullet-glass' || sIdLower === 'tr-bullet-wall';
  
  // Custom volumetric mappings (furniture, etc.)
  // isBed: f-1, f-2 — but NOT f-12/f-13 (wardrobes)
  const isBed = (sIdLower === 'f-1' || sIdLower === 'f-2' || (sIdLower.startsWith('f-1') && !sIdLower.startsWith('f-12') && !sIdLower.startsWith('f-13'))) || sIdLower.includes('yatak') || sIdLower.includes('bed') || nameLower.includes('yatak');
  const isSofa = sIdLower.startsWith('f-5') || sIdLower.startsWith('f-8') || sIdLower.includes('koltuk') || sIdLower.includes('sofa') || nameLower.includes('koltuk');
  const isTable = sIdLower.includes('masa') || sIdLower.includes('sehpa') || sIdLower.includes('table');
  const isChair = sIdLower.includes('sandalye') || sIdLower.includes('chair');
  const isKitchen = sIdLower === 'f-3' || sIdLower === 'f-4' || sIdLower.startsWith('f-3') || sIdLower.startsWith('f-4') || sIdLower.includes('mutfak') || sIdLower.includes('tezgah') || srcLower.includes('kitchen');
  // isWardrobe: f-12, f-12-f, f-13, f-13-f, f-7, f-7-f
  const isWardrobe = sIdLower.startsWith('f-12') || sIdLower.startsWith('f-13') || sIdLower === 'f-7' || sIdLower.startsWith('f-7') || sIdLower.includes('gardırop') || sIdLower.includes('gardrop') || nameLower.includes('gardırop') || nameLower.includes('dolap');
  const isCabinet = !isWardrobe && (sIdLower.includes('dolap') || nameLower.includes('dolap'));
  const isTV = sIdLower.includes('tv') || sIdLower.includes('televizyon') || sIdLower.includes('ekran');
  
  // Flat floor items (roads, carpets, tracks, fingerprints, ruler, etc.)
  const isFloorItem = sIdLower.startsWith('f-9') || sIdLower.startsWith('f-10') || sIdLower.startsWith('f-11') || sIdLower.includes('halı') || sIdLower.includes('carpet') || sIdLower.startsWith('st-1') || sIdLower.startsWith('st-2') || sIdLower.startsWith('st-3') || sIdLower.startsWith('st-4') || sIdLower.startsWith('tr-2') || sIdLower.startsWith('tr-3') || sIdLower.includes('iz') || sIdLower.includes('rögar') || sIdLower.includes('zebra') || sIdLower.includes('gecit') || sIdLower.includes('geçit');

  // Interactive 3D Objects
  const isVehicle = sIdLower.startsWith('v-') || sIdLower.includes('car') || sIdLower.includes('sedan') || sIdLower.includes('suv') || sIdLower.includes('truck') || sIdLower.includes('bus') || sIdLower.includes('motor') || sIdLower.includes('police') || sIdLower.includes('ambulance') || sIdLower.includes('itfaiye') || sIdLower.includes('kepçe') || nameLower.includes('araç') || nameLower.includes('otomobil') || nameLower.includes('kamyon') || nameLower.includes('motosiklet') || nameLower.includes('otobüs') || nameLower.includes('ambulans') || nameLower.includes('polis') || nameLower.includes('itfaiye') || nameLower.includes('kepçe') || nameLower.includes('traktör') || nameLower.includes('çekici') || nameLower.includes('araba') || nameLower.includes('taksi') || nameLower.includes('minibüs');
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
    return <Door3D x={x} y={y} width={width} h={(actualObj.zHeight || 210) * SCALE} rad={rad} thickness={currentWallThickness} zOffset={yOff} />;
  }
  if (isWindow(effSymbolId)) {
    const rawZHeight = actualObj.zHeight || 120;
    const rawSillH = Math.max(0, (actualObj.sillH || (125 - rawZHeight / 2)));
    return <Window3D x={x} y={y} width={width} h={rawZHeight * SCALE} rad={rad} sillH={rawSillH * SCALE} thickness={currentWallThickness} zOffset={yOff} />;
  }
  if (isTraj) {
    return (
      <Suspense fallback={null}>
        <ShootingTrajectory3D obj={obj} realObj={actualObj} allWalls={allWalls} visualObjects={visualObjects} uploadedImages={uploadedImages} />
      </Suspense>
    );
  }

  // 5. Texture Prep
  const isabetIziImg = uploadedImages?.find((img: any) => {
    if (!img || typeof img.name !== 'string') return false;
    const name = img.name.toLowerCase().replace(/[-_\s]/g, '');
    return name === 'isabetizipng' || name === 'isabetizi';
  });

  let textureSrcRaw = (src && typeof src === 'string' && !src.startsWith('data:text')) ? src : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  
  if (sIdLower === 'tr-bullet-glass' && isabetIziImg?.src && typeof isabetIziImg.src === 'string' && isabetIziImg.src.trim() !== '') {
    textureSrcRaw = isabetIziImg.src;
  }

  const textureSrc = textureSrcRaw.startsWith('data:image/svg+xml') ? textureSrcRaw.replace(/#/g, '%23') : textureSrcRaw;
  const autoHeight = getStandardHeight(effSymbolId);

  // 6. Volumetric Rendering
  if (isImpactMark) {
    const pngSrc = sIdLower === 'tr-bullet-wall'
      ? '/assets/symbols/bullet_hole_2.png'
      : '/assets/symbols/bullet_hole_1.png';
    return (
      <GlassImpact3D
        textureSrc={pngSrc}
        zHeight={zHeight || 120}
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

  if (isHuman) return (
    <group position={[posX, totalOffset, posZ]} rotation={[0, rad, 0]}>
      <Humanoid3D obj={actualObj} zOffset={0} />
    </group>
  );

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
  if (isVehicle) return <Vehicle3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} type={sIdLower + ' ' + nameLower} fill={fill} zOffset={yOff} zHeight={actualObj.zHeight} />;
  if (isTree) return <Tree3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} type={sIdLower} zOffset={yOff} />;
  if (isCone) return <TrafficCone3D x={posX} y={posZ} zOffset={yOff} />;
  if (isBarrier) return <SecurityBarrier3D x={posX} y={posZ} width={finalW} rad={rad} zOffset={yOff} />;
  if (isHydrant) return <FireHydrant3D x={posX} y={posZ} zOffset={yOff} />;
  if (isPole) return <UtilityPole3D x={posX} y={posZ} zOffset={yOff} />;
  if (isBench) return <Bench3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} zOffset={yOff} />;
  if (isTrafficSign) return <TrafficSign3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} type={sIdLower} textureSrc={textureSrc} zOffset={yOff} />;

  if (isFloorItem) return <FloorItem3D x={posX} y={posZ} width={finalW} height={finalH} rad={rad} textureSrc={textureSrc} zOffset={totalOffset} />;

  return <SymbolWithTexture x={posX} y={posZ} width={finalW} height={finalH} rad={rad} fill={fill} textureSrc={textureSrc} zHeight={(actualObj.zHeight || autoHeight) * SCALE} isVertical={actualObj.isVertical} isWound={isWound} zOffset={yOff} />;
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

  const handleFrontClick = (e: any) => {
    e.stopPropagation();
    e.nativeEvent?.stopPropagation?.();
    const p = e.point;
    if (!p) return;
    // Transform world hit point to local X of this group (rotated by rad)
    const dx = p.x - x;
    const dz = p.z - y;
    const cos = Math.cos(-rad);
    const sin = Math.sin(-rad);
    const localX = dx * cos - dz * sin;
    const doorStartX = -w / 2 + frameT;
    const relX = localX - doorStartX;
    const idx = Math.floor(relX / doorW);
    if (idx >= 0 && idx < numDoors) {
      toggleDoor(idx, e);
    }
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
      {/* Invisible click plane across all doors — unified hit detection */}
      <mesh 
        onClick={handleFrontClick}
        position={[0, h / 2, d / 2]}
        renderOrder={-1}
      >
        <planeGeometry args={[w - frameT * 2, h - frameT * 2]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
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
              <mesh position={[panelOffsetX, 0, 0.8 * SCALE]} castShadow>
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

      {/* Invisible click plane on front face */}
      <mesh onClick={handleOpenClose} position={[0, h / 2, d / 2]} renderOrder={-1}>
        <planeGeometry args={[w - frameT * 2, h - frameT * 2]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Left Door */}
      <group position={[-w / 2, h / 2, d / 2]}>
        <group rotation={[0, open ? -Math.PI * 0.5 : 0, 0]}>
          <mesh position={[w / 4, 0, 0]} castShadow>
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
          <mesh position={[-w / 4, 0, 0]} castShadow>
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
  const w = width; // already scaled
  const d = height; // already scaled
  return (
    <group position={[x, 0.05 + (zOffset || 0), y]} rotation={[0, rad, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={tMain} transparent alphaTest={0.05} />
      </mesh>
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
const GlassImpact3D = ({ textureSrc, zHeight }: any) => {
  const tex = useTexture(textureSrc) as THREE.Texture;

  const hUnits = (zHeight || 120) * SCALE;
  const size = 35 * SCALE; // 70cm x 70cm — cam yüzünde rahatça görünür

  return (
    <group position={[0, hUnits, 0]}>
      <mesh position={[0, 0, 0]} renderOrder={999}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          map={tex}
          transparent
          alphaTest={0.01}
          side={THREE.DoubleSide}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
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

  const bodyColor = fill || "#ffffff";
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

const Vehicle3D = ({ x, y, width, height, rad, type, fill, zOffset, zHeight }: any) => {
  const isVerticalIn2D = height > width;
  const w = isVerticalIn2D ? height : width;
  const d = isVerticalIn2D ? width : height;
  const adjustedRad = isVerticalIn2D ? rad - Math.PI / 2 : rad;

  const typeLower = (type || '').toLowerCase();
  
  let color = fill || "#34495e";
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

  let bodyH = (isTruck ? 80 : isBus ? 110 : 50) * SCALE * heightScale;
  let cabinH = (isTruck ? 70 : isBus ? 0 : 40) * SCALE * heightScale;
  let groundClearance = (isTruck ? 25 : isBus ? 20 : isMotorcycle ? 20 : 15) * SCALE * heightScale;
  const wheelR = (isTruck ? 22 : isBus ? 22 : isMotorcycle ? 20 : 18) * SCALE * heightScale;
  const wheelW = (isTruck ? 12 : isBus ? 12 : isMotorcycle ? 8 : 10) * SCALE * heightScale;

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
      // SUV / Ambulance Lower Body Profile (Clockwise)
      shape.moveTo(-w / 2, groundClearance);
      shape.lineTo(-w / 2, groundClearance + bodyH);
      shape.lineTo(w * 0.25, groundClearance + bodyH);
      shape.lineTo(w * 0.38, groundClearance + bodyH * 0.8);
      shape.lineTo(w * 0.5, groundClearance + bodyH * 0.75);
      shape.lineTo(w * 0.5, groundClearance);
      shape.lineTo(-w / 2, groundClearance);
    } else {
      // Sedan Lower Body Profile (Clockwise)
      shape.moveTo(-w / 2, groundClearance);
      shape.lineTo(-w / 2, groundClearance + bodyH * 0.8);
      shape.lineTo(-w * 0.25, groundClearance + bodyH);
      shape.lineTo(w * 0.2, groundClearance + bodyH);
      shape.lineTo(w * 0.35, groundClearance + bodyH * 0.8);
      shape.lineTo(w * 0.5, groundClearance + bodyH * 0.75);
      shape.lineTo(w * 0.5, groundClearance);
      shape.lineTo(-w / 2, groundClearance);
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
    return (
      <group position={[x, zOffset || 0, y]} rotation={[0, adjustedRad, 0]}>
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
    );
  }

  const headlightR = 3 * SCALE;
  const taillightR = 2.5 * SCALE;

  return (
    <group position={[x, zOffset || 0, y]} rotation={[0, adjustedRad, 0]}>
      {/* Chassis */}
      <mesh position={[0, groundClearance - 2 * SCALE, 0]}>
        <boxGeometry args={[w * 0.98, 4 * SCALE, d * 0.98]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>

      {/* Extruded Body Shell */}
      <group position={[0, 0, -d / 2]}>
        <mesh castShadow receiveShadow>
          <extrudeGeometry args={[bodyProfileShape, extrudeSettings]} />
          <meshStandardMaterial color={color} metalness={0.6} roughness={0.15} />
        </mesh>
      </group>

      {/* Sedan Cabin Frame & Windshields */}
      {!isTruck && !isBus && !isMotorcycle && !isSUV && (
        <group>
          {/* Roof */}
          <mesh position={[-w * 0.025, groundClearance + bodyH + cabinH - 1 * SCALE, 0]} castShadow>
            <boxGeometry args={[w * 0.45, 2 * SCALE, d * 0.95]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.15} />
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
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.15} />
          </mesh>
          <mesh position={[w * 0.275, groundClearance + bodyH + cabinH * 0.5, -d / 2 + 0.15 * SCALE]} rotation={[0, 0, Math.PI / 4.5]}>
            <boxGeometry args={[w * 0.04, cabinH * 1.4, 1.5 * SCALE]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.15} />
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
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.15} />
          </mesh>
          <mesh position={[-w * 0.315, groundClearance + bodyH + cabinH * 0.5, -d / 2 + 0.15 * SCALE]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[w * 0.05, cabinH * 1.4, 1.5 * SCALE]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.15} />
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
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.15} />
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
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.15} />
          </mesh>
          <mesh position={[w * 0.387, groundClearance + bodyH + cabinH * 0.5, -d / 2 + 0.15 * SCALE]} rotation={[0, 0, Math.PI / 4.2]}>
            <boxGeometry args={[w * 0.04, cabinH * 1.4, 1.5 * SCALE]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.15} />
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
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.15} />
          </mesh>
          <mesh position={[-w * 0.485, groundClearance + bodyH + cabinH * 0.5, -d / 2 + 0.15 * SCALE]}>
            <boxGeometry args={[w * 0.04, cabinH * 0.95, 1.5 * SCALE]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.15} />
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
            <meshStandardMaterial color={color} metalness={0.7} roughness={0.15} />
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
            <meshStandardMaterial color={color} metalness={0.7} roughness={0.15} />
          </mesh>
          <mesh position={[w * 0.11, groundClearance + bodyH + cabinH * 0.6, 0]}>
            <boxGeometry args={[w * 0.025, cabinH * 0.5, d * 0.5]} />
            <meshPhysicalMaterial color="#1e3a4a" roughness={0.05} metalness={0.0} transparent opacity={0.85} side={THREE.DoubleSide} envMapIntensity={1.5} />
          </mesh>
          {/* A-Pillars (Front Frame) */}
          <mesh position={[w * 0.39, groundClearance + bodyH + cabinH * 0.5, d / 2 - 0.15 * SCALE]} rotation={[0, 0, Math.PI / 5]}>
            <boxGeometry args={[w * 0.04, cabinH * 1.3, 1.5 * SCALE]} />
            <meshStandardMaterial color={color} metalness={0.7} roughness={0.15} />
          </mesh>
          <mesh position={[w * 0.39, groundClearance + bodyH + cabinH * 0.5, -d / 2 + 0.15 * SCALE]} rotation={[0, 0, Math.PI / 5]}>
            <boxGeometry args={[w * 0.04, cabinH * 1.3, 1.5 * SCALE]} />
            <meshStandardMaterial color={color} metalness={0.7} roughness={0.15} />
          </mesh>
        </group>
      )}

      {/* Bus Cabin Structure */}
      {isBus && (
        <group>
          {/* Bus Roof */}
          <mesh position={[0, groundClearance + bodyH - 1 * SCALE, 0]} castShadow>
            <boxGeometry args={[w * 0.98, 2 * SCALE, d * 0.95]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.15} />
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
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.15} />
          </mesh>
          {/* Rear Right Corner Pillar */}
          <mesh position={[-w / 2 + 1 * SCALE, groundClearance + bodyH * 0.775, -d / 2 + 0.2 * SCALE]}>
            <boxGeometry args={[w * 0.03, bodyH * 0.45, 0.4 * SCALE]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.15} />
          </mesh>
          {/* Front Left Corner Pillar */}
          <mesh position={[w / 2 - 1 * SCALE, groundClearance + bodyH * 0.775, d / 2 - 0.2 * SCALE]}>
            <boxGeometry args={[w * 0.03, bodyH * 0.45, 0.4 * SCALE]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.15} />
          </mesh>
          {/* Front Right Corner Pillar */}
          <mesh position={[w / 2 - 1 * SCALE, groundClearance + bodyH * 0.775, -d / 2 + 0.2 * SCALE]}>
            <boxGeometry args={[w * 0.03, bodyH * 0.45, 0.4 * SCALE]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.15} />
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
              <meshStandardMaterial color={color} metalness={0.7} roughness={0.15} />
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
              <meshStandardMaterial color={color} metalness={0.7} roughness={0.15} />
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
              <meshStandardMaterial color={color} metalness={0.7} roughness={0.15} />
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
              <meshStandardMaterial color={color} metalness={0.7} roughness={0.15} />
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
              <meshStandardMaterial color={color} metalness={0.7} roughness={0.15} />
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
              <meshStandardMaterial color={color} metalness={0.7} roughness={0.15} />
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
              <meshStandardMaterial color={color} metalness={0.7} roughness={0.15} />
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
              <meshStandardMaterial color={color} metalness={0.7} roughness={0.15} />
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

      {/* High-Fidelity Wheels */}
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
          <mesh castShadow>
            <cylinderGeometry args={[wheelR, wheelR, wheelW, 24]} />
            <meshStandardMaterial color="#151515" roughness={0.9} />
          </mesh>
          <mesh position={[0, wheelW * 0.1, 0]}>
            <cylinderGeometry args={[wheelR * 0.6, wheelR * 0.6, wheelW * 0.9, 16]} />
            <meshStandardMaterial color="#dcdde1" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[0, wheelW * 0.2, 0]}>
            <cylinderGeometry args={[wheelR * 0.15, wheelR * 0.15, wheelW * 0.9, 6]} />
            <meshStandardMaterial color="#2f3640" metalness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Headlights */}
      <mesh position={[w * 0.5 - 1 * SCALE, groundClearance + bodyH * 0.35, d * 0.35]}>
        <sphereGeometry args={[headlightR, 12, 12]} />
        <meshBasicMaterial color="#ffffcc" />
      </mesh>
      <mesh position={[w * 0.5 - 1 * SCALE, groundClearance + bodyH * 0.35, -d * 0.35]}>
        <sphereGeometry args={[headlightR, 12, 12]} />
        <meshBasicMaterial color="#ffffcc" />
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

      {/* Taillights */}
      <mesh position={[-w * 0.5 + 1 * SCALE, groundClearance + bodyH * 0.4, d * 0.35]}>
        <boxGeometry args={[2 * SCALE, taillightR * 2, taillightR * 2]} />
        <meshBasicMaterial color="#ff3333" />
      </mesh>
      <mesh position={[-w * 0.5 + 1 * SCALE, groundClearance + bodyH * 0.4, -d * 0.35]}>
        <boxGeometry args={[2 * SCALE, taillightR * 2, taillightR * 2]} />
        <meshBasicMaterial color="#ff3333" />
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

const InteractiveSymbol = React.memo(({ obj, onSelect, isSelected, stageWidth, stageHeight, wallThickness, allWalls, visualObjects, uploadedImages }: any) => {
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
          <Symbol3D obj={{...obj, x: 0, y: 0, rotation: 0}} realObj={obj} wallThickness={wallThickness} allWalls={allWalls} visualObjects={visualObjects} uploadedImages={uploadedImages} />
        </group>
      </group>
    </>
  );
});


const SceneCaptureController = ({ onCaptureRef }: { onCaptureRef: React.MutableRefObject<any> }) => {
  const { gl, scene, camera } = useThree();
  
  useEffect(() => {
    onCaptureRef.current = {
      takeScreenshot: () => {
        gl.render(scene, camera);
        return gl.domElement.toDataURL('image/png');
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
    const r = (wall.rotation || 0) * (Math.PI / 180);
    return {
      x: dx * Math.cos(-r) - dy * Math.sin(-r),
      y: dx * Math.sin(-r) + dy * Math.cos(-r)
    };
  };

  const fromLocal = (lx: number, ly: number, wall: any, centerX: number, centerY: number, scale: number) => {
    const r = (wall.rotation || 0) * (Math.PI / 180);
    const wX = (wall.cx - centerX) * scale;
    const wY = (wall.cy - centerY) * scale;
    return {
      x: wX + lx * Math.cos(r) - ly * Math.sin(r),
      z: wY + lx * Math.sin(r) + ly * Math.cos(r)
    };
  };

  const { visualObjects, allWalls, wallThickness } = useMemo(() => {
    const scale = SCALE;
    const thickness = ((visualSettings as any)?.wallThickness || 10) * scale;
    
    // Fixed Origin for Absolute Parity: Anchor to stage center to prevent drift
    const centerX = stageWidth / 2;
    const centerY = stageHeight / 2;

    const objectsWithCenters = objects.map((o: any) => {
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
        processedWalls.push({ ...w, id: `${w.id}-t`, cx: rotate(wW/2, 0).x, cy: rotate(wW/2, 0).y, width: wW + 10, height: 10, rotation: w.rotation, symbolId: 'arch-w1-fake' });
        processedWalls.push({ ...w, id: `${w.id}-b`, cx: rotate(wW/2, wH).x, cy: rotate(wW/2, wH).y, width: wW + 10, height: 10, rotation: w.rotation, symbolId: 'arch-w1-fake' });
        processedWalls.push({ ...w, id: `${w.id}-l`, cx: rotate(0, wH/2).x, cy: rotate(0, wH/2).y, width: wH + 10, height: 10, rotation: w.rotation + 90, symbolId: 'arch-w1-fake' });
        processedWalls.push({ ...w, id: `${w.id}-r`, cx: rotate(wW, wH/2).x, cy: rotate(wW, wH/2).y, width: wH + 10, height: 10, rotation: w.rotation + 90, symbolId: 'arch-w1-fake' });
      } else {
        processedWalls.push({ ...w });
      }
    });

    const openingsWithWalls = openings.map((op: any) => {
      let bestWallId = null;
      let minLY = 250;
      processedWalls.forEach((wall: any) => {
        const local = toLocal(op, wall, scale);
        const { width: wWidthRaw } = getEffectiveSize(wall);
        const rotDiff = Math.abs(((wall.rotation || 0) - (op.rotation || 0)) % 180);
        const rotationMatch = rotDiff < 20 || rotDiff > 160;
        const wWidth = wWidthRaw * scale;
        if (rotationMatch && Math.abs(local.x) < (wWidth/2 + 20) && Math.abs(local.y) < minLY) {
          minLY = Math.abs(local.y);
          bestWallId = wall.id;
        }
      });
      return { ...op, bestWallId };
    });

    const finalWalls: any[] = [];
    processedWalls.forEach((wall: any) => {
      const { width: wallWidthRaw } = getEffectiveSize(wall);
      const wX = (wall.cx - centerX) * scale;
      const wY = (wall.cy - centerY) * scale;
      const wWidth = wallWidthRaw * scale;
      const wHeight = thickness; 
      const wRad = (wall.rotation || 0) * (Math.PI / 180);
      const wallOpenings = openingsWithWalls.filter((op: any) => op.bestWallId === wall.id)
        .map((op: any) => {
          const local = toLocal(op, wall, scale);
          const { width: opWidthRaw } = getEffectiveSize(op);
          const isD = isDoor(op);
          return { ...op, localX: local.x, localY: local.y, effectiveWidth: (isD ? 80 : opWidthRaw) * scale };
        })
        .sort((a: any, b: any) => a.localX - b.localX);

      if (wallOpenings.length === 0) {
        finalWalls.push({ ...wall, x: wX, y: wY, width: wWidth, height: wHeight, h: 250, yOffset: 0 });
      } else {
        const wallH = 250;
        let currentX = -wWidth / 2;
        wallOpenings.forEach((op: any, idx: number) => {
          const opW = op.effectiveWidth;
          const gapStart = op.localX - opW / 2;
          const gapEnd = op.localX + opW / 2;
          if (gapStart > currentX + 0.1) {
            const segW = gapStart - currentX; 
            const segCenterX = currentX + segW / 2;
            finalWalls.push({ ...wall, id: `${wall.id}-seg-${idx}`, x: wX + segCenterX * Math.cos(wRad), y: wY + segCenterX * Math.sin(wRad), width: segW, height: wHeight, h: wallH, yOffset: 0 });
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
              h: rawSillH, 
              yOffset: 0 
            });
          }
          currentX = gapEnd;
        });
        if (currentX < wWidth / 2 - 0.1) {
          const segW = wWidth / 2 - currentX;
          const segCenterX = currentX + segW / 2;
          finalWalls.push({ ...wall, id: `${wall.id}-final`, x: wX + segCenterX * Math.cos(wRad), y: wY + segCenterX * Math.sin(wRad), width: segW, height: wHeight, h: wallH, yOffset: 0 });
        }
      }
    });

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

      let fX = (obj.cx - centerX) * scale;
      let fY = (obj.cy - centerY) * scale;
      let fRot = obj.rotation || 0;
      
      if (isAperture) {
        let bestWall = null;
        let minDist = 125;
        for (const wall of processedWalls) {
          const local = toLocal(obj, wall, scale);
          const { width: wWidthRaw } = getEffectiveSize(wall);
          const wW = wWidthRaw * scale;
          const rotDiff = Math.abs(((wall.rotation || 0) - (obj.rotation || 0)) % 180);
          if (local.x > -wW/2 - 10 && local.x < wW/2 + 10 && Math.abs(local.y) < minDist && (rotDiff < 20 || rotDiff > 160)) {
            minDist = Math.abs(local.y);
            bestWall = { wall, local };
          }
        }
        if (bestWall) {
          const pos = fromLocal(bestWall.local.x, 0, bestWall.wall, centerX, centerY, scale);
          fX = pos.x; fY = pos.z; fRot = bestWall.wall.rotation || 0;
        }
      }
      
      const isD = isDoor(obj);
      const isW_ap = isWindow(obj);
      const defaultZH = isD ? 210 : (isW_ap ? 120 : 0);
      
      return { 
        ...obj, x: fX, y: fY, rotation: fRot,
        width: (isD ? 80 : effW) * scale, height: (isD ? 60 : effH) * scale,
        zHeight: (obj.zHeight !== undefined) ? obj.zHeight : defaultZH, 
        yOffset: obj.yOffset || 0
      };
    });

    return { visualObjects: resolvedObjects, allWalls: finalWalls, wallThickness: thickness };
  }, [objects, stageWidth, stageHeight, visualSettings]);

  const { scene } = useThree();
  useEffect(() => {
    (window as any).export3DScene = () => {
      const exporter = new GLTFExporter();
      exporter.parse(scene, (result: any) => {
        const output = result instanceof ArrayBuffer ? result : JSON.stringify(result);
        const blob = new Blob([output], { type: result instanceof ArrayBuffer ? 'model/gltf-binary' : 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Forensic_Scene_${new Date().getTime()}.glb`;
        link.click();
      }, { binary: true });
    };
  }, [scene]);

  return (
    <>
      <SceneCaptureController onCaptureRef={onCaptureRef} />
      <PerspectiveCamera makeDefault position={[0, 400, 400]} fov={50} />
      {viewMode === 'orbit' ? (
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} />
      ) : (
        <Player isWalkMode={true} />
      )}
      <Environment preset="city" />
      <ambientLight intensity={0.5} />
      <directionalLight position={[100, 200, 100]} intensity={1} castShadow />
      
      <group>
        {allWalls.map((wall: any, idx: number) => (
          <SafeComponent key={wall.id || `wall-${idx}`}>
            <Symbol3D obj={wall} wallThickness={wallThickness} uploadedImages={uploadedImages} />
          </SafeComponent>
        ))}
        {/* Standard Objects Pass */}
        {visualObjects.filter((o: any) => {
          const sId = o.symbolId?.toLowerCase() || '';
          const hasParent = !!o.parentId;
          const isAutoImpact = (sId === 'tr-bullet-wall' || sId === 'tr-bullet-glass') && hasParent;
          return !sId.includes('shooting') && !sId.includes('atış') && !sId.includes('ateş') && !isAutoImpact;
        }).map((obj: any) => (
          <SafeComponent key={obj.id}>
            <InteractiveSymbol 
              obj={obj} 
              isSelected={selectedId === obj.id} 
              onSelect={setSelectedId}
              stageWidth={stageWidth}
              stageHeight={stageHeight}
              wallThickness={wallThickness}
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
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[400 * SCALE, -0.1, 300 * SCALE]} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color="#ffffff" metalness={0.1} roughness={0.9} />
      </mesh>
      <gridHelper args={[2000, 100, "#cccccc", "#eeeeee"]} position={[400 * SCALE, -0.05, 300 * SCALE]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[100, 200, 100]} intensity={1} castShadow />
    </>
  );
};

export const ThreeDPreview: React.FC<ThreeDPreviewProps> = ({ isOpen, onClose }) => {
  const { objects, updateObject, addNotification } = useStore();
  const [viewMode, setViewMode] = useState<'orbit' | 'walk'>('orbit');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const captureRef = useRef<any>(null);
  const [capturedMedia, setCapturedMedia] = useState<{ id: string; type: 'photo' | 'video'; url: string; timestamp: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

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
      addNotification({
        type: 'success',
        message: 'Fotoğraf Çekildi',
        description: 'Olay yeri fotoğrafı başarıyla kaydedildi ve medyalarım albümüne eklendi.'
      });
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
        addNotification({
          type: 'success',
          message: 'Video Kaydedildi',
          description: 'Olay yeri gezi videosu başarıyla albüme kaydedildi.'
        });
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
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
      </div>
      <div className="flex-1 relative">
        <Canvas shadows gl={{ preserveDrawingBuffer: true }} camera={{ position: [0, 400, 400], fov: 50 }}>
          <Suspense fallback={null}>
            <Scene objects={objects} viewMode={viewMode} selectedId={selectedId} setSelectedId={setSelectedId} onCaptureRef={captureRef} />
          </Suspense>
        </Canvas>
        
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

        {/* Forensic AI Command Console */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[500px] max-w-[90%]">
          <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-1 flex items-center gap-2 ring-1 ring-white/5">
            <div className="flex-1 flex items-center gap-3 px-4">
              <Rotate3D size={16} className="text-[#3a7ca5]" />
              <input 
                type="text" 
                placeholder="Sahneyi düzenlemek için yazın... (Örn: 'ceset ekle', 'sil')"
                className="bg-transparent border-none outline-none text-white text-[13px] w-full py-3 font-medium placeholder:text-gray-600"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    processForensicCommand(
                      e.currentTarget.value, 
                      objects, 
                      selectedId, 
                      updateObject, 
                      (useStore.getState() as any).addObject, 
                      (useStore.getState() as any).removeObject
                    );
                    e.currentTarget.value = '';
                    // Command processed successfully
                  }
                }}
              />
            </div>
            <button className="bg-[#3a7ca5] text-white px-5 py-2.5 rounded-xl text-[11px] font-bold hover:bg-[#4a8cb5] transition-all">
              UYGULA
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
