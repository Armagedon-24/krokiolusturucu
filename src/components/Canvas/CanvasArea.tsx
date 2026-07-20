import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Text, Transformer, Rect, Arrow, Group, Line, Path, Circle, Ellipse, Arc, Label, Tag } from 'react-konva';
import { useStore } from '../../store/useStore';
import useImage from 'use-image';
import { 
  Trash2, 
  X, 
  Upload, 
  Target, 
  Grid, 
  Camera, 
  User, 
  Info,
  Activity
} from 'lucide-react';
import Konva from 'konva';
import { DistanceModal } from '../UI/DistanceModal';
import { EvidencePhotoModal } from '../UI/EvidencePhotoModal';
import { BodyMapModal } from '../UI/BodyMapModal';
import { FindingModal, PromptModal } from '../UI/Modal';
import { DistanceMatrixModal } from '../UI/DistanceMatrixModal';
import { AccidentAnimation } from './AccidentAnimation';
import { FallAnimationCanvas } from './FallAnimationCanvas';
import { PedestrianLaunchCanvas } from './PedestrianLaunchCanvas';
import { PageControlBar } from './PageControlBar';
import type { CanvasObject } from '../../types';

const RemoveWhiteFilter = (imageData: any) => {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // If pixel is white or very close to white (tolerance increased to 225), make it transparent
    if (r > 225 && g > 225 && b > 225) {
      data[i + 3] = 0;
    }
  }
};

import { v4 as uuidv4 } from 'uuid';
import { jsPDF } from 'jspdf';

import { calculateCalloutSize, getEffectiveZIndex, compressAndResizeImage } from '../../utils/canvasUtils';

const useSmartImage = (src: string | undefined) => {
  // Load without crossOrigin - works for data:, blob:, and most external URLs.
  // crossOrigin='anonymous' can cause issues when the image is cached without CORS headers.
  const [image] = useImage(src || '');
  return image;
};

