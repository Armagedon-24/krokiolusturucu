import React, { useState, useEffect } from 'react';
import { Zap, Activity, Info, PlusCircle, TrendingUp, AlertTriangle, Truck, Car, Bike } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';

const SURFACE_TYPES = [
  { name: 'Asfalt (Kuru)', default: 0.75 },
  { name: 'Asfalt (Islak)', default: 0.5 },
  { name: 'Beton (Kuru)', default: 0.85 },
  { name: 'Beton (Islak)', default: 0.6 },
  { name: 'Çakıl Yol', default: 0.6 },
  { name: 'Toprak Yol', default: 0.5 },
];

const VEHICLE_TYPES = [
  { id: 'car_abs', name: 'Binek (ABS)', efficiency: 100, muMultiplier: 1.0, icon: <Car size={12} /> },
  { id: 'car_no_abs', name: 'Binek (ABS\'siz)', efficiency: 85, muMultiplier: 1.0, icon: <Car size={12} /> },
  { id: 'truck', name: 'Kamyon / Tır', efficiency: 75, muMultiplier: 0.85, icon: <Truck size={12} /> },
  { id: 'bus', name: 'Otobüs', efficiency: 80, muMultiplier: 0.90, icon: <Truck size={12} /> },
  { id: 'motorcycle', name: 'Motosiklet', efficiency: 70, muMultiplier: 0.95, icon: <Bike size={12} /> },
];

export const SkidMarkCalculator: React.FC = () => {
  const [distance, setDistance] = useState<number>(20);
  const [mu, setMu] = useState<number>(0.75);
  const [vehicleType, setVehicleType] = useState(VEHICLE_TYPES[0]);
  const [efficiency, setEfficiency] = useState<number>(100);
  const [speed, setSpeed] = useState<number>(0);
  
  const { addObject } = useStore();

  useEffect(() => {
    setEfficiency(vehicleType.efficiency);
  }, [vehicleType]);

  useEffect(() => {
    if (distance > 0 && mu > 0) {
      const effectiveMu = mu * vehicleType.muMultiplier;
      const calculatedSpeed = 15.94 * Math.sqrt(effectiveMu * distance * (efficiency / 100));
      setSpeed(calculatedSpeed);
    } else {
      setSpeed(0);
    }
  }, [distance, mu, efficiency, vehicleType]);

  const handleAddToCanvas = () => {
    addObject({
      type: 'text',
      text: `FREN İZİ ANALİZİ\n-------------------\nAraç: ${vehicleType.name}\nFren İzi: ${distance}m\nSürtünme (μ): ${mu}\nVerim: %${efficiency}\nTahmini Hız: ${Math.round(speed)} km/s`,
      x: 300,
      y: 300,
      width: 200,
      fontSize: 12,
      fill: '#000000',
      fontFamily: 'Inter',
      fontStyle: 'bold'
    });
  };

  return (
    <div className="space-y-6 relative">
      <HelpTooltip 
        title="Fren İzi Analizi"
        description="Fren izi uzunluğu ve zemin sürtünmesinden yola çıkarak aracın fren anındaki minimum hızını hesaplar."
        formula="v = 15.94 * sqrt(μ * d * η * k)"
        usage="Zemin tipini seçin, fren izi uzunluğunu girin ve araç modelini belirleyin. ABS durumu verimi (%) otomatik ayarlar."
      />
      <div className="space-y-4 p-1">
        {/* Vehicle Type Selection */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Araç Modeli / Tipi
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {VEHICLE_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setVehicleType(type)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[9px] font-black transition-all ${
                  vehicleType.id === type.id 
                    ? 'bg-[#F5C518] border-[#F5C518] text-black shadow-lg shadow-[#F5C518]/20' 
                    : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:border-gray-600'
                }`}
              >
                {type.icon}
                {type.name.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Distance Input */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Zap size={12} className="text-[#F5C518]" />
            Fren İzi Uzunluğu (Metre)
          </label>
          <div className="relative">
            <input
              type="number"
              value={distance}
              onChange={(e) => setDistance(Math.max(0, Number(e.target.value)))}
              className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all font-mono"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">M</span>
          </div>
        </div>

        {/* Friction Coefficient */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <TrendingUp size={12} className="text-[#F5C518]" />
            Sürtünme Katsayısı (μ): {mu.toFixed(2)}
          </label>
          <div className="grid grid-cols-2 gap-1 mb-2">
            {SURFACE_TYPES.map((type) => (
              <button
                key={type.name}
                onClick={() => setMu(type.default)}
                className={`px-2 py-1.5 rounded-lg border text-[8px] font-bold transition-all ${
                  mu === type.default 
                    ? 'bg-[#F5C518]/20 border-[#F5C518]/50 text-[#F5C518]' 
                    : 'bg-[#1a1a1a] border-[#333] text-gray-500'
                }`}
              >
                {type.name.toUpperCase()}
              </button>
            ))}
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.01"
            value={mu}
            onChange={(e) => setMu(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
          />
        </div>

        {/* Efficiency */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Activity size={12} className="text-[#F5C518]" />
            Fren Verimi (Araç Durumu): %{efficiency}
          </label>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={efficiency}
            onChange={(e) => setEfficiency(parseInt(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
          />
          <p className="text-[8px] text-gray-600 italic">
            * ABS'li binek araçlarda genellikle %100, ABS'sizlerde %80-90 civarıdır.
          </p>
        </div>

        {/* Results Card */}
        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <Zap size={80} className="text-[#F5C518]" />
          </div>
          
          <div className="relative z-10 space-y-4">
            <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest text-center">TAHMİNİ HIZ</div>
            <div className="text-center">
              <span className="text-6xl font-black text-white tracking-tighter">{Math.round(speed)}</span>
              <span className="text-sm font-bold text-[#F5C518] ml-2 italic">KM/S</span>
            </div>

            <button
              onClick={handleAddToCanvas}
              className="w-full flex items-center justify-center gap-2 py-4 bg-[#F5C518] text-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#ffcf24] transition-all shadow-lg active:scale-95"
            >
              <PlusCircle size={14} />
              RAPORA EKLE
            </button>
          </div>
        </div>

        <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl flex gap-3 items-start">
          <AlertTriangle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-orange-200">ADLİ ANALİZ NOTU</p>
            <p className="text-[8px] text-gray-500 leading-relaxed italic">
              Bu hesaplama, belirlenen araç tipinin standart ağırlık ve fren karakteristiği üzerinden yapılmaktadır. 
              Eğim, aşırı yük ve lastik aşınması gibi faktörler için verim ayarını manuel güncelleyiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
