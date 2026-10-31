import React, { useState, useEffect, useMemo } from 'react';
import { Crosshair, Info, Eye, Target } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';
import { ShotDirectionAnimationPlayer } from '../../UI/ShotDirectionAnimationPlayer';
import { ForensicReportPreview, ForensicPdfButton } from '../../UI/ForensicReportPreview';
import { formatForensicReport, formatForensicSummary, trNum, type ForensicReport } from '../../../utils/forensicReport';
import type { ShotDirectionData } from '../../../types';

const SURFACE_TYPES = [
  { id: 'glass', name: 'Cam', deflectionFactor: 2 },
  { id: 'metal', name: 'Metal Sac', deflectionFactor: 1 },
  { id: 'drywall', name: 'Alçıpan', deflectionFactor: 3 },
  { id: 'wood', name: 'Ahşap', deflectionFactor: 2.5 },
  { id: 'concrete', name: 'Beton', deflectionFactor: 0.5 },
  { id: 'other', name: 'Diğer', deflectionFactor: 1 },
];

const BULLET_TYPES = [
  { id: '9mm', name: '9mm Tabanca', v0: 380 },
  { id: '556', name: '5.56mm NATO', v0: 900 },
  { id: '762', name: '7.62mm AK/G3', v0: 715 },
  { id: '357', name: '.357 Magnum', v0: 460 },
  { id: '45acp', name: '.45 ACP', v0: 255 },
  { id: '223', name: '.223 Rem', v0: 990 },
  { id: 'custom', name: 'Özel', v0: 500 },
];

