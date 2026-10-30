import React, { useState, useEffect, useMemo } from 'react';
import { Footprints, Info, PlusCircle, AlertTriangle } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';
import { formatForensicReport, trNum } from '../../../utils/forensicReport';
import { ForensicReportPreview, ForensicPdfButton } from '../../UI/ForensicReportPreview';

const SURFACE_TYPES = [
  { name: 'Asfalt (Kuru)', default: 0.75 },
  { name: 'Asfalt (Islak)', default: 0.5 },
  { name: 'Beton (Kuru)', default: 0.85 },
  { name: 'Beton (Islak)', default: 0.6 },
  { name: 'Çakıl Yol', default: 0.6 },
  { name: 'Toprak Yol', default: 0.5 },
];

const HEIGHT_PRESETS = [
  { label: 'Kaput Üstü', h: 0.75 },
  { label: 'Kaput Kenarı', h: 0.85 },
  { label: 'Ağırlık Merkezi', h: 0.95 },
  { label: 'Omuz Hizası', h: 1.3 },
];

/** Searle (1983) sınır hızları [m/s]: √(2μg)·(√(d+h) ± √h) */
const searle = (d: number, h: number, mu: number) => {
  const k = Math.sqrt(2 * mu * 9.81);
  return { min: k * (Math.sqrt(d + h) - Math.sqrt(h)), max: k * (Math.sqrt(d + h) + Math.sqrt(h)) };
};
const toKmh = (v: number) => v * 3.6;

