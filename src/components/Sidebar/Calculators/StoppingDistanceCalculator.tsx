import React, { useState, useMemo } from 'react';
import { Gauge, Info, PlusCircle, AlertTriangle } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';
import { formatForensicReport, formatForensicSummary, trNum } from '../../../utils/forensicReport';
import { ForensicReportPreview, ForensicPdfButton } from '../../UI/ForensicReportPreview';

const SURFACE_TYPES = [
  { name: 'Asfalt (Kuru)', default: 0.75 },
  { name: 'Asfalt (Islak)', default: 0.5 },
  { name: 'Beton (Kuru)', default: 0.85 },
  { name: 'Beton (Islak)', default: 0.6 },
  { name: 'Çakıl Yol', default: 0.6 },
  { name: 'Toprak Yol', default: 0.5 },
];

const REACTION_PRESETS = [
  { label: 'Çok Dikkatli', t: 0.75 },
  { label: 'Ortalama', t: 1.0 },
  { label: 'Dikkat Dağınık', t: 1.5 },
  { label: 'Yorgun / Yaşlı', t: 2.5 },
];

export const StoppingDistanceCalculator: React.FC = () => {
  const [speed, setSpeed] = useState<number>(90);
  const [reaction, setReaction] = useState<number>(1.0);
  const [mu, setMu] = useState<number>(0.75);
  const [efficiency, setEfficiency] = useState<number>(100);
  const [grade, setGrade] = useState<number>(0); // % — + yokuş yukarı
  const [obstacle, setObstacle] = useState<number>(0); // opsiyonel: engel/çarpışma noktası uzaklığı

  const { addObject, addNotification } = useStore();

  const calc = useMemo(() => {
    const v = speed;
    if (v <= 0) return { dReact: 0, dBrake: 0, dTotal: 0, fEff: 0, margin: 0, verdict: '' as '' | 'ok' | 'no' };
    const fEff = Math.max(0.02, (mu * efficiency) / 100 + grade / 100);
    const dReact = (v / 3.6) * reaction; // tepki mesafesi (m)
    const dBrake = (v * v) / (254 * fEff); // frenleme mesafesi (m)
    const dTotal = dReact + dBrake;
    let verdict: '' | 'ok' | 'no' = '';
    let margin = 0;
    if (obstacle > 0) {
      margin = obstacle - dTotal;
      verdict = margin >= 0 ? 'ok' : 'no';
    }
    return { dReact, dBrake, dTotal, fEff, margin, verdict };
  }, [speed, reaction, mu, efficiency, grade, obstacle]);

  const report = useMemo(() => {
    const verdictText =
      calc.verdict === 'ok'
        ? `Sürücünün tespit noktası ile engel arasındaki ${trNum(obstacle, 1)} m mesafe, toplam durma mesafesinden ${trNum(calc.margin, 1)} m fazladır → durma imkânı MEVCUTTUR.`
        : calc.verdict === 'no'
          ? `Sürücünün tespit noktası ile engel arasındaki ${trNum(obstacle, 1)} m mesafe, toplam durma mesafesinden ${trNum(Math.abs(calc.margin), 1)} m eksiktir → durma imkânı MEVCUT DEĞİLDİR.`
          : 'Engel/tespit noktası uzaklığı girilmediğinden karşılaştırma yapılmamıştır.';
    return {
      title: 'TOPLAM DURMA MESAFESİ İNCELEMESİ',
      topic: 'Belirtilen hız, algılama-tepki süresi ve zemin koşullarında aracın algılama noktasından tamamen durma noktasına kadar kat edeceği toplam mesafenin adli teknik yönden hesaplanması ve değerlendirilmesi.',
      evidence: [
        `Başlangıç hızı: ${trNum(speed, 0)} km/s`,
        `Algılama-tepki süresi: ${trNum(reaction, 2)} sn`,
        `Zemin tipi/katsayısı: μ=${mu.toFixed(2)} (katsayı belirsizliği ±0.05)`,
        `Fren verimi: %${efficiency}`,
        `Yol eğimi: %${trNum(grade, 0)} (pozitif: yokuş yukarı)`,
        obstacle > 0 ? `Tespit noktası–engel arası ölçülen mesafe: ${trNum(obstacle, 1)} m` : 'Tespit noktası–engel arası mesafe verilmedi.',
      ],
      method: [
        'Tepki mesafesi: d₁ = v·t [m] (v m/s cinsinden; v = km/s ÷ 3.6).',
        'Frenleme mesafesi: d₂ = v² / (254·f), f = μ·η + e (η verim oranı, e eğim oranı) [v km/s].',
        'Toplam durma mesafesi: D = d₁ + d₂. Sağlık durumu, dikkat ve görüş koşulları tepki süresi seçiminde dikkate alınmıştır.',
      ],
      findings: [
        `Tepki (algılama) mesafesi: ${trNum(calc.dReact, 1)} m`,
        `Frenleme mesafesi: ${trNum(calc.dBrake, 1)} m`,
        `TOPLAM DURMA MESAFESİ: ${trNum(calc.dTotal, 1)} m`,
        `Etkin sürtünme katsayısı: f = ${calc.fEff.toFixed(2)}`,
        verdictText,
      ],
      scenarios: [
        'Tepki süresi bireyler arasında 0.7 – 3.0 sn aralığında değişir; yorgunluk, alkol, ilaç ve dikkat dağınıklığı süreyi uzatır → gerçek mesafe daha uzun olabilir.',
        'Gece görüşü ve yaya/algi zorluğu "görme-tepme" süresini tepki süresinin üzerine ekler → sonuç alt sınır olarak yorumlanmalıdır.',
        'ABS ve modern fren sistemleri verimi artırır; kilitli tekerleklerde katsayı düşer (μ kayma < μ statik).',
        'Yokuş aşağı durumunda eğim bileşeni frenleme mesafesini uzatır; yokuş yukarı kısaltır.',
        'Islak zeminde ilk yağmur kayganlığı (polishing) yerel μ\'yu belirgin düşürebilir.',
        'Yük ve araç tipi fren verimini değiştirir; ağır vasıtada verim belirgin düşüktür.',
        'Hız arttıkça frenleme mesafesi hızın karesiyle artar; küçük hız farkı mesafede büyük fark yaratır.',
      ],
      conclusion: [
        `${trNum(speed, 0)} km/s hızla seyreden sürücünün algılama noktasından itibaren ${trNum(reaction, 2)} sn tepki süresi ve %${efficiency} fren verimiyle tamamen durabilmesi için yaklaşık ${trNum(calc.dTotal, 1)} m mesafeye ihtiyaç duyduğu hesaplanmıştır.`,
        obstacle > 0 ? `Ölçülen mesafe ${trNum(obstacle, 1)} m ile karşılaştırıldığında: ${calc.verdict === 'ok' ? 'durma imkânı mevcut' : calc.verdict === 'no' ? 'durma imkânı mevcut değil' : 'karşılaştırma yapılamadı'}.` : 'Karşılaştırma için tespit noktası–engel arası mesafenin ölçülerek girişi önerilir.',
      ],
      caveats: [
        'Tepki süresi varsayıma dayalıdır; sürücüye özel veri (sağlık, alkol, dikkat) dosyadan doğrulanmalıdır.',
        'Sonuç; μ, verim ve eğim girdilerinin saha doğruluğuna bağımlıdır.',
        'Araç EDR verisi veya saha çekme (drag) testi varsa girdiler buna göre düzeltilmelidir.',
      ],
    };
  }, [calc, speed, reaction, mu, efficiency, grade, obstacle]);
  const reportText = useMemo(() => formatForensicReport(report), [report]);
  const summaryText = useMemo(() => formatForensicSummary(report), [report]);

  const handleAddToCanvas = () => {
    const total = Math.max(1, calc.dTotal);
    const scale = Math.min(6, 360 / total);
    const baseX = 210;
    const baseY = 300;
    const rPx = Math.max(10, calc.dReact * scale);
    const bPx = Math.max(20, calc.dBrake * scale);

    // Araç
    addObject({ type: 'rect', x: baseX - 62, y: baseY - 11, width: 56, height: 22, cornerRadius: 5, fill: '#1565C0', stroke: '#0D47A1', strokeWidth: 2 });
    addObject({ type: 'text', text: `${trNum(speed, 0)} km/s`, x: baseX - 70, y: baseY - 36, width: 100, fontSize: 10, fill: '#0D47A1', fontFamily: 'Inter', fontStyle: 'bold' });
    // Tepki mesafesi (sarı)
    addObject({ type: 'rect', x: baseX, y: baseY - 5, width: rPx, height: 10, fill: '#F5C518', stroke: '#C9A50A', strokeWidth: 1 });
    // Frenleme mesafesi (kırmızı)
    addObject({ type: 'rect', x: baseX + rPx, y: baseY - 5, width: bPx, height: 10, fill: '#E53935', stroke: '#B71C1C', strokeWidth: 1 });

    addObject({ type: 'text', text: `Tepki: ${trNum(calc.dReact, 1)} m`, x: baseX, y: baseY - 28, width: 150, fontSize: 10, fill: '#8D6E00', fontFamily: 'Inter', fontStyle: 'bold' });
    addObject({ type: 'text', text: `Frenleme: ${trNum(calc.dBrake, 1)} m`, x: baseX + rPx, y: baseY + 14, width: 170, fontSize: 10, fill: '#B71C1C', fontFamily: 'Inter', fontStyle: 'bold' });
    addObject({ type: 'text', text: `Toplam: ${trNum(calc.dTotal, 1)} m`, x: baseX + rPx + bPx + 12, y: baseY - 8, width: 150, fontSize: 12, fill: '#1B5E20', fontFamily: 'Inter', fontStyle: 'bold' });

    addObject({
      type: 'text',
      text: summaryText,
      x: baseX - 20,
      y: baseY + 44,
      width: 320,
      fontSize: 10,
      fill: '#000000',
      fontFamily: 'Inter',
      fontStyle: 'bold',
    });
    addNotification({ type: 'success', message: 'Şema ve kısa özet rapora (kroki) eklendi' });
  };

  const inputCls = 'w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all font-mono';

  return (
    <div className="space-y-6 relative">
      <HelpTooltip
        title="Toplam Durma Mesafesi"
        description="Belirli hız ve zemin koşullarında tepki + frenleme mesafelerinin toplamını hesaplar; engel mesafesi girilirse durabilme karşılaştırması yapar."
        formula="D = v·t + v²/(254·f)"
        usage="Hızı ve tepki süresini seçin, zemin katsayısını belirleyin. Varsa sürücünün engeli gördüğü nokta ile engel arası mesafeyi girin — yeterlilik değerlendirmesi rapora eklenir."
      />
      <div className="space-y-4 p-1">
        {/* Hız */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Gauge size={12} className="text-[#F5C518]" />
            Seyir Hızı (km/s)
          </label>
          <div className="relative">
            <input type="number" value={speed} onChange={(e) => setSpeed(Math.max(0, Number(e.target.value)))} className={inputCls} />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">KM/S</span>
          </div>
        </div>

        {/* Tepki süresi */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Algılama-Tepki Süresi: {trNum(reaction, 2)} SN
          </label>
          <div className="grid grid-cols-4 gap-1 mb-2">
            {REACTION_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setReaction(p.t)}
                className={`px-1 py-1.5 rounded-lg border text-[8px] font-bold transition-all ${
                  reaction === p.t
                    ? 'bg-[#F5C518]/20 border-[#F5C518]/50 text-[#F5C518]'
                    : 'bg-[#1a1a1a] border-[#333] text-gray-500'
                }`}
              >
                {p.label.toUpperCase()}
              </button>
            ))}
          </div>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.05"
            value={reaction}
            onChange={(e) => setReaction(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
          />
        </div>

        {/* Sürtünme katsayısı */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Sürtünme Katsayısı (μ): {mu.toFixed(2)}
          </label>
          <div className="grid grid-cols-2 gap-1 mb-2">
            {SURFACE_TYPES.map((type) => (
              <button
                key={type.name}
                onClick={() => setMu(type.default)}
                className={`px-2 py-1.5 rounded-lg border text-[8px] font-bold transition-all ${
                  mu === type.default
                    ? 'bg-[#F5C518]/20 border-[#F5C518]/50 text-[#F5C518]'
                    : 'bg-[#1a1a1a] border-[#333] text-gray-500'
                }`}
              >
                {type.name.toUpperCase()}
              </button>
            ))}
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.01"
            value={mu}
            onChange={(e) => setMu(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
          />
        </div>

        {/* Verim ve eğim */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Fren Verimi: %{efficiency} · Eğim: %{grade > 0 ? '+' : ''}{grade}
          </label>
          <input
            type="range"
            min="30"
            max="100"
            step="5"
            value={efficiency}
            onChange={(e) => setEfficiency(parseInt(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
          />
          <input
            type="range"
            min="-10"
            max="10"
            step="1"
            value={grade}
            onChange={(e) => setGrade(parseInt(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
          />
        </div>

        {/* Opsiyonel engel mesafesi */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Tespit Noktası–Engel Mesafesi (Opsiyonel, Metre)
          </label>
          <div className="relative">
            <input
              type="number"
              value={obstacle || ''}
              placeholder="0"
              onChange={(e) => setObstacle(Math.max(0, Number(e.target.value)))}
              className={inputCls}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">M</span>
          </div>
        </div>

        {/* Results Card */}
        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Gauge size={80} className="text-[#F5C518]" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest text-center">TOPLAM DURMA MESAFESİ</div>
            <div className="text-center">
              <span className="text-6xl font-black text-white tracking-tighter">{trNum(calc.dTotal, 1)}</span>
              <span className="text-sm font-bold text-[#F5C518] ml-2 italic">METRE</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold text-gray-400">
              <span className="text-gray-600">TEPKİ</span>
              <span>{trNum(calc.dReact, 1)} M</span>
              <span className="text-gray-600">+</span>
              <span className="text-gray-600">FRENLEME</span>
              <span>{trNum(calc.dBrake, 1)} M</span>
            </div>
            {calc.verdict !== '' && (
              <div
                className={`text-center text-[9px] font-black uppercase tracking-widest py-2 rounded-xl ${
                  calc.verdict === 'ok' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}
              >
                {calc.verdict === 'ok'
                  ? `DURABİLİRDİ (+${trNum(calc.margin, 1)} M PAY)`
                  : `DURAMAZDI (−${trNum(Math.abs(calc.margin), 1)} M EKSİK)`}
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
              Tepki süresi varsayıma dayalı bir girdidir; sürücünün sağlık durumu, dikkat ve görüş
              koşulları dosya kapsamında ayrıca değerlendirilmelidir. Girdi değerleri için EDR
              verisi veya saha ölçümleri varsa bunlar esas alınmalıdır.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
