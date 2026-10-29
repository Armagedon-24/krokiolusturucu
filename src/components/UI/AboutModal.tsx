import React from 'react';
import { Mail, Phone, Code2 } from 'lucide-react';
import { Modal } from './Modal';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Uygulama Hakkında"
      footer={
        <button
          onClick={onClose}
          className="px-6 py-2 bg-[#F5C518] hover:bg-[#E2B616] text-black text-xs font-black rounded-md transition-all shadow-lg active:scale-95 cursor-pointer"
        >
          KAPAT
        </button>
      }
    >
      <div className="flex flex-col items-center text-center space-y-6">
        {/* Developer Avatar Badge */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#F5C518] to-amber-500 rounded-full blur opacity-40 group-hover:opacity-70 transition duration-500"></div>
          <div className="relative w-24 h-24 bg-neutral-900 border-2 border-[#F5C518] rounded-full flex items-center justify-center shadow-xl">
            <span className="text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#F5C518] to-amber-400">
              HV
            </span>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-neutral-900 border border-neutral-800 p-1.5 rounded-full shadow-lg">
            <Code2 size={16} className="text-[#F5C518]" />
          </div>
        </div>

        {/* Developer Details */}
        <div className="space-y-1">
          <h2 className="text-xl font-black text-white tracking-wide">Hakan VARLIK</h2>
          <p className="text-[#F5C518] text-xs font-bold uppercase tracking-widest">Uygulama Geliştirici</p>
        </div>

        {/* Description */}
        <p className="text-gray-400 text-xs leading-relaxed max-w-sm">
          Bu uygulama; olay yeri inceleme ekipleri, kaza araştırmacıları ve adli tıp uzmanları için 2D/3D interaktif kroki çizimi, balistik atış yörüngesi analizi ve kaza rekonstrüksiyon simülasyonları üretmek amacıyla modern web teknolojileriyle özel olarak geliştirilmiştir.
        </p>

        {/* Separator */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-[#2a2a2a] to-transparent" />

        {/* Contact Links */}
        <div className="w-full space-y-3">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-left pl-1">
            İletişim Bilgileri
          </h3>
          
          <div className="grid grid-cols-1 gap-2">
            {/* Phone */}
            <a
              href="tel:05055434824"
              className="flex items-center gap-3 px-4 py-3 bg-neutral-900/60 border border-neutral-800 rounded-lg text-gray-300 hover:text-white hover:bg-neutral-800 hover:border-neutral-700 transition-all duration-300 group"
            >
              <div className="p-1.5 bg-[#F5C518]/10 rounded-md text-[#F5C518] group-hover:bg-[#F5C518]/20 transition-all">
                <Phone size={16} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-gray-500 font-bold uppercase leading-none mb-1">Telefon</span>
                <span className="text-xs font-semibold">0505 543 48 24</span>
              </div>
            </a>

            {/* Email */}
            <a
              href="mailto:hakan_varlik24@hotmail.com"
              className="flex items-center gap-3 px-4 py-3 bg-neutral-900/60 border border-neutral-800 rounded-lg text-gray-300 hover:text-white hover:bg-neutral-800 hover:border-neutral-700 transition-all duration-300 group"
            >
              <div className="p-1.5 bg-[#F5C518]/10 rounded-md text-[#F5C518] group-hover:bg-[#F5C518]/20 transition-all">
                <Mail size={16} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-gray-500 font-bold uppercase leading-none mb-1">E-Posta</span>
                <span className="text-xs font-semibold">hakan_varlik24@hotmail.com</span>
              </div>
            </a>
          </div>
        </div>
      </div>
    </Modal>
  );
};
