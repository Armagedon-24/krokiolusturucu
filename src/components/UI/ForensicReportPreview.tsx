import React, { useState } from 'react';
import { FileText, ChevronDown, Copy, Check } from 'lucide-react';

interface Props {
  text: string;
  label?: string;
}

/**
 * Bilirkişi raporu önizlemesi: koyu panel içinde kâğıt dokulu,
 * monospace belge görünümü. Kopyala düğmesi içerir.
 */
export const ForensicReportPreview: React.FC<Props> = ({ text, label = 'BİLİRKİŞİ RAPORU ÖNİZLEME' }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* pano izni yoksa sessizce yut */
    }
  };

  return (
    <div className="rounded-2xl border border-[#333] overflow-hidden bg-[#141414]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#1a1a1a] hover:bg-[#202020] transition-colors"
      >
        <span className="flex items-center gap-2 text-[9px] font-black text-gray-300 uppercase tracking-widest">
          <FileText size={13} className="text-[#F5C518]" />
          {label}
        </span>
        <span className="flex items-center gap-2">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                handleCopy();
              }
            }}
            className="p-1 rounded-md hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
          >
            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          </span>
          <ChevronDown size={14} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="p-3 bg-[#f7f6f2] max-h-72 overflow-y-auto custom-scrollbar">
          <pre className="text-[9px] leading-[1.45] font-mono text-[#1c1c1c] whitespace-pre-wrap break-words">
            {text}
          </pre>
        </div>
      )}
    </div>
  );
};
