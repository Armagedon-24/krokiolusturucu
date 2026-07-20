import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Line, Circle, Group, Text } from 'react-konva';
import { X, Play, Square, RotateCcw } from 'lucide-react';
import type { ShotDirectionData } from '../../types';

const STAGE_W = 960;
const STAGE_H = 620;
const PADDING = 50;

interface ShotDirectionAnimationPlayerProps {
  isOpen: boolean;
  onClose?: () => void;
  shotData: ShotDirectionData;
  inline?: boolean;
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function getTrajectoryPoints(
  entryX: number, entryY: number, entryZ: number,
  exitX: number, exitY: number, exitZ: number,
  stageW: number, stageH: number, pad: number
) {
  const horizDist = Math.sqrt((exitX - entryX) ** 2 + (exitY - entryY) ** 2);
  const horizDistSafe = Math.max(horizDist, 20);

  const EXT = 2.0; // extrapolate behind entry to show shooter position

  // Shooter Z extrapolated along the trajectory line
  const shooterZ = entryZ - (exitZ - entryZ) * EXT;

  // Collect all Z values for vertical centering (including ground at 0)
  const allZ = [shooterZ, entryZ, exitZ, 0];
  const minZ = Math.min(...allZ);
  const maxZ = Math.max(...allZ) + 30; // headroom above highest point
  const zRange = Math.max(maxZ - minZ, 100);

  // Total horizontal extent from shooter to exit
  const totalHorizExtent = horizDistSafe * (1 + EXT);

  // Available space (leave room for side panels)
  const availW = stageW - pad * 4;
  const availH = stageH - pad * 2.5;

  const scaleX = availW / (totalHorizExtent * 1.2);
  const scaleY = availH / (zRange * 1.15);
  const scale = Math.min(scaleX, scaleY, 3);

  // Center of the stage
  const cx = stageW / 2;
  const cy = stageH / 2;

  // Average Z for vertical centering
  const avgZ = (minZ + maxZ) / 2;

  const toX = (d: number) => cx + d * scale;
  const toY = (z: number) => cy - (z - avgZ) * scale;

  return {
    entry:  { x: toX(0),                  y: toY(entryZ) },
    exit:   { x: toX(horizDistSafe),       y: toY(exitZ) },
    shooter:{ x: toX(-horizDistSafe * EXT), y: toY(shooterZ) },
    groundY: toY(0),
    scale,
    cx, cy, horizDist: horizDistSafe,
  };
}

export const ShotDirectionAnimationPlayer: React.FC<ShotDirectionAnimationPlayerProps> = ({ isOpen, onClose, shotData }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const animRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration] = useState(3);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);

  const animate = useCallback((timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const elapsed = (timestamp - startTimeRef.current) * speed;
    const rawProgress = Math.min(elapsed / (duration * 1000), 1);
    const easedProgress = easeInOutQuad(rawProgress);

    setProgress(easedProgress);

    if (rawProgress >= 1) {
      if (loop) {
        startTimeRef.current = timestamp;
        animRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
      }
      return;
    }

    animRef.current = requestAnimationFrame(animate);
  }, [duration, speed, loop]);

  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = 0;
      animRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, animate]);

  const handlePlay = () => {
    if (progress >= 1) {
      setProgress(0);
    }
    setIsPlaying(true);
  };

  const handlePause = () => {
    cancelAnimationFrame(animRef.current);
    setIsPlaying(false);
  };

  const handleStop = () => {
    cancelAnimationFrame(animRef.current);
    setIsPlaying(false);
    setProgress(0);
  };

  const pts = getTrajectoryPoints(
    shotData.entryX, shotData.entryY, shotData.entryZ,
    shotData.exitX, shotData.exitY, shotData.exitZ,
    STAGE_W, STAGE_H, PADDING
  );

  // Animated bullet position along trajectory (from shooter → exit)
  const totalTrajX = pts.exit.x - pts.shooter.x;
  const totalTrajY = pts.exit.y - pts.shooter.y;
  const bulletX = pts.shooter.x + totalTrajX * progress;
  const bulletY = pts.shooter.y + totalTrajY * progress;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="relative bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col w-[98vw] max-w-[1400px] h-[96vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a2a] bg-[#1f1f1f] shrink-0">
          <h3 className="text-sm font-bold text-gray-100 tracking-wide uppercase">Atış Yönü Tespiti Animasyonu</h3>
          <div className="flex items-center gap-2">
            {isPlaying ? (
              <button onClick={handlePause} className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-bold rounded-md transition-all shadow-sm">
                <Square size={13} /> DURAKLAT
              </button>
            ) : (
              <button onClick={handlePlay} className="flex items-center gap-1 px-3 py-1.5 bg-[#F5C518] hover:bg-[#E2B616] text-black text-[10px] font-bold rounded-md transition-all shadow-sm">
                <Play size={13} /> BAŞLAT
              </button>
            )}
            <button onClick={handleStop} className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-gray-400 hover:text-white border border-[#333] hover:border-gray-500 rounded-md transition-all">
              <RotateCcw size={13} /> DURDUR
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-md transition-all">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stage */}
        <div ref={containerRef} className="flex-1 bg-[#111] flex items-center justify-center p-4 min-h-0">
          <Stage ref={stageRef} width={STAGE_W} height={STAGE_H} className="rounded-lg border border-[#333]">
            <Layer>
              {/* Background */}
              <Rect x={0} y={0} width={STAGE_W} height={STAGE_H} fill="#f4f1eb" />

              {/* Grid */}
              {Array.from({ length: 20 }).map((_, i) => (
                <Line key={`v${i}`}
                  points={[i * (STAGE_W / 20), 0, i * (STAGE_W / 20), STAGE_H]}
                  stroke="#ddd" strokeWidth={0.5} opacity={0.4}
                />
              ))}
              {Array.from({ length: 14 }).map((_, i) => (
                <Line key={`h${i}`}
                  points={[0, i * (STAGE_H / 14), STAGE_W, i * (STAGE_H / 14)]}
                  stroke="#ddd" strokeWidth={0.5} opacity={0.4}
                />
              ))}

              {/* Ground reference line */}
              <Line
                points={[PADDING, pts.groundY, STAGE_W - PADDING, pts.groundY]}
                stroke="#8B7355" strokeWidth={2} lineCap="round"
              />
              <Text x={PADDING + 4} y={pts.groundY + 6} text="ZEMİN (0 cm)"
                fontSize={9} fontFamily="Inter" fill="#8B7355" opacity={0.7} />

              {/* Full trajectory from shooter to exit */}
              <Line
                points={[pts.shooter.x, pts.shooter.y, pts.entry.x, pts.entry.y, pts.exit.x, pts.exit.y]}
                stroke="#F44336" strokeWidth={2.5} dash={[8, 4]} lineCap="round"
                opacity={0.55}
              />

              {/* ATICI (Shooter) marker — always visible */}
              <Group>
                <Circle x={pts.shooter.x} y={pts.shooter.y} radius={8} fill="rgba(255, 152, 0, 0.35)" stroke="#FF9800" strokeWidth={2} />
                <Line points={[pts.shooter.x - 10, pts.shooter.y - 10, pts.shooter.x + 10, pts.shooter.y + 10]} stroke="#FF9800" strokeWidth={2} />
                <Line points={[pts.shooter.x + 10, pts.shooter.y - 10, pts.shooter.x - 10, pts.shooter.y + 10]} stroke="#FF9800" strokeWidth={2} />
                <Text x={pts.shooter.x - 28} y={pts.shooter.y - 24} text="ATICI" fontSize={10} fontFamily="Inter" fontStyle="bold" fill="#FF9800" />
                <Text x={pts.shooter.x - 28} y={pts.shooter.y + 14} text={`~${shotData.shooterDistance}m`} fontSize={8} fontFamily="Inter" fill="rgba(255,152,0,0.7)" />
              </Group>

              {/* Entry point (Hedef/Giriş) */}
              <Group>
                <Circle x={pts.entry.x} y={pts.entry.y} radius={9} fill="rgba(33, 150, 243, 0.25)" stroke="#2196F3" strokeWidth={2.5} />
                <Circle x={pts.entry.x} y={pts.entry.y} radius={3} fill="#2196F3" />
                <Line points={[pts.entry.x - 12, pts.entry.y, pts.entry.x + 12, pts.entry.y]} stroke="#2196F3" strokeWidth={2.5} />
                <Line points={[pts.entry.x, pts.entry.y - 12, pts.entry.x, pts.entry.y + 12]} stroke="#2196F3" strokeWidth={2.5} />
                <Text x={pts.entry.x - 16} y={pts.entry.y + 16} text="GİRİŞ (HEDEF)" fontSize={9} fontFamily="Inter" fontStyle="bold" fill="#2196F3" />
              </Group>

              {/* Exit point */}
              <Group>
                <Circle x={pts.exit.x} y={pts.exit.y} radius={8} fill="rgba(76, 175, 80, 0.2)" stroke="#4CAF50" strokeWidth={2} />
                <Circle x={pts.exit.x} y={pts.exit.y} radius={4} fill="rgba(76, 175, 80, 0.5)" />
                <Text x={pts.exit.x + 10} y={pts.exit.y - 20} text="ÇIKIŞ" fontSize={9} fontFamily="Inter" fontStyle="bold" fill="#4CAF50" />
              </Group>

              {/* Distance annotation between entry and exit */}
              <Text
                x={(pts.entry.x + pts.exit.x) / 2 - 30}
                y={Math.min(pts.entry.y, pts.exit.y) - 14}
                text={`${pts.horizDist.toFixed(0)} cm`}
                fontSize={8} fontFamily="Inter" fontStyle="bold" fill="#666" opacity={0.7}
              />

              {/* Animated bullet */}
              <Group>
                {/* Trail */}
                <Circle x={bulletX} y={bulletY} radius={12} fill="rgba(244, 67, 54, 0.12)" />
                {/* Bullet body */}
                <Circle x={bulletX} y={bulletY} radius={5} fill="#F44336" stroke="#fff" strokeWidth={1.5} />
              </Group>

              {/* Angle arc indicators */}
              {progress > 0.05 && (
                <Group>
                  <Text x={pts.entry.x + 16} y={pts.entry.y - 32}
                    text={`Dikey: ${shotData.impactAngle}°  |  Yatay: ${shotData.horizontalAngle}°`}
                    fontSize={9} fontFamily="Inter" fontStyle="bold" fill="#333" opacity={0.6} />
                </Group>
              )}

              {/* GÖSTERGE (Legend) */}
              <Group>
                <Rect x={10} y={8} width={170} height={116}
                  fill="#1a1a1a" cornerRadius={6} opacity={0.88} stroke="#444" strokeWidth={1} />
                <Text x={16} y={12} text="GÖSTERGE" fontSize={11} fontFamily="Inter" fontStyle="bold" fill="#F5C518" />

                <Line points={[16, 30, 32, 30]} stroke="#FF9800" strokeWidth={2.5} />
                <Text x={36} y={26} text="Atıcı konumu" fontSize={11} fontFamily="Inter" fill="#ccc" />

                <Line points={[16, 48, 32, 48]} stroke="#2196F3" strokeWidth={2.5} />
                <Text x={36} y={44} text="Giriş noktası (hedef)" fontSize={11} fontFamily="Inter" fill="#ccc" />

                <Line points={[16, 66, 32, 66]} stroke="#4CAF50" strokeWidth={2} />
                <Text x={36} y={62} text="Çıkış noktası" fontSize={11} fontFamily="Inter" fill="#ccc" />

                <Line points={[16, 84, 32, 84]} stroke="#F44336" strokeWidth={2} dash={[5, 3]} />
                <Text x={36} y={80} text="Mermi trajektörü" fontSize={11} fontFamily="Inter" fill="#ccc" />

                <Circle x={24} y={100} radius={3} fill="#F44336" />
                <Text x={36} y={96} text="Mermi (anlık konum)" fontSize={11} fontFamily="Inter" fill="#ccc" />
              </Group>

              {/* DEĞERLENDİRME (Assessment) */}
              <Group>
                <Rect x={10} y={132} width={160} height={56}
                  fill="#1a1a1a" cornerRadius={6} opacity={0.88} stroke="#444" strokeWidth={1} />
                <Text x={16} y={136} text="DEĞERLENDİRME" fontSize={10} fontFamily="Inter" fontStyle="bold" fill="#F5C518" />
                <Text x={16} y={150} text={`${shotData.horizontalAngle}° yatay, ${shotData.impactAngle}° dikey`}
                  fontSize={10} fontFamily="Inter" fontStyle="bold" fill="#fff" />
                <Text x={16} y={166} text={`Atıcı ~${shotData.shooterDistance}m uzaklıkta`}
                  fontSize={10} fontFamily="Inter" fill="#ccc" />
              </Group>

              {/* VERİLER (Data Panel) */}
              <Group>
                <Rect x={STAGE_W - 250} y={8} width={240} height={180}
                  fill="#1a1a1a" cornerRadius={8} opacity={0.92} stroke="#444" strokeWidth={1.5} />
                <Text x={STAGE_W - 242} y={14} text="VERİLER" fontSize={12} fontFamily="Inter" fontStyle="bold" fill="#F5C518" />

                <Rect x={STAGE_W - 245} y={32} width={230} height={22} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 240} y={35} text={`Giriş: (${shotData.entryX}, ${shotData.entryY}, ${shotData.entryZ}) cm`}
                  fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#fff" />

                <Rect x={STAGE_W - 245} y={58} width={230} height={22} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 240} y={61} text={`Çıkış: (${shotData.exitX}, ${shotData.exitY}, ${shotData.exitZ}) cm`}
                  fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#fff" />

                <Rect x={STAGE_W - 245} y={84} width={230} height={22} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 240} y={87} text={`Yatay Açı: ${shotData.horizontalAngle}°`}
                  fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#fff" />

                <Rect x={STAGE_W - 245} y={110} width={230} height={22} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 240} y={113} text={`Dikey Açı: ${shotData.impactAngle}°`}
                  fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#fff" />

                <Rect x={STAGE_W - 245} y={136} width={110} height={22} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 240} y={139} text={`Atıcı: ~${shotData.shooterDistance}m`}
                  fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#fff" />

                <Rect x={STAGE_W - 125} y={136} width={110} height={22} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 120} y={139} text={`Yük.: ${shotData.shooterHeight}m`}
                  fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#fff" />

                <Rect x={STAGE_W - 245} y={162} width={230} height={22} fill="#2a2a2a" cornerRadius={3} />
                <Text x={STAGE_W - 240} y={165} text={`Yüzey: ${shotData.entrySurface} | Sapma: ${shotData.deflectionAngle}°`}
                  fontSize={13} fontFamily="Inter" fontStyle="bold" fill="#fff" />
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
                <button key={s} onClick={() => setSpeed(s)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${speed === s ? 'bg-[#F5C518] text-black' : 'text-gray-500 hover:text-white'}`}>
                  {s}x
                </button>
              ))}
            </div>
            <button onClick={() => setLoop(!loop)}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                loop ? 'bg-[#F5C518]/10 border-[#F5C518]/40 text-[#F5C518]' : 'border-[#333] text-gray-500 hover:text-white'
              }`}>
              DÖNGÜ
            </button>
            <div className="w-32 h-2 bg-[#333] rounded-full overflow-hidden">
              <div className="h-full bg-[#F5C518] rounded-full transition-all duration-100" style={{ width: `${progress * 100}%` }} />
            </div>
            <span className="text-[10px] font-mono text-gray-500 tabular-nums w-8 text-right">{Math.round(progress * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
