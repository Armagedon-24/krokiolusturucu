import React, { useState, useRef } from 'react';
import { X, Camera, Plus, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import type { CanvasObject } from '../../types';
import { cloudinary } from '../../lib/cloudinary';
import { useStore } from '../../store/useStore';

interface EvidencePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  object: CanvasObject | null;
  onUpdatePhotos: (photos: string[]) => void;
}

export const EvidencePhotoModal: React.FC<EvidencePhotoModalProps> = ({
  isOpen,
  onClose,
  object,
  onUpdatePhotos
}) => {
  const { addNotification } = useStore();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  if (!isOpen || !object) return null;

  const photos = object.photos || [];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newPhotoUrls: string[] = [...photos];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `evidence_${object.findingNo || 'marker'}_${Date.now()}_${i}`;
        const url = await cloudinary.upload(file, fileName, 'evidence_photos');
        newPhotoUrls.push(url);
      }
      onUpdatePhotos(newPhotoUrls);
    } catch (error) {
      console.error('Photo upload failed:', error);
      addNotification({
        type: 'error',
        message: 'Yükleme Hatası',
        description: 'Fotoğraflar yüklenirken bir hata oluştu.'
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    onUpdatePhotos(newPhotos);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center px-4 py-8">
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      <div className="relative bg-[#1a1a1a] border border-[#2a2a2a] w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2a2a2a] flex items-center justify-between bg-[#1f1f1f]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F5C518]/10 rounded-lg">
              <Camera className="text-[#F5C518]" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-100 tracking-wide uppercase">
                BULGU FOTOĞRAFLARI: {object.findingNo ? `NO ${object.findingNo}` : object.name}
              </h3>
              <p className="text-[10px] text-gray-500 font-medium">Bu bulguya ait gerçek olay yeri fotoğraflarını yönetin</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-white hover:bg-white/5 rounded-md transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#161616]">
          {photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-[#333] rounded-xl opacity-40">
              <ImageIcon size={40} className="mb-3" />
              <p className="text-sm font-medium">Henüz fotoğraf eklenmemiş.</p>
              <p className="text-xs mt-1">Aşağıdaki butonu kullanarak fotoğraf yükleyebilirsiniz.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {photos.map((url, index) => (
                <div key={index} className="group relative aspect-square bg-[#111] border border-[#333] rounded-lg overflow-hidden shadow-lg">
                  <img src={url} alt={`Evidence ${index}`} className="w-full h-full object-contain bg-black/40 transition-transform group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button 
                      onClick={() => window.open(url, '_blank')}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"
                      title="Tam Ekran"
                    >
                      <ImageIcon size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(index)}
                      className="p-2 bg-red-500/20 hover:bg-red-500/40 rounded-full text-red-500 transition-all"
                      title="Sil"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="absolute bottom-2 left-2 bg-black/80 px-1.5 py-0.5 rounded text-[8px] font-black text-[#F5C518]">
                    #{index + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#1f1f1f] border-t border-[#2a2a2a] flex items-center justify-between">
          <p className="text-[10px] text-gray-500 italic">
            * Yüklenen fotoğraflar rapor dökümünde otomatik olarak listelenecektir.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-300 transition-colors"
            >
              KAPAT
            </button>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleUpload}
              multiple
              accept="image/*"
              className="hidden"
            />
            <button
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-2 bg-[#F5C518] hover:bg-[#E2B616] text-black text-xs font-black rounded-md transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {isUploading ? 'YÜKLENİYOR...' : 'FOTOĞRAF EKLE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
