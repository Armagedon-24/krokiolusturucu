import React, { useState, useEffect, useMemo } from 'react';
import { Target, PlusCircle, Flame, Droplet, Shield, Info, AlertTriangle } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';
import { formatForensicReport, formatForensicSummary, trNum } from '../../../utils/forensicReport';
import { ForensicReportPreview, ForensicPdfButton } from '../../UI/ForensicReportPreview';

const CHOKE_TYPES = [
  { id: 'full', name: 'Full Choke (Dar)', factor: 1.0 },
  { id: 'modified', name: 'Modified Choke (Orta)', factor: 1.25 },
  { id: 'cylinder', name: 'Cylinder Choke (Geniş)', factor: 1.5 },
];

export const GunshotDistanceCalculator: React.FC = () => {
  const [weaponType, setWeaponType] = useState<'handgun' | 'rifle' | 'shotgun'>('handgun');
  const [spread, setSpread] = useState<number>(10);
  const [choke, setChoke] = useState(CHOKE_TYPES[0]);

  // Physical findings
  const [hasBurn, setHasBurn] = useState<boolean>(false);
  const [hasSoot, setHasSoot] = useState<boolean>(true);
  const [hasStippling, setHasStippling] = useState<boolean>(true);
  const [hasWipe, setHasWipe] = useState<boolean>(true);

  const [estimatedDistance, setEstimatedDistance] = useState<string>('Belirsiz');
  const [classification, setClassification] = useState<string>('Bulgu Seçiniz');

  const { addObject, addNotification } = useStore();

  useEffect(() => {
    if (weaponType === 'shotgun') {
      // Shotgun pellet spread logic
      if (spread > 0) {
        // Average shotgun spread increases by about 2.5 cm in diameter per meter of travel
        // Modified by choke factor: cylinder spreads wider, full choke spreads narrower
        const baseMeters = spread / (2.5 * choke.factor);
        const minMeters = baseMeters * 0.9;
        const maxMeters = baseMeters * 1.1;
        setEstimatedDistance(`${minMeters.toFixed(1)} - ${maxMeters.toFixed(1)} Metre`);
        setClassification('Saçma Dağılımına Bağlı Mesafe');
      } else {
        setEstimatedDistance('Belirsiz');
        setClassification('Dağılım Çapı Giriniz');
      }
    } else {
      // Handgun / Rifle logic based on forensic stippling & soot marks
      if (hasBurn) {
        setEstimatedDistance('0 - 5 cm');
        setClassification('Bitişik veya Bitişiğe Yakın Atış');
      } else if (hasSoot && hasStippling) {
        setEstimatedDistance('5 - 35 cm');
        setClassification('Yakın Atış (Yoğun İs ve Barut Dövmesi)');
      } else if (hasStippling && !hasSoot) {
        setEstimatedDistance('35 - 100 cm');
        setClassification('Orta Mesafe Atış (Barut Dövmesi Mevcut)');
      } else if (hasWipe && !hasStippling && !hasSoot) {
        setEstimatedDistance('100+ cm (Uzak Atış)');
        setClassification('Uzak Atış (Sadece Giriş Deliği ve Mermi Sıyrığı)');
      } else {
        setEstimatedDistance('Belirsiz');
        setClassification('Bulguları Güncelleyiniz');
      }
    }
  }, [weaponType, spread, choke, hasBurn, hasSoot, hasStippling, hasWipe]);

  const report = useMemo(() => {
    const weaponName = weaponType === 'handgun' ? 'Tabanca' : weaponType === 'rifle' ? 'Yivli Tüfek' : 'Yivsiz Av Tüfeği';
    const bulgular: string[] = weaponType === 'shotgun'
      ? [`Saçma dağılım çapı: ${spread} cm`, `Namlu şoku (choke): ${choke.name}`]
      : ([
        hasBurn ? 'Alev/sıcaklık yanığı mevcut' : 'Alev yanığı yok',
        hasSoot ? 'İs (kurum) lekesi mevcut' : 'İs lekesi yok',
        hasStippling ? 'Barut dövmesi (stippling) mevcut' : 'Barut dövmesi yok',
        hasWipe ? 'Giriş halkası/mermi sıyrığı mevcut' : 'Giriş halkası yok',
      ]);
    return ({
      title: 'ATIŞ MESAFESİ İNCELEMESİ (BARUT ARTIĞI)',
      topic: 'Ateşli silah yaralanmasında hedefte tespit edilen barut artığı bulgularından hareketle, atış mesafesinin adli balistik yönünden tahmini ve değerlendirilmesi.',
      evidence: [`Silah tipi: ${weaponName}`, ...bulgular],
      method: [
        'Bulguların mesafe-bağımlı dağılım şablonlarıyla karşılaştırılması (sınıflar: bitişik/ yakın/ orta/ uzak atış sınıflaması).',
        'Yivsiz silahta saçma dağılımı ölçütü: mesafe ≈ çap / (2.5 × şok faktörü) [metre]; ±%10 saçma varyansı uygulanmıştır.',
        'Sınıflama, kriminal laboratuvar karşılaştırma standartlarına dayalı genel aralıklardır.',
      ],
      findings: [
        `Atış tipi (sınıflama): ${classification}`,
        `Tahmini atış mesafesi: ${estimatedDistance}`,
        weaponType === 'shotgun'
          ? 'Not: dağılım çapı tek eksende ölçülmüşse en uzun ve en kısa ekseni ayrıca ölçmek aralığı iyileştirir.'
          : 'Not: bulgu yokluğu da bilgidir; hiçbir patlama bulgusu yoksa uzak atış (100 cm+) ihtimali güçlenir.',
      ],
      scenarios: [
        'Kıyafet/ara katman: kalın giysi is ve dövmeyi emebilir → gerçek mesafe tahminden DAHA UZUN olabilir; kıyafet incelenmelidir.',
        'Ara hedef (cam, kapı): artıkları saptırır veya delikten geçen merminin davranışını değiştirir → sınıflama güvenilmez hale gelir.',
        'Bitişik atışta kemik üzeri delik yıldız şeklini alır; yumuşak dokuda görünmeyebilir → tip yanlış sınıflanabilir.',
        'Namlu uzunluğu ve mühimmat markası dağılımı değiştirir; tablolar ortalama namlu/kartuş içindir → laboratuvar karşılaştırması önerilir.',
        'Yüksek nem/yağmur yanmamış barutun menzilini kısaltır → dövme mesafe eşiği kayar.',
        'Açılı (tangansiyel) atışta bulgular tek tarafa yoğunlaşır; mesafe tahmini yanıltıcı olabilir.',
        'Sahada rüzgar/açık hava: is ve hafif dövmeye ilişkin bulgular zayıflayabilir → üst mesafe sınırı kullanılmalıdır.',
        'Laboratuvar (SEM-EDX, parafin (dermo) testi, GSR) analizi yapılmadıysa mesafe tahmini gösterge niteliğindedir.',
      ],
      conclusion: [
        `İnceleme sonucunda atışın “${classification}” sınıfına girdiği ve mesafenin yaklaşık ${estimatedDistance} olduğu kanaatine varılmıştır.`,
        'Kesinleştirme için kıyafet/GSR laboratuvar incelemesi ve silah-mühimmat karşılaştırma atışları önerilir.',
      ],
      caveats: [
        'Aralıklar; mühimmat, namlu ve hedef yüzeye göre değişebilir; tablo değerleri genel ortalama içindir.',
        'Birden fazla atış varsa bulgular karışabilir; giriş çıkış delikleri ayrıştırılmalıdır.',
        'Rapor, muayene anındaki görsel bulgulara dayanır; nihai kanaat adli tıp/kriminal değerlendirmesiyle birlikte oluşmalıdır.',
      ],
    });
  }, [weaponType, spread, choke, hasBurn, hasSoot, hasStippling, hasWipe, classification, estimatedDistance]);
  const reportText = useMemo(() => formatForensicReport(report), [report]);
  const summaryText = useMemo(() => formatForensicSummary(report), [report]);

  const handleAddToCanvas = () => {
    const seg = (ax: number, ay: number, bx: number, by: number, color: string, th = 3) => {
      const dx = bx - ax, dy = by - ay;
      addObject({ type: 'rect', x: ax, y: ay, width: Math.max(2, Math.sqrt(dx * dx + dy * dy)), height: th, rotation: (Math.atan2(dy, dx) * 180) / Math.PI, fill: color, stroke: color, strokeWidth: 0.5 });
    };

    const baseX = 230;
    const baseY = 290;
    const r = Math.max(14, Math.min(60, (spread * 3) / 2));
    const cx = baseX + 110;

    // Namlu
    addObject({ type: 'rect', x: baseX - 70, y: baseY - 4, width: 36, height: 8, cornerRadius: 2, fill: '#37474F', stroke: '#263238', strokeWidth: 1 });
    addObject({ type: 'text', text: 'Namlu', x: baseX - 70, y: baseY + 10, width: 60, fontSize: 9, fill: '#37474F', fontFamily: 'Inter', fontStyle: 'bold' });
    // Saçma yayılımı (daire — rect parçalarıyla)
    const N = 18;
    for (let i = 0; i < N; i++) {
      const a1 = (i / N) * 2 * Math.PI, a2 = ((i + 1) / N) * 2 * Math.PI;
      seg(cx + r * Math.cos(a1), baseY + r * Math.sin(a1), cx + r * Math.cos(a2), baseY + r * Math.sin(a2), '#FF5722', 2.5);
    }
    addObject({ type: 'text', text: `Yayılım: ${trNum(spread, 1)} cm`, x: cx - 44, y: baseY - r - 22, width: 140, fontSize: 10, fill: '#FF5722', fontFamily: 'Inter', fontStyle: 'bold' });
    // Hedef levha
    addObject({ type: 'rect', x: baseX + 220, y: baseY - 55, width: 10, height: 110, fill: '#CFD8DC', stroke: '#90A4AE', strokeWidth: 1.5 });
    // Mesafe (kesikli)
    addObject({ type: 'line', x: baseX + 20, y: baseY + 34, width: 200, height: 2, dash: [5, 5], fill: '#546E7A' });
    addObject({ type: 'text', text: `Tahmini mesafe: ${estimatedDistance}`, x: baseX + 30, y: baseY + 42, width: 240, fontSize: 11, fill: '#37474F', fontFamily: 'Inter', fontStyle: 'bold' });

    addObject({
      type: 'text',
      text: summaryText,
      x: baseX - 20,
      y: baseY + 72,
      width: 320,
      fontSize: 10,
      fill: '#000000',
      fontFamily: 'Inter',
      fontStyle: 'bold',
    });
    addNotification({ type: 'success', message: 'Şema ve kısa özet tuvale aktarıldı' });
  };

  return (
    <div className="space-y-6 p-1 relative">
      <HelpTooltip 
        title="Atış Mesafesi Tahmini"
        description="Ateşli silah yaralanmalarında hedefte kalan barut artıkları, yanıklar, is ve saçma dağılımından yola çıkarak atış mesafesini tahmin eder."
        formula="Görsel & Dağılım Çapı Korelasyonu"
        usage="Silah tipini seçin. Tabanca/Tüfek için ciltteki/kıyafetteki bulguları işaretleyin. Av tüfeği için saçma dağılımı çapını girin."
      />

      <div className="space-y-4">
        {/* Weapon Type */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Target size={12} className="text-[#F5C518]" />
            SİLAH / NAMLULU ALET TİPİ
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['handgun', 'rifle', 'shotgun'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setWeaponType(type)}
                className={`px-2 py-2.5 rounded-xl border text-[9px] font-black transition-all text-center uppercase tracking-wider ${
                  weaponType === type 
                    ? 'bg-[#F5C518] border-[#F5C518] text-black shadow-lg shadow-[#F5C518]/10' 
                    : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:border-gray-600'
                }`}
              >
                {type === 'handgun' ? 'Tabanca' : type === 'rifle' ? 'Yivli Tüfek' : 'Av Tüfeği'}
              </button>
            ))}
          </div>
        </div>

        {weaponType === 'shotgun' ? (
          /* Shotgun Section */
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                <Target size={12} className="text-red-400" />
                Saçma Dağılım Çapı (cm)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={spread}
                  onChange={(e) => setSpread(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-red-500/50 outline-none transition-all font-mono"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">CM</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                <Info size={12} className="text-[#F5C518]" />
                Namlu Şok Tipi (Choke)
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {CHOKE_TYPES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setChoke(c)}
                    className={`w-full flex justify-between items-center px-4 py-2.5 rounded-xl border text-[9px] font-black transition-all ${
                      choke.id === c.id 
                        ? 'bg-[#F5C518]/20 border-[#F5C518]/50 text-[#F5C518]' 
                        : 'bg-[#1a1a1a] border-[#333] text-gray-500'
                    }`}
                  >
                    <span className="uppercase">{c.name}</span>
                    <span className="text-[8px] font-mono opacity-60">Faktör: {c.factor}x</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Handgun / Rifle Section */
          <div className="space-y-3 animate-in fade-in duration-200 bg-[#161616] p-4 border border-[#2a2a2a] rounded-2xl">
            <span className="text-[10px] font-bold text-gray-400 uppercase block mb-2 border-b border-[#222] pb-1.5">
              HEDEFTEKİ BULGULARI İŞARETLEYİN
            </span>

            <label className="flex items-center gap-3 py-2 px-1 hover:bg-white/5 rounded-lg cursor-pointer transition-colors group">
              <input
                type="checkbox"
                checked={hasBurn}
                onChange={(e) => setHasBurn(e.target.checked)}
                className="rounded border-[#333] text-[#F5C518] focus:ring-[#F5C518] bg-[#111] w-4 h-4"
              />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-200 uppercase flex items-center gap-1 group-hover:text-red-400 transition-colors">
                  <Flame size={12} className="text-red-500" /> Alev / Sıcaklık Yanığı
                </span>
                <span className="text-[8px] text-gray-600">Doku veya kıyafette kavrulma, alev izi</span>
              </div>
            </label>

            <label className="flex items-center gap-3 py-2 px-1 hover:bg-white/5 rounded-lg cursor-pointer transition-colors group">
              <input
                type="checkbox"
                checked={hasSoot}
                onChange={(e) => setHasSoot(e.target.checked)}
                className="rounded border-[#333] text-[#F5C518] focus:ring-[#F5C518] bg-[#111] w-4 h-4"
              />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-200 uppercase flex items-center gap-1 group-hover:text-gray-300 transition-colors">
                  <Shield size={12} className="text-gray-500" /> İs Dumanı / Kurum Lekesi
                </span>
                <span className="text-[8px] text-gray-600">Delik çevresinde kolayca silinebilen gri/kara leke</span>
              </div>
            </label>

            <label className="flex items-center gap-3 py-2 px-1 hover:bg-white/5 rounded-lg cursor-pointer transition-colors group">
              <input
                type="checkbox"
                checked={hasStippling}
                onChange={(e) => setHasStippling(e.target.checked)}
                className="rounded border-[#333] text-[#F5C518] focus:ring-[#F5C518] bg-[#111] w-4 h-4"
              />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-200 uppercase flex items-center gap-1 group-hover:text-orange-400 transition-colors">
                  <Target size={12} className="text-orange-500" /> Barut Dövmesi (Stippling)
                </span>
                <span className="text-[8px] text-gray-600">Yanmamış barut tanelerinin cilde saplanma izleri</span>
              </div>
            </label>

            <label className="flex items-center gap-3 py-2 px-1 hover:bg-white/5 rounded-lg cursor-pointer transition-colors group">
              <input
                type="checkbox"
                checked={hasWipe}
                onChange={(e) => setHasWipe(e.target.checked)}
                className="rounded border-[#333] text-[#F5C518] focus:ring-[#F5C518] bg-[#111] w-4 h-4"
              />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-200 uppercase flex items-center gap-1 group-hover:text-blue-400 transition-colors">
                  <Droplet size={12} className="text-blue-500" /> Giriş Halkası / Kurşun Sıyrığı
                </span>
                <span className="text-[8px] text-gray-600">Merminin deliği açarken bıraktığı yağ/is halkası</span>
              </div>
            </label>
          </div>
        )}

        {/* Results Card */}
        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
            <Target size={120} />
          </div>
          
          <div className="relative z-10 space-y-6">
            <div className="space-y-1 text-center">
              <div className="text-[8px] text-gray-500 uppercase font-black tracking-widest text-center">TAHMİNİ ATIŞ MESAFESİ</div>
              <div className="flex flex-col items-center justify-center gap-1">
                <span className="text-3xl font-black text-white tracking-tighter">{estimatedDistance}</span>
                <span className="text-[8px] font-bold text-[#F5C518] uppercase tracking-widest italic">{classification}</span>
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

        {/* Info Box */}
        <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl flex gap-3 items-start shadow-inner">
          <AlertTriangle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-[8px] font-bold text-orange-200/50 uppercase">ADLİ BALİSTİK NOTU</p>
            <p className="text-[8px] text-gray-600 leading-relaxed italic">
              Barut artıklarının dağılımı; mühimmat tipine, namlu uzunluğuna, nem oranına ve hedef yüzeyin (kıyafet vb.) karakteristiğine göre değişiklik gösterebilir. Bu değerler kriminal laboratuvar standartlarına göre genel tahminlerdir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
