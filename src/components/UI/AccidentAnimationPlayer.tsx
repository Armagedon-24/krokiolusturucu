import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Line, Circle, Group, Text, Star } from 'react-konva';
import { X, Play, Square, RotateCcw, Save } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { VehicleData } from '../../types';

const VEHICLE_WIDTH = 60;
const VEHICLE_HEIGHT = 30;
const STAGE_W = 1000;
const STAGE_H = 650;
const PADDING = 60;

interface AccidentAnimationPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

function getVehicleState(vehicle: VehicleData, progress: number) {
  const brakeProgress = 0.25;
  const collisionProgress = 0.55;

  let x: number, y: number, rotation: number;
  let showBrake: boolean;
  let opacity: number;

  if (progress < brakeProgress) {
    const t = progress / brakeProgress;
    x = vehicle.startX + (vehicle.collisionX - vehicle.startX) * t * 0.3;
    y = vehicle.startY + (vehicle.collisionY - vehicle.startY) * t * 0.3;
    rotation = vehicle.startRotation;
    showBrake = false;
    opacity = 1;
  } else if (progress < collisionProgress) {
    const t = (progress - brakeProgress) / (collisionProgress - brakeProgress);
    const brakeStartX = vehicle.startX + (vehicle.collisionX - vehicle.startX) * 0.3;
    const brakeStartY = vehicle.startY + (vehicle.collisionY - vehicle.startY) * 0.3;
    x = brakeStartX + (vehicle.collisionX - brakeStartX) * t;
    y = brakeStartY + (vehicle.collisionY - brakeStartY) * t;
    rotation = vehicle.startRotation + (vehicle.impactAngle - vehicle.startRotation) * t * 0.3;
    showBrake = true;
    opacity = 1;
  } else if (progress < 0.7) {
    x = vehicle.collisionX;
    y = vehicle.collisionY;
    rotation = vehicle.impactAngle;
    showBrake = true;
    opacity = 1;
  } else {
    const t = (progress - 0.7) / 0.3;
    x = vehicle.collisionX + (vehicle.finalX - vehicle.collisionX) * t;
    y = vehicle.collisionY + (vehicle.finalY - vehicle.collisionY) * t;
    rotation = vehicle.impactAngle + (vehicle.finalRotation - vehicle.impactAngle) * t;
    showBrake = true;
    opacity = 1;
  }

  return { x, y, rotation, showBrake, opacity };
}

function getBrakeMarkPoints(vehicle: VehicleData) {
  const brakeStartX = vehicle.startX + (vehicle.collisionX - vehicle.startX) * 0.3;
  const brakeStartY = vehicle.startY + (vehicle.collisionY - vehicle.startY) * 0.3;

  const points: number[] = [];
  const segments = 20;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    let x = brakeStartX + (vehicle.collisionX - brakeStartX) * t;
    let y = brakeStartY + (vehicle.collisionY - brakeStartY) * t;
    if (vehicle.brakeMarkType === 'curved') {
      const curveOffset = Math.sin(t * Math.PI) * vehicle.brakeMarkCurvature * 20;
      const dx = vehicle.collisionX - brakeStartX;
      const dy = vehicle.collisionY - brakeStartY;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len;
      const ny = dx / len;
      x += nx * curveOffset;
      y += ny * curveOffset;
    }
    points.push(x, y);
  }
  return points;
}

