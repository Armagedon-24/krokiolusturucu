import React, { useState, useMemo } from 'react';
import { Table2, Info, PlusCircle, AlertTriangle } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';
import { formatForensicReport, formatForensicSummary, trNum } from '../../../utils/forensicReport';
import { ForensicReportPreview, ForensicPdfButton } from '../../UI/ForensicReportPreview';

/** Adli kaza rekonstrüksiyonu literatüründe yaygın kabul gören tipik μ aralıkları. */
const FRICTION_TABLE: Array<{ id: string; name: string; min: number; max: number; typ: number }> = [
  { id: 'asphalt_dry', name: 'Asfalt — Kuru', min: 0.7, max: 0.85, typ: 0.75 },
  { id: 'asphalt_wet', name: 'Asfalt — Islak', min: 0.4, max: 0.65, typ: 0.5 },
  { id: 'concrete_dry', name: 'Beton — Kuru', min: 0.8, max: 0.95, typ: 0.85 },
  { id: 'concrete_wet', name: 'Beton — Islak', min: 0.55, max: 0.75, typ: 0.6 },
  { id: 'gravel', name: 'Çakıl Yol', min: 0.4, max: 0.7, typ: 0.55 },
  { id: 'dirt_dry', name: 'Toprak Yol — Kuru', min: 0.5, max: 0.7, typ: 0.6 },
  { id: 'dirt_wet', name: 'Toprak/Çamur — Islak', min: 0.3, max: 0.5, typ: 0.4 },
  { id: 'grass', name: 'Çim / Kenar Zemin', min: 0.35, max: 0.55, typ: 0.45 },
  { id: 'snow', name: 'Kar (Sıkışmış)', min: 0.15, max: 0.3, typ: 0.2 },
  { id: 'ice', name: 'Buz', min: 0.05, max: 0.15, typ: 0.1 },
];

