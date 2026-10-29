import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  ImageIcon,
  Search,
  Type,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Settings2,
  Play,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { v4 as uuidv4 } from 'uuid';
import { Lock, Calculator } from 'lucide-react';
import { CalculatorIndex } from './Calculators/CalculatorIndex';
import { AnimationIndex } from './Animations/AnimationIndex';
import { processUploadedSymbolImage } from '../../utils/canvasUtils';
import { getOptimizedCloudinaryUrl } from '../../lib/cloudinary';

export const Sidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'symbols' | 'uploads' | 'animations' | 'calculators'>('symbols');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const {
    addObject,
    uploadedImages,
    addUploadedImage,
    updateUploadedImage,
    removeUploadedImage,
    allSymbols,
    setAllSymbols,
    removeSymbol,
    isSidebarOpen,
    toggleSidebar,
    addNotification,
    isAdmin,
    recoverCloudinaryImages,
    refreshSymbols
  } = useStore();

  useEffect(() => {
    refreshSymbols();
  }, [refreshSymbols]);

  const [draggedItem, setDraggedItem] = useState<{ id: string, catId: string, isUpload?: boolean } | null>(null);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [showAllUploads, setShowAllUploads] = useState(false);
  const [hoveredSymbol, setHoveredSymbol] = useState<{ id: string, name: string, description?: string, rect: DOMRect } | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Hangi format gelirse gelsin: yeniden boyutlandır + PNG + şeffaf arka plan
        const compressedSrc = await processUploadedSymbolImage(file, 600, 600);
        const capitalizedName = file.name.replace(/\.(png|jpe?g|webp|gif|bmp|svg)$/i, '');
        const displayName = capitalizedName.charAt(0).toUpperCase() + capitalizedName.slice(1);

        addUploadedImage({
          id: uuidv4(),
          src: compressedSrc,
          name: displayName,
          category: 'uncategorized',
        });
        addNotification({
          type: 'success',
          message: 'Görsel Yüklendi',
          description: `"${file.name}" başarıyla sıkıştırılıp sisteme eklendi.`
        });
      } catch (err) {
        console.error('Image optimization error:', err);
      }
    }
  };

  const handleCategoryUpload = async (e: React.ChangeEvent<HTMLInputElement>, categoryId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Hangi format gelirse gelsin: yeniden boyutlandır + PNG + şeffaf arka plan
        const compressedSrc = await processUploadedSymbolImage(file, 600, 600);
        const capitalizedName = file.name.replace(/\.(png|jpe?g|webp|gif|bmp|svg)$/i, '');
        const displayName = capitalizedName.charAt(0).toUpperCase() + capitalizedName.slice(1);

        addUploadedImage({
          id: uuidv4(),
          src: compressedSrc,
          name: displayName,
          category: categoryId,
        });
        addNotification({
          type: 'success',
          message: 'Görsel Yüklendi',
          description: `"${file.name}" başarıyla sıkıştırılıp sisteme eklendi.`
        });
      } catch (err) {
        console.error('Category upload error:', err);
      }
    }
  };

  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setDraggedItem(null);
    };
    window.addEventListener('dragend', handleGlobalDragEnd);
    return () => window.removeEventListener('dragend', handleGlobalDragEnd);
  }, []);

  const handleDragStart = (e: React.DragEvent, item: any, catId: string, isUpload: boolean = false) => {
    setHoveredSymbol(null); // Sürükleme başladığında balonu hemen kapat
    const symbolWithCat = { ...item, categoryId: catId };
    e.dataTransfer.setData('symbol', JSON.stringify(symbolWithCat));
    e.dataTransfer.effectAllowed = isAdmin ? 'move' : 'copy';
    setDraggedItem({ id: item.id, catId, isUpload });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedItem(null);
  };

  const handleSidebarDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSidebarDrop = (e: React.DragEvent, toCatId: string, toSymbolId?: string) => {
    e.preventDefault();
    if (!isAdmin) {
      addNotification({
        type: 'warning',
        message: 'Yetki Gerekli',
        description: 'Kategoriler arası taşıma işlemi için yönetici girişi yapmalısınız.'
      });
      setDraggedItem(null);
      return;
    }
    if (!draggedItem) return;

    const { id: fromId, catId: fromCatId, isUpload } = draggedItem;
    setDraggedItem(null);

    // 1. Yüklenen Görsellerin Reorganizasyonu
    if (isUpload) {
      if (fromCatId === toCatId && toSymbolId) {
        const newUploads = [...uploadedImages];
        const fromIdx = newUploads.findIndex(img => img.id === fromId);
        const toIdx = newUploads.findIndex(img => img.id === toSymbolId);
        
        if (fromIdx !== -1 && toIdx !== -1) {
          const [movedItem] = newUploads.splice(fromIdx, 1);
          newUploads.splice(toIdx, 0, movedItem);
          useStore.setState({ uploadedImages: newUploads });
          useStore.getState().syncToCloud(true);
        }
      } else {
        updateUploadedImage(fromId, toCatId);
      }
      return;
    }

    // 2. Hazır Sembollerin Reorganizasyonu
    const newAllSymbols = structuredClone(allSymbols) as any[];
    const fromCat = newAllSymbols.find((c: any) => c.id === fromCatId);
    const toCat = newAllSymbols.find((c: any) => c.id === toCatId);

    if (!fromCat || !toCat) return;

    const symbolIndex = fromCat.symbols.findIndex((s: any) => s.id === fromId);
    if (symbolIndex === -1) return;

    const [symbol] = fromCat.symbols.splice(symbolIndex, 1);

    if (toSymbolId) {
      const toIndex = toCat.symbols.findIndex((s: any) => s.id === toSymbolId);
      toCat.symbols.splice(toIndex !== -1 ? toIndex : toCat.symbols.length, 0, symbol);
    } else {
      toCat.symbols.push(symbol);
    }

    setAllSymbols(newAllSymbols);
    useStore.getState().syncToCloud(true);
    
    addNotification({
      type: 'info',
      message: 'Sembol Düzenlendi',
      description: 'Sıralama başarıyla güncellendi.'
    });
  };

  const filteredSymbols = useMemo(() => {
    return allSymbols
      .map((cat) => {
        const matchingSymbols = cat.symbols.filter((s: any) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        const matchingUploads = uploadedImages.filter(
          (img) => img.category === cat.id && img.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        return {
          ...cat,
          symbols: matchingSymbols,
          hasUploads: matchingUploads.length > 0,
          totalCount: matchingSymbols.length + matchingUploads.length
        };
      })
      .filter(
        (cat) =>
          (searchQuery.length > 0 || selectedCategory === 'all' || cat.id === selectedCategory) && cat.totalCount > 0
      );
  }, [allSymbols, selectedCategory, searchQuery, uploadedImages]);

  const filteredUploads = useMemo(() => {
    return uploadedImages.filter(
      (img) =>
        img.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        (searchQuery.length > 0 || selectedCategory === 'all' || img.category === selectedCategory)
    );
  }, [uploadedImages, selectedCategory, searchQuery]);

  const logicalOrder = useMemo(() => [
    'evidence',      // DELİL İŞARETLERİ
    'vehicles',      // ARAÇLAR
    'streets',       // CADDE SOKAK
    'traffic',       // TRAFİK İŞARETLERİ
    'architecture',  // MİMARİ YAPILAR
    'humans',        // İNSAN FİGÜRLERİ
    'wounds',        // YARA VE YARALANMALAR
    'clothing',      // GİYSİ EŞYA
    'weapons',       // SİLAHLAR VE PARÇALARI
    'traces',        // İZLER
    'explosions',    // PATLAMA VE HASAR
    'outdoor',       // AÇIK ALAN SEMBOLLERİ
    'household',     // EV EŞYALARI
    'arrows',        // OKLAR VE YÖNLER
    'shapes'         // ŞEKİLLER
  ], []);

  const sortedCategories = useMemo(() => {
    return [...allSymbols].sort((a, b) => {
      const indexA = logicalOrder.indexOf(a.id);
      const indexB = logicalOrder.indexOf(b.id);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [allSymbols, logicalOrder]);

  const tabs = [
    { id: 'symbols' as const, label: 'SEMBOLLER', icon: <Package size={18} /> },
    { id: 'uploads' as const, label: 'YÜKLENENLER', icon: <ImageIcon size={18} /> },
    { id: 'animations' as const, label: 'ANİMASYON', icon: <Play size={18} /> },
    { id: 'calculators' as const, label: 'HESAPLAYICI', icon: <Calculator size={18} /> },
  ];

  return (
    <aside
      className={`absolute md:relative z-40 bg-[#1a1a1a] border-r border-[#2a2a2a] transition-all duration-300 ease-in-out flex flex-col h-full overflow-visible flex-shrink-0 sidebar ${
        isSidebarOpen ? 'w-96' : 'w-0 border-r-0'
      }`}
      onMouseLeave={() => setHoveredSymbol(null)}
    >
      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute left-full top-1/2 -translate-y-1/2 w-6 h-12 bg-[#2a2a2a] border border-[#333] border-l-0 rounded-r-md flex items-center justify-center text-[#F5C518] hover:bg-[#333] transition-colors z-50 shadow-xl"
        title={isSidebarOpen ? "Paneli Kapat" : "Paneli Aç"}
        aria-label={isSidebarOpen ? "Paneli Kapat" : "Paneli Aç"}
      >
        {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* Content wrapper — overflow-visible so absolute dropdowns are not clipped */}
      <div className={`flex flex-col h-full w-96 overflow-visible transition-opacity duration-200 ${
        isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        {/* Tabs */}
        <div className="flex border-b border-[#2a2a2a] flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 text-[11px] font-black tracking-wide transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-[#F5C518] text-[#F5C518]'
                  : 'border-transparent text-gray-300 hover:text-white'
              }`}
              aria-label={tab.label}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          {activeTab === 'symbols' && (
            <>
              {/* Search */}
              <div className="px-3 pt-3 flex-shrink-0">
                <div className="flex items-center bg-[#111] border border-[#333] rounded-md px-3 py-1.5 gap-2">
                  <Search size={14} className="text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 text-xs text-gray-200 placeholder-gray-400 w-full outline-none"
                    aria-label="Sembol veya Görsel Ara"
                  />
                </div>
              </div>

              {/* Category filters */}
              <div className="px-3 pt-2 pb-1 flex-shrink-0">
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-1 py-1.5 rounded transition-all text-[8px] font-black border ${
                      selectedCategory === 'all'
                        ? 'bg-[#F5C518] text-black border-[#F5C518]'
                        : 'bg-[#242424] text-gray-200 hover:text-white border-[#333] hover:border-[#F5C518]/40'
                    }`}
                    aria-label="Tüm Kategoriler"
                  >
                    TÜMÜ
                  </button>
                  {sortedCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-1 py-1.5 rounded transition-all text-[8px] font-black border truncate ${
                        selectedCategory === cat.id
                          ? 'bg-[#F5C518] text-black border-[#F5C518]'
                          : 'bg-[#242424] text-gray-200 hover:text-white border-[#333] hover:border-[#F5C518]/40'
                      }`}
                      title={cat.name.toUpperCase()}
                      aria-label={`${cat.name} Kategorisi`}
                    >
                      {cat.name.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add Text Button */}
              <div className="px-3 py-2 flex-shrink-0">
                <button
                  onClick={() =>
                    addObject({ type: 'text', text: 'Yeni Metin', width: 200, fontSize: 12, fill: '#000000', fontFamily: 'Inter' })
                  }
                  className="w-full flex items-center justify-center gap-2 py-2 bg-[#242424] border border-[#333] rounded-md hover:border-[#F5C518]/50 hover:bg-[#2a2a2a] transition-all text-xs font-bold text-white"
                  aria-label="Metin Kutusu Ekle"
                >
                  <Type size={14} className="text-[#F5C518]" />
                  METİN KUTUSU EKLE
                </button>
              </div>

              {/* Symbol Lists */}
              <div className="px-3 pb-4 space-y-5">
                {filteredSymbols.length === 0 && filteredUploads.length === 0 && (
                  <div className="text-center py-12">
                    <div className="bg-[#242424] rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3">
                      <Search size={28} className="text-gray-600" />
                    </div>
                    <p className="text-gray-600 text-xs">Eşleşen sembol bulunamadı.</p>
                  </div>
                )}


                {filteredSymbols.map((cat) => {
                  const catUploads = filteredUploads.filter((img) => img.category === cat.id);
                  return (
                    <div key={cat.id} className="space-y-4">
                      <div 
                        className="flex items-center justify-between cursor-pointer py-1.5 border-b border-[#333] mb-3 group/header"
                        onDragOver={handleSidebarDragOver}
                        onDrop={(e) => handleSidebarDrop(e, cat.id)}
                      >
                        <h3 className="text-[11px] font-black text-[#F5C518] uppercase tracking-widest border-l-2 border-[#F5C518] pl-2">
                          {cat.name}
                        </h3>
                        {isAdmin && (
                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer text-[9px] bg-[#2a2a2a] hover:bg-[#333] border border-[#444] text-gray-300 px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors">
                              <Upload size={10} className="text-[#F5C518]" />
                              YÜKLE
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*" 
                                onChange={(e) => handleCategoryUpload(e, cat.id)} 
                              />
                            </label>
                            <span className="text-[8px] text-gray-600 font-bold group-hover/header:text-gray-400 transition-colors">
                              SIRALA ↕
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-6">
                        {(() => {
                          const groups: Record<string, any[]> = {};
                          
                          // Predefined symbols
                          cat.symbols.forEach((s: any) => {
                            const g = (s.group || '').trim().toLocaleUpperCase('tr-TR');
                            if (!groups[g]) groups[g] = [];
                            groups[g].push({ ...s, isUpload: false });
                          });

                          // Uploaded images for this category
                          catUploads.forEach((img) => {
                            const g = (img.group || '').trim().toLocaleUpperCase('tr-TR');
                            if (!groups[g]) groups[g] = [];
                            groups[g].push({ ...img, isUpload: true });
                          });

                          return Object.entries(groups).map(([groupName, groupItems]) => (
                            <div key={groupName} className="space-y-3 group/section">
                              <div className="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded-md border border-white/5">
                                <Package size={10} className="text-[#F5C518]/70" />
                                <span className="text-[9px] font-black text-gray-300 uppercase tracking-wider">
                                  {groupName || 'DİĞER'}
                                </span>
                                <div className="ml-auto flex items-center gap-1.5">
                                  <span className="text-[8px] text-gray-300 font-bold px-1.5 py-0.5 bg-black/50 rounded-full">
                                    {groupItems.length}
                                  </span>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 px-0.5">
                                {groupItems.map((item: any) => (
                                  <div
                                    key={item.id}
                                    onDragOver={handleSidebarDragOver}
                                    onDrop={(e) => handleSidebarDrop(e, cat.id, item.id)}
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setHoveredSymbol({ id: item.id, name: item.name, description: item.description, rect });
                                    }}
                                    onMouseLeave={() => setHoveredSymbol(null)}
                                    onDoubleClick={() => {
                                      const doorIds = ['arch-d1r', 'arch-d1l', 'arch-d2'];
                                      const isDoor = doorIds.includes(item.id);
                                      const isWindow = item.id === 'arch-win';
                                      const isWall = ['arch-w1', 'arch-w1v', 'arch-w1i', 'arch-w1vi'].includes(item.id);
                                      
                                      let finalWidth = item.id === 'arch-d2' ? 120 : (isDoor ? 60 : (item.width || 100));
                                      let finalHeight = isDoor ? 60 : (item.height || 100);

                                      if (isWindow) {
                                        finalWidth = 50;
                                        finalHeight = 10;
                                      } else if (isWall) {
                                        if (item.id === 'arch-w1') { finalWidth = 200; finalHeight = 10; }
                                        else if (item.id === 'arch-w1v') { finalWidth = 10; finalHeight = 200; }
                                        else if (item.id === 'arch-w1i') { finalWidth = 200; finalHeight = 8; }
                                        else if (item.id === 'arch-w1vi') { finalWidth = 8; finalHeight = 200; }
                                      }

                                      addObject({
                                        ...item,
                                        symbolId: item.id,
                                        categoryId: cat.id,
                                        id: uuidv4(),
                                        x: 250,
                                        y: 250,
                                        width: finalWidth,
                                        height: finalHeight,
                                        distanceColor: '#000000',
                                      });
                                      
                                      addNotification({
                                        type: 'info',
                                        message: 'Sembol Eklendi',
                                        description: `"${item.name || 'Sembol'}" çift tıklanarak tuvale yerleştirildi.`
                                      });
                                    }}
                                    className={`group relative aspect-square bg-[#111] border rounded-xl flex flex-col items-center p-2 cursor-pointer hover:scale-102 active:scale-98 transition-all duration-300 ${
                                      item.isUpload 
                                        ? 'border-[#F5C518]/30 hover:border-[#F5C518]/70 shadow-lg shadow-black/20' 
                                        : 'border-white/10 hover:border-[#F5C518]/50 shadow-md'
                                    } ${draggedItem?.id === item.id ? 'opacity-20 scale-90' : 'opacity-100 hover:bg-[#0a0a0a]'}`}
                                  >
                                    {/* Image Container - Fixed height and Draggable */}
                                    <div 
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, item, cat.id, item.isUpload)}
                                      onDragEnd={handleDragEnd}
                                      className="w-full h-12 flex items-center justify-center relative flex-shrink-0 cursor-move"
                                    >
                                      <div className="absolute inset-0 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                      <img
                                        src={getOptimizedCloudinaryUrl(item.thumbnail || item.src, 80, 80)}
                                        alt={item.name}
                                        loading="lazy"
                                        width={48}
                                        height={48}
                                        onError={(e) => {
                                          if (item.isUpload) {
                                            removeUploadedImage(item.id);
                                          } else {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }
                                        }}
                                        className="max-w-[95%] max-h-[95%] object-contain transition-transform duration-300 group-hover:scale-110 relative z-10 pointer-events-none sidebar-symbol-filter"
                                      />
                                    </div>
                                    
                                    {/* Name Area - Larger and Brighter */}
                                    <div className="w-full flex-1 flex items-start justify-center mt-1.5 px-0.5 min-h-[2.2em]">
                                      <span className="text-[11px] font-black text-gray-100 text-center leading-[1.15] transition-colors group-hover:text-white block w-full break-words drop-shadow-sm">
                                        {item.name
                                          .split('?')[0] // Önce query parametrelerini at
                                          .split('.')[0] // Sonra uzantıyı at
                                          .replace(/üstten\s+görünüm/gi, '(Üstten)')
                                          .replace(/sağdan\s+görünüm/gi, '(Sağdan)')
                                          .replace(/soldan\s+görünüm/gi, '(Soldan)')
                                          .replace(/\s[a-z0-9]{5,8}$/, '') // Rastgele ekleri temizle
                                          .replace(/[-_]/g, ' ') 
                                          .trim()}
                                      </span>
                                    </div>

                                    {isAdmin && (
                                      <div className="absolute -top-1.5 -right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-20">
                                        {item.isUpload && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveTab('uploads');
                                              setEditingImageId(item.id);
                                            }}
                                            className="bg-[#222] text-gray-500 hover:text-[#F5C518] rounded-full border border-white/10 p-1 hover:scale-110 shadow-xl"
                                            title="Kategoriyi Düzenle"
                                          >
                                            <Settings2 size={10} />
                                          </button>
                                        )}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            item.isUpload ? removeUploadedImage(item.id) : removeSymbol(cat.id, item.id);
                                          }}
                                          className="bg-[#222] text-gray-500 hover:text-red-400 rounded-full border border-white/10 p-1 hover:scale-110 shadow-xl"
                                          title="Sil"
                                        >
                                          <X size={10} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 'uploads' && (
            <div className="p-3 space-y-3">
              {isAdmin ? (
                <>
                  <label className="w-full flex flex-col items-center justify-center py-8 bg-[#111] border-2 border-dashed border-[#333] rounded-lg hover:border-[#F5C518]/50 hover:bg-[#0a0a0a] cursor-pointer transition-all">
                    <Upload size={22} className="text-gray-600 mb-2" />
                    <span className="text-xs font-bold text-gray-500">Görsel Yükle</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>

                  <div className="flex flex-col gap-2">

                    
                    <button
                      onClick={() => recoverCloudinaryImages()}
                      className="w-full py-2 bg-[#F5C518]/10 border border-[#F5C518]/30 text-[#F5C518] rounded-md hover:bg-[#F5C518]/20 transition-all text-[10px] font-bold flex items-center justify-center gap-2"
                    >
                      <Search size={12} />
                      BULUTU TARA VE EKSİKLERİ GETİR
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase">Yönetim</h4>
                    <button 
                      onClick={() => setShowAllUploads(!showAllUploads)}
                      className={`text-[9px] px-2 py-0.5 rounded border transition-all ${
                        showAllUploads ? 'bg-[#F5C518]/10 border-[#F5C518]/30 text-[#F5C518]' : 'bg-[#111] border-[#333] text-gray-500'
                      }`}
                    >
                      {showAllUploads ? 'Hepsini Gösteriliyor' : 'Kategori Bekleyenler'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(() => {
                      const uploadsToShow = showAllUploads 
                        ? uploadedImages 
                        : uploadedImages.filter(img => (!img.category || img.category === 'uncategorized') || (img.id === editingImageId));

                      if (uploadsToShow.length === 0) {
                        return (
                          <div className="text-center py-8 border-2 border-dashed border-[#333] rounded-xl">
                            <p className="text-[10px] text-gray-500">Kategorize edilecek yeni görsel yok.</p>
                          </div>
                        );
                      }

                      return uploadsToShow.map((img) => (
                        <div
                          key={img.id}
                          className={`bg-[#1e1e1e] border rounded-lg p-2 flex items-center gap-2 transition-all ${
                            editingImageId === img.id ? 'border-[#F5C518] shadow-lg shadow-[#F5C518]/10' : 'border-[#333] hover:border-[#444]'
                          }`}
                          onClick={() => setEditingImageId(img.id)}
                        >
                          <div
                            draggable
                            onDragStart={(e) =>
                              handleDragStart(e, { ...img, type: 'image' }, img.category || 'uncategorized', true)
                            }
                            onDragEnd={handleDragEnd}
                            className="w-12 h-12 bg-white/10 rounded border border-[#333] flex-shrink-0 cursor-move overflow-hidden group/thumb"
                          >
                            <img src={getOptimizedCloudinaryUrl(img.src, 80, 80)} alt={img.name} loading="lazy" width={48} height={48} className="w-full h-full object-contain group-hover/thumb:scale-110 transition-transform sidebar-symbol-filter" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            {editingImageId === img.id ? (
                              <input
                                type="text"
                                value={img.name}
                                onChange={(e) => updateUploadedImage(img.id, img.category, img.group, e.target.value)}
                                className="text-[9px] w-full bg-[#111] border border-[#F5C518]/50 text-white rounded py-0.5 px-1 outline-none font-bold"
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                              />
                            ) : (
                              <p className="text-[9px] font-bold text-gray-300 leading-tight truncate" title={img.name}>
                                {img.name}
                              </p>
                            )}
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1">
                                <select
                                  value={img.category || 'uncategorized'}
                                  onChange={(e) => {
                                    updateUploadedImage(img.id, e.target.value);
                                    setEditingImageId(img.id);
                                  }}
                                  className="text-[9px] flex-1 bg-[#111] border border-[#333] text-gray-400 rounded py-0.5 px-1 outline-none focus:border-[#F5C518]/50"
                                >
                                  <option value="uncategorized">Kategori Seçin</option>
                                  {allSymbols.filter(c => c.id !== 'uncategorized').map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="relative">
                                <input
                                  list={`groups-${img.category}`}
                                  type="text"
                                  placeholder="Alt Kategori Yaz veya Seç..."
                                  value={img.group || ''}
                                  onChange={(e) => {
                                    updateUploadedImage(img.id, img.category || 'uncategorized', e.target.value);
                                    setEditingImageId(img.id);
                                  }}
                                  className="text-[9px] w-full bg-[#111] border border-[#333] text-gray-400 rounded py-0.5 px-1 outline-none focus:border-[#F5C518]/50"
                                />
                                <datalist id={`groups-${img.category}`}>
                                  {(() => {
                                    const existingGroups = new Set<string>();
                                    const cat = allSymbols.find(c => c.id === img.category);
                                    if (cat) cat.symbols.forEach((s: any) => { if (s.group) existingGroups.add(s.group); });
                                    uploadedImages.forEach(u => { if (u.category === img.category && u.group) existingGroups.add(u.group); });
                                    return Array.from(existingGroups).map(g => <option key={g} value={g} />);
                                  })()}
                                </datalist>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingImageId(null);
                              }}
                              className={`p-1 rounded transition-colors ${
                                img.category !== 'uncategorized' ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-gray-600'
                              }`}
                              title="Tamamla ve Listeden Çıkar"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeUploadedImage(img.id);
                              }}
                              className="p-1 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                              title="Sil"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="w-14 h-14 bg-[#1e1e1e] rounded-full flex items-center justify-center mb-3">
                    <Lock size={24} className="text-gray-700" />
                  </div>
                  <h4 className="text-white text-xs font-bold mb-1">Erişim Kısıtlı</h4>
                  <p className="text-gray-600 text-[10px]">Görsel yüklemek için yönetici girişi yapmalısınız.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'animations' && (
            <AnimationIndex />
          )}
          {activeTab === 'calculators' && (
            <CalculatorIndex />
          )}
        </div>
      </div>

      {/* Symbol Description Tooltip */}
      {hoveredSymbol && (
        <div 
          className="fixed z-[9999] w-72 bg-[#1e1e1e]/95 backdrop-blur-md border border-[#F5C518]/40 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-4 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
          style={{
            left: hoveredSymbol.rect.right + 25,
            top: Math.min(window.innerHeight - 200, hoveredSymbol.rect.top - 20),
          }}
        >
          <div className="flex items-center gap-2 mb-2 border-b border-[#333] pb-1.5">
            <div className="w-2 h-2 bg-[#F5C518] rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-[#F5C518] uppercase tracking-wider">
              {hoveredSymbol.name
                .replace(/\.[^/.]+$/, "") 
                .replace(/\?v=\d+/, "") 
                .replace(/üstten\s+görünüm/gi, '(Üstten)')
                .replace(/sağdan\s+görünüm/gi, '(Sağdan)')
                .replace(/soldan\s+görünüm/gi, '(Soldan)')
                .replace(/\s[a-z0-9]{6}$/, '') 
                .replace(/[-_]/g, ' ') 
                .replace(/\d+$/, '') 
                .trim()}
            </span>
          </div>
          <p className="text-[10px] text-gray-300 leading-relaxed font-medium italic">
            {hoveredSymbol.description || `${hoveredSymbol.name
              .replace(/\.[^/.]+$/, "") 
              .replace(/\?v=\d+/, "") 
              .replace(/üstten\s+görünüm/gi, '(Üstten)')
              .replace(/sağdan\s+görünüm/gi, '(Sağdan)')
              .replace(/soldan\s+görünüm/gi, '(Soldan)')
              .replace(/\s[a-z0-9]{6}$/, '') 
              .replace(/[-_]/g, ' ') 
              .replace(/\d+$/, '') 
              .trim()} nesnesini tuvale eklemek için sürükleyin.`}
          </p>
          <div className="mt-2 pt-2 border-t border-[#333] flex items-center gap-2">
            <span className="text-[8px] text-gray-500 font-bold uppercase">Kullanım:</span>
            <span className="text-[8px] text-gray-400">Tuvale sürükleyip bırakın</span>
          </div>
        </div>
      )}
    </aside>
  );
};