export const AccidentAnimationPlayer: React.FC<AccidentAnimationPlayerProps> = ({ isOpen, onClose }) => {
  const { accidentReconstruction, accidentAnimation, setAccidentAnimation, setAccidentData, saveAnimation } = useStore();

  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const [impactFlash, setImpactFlash] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const { enabled, vehicles } = accidentReconstruction;
  const activeVehicles = vehicles.filter((v): v is VehicleData => !!v);
  const { isPlaying, currentTime, speed, loop } = accidentAnimation;

  const handlePlay = useCallback(() => {
    setAccidentData({ enabled: true });
    setAccidentAnimation({ isPlaying: true, currentTime: 0 });
  }, [setAccidentData, setAccidentAnimation]);

  const handlePause = useCallback(() => {
    setAccidentAnimation({ isPlaying: false });
  }, [setAccidentAnimation]);

  const handleStop = useCallback(() => {
    setAccidentAnimation({ isPlaying: false, currentTime: 0 });
  }, [setAccidentAnimation]);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setAccidentAnimation({ speed: newSpeed });
  }, [setAccidentAnimation]);

  const handleToggleLoop = useCallback(() => {
    setAccidentAnimation({ loop: !accidentAnimation.loop });
  }, [setAccidentAnimation, accidentAnimation.loop]);

  const handleSave = useCallback(() => {
    if (saveName.trim()) {
      saveAnimation(saveName.trim());
      setShowSaveInput(false);
      setSaveName('');
    }
  }, [saveName, saveAnimation]);

  // Animation loop — uses internal timeRef to avoid infinite re-subscribe
  useEffect(() => {
    if (!isPlaying || !enabled) {
      lastTimeRef.current = 0;
      timeRef.current = 0;
      return;
    }

    timeRef.current = currentTime;

    const duration = accidentReconstruction.animationDuration / speed;

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaMs = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      const deltaSec = deltaMs / 1000;
      const prevTime = timeRef.current;
      const newTime = Math.min(prevTime + deltaSec, duration);
      timeRef.current = newTime;

      const wasUnderCollision = prevTime / duration < 0.55;
      const isUnderCollision = newTime < duration * 0.7 && newTime >= duration * 0.55;

      if (!wasUnderCollision && isUnderCollision) {
        setImpactFlash(true);
        setTimeout(() => setImpactFlash(false), 300);
      }

      setAccidentAnimation({ currentTime: newTime });

      if (newTime >= duration) {
        if (loop) {
          timeRef.current = 0;
          lastTimeRef.current = 0;
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        } else {
          setAccidentAnimation({ isPlaying: false });
          return;
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, enabled, speed, loop, accidentReconstruction.animationDuration, setAccidentAnimation]);

  // Compute scene bounds
  const allPoints: number[] = [];
  activeVehicles.forEach(v => {
    allPoints.push(v.startX, v.startY, v.collisionX, v.collisionY, v.finalX, v.finalY);
  });
  const minX = Math.min(...allPoints.filter((_, i) => i % 2 === 0)) - PADDING;
  const minY = Math.min(...allPoints.filter((_, i) => i % 2 === 1)) - PADDING;
  const maxX = Math.max(...allPoints.filter((_, i) => i % 2 === 0)) + PADDING;
  const maxY = Math.max(...allPoints.filter((_, i) => i % 2 === 1)) + PADDING;
  const sceneW = maxX - minX;
  const sceneH = maxY - minY;
  const scale = Math.min(STAGE_W / sceneW, STAGE_H / sceneH, 2);
  const offsetX = (STAGE_W - sceneW * scale) / 2 - minX * scale;
  const offsetY = (STAGE_H - sceneH * scale) / 2 - minY * scale;

  const progress = accidentReconstruction.animationDuration > 0
    ? Math.min(currentTime / accidentReconstruction.animationDuration, 1)
    : 0;

  // Road surface info label
  const surfaceLabels: Record<string, string> = {
    asphalt_dry: 'Asfalt (Kuru)',
    asphalt_wet: 'Asfalt (Islak)',
    concrete_dry: 'Beton (Kuru)',
    concrete_wet: 'Beton (Islak)',
    gravel: 'Çakıl',
    soil: 'Toprak',
    snow: 'Kar',
    ice: 'Buz',
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      {/* Overlay click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden w-[1100px] max-w-[95vw] max-h-[95vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a] bg-[#1f1f1f] shrink-0">
          <h3 className="text-sm font-bold text-gray-100 tracking-wide uppercase">Kaza Yeniden Canlandırma — Animasyon</h3>
          <div className="flex items-center gap-2">
            {showSaveInput ? (
              <div className="flex items-center gap-2 bg-[#111] border border-[#333] rounded-lg px-3 py-1.5">
                <input
                  type="text"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder="Animasyon adı..."
                  className="bg-transparent border-none text-xs text-white outline-none w-36"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                />
                <button onClick={handleSave} className="text-[10px] font-bold text-[#F5C518] hover:text-white transition-colors">KAYDET</button>
                <button onClick={() => { setShowSaveInput(false); setSaveName(''); }} className="text-gray-500 hover:text-white">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-gray-400 hover:text-[#F5C518] border border-[#333] hover:border-[#F5C518]/50 rounded-lg transition-all"
              >
                <Save size={12} />
                ANİMASYONU KAYDET
              </button>
            )}

            {/* Play/Pause in header */}
            {isPlaying ? (
              <button
                onClick={handlePause}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-black rounded-lg transition-all"
              >
                <Square size={14} />
                DURAKLAT
              </button>
            ) : (
              <button
                onClick={handlePlay}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#F5C518] hover:bg-[#E2B616] text-black text-[10px] font-black rounded-lg transition-all shadow-lg active:scale-95"
              >
                <Play size={14} />
                BAŞLAT
              </button>
            )}

            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-md transition-all">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Konva Stage */}
        <div className="relative bg-[#111] flex items-center justify-center p-3">
          <Stage width={STAGE_W} height={STAGE_H} className="rounded-lg border border-[#333]">
            <Layer>
              {/* Background */}
              <Rect x={0} y={0} width={STAGE_W} height={STAGE_H} fill="#f0f0f0" />

              <Group scaleX={scale} scaleY={scale} x={offsetX} y={offsetY}>
                {/* Road surface indicator */}
                <Rect
                  x={0} y={0}
                  width={sceneW} height={sceneH}
                  fill="#f0f0f0"
                  stroke="#ccc"
                  strokeWidth={1}
                  dash={[8, 8]}
                />

                {activeVehicles.map((vehicle) => {
                  if (!vehicle.showVehicle) return null;
                  const state = getVehicleState(vehicle, progress);
                  const brakePoints = getBrakeMarkPoints(vehicle);
                  const brakeProgress = Math.max(0, Math.min(1, (progress - 0.25) / 0.3));
                  const visibleBrakeCount = Math.floor(brakeProgress * (brakePoints.length / 2 - 1)) + 1;
                  const visibleBrakePoints = brakePoints.slice(0, Math.max(visibleBrakeCount * 2, 2));

                  const showCollision = progress >= 0.55;
                  const collisionScale = showCollision ? Math.min(1, (progress - 0.55) / 0.05) : 0;

                  return (
                    <Group key={vehicle.id}>
                      {/* Path line */}
                      {vehicle.showPath && (
                        <Line
                          points={[vehicle.startX, vehicle.startY, vehicle.collisionX, vehicle.collisionY, vehicle.finalX, vehicle.finalY]}
                          stroke={vehicle.color + '40'}
                          strokeWidth={2}
                          dash={[6, 4]}
                          lineCap="round"
                          lineJoin="round"
                        />
                      )}

                      {/* Brake marks */}
                      {vehicle.showBrakeMarks && vehicle.brakeMarkType !== 'none' && state.showBrake && visibleBrakePoints.length >= 4 && (
                        <Line
                          points={visibleBrakePoints}
                          stroke="#333"
                          strokeWidth={Math.max(2, vehicle.brakeMarkWidth * 3)}
                          lineCap="round"
                          lineJoin="round"
                          opacity={0.8}
                        />
                      )}

                      {/* Start label */}
                      <Text
                        x={vehicle.startX - 20}
                        y={vehicle.startY + 15}
                        text={`Başlangıç: ${vehicle.initialSpeed} km/h`}
                        fontSize={9}
                        fill="#888"
                        fontStyle="bold"
                      />

                      {/* Brake mark length label */}
                      {vehicle.showBrakeMarks && vehicle.brakeMarkType !== 'none' && (
                        <Text
                          x={(vehicle.startX + vehicle.collisionX) / 2 - 30}
                          y={(vehicle.startY + vehicle.collisionY) / 2 + 10}
                          text={`Fren İzi: ${vehicle.brakeMarkLength}m`}
                          fontSize={9}
                          fill="#666"
                          fontStyle="bold"
                        />
                      )}

                      {/* Collision point label */}
                      <Circle
                        x={vehicle.collisionX}
                        y={vehicle.collisionY}
                        radius={4}
                        fill={vehicle.color}
                        stroke="#fff"
                        strokeWidth={1}
                      />
                      <Text
                        x={vehicle.collisionX + 8}
                        y={vehicle.collisionY - 8}
                        text={`Çarpışma: ${vehicle.impactSpeed} km/h, ${vehicle.impactAngle}°`}
                        fontSize={9}
                        fill="#E53935"
                        fontStyle="bold"
                      />

                      {/* Final position label */}
                      <Text
                        x={vehicle.finalX - 20}
                        y={vehicle.finalY + 15}
                        text={`Son: ${Math.round(Math.sqrt((vehicle.finalX - vehicle.collisionX)**2 + (vehicle.finalY - vehicle.collisionY)**2))}px öte`}
                        fontSize={9}
                        fill="#888"
                        fontStyle="bold"
                      />

                      {/* Collision indicator */}
                      {showCollision && (
                        <Star
                          x={vehicle.collisionX}
                          y={vehicle.collisionY}
                          numPoints={8}
                          innerRadius={10 * collisionScale}
                          outerRadius={25 * collisionScale}
                          fill={impactFlash ? '#FFD600' : '#FF5722'}
                          stroke="#fff"
                          strokeWidth={2}
                          opacity={0.9 * collisionScale}
                        />
                      )}

                      {/* Vehicle body */}
                      <Group x={state.x} y={state.y} rotation={state.rotation} opacity={state.opacity}>
                        <Rect
                          x={-VEHICLE_WIDTH / 2}
                          y={-VEHICLE_HEIGHT / 2}
                          width={VEHICLE_WIDTH}
                          height={VEHICLE_HEIGHT}
                          fill={vehicle.color}
                          stroke="#fff"
                          strokeWidth={2}
                          cornerRadius={4}
                          shadowColor="rgba(0,0,0,0.4)"
                          shadowBlur={8}
                          shadowOffset={{ x: 2, y: 2 }}
                        />
                        <Rect
                          x={VEHICLE_WIDTH / 2 - 8}
                          y={-VEHICLE_HEIGHT / 2 + 3}
                          width={6}
                          height={VEHICLE_HEIGHT - 6}
                          fill="rgba(255,255,255,0.3)"
                          cornerRadius={2}
                        />
                        <Text
                          x={-VEHICLE_WIDTH / 2}
                          y={-VEHICLE_HEIGHT / 2 - 16}
                          width={VEHICLE_WIDTH}
                          height={14}
                          text={vehicle.name}
                          fontSize={10}
                          fontStyle="bold"
                          fill="#222"
                          align="center"
                        />
                      </Group>
                    </Group>
                  );
                })}
              </Group>
            </Layer>
          </Stage>

          {/* Playback indicator overlay */}
          <div className="absolute top-5 right-5 bg-black/60 text-[#F5C518] text-xs font-bold px-3 py-1 rounded-full">
            %{Math.round(progress * 100)}
          </div>
        </div>

        {/* Info bar */}
        <div className="px-5 py-2 bg-[#111] border-t border-[#2a2a2a] flex items-center gap-4 text-[10px] text-gray-500">
          <span>Yol: {surfaceLabels[accidentReconstruction.roadSurface] || accidentReconstruction.roadSurface}</span>
          <span>μ: {accidentReconstruction.frictionCoefficient}</span>
          <span>Hız Limiti: {accidentReconstruction.speedLimit} km/h</span>
          <span>Hava: {accidentReconstruction.weather}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#1f1f1f] border-t border-[#2a2a2a] shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleStop}
              className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            >
              <RotateCcw size={14} />
              DURDUR
            </button>
          </div>
          <div className="flex items-center gap-4">
            {/* Speed selector */}
            <div className="flex items-center gap-1 bg-[#111] border border-[#333] rounded-lg px-2 py-1">
              {[0.25, 0.5, 1, 2, 4].map(s => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${
                    speed === s ? 'bg-[#F5C518] text-black' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Loop toggle */}
            <button
              onClick={handleToggleLoop}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                loop
                  ? 'bg-[#F5C518]/10 border-[#F5C518]/40 text-[#F5C518]'
                  : 'border-[#333] text-gray-500 hover:text-white'
              }`}
            >
              DÖNGÜ
            </button>

          </div>
        </div>
      </div>
    </div>
  );
};