export const PedestrianThrowCalculator: React.FC = () => {
  const [distance, setDistance] = useState<number>(20);
  const [height, setHeight] = useState<number>(0.85);
  const [mu, setMu] = useState<number>(0.75);
  const [vMin, setVMin] = useState<number>(0);
  const [vMax, setVMax] = useState<number>(0);
  const [vMid, setVMid] = useState<number>(0);

  const { addObject } = useStore();

  useEffect(() => {
    if (distance > 0 && mu > 0 && height > 0) {
      const calc = (d: number, m: number) => {
        const s = searle(d, height, m);
        return { min: toKmh(s.min), max: toKmh(s.max) };
      };
      const muMin = Math.max(0.05, mu - 0.05);
      const muMax = Math.min(1.0, mu + 0.05);
      const dMin = distance * 0.95;
      const dMax = distance * 1.05;
      const corners = [calc(dMin, muMin), calc(dMin, muMax), calc(dMax, muMin), calc(dMax, muMax)];
      const gMin = Math.min(...corners.map((c) => c.min));
      const gMax = Math.max(...corners.map((c) => c.max));
      setVMin(gMin);
      setVMax(gMax);
      setVMid((gMin + gMax) / 2);
    } else {
      setVMin(0);
      setVMax(0);
      setVMid(0);
    }
  }, [distance, height, mu]);

  const report = useMemo(
    () => ({
      title: 'YAYA FIRLATMA MESAFESİ (SEARLE) İNCELEMESİ',
      topic: 'Çarpışma sonrasında yayaya ait fırlatma (atılma) mesafesi ile zemin sürtünme katsayısından hareketle, çarpışma anındaki araç hızının adli teknik yönden değerlendirilmesi.',
      evidence: [
        `Yaya fırlatma mesafesi: ${trNum(distance, 1)} m (çarpışma noktasından yayanın durduğu yere kadar, ölçüm payı ±%5)`,
        `Fırlatma yüksekliği (başlangıç ağırlık merkezi): ${trNum(height, 2)} m`,
        `Zemin tipi/katsayısı: μ=${mu.toFixed(2)} (katsayı belirsizliği ±0.05)`,
      ],
      method: [
        'Searle (1983) sınır formülleri: v_min = √(2·μ·g)·(√(d+h) − √h), v_max = √(2·μ·g)·(√(d+h) + √h) [m/s].',
        'Formül; düz zeminde serbest fırlatma + yuvarlanma/kayma sürtünmesi varsayımına dayanır ve hız için alt–üst sınır verir.',
        'Belirsizlik analizi: μ±0.05 ile fırlatma mesafesi ±%5 uç değerlerinin tüm kombinasyonlarıyla min–max aralık hesaplanmıştır.',
      ],
      findings: [
        `Hesaplanan alt sınır (en olası minimum): ${trNum(vMin, 0)} km/s`,
        `Hesaplanan üst sınır: ${trNum(vMax, 0)} km/s`,
        `Aralık orta değeri: ${trNum(vMid, 0)} km/s`,
        'Aralık; çarpışma anındaki araç hızına ilişkin olasılık bandı olarak sunulmuştur.',
      ],
      scenarios: [
        'Searle formülü sarılma (wrap) ve kaput üstünde taşınma sürelerini içermez; uzun taşınmalı olaylarda gerçek hız hesaplanandan yüksek olabilir.',
        'Fırlatma açısının yukarı doğru olması mesafeyi uzatır → üst sınır daha temsili olabilir.',
        'Yayanın yuvarlanması sürtünmeyi azaltır → aynı mesafe için hesaplanan hız düşük çıkar (alt sınır yorumu güçlenir).',
        'Giysi-zemin sürtünmesi araç lastiği μ\'sünden farklıdır; giysi kayma katsayısı genellikle daha düşüktür.',
        'Yokuş aşağı fırlatmada mesafe uzar → hız düşük hesaplanabilir; eğim düzeltmesi ayrı yapılmalıdır.',
        'Yayanın araçla ikinci kez temas etmesi veya emniyet şeridine savrulması mesafeyi yanıltır.',
        'Islak/karlı zeminde μ düşer → aynı mesafe için hesaplanan hız düşer; zemin koşulu güvenle belgelenmelidir.',
        'Araç çarpışma sonrası yayanın üstünden geçtiyse (under-ride) fırlatma modeli uygulanamaz.',
      ],
      conclusion: [
        `İnceleme sonucunda çarpışma anındaki araç hızının en az ${trNum(vMin, 0)} km/s, ölçüm belirsizlikleri ve model sınırları hesaba katıldığında ${trNum(vMin, 0)} – ${trNum(vMax, 0)} km/s aralığında bulunduğu kanaatine varılmıştır.`,
        'Daha dar aralık için fırlatma açısı, yuvarlanma izleri ve sürükleme izlerinin ayrı analizi önerilir.',
      ],
      caveats: [
        'Sonuç; fırlatma mesafesi ve μ ölçümlerinin saha doğruluğuna bağımlıdır.',
        'Searle modeli deneye dayalı bir sınır modelidir; mutlak hız değil olasılık bandı verir.',
        'Yaya boyu, kıyafet ve zemin kirliği gibi yerel etkenler için manuel düzeltme yapılmadıkça sonuç yerel doğruluk taşır.',
      ],
    }),
    [vMin, vMax, vMid, distance, height, mu],
  );
  const reportText = useMemo(() => formatForensicReport(report), [report]);

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
      fontStyle: 'bold',
    });
  };

  const inputCls = 'w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all font-mono';

  return (
    <div className="space-y-6 relative">
      <HelpTooltip
        title="Yaya Fırlatma Mesafesi (Searle)"
        description="Çarpışmada savrulan yayanın yatay fırlatma mesafesinden araç hızına alt–üst sınır hesaplar."
        formula="v_min/max = sqrt(2·μ·g) · (√(d+h) ± √h)"
        usage="Fırlatma mesafesini (çarpışma noktası → yayanın durduğu nokta) metre girin. Fırlatma yüksekliği için hazır değerlerden birini seçin veya slider ile ayarlayın."
      />
      <div className="space-y-4 p-1">
        {/* Fırlatma mesafesi */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Fırlatma Mesafesi (Metre)
          </label>
          <div className="relative">
            <input
              type="number"
              value={distance}
              onChange={(e) => setDistance(Math.max(0, Number(e.target.value)))}
              className={inputCls}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">M</span>
          </div>
        </div>

        {/* Fırlatma yüksekliği */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Footprints size={12} className="text-[#F5C518]" />
            Fırlatma Yüksekliği: {trNum(height, 2)} M
          </label>
          <div className="grid grid-cols-4 gap-1 mb-2">
            {HEIGHT_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setHeight(p.h)}
                className={`px-1 py-1.5 rounded-lg border text-[8px] font-bold transition-all ${
                  height === p.h
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
            min="0.3"
            max="1.5"
            step="0.05"
            value={height}
            onChange={(e) => setHeight(parseFloat(e.target.value))}
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

        {/* Results Card */}
        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Footprints size={80} className="text-[#F5C518]" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest text-center">TAHMİNİ HIZ (ÇARPIŞMA ANI)</div>
            <div className="text-center">
              <span className="text-6xl font-black text-white tracking-tighter">{Math.round(vMid)}</span>
              <span className="text-sm font-bold text-[#F5C518] ml-2 italic">KM/S</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold text-gray-400">
              <span className="text-gray-600">ALT</span>
              <span>{Math.round(vMin)}</span>
              <span className="text-gray-600">—</span>
              <span>{Math.round(vMax)}</span>
              <span className="text-gray-600">ÜST KM/S</span>
            </div>

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

        <ForensicReportPreview text={reportText} report={report} />

        <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl flex gap-3 items-start">
          <AlertTriangle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-orange-200">ADLİ ANALİZ NOTU</p>
            <p className="text-[8px] text-gray-500 leading-relaxed italic">
              Searle yöntemi hız için olasılık bandı verir; mutlak değer değildir. Fırlatma
              mesafesi ölçülürken yayanın yuvarlanma ve sürtünme izlerinin bitiş noktası esas
              alınmalı, çarpışma noktası ise iz ve hasar analizinden doğrulanmalıdır.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