const IndividualObject = ({ 
  shapeProps, 
  isSelected, 
  onSelect, 
  drawingArea, 
  onChange,
  isAdmin,
  allObjects,
  onDragMove,
  onDragEnd,
  onOpenDistanceModal,
  onMouseEnter,
  onMouseLeave,
  onTrajectoryUpdate,
}: any) => {
  // ─── ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS (Rules of Hooks) ───
  const [showTooltip, setShowTooltip] = useState(false);
  const groupRef = useRef<any>(null);
  const imgRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const image = useSmartImage(shapeProps?.src);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  useEffect(() => {
    if (imgRef.current && image) {
      try {
        imgRef.current.cache();
        imgRef.current.getLayer()?.batchDraw();
      } catch {
        // cache() failed (e.g. CORS). Image still renders without filters.
        try { imgRef.current.clearCache(); } catch { /* ignore */ }
        imgRef.current.getLayer()?.batchDraw();
      }
    }
  }, [image, shapeProps?.fill, shapeProps?.scaleX, shapeProps?.scaleY, shapeProps?.width, shapeProps?.height, shapeProps?.categoryId, shapeProps?.symbolId]);

  // Force redraw when visual properties change to ensure instant visual updates
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.getLayer()?.batchDraw();
    }
  }, [shapeProps.distance, shapeProps.distanceColor, shapeProps.distanceFontSize, shapeProps.fill, shapeProps.strokeWidth, shapeProps.opacity, shapeProps.text, shapeProps.width, shapeProps.height]);

  useEffect(() => {
    if (image && shapeProps.type === 'image' && !shapeProps.ratioFixed) {
      const isWallH = shapeProps.symbolId === 'arch-w1' || shapeProps.symbolId === 'arch-w1i';
      const isWallV = shapeProps.symbolId === 'arch-w1v' || shapeProps.symbolId === 'arch-w1vi';
      const isWindow = shapeProps.symbolId === 'arch-win';
      const ratio = image.width / image.height;
      
      let initialWidth, initialHeight;
      const maxSize = 120;

      if (isWallH) {
        initialWidth = 200;
        initialHeight = 10;
      } else if (isWallV) {
        initialWidth = 10;
        initialHeight = 200;
      } else if (isWindow) {
        // Pencereler için varsayılan: boy 50, en 10
        initialWidth = 50;
        initialHeight = 10;
      } else if (['arch-d1r', 'arch-d1l', 'arch-d2'].includes(shapeProps.symbolId || '')) {
        // Kapılar için standart başlangıç boyutu
        initialWidth = 60;
        initialHeight = 60;
      } else {
        // Diğer tüm mimari ve sokak objeleri için (kapılar, merdivenler, binalar)
        // En geniş kenarı maxSize (120px) yap ve oranı koru
        if (ratio > 1) {
          initialWidth = maxSize;
          initialHeight = maxSize / ratio;
        } else {
          initialHeight = maxSize;
          initialWidth = maxSize * ratio;
        }
      }

      onChange({
        ...shapeProps,
        width: initialWidth,
        height: initialHeight,
        ratioFixed: true // Oranı bir kez hesapla ve sabitle
      });
    }
  }, [image, shapeProps.ratioFixed]);

  const isNativeArrow = shapeProps.isDistanceArrow || shapeProps.symbolId === 'a-4' || shapeProps.symbolId === 'a-5';

  // Kurumsal logo sığdırma ve oran koruma mantığı
  useEffect(() => {
    if (image && shapeProps.id === 'corporate-logo' && !shapeProps.logoAdjusted) {
      const containerW = shapeProps.width;
      const containerH = shapeProps.height;
      const imgRatio = image.width / image.height;
      const containerRatio = containerW / containerH;

      let newW = containerW;
      let newH = containerH;

      if (imgRatio > containerRatio) {
        // Görsel daha geniş, genişliği baz al
        newH = containerW / imgRatio;
      } else {
        // Görsel daha dar, yüksekliği baz al
        newW = containerH * imgRatio;
      }

      onChange({
        ...shapeProps,
        width: newW,
        height: newH,
        logoAdjusted: true // Sadece bir kez ayarla
      });
    }
  }, [image, shapeProps.id, shapeProps.logoAdjusted]);

  useEffect(() => {
    if (image && imgRef.current && shapeProps.id === 'corporate-logo') {
      imgRef.current.cache();
    }
  }, [image]);

  const handleTransformEnd = () => {
    const node = groupRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    node.scaleX(1);
    node.scaleY(1);
    
    if (shapeProps.type === 'text') {
      const newWidth = Math.max(20, node.width() * scaleX);
      const scale = Math.max(Math.abs(scaleX), Math.abs(scaleY));
      const newFontSize = Math.max(2, (shapeProps.fontSize || 20) * scale);
      
      onChange({
        ...shapeProps,
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: newWidth,
        fontSize: newFontSize,
        scaleX: 1,
        scaleY: 1,
      });
    } else {
      const updates: any = {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: Math.max(1, shapeProps.width * scaleX),
        height: Math.max(1, shapeProps.height * scaleY),
      };

      // Eğer objenin bir açıklaması/mesafesi varsa, yazı boyutunu da ölçekle
      // NOT: Kullanıcı isteği üzerine 'a-4' (Mesafe Oku) için yazı boyutu sabit kalmalı
      if (shapeProps.distance !== undefined && shapeProps.symbolId !== 'a-4' && !shapeProps.isDistanceArrow) {
        const scale = Math.max(Math.abs(scaleX), Math.abs(scaleY));
        updates.distanceFontSize = Math.max(2, (shapeProps.distanceFontSize || 14) * scale);
      }

      onChange({
        ...shapeProps,
        ...updates
      });
    }
  };

  const isStretchable = 
    shapeProps.type === 'rect' || 
    shapeProps.type === 'line' || 
    shapeProps.type === 'text' ||
    shapeProps.type === 'finding-list' ||
    isNativeArrow ||
    // Mimari, sokak ve ölçü araçları sündürülebilir olmalı
    (
      shapeProps.symbolId?.startsWith('arch-') || 
      shapeProps.symbolId?.startsWith('st-') || 
      shapeProps.symbolId?.startsWith('ev-') ||
      shapeProps.symbolId === 'ev-rope' ||
      shapeProps.symbolId === 'ev-noose' ||
      shapeProps.categoryId === 'outdoor' ||
      shapeProps.categoryId === 'arrows' ||
      shapeProps.categoryId === 'furniture' ||
      ['arch-1', 'arch-1v', 'arch-6', 'arch-6l', 'arch-6u', 'arch-6s', 'arch-6sf',
       'arch-6-spiral-f', 'arch-6-spiral-s', 'arch-6-spiral-s-top',
       'st-1', 'st-2', 'st-3', 'st-4', 
       'ev-arrow-l', 'ev-arrow-r', 'ev-arrowhead',
       'ev-ruler-straight', 'ev-ruler-l', 'ev-rect-hollow'
      ].includes(shapeProps.symbolId || '') ||
      shapeProps.categoryId === 'injuries' ||
      shapeProps.symbolId === 'p-10' ||
      shapeProps.symbolId === 'p-11' ||
      shapeProps.symbolId === 'p-12' ||
      shapeProps.symbolId?.startsWith('in-blood-') ||
      shapeProps.categoryId === 'explosion' ||
      shapeProps.categoryId === 'traces'
    );

  // Guard conditions checked after all hooks are called
  if (!shapeProps) return null;
  // Bulgu Listesi için özel durum: Eğer hiç bulgu yoksa tabloyu gizle
  if (shapeProps.type === 'finding-list' && !allObjects?.some((o: CanvasObject) => o.findingNo)) {
    return null;
  }

  return (
    <React.Fragment>
      <Group
        ref={groupRef}
        x={shapeProps.x}
        y={shapeProps.y}
        rotation={shapeProps.rotation}
        width={shapeProps.width}
        height={shapeProps.type === 'text' || shapeProps.type === 'finding-list' ? undefined : shapeProps.height}
        draggable={!shapeProps.isTemplate || (shapeProps.id === 'corporate-logo' && isAdmin) || shapeProps.type === 'finding-list'}
        listening={!shapeProps.isTemplate || (shapeProps.id === 'corporate-logo' && isAdmin) || shapeProps.type === 'finding-list'}
        onDragMove={(e) => {
          if (onDragMove) onDragMove(e);
          
          // Mimari Snapping (Kapı/Pencere rotasyonunu duvara uydur)
          const isSnapTarget = ['arch-d1r', 'arch-d1l', 'arch-win', 'arch-d2'].includes(shapeProps.symbolId || '');
          const isWall = ['arch-w1', 'arch-w1v', 'arch-w1i', 'arch-w1vi', 'arch-w-square'].includes(shapeProps.symbolId || '');

          if (allObjects && e.target === groupRef.current) {
            const threshold = 15; // Snapping etki alanı
            const myX = e.target.x();
            const myY = e.target.y();

            if (isSnapTarget) {
              for (const other of allObjects) {
                if (other.id === shapeProps.id) continue;
                const isOtherWall = ['arch-w1', 'arch-w1v', 'arch-w1i', 'arch-w1vi', 'arch-w-square'].includes(other.symbolId || '');
                if (!isOtherWall) continue;

                const dx = myX - other.x;
                const dy = myY - other.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist < 100) {
                  const isWallVertical = other.symbolId?.includes('v');
                  const wallBaseRot = (other.rotation || 0);
                  const wallLineAngle = (wallBaseRot + (isWallVertical ? 90 : 0)) % 360;
                  const currentRot = (e.target.rotation() % 360 + 360) % 360;
                  const relAngle = (currentRot - wallLineAngle + 360) % 360;
                  let targetRot = wallLineAngle;
                  if (relAngle > 90 && relAngle < 270) targetRot = (wallLineAngle + 180) % 360;
                  e.target.rotation(targetRot);
                  break;
                }
              }
            } else if (isWall) {
              // Duvar-Duvar Yapışma (Uç uca ekleme)
              for (const other of allObjects) {
                if (other.id === shapeProps.id) continue;
                const isOtherWall = ['arch-w1', 'arch-w1v', 'arch-w1i', 'arch-w1vi', 'arch-w-square'].includes(other.symbolId || '');
                if (!isOtherWall) continue;

                // Diğer duvarın köşelerini hesapla
                const oW = other.width || 0;
                const oH = other.height || 0;
                const oRad = (other.rotation || 0) * (Math.PI / 180);
                const oCos = Math.cos(oRad);
                const oSin = Math.sin(oRad);

                const otherCorners = [
                  { x: other.x, y: other.y }, // Start
                  { x: other.x + oW * oCos, y: other.y + oW * oSin }, // End-Width
                  { x: other.x - oH * oSin, y: other.y + oH * oCos }, // End-Height
                  { x: other.x + oW * oCos - oH * oSin, y: other.y + oH * oSin + oH * oCos } // Opposite
                ];

                for (const corner of otherCorners) {
                  const dx = myX - corner.x;
                  const dy = myY - corner.y;
                  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
                    e.target.x(corner.x);
                    e.target.y(corner.y);
                    return; // Snap gerçekleşti
                  }
                }
              }
            }
          }
        }}
        onDragEnd={(e) => {
          if (onDragEnd) onDragEnd(e);
          if (e.target !== groupRef.current) return;
          onChange({
            ...shapeProps,
            x: e.target.x(),
            y: e.target.y(),
            rotation: e.target.rotation(), // Rotasyonu da kaydet (snap desteği için)
          });
          e.target.getLayer()?.batchDraw();
        }}
        onMouseEnter={(e) => {
          if (['ev-bpa-drop', 'ev-camera-link'].includes(shapeProps.symbolId) || (shapeProps.photos && shapeProps.photos.length > 0)) {
            setShowTooltip(true);
            if (onMouseEnter) onMouseEnter(e);
          }
          const container = e.target.getStage()?.container();
          if (container) {
            container.style.cursor = ((shapeProps.id === 'corporate-logo' && isAdmin) || shapeProps.type === 'finding-list') ? 'pointer' : 'move';
          }
        }}
        onMouseLeave={(e) => {
          setShowTooltip(false);
          if (onMouseLeave) onMouseLeave(e);
          const container = e.target.getStage()?.container();
          if (container) {
            container.style.cursor = 'default';
          }
        }}
        clipX={!shapeProps.isTemplate && drawingArea && !isSelected ? drawingArea.x - shapeProps.x : undefined}
        clipY={!shapeProps.isTemplate && drawingArea && !isSelected ? drawingArea.y - shapeProps.y : undefined}
        clipWidth={!shapeProps.isTemplate && drawingArea && !isSelected ? drawingArea.width : undefined}
        clipHeight={!shapeProps.isTemplate && drawingArea && !isSelected ? drawingArea.height : undefined}
        dragBoundFunc={(pos) => {
          let newX = pos.x;
          let newY = pos.y;

          if (drawingArea && !shapeProps.isTemplate) {
            // Grid Snapping (20px) - Önce grid'e oturt
            const gridSize = 10; // Daha hassas bir grid
            newX = Math.round((newX - drawingArea.x) / gridSize) * gridSize + drawingArea.x;
            newY = Math.round((newY - drawingArea.y) / gridSize) * gridSize + drawingArea.y;
          }

          // Road & Wall Snapping Logic
          const isRoad = shapeProps.symbolId?.startsWith('st-') && ['st-1', 'st-2', 'st-3', 'st-4'].includes(shapeProps.symbolId);
          const isWall = ['arch-w1', 'arch-w1v', 'arch-w1i', 'arch-w1vi'].includes(shapeProps.symbolId || '');
          const isSnapTarget = ['arch-d1r', 'arch-d1l', 'arch-win', 'arch-d2'].includes(shapeProps.symbolId || '');

          if ((isRoad || isWall || isSnapTarget) && allObjects) {
            const threshold = 20;
            for (const other of allObjects) {
              if (other.id === shapeProps.id) continue;
              
              const isOtherRoad = other.symbolId?.startsWith('st-');
              const isOtherWall = other.symbolId === 'arch-1' || other.symbolId === 'arch-1v';

              if (isRoad && isOtherRoad) {
                // Road to Road Snapping
                const otherW = other.width || 0;
                const otherH = other.height || 0;
                const myW = shapeProps.width || 0;
                const myH = shapeProps.height || 0;

                if (Math.abs(newX - other.x) < threshold) newX = other.x;
                else if (Math.abs(newX - (other.x + otherW)) < threshold) newX = other.x + otherW;
                else if (Math.abs((newX + myW) - other.x) < threshold) newX = other.x - myW;
                else if (Math.abs((newX + myW) - (other.x + otherW)) < threshold) newX = other.x + otherW - myW;

                if (Math.abs(newY - other.y) < threshold) newY = other.y;
                else if (Math.abs(newY - (other.y + otherH)) < threshold) newY = other.y + otherH;
                else if (Math.abs((newY + myH) - other.y) < threshold) newY = other.y - myH;
                else if (Math.abs((newY + myH) - (other.y + otherH)) < threshold) newY = other.y + otherH - myH;
                
                if (Math.abs((newX + myW/2) - (other.x + otherW/2)) < threshold) newX = other.x + otherW/2 - myW/2;
                if (Math.abs((newY + myH/2) - (other.y + otherH/2)) < threshold) newY = other.y + otherH/2 - myH/2;
              } else if ((isWall || isSnapTarget) && isOtherWall) {
                // Wall to Wall Endpoint Snapping (Advanced Geometric Magnet)
                const otherW = other.width || 0;
                const otherRad = (other.rotation || 0) * (Math.PI / 180);
                const myW = shapeProps.width || 0;
                const myRad = (shapeProps.rotation || 0) * (Math.PI / 180);

                const threshold = 25; // Daha güçlü mıknatıslanma

                // Other wall endpoints
                const oP1 = { x: other.x, y: other.y };
                const oP2 = { 
                  x: other.x + otherW * Math.cos(otherRad), 
                  y: other.y + otherW * Math.sin(otherRad) 
                };

                if (isWall) {
                  // Current wall candidate endpoints (based on current newX, newY)
                  const mP1 = { x: newX, y: newY };
                  const mP2 = { 
                    x: newX + myW * Math.cos(myRad), 
                    y: newY + myW * Math.sin(myRad) 
                  };

                  const dist = (p1: any, p2: any) => Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);

                  // 4 Snapping combinations
                  if (dist(mP1, oP1) < threshold) {
                    newX = oP1.x; newY = oP1.y;
                  } else if (dist(mP1, oP2) < threshold) {
                    newX = oP2.x; newY = oP2.y;
                  } else if (dist(mP2, oP1) < threshold) {
                    newX = oP1.x - myW * Math.cos(myRad);
                    newY = oP1.y - myW * Math.sin(myRad);
                  } else if (dist(mP2, oP2) < threshold) {
                    newX = oP2.x - myW * Math.cos(myRad);
                    newY = oP2.y - myW * Math.sin(myRad);
                  }
                } else {
                  // Door/Window Snap to Wall Line Center
                  const wallCenterX = (oP1.x + oP2.x) / 2;
                  const wallCenterY = (oP1.y + oP2.y) / 2;
                  
                  const myH = shapeProps.height || 0;
                  const dx = newX + myW / 2 - wallCenterX;
                  const dy = newY + myH / 2 - wallCenterY;
                  if (Math.sqrt(dx*dx + dy*dy) < threshold * 2) {
                    newX = wallCenterX - myW / 2;
                    newY = wallCenterY - myH / 2;
                  }
                }
              }
            }
          }

          if (drawingArea && !shapeProps.isTemplate) {
            const w = shapeProps.width || 0;
            const h = (shapeProps.type === 'text' || shapeProps.type === 'finding-list') ? 20 : (shapeProps.height || 0);
            
            // Rotasyona göre gerçek boyutu hesapla (90/270 derece döndürülmüşse en/boy değişir)
            let actualW = w;
            let actualH = h;
            if (shapeProps.rotation && Math.abs(shapeProps.rotation % 180) === 90) {
              actualW = h;
              actualH = w;
            }

            // Katı sınır: sembolün tamamı çizim alanı içinde kalsın
            newX = Math.max(drawingArea.x, Math.min(newX, drawingArea.x + drawingArea.width - actualW));
            newY = Math.max(drawingArea.y, Math.min(newY, drawingArea.y + drawingArea.height - actualH));
          }
          
          return { x: newX, y: newY };
        }}
        onClick={() => {
          onSelect();
        }}
        onTap={() => {
          onSelect();
        }}
        onTransformEnd={(e) => {
          handleTransformEnd();
          e.target.getLayer()?.batchDraw();
        }}
      >
        {shapeProps.symbolId === 'ev-human-poseable' ? (
          // Professional Forensic Poseable Mannequin Engine (Joint-based)
          <Group>
            {(() => {
              const w = Number(shapeProps.width) || 200;
              const h = Number(shapeProps.height) || 400;
              // Default Joint Positions (scaled to width/height)
              const joints = (shapeProps.joints && Array.isArray(shapeProps.joints) && shapeProps.joints.length === 13) 
                ? shapeProps.joints 
                : [
                  { id: 'head', x: w/2, y: h*0.1 },        // 0
                  { id: 'neck', x: w/2, y: h*0.2 },        // 1
                  { id: 'l_shoulder', x: w*0.3, y: h*0.25 }, // 2
                  { id: 'r_shoulder', x: w*0.7, y: h*0.25 }, // 3
                  { id: 'l_elbow', x: w*0.2, y: h*0.45 },   // 4
                  { id: 'r_elbow', x: w*0.8, y: h*0.45 },   // 5
                  { id: 'l_wrist', x: w*0.15, y: h*0.65 },  // 6
                  { id: 'r_wrist', x: w*0.85, y: h*0.65 },  // 7
                  { id: 'pelvis', x: w/2, y: h*0.55 },     // 8
                  { id: 'l_knee', x: w*0.35, y: h*0.75 },   // 9
                  { id: 'r_knee', x: w*0.65, y: h*0.75 },   // 10
                  { id: 'l_ankle', x: w*0.35, y: h*0.95 },  // 11
                  { id: 'r_ankle', x: w*0.65, y: h*0.95 }   // 12
                ];

              const drawBone = (idx1: number, idx2: number, thickness: number) => {
                const p1 = joints[idx1];
                const p2 = joints[idx2];
                if (!p1 || !p2) return null;
                return (
                  <Line 
                    points={[p1.x, p1.y, p2.x, p2.y]} 
                    stroke="#000" strokeWidth={thickness} lineCap="round" 
                  />
                );
              };

              return (
                <Group>
                  {/* Anatomical Silhouette Rendering */}
                  <Group opacity={0.9}>
                    {/* Diagnostic background */}
                    <Rect width={w} height={h} fill="rgba(0,0,0,0.02)" stroke="#ccc" strokeWidth={0.5} dash={[5,5]} />
                    
                    {/* Torso & Head */}
                    {drawBone(1, 8, 30)} {/* Torso */}
                    <Circle x={joints[0].x} y={joints[0].y} radius={20} fill="white" stroke="#000" strokeWidth={2} />
                    
                    {/* Arms */}
                    {drawBone(1, 2, 16)}
                    {drawBone(1, 3, 16)}
                    {drawBone(2, 4, 13)}
                    {drawBone(4, 6, 10)}
                    {drawBone(3, 5, 13)}
                    {drawBone(5, 7, 10)}
                    
                    {/* Legs */}
                    {drawBone(8, 9, 20)}
                    {drawBone(9, 11, 16)}
                    {drawBone(8, 10, 20)}
                    {drawBone(10, 12, 16)}
                  </Group>

                  {/* Interactive Joint Handles (Visible when selected) */}
                  {isSelected && joints.map((j: {id: string; x: number; y: number}, i: number) => (
                    <Circle
                      key={j.id}
                      x={j.x}
                      y={j.y}
                      radius={10}
                      fill="#F5C518"
                      stroke="white"
                      strokeWidth={2}
                      draggable
                      onDragMove={(e) => {
                        const newJoints = [...joints];
                        newJoints[i] = { ...j, x: e.target.x(), y: e.target.y() };
                        onChange({ ...shapeProps, joints: newJoints });
                      }}
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'move';
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                      shadowBlur={5}
                      shadowColor="black"
                      shadowOpacity={0.5}
                    />
                  ))}
                </Group>
              );
            })()}
          </Group>
        ) : shapeProps.type === 'text' ? (
          <Text
            text={String(shapeProps.text || '')}
            fontSize={shapeProps.fontSize}
            fontFamily={String(shapeProps.fontFamily || 'Inter')}
            fontStyle={shapeProps.fontStyle}
            fill={shapeProps.fill}
            x={0}
            y={0}
            width={shapeProps.width > 0 ? shapeProps.width : undefined}
            wrap="word"
            align={shapeProps.align}
            rotation={0}
            draggable={false}
          />
        ) : isNativeArrow ? (
          (() => {
            const hasCoords = shapeProps.startX !== undefined && shapeProps.endX !== undefined;
            const pts = hasCoords 
              ? [shapeProps.startX - shapeProps.x, shapeProps.startY - shapeProps.y, shapeProps.endX - shapeProps.x, shapeProps.endY - shapeProps.y]
              : [0, shapeProps.height / 2, shapeProps.width, shapeProps.height / 2];
              
            const isMeasurement = shapeProps.isDistanceArrow || shapeProps.symbolId === 'a-4';

            return (
              <Arrow
                points={pts}
                pointerLength={12}
                pointerWidth={12}
                fill={isMeasurement ? "#000000" : (shapeProps.fill || "#000000")}
                stroke={isMeasurement ? "#000000" : (shapeProps.stroke || "#000000")}
                strokeWidth={isMeasurement ? 5 : (shapeProps.strokeWidth || 5)}
                pointerAtBeginning={isMeasurement}
                pointerAtEnding={true}
                lineCap="round"
                lineJoin="round"
                opacity={1}
                perfectDrawEnabled={false}
                draggable={false}
              />
            );
          })()
        ) : ['arch-6', 'arch-6l', 'arch-6u', 'arch-6s', 'arch-6sf', 'arch-6-spiral-f', 'arch-6-spiral-s', 'arch-6-spiral-s-top', 'arch-w-square'].includes(shapeProps.symbolId || '') ? (
          // Dynamic Stairs Engine
          <Group>
            {shapeProps.symbolId === 'arch-6' && (
              <Group>
                <Rect width={shapeProps.width} height={shapeProps.height} stroke="#000" strokeWidth={2} />
                <Line points={[2, 0, 2, shapeProps.height]} stroke="#666" strokeWidth={2} />
                <Line points={[shapeProps.width - 2, 0, shapeProps.width - 2, shapeProps.height]} stroke="#666" strokeWidth={2} />
                {Array.from({ length: Math.floor(shapeProps.height / 15) }).map((_, i) => (
                  <Line key={i} points={[0, (i + 1) * 15, shapeProps.width, (i + 1) * 15]} stroke="#000" strokeWidth={1} />
                ))}
              </Group>
            )}
            {shapeProps.symbolId === 'arch-6l' && (
              <Group>
                <Path data={`M 0 0 L ${shapeProps.width} 0 L ${shapeProps.width} ${shapeProps.height} L ${shapeProps.width - 40} ${shapeProps.height} L ${shapeProps.width - 40} 40 L 0 40 Z`} stroke="#000" strokeWidth={2} />
                {/* Horizontal steps */}
                {Array.from({ length: Math.floor((shapeProps.width - 40) / 15) }).map((_, i) => (
                  <Line key={`h-${i}`} points={[(i + 1) * 15, 0, (i + 1) * 15, 40]} stroke="#000" strokeWidth={1} />
                ))}
                {/* Corner step */}
                <Line points={[shapeProps.width - 40, 0, shapeProps.width, 40]} stroke="#000" strokeWidth={1} />
                {/* Vertical steps */}
                {Array.from({ length: Math.floor((shapeProps.height - 40) / 15) }).map((_, i) => (
                  <Line key={`v-${i}`} points={[shapeProps.width - 40, 40 + (i + 1) * 15, shapeProps.width, 40 + (i + 1) * 15]} stroke="#000" strokeWidth={1} />
                ))}
              </Group>
            )}
            {shapeProps.symbolId === 'arch-6u' && (
              <Group>
                <Path data={`M 0 0 L 35 0 L 35 ${shapeProps.height - 35} L ${shapeProps.width - 35} ${shapeProps.height - 35} L ${shapeProps.width - 35} 0 L ${shapeProps.width} 0 L ${shapeProps.width} ${shapeProps.height} L 0 ${shapeProps.height} Z`} stroke="#000" strokeWidth={2} />
                {/* Steps left */}
                {Array.from({ length: Math.floor((shapeProps.height - 35) / 15) }).map((_, i) => (
                  <Line key={`l-${i}`} points={[0, (i + 1) * 15, 35, (i + 1) * 15]} stroke="#000" strokeWidth={1} />
                ))}
                {/* Steps right */}
                {Array.from({ length: Math.floor((shapeProps.height - 35) / 15) }).map((_, i) => (
                  <Line key={`r-${i}`} points={[shapeProps.width - 35, (i + 1) * 15, shapeProps.width, (i + 1) * 15]} stroke="#000" strokeWidth={1} />
                ))}
                {/* Steps bottom (landing) */}
                {Array.from({ length: Math.floor((shapeProps.width - 70) / 20) }).map((_, i) => (
                  <Line key={`b-${i}`} points={[35 + (i + 1) * 20, shapeProps.height - 35, 35 + (i + 1) * 20, shapeProps.height]} stroke="#000" strokeWidth={0.5} />
                ))}
              </Group>
            )}
            {['arch-6s', 'arch-6sf', 'arch-6-spiral-f'].includes(shapeProps.symbolId || '') && (
              <Group>
                {/* Outer Ring */}
                <Circle x={shapeProps.width / 2} y={shapeProps.height / 2} radius={Math.min(shapeProps.width, shapeProps.height) / 2} stroke="#000" strokeWidth={2} />
                {/* Central Pole (The black circle in the middle) */}
                <Circle x={shapeProps.width / 2} y={shapeProps.height / 2} radius={Math.min(shapeProps.width, shapeProps.height) / 8} fill="#000" />
                {/* Steps */}
                {Array.from({ length: 16 }).map((_, i) => {
                  const angle = (i * 360) / 16;
                  const rad = (angle * Math.PI) / 180;
                  const rOut = Math.min(shapeProps.width, shapeProps.height) / 2;
                  const rIn = Math.min(shapeProps.width, shapeProps.height) / 8;
                  return (
                    <Line
                      key={i}
                      points={[
                        shapeProps.width / 2 + rIn * Math.cos(rad),
                        shapeProps.height / 2 + rIn * Math.sin(rad),
                        shapeProps.width / 2 + rOut * Math.cos(rad),
                        shapeProps.height / 2 + rOut * Math.sin(rad)
                      ]}
                      stroke="#000"
                      strokeWidth={1}
                    />
                  );
                })}
              </Group>
            )}
            {shapeProps.symbolId === 'arch-6-spiral-s-top' && (
              <Group>
                {/* Dubleks Yandan - Üst Görünümü (270 Derece Spiral) */}
                <Arc
                  x={shapeProps.width / 2}
                  y={shapeProps.height / 2}
                  innerRadius={Math.min(shapeProps.width, shapeProps.height) / 10}
                  outerRadius={Math.min(shapeProps.width, shapeProps.height) / 2}
                  angle={270}
                  rotation={0}
                  stroke="#000"
                  strokeWidth={2}
                />
                <Circle x={shapeProps.width / 2} y={shapeProps.height / 2} radius={Math.min(shapeProps.width, shapeProps.height) / 10} fill="#333" />
                {Array.from({ length: 12 }).map((_, i) => {
                  const angle = (i * 270) / 12;
                  const rad = (angle * Math.PI) / 180;
                  const rOut = Math.min(shapeProps.width, shapeProps.height) / 2;
                  const rIn = Math.min(shapeProps.width, shapeProps.height) / 10;
                  return (
                    <Line
                      key={i}
                      points={[
                        shapeProps.width / 2 + rIn * Math.cos(rad),
                        shapeProps.height / 2 + rIn * Math.sin(rad),
                        shapeProps.width / 2 + rOut * Math.cos(rad),
                        shapeProps.height / 2 + rOut * Math.sin(rad)
                      ]}
                      stroke="#000"
                      strokeWidth={1}
                    />
                  );
                })}
              </Group>
            )}
            {shapeProps.symbolId === 'arch-w-square' && (
              <Rect
                width={shapeProps.width}
                height={shapeProps.height}
                stroke="#000"
                strokeWidth={10}
                strokeScaleEnabled={false}
              />
            )}
            {['arch-6-spiral-s'].includes(shapeProps.symbolId || '') && (
              <Group>
                {/* Central Pole */}
                <Rect x={shapeProps.width / 2 - 1.5} y={0} width={3} height={shapeProps.height} fill="#000" />
                {Array.from({ length: 15 }).map((_, i) => {
                  const t = i / 14;
                  const angle = t * Math.PI * 4;
                  const xOffset = (Math.sin(angle) * shapeProps.width) / 2;
                  const isFront = Math.cos(angle) > 0;
                  const y = t * (shapeProps.height - 10);
                  return (
                    <Group key={i}>
                      <Line
                        points={[shapeProps.width / 2, y, shapeProps.width / 2 + xOffset, y]}
                        stroke={isFront ? "#000" : "#888"}
                        strokeWidth={2}
                      />
                      <Line
                        points={[shapeProps.width / 2 + xOffset, y, shapeProps.width / 2 + xOffset, y + 5]}
                        stroke={isFront ? "#000" : "#aaa"}
                        strokeWidth={1}
                      />
                    </Group>
                  );
                })}
                {/* Handrail */}
                <Path
                  data={(() => {
                    let path = `M ${shapeProps.width/2} 0`;
                    for(let i=0; i<=20; i++) {
                      const t = i/20;
                      const angle = t * Math.PI * 4;
                      const x = shapeProps.width/2 + (Math.sin(angle) * shapeProps.width)/2;
                      const y = t * (shapeProps.height - 10);
                      path += ` L ${x} ${y}`;
                    }
                    return path;
                  })()}
                  stroke="#000"
                  strokeWidth={1.5}
                  opacity={0.6}
                />
              </Group>
            )}
          </Group>
        ) : shapeProps.type === 'rect' ? (
          <Rect
            width={shapeProps.width}
            height={shapeProps.height}
            fill={shapeProps.fill || "transparent"}
            stroke={shapeProps.stroke || "black"}
            strokeWidth={shapeProps.strokeWidth || 1}
            draggable={false}
          />
        ) : shapeProps.type === 'line' ? (
          shapeProps.dash ? (
            <Line
              points={shapeProps.width > shapeProps.height 
                ? [0, 0, shapeProps.width, 0] 
                : [0, 0, 0, shapeProps.height]}
              stroke={shapeProps.fill || "black"}
              strokeWidth={Math.max(shapeProps.width, shapeProps.height) > 1 ? Math.min(shapeProps.width, shapeProps.height) : 1}
              dash={shapeProps.dash}
              draggable={false}
            />
          ) : (
            <Rect
              width={shapeProps.width}
              height={shapeProps.height}
              fill={shapeProps.fill || "black"}
              draggable={false}
            />
          )
        ) : shapeProps.symbolId === 'ev-noose' ? (
          // Ultra-Realistic Forensic Noose Engine
          <Group>
            {(() => {
              const sw = shapeProps.width / 80;
              const sh = shapeProps.height / 120;
              const rWidth = Math.max(2, shapeProps.width / 12);
              
              return (
                <Group>
                  {/* Top Rope Segment */}
                  <Line
                    points={[40 * sw, 0, 40 * sw, 30 * sh]}
                    stroke="#000"
                    strokeWidth={rWidth}
                    lineCap="round"
                  />
                  {/* Texture on top segment */}
                  <Line
                    points={[40 * sw, 5 * sh, 40 * sw, 25 * sh]}
                    stroke="white"
                    strokeWidth={rWidth * 0.3}
                    dash={[4, 6]}
                    opacity={0.3}
                  />

                  {/* The Hangman's Knot (Multi-wrap) */}
                  <Rect 
                    x={28 * sw} 
                    y={30 * sh} 
                    width={24 * sw} 
                    height={32 * sh} 
                    cornerRadius={4 * sw} 
                    fill="#000" 
                  />
                  {/* Knot Wraps details */}
                  {[35, 40, 45, 50, 55].map(y => (
                    <Line 
                      key={y}
                      points={[29 * sw, y * sh, 51 * sw, y * sh]}
                      stroke="white"
                      strokeWidth={1 * sw}
                      opacity={0.3}
                    />
                  ))}

                  {/* Main Teardrop Loop */}
                  <Path
                    data="M40 62 Q 80 62, 80 95 Q 80 118, 40 118 Q 0 118, 0 95 Q 0 62, 40 62"
                    stroke="#000"
                    strokeWidth={rWidth}
                    lineCap="round"
                    scaleX={sw}
                    scaleY={sh}
                  />
                  {/* Braid Texture on Loop */}
                  <Path
                    data="M40 62 Q 80 62, 80 95 Q 80 118, 40 118 Q 0 118, 0 95 Q 0 62, 40 62"
                    stroke="white"
                    strokeWidth={rWidth * 0.4}
                    dash={[6, 10]}
                    opacity={0.3}
                    scaleX={sw}
                    scaleY={sh}
                    lineCap="round"
                  />
                </Group>
              );
            })()}
          </Group>
        ) : shapeProps.symbolId === 'ev-rope' ? (
          // Advanced 6-Point Spline Rope Engine
          <Group>
            {(() => {
              const w = shapeProps.width;
              const h = shapeProps.height;
              // Default 6 points relative to group if not set
              const pts = shapeProps.points || [
                0, h / 2, 
                w * 0.2, h / 2 - 30, 
                w * 0.4, h / 2 + 30, 
                w * 0.6, h / 2 - 30, 
                w * 0.8, h / 2 + 30, 
                w, h / 2
              ];
              
              return (
                <Group>
                  {/* Rope Shadow Layer */}
                  <Line
                    points={pts}
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth={10}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                  />
                  {/* Main Braided Rope Body */}
                  <Line
                    points={pts}
                    stroke="#000"
                    strokeWidth={7}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                  />
                  {/* Texture Layer (Braid highlights) */}
                  <Line
                    points={pts}
                    stroke="white"
                    strokeWidth={3}
                    tension={0.5}
                    dash={[6, 10]}
                    opacity={0.3}
                    lineCap="round"
                  />
                  
                  {/* 6 Multi-Point Shaping Handles */}
                  {isSelected && Array.from({ length: 6 }).map((_, i) => (
                    <Circle
                      key={i}
                      x={pts[i * 2]}
                      y={pts[i * 2 + 1]}
                      radius={9}
                      fill="#F5C518"
                      stroke="white"
                      strokeWidth={2}
                      draggable
                      onDragMove={(e) => {
                        const newPts = [...pts];
                        newPts[i * 2] = e.target.x();
                        newPts[i * 2 + 1] = e.target.y();
                        onChange({ ...shapeProps, points: newPts });
                      }}
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'move';
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                      shadowBlur={5}
                      shadowColor="black"
                      shadowOpacity={0.5}
                    />
                  ))}
                </Group>
              );
            })()}
          </Group>
        ) : (shapeProps.symbolId === 'st-3' || shapeProps.symbolId === 'st-4') ? (
          // Advanced Vector Road Junction Engine (Matched to st-1 Style)
          <Group>
            {(() => {
              const w = shapeProps.width;
              const h = shapeProps.height;
              const roadWidth = Math.min(w, h) * 0.35;
              const roadColor = "#2a2a2a"; // Matched to st-1
              const lineColor = "#ffffff";
              const centerDash = [20, 20]; // Matched to st-1
              const centerLineWidth = Math.max(1.5, roadWidth / 20);
              
              if (shapeProps.symbolId === 'st-3') {
                // Y-Junction (st-1 style)
                return (
                  <Group>
                    {/* Road Backgrounds */}
                    <Line points={[w/2, h, w/2, h/2]} stroke={roadColor} strokeWidth={roadWidth} lineCap="butt" />
                    <Line points={[w/2, h/2, 0, 0]} stroke={roadColor} strokeWidth={roadWidth} lineCap="round" />
                    <Line points={[w/2, h/2, w, 0]} stroke={roadColor} strokeWidth={roadWidth} lineCap="round" />
                    
                    {/* Asphalt Hub */}
                    <Circle x={w/2} y={h/2} radius={roadWidth/2} fill={roadColor} />
                    
                    {/* Center Dashed Lines (st-1 style) */}
                    <Line points={[w/2, h, w/2, h/2]} stroke={lineColor} strokeWidth={centerLineWidth} dash={centerDash} lineCap="butt" />
                    <Line points={[w/2, h/2, 0, 0]} stroke={lineColor} strokeWidth={centerLineWidth} dash={centerDash} lineCap="butt" />
                    <Line points={[w/2, h/2, w, 0]} stroke={lineColor} strokeWidth={centerLineWidth} dash={centerDash} lineCap="butt" />
                    
                    {/* Outer Border Lines */}
                    <Line points={[w/2 - roadWidth/2, h, w/2 - roadWidth/2, h/2]} stroke={lineColor} strokeWidth={1} opacity={0.5} />
                    <Line points={[w/2 + roadWidth/2, h, w/2 + roadWidth/2, h/2]} stroke={lineColor} strokeWidth={1} opacity={0.5} />
                  </Group>
                );
              } else {
                // Roundabout (st-1 style)
                const islandRadius = Math.min(w, h) * 0.22;
                return (
                  <Group>
                    {/* Roads */}
                    <Rect x={w/2 - roadWidth/2} y={0} width={roadWidth} height={h} fill={roadColor} />
                    <Rect x={0} y={h/2 - roadWidth/2} width={w} height={roadWidth} fill={roadColor} />
                    
                    {/* Hub Cover */}
                    <Circle x={w/2} y={h/2} radius={roadWidth * 0.8} fill={roadColor} />
                    
                    {/* Center Dashed Lines (st-1 style) */}
                    <Line points={[w/2, 0, w/2, h]} stroke={lineColor} strokeWidth={centerLineWidth} dash={centerDash} lineCap="butt" />
                    <Line points={[0, h/2, w, h/2]} stroke={lineColor} strokeWidth={centerLineWidth} dash={centerDash} lineCap="butt" />
                    
                    {/* Roundabout Dashed Circle */}
                    <Circle x={w/2} y={h/2} radius={islandRadius + 8} stroke={lineColor} strokeWidth={centerLineWidth} dash={[10, 10]} fill="none" opacity={0.8} />
                    
                    {/* The Green Central Island */}
                    <Circle x={w/2} y={h/2} radius={islandRadius} fill="#22c55e" stroke={lineColor} strokeWidth={1.5} />
                    <Circle x={w/2} y={h/2} radius={islandRadius * 0.7} fill="rgba(255,255,255,0.15)" />
                  </Group>
                );
              }
            })()}
          </Group>
        ) : shapeProps.symbolId === 'st-1' ? (
          // Advanced Vector Road Engine with Curvature & Inflection Support
          <Group>
            {(() => {
              const curv = shapeProps.curvature || 0;
              const w = shapeProps.width;
              const h = shapeProps.height;
              const curvX = shapeProps.curvatureX !== undefined ? shapeProps.curvatureX : w / 2;
              
              // Quadratic Bezier adjustment:
              // Peak Y follows the handle directly.
              const controlY = h / 2 + (curv * 2);
              const pathData = `M 0 ${h / 2} Q ${curvX} ${controlY} ${w} ${h / 2}`;
              
              return (
                <Group>
                  {/* Road Surface (Base) */}
                  <Path
                    data={pathData}
                    stroke="#2a2a2a"
                    strokeWidth={h}
                    lineCap="butt"
                    lineJoin="round"
                  />
                  {/* Center Dashed Line */}
                  <Path
                    data={pathData}
                    stroke="white"
                    strokeWidth={Math.max(1, h / 25)}
                    dash={[20, 20]}
                    lineCap="butt"
                    lineJoin="round"
                  />
                  {/* Curvature & Inflection Handle (Free Move) */}
                  {isSelected && (
                    <Circle
                      x={curvX}
                      y={h / 2 + curv}
                      radius={10}
                      fill="#F5C518"
                      stroke="white"
                      strokeWidth={2}
                      draggable
                      onDragMove={(e) => {
                        const newCurv = e.target.y() - h / 2;
                        const newCurvX = e.target.x();
                        onChange({ 
                          ...shapeProps, 
                          curvature: newCurv,
                          curvatureX: newCurvX
                        });
                      }}
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'move';
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                      shadowBlur={5}
                      shadowColor="black"
                      shadowOpacity={0.5}
                    />
                  )}
                </Group>
              );
            })()}
          </Group>
        ) : shapeProps.symbolId === 'arch-7' ? (
          <Group>
            {(() => {
              const curv = shapeProps.curvature !== undefined ? shapeProps.curvature : 40;
              const w = shapeProps.width;
              const h = shapeProps.height;
              const curvX = shapeProps.curvatureX !== undefined ? shapeProps.curvatureX : w / 2;
              
              // We'll use a Quadratic Bezier path for the curved wall
              const pathData = `M 0 ${h} Q ${curvX} ${h - (curv * 2)} ${w} ${h}`;
              
              return (
                <Group>
                  {/* The Wall Shadow/Base for thickness */}
                  <Path
                    data={pathData}
                    stroke="rgba(0,0,0,0.1)"
                    strokeWidth={12}
                    lineCap="round"
                  />
                  {/* The Actual Wall Line */}
                  <Path
                    data={pathData}
                    stroke="#000000"
                    strokeWidth={8}
                    lineCap="round"
                    lineJoin="round"
                  />
                  
                  {/* Curvature Control Handle */}
                  {isSelected && (
                    <Circle
                      x={curvX}
                      y={h - curv}
                      radius={8}
                      fill="#F5C518"
                      stroke="white"
                      strokeWidth={2}
                      draggable
                      onDragMove={(e) => {
                        const newCurv = h - e.target.y();
                        const newCurvX = e.target.x();
                        onChange({ 
                          ...shapeProps, 
                          curvature: newCurv,
                          curvatureX: newCurvX
                        });
                      }}
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'pointer';
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                      shadowBlur={5}
                      shadowColor="black"
                      shadowOpacity={0.3}
                    />
                  )}
                </Group>
              );
            })()}
          </Group>
        ) : ['arch-d1r', 'arch-d1l', 'arch-win', 'arch-d2'].includes(shapeProps.symbolId || '') ? (
          <Group>
            {shapeProps.symbolId === 'arch-win' ? (
              <Group>
                {/* Opaque white background to perfectly cover the wall line */}
                <Rect
                  width={shapeProps.width}
                  height={shapeProps.height}
                  fill="white"
                  strokeEnabled={false}
                />
                {/* Window Detail */}
                <Line
                  points={[0, 0.5, shapeProps.width, 0.5]}
                  stroke="#000"
                  strokeWidth={1}
                />
                <Line
                  points={[0, shapeProps.height - 0.5, shapeProps.width, shapeProps.height - 0.5]}
                  stroke="#000"
                  strokeWidth={1}
                />
                <Line
                  points={[0, shapeProps.height / 2, shapeProps.width, shapeProps.height / 2]}
                  stroke={shapeProps.fill || "#F5C518"}
                  strokeWidth={1.5}
                />
              </Group>
            ) : (
            <>
            {/* 2D Wall-Gap Fix: Masks the wall under the threshold for integration */}
            <Rect
              x={0}
              y={0} 
              width={shapeProps.width}
              height={15}
              fill="white"
              listening={false}
            />
            <KonvaImage
              ref={imgRef}
              image={image}
              width={shapeProps.width}
              height={shapeProps.height}
              draggable={false}
              scaleX={shapeProps.scaleX || 1}
              scaleY={shapeProps.scaleY || 1}
              offsetX={(shapeProps.scaleX === -1) ? shapeProps.width : 0}
              offsetY={shapeProps.height * 0.8}
              filters={[RemoveWhiteFilter]}
              brightness={0}
            />
            </>
            )}
          </Group>
        ) : ['arch-w1', 'arch-w1v', 'arch-w1i', 'arch-w1vi'].includes(shapeProps.symbolId || '') ? (
          <Rect
            width={shapeProps.width}
            height={shapeProps.height}
            fill={shapeProps.fill || "#000000"}
            strokeWidth={0}
          />
        ) : (shapeProps.symbolId === 'ev-arrow-l' || shapeProps.symbolId === 'ev-arrow-r') ? (
          <Group>
            {/* Dynamic Hollow Arrow Vector - Head size stays relatively consistent */}
            <Path
              data={(() => {
                const w = shapeProps.width;
                const h = shapeProps.height;
                const headSize = Math.min(w * 0.5, 30); // Ok ucu boyutu maksimum 30px
                const stemY1 = h * 0.3;
                const stemY2 = h * 0.7;
                
                if (shapeProps.symbolId === 'ev-arrow-l') {
                  return `M ${w} ${stemY1} L ${w} ${stemY2} L ${headSize} ${stemY2} L ${headSize} ${h} L 0 ${h/2} L ${headSize} 0 L ${headSize} ${stemY1} Z`;
                } else {
                  return `M 0 ${stemY1} L 0 ${stemY2} L ${w - headSize} ${stemY2} L ${w - headSize} ${h} L ${w} ${h/2} L ${w - headSize} 0 L ${w - headSize} ${stemY1} Z`;
                }
              })()}
              fill="rgba(255, 255, 255, 0.1)"
              stroke={shapeProps.fill || "#F5C518"}
              strokeWidth={3}
              lineJoin="round"
              scaleX={shapeProps.scaleX || 1}
              scaleY={shapeProps.scaleY || 1}
              offsetX={(shapeProps.scaleX === -1) ? shapeProps.width : 0}
              offsetY={(shapeProps.scaleY === -1) ? shapeProps.height : 0}
            />
          </Group>
        ) : shapeProps.symbolId === 'ev-callout' ? (
          <Group>
            {/* Dynamic Callout Balloon Vector - Auto Resizing */}
            {(() => {
              const text = String(shapeProps.distance || '');
              const fontSize = shapeProps.distanceFontSize || 14;
              const { w, h } = calculateCalloutSize(text, fontSize);
              const r = 4; // Tight corner radius
              const tailH = h * 0.25;
              const boxH = h - tailH;
              const tailW = Math.min(w * 0.2, 20);
              
              return (
                <Group>
                  <Path
                    data={`
                      M ${r} 0 
                      L ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r}
                      L ${w} ${boxH - r} A ${r} ${r} 0 0 1 ${w - r} ${boxH}
                      L ${r + tailW * 1.5} ${boxH}
                      L ${r} ${h}
                      L ${r + tailW * 0.5} ${boxH}
                      L ${r} ${boxH} A ${r} ${r} 0 0 1 0 ${boxH - r}
                      L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 Z
                    `}
                    fill="transparent"
                    stroke={shapeProps.fill === 'transparent' ? "#000000" : (shapeProps.fill || "#000000")}
                    strokeWidth={2}
                    lineJoin="round"
                    shadowColor="black"
                    shadowBlur={2}
                    shadowOpacity={0.2}
                  />
                  <Text
                    text={text}
                    fontSize={fontSize}
                    fontStyle="bold"
                    fill={shapeProps.distanceColor || '#000000'}
                    width={w}
                    height={boxH}
                    align="center"
                    verticalAlign="middle"
                    lineHeight={1.1}
                    padding={5}
                    listening={false}
                  />
                </Group>
              );
            })()}
          </Group>
        ) : (shapeProps.symbolId === 'ev-arrow-desc' || shapeProps.symbolId === 'ev-arrow-desc-ellipse') ? (
          <Group>
            {/* Dual-Handle Dynamic Arrow Engine with Multi-line Support & Resizing Handles */}
            {(() => {
              const mx = shapeProps.markerX !== undefined ? shapeProps.markerX : 0;
              const my = shapeProps.markerY !== undefined ? shapeProps.markerY : 0;
              const tx = shapeProps.textX !== undefined ? shapeProps.textX : 120;
              const ty = shapeProps.textY !== undefined ? shapeProps.textY : 0;
              const isEllipse = shapeProps.symbolId === 'ev-arrow-desc-ellipse';
              
              const text = String(shapeProps.distance || '');
              const fontSize = shapeProps.distanceFontSize || 12;
              
              // Base measurement
              const lines = text.split('\n');
              const charWidth = fontSize * 0.6;
              const padding = 12;
              const maxLineLength = Math.max(...lines.map(l => l.length), 1);
              
              // If user manually resized, use those values
              const autoW = maxLineLength * charWidth + padding * 2;
              const autoH = lines.length * (fontSize * 1.2) + padding * 2;
              
              const frameW = shapeProps.frameWidth !== undefined ? shapeProps.frameWidth : autoW;
              const frameH = shapeProps.frameHeight !== undefined ? shapeProps.frameHeight : autoH;
              
              // Arrow intersection logic
              const centerX = tx + frameW / 2;
              const centerY = ty + frameH / 2;
              const dx = mx - centerX;
              const dy = my - centerY;
              
              let arrowStartX = centerX;
              let arrowStartY = centerY;
              
              if (dx !== 0 || dy !== 0) {
                if (isEllipse) {
                  // Ellipse intersection logic
                  const rw = frameW / 2;
                  const rh = frameH / 2;
                  const t = 1 / Math.sqrt((dx * dx) / (rw * rw) + (dy * dy) / (rh * rh));
                  arrowStartX = centerX + dx * t;
                  arrowStartY = centerY + dy * t;
                } else {
                  // AABB intersection logic
                  const absDx = Math.abs(dx);
                  const absDy = Math.abs(dy);
                  const halfW = frameW / 2;
                  const halfH = frameH / 2;
                  const scaleX = halfW / absDx;
                  const scaleY = halfH / absDy;
                  const scale = Math.min(scaleX, scaleY);
                  arrowStartX = centerX + dx * scale;
                  arrowStartY = centerY + dy * scale;
                }
              }

              return (
                <Group>
                  {/* The Dynamic Arrow */}
                  <Arrow
                    points={[arrowStartX, arrowStartY, mx, my]}
                    pointerLength={10}
                    pointerWidth={8}
                    fill={shapeProps.fill || "#000000"}
                    stroke={shapeProps.fill || "#000000"}
                    strokeWidth={2}
                  />
                  
                  {/* The Frame (Rect or Ellipse) */}
                  {isEllipse ? (
                    <Ellipse
                      x={centerX}
                      y={centerY}
                      radiusX={frameW / 2}
                      radiusY={frameH / 2}
                      fill="transparent"
                      stroke="#000000"
                      strokeWidth={1.5}
                    />
                  ) : (
                    <Rect
                      x={tx}
                      y={ty}
                      width={frameW}
                      height={frameH}
                      fill="transparent"
                      stroke="#000000"
                      strokeWidth={1.5}
                      cornerRadius={0}
                    />
                  )}
                  
                  {/* Centered Text */}
                  <Text
                    x={tx}
                    y={ty}
                    width={frameW}
                    height={frameH}
                    text={text}
                    fontSize={fontSize}
                    fontStyle="bold"
                    lineHeight={1.2}
                    fill="#000000"
                    align="center"
                    verticalAlign="middle"
                    listening={false}
                  />
                  
                  {/* Handles (Visible only when selected) */}
                  {isSelected && (
                    <>
                      {/* Sub-Handle 1: Marker Point (Transparent Zone) */}
                      <Circle
                        x={mx}
                        y={my}
                        radius={15}
                        fill="rgba(245, 197, 24, 0.2)"
                        opacity={0.3}
                        draggable
                        onDragMove={(e) => {
                          onChange({ ...shapeProps, markerX: e.target.x(), markerY: e.target.y() });
                        }}
                        onMouseEnter={(e) => {
                          const s = e.target.getStage();
                          if (s) s.container().style.cursor = 'crosshair';
                        }}
                      />
                      
                      {/* Sub-Handle 2: Center Position (Draggable) */}
                      <Circle
                        x={centerX}
                        y={centerY}
                        radius={15}
                        fill="rgba(59, 130, 246, 0.2)"
                        opacity={0.3}
                        draggable
                        onDragMove={(e) => {
                          onChange({ 
                            ...shapeProps, 
                            textX: e.target.x() - frameW / 2,
                            textY: e.target.y() - frameH / 2
                          });
                        }}
                        onMouseEnter={(e) => {
                          const s = e.target.getStage();
                          if (s) s.container().style.cursor = 'move';
                        }}
                      />

                      {/* Corner Handles for Resizing */}
                      {[
                        { x: tx, y: ty, cursor: 'nw-resize' },
                        { x: tx + frameW, y: ty, cursor: 'ne-resize' },
                        { x: tx, y: ty + frameH, cursor: 'sw-resize' },
                        { x: tx + frameW, y: ty + frameH, cursor: 'se-resize' }
                      ].map((h, i) => (
                        <Rect
                          key={i}
                          x={h.x - 4}
                          y={h.y - 4}
                          width={8}
                          height={8}
                          fill="white"
                          stroke="#000"
                          strokeWidth={1}
                          draggable
                          onDragMove={(e) => {
                            const newX = e.target.x() + 4;
                            const newY = e.target.y() + 4;
                            let newTX = tx;
                            let newTY = ty;
                            let newFW = frameW;
                            let newFH = frameH;

                            if (i === 0) { // NW
                              newTX = newX; newTY = newY;
                              newFW = tx + frameW - newX; newFH = ty + frameH - newY;
                            } else if (i === 1) { // NE
                              newTY = newY;
                              newFW = newX - tx; newFH = ty + frameH - newY;
                            } else if (i === 2) { // SW
                              newTX = newX;
                              newFW = tx + frameW - newX; newFH = newY - ty;
                            } else { // SE
                              newFW = newX - tx; newFH = newY - ty;
                            }
                            
                            onChange({ 
                              ...shapeProps, 
                              textX: newTX, textY: newTY,
                              frameWidth: Math.max(20, newFW),
                              frameHeight: Math.max(20, newFH)
                            });
                          }}
                          onMouseEnter={(e) => {
                            const s = e.target.getStage();
                            if (s) s.container().style.cursor = h.cursor;
                          }}
                          onMouseLeave={(e) => {
                            const s = e.target.getStage();
                            if (s) s.container().style.cursor = 'default';
                          }}
                        />
                      ))}
                    </>
                  )}
                </Group>
              );
            })()}
          </Group>
        ) : shapeProps.symbolId === 'ev-arrowhead' ? (
          <Group>
            {/* Hollow Arrowhead Vector */}
            <Path
              data={`M 0 0 L ${shapeProps.width} ${shapeProps.height / 2} L 0 ${shapeProps.height} Z`}
              fill="rgba(255, 255, 255, 0.01)"
              stroke={shapeProps.fill || "#000000"}
              strokeWidth={3}
              lineJoin="round"
              scaleX={shapeProps.scaleX || 1}
              scaleY={shapeProps.scaleY || 1}
              offsetX={(shapeProps.scaleX === -1) ? shapeProps.width : 0}
              offsetY={(shapeProps.scaleY === -1) ? shapeProps.height : 0}
            />
          </Group>
        ) : (shapeProps.symbolId?.startsWith('ev-rect-') || shapeProps.symbolId?.startsWith('ev-square-') || shapeProps.symbolId?.startsWith('ev-triangle-') || shapeProps.symbolId?.startsWith('ev-lshape-') || shapeProps.symbolId === 'ev-star' || shapeProps.symbolId === 'ev-crack') ? (
          <Group>
            {/* Geometric & Forensic Shape Engine (Rect, Square, Triangle, L-Shape, Star, Crack) */}
            {shapeProps.symbolId === 'ev-star' ? (
              <Path
                data="M50 5L63.5 35.5L95 40L72 62.5L77.5 94L50 79L22.5 94L28 62.5L5 40L36.5 35.5L50 5Z"
                fill={shapeProps.fill || "#000000"}
                scaleX={shapeProps.width / 100}
                scaleY={shapeProps.height / 100}
              />
            ) : shapeProps.symbolId === 'ev-crack' ? (
              <Path
                data="M50 50L60 20L55 10M50 50L80 60L90 55M50 50L40 85L45 95M50 50L15 40L5 45M50 50L70 80L75 70M50 50L25 20L20 30"
                stroke={shapeProps.fill || "#000000"}
                strokeWidth={2}
                lineCap="round"
                lineJoin="round"
                scaleX={shapeProps.width / 100}
                scaleY={shapeProps.height / 100}
              />
            ) : shapeProps.symbolId?.startsWith('ev-lshape') ? (
              <Path
                data="M10 10V90H90V70H30V10H10Z"
                fill={(shapeProps.symbolId?.includes('solid')) ? (shapeProps.fill || "#000000") : "transparent"}
                stroke={shapeProps.fill || "#000000"}
                strokeWidth={shapeProps.symbolId?.includes('hollow') ? 3 : 0}
                lineJoin="round"
                scaleX={shapeProps.width / 100}
                scaleY={shapeProps.height / 100}
              />
            ) : shapeProps.symbolId?.includes('triangle') ? (
              <Line
                points={[shapeProps.width / 2, 0, shapeProps.width, shapeProps.height, 0, shapeProps.height]}
                closed
                fill={(shapeProps.symbolId?.includes('solid')) ? (shapeProps.fill || "#000000") : "transparent"}
                stroke={shapeProps.fill || "#000000"}
                strokeWidth={shapeProps.symbolId?.includes('hollow') ? 3 : 0}
              />
            ) : (
              <Rect
                width={shapeProps.width}
                height={shapeProps.height}
                fill={(shapeProps.symbolId?.includes('solid')) ? (shapeProps.fill || "#000000") : "transparent"}
                stroke={shapeProps.fill || "#000000"}
                strokeWidth={shapeProps.symbolId?.includes('hollow') ? 3 : 0}
              />
            )}
          </Group>
        ) : shapeProps.symbolId === 'ev-ruler-straight' ? (
          <Group
            scaleX={shapeProps.scaleX || 1}
            scaleY={shapeProps.scaleY || 1}
            offsetX={(shapeProps.scaleX === -1) ? shapeProps.width : 0}
            offsetY={(shapeProps.scaleY === -1) ? shapeProps.height : 0}
          >
            {(() => {
              const w = shapeProps.width;
              const h = shapeProps.height;
              const tickSpacing = 20;
              const elements = [];
              const flipX = shapeProps.scaleX === -1;
              const flipY = shapeProps.scaleY === -1;

              elements.push(
                <Rect
                  key="bg"
                  width={w}
                  height={h}
                  fill={shapeProps.fill || "#F5C518"}
                  stroke="#000"
                  strokeWidth={1}
                  shadowColor="black"
                  shadowBlur={2}
                  shadowOpacity={0.3}
                />
              );

              for (let i = 0; i <= w / tickSpacing; i++) {
                const isMajor = i % 5 === 0;
                const tickLen = isMajor ? h * 0.4 : h * 0.2;
                elements.push(
                  <Line key={`tick-${i}`} points={[i * tickSpacing, 0, i * tickSpacing, tickLen]} stroke="#000" strokeWidth={1} />
                );
                if (isMajor && i > 0) {
                  elements.push(
                    <Text 
                      key={`num-${i}`} 
                      text={`${i}`} 
                      x={i * tickSpacing - 4} 
                      y={tickLen + 2} 
                      fontSize={10} 
                      fill="#000" 
                      scaleX={flipX ? -1 : 1}
                      scaleY={flipY ? -1 : 1}
                      offsetX={flipX ? 10 : 0}
                      offsetY={flipY ? 10 : 0}
                    />
                  );
                }
              }
              return elements;
            })()}
          </Group>
        ) : shapeProps.symbolId === 'ev-ruler-l' ? (
          <Group
            scaleX={shapeProps.scaleX || 1}
            scaleY={shapeProps.scaleY || 1}
            offsetX={(shapeProps.scaleX === -1) ? shapeProps.width : 0}
            offsetY={(shapeProps.scaleY === -1) ? shapeProps.height : 0}
          >
            {(() => {
              const w = shapeProps.width;
              const h = shapeProps.height;
              const thick = 20;
              const tickSpacing = 20;
              const elements = [];
              const flipX = shapeProps.scaleX === -1;
              const flipY = shapeProps.scaleY === -1;

              elements.push(
                <Path
                  key="bg"
                  data={`M 0 0 L ${thick} 0 L ${thick} ${h - thick} L ${w} ${h - thick} L ${w} ${h} L 0 ${h} Z`}
                  fill={shapeProps.fill || "#F5C518"}
                  stroke="#000"
                  strokeWidth={1}
                  shadowColor="black"
                  shadowBlur={2}
                  shadowOpacity={0.3}
                />
              );

              for (let x = thick; x <= w; x += tickSpacing) {
                const val = (x - thick) / tickSpacing;
                const isMajor = val % 5 === 0;
                const tickLen = isMajor ? 8 : 4;
                elements.push(
                  <Line key={`hx-${x}`} points={[x, h - thick, x, h - thick + tickLen]} stroke="#000" strokeWidth={1} />
                );
                if (isMajor && val > 0) {
                  elements.push(
                    <Text 
                      key={`hn-${x}`} 
                      text={`${val}`} 
                      x={x - 4} 
                      y={h - thick + tickLen + 1} 
                      fontSize={8} 
                      fill="#000" 
                      scaleX={flipX ? -1 : 1}
                      scaleY={flipY ? -1 : 1}
                      offsetX={flipX ? 8 : 0}
                      offsetY={flipY ? 8 : 0}
                    />
                  );
                }
              }

              for (let y = h - thick; y >= 0; y -= tickSpacing) {
                const val = (h - thick - y) / tickSpacing;
                if (val === 0) continue;
                const isMajor = val % 5 === 0;
                const tickLen = isMajor ? 8 : 4;
                elements.push(
                  <Line key={`vy-${y}`} points={[thick - tickLen, y, thick, y]} stroke="#000" strokeWidth={1} />
                );
                if (isMajor) {
                  elements.push(
                    <Text 
                      key={`vn-${y}`} 
                      text={`${val}`} 
                      x={2} 
                      y={y - 4} 
                      fontSize={8} 
                      fill="#000"
                      scaleX={flipX ? -1 : 1}
                      scaleY={flipY ? -1 : 1}
                      offsetX={flipX ? 8 : 0}
                      offsetY={flipY ? 8 : 0}
                    />
                  );
                }
              }
              
              return elements;
            })()}
          </Group>
        ) : shapeProps.symbolId === 'ev-camera-link' ? (
          <Group
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {(() => {
              const w = shapeProps.width;
              const h = shapeProps.height;
              const hasPhoto = !!shapeProps.photo || (shapeProps.photos && shapeProps.photos.length > 0);
              
              return (
                <Group>
                  {/* Camera Icon Base */}
                  <KonvaImage
                    image={image}
                    width={w}
                    height={h}
                    filters={hasPhoto ? [] : [Konva.Filters.Grayscale]}
                    ref={imgRef}
                  />
                  
                  {/* Directional Indicator (Arrow) */}
                  <Arrow
                    points={[w/2, 0, w/2, -15]}
                    pointerLength={10}
                    pointerWidth={8}
                    fill={hasPhoto ? "#3b82f6" : "#F5C518"}
                    stroke={hasPhoto ? "#3b82f6" : "#F5C518"}
                    strokeWidth={2}
                  />

                  {/* Photo Badge */}
                  {hasPhoto && (
                    <Circle
                      x={w}
                      y={0}
                      radius={6}
                      fill="#3b82f6"
                      stroke="white"
                      strokeWidth={1}
                    />
                  )}

                  {/* Yardım Baloncuğu - Sadece fotoğraf yoksa göster */}
                  {showTooltip && !hasPhoto && (
                    <Label x={w / 2} y={-50} listening={false}>
                      <Tag fill="#000" pointerDirection="down" pointerWidth={10} pointerHeight={8} lineJoin="round" shadowColor="black" shadowBlur={10} shadowOpacity={0.6} />
                      <Text text="Tıklayarak fotoğraf yükleyin veya görüntüleyin" fill="white" fontSize={12} padding={8} fontStyle="bold" />
                    </Label>
                  )}
                </Group>
              );
            })()}
          </Group>
        ) : shapeProps.symbolId === 'ev-bpa-drop' ? (
          <Group
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {(() => {
              const w = shapeProps.width;
              const h = shapeProps.height;
              const tailLen = shapeProps.tailLength || 100;
              
              return (
                <Group>
                  {/* The Trajectory Tail (Projecting back to origin) */}
                  <Line
                    points={[w / 2, h, w / 2, h + tailLen]}
                    stroke="#990000"
                    strokeWidth={2}
                    dash={[5, 5]}
                    opacity={0.6}
                  />
                  
                  {/* The Blood Drop Shape (Vector Path) */}
                  <Path
                    data={`M ${w/2} 0 C ${w/6} ${h/2} ${w/6} ${h} ${w/2} ${h} C ${5*w/6} ${h} ${5*w/6} ${h/2} ${w/2} 0`}
                    fill="#990000"
                    stroke="white"
                    strokeWidth={1}
                    onMouseEnter={() => setShowTooltip(true)}
                  />

                  {/* Tail Length Handle */}
                  {isSelected && (
                    <Circle
                      x={w / 2}
                      y={h + tailLen}
                      radius={6}
                      fill="white"
                      stroke="#990000"
                      strokeWidth={2}
                      draggable
                      onDragMove={(e) => {
                        const newLen = Math.max(20, e.target.y() - h);
                        onChange({ ...shapeProps, tailLength: newLen });
                      }}
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'ns-resize';
                        setShowTooltip(true);
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                    />
                  )}


                </Group>
              );
            })()}
          </Group>
        ) : shapeProps.symbolId === 'ev-shooting-trajectory' ? (
          <Group>
            {/* Interactive Shooting Trajectory Engine */}
            {(() => {
              const sx = shapeProps.startX !== undefined ? shapeProps.startX : 0;
              const sy = shapeProps.startY !== undefined ? shapeProps.startY : 150;
              const ex = shapeProps.endX !== undefined ? shapeProps.endX : 150;
              const ey = shapeProps.endY !== undefined ? shapeProps.endY : 0;
              
              const dx = ex - sx;
              const dy = ey - sy;
              const angle = Math.atan2(dy, dx) * 180 / Math.PI;
              const dist = Math.sqrt(dx*dx + dy*dy);

              return (
                <Group>
                  {/* Trajectory Line */}
                  <Line
                    points={[sx, sy, ex, ey]}
                    stroke="#ff0000"
                    strokeWidth={2.5}
                    dash={[10, 5]}
                    lineCap="round"
                  />
                  
                  {/* Origin Point (Muzzle/Source) */}
                  <Group x={sx} y={sy}>
                    <Circle radius={10} stroke="#ff0000" strokeWidth={1.5} fill="white" />
                    <Line points={[-8, 0, 8, 0]} stroke="#ff0000" strokeWidth={1} />
                    <Line points={[0, -8, 0, 8]} stroke="#ff0000" strokeWidth={1} />
                  </Group>

                  {/* Impact Point (Bullet Hole) */}
                  <Group x={ex} y={ey}>
                    <Circle radius={6} fill="#ff0000" />
                    <Circle radius={12} stroke="#ff0000" strokeWidth={1.5} dash={[2, 2]} />
                  </Group>

                  {/* Angle and Distance Label - Parallel to the line */}
                  {(() => {
                    let displayAngle = angle;
                    // Flip text if it's upside down (between 90 and 270 degrees)
                    if (displayAngle > 90 || displayAngle < -90) {
                      displayAngle += 180;
                    }
                    
                    const displayDist = shapeProps.distance || `${Math.round(dist)}cm`;
                    const az = shapeProps.azimuth;
                    const tl = shapeProps.tilt;
                    
                    const hasTechnicalData = (az !== undefined && az !== 0) || (tl !== undefined && tl !== 0);
                    const labelText = hasTechnicalData 
                      ? `${Math.round(Math.abs(angle))}° / ${displayDist}\nYa: ${az || 0}° Di: ${tl || 0}°`
                      : `${Math.round(Math.abs(angle))}° / ${displayDist}`;

                    return (
                      <Group 
                        x={(sx + ex) / 2} 
                        y={(sy + ey) / 2} 
                        rotation={displayAngle}
                        onClick={(e) => {
                          e.cancelBubble = true;
                          onOpenDistanceModal(shapeProps.id, shapeProps.distance || Math.round(dist).toString());
                        }}
                        onTap={(e) => {
                          e.cancelBubble = true;
                          onOpenDistanceModal(shapeProps.id, shapeProps.distance || Math.round(dist).toString());
                        }}
                      >
                        <Rect 
                          width={hasTechnicalData ? 90 : 74} 
                          height={hasTechnicalData ? 32 : 18} 
                          fill="rgba(0,0,0,0.8)" 
                          cornerRadius={4}
                          offsetX={hasTechnicalData ? 45 : 37} 
                          offsetY={hasTechnicalData ? 35 : 20}
                        />
                        <Text 
                          text={labelText} 
                          fill="#ffffff" 
                          fontSize={hasTechnicalData ? 9 : 10} 
                          fontStyle="bold" 
                          align="center" 
                          verticalAlign="middle"
                          width={hasTechnicalData ? 90 : 74} 
                          offsetX={hasTechnicalData ? 45 : 37} 
                          offsetY={hasTechnicalData ? 31 : 16}
                          lineHeight={1.2}
                        />
                      </Group>
                    );
                  })()}

                  {/* Drag Handles */}
                  {isSelected && (
                    <>
                      <Circle
                        x={sx} y={sy} radius={12} fill="rgba(255,0,0,0.1)" stroke="#ff0000" strokeWidth={1} draggable
                        onDragMove={(e) => {
                          const newSx = e.target.x();
                          const newSy = e.target.y();
                          const dx = ex - newSx;
                          const dy = ey - newSy;
                          const newAz = Math.round(Math.atan2(dy, dx) * 180 / Math.PI + 90);
                          const newLen = Math.round(Math.sqrt(dx*dx + dy*dy));
                          onChange({ 
                            ...shapeProps, 
                            startX: newSx, 
                            startY: newSy,
                            azimuth: (newAz + 360) % 360,
                            length: newLen
                          });
                        }}
                        onMouseEnter={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'crosshair';
                        }}
                        onMouseLeave={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'default';
                        }}
                        onDragEnd={() => {
                          if (onTrajectoryUpdate) onTrajectoryUpdate(shapeProps.id);
                        }}
                      />
                      <Circle
                        x={ex} y={ey} radius={12} fill="rgba(255,0,0,0.1)" stroke="#ff0000" strokeWidth={1} draggable
                        onDragMove={(e) => {
                          const newEx = e.target.x();
                          const newEy = e.target.y();
                          const dx = newEx - sx;
                          const dy = newEy - sy;
                          const newAz = Math.round(Math.atan2(dy, dx) * 180 / Math.PI + 90);
                          const newLen = Math.round(Math.sqrt(dx*dx + dy*dy));
                          onChange({ 
                            ...shapeProps, 
                            endX: newEx, 
                            endY: newEy,
                            azimuth: (newAz + 360) % 360,
                            length: newLen
                          });
                        }}
                        onMouseEnter={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'crosshair';
                        }}
                        onMouseLeave={(e) => {
                          const stage = e.target.getStage();
                          if (stage) stage.container().style.cursor = 'default';
                        }}
                        onDragEnd={() => {
                          if (onTrajectoryUpdate) onTrajectoryUpdate(shapeProps.id);
                        }}
                      />
                    </>
                  )}
                </Group>
              );
            })()}
          </Group>
        ) : shapeProps.symbolId === 'ev-angle-ruler' ? (
          <Group>
            {(() => {
              const w = shapeProps.width;
              const h = shapeProps.height;
              
              // Points logic: Vertex is always at [0, h], Arm1 is horizontal, Arm2 is angled
              // We use rotation and scaling for overall placement, 
              // but the 'angle' itself is a property.
              const angleVal = shapeProps.angle || 45;
              const armLength = Math.max(w, h);
              
              // Calculate Arm 2 end point based on angle
              const rad = (angleVal * Math.PI) / 180;
              const p2x = Math.cos(-rad) * armLength;
              const p2y = h + Math.sin(-rad) * armLength;

              return (
                <Group>
                  {/* Arm 1 (Base - Horizontal) */}
                  <Line
                    points={[0, h, armLength, h]}
                    stroke="#F5C518"
                    strokeWidth={4}
                    lineCap="round"
                  />
                  {/* Arm 2 (Angled) */}
                  <Line
                    points={[0, h, p2x, p2y]}
                    stroke="#F5C518"
                    strokeWidth={4}
                    lineCap="round"
                  />
                  {/* Angle Arc */}
                  <Arc
                    x={0}
                    y={h}
                    innerRadius={30}
                    outerRadius={35}
                    angle={angleVal}
                    rotation={-angleVal}
                    fill="#F5C518"
                    opacity={0.4}
                  />
                  {/* Angle Text */}
                  <Text
                    x={40}
                    y={h - 30}
                    text={`${Math.round(angleVal)}°`}
                    fontSize={18}
                    fontStyle="bold"
                    fill="#F5C518"
                    align="center"
                  />

                  {/* Interactive Angle Handle */}
                  {isSelected && (
                    <Circle
                      x={p2x}
                      y={p2y}
                      radius={10}
                      fill="white"
                      stroke="#F5C518"
                      strokeWidth={2}
                      draggable
                      onDragMove={(e) => {
                        const dx = e.target.x() - 0;
                        const dy = e.target.y() - h;
                        let newAngle = Math.atan2(-dy, dx) * 180 / Math.PI;
                        if (newAngle < 0) newAngle += 360;
                        onChange({
                          ...shapeProps,
                          angle: newAngle
                        });
                      }}
                      onMouseEnter={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'crosshair';
                      }}
                      onMouseLeave={(e) => {
                        const stage = e.target.getStage();
                        if (stage) stage.container().style.cursor = 'default';
                      }}
                      shadowBlur={5}
                      shadowColor="black"
                      shadowOpacity={0.5}
                    />
                  )}
                </Group>
              );
            })()}
          </Group>
        ) : shapeProps.type === 'finding-list' ? (
          <Group>
            {(() => {
              const findings = allObjects
                ?.filter((o: any) => o.findingNo)
                .sort((a: any, b: any) => (a.findingNo || '').localeCompare(b.findingNo || '', undefined, { numeric: true })) || [];

              const itemsWithPosition: any[] = [];
              let currentY = 0;
              const textWidth = shapeProps.width - 16;
              const charWidth = 4.5; // average width per char for font size 9
              const prefixWidth = 54;
              const descWidth = textWidth - prefixWidth;
              const charsPerDescLine = descWidth / charWidth;

              findings.forEach((obj: any) => {
                const prefix = `Bulgu No. ${obj.findingNo}:`;
                const desc = obj.findingDesc || obj.name || '';
                const lines = Math.max(1, Math.ceil(desc.length / charsPerDescLine));
                const itemHeight = lines * 11 + 6;
                
                itemsWithPosition.push({ obj, prefix, desc, y: currentY, prefixWidth, descWidth });
                currentY += itemHeight;
              });

              const totalHeight = Math.max(100, currentY + 40);

              return (
                <>
                  <Rect 
                    width={shapeProps.width}
                    height={totalHeight}
                    fill="rgba(255, 255, 255, 0.9)"
                    stroke="#000"
                    strokeWidth={1}
                  />
                  <Text 
                    text="BULGU LİSTESİ"
                    width={shapeProps.width}
                    y={5}
                    align="center"
                    fontSize={11}
                    fontStyle="bold"
                    fill="#000"
                  />
                  <Line points={[5, 20, shapeProps.width - 5, 20]} stroke="#000" strokeWidth={1} />
                  
                  <Group y={25}>
                    {itemsWithPosition.map((item) => (
                      <Group key={item.obj.id}>
                        <Text
                          text={item.prefix}
                          y={item.y}
                          x={8}
                          fontSize={9}
                          fontStyle="bold"
                          fill="#000"
                          width={item.prefixWidth}
                          wrap="none"
                        />
                        <Text
                          text={item.desc}
                          y={item.y}
                          x={8 + item.prefixWidth}
                          fontSize={9}
                          fill="#000"
                          width={item.descWidth}
                          wrap="word"
                        />
                      </Group>
                    ))}
                  </Group>
                </>
              );
            })()}
          </Group>
        ) : (shapeProps.symbolId === 'ev-circle' || shapeProps.symbolId === 'ev-square') ? (
          <Group>
            {shapeProps.symbolId === 'ev-circle' ? (
              <Circle
                width={shapeProps.width}
                height={shapeProps.height}
                x={shapeProps.width / 2}
                y={shapeProps.height / 2}
                fill="#F5C518"
                stroke="#000"
                strokeWidth={2}
                shadowBlur={5}
                shadowOpacity={0.3}
              />
            ) : (
              <Rect
                width={shapeProps.width}
                height={shapeProps.height}
                fill="#F5C518"
                stroke="#000"
                strokeWidth={2}
                shadowBlur={5}
                shadowOpacity={0.3}
              />
            )}
            <Text
              text={String(shapeProps.findingNo ?? '')}
              width={shapeProps.width}
              height={shapeProps.height}
              align="center"
              verticalAlign="middle"
              fontSize={shapeProps.width * 0.4}
              fontStyle="bold"
              fill="#000"
            />
          </Group>
        ) : shapeProps.symbolId === 'a-4' ? (
          <Arrow
            points={[0, shapeProps.height / 2, shapeProps.width, shapeProps.height / 2]}
            stroke="#000000"
            fill="#000000"
            strokeWidth={3}
            pointerLength={10}
            pointerWidth={10}
            pointerAtBeginning={true}
            pointerAtEnding={true}
            opacity={1}
          />
        ) : shapeProps.symbolId === 'tr-2' ? (
          <Rect
            width={shapeProps.width}
            height={shapeProps.height}
            fillPatternImage={image}
            fillPatternRepeat="repeat-x"
            fillPatternScale={{ 
              x: shapeProps.height / (image?.height || 1), 
              y: shapeProps.height / (image?.height || 1) 
            }}
            scaleX={shapeProps.scaleX || 1}
            scaleY={shapeProps.scaleY || 1}
            offsetX={(shapeProps.scaleX === -1) ? shapeProps.width : 0}
            offsetY={(shapeProps.scaleY === -1) ? shapeProps.height : 0}
            filters={[Konva.Filters.Grayscale, RemoveWhiteFilter]}
            onMouseMove={() => {
              if (imgRef.current) imgRef.current.cache();
            }}
          />
        ) : (
           <KonvaImage
            ref={imgRef}
            image={image}
            width={shapeProps.width}
            height={shapeProps.height}
            globalCompositeOperation="source-over"
            draggable={false}
            imageSmoothingEnabled={true}
            scaleX={shapeProps.scaleX || 1}
            scaleY={shapeProps.scaleY || 1}
            offsetX={(shapeProps.scaleX === -1) ? shapeProps.width : 0}
            offsetY={(shapeProps.scaleY === -1) ? shapeProps.height : 0}
          />
        )}

        {shapeProps.distance && !['ev-arrow-desc', 'ev-arrow-desc-ellipse', 'ev-callout', 'ev-shooting-trajectory'].includes(shapeProps.symbolId || '') && (
          (() => {
            const isDistanceTool = shapeProps.isDistanceArrow || shapeProps.symbolId === 'a-4';
            
            // For arrows, the group is already centered at the midpoint in most cases, 
            // but we ensure it by using width/2 if startX/endX are relative or missing.
            const textX = isDistanceTool ? (shapeProps.width / 2) : 0;
            const textY = isDistanceTool ? (shapeProps.height / 2) : 0;

            const angle = isDistanceTool && shapeProps.startX !== undefined
              ? Math.atan2(shapeProps.endY - shapeProps.startY, shapeProps.endX - shapeProps.startX) * (180 / Math.PI)
              : 0;

            // Normalize angle for readability
            let textRotation = angle;
            if (textRotation > 90) textRotation -= 180;
            if (textRotation < -90) textRotation += 180;

            const fontSize = shapeProps.distanceFontSize || ((shapeProps.isDistanceArrow || shapeProps.symbolId === 'a-4') ? 10 : 14);

            return (
              <Group 
                x={isDistanceTool ? textX : 0} 
                y={isDistanceTool ? textY : (
                  shapeProps.symbolId === 'ev-arrow-text' ? -20 : 
                  shapeProps.symbolId === 'ev-callout' ? 0 :
                  (shapeProps.isDistanceArrow || shapeProps.symbolId === 'a-4') 
                    ? (shapeProps.height / 2)
                    : (shapeProps.height ? Number(shapeProps.height) + 5 : 50)
                )}
                rotation={textRotation}
              >
                {/* Distance Text (Above Line) */}
                <Text
                  text={String(shapeProps.text || shapeProps.distance || '')}
                  fontSize={fontSize}
                  fontStyle="bold"
                  fill={shapeProps.distanceColor || '#000000'}
                  x={0}
                  y={-fontSize - 8}
                  width={400}
                  align="center"
                  padding={0}
                  listening={false}
                  offsetX={200}
                />
                
                {/* Speed Text (Below Line) - Conditional */}
                {shapeProps.showSpeedInfo && (() => {
                  const rawText = String(shapeProps.text || shapeProps.distance || '');
                  // Extract numbers from text (e.g. "45 metre" -> 45)
                  const match = rawText.match(/\d+(\.\d+)?/);
                  const cm = match ? parseFloat(match[0]) : NaN;
                  
                  if (!isNaN(cm) && cm > 0) {
                    // If the user wrote something like "45 metre", assume they mean meters?
                    // No, usually the system works in CM (50px = 1m).
                    // If the value is small (e.g. < 50), they might be typing meters.
                    // But for consistency, we'll follow the canvas scale.
                    const meters = rawText.toLowerCase().includes('metre') ? cm : cm / 100;
                    const mu = shapeProps.mu || 0.75;
                    const efficiency = shapeProps.efficiency || 100;
                    const speed = Math.round(15.94 * Math.sqrt(mu * meters * (efficiency / 100)));
                    return (
                      <Text
                        text={`(~${speed} km/s)`}
                        fontSize={fontSize * 0.85}
                        fontStyle="italic bold"
                        fill="#059669" // Emerald-600
                        x={0}
                        y={5}
                        width={400}
                        align="center"
                        padding={0}
                        listening={false}
                        offsetX={200}
                      />
                    );
                  }
                  return null;
                })()}
              </Group>
            );
          })()
        )}

        {/* Finding No Label for all symbols */}
        {shapeProps.findingNo && !['ev-circle', 'ev-square', 'finding-list'].includes(shapeProps.symbolId || '') && (
          <Group 
            x={shapeProps.width / 2} 
            y={-15}
          >
            <Circle
              radius={8}
              fill="#F5C518"
              stroke="#000"
              strokeWidth={1}
            />
            <Text
              text={String(shapeProps.findingNo)}
              fontSize={9}
              fontStyle="bold"
              fill="#000"
              width={16}
              height={16}
              align="center"
              verticalAlign="middle"
              offsetX={8}
              offsetY={8}
            />
          </Group>
        )}

      </Group>

      {isSelected && (!shapeProps.isTemplate || (shapeProps.id === 'corporate-logo' && isAdmin)) && (
        <Transformer
          ref={trRef}
          rotateEnabled={
            shapeProps.type !== 'rect' && 
            shapeProps.type !== 'line' && 
            !['arch-1', 'arch-1v'].includes(shapeProps.symbolId || '')
          }
          enabledAnchors={
            isStretchable
              ? ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']
              : ['top-left', 'top-right', 'bottom-left', 'bottom-right']
          }
          keepRatio={shapeProps.categoryId === 'furniture' ? true : !isStretchable}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
              return oldBox;
            }
            
            if (drawingArea && !shapeProps.isTemplate) {
              if (newBox.x < drawingArea.x) {
                newBox.width += newBox.x - drawingArea.x;
                newBox.x = drawingArea.x;
              }
              if (newBox.y < drawingArea.y) {
                newBox.height += newBox.y - drawingArea.y;
                newBox.y = drawingArea.y;
              }
              if (newBox.x + newBox.width > drawingArea.x + drawingArea.width) {
                newBox.width = drawingArea.x + drawingArea.width - newBox.x;
              }
              if (newBox.y + newBox.height > drawingArea.y + drawingArea.height) {
                newBox.height = drawingArea.y + drawingArea.height - newBox.y;
              }
              
              // Kırpmadan sonra çok küçüldüyse iptal et
              if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
                return oldBox;
              }
            }
            return newBox;
          }}
        />
      )}
    </React.Fragment>
  );
};

