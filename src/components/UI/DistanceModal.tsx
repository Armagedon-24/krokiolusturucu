import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface DistanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  initialValue: string;
  title: string;
  unit?: string;
}

export const DistanceModal: React.FC<DistanceModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialValue,
  title,
  unit = 'cm'
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center px-4 py-8 sm:py-12">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-[#1a1a1a] border border-[#2a2a2a] w-full max-w-md flex flex-col rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2a2a2a] flex items-center justify-between bg-[#1f1f1f]">
          <h3 className="text-sm font-bold text-gray-100 tracking-wide uppercase">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-white hover:bg-white/5 rounded-md transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-8 space-y-4">
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 ml-1">
              ÖLÇÜLEN MESAFE ({unit})
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onConfirm(value);
                  }
                  if (e.key === 'Escape') onClose();
                }}
                placeholder="0"
                className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-lg font-bold text-white focus:border-[#F5C518]/50 focus:ring-1 focus:ring-[#F5C518]/50 outline-none transition-all placeholder:text-gray-700"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-700 font-bold">
                {unit}
              </div>
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
            onClick={() => onConfirm(value)}
            className="px-6 py-2 bg-[#F5C518] hover:bg-[#E2B616] text-black text-xs font-black rounded-md transition-all shadow-lg active:scale-95"
          >
            KAYDET
          </button>
        </div>
      </div>
    </div>
  );
};
