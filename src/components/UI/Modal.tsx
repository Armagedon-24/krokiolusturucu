import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';


interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center px-4 py-8 sm:py-12">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div 
        ref={modalRef}
        className="relative bg-[#1a1a1a] border border-[#2a2a2a] w-full max-w-md max-h-full flex flex-col rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 fade-in duration-200"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2a2a2a] flex items-center justify-between bg-[#1f1f1f] shrink-0">
          <h3 className="text-sm font-bold text-gray-100 tracking-wide uppercase">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-white hover:bg-white/5 rounded-md transition-all"
          >
            <X size={18} />
          </button>
        </div>
        
        {/* Body */}
        <div className="px-6 py-8 overflow-y-auto flex-1 custom-scrollbar">
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="px-5 py-4 bg-[#1f1f1f] border-t border-[#2a2a2a] flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

interface PromptModalProps extends Omit<ModalProps, 'children'> {
  onConfirm: (value: string) => void;
  defaultValue?: string;
  placeholder?: string;
  label: string;
  multiline?: boolean;
}

export const PromptModal: React.FC<PromptModalProps> = ({ 
  onConfirm, 
  defaultValue = '', 
  placeholder, 
  label,
  multiline,
  ...props 
}) => {
  const [value, setValue] = React.useState(defaultValue);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    if (props.isOpen) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [props.isOpen, defaultValue]);

  const handleSubmit = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onConfirm(value);
    if (props.onClose) props.onClose();
  };

  return (
    <Modal 
      {...props}
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button 
            type="button"
            onClick={props.onClose}
            className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-300 transition-colors"
          >
            İPTAL
          </button>
          <button 
            type="button"
            onClick={() => handleSubmit()}
            className="px-6 py-2 bg-[#F5C518] hover:bg-[#E2B616] text-black text-xs font-black rounded-md transition-all shadow-lg active:scale-95"
          >
            ONAYLA
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 ml-1">
          {label}
        </label>
        {multiline ? (
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-sm text-white focus:border-[#F5C518]/50 focus:ring-1 focus:ring-[#F5C518]/50 outline-none transition-all placeholder:text-gray-700 resize-none"
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={placeholder}
            className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-sm text-white focus:border-[#F5C518]/50 focus:ring-1 focus:ring-[#F5C518]/50 outline-none transition-all placeholder:text-gray-700"
          />
        )}
      </div>
    </Modal>
  );
};

interface FindingModalProps extends Omit<ModalProps, 'children'> {
  onConfirm: (no: string, desc: string) => void;
  defaultNo?: string;
  defaultDesc?: string;
}

export const FindingModal: React.FC<FindingModalProps> = ({ 
  onConfirm, 
  defaultNo = '', 
  defaultDesc = '',
  ...props 
}) => {
  const [no, setNo] = React.useState(defaultNo);
  const [desc, setDesc] = React.useState(defaultDesc);
  const noRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (props.isOpen) {
      setNo(defaultNo);
      setDesc(defaultDesc);
      setTimeout(() => noRef.current?.focus(), 100);
    }
  }, [props.isOpen, defaultNo, defaultDesc]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(no, desc);
    props.onClose();
  };

  const isFixedPoint = props.title?.includes('NİRENGİ') || props.title?.includes('SABİT');

  return (
    <Modal 
      {...props}
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button 
            type="button"
            onClick={props.onClose} 
            className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-300 transition-colors"
          >
            İPTAL
          </button>
          <button 
            onClick={handleSubmit}
            className="px-6 py-2 bg-[#F5C518] hover:bg-[#E2B616] text-black text-xs font-black rounded-md transition-all shadow-lg active:scale-95"
          >
            {isFixedPoint ? 'SABİT NOKTAYI EKLE' : 'BULGUYU EKLE'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5 py-2">
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-gray-500 uppercase ml-1">
            {isFixedPoint ? 'SABİT NOKTA NO' : 'BULGU NUMARASI'}
          </label>
          <input
            ref={noRef}
            type="text"
            value={no}
            onChange={(e) => setNo(e.target.value)}
            className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all"
            placeholder="Örn: 1, 2, A..."
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-gray-500 uppercase ml-1">BULGU NEDİR? (AÇIKLAMA)</label>
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all"
            placeholder="Örn: Kovan, Kan lekesi, Bıçak..."
          />
        </div>
      </form>
    </Modal>
  );
};


