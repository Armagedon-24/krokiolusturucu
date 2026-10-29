import React, { useState } from 'react';
import {
  AlertTriangle,
  Activity,
  ChevronDown,
  Zap,
  Crosshair,
} from 'lucide-react';
import { AccidentReconstructionCalculator } from '../Calculators/AccidentReconstructionCalculator';
import { FallCalculator } from '../FallCalculator';
import { PedestrianLaunchCalculator } from '../Calculators/PedestrianLaunchCalculator';
import { ShotDirectionCalculator } from '../Calculators/ShotDirectionCalculator';

type AnimationType = 'accident' | 'fall' | 'pedestrianLaunch' | 'shotDirection';

export const AnimationIndex: React.FC = () => {
  const [activeAnim, setActiveAnim] = useState<AnimationType>('accident');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const animations = [
    { id: 'accident' as const, name: 'Kaza Yeniden Canlandırma', icon: <AlertTriangle size={14} />, component: <AccidentReconstructionCalculator /> },
    { id: 'fall' as const, name: 'Yüksekten Düşme Analizi', icon: <Activity size={14} />, component: <FallCalculator /> },
    { id: 'pedestrianLaunch' as const, name: 'Yaya Fırlatma Analizi', icon: <Zap size={14} />, component: <PedestrianLaunchCalculator /> },
    { id: 'shotDirection' as const, name: 'Atış Yönü Tespiti', icon: <Crosshair size={14} />, component: <ShotDirectionCalculator /> },
  ];

  const activeAnimation = animations.find(a => a.id === activeAnim);

  return (
    <div className="flex flex-col h-full">
      {/* Dropdown Selector */}
      <div className="p-3 border-b border-[#2a2a2a] bg-[#111] sticky top-0 z-50 overflow-visible">
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#1e1e1e] border border-[#333] rounded-xl hover:border-[#F5C518]/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="text-[#F5C518]">
                {activeAnimation?.icon}
              </div>
              <span className="text-[10px] font-black text-gray-200 uppercase tracking-widest">
                {activeAnimation?.name}
              </span>
            </div>
            <ChevronDown size={14} className={`text-gray-500 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMenuOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl z-[500] animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
              <div className="py-2">
                {animations.map((anim) => (
                  <button
                    key={anim.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveAnim(anim.id);
                      setIsMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                      activeAnim === anim.id 
                        ? 'bg-[#F5C518] text-black' 
                        : 'hover:bg-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className={activeAnim === anim.id ? 'text-black' : 'text-[#F5C518]'}>
                      {anim.icon}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider">{anim.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Animation Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeAnimation?.component}
      </div>
    </div>
  );
};