export const FrictionTableCalculator: React.FC = () => {
  const [surfaceId, setSurfaceId] = useState<string>(FRICTION_TABLE[0].id);
  const [mu, setMu] = useState<number>(FRICTION_TABLE[0].typ);
  const [speed, setSpeed] = useState<number>(90); // frenleme mesafesi ön hesabı için hız

  const surface = FRICTION_TABLE.find((s) => s.id === surfaceId)!;

  const { addObject, addNotification } = useStore();

  const selectSurface = (id: string) => {
    setSurfaceId(id);
    const s = FRICTION_TABLE.find((x) => x.id === id);
    if (s) setMu(s.typ);
  };

  const braking = useMemo(() => {
    if (speed <= 0) return { dMin: 0, dTyp: 0, dMax: 0 };
    const d = (m: number) => (speed * speed) / (254 * m);
    return { dMin: d(surface.max), dTyp: d(surface.typ), dMax: d(surface.min) };
  }, [speed, surface]);

  const report = useMemo(
    () => ({
      title: 'ZEMİN SÜRTÜNME KATSAYISI (μ) DEĞERLENDİRMESİ',
      topic: 'Kaza yerindeki zemin tipi ve yüzey durumuna ilişkin tipik sürtünme katsayısı aralığının belirlenmesi ve seçilen hız değerinde frenleme mesafesinin adli teknik yönden ön hesaplanması.',
      evidence: [
        `Zemin tipi / yüzey durumu: ${surface.name}`,
        `Literatür tipik aralığı: μ = ${surface.min.toFixed(2)} – ${surface.max.toFixed(2)} (orta değer ${surface.typ.toFixed(2)})`,
        `Ön hesap için seçilen hız: ${trNum(speed, 0)} km/s`,
      ],
      method: [
        'Katsayı aralıkları, adli kaza rekonstrüksiyonu literatüründe yaygın kabul gören tipik μ tablolarından derlenmiştir.',
        'Frenleme mesafesi ön hesabı: d = v² / (254·μ) [v km/s, d metre] — %100 fren verimi varsayımıyla.',
        'Aralığın alt ve üst uçlarıyla frenleme mesafeleri ayrı ayrı hesaplanmıştır.',
      ],
      findings: [
        `Önerilen katsayı aralığı: μ = ${surface.min.toFixed(2)} – ${surface.max.toFixed(2)} (orta değer ${surface.typ.toFixed(2)})`,
        `${trNum(speed, 0)} km/s hız için frenleme mesafesi: μ_min ile ${trNum(braking.dMax, 1)} m, orta değer ile ${trNum(braking.dTyp, 1)} m, μ_max ile ${trNum(braking.dMin, 1)} m`,
        'Değerler; kuru/temiz tekerlek, kilitli frenleme ve düz yol varsayımına aittir.',
      ],
      scenarios: [
        'Yüzey kirliliği (toz, çamur, yaprak, yağ) yerel μ\'yu belirgin düşürebilir; saha fotoğraflarıyla doğrulanmalıdır.',
        'İlk yağmur sonrası polisleşmiş asfaltta kayganlık artar → alt aralık sınırı daha temsili olabilir.',
        'Yerel μ, sahadaki çekme (drag) testi veya radar/EDR destekli frenleme testiyle kesinleştirilmelidir.',
        'Farklı lastik tipi/diş derinliği katsayıyı değiştirir; ağır vasıtada etkin katsayı daha düşüktür.',
        'Kar/buz tabakasının kalınlığı ve sıcaklık, aralığın hangi ucunun temsili olduğunu belirler.',
        'Eğimli yollarda etkin katsayıya eğim bileşeni (±sinθ) eklenmelidir.',
      ],
      conclusion: [
        `Kaza yerindeki ${surface.name.toLowerCase()} zemin için tipik sürtünme katsayısının μ = ${surface.min.toFixed(2)} – ${surface.max.toFixed(2)} aralığında, orta değer olarak ${surface.typ.toFixed(2)} alınmasının uygun olacağı değerlendirilmiştir.`,
        `${trNum(speed, 0)} km/s hız için %100 verimli frenlemede durma mesafesi orta değerle yaklaşık ${trNum(braking.dTyp, 1)} m, tam aralıkla ${trNum(braking.dMin, 1)} – ${trNum(braking.dMax, 1)} m arasındadır.`,
        'Kesin katsayı için sahada çekme (drag) testi yapılması önerilir.',
      ],
      caveats: [
        'Tablo değerleri literatürden derlenen tipik aralıklardır; kesin değer değildir.',
        'Sonuç; zemin tipi tespitinin ve yüzey durumunun doğru belgelenmesine bağımlıdır.',
        'Hava olayı kayıtları (yağmur/kar zaman çizelgesi) ile olay saati karşılaştırılmalıdır.',
      ],
    }),
    [surface, speed, braking],
  );
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
        title="Zemin Sürtünme Katsayısı (μ) Referansı"
        description="Zemin tipine göre tipik μ aralıklarını gösterir; seçilen hız için frenleme mesafesini ön hesaplar."
        formula="d = v² / (254 · μ)"
        usage="Zemin tipini/yüzey durumunu tablodan seçin — katsayı aralığı ve orta değer otomatik gelir. Hız girerseniz frenleme mesafesi ön hesabı rapora işlenir."
      />
      <div className="space-y-4 p-1">
        {/* Zemin seçimi */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Table2 size={12} className="text-[#F5C518]" />
            Zemin Tipi / Yüzey Durumu
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {FRICTION_TABLE.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSurface(s.id)}
                className={`px-2 py-2 rounded-xl border text-[8px] font-black transition-all ${
                  surfaceId === s.id
                    ? 'bg-[#F5C518] border-[#F5C518] text-black shadow-lg shadow-[#F5C518]/20'
                    : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:border-gray-600'
                }`}
              >
                {s.name.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Seçili katsayı */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Katsayı (μ): {mu.toFixed(2)} — Aralık {surface.min.toFixed(2)} – {surface.max.toFixed(2)}
          </label>
          <input
            type="range"
            min={surface.min}
            max={surface.max}
            step="0.01"
            value={mu}
            onChange={(e) => setMu(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
          />
          <p className="text-[8px] text-gray-600 italic">
            * Orta değer önerilir; saha çekme (drag) testi varsa ölçülen değer kullanılmalıdır.
          </p>
        </div>

        {/* Hız girdisi */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Frenleme Mesafesi Ön Hesabı — Hız (km/s)
          </label>
          <div className="relative">
            <input type="number" value={speed} onChange={(e) => setSpeed(Math.max(0, Number(e.target.value)))} className={inputCls} />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">KM/S</span>
          </div>
        </div>

        {/* Referans tablo */}
        <div className="bg-[#141414] border border-[#333] rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 bg-[#1a1a1a] text-[8px] font-black text-gray-400 uppercase tracking-widest border-b border-[#333] flex justify-between">
            <span>Zemin</span>
            <span>μ Tipik Aralık</span>
          </div>
          {FRICTION_TABLE.map((s) => (
            <button
              key={s.id}
              onClick={() => selectSurface(s.id)}
              className={`w-full flex items-center justify-between px-4 py-2 text-[9px] font-bold border-b border-[#222] last:border-0 transition-colors ${
                surfaceId === s.id ? 'bg-[#F5C518]/10 text-[#F5C518]' : 'text-gray-500 hover:bg-white/5'
              }`}
            >
              <span>{s.name}</span>
              <span className="font-mono">
                {s.min.toFixed(2)} – {s.max.toFixed(2)}
              </span>
            </button>
          ))}
        </div>

        {/* Results Card */}
        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Table2 size={80} className="text-[#F5C518]" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest text-center">SEÇİLİ ZEMİN — μ DEĞERİ</div>
            <div className="text-center">
              <span className="text-6xl font-black text-white tracking-tighter">{mu.toFixed(2)}</span>
              <span className="text-sm font-bold text-[#F5C518] ml-2 italic">μ</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold text-gray-400">
              <span className="text-gray-600">{trNum(speed, 0)} KM/S →</span>
              <span>{trNum(braking.dTyp, 1)} M</span>
              <span className="text-gray-600">FRENLEME</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[8px] font-mono font-bold text-gray-500">
              <span className="text-gray-600">ARALIK</span>
              <span>{trNum(braking.dMin, 1)} M</span>
              <span className="text-gray-600">—</span>
              <span>{trNum(braking.dMax, 1)} M</span>
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

        <ForensicReportPreview text={reportText} summaryText={summaryText} report={report} />

        <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl flex gap-3 items-start">
          <AlertTriangle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-orange-200">ADLİ ANALİZ NOTU</p>
            <p className="text-[8px] text-gray-500 leading-relaxed italic">
              Tablo değerleri literatürden derlenen tipik aralıklardır; kesin değer değildir.
              Bilirkişi raporlarında katsayının gerekçelendirilebilmesi için saha çekme (drag)
              testi veya EDR destekli frenleme verisi önerilir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
