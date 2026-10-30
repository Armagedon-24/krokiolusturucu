import React, { useState, useEffect, useMemo } from 'react';
import { Target, Ruler, Info, PlusCircle, Crosshair, Zap } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';
import { formatForensicReport, trNum } from '../../../utils/forensicReport';
import { ForensicReportPreview } from '../../UI/ForensicReportPreview';

const AMMO_TYPES = [
  { id: '9mm', name: '9mm Tabanca', v0: 380, icon: '🔫' },
  { id: '556', name: '5.56mm NATO', v0: 900, icon: '🎯' },
  { id: '762', name: '7.62mm AK/G3', v0: 715, icon: '🔥' },
  { id: 'custom', name: 'Özel Hız', v0: 500, icon: '⚙️' },
];

export const BulletTrajectoryCalculator: React.FC = () => {
  const [distance, setDistance] = useState<number>(50);
  const [angle, setAngle] = useState<number>(5);
  const [ammo, setAmmo] = useState(AMMO_TYPES[0]);
  const [height, setHeight] = useState<number>(0);
  const [bulletDrop, setBulletDrop] = useState<number>(0);
  const [heightMin, setHeightMin] = useState<number>(0);
  const [heightMax, setHeightMax] = useState<number>(0);
  
  const { addObject } = useStore();

  useEffect(() => {
    const g = 9.81;
    const v0 = ammo.v0;
    
    if (distance > 0 && v0 > 0) {
      const radians = angle * (Math.PI / 180);
      const flightTime = distance / (v0 * Math.cos(radians));
      const drop = 0.5 * g * (flightTime * flightTime);
      setBulletDrop(drop);
      const linearHeight = distance * Math.tan(radians);
      setHeight(linearHeight + drop);

      // Belirsizlik: açı ±1°, mesafe ±%2
      const calc = (d: number, a: number) => {
        const r = a * (Math.PI / 180);
        const t = d / (v0 * Math.cos(r));
        return { h: d * Math.tan(r) + 0.5 * g * t * t, drop: 0.5 * g * t * t };
      };
      const dMin = distance * 0.98;
      const dMax = distance * 1.02;
      const aMin = Math.max(0, angle - 1);
      const aMax = Math.min(89, angle + 1);
      const c1 = calc(dMin, aMin);
      const c2 = calc(dMax, aMax);
      const c3 = calc(dMin, aMax);
      const c4 = calc(dMax, aMin);
      setHeightMin(Math.min(c1.h, c2.h, c3.h, c4.h));
      setHeightMax(Math.max(c1.h, c2.h, c3.h, c4.h));
    } else {
      // Mesafe sıfırlanınca eski sonuçlar ekranda kalmasın
      setBulletDrop(0);
      setHeight(0);
      setHeightMin(0);
      setHeightMax(0);
    }
  }, [distance, angle, ammo]);

  const report = useMemo(() => ({
    title: 'BALİSTİK TRAJEKTÖR İNCELEMESİ',
    topic: 'Vuruş açısı ve mermi karakteristiklerinden hareketle, atışın kaynak (namlu çıkış) konumunun adli balistik yönünden değerlendirilmesi.',
    evidence: [
      `Mühimmat: ${ammo.name} (v₀=${ammo.v0} m/s — fabrika varyasyonu ±%5)`,
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
      `Uçuş süresi: ${distance > 0 ? trNum(distance / ammo.v0, 3) : '0,000'} sn`,
    ],
    scenarios: [
      'Açı ölçümü giriş deliğinin eliptikliğiyle yapılıyorsa ±2° hata mümkündür; 3D lazer tarama veya probe yöntemi hassasiyeti artırır.',
      'Ara hedef (cam, kapı, dal) veya sekmeye uğrayan mermide ölçülen açı gerçek atış yönünü yansıtmaz → sonuç geçersizdir.',
      'Hava direnci ihmal edilmiştir: uzun mesafede (>100 m) gerçek düşme daha fazla → kaynak, hesaplanandan daha yakın ve daha yüksek olabilir.',
      'Yüksek hızlı mermilerde jiroskopik stabilizasyon ve rüzgar sapması yatay yönü değiştirebilir; dikey yüksekliğe etkisi sınırlıdır.',
      'Vuruş noktası ile namlu çıkışı arasındaki açı, mermi deformasyonu veya yalpalamadan (yaw) etkilenebilir → kısa mesafede küçük, uzun mesafede büyüyen hata.',
      'Hedef hareketliyse (taşınan vücut, araç) ölçülen açı anlık konumu yansıtır → kaynak konumu dinamik değerlendirilmelidir.',
      'Kesin kaynak konumu için en az iki farklı yüzeydeki delik/izden üç boyutlu kesişim analizi önerilir.',
    ],
    conclusion: [
      `İnceleme sonucunda atışın kaynak noktasının, hedefe göre yaklaşık ${trNum(height, 2)} m yükseklikte (${trNum(heightMin, 2)} – ${trNum(heightMax, 2)} m aralığında) bulunduğu kanaatine varılmıştır.`,
      'Atış yönünün kesin tespiti için saha rekonstrüksiyonu, delik/iz fotoğrafları ve mümkünse GSR/paraketon analizleriyle birlikte değerlendirme yapılmalıdır.',
    ],
    caveats: [
      'Hesap vakum ortamı ve sabit v₀ varsayımıyla tek boyutlu düzlemde yapılmıştır.',
      'Sekme, ara hedef veya mermi parçalanması saptanmışsa bu hesap kullanılmamalıdır.',
      'Sonuç gösterge niteliğindedir; nihai kanaat saha incelemesi ve laboratuvar bulgularıyla desteklenmelidir.',
    ],
  }), [ammo, angle, distance, height, heightMin, heightMax, bulletDrop]);
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
      fontStyle: 'bold'
    });
  };

  return (
    <div className="space-y-6 p-1 relative">
      <HelpTooltip 
        title="Balistik Trajektör"
        description="Atış açısı ve mühimmat tipine göre merminin izlediği yolu ve yerçekimi kaynaklı düşüşü hesaplar."
        formula="H = D*tan(θ) + 0.5*g*(D/V₀)²"
        usage="Mühimmat tipini seçin, vuruş açısını ve mesafeyi girin. Sistem yerçekimi etkisini (Bullet Drop) otomatik ekleyecektir."
      />
      <div className="space-y-4">
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

        {/* Distance & Angle Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 text-gray-400">
              <Ruler size={12} className="text-[#F5C518]" />
              Mesafe (M)
            </label>
            <input
              type="number"
              value={distance}
              onChange={(e) => setDistance(Math.max(0, Number(e.target.value)))}
              className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 text-gray-400">
              <Target size={12} className="text-red-500" />
              Açı (°)
            </label>
            <input
              type="number"
              value={angle}
              onChange={(e) => setAngle(Math.min(89, Math.max(0, Number(e.target.value))))}
              className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-red-500/50 outline-none transition-all font-mono"
            />
          </div>
        </div>

        {/* Results Card */}
        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-[0.03] rotate-12">
            <Crosshair size={120} />
          </div>
          
          <div className="relative z-10 space-y-6">
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

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-[7px] text-gray-500 uppercase font-black block mb-1">Mermi Düşmesi</span>
                <span className="text-xs font-mono font-bold text-red-400">{(bulletDrop * 100).toFixed(1)} cm</span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-[7px] text-gray-500 uppercase font-black block mb-1">Uçuş Süresi</span>
                <span className="text-xs font-mono font-bold text-gray-400">
                  {distance > 0 ? (distance / ammo.v0).toFixed(3) : "0.000"} sn
                </span>
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

        <ForensicReportPreview text={reportText} report={report} />

        <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex gap-3 items-start shadow-inner">
          <Info size={16} className="text-red-900 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-red-200/50 uppercase">BALİSTİK NOT</p>
            <p className="text-[8px] text-gray-600 leading-relaxed italic">
              Bu hesaplamada yerçekimi etkisi (Bullet Drop) dahil edilmiştir. Rüzgar sapması ve hava direnci katsayısı (BC) kısa ve orta mesafe adli analizler için ihmal edilebilir düzeydedir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