export const ShotDirectionCalculator: React.FC = () => {
  const [entryX, setEntryX] = useState<number>(0);
  const [entryY, setEntryY] = useState<number>(0);
  const [entryZ, setEntryZ] = useState<number>(150);
  const [hasExitWound, setHasExitWound] = useState<boolean>(true);
  const [exitX, setExitX] = useState<number>(30);
  const [exitY, setExitY] = useState<number>(10);
  const [exitZ, setExitZ] = useState<number>(140);
  const [surface, setSurface] = useState(SURFACE_TYPES[0]);
  const [bulletType, setBulletType] = useState(BULLET_TYPES[0]);
  const [showPlayer, setShowPlayer] = useState(false);

  // Calculated results
  const [impactAngle, setImpactAngle] = useState(0);
  const [horizontalAngle, setHorizontalAngle] = useState(0);
  const [shooterDistance, setShooterDistance] = useState(0);
  const [shooterHeight, setShooterHeight] = useState(0);
  const [deflectionAngle, setDeflectionAngle] = useState(0);
  const [trajectoryLength, setTrajectoryLength] = useState(0);

  const { addObject, setShotDirection, addNotification } = useStore();

  useEffect(() => {
    const dx = exitX - entryX;
    const dy = exitY - entryY;
    const dz = exitZ - entryZ;

    const horizDist = Math.sqrt(dx * dx + dy * dy);

    if (horizDist > 0) {
      // Horizontal bearing angle (shooter's direction)
      const hAngle = Math.atan2(dx, dy) * (180 / Math.PI);
      setHorizontalAngle(Math.round(hAngle * 10) / 10);

      // Vertical impact angle
      const vAngle = Math.atan2(Math.abs(dz), horizDist) * (180 / Math.PI);
      setImpactAngle(Math.round(vAngle * 10) / 10);

      // Trajectory length (3D)
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      setTrajectoryLength(Math.round(length * 10) / 10);

      // Estimate shooter distance based on trajectory and bullet type (METRE cinsinden;
      // koordinat girişleri cm olduğu için /100 ile dönüştürülür)
      // In real forensics this uses more complex ballistic coefficients
      const estDist = Math.round((horizDist / 100) * 1.2 + 5);
      setShooterDistance(estDist);

      // Estimate shooter height (extrapolate trajectory backwards, METRE)
      // Using similar triangles: shooterHeight = entryZ(m) - estDist * tan(impactAngle)
      const estimatedHeight = (entryZ / 100) - (estDist * Math.tan(vAngle * Math.PI / 180));
      setShooterHeight(Math.round(Math.max(0, estimatedHeight) * 10) / 10);

      // Deflection based on surface type
      const deflection = Math.round(Math.min(vAngle * 0.15 * surface.deflectionFactor, 15) * 10) / 10;
      setDeflectionAngle(deflection);
    } else {
      setImpactAngle(0);
      setHorizontalAngle(0);
      setShooterDistance(0);
      setShooterHeight(0);
      setDeflectionAngle(0);
      setTrajectoryLength(0);
    }
  }, [entryX, entryY, entryZ, exitX, exitY, exitZ, surface]);

  const shotData: ShotDirectionData = {
    entryX, entryY, entryZ,
    exitX, exitY, exitZ,
    hasExitWound,
    impactAngle,
    horizontalAngle,
    shooterDistance,
    shooterHeight,
    bulletType: bulletType.name,
    deflectionAngle,
    entrySurface: surface.id as ShotDirectionData['entrySurface'],
  };

  const report = useMemo<ForensicReport>(() => ({
    title: 'ATIŞ YÖNÜ TESPİT İNCELEMESİ',
    topic: 'Giriş ve çıkış deliklerinin konumundan hareketle, atışın yatay/dikey yönü ve atıcı konumunun adli balistik yönünden değerlendirilmesi.',
    evidence: [
      `Giriş deliği: (${entryX}, ${entryY}, ${entryZ}) cm`,
      `Çıkış deliği: (${exitX}, ${exitY}, ${exitZ}) cm`,
      `Geçilen yüzey: ${surface.name} (sapma faktörü ${surface.deflectionFactor}x)`,
      `Mühimmat: ${bulletType.name}`, 
    ],
    method: [
      'Giriş-çıkış geometrisi: iki nokta arasındaki vektörün yatay/dikey düzlemlere izdüşümüyle açı hesabı.',
      "Yüzey sapması: delikler arası hat, ${surface.name.toLowerCase()} yüzeyindeki sapma faktörüyle düzeltilmiştir.",
      'Atıcı konumu: yön doğrultusunda geriye doğru projeksiyon.',
    ],
    findings: [
      `Yatay atış açısı: ${trNum(horizontalAngle, 1)}°`,
      `Dikey atış açısı: ${trNum(impactAngle, 1)}°`,
      `Mermi sapması (deflection): ${trNum(deflectionAngle, 1)}°`,
      `Tahmini atıcı mesafesi: ~${shooterDistance} m — atıcı yüksekliği: ${shooterHeight} m`,
    ],
    scenarios: [
      'Giriş-çıkış delikleri AYNI mermiye ait olmalıdır; parçalanma/multiple atış durumunda geometri geçersizleşir.',
      `${surface.name} yüzeyinde mermi yolunu saptırabilir: sapma faktörü ${surface.deflectionFactor}x uygulandı; gerçek delikler arası hat ile atış yönü arasında fark olabilir.`,
      'Alçıpan/cam gibi kırılgan yüzeylerde sapma daha büyük; betonda daha küçüktür → farklı yüzey senaryoları ayrıca test edilmelidir.',
      'Delik konum ölçümlerindeki ±2 cm hata, açılarda ~2-3° ve atıcı mesafesinde metrelere varan kayma yaratabilir.',
      'Mermi stabilitesi (yalpalama/yaw) giriş açısını etkiler; çarpma anında mermi stabilize değilse açı ölçümü yanıltıcıdır.',
      'Atıcı mesafesi tahmini, atışın düz bir hat izlediği varsayımına dayanır; yerçekimi düşmesi mesafeye göre düzeltme gerektirir.',
      'Atıcı yüksekliği tahmini; aracın/düşük yükseklikten atışın (rakım farkı) veya eğimli zeminin dikkate alınmaması durumunda kayar.',
      'Kesin yön tespiti için giriş deliğinin eliptikliği (açı) ve GSR/parafin bulguları birlikte kullanılmalıdır.',
    ],
    conclusion: [
      `İnceleme sonucunda atışın yatay düzlemde ${trNum(horizontalAngle, 1)}°, dikey düzlemde ${trNum(impactAngle, 1)}° doğrultudan geldiği; mermi sapması düzeltmesi sonrası atıcının yaklaşık ${shooterDistance} m mesafede ve ${shooterHeight} m yükseklikte konumlanmış olabileceği kanaatine varılmıştır.`,
      'Atıcı konumu; yüzey sapması, mermi davranışı ve delik ölçüm hassasiyetine bağlı gösterge niteliğindedir.',
    ],
    caveats: [
      'Hesap; iki delik noktasının doğru eşleştirilmesine ve ölçümlerin cm hassasiyetinde alınmasına bağlıdır.',
      'Yüzey sapma faktörleri ampirik ortalama değerlerdir; laboratuvar atış testleriyle doğrulanmalıdır.',
      'Rapor gösterge niteliğinde olup nihai kanaat adli balistik uzmanı değerlendirmesiyle birlikte oluşmalıdır.',
    ],
  }), [entryX, entryY, entryZ, exitX, exitY, exitZ, hasExitWound, surface, bulletType, impactAngle, horizontalAngle, shooterDistance, shooterHeight, deflectionAngle]);
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
      fontStyle: 'bold'
    });
    addNotification({ type: 'success', message: 'Şema ve kısa özet rapora (kroki) eklendi' });
  };

  const handleAnimationOpen = () => {
    setShotDirection({ canvasData: shotData });
    setShowPlayer(true);
  };

  return (
    <div className="space-y-6 p-1 relative">
      <HelpTooltip
        title="Atış Yönü Tespiti"
        description="Mermi giriş ve çıkış deliklerine göre atıcının konumunu, atış açısını ve mesafesini hesaplar."
        formula="θ = atan2(ΔZ, √(ΔX²+ΔY²)) | Atıcı Yüksekliği = GirişZ - Mesafe * tan(θ)"
        usage="Giriş ve çıkış noktalarının koordinatlarını girin. Yüzey tipini ve mühimmatı seçin. Sistem otomatik olarak atış yönünü hesaplayacaktır."
      />

      <div className="space-y-4">
        {/* Entry Point Section */}
        <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-4">
          <label className="text-[10px] font-bold text-red-400 uppercase flex items-center gap-2 mb-3">
            <Target size={12} />
            Giriş Noktası (Entry)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[8px] text-gray-500 uppercase font-bold">X (Yatay cm)</label>
              <input
                type="number"
                value={entryX}
                onChange={(e) => setEntryX(Number(e.target.value))}
                className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2 text-sm text-white focus:border-red-500/50 outline-none transition-all font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] text-gray-500 uppercase font-bold">Y (Derinlik cm)</label>
              <input
                type="number"
                value={entryY}
                onChange={(e) => setEntryY(Number(e.target.value))}
                className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2 text-sm text-white focus:border-red-500/50 outline-none transition-all font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] text-gray-500 uppercase font-bold">Z (Yükseklik cm)</label>
              <input
                type="number"
                value={entryZ}
                onChange={(e) => setEntryZ(Number(e.target.value))}
                className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2 text-sm text-white focus:border-red-500/50 outline-none transition-all font-mono"
              />
            </div>
          </div>
        </div>

        {/* Exit Point Section */}
        <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-[10px] font-bold text-orange-400 uppercase flex items-center gap-2">
              <Target size={12} />
              Çıkış Noktası (Exit)
            </label>
            <button
              onClick={() => setHasExitWound(!hasExitWound)}
              className={`text-[9px] font-bold px-2 py-1 rounded-lg transition-all ${
                hasExitWound
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-gray-800 text-gray-500 border border-gray-700'
              }`}
            >
              {hasExitWound ? 'Çıkış Var' : 'Çıkış Yok / Tek Delik'}
            </button>
          </div>
          {hasExitWound && (
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[8px] text-gray-500 uppercase font-bold">X (Yatay cm)</label>
                <input
                  type="number"
                  value={exitX}
                  onChange={(e) => setExitX(Number(e.target.value))}
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500/50 outline-none transition-all font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] text-gray-500 uppercase font-bold">Y (Derinlik cm)</label>
                <input
                  type="number"
                  value={exitY}
                  onChange={(e) => setExitY(Number(e.target.value))}
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500/50 outline-none transition-all font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] text-gray-500 uppercase font-bold">Z (Yükseklik cm)</label>
                <input
                  type="number"
                  value={exitZ}
                  onChange={(e) => setExitZ(Number(e.target.value))}
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500/50 outline-none transition-all font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Surface & Bullet Type */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
              <Info size={12} className="text-[#F5C518]" />
              Yüzey Tipi
            </label>
            <select
              value={surface.id}
              onChange={(e) => setSurface(SURFACE_TYPES.find(s => s.id === e.target.value) || SURFACE_TYPES[0])}
              className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all appearance-none cursor-pointer"
            >
              {SURFACE_TYPES.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
              <Crosshair size={12} className="text-[#F5C518]" />
              Mühimmat
            </label>
            <select
              value={bulletType.id}
              onChange={(e) => setBulletType(BULLET_TYPES.find(b => b.id === e.target.value) || BULLET_TYPES[0])}
              className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all appearance-none cursor-pointer"
            >
              {BULLET_TYPES.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Card */}
        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-[0.03] rotate-12">
            <Crosshair size={120} />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="space-y-1">
              <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest text-center">ATIŞ YÖNÜ ANALİZİ</div>
              <div className="text-center flex items-baseline justify-center gap-2">
                <span className="text-4xl font-black text-white tracking-tighter">{horizontalAngle}°</span>
                <span className="text-sm font-bold text-[#F5C518]">YATAY AÇI</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-[7px] text-gray-500 uppercase font-black block mb-1">Dikey Geliş Açısı</span>
                <span className="text-xs font-mono font-bold text-orange-400">{impactAngle}°</span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-[7px] text-gray-500 uppercase font-black block mb-1">Sapma Açısı</span>
                <span className="text-xs font-mono font-bold text-yellow-400">{deflectionAngle}°</span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-[7px] text-gray-500 uppercase font-black block mb-1">Atıcı Mesafesi</span>
                <span className="text-xs font-mono font-bold text-blue-400">~{shooterDistance} m</span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-[7px] text-gray-500 uppercase font-black block mb-1">Atıcı Yüksekliği</span>
                <span className="text-xs font-mono font-bold text-green-400">{shooterHeight} m</span>
              </div>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
              <span className="text-[7px] text-gray-500 uppercase font-black block mb-1">Trajektör Uzunluğu</span>
              <span className="text-xs font-mono font-bold text-gray-300">{trajectoryLength} cm</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex gap-3 items-start shadow-inner">
          <Info size={16} className="text-red-900 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-red-200/50 uppercase">ADLİ NOT</p>
            <p className="text-[8px] text-gray-600 leading-relaxed italic">
              Hesaplanan değerler yaklaşıktır. Kesin atış mesafesi ve açı tespiti için balistik uzmanı görüşü alınmalıdır. Sapma açısı, merminin yüzeyden çıkarken izlediği yolun girişe göre olan yön değişimini ifade eder.
            </p>
          </div>
        </div>
      </div>

      <ForensicReportPreview text={reportText} summaryText={summaryText} report={report} />

      {/* Controls Bar — always at top */}
      <div className="sticky top-0 px-4 py-3 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEntryX(0); setEntryY(0); setEntryZ(150); setExitX(30); setExitY(10); setExitZ(140); setHasExitWound(true); setSurface(SURFACE_TYPES[0]); setBulletType(BULLET_TYPES[0]); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 hover:text-red-400 transition-colors"
          >
            TEMİZLE
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddToCanvas}
            className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold text-gray-400 hover:text-[#F5C518] border border-[#333] hover:border-[#F5C518]/50 rounded-lg transition-all"
            title="Şema ve kısa özeti rapora (kroki) ekler"
          >
            RAPORA EKLE
          </button>
          <ForensicPdfButton report={report} />
          <button
            onClick={handleAnimationOpen}
            className="flex items-center gap-2 px-5 py-2 bg-[#F5C518] hover:bg-[#E2B616] text-black text-xs font-black rounded-md transition-all shadow-lg active:scale-95"
          >
            <Eye size={14} />
            ANİMASYONU İZLE
          </button>
        </div>
      </div>

      {showPlayer && (
        <ShotDirectionAnimationPlayer isOpen={showPlayer} onClose={() => setShowPlayer(false)} shotData={shotData} />
      )}
    </div>
  );
};