export const CanvasArea: React.FC = () => {
  const { 
    objects, 
    backgroundImage, 
    backgroundOpacity, 
    backgroundGrayscale, 
    selectedId, 
    setSelectedId, 
    updateObject, 
    addObject, 
    saveHistory, 
    removeObject,
    removeObjects,
    canvasBgColor,
    canvasOrientation,
    setCanvasBgColor,
    setCanvasOrientation,
    addNotification,
    drawingArea,
    projectInfo,
    isAdmin,
    updateProjectInfo,
    scaleCalibration,
  } = useStore();

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredPos, setHoveredPos] = useState<{ x: number, y: number } | null>(null);
  
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isAdmin) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const src = event.target?.result as string;
        
        // Yeni bir Image nesnesi oluşturup boyutlarını alalım ki kutuya tam otursun
        const img = new Image();
        img.onload = () => {
          const logo = objects.find(o => o.id === 'corporate-logo');
          const boxW = logo?.width || 50;
          const boxH = logo?.height || 40;
          
          const imgRatio = img.width / img.height;
          const boxRatio = boxW / boxH;
          
          let finalW, finalH;
          if (imgRatio > boxRatio) {
            // Resim daha geniş: Genişliği kutuya uydur, yüksekliği küçült
            finalW = boxW;
            finalH = boxW / imgRatio;
          } else {
            // Resim daha dar: Yüksekliği kutuya uydur, genişliği küçült
            finalH = boxH;
            finalW = boxH * imgRatio;
          }
          
          updateProjectInfo({ corporateLogo: src });
          updateObject('corporate-logo', { 
            src,
            width: finalW,
            height: finalH,
            // Kutunun merkezine ortalayalım
            x: (logo?.x || 0) + (boxW - finalW) / 2,
            y: (logo?.y || 0) + (boxH - finalH) / 2
          });
          
          addNotification({
            type: 'success',
            message: 'Logo Yerleştirildi',
            description: 'Logo, alanın içerisine oranları korunarak tam sığacak şekilde yerleştirildi.'
          });
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    }
  };
  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    title: string;
    label: string;
    value: string;
    onConfirm: (val: string) => void;
    multiline?: boolean;
  }>({
    isOpen: false,
    title: '',
    label: '',
    value: '',
    onConfirm: () => {},
    multiline: false
  });

  const [isDistanceMatrixOpen, setIsDistanceMatrixOpen] = useState(false);

  const [findingModalState, setFindingModalState] = useState({
    isOpen: false,
    symbol: null as any,
    pos: { x: 0, y: 0 }
  });


  const [isDistanceModalOpen, setIsDistanceModalOpen] = useState(false);
  const [distanceModalTarget, setDistanceModalTarget] = useState<string | null>(null);
  const [initialDistance, setInitialDistance] = useState('');

  const [isEvidencePhotoModalOpen, setIsEvidencePhotoModalOpen] = useState(false);
  const [evidencePhotoTarget, setEvidencePhotoTarget] = useState<string | null>(null);

  const [isBodyMapModalOpen, setIsBodyMapModalOpen] = useState(false);
  const [bodyMapTarget, setBodyMapTarget] = useState<string | null>(null);

  const bgImage = useSmartImage(backgroundImage || undefined);
  const stageRef = useRef<any>(null);
  const bgImageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [previousScale] = useState(1);
  const [gridVisible, setGridVisible] = useState(true);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Keep stage positioned at { x: 0, y: 0 } when orientation changes
    setStagePos({ x: 0, y: 0 });
  }, [canvasOrientation]);

  const handleWheel = (e: any) => {
    // Only zoom if Ctrl key is pressed
    if (!e.evt.ctrlKey) return;
    
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const scaleBy = 1.1;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    // Limit zoom
    const limitedScale = Math.max(0.1, Math.min(newScale, 5));
    
    setScale(limitedScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * limitedScale,
      y: pointer.y - mousePointTo.y * limitedScale,
    });
  };

  const handleTriangulate = (objId: string) => {
    const obj = objects.find(o => o.id === objId);
    if (!obj) return;

    const centerX = obj.x + (obj.width * (obj.scaleX || 1)) / 2;
    const centerY = obj.y + (obj.height * (obj.scaleY || 1)) / 2;
    const radius = (obj.width * (obj.scaleX || 1)) / 2;

    // 1. First, look for manually placed Fixed Points (isTriangulation)
    const fixedPoints = objects.filter(o => 
      (o.isTriangulation || o.symbolId === 'out-fixed-point' || o.symbolId === 'out-pole') && 
      o.id !== objId && 
      o.symbolId !== 'a-4'
    ).map(fp => ({
      ...fp,
      centerX: fp.x + (fp.width * (fp.scaleX || 1)) / 2,
      centerY: fp.y + (fp.height * (fp.scaleY || 1)) / 2,
      dist: Math.sqrt(Math.pow((fp.x + (fp.width * (fp.scaleX || 1)) / 2) - centerX, 2) + Math.pow((fp.y + (fp.height * (fp.scaleY || 1)) / 2) - centerY, 2))
    })).sort((a, b) => a.dist - b.dist);

    if (fixedPoints.length >= 2) {
      // Professional Outdoor Triangulation: Measure from the 2 nearest fixed points
      const nearestPoints = fixedPoints.slice(0, 2);
      const arrowColor = '#000000'; // Siyah renk

      nearestPoints.forEach((fp) => {
        const dx = fp.centerX - centerX;
        const dy = fp.centerY - centerY;
        const angle = Math.atan2(dy, dx);
        
        // Offset start/end to be outside the icons
        const startX = centerX + Math.cos(angle) * radius;
        const startY = centerY + Math.sin(angle) * radius;
        const endX = fp.centerX - Math.cos(angle) * 20; // 20 is half fixed point width
        const endY = fp.centerY - Math.sin(angle) * 20;

        addObject({
          type: 'symbol',
          symbolId: 'a-4',
          categoryId: 'arrows',
          x: (startX + endX) / 2,
          y: (startY + endY) / 2,
          startX: startX,
          startY: startY,
          endX: endX,
          endY: endY,
          width: Math.abs(endX - startX),
          height: Math.abs(endY - startY),
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          distance: `${Math.round(fp.dist * (scaleCalibration.realDistance / scaleCalibration.pixelDistance))} ${scaleCalibration.unit}`,
          distanceColor: arrowColor,
          distanceFontSize: 14,
          fill: '#000000',
          stroke: '#000000',
          isDistanceArrow: true,
          isTriangulation: true,
          measuredIds: [obj.id, fp.id],
          name: `Nirengi (${obj.findingNo || 'Bulgu'} - ${fp.findingNo || 'Sabit Nokta'})`
        });
      });

      addNotification({
        type: 'success',
        message: 'Açık Alan Nirengi Ölçümü Tamamlandı',
        description: `"${obj.findingNo || 'Bulgu'}" ile en yakın iki sabit nokta (${nearestPoints.map(p => p.findingNo).join(', ')}) arası mesafeler eklendi.`
      });
      return;
    }

    // 2. Fallback to Architecture (Indoor mode)
    const walls = objects.filter(o => 
      (o.categoryId === 'architecture' || o.type === 'line' || o.type === 'rect') && 
      o.id !== objId && 
      !o.isTemplate
    );

    if (walls.length === 0) {
      addNotification({
        type: 'warning',
        message: 'Ölçüm Noktası Bulunamadı',
        description: 'Nirengi hesabı için ya en az 2 sabit nokta (elektrik direği vb.) eklemeli ya da mimari hatlar (duvar) çizmelisiniz.'
      });
      return;
    }

    // Helper to find nearest orthogonal point on any wall
    const findNearestX = (dir: number) => {
      let nearestDist = Infinity;
      let nearestPoint = 0;
      
      objects.forEach(other => {
        const isWall = ['arch-w1', 'arch-w1v', 'arch-w1i', 'arch-w1vi', 'arch-w-square', 'ev-rect-hollow'].includes(other.symbolId || '');
        if (!isWall) return;

        const otherW = other.width * (other.scaleX || 1);
        const otherH = other.height * (other.scaleY || 1);
        const otherX1 = other.x;
        const otherX2 = other.x + otherW;
        const otherY1 = other.y;
        const otherY2 = other.y + otherH;

        // Check if wall is in the path along X axis
        if (centerY >= otherY1 && centerY <= otherY2) {
          const edges = [otherX1, otherX2];
          edges.forEach(ex => {
            const d = (ex - centerX) * dir;
            // d > 0 means the edge is in the specified direction
            if (d > 0.01 && d < nearestDist) {
              nearestDist = d;
              nearestPoint = ex;
            }
          });
        }
      });
      return { dist: nearestDist, point: nearestPoint };
    };

    const findNearestY = (dir: number) => {
      let nearestDist = Infinity;
      let nearestPoint = 0;
      
      objects.forEach(other => {
        const isWall = ['arch-w1', 'arch-w1v', 'arch-w1i', 'arch-w1vi', 'arch-w-square', 'ev-rect-hollow'].includes(other.symbolId || '');
        if (!isWall) return;

        const otherW = other.width * (other.scaleX || 1);
        const otherH = other.height * (other.scaleY || 1);
        const otherX1 = other.x;
        const otherX2 = other.x + otherW;
        const otherY1 = other.y;
        const otherY2 = other.y + otherH;

        // Check if wall is in the path along Y axis
        if (centerX >= otherX1 && centerX <= otherX2) {
          const edges = [otherY1, otherY2];
          edges.forEach(ey => {
            const d = (ey - centerY) * dir;
            // d > 0 means the edge is in the specified direction
            if (d > 0.01 && d < nearestDist) {
              nearestDist = d;
              nearestPoint = ey;
            }
          });
        }
      });
      return { dist: nearestDist, point: nearestPoint };
    };

    // Find best X (Left vs Right)
    const left = findNearestX(-1);
    const right = findNearestX(1);
    const xRes = left.dist < right.dist ? { ...left, dir: -1 } : { ...right, dir: 1 };

    // Find best Y (Up vs Down)
    const up = findNearestY(-1);
    const down = findNearestY(1);
    const yRes = up.dist < down.dist ? { ...up, dir: -1 } : { ...down, dir: 1 };

    const arrowColor = '#000000'; // Siyah renk 
    
    // Create X Arrow
    if (xRes.dist !== Infinity && xRes.dist > radius) {
      const startX = centerX + xRes.dir * radius;
      addObject({
        type: 'symbol',
        symbolId: 'a-4',
        categoryId: 'arrows',
        x: (startX + xRes.point) / 2,
        y: centerY,
        startX: startX,
        startY: centerY,
        endX: xRes.point,
        endY: centerY,
        width: Math.abs(xRes.point - startX),
        height: 6,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
          distance: `${Math.round(xRes.dist * (scaleCalibration.realDistance / scaleCalibration.pixelDistance))} ${scaleCalibration.unit}`,
        distanceColor: arrowColor,
        distanceFontSize: 10,
        fill: arrowColor,
        stroke: arrowColor,
        isDistanceArrow: true,
        isTriangulation: true,
        name: `Nirengi X (${obj.findingNo || 'Bulgu'})`
      });
    }

    // Create Y Arrow
    if (yRes.dist !== Infinity && yRes.dist > radius) {
      const startY = centerY + yRes.dir * radius;
      addObject({
        type: 'symbol',
        symbolId: 'a-4',
        categoryId: 'arrows',
        x: centerX,
        y: (startY + yRes.point) / 2,
        startX: centerX,
        startY: startY,
        endX: centerX,
        endY: yRes.point,
        width: 6,
        height: Math.abs(yRes.point - startY),
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
          distance: `${Math.round(yRes.dist * (scaleCalibration.realDistance / scaleCalibration.pixelDistance))} ${scaleCalibration.unit}`,
        distanceColor: arrowColor,
        distanceFontSize: 10,
        fill: arrowColor,
        stroke: arrowColor,
        isDistanceArrow: true,
        isTriangulation: true,
        name: `Nirengi Y (${obj.findingNo || 'Bulgu'})`
      });
    }

    addNotification({
      type: 'success',
      message: 'Nirengi Ölçüleri Oluşturuldu',
      description: 'En yakın mimari hatlara olan X ve Y mesafeleri tam temas ile otomatik olarak eklendi.'
    });
  };

  const handleDrawMeasurement = (f1: any, f2: any) => {
    const getCenter = (obj: any) => {
      if (obj.symbolId === 'ev-shooting-trajectory') {
        const sx = obj.startX || 0;
        const sy = obj.startY || 0;
        const ex = obj.endX || 0;
        const ey = obj.endY || 0;
        return { x: obj.x + (sx + ex) / 2, y: obj.y + (sy + ey) / 2 };
      }
      return { x: obj.x + (obj.width * (obj.scaleX || 1)) / 2, y: obj.y + (obj.height * (obj.scaleY || 1)) / 2 };
    };

    const p1 = getCenter(f1);
    const p2 = getCenter(f2);
    const r1 = (f1.width * (f1.scaleX || 1)) / 2;
    const r2 = (f2.width * (f2.scaleX || 1)) / 2;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const totalDist = Math.sqrt(dx * dx + dy * dy);

    if (totalDist <= r1 + r2) {
      addNotification({
        type: 'warning',
        message: 'Mesafe Çok Kısa',
        description: 'Bulgular birbirine çok yakın olduğu için ölçü okları çizilemedi.'
      });
      return;
    }

    // Birim vektör (p1 -> p2 yönünde)
    const ux = dx / totalDist;
    const uy = dy / totalDist;

    // Kenarlara kadar offsetle
    const startX = p1.x + ux * r1;
    const startY = p1.y + uy * r1;
    const endX = p2.x - ux * r2;
    const endY = p2.y - uy * r2;
    
    const actualDist = totalDist - r1 - r2;
    const arrowColor = '#000000'; // Siyah renk

    addObject({
      type: 'symbol',
      symbolId: 'a-4',
      categoryId: 'arrows',
      x: (startX + endX) / 2,
      y: (startY + endY) / 2,
      startX: startX,
      startY: startY,
      endX: endX,
      endY: endY,
      width: actualDist,
      height: 6,
      scaleX: 1,
      scaleY: 1,
      isDistanceArrow: true,
      isTriangulation: false,
      measuredIds: [f1.id, f2.id],
          distance: `${Math.round(totalDist * (scaleCalibration.realDistance / scaleCalibration.pixelDistance))} ${scaleCalibration.unit}`,
      distanceColor: arrowColor,
      distanceFontSize: 12,
      fill: arrowColor,
      stroke: arrowColor,
      name: `Mesafe (${f1.findingNo}-${f2.findingNo})`
    });
    
    setIsDistanceMatrixOpen(false);
    addNotification({
      type: 'success',
      message: 'Mesafe Ölçüsü Eklendi',
      description: `${f1.findingNo} ve ${f2.findingNo} nolu bulgular arası mesafe siyah ok ile tuvale eklendi.`
    });
  };




  useEffect(() => {
    if (bgImage && bgImageRef.current) {
      bgImageRef.current.cache();
    }
  }, [bgImage, backgroundGrayscale, backgroundOpacity]);

  useEffect(() => {
    const handleExportPDF = async () => {
      const state = useStore.getState();
      if (!stageRef.current) return;

      // 1. Keep track of current active scene so we can restore it at the end
      const originalSceneId = state.activeSceneId;
      
      // Save current active canvas state into the active scene first
      const currentActiveId = state.activeSceneId;
      const updatedScenes = state.scenes.map((s: any) => 
        s.id === currentActiveId 
          ? { 
              ...s, 
              type: state.projectInfo.type, 
              objects: [...state.objects], 
              backgroundImage: state.backgroundImage, 
              projectInfo: { ...state.projectInfo }, 
              drawingArea: state.drawingArea 
            } 
          : s
      );

      const scenesToExport = updatedScenes.length > 0 ? updatedScenes : [
        {
          id: 'temp-current',
          name: 'Sayfa 1',
          type: state.projectInfo.type,
          objects: [...state.objects],
          backgroundImage: state.backgroundImage,
          projectInfo: { ...state.projectInfo },
          drawingArea: state.drawingArea
        }
      ];

      addNotification({
        type: 'info',
        message: 'PDF Hazırlanıyor',
        description: `${scenesToExport.length} sayfa sırayla işleniyor, lütfen bekleyin...`
      });

      // Deselect objects to hide transformers
      setSelectedId(null);
      // Hide grid for export
      setGridVisible(false);
      
      // Small delay to ensure grid hiding is applied
      await new Promise(resolve => setTimeout(resolve, 150));

      try {
        const orientation = canvasOrientation === 'landscape' ? 'l' : 'p';
        let pdf: jsPDF | null = null;
        let pageWidth = 1000;
        let pageHeight = 1400;

        // Helper: load an image to HTMLImageElement, resolves null on error
        const loadImg = (src: string): Promise<HTMLImageElement | null> => new Promise(resolve => {
          if (!src) return resolve(null);
          // data: and blob: URLs don't need crossOrigin
          const isDataOrBlob = src.startsWith('data:') || src.startsWith('blob:');
          const img = new Image();
          if (!isDataOrBlob) img.crossOrigin = 'Anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => {
            if (!isDataOrBlob) {
              // Retry without crossOrigin as fallback
              const img2 = new Image();
              img2.onload = () => resolve(img2);
              img2.onerror = () => resolve(null);
              img2.src = src;
            } else {
              resolve(null);
            }
          };
          img.src = src;
        });

        // Helper: draw a single scene to an off-screen canvas and return dataURL
        const renderSceneToDataURL = async (scene: any, bgColorVal: string): Promise<string> => {
          const sceneObjects: any[] = scene.objects || [];
          const W = canvasOrientation === 'landscape' ? 1400 : 1000;
          const H = canvasOrientation === 'landscape' ? 1000 : 1400;
          const PIXEL_RATIO = 2;

          const offCanvas = document.createElement('canvas');
          offCanvas.width = W * PIXEL_RATIO;
          offCanvas.height = H * PIXEL_RATIO;
          const ctx = offCanvas.getContext('2d')!;
          ctx.scale(PIXEL_RATIO, PIXEL_RATIO);

          // Background
          ctx.fillStyle = bgColorVal || '#ffffff';
          ctx.fillRect(0, 0, W, H);

          // Background image
          if (scene.backgroundImage) {
            const bgImg = await loadImg(scene.backgroundImage);
            if (bgImg) {
              const da = scene.drawingArea || { x: 0, y: 0, width: W, height: H };
              ctx.save();
              ctx.beginPath();
              ctx.rect(da.x, da.y, da.width, da.height);
              ctx.clip();
              ctx.globalAlpha = 1;
              ctx.drawImage(bgImg, da.x, da.y, da.width, da.height);
              ctx.restore();
            }
          }

          // Preload all object images in parallel
          const srcList = sceneObjects.map((o: any) => o.src || '').filter(Boolean);
          const imgMap = new Map<string, HTMLImageElement | null>();
          await Promise.all(srcList.map(async (src: string) => {
            if (!imgMap.has(src)) {
              imgMap.set(src, await loadImg(src));
            }
          }));

          // Sort objects by z-index (template first, then user objects)
          const sorted = [...sceneObjects].sort((a, b) => {
            const az = a.zIndex ?? (a.isTemplate ? -1 : 0);
            const bz = b.zIndex ?? (b.isTemplate ? -1 : 0);
            return az - bz;
          });

          for (const obj of sorted) {
            if (!obj || obj.hidden) continue;
            ctx.save();

            const x = obj.x ?? 0;
            const y = obj.y ?? 0;
            const w = obj.width ?? 50;
            const h = obj.height ?? 50;
            const rot = ((obj.rotation ?? 0) * Math.PI) / 180;
            const ox = (obj as any).offsetX ?? 0;
            const oy = (obj as any).offsetY ?? 0;

            // Apply transform matching Konva node origin
            if (rot !== 0 || ox !== 0 || oy !== 0) {
              ctx.translate(x + ox, y + oy);
              ctx.rotate(rot);
              ctx.scale(obj.scaleX ?? 1, obj.scaleY ?? 1);
              ctx.translate(-ox, -oy);
            } else {
              ctx.translate(x, y);
              ctx.scale(obj.scaleX ?? 1, obj.scaleY ?? 1);
            }

            if (obj.src) {
              // Image-based symbol / uploaded image / photo
              const img = imgMap.get(obj.src);
              if (img) {
                ctx.drawImage(img, 0, 0, w, h);
              }
            } else if (obj.type === 'rect') {
              ctx.fillStyle = obj.fill || 'transparent';
              ctx.strokeStyle = obj.stroke || 'black';
              ctx.lineWidth = obj.strokeWidth || 1;
              if (obj.fill && obj.fill !== 'transparent') ctx.fillRect(0, 0, w, h);
              ctx.strokeRect(0, 0, w, h);
            } else if (obj.type === 'line') {
              ctx.strokeStyle = obj.fill || 'black';
              ctx.lineWidth = obj.strokeWidth || Math.min(w, h) || 1;
              if (obj.dash) ctx.setLineDash(obj.dash);
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(w > h ? w : 0, w > h ? 0 : h);
              ctx.stroke();
            } else if (obj.type === 'text' || obj.type === 'template-text') {
              ctx.font = `${obj.fontStyle || 'normal'} ${obj.fontSize || 12}px ${obj.fontFamily || 'Arial'}`;
              ctx.fillStyle = obj.fill || '#000';
              ctx.textAlign = (obj.align as CanvasTextAlign) || 'left';
              const text = obj.text || '';
              const lines = text.split('\n');
              const textX = obj.align === 'right' ? w : (obj.align === 'center' ? w / 2 : 0);
              lines.forEach((line: string, idx: number) => {
                ctx.fillText(line, textX, (obj.fontSize || 12) * (idx + 1));
              });
            } else if (obj.symbolId === 'ev-circle') {
              ctx.beginPath();
              ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
              ctx.fillStyle = '#F5C518';
              ctx.fill();
              ctx.strokeStyle = '#000';
              ctx.lineWidth = 2;
              ctx.stroke();
              if (obj.findingNo) {
                ctx.font = `bold ${w * 0.4}px Arial`;
                ctx.fillStyle = '#000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(obj.findingNo), w / 2, h / 2);
              }
            } else if (obj.symbolId === 'ev-square') {
              ctx.fillStyle = '#F5C518';
              ctx.fillRect(0, 0, w, h);
              ctx.strokeStyle = '#000';
              ctx.lineWidth = 2;
              ctx.strokeRect(0, 0, w, h);
              if (obj.findingNo) {
                ctx.font = `bold ${w * 0.4}px Arial`;
                ctx.fillStyle = '#000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(obj.findingNo), w / 2, h / 2);
              }
            }

            ctx.restore();
          }

          try {
            return offCanvas.toDataURL('image/jpeg', 0.92);
          } catch (err) {
            console.warn('offCanvas toDataURL failed, using stage fallback if active scene:', err);
            if (scene.id === currentActiveId && stageRef.current) {
              const fallbackUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
              if (fallbackUrl) return fallbackUrl;
            }
            return offCanvas.toDataURL('image/png');
          }
        };

        // Loop through all scenes, render each to off-screen canvas (no React dependency)
        for (let i = 0; i < scenesToExport.length; i++) {
          const scene = scenesToExport[i];

          const dataURL = await renderSceneToDataURL(scene, canvasBgColor);
          const W = canvasOrientation === 'landscape' ? 1400 : 1000;
          const H = canvasOrientation === 'landscape' ? 1000 : 1400;
          pageWidth = W;
          pageHeight = H;

          if (i === 0) {
            pdf = new jsPDF({
              orientation: orientation,
              unit: 'px',
              format: [pageWidth, pageHeight]
            });
          } else if (pdf) {
            pdf.addPage([pageWidth, pageHeight], orientation);
          }

          if (pdf) {
            pdf.addImage(dataURL, 'JPEG', 0, 0, pageWidth, pageHeight);
          }
        }

        if (!pdf) {
          throw new Error('PDF nesnesi oluşturulamadı.');
        }

        // --- APPENDIX: Finding Photos ---
        const allFindingsWithPhotos: any[] = [];
        const findingToScenePageMap: Record<string, number> = {};

        scenesToExport.forEach((scene, sceneIndex) => {
          const sceneFindings = (scene.objects || []).filter((o: any) => o.findingNo && o.photos && o.photos.length > 0);
          sceneFindings.forEach((f: any) => {
            if (!allFindingsWithPhotos.some(existing => existing.id === f.id)) {
              allFindingsWithPhotos.push(f);
              findingToScenePageMap[f.id] = sceneIndex + 1; // 1-based page index of the scene in the PDF
            }
          });
        });

        if (allFindingsWithPhotos.length > 0) {
          const loadImage = (url: string): Promise<HTMLImageElement> => {
            return new Promise((resolve) => {
              const isDataOrBlob = url.startsWith('data:') || url.startsWith('blob:');
              const img = new Image();
              if (!isDataOrBlob) img.crossOrigin = 'Anonymous';
              img.onload = () => resolve(img);
              img.onerror = () => {
                const img2 = new Image();
                img2.onload = () => resolve(img2);
                img2.onerror = () => resolve(img);
                img2.src = url;
              };
              img.src = url;
            });
          };

          const findingPageMap: Record<string, number> = {};

          for (const obj of allFindingsWithPhotos) {
            const photos = obj.photos || [];
            findingPageMap[obj.id] = pdf.getNumberOfPages() + 1;

            for (let i = 0; i < photos.length; i++) {
              const photoUrl = photos[i];
              try {
                const img = await loadImage(photoUrl);
                
                pdf.addPage([pageWidth, pageHeight], orientation);
                
                // Header for the photo page
                pdf.setFillColor(245, 197, 24); // #F5C518
                pdf.rect(0, 0, pageWidth, 40, 'F');
                
                pdf.setFontSize(14);
                pdf.setTextColor(0, 0, 0);
                pdf.setFont('helvetica', 'bold');
                pdf.text(`BULGU FOTOGRAFI - BULGU NO: ${obj.findingNo}`, 20, 25);
                
                pdf.setFontSize(10);
                pdf.text(`Dosya Eki: ${i + 1}/${photos.length}`, pageWidth - 20, 25, { align: 'right' });

                // Info Box
                pdf.setFillColor(240, 240, 240);
                pdf.rect(20, 50, pageWidth - 40, 30, 'F');
                pdf.setTextColor(60, 60, 60);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Tanim: ${obj.findingDesc || obj.name || 'Belirtilmedi'}`, 30, 68);

                // Calculate dimensions
                const margin = 40;
                const maxWidth = pageWidth - (margin * 2);
                const maxHeight = pageHeight - 120;
                
                let finalW = img.width;
                let finalH = img.height;
                const ratio = img.width / img.height;

                if (finalW > maxWidth) {
                  finalW = maxWidth;
                  finalH = finalW / ratio;
                }
                if (finalH > maxHeight) {
                  finalH = maxHeight;
                  finalW = finalH * ratio;
                }

                const x = (pageWidth - finalW) / 2;
                const y = 100 + (maxHeight - finalH) / 2;

                pdf.setDrawColor(200, 200, 200);
                pdf.rect(x - 2, y - 2, finalW + 4, finalH + 4, 'S');
                pdf.addImage(img, 'JPEG', x, y, finalW, finalH);
                
                // Add "Go Back to the correct Drawing Page" link
                const backPage = findingToScenePageMap[obj.id] || 1;
                pdf.setFontSize(8);
                pdf.setTextColor(0, 0, 255);
                pdf.textWithLink('<< KROKIYE GERI DON', 20, pageHeight - 20, { pageNumber: backPage });
                
              } catch (err) {
                console.error('Error adding photo to PDF:', photoUrl, err);
              }
            }
          }
          
          // Go back to the correct page to add clickable areas over finding markers
          allFindingsWithPhotos.forEach(obj => {
            const markerPage = findingToScenePageMap[obj.id];
            if (markerPage && findingPageMap[obj.id]) {
              pdf.setPage(markerPage);
              pdf.link(obj.x, obj.y, obj.width, obj.height, { pageNumber: findingPageMap[obj.id] });
            }
          });
        }

        // Format the report number cleanly, replacing backslashes and forwardslashes with dashes
        // so that Windows doesn't reject the filename and fall back to Blob UUIDs.
        const cleanReportNo = (state.projectInfo.reportNo || '')
          .replace(/[\/\\]/g, '-') // Replace both '/' and '\' with '-'
          .replace(/[:*?"<>|]/g, '_') // Replace other invalid Windows characters with '_'
          .trim();

        const reportSuffix = cleanReportNo ? ` ${cleanReportNo}` : '';
        const baseName = state.projectInfo.type === 'diagram' 
          ? `Olay Yeri Diyagramı${reportSuffix}`
          : `Olay Yeri Krokisi${reportSuffix}`;
          
        // 1. Save PDF directly to Downloads folder (İndirilenler)
        pdf.save(`${baseName}.pdf`);

        // 2. Open PDF in a new tab simultaneously for instant preview
        try {
          const pdfBlob = pdf.output('blob');
          const pdfUrl = URL.createObjectURL(pdfBlob);
          window.open(pdfUrl, '_blank');
        } catch (openErr) {
          console.error('Error opening PDF in new tab:', openErr);
        }

        // Restore the original active scene
        if (originalSceneId) {
          useStore.getState().switchScene(originalSceneId);
        }

        setGridVisible(true);
        addNotification({
          type: 'success',
          message: 'PDF Kaydedildi ve Açıldı',
          description: `"${baseName}.pdf" İndirilenler klasörüne kaydedildi ve yeni sekmede görüntülendi.`
        });
      } catch (error: any) {
        console.error('PDF Export Error:', error);
        
        // Make sure to restore original scene even on error
        if (originalSceneId) {
          useStore.getState().switchScene(originalSceneId);
        }

        addNotification({
          type: 'error',
          message: 'PDF Hatası',
          description: 'PDF oluşturulurken bir hata oluştu: ' + error.message
        });
        setGridVisible(true);
      }
    };

    // Register both local callback ref in the store and event listener for window
    useStore.setState({ exportPDFRef: handleExportPDF });
    window.addEventListener('export-pdf', handleExportPDF);

    // Register fall animation canvas export handler
    const handleFallExport = async () => {
      if (!stageRef.current) return;

      const state = useStore.getState();
      const { duration } = state.fallAnimation;
      if (!duration || duration <= 0) {
        addNotification({ type: 'warning', message: 'Animasyon verisi bulunamadı', description: 'Lütfen önce bir düşme analizi yapın.' });
        return;
      }

      useStore.getState().setFallAnimation({ currentTime: 0, isPlaying: true, speed: 1, loop: false });

      const stageContainer = stageRef.current.getContent();
      const canvasEl = stageContainer.querySelector('canvas');
      if (!canvasEl || typeof MediaRecorder === 'undefined') {
        const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `dusme-animasyonu-${Date.now()}.png`,
            types: [{ description: 'PNG Resim', accept: { 'image/png': ['.png'] } }],
          });
          const blob = await (await fetch(dataURL)).blob();
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch {
          const link = document.createElement('a');
          link.download = `dusme-animasyonu-${Date.now()}.png`;
          link.href = dataURL;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        return;
      }

      await new Promise(r => setTimeout(r, 100));

      const stream = canvasEl.captureStream(30);
      const mp4Types = ['video/mp4;codecs=h264,aac', 'video/mp4;codecs=avc1', 'video/mp4'];
      const mimeType = mp4Types.find(t => MediaRecorder.isTypeSupported(t))
        || (MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm');
      const isMp4 = mimeType.startsWith('video/mp4');
      const ext = isMp4 ? 'mp4' : 'webm';
      const baseMimeType = isMp4 ? 'video/mp4' : 'video/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.start(1000 / 30);

      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          const animState = useStore.getState().fallAnimation;
          if (!animState.isPlaying && animState.currentTime >= (duration - 0.01)) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
        setTimeout(() => { clearInterval(checkInterval); resolve(); }, (duration * 1000) + 3000);
      });

      mediaRecorder.stop();
      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => resolve();
      });

      const blob = new Blob(chunks, { type: baseMimeType });

      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `dusme-animasyonu-${state.fallAnimation.canvasData?.height || ''}m.${ext}`,
          types: [{ description: isMp4 ? 'MP4 Video' : 'WebM Video', accept: { [baseMimeType]: [`.${ext}`] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        addNotification({ type: 'success', message: 'Animasyon Kaydedildi', description: 'Düşme animasyonu video olarak kaydedildi.' });
      } catch {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `dusme-animasyonu-${state.fallAnimation.canvasData?.height || ''}m.${ext}`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    };
    useStore.setState({ fallAnimationExportRef: handleFallExport });

    const handleGeneratePreview = async () => {
      if (!stageRef.current) return;
      setSelectedId(null);
      setGridVisible(false);

      try {
        const state = useStore.getState();
        const W = canvasOrientation === 'landscape' ? 1400 : 1000;
        const H = canvasOrientation === 'landscape' ? 1000 : 1400;
        const PIXEL_RATIO = 2;

        // Build a list of all scenes to render (current active canvas state)
        const currentObjects = state.objects || [];
        const currentBg = state.backgroundImage;

        // Helper: load image to HTMLImageElement
        const loadImg = (src: string): Promise<HTMLImageElement | null> => new Promise(resolve => {
          if (!src) return resolve(null);
          const isLocal = src.startsWith('data:') || src.startsWith('blob:');
          const img = new Image();
          if (!isLocal) img.crossOrigin = 'Anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => {
            if (!isLocal) {
              const img2 = new Image();
              img2.onload = () => resolve(img2);
              img2.onerror = () => resolve(null);
              img2.src = src;
            } else resolve(null);
          };
          img.src = src;
        });

        const offCanvas = document.createElement('canvas');
        offCanvas.width = W * PIXEL_RATIO;
        offCanvas.height = H * PIXEL_RATIO;
        const ctx = offCanvas.getContext('2d')!;
        ctx.scale(PIXEL_RATIO, PIXEL_RATIO);

        // Background color
        ctx.fillStyle = canvasBgColor || '#ffffff';
        ctx.fillRect(0, 0, W, H);

        // Background image
        if (currentBg) {
          const bgImg = await loadImg(currentBg);
          if (bgImg) {
            const da = state.drawingArea || { x: 0, y: 0, width: W, height: H };
            ctx.save();
            ctx.beginPath();
            ctx.rect(da.x, da.y, da.width, da.height);
            ctx.clip();
            ctx.drawImage(bgImg, da.x, da.y, da.width, da.height);
            ctx.restore();
          }
        }

        // Preload all symbol images in parallel
        const srcList = [...new Set(currentObjects.map((o: any) => o.src).filter(Boolean))] as string[];
        const imgMap = new Map<string, HTMLImageElement | null>();
        await Promise.all(srcList.map(async (src: string) => {
          imgMap.set(src, await loadImg(src));
        }));

        // Sort and draw all objects
        const sorted = [...currentObjects].sort((a: any, b: any) => {
          const az = a.zIndex ?? (a.isTemplate ? -1 : 0);
          const bz = b.zIndex ?? (b.isTemplate ? -1 : 0);
          return az - bz;
        });

        for (const obj of sorted) {
          if (!obj || (obj as any).hidden || (obj as any).hidden2D) continue;
          ctx.save();
          const x = obj.x ?? 0;
          const y = obj.y ?? 0;
          const w = obj.width ?? 50;
          const h = obj.height ?? 50;
          const rot = ((obj.rotation ?? 0) * Math.PI) / 180;
          const ox = (obj as any).offsetX ?? 0;
          const oy = (obj as any).offsetY ?? 0;

          if (rot !== 0 || ox !== 0 || oy !== 0) {
            ctx.translate(x + ox, y + oy);
            ctx.rotate(rot);
            ctx.scale(obj.scaleX ?? 1, obj.scaleY ?? 1);
            ctx.translate(-ox, -oy);
          } else {
            ctx.translate(x, y);
            ctx.scale(obj.scaleX ?? 1, obj.scaleY ?? 1);
          }

          if (obj.src) {
            const img = imgMap.get(obj.src);
            if (img) ctx.drawImage(img, 0, 0, w, h);
          } else if (obj.type === 'rect') {
            if (obj.fill && obj.fill !== 'transparent') { ctx.fillStyle = obj.fill; ctx.fillRect(0, 0, w, h); }
            ctx.strokeStyle = obj.stroke || '#000'; ctx.lineWidth = obj.strokeWidth || 1; ctx.strokeRect(0, 0, w, h);
          } else if (obj.type === 'line') {
            ctx.strokeStyle = obj.fill || '#000';
            ctx.lineWidth = obj.strokeWidth || Math.min(w, h) || 1;
            if (obj.dash) ctx.setLineDash(obj.dash);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w > h ? w : 0, w > h ? 0 : h); ctx.stroke();
          } else if (obj.type === 'text' || (obj.type as any) === 'template-text') {
            ctx.font = `${obj.fontStyle || 'normal'} ${obj.fontSize || 12}px ${obj.fontFamily || 'Arial'}`;
            ctx.fillStyle = obj.fill || '#000';
            ctx.textAlign = (obj.align as CanvasTextAlign) || 'left';
            const lines = (obj.text || '').split('\n');
            const textX = obj.align === 'right' ? w : (obj.align === 'center' ? w / 2 : 0);
            lines.forEach((line: string, idx: number) => {
              ctx.fillText(line, textX, (obj.fontSize || 12) * (idx + 1));
            });
          } else if (obj.symbolId === 'ev-circle') {
            ctx.beginPath(); ctx.arc(w/2, h/2, Math.min(w,h)/2, 0, Math.PI*2);
            ctx.fillStyle = '#F5C518'; ctx.fill();
            ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
            if (obj.findingNo) { ctx.font = `bold ${w*0.4}px Arial`; ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(obj.findingNo), w/2, h/2); }
          } else if (obj.symbolId === 'ev-square') {
            ctx.fillStyle = '#F5C518'; ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, w, h);
            if (obj.findingNo) { ctx.font = `bold ${w*0.4}px Arial`; ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(obj.findingNo), w/2, h/2); }
          }
          ctx.restore();
        }

        const dataURL = offCanvas.toDataURL('image/png');
        window.dispatchEvent(new CustomEvent('preview-ready', { detail: dataURL }));
      } catch (err) {
        console.error('Preview generation failed, falling back to stage capture:', err);
        // Fallback: use stage directly
        await new Promise(resolve => setTimeout(resolve, 150));
        const dataURL = stageRef.current?.toDataURL({ pixelRatio: 2 });
        if (dataURL) window.dispatchEvent(new CustomEvent('preview-ready', { detail: dataURL }));
      } finally {
        setGridVisible(true);
      }
    };

    const handleClosePreview = () => {
      setScale(previousScale);
    };

    window.addEventListener('generate-preview', handleGeneratePreview);
    window.addEventListener('close-preview', handleClosePreview);

    return () => {
      useStore.setState({ exportPDFRef: null, fallAnimationExportRef: null });
      window.removeEventListener('export-pdf', handleExportPDF);
      window.removeEventListener('generate-preview', handleGeneratePreview);
      window.removeEventListener('close-preview', handleClosePreview);
    };
  }, [canvasOrientation, setSelectedId, addNotification, scale, previousScale, objects, backgroundImage, projectInfo, drawingArea]);



  const stagePosRef = useRef(stagePos);
  stagePosRef.current = stagePos;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const savedPosRef = useRef({ x: 0, y: 0 });
  const savedScaleRef = useRef(1);

  useEffect(() => {
    const handleBeforePrint = () => {
      setGridVisible(false);
      setSelectedId(null);
      savedPosRef.current = stagePosRef.current;
      savedScaleRef.current = scaleRef.current;
      setStagePos({ x: 0, y: 0 });
      setScale(1);
    };

    const handleAfterPrint = () => {
      setGridVisible(true);
      setStagePos(savedPosRef.current);
      setScale(savedScaleRef.current);
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [setGridVisible, setSelectedId]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      // Force stop any active Konva drag operation
      if (Konva.DD.isDragging) {
        (Konva.DD as any).stopDrag();
      }
      if (stageRef.current) {
        stageRef.current.getLayer()?.batchDraw();
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    if (stageRef.current) {
      stageRef.current.setPointersPositions(e);
    }
    const symbolData = e.dataTransfer.getData('symbol');
    if (symbolData && stageRef.current) {
      const symbol = JSON.parse(symbolData);
      
      // Compute exact canvas coordinate using inverse transform (accounts for pan & zoom)
      const pointer = stageRef.current.getPointerPosition();
      if (!pointer) return;
      const transform = stageRef.current.getAbsoluteTransform().copy().invert();
      const pos = transform.point(pointer);

      const isDistanceObject = symbol.isDistanceArrow || 
                               symbol.name?.toLowerCase().includes('mesafe') ||
                               symbol.id?.toLowerCase().includes('distance');

      const isArchitecture = symbol.categoryId === 'architecture' || symbol.id?.startsWith('arch-');

      const isTriangulationPoint = (symbol as any).isTriangulation || symbol.id === 'out-fixed-point' || symbol.id === 'out-pole' || symbol.id === 'out-hydrant';
      const isFindingMarker = symbol.id === 'ev-circle' || symbol.id === 'ev-square';

      if (isFindingMarker || isTriangulationPoint) {
        setFindingModalState({
          isOpen: true,
          symbol,
          pos
        });
      } else if (isDistanceObject) {
        setPromptState({
          isOpen: true,
          title: 'Mesafe Girin',
          label: 'Ölçülen mesafeyi yazın (örn: 5.40 m):',
          value: '',
          onConfirm: (input) => {
            if (input) {
              const w = symbol.width || 100;
              const h = symbol.height || 100;
              addObject({
                ...symbol,
                symbolId: symbol.id,
                categoryId: symbol.categoryId,
                id: uuidv4(),
                x: pos.x - w / 2,
                y: pos.y - h / 2,
                distance: input,
                distanceColor: '#000000',
                width: w,
                height: h,
                rotation: 0,
                scaleX: 1,
                scaleY: 1
              });
              addNotification({
                type: 'success',
                message: 'Ölçü Eklendi',
                description: `"${input}" etiketiyle mesafe oku yerleştirildi.`
              });
            }
            setPromptState(prev => ({ ...prev, isOpen: false }));
          }
        });
      } else if (isArchitecture || symbol.categoryId === 'shapes' || symbol.categoryId === 'outdoor' || symbol.categoryId === 'arrows' || symbol.id?.startsWith('ev-rect-') || symbol.id?.startsWith('ev-square-')) {
        const w = symbol.width || 100;
        const h = symbol.height || 100;
        let finalX = pos.x - w / 2;
        let finalY = pos.y - h / 2;

        if (drawingArea) {
          finalX = Math.max(drawingArea.x, Math.min(finalX, drawingArea.x + drawingArea.width - w));
          finalY = Math.max(drawingArea.y, Math.min(finalY, drawingArea.y + drawingArea.height - h));
        }

        addObject({
          ...symbol,
          symbolId: symbol.id,
          categoryId: symbol.categoryId || 'architecture',
          id: uuidv4(),
          fill: '#000000',
          x: finalX,
          y: finalY,
          width: w,
          height: h,
          rotation: 0,
          scaleX: 1,
          scaleY: 1
        });
        addNotification({
          type: 'info',
          message: 'Sembol Eklendi',
          description: `"${symbol.name || 'Sembol'}" tuvale eklendi.`
        });
      } else if (symbol.id === 'ev-human-poseable') {
        const w = symbol.width || 100;
        const h = symbol.height || 200;
        addObject({
          ...symbol,
          symbolId: symbol.id,
          categoryId: symbol.categoryId,
          id: uuidv4(),
          x: pos.x - w / 2,
          y: pos.y - h / 2,
          width: w,
          height: h,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          joints: [
            { id: 'head', x: w/2, y: h*0.1 },
            { id: 'neck', x: w/2, y: h*0.2 },
            { id: 'l_shoulder', x: w*0.3, y: h*0.25 },
            { id: 'r_shoulder', x: w*0.7, y: h*0.25 },
            { id: 'l_elbow', x: w*0.2, y: h*0.45 },
            { id: 'r_elbow', x: w*0.8, y: h*0.45 },
            { id: 'l_wrist', x: w*0.15, y: h*0.65 },
            { id: 'r_wrist', x: w*0.85, y: h*0.65 },
            { id: 'pelvis', x: w/2, y: h*0.55 },
            { id: 'l_knee', x: w*0.35, y: h*0.75 },
            { id: 'r_knee', x: w*0.65, y: h*0.75 },
            { id: 'l_ankle', x: w*0.35, y: h*0.95 },
            { id: 'r_ankle', x: w*0.65, y: h*0.95 }
          ]
        });
        addNotification({
          type: 'success',
          message: 'Ceset Eklendi',
          description: 'Şekillendirilebilir ceset figürü başarıyla eklendi.'
        });
      } else if (symbol.id === 'ev-callout') {
        setPromptState({
          isOpen: true,
          multiline: true,
          title: 'Balon Açıklaması Girin',
          label: 'Balon İçinde Yazacak Metin:',
          value: '',
          onConfirm: (input) => {
            if (input) {
              const size = calculateCalloutSize(input, 14);
              addObject({
                ...symbol,
                symbolId: symbol.id,
                categoryId: symbol.categoryId,
                id: uuidv4(),
                x: pos.x - (size.w / 2),
                y: pos.y - (size.h / 2),
                distance: input,
                width: size.w,
                height: size.h,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                fill: 'transparent',
                distanceColor: '#000000',
              });
              addNotification({
                type: 'success',
                message: 'Balon Eklendi',
                description: `Açıklama balonu başarıyla eklendi.`
              });
            }
            setPromptState(prev => ({ ...prev, isOpen: false }));
          }
        });
      } else if (symbol.id === 'ev-arrow-text') {
        setPromptState({
          isOpen: true,
          title: 'Ok Ucuna Açıklama Girin',
          label: 'Açıklama (örn. Plaka No):',
          value: '',
          onConfirm: (input) => {
            if (input) {
              addObject({
                ...symbol,
                id: uuidv4(),
                symbolId: symbol.id,
                categoryId: symbol.categoryId,
                x: pos.x - 75,
                y: pos.y - 15,
                distance: input,
                width: 150,
                height: 30,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                fill: '#000000',
                distanceColor: '#000000',
                distanceFontSize: 12,
              });
              addNotification({
                type: 'success',
                message: 'Ok İşaretli Metin Eklendi'
              });
            }
            setPromptState(prev => ({ ...prev, isOpen: false }));
          }
        });
      } else if (symbol.id === 'ev-arrow-desc' || symbol.id === 'ev-arrow-desc-ellipse') {
        setPromptState({
          isOpen: true,
          multiline: true,
          title: 'Delil Açıklaması Girin',
          label: 'Delil/Bulgu Açıklaması (Örn: Boş Kovan, Kan Lekesi):',
          value: '',
          onConfirm: (input) => {
            if (input) {
              let finalX = pos.x - 100;
              let finalY = pos.y - 20;
              if (drawingArea) {
                finalX = Math.max(drawingArea.x, Math.min(finalX, drawingArea.x + drawingArea.width - 200));
                finalY = Math.max(drawingArea.y, Math.min(finalY, drawingArea.y + drawingArea.height - 40));
              }
              addObject({
                ...symbol,
                id: uuidv4(),
                symbolId: symbol.id,
                categoryId: symbol.categoryId,
                x: finalX,
                y: finalY,
                markerX: 0,
                markerY: 0,
                textX: 120,
                textY: 0,
                distance: input,
                width: 200,
                height: 40,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                distanceColor: '#000000',
                distanceFontSize: 12,
              });
              addNotification({
                type: 'success',
                message: 'Ok İşaretli Delil Eklendi'
              });
            }
            setPromptState(prev => ({ ...prev, isOpen: false }));
          }
        });
      } else if (symbol.id === 'st-1') {
          let finalX = pos.x - 200;
          let finalY = pos.y - 40;
          if (drawingArea) {
            finalX = Math.max(drawingArea.x, Math.min(finalX, drawingArea.x + drawingArea.width - 400));
            finalY = Math.max(drawingArea.y, Math.min(finalY, drawingArea.y + drawingArea.height - 80));
          }
          addObject({
            ...symbol,
            id: uuidv4(),
            symbolId: 'st-1',
            categoryId: 'streets',
            x: finalX,
            y: finalY,
            width: 400,
            height: 80,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            curvature: 0,
            ratioFixed: false,
            zIndex: objects.length,
        });
        addNotification({
          type: 'info',
          message: 'Yol Eklendi',
          description: 'Esnek yol tuvale eklendi.'
        });
      } else if (symbol.id === 'ev-rope') {
        addObject({
          ...symbol,
          id: uuidv4(),
          symbolId: 'ev-rope',
          categoryId: 'shapes',
          x: pos.x - 100,
          y: pos.y - 20,
          width: 200,
          height: 40,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          curvature: 0,
          zIndex: objects.length,
        });
        addNotification({
          type: 'info',
          message: 'İp Eklendi',
          description: 'Şekillendirilebilir ip tuvale eklendi.'
        });
      } else if (symbol.id === 'ev-noose') {
        addObject({
          ...symbol,
          id: uuidv4(),
          symbolId: 'ev-noose',
          categoryId: 'shapes',
          x: pos.x - 40,
          y: pos.y - 60,
          width: 80,
          height: 120,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          zIndex: objects.length,
        });
        addNotification({
          type: 'info',
          message: 'Ası İpi Eklendi',
          description: 'Kement yapılmış ası ipi tuvale eklendi.'
        });
      } else {
        const doorIds = ['arch-d1r', 'arch-d1l', 'arch-d2'];
        const isDoor = doorIds.includes(symbol.id);
        const isWindow = symbol.id === 'arch-win';
        const isWall = ['arch-w1', 'arch-w1v', 'arch-w1i', 'arch-w1vi'].includes(symbol.id);
        
        let finalWidth = symbol.id === 'arch-d2' ? 120 : (isDoor ? 60 : (symbol.width || 100));
        let finalHeight = isDoor ? 60 : (symbol.height || 100);

        if (isWindow) {
          finalWidth = 50;
          finalHeight = 10; 
        } else if (isWall) {
          if (symbol.id === 'arch-w1') { finalWidth = 200; finalHeight = 10; }
          else if (symbol.id === 'arch-w1v') { finalWidth = 10; finalHeight = 200; }
          else if (symbol.id === 'arch-w1i') { finalWidth = 200; finalHeight = 8; }
          else if (symbol.id === 'arch-w1vi') { finalWidth = 8; finalHeight = 200; }
        }

        let finalX = pos.x - finalWidth / 2;
        let finalY = pos.y - finalHeight / 2;

        if (drawingArea) {
          finalX = Math.max(drawingArea.x, Math.min(finalX, drawingArea.x + drawingArea.width - finalWidth));
          finalY = Math.max(drawingArea.y, Math.min(finalY, drawingArea.y + drawingArea.height - finalHeight));
        }

        const newObjId = uuidv4();
        addObject({
          ...symbol,
          symbolId: symbol.id,
          id: newObjId,
          x: finalX,
          y: finalY,
          width: finalWidth,
          height: finalHeight,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          distanceColor: '#000000',
          zIndex: objects.length,
        });
        addNotification({
          type: 'info',
          message: isDoor ? 'Kapı Eklendi' : isWindow ? 'Pencere Eklendi' : isWall ? 'Duvar Eklendi' : 'Sembol Eklendi',
          description: `"${symbol.name || 'Sembol'}" tuvale eklendi.`
        });

        if (symbol.id === 'ev-shooting-trajectory') {
          checkShootingTrajectoryIntersections(newObjId);
        }
      }
      saveHistory();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Input/Textarea içindeysen engelle
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (!selectedId) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      removeObject(selectedId);
      saveHistory();
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const obj = objects.find(o => o.id === selectedId);
      if (obj) {
        let newX = obj.x;
        let newY = obj.y;
        if (e.key === 'ArrowUp') newY -= step;
        if (e.key === 'ArrowDown') newY += step;
        if (e.key === 'ArrowLeft') newX -= step;
        if (e.key === 'ArrowRight') newX += step;
        
        updateObject(selectedId, { x: newX, y: newY });
        saveHistory();
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, objects, updateObject, saveHistory]);



  const renderGrid = () => {
    if (!gridVisible || projectInfo.type === 'diagram') return null;
    const lines = [];
    
    // Use drawingArea if available, otherwise fallback to full canvas
    const gridBounds = drawingArea || {
      x: 0,
      y: 0,
      width: canvasOrientation === 'landscape' ? 1200 : 800,
      height: canvasOrientation === 'landscape' ? 800 : 1200
    };

    const startX = Math.floor(gridBounds.x / 20) * 20;
    const endX = gridBounds.x + gridBounds.width;
    const startY = Math.floor(gridBounds.y / 20) * 20;
    const endY = gridBounds.y + gridBounds.height;
    
    // Vertical lines
    for (let x = startX; x <= endX; x += 20) {
      if (x < gridBounds.x) continue;
      lines.push(
        <Rect
          key={`v-${x}`}
          x={x}
          y={gridBounds.y}
          width={0.5}
          height={gridBounds.height}
          fill="#333333"
          listening={false}
          opacity={0.35}
        />
      );
    }
    // Horizontal lines
    for (let y = startY; y <= endY; y += 20) {
      if (y < gridBounds.y) continue;
      lines.push(
        <Rect
          key={`h-${y}`}
          x={gridBounds.x}
          y={y}
          width={gridBounds.width}
          height={0.5}
          fill="#333333"
          listening={false}
          opacity={0.35}
        />
      );
    }
    return lines;
  };

  const [guidelines, setGuidelines] = useState<{ x?: number, y?: number, type: 'h' | 'v' }[]>([]);

  const handleDragMove = (e: any) => {
    const stage = e.target.getStage();
    const layer = e.target.getLayer();
    const item = e.target;
    const GUIDELINE_OFFSET = 5;

    const otherNodes = layer.getChildren().filter((node: any) => 
      node.className === 'Group' && node !== item && node.id() !== 'drawing-area' && node.name() !== 'background-rect'
    );

    const stops = {
      vertical: [0, stage.width() / 2, stage.width()],
      horizontal: [0, stage.height() / 2, stage.height()],
    };

    otherNodes.forEach((node: any) => {
      const box = node.getClientRect();
      stops.vertical.push(box.x, box.x + box.width / 2, box.x + box.width);
      stops.horizontal.push(box.y, box.y + box.height / 2, box.y + box.height);
    });

    const itemBox = item.getClientRect();
    const itemStops = {
      vertical: [itemBox.x, itemBox.x + itemBox.width / 2, itemBox.x + itemBox.width],
      horizontal: [itemBox.y, itemBox.y + itemBox.height / 2, itemBox.y + itemBox.height],
    };

    const newGuides: any[] = [];
    let snappedX = item.x();
    let snappedY = item.y();

    itemStops.vertical.forEach((is) => {
      stops.vertical.forEach((s) => {
        if (Math.abs(is - s) < GUIDELINE_OFFSET) {
          const diff = is - s;
          snappedX -= diff;
          newGuides.push({ x: s, type: 'v' });
        }
      });
    });

    itemStops.horizontal.forEach((is) => {
      stops.horizontal.forEach((s) => {
        if (Math.abs(is - s) < GUIDELINE_OFFSET) {
          const diff = is - s;
          snappedY -= diff;
          newGuides.push({ y: s, type: 'h' });
        }
      });
    });

    if (newGuides.length > 0) {
      item.position({ x: snappedX, y: snappedY });
    }
    setGuidelines(newGuides);
  };

  const handleDragEnd = () => {
    setGuidelines([]);
  };

  const checkShootingTrajectoryIntersections = (trajId: string) => {
    // Use live store state so the function works even when called right after addObject
    const traj = useStore.getState().objects.find(o => o.id === trajId);
    if (!traj) return;

    // 1. Remove previous auto-created symbols for this trajectory
    const oldWoundIds = objects
      .filter((o: any) => o.parentId === trajId)
      .map(o => o.id);
    if (oldWoundIds.length > 0) {
      removeObjects(oldWoundIds);
    }

    const mannequins = objects.filter(o => o.id !== trajId && (o.symbolId?.startsWith('p-') || o.symbolId === 'ev-human-poseable'));
    const windows = objects.filter(o => o.id !== trajId && o.symbolId === 'arch-win');
    const walls = objects.filter(o => o.id !== trajId && (o.symbolId?.startsWith('arch-w1') || o.symbolId === 'arch-7' || o.symbolId === 'arch-w-square'));

    if (mannequins.length === 0 && windows.length === 0 && walls.length === 0) return;

    const r = (traj.rotation || 0) * Math.PI / 180;
    const sX = traj.startX !== undefined ? traj.startX : 0;
    const sY = traj.startY !== undefined ? traj.startY : 150;
    const eX = traj.endX !== undefined ? traj.endX : 150;
    const eY = traj.endY !== undefined ? traj.endY : 0;

    const tsx = traj.x + (sX * Math.cos(r) - sY * Math.sin(r));
    const tsy = traj.y + (sX * Math.sin(r) + sY * Math.cos(r));
    const tex = traj.x + (eX * Math.cos(r) - eY * Math.sin(r));
    const tey = traj.y + (eX * Math.sin(r) + eY * Math.cos(r));

    const trajDx = tex - tsx;
    const trajDy = tey - tsy;
    const trajLen = Math.sqrt(trajDx*trajDx + trajDy*trajDy);
    if (trajLen === 0) return;

    let newObjects: any[] = [];
    const addedPoints = new Set<string>();

    const allSyms = useStore.getState().allSymbols;
    const allFlatSymbols = allSyms ? allSyms.flatMap(c => c.symbols) : [];
    const wallDef = allFlatSymbols.find(s => s?.id === 'tr-bullet-wall');
    const glassDef = allFlatSymbols.find(s => s?.id === 'tr-bullet-glass');
    const woundInDef = allFlatSymbols.find(s => s?.id === 'in-bullet-in');
    const woundOutDef = allFlatSymbols.find(s => s?.id === 'in-bullet-out');

    const zH = traj.zHeight || 120;
    const tilt = traj.tilt || 0;
    const dz = trajLen > 0 ? (trajLen * Math.tan(tilt * Math.PI / 180)) : 0;

    // A. Mannequins (Entrance / Exit wounds)
    mannequins.forEach(mObj => {
      const w = mObj.width * (mObj.scaleX || 1);
      const h = mObj.height * (mObj.scaleY || 1);
      const rotRad = (mObj.rotation || 0) * Math.PI / 180;
      const cosR = Math.cos(-rotRad);
      const sinR = Math.sin(-rotRad);

      const toLocal = (px: number, py: number) => {
        const dx = px - mObj.x;
        const dy = py - mObj.y;
        return {
          x: dx * cosR - dy * sinR,
          y: dx * sinR + dy * cosR
        };
      };

      const lStart = toLocal(tsx, tsy);
      const lEnd = toLocal(tex, tey);

      const lx0 = lStart.x;
      const ly0 = lStart.y;
      const ldx = lEnd.x - lStart.x;
      const ldy = lEnd.y - lStart.y;

      const p = [-ldx, ldx, -ldy, ldy];
      const q = [lx0, w - lx0, ly0, h - ly0];

      let tNear = -Infinity;
      let tFar = Infinity;

      for (let i = 0; i < 4; i++) {
        if (p[i] === 0) {
          if (q[i] < 0) return;
        } else {
          let t = q[i] / p[i];
          if (p[i] < 0) {
            if (t > tNear) tNear = t;
          } else {
            if (t < tFar) tFar = t;
          }
        }
      }

      if (tNear > tFar || tFar < 0 || tNear > 1) return;

      if (tNear >= 0 && tNear <= 1) {
        const pHitX = tsx + tNear * trajDx;
        const pHitY = tsy + tNear * trajDy;
        const key = `mank-in-${Math.round(pHitX)}-${Math.round(pHitY)}`;
        if (!addedPoints.has(key)) {
          addedPoints.add(key);
          newObjects.push({
            ...(woundInDef || {}),
            type: 'symbol',
            symbolId: 'in-bullet-in',
            categoryId: 'injuries',
            src: woundInDef?.src || '',
            id: uuidv4(),
            parentId: trajId,
            x: pHitX - 10,
            y: pHitY - 10,
            width: 20,
            height: 20,
            rotation: mObj.rotation || 0,
            scaleX: 1, scaleY: 1,
            zHeight: Math.max(0, zH + tNear * dz),
            isVertical: true,
            hidden2D: true,
            zIndex: objects.length + newObjects.length + 1
          });
        }
      }

      if (tFar >= 0 && tFar <= 1 && Math.abs(tFar - tNear) > 0.01) {
        const pHitX = tsx + tFar * trajDx;
        const pHitY = tsy + tFar * trajDy;
        const key = `mank-out-${Math.round(pHitX)}-${Math.round(pHitY)}`;
        if (!addedPoints.has(key)) {
          addedPoints.add(key);
          newObjects.push({
            ...(woundOutDef || {}),
            type: 'symbol',
            symbolId: 'in-bullet-out',
            categoryId: 'injuries',
            src: woundOutDef?.src || '',
            id: uuidv4(),
            parentId: trajId,
            x: pHitX - 10,
            y: pHitY - 10,
            width: 20,
            height: 20,
            rotation: mObj.rotation || 0,
            scaleX: 1, scaleY: 1,
            zHeight: Math.max(0, zH + tFar * dz),
            isVertical: true,
            hidden2D: true,
            zIndex: objects.length + newObjects.length + 1
          });
        }
      }
    });

    // B. Windows (Glass impact)
    windows.forEach(winObj => {
      const w = winObj.width * (winObj.scaleX || 1);
      const h = winObj.height * (winObj.scaleY || 1);
      const rotRad = (winObj.rotation || 0) * Math.PI / 180;
      const cosR = Math.cos(-rotRad);
      const sinR = Math.sin(-rotRad);

      const toLocal = (px: number, py: number) => {
        const dx = px - winObj.x;
        const dy = py - winObj.y;
        return {
          x: dx * cosR - dy * sinR,
          y: dx * sinR + dy * cosR
        };
      };

      const lStart = toLocal(tsx, tsy);
      const lEnd = toLocal(tex, tey);

      const lx0 = lStart.x;
      const ly0 = lStart.y;
      const ldx = lEnd.x - lStart.x;
      const ldy = lEnd.y - lStart.y;

      const p = [-ldx, ldx, -ldy, ldy];
      const q = [lx0, w - lx0, ly0, h - ly0];

      let tNear = -Infinity;
      let tFar = Infinity;

      for (let i = 0; i < 4; i++) {
        if (p[i] === 0) {
          if (q[i] < 0) return;
        } else {
          let t = q[i] / p[i];
          if (p[i] < 0) {
            if (t > tNear) tNear = t;
          } else {
            if (t < tFar) tFar = t;
          }
        }
      }

      if (tNear > tFar || tFar < 0 || tNear > 1) return;

      if (tNear >= 0 && tNear <= 1) {
        const pHitX = tsx + tNear * trajDx;
        const pHitY = tsy + tNear * trajDy;
        const key = `win-${Math.round(pHitX)}-${Math.round(pHitY)}`;
        if (!addedPoints.has(key)) {
          addedPoints.add(key);
          newObjects.push({
            ...(glassDef || {}),
            type: 'symbol',
            symbolId: 'tr-bullet-glass',
            categoryId: 'traces',
            src: glassDef?.src || '/assets/symbols/bullet_hole_1.png',
            id: uuidv4(),
            parentId: trajId,
            x: pHitX - 12.5,
            y: pHitY - 12.5,
            width: 25,
            height: 25,
            rotation: winObj.rotation || 0,
            scaleX: 1, scaleY: 1,
            zHeight: Math.max(0, zH + tNear * dz),
            isVertical: true,
            hidden2D: true,
            zIndex: objects.length + newObjects.length + 1
          });
        }
      }
    });

    // C. Walls
    walls.forEach(wObj => {
      const w = wObj.width * (wObj.scaleX || 1);
      const h = wObj.height * (wObj.scaleY || 1);
      const rotRad = (wObj.rotation || 0) * Math.PI / 180;
      const cosR = Math.cos(-rotRad);
      const sinR = Math.sin(-rotRad);

      const toLocal = (px: number, py: number) => {
        const dx = px - wObj.x;
        const dy = py - wObj.y;
        return {
          x: dx * cosR - dy * sinR,
          y: dx * sinR + dy * cosR
        };
      };

      const lStart = toLocal(tsx, tsy);
      const lEnd = toLocal(tex, tey);

      const lx0 = lStart.x;
      const ly0 = lStart.y;
      const ldx = lEnd.x - lStart.x;
      const ldy = lEnd.y - lStart.y;

      const p = [-ldx, ldx, -ldy, ldy];
      const q = [lx0, w - lx0, ly0, h - ly0];

      let tNear = -Infinity;
      let tFar = Infinity;

      for (let i = 0; i < 4; i++) {
        if (p[i] === 0) {
          if (q[i] < 0) return;
        } else {
          let t = q[i] / p[i];
          if (p[i] < 0) {
            if (t > tNear) tNear = t;
          } else {
            if (t < tFar) tFar = t;
          }
        }
      }

      if (tNear > tFar || tFar < 0 || tNear > 1) return;

      if (tNear >= 0 && tNear <= 1) {
        const pHitX = tsx + tNear * trajDx;
        const pHitY = tsy + tNear * trajDy;
        const key = `wall-in-${Math.round(pHitX)}-${Math.round(pHitY)}`;
        if (!addedPoints.has(key)) {
          addedPoints.add(key);
          newObjects.push({
            ...(wallDef || {}),
            type: 'symbol',
            symbolId: 'tr-bullet-wall',
            categoryId: 'traces',
            src: wallDef?.src || '/assets/symbols/bullet_hole_2.png',
            id: uuidv4(),
            parentId: trajId,
            x: pHitX - 12.5,
            y: pHitY - 12.5,
            width: 25,
            height: 25,
            rotation: wObj.rotation || 0,
            scaleX: 1, scaleY: 1,
            zHeight: Math.max(0, zH + tNear * dz),
            isVertical: true,
            hidden2D: true,
            zIndex: objects.length + newObjects.length + 1
          });
        }
      }

      if (tFar >= 0 && tFar <= 1 && Math.abs(tFar - tNear) > 0.01) {
        const pHitX = tsx + tFar * trajDx;
        const pHitY = tsy + tFar * trajDy;
        const key = `wall-out-${Math.round(pHitX)}-${Math.round(pHitY)}`;
        if (!addedPoints.has(key)) {
          addedPoints.add(key);
          newObjects.push({
            ...(wallDef || {}),
            type: 'symbol',
            symbolId: 'tr-bullet-wall',
            categoryId: 'traces',
            src: wallDef?.src || '/assets/symbols/bullet_hole_2.png',
            id: uuidv4(),
            parentId: trajId,
            x: pHitX - 12.5,
            y: pHitY - 12.5,
            width: 25,
            height: 25,
            rotation: wObj.rotation || 0,
            scaleX: 1, scaleY: 1,
            zHeight: Math.max(0, zH + tFar * dz),
            isVertical: true,
            hidden2D: true,
            zIndex: objects.length + newObjects.length + 1
          });
        }
      }
    });

    if (newObjects.length > 0) {
      newObjects.forEach(obj => addObject(obj));
      
      addNotification({
        type: 'success',
        message: 'İsabet İzleri Eklendi',
        description: 'Atış yönü çizgisine göre duvar, cam ve manken üzerinde otomatik isabet izleri/yaraları oluşturuldu.'
      });
    }
  };


  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleCameraPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;

    try {
      const compressedSrc = await compressAndResizeImage(file, 600, 600, 0.45);
      updateObject(selectedId, { photo: compressedSrc });
      saveHistory();
      addNotification({
        type: 'success',
        message: 'Fotoğraf Eklendi',
        description: 'Fotoğraf sıkıştırılarak noktaya başarıyla bağlandı.'
      });
    } catch (err) {
      console.error('Camera photo optimization error:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#111111] relative canvas-area-container">
      <div
        ref={containerRef}
        className="flex-1 overflow-auto custom-scrollbar relative p-0"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="min-w-full min-h-full flex items-center justify-center p-1">
          <Stage
            ref={stageRef}
            width={canvasOrientation === 'landscape' ? 1400 : 1000}
            height={canvasOrientation === 'landscape' ? 1000 : 1400}
            scaleX={scale}
            scaleY={scale}
            x={stagePos.x}
            y={stagePos.y}
            onWheel={handleWheel}
            draggable={false}
            onDragEnd={(e) => {
              if (e.target === stageRef.current) {
                setStagePos({ x: e.target.x(), y: e.target.y() });
              }
            }}
            dragDistance={3}
            className="bg-white shadow-2xl transition-all duration-300"
            onMouseDown={(e) => {
              // deselect when clicked on empty area
              const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'background-rect';
              if (clickedOnEmpty) {
                setSelectedId(null);
              }
            }}
            onMouseUp={() => {
              if (Konva.DD.isDragging) {
                (Konva.DD as any).stopDrag();
              }
            }}
          >
            <Layer>
          {/* Snap Guidelines */}
          {projectInfo.type !== 'diagram' && guidelines.map((g, i) => (
            <Line
              key={i}
              points={g.type === 'v' ? [g.x!, -5000, g.x!, 5000] : [-5000, g.y!, 5000, g.y!]}
              stroke="#3b82f6"
              strokeWidth={1}
              dash={[4, 4]}
              opacity={0.6}
            />
          ))}
              <Rect
                x={0}
                y={0}
                width={canvasOrientation === 'landscape' ? 1400 : 1000}
                height={canvasOrientation === 'landscape' ? 1000 : 1400}
                fill={canvasBgColor}
                name="background-rect"
              />
              {renderGrid()}
              {bgImage && (
                <Group
                  x={drawingArea?.x || 0}
                  y={drawingArea?.y || 0}
                  width={drawingArea?.width || 1000}
                  height={drawingArea?.height || 1400}
                  clipFunc={(ctx) => {
                    if (drawingArea) {
                      ctx.rect(0, 0, drawingArea.width, drawingArea.height);
                    }
                  }}
                >
                  <KonvaImage
                    image={bgImage}
                    x={0}
                    y={0}
                    width={drawingArea?.width || 1000}
                    height={drawingArea?.height || 1400}
                    name="background-image"
                    ref={bgImageRef}
                    opacity={backgroundOpacity}
                    filters={backgroundGrayscale ? [Konva.Filters.Grayscale] : []}
                    onClick={() => setSelectedId('background-image')}
                    onTap={() => setSelectedId('background-image')}
                  />
                </Group>
              )}
              
              {/* Background Transformer (if selected) */}
              {selectedId === 'background-image' && bgImageRef.current && (
                <Transformer
                  nodes={[bgImageRef.current]}
                  boundBoxFunc={(oldBox, newBox) => {
                    // Optional: limit scaling
                    if (newBox.width < 50 || newBox.height < 50) return oldBox;
                    return newBox;
                  }}
                  rotateEnabled={true}
                  anchorSize={8}
                  anchorCornerRadius={4}
                  anchorFill="#F5C518"
                  anchorStroke="white"
                  borderStroke="#F5C518"
                />
              )}
              
              {objects
                .slice()
                .filter((obj: any) => !obj.hidden2D)
                .sort((a, b) => {
                  if (a.id === hoveredId) return 1;
                  if (b.id === hoveredId) return -1;
                  return getEffectiveZIndex(a) - getEffectiveZIndex(b);
                })
                .map((obj) => {
                  // Admin için Logo Placeholder Mantığı
                  if (obj.id === 'corporate-logo' && isAdmin) {
                    return (
                      <Group 
                        key={obj.id} 
                        x={obj.x} y={obj.y} 
                        width={obj.width} height={obj.height}
                        rotation={obj.rotation}
                        onClick={() => {
                          setSelectedId(obj.id);
                          logoInputRef.current?.click();
                        }}
                        onDblClick={() => logoInputRef.current?.click()}
                      >
                        {/* Daima görünür olan admin çerçevesi - Sadece logo yoksa veya seçiliyken görünür */}
                        <Rect 
                          width={obj.width} height={obj.height}
                          fill={obj.src ? "transparent" : "#1a1a1a"}
                          stroke={selectedId === obj.id ? "#F5C518" : (obj.src ? "transparent" : "#444")}
                          strokeWidth={obj.src ? 1 : 2}
                          dash={obj.src ? [2, 2] : [5, 5]}
                          cornerRadius={4}
                          opacity={obj.src && selectedId !== obj.id ? 0 : 1}
                        />
                        
                        {!obj.src && (
                          <Text 
                            text="KURUMSAL\nLOGO YÜKLE"
                            width={obj.width}
                            height={obj.height}
                            align="center"
                            verticalAlign="middle"
                            fontSize={10}
                            fontStyle="bold"
                            fill="#F5C518"
                          />
                        )}

                        {obj.src && (
                          <IndividualObject
                            shapeProps={obj}
                            isSelected={obj.id === selectedId}
                            onSelect={() => setSelectedId(obj.id)}
                            drawingArea={drawingArea}
                            isAdmin={isAdmin}
                            allObjects={objects}
                            onChange={(newAttrs: any) => {
                              updateObject(obj.id, newAttrs);
                              saveHistory();
                            }}
                          />
                        )}
                        
                        {/* Üstüne gelince çıkan admin etiketi */}
                        {selectedId === obj.id && (
                          <Text
                            text="Logo Alanı"
                            y={-15}
                            fontSize={10}
                            fill="#F5C518"
                            fontStyle="bold"
                          />
                        )}
                      </Group>
                    );
                  }

                  // Admin değilse ve logo yoksa hiçbir şey çizme
                  if (obj.id === 'corporate-logo' && !obj.src && !isAdmin) return null;

                  return (
                    <IndividualObject
                      key={obj.id}
                      shapeProps={obj}
                      isSelected={obj.id === selectedId}
                      onSelect={() => setSelectedId(obj.id)}
                      drawingArea={drawingArea}
                      isAdmin={isAdmin}
                      allObjects={objects}
                      onDragMove={(e: any) => {
                        setHoveredId(null);
                        handleDragMove(e);
                      }}
                      onDragEnd={() => {
                        handleDragEnd();
                        if (obj.symbolId === 'ev-shooting-trajectory') {
                          checkShootingTrajectoryIntersections(obj.id);
                        }
                      }}
                      onTrajectoryUpdate={(id: string) => checkShootingTrajectoryIntersections(id)}
                      onMouseEnter={(e: any) => {
                        if ((obj.photos?.length || 0) > 0 || ['ev-camera-link', 'ev-bpa-drop'].includes(obj.symbolId || '')) {
                          setHoveredId(obj.id);
                          // Calculate position for HTML overlay
                          const stage = e.target.getStage();
                          const pos = e.target.getAbsolutePosition();
                          // No need to apply transform as absolute position is already in stage coordinates
                          // but we need to account for stage's own position/scale on page
                          const rect = stage.container().getBoundingClientRect();
                          setHoveredPos({
                            x: rect.left + pos.x + (obj.width * scale) / 2,
                            y: rect.top + pos.y
                          });
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredId(null);
                        setHoveredPos(null);
                      }}
                      onOpenDistanceModal={(id: string, initial: string) => {
                        setDistanceModalTarget(id);
                        setInitialDistance(initial);
                        setIsDistanceModalOpen(true);
                      }}
                      onChange={(newAttrs: any) => {
                        updateObject(obj.id, newAttrs);
                        saveHistory();
                      }}
                    />
                  );
                })}
            </Layer>
            {/* Accident Reconstruction Animation Layer */}
            <Layer>
              <AccidentAnimation />
            </Layer>
            {/* Fall Animation Canvas Layer */}
            <Layer>
              <FallAnimationCanvas />
            </Layer>
            {/* Pedestrian Launch Canvas Layer */}
            <Layer>
              <PedestrianLaunchCanvas />
            </Layer>
          </Stage>


        </div>

        {selectedId && (
          <div className="fixed top-20 right-8 bg-[#1e1e1e] border border-[#333] rounded-lg p-1.5 shadow-2xl flex items-center gap-1 animate-in fade-in slide-in-from-top-4 duration-200 z-50">
            {(() => {
              const selectedObj = objects.find(o => o.id === selectedId);
              if (!selectedObj) return null;

              return (
                <>
                  {/* Group 1: Text Editing (for type='text' only) */}
                  {selectedObj.type === 'text' && (
                    <div className="flex items-center gap-2 px-2 border-r border-[#333]">
                      <span className="text-[9px] font-bold text-[#F5C518] uppercase">Metin:</span>
                      {['ev-callout', 'ev-arrow-desc', 'ev-arrow-desc-ellipse'].includes(selectedObj.symbolId || '') ? (
                        <textarea
                          value={selectedObj.distance || ''}
                          onChange={(e) => updateObject(selectedId, { distance: e.target.value }, true)}
                          onBlur={() => saveHistory()}
                          onKeyDown={(e) => e.stopPropagation()}
                          rows={2}
                          className="border border-[#333] bg-[#111] rounded px-2 py-1 text-[10px] text-gray-200 focus:ring-1 focus:ring-[#F5C518]/50 outline-none w-40 resize-none leading-tight"
                        />
                      ) : (
                        <input
                          type="text"
                          autoFocus
                          value={selectedObj.text || selectedObj.distance || ''}
                          onChange={(e) => updateObject(selectedId, { 
                            [selectedObj.distance !== undefined ? 'distance' : 'text']: e.target.value 
                          }, true)}
                          onBlur={() => saveHistory()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="border border-[#333] bg-[#111] rounded px-2 py-1 text-xs text-gray-200 focus:ring-1 focus:ring-[#F5C518]/50 outline-none w-32"
                        />
                      )}
                      <select
                        value={selectedObj.fontFamily || 'Inter'}
                        onChange={(e) => updateObject(selectedId, { fontFamily: e.target.value })}
                        className="bg-[#111] border border-[#333] text-white text-[10px] rounded px-1 py-0.5 outline-none"
                      >
                        <option value="Arial">Arial</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Tahoma">Tahoma</option>
                        <option value="Impact">Impact</option>
                      </select>
                      <span className="text-[9px] font-bold text-gray-400 uppercase">Punto:</span>
                      <input
                        type="number"
                        value={Math.round(selectedObj.fontSize || 20)}
                        onChange={(e) => updateObject(selectedId, { fontSize: parseInt(e.target.value) || 12 }, true)}
                        onBlur={() => saveHistory()}
                        className="bg-[#111] border border-[#333] text-white text-[10px] rounded px-1 py-0.5 w-10 text-center"
                      />
                      <button
                        onClick={() => updateObject(selectedId, { fontStyle: selectedObj.fontStyle === 'bold' ? 'normal' : 'bold' })}
                        className={`w-7 h-7 rounded flex items-center justify-center font-bold text-xs ${
                          selectedObj.fontStyle === 'bold' ? 'bg-[#F5C518] text-black' : 'bg-[#111] text-gray-400 border border-[#333]'
                        }`}
                      >
                        B
                      </button>
                    </div>
                  )}

                  {/* Group 2: Dimension Inputs (Architecture, Streets, Symbols, Images) */}
                  {(selectedObj.categoryId === 'architecture' || selectedObj.categoryId === 'streets' || selectedObj.type === 'image' || ['ev-ruler-straight', 'ev-ruler-l'].includes(selectedObj.symbolId || '')) && (
                    <div className="flex items-center gap-2 px-2 border-r border-[#333]">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-bold text-orange-400 uppercase">{selectedObj.symbolId === 'arch-1v' ? 'EN:' : 'BOY:'}</span>
                        <input
                          type="number"
                          value={Math.round(selectedObj.width || 100)}
                          onChange={(e) => updateObject(selectedId, { width: parseInt(e.target.value) || 1 })}
                          className="border border-[#333] bg-[#111] rounded px-1 py-0.5 text-[10px] text-gray-200 w-12 text-center"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-bold text-orange-400 uppercase">{selectedObj.symbolId === 'arch-1v' ? 'BOY:' : 'EN:'}</span>
                        <input
                          type="number"
                          value={Math.round(selectedObj.height || 10)}
                          onChange={(e) => updateObject(selectedId, { height: parseInt(e.target.value) || 1 })}
                          className="border border-[#333] bg-[#111] rounded px-1 py-0.5 text-[10px] text-gray-200 w-12 text-center"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-bold text-emerald-400 uppercase">YÜKSEKLİK:</span>
                        <input
                          type="number"
                          value={Math.round(selectedObj.zHeight || (selectedObj.symbolId === 'arch-win' ? 120 : 210))}
                          onChange={(e) => updateObject(selectedId, { zHeight: parseInt(e.target.value) || 0 })}
                          className="border border-[#333] bg-[#111] rounded px-1 py-0.5 text-[10px] text-gray-200 w-12 text-center"
                        />
                      </div>
                      {!selectedObj.symbolId?.startsWith('arch-') && !selectedObj.symbolId?.startsWith('p-') && (
                        <>
                          <div className="flex items-center gap-1 ml-2 border-l border-[#333] pl-2">
                            <input
                              type="checkbox"
                              id="isVertical"
                              checked={!!(selectedObj as any).isVertical}
                              onChange={(e) => updateObject(selectedId, { isVertical: e.target.checked } as any)}
                              className="accent-purple-500 w-3 h-3 cursor-pointer"
                            />
                            <label htmlFor="isVertical" className="text-[9px] font-bold text-purple-400 uppercase cursor-pointer">
                              DİK DUR (3D)
                            </label>
                          </div>
                          <div className="flex items-center gap-1 ml-2 border-l border-[#333] pl-2">
                            <input
                              type="checkbox"
                              id="isMannequin"
                              checked={!!(selectedObj as any).isMannequin}
                              onChange={(e) => updateObject(selectedId, { isMannequin: e.target.checked } as any)}
                              className="accent-blue-500 w-3 h-3 cursor-pointer"
                            />
                            <label htmlFor="isMannequin" className="text-[9px] font-bold text-blue-400 uppercase cursor-pointer">
                              3D CESET
                            </label>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Group 3: Label/Annotation (Available for everything that isn't raw text) */}
                  {selectedObj.type !== 'text' && selectedObj.symbolId !== 'ev-shooting-trajectory' && (
                    <div className="flex items-center gap-2 px-2 border-r border-[#333]">
                      <span className="text-[9px] font-bold text-blue-400 uppercase">Metin:</span>
                      <input
                        type="text"
                        placeholder="Açıklama..."
                        value={selectedObj.distance || ''}
                        onChange={(e) => {
                          const newText = e.target.value;
                          if (selectedObj.symbolId === 'ev-callout') {
                            const size = calculateCalloutSize(newText, selectedObj.distanceFontSize || 14);
                            updateObject(selectedId, { distance: newText, width: size.w, height: size.h }, true);
                          } else {
                            updateObject(selectedId, { distance: newText }, true);
                          }
                        }}
                        onBlur={() => saveHistory()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="border border-[#333] bg-[#111] rounded px-2 py-1 text-xs text-gray-200 w-28"
                      />
                      <span className="text-[9px] font-bold text-gray-400 uppercase">Yazı Boyu:</span>
                      <input
                        type="number"
                        value={Math.round(selectedObj.distanceFontSize || 14)}
                        onChange={(e) => updateObject(selectedId, { distanceFontSize: parseInt(e.target.value) || 12 }, true)}
                        onBlur={() => saveHistory()}
                        className="bg-[#111] border border-[#333] text-white text-[10px] rounded px-1 py-0.5 w-10 text-center"
                      />
                    </div>
                  )}

                  {/* Group 4: Visual Style (Unified Color Picker and Transformations) */}
                  <div className="flex items-center gap-2 px-2 border-r border-[#333]">
                    <span className="text-[9px] font-bold text-gray-400 uppercase">Renk:</span>
                    <input
                      type="color"
                      value={selectedObj.distanceColor || selectedObj.fill || '#000000'}
                      onInput={(e: any) => updateObject(selectedId, { distanceColor: e.target.value, fill: e.target.value }, true)}
                      onChange={() => saveHistory()}
                      className="w-7 h-7 rounded cursor-pointer border border-[#333] p-0 bg-transparent"
                      title="Renk"
                    />
                    {(selectedObj.type === 'symbol' || selectedObj.type === 'image') && (
                      <div className="flex items-center gap-1">
                        {/* Door Specific Orientation Controls */}
                        {['arch-d1r', 'arch-d1l', 'arch-d2'].includes(selectedObj.symbolId || '') && (
                          <div className="flex items-center gap-1 mr-2 bg-black/20 p-0.5 rounded border border-[#333]">
                            <span className="text-[8px] font-bold text-gray-500 px-1">KAPI:</span>
                            <button 
                              onClick={() => updateObject(selectedId, { scaleX: (selectedObj.scaleX || 1) * -1 })} 
                              className="w-7 h-7 bg-[#111] border border-[#333] rounded hover:border-[#F5C518] flex items-center justify-center text-[10px]"
                              title="Yönü Değiştir (Sağ/Sol)"
                            >
                              ⇄
                            </button>
                            <button 
                              onClick={() => updateObject(selectedId, { scaleY: (selectedObj.scaleY || 1) * -1 })} 
                              className="w-7 h-7 bg-[#111] border border-[#333] rounded hover:border-[#F5C518] flex items-center justify-center text-[10px]"
                              title="Açılış Yönü (İç/Dış)"
                            >
                              ⇅
                            </button>
                          </div>
                        )}
                        
                        <button onClick={() => updateObject(selectedId, { scaleX: (selectedObj.scaleX || 1) * -1 })} className="w-7 h-7 bg-[#111] border border-[#333] rounded hover:border-[#F5C518]" title="Yatay Çevir">↔️</button>
                        <button onClick={() => updateObject(selectedId, { scaleY: (selectedObj.scaleY || 1) * -1 })} className="w-7 h-7 bg-[#111] border border-[#333] rounded hover:border-[#F5C518]" title="Dikey Çevir">↕️</button>
                        {!['arch-1', 'arch-1v'].includes(selectedObj.symbolId || '') && (
                          <button onClick={() => updateObject(selectedId, { rotation: ((selectedObj.rotation || 0) + 90) % 360 })} className="w-7 h-7 bg-[#111] border border-[#333] rounded hover:border-[#F5C518]" title="90 Derece Döndür">🔄</button>
                        )}

                        {/* Center Alignment Buttons */}
                        <div className="flex items-center gap-1 ml-2 border-l border-[#333] pl-2">
                          <button 
                            onClick={() => {
                              if (drawingArea) {
                                updateObject(selectedId, { x: drawingArea.x + (drawingArea.width - (selectedObj.width || 0)) / 2 });
                              }
                            }} 
                            className="w-7 h-7 bg-[#111] border border-[#333] rounded hover:border-[#F5C518] flex items-center justify-center text-[10px]"
                            title="Yatayda Ortala"
                          >
                            ┶
                          </button>
                          <button 
                            onClick={() => {
                              if (drawingArea) {
                                updateObject(selectedId, { y: drawingArea.y + (drawingArea.height - (selectedObj.height || 0)) / 2 });
                              }
                            }} 
                            className="w-7 h-7 bg-[#111] border border-[#333] rounded hover:border-[#F5C518] flex items-center justify-center text-[10px]"
                            title="Dikeyde Ortala"
                          >
                            ┚
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ballistic Analysis Controls */}
                  {selectedObj.symbolId === 'ev-shooting-trajectory' && (
                    <div className="flex items-center gap-2 px-2 border-r border-[#333]">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-bold text-red-500 uppercase">Yatay Açı:</span>
                        <input
                          type="number"
                          value={selectedObj.azimuth || 0}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '-' || val === '.' || val === '') return;
                            const newAz = parseFloat(val);
                            if (isNaN(newAz)) return;

                            const sx = selectedObj.startX ?? 0;
                            const sy = selectedObj.startY ?? 0;
                            const ex = selectedObj.endX ?? 150;
                            const ey = selectedObj.endY ?? 0;
                            const dx = ex - sx;
                            const dy = ey - sy;
                            const len = Math.sqrt(dx*dx + dy*dy) || 100;
                            const rad = (newAz - 90) * (Math.PI / 180); 
                            const nEx = sx + len * Math.cos(rad);
                            const nEy = sy + len * Math.sin(rad);
                            
                            if (isNaN(nEx) || isNaN(nEy)) return;

                            updateObject(selectedId, { 
                              azimuth: newAz,
                              endX: nEx,
                              endY: nEy,
                              x: (sx + nEx) / 2,
                              y: (sy + nEy) / 2
                            });
                          }}
                          className="border border-[#333] bg-[#111] rounded px-1 py-0.5 text-[10px] text-gray-200 w-12 text-center"
                        />
                        <span className="text-[9px] text-gray-500">°</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-bold text-red-500 uppercase">Dikey Açı:</span>
                        <input
                          type="number"
                          value={selectedObj.tilt || 0}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '-' || val === '.' || val === '') return;
                            const valNum = parseFloat(val);
                            if (!isNaN(valNum)) {
                              updateObject(selectedId, { tilt: valNum });
                            }
                          }}
                          className="border border-[#333] bg-[#111] rounded px-1 py-0.5 text-[10px] text-gray-200 w-12 text-center"
                        />
                        <span className="text-[9px] text-gray-500">°</span>
                      </div>
                      <div className="flex items-center gap-1 ml-1">
                        <span className="text-[9px] font-bold text-red-500 uppercase">Uzunluk:</span>
                        <input
                          type="number"
                          value={(selectedObj as any).length || Math.round(Math.sqrt(Math.pow((selectedObj.endX || 0) - (selectedObj.startX || 0), 2) + Math.pow((selectedObj.endY || 0) - (selectedObj.startY || 0), 2)))}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') return;
                            const newLen = parseFloat(val);
                            if (isNaN(newLen) || newLen <= 0) return;

                            const sx = selectedObj.startX || 0;
                            const sy = selectedObj.startY || 0;
                            const ex = selectedObj.endX || 150;
                            const ey = selectedObj.endY || 0;
                            const dx = ex - sx;
                            const dy = ey - sy;
                            const currentLen = Math.sqrt(dx*dx + dy*dy);
                            const ratio = newLen / (currentLen || 1);
                            const nEx = sx + dx * ratio;
                            const nEy = sy + dy * ratio;
                            updateObject(selectedId, { 
                              length: newLen,
                              endX: nEx,
                              endY: nEy,
                              x: (sx + nEx) / 2,
                              y: (sy + nEy) / 2
                            } as any);
                          }}
                          className="border border-[#333] bg-[#111] rounded px-1 py-0.5 text-[10px] text-gray-200 w-16 text-center"
                        />
                        <span className="text-[9px] text-gray-500">cm</span>
                      </div>
                    </div>
                  )}

                  {/* Hız Analizi Butonu - Her zaman erişilebilir (tr-2 için) */}
                  {selectedObj.symbolId === 'tr-2' && (
                    <div className="flex items-center gap-1 px-2 border-r border-[#333]">
                      <button
                        onClick={() => {
                          const meters = (selectedObj.width * (selectedObj.scaleX || 1)) / 50; 
                          window.dispatchEvent(new CustomEvent('open-skid-calculator', { 
                            detail: { distance: meters.toFixed(2) } 
                          }));
                        }}
                        className="px-2 py-1 bg-emerald-500 text-black rounded text-[9px] font-black hover:bg-emerald-400 transition-all flex items-center gap-1 shadow-lg shadow-emerald-500/20"
                      >
                        <Activity size={10} />
                        HIZ ANALİZİ
                      </button>
                    </div>
                  )}

                  {/* Ok/Mesafe için Hız Göstergesi Toggle */}
                  {(selectedObj.symbolId === 'a-4' || selectedObj.isDistanceArrow) && (
                    <div className="flex items-center gap-2 px-2 border-r border-[#333]">
                      <label className="flex items-center gap-1.5 cursor-pointer group">
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            className="sr-only" 
                            checked={selectedObj.showSpeedInfo || false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              updateObject(selectedId, { showSpeedInfo: checked });
                              if (checked) {
                                // Extract distance and open calculator
                                const rawText = String(selectedObj.text || selectedObj.distance || '');
                                const match = rawText.match(/\d+(\.\d+)?/);
                                const cm = match ? parseFloat(match[0]) : 0;
                                const meters = rawText.toLowerCase().includes('metre') ? cm : cm / 100;
                                window.dispatchEvent(new CustomEvent('open-skid-calculator', { 
                                  detail: { 
                                    distance: meters.toFixed(2),
                                    objectId: selectedId
                                  } 
                                }));
                              }
                            }}
                          />
                          <div className={`w-6 h-3.5 rounded-full transition-colors ${selectedObj.showSpeedInfo ? 'bg-emerald-500' : 'bg-gray-700'}`}></div>
                          <div className={`absolute left-0.5 top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${selectedObj.showSpeedInfo ? 'translate-x-2.5' : ''}`}></div>
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 group-hover:text-emerald-400 transition-colors uppercase">HIZ GÖSTER</span>
                      </label>
                    </div>
                  )}

                  {/* Triangulation and Matrix Tools */}
                  {(selectedObj.findingNo || selectedObj.isTriangulation) && (
                    <div className="flex items-center gap-1 px-2 border-r border-[#333]">
                      <button
                        onClick={() => setFindingModalState({
                          isOpen: true,
                          symbol: selectedObj,
                          pos: { x: selectedObj.x, y: selectedObj.y }
                        })}
                        className="px-2 py-1 bg-[#F5C518]/10 text-[#F5C518] border border-[#F5C518]/30 rounded text-[9px] font-bold hover:bg-[#F5C518]/20 transition-all flex items-center gap-1"
                        title="Bulgu numarasını veya açıklamasını düzenle"
                      >
                        <Info size={10} />
                        {selectedObj.isTriangulation ? 'NO DÜZENLE' : 'BİLGİ DÜZENLE'}
                      </button>
                      <button
                        onClick={() => handleTriangulate(selectedId)}
                        className="px-2 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded text-[9px] font-bold hover:bg-emerald-500/20 transition-all flex items-center gap-1"
                        title="En yakın duvarlara veya sabit noktalara olan mesafeyi otomatik hesapla"
                      >
                        <Target size={10} />
                        SABİT NOKTA
                      </button>
                      <button
                        onClick={() => setIsDistanceMatrixOpen(true)}
                        className="px-2 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/30 rounded text-[9px] font-bold hover:bg-blue-500/20 transition-all flex items-center gap-1"
                        title="Tüm bulguların birbirine olan mesafesini gör"
                      >
                        <Grid size={10} />
                        MESAFE ÖLÇ
                      </button>
                    </div>
                  )}

                  {/* BPA Analytics Panel */}
                  {selectedObj.symbolId === 'ev-bpa-drop' && (
                    <div className="flex items-center gap-2 px-2 border-r border-[#333]">
                      <span className="text-[9px] font-bold text-red-500 uppercase">Analiz Kuyruğu:</span>
                      <input
                        type="range"
                        min="20" max="800"
                        value={selectedObj.tailLength || 100}
                        onChange={(e) => updateObject(selectedId, { tailLength: parseInt(e.target.value) })}
                        className="w-20 h-1 rounded-lg appearance-none bg-[#333] cursor-pointer accent-red-500"
                      />
                      <button
                        onClick={() => {
                          const meters = (selectedObj.width * (selectedObj.scaleX || 1)) / 50;
                          window.dispatchEvent(new CustomEvent('open-skid-calculator', { 
                            detail: { distance: meters.toFixed(2) } 
                          }));
                        }}
                        className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-black hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
                      >
                        <Activity size={10} />
                        HIZ ANALİZİ YAP
                      </button>
                    </div>
                  )}

                  {/* Tire Track Speed Analysis */}
                  {selectedObj.symbolId === 'tr-2' && (
                    <div className="flex items-center gap-2 px-2 border-r border-[#333]">
                      <button
                        onClick={() => {
                          const meters = (selectedObj.width * (selectedObj.scaleX || 1)) / 50; // Use current scale 50px = 1m
                          window.dispatchEvent(new CustomEvent('open-skid-calculator', { 
                            detail: { distance: meters.toFixed(2) } 
                          }));
                        }}
                        className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-black hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
                      >
                        <Activity size={10} />
                        HIZ ANALİZİ YAP
                      </button>
                    </div>
                  )}

                  {/* Camera Link Anchor Controls */}
                  {selectedObj.symbolId === 'ev-camera-link' && (
                    <div className="flex items-center gap-2 px-2 border-r border-[#333]">
                      <button
                        onClick={() => cameraInputRef.current?.click()}
                        className="px-2 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/30 rounded text-[9px] font-bold hover:bg-blue-500/20 transition-all flex items-center gap-1"
                      >
                        <Upload size={10} />
                        {selectedObj.photo ? 'FOTOĞRAFI DEĞİŞTİR' : 'FOTOĞRAF BAĞLA'}
                      </button>
                      {selectedObj.photo && (
                        <button
                          onClick={() => {
                            const win = window.open();
                            if (win) {
                              win.document.title = 'Fotoğraf Görüntüleme';
                              const body = win.document.body;
                              body.style.cssText = 'margin:0; background:#000; display:flex; align-items:center; justify-content:center;';
                              const img = win.document.createElement('img');
                              img.src = selectedObj.photo || '';
                              img.style.cssText = 'max-width:100%; max-height:100%; box-shadow: 0 0 50px rgba(0,0,0,0.5);';
                              img.alt = '';
                              body.appendChild(img);
                            }
                          }}
                          className="px-2 py-1 bg-green-500/10 text-green-500 border border-green-500/30 rounded text-[9px] font-bold hover:bg-green-500/20 transition-all"
                        >
                          FOTOĞRAFI GÖR
                        </button>
                      )}
                    </div>
                  )}

                  {/* Evidence Photo Management for any finding */}
                  {selectedObj.findingNo && (
                    <div className="flex items-center px-2 border-r border-[#333]">
                      <button
                        onClick={() => {
                          setEvidencePhotoTarget(selectedId);
                          setIsEvidencePhotoModalOpen(true);
                        }}
                        className={`px-2 py-1 border rounded text-[9px] font-bold transition-all flex items-center gap-1 ${
                          (selectedObj.photos?.length || 0) > 0 
                            ? 'bg-[#F5C518]/10 text-[#F5C518] border-[#F5C518]/30' 
                            : 'bg-white/5 text-gray-400 border-[#333] hover:border-gray-500'
                        }`}
                      >
                        <Camera size={10} />
                        FOTOĞRAFLAR {(selectedObj.photos?.length || 0) > 0 && `(${selectedObj.photos?.length})`}
                      </button>
                    </div>
                  )}

                  {/* Body Map Analysis */}
                  {selectedObj.symbolId === 'ev-body-map' && (
                    <div className="flex items-center px-2 border-r border-[#333]">
                      <button
                        onClick={() => {
                          setBodyMapTarget(selectedId);
                          setIsBodyMapModalOpen(true);
                        }}
                        className="px-2 py-1 bg-red-500/10 text-red-500 border border-red-500/30 rounded text-[9px] font-bold hover:bg-red-500/20 transition-all flex items-center gap-1"
                      >
                        <User size={10} />
                        VÜCUT ANALİZİ {(selectedObj.injuries?.length || 0) > 0 && `(${selectedObj.injuries?.length})`}
                      </button>
                    </div>
                  )}

                  {/* Group 5: Arrows Specifics */}
                  {(selectedObj.isDistanceArrow || selectedObj.symbolId?.startsWith('a-5')) && (
                    <div className="flex items-center px-2 border-r border-[#333]">
                      <input
                        type="range"
                        min="1" max="15"
                        value={selectedObj.strokeWidth || 4}
                        onChange={(e) => updateObject(selectedId, { strokeWidth: parseInt(e.target.value) })}
                        className="w-16 h-1 rounded-lg appearance-none bg-[#333] cursor-pointer accent-[#F5C518]"
                      />
                    </div>
                  )}

                  {/* Group 6: Z-Index & Delete */}
                  <div className="flex items-center gap-1 pl-1">
                    <button onClick={() => {
                      const maxZ = Math.max(...objects.map(o => getEffectiveZIndex(o)), 0);
                      updateObject(selectedId, { zIndex: maxZ + 1 });
                    }} className="px-2 py-1.5 hover:bg-[#2a2a2a] rounded text-gray-400 text-[9px] font-bold" title="Öne Getir">ÖNE</button>
                    <button onClick={() => {
                      const minZ = Math.min(...objects.filter(o => !o.isTemplate).map(o => getEffectiveZIndex(o)), 0);
                      updateObject(selectedId, { zIndex: Math.max(0, minZ - 1) });
                    }} className="px-2 py-1.5 hover:bg-[#2a2a2a] rounded text-gray-400 text-[9px] font-bold" title="Arka Getir">ARKA</button>
                    <button onClick={() => removeObject(selectedId)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors" title="Sil"><Trash2 size={16} /></button>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Logo Upload Trigger Button in Toolbar */}
        {selectedId === 'corporate-logo' && isAdmin && (
          <div className="flex items-center px-2 border-r border-[#333]">
            <button
              onClick={() => logoInputRef.current?.click()}
              className="px-2 py-1 bg-[#F5C518]/10 text-[#F5C518] border border-[#F5C518]/30 rounded text-[9px] font-bold hover:bg-[#F5C518]/20 transition-all flex items-center gap-1"
            >
              <Upload size={10} />
              {objects.find(o => o.id === 'corporate-logo')?.src ? 'LOGOYU DEĞİŞTİR' : 'LOGO YÜKLE'}
            </button>
          </div>
        )}

        <input 
          type="file" 
          ref={cameraInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleCameraPhotoUpload} 
        />

        <input 
          type="file" 
          ref={logoInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleLogoUpload} 
        />
      </div>

      {/* Finding List Panel */}
      {objects.some(o => o.findingNo) && (
        <div className="fixed right-4 top-32 bg-[#1e1e1e]/90 backdrop-blur-md border border-[#F5C518]/30 rounded-lg shadow-2xl p-3 w-64 z-40 animate-in fade-in slide-in-from-right-4">
          <div className="flex items-center gap-2 mb-3 border-b border-[#333] pb-2">
            <div className="w-2 h-2 rounded-full bg-[#F5C518] animate-pulse" />
            <h3 className="text-[11px] font-black text-[#F5C518] uppercase tracking-wider">Bulgu Listesi</h3>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
            {objects
              .filter(o => o.findingNo)
              .sort((a, b) => (a.findingNo || '').localeCompare(b.findingNo || '', undefined, { numeric: true }))
              .map((obj) => (
                <div 
                  key={obj.id}
                  className={`flex items-center gap-2 bg-[#111] p-2 rounded border transition-colors group cursor-pointer ${
                    selectedId === obj.id ? 'border-[#F5C518] bg-[#F5C518]/5' : 'border-[#333] hover:border-[#F5C518]/50'
                  }`}
                  onClick={() => setSelectedId(obj.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-300 truncate font-bold">
                      Bulgu No. {obj.findingNo}: <span className="text-[#F5C518] font-black ml-1">{obj.findingDesc || obj.name}</span>
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFindingModalState({
                          isOpen: true,
                          symbol: obj,
                          pos: { x: obj.x + 20, y: obj.y + 20 }
                        });
                      }}
                      className="p-1 hover:bg-[#F5C518]/20 text-gray-500 hover:text-[#F5C518] rounded transition-colors"
                      title="Düzenle"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeObject(obj.id);
                      }}
                      className="p-1 hover:bg-red-500/20 text-gray-500 hover:text-red-500 rounded transition-colors"
                      title="Sil"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <FindingModal
        isOpen={findingModalState.isOpen}
        onClose={() => setFindingModalState(s => ({ ...s, isOpen: false }))}
        title={
          objects.some(o => o.id === findingModalState.symbol?.id) 
            ? (findingModalState.symbol?.id === 'out-fixed-point' ? "SABİT NOKTAYI DÜZENLE" : "BULGUYU DÜZENLE")
            : (findingModalState.symbol?.id === 'out-fixed-point' ? "YENİ NİRENGİ / SABİT NOKTA EKLE" : "YENİ BULGU EKLE")
        }
        defaultNo={findingModalState.symbol?.findingNo || ''}
        defaultDesc={findingModalState.symbol?.findingDesc || ''}
        onConfirm={(no, desc) => {
          if (no) {
            const existingId = findingModalState.symbol?.id;
            const isEditing = objects.some(o => o.id === existingId);

            if (isEditing) {
              updateObject(existingId, {
                findingNo: no,
                findingDesc: desc
              });
              addNotification({
                type: 'success',
                message: 'Bulgu Güncellendi',
                description: `Bulgu No. ${no}: ${findingModalState.symbol.name} bilgileri güncellendi.`
              });
            } else {
              addObject({
                ...findingModalState.symbol,
                id: uuidv4(),
                x: findingModalState.pos.x - 20,
                y: findingModalState.pos.y - 20,
                width: 40,
                height: 40,
                zIndex: objects.length,
                findingNo: no,
                findingDesc: desc,
                symbolId: findingModalState.symbol.id,
                categoryId: 'evidence'
              });
              addNotification({
                type: 'success',
                message: 'Bulgu Eklendi',
                description: `Bulgu No. ${no}: ${findingModalState.symbol.name} tuvale eklendi.`
              });
            }
          }
        }}
      />

      <PromptModal
        isOpen={promptState.isOpen}
        onClose={() => setPromptState(s => ({ ...s, isOpen: false }))}
        title={promptState.title}
        label={promptState.label}
        defaultValue={promptState.value}
        onConfirm={promptState.onConfirm}
        multiline={promptState.multiline}
      />

      <DistanceModal
        isOpen={isDistanceModalOpen}
        onClose={() => setIsDistanceModalOpen(false)}
        onConfirm={(value) => {
          if (distanceModalTarget) {
            updateObject(distanceModalTarget, { distance: value });
            saveHistory();
          }
          setIsDistanceModalOpen(false);
        }}
        initialValue={initialDistance}
        title="ATIŞ MESAFESİ"
      />

      <EvidencePhotoModal
        isOpen={isEvidencePhotoModalOpen}
        onClose={() => setIsEvidencePhotoModalOpen(false)}
        object={objects.find(o => o.id === evidencePhotoTarget) || null}
        onUpdatePhotos={(newPhotos: string[]) => {
          if (evidencePhotoTarget) {
            updateObject(evidencePhotoTarget, { photos: newPhotos });
            saveHistory();
          }
        }}
      />

      <BodyMapModal
        isOpen={isBodyMapModalOpen}
        onClose={() => setIsBodyMapModalOpen(false)}
        object={objects.find(o => o.id === bodyMapTarget) || null}
        onUpdateInjuries={(newInjuries: any[]) => {
          if (bodyMapTarget) {
            updateObject(bodyMapTarget, { injuries: newInjuries });
            saveHistory();
          }
        }}
      />

      {/* Fixed Bottom status bar (merged with pages) */}
      <div className="h-12 bg-[#1a1a1a] border-t border-[#2a2a2a] flex items-center px-4 gap-1 z-10 flex-shrink-0 bottom-bar">
        <button
          onClick={() => setGridVisible(!gridVisible)}
          className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${
            gridVisible
              ? 'bg-[#F5C518] text-black'
              : 'bg-[#242424] text-gray-500 border border-[#333] hover:border-[#444]'
          }`}
        >
          KILAVUZ: {gridVisible ? 'AÇIK' : 'KAPALI'}
        </button>

        <button 
          onClick={() => setCanvasBgColor(canvasBgColor === '#0a0a0a' ? '#ffffff' : '#0a0a0a')}
          className={`px-3 py-1 text-[10px] font-bold rounded transition-all border ${
            canvasBgColor === '#ffffff' 
              ? 'bg-white text-black border-gray-300' 
              : 'bg-[#242424] text-gray-400 border-[#333] hover:border-[#444]'
          }`}
        >
          ZEMİN: {canvasBgColor === '#ffffff' ? 'BEYAZ' : 'SİYAH'}
        </button>

        <div className="h-4 w-px bg-[#333] mx-2" />

        <div className="flex-1 flex items-center gap-1 overflow-x-auto custom-scrollbar">
          <PageControlBar variant="inline" />
        </div>

        <div className="flex items-center gap-1 bg-[#242424] rounded border border-[#333] px-1 py-0.5">
          <button 
            onClick={() => {
              if (containerRef.current) {
                const containerWidth = containerRef.current.offsetWidth - 4;
                const containerHeight = containerRef.current.offsetHeight - 4;
                const stageWidth = canvasOrientation === 'landscape' ? 1400 : 1000;
                const stageHeight = canvasOrientation === 'landscape' ? 1000 : 1400;
                const newScale = Math.min(containerWidth / stageWidth, containerHeight / stageHeight, 2);
                setScale(newScale);
                setStagePos({ x: 0, y: 0 });
              }
            }}
            className="px-2 py-0.5 text-[9px] font-bold text-gray-400 hover:text-[#F5C518] hover:bg-[#333] rounded transition-all"
          >
            SIĞDIR
          </button>
          <div className="w-px h-3 bg-[#333]" />
          <button 
            onClick={() => {
              setScale(1);
              setStagePos({ x: 0, y: 0 });
            }}
            className="px-2 py-0.5 text-[9px] font-bold text-gray-400 hover:text-[#F5C518] hover:bg-[#333] rounded transition-all"
          >
            %100
          </button>
          <div className="w-px h-3 bg-[#333]" />
          <button 
            onClick={() => setCanvasOrientation(canvasOrientation === 'landscape' ? 'portrait' : 'landscape')}
            className="px-3 py-1 text-[10px] font-bold rounded bg-[#242424] text-gray-200 border border-[#333] hover:border-[#F5C518] hover:text-[#F5C518] transition-all uppercase"
          >
            TUVAL: A4 ({canvasOrientation === 'landscape' ? 'YATAY' : 'DİKEY'})
          </button>
          <span className="px-2 text-[9px] font-black text-[#F5C518] min-w-[35px] text-center">
            %{Math.round(scale * 100)}
          </span>
        </div>

        <div className="h-4 w-px bg-[#333] mx-2" />

        <span className="text-[9px] text-gray-300 font-semibold italic whitespace-nowrap">
          Resmi Makamlar İçin Olay Yeri Dokümantasyonu
        </span>
      </div>

      {/* HTML-based High Priority Photo Preview Overlay (Overflows canvas) */}
      {hoveredId && hoveredPos && (
        <div 
          className="fixed z-[99999] pointer-events-none transition-all duration-200"
          style={{ 
            left: `${hoveredPos.x}px`, 
            top: `${hoveredPos.y - 20}px`,
            transform: 'translateX(-50%) translateY(-100%)'
          }}
        >
          {(() => {
            const obj = objects.find(o => o.id === hoveredId);
            if (!obj || !obj.photos || obj.photos.length === 0) return null;
            
            return (
              <div className="flex flex-col items-center">
                <div className="bg-[#1a1a1a]/95 backdrop-blur-xl border-2 border-[#F5C518] rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex gap-4 ring-1 ring-white/10 animate-in zoom-in-95 duration-200">
                  {obj.photos.slice(0, 3).map((url, i) => (
                    <div key={i} className="relative group">
                      <img 
                        src={url} 
                        className="w-[150px] h-[150px] object-contain bg-[#111] rounded-lg border border-[#333] shadow-inner" 
                        alt="Evidence" 
                      />
                      <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[8px] font-black text-[#F5C518] border border-[#F5C518]/30">
                        #{i+1}
                      </div>
                    </div>
                  ))}
                  {obj.photos.length > 3 && (
                    <div className="flex items-center justify-center min-w-[40px] text-xl font-black text-[#F5C518] animate-pulse">
                      +{obj.photos.length - 3}
                    </div>
                  )}
                </div>
                {/* Speech bubble arrow */}
                <div 
                  className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[15px] border-t-[#F5C518]"
                />
              </div>
            );
          })()}
        </div>
      )}
      <DistanceMatrixModal
        isOpen={isDistanceMatrixOpen}
        onClose={() => setIsDistanceMatrixOpen(false)}
        objects={objects}
        onDrawMeasurement={handleDrawMeasurement}
      />
    </div>
  );
};
