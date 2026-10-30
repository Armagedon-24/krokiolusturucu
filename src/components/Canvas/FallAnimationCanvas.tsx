import React, { useRef, useEffect, useState } from 'react';
import { Rect, Line, Group, Text, Star, Circle, Ellipse } from 'react-konva';
import { useStore } from '../../store/useStore';
import type { FallData } from '../../types';

const HUMAN_W = 24;
const HUMAN_H = 48;
const HUMAN_SHOULDER_W = 34;

// Scene geometry — centered on the canvas drawing area
const PAD = 60;

function getCanvasBounds(fallData: FallData) {
  const heightPx = Math.min(600, fallData.height * 8);
  const distancePx = Math.min(400, fallData.distance * 10);
  const totalH = heightPx + 2 * PAD;
  const totalW = distancePx + 120 + 2 * PAD;
  const cx = totalW / 2;
  const cy = totalH - PAD;

  const startX = cx;
  const startY = cy - heightPx;
  const endX = cx + distancePx;
  const endY = cy;

  return { heightPx, distancePx, totalH, totalW, cx, cy, startX, startY, endX, endY };
}

function getFallState(time: number, duration: number, startX: number, startY: number, endX: number, endY: number) {
  const progress = Math.min(time / duration, 1);
  const x = startX + (endX - startX) * progress;
  const y = startY + (endY - startY) * progress + 20 * Math.sin(progress * Math.PI);
  const rotation = 15 * Math.sin(progress * Math.PI);
  const isImpact = progress > 0.9;
  const opacity = isImpact && Math.floor(progress * 20) % 2 === 0 ? 0.3 : 1;
  return { x, y, rotation, isImpact, opacity, progress };
}

