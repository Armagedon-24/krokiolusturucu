import React, { useState, useEffect } from 'react';
import { X, Ruler, Check } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface ScaleCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScaleCalibrationModal: React.FC<ScaleCalibrationModalProps> = ({ isOpen, onClose }) => {
  const { scaleCalibration, setScaleCalibration } = useStore();

  const [pixelDistance, setPixelDistance] = useState(String(scaleCalibration.pixelDistance));
  const [realDistance, setRealDistance] = useState(String(scaleCalibration.realDistance));
  const [unit, setUnit] = useState(scaleCalibration.unit);

  useEffect(() => {
    if (isOpen) {
      setPixelDistance(String(scaleCalibration.pixelDistance));
      setRealDistance(String(scaleCalibration.realDistance));
      setUnit(scaleCalibration.unit);
    }
  }, [isOpen, scaleCalibration]);

  const handleSave = () => {
    const px = parseFloat(pixelDistance);
    const real = parseFloat(realDistance);
    if (isNaN(px) || px <= 0 || isNaN(real) || real <= 0) return;

    setScaleCalibration({ pixelDistance: px, realDistance: real, unit });
    onClose();
  };

  const scaleRatio = scaleCalibration.realDistance / scaleCalibration.pixelDistance;

  const presetScales = [
    { label: 'Varsayılan (2cm/px)', pixel: 50, real: 100, unit: 'cm' },
    { label: 'Hassas (1cm/px)', pixel: 100, real: 100, unit: 'cm' },
    { label: 'Genel Görünüm (5cm/px)', pixel: 20, real: 100, unit: 'cm' },
    { label: 'İnç (1in/px)', pixel: 96, real: 1, unit: 'in' },
    { label: 'Metrik (1m/px)', pixel: 100, real: 1, unit: 'm' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center px-4 py-8 sm:py-12">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative bg-[#1a1a1a] border border-[#2a2a2a] w-full max-w-lg flex flex-col rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2a2a2a] flex items-center justify-between bg-[#1f1f1f]">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-[#F5C518]/10 rounded-lg border border-[#F5C518]/20">
              <Ruler size={18} className="text-[#F5C518]" />
            </div>
            <h3 className="text-sm font-bold text-gray-100 tracking-wide uppercase">Ölçek Kalibrasyonu</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-white hover:bg-white/5 rounded-md transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-6">
          {/* Current Scale Info */}
          <div className="bg-[#111] border border-[#333] rounded-lg p-4 space-y-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Mevcut Ölçek</span>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[#0a0a0a] rounded px-3 py-2 border border-[#2a2a2a]">
                <span className="text-lg font-black text-[#F5C518] font-mono">
                  1 px = {(scaleRatio).toFixed(4)} {scaleCalibration.unit}
                </span>
              </div>
            </div>
          </div>

          {/* Preset Scales */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Hazır Ölçekler</span>
            <div className="grid grid-cols-1 gap-1.5">
              {presetScales.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setPixelDistance(String(preset.pixel));
                    setRealDistance(String(preset.real));
                    setUnit(preset.unit);
                  }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all text-xs ${
                    parseFloat(pixelDistance) === preset.pixel &&
                    parseFloat(realDistance) === preset.real &&
                    unit === preset.unit
                      ? 'bg-[#F5C518]/10 border-[#F5C518]/40 text-[#F5C518]'
                      : 'bg-[#111] border-[#333] text-gray-400 hover:border-[#555] hover:text-gray-200'
                  }`}
                >
                  <Ruler size={14} className="shrink-0" />
                  <span className="font-bold">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Manual Calibration Inputs */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Manuel Kalibrasyon</span>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-bold text-gray-600 uppercase tracking-wide ml-1">
                  Ekrandaki Mesafe (px)
                </label>
                <input
                  type="number"
                  value={pixelDistance}
                  onChange={(e) => setPixelDistance(e.target.value)}
                  min="1"
                  step="1"
                  className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:border-[#F5C518]/50 focus:ring-1 focus:ring-[#F5C518]/50 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[9px] font-bold text-gray-600 uppercase tracking-wide ml-1">
                  Gerçek Mesafe ({unit})
                </label>
                <input
                  type="number"
                  value={realDistance}
                  onChange={(e) => setRealDistance(e.target.value)}
                  min="1"
                  step="1"
                  className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:border-[#F5C518]/50 focus:ring-1 focus:ring-[#F5C518]/50 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="100"
                />
              </div>
            </div>
          </div>

          {/* Unit Selector */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-bold text-gray-600 uppercase tracking-wide ml-1">Birim</label>
            <div className="flex gap-2">
              {['cm', 'm', 'in', 'ft'].map((u) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-all ${
                    unit === u
                      ? 'bg-[#F5C518]/10 border-[#F5C518]/40 text-[#F5C518]'
                      : 'bg-[#111] border-[#333] text-gray-500 hover:border-[#555]'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Visual Guide */}
          <div className="bg-[#111] border border-[#333] rounded-lg p-4">
            <div className="flex items-center gap-3 text-[10px] text-gray-500">
              <div className="flex-1 h-4 bg-[#F5C518]/20 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-[#F5C518] rounded-full transition-all"
                  style={{ width: `${Math.min(100, (parseFloat(pixelDistance) || 50) / 2)}%` }}
                />
              </div>
              <span className="font-mono font-bold text-gray-400 w-16 text-right">
                {parseFloat(pixelDistance) || 50}px
              </span>
              <span className="text-gray-600">=</span>
              <span className="font-mono font-bold text-[#F5C518] w-16">
                {parseFloat(realDistance) || 100} {unit}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-[#1f1f1f] border-t border-[#2a2a2a] flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-300 transition-colors"
          >
            İPTAL
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-[#F5C518] hover:bg-[#E2B616] text-black text-xs font-black rounded-md transition-all shadow-lg active:scale-95"
          >
            <Check size={14} />
            KALİBRE ET
          </button>
        </div>
      </div>
    </div>
  );
};
