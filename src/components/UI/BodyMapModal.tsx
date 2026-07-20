import React, { useState } from 'react';
import { X, User, Trash2, Info, Save } from 'lucide-react';
import type { CanvasObject } from '../../types';

interface BodyMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  object: CanvasObject | null;
  onUpdateInjuries: (injuries: { x: number, y: number, type: string }[]) => void;
}

const INJURY_TYPES = [
  'Ateşli Silah Giriş Yarası',
  'Ateşli Silah Çıkış Yarası',
  'Kesici/Delici Alet Yarası',
  'Ekimoz/Morluk',
  'Sıyrık/Aşınma',
  'Laserasyon/Yırtılma',
  'Darp İzi',
  'Yanık',
  'Diğer'
];

export const BodyMapModal: React.FC<BodyMapModalProps> = ({
  isOpen,
  onClose,
  object,
  onUpdateInjuries
}) => {
  const [selectedInjury, setSelectedInjury] = useState<number | null>(null);
  
  if (!isOpen || !object) return null;

  const injuries = object.injuries || [];

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newInjury = { x, y, type: INJURY_TYPES[0], notes: '' };
    const updatedInjuries = [...injuries, newInjury];
    onUpdateInjuries(updatedInjuries);
    setSelectedInjury(updatedInjuries.length - 1);
  };

  const updateInjury = (index: number, updates: Partial<any>) => {
    const updated = [...injuries];
    updated[index] = { ...updated[index], ...updates };
    onUpdateInjuries(updated);
  };

  const deleteInjury = (index: number) => {
    const updated = injuries.filter((_, i) => i !== index);
    onUpdateInjuries(updated);
    setSelectedInjury(null);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center px-4 py-8">
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      <div className="relative bg-[#1a1a1a] border border-[#2a2a2a] w-full max-w-5xl max-h-[90vh] flex flex-col rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2a2a2a] flex items-center justify-between bg-[#1f1f1f]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <User className="text-red-500" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-100 tracking-wide uppercase">
                ADLİ VÜCUT HARİTALAMA VE ANALİZ
              </h3>
              <p className="text-[10px] text-gray-500 font-medium">Yaralanma türlerini ve detaylı tıbbi bulguları şema üzerinde işaretleyin</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-white hover:bg-white/5 rounded-md transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden bg-[#111]">
          {/* Left: Interactive Map */}
          <div className="flex-1 relative bg-white/5 p-8 flex items-center justify-center overflow-auto custom-scrollbar">
            <div 
              className="relative w-[300px] aspect-[1/2] bg-contain bg-no-repeat bg-center cursor-crosshair select-none"
              style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200" fill="none" stroke="%23F5C518" stroke-width="2" stroke-linecap="round"><circle cx="50" cy="22" r="14"/><path d="M50 36 v64 M50 50 L20 90 M50 50 L80 90 M50 100 L28 185 M50 100 L72 185"/><path d="M42 60 h16 M44 75 h12"/></svg>')`, opacity: 0.85 }}
              onClick={handleCanvasClick}
            >
              {/* Injury Markers */}
              {injuries.map((injury, index) => (
                <div
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedInjury(index);
                  }}
                  className={`absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 shadow-lg transition-all transform hover:scale-125 cursor-pointer flex items-center justify-center text-[9px] font-black ${
                    selectedInjury === index 
                      ? 'bg-red-500 border-white text-white animate-pulse z-10' 
                      : 'bg-white border-red-500 text-red-500 z-0'
                  }`}
                  style={{ left: `${injury.x}%`, top: `${injury.y}%` }}
                >
                  {index + 1}
                </div>
              ))}
            </div>
            <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md p-2 rounded border border-white/10">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                Şema üzerine tıklayarak yeni bulgu ekleyin
              </p>
            </div>
          </div>

          {/* Right: Info Panel */}
          <div className="w-96 border-l border-[#2a2a2a] bg-[#1a1a1a] flex flex-col">
            <div className="p-4 border-b border-[#2a2a2a] bg-[#1f1f1f] flex items-center justify-between">
              <h4 className="text-[10px] font-black text-[#F5C518] uppercase tracking-wider">BULGU ANALİZ PANELİ</h4>
              <span className="text-[10px] font-bold text-gray-500">{injuries.length} TOPLAM</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {injuries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                  <Info size={40} className="mb-3" />
                  <p className="text-sm font-medium">Henüz işaretlenmiş bulgu yok.</p>
                  <p className="text-[10px] mt-2">Vücut şeması üzerine tıklayarak<br/>başlayabilirsiniz.</p>
                </div>
              ) : (
                injuries.map((injury, index) => (
                  <div 
                    key={index}
                    onClick={() => setSelectedInjury(index)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedInjury === index 
                        ? 'bg-red-500/5 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' 
                        : 'bg-[#111] border-[#333] hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
                          selectedInjury === index ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-400'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-tighter">BULGU DETAYI</span>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteInjury(index);
                        }}
                        className="p-1 hover:bg-red-500/20 text-gray-600 hover:text-red-500 rounded transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {selectedInjury === index ? (
                      <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div>
                          <label className="text-[9px] font-bold text-gray-500 uppercase mb-1 block">Yaralanma Türü</label>
                          <select
                            value={injury.type}
                            onChange={(e) => updateInjury(index, { type: e.target.value })}
                            className="w-full bg-[#111] border border-[#444] rounded-lg p-2 text-[11px] text-white outline-none focus:border-red-500/50"
                          >
                            {INJURY_TYPES.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-500 uppercase mb-1 block">Tıbbi Notlar / Detaylar</label>
                          <textarea
                            value={injury.notes || ''}
                            onChange={(e) => updateInjury(index, { notes: e.target.value })}
                            placeholder="Yara boyutları, derinliği veya diğer tıbbi gözlemleri buraya yazın..."
                            className="w-full bg-[#111] border border-[#444] rounded-lg p-3 text-[11px] text-white outline-none focus:border-red-500/50 h-24 resize-none leading-relaxed"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-red-500/80">{injury.type}</p>
                        <p className="text-[10px] text-gray-500 line-clamp-2 italic">{injury.notes || 'Not eklenmemiş...'}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {injuries.length > 0 && (
              <div className="p-4 bg-[#1f1f1f] border-t border-[#2a2a2a]">
                <button 
                  onClick={onClose}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/20 active:scale-95"
                >
                  <Save size={14} />
                  ANALİZİ TAMAMLA VE KAYDET
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
