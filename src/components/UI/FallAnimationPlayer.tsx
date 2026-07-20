import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Line, Circle, Group, Star, Text, Ellipse } from 'react-konva';
import { X, Play, Square, RotateCcw } from 'lucide-react';
import { useStore } from '../../store/useStore';

const HUMAN_W = 24;
const HUMAN_H = 48;
const HUMAN_SHOULDER_W = 34;
const STAGE_W = 960;
const STAGE_H = 620;
const PADDING = 50;
const INLINE_W = 340;
const INLINE_H = 400;
const INLINE_PADDING = 35;

interface FallData {
  height: number;
  distance: number;
  velocity: number;
  impactVelocity: number;
  impactEnergy: number;
  time: number;
  weight: number;
  useDrag: boolean;
}

interface FallAnimationPlayerProps {
  isOpen: boolean;
  onClose?: () => void;
  fallData: FallData;
  inline?: boolean;
}

function getFallState(time: number, duration: number, stageW: number, stageH: number, pad: number, pDistance: number = 0): {
  x: number;
  y: number;
  rotation: number;
  isImpact: boolean;
  opacity: number;
  progress: number;
} {
  const progress = Math.min(time / duration, 1);
  
  const startX = stageW / 2;
  const startY = pad + 20;
  const maxDistPx = Math.min(stageW * 0.35, Math.max(30, pDistance * 5));
  const endX = startX + maxDistPx;
  const endY = stageH - pad - 20;
  
  const x = startX + (endX - startX) * progress;
  const y = startY + (endY - startY) * progress + 20 * Math.sin(progress * Math.PI);
  const rotation = 15 * Math.sin(progress * Math.PI);
  const isImpact = progress > 0.9;
  const opacity = isImpact && Math.floor(progress * 20) % 2 === 0 ? 0.3 : 1;
  
  return { x, y, rotation, isImpact, opacity, progress };
}

