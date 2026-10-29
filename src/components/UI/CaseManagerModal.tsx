import React, { useState } from 'react';
import { X, FolderPlus, FileText, ChevronRight, Trash2, Edit3, Save, Info, FileDown, Search, MapPin } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { MapPickerModal } from './MapPickerModal';
import { v4 as uuidv4 } from 'uuid';

interface CaseManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CaseManagerModal: React.FC<CaseManagerModalProps> = ({ isOpen, onClose }) => {
  const { 
    archiveScenes = [],
    activeSceneId, 
    switchScene, 
    removeScene, 
    updateSceneName,
    projectInfo,
    updateProjectInfo,
    applyTemplate,
    clearCanvas,
    showConfirm
  } = useStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);

  // Automatic Background Cloud Sync on Modal Open
  React.useEffect(() => {
    if (isOpen) {
      useStore.getState().restoreFromCloud(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const startEditing = (id: string, name: string) => {
    setEditingId(id);
    setEditValue(name);
  };

  const saveEdit = () => {
    if (editingId && editValue.trim()) {
      updateSceneName(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const handleSaveAndClose = () => {
    // 0. Refresh template with latest form info before saving
    applyTemplate(projectInfo.type);

    setTimeout(() => {
      const { activeSceneId, scenes, archiveScenes = [], objects, backgroundImage, drawingArea } = useStore.getState();
      
      const timeString = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const reportSuffix = projectInfo.reportNo ? `- ${projectInfo.reportNo}` : '';
      const sceneName = projectInfo.type === 'diagram' 
        ? `${projectInfo.diagramType || 'Diyagram'}${reportSuffix} (${timeString})`
        : `Olay Yeri Kroki${reportSuffix} (${timeString})`;
        
      const newSceneId = uuidv4();
      
      const newScene: any = {
        id: newSceneId,
        name: sceneName,
        type: projectInfo.type,
        objects: [...objects],
        backgroundImage,
        projectInfo: { ...projectInfo },
        drawingArea: { ...drawingArea }
      };

      // Append the new scene to archiveScenes (so it creates a new separate file in Olay Yönetimi)
      const updatedArchiveScenes = [...archiveScenes, newScene];
      
      // Replace the active scene in the bottom tabs in-place, so we keep the exact page/tab count!
      let updatedScenes = [];
      if (activeSceneId && scenes.some(s => s.id === activeSceneId)) {
        updatedScenes = scenes.map(s => s.id === activeSceneId ? newScene : s);
      } else if (scenes.length > 0) {
        updatedScenes = scenes.map((s, idx) => idx === 0 ? newScene : s);
      } else {
        updatedScenes = [newScene];
      }

      useStore.setState({ 
        scenes: updatedScenes,
        archiveScenes: updatedArchiveScenes,
        activeSceneId: newSceneId
      });
      
      useStore.getState().addNotification({
        type: 'success',
        message: 'Yeni Dosya Kaydedildi',
        description: `"${sceneName}" başarıyla kaydedildi ve olaya bağlandı.`
      });

      // 2. Trigger PDF Export using direct synchronous trigger
      setTimeout(() => {
        useStore.getState().triggerExportPDF();
        // 3. Automatic Cloud Sync
        useStore.getState().syncToCloud(true);
      }, 150);

      onClose();
    }, 100);
  };

  const handleNewDrawing = () => {
    showConfirm({
      title: 'YENİ ÇİZİM BAŞLAT',
      message: 'Tüm çizimler ve bilgiler sıfırlanarak yeni bir çalışma sayfası açılacaktır. Kaydedilmemiş veriler kaybolabilir. Devam etmek istiyor musunuz?',
      onConfirm: () => {
        clearCanvas();
        // Reset active scene ID so next save creates a new entry
        useStore.setState({ activeSceneId: null });
        onClose();
      }
    });
  };

  const filteredScenes = (archiveScenes || []).filter(s => {
    // Turkish-aware lowercasing for robust searching
    const search = searchTerm.toLocaleLowerCase('tr-TR').trim();
    
    // IF NOT searching, show everything but we will sort it (or we can still filter by type if desired)
    // User requested "all saved files definitely appear here", so we remove the type filter
    if (!search) return true; 

    // IF searching, search EVERYTHING across all relevant metadata
    const name = (s.name || '').toLocaleLowerCase('tr-TR');
    const eventName = (s.projectInfo?.eventName || '').toLocaleLowerCase('tr-TR');
    const reportNo = (s.projectInfo?.reportNo || '').toLocaleLowerCase('tr-TR');
    const address = (s.projectInfo?.address || '').toLocaleLowerCase('tr-TR');
    const expert = (s.projectInfo?.sketchedBy || '').toLocaleLowerCase('tr-TR');
    const expert2 = (s.projectInfo?.expert2 || '').toLocaleLowerCase('tr-TR');
    const date = (s.projectInfo?.date || '').toLocaleLowerCase('tr-TR');
    const description = (s.projectInfo?.description || '').toLocaleLowerCase('tr-TR');
    
    return (
      name.includes(search) ||
      eventName.includes(search) ||
      reportNo.includes(search) ||
      address.includes(search) ||
      expert.includes(search) ||
      expert2.includes(search) ||
      date.includes(search) ||
      description.includes(search)
    );
  }).reverse();

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-4xl bg-[#111] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#F5C518]/20 to-transparent p-6 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#F5C518]/10 rounded-2xl flex items-center justify-center border border-[#F5C518]/20 shadow-lg shadow-[#F5C518]/10">
              <FolderPlus className="text-[#F5C518]" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-widest italic">OLAY VE DOSYA YÖNETİMİ</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Aktİf Mod: {projectInfo.type === 'diagram' ? 'DİYAGRAM' : 'OLAY YERİ KROKİSİ'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Mode Selection Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => { updateProjectInfo({ type: 'kroki' }); applyTemplate('kroki'); }}
              className={`flex flex-col items-center gap-2 p-6 rounded-2xl border transition-all ${projectInfo.type === 'kroki' ? 'bg-[#F5C518]/20 border-[#F5C518] shadow-lg shadow-[#F5C518]/10' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${projectInfo.type === 'kroki' ? 'bg-[#F5C518] text-black' : 'bg-white/10 text-gray-400'}`}>
                <FileText size={24} />
              </div>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-white">OLAY YERİ KROKİSİ</span>
            </button>
            <button 
              onClick={() => { updateProjectInfo({ type: 'diagram' }); applyTemplate('diagram'); }}
              className={`flex flex-col items-center gap-2 p-6 rounded-2xl border transition-all ${projectInfo.type === 'diagram' ? 'bg-[#F5C518]/20 border-[#F5C518] shadow-lg shadow-[#F5C518]/10' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${projectInfo.type === 'diagram' ? 'bg-[#F5C518] text-black' : 'bg-white/10 text-gray-400'}`}>
                <Edit3 size={24} />
              </div>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-white">DİYAGRAM</span>
            </button>
          </div>

          {/* Detailed Info Form */}
          <div className="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/5">
            <div className="grid grid-cols-2 gap-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Olay Adı / Başlık</label>
                  <input 
                    value={projectInfo.eventName}
                    onChange={(e) => updateProjectInfo({ eventName: e.target.value })}
                    placeholder="Olay adını giriniz..."
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-gray-700 outline-none focus:border-[#F5C518]/50"
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Rapor / Dosya No</label>
                  <input 
                    value={projectInfo.reportNo}
                    onChange={(e) => updateProjectInfo({ reportNo: e.target.value })}
                    placeholder="2024/XXX"
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-[#F5C518] placeholder:text-gray-700 outline-none focus:border-[#F5C518]/50"
                  />
               </div>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Olay Yerİ Adresİ</label>
               <div className="flex gap-2">
                 <div className="relative flex-1">
                   <input 
                     value={projectInfo.address}
                     onChange={(e) => updateProjectInfo({ address: e.target.value })}
                     placeholder="Olayın gerçekleştiği tam adresi giriniz..."
                     className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-gray-700 outline-none focus:border-[#F5C518]/50"
                   />
                 </div>
                 <button 
                   onClick={() => setIsMapPickerOpen(true)}
                   className="px-4 bg-[#F5C518]/10 border border-[#F5C518]/30 text-[#F5C518] rounded-xl hover:bg-[#F5C518]/20 transition-all flex items-center gap-2 text-[10px] font-black uppercase whitespace-nowrap"
                   title="Haritadan Seç"
                 >
                   <MapPin size={16} />
                   Harİtadan Seç
                 </button>
               </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Olay Tarİhİ</label>
                  <input 
                    type="date"
                    value={projectInfo.date}
                    onChange={(e) => updateProjectInfo({ date: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#F5C518]/50"
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Çİzen / Uzman</label>
                  <input 
                    value={projectInfo.sketchedBy}
                    onChange={(e) => updateProjectInfo({ sketchedBy: e.target.value })}
                    placeholder="Ad Soyad"
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-gray-700 outline-none focus:border-[#F5C518]/50"
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">2. Uzman / Tanık</label>
                  <input 
                    value={projectInfo.expert2}
                    onChange={(e) => updateProjectInfo({ expert2: e.target.value })}
                    placeholder="Ad Soyad"
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-gray-700 outline-none focus:border-[#F5C518]/50"
                  />
               </div>
            </div>

            {projectInfo.type === 'diagram' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Dİyagram Tİpİ / Notu</label>
                <input 
                  list="diagram-types"
                  value={projectInfo.diagramType}
                  onChange={(e) => updateProjectInfo({ diagramType: e.target.value })}
                  placeholder="Seçiniz veya manuel giriniz..."
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-[#F5C518] outline-none focus:border-[#F5C518]/50"
                />
                <datalist id="diagram-types">
                  <option value="OTOMOBİL DİYAGRAMI" />
                  <option value="KAMYON/OTOBÜS DİYAGRAMI" />
                  <option value="MOTOSİKLET DİYAGRAMI" />
                  <option value="YAYALI KAZA DİYAGRAMI" />
                  <option value="BİSİKLET KAZA DİYAGRAMI" />
                  <option value="TREN/RAYLI SİSTEM DİYAGRAMI" />
                </datalist>
              </div>
            )}

            <div className="space-y-2">
               <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Olay Açıklaması / Notlar</label>
               <textarea 
                 value={projectInfo.description}
                 onChange={(e) => updateProjectInfo({ description: e.target.value })}
                 placeholder="Olay ile ilgili ek notlar veya açıklama..."
                 rows={2}
                 className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-gray-700 outline-none focus:border-[#F5C518]/50 resize-none"
               />
            </div>
          </div>

          {/* Scene List Section */}
          <div className="space-y-4">
             <div className="flex items-center justify-between mb-4">
                 <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={14} className="text-[#F5C518]" />
                    Bu Olaya Bağlı Çİzİmler ve Krokİler
                 </h3>
                 <div className="flex items-center gap-3">
                    <div className="relative group">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#F5C518] transition-colors" />
                      <input 
                        type="text"
                        placeholder="Detaylı Sorgula (Ad, No, Adres...)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-white/5 border border-white/5 hover:border-white/10 focus:border-[#F5C518]/50 text-[10px] font-bold text-white px-8 py-1.5 rounded-full outline-none w-64 transition-all placeholder:text-gray-700"
                      />
                      {searchTerm && (
                        <button 
                          onClick={() => setSearchTerm('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase px-3 py-1 bg-white/5 rounded-full">
                      {filteredScenes.length} {searchTerm ? 'SONUÇ' : (projectInfo.type === 'diagram' ? 'Dİyagram' : 'Krokİ')}
                    </span>
                 </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {filteredScenes.length === 0 && (
                   <div className="py-12 flex flex-col items-center justify-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                      <FileText size={40} className="text-gray-700 mb-2" />
                      <p className="text-[10px] text-gray-500 font-bold uppercase text-center px-6">
                        {searchTerm ? `"${searchTerm}" İle eşleşen bİr krokİ veya dİyagram bulunamadı` : `Henüz bİr ${projectInfo.type === 'diagram' ? 'Dİyagram' : 'Krokİ'} eklenmedİ`}
                      </p>
                   </div>
                )}
                
                {filteredScenes.map((scene) => (
                   <div 
                    key={scene.id}
                    onClick={() => { 
                      switchScene(scene.id); 
                      setSearchTerm(''); 
                      onClose(); 
                    }}
                    className={`group relative flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${activeSceneId === scene.id ? 'bg-[#F5C518]/10 border-[#F5C518]/50 shadow-lg shadow-[#F5C518]/5' : 'bg-[#1a1a1a] border-white/5 hover:border-white/20'}`}
                   >
                      <div className="flex items-center gap-4">
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeSceneId === scene.id ? 'bg-[#F5C518] text-black' : 'bg-white/5 text-gray-500 group-hover:text-gray-300'}`}>
                            <FileText size={20} />
                         </div>
                         
                         {editingId === scene.id ? (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                               <input 
                                 autoFocus
                                 value={editValue}
                                 onChange={(e) => setEditValue(e.target.value)}
                                 onBlur={saveEdit}
                                 onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                 className="bg-[#222] border border-[#F5C518]/50 text-sm font-bold text-white px-3 py-1 rounded-lg outline-none"
                               />
                               <button onClick={saveEdit} className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors">
                                  <Save size={14} />
                                </button>
                            </div>
                         ) : (
                            <div>
                               <p className={`text-sm font-bold uppercase tracking-tight ${activeSceneId === scene.id ? 'text-white' : 'text-gray-400'}`}>
                                  {scene.name}
                               </p>
                               <div className="flex items-center gap-2 mt-0.5">
                                 <p className="text-[9px] text-gray-600 font-bold uppercase">
                                    {scene.type === 'diagram' ? 'DİYAGRAM' : 'KROKİ'}
                                 </p>
                                 <span className="text-gray-800">•</span>
                                 <p className="text-[9px] text-gray-600 font-bold truncate max-w-[150px]">
                                    {scene.projectInfo?.reportNo || 'NO BELİRTİLMEDİ'}
                                 </p>
                               </div>
                            </div>
                         )}
                      </div>

                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                         <button 
                           onClick={() => {
                             switchScene(scene.id);
                             setTimeout(() => {
                               useStore.getState().triggerExportPDF();
                             }, 250);
                           }}
                           className="p-2 bg-[#F5C518]/10 text-[#F5C518] hover:bg-[#F5C518]/20 rounded-lg transition-all"
                           title="PDF Olarak Aç/İndir"
                         >
                            <FileDown size={14} />
                         </button>
                         <button 
                           onClick={() => startEditing(scene.id, scene.name)}
                           className="p-2 bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                         >
                            <Edit3 size={14} />
                         </button>
                          <button 
                            onClick={() => {
                              showConfirm({
                                title: 'BELGEYİ SİL',
                                message: `"${scene.name}" isimli çizim/kroki kalıcı olarak silinecektir. Bu işlem bulut yedeğini de güncelleyecektir. Devam etmek istiyor musunuz?`,
                                onConfirm: async () => { await removeScene(scene.id); }
                              });
                            }}
                            className="p-2 bg-red-500/10 text-red-500/50 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                            title="Kalıcı Olarak Sil"
                          >
                             <Trash2 size={14} />
                          </button>
                         <div className="ml-2 w-8 h-8 flex items-center justify-center text-[#F5C518]">
                            <ChevronRight size={18} />
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        </div>

        <div className="bg-white/5 p-4 flex justify-end gap-3 flex-shrink-0 border-t border-white/5">
           <p className="text-[9px] text-gray-600 font-bold uppercase mr-auto flex items-center gap-2 italic">
              <Info size={12} />
              Bİlgİlerİ kaydet dedİğİnİzde rapor otomatik olarak PDF formatında İndİrİlecektİr.
           </p>
           <button 
             onClick={handleNewDrawing}
             className="px-6 py-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 font-black text-xs uppercase tracking-[0.1em] rounded-xl transition-all border border-red-500/20"
           >
             YENİ ÇİZİM
           </button>
           <button 
             onClick={handleSaveAndClose}
             className="px-12 py-3 bg-[#F5C518] hover:bg-[#E2B616] text-black font-black text-xs uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-[#F5C518]/20"
           >
             Bİlgİlerİ Kaydet ve PDF Oluştur
           </button>
        </div>
      </div>
      <MapPickerModal
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        initialAddress={projectInfo.address}
        onConfirm={(data) => {
          updateProjectInfo({ address: data.address });
          if (projectInfo.type === 'kroki') {
             useStore.getState().setBackgroundImage(data.staticMapUrl);
             useStore.getState().setBackgroundOpacity(0.7);
          }
        }}
      />
    </div>
  );
};
