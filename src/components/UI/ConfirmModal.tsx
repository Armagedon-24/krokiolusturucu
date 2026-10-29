import React from 'react';
import { useStore } from '../../store/useStore';
import { AlertCircle, X } from 'lucide-react';

export const ConfirmModal: React.FC = () => {
  const { confirmDialog, hideConfirm } = useStore();

  if (!confirmDialog.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-[#111] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="relative p-8">
          {/* Decorative Background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#F5C518]/10 blur-[60px] rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <div className="flex flex-col items-center text-center gap-6 relative">
            <div className="w-20 h-20 bg-[#F5C518]/10 rounded-3xl flex items-center justify-center border border-[#F5C518]/20 shadow-xl shadow-[#F5C518]/5">
              <AlertCircle className="text-[#F5C518]" size={40} />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white uppercase tracking-widest italic">{confirmDialog.title}</h3>
              <p className="text-sm font-medium text-gray-400 leading-relaxed">
                {confirmDialog.message}
              </p>
            </div>

            <div className="flex flex-col w-full gap-3 mt-4">
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  hideConfirm();
                }}
                className="w-full py-4 bg-[#F5C518] hover:bg-[#E2B616] text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-[#F5C518]/20"
              >
                EVET, DEVAM ET
              </button>
              <button
                onClick={() => {
                  if (confirmDialog.onCancel) confirmDialog.onCancel();
                  hideConfirm();
                }}
                className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl border border-white/5 transition-all"
              >
                İPTAL
              </button>
            </div>
          </div>

          <button 
            onClick={hideConfirm}
            className="absolute top-6 right-6 p-2 text-gray-600 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
