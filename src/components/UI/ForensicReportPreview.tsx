import React, { useState } from 'react';
import { FileText, ChevronDown, Copy, Check, Download, Loader2, AlertTriangle } from 'lucide-react';
import type { ForensicReport } from '../../utils/forensicReport';
import { reportMeta } from '../../utils/forensicReport';
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
const PaperView: React.FC<{ report: ForensicReport }> = ({ report }) => {
  const m = reportMeta();
  const logoSrc = `${import.meta.env.BASE_URL}assets/kurum_logo.png`;
  const wmSrc = `${import.meta.env.BASE_URL}assets/kurum_logo_filigran_kontur.png`;
  return (
    <div className="relative bg-white text-[#26282E] px-5 py-4 overflow-hidden">
      {/* Sayfa arkası içi boş (kontur) gri filigran — kartı kaplar */}
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
        <img src={wmSrc} alt="" aria-hidden className="w-[92%] max-w-none opacity-[0.14]" />
      </div>

      {/* Üst band — antet: logo solda, ortalanmış ana başlık, sağ altta rapor rozeti */}
      <div className="relative z-10 bg-[#16181D] text-white pl-2.5 pr-3 py-2.5 -mx-5 -mt-4">
        <img src={logoSrc} alt="Kurum logosu" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 object-contain" />
        <div className="px-12 text-center">
          <div className="text-[10px] font-black tracking-wide leading-tight">KAZA ANALİZ VE REKONSTRÜKSİYON ANALİZİ</div>
          <div className="text-[7px] text-gray-400 mt-0.5">Bilimsel yöntemlere dayalı teknik değerlendirme belgesi</div>
        </div>
        <div className="mt-2 flex justify-end">
          <div className="text-right border border-gray-600 rounded px-2 py-1">
            <div className="text-[6.5px] font-bold text-gray-400 tracking-wider">RAPOR NO</div>
            <div className="text-[8.5px] font-bold text-[#D1D5DB] leading-tight">{m.dosyaNo}</div>
            <div className="text-[6.5px] text-gray-400">{m.tarih} · {m.saat}</div>
          </div>
        </div>
      </div>

      {/* Bilgi tablosu */}
      <div className="relative z-10 mt-3 text-[8px] border border-gray-200 rounded-sm overflow-hidden">
        {([
          ['RAPOR NO', m.dosyaNo],
          ['RAPOR TARİHİ', m.tarih],
          ['RAPOR SAATİ', m.saat],
          ['İNCELEME TÜRÜ', report.title],
          ['ADRES', '.....................................................'],
        ] as Array<[string, string]>).map(([k, v], i) => (
          <div key={k} className={`flex ${i % 2 === 0 ? 'bg-[#F3F4F6]' : 'bg-white'} px-2.5 py-1`}>
            <span className="w-24 shrink-0 font-bold text-[#16181D] tracking-wide">{k}</span>
            <span className="text-[#26282E] truncate">{v}</span>
          </div>
        ))}
      </div>

      {/* Başlık + bölümler */}
      <div className="relative z-10 mt-3 border border-gray-200 bg-[#FBFBFA] rounded-sm px-3 py-2">
        <div className="text-[10.5px] font-bold text-[#16181D] leading-snug">{report.title}</div>
      </div>

    <div className="relative z-10 mt-3 space-y-3.5">
      {SECTIONS.map(({ no, key, title }) => {
        const raw = report[key];
        const items = typeof raw === 'string' ? [raw] : raw;
        return (
          <div key={key}>
            <div className="flex items-center gap-1.5 border-b border-gray-300 pb-1 mb-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 bg-[#6B7280] text-white text-[8px] font-black rounded-[2px]">
                {no}
              </span>
              <span className="text-[10px] font-black text-black tracking-wide">{title}</span>
            </div>
            {items.length === 0 ? (
              <div className="text-[9px] text-gray-400 pl-5">— veri yok —</div>
            ) : (
              <ol className="space-y-1">
                {items.map((it, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="shrink-0 text-[8.5px] font-bold text-[#6B7280] pt-[1px]">
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
    <div className="relative z-10 mt-4 flex justify-end">
      <div className="w-44 border border-gray-300 rounded-sm overflow-hidden">
        <div className="bg-[#16181D] text-white text-[8px] font-black text-center py-1">BİLİRKİŞİ</div>
        <div className="px-2.5 py-2 space-y-1 text-[8px] text-gray-500">
          <div>Adı Soyadı : ....................</div>
          <div>Unvan / Sicil : ....................</div>
          <div className="pt-2">İmza / Paraf :</div>
        </div>
      </div>
    </div>

    <div className="relative z-10 mt-3 border-t border-gray-200 pt-2 text-[7.5px] leading-[1.5] text-gray-400">
      Bu rapor bilimsel yöntemlere dayalı bilirkişi görüşü niteliğindedir; nihai kanaat, dosyanın
      bütüncül delilleri ile birlikte değerlendirilmelidir.
    </div>
  </div>
  );
};

/**
 * Kompakt kurumsal PDF indirme düğmesi — hesaplayıcılarda "Rapora Ekle"
 * düğmesinin yanında kullanılır. Yükleme/hata durumlarını kendisi yönetir.
 */
export const ForensicPdfButton: React.FC<{ report: ForensicReport }> = ({ report }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const handlePdf = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await downloadForensicPdf(report);
    } catch {
      setError(true);
      setTimeout(() => setError(false), 3500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handlePdf}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handlePdf();
      }}
      title="Kurumsal PDF olarak indir"
      className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all active:scale-95 cursor-pointer select-none ${
        error
          ? 'border-red-500/40 bg-red-500/10 text-red-400'
          : 'border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
      }`}
    >
      {error ? (
        <AlertTriangle size={13} />
      ) : busy ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <Download size={13} />
      )}
      <span className="text-[9px] font-black tracking-wider">PDF</span>
    </span>
  );
};

/**
 * Bilirkişi raporu önizlemesi: belge görünümlü kurumsal düzen ve
 * kopyala düğmesi. PDF indirme, hesaplayıcı ekranlarındaki kompakt
 * ForensicPdfButton üzerinden yapılır.
 */
export const ForensicReportPreview: React.FC<Props> = ({ text, label = 'BİLİRKİŞİ RAPORU ÖNİZLEME', report }) => {
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
