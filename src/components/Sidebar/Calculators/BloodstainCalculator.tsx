import React, { useState, useEffect, useMemo } from 'react';
import { Droplets, Ruler, Info, PlusCircle, Target, ArrowUpCircle } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';
import { formatForensicReport, formatForensicSummary, trNum } from '../../../utils/forensicReport';
import { ForensicReportPreview, ForensicPdfButton } from '../../UI/ForensicReportPreview';

export const BloodstainCalculator: React.FC = () => {
  const [width, setWidth] = useState<number>(5);
  const [length, setLength] = useState<number>(10);
  const [distanceToSource, setDistanceToSource] = useState<number>(1.5);
  const [angle, setAngle] = useState<number>(0);
  const [originHeight, setOriginHeight] = useState<number>(0);
  const [angleMin, setAngleMin] = useState<number>(0);
  const [angleMax, setAngleMax] = useState<number>(0);
  const [heightMin, setHeightMin] = useState<number>(0);
  const [heightMax, setHeightMax] = useState<number>(0);
  
  const { addObject, addNotification } = useStore();

  useEffect(() => {
    if (width > 0 && length > 0 && width <= length) {
      const radians = Math.asin(width / length);
      const degrees = radians * (180 / Math.PI);
      setAngle(degrees);

      // Origin Height Calculation: H = D * tan(alpha)
      if (distanceToSource > 0) {
        const h = distanceToSource * Math.tan(radians);
        setOriginHeight(h);

        // Belirsizlik: ölçüm ±0.5 mm, mesafe ±0.05 m
        const ang = (w: number, l: number) => Math.asin(Math.min(1, Math.max(0, w / l))) * (180 / Math.PI);
        const aMin = ang(width - 0.5, length + 0.5);
        const aMax = ang(width + 0.5, Math.max(width + 0.5, length - 0.5));
        setAngleMin(aMin);
        setAngleMax(aMax);
        setHeightMin((distanceToSource - 0.05) * Math.tan(aMin * Math.PI / 180));
        setHeightMax((distanceToSource + 0.05) * Math.tan(aMax * Math.PI / 180));
      } else {
        setOriginHeight(0); // mesafe sıfırlanınca eski değer kalmasın
        setAngleMin(0);
        setAngleMax(0);
        setHeightMin(0);
        setHeightMax(0);
      }
    } else {
      setAngle(0);
      setOriginHeight(0);
    }
  }, [width, length, distanceToSource]);

  const velocityClass = angle > 0
    ? width >= 4
      ? 'Düşük hız — damla/sıçrantı (yerçekimi damlası, damla damla akıntı)'
      : width >= 1 && width < 4
        ? 'Orta hız — darbe/sıçratma spatter (bıçak, yumruk, devrilme)'
        : 'Yüksek hız — ateşli silah veya mekanik spütrasyon' // genişlik < 1 mm
    : 'Belirsiz';

  const report = useMemo(() => ({
    title: 'KAN SIÇRAMA DESENİ İNCELEMESİ (BPA)',
    topic: 'Olay yerinde tespit edilen kan lekesinin boyut ölçümlerinden hareketle çarpma açısının ve kaynağın (yara/darbe noktası) konumunun adli teknik yönden değerlendirilmesi.',
    evidence: [
      `Lekenin genişliği (W): ${trNum(width, 1)} mm (ölçüm ±0.5 mm)`,
      `Lekenin uzunluğu (L): ${trNum(length, 1)} mm (ölçüm ±0.5 mm)`,
      `Yakınsama noktasına yatay mesafe (D): ${trNum(distanceToSource, 2)} m (±0.05 m)`,
    ],
    method: [
      'Çarpma açısı: sin(α) = W/L → α = arcsin(W/L) (eliptik leke geometrisi).',
      'Kaynak yüksekliği: H = D × tan(α) (yakınsama noktası trigonometrisi).',
      'Belirsizlik analizi: W±0.5 mm, L±0.5 mm ve D±0.05 m uç değerleriyle min–max açı ve yükseklik hesaplanmıştır.',
    ],
    findings: [
      `Çarpma açısı (α): ${trNum(angle, 1)}° — muhtemel aralık ${trNum(angleMin, 1)}° – ${trNum(angleMax, 1)}°`,
      `Kaynak yüksekliği (H): ${trNum(originHeight, 2)} m — muhtemel aralık ${trNum(heightMin, 2)} – ${trNum(heightMax, 2)} m`,
      `Hız sınıflaması (leke morfolojisine göre): ${velocityClass}`,
    ],
    scenarios: [
      'Lekenin kuyruğu (tail/spine) uzunluk ölçümüne dâhil edilmişse açı DÜŞÜK hesaplanır; kuyruk hariç çekirdek ölçülmelidir.',
      '20° altı dar açılarda elips neredeyse çizgiye yakınlaşır; W/L hassasiyeti düşer → açı aralığının alt sınırı güvenilirdir.',
      'Islak, poröz veya parlak zeminde damla yayılarak genişler → W artar, açı DÜŞÜK çıkar; zemin dokusu not edilmelidir.',
      'İkincil sıçrama (satellite/splash) damlaları ana desenle karışabilir; ana damla ile küçük yancıkları ayırmak gerekir.',
      'Tek damladan kaynak yüksekliği tahmini gösterge niteliğindedir; kesin konum için aynı desenden çoklu damla ve iplikleme (stringing) analizi yapılmalıdır.',
      'Kaynak yüksekliği tahmini, D mesafesinin doğru ölçülmesine bağlıdır; lekenin bulunduğu yüzey eğimliyse düzeltme gerekir.',
      'Hareket eden kaynak (taşınan vücut, damlayan yara) oluşturduğu desende yol boyu damlalar kaynak yüksekliği hesabını yanıltır.',
    ],
    conclusion: [
      `İnceleme sonucunda kanın hedef yüzeye ${trNum(angle, 1)}° açıyla (muhtemel aralık ${trNum(angleMin, 1)}° – ${trNum(angleMax, 1)}°) çarptığı, kaynağın ise ölçülen noktadan yaklaşık ${trNum(originHeight, 2)} m (${trNum(heightMin, 2)} – ${trNum(heightMax, 2)} m) konumda bulunduğu kanaatine varılmıştır.`,
      'Kesin olay rekonstrüksiyonu için tüm leke deseni, yönü ve çakışma sırası birlikte değerlendirilmelidir.',
    ],
    caveats: [
      'Sonuç tekil leke ölçümüne dayanır; desen bazlı analiz için saha fotoğrafları ve ölçekli çizimler gereklidir.',
      'Zemin dokusu, kan viskozitesi ve damla yaşı ölçüm belirsizliğini artırır.',
      'Rapor gösterge niteliğinde olup nihai kanaat adli tıp/kriminal uzmanı değerlendirmesiyle birlikte oluşmalıdır.',
    ],
  }), [width, length, distanceToSource, angle, angleMin, angleMax, originHeight, heightMin, heightMax, velocityClass]);
  const reportText = useMemo(() => formatForensicReport(report), [report]);
  const summaryText = useMemo(() => formatForensicSummary(report), [report]);

  const handleAddToCanvas = () => {
    addObject({
      type: 'text',
      text: summaryText,
      x: 300,
      y: 300,
      width: 360,
      fontSize: 11,
      fill: '#000000',
      fontFamily: 'Inter',
      fontStyle: 'bold'
    });
    addNotification({ type: 'success', message: 'Hesaplama kısa özeti rapora (kroki) eklendi' });
  };

  return (
    <div className="space-y-6 p-1 relative">
      <HelpTooltip 
        title="Kan Sıçrama Analizi (BPA)"
        description="Kan lekelerinin boyutlarından çarpma açısını ve kaynağın (yara/darbe) yerden yüksekliğini hesaplar."
        formula="α = arcsin(W/L) | H = D * tan(α)"
        usage="Lekenin enini (W) ve boyunu (L) mm cinsinden girin. Kaynak mesafesini (D) metre olarak belirleyerek yüksekliği (H) bulun."
      />
      <div className="space-y-4">
        {/* Dimensions */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
              <Droplets size={12} className="text-red-500" />
              Genişlik (W)
            </label>
            <div className="relative">
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(Math.max(0, Number(e.target.value)))}
                className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-red-500/50 outline-none transition-all font-mono"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">mm</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
              <Ruler size={12} className="text-[#F5C518]" />
              Uzunluk (L)
            </label>
            <div className="relative">
              <input
                type="number"
                value={length}
                onChange={(e) => setLength(Math.max(0, Number(e.target.value)))}
                className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all font-mono"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">mm</span>
            </div>
          </div>
        </div>

        {/* Distance to convergence point */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 text-gray-400">
            <Target size={12} className="text-blue-500" />
            Yakınsama Noktasına Mesafe (Metre)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              value={distanceToSource}
              onChange={(e) => setDistanceToSource(Math.max(0, Number(e.target.value)))}
              className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all font-mono"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">M</span>
          </div>
          <p className="text-[8px] text-gray-600 italic">
            * Kan lekesinin yüzeydeki izdüşümünden, kanın çıktığı varsayılan yatay mesafe.
          </p>
        </div>

        {/* Results Card */}
        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">ÇARPMA AÇISI (α)</div>
                <div className="flex items-center gap-2">
                  <span className="text-4xl font-black text-white tracking-tighter">{angle.toFixed(1)}</span>
                  <span className="text-xl font-black text-red-600">°</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full border-2 border-red-900/30 flex items-center justify-center relative overflow-hidden">
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-red-600/20 transition-all duration-500"
                  style={{ height: `${(angle / 90) * 100}%` }}
                />
                <Droplets size={20} className="text-red-600 relative z-10" />
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-[9px] text-gray-500 uppercase font-black tracking-widest">
                <ArrowUpCircle size={12} className="text-green-500" />
                TAHMİNİ KAYNAK YÜKSEKLİĞİ (H)
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-green-500 tracking-tighter">
                  {originHeight.toFixed(2)}
                </span>
                <span className="text-sm font-bold text-gray-600 uppercase">Metre</span>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-gray-500">
                <span className="text-gray-600">ARALIK</span>
                <span>{heightMin.toFixed(2)}</span>
                <span className="text-gray-600">—</span>
                <span>{heightMax.toFixed(2)}</span>
                <span className="text-gray-600">M</span>
              </div>
            </div>

            <div className="mt-2 flex gap-2">
              <button
                onClick={handleAddToCanvas}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95"
              >
                <PlusCircle size={13} />
                ANALİZİ RAPORA EKLE
              </button>
              <ForensicPdfButton report={report} />
            </div>
          </div>
        </div>

        <ForensicReportPreview text={reportText} summaryText={summaryText} report={report} />

        <div className="p-4 bg-[#111]/80 border border-red-500/10 rounded-2xl flex gap-3 items-start shadow-inner">
          <Info size={16} className="text-red-900 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-red-200/50 uppercase">TEKNİK NOT</p>
            <p className="text-[8px] text-gray-600 leading-relaxed italic">
              Sinüs yasası ($\sin\alpha = W/L$) kullanılmıştır. Kaynak yüksekliği, yakınsama noktası (convergence point) ve çarpma açısının trigonometrik birleşimi ile hesaplanır.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

