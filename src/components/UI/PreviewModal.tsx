import React from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, Maximize, FileText } from 'lucide-react';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: string;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ isOpen, onClose, image }) => {
  const [scale, setScale] = React.useState(0.85);
  const [isHovering, setIsHovering] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setScale(0.85); // Start slightly zoomed out to see edges
    }
  }, [isOpen]);

  // Ctrl+tekerlek ile yakınlaştırma: React wheel listener'ı passive olduğu için
  // preventDefault orada çalışmaz; non-passive dinleyici ref üzerinden eklenir.
  // HOOK KURALI: tüm hook'lar erken return'den ÖNCE çağrılmalı.
  const scrollAreaRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) setScale(prev => Math.min(prev + 0.1, 2.5));
        else setScale(prev => Math.max(prev - 0.1, 0.4));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  if (!isOpen) return null;

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 2.5));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.4));
  const handleResetZoom = () => setScale(0.85);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0a0a0a] animate-in fade-in duration-300">
      {/* Top Header Bar */}
      <div className="h-16 bg-[#1a1a1a] border-b border-[#333] flex items-center justify-between px-6 z-10 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-[#F5C518] to-[#d4a017] rounded-lg flex items-center justify-center shadow-lg shadow-[#F5C518]/20">
            <FileText size={20} className="text-black" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-widest">BASKI VE ÇIKTI ÖNİZLEME</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Hazır: Resmi Makam Standartları Uygulandı</p>
            </div>
          </div>
        </div>

        {/* Zoom Controls Area */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center bg-[#242424] border border-[#333] rounded-full p-1 shadow-inner">
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#333] rounded-full transition-all"
          >
            <ZoomOut size={16} />
          </button>
          <div className="px-4 text-[11px] font-black text-[#F5C518] min-w-[60px] text-center select-none">
            %{Math.round(scale * 100)}
          </div>
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#333] rounded-full transition-all"
          >
            <ZoomIn size={16} />
          </button>
          <div className="w-px h-4 bg-[#333] mx-1" />
          <button
            onClick={handleResetZoom}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#333] rounded-full transition-all"
            title="Sığdır"
          >
            <Maximize size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-2.5 text-gray-400 hover:text-white hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Main Preview Area */}
      <div 
        ref={scrollAreaRef}
        className="flex-1 overflow-auto bg-[#0a0a0a] flex items-start justify-center custom-scrollbar relative py-12 px-12"
      >
        {/* Subtle decorative background pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#F5C518 1px, transparent 0)', backgroundSize: '40px 40px' }} />

        <div 
          className="relative transition-transform duration-300 ease-out origin-top shadow-[0_0_100px_rgba(0,0,0,0.5)]"
          style={{ 
            transform: `scale(${scale})`,
            marginTop: '20px'
          }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {/* Paper Shadow Stack (Visual depth) */}
          <div className="absolute inset-0 translate-x-2 translate-y-2 bg-black/20 blur-xl -z-10" />
          
          <div className="bg-white p-0 relative overflow-hidden border border-gray-200">
            <img 
              src={image} 
              alt="Preview" 
              className="max-w-none h-auto block"
              style={{ 
                width: 'auto', 
                height: 'auto',
                boxShadow: isHovering ? '0 0 40px rgba(0,0,0,0.1)' : 'none',
                transition: 'box-shadow 0.3s ease'
              }}
            />
          </div>
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="h-10 bg-[#1a1a1a] border-t border-[#333] flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Durum:</span>
            <span className="text-[10px] text-green-500 font-black uppercase">Yayında</span>
          </div>
          <div className="h-3 w-px bg-[#333]" />
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <span className="font-bold">Ölçek:</span>
            <span className="text-gray-300">{Math.round(scale * 100)}%</span>
          </div>
        </div>
        
        <p className="text-[9px] text-gray-600 font-medium italic">
          Bu bir sistem önizlemesidir. Gerçek çıktı kalitesi yazıcınıza bağlıdır.
        </p>
      </div>
    </div>,
    document.body
  );
};
