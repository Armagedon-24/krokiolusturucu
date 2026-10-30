import React, { useState, useEffect, useMemo } from 'react';
import { Thermometer, Clock, Info, PlusCircle, Wind, Waves, Shirt } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';
import { formatForensicReport, trNum } from '../../../utils/forensicReport';
import { ForensicReportPreview } from '../../UI/ForensicReportPreview';

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
  
  const { addObject } = useStore();

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

  const reportText = useMemo(() => formatForensicReport({
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

  const handleAddToCanvas = () => {
    addObject({
      type: 'text',
      text: reportText,
      x: 300,
      y: 300,
      width: 360,
      fontSize: 11,
      fill: '#000000',
      fontFamily: 'Inter',
      fontStyle: 'bold'
    });
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

            <button
              onClick={handleAddToCanvas}
              className="w-full flex items-center justify-center gap-2 py-4 bg-[#F5C518] text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#ffcf24] transition-all shadow-lg active:scale-95"
            >
              <PlusCircle size={14} />
              ANALİZİ RAPORA EKLE
            </button>
          </div>
        </div>

        <ForensicReportPreview text={reportText} />

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
