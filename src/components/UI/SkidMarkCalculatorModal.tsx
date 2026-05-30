import React, { useState, useEffect } from 'react';
import { X, Calculator, Info, Zap, AlertTriangle, TrendingUp, Check } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface SkidMarkCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SURFACE_TYPES = [
  { name: 'Asfalt (Kuru)', min: 0.7, max: 0.8, default: 0.75 },
  { name: 'Asfalt (Islak)', min: 0.4, max: 0.6, default: 0.5 },
  { name: 'Beton (Kuru)', min: 0.8, max: 0.9, default: 0.85 },
  { name: 'Beton (Islak)', min: 0.45, max: 0.7, default: 0.6 },
  { name: 'Çakıl Yol', min: 0.5, max: 0.7, default: 0.6 },
  { name: 'Toprak Yol', min: 0.4, max: 0.6, default: 0.5 },
  { name: 'Çim', min: 0.35, max: 0.35, default: 0.35 },
  { name: 'Buz / Kar', min: 0.1, max: 0.2, default: 0.15 },
];

export const SkidMarkCalculatorModal: React.FC<SkidMarkCalculatorModalProps> = ({ isOpen: propIsOpen, onClose: propOnClose }) => {
  const { updateObject } = useStore();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [distance, setDistance] = useState<string>('');
  const [mu, setMu] = useState<number>(0.75);
  const [efficiency, setEfficiency] = useState<number>(100);
  const [result, setResult] = useState<number | null>(null);
  const [targetObjectId, setTargetObjectId] = useState<string | null>(null);

  const isOpen = propIsOpen || internalIsOpen;
  const onClose = () => {
    if (propOnClose) propOnClose();
    setInternalIsOpen(false);
    setTargetObjectId(null);
  };

  useEffect(() => {
    const handleOpen = (e: any) => {
      if (e.detail?.distance) {
        setDistance(e.detail.distance.toString());
      }
      if (e.detail?.objectId) {
        setTargetObjectId(e.detail.objectId);
      }
      setInternalIsOpen(true);
    };
    window.addEventListener('open-skid-calculator', handleOpen);
    return () => window.removeEventListener('open-skid-calculator', handleOpen);
  }, []);

  const handleApply = () => {
    if (targetObjectId) {
      updateObject(targetObjectId, { 
        mu: mu,
        efficiency: efficiency
      });
      onClose();
    }
  };

  useEffect(() => {
    const d = parseFloat(distance);
    if (!isNaN(d) && d > 0 && mu > 0) {
      // v = sqrt(2 * g * mu * d * efficiency)
      // v (km/h) = 3.6 * sqrt(2 * 9.81 * mu * d * (efficiency/100))
      // Simplified constant: 3.6 * sqrt(19.62) = 15.939...
      const speed = 15.94 * Math.sqrt(mu * d * (efficiency / 100));
      setResult(speed);
    } else {
      setResult(null);
    }
  }, [distance, mu, efficiency]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
      <div className="w-full max-w-2xl bg-[#111] border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#F5C518]/20 via-transparent to-transparent p-8 border-b border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#F5C518]/5 blur-[100px] rounded-full -mr-32 -mt-32" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-gradient-to-br from-[#F5C518] to-[#E2B616] rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(245,197,24,0.3)] transform -rotate-6">
                <Calculator className="text-black" size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-wider italic">FREN İZİNDEN HIZ HESAPLAMA</h2>
                <p className="text-[10px] text-[#F5C518] font-bold uppercase tracking-[0.2em] mt-1 opacity-80">Adli Trafik Kaza Analiz Sistemi</p>
              </div>
            </div>
            <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-white transition-all border border-white/5">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {/* Inputs Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Inputs */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Zap size={12} className="text-[#F5C518]" />
                  Fren İzi Uzunluğu (Metre)
                </label>
                <div className="relative group">
                  <input
                    type="number"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    placeholder="Örn: 25.5"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-2xl font-black text-white placeholder:text-gray-700 focus:border-[#F5C518]/50 focus:ring-4 focus:ring-[#F5C518]/10 outline-none transition-all"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-500 font-black tracking-widest text-sm">METRE</div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp size={12} className="text-[#F5C518]" />
                  Yüzey Sürtünme Katsayısı (μ)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SURFACE_TYPES.map((type) => (
                    <button
                      key={type.name}
                      onClick={() => setMu(type.default)}
                      className={`px-3 py-3 rounded-xl border text-[10px] font-black transition-all ${
                        mu === type.default 
                          ? 'bg-[#F5C518] border-[#F5C518] text-black shadow-lg shadow-[#F5C518]/20' 
                          : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      {type.name.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <input
                    type="range"
                    min="0.05"
                    max="1"
                    step="0.01"
                    value={mu}
                    onChange={(e) => setMu(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
                  />
                  <span className="text-xl font-black text-white min-w-[3rem] text-right">{mu.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle size={12} className="text-[#F5C518]" />
                  Fren Verimi (%)
                </label>
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={efficiency}
                    onChange={(e) => setEfficiency(parseInt(e.target.value))}
                    className="flex-1 h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
                  />
                  <span className="text-xl font-black text-white min-w-[3rem] text-right">%{efficiency}</span>
                </div>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter text-right">Dört tekerlek için %100 önerilir.</p>
              </div>
            </div>

            {/* Right Column: Result */}
            <div className="flex flex-col">
              <div className="flex-1 bg-gradient-to-b from-white/5 to-transparent rounded-[2rem] border border-white/5 p-8 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-[#F5C518]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="text-[10px] font-black text-[#F5C518] uppercase tracking-[0.3em] mb-4 relative z-10">TAHMİNİ HIZ</div>
                
                {result !== null ? (
                  <div className="text-center relative z-10">
                    <div className="text-[120px] font-black text-white leading-none tracking-tighter animate-in zoom-in duration-500">
                      {Math.round(result)}
                    </div>
                    <div className="text-2xl font-black text-white/40 -mt-4 uppercase italic tracking-widest">KM/SAAT</div>
                  </div>
                ) : (
                  <div className="text-center space-y-4 opacity-30 relative z-10">
                    <div className="text-[120px] font-black text-white/10 leading-none">--</div>
                    <p className="text-xs font-bold text-gray-500 uppercase">Veri Girişi Bekleniyor</p>
                  </div>
                )}

                <div className="mt-8 w-full bg-black/40 rounded-2xl p-4 border border-white/5 relative z-10">
                  <div className="flex items-center justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
                    <span>Hız Göstergesi</span>
                    <span>{result ? Math.round(result) : 0} km/s</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#F5C518] to-red-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (result || 0) / 1.8)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Formula Info */}
              <div className="mt-6 p-5 bg-[#F5C518]/5 rounded-2xl border border-[#F5C518]/10 flex items-start gap-4">
                <div className="p-2 bg-[#F5C518]/10 rounded-lg">
                  <Info size={16} className="text-[#F5C518]" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase mb-1">Hesaplama Formülü</h4>
                  <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                    V = 15.94 * √(μ * d * n) formülü kullanılmıştır. Bu hesaplama kaba bir tahmindir ve adli raporlarda uzman görüşü ile desteklenmelidir.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-white/5 border-t border-white/5 flex items-center justify-between">
          <p className="text-[9px] text-gray-600 font-bold uppercase tracking-tighter flex items-center gap-2">
            <AlertTriangle size={10} className="text-orange-500" />
            Bu hesaplama yalnızca düz yollar için geçerlidir. Eğim hesaba katılmamıştır.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black text-white uppercase tracking-widest transition-all"
            >
              Kapat
            </button>
            {targetObjectId && (
              <button
                onClick={handleApply}
                className="px-8 py-3 bg-[#F5C518] hover:bg-[#E2B616] rounded-xl text-xs font-black text-black uppercase tracking-widest transition-all shadow-lg shadow-[#F5C518]/20 flex items-center gap-2"
              >
                <Check size={14} />
                Seçilenleri Uygula
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
