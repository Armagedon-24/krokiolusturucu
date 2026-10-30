import React, { useState } from 'react';
import { 
  Zap, 
  Droplets, 
  Target, 
  Sun, 
  Thermometer,
  ChevronDown,
  GitMerge,
  Flame,
  Spline,
  Footprints,
  Gauge,
  Hammer,
  Bike,
  Eye,
  Table2,
} from 'lucide-react';
import { SkidMarkCalculator } from './SkidMarkCalculator';
import { BloodstainCalculator } from './BloodstainCalculator';
import { BulletTrajectoryCalculator } from './BulletTrajectoryCalculator';
import { ShadowCalculator } from './ShadowCalculator';
import { AlgorMortisCalculator } from './AlgorMortisCalculator';
import { CollisionSpeedCalculator } from './CollisionSpeedCalculator';
import { GunshotDistanceCalculator } from './GunshotDistanceCalculator';
import { YawMarkCalculator } from './YawMarkCalculator';
import { PedestrianThrowCalculator } from './PedestrianThrowCalculator';
import { StoppingDistanceCalculator } from './StoppingDistanceCalculator';
import { CrushEnergyCalculator } from './CrushEnergyCalculator';
import { MotorcycleSlideCalculator } from './MotorcycleSlideCalculator';
import { SightDistanceCalculator } from './SightDistanceCalculator';
import { FrictionTableCalculator } from './FrictionTableCalculator';

type CalculatorType =
  | 'skid'
  | 'collision'
  | 'bloodstain'
  | 'bullet'
  | 'gunshot'
  | 'shadow'
  | 'algor'
  | 'yaw'
  | 'pedestrian'
  | 'stopping'
  | 'crush'
  | 'moto'
  | 'sight'
  | 'friction';

export const CalculatorIndex: React.FC = () => {
  const [activeCalc, setActiveCalc] = useState<CalculatorType>('skid');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const calculators = [
    { id: 'skid', name: 'Fren İzi / Hız', icon: <Zap size={14} />, component: <SkidMarkCalculator /> },
    { id: 'collision', name: 'Çarpışma Hızı (Momentum)', icon: <GitMerge size={14} />, component: <CollisionSpeedCalculator /> },
    { id: 'yaw', name: 'Yayılma İzi (Kritik Hız)', icon: <Spline size={14} />, component: <YawMarkCalculator /> },
    { id: 'pedestrian', name: 'Yaya Fırlatma (Searle)', icon: <Footprints size={14} />, component: <PedestrianThrowCalculator /> },
    { id: 'stopping', name: 'Toplam Durma Mesafesi', icon: <Gauge size={14} />, component: <StoppingDistanceCalculator /> },
    { id: 'crush', name: 'Deformasyon Enerjisi (CRASH3)', icon: <Hammer size={14} />, component: <CrushEnergyCalculator /> },
    { id: 'moto', name: 'Motosiklet Kayma Analizi', icon: <Bike size={14} />, component: <MotorcycleSlideCalculator /> },
    { id: 'sight', name: 'Görüş Üçgeni / Kavşak', icon: <Eye size={14} />, component: <SightDistanceCalculator /> },
    { id: 'friction', name: 'Zemin μ Referans Tablosu', icon: <Table2 size={14} />, component: <FrictionTableCalculator /> },
    { id: 'bloodstain', name: 'Kan Sıçrama (BPA)', icon: <Droplets size={14} />, component: <BloodstainCalculator /> },
    { id: 'bullet', name: 'Atış Yönü / Atış Mesafesi', icon: <Target size={14} />, component: <BulletTrajectoryCalculator /> },
    { id: 'gunshot', name: 'Atış Mesafesi (Barut İzi)', icon: <Flame size={14} />, component: <GunshotDistanceCalculator /> },
    { id: 'shadow', name: 'Gölge / Zaman', icon: <Sun size={14} />, component: <ShadowCalculator /> },
    { id: 'algor', name: 'Ölüm Saati (Vücut Isısı)', icon: <Thermometer size={14} />, component: <AlgorMortisCalculator /> },
  ];

  const activeCalculator = calculators.find(c => c.id === activeCalc);

  return (
    <div className="flex flex-col h-full">
      {/* Dropdown Selector — z-30: sonuç kartlarındaki 'relative z-10' içeriklerin
          ÜSTÜNDE kalmalı; aksi halde açılan menü, sonuç bandı ve butonların altında kalır.
          (HelpTooltip popup z-100 ve modal'lar z-9999+ hâlâ daha üstte.) */}
      <div className="p-3 border-b border-[#2a2a2a] bg-[#111] sticky top-0 z-30">
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#1e1e1e] border border-[#333] rounded-xl hover:border-[#F5C518]/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="text-[#F5C518]">
                {activeCalculator?.icon}
              </div>
              <span className="text-[10px] font-black text-gray-200 uppercase tracking-widest">
                {activeCalculator?.name}
              </span>
            </div>
            <ChevronDown size={14} className={`text-gray-500 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMenuOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl z-[500] animate-in fade-in slide-in-from-top-2 duration-200 max-h-[400px] overflow-y-auto custom-scrollbar">
              <div className="py-2">
                {calculators.map((calc) => (
                  <button
                    key={calc.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCalc(calc.id as CalculatorType);
                      setIsMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                      activeCalc === calc.id 
                        ? 'bg-[#F5C518] text-black' 
                        : 'hover:bg-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className={activeCalc === calc.id ? 'text-black' : 'text-[#F5C518]'}>
                      {calc.icon}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider">{calc.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Calculator Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeCalculator?.component}
      </div>
    </div>
  );
};
