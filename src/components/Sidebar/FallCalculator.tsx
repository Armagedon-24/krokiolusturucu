import React, { useState, useEffect, useMemo } from 'react';
import { Ruler, Activity, Info, Weight, Zap, TrendingUp, Eye } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { HelpTooltip } from '../UI/HelpTooltip';
import { FallAnimationPlayer } from '../UI/FallAnimationPlayer';
import { ForensicReportPreview, ForensicPdfButton } from '../UI/ForensicReportPreview';
import { formatForensicReport, formatForensicSummary, trNum, type ForensicReport } from '../../utils/forensicReport';

export const FallCalculator: React.FC = () => {
  const [height, setHeight] = useState<number>(10);
  const [velocity, setVelocity] = useState<number>(1.5);
  const [weight, setWeight] = useState<number>(75);
  const [useDrag, setUseDrag] = useState<boolean>(true);
  const [distance, setDistance] = useState<number>(0);
  const [time, setTime] = useState<number>(0);
  const [impactVelocity, setImpactVelocity] = useState<number>(0);
  const [impactEnergy, setImpactEnergy] = useState<number>(0);
  
  const [isAnimationOpen, setIsAnimationOpen] = useState<boolean>(false);
  const { addObject, setFallAnimation, fallAnimation, addNotification } = useStore();

  const presets = [
    { label: 'Adım Atma', value: 0.8, description: 'Yavaşça kenardan adım atma' },
    { label: 'Atlama', value: 2.5, description: 'Normal bir zıplama hareketi' },
    { label: 'Hızlı Koşu', value: 5.5, description: 'Hızlı bir koşu sonrası atlayış' },
  ];

  useEffect(() => {
    const g = 9.81;
    const vTerm = 54; // m/s (insan vücudu için yaklaşık terminal hız)
    let t, vFinal;

    if (useDrag && height > 2) {
      // Hava direnci dahil edilmiş fiziksel hesaplama
      t = (vTerm / g) * Math.acosh(Math.exp((g * height) / (vTerm * vTerm)));
      vFinal = vTerm * Math.tanh((g * t) / vTerm);
    } else {
      // Vakum ortamı (temel fizik)
      t = Math.sqrt((2 * height) / g);
      vFinal = g * t;
    }
    
    const d = velocity * t; // Yatay mesafe
    const energy = 0.5 * weight * (vFinal * vFinal); // J = 1/2 * m * v^2

    setTime(t);
    setDistance(d);
    setImpactVelocity(vFinal * 3.6); // km/h'ye çevir
    setImpactEnergy(energy);
    setFallAnimation({ duration: t });
  }, [height, velocity, weight, useDrag]);

  const report = useMemo<ForensicReport>(() => ({
    title: 'YÜKSEKTEN DÜŞME İNCELEMESİ',
    topic: 'Yüksekten düşme olayında düşme süresi, çarpma hızı ve enerjisinin adli teknik yönünden değerlendirilmesi.',
    evidence: [
      `Düşme yüksekliği: ${height} m`,
      `Ayrılma (yatay) hızı: ${velocity} m/s`,
      `Vücut ağırlığı: ${weight} kg`,
      `Hava direnci modeli: ${useDrag ? 'Dahil (terminal hız ~54 m/s)' : 'Hariç (vakum modeli)'}`,
    ],
    method: [
      'Vakum modeli: t=√(2h/g), v=g·t. Hava direnci modeli: terminal hız asimptotlu (vterm=54 m/s) hiperbolik çözüm.',
      'Çarpma enerjisi: E = ½·m·v² (Joule).',
    ],
    findings: [
      `Düşme süresi: ${trNum(time, 2)} sn`,
      `Yatay (izdüşüm) mesafe: ${trNum(distance, 2)} m`,
      `Çarpma (dikey) hızı: ${trNum(impactVelocity, 0)} km/s`,
      `Çarpma enerjisi: ${trNum(impactEnergy, 0)} J (≈ ${trNum(impactEnergy / weight, 0)} J/kg)`,
    ],
    scenarios: [
      'Ayrılma hızı; adım atma/zıplama/koşu senaryolarında farklıdır: fırlatma mesafesi, ayrılma şeklinin ayırt edici göstergesidir.',
      'İtilme/atılma ihtimalinde başlangıç hızı vektörü ve gövde konumu kendiliğinden düşmeden farklıdır; bulunduğu yer ve duruş analizi gerekir.',
      '30 m üzeri düşüşlerde hava direnci belirginleşir: hız terminal değere (~195 km/s) yakınsar → vakum modeli gerçekçi değildir.',
      'Ara temas (balkon, ağaç, saçak) enerjinin bir kısmını absorbe eder → çarpma enerjisi hesaptan düşük çıkar.',
      'Çarpma yüzeyi (beton/asfalt/toprak) yaralanma şiddetini değiştirir; enerji değerleri yüzeyle birlikte yorumlanmalıdır.',
      'İlk temas bölgesi (ayak, kafa, gövde) sonucu belirler; ölümcül yaralanma eşiği kişi başına enerji yoğunluğuyla ilgilidir.',
      'Yer değiştirme (düşme sonrası savrulma/sıçrama) ölçülen mesafeyle hesaplanan izdüşümü farklılaştırabilir.',
    ],
    conclusion: [
      `İnceleme sonucunda ${height} m yükseklikten düşen vücudun ${trNum(time, 2)} sn sürede ${trNum(distance, 2)} m ilerleyerek ${trNum(impactVelocity, 0)} km/s hızla ve yaklaşık ${trNum(impactEnergy, 0)} J kinetik enerjiyle zemine çarptığı hesaplanmıştır.`,
      'Düşmenin kendiliğinden mi yoksa dış etkiyle mi gerçekleştiği; ayrılma hızı, duruş ve yaralanma paterni birlikte değerlendirilerek yorumlanmalıdır.',
    ],
    caveats: [
      'Hesaplar; ideal vücut ağırlığı, dik/düz düşme ve bilinen yükseklik varsayımlarına dayanır.',
      'Vücut duruşu (gerdirilmiş/kıvırılmış) hava direncini değiştirir; sonuçlar yaklaşık değerlerdir.',
      'Rapor gösterge niteliğinde olup nihai kanaat otopsi ve saha bulgularıyla birlikte oluşmalıdır.',
    ],
  }), [height, velocity, weight, useDrag, time, distance, impactVelocity, impactEnergy]);
  const reportText = useMemo(() => formatForensicReport(report), [report]);
  const summaryText = useMemo(() => formatForensicSummary(report), [report]);

  const handleAddToCanvas = () => {
    const scale = 20;
    const baseX = 250;
    const baseY = 200;
    const hPx = height * scale;
    const dPx = distance * scale;

    addObject({
      type: 'rect',
      x: baseX - 30,
      y: baseY - hPx,
      width: 60,
      height: hPx,
      fill: '#e0e0e0',
      stroke: '#888',
      strokeWidth: 2,
    });

    addObject({
      type: 'line',
      x: baseX - 80,
      y: baseY,
      width: 160 + dPx,
      height: 6,
      fill: '#666',
      points: [0, 3, 160 + dPx, 3],
      stroke: '#666',
      strokeWidth: 6,
    });

    addObject({
      type: 'line',
      x: baseX,
      y: baseY - hPx,
      width: dPx + 10,
      height: hPx + 10,
      points: [
        0, 0,
        dPx * 0.25, -hPx * 0.15,
        dPx * 0.55, hPx * 0.2,
        dPx, hPx,
      ],
      dash: [6, 4],
      stroke: '#E53935',
      strokeWidth: 2,
    });

    addObject({
      type: 'text',
      text: `Bina: ${height}m`,
      x: baseX - 25,
      y: baseY - hPx - 20,
      width: 80,
      fontSize: 10,
      fill: '#666',
      fontFamily: 'Inter',
      fontStyle: 'bold',
    });

    addObject({
      type: 'rect',
      x: baseX - 6,
      y: baseY - hPx - 6,
      width: 12,
      height: 12,
      rotation: 45,
      fill: '#1565C0',
      stroke: '#fff',
      strokeWidth: 2,
    });

    addObject({
      type: 'rect',
      x: baseX + dPx - 6,
      y: baseY - 6,
      width: 12,
      height: 12,
      rotation: 45,
      fill: '#FF5722',
      stroke: '#fff',
      strokeWidth: 2,
    });

    addObject({
      type: 'text',
      text: `Çarpma: ${Math.round(impactVelocity)} km/h`,
      x: baseX + dPx + 12,
      y: baseY - 12,
      width: 120,
      fontSize: 10,
      fill: '#E53935',
      fontFamily: 'Inter',
      fontStyle: 'bold',
    });

    addObject({
      type: 'line',
      x: baseX,
      y: baseY + 20,
      width: dPx,
      height: 2,
      points: [0, 0, dPx, 0],
      stroke: '#1565C0',
      strokeWidth: 1,
      dash: [3, 3],
    });

    addObject({
      type: 'text',
      text: `${distance.toFixed(1)}m`,
      x: baseX + dPx / 2 - 20,
      y: baseY + 22,
      width: 50,
      fontSize: 9,
      fill: '#1565C0',
      fontFamily: 'Inter',
      fontStyle: 'bold',
    });

    addObject({
      type: 'text',
      text: summaryText,
      x: baseX - 20,
      y: baseY + 50,
      width: 320,
      fontSize: 10,
      fill: '#000',
      fontFamily: 'Inter',
      fontStyle: 'bold',
    });

    setFallAnimation({ canvasData: undefined, isPlaying: false, currentTime: 0 });

    addNotification({ type: 'success', message: 'Şema ve kısa özet tuvale aktarıldı' });
  };

  return (
    <div className="p-4 space-y-6 overflow-y-auto max-h-screen custom-scrollbar pb-20 relative">
      <HelpTooltip 
        title="Düşme Analizi"
        description="Serbest düşüş ve yatay hız parametrelerini kullanarak düşme mesafesini ve çarpma enerjisini hesaplar."
        formula="v(t) = v_term * tanh(gt/v_term)"
        usage="Bina yüksekliğini ve ayrılma hızını girin. Hava direnci seçeneği yüksek mesafeli düşüşlerde (30m+) sonucu daha gerçekçi kılar."
      />
      
      <div className="flex items-center gap-2 px-1 mb-2">
        <Activity size={18} className="text-[#F5C518]" />
        <h4 className="text-[11px] font-black text-gray-200 uppercase tracking-widest">
          Yüksekten Düşme Analizi (Profesyonel)
        </h4>
      </div>

      <div className="space-y-6">
        {/* Height Input */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Ruler size={14} className="text-[#F5C518]" />
            Bina / Düşme Yüksekliği (Metre)
          </label>
          <div className="relative group">
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(Math.max(0.1, Number(e.target.value)))}
              className="w-full bg-[#111] border border-[#333] rounded-2xl px-5 py-4 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all font-mono"
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-600">M</span>
          </div>
        </div>

        {/* Velocity Selection */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 text-gray-400">
            <Zap size={14} className="text-blue-500" />
            Ayrılma Hızı (m/sn): {velocity}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => setVelocity(p.value)}
                className={`p-2 rounded-xl border text-[8px] font-black transition-all ${
                  velocity === p.value 
                    ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
                    : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:border-gray-600'
                }`}
              >
                {p.label.toUpperCase()}
              </button>
            ))}
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={velocity}
            onChange={(e) => setVelocity(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        {/* Options */}
        <div className="flex items-center justify-between p-4 bg-[#111] border border-[#333] rounded-2xl">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-6 rounded-full relative transition-all cursor-pointer ${useDrag ? 'bg-green-500' : 'bg-gray-700'}`} onClick={() => setUseDrag(!useDrag)}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${useDrag ? 'left-5' : 'left-1'}`} />
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-gray-200">Hava Direnci (Gerçekçi Fizik)</span>
          </div>
          <Weight size={16} className={useDrag ? "text-green-500" : "text-gray-600"} />
        </div>

        {/* Weight Input (for Energy calculation) */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
             Vücut Ağırlığı (Kg)
          </label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(Math.max(1, Number(e.target.value)))}
            className="w-full bg-[#111] border border-[#333] rounded-2xl px-5 py-4 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all font-mono"
          />
        </div>

        {/* Results Professional Dashboard */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-[#333] rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 rotate-12 transition-transform group-hover:scale-110">
            <TrendingUp size={120} />
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-6">
              <div className="space-y-1">
                <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest block">Düşme Mesafesi</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{distance.toFixed(2)}</span>
                  <span className="text-[10px] font-bold text-blue-500">M</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest block">Düşüş Süresi</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{time.toFixed(2)}</span>
                  <span className="text-[10px] font-bold text-blue-500">SN</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest block">Çarpma Hızı</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-red-500">{Math.round(impactVelocity)}</span>
                  <span className="text-[10px] font-bold text-red-700 uppercase">km/s</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest block">Çarpma Enerjisi</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-[#F5C518]">{Math.round(impactEnergy)}</span>
                  <span className="text-[10px] font-bold text-[#F5C518]/60 uppercase">J</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex gap-3 items-start">
              <Info size={16} className="text-blue-900 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-blue-200">TEKNİK NOT</p>
                <p className="text-[8px] text-gray-600 leading-relaxed italic">
                  {useDrag 
                    ? "Hava direnci hesaba katılmıştır (Terminal Hız: 54m/s). Bu model özellikle 10 metre ve üzeri düşüşlerde adli tıp standartlarına uygundur."
                    : "Hava direnci ihmal edilmiştir (Vakum fiziği). Kısa mesafeli düşüşlerde hızlı sonuç verir ancak yüksek irtifada hata payı artar."}
                </p>
              </div>
            </div>
            
            {/* Animation Controls - matches accident reconstruction pattern */}
            <div className="border-t border-white/5 pt-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <label className="text-[9px] font-bold text-gray-500 uppercase block mb-1">Oynatma Hızı</label>
                  <select className="bg-[#111] border border-[#333] rounded-xl px-3 py-2 text-[10px] text-white outline-none focus:border-[#F5C518]/50"
                    value={fallAnimation.speed}
                    onChange={e => setFallAnimation({ speed: Number(e.target.value) })}>
                    <option value="0.25">0.25x</option>
                    <option value="0.5">0.5x</option>
                    <option value="1">1x (Normal)</option>
                    <option value="2">2x</option>
                    <option value="4">4x</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={fallAnimation.loop}
                    onChange={e => setFallAnimation({ loop: e.target.checked })}
                    className="accent-[#F5C518]" />
                  <span className="text-[10px] text-gray-400">Döngü</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <ForensicReportPreview text={reportText} summaryText={summaryText} report={report} />

      {/* Controls Bar — always at top */}
      <div className="sticky top-0 px-4 py-3 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setHeight(10); setVelocity(1.5); setWeight(75); setUseDrag(true); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 hover:text-red-400 transition-colors"
          >
            TEMİZLE
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddToCanvas}
            className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold text-gray-400 hover:text-[#F5C518] border border-[#333] hover:border-[#F5C518]/50 rounded-lg transition-all"
            title="Şema ve kısa özeti tuvale aktarır"
          >
            TUVALE AKTAR
          </button>
          <ForensicPdfButton report={report} />
          <button
            onClick={() => setIsAnimationOpen(true)}
            className="flex items-center gap-2 px-5 py-2 bg-[#F5C518] hover:bg-[#E2B616] text-black text-xs font-black rounded-md transition-all shadow-lg active:scale-95"
          >
            <Eye size={14} />
            ANİMASYONU İZLE
          </button>
        </div>
      </div>
      
      <FallAnimationPlayer isOpen={isAnimationOpen} onClose={() => setIsAnimationOpen(false)}
        fallData={{ height, distance, velocity, impactVelocity, impactEnergy, time, weight, useDrag }} />
    </div>
  );
};
