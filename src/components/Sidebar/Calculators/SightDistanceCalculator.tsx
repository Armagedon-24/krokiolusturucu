import React, { useState, useMemo } from 'react';
import { Eye, Info, PlusCircle, AlertTriangle } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';
import { formatForensicReport, formatForensicSummary, trNum } from '../../../utils/forensicReport';
import { ForensicReportPreview, ForensicPdfButton } from '../../UI/ForensicReportPreview';

type Maneuver = 'cross_left' | 'right';

/** AASHTO kesikli (gap acceptance) taban süreleri [sn] — binek araç. */
const MANEUVERS: Array<{ id: Maneuver; name: string; base: number }> = [
  { id: 'cross_left', name: 'Düz Geçiş / Sola Dönüş', base: 7.5 },
  { id: 'right', name: 'Sağa Dönüş', base: 6.5 },
];

export const SightDistanceCalculator: React.FC = () => {
  const [speed, setSpeed] = useState<number>(90); // ana yol hızı (km/s)
  const [maneuver, setManeuver] = useState<Maneuver>('cross_left');
  const [extraLanes, setExtraLanes] = useState<number>(0);
  const [heavy, setHeavy] = useState<boolean>(false);
  const [available, setAvailable] = useState<number>(0); // ölçülen mevcut görüş mesafesi (0 = yok)
  const [mu, setMu] = useState<number>(0.7); // SSD için

  const { addObject, addNotification } = useStore();

  const calc = useMemo(() => {
    const m = MANEUVERS.find((x) => x.id === maneuver)!;
    const tGap = m.base + extraLanes * 0.5 + (heavy ? 1.0 : 0.0);
    const isd = (speed / 3.6) * tGap; // gerekli görüş mesafesi (m)
    // Ana yolda emniyetli durma görüş mesafesi (SSD): 2.5 sn tepki + ıslak frenleme
    const ssd = (speed * 2.5) / 3.6 + (speed * speed) / (254 * mu);
    let verdict: '' | 'ok' | 'no' = '';
    let margin = 0;
    if (available > 0) {
      margin = available - isd;
      verdict = margin >= 0 ? 'ok' : 'no';
    }
    return { tGap, isd, ssd, verdict, margin, maneuverName: m.name };
  }, [speed, maneuver, extraLanes, heavy, available, mu]);

  const report = useMemo(() => {
    const verdictText =
      calc.verdict === 'ok'
        ? `Ölçülen ${trNum(available, 1)} m görüş mesafesi, gerekli ${trNum(calc.isd, 1)} m değerinden ${trNum(calc.margin, 1)} m fazladır → GÖRÜŞ MESAFESİ YETERLİDİR.`
        : calc.verdict === 'no'
          ? `Ölçülen ${trNum(available, 1)} m görüş mesafesi, gerekli ${trNum(calc.isd, 1)} m değerinden ${trNum(Math.abs(calc.margin), 1)} m eksiktir → GÖRÜŞ MESAFESİ YETERSİZDİR.`
          : 'Ölçülen mevcut görüş mesafesi girilmediğinden yeterlilik karşılaştırması yapılmamıştır.';
    return {
      title: 'KAVŞAK GÖRÜŞ MESAFESİ (GÖRÜŞ ÜÇGENİ) İNCELEMESİ',
      topic: 'Tali yoldan ana yola manevra yapacak sürücünün, ana yoldan gelen aracı emniyetle görebilmesi için gerekli görüş mesafesinin (görüş üçgeni) adli teknik yönden hesaplanması ve mevcut görüş mesafesiyle karşılaştırılması.',
      evidence: [
        `Ana yol seyir/limit hızı: ${trNum(speed, 0)} km/s`,
        `Manevra tipi: ${calc.maneuverName}`,
        `Geçilecek ek şerit sayısı: ${extraLanes}`,
        heavy ? 'Manevra yapan araç: Ağır vasıta (+1.0 sn boşluk süresi)' : 'Manevra yapan araç: Binek araç',
        available > 0 ? `Ölçülen mevcut görüş mesafesi: ${trNum(available, 1)} m` : 'Ölçülen mevcut görüş mesafesi verilmedi.',
        `SSD hesabında zemin katsayısı: μ=${mu.toFixed(2)}`,
      ],
      method: [
        'Boşluk kabul (gap acceptance) yöntemi — AASHTO: gerekli görüş mesafesi ISD = v·t; t = taban boşluk süresi (düz geçiş/sola dönüş 7.5 sn, sağa dönüş 6.5 sn) + her ek şerit için 0.5 sn + ağır vasıta için 1.0 sn.',
        'Ana yolda emniyetli durma görüş mesafesi (SSD) = 2.5 sn tepki süresi + v²/(254·μ) frenleme mesafesi.',
        'Ölçülen görüş mesafesi verildiyse ISD değeriyle karşılaştırılmış, fark (pay/eksik) raporlanmıştır.',
      ],
      findings: [
        `Gerekli boşluk süresi (t): ${trNum(calc.tGap, 1)} sn`,
        `Gerekli görüş mesafesi (ISD): ${trNum(calc.isd, 1)} m`,
        `Ana yolda emniyetli durma görüş mesafesi (SSD): ${trNum(calc.ssd, 1)} m`,
        verdictText,
      ],
      scenarios: [
        'Ana yol hızı limit değerinden alınmışsa; gözlenen operasyonel hız (85. yüzdelik) daha yüksek olabilir → gerekli mesafe artar.',
        'Görüş engelinin türü (bina, duvar, ağaç, park halindeki araç) ve konumu, ölçülen üçgen kenarını değiştirir; mevsimsel yapraklanma değerlendirilmelidir.',
        'Sürücü göz yüksekliği modelde 1.08 m esaslıdır; büyük araç sürücülerinde görüş açısı farklıdır.',
        'Kavşak eğimi ve tali yolda duruş konumu (stop hattına uzaklık) üçgen kenarlarını değiştirir.',
        'Yaya/yolcu bekleyen araçların gölgeleme etkisi ölçüm sırasında ayrıca değerlendirilmelidir.',
        'Gece aydınlatma ve karşı araç farı parlaması, etkili görüş mesafesini bozan etkenlerdir.',
        'Çok şeritli ana yolda her ek şerit için boşluk süresi artar; şerit sayısı saha tespitiyle doğrulanmalıdır.',
      ],
      conclusion: [
        `İnceleme sonucunda; ${trNum(speed, 0)} km/s hızla gelen araç için ${calc.maneuverName.toLowerCase()} manevrasının emniyetle yapılabilmesine gerekli görüş mesafesinin ${trNum(calc.isd, 1)} m olduğu hesaplanmıştır.`,
        available > 0
          ? `Sahada ölçülen ${trNum(available, 1)} m görüş mesafesiyle karşılaştırıldığında görüş üçgeninin ${calc.verdict === 'ok' ? 'yeterli' : calc.verdict === 'no' ? 'yetersiz' : 'değerlendirilemedi'} olduğu kanaatine varılmıştır.`
          : 'Yeterlilik hükmü için sahada görüş üçgeni kenarlarının ölçülmesi gerekir.',
      ],
      caveats: [
        'Boşluk süreleri AASHTO binek araç taban değerleridir; yerel trafik yapısı farklılıkları için düzeltme gerekebilir.',
        'Sonuç; hız girdisinin ve görüş engeli konumunun doğru tespitine bağımlıdır.',
        'Görüş mesafesi ölçümü sürücü göz noktasından, tali yol duruş konumuna göre yapılmalıdır.',
      ],
    };
  }, [calc, speed, extraLanes, heavy, available, mu]);
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
      fontStyle: 'bold',
    });
    addNotification({ type: 'success', message: 'Hesaplama kısa özeti rapora (kroki) eklendi' });
  };

  const inputCls = 'w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all font-mono';

  return (
    <div className="space-y-6 relative">
      <HelpTooltip
        title="Kavşak Görüş Mesafesi (Görüş Üçgeni)"
        description="Tali yoldan manevra yapacak sürücü için ana yoldan gelen aracı görmeye yetecek mesafeyi (ISD) hesaplar; ölçülen değerle karşılaştırır."
        formula="ISD = v · t  (t = 7.5/6.5 sn + 0.5·şerit + 1.0·ağır vasıta)"
        usage="Ana yol hızını, manevra tipini ve şerit sayısını girin. Sahada ölçtüğünüz görüş mesafesini (sürücü göz noktası → ana yol) metre girin — yeterlilik hükmü rapora eklenir."
      />
      <div className="space-y-4 p-1">
        {/* Ana yol hızı */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Eye size={12} className="text-[#F5C518]" />
            Ana Yol Hızı (km/s)
          </label>
          <div className="relative">
            <input type="number" value={speed} onChange={(e) => setSpeed(Math.max(0, Number(e.target.value)))} className={inputCls} />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">KM/S</span>
          </div>
        </div>

        {/* Manevra tipi */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Manevra Tipi
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {MANEUVERS.map((m) => (
              <button
                key={m.id}
                onClick={() => setManeuver(m.id)}
                className={`px-2 py-2 rounded-xl border text-[9px] font-black transition-all ${
                  maneuver === m.id
                    ? 'bg-[#F5C518] border-[#F5C518] text-black shadow-lg shadow-[#F5C518]/20'
                    : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:border-gray-600'
                }`}
              >
                {m.name.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Ek şerit + ağır vasıta */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Geçilecek Ek Şerit: {extraLanes}
          </label>
          <input
            type="range"
            min="0"
            max="3"
            step="1"
            value={extraLanes}
            onChange={(e) => setExtraLanes(parseInt(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
          />
          <button
            onClick={() => setHeavy(!heavy)}
            className={`w-full px-3 py-2 rounded-xl border text-[9px] font-black transition-all flex items-center justify-center gap-2 ${
              heavy
                ? 'bg-[#F5C518] border-[#F5C518] text-black'
                : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:border-gray-600'
            }`}
          >
            {heavy ? 'AĞIR VASITA — EVET (+1.0 SN)' : 'AĞIR VASITA — HAYIR'}
          </button>
        </div>

        {/* Ölçülen görüş mesafesi */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Ölçülen Görüş Mesafesi (Opsiyonel, Metre)
          </label>
          <div className="relative">
            <input
              type="number"
              value={available || ''}
              placeholder="0"
              onChange={(e) => setAvailable(Math.max(0, Number(e.target.value)))}
              className={inputCls}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">M</span>
          </div>
        </div>

        {/* SSD için μ */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            SSD İçin Sürtünme Katsayısı (μ): {mu.toFixed(2)}
          </label>
          <input
            type="range"
            min="0.3"
            max="0.9"
            step="0.01"
            value={mu}
            onChange={(e) => setMu(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
          />
        </div>

        {/* Results Card */}
        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Eye size={80} className="text-[#F5C518]" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest text-center">GEREKLİ GÖRÜŞ MESAFESİ (ISD)</div>
            <div className="text-center">
              <span className="text-6xl font-black text-white tracking-tighter">{trNum(calc.isd, 1)}</span>
              <span className="text-sm font-bold text-[#F5C518] ml-2 italic">METRE</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold text-gray-400">
              <span className="text-gray-600">BOŞLUK</span>
              <span>{trNum(calc.tGap, 1)} SN</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-600">SSD</span>
              <span>{trNum(calc.ssd, 1)} M</span>
            </div>
            {calc.verdict !== '' && (
              <div
                className={`text-center text-[9px] font-black uppercase tracking-widest py-2 rounded-xl ${
                  calc.verdict === 'ok' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}
              >
                {calc.verdict === 'ok'
                  ? `GÖRÜŞ YETERLİ (+${trNum(calc.margin, 1)} M PAY)`
                  : `GÖRÜŞ YETERSİZ (−${trNum(Math.abs(calc.margin), 1)} M EKSİK)`}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleAddToCanvas}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#F5C518] text-black rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-[#ffcf24] transition-all active:scale-95"
              >
                <PlusCircle size={13} />
                RAPORA EKLE
              </button>
              <ForensicPdfButton report={report} />
            </div>
          </div>
        </div>

        <ForensicReportPreview text={reportText} summaryText={summaryText} report={report} />

        <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl flex gap-3 items-start">
          <AlertTriangle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-orange-200">ADLİ ANALİZ NOTU</p>
            <p className="text-[8px] text-gray-500 leading-relaxed italic">
              Ölçüm, sürücü göz noktasından (≈1.08 m) tali yoldaki duruş konumuna göre yapılmalı,
              engel konumu kaza tarihindeki durumuyla değerlendirilmelidir. Limit hız yerine
              gözlenen operasyonel hız varsa ikisi ayrı senaryo olarak raporlanmalıdır.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
