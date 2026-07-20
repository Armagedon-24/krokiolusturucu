import React from 'react';
import { 
  Undo, 
  Redo, 
  Upload, 
  Trash2, 
  CloudUpload, 
  CloudDownload, 
  LogOut, 
  Rotate3D, 
  FolderOpen, 
  Eye, 
  EyeOff, 
  Contrast,
  Ruler,
  Map as MapIcon,
  Info
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { CaseManagerModal } from '../UI/CaseManagerModal';
import { DistanceMatrixModal } from '../UI/DistanceMatrixModal';
import { AdminLoginModal } from '../UI/AdminLoginModal';
import { PreviewModal } from '../UI/PreviewModal';
import { ScaleCalibrationModal } from '../UI/ScaleCalibrationModal';
import { MapPickerModal } from '../UI/MapPickerModal';
import { AboutModal } from '../UI/AboutModal';

import { ThreeDPreview } from '../UI/ThreeDPreview';
import { compressAndResizeImage } from '../../utils/canvasUtils';

export const Topbar: React.FC = () => {
  const {
    undo,
    redo,
    setBackgroundImage,
    clearCanvas,
    backgroundImage,
    backgroundOpacity,
    setBackgroundOpacity,
    backgroundGrayscale,
    setBackgroundGrayscale,
    addNotification,
    isAdmin,
    setIsAdmin,
    syncToCloud,
    restoreFromCloud,
    objects,
    showConfirm,
    projectInfo
  } = useStore();

  const [isDistanceMatrixOpen, setIsDistanceMatrixOpen] = React.useState(false);
  const [isThreeDOpen, setIsThreeDOpen] = React.useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = React.useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = React.useState(false);
  const [isAboutOpen, setIsAboutOpen] = React.useState(false);

  const [isCaseManagerOpen, setIsCaseManagerOpen] = React.useState(false);
  const [isScaleCalibrationOpen, setIsScaleCalibrationOpen] = React.useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = React.useState(false);
  const [previewImage, setPreviewImage] = React.useState<string>('');

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedSrc = await compressAndResizeImage(file, 800, 800, 0.45);
        setBackgroundImage(compressedSrc);
        addNotification({
          type: 'success',
          message: 'Arka Plan Yüklendi',
          description: 'Seçilen görsel performans için optimize edilerek arka plana yerleştirildi.'
        });
      } catch (err) {
        console.error('Background image error:', err);
      }
    }
  };


  const handlePreview = () => {
    if (objects.length === 0 && !backgroundImage) {
      addNotification({
        type: 'warning',
        message: 'Tuval Henüz Boş',
        description: 'Önizleme oluşturmak için tuvale en az bir nesne eklemeli veya bir arka plan görseli yüklemelisiniz.'
      });
      return;
    }
    window.dispatchEvent(new CustomEvent('generate-preview'));
  };

  React.useEffect(() => {
    const handlePreviewGenerated = (e: any) => {
      setPreviewImage(e.detail);
      setIsPreviewModalOpen(true);
    };
    window.addEventListener('preview-ready', handlePreviewGenerated);
    return () => window.removeEventListener('preview-ready', handlePreviewGenerated);
  }, []);



  return (
    <div className="h-14 border-b flex items-center justify-between px-4 z-[100] flex-shrink-0 topbar overflow-x-auto custom-scrollbar gap-4 transition-all duration-500 bg-[#1a1a1a] border-[#2a2a2a]">
      {/* LEFT: Logo + Undo/Redo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 mr-2">
          <div onClick={() => setIsAdminModalOpen(true)} className="h-12 flex items-center justify-center flex-shrink-0 cursor-pointer hover:scale-105 transition-all py-1">
            <img src="/logo.png" className="h-full w-auto object-contain animate-pulse" alt="Logo" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-wide uppercase whitespace-nowrap text-white">
              Kroki Oluşturucu
            </span>
            {isAdmin && (
              <span className="text-[8px] font-black tracking-tighter uppercase leading-none text-[#F5C518]">
                Yönetici Paneli Aktif
              </span>
            )}
          </div>
        </div>

        <div className="h-5 w-px bg-[#333]" />
        <div className="flex items-center bg-[#242424] rounded-md border border-[#333] p-0.5">
          <button onClick={undo} className="p-1.5 hover:bg-[#333] rounded transition-colors" title="Geri Al" aria-label="Geri Al"><Undo size={16} className="text-gray-200" /></button>
          <button onClick={redo} className="p-1.5 hover:bg-[#333] rounded transition-colors" title="İleri Al" aria-label="İleri Al"><Redo size={16} className="text-gray-200" /></button>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1 ml-2 bg-black/40 p-1 rounded-md border border-[#F5C518]/20">
            <button onClick={() => {
                const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                if (isLocal) {
                  addNotification({ type: 'info', message: 'Geliştirme Modu', description: 'Bulut yükleme yalnızca canlı (deploy) ortamda çalışır.' });
                  return;
                }
                syncToCloud();
              }} className="flex items-center gap-1.5 px-2 py-1 bg-[#F5C518]/10 text-[#F5C518] rounded hover:bg-[#F5C518]/20 transition-all text-[9px] font-bold border border-[#F5C518]/30" title="Buluta Yükle" aria-label="Buluta Yükle"><CloudUpload size={12} /> YÜKLE</button>
            <button onClick={() => restoreFromCloud()} className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 transition-all text-[9px] font-bold border border-blue-500/30" title="Buluttan İndir" aria-label="Buluttan İndir"><CloudDownload size={12} /> İNDİR</button>
          </div>
        )}
      </div>

      {/* CENTER: Map + BG Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsMapModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#F5C518] hover:bg-[#E2B616] text-black text-[10px] font-black rounded-md transition-all shadow-lg active:scale-95"
          title="Google Maps Uydu Görüntüsü Getir"
          aria-label="Uydu Haritası Aç"
        >
          <MapIcon size={14} />
          <span className="text-xs font-bold">UYDU HARİTASI</span>
        </button>

        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5C518] text-black rounded-md hover:bg-[#d4a017] cursor-pointer transition-all text-xs font-bold shadow-lg shadow-yellow-500/10" aria-label="Arka Plan Görseli Yükle">
          <Upload size={14} />
          <span>ARKA PLAN</span>
          <input type="file" className="hidden" accept="image/*" onChange={handleBackgroundUpload} aria-label="Arka Plan Dosyası" />
        </label>

        <div className={`flex items-center gap-2 bg-[#1e1e1e] border border-[#333] rounded-md px-2 py-1 ${!backgroundImage ? 'opacity-30 pointer-events-none' : ''}`}>
          <span className="text-gray-300">{backgroundOpacity > 0.5 ? <Eye size={14} /> : <EyeOff size={14} />}</span>
          <input type="range" min="0" max="1" step="0.1" value={backgroundOpacity} onChange={(e) => setBackgroundOpacity(parseFloat(e.target.value))} className="w-16 h-1 bg-[#333] cursor-pointer accent-[#F5C518]" aria-label="Arka Plan Şeffaflığı Ayarı" title="Arka Plan Şeffaflığı" />
          <button onClick={() => setBackgroundGrayscale(!backgroundGrayscale)} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${backgroundGrayscale ? 'bg-[#F5C518] text-black' : 'bg-[#333] text-gray-200'}`} aria-label="Siyah Beyaz Filtre" title="Siyah Beyaz Filtre"><Contrast size={12} /></button>
        </div>
      </div>

      {/* RIGHT: Actions */}
      <div className="flex items-center gap-2">
        {isAdmin && (
          <button onClick={() => setIsThreeDOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#242424] border border-blue-500/40 rounded-md hover:bg-blue-500/10 transition-all text-xs font-black text-blue-300 shadow-lg shadow-blue-600/5" aria-label="3D Görünüm">
            <Rotate3D size={14} />
            <span>3D GÖRÜNÜM</span>
          </button>
        )}

        <button 
          onClick={() => setIsCaseManagerOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#242424] border border-[#F5C518]/50 rounded-md hover:bg-[#F5C518]/10 transition-all text-xs font-black text-[#F5C518] shadow-lg shadow-[#F5C518]/5"
          aria-label="Olay Yönetimi Paneli"
        >
          <FolderOpen size={14} />
          <span>OLAY YÖNETİMİ</span>
        </button>

        <button onClick={handlePreview} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#242424] border border-[#444] rounded-md hover:bg-[#2a2a2a] transition-all text-xs font-bold text-white" aria-label="Önizle"><Eye size={14} /><span>ÖNİZLE</span></button>
        <button onClick={() => setIsScaleCalibrationOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#242424] border border-[#444] rounded-md hover:bg-[#2a2a2a] transition-all text-xs font-bold text-white" aria-label="Ölçek Ayarı"><Ruler size={14} /><span>ÖLÇEK</span></button>
        <button onClick={() => setIsAboutOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#242424] border border-[#444] rounded-md hover:bg-[#2a2a2a] transition-all text-xs font-bold text-white" aria-label="Hakkında Bilgisi">
          <Info size={14} />
          <span>HAKKINDA</span>
        </button>
        <button onClick={() => window.print()} className="px-4 py-1.5 bg-[#15803d] text-white rounded-md hover:bg-[#166534] transition-all text-xs font-black tracking-wide" aria-label="Yazdır"><span>YAZDIR</span></button>
        
        <button 
          onClick={() => {
            showConfirm({
              title: 'SAYFAYI SIFIRLA',
              message: 'Tüm çizimler ve bilgiler sıfırlanarak yeni bir çalışma sayfası açılacaktır. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?',
              onConfirm: () => {
                clearCanvas();
                useStore.setState({ activeSceneId: null });
              }
            });
          }} 
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 text-red-300 border border-red-500/40 rounded-md hover:bg-red-600/30 transition-all text-xs font-bold" 
          title="Tüm Sayfayı Sıfırla"
          aria-label="Yeni Çizim Aç"
        >
          <Trash2 size={14} />
          <span>YENİ ÇİZİM</span>
        </button>

        {isAdmin && (
          <button 
            onClick={() => { setIsAdmin(false); addNotification({ type: 'info', message: 'Çıkış Yapıldı', description: 'Yönetici panelinden güvenli bir şekilde çıkış yapıldı.' }); }}
            className="p-1.5 text-orange-400 hover:bg-orange-400/10 rounded-md transition-colors border border-orange-400/30"
            title="Yönetici Çıkışı"
            aria-label="Yönetici Çıkışı Yap"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>

      {/* Modals */}
      <CaseManagerModal isOpen={isCaseManagerOpen} onClose={() => setIsCaseManagerOpen(false)} />
      <DistanceMatrixModal isOpen={isDistanceMatrixOpen} onClose={() => setIsDistanceMatrixOpen(false)} objects={objects} />
      <ThreeDPreview isOpen={isThreeDOpen} onClose={() => setIsThreeDOpen(false)} />
      <AdminLoginModal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} onLogin={(pwd) => setIsAdmin(true, pwd)} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <MapPickerModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        initialAddress={projectInfo.address}
        onConfirm={(data) => {
          setBackgroundImage(data.staticMapUrl);
          setBackgroundOpacity(0.7);
          addNotification({
            type: 'success',
            message: 'Uydu Haritası Güncellendi',
            description: `Yeni konum (${data.address}) başarıyla sisteme işlendi ve uydu görüntüsü arka plana alındı.`
          });
          setIsMapModalOpen(false);
        }}
      />
      <ScaleCalibrationModal isOpen={isScaleCalibrationOpen} onClose={() => setIsScaleCalibrationOpen(false)} />
      <PreviewModal 
        isOpen={isPreviewModalOpen} 
        onClose={() => {
          setIsPreviewModalOpen(false);
          window.dispatchEvent(new CustomEvent('close-preview'));
        }} 
        image={previewImage} 
      />
    </div>
  );
};
