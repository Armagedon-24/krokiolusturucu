import React from 'react';
import { useStore } from '../../store/useStore';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export const NotificationSystem: React.FC = () => {
  const { notifications, removeNotification } = useStore();

  const icons = {
    success: <CheckCircle2 size={18} className="text-[#F5C518]" />,
    error: <AlertCircle size={18} className="text-red-500" />,
    warning: <AlertTriangle size={18} className="text-orange-500" />,
    info: <Info size={18} className="text-[#F5C518]" />,
  };

  const bgColors = {
    success: 'bg-[#1a1a1a]/95 border-[#F5C518]/50 shadow-[#F5C518]/10',
    error: 'bg-[#1a1a1a]/95 border-red-500/50 shadow-red-500/10',
    warning: 'bg-[#1a1a1a]/95 border-orange-500/50 shadow-orange-500/10',
    info: 'bg-[#1a1a1a]/95 border-[#F5C518]/50 shadow-[#F5C518]/10',
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full notification-system">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`pointer-events-auto p-4 rounded-xl border shadow-2xl backdrop-blur-xl flex items-start gap-3 animate-in slide-in-from-right-full duration-500 hover:scale-[1.02] transition-transform ${bgColors[n.type]}`}
        >
          <div className="mt-0.5 flex-shrink-0 bg-white/5 p-1.5 rounded-lg border border-white/5">{icons[n.type]}</div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-white tracking-tight">{n.message}</h4>
            {n.description && (
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed font-medium">
                {n.description}
              </p>
            )}
          </div>
          <button
            onClick={() => removeNotification(n.id)}
            className="mt-0.5 text-gray-500 hover:text-white hover:bg-white/5 rounded p-1 transition-all flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
