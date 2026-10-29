import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Line, Group, Text, Star, Circle, Ellipse } from 'react-konva';
import { X, Play, Square, RotateCcw } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { PedestrianLaunchData } from '../../types';

const PADDING = 50;

interface PedestrianLaunchAnimationPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  launchData: PedestrianLaunchData;
}

function easeOutQuad(t: number) {
  return t * (2 - t);
}

function getLaunchState(
  time: number, duration: number, groundY: number, startX: number,
  maxHeightPx: number, flightEndX: number, trajEndX: number
) {
  const progress = Math.min(time / duration, 1);
  const totalDist = trajEndX - startX;
  const flightDist = flightEndX - startX;
  const slideDist = trajEndX - flightEndX;
  const flightEndProgress = totalDist > 0 ? flightDist / totalDist : 1;

  if (progress <= flightEndProgress) {
    const phaseProgress = flightEndProgress > 0 ? progress / flightEndProgress : 1;
    const x = startX + flightDist * phaseProgress;
    const y = groundY - maxHeightPx * 4 * phaseProgress * (1 - phaseProgress);
    const rotation = 360 * phaseProgress;
    const displayOpacity = 1;
    return { x, y, rotation, isImpact: false, opacity: displayOpacity, progress };
  } else {
    const phaseProgress = slideDist > 0
      ? (progress - flightEndProgress) / (1 - flightEndProgress)
      : 1;
    const x = flightEndX + slideDist * easeOutQuad(phaseProgress);
    const y = groundY;
    const rotation = 90 - 90 * easeOutQuad(phaseProgress);
    const isImpact = phaseProgress > 0.85;
    const displayOpacity = isImpact && Math.floor(phaseProgress * 20) % 2 === 0 ? 0.3 : 1;
    return { x, y, rotation, isImpact, opacity: displayOpacity, progress };
  }
}

/** Draw a jointed human figure with animated arms/legs */
function PedestrianFigure({ x, y, rotation, opacity }: {
  x: number; y: number; rotation: number; opacity: number;
}) {
  return (
    <Group x={x} y={y} rotation={rotation} opacity={opacity}>
      <Circle x={0} y={-12} radius={6} fill="#e6c8a0" stroke="#c4a882" strokeWidth={1.5} />
      <Ellipse x={0} y={-15} radiusX={5} radiusY={3} fill="#3a2210" />
      <Line points={[0, -6, 0, 9]} stroke="#1565C0" strokeWidth={3} lineCap="round" />
      <Line points={[0, 1, -6, -3]} stroke="#e6c8a0" strokeWidth={2.5} lineCap="round" />
      <Line points={[0, 1, 6, -3]} stroke="#e6c8a0" strokeWidth={2.5} lineCap="round" />
      <Line points={[0, 9, -5, 17]} stroke="#1a3a6b" strokeWidth={3} lineCap="round" />
      <Line points={[0, 9, 5, 17]} stroke="#1a3a6b" strokeWidth={3} lineCap="round" />
    </Group>
  );
}

