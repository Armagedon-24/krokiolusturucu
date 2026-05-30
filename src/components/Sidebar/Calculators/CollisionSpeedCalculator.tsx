import React, { useState, useEffect } from 'react';
import { Scale, PlusCircle, Compass, ShieldAlert } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';

export const CollisionSpeedCalculator: React.FC = () => {
  const [mass1, setMass1] = useState<number>(1500);
  const [mass2, setMass2] = useState<number>(1200);
  const [distance1, setDistance1] = useState<number>(12);
  const [distance2, setDistance2] = useState<number>(18);
  const [mu, setMu] = useState<number>(0.65);
  const [phi, setPhi] = useState<number>(90); // Pre-impact angle of vehicle 2 (degrees)
  const [theta1, setTheta1] = useState<number>(15); // Departure angle vehicle 1 (degrees)
  const [theta2, setTheta2] = useState<number>(45); // Departure angle vehicle 2 (degrees)

  const [postSpeed1, setPostSpeed1] = useState<number>(0);
  const [postSpeed2, setPostSpeed2] = useState<number>(0);
  const [preSpeed1, setPreSpeed1] = useState<number>(0);
  const [preSpeed2, setPreSpeed2] = useState<number>(0);

  const { addObject } = useStore();

  useEffect(() => {
    // 1. Calculate post-impact speeds using skid formula: v' = 15.94 * sqrt(mu * d)
    const vPrime1 = 15.94 * Math.sqrt(mu * distance1);
    const vPrime2 = 15.94 * Math.sqrt(mu * distance2);
    setPostSpeed1(vPrime1);
    setPostSpeed2(vPrime2);

    // Convert angles to radians
    const radPhi = (phi * Math.PI) / 180;
    const radTheta1 = (theta1 * Math.PI) / 180;
    const radTheta2 = (theta2 * Math.PI) / 180;

    // 2. Solve 2D Momentum equations:
    // Y-Axis: m2 * v2 * sin(phi) = m1 * v'1 * sin(theta1) + m2 * v'2 * sin(theta2)
    // X-Axis: m1 * v1 + m2 * v2 * cos(phi) = m1 * v'1 * cos(theta1) + m2 * v'2 * cos(theta2)
    
    const sinPhi = Math.sin(radPhi);
    const cosPhi = Math.cos(radPhi);

    let calculatedV2 = 0;
    let calculatedV1 = 0;

    if (Math.abs(sinPhi) > 0.001) {
      // Perpendicular or angled collision
      const numeratorV2 = (mass1 * vPrime1 * Math.sin(radTheta1)) + (mass2 * vPrime2 * Math.sin(radTheta2));
      calculatedV2 = numeratorV2 / (mass2 * sinPhi);

      const numeratorV1 = (mass1 * vPrime1 * Math.cos(radTheta1)) + (mass2 * vPrime2 * Math.cos(radTheta2)) - (mass2 * calculatedV2 * cosPhi);
      calculatedV1 = numeratorV1 / mass1;
    } else {
      // Parallel / Head-on / Rear-end (1D approximation)
      // Since sin(phi) ~ 0, we assume simple inline collision
      calculatedV2 = vPrime2;
      calculatedV1 = ((mass1 * vPrime1 + mass2 * vPrime2) - mass2 * calculatedV2) / mass1;
    }

    setPreSpeed1(Math.max(0, calculatedV1));
    setPreSpeed2(Math.max(0, calculatedV2));
  }, [mass1, mass2, distance1, distance2, mu, phi, theta1, theta2]);

  const handleAddToCanvas = () => {
    addObject({
      type: 'text',
      text: `ARAÇ ÇARPIŞMA HIZI ANALİZİ (2D MOMENTUM)\n----------------------------------------\n` +
            `Zemin Sürtünmesi (μ): ${mu.toFixed(2)}\n` +
            `Araç 1 (Mavi) Ağırlık: ${mass1} kg | Çıkış Açısı: ${theta1}° | Sürüklenme: ${distance1}m\n` +
            `Araç 2 (Sarı) Ağırlık: ${mass2} kg | Çıkış Açısı: ${theta2}° | Sürüklenme: ${distance2}m\n` +
            `Çarpışma Açısı (φ): ${phi}°\n` +
            `----------------------------------------\n` +
            `Çarpışma Sonrası Süratler:\n` +
            `  * Araç 1 (v'1): ${Math.round(postSpeed1)} km/s\n` +
            `  * Araç 2 (v'2): ${Math.round(postSpeed2)} km/s\n` +
            `ÇARPIŞMA ANINDAKİ TAHMİNİ HIZLAR:\n` +
            `  * ARAÇ 1 HIZI (v1): ${Math.round(preSpeed1)} km/s\n` +
            `  * ARAÇ 2 HIZI (v2): ${Math.round(preSpeed2)} km/s`,
      x: 300,
      y: 300,
      width: 320,
      fontSize: 11,
      fill: '#000000',
      fontFamily: 'Inter',
      fontStyle: 'bold'
    });
  };

  return (
    <div className="space-y-6 p-1 relative">
      <HelpTooltip 
        title="Çarpışma Hızı (Momentum)"
        description="Kazaya karışan araçların ağırlıkları, sürüklenme yönleri ve mesafelerinden yola çıkarak çarpışma anındaki hızlarını hesaplar."
        formula="m1*v1 + m2*v2*cos(φ) = m1*v'1*cos(θ1) + m2*v'2*cos(θ2)"
        usage="Araç kütlelerini, çarpışma açısını ve kazadan sonraki sürüklenme mesafelerini girin. Sonuçlar momentum korunumu ile hesaplanır."
      />

      <div className="space-y-4">
        {/* Collision Configuration */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Compass size={12} className="text-[#F5C518]" />
            Çarpışma Kurulumu (Ortam)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[9px] text-gray-400 font-bold">ÇARPIŞMA AÇISI (φ)</span>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={phi}
                  onChange={(e) => setPhi(Math.min(180, Math.max(0, Number(e.target.value))))}
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2 text-xs text-white focus:border-[#F5C518]/50 outline-none transition-all font-mono"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-600">DERECE</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-gray-400 font-bold">ZEMİN SÜRTÜNMESİ (μ)</span>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={mu}
                onChange={(e) => setMu(parseFloat(e.target.value))}
                className="w-full h-8 bg-transparent appearance-none cursor-pointer accent-[#F5C518]"
              />
              <div className="flex justify-between text-[8px] text-gray-500 font-mono -mt-1.5">
                <span>μ: {mu.toFixed(2)}</span>
                <span>(Kuru Asfalt ~0.75)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle 1 (Blue/Main) Card */}
        <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-blue-500/10 pb-1.5">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Scale size={12} /> ARAÇ 1 (ANA ARAÇ)
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-[8px] text-gray-500 font-bold uppercase block mb-1">Ağırlık (kg)</span>
              <input
                type="number"
                step="50"
                value={mass1}
                onChange={(e) => setMass1(Math.max(100, Number(e.target.value)))}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-2 py-1.5 text-xs text-white outline-none font-mono"
              />
            </div>
            <div>
              <span className="text-[8px] text-gray-500 font-bold uppercase block mb-1">Ayrılma Açısı (θ1)</span>
              <input
                type="number"
                value={theta1}
                onChange={(e) => setTheta1(Number(e.target.value))}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-2 py-1.5 text-xs text-white outline-none font-mono"
              />
            </div>
            <div>
              <span className="text-[8px] text-gray-500 font-bold uppercase block mb-1">Sürüklenme (m)</span>
              <input
                type="number"
                value={distance1}
                onChange={(e) => setDistance1(Math.max(0.1, Number(e.target.value)))}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-2 py-1.5 text-xs text-white outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Vehicle 2 (Orange/Cross) Card */}
        <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-amber-500/10 pb-1.5">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Scale size={12} /> ARAÇ 2 (DİĞER ARAÇ)
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-[8px] text-gray-500 font-bold uppercase block mb-1">Ağırlık (kg)</span>
              <input
                type="number"
                step="50"
                value={mass2}
                onChange={(e) => setMass2(Math.max(100, Number(e.target.value)))}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-2 py-1.5 text-xs text-white outline-none font-mono"
              />
            </div>
            <div>
              <span className="text-[8px] text-gray-500 font-bold uppercase block mb-1">Ayrılma Açısı (θ2)</span>
              <input
                type="number"
                value={theta2}
                onChange={(e) => setTheta2(Number(e.target.value))}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-2 py-1.5 text-xs text-white outline-none font-mono"
              />
            </div>
            <div>
              <span className="text-[8px] text-gray-500 font-bold uppercase block mb-1">Sürüklenme (m)</span>
              <input
                type="number"
                value={distance2}
                onChange={(e) => setDistance2(Math.max(0.1, Number(e.target.value)))}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-2 py-1.5 text-xs text-white outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Results Card */}
        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest text-center">ÇARPIŞMA ANINDAKİ TAHMİNİ HIZLAR</div>
          
          <div className="grid grid-cols-2 gap-4 divide-x divide-[#2a2a2a]">
            {/* Vehicle 1 Speed */}
            <div className="text-center space-y-1">
              <span className="text-[8px] text-blue-400 font-bold uppercase block tracking-wider">ARAÇ 1 HIZI</span>
              <div>
                <span className="text-4xl font-black text-white tracking-tighter">{Math.round(preSpeed1)}</span>
                <span className="text-[10px] font-bold text-[#F5C518] ml-1 italic">KM/S</span>
              </div>
              <span className="text-[8px] text-gray-600 block">Çarpışma Sonrası: {Math.round(postSpeed1)} km/s</span>
            </div>

            {/* Vehicle 2 Speed */}
            <div className="text-center space-y-1 pl-4">
              <span className="text-[8px] text-amber-400 font-bold uppercase block tracking-wider">ARAÇ 2 HIZI</span>
              <div>
                <span className="text-4xl font-black text-white tracking-tighter">{Math.round(preSpeed2)}</span>
                <span className="text-[10px] font-bold text-[#F5C518] ml-1 italic">KM/S</span>
              </div>
              <span className="text-[8px] text-gray-600 block">Çarpışma Sonrası: {Math.round(postSpeed2)} km/s</span>
            </div>
          </div>

          <button
            onClick={handleAddToCanvas}
            className="w-full flex items-center justify-center gap-2 py-4 bg-[#F5C518] text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#ffcf24] transition-all shadow-lg active:scale-95"
          >
            <PlusCircle size={14} />
            HIZ ANALİZİNİ KROKİYE EKLE
          </button>
        </div>

        {/* Warning Alert */}
        <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-2xl flex gap-3 items-start">
          <ShieldAlert size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-[8px] font-bold text-red-200 uppercase">MOMENTUM SINIRLAMALARI</p>
            <p className="text-[8px] text-gray-600 leading-relaxed italic">
              Bu 2D hesaplama, iki aracın çarpışıp ayrıldıktan sonraki doğrusal momentum korunumuna dayanır. 
              Çarpışma esnasında bariyer teması veya takla atma gibi ek enerji kayıpları varsa hızlar daha yüksek olabilir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
