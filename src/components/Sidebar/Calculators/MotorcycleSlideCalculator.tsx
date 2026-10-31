import React, { useState, useEffect, useMemo } from 'react';
import { Bike, Info, PlusCircle, AlertTriangle } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';
import { formatForensicReport, formatForensicSummary, trNum } from '../../../utils/forensicReport';
import { ForensicReportPreview, ForensicPdfButton } from '../../UI/ForensicReportPreview';

/** Kayma/düşme fazı sürükleme faktörü ön ayarları (adli literatür tipik aralıkları). */
const DRAG_PRESETS = [
  { id: 'bike_slide', name: 'Motosiklet — Yan Yatma', mu: 0.28 },
  { id: 'bike_tumble', name: 'Motosiklet — Taklamalı', mu: 0.35 },
  { id: 'rider_leather', name: 'Sürücü — Deri Kıyafet', mu: 0.2 },
  { id: 'rider_normal', name: 'Sürücü — Normal Kıyafet', mu: 0.3 },
];

export const MotorcycleSlideCalculator: React.FC = () => {
  const [distance, setDistance] = useState<number>(25);
  const [presetId, setPresetId] = useState<string>(DRAG_PRESETS[0].id);
  const [mu, setMu] = useState<number>(DRAG_PRESETS[0].mu);
  const [speed, setSpeed] = useState<number>(0);
  const [speedMin, setSpeedMin] = useState<number>(0);
  const [speedMax, setSpeedMax] = useState<number>(0);

  const preset = DRAG_PRESETS.find((p) => p.id === presetId)!;

  const { addObject, addNotification } = useStore();

  useEffect(() => {
    const p = DRAG_PRESETS.find((x) => x.id === presetId);
    if (p) setMu(p.mu);
  }, [presetId]);

  useEffect(() => {
    if (distance > 0 && mu > 0) {
      // v = √(2·μ·g·d) m/s → 15.94·√(μ·d) km/s
      const calc = (m: number, d: number) => 15.94 * Math.sqrt(m * d);
      setSpeed(calc(mu, distance));
      const muMin = Math.max(0.05, mu - 0.05);
      const muMax = Math.min(0.8, mu + 0.05);
      const dMin = distance * 0.95;
      const dMax = distance * 1.05;
      const candidates = [calc(muMin, dMin), calc(muMin, dMax), calc(muMax, dMin), calc(muMax, dMax)];
      setSpeedMin(Math.min(...candidates));
      setSpeedMax(Math.max(...candidates));
    } else {
      setSpeed(0);
      setSpeedMin(0);
      setSpeedMax(0);
    }
  }, [distance, mu]);

  const report = useMemo(
    () => ({
      title: 'MOTOSİKLET KAYMA İZİ HIZ İNCELEMESİ',
      topic: 'Düşme sonrasında motosikletin/sürücünün yerde kayma (sürüklenme) izi uzunluğu ve sürükleme faktöründen hareketle, düşme anındaki hızın adli teknik yönden değerlendirilmesi.',
      evidence: [
        `Kayma izi uzunluğu: ${trNum(distance, 1)} m (ölçüm payı ±%5)`,
        `Kayma fazı: ${preset.name} — sürükleme faktörü μ=${mu.toFixed(2)} (belirsizlik ±0.05)`,
      ],
      method: [
        'Kinetik enerji-iş denklemi: v = √(2·μ·g·d), pratik form: v = 15.94·√(μ·d) [km/s, d metre].',
        'Sürükleme faktörü; kayma fazına (yan yatma / taklama) ve sürtünen yüzeye (araç / kıyafet) göre seçilmiştir.',
        'Belirsizlik analizi: μ±0.05 ve iz boyu ±%5 uç değerlerinin tüm kombinasyonlarıyla min–max hız hesaplanmıştır.',
      ],
      findings: [
        `Hesaplanan nokta hız: ${trNum(speed, 0)} km/s`,
        `Muhtemel hız aralığı: ${trNum(speedMin, 0)} – ${trNum(speedMax, 0)} km/s`,
        'Bu hız, kaymanın başladığı (düşme) noktasına aittir.',
      ],
      scenarios: [
        'Taklama (tumble) fazları sürtünmeyi artırır → yan yatma katsayısı ile hesap gerçek hızın alt sınırını verebilir.',
        'Motor çalışır durumdaysa veya tekerlekler serbest dönüyorsa sürtünme düşer → gerçek hız hesaplanandan yüksek olabilir.',
        'Motosiklet ve sürücü izleri ayrı ise her biri için ayrı hesap yapılmalı; tek değerle genellemeye gidilmemelidir.',
        'Kayma boyunca zemin tipi değişiyorsa (asfalt→toprak) segment segment enerji analizi gerekir.',
        'Düşme öncesi frenleme varsa düşme anındaki hız, seyir hızının altındadır.',
        'Çarpma sonrası ikinci bir temas (kervan, bariyer, başka araç) izin sonunu değiştirir → kayma boyu okuması yanıltıcı olur.',
        'Deri kıyafetli sürücüde sürükleme faktörü belirgin düşüktür; giysi tipi tespiti sonuçları etkiler.',
        'Islak zeminde katsayı düşer → aynı iz boyu daha yüksek hız anlamına gelir.',
      ],
      conclusion: [
        `İnceleme sonucunda düşme anındaki hızın en az ${trNum(speed, 0)} km/s, ölçüm belirsizlikleri hesaba katıldığında ${trNum(speedMin, 0)} – ${trNum(speedMax, 0)} km/s aralığında bulunduğu kanaatine varılmıştır.`,
        'Kesin değer için iz segmentlerinin ayrı analizi ve mümkünse araç EDR verisi önerilir.',
      ],
      caveats: [
        'Sonuç; iz boyu ve sürükleme faktörü seçiminin saha doğruluğuna bağımlıdır.',
        'Kayma modeli tek fazlıdır; çok fazlı olaylarda segment analizi yapılmadan sonuç kullanılmamalıdır.',
        'Zemin değişimi, ikinci temas ve iklim koşulları için manuel düzeltme yapılmadıkça sonuç yerel doğruluk taşır.',
      ],
    }),
    [speed, speedMin, speedMax, distance, mu, preset],
  );
  const reportText = useMemo(() => formatForensicReport(report), [report]);
  const summaryText = useMemo(() => formatForensicSummary(report), [report]);

  const handleAddToCanvas = () => {
    // Yalnızca kısa özet metni tuvale eklenir (şema/çizim eklenmez)
    addObject({
      type: 'text',
      text: summaryText,
      x: 200,
      y: 300,
      width: 340,
      fontSize: 10,
      fill: '#000000',
      fontFamily: 'Inter',
      fontStyle: 'bold',
    });
    addNotification({ type: 'success', message: 'Kısa özet tuvale aktarıldı' });
  };

  const inputCls = 'w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all font-mono';

  return (
    <div className="space-y-6 relative">
      <HelpTooltip
        title="Motosiklet Kayma Analizi"
        description="Düşme sonrası kayma izi uzunluğundan motosikletin (veya sürücünün) düşme anındaki hızını hesaplar."
        formula="v = 15.94 · sqrt(μ · d)"
        usage="Kayma izi uzunluğunu metre girin. Kayma fazını seçin — sürükleme faktörü otomatik gelir, gerekirse slider ile düzeltin."
      />
      <div className="space-y-4 p-1">
        {/* Kayma fazı */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Kayma Fazı / Sürükleme Faktörü Ön Ayarı
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {DRAG_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPresetId(p.id)}
                className={`px-3 py-2 rounded-xl border text-[9px] font-black transition-all ${
                  presetId === p.id
                    ? 'bg-[#F5C518] border-[#F5C518] text-black shadow-lg shadow-[#F5C518]/20'
                    : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:border-gray-600'
                }`}
              >
                {p.name.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* İz boyu */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Bike size={12} className="text-[#F5C518]" />
            Kayma İzi Uzunluğu (Metre)
          </label>
          <div className="relative">
            <input type="number" value={distance} onChange={(e) => setDistance(Math.max(0, Number(e.target.value)))} className={inputCls} />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">M</span>
          </div>
        </div>

        {/* Sürükleme faktörü */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Sürükleme Faktörü (μ): {mu.toFixed(2)}
          </label>
          <input
            type="range"
            min="0.15"
            max="0.5"
            step="0.01"
            value={mu}
            onChange={(e) => setMu(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
          />
          <p className="text-[8px] text-gray-600 italic">
            * Tipik aralıklar: yan yatma 0.25–0.35, taklamalı 0.30–0.40, deri kıyafet 0.15–0.25, normal kıyafet 0.25–0.35.
          </p>
        </div>

        {/* Results Card */}
        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Bike size={80} className="text-[#F5C518]" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest text-center">DÜŞME ANINDAKİ HIZ</div>
            <div className="text-center">
              <span className="text-6xl font-black text-white tracking-tighter">{Math.round(speed)}</span>
              <span className="text-sm font-bold text-[#F5C518] ml-2 italic">KM/S</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold text-gray-400">
              <span className="text-gray-600">MİN</span>
              <span>{Math.round(speedMin)}</span>
              <span className="text-gray-600">—</span>
              <span>{Math.round(speedMax)}</span>
              <span className="text-gray-600">MAKS KM/S</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddToCanvas}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#F5C518] text-black rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-[#ffcf24] transition-all active:scale-95"
              >
                <PlusCircle size={13} />
                TUVALE AKTAR
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
              Motosiklet ve sürücü izleri ayrı ayrı ölçülmeli ve ayrı hesap yapılmalıdır. Zemin
              tipi iz boyunca değişiyorsa segment segment enerji analizi gerekir; tek değerle
              genellemeye gidilmemelidir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