export const PedestrianLaunchAnimationPlayer: React.FC<PedestrianLaunchAnimationPlayerProps> = ({ isOpen, onClose, launchData }) => {
  const isPlaying = useStore((s) => s.pedestrianLaunch.isPlaying);
  const currentTime = useStore((s) => s.pedestrianLaunch.currentTime);
  const speed = useStore((s) => s.pedestrianLaunch.speed);
  const loop = useStore((s) => s.pedestrianLaunch.loop);
  const duration = useStore((s) => s.pedestrianLaunch.duration ?? 3);

  const setPedestrianLaunchRef = useRef(useStore.getState().setPedestrianLaunch);

  useEffect(() => {
    setPedestrianLaunchRef.current = useStore.getState().setPedestrianLaunch;
  });

  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 500 });

  // Responsive stage: fit container
  useEffect(() => {
    if (!containerRef.current || !isOpen) return;
    const container = containerRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setStageSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [isOpen]);

  const { width: STAGE_W, height: STAGE_H } = stageSize;
  const groundY = STAGE_H - PADDING - 40;
  const startX = STAGE_W * 0.15;

  // Proportional scaling: car (~4.5m real) is reference for throw distance
  const CAR_LENGTH_M = 4.5;
  const BASE_CAR_PX = 100;
  const scalePxPerM = BASE_CAR_PX / CAR_LENGTH_M;
  const availableWidth = STAGE_W - PADDING - startX;

  let throwPx = launchData.throwDistance * scalePxPerM;
  let carScale = 1;
  if (throwPx > availableWidth) {
    carScale = availableWidth / throwPx;
    throwPx = availableWidth;
  }

  const carPx = BASE_CAR_PX * carScale;
  const maxDistPx = throwPx;
  const maxHeightPx = Math.min(STAGE_H * 0.5, Math.max(20, launchData.maxHeight * scalePxPerM * carScale));
  const trajEndX = startX + maxDistPx;
  const flightEndX = launchData.throwDistance > 0
    ? startX + maxDistPx * (launchData.flightDistance / launchData.throwDistance)
    : startX;
  const slideRatio = launchData.throwDistance > 0 ? launchData.slideDistance / launchData.throwDistance : 0;

  const IMPACT_TIME_RATIO = 0.08;
  const impactTime = duration * IMPACT_TIME_RATIO;
  const effectiveTime = currentTime < impactTime ? 0 : currentTime - impactTime;
  const effectiveDuration = duration - impactTime;

  const vehicleTravelDist = carPx * 2.5;
  const vehicleEndX = startX - carPx;
  const vehicleStartX = vehicleEndX - vehicleTravelDist;
  const vehicleT = Math.min(currentTime / impactTime, 1);
  const vehicleX = vehicleStartX + (vehicleEndX - vehicleStartX) * vehicleT;

  const launchState = getLaunchState(effectiveTime, effectiveDuration, groundY, startX, maxHeightPx, flightEndX, trajEndX);

  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const [impactFlash, setImpactFlash] = useState(false);
  const [impactParticles, setImpactParticles] = useState<{ x: number; y: number; r: number; dx: number; dy: number; life: number }[]>([]);

  useEffect(() => {
    if (isOpen) {
      setPedestrianLaunchRef.current({ isPlaying: true, currentTime: 0 });
      setImpactFlash(false);
      setImpactParticles([]);
    }
  }, [isOpen]);

  const handlePlay = useCallback(() => {
    setPedestrianLaunchRef.current({ isPlaying: true, currentTime: 0 });
  }, []);

  const handlePause = useCallback(() => {
    setPedestrianLaunchRef.current({ isPlaying: false });
  }, []);

  const handleStop = useCallback(() => {
    setPedestrianLaunchRef.current({ isPlaying: false, currentTime: 0 });
    setImpactParticles([]);
  }, []);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setPedestrianLaunchRef.current({ speed: newSpeed });
  }, []);

  const handleToggleLoop = useCallback(() => {
    setPedestrianLaunchRef.current({ loop: !loop });
  }, [loop]);

  // Spawn impact particles
  const spawnImpactParticles = useCallback((px: number, py: number) => {
    const particles = [];
    for (let i = 0; i < 12; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const speed = 30 + Math.random() * 60;
      particles.push({
        x: px, y: py,
        r: 2 + Math.random() * 4,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        life: 1,
      });
    }
    setImpactParticles(particles);
  }, []);

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
      const prevTime = timeRef.current;
      const newTime = Math.min(prevTime + deltaSec, duration);
      timeRef.current = newTime;

      const effPrevTime = Math.max(0, prevTime - impactTime);
      const effNewTime = Math.max(0, newTime - impactTime);
      const prevProgress = effectiveDuration > 0 ? effPrevTime / effectiveDuration : 0;
      const newProgress = effectiveDuration > 0 ? effNewTime / effectiveDuration : 0;
      if (prevProgress <= 0.95 && newProgress > 0.95) {
        setImpactFlash(true);
        spawnImpactParticles(trajEndX, groundY);
        setTimeout(() => setImpactFlash(false), 150);
      }

      // Update particles
      setImpactParticles(prev => prev
        .map(p => ({
          ...p,
          x: p.x + p.dx * deltaSec,
          y: p.y + p.dy * deltaSec,
          dy: p.dy + 200 * deltaSec,
          life: p.life - deltaSec * 2,
        }))
        .filter(p => p.life > 0)
      );

      useStore.getState().setPedestrianLaunch({ currentTime: newTime });

      if (newTime >= duration) {
        if (loop) {
          timeRef.current = 0;
          lastTimeRef.current = 0;
          setImpactParticles([]);
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        } else {
          useStore.getState().setPedestrianLaunch({ isPlaying: false });
          return;
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, speed, loop, duration, impactTime, effectiveDuration, STAGE_W, STAGE_H, trajEndX, groundY, spawnImpactParticles]);

  const handleSaveVideo = useCallback(async () => {
    if (!stageRef.current) return;
    const stageContainer = stageRef.current.getContent();
    const canvasEl = stageContainer.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvasEl || typeof MediaRecorder === 'undefined') return;

    setPedestrianLaunchRef.current({ currentTime: 0, isPlaying: true, speed: 1, loop: false });
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
        const animState = useStore.getState().pedestrianLaunch;
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
        suggestedName: `yaya-firlatma-${Math.round(launchData.vehicleSpeed)}kmh.${ext}`,
        types: [{ description: isMp4 ? 'MP4 Video' : 'WebM Video', accept: { [baseMimeType]: [`.${ext}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `yaya-firlatma-${Math.round(launchData.vehicleSpeed)}kmh.${ext}`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, [launchData.vehicleSpeed, duration, STAGE_W, STAGE_H]);



  const stateLabel = ({
    stationary: 'SABİT',
    walking_same: 'YÜRÜYOR (Aynı Yön)',
    walking_opposite: 'YÜRÜYOR (Ters Yön)',
    running_same: 'KOŞUYOR (Aynı Yön)',
    running_opposite: 'KOŞUYOR (Ters Yön)',
  } as Record<string, string>)[launchData.pedestrianState] ?? '';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col w-[98vw] max-w-[1400px] h-[96vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a] bg-[#1f1f1f] shrink-0">
          <h3 className="text-sm font-bold text-gray-100 tracking-wide uppercase">Yaya Fırlatma Animasyonu</h3>
          <div className="flex items-center gap-2">
            <button onClick={handlePlay} className="flex items-center gap-1 px-3 py-1.5 bg-[#F5C518] hover:bg-[#E2B616] text-black text-[10px] font-bold rounded-md transition-all shadow-sm">
              <Play size={13} /> BAŞLAT
            </button>
            <button onClick={handleSaveVideo} className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-gray-400 hover:text-white border border-[#333] hover:border-gray-500 rounded-md transition-all">
              KAYDET
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-md transition-all">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stage — fills remaining space */}
        <div ref={containerRef} className="flex-1 bg-[#111] flex items-center justify-center p-4 min-h-0">
          <Stage ref={stageRef} width={STAGE_W} height={STAGE_H} className="rounded-lg border border-[#333]">
            <Layer>
              {/* Background */}
              <Rect x={0} y={0} width={STAGE_W} height={STAGE_H} fill="#f4f1eb" />

              {/* Sky gradient strip */}
              <Rect x={0} y={0} width={STAGE_W} height={PADDING} fill="#e8e4dc" opacity={0.5} />

              {/* Road surface */}
              <Rect x={0} y={STAGE_H - PADDING - 5} width={STAGE_W} height={PADDING + 5} fill="#c8c4be" />
              <Line points={[0, STAGE_H - PADDING, STAGE_W, STAGE_H - PADDING]} stroke="#888" strokeWidth={3} lineCap="round" />

              {/* Ground distance markers */}
              {Array.from({ length: Math.min(10, Math.ceil(launchData.throwDistance / 2)) }).map((_, i) => {
                const markerDist = (i + 1) * maxDistPx / Math.min(10, Math.ceil(launchData.throwDistance / 2));
                return (
                  <Line key={i}
                    points={[startX + markerDist, groundY - 3, startX + markerDist, groundY + 8]}
                    stroke="#aaa" strokeWidth={1} opacity={0.4}
                  />
                );
              })}

              {/* Vehicle — proportionally scaled */}
              <Group x={vehicleX - (startX - carPx)}>
                {/* Body */}
                <Rect x={startX - carPx} y={groundY - 30} width={carPx} height={26 * carScale} fill="#D32F2F" stroke="#b71c1c" strokeWidth={1.5} cornerRadius={4} />
                {/* Cabin */}
                <Rect x={startX - carPx * 0.8} y={groundY - 42 * carScale} width={carPx * 0.55} height={18 * carScale} fill="#D32F2F" stroke="#b71c1c" strokeWidth={1} cornerRadius={2} />
                {/* Windshield */}
                <Rect x={startX - carPx * 0.8 + 2} y={groundY - 40 * carScale} width={Math.max(12, 25 * carScale)} height={Math.max(8, 14 * carScale)} fill="rgba(200,230,255,0.4)" stroke="rgba(255,255,255,0.2)" strokeWidth={1} cornerRadius={2} />
                {/* Rear window */}
                <Rect x={startX - carPx * 0.8 + 30 * carScale} y={groundY - 40 * carScale} width={Math.max(10, 20 * carScale)} height={Math.max(8, 14 * carScale)} fill="rgba(200,230,255,0.25)" stroke="rgba(255,255,255,0.15)" strokeWidth={1} cornerRadius={2} />
                {/* Wheels */}
                <Circle cx={startX - carPx * 0.8} cy={groundY + 1} radius={Math.max(4, 7 * carScale)} fill="#1a1a1a" />
                <Circle cx={startX - carPx * 0.22} cy={groundY + 1} radius={Math.max(4, 7 * carScale)} fill="#1a1a1a" />
                {/* Speed label on vehicle — large & readable */}
                <Rect x={startX - carPx} y={groundY - 60 * carScale} width={carPx} height={20 * carScale} fill="#1a1a1a" cornerRadius={4} opacity={0.8} />
                <Text
                  x={startX - carPx + 6} y={groundY - 58 * carScale}
                  width={carPx - 6}
                  text={`${Math.round(launchData.vehicleSpeed)} km/h`}
                  fontSize={Math.max(10, 14 * carScale)} fontFamily="Inter" fontStyle="bold"
                  fill="#fff" align="left"
                />
              </Group>

              {/* Flight trajectory — parabolic arc */}
              <Line
                points={(() => {
                  const pts: number[] = [];
                  const segments = 20;
                  for (let i = 0; i <= segments; i++) {
                    const t = i / segments;
                    const px = startX + (flightEndX - startX) * t;
                    const py = groundY - maxHeightPx * 4 * t * (1 - t);
                    pts.push(px, py);
                  }
                  return pts;
                })()}
                stroke="#FF5722" strokeWidth={2.5} dash={[8, 6]} lineCap="round" opacity={0.55}
              />

              {/* Slide trajectory — ground drag */}
              {slideRatio > 0.02 && (
                <Line
                  points={[flightEndX, groundY, trajEndX, groundY]}
                  stroke="#FF5722" strokeWidth={3} lineCap="round" opacity={0.35}
                />
              )}

              {/* Impact marker at landing point */}
              <Star x={trajEndX} y={groundY} numPoints={5} innerRadius={5} outerRadius={14}
                fill={impactFlash ? '#FFD600' : '#FF5722'} stroke="#fff" strokeWidth={2} opacity={0.95} />

              {/* Impact particles */}
              {impactParticles.map((p, i) => (
                <Circle key={i} x={p.x} y={p.y} radius={p.r}
                  fill={impactFlash ? '#FFD600' : '#FF5722'} opacity={p.life * 0.8} />
              ))}

              {/* Pedestrian figure */}
              <PedestrianFigure
                x={launchState.x} y={launchState.y}
                rotation={launchState.rotation} opacity={launchState.opacity}
              />

              {/* ===== Scene annotations — large & readable ===== */}

              {/* Flight distance bracket */}
              <Group>
                <Line points={[startX, groundY + 24, flightEndX, groundY + 24]}
                  stroke="#1565C0" strokeWidth={2} dash={[5, 4]} />
                <Line points={[startX, groundY + 16, startX, groundY + 32]} stroke="#1565C0" strokeWidth={2} />
                <Line points={[flightEndX, groundY + 16, flightEndX, groundY + 32]} stroke="#1565C0" strokeWidth={2} />
                <Rect
                  x={startX + (flightEndX - startX) / 2 - 48} y={groundY + 30}
                  width={96} height={22} fill="#1565C0" cornerRadius={4} opacity={0.9}
                />
                <Text
                  x={startX + (flightEndX - startX) / 2 - 44} y={groundY + 34}
                  text={`Uçuş ${launchData.flightDistance.toFixed(1)}m`}
                  fontSize={14} fontFamily="Inter" fontStyle="bold" fill="#fff" align="left" width={92}
                />
              </Group>

              {/* Height label at peak of trajectory */}
              <Group>
                <Line points={[startX, groundY - maxHeightPx, flightEndX, groundY - maxHeightPx]}
                  stroke="#1565C0" strokeWidth={1.5} dash={[4, 4]} opacity={0.25} />
                <Rect
                  x={(startX + flightEndX) / 2 - 30} y={groundY - maxHeightPx - 22}
                  width={60} height={20} fill="#1565C0" cornerRadius={4} opacity={0.9}
                />
                <Text
                  x={(startX + flightEndX) / 2 - 26} y={groundY - maxHeightPx - 18}
                  text={`${launchData.maxHeight.toFixed(2)}m`}
                  fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#fff" align="left" width={56}
                />
              </Group>

              {/* Impact label — collision speed (vehicle hits pedestrian) */}
              <Group>
                <Rect x={startX + 8} y={groundY - 24} width={98} height={20} fill="#E53935" cornerRadius={3} opacity={0.85} />
                <Text
                  x={startX + 12} y={groundY - 22}
                  text={`Çarpma ${Math.round(launchData.vehicleSpeed)} km/h`}
                  fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#fff" align="left" width={90}
                />
              </Group>

              {/* Landing speed label at ground impact point */}
              <Group>
                <Rect x={trajEndX + 10} y={groundY - 46} width={96} height={20} fill="#E53935" cornerRadius={3} opacity={0.85} />
                <Text
                  x={trajEndX + 14} y={groundY - 44}
                  text={`Yer ${Math.round(launchData.landingSpeed)} km/h`}
                  fontSize={12} fontFamily="Inter" fontStyle="bold" fill="#fff" align="left" width={88}
                />
              </Group>

              {/* Slide distance bracket */}
              {slideRatio > 0.02 && (
                <Group>
                  <Line points={[flightEndX, groundY + 48, trajEndX, groundY + 48]}
                    stroke="#FF5722" strokeWidth={1.5} dash={[4, 3]} opacity={0.6} />
                  <Line points={[flightEndX, groundY + 42, flightEndX, groundY + 54]} stroke="#FF5722" strokeWidth={1.5} opacity={0.6} />
                  <Line points={[trajEndX, groundY + 42, trajEndX, groundY + 54]} stroke="#FF5722" strokeWidth={1.5} opacity={0.6} />
                  <Rect
                    x={flightEndX + (trajEndX - flightEndX) / 2 - 42} y={groundY + 54}
                    width={84} height={20} fill="#FF5722" cornerRadius={3} opacity={0.8}
                  />
                  <Text
                    x={flightEndX + (trajEndX - flightEndX) / 2 - 38} y={groundY + 56}
                    text={`Sür. ${launchData.slideDistance.toFixed(1)}m`}
                    fontSize={12} fontFamily="Inter" fontStyle="bold" fill="#fff" align="left" width={80}
                  />
                </Group>
              )}

              {/* Top-left legend — what the values mean */}
              <Group>
                <Rect x={10} y={8} width={190} height={104}
                  fill="#1a1a1a" cornerRadius={6} opacity={0.88} stroke="#444" strokeWidth={1} />
                <Text x={16} y={12} text="GÖSTERGE" fontSize={11} fontFamily="Inter" fontStyle="bold" fill="#F5C518" />

                <Rect x={16} y={28} width={10} height={2} fill="#1565C0" />
                <Text x={30} y={24} text="Uçuş mesafesi (havada)" fontSize={11} fontFamily="Inter" fill="#ccc" />

                <Rect x={16} y={44} width={10} height={2} fill="#FF5722" />
                <Text x={30} y={40} text="Sürüklenme mesafesi (yerde)" fontSize={11} fontFamily="Inter" fill="#ccc" />

                <Rect x={16} y={60} width={10} height={2} fill="#E53935" />
                <Text x={30} y={56} text="Çarpma / yere düşüş hızı" fontSize={11} fontFamily="Inter" fill="#ccc" />

                <Rect x={16} y={76} width={10} height={2} fill="#FFD600" />
                <Text x={30} y={72} text="Maksimum yükseklik" fontSize={11} fontFamily="Inter" fill="#ccc" />

                <Rect x={16} y={92} width={10} height={2} fill="#64B5F6" strokeWidth={0} />
                <Text x={30} y={88} text="Uçuş süresi / Yaya bilgisi" fontSize={11} fontFamily="Inter" fill="#ccc" />
              </Group>

              {/* Değerlendirme */}
              <Group>
                <Rect x={10} y={118} width={190} height={52}
                  fill="#1a1a1a" cornerRadius={6} opacity={0.88} stroke="#444" strokeWidth={1} />
                <Text x={16} y={122} text="DEĞERLENDİRME" fontSize={10} fontFamily="Inter" fontStyle="bold" fill="#F5C518" />
                <Text x={16} y={136} text={`${Math.round(launchData.vehicleSpeed)} km/h`} fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#fff" />
                <Text x={16} y={152} text={`Uçuş ${launchData.flightDistance.toFixed(1)}m → Sür. ${launchData.slideDistance.toFixed(1)}m`}
                  fontSize={10} fontFamily="Inter" fill="#ccc" />
              </Group>

              {/* Top-right data panel — left-aligned in row boxes */}
              <Group>
                <Rect x={STAGE_W - 260} y={8} width={250} height={220}
                  fill="#1a1a1a" cornerRadius={8} opacity={0.92} stroke="#444" strokeWidth={1.5} />
                <Text x={STAGE_W - 252} y={14} text="VERİLER" fontSize={12} fontFamily="Inter" fontStyle="bold" fill="#F5C518" />

                <Rect x={STAGE_W - 255} y={32} width={240} height={24} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 250} y={35} text={`Araç Hızı: ${Math.round(launchData.vehicleSpeed)} km/h`}
                  fontSize={15} fontFamily="Inter" fontStyle="bold" fill="#fff" />

                <Rect x={STAGE_W - 255} y={58} width={240} height={24} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 250} y={61} text={`Uçuş: ${launchData.flightDistance.toFixed(1)}m`}
                  fontSize={14} fontFamily="Inter" fontStyle="bold" fill="#64B5F6" />

                <Rect x={STAGE_W - 255} y={84} width={240} height={24} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 250} y={87} text={`Sürüklenme: ${launchData.slideDistance.toFixed(2)}m`}
                  fontSize={14} fontFamily="Inter" fontStyle="bold" fill="#FF8A65" />

                <Rect x={STAGE_W - 255} y={110} width={240} height={24} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 250} y={113} text={`Çarpma Hızı: ${Math.round(launchData.landingSpeed)} km/h`}
                  fontSize={14} fontFamily="Inter" fontStyle="bold" fill="#fff" />

                <Rect x={STAGE_W - 255} y={136} width={240} height={24} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 250} y={139} text={`Süre: ${launchData.flightTime.toFixed(2)}sn`}
                  fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#e0e0e0" />

                <Rect x={STAGE_W - 255} y={162} width={240} height={24} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 250} y={165} text={`Maks. Yük.: ${launchData.maxHeight.toFixed(2)}m`}
                  fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#FFD600" />

                <Rect x={STAGE_W - 255} y={188} width={240} height={24} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 250} y={191} text={`Yaya ${launchData.pedestrianHeight}cm / ${launchData.pedestrianWeight}kg · ${stateLabel}`}
                  fontSize={12} fontFamily="Inter" fontStyle="bold" fill="#bbb" />
              </Group>
            </Layer>
          </Stage>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#1f1f1f] border-t border-[#2a2a2a] shrink-0">
          <div className="flex items-center gap-2">
            {isPlaying ? (
              <button onClick={handlePause} className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition-all">
                <Square size={14} /> DURAKLAT
              </button>
            ) : (
              <button onClick={handlePlay} className="flex items-center gap-1.5 px-3 py-2 bg-[#F5C518] hover:bg-[#E2B616] text-black text-xs font-bold rounded-lg transition-all">
                <Play size={14} /> BAŞLAT
              </button>
            )}
            <button onClick={handleStop} className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
              <RotateCcw size={14} /> DURDUR
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-[#111] border border-[#333] rounded-lg px-2 py-1">
              {[0.25, 0.5, 1, 2, 4].map(s => (
                <button key={s} onClick={() => handleSpeedChange(s)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${speed === s ? 'bg-[#F5C518] text-black' : 'text-gray-500 hover:text-white'}`}>
                  {s}x
                </button>
              ))}
            </div>
            <button onClick={handleToggleLoop}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${loop ? 'bg-[#F5C518]/10 border-[#F5C518]/40 text-[#F5C518]' : 'border-[#333] text-gray-500 hover:text-white'}`}>
              DÖNGÜ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
