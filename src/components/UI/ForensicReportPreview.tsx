import React, { useState } from 'react';
import { FileText, ChevronDown, Copy, Check, Download, Loader2, AlertTriangle } from 'lucide-react';
import type { ForensicReport } from '../../utils/forensicReport';
import { downloadForensicPdf } from '../../utils/forensicPdf';

interface Props {
  /** formatForensicReport çıktısı (kopyalama + yapılandırılmamış geri dönüş) */
  text: string;
  label?: string;
  /** Verilirse belge görünümlü önizleme ve kurumsal PDF indirme etkinleşir. */
  report?: ForensicReport;
}

const SECTIONS: Array<{ no: number; key: keyof ForensicReport; title: string }> = [
  { no: 1, key: 'topic', title: 'İNCELEME KONUSU' },
  { no: 2, key: 'evidence', title: 'İNCELENEN DELİLLER VE GİRDİLER' },
  { no: 3, key: 'method', title: 'UYGULANAN YÖNTEM' },
  { no: 4, key: 'findings', title: 'BULGULAR' },
  { no: 5, key: 'scenarios', title: 'DEĞERLENDİRME (TÜM İHTİMALLER)' },
  { no: 6, key: 'conclusion', title: 'SONUÇ VE KANAAT' },
  { no: 7, key: 'caveats', title: 'ŞERHLER VE LİMİTASYONLAR' },
];

/** Belge görünümlü kurumsal önizleme (PDF ile aynı düzen). */
const PaperView: React.FC<{ report: ForensicReport }> = ({ report }) => (
  <div className="bg-white text-[#26282E] px-5 py-4">
    {/* Üst band */}
    <div className="bg-[#16181D] text-white px-4 py-3 -mx-5 -mt-4">
      <div className="text-[13px] font-black tracking-wide">ADLİ BİLİRKİŞİ ANALİZ RAPORU</div>
      <div className="text-[8.5px] text-[#D8B94A] mt-0.5">Kaza Analiz ve Rekonstrüksiyon Birimi</div>
    </div>

    {/* Başlık + bölümler */}
    <div className="mt-3 border border-gray-200 bg-[#FBFBFA] rounded-sm px-3 py-2">
      <div className="text-[10.5px] font-bold text-[#16181D] leading-snug">{report.title}</div>
    </div>

    <div className="mt-3 space-y-3.5">
      {SECTIONS.map(({ no, key, title }) => {
        const raw = report[key];
        const items = typeof raw === 'string' ? [raw] : raw;
        return (
          <div key={key}>
            <div className="flex items-center gap-1.5 border-b border-gray-300 pb-1 mb-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 bg-[#C9A227] text-white text-[8px] font-black rounded-[2px]">
                {no}
              </span>
              <span className="text-[9px] font-black text-[#16181D] tracking-wide">{title}</span>
            </div>
            {items.length === 0 ? (
              <div className="text-[9px] text-gray-400 pl-5">— veri yok —</div>
            ) : (
              <ol className="space-y-1">
                {items.map((it, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="shrink-0 text-[8.5px] font-bold text-[#A3861C] pt-[1px]">
                      {no}.{i + 1}
                    </span>
                    <span className="text-[9px] leading-[1.5] text-[#26282E]">{it}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </div>

    {/* İmza bloğu */}
    <div className="mt-4 flex justify-end">
      <div className="w-44 border border-gray-300 rounded-sm overflow-hidden">
        <div className="bg-[#16181D] text-white text-[8px] font-black text-center py-1">BİLİRKİŞİ</div>
        <div className="px-2.5 py-2 space-y-1 text-[8px] text-gray-500">
          <div>Adı Soyadı : ....................</div>
          <div>Unvan / Sicil : ....................</div>
          <div className="pt-2">İmza / Paraf :</div>
        </div>
      </div>
    </div>

    <div className="mt-3 border-t border-gray-200 pt-2 text-[7.5px] leading-[1.5] text-gray-400">
      Bu rapor bilimsel yöntemlere dayalı bilirkişi görüşü niteliğindedir; nihai kanaat, dosyanın
      bütüncül delilleri ile birlikte değerlendirilmelidir.
    </div>
  </div>
);

/**
 * Bilirkişi raporu önizlemesi: belge görünümlü kurumsal düzen,
 * kopyala ve kurumsal PDF indir düğmeleri.
 */
export const ForensicReportPreview: React.FC<Props> = ({ text, label = 'BİLİRKİŞİ RAPORU ÖNİZLEME', report }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* pano izni yoksa sessizce yut */
    }
  };

  const handlePdf = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!report || pdfBusy) return;
    setPdfBusy(true);
    setPdfError(false);
    try {
      await downloadForensicPdf(report);
    } catch {
      setPdfError(true);
      setTimeout(() => setPdfError(false), 3500);
    } finally {
      setPdfBusy(false);
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
          {report && (
            <span
              role="button"
              tabIndex={0}
              onClick={handlePdf}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  handlePdf(e as unknown as React.MouseEvent);
                }
              }}
              title="Kurumsal PDF olarak indir"
              className="flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-white/10 text-gray-500 hover:text-[#F5C518] transition-colors"
            >
              {pdfBusy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Download size={12} />
              )}
              <span className="text-[8px] font-black tracking-wider">PDF</span>
            </span>
          )}
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
      {pdfError && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-red-950/60 text-red-300 text-[9px]">
          <AlertTriangle size={11} />
          PDF oluşturulamadı — bağlantınızı kontrol edip tekrar deneyin.
        </div>
      )}
      {open && (
        <div className="p-3 bg-[#f7f6f2] max-h-80 overflow-y-auto custom-scrollbar">
          {report ? <PaperView report={report} /> : (
            <pre className="text-[9px] leading-[1.45] font-mono text-[#1c1c1c] whitespace-pre-wrap break-words">
              {text}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
