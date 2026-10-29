import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, RefreshCw, CloudDownload, CheckSquare, Square, Search, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { v4 as uuidv4 } from 'uuid';
import { getOptimizedCloudinaryUrl, publicIdFromUrl } from '../../lib/cloudinary';

interface CloudAsset {
  id: string;
  src: string;
  name: string;
  category: string;
}

/**
 * Bulut Galerisi: Cloudinary deposundaki TÜM görselleri listeler;
 * kullanıcı seçtiklerini kütüphaneye (uploadedImages) yükler.
 * - Kütüphanede zaten olanlar (public_id/URL eşleşmesi) "Kütüphanede" rozetiyle işaretlenir
 * - Kalıcı olarak silinmişler (deletedAssetIds) gizlenir (talep edilirse gösterilir)
 * - Mükerrer yükleme engellenir
 */
export const CloudGalleryModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    uploadedImages, allSymbols, adminSettings, adminPassword,
    addUploadedImage, addNotification
  } = useStore();

  const [assets, setAssets] = useState<CloudAsset[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/list-cloudinary', {
        headers: { 'x-auth-token': adminPassword || '' }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error || !Array.isArray(data.assets)) {
        throw new Error(data.error || 'Bulut görselleri alınamadı');
      }
      setAssets(data.assets);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [adminPassword]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Mevcut kütüphane parmak izleri: public_id + URL
  const existingUrls = useMemo(() => {
    const s = new Set<string>();
    uploadedImages.forEach(i => i.src && s.add(i.src));
    allSymbols.forEach(c => c.symbols.forEach((sym: any) => sym.src && s.add(sym.src)));
    return s;
  }, [uploadedImages, allSymbols]);

  const existingPids = useMemo(() => {
    const s = new Set<string>();
    uploadedImages.forEach(i => { const p = publicIdFromUrl(i.src); if (p) s.add(p); });
    allSymbols.forEach(c => c.symbols.forEach((sym: any) => { const p = publicIdFromUrl(sym.src); if (p) s.add(p); }));
    return s;
  }, [uploadedImages, allSymbols]);

  const deletedKeys = useMemo(
    () => new Set<string>(adminSettings.deletedAssetIds || []),
    [adminSettings.deletedAssetIds]
  );

  const isDeletedAsset = useCallback((a: CloudAsset) => {
    const pid = publicIdFromUrl(a.src) || a.id;
    const nameKey = a.name ? 'name:' + a.name.trim().toLowerCase() : null;
    return deletedKeys.has(a.id) || deletedKeys.has(pid) || deletedKeys.has(a.src) ||
           (nameKey ? deletedKeys.has(nameKey) : false);
  }, [deletedKeys]);

  const isExistingAsset = useCallback((a: CloudAsset) => {
    const pid = publicIdFromUrl(a.src);
    return existingUrls.has(a.src) || (pid ? existingPids.has(pid) : false);
  }, [existingUrls, existingPids]);

  const visibleAssets = useMemo(() => {
    if (!assets) return [];
    const q = query.trim().toLowerCase();
    return assets.filter(a => {
      if (!showDeleted && isDeletedAsset(a)) return false;
      if (q && !(`${a.name} ${a.category}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [assets, query, showDeleted, isDeletedAsset]);

  const newSelectable = visibleAssets.filter(a => !isExistingAsset(a));
  const selectedCount = newSelectable.filter(a => selected.has(a.id)).length;

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllNew = () => {
    setSelected(prev => {
      const next = new Set(prev);
      const allSelected = newSelectable.every(a => next.has(a.id));
      newSelectable.forEach(a => allSelected ? next.delete(a.id) : next.add(a.id));
      return next;
    });
  };

  const importSelected = async () => {
    if (selectedCount === 0) return;
    setImporting(true);
    let added = 0, skipped = 0;
    for (const a of newSelectable) {
      if (!selected.has(a.id)) continue;
      const before = useStore.getState().uploadedImages.length;
      await addUploadedImage(
        { id: uuidv4(), src: a.src, name: a.name, category: a.category || 'uncategorized' },
        { allowDeletedName: true }
      );
      const after = useStore.getState().uploadedImages.length;
      if (after > before) added++; else skipped++;
      setSelected(prev => { const n = new Set(prev); n.delete(a.id); return n; });
    }
    setImporting(false);
    addNotification({
      type: 'success',
      message: 'Buluttan Yükleme Tamamlandı',
      description: `${added} görsel kütüphaneye eklendi${skipped > 0 ? `, ${skipped} mükerrer atlandı` : ''}.`
    });
    if (added === 0 && skipped === 0) onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#0d0d0d] border border-white/15 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Başlık */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <CloudDownload size={16} className="text-[#F5C518]" />
            <h3 className="text-sm font-black text-white tracking-wide">BULUT GALERİSİ</h3>
            <span className="text-[10px] text-gray-500 font-bold">
              {assets ? `${assets.length} görsel` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadAssets}
              className="p-1.5 text-gray-400 hover:text-[#F5C518] hover:bg-white/5 rounded-md transition-all"
              title="Yenile"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-all"
              title="Kapat"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Araç çubuğu */}
        <div className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-white/10">
          <div className="flex-1 min-w-[160px] flex items-center gap-2 bg-[#111] border border-white/10 rounded-md px-2.5 py-1.5">
            <Search size={12} className="text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="İsim veya kategori ara..."
              className="flex-1 bg-transparent text-[11px] text-gray-200 outline-none placeholder:text-gray-600"
            />
          </div>
          <button
            onClick={() => setShowDeleted(v => !v)}
            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-md border transition-all flex items-center gap-1.5 ${
              showDeleted
                ? 'bg-red-500/10 border-red-500/40 text-red-300'
                : 'bg-[#111] border-white/10 text-gray-400 hover:text-gray-200'
            }`}
            title="Kalıcı silinmiş görselleri göster"
          >
            <AlertTriangle size={11} />
            SİLİNENLER
          </button>
          <button
            onClick={selectAllNew}
            disabled={newSelectable.length === 0}
            className="text-[10px] font-bold px-2.5 py-1.5 rounded-md bg-[#111] border border-[#F5C518]/30 text-[#F5C518] hover:bg-[#F5C518]/10 transition-all disabled:opacity-30"
          >
            YENİLERİNİ SEÇ ({newSelectable.length})
          </button>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="h-40 flex flex-col items-center justify-center gap-2 text-gray-500">
              <RefreshCw size={20} className="animate-spin text-[#F5C518]" />
              <span className="text-[11px] font-bold">Bulut deposu taranıyor...</span>
            </div>
          )}
          {error && !loading && (
            <div className="text-center py-10">
              <AlertTriangle size={22} className="text-red-400 mx-auto mb-2" />
              <p className="text-[11px] text-red-300 font-bold">{error}</p>
              <button onClick={loadAssets} className="mt-3 text-[10px] font-bold text-[#F5C518] hover:underline">
                Tekrar dene
              </button>
            </div>
          )}
          {!loading && !error && visibleAssets.length === 0 && (
            <p className="text-center text-[11px] text-gray-500 font-bold py-10">Gösterilecek görsel yok.</p>
          )}
          {!loading && !error && visibleAssets.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {visibleAssets.map((a) => {
                const exists = isExistingAsset(a);
                const wasDeleted = isDeletedAsset(a);
                const isSel = selected.has(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => { if (!exists) toggleSelect(a.id); }}
                    className={`relative group rounded-xl border p-2 flex flex-col items-center gap-1.5 transition-all ${
                      exists
                        ? 'border-white/5 bg-[#0a0a0a] opacity-45 cursor-default'
                        : isSel
                          ? 'border-[#F5C518] bg-[#F5C518]/10'
                          : 'border-white/10 bg-[#111] hover:border-[#F5C518]/50'
                    }`}
                  >
                    {/* Seçim işareti */}
                    <div className={`absolute top-1.5 left-1.5 ${exists ? 'hidden' : ''}`}>
                      {isSel
                        ? <CheckSquare size={14} className="text-[#F5C518]" />
                        : <Square size={14} className="text-gray-600 group-hover:text-gray-400" />}
                    </div>
                    {wasDeleted && (
                      <span className="absolute top-1.5 right-1.5 text-[7px] font-black bg-red-500/20 text-red-300 border border-red-500/40 rounded px-1 py-0.5">SİLİNMİŞ</span>
                    )}
                    <div className="w-full h-16 flex items-center justify-center">
                      <img
                        src={getOptimizedCloudinaryUrl(a.src, 120, 120)}
                        alt={a.name}
                        loading="lazy"
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.15'; }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-gray-300 text-center leading-tight line-clamp-2 w-full break-words">
                      {a.name.split('?')[0].split('.')[0].replace(/[-_]/g, ' ')}
                    </span>
                    {exists ? (
                      <span className="text-[8px] font-black text-gray-500 border border-white/10 rounded px-1">KÜTÜPHANEDE</span>
                    ) : (
                      <span className="text-[8px] font-black text-[#F5C518]/70 uppercase">{a.category}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Alt çubuk */}
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-500">
            {selectedCount} görsel seçildi
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-[10px] font-bold px-3 py-2 rounded-md bg-[#111] border border-white/10 text-gray-400 hover:text-gray-200 transition-all"
            >
              VAZGEÇ
            </button>
            <button
              onClick={importSelected}
              disabled={selectedCount === 0 || importing}
              className="text-[10px] font-black px-4 py-2 rounded-md bg-[#F5C518] text-black hover:bg-[#ffd52e] transition-all disabled:opacity-30 flex items-center gap-1.5"
            >
              {importing ? <RefreshCw size={11} className="animate-spin" /> : <CloudDownload size={11} />}
              SEÇİLENLERİ KÜTÜPHANEYE YÜKLE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
