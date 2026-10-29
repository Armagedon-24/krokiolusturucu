import React, { useState, useEffect } from 'react';
import { Ruler, Info, Weight, Zap, TrendingUp, Eye, Footprints, Gauge } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';
import { PedestrianLaunchAnimationPlayer } from '../../UI/PedestrianLaunchAnimationPlayer';
import type { PedestrianLaunchData } from '../../../types';

const G = 9.81;
const MU = 0.7; // pedestrian-road friction coefficient (dry asphalt)

export const PedestrianLaunchCalculator: React.FC = () => {
  const [throwDistInput, setThrowDistInput] = useState<number>(20);
  const [pedestrianHeight, setPedestrianHeight] = useState<number>(175);
  const [pedestrianWeight, setPedestrianWeight] = useState<number>(75);
  const [pedestrianState, setPedestrianState] = useState<'stationary' | 'walking_same' | 'walking_opposite' | 'running_same' | 'running_opposite'>('stationary');
  const [showPlayer, setShowPlayer] = useState(false);

  const [calculatedSpeed, setCalculatedSpeed] = useState(0);
  const [launchSpeed, setLaunchSpeed] = useState(0);
  const [launchAngle] = useState(15);
  const [throwDistance, setThrowDistance] = useState(0);
  const [flightDistance, setFlightDistance] = useState(0);
  const [slideDistance, setSlideDistance] = useState(0);
  const [flightTime, setFlightTime] = useState(0);
  const [landingSpeed, setLandingSpeed] = useState(0);
  const [maxHeight, setMaxHeight] = useState(0);

  const { addObject, setPedestrianLaunch, pedestrianLaunch } = useStore();

  useEffect(() => {
    const hCm = (pedestrianHeight * 0.55) / 100;
    const d = throwDistInput;
    const sqrtHG = Math.sqrt(2 * hCm / G);

    // Inverse Searle: solve d = v·√(2h/g) + v²/(2μg) for v
    // v = μg · (√(2h/g + 2d/(μg)) - √(2h/g))
    const vEffMs = MU * G * (Math.sqrt(2 * hCm / G + 2 * d / (MU * G)) - sqrtHG);

    // Pedestrian speed offset
    const stateSpeeds: Record<string, number> = {
      stationary: 0,
      walking_same: 5,
      walking_opposite: -5,
      running_same: 10,
      running_opposite: -10,
    };
    const relSpeedKmh = stateSpeeds[pedestrianState] ?? 0;
    const vehicleSpeedKmh = vEffMs * 3.6 - relSpeedKmh;

    // Derived Searle values using vEffMs
    const flightDist = vEffMs * sqrtHG;
    const slideDist = (vEffMs * vEffMs) / (2 * MU * G);
    const totalDist = flightDist + slideDist;

    const tFlight = sqrtHG;
    const tSlide = vEffMs / (MU * G);
    const totalTime = tFlight + tSlide;

    const angleRad = (launchAngle * Math.PI) / 180;
    const upwardVel = vEffMs * Math.sin(angleRad);
    const maxH = hCm + (upwardVel * upwardVel) / (2 * G);

    const vyLand = upwardVel + G * tFlight;
    const landingV = Math.sqrt(vEffMs * vEffMs + vyLand * vyLand) * 3.6;

    setCalculatedSpeed(Math.max(0, vehicleSpeedKmh));
    setLaunchSpeed(vEffMs);
    setThrowDistance(totalDist);
    setFlightDistance(flightDist);
    setSlideDistance(slideDist);
    setFlightTime(totalTime);
    setLandingSpeed(landingV);
    setMaxHeight(Math.max(maxH, hCm));
    setPedestrianLaunch({ duration: totalTime });
  }, [throwDistInput, pedestrianHeight, launchAngle, pedestrianState]);

  const handleAddToCanvas = () => {
    const scale = 15;
    const baseX = 200;
    const baseY = 350;
    const dPx = Math.min(500, throwDistance * scale);
    const hPx = maxHeight * scale;
    const vehicleLen = calculatedSpeed * 0.8;

    addObject({
      type: 'rect',
      x: baseX - vehicleLen / 2,
      y: baseY - 20,
      width: vehicleLen,
      height: 40,
      fill: '#E53935',
      stroke: '#b71c1c',
      strokeWidth: 2,
      cornerRadius: 4,
    });

    addObject({
      type: 'text',
      text: `Araç: ${Math.round(calculatedSpeed)} km/h`,
      x: baseX - 30,
      y: baseY - 50,
      width: 100,
      fontSize: 10,
      fill: '#E53935',
      fontFamily: 'Inter',
      fontStyle: 'bold',
    });

    addObject({
      type: 'line',
      x: baseX,
      y: baseY,
      width: dPx + 10,
      height: hPx + 10,
      points: (() => {
        const pts: number[] = [];
        const segments = 30;
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const px = dPx * t;
          const py = -hPx * 4 * t * (1 - t);
          pts.push(px, py);
        }
        return pts;
      })(),
      dash: [6, 4],
      stroke: '#FF5722',
      strokeWidth: 2,
    });

    addObject({
      type: 'rect',
      x: baseX - 5,
      y: baseY - 5,
      width: 10,
      height: 10,
      rotation: 45,
      fill: '#1565C0',
      stroke: '#fff',
      strokeWidth: 2,
    });

    addObject({
      type: 'rect',
      x: baseX + dPx - 5,
      y: baseY - 5,
      width: 10,
      height: 10,
      rotation: 45,
      fill: '#FF5722',
      stroke: '#fff',
      strokeWidth: 2,
    });

    addObject({
      type: 'text',
      text: `Fırlatma: ${throwDistance.toFixed(1)}m`,
      x: baseX + dPx + 12,
      y: baseY - 12,
      width: 120,
      fontSize: 10,
      fill: '#FF5722',
      fontFamily: 'Inter',
      fontStyle: 'bold',
    });

    addObject({
      type: 'line',
      x: baseX,
      y: baseY + 20,
      width: dPx,
      height: 2,
      points: [0, 0, dPx, 0],
      stroke: '#FF5722',
      strokeWidth: 1,
      dash: [3, 3],
    });

    addObject({
      type: 'text',
      text: `Hesaplanan Araç Hızı: ${Math.round(calculatedSpeed)} km/h\nYükseklik: ${pedestrianHeight}cm | Ağırlık: ${pedestrianWeight}kg\nUçuş: ${flightDistance.toFixed(2)}m | Savrulma: ${slideDistance.toFixed(2)}m`,
      x: baseX - 20,
      y: baseY + 40,
      width: 300,
      fontSize: 10,
      fill: '#000',
      fontFamily: 'Inter',
      fontStyle: 'bold',
    });

    setPedestrianLaunch({
      canvasData: { vehicleSpeed: calculatedSpeed, pedestrianHeight, pedestrianWeight, launchSpeed, launchAngle, throwDistance: throwDistance, flightDistance, slideDistance, flightTime, landingSpeed, maxHeight, pedestrianState },
      isPlaying: true,
      currentTime: 0,
      duration: flightTime,
    });
  };

  const launchData: PedestrianLaunchData = {
    vehicleSpeed: calculatedSpeed,
    pedestrianHeight,
    pedestrianWeight,
    launchSpeed,
    launchAngle,
    throwDistance: throwDistance,
    flightDistance,
    slideDistance,
    flightTime,
    landingSpeed,
    maxHeight,
    pedestrianState,
  };

  return (
    <div className="p-4 space-y-6 overflow-y-auto max-h-screen custom-scrollbar pb-20 relative">
      <HelpTooltip
        title="Yaya Fırlatma Analizi"
        description="Fırlatma mesafesinden araç hızını ters Searle formülü ile hesaplar."
        formula="Ters Searle: v = μg·(√(2h/g + 2d/(μg)) − √(2h/g))"
        usage="Olay yerinde ölçülen fırlatma mesafesini girin. Yaya boyutları ve durumuna göre araç hızı hesaplanır."
      />

      <div className="flex items-center gap-2 px-1 mb-2">
        <Zap size={18} className="text-[#F5C518]" />
        <h4 className="text-[11px] font-black text-gray-200 uppercase tracking-widest">
          Yaya Fırlatma Analizi
        </h4>
      </div>

      <div className="space-y-6">
        {/* Throw Distance Input — direct number input */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <TrendingUp size={14} className="text-[#F5C518]" />
            Fırlatma Mesafesi (m)
          </label>
          <input
            type="number"
            value={throwDistInput}
            onChange={(e) => setThrowDistInput(Math.max(1, Math.min(200, Number(e.target.value))))}
            className="w-full bg-[#111] border border-[#333] rounded-2xl px-5 py-4 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all font-mono"
            step="0.1"
          />
        </div>

        {/* Pedestrian Height */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Ruler size={14} className="text-blue-500" />
            Yaya Boyu (cm)
          </label>
          <input
            type="number"
            value={pedestrianHeight}
            onChange={(e) => setPedestrianHeight(Math.max(100, Math.min(220, Number(e.target.value))))}
            className="w-full bg-[#111] border border-[#333] rounded-2xl px-5 py-4 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all font-mono"
          />
        </div>

        {/* Pedestrian Weight */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Weight size={14} className="text-blue-500" />
            Yaya Ağırlığı (kg)
          </label>
          <input
            type="number"
            value={pedestrianWeight}
            onChange={(e) => setPedestrianWeight(Math.max(30, Math.min(200, Number(e.target.value))))}
            className="w-full bg-[#111] border border-[#333] rounded-2xl px-5 py-4 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all font-mono"
          />
        </div>

        {/* Pedestrian State */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Footprints size={14} className="text-green-500" />
            Yaya Durumu
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'stationary', label: 'SABİT', desc: '0 km/h', color: 'text-gray-400' },
              { key: 'walking_same', label: 'YÜRÜYOR (Aynı Yön)', desc: '+5 km/h', color: 'text-yellow-400' },
              { key: 'walking_opposite', label: 'YÜRÜYOR (Ters Yön)', desc: '-5 km/h', color: 'text-orange-400' },
              { key: 'running_same', label: 'KOŞUYOR (Aynı Yön)', desc: '+10 km/h', color: 'text-red-400' },
              { key: 'running_opposite', label: 'KOŞUYOR (Ters Yön)', desc: '-10 km/h', color: 'text-red-600' },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setPedestrianState(s.key as typeof pedestrianState)}
                className={`p-2 rounded-xl border text-[8px] font-black transition-all ${
                  pedestrianState === s.key
                    ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-600/20'
                    : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:border-gray-600'
                }`}
              >
                <span className="block">{s.label}</span>
                <span className={`block text-[10px] font-mono mt-0.5 ${pedestrianState === s.key ? 'text-white/70' : s.color}`}>{s.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Results Dashboard */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-[#333] rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 rotate-12 transition-transform group-hover:scale-110">
            <Gauge size={120} />
          </div>

          <div className="relative z-10 space-y-6">
            {/* Primary result: vehicle speed */}
            <div className="flex justify-center pb-4 border-b border-white/5">
              <div className="text-center">
                <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest block mb-1">Hesaplanan Araç Hızı</span>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-black text-[#F5C518]">{Math.round(calculatedSpeed)}</span>
                  <span className="text-sm font-bold text-[#F5C518]/70 uppercase">km/h</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest block">Uçuş Mesafesi</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-blue-400">{flightDistance.toFixed(2)}</span>
                  <span className="text-[10px] font-bold text-blue-500">M</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest block">Savrulma Mesafesi</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-orange-400">{slideDistance.toFixed(2)}</span>
                  <span className="text-[10px] font-bold text-orange-500">M</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest block">Toplam Fırlatma</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-white">{throwDistance.toFixed(2)}</span>
                  <span className="text-[10px] font-bold text-red-500">M</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-4">
              <div className="space-y-1">
                <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest block">Çarpma Hızı</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black text-red-500">{Math.round(landingSpeed)}</span>
                  <span className="text-[10px] font-bold text-red-700 uppercase">km/h</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest block">Uçuş + Savrulma Süresi</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black text-white">{flightTime.toFixed(2)}</span>
                  <span className="text-[10px] font-bold text-blue-500">SN</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest block">Maks. Yükseklik</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black text-[#F5C518]">{maxHeight.toFixed(2)}</span>
                  <span className="text-[10px] font-bold text-[#F5C518]/60 uppercase">M</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex gap-3 items-start">
              <Info size={16} className="text-blue-900 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-blue-200">TEKNİK NOT</p>
                <p className="text-[8px] text-gray-600 leading-relaxed italic">
                  Ters Searle formülü (μ=0.7 asfalt sürtünme katsayısı) kullanılmıştır.
                  Fırlatma açısı 15° varsayılmış, kütle merkezi boyun %55'i alınmıştır. Hava direnci ihmal edilmiştir.
                </p>
              </div>
            </div>

            {/* Animation Controls */}
            <div className="border-t border-white/5 pt-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Oynatma Hızı</label>
                  <select className="bg-[#111] border border-[#333] rounded-xl px-3 py-2 text-[10px] text-white outline-none focus:border-[#F5C518]/50"
                    value={pedestrianLaunch.speed}
                    onChange={e => setPedestrianLaunch({ speed: Number(e.target.value) })}>
                    <option value="0.25">0.25x</option>
                    <option value="0.5">0.5x</option>
                    <option value="1">1x (Normal)</option>
                    <option value="2">2x</option>
                    <option value="4">4x</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pedestrianLaunch.loop}
                    onChange={e => setPedestrianLaunch({ loop: e.target.checked })}
                    className="accent-[#F5C518]" />
                  <span className="text-[10px] text-gray-400">Döngü</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Bar — always at top */}
      <div className="sticky top-0 px-4 py-3 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { useStore.getState().clearObjects(); setThrowDistInput(20); setPedestrianHeight(175); setPedestrianWeight(75); setPedestrianState('stationary'); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 hover:text-red-400 transition-colors"
          >
            TEMİZLE
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddToCanvas}
            className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold text-gray-400 hover:text-[#F5C518] border border-[#333] hover:border-[#F5C518]/50 rounded-lg transition-all"
          >
            TUVALE AKTAR
          </button>
          <button
            onClick={() => setShowPlayer(true)}
            className="flex items-center gap-2 px-5 py-2 bg-[#F5C518] hover:bg-[#E2B616] text-black text-xs font-black rounded-md transition-all shadow-lg active:scale-95"
          >
            <Eye size={14} />
            ANİMASYONU İZLE
          </button>
        </div>
      </div>

      <PedestrianLaunchAnimationPlayer isOpen={showPlayer} onClose={() => setShowPlayer(false)} launchData={launchData} />
    </div>
  );
};
