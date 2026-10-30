import React, { useState, useEffect, useMemo } from 'react';
import { X, Sparkles, Loader2, Check, RefreshCw, Pencil, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { v4 as uuidv4 } from 'uuid';
import { processUploadedSymbolImage } from '../../utils/canvasUtils';

/**
 * AI Görsel Üretici (Yönetici)
 *
 * AKIŞ: Admin görsel tarifini ve kaydedilecek kategoriyi belirtir → görsel
 * üretilir (/api/generate-image) → admin'e önizlenir (beyaz zemin otomatik
 * şeffaflaştırılmış haliyle) → admin ONAYLARSA seçilen kategoriye eklenir
 * (Cloudinary'de kroki-olusturucu/<kategori>/ altına), onaylamazsa hiçbir
 * kayıt oluşmaz.
 */

interface ImageGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Kategori başlığındaki AI düğmesiyle açılışta ön-seçili kategori. */
  initialCategory?: string;
}

type Phase = 'form' | 'generating' | 'preview';

/** Şeffaflığı görselleştiren dama deseni arka plan. */
const checkerStyle: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
};

const PROMPT_PLACEHOLDER = 'Örn: kuşbakışı beyaz sedan otomobil, hasarsız, yan görünüm yok, tek nesne, saf beyaz arka plan';

