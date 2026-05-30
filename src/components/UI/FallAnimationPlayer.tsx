import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Line, Circle, Group, Star } from 'react-konva';
import { X, Play, Square, RotateCcw } from 'lucide-react';
import { useStore } from '../../store/useStore';

const HUMAN_WIDTH = 20;
const HUMAN_HEIGHT = 40;
const STAGE_W = 800;
const STAGE_H = 500;
const PADDING = 40;

interface FallAnimationPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

function getFallState(time: number, duration: number): {
  x: number;
  y: number;
  rotation: number;
  isImpact: boolean;
  opacity: number;
} {
  // Simple fall trajectory: start at top, fall to ground with slight arc
  const progress = Math.min(time / duration, 1);
  
  // Starting position: near top of screen
  const startX = STAGE_W / 2;
  const startY = PADDING + 20;
  
  // Ending position: on ground, slightly offset
  const endX = STAGE_W / 2 + 50; // offset for realistic fall
  const endY = STAGE_H - PADDING - 20;
  
  // Simple parabolic trajectory
  const x = startX + (endX - startX) * progress;
  const y = startY + (endY - startY) * progress + 20 * Math.sin(progress * Math.PI);
  
  // Slight rotation during fall
  const rotation = 15 * Math.sin(progress * Math.PI);
  
  // Impact detection (last 10% of animation)
  const isImpact = progress > 0.9;
  
  // Opacity: full except during impact flash
  const opacity = isImpact && Math.floor(progress * 20) % 2 === 0 ? 0.3 : 1;
  
  return { x, y, rotation, isImpact, opacity };
}

export const FallAnimationPlayer: React.FC<FallAnimationPlayerProps> = ({ isOpen, onClose }) => {
  const store = useStore();
  const { fallAnimation } = store;
  const { isPlaying, currentTime, speed, loop } = fallAnimation;
  
  // Calculate duration from fall time in calculator
  const duration = store.fallAnimation?.duration ?? 2; // fallback to 2 seconds
  const fallState = getFallState(currentTime, duration);
  
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const [impactFlash, setImpactFlash] = useState(false);
  
  const handlePlay = useCallback(() => {
    store.setFallAnimation({ isPlaying: true, currentTime: 0 });
  }, [store]);
  
  const handlePause = useCallback(() => {
    store.setFallAnimation({ isPlaying: false });
  }, [store]);
  
  const handleStop = useCallback(() => {
    store.setFallAnimation({ isPlaying: false, currentTime: 0 });
  }, [store]);
  
  const handleSpeedChange = useCallback((newSpeed: number) => {
    store.setFallAnimation({ speed: newSpeed });
  }, [store]);
  
  const handleToggleLoop = useCallback(() => {
    store.setFallAnimation({ loop: !fallAnimation.loop });
  }, [store, fallAnimation.loop]);
  
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
      
      const deltaSec = deltaMs / 1000;
      const prevTime = timeRef.current;
      const newTime = Math.min(prevTime + deltaSec, duration);
      timeRef.current = newTime;
      
      // Impact flash detection
      const wasUnderImpact = prevTime / duration <= 0.9;
      const isUnderImpact = newTime / duration > 0.9;
      
      if (!wasUnderImpact && isUnderImpact) {
        setImpactFlash(true);
        setTimeout(() => setImpactFlash(false), 150);
      }
      
      store.setFallAnimation({ currentTime: newTime });
      
      if (newTime >= duration) {
        if (loop) {
          timeRef.current = 0;
          lastTimeRef.current = 0;
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        } else {
          store.setFallAnimation({ isPlaying: false });
          return;
        }
      }
      
      animFrameRef.current = requestAnimationFrame(animate);
    };
    
    animFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, speed, loop, duration, store]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden w-[900px] max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] bg-[#1f1f1f] shrink-0">
          <h3 className="text-sm font-bold text-gray-100 tracking-wide uppercase">Düşme Animasyonu</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-md transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        
        {/* Konva Stage */}
        <div className="relative bg-[#111] flex items-center justify-center p-3">
          <Stage width={STAGE_W} height={STAGE_H} className="rounded-lg border border-[#333]">
            <Layer>
              {/* Background */}
              <Rect x={0} y={0} width={STAGE_W} height={STAGE_H} fill="#f8f4f0" />
              
              {/* Scene elements */}
              <Group>
                {/* Building */}
                <Rect
                  x={STAGE_W / 2 - 30}
                  y={PADDING}
                  width={60}
                  height={STAGE_H - 2 * PADDING}
                  fill="#e0e0e0"
                  stroke="#888"
                  strokeWidth={2}
                />
                
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
                    PADDING + 20,
                    STAGE_W / 2 + 30,
                    STAGE_H - PADDING - 20
                  ]}
                  stroke="#E53935"
                  strokeWidth={2}
                  dash={[6, 4]}
                />
                
                {/* Impact marker */}
                <Star
                  x={STAGE_W / 2 + 30}
                  y={STAGE_H - PADDING - 20}
                  numPoints={5}
                  innerRadius={4}
                  outerRadius={8}
                  fill={impactFlash ? '#FFD600' : '#FF5722'}
                  stroke="#fff"
                  strokeWidth={1.5}
                  opacity={0.8}
                />
                
                {/* Human figure */}
                <Group x={fallState.x} y={fallState.y} rotation={fallState.rotation} opacity={fallState.opacity}>
                  <Circle
                    x={0}
                    y={0}
                    r={HUMAN_WIDTH / 2}
                    fill="#1565C0"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                  <Line
                    points={[
                      0, -HUMAN_WIDTH / 2,
                      0, -HUMAN_HEIGHT / 2 + 5
                    ]}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                  <Line
                    points={[
                      -HUMAN_WIDTH / 3, -HUMAN_HEIGHT / 3,
                      HUMAN_WIDTH / 3, -HUMAN_HEIGHT / 3
                    ]}
                    stroke="#fff"
                    strokeWidth={1.5}
                  />
                  <Line
                    points={[
                      0, -HUMAN_HEIGHT / 4,
                      -HUMAN_WIDTH / 4, 0
                    ]}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                  <Line
                    points={[
                      0, -HUMAN_HEIGHT / 4,
                      HUMAN_WIDTH / 4, 0
                    ]}
                    stroke="#fff"
                    strokeWidth={1}
                  />
                </Group>
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