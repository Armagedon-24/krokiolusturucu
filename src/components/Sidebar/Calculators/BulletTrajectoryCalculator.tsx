import React, { useState, useEffect, useMemo } from 'react';
import { Target, Ruler, Info, PlusCircle, Crosshair, Zap, MoveVertical, MoveHorizontal, Compass, AlertTriangle } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';
import { formatForensicReport, formatForensicSummary, trNum } from '../../../utils/forensicReport';
import { ForensicReportPreview, ForensicPdfButton } from '../../UI/ForensicReportPreview';

const AMMO_TYPES = [
  { id: '9mm', name: '9mm Tabanca', v0: 380, icon: '🔫' },
  { id: '556', name: '5.56mm NATO', v0: 900, icon: '🎯' },
  { id: '762', name: '7.62mm AK/G3', v0: 715, icon: '🔥' },
  { id: 'custom', name: 'Özel Hız', v0: 500, icon: '⚙️' },
];

const MODES = [
  { id: 'height', label: 'YÜKSEKLİK BUL', sub: 'Açı + Mesafe', icon: MoveVertical },
  { id: 'distance', label: 'MESAFE BUL', sub: 'Açı + Yükseklik', icon: MoveHorizontal },
  { id: 'angle', label: 'AÇI BUL', sub: 'Mesafe + Yükseklik', icon: Compass },
] as const;

type SolveMode = typeof MODES[number]['id'];

const G = 9.81;
const rad = (a: number) => (a * Math.PI) / 180;