export const FallAnimationCanvas: React.FC = () => {
  const fallData = useStore((s) => s.fallAnimation.canvasData);
  const { isPlaying, currentTime, speed, loop, duration } = useStore((s) => s.fallAnimation);
  const setFallAnimation = useStore((s) => s.setFallAnimation);

  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const [impactFlash, setImpactFlash] = useState(false);

  // Animation loop (hooks must run unconditionally — early return below)
  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = 0;
      timeRef.current = 0;
      return;
    }

    timeRef.current = currentTime;

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaMs = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      const deltaSec = (deltaMs / 1000) * speed;
      const newTime = Math.min(timeRef.current + deltaSec, duration);
      timeRef.current = newTime;

      const wasUnderImpact = currentTime / duration <= 0.9;
      const isUnderImpact = newTime / duration > 0.9;
      if (!wasUnderImpact && isUnderImpact) {
        setImpactFlash(true);
        setTimeout(() => setImpactFlash(false), 150);
      }

      setFallAnimation({ currentTime: newTime });

      if (newTime >= duration) {
        if (loop) {
          timeRef.current = 0;
          lastTimeRef.current = 0;
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        } else {
          setFallAnimation({ isPlaying: false });
          return;
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, speed, loop, duration, setFallAnimation, currentTime]);

  if (!fallData) return null;

  const bounds = getCanvasBounds(fallData);
  const fallState = getFallState(currentTime, duration, bounds.startX, bounds.startY, bounds.endX, bounds.endY);
  const progress = fallState.progress;

  const sx = bounds.startX;
  const sy = bounds.startY;
  const ex = bounds.endX;
  const ey = bounds.endY;

  return (
    <Group>
      {/* Building */}
      <Group>
        <Ellipse x={sx} y={bounds.cy + 2} radiusX={48} radiusY={6} fill="#000" opacity={0.12} />
        <Rect x={sx - 28} y={PAD + 4} width={64} height={bounds.cy - PAD} fill="#000" opacity={0.08} cornerRadius={2} />
        <Rect x={sx - 30} y={PAD} width={60} height={bounds.cy - PAD} fill="#c8c8c8" stroke="#777" strokeWidth={2} cornerRadius={2} />
        <Rect x={sx + 24} y={PAD} width={6} height={bounds.cy - PAD} fill="#a0a0a0" stroke="#777" strokeWidth={1} />
        <Line points={[sx, PAD, sx, bounds.cy]} stroke="#aaa" strokeWidth={0.5} opacity={0.4} />
        <Rect x={sx - 34} y={PAD - 4} width={68} height={8} fill="#777" stroke="#555" strokeWidth={1} cornerRadius={1} />
        <Rect x={sx - 36} y={PAD - 8} width={72} height={6} fill="#888" stroke="#666" strokeWidth={1} cornerRadius={1} />
        <Rect x={sx - 30} y={PAD - 12} width={60} height={5} fill="#999" stroke="#777" strokeWidth={0.8} cornerRadius={1} />
        {Array.from({ length: 9 }, (_, i) => (
          <React.Fragment key={`fl-${i}`}>
            <Line points={[sx - 28, PAD + 45 + i * 42, sx + 28, PAD + 45 + i * 42]} stroke="#999" strokeWidth={0.5} opacity={0.6} />
            <Rect x={sx - 30} y={PAD + 44 + i * 42} width={60} height={1.5} fill="#aaa" opacity={0.5} />
          </React.Fragment>
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <React.Fragment key={`rw-${i}`}>
            <Rect x={sx - 22} y={PAD + 10 + i * 42} width={12} height={30} fill="#b8d4e8" stroke="#999" strokeWidth={0.8} cornerRadius={1} opacity={i % 2 === 0 ? 1 : 0.8} />
            <Rect x={sx + 10} y={PAD + 10 + i * 42} width={12} height={30} fill="#b8d4e8" stroke="#999" strokeWidth={0.8} cornerRadius={1} opacity={i % 2 === 1 ? 1 : 0.8} />
            <Line points={[sx - 20, PAD + 12 + i * 42, sx - 14, PAD + 12 + i * 42]} stroke="#fff" strokeWidth={1} opacity={0.3} />
            <Line points={[sx + 12, PAD + 12 + i * 42, sx + 18, PAD + 12 + i * 42]} stroke="#fff" strokeWidth={1} opacity={0.3} />
          </React.Fragment>
        ))}
        <Rect x={sx - 30} y={bounds.cy - 80} width={60} height={80} fill="#000" opacity={0.06} />
        <Rect x={sx - 7} y={bounds.cy - 38} width={14} height={38} fill="#5c3a1e" stroke="#3a2210" strokeWidth={1.5} cornerRadius={1} />
        <Rect x={sx - 8} y={bounds.cy - 40} width={16} height={2} fill="#3a2210" />
        <Circle x={sx + 4} y={bounds.cy - 20} radius={1.5} fill="#F5C518" />
        <Line points={[sx - 32, bounds.cy, sx + 32, bounds.cy]} stroke="#666" strokeWidth={3} lineCap="round" />
      </Group>

      {/* Ground */}
      <Line points={[PAD, bounds.cy, bounds.totalW - PAD, bounds.cy]} stroke="#666" strokeWidth={6} lineCap="round" />

      {/* Trajectory */}
      <Line points={[sx, sy, ex, ey]} stroke="#E53935" strokeWidth={2} dash={[6, 4]} />

      {/* Height bracket */}
      <Line points={[sx - 50, sy - 5, sx - 50, ey + 5]} stroke="#1565C0" strokeWidth={1.5} dash={[4, 3]} />
      <Line points={[sx - 55, sy - 5, sx - 45, sy - 5]} stroke="#1565C0" strokeWidth={1.5} />
      <Line points={[sx - 55, ey + 5, sx - 45, ey + 5]} stroke="#1565C0" strokeWidth={1.5} />
      <Text x={sx - 80} y={bounds.cy - bounds.heightPx / 2 - 10} text={`${fallData.height}m`} fontSize={11} fontFamily="Inter" fontStyle="bold" fill="#1565C0" align="center" width={30} />

      {/* Distance bracket */}
      <Line points={[sx, ey + 15, ex, ey + 15]} stroke="#E53935" strokeWidth={1.5} dash={[4, 3]} />
      <Line points={[sx, ey + 10, sx, ey + 20]} stroke="#E53935" strokeWidth={1.5} />
      <Line points={[ex, ey + 10, ex, ey + 20]} stroke="#E53935" strokeWidth={1.5} />
      <Text x={sx + (ex - sx) / 2 - 20} y={ey + 17} text={`${fallData.distance.toFixed(1)}m`} fontSize={10} fontFamily="Inter" fontStyle="bold" fill="#E53935" />

      {/* Impact marker */}
      <Star x={ex} y={ey} numPoints={5} innerRadius={4} outerRadius={8} fill={impactFlash ? '#FFD600' : '#FF5722'} stroke="#fff" strokeWidth={1.5} opacity={0.8} />

      {/* Falling human */}
      <Group x={fallState.x} y={fallState.y} rotation={fallState.rotation} opacity={fallState.opacity}>
        <Ellipse x={0} y={HUMAN_H * 0.15} radiusX={HUMAN_SHOULDER_W * 0.35} radiusY={HUMAN_H * 0.25} fill="#000" opacity={0.06} />
        <Line points={[-HUMAN_SHOULDER_W * 0.45, -HUMAN_H * 0.12, -HUMAN_SHOULDER_W * 0.15, HUMAN_H * 0.02]} stroke="#e6c8a0" strokeWidth={4.5} lineCap="round" />
        <Line points={[HUMAN_SHOULDER_W * 0.45, -HUMAN_H * 0.12, HUMAN_SHOULDER_W * 0.15, HUMAN_H * 0.02]} stroke="#e6c8a0" strokeWidth={4.5} lineCap="round" />
        <Line points={[-HUMAN_W * 0.15, HUMAN_H * 0.45, -HUMAN_W * 0.35, HUMAN_H * 0.85]} stroke="#1a3a6b" strokeWidth={5} lineCap="round" />
        <Line points={[HUMAN_W * 0.15, HUMAN_H * 0.45, HUMAN_W * 0.35, HUMAN_H * 0.85]} stroke="#1a3a6b" strokeWidth={5} lineCap="round" />
        <Ellipse x={-HUMAN_W * 0.35} y={HUMAN_H * 0.88} radiusX={4} radiusY={2.5} fill="#222" />
        <Ellipse x={HUMAN_W * 0.35} y={HUMAN_H * 0.88} radiusX={4} radiusY={2.5} fill="#222" />
        <Rect x={-HUMAN_W * 0.33} y={-HUMAN_H * 0.12} width={HUMAN_W * 0.66} height={HUMAN_H * 0.55} fill="#1565C0" stroke="#0d47a1" strokeWidth={1.5} cornerRadius={3} />
        <Line points={[-5, -HUMAN_H * 0.12, 0, -HUMAN_H * 0.06, 5, -HUMAN_H * 0.12]} stroke="#0d47a1" strokeWidth={1.5} lineCap="round" />
        <Circle x={0} y={-HUMAN_H * 0.24} r={HUMAN_W * 0.3} fill="#e6c8a0" stroke="#c4a882" strokeWidth={1.5} />
        <Ellipse x={0} y={-HUMAN_H * 0.3} radiusX={HUMAN_W * 0.27} radiusY={HUMAN_W * 0.12} fill="#3a2210" />
        <Line points={[-5, -HUMAN_H * 0.24, -2, -HUMAN_H * 0.22]} stroke="#3a2210" strokeWidth={1.2} lineCap="round" />
        <Line points={[5, -HUMAN_H * 0.24, 2, -HUMAN_H * 0.22]} stroke="#3a2210" strokeWidth={1.2} lineCap="round" />
        <Circle x={-3.5} y={-HUMAN_H * 0.19} r={2} fill="#fff" />
        <Circle x={3.5} y={-HUMAN_H * 0.19} r={2} fill="#fff" />
        <Circle x={-3.5} y={-HUMAN_H * 0.19} r={1} fill="#333" />
        <Circle x={3.5} y={-HUMAN_H * 0.19} r={1} fill="#333" />
        <Line points={[0, -HUMAN_H * 0.17, 0, -HUMAN_H * 0.13]} stroke="#c4a882" strokeWidth={1} lineCap="round" />
        <Line points={[-3, -HUMAN_H * 0.1, 0, -HUMAN_H * 0.08, 3, -HUMAN_H * 0.1]} stroke="#b5786a" strokeWidth={1.2} lineCap="round" fill="#b5786a" />
        {isPlaying && progress > 0.1 && progress < 0.85 && (
          <>
            <Line points={[HUMAN_SHOULDER_W * 0.65, -HUMAN_H * 0.3, HUMAN_SHOULDER_W * 0.65, -HUMAN_H * 0.55]} stroke="#aaa" strokeWidth={1.5} dash={[4, 4]} opacity={0.3} />
            <Line points={[-HUMAN_SHOULDER_W * 0.65, -HUMAN_H * 0.2, -HUMAN_SHOULDER_W * 0.65, -HUMAN_H * 0.45]} stroke="#aaa" strokeWidth={1.5} dash={[4, 4]} opacity={0.3} />
          </>
        )}
      </Group>

      {/* Data panel */}
      <Group>
        <Rect x={bounds.totalW - 200} y={10} width={185} height={145} fill="#1a1a1a" cornerRadius={8} opacity={0.85} stroke="#333" strokeWidth={1} />
        <Text x={bounds.totalW - 192} y={18} text="ANİMASYON VERİLERİ" fontSize={11} fontFamily="Inter" fontStyle="bold" fill="#F5C518" />
        <Text x={bounds.totalW - 192} y={38} text={`Yükseklik: ${fallData.height}m`} fontSize={14} fontFamily="Inter" fontStyle="bold" fill="#ccc" />
        <Text x={bounds.totalW - 192} y={56} text={`Yatay Mesafe: ${fallData.distance.toFixed(2)}m`} fontSize={14} fontFamily="Inter" fontStyle="bold" fill="#ccc" />
        <Text x={bounds.totalW - 192} y={74} text={`Çarpma Hızı: ${Math.round(fallData.impactVelocity)} km/h`} fontSize={14} fontFamily="Inter" fontStyle="bold" fill="#E53935" />
        <Text x={bounds.totalW - 192} y={92} text={`Düşüş Süresi: ${fallData.time.toFixed(2)}sn`} fontSize={14} fontFamily="Inter" fontStyle="bold" fill="#ccc" />
        <Text x={bounds.totalW - 192} y={110} text={`Çarpma Enerjisi: ${Math.round(fallData.impactEnergy)} Joule`} fontSize={14} fontFamily="Inter" fontStyle="bold" fill="#F5C518" />
        <Text x={bounds.totalW - 192} y={128} text={`Ağırlık: ${fallData.weight}kg | Hava: ${fallData.useDrag ? 'Dahil' : 'Hariç'}`} fontSize={12} fontFamily="Inter" fontStyle="bold" fill="#888" />
      </Group>

      {/* Scene label */}
      <Group>
        <Rect x={PAD - 10} y={PAD - 10} width={120} height={28} fill="#1a1a1a" cornerRadius={6} opacity={0.8} stroke="#333" strokeWidth={1} />
        <Text x={PAD - 4} y={PAD - 3} text={`${fallData.height}m DÜŞME`} fontSize={9} fontFamily="Inter" fontStyle="bold" fill="#fff" />
      </Group>
    </Group>
  );
};