/** Açılışta temiz durumla monta edilen iç form (modal her açılışta sıfırlanır). */
const ImageGeneratorForm: React.FC<{ onClose: () => void; initialCategory?: string }> = ({ onClose, initialCategory }) => {
  const { isAdmin, adminPassword, allSymbols, addUploadedImage, addNotification } = useStore();

  const [phase, setPhase] = useState<Phase>('form');
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState<string>(initialCategory || 'uncategorized');
  const [previewSrc, setPreviewSrc] = useState<string>('');
  const [assetName, setAssetName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);

  // Üretim sırasında geçen süre göstergesi (sayaç yalnızca üretim aşamasında akar)
  useEffect(() => {
    if (phase !== 'generating') return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Canlı kategori listesi (adminin özel kategorileri dahil)
  const categoryOptions = useMemo(() => {
    const cats = allSymbols.map((c) => ({ id: c.id, name: c.name }));
    cats.sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));
    if (!cats.some((c) => c.id === 'uncategorized')) {
      cats.push({ id: 'uncategorized', name: 'Kategorisiz (Yüklenenler)' });
    }
    return cats;
  }, [allSymbols]);

  /** Tariften okunur bir kütüphane adı türetir; aynı isim varsa sonuna sayı ekler. */
  const buildAssetName = (p: string): string => {
    const base = (p.split(/\s+/).slice(0, 4).join(' ').replace(/[#<>:"/\\|?*_]/g, '').trim() || 'AI Gorsel')
      .replace(/\s+/g, ' ')
      .slice(0, 40);
    const named = base.charAt(0).toLocaleUpperCase('tr-TR') + base.slice(1);
    const taken = new Set<string>();
    useStore.getState().uploadedImages.forEach((i) => taken.add(i.name));
    useStore.getState().allSymbols.forEach((c) => c.symbols.forEach((s) => taken.add(s.name)));
    if (!taken.has(named)) return named;
    for (let i = 2; i < 100; i++) {
      if (!taken.has(`${named} ${i}`)) return `${named} ${i}`;
    }
    return `${named} ${Date.now()}`;
  };

  const handleGenerate = async () => {
    const trimmed = prompt.trim().replace(/\s+/g, ' ');
    if (trimmed.length < 3) {
      setError('Lütfen üretmek istediğiniz görseli birkaç kelimeyle tarif edin.');
      return;
    }
    if (!adminPassword) {
      setError('Yönetici oturumu bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }

    setError('');
    setElapsed(0);
    setPhase('generating');

    try {
      const resp = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': adminPassword },
        body: JSON.stringify({ prompt: trimmed }),
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok || !data?.dataUri) {
        setError((data && data.error) || `Görsel üretilemedi (HTTP ${resp.status}).`);
        setPhase('form');
        return;
      }

      const raw: string = data.dataUri;
      // Beyaz zemini şeffaflaştır + yeniden boyutlandır (onaylanan = kaydedilen olsun)
      const processed = await processUploadedSymbolImage(raw, 600, 600);
      setPreviewSrc(processed || raw);
      setAssetName(buildAssetName(trimmed));
      setPhase('preview');
    } catch (err) {
      console.error('AI görsel üretim hatası:', err);
      setError('Görsel üretimi sırasında bir sorun oluştu. İnternet bağlantınızı kontrol edip tekrar deneyin.');
      setPhase('form');
    }
  };

  const handleApprove = async () => {
    if (!previewSrc || saving) return;
    setSaving(true);
    setError('');

    const newId = uuidv4();
    try {
      await addUploadedImage({
        id: newId,
        src: previewSrc,
        name: assetName,
        category,
      });

      const saved = useStore.getState().uploadedImages.some((i) => i.id === newId);
      const catName = categoryOptions.find((c) => c.id === category)?.name || category;

      if (saved) {
        addNotification({
          type: 'success',
          message: 'Görsel Onaylandı',
          description: `"${assetName}" "${catName}" kategorisine eklendi ve buluta kaydedildi.`
        });
        onClose();
      } else {
        // Store tarafı (mükerrer/bulut hatası) zaten bildirim gösterdi; önizleme kaybolmasın
        setError('Görsel kaydedilemedi. Yukarıdaki uyarıyı kontrol edip tekrar deneyebilirsiniz.');
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedCatName = categoryOptions.find((c) => c.id === category)?.name || category;

  if (!isAdmin) {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertTriangle size={32} className="mx-auto text-[#F5C518]" />
        <p className="text-sm text-gray-300 font-bold">Bu özellik yalnızca yöneticiler içindir.</p>
        <p className="text-xs text-gray-500">Görsel üretebilmek için önce admin girişi yapmalısınız.</p>
      </div>
    );
  }

  return (
    <>
      {phase === 'form' || phase === 'generating' ? (
        <div className="p-5 space-y-4">
          {/* Prompt */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
              Görsel Tarifi
            </label>
            <textarea
              autoFocus
              disabled={phase === 'generating'}
              rows={3}
              maxLength={900}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={PROMPT_PLACEHOLDER}
              className="w-full bg-[#111] border border-[#333] rounded-lg py-3 px-3 text-white text-sm outline-none focus:border-[#F5C518] transition-all disabled:opacity-50 resize-none placeholder-gray-600"
            />
            <p className="text-[9px] text-gray-600 leading-relaxed ml-1">
              İpucu: "kuşbakışı", "tek nesne", "saf beyaz arka plan" ifadeleri kroki sembolü için en iyi sonucu verir.
              Üretilen görselin beyaz zemini onaydan sonra otomatik şeffaflaştırılır.
            </p>
          </div>

          {/* Kategori */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
              Kaydedilecek Kategori
            </label>
            <div className="relative">
              <ImageIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <select
                disabled={phase === 'generating'}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full appearance-none bg-[#111] border border-[#333] rounded-lg py-3 pl-9 pr-4 text-white text-sm outline-none focus:border-[#F5C518] transition-all disabled:opacity-50 cursor-pointer"
                aria-label="Kaydedilecek Kategori"
              >
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#111]">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-xs leading-relaxed">{error}</p>
            </div>
          )}

          {/* Aksiyon */}
          {phase === 'form' ? (
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim()}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-black py-3 rounded-lg transition-all shadow-lg active:scale-95 text-sm tracking-widest disabled:opacity-40 disabled:active:scale-100"
            >
              <Sparkles size={16} />
              <span>GÖRSEL ÜRET</span>
            </button>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-violet-500/20 blur-xl rounded-full animate-pulse" />
                <Loader2 size={40} className="relative text-violet-400 animate-spin" />
              </div>
              <p className="text-sm font-bold text-white tracking-widest uppercase">
                Görsel Üretiliyor... {elapsed} sn
              </p>
              <p className="text-[10px] text-gray-500">Üretim 10-60 saniye sürebilir, sayfayı kapatmayın.</p>
            </div>
          )}
        </div>
      ) : (
        /* ── ONAY AŞAMASI: üretilen görsel admin'e gösterilir ── */
        <div className="p-5 space-y-4">
          <div
            className="relative w-full h-64 rounded-lg border border-[#333] overflow-hidden flex items-center justify-center"
            style={checkerStyle}
          >
            <img
              src={previewSrc}
              alt="Üretilen görsel önizleme"
              className="max-w-[92%] max-h-[92%] object-contain drop-shadow-lg"
            />
            <span className="absolute top-2 left-2 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-black/70 text-violet-300 border border-violet-400/30 rounded">
              Önizleme
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="p-2.5 bg-[#111] border border-[#333] rounded-lg">
              <p className="text-gray-500 uppercase tracking-widest font-bold text-[8px] mb-1">Kategori</p>
              <p className="text-gray-200 font-bold truncate" title={selectedCatName}>{selectedCatName}</p>
            </div>
            <div className="p-2.5 bg-[#111] border border-[#333] rounded-lg">
              <p className="text-gray-500 uppercase tracking-widest font-bold text-[8px] mb-1">Kayıt Adı</p>
              <p className="text-gray-200 font-bold truncate" title={assetName}>{assetName}</p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-xs leading-relaxed">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={handleApprove}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-[#F5C518] hover:bg-[#d4a017] text-black font-black py-3 rounded-lg transition-all shadow-lg active:scale-95 text-sm tracking-widest disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              <span>{saving ? 'KAYDEDİLİYOR...' : 'ONAYLA VE KAYDET'}</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleGenerate}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-[#242424] border border-[#333] hover:border-violet-400/50 hover:bg-[#2a2a2a] text-gray-200 rounded-lg transition-all text-xs font-bold disabled:opacity-50"
              >
                <RefreshCw size={13} />
                <span>YENİDEN ÜRET</span>
              </button>
              <button
                onClick={() => { setPhase('form'); setError(''); }}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-[#242424] border border-[#333] hover:border-[#F5C518]/50 hover:bg-[#2a2a2a] text-gray-200 rounded-lg transition-all text-xs font-bold disabled:opacity-50"
              >
                <Pencil size={13} />
                <span>TARİFİ DÜZENLE</span>
              </button>
            </div>
            <p className="text-[9px] text-gray-600 text-center">
              Onaylamazsanız görsel hiçbir kategoriye kaydedilmez. Aynı tarifle yeni bir varyasyon için Yeniden Üret deyin.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export const ImageGeneratorModal: React.FC<ImageGeneratorModalProps> = ({ isOpen, onClose, initialCategory }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a] bg-[#242424]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-violet-500/15 border border-violet-400/30">
              <Sparkles size={16} className="text-violet-300" />
            </div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">AI Görsel Üretici</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors" aria-label="Kapat">
            <X size={20} />
          </button>
        </div>

        {/* Form her açılışta temiz durumla monte edilir */}
        <ImageGeneratorForm onClose={onClose} initialCategory={initialCategory} />

        <div className="p-3 bg-[#111] border-t border-[#2a2a2a] text-center">
          <p className="text-[9px] text-gray-600 font-medium">
            Üretilen görseller onay sonrası seçilen kategoriye kaydedilir · Kroki Oluşturucu V2
          </p>
        </div>
      </div>
    </div>
  );
};
