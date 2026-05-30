import React, { useState, useEffect } from 'react';
import { Sun, Ruler, PlusCircle, Clock, Calendar } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';

const SEASONAL_PRESETS = [
  { id: 'summer', name: 'Yaz Gündönümü', maxAngle: 73, icon: '☀️' },
  { id: 'equinox', name: 'Ekinoks', maxAngle: 50, icon: '⛅' },
  { id: 'winter', name: 'Kış Gündönümü', maxAngle: 26, icon: '❄️' },
];

export const ShadowCalculator: React.FC = () => {
  const [shadowLength, setShadowLength] = useState<number>(5);
  const [sunAngle, setSunAngle] = useState<number>(45);
  const [objectHeight, setObjectHeight] = useState<number>(0);
  const [timeEstimate, setTimeEstimate] = useState<string>('');
  
  const { addObject } = useStore();

  useEffect(() => {
    if (shadowLength > 0 && sunAngle > 0) {
      const radians = sunAngle * (Math.PI / 180);
      const calculatedHeight = shadowLength * Math.tan(radians);
      setObjectHeight(calculatedHeight);

      if (sunAngle > 70) setTimeEstimate('Öğle (12:00 - 13:30)');
      else if (sunAngle > 45) setTimeEstimate('Kuşluk / İkindi (10:00-11:30 veya 14:30-16:00)');
      else if (sunAngle > 20) setTimeEstimate('Sabah / Akşamüstü (08:30-10:00 veya 16:00-17:30)');
      else setTimeEstimate('Gün Doğumu / Batımı (Yakın Saatler)');
    }
  }, [shadowLength, sunAngle]);

  const handleAddToCanvas = () => {
    addObject({
      type: 'text',
      text: `GÖLGE ANALİZİ\n-------------------\nGölge Boyu: ${shadowLength}m\nGüneş Açısı: ${sunAngle}°\nNesne Yüksekliği: ${objectHeight.toFixed(2)}m\nTahmini Zaman Dilimi: ${timeEstimate}`,
      x: 300,
      y: 300,
      width: 220,
      fontSize: 12,
      fill: '#000000',
      fontFamily: 'Inter',
      fontStyle: 'bold'
    });
  };

  return (
    <div className="space-y-6 p-1 relative">
      <HelpTooltip 
        title="Gölge ve Zaman Analizi"
        description="Nesne gölgesi ve güneş açısından yola çıkarak nesne boyunu veya olay saatini saptar."
        formula="H = S * tan(θ)"
        usage="Gölge boyunu girin ve güneşin açısını (veya mevsim referansını) seçin. Tahmini zaman dilimi otomatik olarak belirecektir."
      />
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Calendar size={12} className="text-[#F5C518]" />
            Mevsimsel Referans (Türkiye)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SEASONAL_PRESETS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSunAngle(s.maxAngle)}
                className="flex flex-col items-center gap-1 p-2 bg-[#1a1a1a] border border-[#333] rounded-xl hover:border-[#F5C518]/50 transition-all group"
              >
                <span className="text-xs">{s.icon}</span>
                <span className="text-[7px] font-black text-gray-500 uppercase text-center leading-tight">
                  {s.name.split(' ')[0]}<br/>{s.name.split(' ')[1] || ''}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Ruler size={12} className="text-[#F5C518]" />
            Gölge Boyu (Metre)
          </label>
          <input
            type="number"
            value={shadowLength}
            onChange={(e) => setShadowLength(Math.max(0, Number(e.target.value)))}
            className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all font-mono"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Sun size={12} className="text-[#F5C518]" />
            Güneş Açısı (°): {sunAngle}°
          </label>
          <input
            type="range"
            min="1"
            max="89"
            step="1"
            value={sunAngle}
            onChange={(e) => setSunAngle(parseInt(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
          />
        </div>

        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="relative z-10 space-y-6">
            <div className="space-y-1 text-center">
              <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">TAHMİNİ NESNE BOYU</div>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-6xl font-black text-white tracking-tighter">{objectHeight.toFixed(2)}</span>
                <span className="text-xl font-bold text-[#F5C518]">M</span>
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-[9px] text-gray-500 uppercase font-bold tracking-widest">
                <Clock size={12} className="text-[#F5C518]" />
                OLAY ANI ZAMAN TAHMİNİ
              </div>
              <div className="text-xs font-bold text-gray-200">
                {timeEstimate}
              </div>
            </div>

            <button
              onClick={handleAddToCanvas}
              className="w-full flex items-center justify-center gap-2 py-4 bg-[#F5C518] text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#ffcf24] transition-all shadow-lg active:scale-95"
            >
              <PlusCircle size={14} />
              ANALİZİ RAPORA EKLE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
