import React, { useState, useEffect } from 'react';
import { Droplets, Ruler, Info, PlusCircle, Target, ArrowUpCircle } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';

export const BloodstainCalculator: React.FC = () => {
  const [width, setWidth] = useState<number>(5);
  const [length, setLength] = useState<number>(10);
  const [distanceToSource, setDistanceToSource] = useState<number>(1.5);
  const [angle, setAngle] = useState<number>(0);
  const [originHeight, setOriginHeight] = useState<number>(0);
  
  const { addObject } = useStore();

  useEffect(() => {
    if (width > 0 && length > 0 && width <= length) {
      const radians = Math.asin(width / length);
      const degrees = radians * (180 / Math.PI);
      setAngle(degrees);

      // Origin Height Calculation: H = D * tan(alpha)
      if (distanceToSource > 0) {
        const h = distanceToSource * Math.tan(radians);
        setOriginHeight(h);
      }
    } else {
      setAngle(0);
      setOriginHeight(0);
    }
  }, [width, length, distanceToSource]);

  const handleAddToCanvas = () => {
    addObject({
      type: 'text',
      text: `KAN SIÇRAMA ANALİZİ (BPA)\n-------------------\nDamla Genişliği: ${width}mm\nDamla Uzunluğu: ${length}mm\nÇarpma Açısı (α): ${angle.toFixed(1)}°\nKaynak Mesafesi: ${distanceToSource}m\nKAYNAK YÜKSEKLİĞİ: ${originHeight.toFixed(2)}m`,
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
        title="Kan Sıçrama Analizi (BPA)"
        description="Kan lekelerinin boyutlarından çarpma açısını ve kaynağın (yara/darbe) yerden yüksekliğini hesaplar."
        formula="α = arcsin(W/L) | H = D * tan(α)"
        usage="Lekenin enini (W) ve boyunu (L) mm cinsinden girin. Kaynak mesafesini (D) metre olarak belirleyerek yüksekliği (H) bulun."
      />
      <div className="space-y-4">
        {/* Dimensions */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
              <Droplets size={12} className="text-red-500" />
              Genişlik (W)
            </label>
            <div className="relative">
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(Math.max(0, Number(e.target.value)))}
                className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-red-500/50 outline-none transition-all font-mono"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">mm</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
              <Ruler size={12} className="text-[#F5C518]" />
              Uzunluk (L)
            </label>
            <div className="relative">
              <input
                type="number"
                value={length}
                onChange={(e) => setLength(Math.max(0, Number(e.target.value)))}
                className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all font-mono"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">mm</span>
            </div>
          </div>
        </div>

        {/* Distance to convergence point */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 text-gray-400">
            <Target size={12} className="text-blue-500" />
            Yakınsama Noktasına Mesafe (Metre)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              value={distanceToSource}
              onChange={(e) => setDistanceToSource(Math.max(0, Number(e.target.value)))}
              className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all font-mono"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">M</span>
          </div>
          <p className="text-[8px] text-gray-600 italic">
            * Kan lekesinin yüzeydeki izdüşümünden, kanın çıktığı varsayılan yatay mesafe.
          </p>
        </div>

        {/* Results Card */}
        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">ÇARPMA AÇISI (α)</div>
                <div className="flex items-center gap-2">
                  <span className="text-4xl font-black text-white tracking-tighter">{angle.toFixed(1)}</span>
                  <span className="text-xl font-black text-red-600">°</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full border-2 border-red-900/30 flex items-center justify-center relative overflow-hidden">
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-red-600/20 transition-all duration-500"
                  style={{ height: `${(angle / 90) * 100}%` }}
                />
                <Droplets size={20} className="text-red-600 relative z-10" />
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-[9px] text-gray-500 uppercase font-black tracking-widest">
                <ArrowUpCircle size={12} className="text-green-500" />
                TAHMİNİ KAYNAK YÜKSEKLİĞİ (H)
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-green-500 tracking-tighter">
                  {originHeight.toFixed(2)}
                </span>
                <span className="text-sm font-bold text-gray-600 uppercase">Metre</span>
              </div>
            </div>

            <button
              onClick={handleAddToCanvas}
              className="w-full flex items-center justify-center gap-2 py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg active:scale-95 mt-2"
            >
              <PlusCircle size={14} />
              ANALİZİ RAPORA EKLE
            </button>
          </div>
        </div>

        <div className="p-4 bg-[#111]/80 border border-red-500/10 rounded-2xl flex gap-3 items-start shadow-inner">
          <Info size={16} className="text-red-900 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-red-200/50 uppercase">TEKNİK NOT</p>
            <p className="text-[8px] text-gray-600 leading-relaxed italic">
              Sinüs yasası ($\sin\alpha = W/L$) kullanılmıştır. Kaynak yüksekliği, yakınsama noktası (convergence point) ve çarpma açısının trigonometrik birleşimi ile hesaplanır.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

