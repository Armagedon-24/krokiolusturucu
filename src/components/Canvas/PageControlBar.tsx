import React, { useState, useRef, useEffect } from 'react';
import { FileText, Plus, X, Edit2 } from 'lucide-react';
import { useStore } from '../../store/useStore';

export const PageControlBar: React.FC = () => {
  const {
    scenes,
    activeSceneId,
    addNewPage,
    switchScene,
    removeScene,
    updateSceneName,
    showConfirm,
    addNotification,
    projectInfo,
    objects,
    backgroundImage,
    drawingArea
  } = useStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initialize the first page if scenes are empty
  useEffect(() => {
    if (!scenes || scenes.length === 0) {
      const defaultId = 'page-1-default';
      const defaultScene = {
        id: defaultId,
        name: 'Sayfa 1',
        type: projectInfo.type,
        objects: [...objects],
        backgroundImage: backgroundImage,
        projectInfo: { ...projectInfo },
        drawingArea: drawingArea ? {
          x: drawingArea.x || 0,
          y: drawingArea.y || 0,
          width: drawingArea.width || 800,
          height: drawingArea.height || 600
        } : undefined
      };
      useStore.setState({
        scenes: [defaultScene],
        activeSceneId: defaultId
      });
    }
  }, [scenes, objects, backgroundImage, projectInfo, drawingArea]);

  const handleAddPage = () => {
    setIsTypeModalOpen(true);
  };

  const createPageWithType = (type: 'kroki' | 'diagram') => {
    const pageNum = scenes.length;
    const name = `Ek ${pageNum}: ${type === 'kroki' ? 'Kroki' : 'Diyagram'}`;
    addNewPage(name, type);
    addNotification({
      type: 'success',
      message: 'Sayfa Eklendi',
      description: `"${name}" başarıyla oluşturuldu ve çizim ekranına alındı.`
    });
    setIsTypeModalOpen(false);
  };

  const handleStartRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditValue(currentName);
  };

  const handleSaveRename = (id: string) => {
    if (editValue.trim()) {
      updateSceneName(id, editValue.trim());
      addNotification({
        type: 'success',
        message: 'Sayfa Yeniden Adlandırıldı',
        description: `Sayfa ismi "${editValue.trim()}" olarak güncellendi.`
      });
    }
    setEditingId(null);
  };

  const handleDeletePage = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (scenes.length <= 1) {
      addNotification({
        type: 'warning',
        message: 'Sayfa Silinemez',
        description: 'Çalışmada en az bir sayfa bulunmalıdır.'
      });
      return;
    }

    showConfirm({
      title: 'SAYFAYI SİL',
      message: `"${name}" isimli sayfa ve üzerindeki tüm çizimler kalıcı olarak silinecektir. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?`,
      onConfirm: () => {
        removeScene(id);
        addNotification({
          type: 'info',
          message: 'Sayfa Silindi',
          description: `"${name}" isimli sayfa sistemden kaldırıldı.`
        });
      }
    });
  };

  return (
    <div className="h-12 bg-[#141414] border-t border-[#222] flex items-center px-4 gap-2 z-10 flex-shrink-0 select-none page-control-bar relative">
      {/* Title / Helper info */}
      <div className="flex items-center gap-1.5 border-r border-[#222] pr-3 mr-1">
        <FileText size={14} className="text-[#F5C518] animate-pulse" />
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">SAYFALAR:</span>
      </div>

      {/* Tabs Container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex items-center gap-1.5 overflow-x-auto overflow-y-hidden h-full scroll-smooth custom-scrollbar pr-4 py-1"
      >
        {scenes.map((scene) => {
          const isActive = scene.id === activeSceneId;
          const isEditing = scene.id === editingId;

          return (
            <div
              key={scene.id}
              onClick={() => !isActive && switchScene(scene.id)}
              onDoubleClick={(e) => handleStartRename(scene.id, scene.name, e)}
              className={`group flex items-center gap-2 h-8 px-3.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-[#1e1e1e] border-[#F5C518]/50 text-white shadow-lg shadow-[#F5C518]/5 font-black border-t-2 border-t-[#F5C518]'
                  : 'bg-black/40 border-[#222] text-gray-500 hover:text-gray-300 hover:border-gray-800'
              }`}
            >
              <FileText size={11} className={isActive ? 'text-[#F5C518]' : 'text-gray-600 group-hover:text-gray-400'} />
              
              {isEditing ? (
                <input
                  type="text"
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleSaveRename(scene.id)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(scene.id)}
                  className="bg-[#111] border border-[#F5C518]/50 text-[10px] font-black text-white px-2 py-0.5 rounded outline-none w-24 h-5 focus:ring-1 focus:ring-[#F5C518]"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-[10px] uppercase tracking-wider select-none truncate max-w-[120px]">
                  {scene.name}
                </span>
              )}

              {/* Rename helper button */}
              {!isEditing && isActive && (
                <button
                  onClick={(e) => handleStartRename(scene.id, scene.name, e)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[#333] text-gray-400 hover:text-[#F5C518] rounded transition-all"
                  title="Yeniden Adlandır"
                >
                  <Edit2 size={10} />
                </button>
              )}

              {/* Delete button */}
              {scenes.length > 1 && (
                <button
                  onClick={(e) => handleDeletePage(scene.id, scene.name, e)}
                  className={`p-0.5 rounded transition-all ${
                    isActive
                      ? 'text-gray-600 hover:text-red-500 hover:bg-red-500/10'
                      : 'text-gray-700 hover:text-red-500 hover:bg-red-500/10 group-hover:opacity-100'
                  }`}
                  title="Sayfayı Sil"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          );
        })}

        {/* Add Page Button inside scroll area */}
        <button
          onClick={handleAddPage}
          className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-[#F5C518]/30 bg-[#F5C518]/5 text-[#F5C518] hover:bg-[#F5C518]/15 hover:border-[#F5C518]/50 transition-all font-black text-[10px] uppercase tracking-wider shrink-0"
          title="Yeni Boş Sayfa Ekle"
        >
          <Plus size={12} />
          SAYFA EKLE
        </button>
      </div>

      <div className="text-[9px] text-gray-600 italic tracking-tighter uppercase pr-1 select-none pointer-events-none">
        Çift tıklayarak sayfayı yeniden adlandırın
      </div>

      {/* Page Type Selection Modal */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#111] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="relative p-8">
              {/* Decorative Background */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#F5C518]/10 blur-[60px] rounded-full -translate-y-1/2 translate-x-1/2" />
              
              <div className="flex flex-col gap-6 relative">
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-black text-white uppercase tracking-widest italic flex items-center justify-center gap-2">
                    <Plus size={20} className="text-[#F5C518]" />
                    YENİ SAYFA EKLE
                  </h3>
                  <p className="text-[11px] font-semibold text-gray-400 leading-relaxed">
                    Eklemek istediğiniz yeni sayfanın formatını seçiniz. Bu sayfa ilk sayfanın eki (devamı) olarak projeye eklenecektir.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-2">
                  {/* Kroki Option */}
                  <button
                    onClick={() => createPageWithType('kroki')}
                    className="group flex flex-col items-center gap-3 p-5 bg-white/5 border border-white/10 hover:border-[#F5C518] hover:bg-[#F5C518]/5 rounded-2xl transition-all duration-300 text-center shadow-lg hover:shadow-[#F5C518]/5"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/5 group-hover:bg-[#F5C518] text-gray-400 group-hover:text-black flex items-center justify-center transition-all duration-300">
                      <FileText size={22} />
                    </div>
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-white group-hover:text-[#F5C518] transition-colors">OLAY YERİ KROKİSİ</span>
                      <p className="text-[9px] text-gray-500 font-semibold mt-1">Ölçümler ve yerleşim planı çizim alanı</p>
                    </div>
                  </button>

                  {/* Diagram Option */}
                  <button
                    onClick={() => createPageWithType('diagram')}
                    className="group flex flex-col items-center gap-3 p-5 bg-white/5 border border-white/10 hover:border-[#F5C518] hover:bg-[#F5C518]/5 rounded-2xl transition-all duration-300 text-center shadow-lg hover:shadow-[#F5C518]/5"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/5 group-hover:bg-[#F5C518] text-gray-400 group-hover:text-black flex items-center justify-center transition-all duration-300">
                      <Edit2 size={22} />
                    </div>
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-white group-hover:text-[#F5C518] transition-colors">DİYAGRAM</span>
                      <p className="text-[9px] text-gray-500 font-semibold mt-1">Hasar tespiti ve kaza analiz şablonu</p>
                    </div>
                  </button>
                </div>

                <div className="flex flex-col w-full gap-3 mt-4">
                  <button
                    onClick={() => setIsTypeModalOpen(false)}
                    className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl border border-white/5 transition-all"
                  >
                    İPTAL
                  </button>
                </div>
              </div>

              <button 
                onClick={() => setIsTypeModalOpen(false)}
                className="absolute top-6 right-6 p-2 text-gray-600 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
