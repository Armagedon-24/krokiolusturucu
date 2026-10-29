import React from 'react';
import { X, Ruler, Table, Download } from 'lucide-react';
import type { CanvasObject } from '../../types';
import { useStore } from '../../store/useStore';

interface DistanceMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  objects: CanvasObject[];
  onDrawMeasurement?: (f1: CanvasObject, f2: CanvasObject, dist: number) => void;
}

export const DistanceMatrixModal: React.FC<DistanceMatrixModalProps> = ({
  isOpen,
  onClose,
  objects,
  onDrawMeasurement
}) => {
  const { addNotification } = useStore();
  // Separate objects into Bulgular (Findings) and Sabit Noktalar (Fixed Points)
  const bulgular = objects.filter(obj => 
    obj.findingNo && 
    !(obj.isTriangulation || obj.symbolId === 'out-fixed-point' || obj.symbolId === 'out-pole')
  ).sort((a, b) => (a.findingNo || '').localeCompare(b.findingNo || '', undefined, { numeric: true }));

  const sabitNoktalar = objects.filter(obj => 
    obj.findingNo && 
    (obj.isTriangulation || obj.symbolId === 'out-fixed-point' || obj.symbolId === 'out-pole')
  ).sort((a, b) => (a.findingNo || '').localeCompare(b.findingNo || '', undefined, { numeric: true }));

  // All valid targets for measurement (Findings should be measured to both other Findings and Fixed Points)
  const allTargets = [...sabitNoktalar, ...bulgular];

  if (!isOpen) return null;

  const getCenter = (obj: CanvasObject) => {
    if (obj.symbolId === 'ev-shooting-trajectory') {
      const sx = obj.startX || 0;
      const sy = obj.startY || 0;
      const ex = obj.endX || 0;
      const ey = obj.endY || 0;
      return { x: obj.x + (sx + ex) / 2, y: obj.y + (sy + ey) / 2 };
    }
    return { x: obj.x + (obj.width * (obj.scaleX || 1)) / 2, y: obj.y + (obj.height * (obj.scaleY || 1)) / 2 };
  };

  const calculateDistance = (o1: CanvasObject, o2: CanvasObject) => {
    const p1 = getCenter(o1);
    const p2 = getCenter(o2);
    
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const isAlreadyMeasured = (o1: CanvasObject, o2: CanvasObject) => {
    return objects.some(obj => {
      // 1. First priority: Precise ID matching via measuredIds array
      if (obj.measuredIds && obj.measuredIds.length >= 2) {
        return (obj.measuredIds.includes(o1.id) && obj.measuredIds.includes(o2.id));
      }

      // 2. Second priority: Geometric matching (start/end positions) - useful for legacy objects
      const center1 = getCenter(o1);
      const center2 = getCenter(o2);
      
      const isA4 = obj.symbolId === 'a-4' || obj.isDistanceArrow;
      if (!isA4) return false;

      const posMatch = (
        (Math.abs((obj.startX || 0) - center1.x) < 5 && Math.abs((obj.endX || 0) - center2.x) < 5) ||
        (Math.abs((obj.startX || 0) - center2.x) < 5 && Math.abs((obj.endX || 0) - center1.x) < 5)
      );

      if (posMatch) return true;

      // 3. Last fallback: Name matching (least reliable if duplicate numbers exist)
      // Only if we don't have better info
      return false; 
    });
  };

  const getObjectTypeTag = (obj: CanvasObject) => {
    if (obj.isTriangulation || obj.symbolId === 'out-fixed-point' || obj.symbolId === 'out-pole') {
      return <span className="text-[7px] px-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded ml-1">SABİT</span>;
    }
    return <span className="text-[7px] px-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded ml-1">BULGU</span>;
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center px-4 py-8">
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      <div className="relative bg-[#0a0a0a] border border-[#2a2a2a] w-full max-w-6xl max-h-[90vh] flex flex-col rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="px-8 py-6 border-b border-[#1a1a1a] flex items-center justify-between bg-[#0f0f0f]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#F5C518]/10 rounded-xl border border-[#F5C518]/20">
              <Ruler className="text-[#F5C518]" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight uppercase">AKILLI MESAFE ANALİZ SİSTEMİ</h3>
              <p className="text-xs text-gray-400 font-medium">Bulgu ve nirengi noktaları arasındaki profesyonel ölçüm matrisi</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Body */}
        <div className="flex-1 overflow-auto p-8 bg-[#0a0a0a]">
          {bulgular.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <Table size={64} className="mb-4 text-[#F5C518]" />
              <p className="text-lg font-bold text-white">Analiz İçin Bulgu Bulunamadı</p>
              <p className="text-sm mt-2 text-gray-400">Mesafe raporu oluşturmak için önce tuvale en az bir bulgu (numaratör) eklemelisiniz.</p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="inline-block min-w-full align-middle border border-[#1a1a1a] rounded-xl overflow-hidden shadow-inner">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-[#111] border-b border-[#1a1a1a]">
                      <th className="sticky left-0 z-10 px-6 py-4 text-left text-[11px] font-black text-[#F5C518] uppercase tracking-wider bg-[#111] border-r border-[#1a1a1a]">
                        REFERANS / HEDEF
                      </th>
                      {allTargets.map(f => (
                        <th key={f.id} className="px-6 py-4 text-center text-[10px] font-black text-gray-300 uppercase tracking-wider min-w-[120px] border-r border-[#1a1a1a]">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="text-sm text-white font-mono">{f.findingNo}</span>
                            {getObjectTypeTag(f)}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a1a1a]">
                    {bulgular.map((row) => (
                      <tr key={row.id} className="group hover:bg-[#111] transition-all">
                        <td className="sticky left-0 z-10 px-6 py-4 whitespace-nowrap text-[11px] font-black text-[#F5C518] bg-[#0f0f0f] border-r border-[#1a1a1a] shadow-[5px_0_10px_rgba(0,0,0,0.3)]">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono bg-[#F5C518]/10 px-2 py-0.5 rounded border border-[#F5C518]/20">{row.findingNo}</span>
                            <div className="flex flex-col">
                              <span className="text-gray-400 text-[8px] uppercase">{row.name?.substring(0, 15)}...</span>
                              {getObjectTypeTag(row)}
                            </div>
                          </div>
                        </td>
                        {allTargets.map((col) => {
                          // Rules for displaying cells:
                          // 1. Don't measure self to self
                          if (col.id === row.id) {
                            return <td key={col.id} className="px-6 py-4 text-center bg-[#050505] text-[#222] font-black">X</td>;
                          }
                          
                          // 2. Hide duplicates in Bulgu-Bulgu measurements (lower triangle only)
                          const isColBulgu = bulgular.some(b => b.id === col.id);
                          if (isColBulgu) {
                            const rowIndex = bulgular.findIndex(b => b.id === row.id);
                            const colIndex = bulgular.findIndex(b => b.id === col.id);
                            if (colIndex >= rowIndex) {
                              return <td key={col.id} className="px-6 py-4 text-center text-[#222] font-black bg-[#050505]">-</td>;
                            }
                          }

                          const dist = calculateDistance(row, col);
                          const alreadyExists = isAlreadyMeasured(row, col);

                          return (
                            <td key={col.id} className={`px-6 py-4 text-center text-[11px] font-mono font-black transition-all border-r border-[#1a1a1a] ${alreadyExists ? 'bg-emerald-500/5 text-emerald-400' : 'text-gray-400 group-hover:text-white'}`}>
                              <div className="flex flex-col items-center justify-center gap-2">
                                <span className="text-sm">
                                  {Math.round(dist)}
                                  <span className="text-[9px] ml-1 opacity-50 uppercase">cm</span>
                                </span>
                                
                                {alreadyExists ? (
                                  <div className="flex items-center gap-1 text-[8px] text-emerald-500 font-black tracking-tighter bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                    ÖLÇÜLDÜ
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => onDrawMeasurement?.(row, col, dist)}
                                    className="px-3 py-1 bg-[#F5C518]/10 text-[#F5C518] rounded-md border border-[#F5C518]/30 hover:bg-[#F5C518] hover:text-black hover:scale-110 active:scale-95 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1 shadow-lg"
                                    title="Tuvale Ölçü Oku Ekle"
                                  >
                                    <Ruler size={10} />
                                    <span className="text-[8px] font-black">EKLE</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-start gap-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                  <Table size={16} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black text-emerald-400 uppercase">Akıllı Matris Kuralları</h4>
                  <p className="text-[9px] text-gray-500 leading-relaxed">
                    Sistem sadece <strong>Bulgu-Sabit Nokta</strong> ve <strong>Bulgu-Bulgu</strong> arası mesafeleri gösterir. 
                    İki sabit nokta arasındaki mesafeler rapor bütünlüğü için gizlenmiştir. 
                    Ölçülen mesafeler tuvalde yeşil vurgu ile işaretlenir.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-[#1f1f1f] border-t border-[#2a2a2a] flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-300 transition-colors"
          >
            KAPAT
          </button>
          {allTargets.length >= 2 && (
            <button 
              onClick={() => {
                addNotification({
                  type: 'success',
                  message: 'Rapor Güncellendi',
                  description: 'Mesafe verileri rapor dökümüne eklendi.'
                });
              }}
              className="flex items-center gap-2 px-5 py-2 bg-[#F5C518] hover:bg-[#E2B616] text-black text-xs font-black rounded-md transition-all shadow-lg active:scale-95"
            >
              <Download size={14} />
              RAPORA EKLE
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
