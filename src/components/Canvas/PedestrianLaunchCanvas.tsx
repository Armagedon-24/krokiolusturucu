import React, { useRef, useEffect, useState } from 'react';
import { Rect, Line, Group, Text, Star, Circle, Ellipse } from 'react-konva';
import { useStore } from '../../store/useStore';

function getLaunchState(time: number, duration: number, startX: number, startY: number, endX: number, maxHeightPx: number) {
  const progress = Math.min(time / duration, 1);
  const x = startX + (endX - startX) * progress;
  const y = startY - maxHeightPx * 4 * progress * (1 - progress);
  const rotation = 360 * progress;
  const isImpact = progress > 0.95;
  const opacity = isImpact && Math.floor(progress * 20) % 2 === 0 ? 0.3 : 1;
  return { x, y, rotation, isImpact, opacity, progress };
}

export const PedestrianLaunchCanvas: React.FC = () => {
  const launchData = useStore((s) => s.pedestrianLaunch.canvasData);
  const { isPlaying, currentTime, speed, loop, duration } = useStore((s) => s.pedestrianLaunch);
  const setPedestrianLaunch = useStore((s) => s.setPedestrianLaunch);

  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const [impactFlash, setImpactFlash] = useState(false);

  if (!launchData) return null;

  // Compute scene bounds dynamically
  const groundY = 350;
  const maxDistPx = Math.min(500, launchData.throwDistance * 15);
  const maxHeightPx = Math.min(200, launchData.maxHeight * 30);
  const startX = 200;
  const endX = startX + maxDistPx;

  const totalW = Math.max(endX + 100, 500);

  const launchState = getLaunchState(currentTime, duration, startX, groundY, endX, maxHeightPx);

  // Animation loop
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

      setPedestrianLaunch({ currentTime: newTime });

      if (newTime >= duration) {
        if (loop) {
          timeRef.current = 0;
          lastTimeRef.current = 0;
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        } else {
          setPedestrianLaunch({ isPlaying: false });
          return;
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, speed, loop, duration, setPedestrianLaunch, currentTime]);

  return (
    <Group>
      {/* Ground */}
      <Line points={[30, groundY, totalW - 30, groundY]} stroke="#666" strokeWidth={4} lineCap="round" />

      {/* Trajectory line */}
      <Line
        points={(() => {
          const pts: number[] = [];
          const segments = 30;
          for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            pts.push(startX + maxDistPx * t, groundY - maxHeightPx * 4 * t * (1 - t));
          }
          return pts;
        })()}
        stroke="#FF5722"
        strokeWidth={2}
        dash={[6, 4]}
      />

      {/* Launch marker */}
      <Circle x={startX} y={groundY} radius={5} fill="#1565C0" stroke="#fff" strokeWidth={2} />

      {/* Impact marker */}
      <Star x={endX} y={groundY} numPoints={5} innerRadius={4} outerRadius={8} fill={impactFlash ? '#FFD600' : '#FF5722'} stroke="#fff" strokeWidth={1.5} opacity={0.8} />

      {/* Distance bracket */}
      <Line points={[startX, groundY + 12, endX, groundY + 12]} stroke="#FF5722" strokeWidth={1.5} dash={[4, 3]} />
      <Line points={[startX, groundY + 8, startX, groundY + 16]} stroke="#FF5722" strokeWidth={1.5} />
      <Line points={[endX, groundY + 8, endX, groundY + 16]} stroke="#FF5722" strokeWidth={1.5} />
      <Text x={startX + maxDistPx / 2 - 20} y={groundY + 14} text={`${launchData.throwDistance.toFixed(1)}m`} fontSize={10} fontFamily="Inter" fontStyle="bold" fill="#FF5722" />

      {/* Height bracket */}
      <Line points={[startX - 40, groundY - maxHeightPx, startX - 40, groundY]} stroke="#1565C0" strokeWidth={1.5} dash={[4, 3]} />
      <Line points={[startX - 45, groundY - maxHeightPx, startX - 35, groundY - maxHeightPx]} stroke="#1565C0" strokeWidth={1.5} />
      <Line points={[startX - 45, groundY, startX - 35, groundY]} stroke="#1565C0" strokeWidth={1.5} />
      <Text x={startX - 65} y={groundY - maxHeightPx / 2 - 8} text={`${launchData.maxHeight.toFixed(2)}m`} fontSize={10} fontFamily="Inter" fontStyle="bold" fill="#1565C0" align="center" width={25} />

      {/* Vehicle */}
      <Group>
        <Rect x={startX - 100} y={groundY - 20} width={60} height={22} fill="#E53935" stroke="#b71c1c" strokeWidth={2} cornerRadius={3} />
        <Rect x={startX - 100 + 40} y={groundY - 18} width={14} height={16} fill="rgba(200,230,255,0.4)" cornerRadius={1} />
        <Circle cx={startX - 100 + 10} cy={groundY + 2} r={4} fill="#1a1a1a" />
        <Circle cx={startX - 100 + 52} cy={groundY + 2} r={4} fill="#1a1a1a" />
        <Text x={startX - 100} y={groundY - 32} width={60} text={`${launchData.vehicleSpeed} km/h`} fontSize={9} fontStyle="bold" fill="#E53935" align="center" />
      </Group>

      {/* Pedestrian figure */}
      <Group x={launchState.x} y={launchState.y} rotation={launchState.rotation} opacity={launchState.opacity}>
        <Circle x={0} y={-12} radius={6} fill="#e6c8a0" stroke="#c4a882" strokeWidth={1.5} />
        <Ellipse x={0} y={-15} radiusX={5} radiusY={3} fill="#3a2210" />
        <Line points={[0, -6, 0, 9]} stroke="#1565C0" strokeWidth={3} lineCap="round" />
        <Line points={[0, 1, -6, -3]} stroke="#e6c8a0" strokeWidth={2.5} lineCap="round" />
        <Line points={[0, 1, 6, -3]} stroke="#e6c8a0" strokeWidth={2.5} lineCap="round" />
        <Line points={[0, 9, -5, 17]} stroke="#1a3a6b" strokeWidth={3} lineCap="round" />
        <Line points={[0, 9, 5, 17]} stroke="#1a3a6b" strokeWidth={3} lineCap="round" />
      </Group>

      {/* Data panel */}
      <Group>
        <Rect x={totalW - 190} y={10} width={180} height={140} fill="#1a1a1a" cornerRadius={6} opacity={0.85} stroke="#333" strokeWidth={1} />
        <Text x={totalW - 182} y={18} text="YAYA FIRLATMA" fontSize={11} fontFamily="Inter" fontStyle="bold" fill="#F5C518" />
        <Text x={totalW - 182} y={36} text={`Araç: ${launchData.vehicleSpeed} km/h`} fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#ccc" />
        <Text x={totalW - 182} y={54} text={`Mesafe: ${launchData.throwDistance.toFixed(2)}m`} fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#FF5722" />
        <Text x={totalW - 182} y={72} text={`Süre: ${launchData.flightTime.toFixed(2)}sn`} fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#ccc" />
        <Text x={totalW - 182} y={90} text={`Çarpma: ${Math.round(launchData.landingSpeed)} km/h`} fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#E53935" />
        <Text x={totalW - 182} y={108} text={`Maks. Yük.: ${launchData.maxHeight.toFixed(2)}m`} fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#F5C518" />
        <Text x={totalW - 182} y={126} text={`Yaya: ${launchData.pedestrianHeight}cm/${launchData.pedestrianWeight}kg`} fontSize={11} fontFamily="Inter" fontStyle="bold" fill="#888" />
      </Group>

      {/* Scene label */}
      <Group>
        <Rect x={15} y={15} width={130} height={26} fill="#1a1a1a" cornerRadius={5} opacity={0.8} stroke="#333" strokeWidth={1} />
        <Text x={21} y={20} text="YAYA FIRLATMA ANALİZİ" fontSize={9} fontFamily="Inter" fontStyle="bold" fill="#fff" />
      </Group>
    </Group>
  );
};
