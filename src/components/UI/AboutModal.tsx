import React, { useEffect } from 'react';
import {
  X,
  Phone,
  Mail,
  PencilRuler,
  Box,
  Crosshair,
  CarFront,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react';
import { withBase } from '../../utils/assetMigration';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const APP_VERSION = '1.0.0';

const FEATURES = [
  {
    icon: PencilRuler,
    title: '2B Kroki Çizimi',
    desc: 'Mimari semboller ve ölçek desteğiyle profesyonel olay yeri krokisi',
  },
  {
    icon: Box,
    title: '3B Önizleme',
    desc: 'Çizimlerinizi tek tıkla gerçekçi üç boyutlu modellere dönüştürün',
  },
  {
    icon: Crosshair,
    title: 'Balistik Analiz',
    desc: 'Atış yörüngesi, nirengi noktası ve mesafe hesaplama araçları',
  },
  {
    icon: CarFront,
    title: 'Kaza Rekonstrüksiyonu',
    desc: 'Trafik kazası simülasyonları ve animasyonlu senaryo analizleri',
  },
];

const CONTACTS = [
  {
    icon: Phone,
    label: 'Telefon',
    value: '0505 543 48 24',
    href: 'tel:05055434824',
  },
  {
    icon: Mail,
    label: 'E-Posta',
    value: 'hakan_varlik24@hotmail.com',
    href: 'mailto:hakan_varlik24@hotmail.com',
  },
];

const gridStyle: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(245,197,24,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(245,197,24,0.05) 1px, transparent 1px)',
  backgroundSize: '26px 26px',
};

