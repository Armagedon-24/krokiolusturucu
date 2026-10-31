import React, { useState } from 'react';
import {
  Zap,
  GitMerge,
  Spline,
  Footprints,
  Gauge,
  Hammer,
  Bike,
  Eye,
  Table2,
  Droplets,
  Target,
  Flame,
  Sun,
  Thermometer,
  Activity,
  Car,
  Crosshair,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { EXAMPLE_TOPICS, type ExampleCase } from '../../../data/exampleCases';

/** Veri dosyasındaki ikon adlarını bileşenlere eşler. */
const ICONS: Record<string, React.ReactNode> = {
  Zap: <Zap size={14} />,
  GitMerge: <GitMerge size={14} />,
  Spline: <Spline size={14} />,
  Footprints: <Footprints size={14} />,
  Gauge: <Gauge size={14} />,
  Hammer: <Hammer size={14} />,
  Bike: <Bike size={14} />,
  Eye: <Eye size={14} />,
  Table2: <Table2 size={14} />,
  Droplets: <Droplets size={14} />,
  Target: <Target size={14} />,
  Flame: <Flame size={14} />,
  Sun: <Sun size={14} />,
  Thermometer: <Thermometer size={14} />,
  Activity: <Activity size={14} />,
  Car: <Car size={14} />,
  Crosshair: <Crosshair size={14} />,
};

/**
 * ÖRNEK OLAYLAR — eski "Animasyonlar" sekmesinin yerine geçer.
 * 18 hesaplayıcı konusunun her biri için 5 farklı senaryoda örnek olay sunar;
 * her örnek tuvale hesaplayıcılarla aynı biçimde kısa özet (yalnızca metin) olarak aktarılır.
 */
export const ExampleCaseIndex: React.FC = () => {
  const [activeId, setActiveId] = useState(EXAMPLE_TOPICS[0].id);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { addObject, addNotification } = useStore();

  const topic = EXAMPLE_TOPICS.find((t) => t.id === activeId) ?? EXAMPLE_TOPICS[0];

  const handleTransfer = (c: ExampleCase) => {
    // Hesaplayıcılarla aynı kural: tuvale yalnızca KISA ÖZET METNİ eklenir (şema yok).
    // Biçem: ilk 2 girdi + ilk 2 sonuç ('anahtar: değer' satırları).
    const lines = [...c.inputs.slice(0, 2), ...c.results.slice(0, 2)];
    addObject({
      type: 'text',
      text: lines.join('\n'),
      x: 200,
      y: 300,
      width: 340,
      fontSize: 10,
      fill: '#000000',
      fontFamily: 'Inter',
      fontStyle: 'bold',
    });
    addNotification({ type: 'success', message: 'Kısa özet tuvale aktarıldı' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Konu Seçici */}
      <div className="p-3 border-b border-[#2a2a2a] bg-[#111] sticky top-0 z-30 overflow-visible">
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#1e1e1e] border border-[#333] rounded-xl hover:border-[#F5C518]/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="text-[#F5C518]">{ICONS[topic.icon] ?? <FileText size={14} />}</div>
              <div className="text-left">
                <div className="text-[10px] font-black text-gray-200 uppercase tracking-widest">{topic.name}</div>
                <div className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">{topic.group}</div>
              </div>
            </div>
            <ChevronDown size={14} className={`text-gray-500 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMenuOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl z-[500] animate-in fade-in slide-in-from-top-2 duration-200 max-h-[400px] overflow-y-auto custom-scrollbar">
              <div className="py-2">
                {EXAMPLE_TOPICS.map((t) => (
                  <button
                    key={t.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveId(t.id);
                      setIsMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
                      activeId === t.id
                        ? 'bg-[#F5C518] text-black'
                        : 'hover:bg-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className={activeId === t.id ? 'text-black' : 'text-[#F5C518]'}>
                      {ICONS[t.icon] ?? <FileText size={14} />}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider">{t.name}</span>
                    <span className={`ml-auto text-[8px] font-bold uppercase tracking-wider ${activeId === t.id ? 'text-black/60' : 'text-gray-600'}`}>
                      {t.group}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Konu açıklaması */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-[9px] text-gray-500 leading-relaxed">{topic.desc}</p>
      </div>

      {/* Örnek olay kartları */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-6 space-y-3">
        {topic.cases.map((c, idx) => (
          <div key={c.id} className="bg-[#1e1e1e] border border-[#333] rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#F5C518] text-black text-[10px] font-black flex items-center justify-center mt-0.5">
                {idx + 1}
              </span>
              <h4 className="text-[11px] font-black text-white leading-snug">{c.title}</h4>
            </div>

            <p className="text-[10px] text-gray-400 leading-relaxed">{c.scenario}</p>

            <div className="space-y-1">
              <span className="block text-[8px] font-black text-gray-500 uppercase tracking-widest">Girdiler</span>
              {c.inputs.map((l, i) => (
                <div key={i} className="text-[10px] text-gray-300 font-mono leading-snug">{l}</div>
              ))}
            </div>

            <div className="bg-[#111] border border-[#333] rounded-xl p-2.5 space-y-1">
              <span className="block text-[8px] font-black text-[#F5C518] uppercase tracking-widest">Sonuçlar</span>
              {c.results.map((l, i) => (
                <div key={i} className="text-[10px] font-bold text-gray-100 leading-snug">{l}</div>
              ))}
            </div>

            {c.note && (
              <p className="text-[9px] italic text-gray-500 leading-snug border-l-2 border-[#F5C518]/40 pl-2">{c.note}</p>
            )}

            <button
              onClick={() => handleTransfer(c)}
              className="w-full py-2.5 bg-[#F5C518] text-black rounded-xl text-[10px] font-black tracking-wider hover:bg-[#ffd54d] transition-colors flex items-center justify-center gap-1.5"
              title="Örneğin kısa özetini tuvale aktarır (yalnızca metin)"
            >
              TUVALE AKTAR
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
