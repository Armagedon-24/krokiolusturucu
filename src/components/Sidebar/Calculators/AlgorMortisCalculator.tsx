import React, { useState, useEffect, useMemo } from 'react';
import { Thermometer, Clock, Info, PlusCircle, Wind, Waves, Shirt } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';
import { formatForensicReport, formatForensicSummary, trNum } from '../../../utils/forensicReport';
import { ForensicReportPreview, ForensicPdfButton } from '../../UI/ForensicReportPreview';

const CORRECTION_FACTORS = [
  { id: 'naked', name: 'Çıplak / İnce Giysi', factor: 1.0, icon: <Thermometer size={14} /> },
  { id: 'clothed', name: 'Kalın Giysili', factor: 0.5, icon: <Shirt size={14} /> },
  { id: 'water_still', name: 'Durgun Su', factor: 2.0, icon: <Waves size={14} /> },
  { id: 'water_moving', name: 'Akan Su', factor: 3.0, icon: <Waves size={14} /> },
  { id: 'windy', name: 'Rüzgarlı Ortam', factor: 1.4, icon: <Wind size={14} /> },
];

export const AlgorMortisCalculator: React.FC = () => {
  const [bodyTemp, setBodyTemp] = useState<number>(30);
  const [ambientTemp, setAmbientTemp] = useState<number>(20);
  const [condition, setCondition] = useState(CORRECTION_FACTORS[0]);
  const [hours, setHours] = useState<number>(0);
  const [hoursMin, setHoursMin] = useState<number>(0);
  const [hoursMax, setHoursMax] = useState<number>(0);
  
  const { addObject, addNotification } = useStore();

  useEffect(() => {
    const baseCoolingRate = 1.5;
    const adjustedRate = baseCoolingRate * condition.factor;
    // Newton soğuma modeli: ortam sıcaklığı artık hesaba katılıyor.
    // t = (T0 − Ta)/k × ln((T0 − Ta)/(Tb − Ta)) — k başlangıç eğimi (°C/saat).
    // Vücut ısısı ortam sıcaklığına yaklaştıysa güvenilir tahmin yapılamaz.
    const delta0 = 37.2 - ambientTemp;
    const deltaNow = bodyTemp - ambientTemp;
    if (delta0 <= 0 || deltaNow <= 0.5) {
      setHours(0);
      setHoursMin(0);
      setHoursMax(0);
      return;
    }
    const calculatedHours = (delta0 / adjustedRate) * Math.log(delta0 / deltaNow);
    setHours(Math.max(0, calculatedHours));

    // Belirsizlik: ölçüm ±0.5°C, soğuma hızı ±%15 (Henssge varyasyonu)
    const hMin = (delta0 / (adjustedRate * 1.15)) * Math.log(delta0 / Math.min(delta0, deltaNow + 0.5));
    const hMax = (delta0 / (adjustedRate * 0.85)) * Math.log(delta0 / Math.max(0.1, deltaNow - 0.5));
    setHoursMin(Math.max(0, hMin));
    setHoursMax(Math.max(0, hMax));
  }, [bodyTemp, ambientTemp, condition]);

  const reliability = bodyTemp - ambientTemp <= 5
    ? 'DÜŞÜK — vücut ısısı ortama yakınsadığı için sıcaklık yöntemiyle kesin kanaat verilemez'
    : hours > 24
      ? 'ORTA — 24 saati aşan sürelerde livor/rigor mortis ve entomolojik bulgularla desteklenmelidir'
      : 'YÜKSEK';

  const report = useMemo(() => ({
    title: 'ÖLÜM ZAMANI İNCELEMESİ (ALGOR MORTİS)',
    topic: 'Ceset vücut ısısı ve çevre koşullarından hareketle, ölümün üzerinden geçen sürenin (PMI) adli tıp teknik yönünden tahmin edilmesi.',
    evidence: [
      `Ölçülen vücut ısısı: ${bodyTemp}°C (rektal/kulak ölçümü ±0.5°C)`,
      `Ortam (mahal) sıcaklığı: ${ambientTemp}°C`,
      `Bulunduğu ortam/giysi durumu: ${condition.name} (K-faktörü ${condition.factor}x)`,
    ],
    method: [
      'Newton soğuma modeli: t = (T0 − Ta)/k × ln((T0 − Ta)/(Tb − Ta)); T0=37.2°C, k=1.5×K °C/saat.',
      'Soğuma hızına giysi/su/rüzgar K-faktörü uygulanmıştır.',
      'Belirsizlik analizi: ölçüm ±0.5°C ve soğuma hızı ±%15 uç değerleriyle min–max PMI hesaplanmıştır.',
      'Kesin ölüm saati, olay anı referans saatten geriye doğru hesaplanmıştır.',
    ],
    findings: [
      `Nokta tahmin (PMI): ${trNum(hours, 1)} saat`,
      `Muhtemel aralık: ${trNum(hoursMin, 1)} – ${trNum(hoursMax, 1)} saat`,
      `Güvenilirlik: ${reliability}`,
    ],
    scenarios: [
      'Ölüm anında ateş/infeksiyon (T0 38–40°C) varsa gerçek süre tahminden UZUN; ağır egzersiz veya heyecan durumunda kısa çıkabilir.',
      'Alkol/uyuşturucu alımı periferik damarları açarak soğumayı hızlandırır → gerçek süre tahminden KISA çıkabilir.',
      'Hipotermi öyküsü (ölüm öncesi soğuma) başlangıç ısısını düşürür → süre tahminden UZUN çıkabilir.',
      'Obez vücut ısıyı daha yavaş kaybeder → gerçek süre tahminden KISA; zayıf/bebek/yaşlı vücut hızlı soğur → süre UZUN çıkar.',
      'Su içindeki cesetler havaya göre 2–3 kat hızlı soğur; akan su faktörü durgun sudan büyüktür.',
      'Rüzgar ve düşük nem soğumayı hızlandırır; güneş ışığı, klima veya kalorifer mahal sıcaklığını değiştirir → ortam sıcaklığı ölçüm anındaki değer varsayılmıştır.',
      'Ortam sıcaklığı ölüm anından bugüne değişkense (gece/gündüz farkı) düzeltme gerekir; sabit sıcaklık varsayımı aralığı genişletir.',
      'Kalın giysi/yatak örtüsü soğumayı %50’ye kadar yavaşlatır; ıslak giysi tersine hızlandırır.',
      'Kasıt/araç içi gibi yalıtılmış mahallerde soğuma eğrisi düzleşir → hesap alt sınır verir.',
    ],
    conclusion: [
      `İnceleme sonucunda ölümün üzerinden ${trNum(hours, 1)} saat geçmiş olma ihtimali güçlüdür; tüm değişkenler hesaba katıldığında muhtemel süre ${trNum(hoursMin, 1)} – ${trNum(hoursMax, 1)} saat aralığındadır.`,
      'Ölüm zamanı kanaati, livor/rigor mortis, mide boşalması, entomolojik ve sahaya ilişkin bulgularla birlikte bütüncül değerlendirilmelidir.',
    ],
    caveats: [
      'Sıcaklık yöntemi tek başına kesin ölüm saati vermez; ±2–3 saatin altına inen hassasiyet iddiası bilimsel değildir.',
      'Vücut ısısı ortam sıcaklığına yaklaşmışsa (fark ≤5°C) yöntemin güvenilirliği düşer; otopsi ve laboratuvar bulguları esas alınmalıdır.',
      'Rapor, muayene anında bildirilen ölçümlerin doğruluğuna bağlıdır.',
    ],
  }), [bodyTemp, ambientTemp, condition, hours, hoursMin, hoursMax, reliability]);
  const reportText = useMemo(() => formatForensicReport(report), [report]);
  const summaryText = useMemo(() => formatForensicSummary(report), [report]);

  const handleAddToCanvas = () => {
    const seg = (ax: number, ay: number, bx: number, by: number, color: string, th = 3) => {
      const dx = bx - ax, dy = by - ay;
      addObject({ type: 'rect', x: ax, y: ay, width: Math.max(2, Math.sqrt(dx * dx + dy * dy)), height: th, rotation: (Math.atan2(dy, dx) * 180) / Math.PI, fill: color, stroke: color, strokeWidth: 0.5 });
    };

    const baseX = 230;
    const baseY = 290;
    const W = 260;
    const H = 120;
    const span = Math.max(24, hours * 1.5);
    const tMin = Math.min(ambientTemp, bodyTemp) - 1;
    const lam = bodyTemp > ambientTemp && hours > 0
      ? Math.log((37 - ambientTemp) / Math.max(0.5, bodyTemp - ambientTemp)) / hours
      : 0.05;
    const yOf = (t: number) => H - ((t - tMin) / (37.5 - tMin)) * H;

    // Eksenler
    addObject({ type: 'rect', x: baseX, y: baseY - H, width: 2, height: H + 6, fill: '#9E9E9E' });
    addObject({ type: 'rect', x: baseX, y: baseY, width: W + 30, height: 2, fill: '#9E9E9E' });
    // Ortam sıcaklığı (kesikli yatay)
    addObject({ type: 'line', x: baseX, y: baseY + yOf(ambientTemp) - H, width: W + 30, height: 2, dash: [6, 5], fill: '#455A64' });
    addObject({ type: 'text', text: `Ortam ${trNum(ambientTemp, 0)}°C`, x: baseX + W + 8, y: baseY + yOf(ambientTemp) - H - 8, width: 90, fontSize: 9, fill: '#455A64', fontFamily: 'Inter', fontStyle: 'bold' });
    // Soğuma eğrisi (rect parçalarıyla)
    const N = 16;
    for (let i = 0; i < N; i++) {
      const t1 = (i / N) * span, t2 = ((i + 1) / N) * span;
      const u1 = ambientTemp + (37 - ambientTemp) * Math.exp(-lam * t1);
      const u2 = ambientTemp + (37 - ambientTemp) * Math.exp(-lam * t2);
      seg(baseX + (t1 / span) * W, baseY + yOf(u1) - H, baseX + (t2 / span) * W, baseY + yOf(u2) - H, '#B71C1C', 3);
    }
    // Ölçüm anı işareti
    const nowX = Math.min(W, (hours / span) * W);
    const nowY = yOf(bodyTemp) - H;
    addObject({ type: 'rect', x: baseX + nowX - 5, y: baseY + nowY - 5, width: 10, height: 10, rotation: 45, fill: '#1565C0', stroke: '#fff', strokeWidth: 1 });
    addObject({ type: 'text', text: `Ölçüm: ${trNum(bodyTemp, 1)}°C`, x: baseX + nowX - 60, y: baseY + nowY - 26, width: 130, fontSize: 9, fill: '#0D47A1', fontFamily: 'Inter', fontStyle: 'bold' });
    addObject({ type: 'text', text: `PMI ≈ ${trNum(hours, 1)} saat (${trNum(hoursMin, 1)}–${trNum(hoursMax, 1)})`, x: baseX + 20, y: baseY - H - 36, width: 250, fontSize: 12, fill: '#B71C1C', fontFamily: 'Inter', fontStyle: 'bold' });
    addObject({ type: 'text', text: 'Vücut ısısı (soğuma eğrisi)', x: baseX + 14, y: baseY - H - 12, width: 190, fontSize: 9, fill: '#B71C1C', fontFamily: 'Inter', fontStyle: 'bold' });

    addObject({
      type: 'text',
      text: summaryText,
      x: baseX - 20,
      y: baseY + 34,
      width: 320,
      fontSize: 10,
      fill: '#000000',
      fontFamily: 'Inter',
      fontStyle: 'bold',
    });
    addNotification({ type: 'success', message: 'Şema ve kısa özet rapora (kroki) eklendi' });
  };

  return (
    <div className="space-y-6 p-1 relative">
      <HelpTooltip 
        title="Ölüm Saati (Algor Mortis)"
        description="Ölüm sonrası vücut sıcaklığının düşüş hızından yola çıkarak ölüm anını tahmin eder."
        formula="t = (37.2 - T_body) / (1.5 * K)"
        usage="Mevcut vücut sıcaklığını ve ortam sıcaklığını girin. K-Faktörü için cesedin üzerindeki giysi veya bulunduğu ortamı (su vb.) seçin."
      />
      <div className="space-y-4">
        {/* Condition Selection */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Ortam ve Vücut Durumu
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CORRECTION_FACTORS.map((cf) => (
              <button
                key={cf.id}
                onClick={() => setCondition(cf)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[9px] font-black transition-all ${
                  condition.id === cf.id 
                    ? 'bg-[#F5C518] border-[#F5C518] text-black shadow-lg shadow-[#F5C518]/10' 
                    : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:border-gray-600'
                }`}
              >
                {cf.icon}
                {cf.name.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Temperature Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 text-red-400">
              <Thermometer size={12} />
              Vücut Isısı (°C)
            </label>
            <input
              type="number"
              step="0.1"
              value={bodyTemp}
              onChange={(e) => setBodyTemp(Number(e.target.value))}
              className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-red-500/50 outline-none transition-all font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 text-blue-400">
              <Thermometer size={12} />
              Ortam Isısı (°C)
            </label>
            <input
              type="number"
              step="0.1"
              value={ambientTemp}
              onChange={(e) => setAmbientTemp(Number(e.target.value))}
              className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all font-mono"
            />
          </div>
        </div>

        {/* Results Card */}
        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
            <Clock size={120} />
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="space-y-1 text-center">
              <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest text-center">ÖLÜMÜN ÜZERİNDEN GEÇEN SÜRE</div>
              <div className="flex items-center justify-center gap-3">
                <span className="text-6xl font-black text-white tracking-tighter">{hours.toFixed(1)}</span>
                <div className="text-left">
                   <div className="text-sm font-bold text-[#F5C518] leading-none uppercase">Saat</div>
                   <div className="text-[8px] text-gray-600 font-bold uppercase tracking-widest italic">Tahmini</div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold text-gray-400">
                <span className="text-gray-600">ARALIK</span>
                <span>{hoursMin.toFixed(1)}</span>
                <span className="text-gray-600">—</span>
                <span>{hoursMax.toFixed(1)}</span>
                <span className="text-gray-600">SAAT</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddToCanvas}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#F5C518] text-black rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-[#ffcf24] transition-all active:scale-95"
              >
                <PlusCircle size={13} />
                ANALİZİ RAPORA EKLE
              </button>
              <ForensicPdfButton report={report} />
            </div>
          </div>
        </div>

        <ForensicReportPreview text={reportText} summaryText={summaryText} report={report} />

        <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex gap-3 items-start shadow-inner">
          <Info size={16} className="text-blue-900 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-blue-200/50 uppercase">HENSGGE NOMOGRAM NOTU</p>
            <p className="text-[8px] text-gray-600 leading-relaxed italic">
              Giysi ve ortam faktörleri (K-Faktörü) hesaba katılmıştır. Su içindeki cesetler havaya göre 2-3 kat daha hızlı soğurken, kalın giysiler bu süreci %50'ye kadar yavaşlatabilir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