/** Teknik çizim köşe işareti (blueprint çerçeve süsü) */
const Corner: React.FC<{ className: string }> = ({ className }) => (
  <div className={`pointer-events-none absolute w-5 h-5 border-[#F5C518]/35 ${className}`} />
);

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Uygulama Hakkında"
    >
      <style>{`
        @keyframes aboutFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes aboutPop {
          from { opacity: 0; transform: scale(.95) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes aboutFade {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes aboutPulse {
          0%, 100% { opacity: .45; }
          50%      { opacity: .85; }
        }
        .about-pop   { opacity: 0; animation: aboutPop .45s cubic-bezier(.22,1,.36,1) forwards; }
        .about-fade  { opacity: 0; animation: aboutFade .4s ease-out forwards; }
        .about-in    { opacity: 0; animation: aboutFadeUp .55s cubic-bezier(.22,1,.36,1) forwards; }
        .about-glow  { animation: aboutPulse 3.2s ease-in-out infinite; }
      `}</style>

      {/* Arka plan perdesi */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md about-fade" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-2xl max-h-full flex flex-col rounded-2xl border border-[#2a2a2a] bg-[#161616] shadow-[0_25px_80px_rgba(0,0,0,0.65)] overflow-hidden about-pop">
        {/* ─────────── HERO ─────────── */}
        <div className="relative shrink-0 px-8 pt-11 pb-8 text-center overflow-hidden" style={gridStyle}>
          {/* Köşe süsleri */}
          <Corner className="top-3 left-3 border-t-2 border-l-2 rounded-tl-lg" />
          <Corner className="top-3 right-3 border-t-2 border-r-2 rounded-tr-lg" />
          <Corner className="bottom-3 left-3 border-b-2 border-l-2 rounded-bl-lg" />
          <Corner className="bottom-3 right-3 border-b-2 border-r-2 rounded-br-lg" />

          {/* Dekoratif pusula halkaları */}
          <svg
            className="pointer-events-none absolute -right-14 -top-14 text-[#F5C518] opacity-[0.07]"
            width="190" height="190" viewBox="0 0 100 100" fill="none" stroke="currentColor"
          >
            <circle cx="50" cy="50" r="46" strokeWidth="0.8" />
            <circle cx="50" cy="50" r="30" strokeWidth="0.6" />
            <line x1="50" y1="2" x2="50" y2="98" strokeWidth="0.6" />
            <line x1="2" y1="50" x2="98" y2="50" strokeWidth="0.6" />
          </svg>
          <svg
            className="pointer-events-none absolute -left-10 bottom-0 text-[#F5C518] opacity-[0.05]"
            width="130" height="130" viewBox="0 0 100 100" fill="none" stroke="currentColor"
          >
            <circle cx="50" cy="50" r="44" strokeWidth="0.8" strokeDasharray="4 3" />
            <circle cx="50" cy="50" r="4" strokeWidth="0.8" />
          </svg>

          {/* İksi */}
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="absolute top-4 right-4 z-20 p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            <X size={16} />
          </button>

          {/* Logo */}
          <div className="relative inline-block about-in">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#F5C518] to-amber-500 rounded-2xl blur-xl opacity-40 about-glow" />
            <div className="relative w-20 h-20 mx-auto rounded-2xl bg-neutral-900 border-2 border-[#F5C518]/70 shadow-[0_0_35px_rgba(245,197,24,0.25)] flex items-center justify-center overflow-hidden">
              <img
                src={withBase('/logo.png')}
                alt="Kroki Oluşturucu logosu"
                className="w-14 h-14 object-contain"
                draggable={false}
              />
            </div>
          </div>

          {/* Başlık */}
          <h1 className="about-in mt-5 text-2xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-[#F5C518] to-amber-400" style={{ animationDelay: '90ms' }}>
            KROKİ OLUŞTURUCU
          </h1>
          <p className="about-in mt-1.5 text-[11px] font-semibold text-gray-400 tracking-[0.18em] uppercase" style={{ animationDelay: '160ms' }}>
            Olay Yeri Dokümantasyon ve Adli Analiz Sistemi
          </p>

          {/* Rozetler */}
          <div className="about-in mt-4 flex items-center justify-center gap-2" style={{ animationDelay: '230ms' }}>
            <span className="px-2.5 py-1 rounded-md bg-[#F5C518]/10 border border-[#F5C518]/30 text-[#F5C518] text-[9px] font-black tracking-[0.15em]">
              SÜRÜM {APP_VERSION}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-[#1d1d1d] border border-[#2e2e2e] text-gray-400 text-[9px] font-black tracking-[0.15em]">
              PWA
            </span>
            <span className="px-2.5 py-1 rounded-md bg-[#1d1d1d] border border-[#2e2e2e] text-gray-400 text-[9px] font-black tracking-[0.15em]">
              ÇEVRİMDIŞI KULLANIM
            </span>
          </div>

          {/* Alt çizgi */}
          <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#F5C518]/60 to-transparent" />
        </div>

        {/* ─────────── GÖVDE ─────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-8 py-7 space-y-7">
          {/* Özellikler */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="about-in group relative p-4 rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] hover:border-[#F5C518]/40 hover:bg-[#202020] transition-all duration-300 text-left"
                style={{ animationDelay: `${300 + i * 70}ms` }}
              >
                <div className="w-9 h-9 rounded-lg bg-[#F5C518]/10 border border-[#F5C518]/20 flex items-center justify-center text-[#F5C518] mb-3 group-hover:scale-110 group-hover:bg-[#F5C518]/15 transition-all duration-300">
                  <f.icon size={17} strokeWidth={2.2} />
                </div>
                <h4 className="text-[11px] font-black text-gray-100 tracking-wide uppercase mb-1">
                  {f.title}
                </h4>
                <p className="text-[10px] text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Ayraç: Geliştirici */}
          <div className="about-in flex items-center gap-3" style={{ animationDelay: '580ms' }}>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#2a2a2a]" />
            <span className="text-[9px] font-black tracking-[0.3em] text-gray-600 uppercase">Geliştirici</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#2a2a2a]" />
          </div>

          {/* Geliştirici kartı */}
          <div
            className="about-in relative p-5 rounded-xl border border-[#F5C518]/20 bg-gradient-to-br from-[#231d0c]/70 via-[#1c1c1c] to-[#1c1c1c] overflow-hidden"
            style={{ animationDelay: '640ms' }}
          >
            <svg
              className="pointer-events-none absolute -right-6 -bottom-8 text-[#F5C518] opacity-[0.06]"
              width="140" height="140" viewBox="0 0 100 100" fill="none" stroke="currentColor"
            >
              <circle cx="50" cy="50" r="46" strokeWidth="0.8" />
              <circle cx="50" cy="50" r="30" strokeWidth="0.6" strokeDasharray="3 3" />
            </svg>

            <div className="relative flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-[#F5C518]/50 to-amber-500/50 blur about-glow" />
                <div className="relative w-14 h-14 rounded-full bg-neutral-900 border-2 border-[#F5C518] flex items-center justify-center">
                  <span className="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#F5C518] to-amber-400">
                    HV
                  </span>
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-white tracking-wide">Hakan VARLIK</h3>
                <p className="text-[10px] font-bold text-[#F5C518] uppercase tracking-[0.22em] mt-0.5">
                  Uygulama Geliştirici
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Olay Yeri Belgeleme &amp; Rekonstrüksiyon</p>
              </div>
            </div>

            <p className="relative text-[11px] text-gray-400 leading-relaxed mt-4 pt-4 border-t border-[#2a2a2a]/70">
              Bu uygulama; olay yeri inceleme ekipleri, kaza araştırmacıları ve adli tıp
              uzmanları için 2B/3B interaktif kroki çizimi, balistik atış yörüngesi analizi ve
              kaza rekonstrüksiyon simülasyonları üretmek amacıyla modern web teknolojileriyle
              özel olarak geliştirilmiştir.
            </p>
          </div>

          {/* Ayraç: İletişim */}
          <div className="about-in flex items-center gap-3" style={{ animationDelay: '700ms' }}>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#2a2a2a]" />
            <span className="text-[9px] font-black tracking-[0.3em] text-gray-600 uppercase">İletişim</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#2a2a2a]" />
          </div>

          {/* İletişim kartları */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CONTACTS.map((c, i) => (
              <a
                key={c.label}
                href={c.href}
                className="about-in group flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] hover:border-[#F5C518]/40 hover:bg-[#202020] transition-all duration-300"
                style={{ animationDelay: `${760 + i * 70}ms` }}
              >
                <div className="p-2 rounded-lg bg-[#F5C518]/10 border border-[#F5C518]/20 text-[#F5C518] group-hover:bg-[#F5C518]/20 transition-all">
                  <c.icon size={15} />
                </div>
                <div className="flex flex-col text-left min-w-0">
                  <span className="text-[9px] text-gray-500 font-black uppercase tracking-[0.18em] leading-none mb-1">
                    {c.label}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-200 truncate">{c.value}</span>
                </div>
                <ArrowUpRight
                  size={14}
                  className="ml-auto shrink-0 text-gray-600 group-hover:text-[#F5C518] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
                />
              </a>
            ))}
          </div>
        </div>

        {/* ─────────── ALT BİLGİ ─────────── */}
        <div className="shrink-0 px-8 py-3.5 bg-[#101010] border-t border-[#232323] flex items-center justify-between gap-3">
          <span className="text-[9px] font-bold text-gray-600 tracking-wider">
            © {new Date().getFullYear()} Hakan VARLIK · Tüm hakları saklıdır
          </span>
          <span className="flex items-center gap-1.5 text-[9px] font-bold text-gray-600 tracking-wider">
            <ShieldCheck size={12} className="text-[#F5C518]/70" />
            Olay Yeri Dokümantasyon Sistemi
          </span>
        </div>
      </div>
    </div>
  );
};
