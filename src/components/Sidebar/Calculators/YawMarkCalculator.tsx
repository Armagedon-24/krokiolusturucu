import React, { useState, useEffect, useMemo } from 'react';
import { Spline, Info, PlusCircle, AlertTriangle } from 'lucide-react';
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

type RadiusMode = 'direct' | 'chord';

/** Kiriş (C) ve orta tepe (M) ölçüsünden yay yarıçapı: R = C²/(8M) + M/2 */
const radiusFromChord = (c: number, m: number) => (c * c) / (8 * m) + m / 2;

export const YawMarkCalculator: React.FC = () => {
  const [radiusMode, setRadiusMode] = useState<RadiusMode>('chord');
  const [radius, setRadius] = useState<number>(50);
  const [chord, setChord] = useState<number>(30);
  const [midOrd, setMidOrd] = useState<number>(2.3);
  const [mu, setMu] = useState<number>(0.75);
  const [grade, setGrade] = useState<number>(0); // % — süperelevasyon (+ içe bakımlı)
  const [speed, setSpeed] = useState<number>(0);
  const [speedMin, setSpeedMin] = useState<number>(0);
  const [speedMax, setSpeedMax] = useState<number>(0);

  const { addObject } = useStore();

  const calcR = useMemo(
    () => (radiusMode === 'direct' ? radius : midOrd > 0 ? radiusFromChord(chord, midOrd) : 0),
    [radiusMode, radius, chord, midOrd],
  );

  useEffect(() => {
    const fEff = Math.max(0.02, mu + grade / 100);
    if (calcR > 0 && fEff > 0) {
      // v = √(g·R·f) m/s → ×3.6 km/s
      const calc = (r: number, m: number) => Math.sqrt(9.81 * r * m) * 3.6;
      setSpeed(calc(calcR, fEff));

      // Yarıçap aralığı: doğrudan girişte ±%5; kiriş modunda C±%5, M±%5 uçları
      let rMin: number, rMax: number;
      if (radiusMode === 'direct') {
        rMin = calcR * 0.95;
        rMax = calcR * 1.05;
      } else {
        rMin = Math.min(radiusFromChord(chord * 0.95, midOrd * 1.05), radiusFromChord(chord * 1.05, midOrd * 1.05));
        rMax = Math.max(radiusFromChord(chord * 1.05, midOrd * 0.95), radiusFromChord(chord * 0.95, midOrd * 0.95));
      }
      const muMin = Math.max(0.05, mu - 0.05);
      const muMax = Math.min(1.0, mu + 0.05);
      const candidates = [
        calc(rMin, Math.max(0.02, muMin + grade / 100)),
        calc(rMin, Math.max(0.02, muMax + grade / 100)),
        calc(rMax, Math.max(0.02, muMin + grade / 100)),
        calc(rMax, Math.max(0.02, muMax + grade / 100)),
      ];
      setSpeedMin(Math.min(...candidates));
      setSpeedMax(Math.max(...candidates));
    } else {
      setSpeed(0);
      setSpeedMin(0);
      setSpeedMax(0);
    }
  }, [calcR, radiusMode, chord, midOrd, mu, grade]);

  const report = useMemo(() => {
    const rTxt =
      radiusMode === 'direct'
        ? `Yay yarıçapı (saha ölçümü): R = ${trNum(calcR, 1)} m (ölçüm payı ±%5)`
        : `Kiriş/orta tepe ölçüsü: C = ${trNum(chord, 1)} m, M = ${trNum(midOrd, 2)} m → R = C²/(8M) + M/2 = ${trNum(calcR, 1)} m`;
    return {
      title: 'YAYILMA (YAW) İZİ — KRİTİK HIZ İNCELEMESİ',
      topic: 'Kaza yerinde tespit edilen yayılma (yaw) izi yarıçapı ile zemin sürtünme katsayısından hareketle, aracın virajda kaymanın başladığı andaki (kritik) hızının adli teknik yönden değerlendirilmesi.',
      evidence: [
        rTxt,
        `Zemin tipi/katsayısı: μ=${mu.toFixed(2)} (katsayı belirsizliği ±0.05)`,
        `Viraj eğimi (süperelevasyon): %${trNum(grade, 0)} (etkin katsayı f = μ ± e)`,
      ],
      method: [
        'Kritik hız denklemi: v = √(g·R·f) [m/s]; pratik form km/s cinsinden uygulandı (g = 9.81 m/s²).',
        radiusMode === 'chord'
          ? 'Yarıçap, sahadaki kiriş–orta tepe (chord / mid-ordinate) yöntemiyle hesaplanmıştır: R = C²/(8M) + M/2.'
          : 'Yarıçap, sahadaki doğrudan ölçüm değeri olarak alınmıştır.',
        'Belirsizlik analizi: μ±0.05 ile yarıçap ölçüm uç değerlerinin tüm kombinasyonlarıyla min–max hız hesaplanmıştır.',
      ],
      findings: [
        `Hesaplanan yay yarıçapı: R = ${trNum(calcR, 1)} m`,
        `Etkin sürtünme katsayısı: f = ${fEffStr(mu, grade)}`,
        `Kritik hız (kayma başlangıcı): ${trNum(speed, 0)} km/s`,
        `Muhtemel hız aralığı: ${trNum(speedMin, 0)} – ${trNum(speedMax, 0)} km/s`,
      ],
      scenarios: [
        'Kritik hız, virajda yandan kaymanın başladığı alt eşiktir; gerçek hız bu değerin üzerindeyse araç kaymıştır.',
        'Yaw izine frenleme eşlik ediyorsa iz yapısı değişir → sonuç yalnızca serbest kayma izleri için geçerlidir.',
        'Yarıçap, izin orta bölgesinden ve direksiyon açısının sabit olduğu kısımdan ölçülmelidir; kısa/parçalı izler R\'yi yanıltabilir.',
        'Kiriş uzunluğunun iz yayının tamamına yakın seçilmesi yarıçapı küçültür → hız düşük hesaplanabilir.',
        'Süperelevasyon bilinmiyorsa %0 alınmalıdır; bu durumda sonuç alt/üst sınır olarak yorumlanmalıdır.',
        'Lastik basıncı, yük dağılımı ve süspansiyon durumu etkili katsayıyı değiştirebilir.',
        'Çift eksenli izlerde (iki lastik çifti farklı yay) her yay için ayrı hesap yapılmalıdır.',
        'Islak zeminde hidroplanaj etkisi yerel katsayıyı düşürür → üst aralık sınırı daha temsili olabilir.',
      ],
      conclusion: [
        `İnceleme sonucunda aracın virajda kaymanın başladığı andaki kritik hızının ${trNum(speed, 0)} km/s, ölçüm belirsizlikleri hesaba katıldığında ${trNum(speedMin, 0)} – ${trNum(speedMax, 0)} km/s aralığında bulunduğu kanaatine varılmıştır.`,
        'Kesin değere ilişkin sağlam kanıt, zeminde yapılacak çekme (drag) testi veya araç EDR verisidir.',
      ],
      caveats: [
        'Sonuç; iz yarıçapı ve μ ölçümlerinin saha doğruluğuna bağımlıdır.',
        'Kritik hız modeli, tek araç-serbest kayma varsayımına dayanır; yük aktarımı ve lastik karakteristikleri modellenmemiştir.',
        'Eğim, zemin kirliği ve lastik durumu için manuel düzeltme yapılmadıkça sonuç yerel doğruluk taşır.',
      ],
    };
  }, [speed, speedMin, speedMax, calcR, radiusMode, chord, midOrd, mu, grade]);
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
        title="Yayılma (Yaw) İzi — Kritik Hız"
        description="Virajda oluşan yayılma izlerinin yarıçapından aracın kaymaya başladığı (kritik) hızını hesaplar."
        formula="v = sqrt(g * R * (μ ± e))  ·  R = C²/(8M) + M/2"
        usage="Yarıçapı doğrudan girin veya sahadaki kiriş (C) ve orta tepe (M) ölçülerini girin. Viraj eğimi (süperelevasyon) biliniyorsa yüzde olarak işaretleyin."
      />
      <div className="space-y-4 p-1">
        {/* Yarıçap girişi */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Yarıçap Yöntemi
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setRadiusMode('chord')}
              className={`px-3 py-2 rounded-xl border text-[9px] font-black transition-all ${
                radiusMode === 'chord'
                  ? 'bg-[#F5C518] border-[#F5C518] text-black shadow-lg shadow-[#F5C518]/20'
                  : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:border-gray-600'
              }`}
            >
              KİRİŞ + ORTA TEPE
            </button>
            <button
              onClick={() => setRadiusMode('direct')}
              className={`px-3 py-2 rounded-xl border text-[9px] font-black transition-all ${
                radiusMode === 'direct'
                  ? 'bg-[#F5C518] border-[#F5C518] text-black shadow-lg shadow-[#F5C518]/20'
                  : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:border-gray-600'
              }`}
            >
              DOĞRUDAN YARIÇAP
            </button>
          </div>
          {radiusMode === 'chord' ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[8px] font-bold text-gray-600 uppercase block mb-1">Kiriş C (m)</label>
                <input type="number" value={chord} onChange={(e) => setChord(Math.max(0, Number(e.target.value)))} className={inputCls} />
              </div>
              <div>
                <label className="text-[8px] font-bold text-gray-600 uppercase block mb-1">Orta Tepe M (m)</label>
                <input type="number" value={midOrd} step="0.01" onChange={(e) => setMidOrd(Math.max(0, Number(e.target.value)))} className={inputCls} />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[8px] font-bold text-gray-600 uppercase block mb-1">Yay Yarıçapı R (m)</label>
              <input type="number" value={radius} onChange={(e) => setRadius(Math.max(0, Number(e.target.value)))} className={inputCls} />
            </div>
          )}
        </div>

        {/* Sürtünme katsayısı */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Spline size={12} className="text-[#F5C518]" />
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

        {/* Süperelevasyon */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Viraj Eğimi (Süperelevasyon): %{grade > 0 ? '+' : ''}{grade}
          </label>
          <input
            type="range"
            min="-10"
            max="10"
            step="1"
            value={grade}
            onChange={(e) => setGrade(parseInt(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
          />
          <p className="text-[8px] text-gray-600 italic">
            * İçe bakımlı (yukarı) eğim pozitif alınır. Bilinmiyorsa %0 bırakınız.
          </p>
        </div>

        {/* Results Card */}
        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Spline size={80} className="text-[#F5C518]" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest text-center">KRİTİK HIZ (KAYMA BAŞLANGICI)</div>
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
              Kritik hız, virajda yandan kaymanın başladığı alt eşiktir. Yarıçap ölçüsü izin orta
              bölgesinden, direksiyon açısının sabit olduğu kısımdan alınmalıdır; frenleme veya
              hızlanma eşliğinde oluşan izlerde model geçersizdir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Etkin katsayı metni: f = μ + e/100 */
function fEffStr(mu: number, grade: number): string {
  const f = Math.max(0.02, mu + grade / 100);
  return grade === 0 ? `${f.toFixed(2)}` : `${f.toFixed(2)} (μ ${grade > 0 ? '+' : '−'} ${Math.abs(grade / 100).toFixed(2)})`;
}