export const FallAnimationPlayer: React.FC<FallAnimationPlayerProps> = ({ isOpen, onClose, fallData, inline }) => {
  // Use individual selectors to avoid full-store re-renders on every frame
  const isPlaying = useStore((s) => s.fallAnimation.isPlaying);
  const currentTime = useStore((s) => s.fallAnimation.currentTime);
  const speed = useStore((s) => s.fallAnimation.speed);
  const loop = useStore((s) => s.fallAnimation.loop);
  const duration = useStore((s) => s.fallAnimation.duration ?? 2);
  
  const stageW = inline ? INLINE_W : STAGE_W;
  const stageH = inline ? INLINE_H : STAGE_H;
  const pad = inline ? INLINE_PADDING : PADDING;
  
  const maxDistPx = Math.min(stageW * 0.35, Math.max(30, fallData.distance * 5));
  const trajEndX = stageW / 2 + maxDistPx;
  const groundY = stageH - pad - 20;
  
  // Get non-reactive store action via ref to keep callbacks stable
  const setFallAnimationRef = useRef(useStore.getState().setFallAnimation);
  
  useEffect(() => {
    setFallAnimationRef.current = useStore.getState().setFallAnimation;
  });
  
  const stageRef = useRef<any>(null);
  const fallState = getFallState(currentTime, duration, stageW, stageH, pad, fallData.distance);
  
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const [impactFlash, setImpactFlash] = useState(false);
  
  // Autostart only when modal opens
  useEffect(() => {
    if (isOpen && !inline) {
      setFallAnimationRef.current({ isPlaying: true, currentTime: 0 });
      setImpactFlash(false);
    }
  }, [isOpen, inline]);
  
  const handlePlay = useCallback(() => {
    setFallAnimationRef.current({ isPlaying: true, currentTime: 0 });
  }, []);
  
  const handlePause = useCallback(() => {
    setFallAnimationRef.current({ isPlaying: false });
  }, []);
  
  const handleStop = useCallback(() => {
    setFallAnimationRef.current({ isPlaying: false, currentTime: 0 });
  }, []);
  
  const handleSpeedChange = useCallback((newSpeed: number) => {
    setFallAnimationRef.current({ speed: newSpeed });
  }, []);
  
  const handleToggleLoop = useCallback(() => {
    setFallAnimationRef.current({ loop: !loop });
  }, [loop]);
  
  // Animation loop — stable deps, no full-store subscription
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
      
      const deltaSec = deltaMs / 1000 * speed;
      const prevTime = timeRef.current;
      const newTime = Math.min(prevTime + deltaSec, duration);
      timeRef.current = newTime;
      
      const wasUnderImpact = prevTime / duration <= 0.9;
      const isUnderImpact = newTime / duration > 0.9;
      
      if (!wasUnderImpact && isUnderImpact) {
        setImpactFlash(true);
        setTimeout(() => setImpactFlash(false), 150);
      }
      
      useStore.getState().setFallAnimation({ currentTime: newTime });
      
      if (newTime >= duration) {
        if (loop) {
          timeRef.current = 0;
          lastTimeRef.current = 0;
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        } else {
          useStore.getState().setFallAnimation({ isPlaying: false });
          return;
        }
      }
      
      animFrameRef.current = requestAnimationFrame(animate);
    };
    
    animFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, speed, loop, duration]);
  
  const handleSaveVideo = useCallback(async () => {
    if (!stageRef.current) return;
    const stageContainer = stageRef.current.getContent();
    const canvasEl = stageContainer.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvasEl || typeof MediaRecorder === 'undefined') return;
    
    setFallAnimationRef.current({ currentTime: 0, isPlaying: true, speed: 1, loop: false });
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
        suggestedName: `dusme-animasyonu-${fallData.height}m.${ext}`,
        types: [{ description: isMp4 ? 'MP4 Video' : 'WebM Video', accept: { [baseMimeType]: [`.${ext}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `dusme-animasyonu-${fallData.height}m.${ext}`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, [fallData.height, duration]);
  
  const progress = fallState.progress;
  
  // Inline: always visible
  // Modal: hide when not open
  if (!inline && !isOpen) return null;
  
  if (inline) {
    return (
      <div className="flex flex-col">
        <div className="bg-[#111] rounded-xl border border-[#333] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-[#1f1f1f] border-b border-[#2a2a2a]">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Düşme Animasyonu</span>
            <div className="flex items-center gap-1.5">
              <button onClick={handlePlay} className="flex items-center gap-1 px-2 py-1 bg-[#F5C518] hover:bg-[#E2B616] text-black text-[9px] font-bold rounded transition-all"><Play size={11} /> BAŞLAT</button>
            </div>
          </div>
          <div className="flex items-center justify-center p-1">
            <Stage ref={stageRef} width={stageW} height={stageH} className="rounded border border-[#333]">
              <Layer>
                <Rect x={0} y={0} width={stageW} height={stageH} fill="#f8f4f0" />
                <Group>
                  <Group>
                    {/* Building ground shadow */}
                    <Ellipse x={stageW / 2} y={stageH - pad + 2} radiusX={42} radiusY={5} fill="#000" opacity={0.12} />
                    {/* Building shadow */}
                    <Rect x={stageW / 2 - 28} y={pad + 4} width={64} height={stageH - 2 * pad} fill="#000" opacity={0.08} cornerRadius={2} />
                    {/* Main building body */}
                    <Rect x={stageW / 2 - 30} y={pad} width={60} height={stageH - 2 * pad} fill="#c8c8c8" stroke="#777" strokeWidth={2} cornerRadius={2} />
                    {/* Right side panel (3D depth) */}
                    <Rect x={stageW / 2 + 24} y={pad} width={6} height={stageH - 2 * pad} fill="#a0a0a0" stroke="#777" strokeWidth={1} />
                    {/* Vertical center divider */}
                    <Line points={[stageW / 2, pad, stageW / 2, stageH - pad]} stroke="#aaa" strokeWidth={0.5} opacity={0.4} />
                    {/* Parapet lower */}
                    <Rect x={stageW / 2 - 34} y={pad - 4} width={68} height={8} fill="#777" stroke="#555" strokeWidth={1} cornerRadius={1} />
                    {/* Parapet upper */}
                    <Rect x={stageW / 2 - 36} y={pad - 8} width={72} height={6} fill="#888" stroke="#666" strokeWidth={1} cornerRadius={1} />
                    {/* Parapet top accent */}
                    <Rect x={stageW / 2 - 30} y={pad - 12} width={60} height={5} fill="#999" stroke="#777" strokeWidth={0.8} cornerRadius={1} />
                    {/* Floor separator lines + ledges */}
                    {Array.from({ length: 7 }, (_, i) => (
                      <React.Fragment key={`fl-${i}`}>
                        <Line points={[stageW / 2 - 28, pad + 45 + i * 42, stageW / 2 + 28, pad + 45 + i * 42]} stroke="#999" strokeWidth={0.5} opacity={0.6} />
                        <Rect x={stageW / 2 - 30} y={pad + 44 + i * 42} width={60} height={1.5} fill="#aaa" opacity={0.5} />
                      </React.Fragment>
                    ))}
                    {/* Windows - 2 columns alternating */}
                    {Array.from({ length: 7 }, (_, i) => (
                      <React.Fragment key={`rw-${i}`}>
                        <Rect x={stageW / 2 - 22} y={pad + 10 + i * 42} width={12} height={30} fill="#b8d4e8" stroke="#999" strokeWidth={0.8} cornerRadius={1} opacity={i % 2 === 0 ? 1 : 0.8} />
                        <Rect x={stageW / 2 + 10} y={pad + 10 + i * 42} width={12} height={30} fill="#b8d4e8" stroke="#999" strokeWidth={0.8} cornerRadius={1} opacity={i % 2 === 1 ? 1 : 0.8} />
                        <Line points={[stageW / 2 - 20, pad + 12 + i * 42, stageW / 2 - 14, pad + 12 + i * 42]} stroke="#fff" strokeWidth={1} opacity={0.3} />
                        <Line points={[stageW / 2 + 12, pad + 12 + i * 42, stageW / 2 + 18, pad + 12 + i * 42]} stroke="#fff" strokeWidth={1} opacity={0.3} />
                      </React.Fragment>
                    ))}
                    {/* Floor gradient overlay */}
                    <Rect x={stageW / 2 - 30} y={stageH - pad - 80} width={60} height={80} fill="#000" opacity={0.06} />
                    {/* Door */}
                    <Rect x={stageW / 2 - 7} y={stageH - pad - 38} width={14} height={38} fill="#5c3a1e" stroke="#3a2210" strokeWidth={1.5} cornerRadius={1} />
                    <Rect x={stageW / 2 - 8} y={stageH - pad - 40} width={16} height={2} fill="#3a2210" />
                    <Circle x={stageW / 2 + 4} y={stageH - pad - 20} radius={1.5} fill="#F5C518" />
                    <Line points={[stageW / 2 - 32, stageH - pad, stageW / 2 + 32, stageH - pad]} stroke="#666" strokeWidth={3} lineCap="round" />
                  </Group>
                  <Line points={[pad, stageH - pad, stageW - pad, stageH - pad]} stroke="#666" strokeWidth={6} lineCap="round" />
                  <Line points={[stageW / 2, pad + 20, trajEndX, groundY]} stroke="#E53935" strokeWidth={2} dash={[6, 4]} />
                  <Line points={[stageW / 2 - 50, pad + 5, stageW / 2 - 50, groundY]} stroke="#1565C0" strokeWidth={1.5} dash={[4, 3]} />
                  <Line points={[stageW / 2 - 55, pad + 5, stageW / 2 - 45, pad + 5]} stroke="#1565C0" strokeWidth={1.5} />
                  <Line points={[stageW / 2 - 55, groundY, stageW / 2 - 45, groundY]} stroke="#1565C0" strokeWidth={1.5} />
                  <Text x={stageW / 2 - 80} y={stageH / 2 - 10} text={`${fallData.height}m`} fontSize={12} fontFamily="Inter" fontStyle="bold" fill="#1565C0" align="center" width={30} />
                  <Line points={[stageW / 2, stageH - pad + 15, trajEndX, stageH - pad + 15]} stroke="#E53935" strokeWidth={1.5} dash={[4, 3]} />
                  <Line points={[stageW / 2, stageH - pad + 10, stageW / 2, stageH - pad + 20]} stroke="#E53935" strokeWidth={1.5} />
                  <Line points={[trajEndX, stageH - pad + 10, trajEndX, stageH - pad + 20]} stroke="#E53935" strokeWidth={1.5} />
                  <Text x={trajEndX + 10} y={stageH - pad + 17} text={`${fallData.distance.toFixed(1)}m`} fontSize={11} fontFamily="Inter" fontStyle="bold" fill="#E53935" />
                  <Star x={trajEndX} y={groundY} numPoints={5} innerRadius={4} outerRadius={8} fill={impactFlash ? '#FFD600' : '#FF5722'} stroke="#fff" strokeWidth={1.5} opacity={0.8} />
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
                </Group>
                <Group>
                  <Rect x={stageW - 160} y={stageH - 140} width={150} height={130} fill="#1a1a1a" cornerRadius={6} opacity={0.85} stroke="#333" strokeWidth={1} />
                  <Text x={stageW - 153} y={stageH - 132} text="ANİMASYON VERİLERİ" fontSize={9} fontFamily="Inter" fontStyle="bold" fill="#F5C518" />
                  <Text x={stageW - 153} y={stageH - 116} text={`Yükseklik: ${fallData.height}m`} fontSize={12} fontFamily="Inter" fontStyle="bold" fill="#ccc" />
                  <Text x={stageW - 153} y={stageH - 100} text={`Mesafe: ${fallData.distance.toFixed(2)}m`} fontSize={12} fontFamily="Inter" fontStyle="bold" fill="#ccc" />
                  <Text x={stageW - 153} y={stageH - 84} text={`Çarpma Hızı: ${Math.round(fallData.impactVelocity)} km/h`} fontSize={12} fontFamily="Inter" fontStyle="bold" fill="#E53935" />
                  <Text x={stageW - 153} y={stageH - 68} text={`Süre: ${fallData.time.toFixed(2)}sn`} fontSize={12} fontFamily="Inter" fontStyle="bold" fill="#ccc" />
                  <Text x={stageW - 153} y={stageH - 52} text={`Enerji: ${Math.round(fallData.impactEnergy)} J`} fontSize={12} fontFamily="Inter" fontStyle="bold" fill="#F5C518" />
                  <Text x={stageW - 153} y={stageH - 36} text={`${fallData.weight}kg | Hava: ${fallData.useDrag ? 'Dahil' : 'Hariç'}`} fontSize={10} fontFamily="Inter" fontStyle="bold" fill="#888" />
                </Group>
                <Group>
                  <Rect x={pad - 10} y={pad - 10} width={100} height={24} fill="#1a1a1a" cornerRadius={5} opacity={0.8} stroke="#333" strokeWidth={1} />
                  <Text x={pad - 5} y={pad - 4} text={`${fallData.height}m DÜŞME`} fontSize={8} fontFamily="Inter" fontStyle="bold" fill="#fff" />
                </Group>
              </Layer>
            </Stage>
          </div>
        </div>
        <div className="flex items-center justify-between px-1 py-2">
          <div className="flex items-center gap-1">
            {isPlaying ? (
              <button onClick={handlePause} className="flex items-center gap-1 px-2 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-[9px] font-bold rounded transition-all"><Square size={11} /> DURAKLAT</button>
            ) : (
              <button onClick={handlePlay} className="flex items-center gap-1 px-2 py-1.5 bg-[#F5C518] hover:bg-[#E2B616] text-black text-[9px] font-bold rounded transition-all"><Play size={11} /> BAŞLAT</button>
            )}
            <button onClick={handleStop} className="px-2 py-1.5 text-[9px] font-bold text-gray-400 hover:text-white transition-colors"><RotateCcw size={11} /> DURDUR</button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5 bg-[#111] border border-[#333] rounded px-1.5 py-1">
              {[0.5, 1, 2].map(s => (
                <button key={s} onClick={() => handleSpeedChange(s)} className={`px-1.5 py-0.5 text-[8px] font-bold rounded transition-all ${speed === s ? 'bg-[#F5C518] text-black' : 'text-gray-500 hover:text-white'}`}>{s}x</button>
              ))}
            </div>
            <button onClick={handleToggleLoop} className={`px-2 py-1 text-[8px] font-bold rounded border transition-all ${loop ? 'bg-[#F5C518]/10 border-[#F5C518]/40 text-[#F5C518]' : 'border-[#333] text-gray-500 hover:text-white'}`}>DÖNGÜ</button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col overflow-y-auto overflow-x-hidden w-[1060px] max-w-[95vw] max-h-[95vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] bg-[#1f1f1f] shrink-0">
          <h3 className="text-sm font-bold text-gray-100 tracking-wide uppercase">Düşme Animasyonu</h3>
          <div className="flex items-center gap-2">
            <button onClick={handlePlay} className="flex items-center gap-1 px-3 py-1.5 bg-[#F5C518] hover:bg-[#E2B616] text-black text-[10px] font-bold rounded-md transition-all shadow-sm"><Play size={13} /> BAŞLAT</button>
            <button onClick={handleSaveVideo} className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-gray-400 hover:text-white border border-[#333] hover:border-gray-500 rounded-md transition-all">KAYDET</button>
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-md transition-all"><X size={18} /></button>
          </div>
        </div>
        
        <div className="relative bg-[#111] flex items-center justify-center p-3">
          <Stage ref={stageRef} width={STAGE_W} height={STAGE_H} className="rounded-lg border border-[#333]">
            <Layer>
              {/* Background */}
              <Rect x={0} y={0} width={STAGE_W} height={STAGE_H} fill="#f8f4f0" />
              
              {/* Scene elements */}
              <Group>
                <Group>
                  {/* Building ground shadow */}
                  <Ellipse
                    x={STAGE_W / 2}
                    y={STAGE_H - pad + 2}
                    radiusX={48}
                    radiusY={6}
                    fill="#000"
                    opacity={0.12}
                  />
                  {/* Building shadow */}
                  <Rect
                    x={STAGE_W / 2 - 28}
                    y={pad + 4}
                    width={64}
                    height={STAGE_H - 2 * pad}
                    fill="#000"
                    opacity={0.08}
                    cornerRadius={2}
                  />
                  {/* Main building body */}
                  <Rect
                    x={STAGE_W / 2 - 30}
                    y={pad}
                    width={60}
                    height={STAGE_H - 2 * pad}
                    fill="#c8c8c8"
                    stroke="#777"
                    strokeWidth={2}
                    cornerRadius={2}
                  />
                  {/* Right side panel (3D depth - darker) */}
                  <Rect
                    x={STAGE_W / 2 + 24}
                    y={pad}
                    width={6}
                    height={STAGE_H - 2 * pad}
                    fill="#a0a0a0"
                    stroke="#777"
                    strokeWidth={1}
                  />
                  {/* Vertical center divider */}
                  <Line
                    points={[STAGE_W / 2, pad, STAGE_W / 2, STAGE_H - pad]}
                    stroke="#aaa"
                    strokeWidth={0.5}
                    opacity={0.4}
                  />
                  {/* Parapet lower */}
                  <Rect
                    x={STAGE_W / 2 - 34}
                    y={pad - 4}
                    width={68}
                    height={8}
                    fill="#777"
                    stroke="#555"
                    strokeWidth={1}
                    cornerRadius={1}
                  />
                  {/* Parapet upper */}
                  <Rect
                    x={STAGE_W / 2 - 36}
                    y={pad - 8}
                    width={72}
                    height={6}
                    fill="#888"
                    stroke="#666"
                    strokeWidth={1}
                    cornerRadius={1}
                  />
                  {/* Parapet top accent */}
                  <Rect
                    x={STAGE_W / 2 - 30}
                    y={pad - 12}
                    width={60}
                    height={5}
                    fill="#999"
                    stroke="#777"
                    strokeWidth={0.8}
                    cornerRadius={1}
                  />
                  {/* Floor separator lines + ledges */}
                  {Array.from({ length: 9 }, (_, i) => (
                    <React.Fragment key={`floor-${i}`}>
                      <Line
                        points={[
                          STAGE_W / 2 - 28,
                          pad + 45 + i * 42,
                          STAGE_W / 2 + 28,
                          pad + 45 + i * 42,
                        ]}
                        stroke="#999"
                        strokeWidth={0.5}
                        opacity={0.6}
                      />
                      <Rect
                        x={STAGE_W / 2 - 30}
                        y={pad + 44 + i * 42}
                        width={60}
                        height={1.5}
                        fill="#aaa"
                        opacity={0.5}
                      />
                    </React.Fragment>
                  ))}
                  {/* Windows - 2 columns alternating rows */}
                  {Array.from({ length: 9 }, (_, i) => (
                    <React.Fragment key={`row-${i}`}>
                      <Rect
                        x={STAGE_W / 2 - 22}
                        y={pad + 10 + i * 42}
                        width={12}
                        height={30}
                        fill="#b8d4e8"
                        stroke="#999"
                        strokeWidth={0.8}
                        cornerRadius={1}
                        opacity={i % 2 === 0 ? 1 : 0.8}
                      />
                      <Rect
                        x={STAGE_W / 2 + 10}
                        y={pad + 10 + i * 42}
                        width={12}
                        height={30}
                        fill="#b8d4e8"
                        stroke="#999"
                        strokeWidth={0.8}
                        cornerRadius={1}
                        opacity={i % 2 === 1 ? 1 : 0.8}
                      />
                      <Line
                        points={[
                          STAGE_W / 2 - 20,
                          pad + 12 + i * 42,
                          STAGE_W / 2 - 14,
                          pad + 12 + i * 42,
                        ]}
                        stroke="#fff"
                        strokeWidth={1}
                        opacity={0.3}
                      />
                      <Line
                        points={[
                          STAGE_W / 2 + 12,
                          pad + 12 + i * 42,
                          STAGE_W / 2 + 18,
                          pad + 12 + i * 42,
                        ]}
                        stroke="#fff"
                        strokeWidth={1}
                        opacity={0.3}
                      />
                    </React.Fragment>
                  ))}
                  {/* Floor gradient overlay (bottom darker) */}
                  <Rect
                    x={STAGE_W / 2 - 30}
                    y={STAGE_H - pad - 80}
                    width={60}
                    height={80}
                    fill="#000"
                    opacity={0.06}
                  />
                  {/* Door */}
                  <Rect
                    x={STAGE_W / 2 - 7}
                    y={STAGE_H - pad - 38}
                    width={14}
                    height={38}
                    fill="#5c3a1e"
                    stroke="#3a2210"
                    strokeWidth={1.5}
                    cornerRadius={1}
                  />
                  <Rect
                    x={STAGE_W / 2 - 8}
                    y={STAGE_H - pad - 40}
                    width={16}
                    height={2}
                    fill="#3a2210"
                  />
                  <Circle
                    x={STAGE_W / 2 + 4}
                    y={STAGE_H - pad - 20}
                    radius={1.5}
                    fill="#F5C518"
                  />
                  {/* Building base line */}
                  <Line
                    points={[
                      STAGE_W / 2 - 32,
                      STAGE_H - pad,
                      STAGE_W / 2 + 32,
                      STAGE_H - pad,
                    ]}
                    stroke="#666"
                    strokeWidth={3}
                    lineCap="round"
                  />
                </Group>
                
                {/* Ground */}
                <Line
                  points={[PADDING, STAGE_H - PADDING, STAGE_W - PADDING, STAGE_H - PADDING]}
                  stroke="#666"
                  strokeWidth={6}
                  lineCap="round"
                />
                
                {/* Fall trajectory (dashed line) */}
                <Line
                  points={[
                    STAGE_W / 2,
                    pad + 20,
                    trajEndX,
                    groundY
                  ]}
                  stroke="#E53935"
                  strokeWidth={2}
                  dash={[6, 4]}
                />

                <Line
                  points={[STAGE_W / 2 - 50, pad + 5, STAGE_W / 2 - 50, groundY]}
                  stroke="#1565C0"
                  strokeWidth={1.5}
                  dash={[4, 3]}
                />
                <Line
                  points={[STAGE_W / 2 - 55, pad + 5, STAGE_W / 2 - 45, pad + 5]}
                  stroke="#1565C0"
                  strokeWidth={1.5}
                />
                <Line
                  points={[STAGE_W / 2 - 55, groundY, STAGE_W / 2 - 45, groundY]}
                  stroke="#1565C0"
                  strokeWidth={1.5}
                />
                <Text
                  x={STAGE_W / 2 - 80}
                  y={STAGE_H / 2 - 10}
                  text={`${fallData.height}m`}
                  fontSize={12}
                  fontFamily="Inter"
                  fontStyle="bold"
                  fill="#1565C0"
                  align="center"
                  width={30}
                />

                <Line
                  points={[STAGE_W / 2, STAGE_H - pad + 15, trajEndX, STAGE_H - pad + 15]}
                  stroke="#E53935"
                  strokeWidth={1.5}
                  dash={[4, 3]}
                />
                <Line
                  points={[STAGE_W / 2, STAGE_H - pad + 10, STAGE_W / 2, STAGE_H - pad + 20]}
                  stroke="#E53935"
                  strokeWidth={1.5}
                />
                <Line
                  points={[trajEndX, STAGE_H - pad + 10, trajEndX, STAGE_H - pad + 20]}
                  stroke="#E53935"
                  strokeWidth={1.5}
                />
                <Text
                  x={trajEndX + 10}
                  y={STAGE_H - pad + 17}
                  text={`${fallData.distance.toFixed(1)}m`}
                  fontSize={11}
                  fontFamily="Inter"
                  fontStyle="bold"
                  fill="#E53935"
                />
                
                {/* Impact marker */}
                <Star
                  x={trajEndX}
                  y={groundY}
                  numPoints={5}
                  innerRadius={4}
                  outerRadius={8}
                  fill={impactFlash ? '#FFD600' : '#FF5722'}
                  stroke="#fff"
                  strokeWidth={1.5}
                  opacity={0.8}
                />
                
                {/* Falling human figure - realistic front-facing */}
                <Group x={fallState.x} y={fallState.y} rotation={fallState.rotation} opacity={fallState.opacity}>
                  {/* Shadow/glow below body */}
                  <Ellipse x={0} y={HUMAN_H * 0.15} radiusX={HUMAN_SHOULDER_W * 0.35} radiusY={HUMAN_H * 0.25} fill="#000" opacity={0.06} />
                  {/* Arms spread out in falling pose (skin color) */}
                  <Line points={[-HUMAN_SHOULDER_W * 0.45, -HUMAN_H * 0.12, -HUMAN_SHOULDER_W * 0.15, HUMAN_H * 0.02]} stroke="#e6c8a0" strokeWidth={4.5} lineCap="round" />
                  <Line points={[HUMAN_SHOULDER_W * 0.45, -HUMAN_H * 0.12, HUMAN_SHOULDER_W * 0.15, HUMAN_H * 0.02]} stroke="#e6c8a0" strokeWidth={4.5} lineCap="round" />
                  {/* Legs (dark blue pants) */}
                  <Line points={[-HUMAN_W * 0.15, HUMAN_H * 0.45, -HUMAN_W * 0.35, HUMAN_H * 0.85]} stroke="#1a3a6b" strokeWidth={5} lineCap="round" />
                  <Line points={[HUMAN_W * 0.15, HUMAN_H * 0.45, HUMAN_W * 0.35, HUMAN_H * 0.85]} stroke="#1a3a6b" strokeWidth={5} lineCap="round" />
                  {/* Shoes */}
                  <Ellipse x={-HUMAN_W * 0.35} y={HUMAN_H * 0.88} radiusX={4} radiusY={2.5} fill="#222" />
                  <Ellipse x={HUMAN_W * 0.35} y={HUMAN_H * 0.88} radiusX={4} radiusY={2.5} fill="#222" />
                  {/* Torso */}
                  <Rect x={-HUMAN_W * 0.33} y={-HUMAN_H * 0.12} width={HUMAN_W * 0.66} height={HUMAN_H * 0.55} fill="#1565C0" stroke="#0d47a1" strokeWidth={1.5} cornerRadius={3} />
                  {/* Torso center line */}
                  <Line points={[0, -HUMAN_H * 0.08, 0, HUMAN_H * 0.38]} stroke="#0d47a1" strokeWidth={1} opacity={0.4} />
                  {/* Collar */}
                  <Line points={[-5, -HUMAN_H * 0.12, 0, -HUMAN_H * 0.06, 5, -HUMAN_H * 0.12]} stroke="#0d47a1" strokeWidth={1.5} lineCap="round" />
                  {/* Head */}
                  <Circle x={0} y={-HUMAN_H * 0.24} r={HUMAN_W * 0.3} fill="#e6c8a0" stroke="#c4a882" strokeWidth={1.5} />
                  {/* Hair */}
                  <Ellipse x={0} y={-HUMAN_H * 0.3} radiusX={HUMAN_W * 0.27} radiusY={HUMAN_W * 0.12} fill="#3a2210" />
                  {/* Eyebrows */}
                  <Line points={[-5, -HUMAN_H * 0.24, -2, -HUMAN_H * 0.22]} stroke="#3a2210" strokeWidth={1.2} lineCap="round" />
                  <Line points={[5, -HUMAN_H * 0.24, 2, -HUMAN_H * 0.22]} stroke="#3a2210" strokeWidth={1.2} lineCap="round" />
                  {/* Eyes (front-facing) */}
                  <Circle x={-3.5} y={-HUMAN_H * 0.19} r={2} fill="#fff" />
                  <Circle x={3.5} y={-HUMAN_H * 0.19} r={2} fill="#fff" />
                  <Circle x={-3.5} y={-HUMAN_H * 0.19} r={1} fill="#333" />
                  <Circle x={3.5} y={-HUMAN_H * 0.19} r={1} fill="#333" />
                  {/* Nose */}
                  <Line points={[0, -HUMAN_H * 0.17, 0, -HUMAN_H * 0.13]} stroke="#c4a882" strokeWidth={1} lineCap="round" />
                  {/* Mouth (front-facing smile) */}
                  <Line points={[-3, -HUMAN_H * 0.1, 0, -HUMAN_H * 0.08, 3, -HUMAN_H * 0.1]} stroke="#b5786a" strokeWidth={1.2} lineCap="round" fill="#b5786a" />
                  {/* Motion / wind lines */}
                  {isPlaying && progress > 0.1 && progress < 0.85 && (
                    <>
                      <Line points={[HUMAN_SHOULDER_W * 0.65, -HUMAN_H * 0.3, HUMAN_SHOULDER_W * 0.65, -HUMAN_H * 0.55]} stroke="#aaa" strokeWidth={1.5} dash={[4, 4]} opacity={0.3} />
                      <Line points={[-HUMAN_SHOULDER_W * 0.65, -HUMAN_H * 0.2, -HUMAN_SHOULDER_W * 0.65, -HUMAN_H * 0.45]} stroke="#aaa" strokeWidth={1.5} dash={[4, 4]} opacity={0.3} />
                    </>
                  )}
                </Group>
              </Group>

              {/* Top-left legend */}
              <Group>
                <Rect x={PADDING} y={PADDING + 30} width={160} height={90}
                  fill="#1a1a1a" cornerRadius={6} opacity={0.88} stroke="#444" strokeWidth={1} />
                <Text x={PADDING + 6} y={PADDING + 34} text="GÖSTERGE" fontSize={11} fontFamily="Inter" fontStyle="bold" fill="#F5C518" />

                <Rect x={PADDING + 6} y={PADDING + 52} width={10} height={2} fill="#1565C0" />
                <Text x={PADDING + 20} y={PADDING + 48} text="Düşme yüksekliği" fontSize={11} fontFamily="Inter" fill="#ccc" />

                <Rect x={PADDING + 6} y={PADDING + 68} width={10} height={2} fill="#E53935" />
                <Text x={PADDING + 20} y={PADDING + 64} text="Düşüş yörüngesi" fontSize={11} fontFamily="Inter" fill="#ccc" />

                <Rect x={PADDING + 6} y={PADDING + 84} width={10} height={2} fill="#E53935" />
                <Text x={PADDING + 20} y={PADDING + 80} text="Yatay mesafe" fontSize={11} fontFamily="Inter" fill="#ccc" />

                <Rect x={PADDING + 6} y={PADDING + 100} width={10} height={2} fill="#FFD600" />
                <Text x={PADDING + 20} y={PADDING + 96} text="Çarpma noktası" fontSize={11} fontFamily="Inter" fill="#ccc" />
              </Group>

              {/* Değerlendirme */}
              <Group>
                <Rect x={PADDING} y={PADDING + 126} width={160} height={52}
                  fill="#1a1a1a" cornerRadius={6} opacity={0.88} stroke="#444" strokeWidth={1} />
                <Text x={PADDING + 6} y={PADDING + 130} text="DEĞERLENDİRME" fontSize={10} fontFamily="Inter" fontStyle="bold" fill="#F5C518" />
                <Text x={PADDING + 6} y={PADDING + 144} text={`${fallData.height}m → ${Math.round(fallData.impactVelocity)} km/h`}
                  fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#fff" />
                <Text x={PADDING + 6} y={PADDING + 160} text={`Mesafe ${fallData.distance.toFixed(1)}m · ${fallData.time.toFixed(2)}sn`}
                  fontSize={10} fontFamily="Inter" fill="#ccc" />
              </Group>

              {/* Top-right data panel */}
              <Group>
                <Rect
                  x={STAGE_W - 215} y={8}
                  width={200} height={185}
                  fill="#1a1a1a" cornerRadius={8} opacity={0.92} stroke="#444" strokeWidth={1.5}
                />
                <Text x={STAGE_W - 207} y={14} text="VERİLER" fontSize={12} fontFamily="Inter" fontStyle="bold" fill="#F5C518" />

                <Rect x={STAGE_W - 210} y={32} width={190} height={22} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 206} y={34} text={`Yükseklik: ${fallData.height}m`} fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#ccc" />

                <Rect x={STAGE_W - 210} y={58} width={190} height={22} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 206} y={60} text={`Yatay Mesafe: ${fallData.distance.toFixed(2)}m`} fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#ccc" />

                <Rect x={STAGE_W - 210} y={84} width={190} height={22} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 206} y={86} text={`Çarpma Hızı: ${Math.round(fallData.impactVelocity)} km/h`} fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#E53935" />

                <Rect x={STAGE_W - 210} y={110} width={190} height={22} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 206} y={112} text={`Düşüş Süresi: ${fallData.time.toFixed(2)}sn`} fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#ccc" />

                <Rect x={STAGE_W - 210} y={136} width={190} height={22} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 206} y={138} text={`Çarpma Enerjisi: ${Math.round(fallData.impactEnergy)} J`} fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#F5C518" />

                <Rect x={STAGE_W - 210} y={162} width={190} height={22} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 206} y={164} text={`${fallData.weight}kg · Hava: ${fallData.useDrag ? 'Dahil' : 'Hariç'}`} fontSize={12} fontFamily="Inter" fontStyle="bold" fill="#888" />
              </Group>

              {/* Top-left scene info */}
              <Group>
                <Rect
                  x={PADDING - 10}
                  y={PADDING - 10}
                  width={130}
                  height={32}
                  fill="#1a1a1a"
                  cornerRadius={6}
                  opacity={0.8}
                  stroke="#333"
                  strokeWidth={1}
                />
                <Text
                  x={PADDING - 4}
                  y={PADDING - 3}
                  text={`${fallData.height}m DÜŞME`}
                  fontSize={12}
                  fontFamily="Inter"
                  fontStyle="bold"
                  fill="#fff"
                />
              </Group>
            </Layer>
          </Stage>
        </div>
        
        {/* Controls */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1f1f1f] border-t border-[#2a2a2a] shrink-0">
          <div className="flex items-center gap-2">
            {isPlaying ? (
              <button
                onClick={handlePause}
                className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition-all"
              >
                <Square size={14} />
                DURAKLAT
              </button>
            ) : (
              <button
                onClick={handlePlay}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#F5C518] hover:bg-[#E2B616] text-black text-xs font-bold rounded-lg transition-all"
              >
                <Play size={14} />
                BAŞLAT
              </button>
            )}
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