export const BulletTrajectoryCalculator: React.FC = () => {
  const [mode, setMode] = useState<SolveMode>('height');
  const [distance, setDistance] = useState<number>(50);
  const [angle, setAngle] = useState<number>(5);
  const [heightDiff, setHeightDiff] = useState<number>(2);
  const [ammo, setAmmo] = useState(AMMO_TYPES[0]);

  // height modu çıktıları
  const [height, setHeight] = useState<number>(0);
  const [heightMin, setHeightMin] = useState<number>(0);
  const [heightMax, setHeightMax] = useState<number>(0);
  // distance modu çıktıları
  const [distRes, setDistRes] = useState<number>(0);
  const [distMin, setDistMin] = useState<number>(0);
  const [distMax, setDistMax] = useState<number>(0);
  // angle modu çıktıları
  const [angleRes, setAngleRes] = useState<number>(0);
  const [angleMin, setAngleMin] = useState<number>(0);
  const [angleMax, setAngleMax] = useState<number>(0);
  const [feasible, setFeasible] = useState<boolean>(true);
  // ortak çıktılar
  const [bulletDrop, setBulletDrop] = useState<number>(0);
  const [flightTime, setFlightTime] = useState<number>(0);

  const { addObject, addNotification } = useStore();

  useEffect(() => {
    const v0 = ammo.v0;

    if (mode === 'height') {
      setDistRes(0); setDistMin(0); setDistMax(0);
      setAngleRes(0); setAngleMin(0); setAngleMax(0); setFeasible(true);
      if (distance > 0 && v0 > 0) {
        const r = rad(angle);
        const t = distance / (v0 * Math.cos(r));
        const drop = 0.5 * G * t * t;
        setBulletDrop(drop);
        setFlightTime(t);
        setHeight(distance * Math.tan(r) + drop);

        // Belirsizlik: açı ±1°, mesafe ±%2
        const calc = (d: number, a: number) => {
          const rr = rad(a);
          const tt = d / (v0 * Math.cos(rr));
          return d * Math.tan(rr) + 0.5 * G * tt * tt;
        };
        const combos = [
          [distance * 0.98, Math.max(0, angle - 1)],
          [distance * 1.02, Math.min(89, angle + 1)],
          [distance * 0.98, Math.min(89, angle + 1)],
          [distance * 1.02, Math.max(0, angle - 1)],
        ].map(([d, a]) => calc(d, a));
        setHeightMin(Math.min(...combos));
        setHeightMax(Math.max(...combos));
      } else {
        setBulletDrop(0); setFlightTime(0);
        setHeight(0); setHeightMin(0); setHeightMax(0);
      }
    } else if (mode === 'distance') {
      setHeight(0); setHeightMin(0); setHeightMax(0);
      setAngleRes(0); setAngleMin(0); setAngleMax(0); setFeasible(true);
      // H = D·tanθ + g·D²/(2·v₀²·cos²θ) → A·D² + tanθ·D − H = 0, A = g/(2v₀²cos²θ)
      const calc = (H: number, a: number, v: number) => {
        const r = rad(a);
        const u = Math.tan(r);
        const A = G / (2 * v * v * Math.cos(r) * Math.cos(r));
        return (-u + Math.sqrt(u * u + 4 * A * H)) / (2 * A);
      };
      if (heightDiff > 0 && v0 > 0) {
        const dMid = calc(heightDiff, angle, v0);
        setDistRes(dMid);
        const t = dMid / (v0 * Math.cos(rad(angle)));
        setBulletDrop(0.5 * G * t * t);
        setFlightTime(t);
        // Belirsizlik: v₀±%5, açı ±1°, yükseklik ±%2 → 8 uç kombinasyon
        const vs = [v0 * 0.95, v0 * 1.05];
        const as = [Math.max(0, angle - 1), Math.min(89, angle + 1)];
        const hs = [heightDiff * 0.98, heightDiff * 1.02];
        const ds: number[] = [];
        vs.forEach((v) => as.forEach((a) => hs.forEach((h) => ds.push(calc(h, a, v)))));
        setDistMin(Math.min(...ds));
        setDistMax(Math.max(...ds));
      } else {
        setBulletDrop(0); setFlightTime(0);
        setDistRes(0); setDistMin(0); setDistMax(0);
      }
    } else {
      // angle modu
      setHeight(0); setHeightMin(0); setHeightMax(0);
      setDistRes(0); setDistMin(0); setDistMax(0);
      // H = D·tanθ + k(1+tan²θ), k = g·D²/(2v₀²) → tanθ = [−D + √(D² + 4k(H−k))]/(2k)
      const calc = (D: number, H: number, v: number): number => {
        const k = (G * D * D) / (2 * v * v);
        if (H < k) return NaN; // fizibilite: yatay atışta düşmeden küçük yükseklik farkı imkânsız
        const u = (-D + Math.sqrt(D * D + 4 * k * (H - k))) / (2 * k);
        return (Math.atan(u) * 180) / Math.PI;
      };
      if (distance > 0 && v0 > 0) {
        const aMid = calc(distance, heightDiff, v0);
        setFeasible(!isNaN(aMid));
        if (!isNaN(aMid)) {
          setAngleRes(aMid);
          const t = distance / (v0 * Math.cos(rad(aMid)));
          setBulletDrop(0.5 * G * t * t);
          setFlightTime(t);
          // Belirsizlik: v₀±%5, mesafe ±%2, yükseklik ±%2 → 8 uç kombinasyon
          const vs = [v0 * 0.95, v0 * 1.05];
          const ds = [distance * 0.98, distance * 1.02];
          const hs = [heightDiff * 0.98, heightDiff * 1.02];
          const angs: number[] = [];
          vs.forEach((v) => ds.forEach((d) => hs.forEach((h) => {
            const a = calc(d, h, v);
            if (!isNaN(a)) angs.push(a);
          })));
          if (angs.length) {
            setAngleMin(Math.min(...angs));
            setAngleMax(Math.max(...angs));
          } else {
            setAngleMin(aMid); setAngleMax(aMid);
          }
        } else {
          setAngleRes(0); setAngleMin(0); setAngleMax(0);
          setBulletDrop(0); setFlightTime(0);
        }
      } else {
        setFeasible(true);
        setAngleRes(0); setAngleMin(0); setAngleMax(0);
        setBulletDrop(0); setFlightTime(0);
      }
    }
  }, [mode, distance, angle, heightDiff, ammo]);

  const report = useMemo(() => {
    const base = 'BALİSTİK TRAJEKTÖR İNCELEMESİ';
    const ammoEv = `Mühimmat: ${ammo.name} (v₀=${ammo.v0} m/s — fabrika varyasyonu ±%5)`;
    const commonScenarios = [
      'Açı ölçümü giriş deliğinin eliptikliğiyle yapılıyorsa ±2° hata mümkündür; 3D lazer tarama veya probe yöntemi hassasiyeti artırır.',
      'Ara hedef (cam, kapı, dal) veya sekmeye uğrayan mermide ölçülen açı gerçek atış yönünü yansıtmaz → sonuç geçersizdir.',
      'Hava direnci ihmal edilmiştir: uzun mesafede (>100 m) gerçek düşme daha fazla → kaynak, hesaplanandan daha yakın olabilir.',
      'Yüksek hızlı mermilerde jiroskopik stabilizasyon ve rüzgar sapması yatay yönü değiştirebilir; dikey değerlere etkisi sınırlıdır.',
      'Vuruş noktası ile namlu çıkışı arasındaki açı, mermi deformasyonu veya yalpalamadan (yaw) etkilenebilir → kısa mesafede küçük, uzun mesafede büyüyen hata.',
      'Hedef hareketliyse (taşınan vücut, araç) ölçülen açı anlık konumu yansıtır → kaynak konumu dinamik değerlendirilmelidir.',
      'Kesin kaynak konumu için en az iki farklı yüzeydeki delik/izden üç boyutlu kesişim analizi önerilir.',
    ];

    if (mode === 'height') {
      return {
        title: `${base} (KAYNAK YÜKSEKLİĞİ)`,
        topic: 'Vuruş açısı ve mermi karakteristiklerinden hareketle, atışın kaynak (namlu çıkış) konumunun adli balistik yönünden değerlendirilmesi.',
        evidence: [
          ammoEv,
          `Vuruş (trajektör) açısı: ${angle}° (ölçüm ±1°)`,
          `Hedef-izdüşüm mesafesi: ${distance} m (ölçüm ±%2)`,
        ],
        method: [
          'Doğrusal yol: H_lin = D × tan(θ).',
          'Yerçekimi düşmesi: h = ½·g·t², uçuş süresi t = D / (v₀·cos θ).',
          'Kaynak yüksekliği: H = D·tan(θ) + ½·g·(D/(v₀·cosθ))².',
          'Belirsizlik analizi: açı ±1° ve mesafe ±%2 uç kombinasyonlarıyla min–max kaynak yüksekliği hesaplanmıştır.',
        ],
        findings: [
          `Kaynak yüksekliği: ${trNum(height, 2)} m — muhtemel aralık ${trNum(heightMin, 2)} – ${trNum(heightMax, 2)} m`,
          `Balistik düşme (bullet drop): ${trNum(bulletDrop * 100, 1)} cm`,
          `Uçuş süresi: ${trNum(flightTime, 3)} sn`,
        ],
        scenarios: commonScenarios,
        conclusion: [
          `İnceleme sonucunda atışın kaynak noktasının, hedefe göre yaklaşık ${trNum(height, 2)} m yükseklikte (${trNum(heightMin, 2)} – ${trNum(heightMax, 2)} m aralığında) bulunduğu kanaatine varılmıştır.`,
          'Atış yönünün kesin tespiti için saha rekonstrüksiyonu, delik/iz fotoğrafları ve mümkünse GSR/paraketon analizleriyle birlikte değerlendirme yapılmalıdır.',
        ],
        caveats: [
          'Hesap vakum ortamı ve sabit v₀ varsayımıyla tek boyutlu düzlemde yapılmıştır.',
          'Sekme, ara hedef veya mermi parçalanması saptanmışsa bu hesap kullanılmamalıdır.',
          'Sonuç gösterge niteliğindedir; nihai kanaat saha incelemesi ve laboratuvar bulgularıyla desteklenmelidir.',
        ],
      };
    }

    if (mode === 'distance') {
      return {
        title: `${base} (ATIŞ MESAFESİ)`,
        topic: 'Namlu çıkışı ile vuruş noktası arasındaki yükseklik farkı ve trajektör açısından hareketle, atış mesafesinin adli balistik yönünden tahmin edilmesi.',
        evidence: [
          ammoEv,
          `Vuruş (trajektör) açısı: ${angle}° (ölçüm ±1°)`,
          `Yükseklik farkı (namlu çıkışı − vuruş noktası): ${trNum(heightDiff, 2)} m (ölçüm ±%2)`,
        ],
        method: [
          'Ters çözüm: A·D² + tanθ·D − H = 0 ikinci derece denkleminin pozitif kökü; A = g / (2·v₀²·cos²θ).',
          'D = [−tanθ + √(tan²θ + 4·A·H)] / (2·A) — yükselen dal hariç, düşen (vuruş) dalı esas alınmıştır.',
          'Belirsizlik analizi: v₀ ±%5, açı ±1° ve yükseklik ±%2 uç değerlerinin 8 kombinasyonuyla min–max mesafe hesaplanmıştır.',
        ],
        findings: [
          `Atış mesafesi: ${trNum(distRes, 1)} m — muhtemel aralık ${trNum(distMin, 1)} – ${trNum(distMax, 1)} m`,
          `Bu mesafede balistik düşme: ${trNum(bulletDrop * 100, 1)} cm`,
          `Uçuş süresi: ${trNum(flightTime, 3)} sn`,
        ],
        scenarios: [
          'Yükseklik farkı, vuruş noktası zemin seviyesinden yüksekse namlu çıkış yüksekliği varsayımına (omuz ~1,4–1,5 m) dayanır; H doğrudan ölçülerek girilmelidir.',
          'Aynı açı ve yükseklik için açı ölçümündeki ±1° hata, mesafede orantısız büyüyen hataya yol açar (küçük açılarda duyarlılık yüksektir).',
          'v₀ bilinmiyorsa mermi tipi/kartuş varsayımı mesafeyi belirgin kaydırır; kovan/çapa bulgularıyla mühimmat doğrulanmalıdır.',
          ...commonScenarios,
        ],
        conclusion: [
          `İnceleme sonucunda atışın, vuruş noktasından ${trNum(distRes, 1)} m (ölçüm belirsizlikleriyle ${trNum(distMin, 1)} – ${trNum(distMax, 1)} m aralığında) uzaklıktaki bir kaynaktan geldiği kanaatine varılmıştır.`,
          'Mesafenin kesinleştirilmesi için aynı trajektör üzerindeki ikinci bir delik/izden teyit hesabı ve saha rekonstrüksiyonu önerilir.',
        ],
        caveats: [
          'Hesap vakum ortamı ve sabit v₀ varsayımıyla tek boyutlu düzlemde yapılmıştır.',
          'Sekme, ara hedef veya mermi parçalanması saptanmışsa bu hesap kullanılmamalıdır.',
          'Sonuç gösterge niteliğindedir; nihai kanaat saha incelemesi ve laboratuvar bulgularıyla desteklenmelidir.',
        ],
      };
    }

    // angle modu
    return {
      title: `${base} (ATIŞ AÇISI)`,
      topic: 'Vuruş noktası ile namlu çıkışı arasındaki yükseklik farkı ve mesafeden hareketle, atış (teressübat) açısının adli balistik yönünden hesaplanması.',
      evidence: [
        ammoEv,
        `Hedef-izdüşüm mesafesi: ${distance} m (ölçüm ±%2)`,
        `Yükseklik farkı (namlu çıkışı − vuruş noktası): ${trNum(heightDiff, 2)} m (ölçüm ±%2)`,
      ],
      method: [
        'Ters çözüm: H = D·tanθ + g·D²/(2·v₀²·cos²θ) denkleminin u = tanθ için çözümü.',
        'tanθ = [−D + √(D² + 4·k·(H−k))] / (2·k), burada k = g·D²/(2·v₀²) (yatay atış düşmesi).',
        'Fizibilite koşulu: H ≥ k; aksi hâlde verilen mesafede ve v₀ ile bu yükseklik farkına ulaşan bir atış açısı yoktur.',
        'Belirsizlik analizi: v₀ ±%5, mesafe ±%2 ve yükseklik ±%2 uç değerlerinin mümkün kombinasyonlarıyla min–max açı hesaplanmıştır.',
      ],
      findings: feasible
        ? [
            `Hesaplanan atış açısı: ${trNum(angleRes, 2)}° — muhtemel aralık ${trNum(angleMin, 2)}° – ${trNum(angleMax, 2)}°`,
            `Bu açıdaki balistik düşme: ${trNum(bulletDrop * 100, 1)} cm`,
            `Uçuş süresi: ${trNum(flightTime, 3)} sn`,
          ]
        : [
            'Girilen değerlerle çözüm kümesi BOŞ: yükseklik farkı, yatay atışta oluşacak düşmeden (k) küçük.',
            `Fizibilite eşiği k = g·D²/(2·v₀²) ≈ ${trNum((G * distance * distance) / (2 * ammo.v0 * ammo.v0), 2)} m; en az bu kadar yükseklik farkı gerekir.`,
            'Vuruş noktasının namludan yüksekte olduğu veya mesafe/mühimmat bilgisinin hatalı olduğu değerlendirilmektedir.',
          ],
      scenarios: [
        'Atış açısı, mermi ara hedeften geçtiyse veya sektiyse gerçek açıyı yansıtmaz; ölçüm yalnızca doğrudan vuruşta geçerlidir.',
        'Bulunan açı alçak (gerçek) atış dalıdır; aynı hedefe ulaşan teorik yüksek açı (havada tavan yapan) denklemin ikinci kökü olup adli sahada ayırt edici değildir.',
        'H < k fizibilite ihlali, çoğu kez vuruş noktası yüksekliğinin yanlış referanstan ölçülmesinden (zemin yerine tavan) kaynaklanır.',
        ...commonScenarios,
      ],
      conclusion: feasible
        ? [
            `İnceleme sonucunda atışın yatayla yaklaşık ${trNum(angleRes, 2)}°'lik teressübat açısıyla (${trNum(angleMin, 2)}° – ${trNum(angleMax, 2)}° aralığında) yapıldığı kanaatine varılmıştır.`,
            'Açının kesinleştirilmesi için delik eliptikliğinin 3D ölçümü ve ikinci bir iz noktasıyla teyit önerilir.',
          ]
        : [
            'Girilen parametrelerle fiziksel olarak mümkün bir atış açısı hesaplanamamıştır; girdiler (mesafe, yükseklik farkı, mühimmat) yeniden doğrulanmalıdır.',
          ],
      caveats: [
        'Hesap vakum ortamı ve sabit v₀ varsayımıyla tek boyutlu düzlemde yapılmıştır.',
        'Sekme, ara hedef veya mermi parçalanması saptanmışsa bu hesap kullanılmamalıdır.',
        'Sonuç gösterge niteliğindedir; nihai kanaat saha incelemesi ve laboratuvar bulgularıyla desteklenmelidir.',
      ],
    };
  }, [mode, ammo, angle, distance, heightDiff, height, heightMin, heightMax, distRes, distMin, distMax, angleRes, angleMin, angleMax, feasible, bulletDrop, flightTime]);

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
  const labelCls = 'text-[10px] font-bold uppercase flex items-center gap-2 text-gray-400';

  return (
    <div className="space-y-6 p-1 relative">
      <HelpTooltip
        title="Balistik Trajektör (3 Mod)"
        description="Açı, mesafe ve yükseklik farkından bilinen iki değeri girip üçüncüsünü hesaplar: kaynak yüksekliği, atış mesafesi veya atış açısı. Yerçekimi düşmesi (bullet drop) tüm modlarda hesaba katılır."
        formula="H = D·tan(θ) + 0.5·g·(D/V₀·cosθ)² — ters çözümler: D ve θ için ikinci derece denklem kökleri"
        usage="Önce hangi değeri bulmak istediğinizi seçin, ardından kalan iki girdiyi girin. Mühimmat tipi v₀ hızını belirler."
      />
      <div className="space-y-4">
        {/* Mode Selection */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Zap size={12} className="text-[#F5C518]" />
            Hesaplama Modu — Neyi Bulmak İstiyorsunuz?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-xl border text-[9px] font-black transition-all ${
                  mode === m.id
                    ? 'bg-[#F5C518] border-[#F5C518] text-black'
                    : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:border-gray-600'
                }`}
              >
                <m.icon size={15} />
                {m.label}
                <span className={`text-[7px] font-bold ${mode === m.id ? 'text-black/70' : 'text-gray-600'}`}>{m.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Ammo Selection */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Zap size={12} className="text-[#F5C518]" />
            Mühimmat Tipi / Çıkış Hızı
          </label>
          <div className="grid grid-cols-2 gap-2">
            {AMMO_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setAmmo(type)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[9px] font-black transition-all ${
                  ammo.id === type.id
                    ? 'bg-[#F5C518] border-[#F5C518] text-black'
                    : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:border-gray-600'
                }`}
              >
                <span>{type.icon}</span>
                {type.name.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Mode-specific Inputs */}
        <div className="grid grid-cols-2 gap-3">
          {(mode === 'height' || mode === 'angle') && (
            <div className="space-y-2">
              <label className={labelCls}>
                <Ruler size={12} className="text-[#F5C518]" />
                Mesafe (M)
              </label>
              <input
                type="number"
                value={distance}
                onChange={(e) => setDistance(Math.max(0, Number(e.target.value)))}
                className={inputCls}
              />
            </div>
          )}
          {(mode === 'height' || mode === 'distance') && (
            <div className="space-y-2">
              <label className={labelCls}>
                <Target size={12} className="text-red-500" />
                Açı (°)
              </label>
              <input
                type="number"
                value={angle}
                onChange={(e) => setAngle(Math.min(89, Math.max(0, Number(e.target.value))))}
                className={inputCls}
              />
            </div>
          )}
          {(mode === 'distance' || mode === 'angle') && (
            <div className="space-y-2">
              <label className={labelCls}>
                <MoveVertical size={12} className="text-[#F5C518]" />
                Yükseklik Farkı (M)
              </label>
              <input
                type="number"
                value={heightDiff}
                onChange={(e) => setHeightDiff(Math.max(0, Number(e.target.value)))}
                className={inputCls}
              />
              <p className="text-[8px] text-gray-600 leading-tight">Namlu çıkışı ile vuruş noktası arasındaki dikey fark</p>
            </div>
          )}
        </div>

        {/* Results Card */}
        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-[0.03] rotate-12">
            <Crosshair size={120} />
          </div>

          <div className="relative z-10 space-y-6">
            {mode === 'height' && (
              <div className="space-y-1">
                <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest text-center">TAHMİNİ KAYNAK YÜKSEKLİĞİ</div>
                <div className="text-center flex items-baseline justify-center gap-2">
                  <span className="text-6xl font-black text-white tracking-tighter">{height.toFixed(2)}</span>
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
            )}

            {mode === 'distance' && (
              <div className="space-y-1">
                <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest text-center">TAHMİNİ ATIŞ MESAFESİ</div>
                <div className="text-center flex items-baseline justify-center gap-2">
                  <span className="text-6xl font-black text-white tracking-tighter">{distRes.toFixed(1)}</span>
                  <span className="text-xl font-bold text-[#F5C518]">M</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold text-gray-400">
                  <span className="text-gray-600">ARALIK</span>
                  <span>{distMin.toFixed(1)}</span>
                  <span className="text-gray-600">—</span>
                  <span>{distMax.toFixed(1)}</span>
                  <span className="text-gray-600">M</span>
                </div>
              </div>
            )}

            {mode === 'angle' && feasible && (
              <div className="space-y-1">
                <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest text-center">TAHMİNİ ATIŞ (TERESSÜBAT) AÇISI</div>
                <div className="text-center flex items-baseline justify-center gap-2">
                  <span className="text-6xl font-black text-white tracking-tighter">{angleRes.toFixed(2)}</span>
                  <span className="text-xl font-bold text-[#F5C518]">°</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono font-bold text-gray-400">
                  <span className="text-gray-600">ARALIK</span>
                  <span>{angleMin.toFixed(2)}</span>
                  <span className="text-gray-600">—</span>
                  <span>{angleMax.toFixed(2)}</span>
                  <span className="text-gray-600">°</span>
                </div>
              </div>
            )}

            {mode === 'angle' && !feasible && (
              <div className="space-y-2 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                <div className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase tracking-wider">
                  <AlertTriangle size={14} />
                  Fiziksel Olarak Mümkün Değil
                </div>
                <p className="text-[9px] text-gray-400 leading-relaxed">
                  Yükseklik farkı ({trNum(heightDiff, 2)} m), merminin {distance} m'de yatay atışta bile düşeceği
                  değerin (k ≈ {trNum((G * distance * distance) / (2 * ammo.v0 * ammo.v0), 2)} m) altında.
                  Vuruş noktası namludan yüksekte olabilir veya mesafe/mühimmat bilgisi hatalı olabilir.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-[7px] text-gray-500 uppercase font-black block mb-1">Mermi Düşmesi</span>
                <span className="text-xs font-mono font-bold text-red-400">{(bulletDrop * 100).toFixed(1)} cm</span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-[7px] text-gray-500 uppercase font-black block mb-1">Uçuş Süresi</span>
                <span className="text-xs font-mono font-bold text-gray-400">{flightTime.toFixed(3)} sn</span>
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

        <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex gap-3 items-start shadow-inner">
          <Info size={16} className="text-red-900 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-red-200/50 uppercase">BALİSTİK NOT</p>
            <p className="text-[8px] text-gray-600 leading-relaxed italic">
              Tüm modlarda yerçekimi etkisi (Bullet Drop) dahildir. Mesafe ve açı modları aynı fizik modelin ters çözümleridir;
              rüzgar sapması ve hava direnci katsayısı (BC) kısa ve orta mesafe adli analizler için ihmal edilebilir düzeydedir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
