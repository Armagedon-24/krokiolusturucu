import React, { useState, useEffect, useMemo } from 'react';
import { Sun, Ruler, PlusCircle, Clock, Calendar } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';
import { formatForensicReport, formatForensicSummary, trNum } from '../../../utils/forensicReport';
import { ForensicReportPreview, ForensicPdfButton } from '../../UI/ForensicReportPreview';

const SEASONAL_PRESETS = [
  { id: 'summer', name: 'Yaz Gündönümü', maxAngle: 73, icon: '☀️' },
  { id: 'equinox', name: 'Ekinoks', maxAngle: 50, icon: '⛅' },
  { id: 'winter', name: 'Kış Gündönümü', maxAngle: 26, icon: '❄️' },
];

export const ShadowCalculator: React.FC = () => {
  const [shadowLength, setShadowLength] = useState<number>(5);
  const [sunAngle, setSunAngle] = useState<number>(45);
  const [objectHeight, setObjectHeight] = useState<number>(0);
  const [timeEstimate, setTimeEstimate] = useState<string>('');
  const [heightMin, setHeightMin] = useState<number>(0);
  const [heightMax, setHeightMax] = useState<number>(0);
  
  const { addObject, addNotification } = useStore();

  useEffect(() => {
    if (shadowLength > 0 && sunAngle > 0) {
      const radians = sunAngle * (Math.PI / 180);
      const calculatedHeight = shadowLength * Math.tan(radians);
      setObjectHeight(calculatedHeight);
      // Belirsizlik: gölge ucu ölçümü ±5 cm, güneş açısı ±2°
      const hMin = Math.max(0, shadowLength - 0.05) * Math.tan(Math.max(0.01, sunAngle - 2) * Math.PI / 180);
      const hMax = (shadowLength + 0.05) * Math.tan(Math.min(89, sunAngle + 2) * Math.PI / 180);
      setHeightMin(hMin);
      setHeightMax(hMax);

      if (sunAngle > 70) setTimeEstimate('Öğle (12:00 - 13:30)');
      else if (sunAngle > 45) setTimeEstimate('Kuşluk / İkindi (10:00-11:30 veya 14:30-16:00)');
      else if (sunAngle > 20) setTimeEstimate('Sabah / Akşamüstü (08:30-10:00 veya 16:00-17:30)');
      else setTimeEstimate('Gün Doğumu / Batımı (Yakın Saatler)');
    }
  }, [shadowLength, sunAngle]);

  const report = useMemo(() => ({
    title: 'GÖLGE VE ZAMAN İNCELEMESİ',
    topic: 'Fotoğraf/kroki üzerinde ölçülen gölge boyu ve güneş yükseklik açısından hareketle, nesne boyunun ve olayın gerçekleştiği zaman diliminin adli teknik yönden değerlendirilmesi.',
    evidence: [
      `Gölge boyu: ${shadowLength} m (uç ölçümü ±5 cm)`,
      `Güneş yükseklik açısı: ${sunAngle}° (ölçüm ±2°)`,
      `Mevsimsel referans (Türkiye): güneş açısı ayarlanmıştır`,
    ],
    method: [
      'Nesne boyu: H = S × tan(θ) (gölge boyu × tanjant ilişkisi).',
      'Zaman dilimi; güneş yükseklik açısının Türkiye (36–42°N enlem) gündüz eğrisine göre sınıflandırılmasıyla verilmiştir.',
      'Belirsizlik analizi: gölge ucu ±5 cm ve açı ±2° uç değerleriyle min–max nesne boyu hesaplanmıştır.',
    ],
    findings: [
      `Hesaplanan nesne boyu: ${trNum(objectHeight, 2)} m — muhtemel aralık ${trNum(heightMin, 2)} – ${trNum(heightMax, 2)} m`,
      `Tahmini zaman dilimi: ${timeEstimate || 'Belirsiz'}`,
    ],
    scenarios: [
      'Aynı güneş açısı günde iki kez oluşur (sabah + öğleden sonra); kesin ayırım gölgenin DOĞU-BATI doğrultusu ile yapılır.',
      'Mevsime göre aynı açı farklı saatlere denk gelir (yaz gündönümünde öğle açısı ~73°, kışta ~26°, Türkiye ortalaması); mevsim seçimi netleştirilmelidir.',
      'Zemin eğimli veya engebeli ise gölge boyu kısalır/uzar → nesne boyu ve saat tahmini kayar; düz zemin varsayılmıştır.',
      'Bulutlu/kapalı hava da gölge kenarı bulanık (penumbra) ölçülür → uç hata payı büyür.',
      'Yapay ışık kaynaklarında (sokak lambası) güneş açısı varsayımı geçersizdir; ışık yüksekliği ve mesafesi ayrıca hesaplanmalıdır.',
      'Yaz saati uygulaması (TSİ +1) ve boylam farkı (doğu illeri ~+40 dk) saat çevirisinde dikkate alınmalıdır.',
    ],
    conclusion: [
      `İnceleme sonucunda gölgenin ait olduğu nesnenin boyunun yaklaşık ${trNum(objectHeight, 2)} m (${trNum(heightMin, 2)} – ${trNum(heightMax, 2)} m aralığında) olduğu, olayın ise “${timeEstimate || 'belirsiz'}” zaman diliminde gerçekleşme ihtimalinin güçlü olduğu kanaatine varılmıştır.`,
      'Saat tespitinin kesinleştirilmesi için gölge doğrultusu (pusula yönü) ve gün bilgisi ile astronomik yeniden hesap önerilir.',
    ],
    caveats: [
      'Sonuç, gölge ölçümünün fotoğraf/kroki üzerinden doğru alınmış olmasına bağlıdır; kamera eğikliği perspektif hatası yaratır.',
      'Sadece güneş açısıyla saat tahmini tek başına kesin değildir; doğrultu bilgisi olmadan sabah/akşam ayrımı yapılamaz.',
    ],
  }), [shadowLength, sunAngle, objectHeight, heightMin, heightMax, timeEstimate]);
  const reportText = useMemo(() => formatForensicReport(report), [report]);
  const summaryText = useMemo(() => formatForensicSummary(report), [report]);

  const handleAddToCanvas = () => {
    const diag = (ax: number, ay: number, bx: number, by: number, color: string, sw = 2) => {
      addObject({ type: 'symbol', symbolId: 'a-5', x: ax, y: ay, width: Math.max(2, Math.abs(bx - ax)), height: Math.max(2, Math.abs(by - ay)), startX: ax, startY: ay, endX: bx, endY: by, fill: color, stroke: color, strokeWidth: sw });
    };

    const hM = objectHeight > 0 ? objectHeight : shadowLength * Math.tan((sunAngle * Math.PI) / 180);
    const scale = Math.min(40, 280 / Math.max(0.5, shadowLength));
    const baseX = 240;
    const baseY = 320;
    const dPx = Math.max(70, shadowLength * scale);
    const hPx = Math.min(170, Math.max(30, hM * scale));

    // Zemin
    addObject({ type: 'rect', x: baseX - 60, y: baseY + 2, width: dPx + 130, height: 2.5, fill: '#9E9E9E' });
    // Dikme (nesne)
    addObject({ type: 'rect', x: baseX - 2, y: baseY - hPx, width: 5, height: hPx, fill: '#37474F' });
    // Gölge
    addObject({ type: 'rect', x: baseX, y: baseY - 3, width: dPx, height: 6, fill: '#546E7A' });
    // Güneş ışını (yönlü ok: güneşten gölge ucuna)
    diag(baseX - 0.25 * dPx, baseY - 1.25 * hPx, baseX + dPx, baseY, '#FFB300', 1.5);
    // Güneş
    addObject({ type: 'rect', x: baseX - 0.25 * dPx - 9, y: baseY - 1.25 * hPx - 9, width: 18, height: 18, rotation: 45, fill: '#FFB300', stroke: '#FF8F00', strokeWidth: 1 });
    addObject({ type: 'text', text: `h = ${trNum(hM, 2)} m`, x: baseX - 96, y: baseY - hPx / 2 - 8, width: 90, fontSize: 10, fill: '#37474F', fontFamily: 'Inter', fontStyle: 'bold' });
    addObject({ type: 'text', text: `Gölge: ${trNum(shadowLength, 2)} m`, x: baseX + dPx / 2 - 44, y: baseY + 12, width: 130, fontSize: 10, fill: '#546E7A', fontFamily: 'Inter', fontStyle: 'bold' });
    addObject({ type: 'text', text: `Güneş açısı: ${trNum(sunAngle, 0)}°`, x: baseX + 16, y: baseY - 28, width: 140, fontSize: 10, fill: '#FF8F00', fontFamily: 'Inter', fontStyle: 'bold' });

    addObject({
      type: 'text',
      text: summaryText,
      x: baseX - 20,
      y: baseY + 40,
      width: 320,
      fontSize: 10,
      fill: '#000000',
      fontFamily: 'Inter',
      fontStyle: 'bold',
    });
    addNotification({ type: 'success', message: 'Şema ve kısa özet tuvale aktarıldı' });
  };

  return (
    <div className="space-y-6 p-1 relative">
      <HelpTooltip 
        title="Gölge ve Zaman Analizi"
        description="Nesne gölgesi ve güneş açısından yola çıkarak nesne boyunu veya olay saatini saptar."
        formula="H = S * tan(θ)"
        usage="Gölge boyunu girin ve güneşin açısını (veya mevsim referansını) seçin. Tahmini zaman dilimi otomatik olarak belirecektir."
      />
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Calendar size={12} className="text-[#F5C518]" />
            Mevsimsel Referans (Türkiye)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SEASONAL_PRESETS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSunAngle(s.maxAngle)}
                className="flex flex-col items-center gap-1 p-2 bg-[#1a1a1a] border border-[#333] rounded-xl hover:border-[#F5C518]/50 transition-all group"
              >
                <span className="text-xs">{s.icon}</span>
                <span className="text-[7px] font-black text-gray-500 uppercase text-center leading-tight">
                  {s.name.split(' ')[0]}<br/>{s.name.split(' ')[1] || ''}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Ruler size={12} className="text-[#F5C518]" />
            Gölge Boyu (Metre)
          </label>
          <input
            type="number"
            value={shadowLength}
            onChange={(e) => setShadowLength(Math.max(0, Number(e.target.value)))}
            className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all font-mono"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Sun size={12} className="text-[#F5C518]" />
            Güneş Açısı (°): {sunAngle}°
          </label>
          <input
            type="range"
            min="1"
            max="89"
            step="1"
            value={sunAngle}
            onChange={(e) => setSunAngle(parseInt(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
          />
        </div>

        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="relative z-10 space-y-6">
            <div className="space-y-1 text-center">
              <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">TAHMİNİ NESNE BOYU</div>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-6xl font-black text-white tracking-tighter">{objectHeight.toFixed(2)}</span>
                <span className="text-xl font-bold text-[#F5C518]">M</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold text-gray-400">
                <span className="text-gray-600">ARALIK</span>
                <span>{heightMin.toFixed(2)}</span>
                <span className="text-gray-600">—</span>
                <span>{heightMax.toFixed(2)}</span>
                <span className="text-gray-600">M</span>
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-[9px] text-gray-500 uppercase font-bold tracking-widest">
                <Clock size={12} className="text-[#F5C518]" />
                OLAY ANI ZAMAN TAHMİNİ
              </div>
              <div className="text-xs font-bold text-gray-200">
                {timeEstimate}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddToCanvas}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#F5C518] text-black rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-[#ffcf24] transition-all active:scale-95"
              >
                <PlusCircle size={13} />
                TUVALE AKTAR
              </button>
              <ForensicPdfButton report={report} />
            </div>
          </div>
        </div>

        <ForensicReportPreview text={reportText} summaryText={summaryText} report={report} />
      </div>
    </div>
  );
};
