import React, { useState, useEffect, useMemo } from 'react';
import { Hammer, Info, PlusCircle, AlertTriangle } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';
import { formatForensicReport, formatForensicSummary, trNum } from '../../../utils/forensicReport';
import { ForensicReportPreview, ForensicPdfButton } from '../../UI/ForensicReportPreview';

/** CRASH3 yaklaşımı — araç sınıfı rijitlik katsayısı ön ayarları (kullanıcı düzeltebilir). */
const STIFFNESS_PRESETS = [
  { id: 'compact', name: 'Küçük Sınıf', A: 350, B: 32 },
  { id: 'mid', name: 'Orta Sınıf', A: 450, B: 45 },
  { id: 'large', name: 'Büyük / SUV', A: 550, B: 55 },
  { id: 'ltv', name: 'Hafif Ticari', A: 500, B: 50 },
];

export const CrushEnergyCalculator: React.FC = () => {
  const [presetId, setPresetId] = useState<string>('mid');
  const [stiffA, setStiffA] = useState<number>(STIFFNESS_PRESETS[1].A);
  const [stiffB, setStiffB] = useState<number>(STIFFNESS_PRESETS[1].B);
  const [width, setWidth] = useState<number>(120); // hasar genişliği L (cm)
  const [crush, setCrush] = useState<number>(25); // ortalama deformasyon derinliği c̄ (cm)
  const [mass, setMass] = useState<number>(1400); // araç kütlesi (kg)
  const [energyKJ, setEnergyKJ] = useState<number>(0);
  const [ebs, setEbs] = useState<number>(0);
  const [ebsMin, setEbsMin] = useState<number>(0);
  const [ebsMax, setEbsMax] = useState<number>(0);

  const preset = STIFFNESS_PRESETS.find((p) => p.id === presetId)!;

  const { addObject, addNotification } = useStore();

  useEffect(() => {
    const p = STIFFNESS_PRESETS.find((x) => x.id === presetId);
    if (p) {
      setStiffA(p.A);
      setStiffB(p.B);
    }
  }, [presetId]);

  useEffect(() => {
    if (width > 0 && crush > 0 && mass > 0) {
      // CRASH3: E = L·(A·c̄ + B·c̄²/2) [N·cm] → J = ÷100
      const calcE = (l: number, c: number, a: number, b: number) => (l * (a * c + (b * c * c) / 2)) / 100; // J
      const E = calcE(width, crush, stiffA, stiffB);
      setEnergyKJ(E / 1000);
      // EBS = √(2E/m) [m/s] → ×3.6 km/s
      const calcEbs = (Ej: number, m: number) => Math.sqrt((2 * Ej) / m) * 3.6;
      setEbs(calcEbs(E, mass));
      // Belirsizlik: c̄ ±%10, katsayı ±%10 → uç kombinasyonlar
      const corners = [
        calcE(width * 0.9, crush * 0.9, stiffA * 0.9, stiffB * 0.9),
        calcE(width * 0.9, crush * 1.1, stiffA * 1.1, stiffB * 1.1),
        calcE(width * 1.1, crush * 0.9, stiffA * 0.9, stiffB * 0.9),
        calcE(width * 1.1, crush * 1.1, stiffA * 1.1, stiffB * 1.1),
      ];
      const ebsList = corners.map((Ej) => calcEbs(Ej, mass));
      setEbsMin(Math.min(...ebsList));
      setEbsMax(Math.max(...ebsList));
    } else {
      setEnergyKJ(0);
      setEbs(0);
      setEbsMin(0);
      setEbsMax(0);
    }
  }, [width, crush, mass, stiffA, stiffB]);

  const report = useMemo(
    () => ({
      title: 'DEFORMASYON (CRUSH) ENERJİSİ İNCELEMESİ',
      topic: 'Araç gövdesinde oluşan kalıcı deformasyon ölçülerinden hareketle, çarpışmada emilen enerjinin ve eşdeğer bariyer hızının (EBS) adli teknik yönden hesaplanması ve değerlendirilmesi.',
      evidence: [
        `Hasar genişliği (deformasyon boyu): L = ${trNum(width, 0)} cm`,
        `Ortalama deformasyon derinliği: c̄ = ${trNum(crush, 1)} cm`,
        `Araç sınıfı: ${preset.name} — rijitlik katsayıları A = ${trNum(stiffA, 0)} N/cm, B = ${trNum(stiffB, 0)} N/cm²`,
        `Araç kütlesi (boş + yük): ${trNum(mass, 0)} kg`,
      ],
      method: [
        'CRASH3 deformasyon enerjisi modeli: E = L·(A·c̄ + B·c̄²/2) [N·cm → J].',
        'Eşdeğer bariyer hızı (EBS): EBS = √(2·E/m) [m/s → km/s] — düz sabit bariyere eşdeğer çarpışma hızı.',
        'Belirsizlik analizi: derinlik ve katsayı uç değerlerinin (±%10) kombinasyonlarıyla min–max aralık hesaplanmıştır.',
      ],
      findings: [
        `Emilen deformasyon enerjisi: ${trNum(energyKJ, 1)} kJ`,
        `Eşdeğer bariyer hızı (EBS): ${trNum(ebs, 0)} km/s`,
        `Muhtemel EBS aralığı: ${trNum(ebsMin, 0)} – ${trNum(ebsMax, 0)} km/s`,
        'EBS; araç kütlesine odaklanmış tekil enerji değerlendirmesidir ve doğrudan çarpışma hızına eşit değildir.',
      ],
      scenarios: [
        'Deformasyon heterojen ise (uzun/kısa boylu hasar) ortalama derinlik yerine profil entegrasyonu gerekir → nokta değer yanıltıcı olabilir.',
        'Hareketli iki araç çarpışmasında EBS yalnızca tek araca ait enerjiyi verir; çarpışma öncesi hız için momentum korunumu ile birlikte çözüm gerekir.',
        'Hasar bölgesinde ikincil temas, yuvarlanma veya torsiyon varsa emilen enerji fazla okunabilir → EBS yüksek çıkar.',
        'Rijitlik katsayıları araç modeline ve yıllına göre değişir; tablo değerleri yerine test verisi varsa esas alınmalıdır.',
        'Motor bölgesi/yük devri bölgesi gibi rijit elemanlara temas, yerel derinliği artırır → c̄ ortalama ile dengelenmelidir.',
        'Ağır vasıtada şasi bütünlüğü deformasyonu sınırlar → EBS düşük çıkabilir.',
        'Kuvvet yönü dik olmayan çarpışmalarda kuvvet uygulama açısı (PDOF) düzeltmesi gerekir.',
      ],
      conclusion: [
        `İnceleme sonucunda aracın çarpışmada emdiği enerjinin yaklaşık ${trNum(energyKJ, 1)} kJ, buna karşılık gelen eşdeğer bariyer hızının ise ${trNum(ebs, 0)} km/s (ölçüm ve katsayı belirsizlikleriyle ${trNum(ebsMin, 0)} – ${trNum(ebsMax, 0)} km/s aralığında) bulunduğu değerlendirilmiştir.`,
        'Çarpışma öncesi hızın kesin tespiti için momentum korunumu analizi ve EDR verisi ile birlikte değerlendirme önerilir.',
      ],
      caveats: [
        'Sonuç; hasar ölçümlerinin ve seçilen rijitlik katsayılarının temsililiğine bağımlıdır.',
        'CRASH3 modeli yaklaşık bir mühendislik modelidir; mutlak hız değil büyüklük derecesi verir.',
        'Deformasyon profili çok noktalı ölçülerek değerlendirilmedikçe sonuç yerel doğruluk taşır.',
      ],
    }),
    [energyKJ, ebs, ebsMin, ebsMax, width, crush, mass, stiffA, stiffB, preset],
  );
  const reportText = useMemo(() => formatForensicReport(report), [report]);
  const summaryText = useMemo(() => formatForensicSummary(report), [report]);

  const handleAddToCanvas = () => {
    const baseX = 220;
    const baseY = 300;
    const len = 150;
    const cPx = Math.max(10, Math.min(70, crush * 0.9));

    // Duvar
    addObject({ type: 'rect', x: baseX - 2, y: baseY - 46, width: 8, height: 100, fill: '#616161' });
    // Araç gövdesi (üstten görünüm)
    addObject({ type: 'rect', x: baseX + cPx, y: baseY - 30, width: len, height: 60, cornerRadius: 6, fill: '#ECEFF1', stroke: '#546E7A', strokeWidth: 2 });
    // Deformasyon bölgesi
    addObject({ type: 'rect', x: baseX + 6, y: baseY - 30, width: cPx, height: 60, fill: '#FFCDD2', stroke: '#E53935', strokeWidth: 1.5 });
    addObject({ type: 'text', text: `c̄ = ${trNum(crush, 1)} cm`, x: baseX + 2, y: baseY + 40, width: 130, fontSize: 10, fill: '#B71C1C', fontFamily: 'Inter', fontStyle: 'bold' });
    addObject({ type: 'text', text: `L = ${trNum(width, 0)} cm · ${trNum(mass, 0)} kg`, x: baseX + cPx + 16, y: baseY - 52, width: 180, fontSize: 10, fill: '#546E7A', fontFamily: 'Inter', fontStyle: 'bold' });
    // Sonuç
    addObject({ type: 'text', text: `EBS ≈ ${trNum(ebs, 0)} km/s (${trNum(ebsMin, 0)}–${trNum(ebsMax, 0)})`, x: baseX + 30, y: baseY + 62, width: 240, fontSize: 13, fill: '#B71C1C', fontFamily: 'Inter', fontStyle: 'bold' });

    addObject({
      type: 'text',
      text: summaryText,
      x: baseX - 20,
      y: baseY + 90,
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
        title="Deformasyon (Crush) Enerjisi — CRASH3"
        description="Araç gövdesindeki kalıcı hasar ölçülerinden emilen enerjiyi ve eşdeğer bariyer hızını (EBS) hesaplar."
        formula="E = L·(A·c̄ + B·c̄²/2)  ·  EBS = √(2·E/m)"
        usage="Hasar genişliğini ve ortalama deformasyon derinliğini cm olarak girin. Araç sınıfını seçin — katsayılar otomatik gelir, gerekirse slider ile düzeltin. Kütleyi kg girin."
      />
      <div className="space-y-4 p-1">
        {/* Araç sınıfı */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Araç Sınıfı (Rijitlik Ön Ayarı)
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {STIFFNESS_PRESETS.map((p) => (
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

        {/* Hasar ölçüleri */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[8px] font-bold text-gray-600 uppercase block mb-1">Hasar Genişliği L (cm)</label>
            <input type="number" value={width} onChange={(e) => setWidth(Math.max(0, Number(e.target.value)))} className={inputCls} />
          </div>
          <div>
            <label className="text-[8px] font-bold text-gray-600 uppercase block mb-1">Ort. Derinlik c̄ (cm)</label>
            <input type="number" value={crush} step="0.5" onChange={(e) => setCrush(Math.max(0, Number(e.target.value)))} className={inputCls} />
          </div>
        </div>

        {/* Rijitlik katsayıları */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Hammer size={12} className="text-[#F5C518]" />
            A: {trNum(stiffA, 0)} N/CM · B: {trNum(stiffB, 0)} N/CM²
          </label>
          <input
            type="range"
            min="200"
            max="800"
            step="10"
            value={stiffA}
            onChange={(e) => setStiffA(parseInt(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
          />
          <input
            type="range"
            min="15"
            max="90"
            step="1"
            value={stiffB}
            onChange={(e) => setStiffB(parseInt(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
          />
          <p className="text-[8px] text-gray-600 italic">
            * Katsayılar araç sınıfı ön ayarından gelir; test verisi varsa slider ile düzeltiniz.
          </p>
        </div>

        {/* Kütle */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Araç Kütlesi (kg)
          </label>
          <div className="relative">
            <input type="number" value={mass} onChange={(e) => setMass(Math.max(0, Number(e.target.value)))} className={inputCls} />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">KG</span>
          </div>
        </div>

        {/* Results Card */}
        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Hammer size={80} className="text-[#F5C518]" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest text-center">EŞDEĞER BARİYER HIZI (EBS)</div>
            <div className="text-center">
              <span className="text-6xl font-black text-white tracking-tighter">{Math.round(ebs)}</span>
              <span className="text-sm font-bold text-[#F5C518] ml-2 italic">KM/S</span>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold text-gray-400">
              <span className="text-gray-600">ENERJİ</span>
              <span>{trNum(energyKJ, 1)} KJ</span>
              <span className="text-gray-600">·</span>
              <span className="text-gray-600">MİN</span>
              <span>{Math.round(ebsMin)}</span>
              <span className="text-gray-600">—</span>
              <span>{Math.round(ebsMax)}</span>
              <span className="text-gray-600">MAKS</span>
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
              EBS, düz sabit bariyere eşdeğer hızı ifade eder; iki araçlı çarpışmalarda çarpışma
              öncesi hız için momentum korunumu ile birlikte çözüm gerekir. Rijitlik katsayıları
              araç modeline göre değişebilir, tablo değerleri temsilidir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
