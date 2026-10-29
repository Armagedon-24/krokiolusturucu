import React from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  title: string;
  description: string;
  formula?: string;
  usage: string;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({ title, description, formula, usage }) => {
  return (
    <div className="absolute top-4 right-4 z-50 group">
      <button className="p-1.5 rounded-full bg-white/5 border border-white/10 text-gray-500 hover:text-[#F5C518] hover:bg-[#F5C518]/10 hover:border-[#F5C518]/30 transition-all">
        <HelpCircle size={14} />
      </button>
      
      {/* Tooltip Content */}
      <div className="absolute top-0 right-8 w-64 p-4 bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-x-2 group-hover:translate-x-0 z-[100] backdrop-blur-xl">
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <HelpCircle size={14} className="text-[#F5C518]" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">{title}</span>
          </div>
          
          <div className="space-y-2">
            <div className="space-y-1">
              <span className="text-[8px] font-bold text-gray-500 uppercase">Nedir?</span>
              <p className="text-[9px] text-gray-400 leading-relaxed italic">{description}</p>
            </div>
            
            {formula && (
              <div className="space-y-1">
                <span className="text-[8px] font-bold text-gray-500 uppercase">Matematiksel Model</span>
                <div className="p-2 bg-black/30 rounded-lg font-mono text-[9px] text-[#F5C518]">
                  {formula}
                </div>
              </div>
            )}
            
            <div className="space-y-1">
              <span className="text-[8px] font-bold text-gray-500 uppercase">Nasıl Kullanılır?</span>
              <p className="text-[9px] text-gray-400 leading-relaxed">{usage}</p>
            </div>
          </div>
        </div>
        
        {/* Arrow */}
        <div className="absolute top-3 -right-1 w-2 h-2 bg-[#1a1a1a] border-r border-t border-[#333] rotate-45" />
      </div>
    </div>
  );
};
