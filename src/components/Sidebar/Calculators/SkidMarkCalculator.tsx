import React, { useState, useEffect, useMemo } from 'react';
import { Zap, Activity, Info, PlusCircle, TrendingUp, AlertTriangle, Truck, Car, Bike } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { HelpTooltip } from '../../UI/HelpTooltip';
import { formatForensicReport, trNum } from '../../../utils/forensicReport';
import { ForensicReportPreview } from '../../UI/ForensicReportPreview';

const SURFACE_TYPES = [
  { name: 'Asfalt (Kuru)', default: 0.75 },
  { name: 'Asfalt (Islak)', default: 0.5 },
  { name: 'Beton (Kuru)', default: 0.85 },
  { name: 'Beton (Islak)', default: 0.6 },
  { name: 'Çakıl Yol', default: 0.6 },
  { name: 'Toprak Yol', default: 0.5 },
];

const VEHICLE_TYPES = [
  { id: 'car_abs', name: 'Binek (ABS)', efficiency: 100, muMultiplier: 1.0, icon: <Car size={12} /> },
  { id: 'car_no_abs', name: 'Binek (ABS\'siz)', efficiency: 85, muMultiplier: 1.0, icon: <Car size={12} /> },
  { id: 'truck', name: 'Kamyon / Tır', efficiency: 75, muMultiplier: 0.85, icon: <Truck size={12} /> },
  { id: 'bus', name: 'Otobüs', efficiency: 80, muMultiplier: 0.90, icon: <Truck size={12} /> },
  { id: 'motorcycle', name: 'Motosiklet', efficiency: 70, muMultiplier: 0.95, icon: <Bike size={12} /> },
];

export const SkidMarkCalculator: React.FC = () => {
  const [distance, setDistance] = useState<number>(20);
  const [mu, setMu] = useState<number>(0.75);
  const [vehicleType, setVehicleType] = useState(VEHICLE_TYPES[0]);
  const [efficiency, setEfficiency] = useState<number>(100);
  const [speed, setSpeed] = useState<number>(0);
  const [speedMin, setSpeedMin] = useState<number>(0);
  const [speedMax, setSpeedMax] = useState<number>(0);
  const [gradeSpeed, setGradeSpeed] = useState<{ up: number; down: number }>({ up: 0, down: 0 });
  
  const { addObject } = useStore();

  useEffect(() => {
    setEfficiency(vehicleType.efficiency);
  }, [vehicleType]);

  useEffect(() => {
    if (distance > 0 && mu > 0) {
      const effectiveMu = mu * vehicleType.muMultiplier;
      const calculatedSpeed = 15.94 * Math.sqrt(effectiveMu * distance * (efficiency / 100));
      setSpeed(calculatedSpeed);

      // Belirsizlik aralığı: μ±0.05, iz boyu ±%5, verim ±%10
      const calc = (m: number, d: number, eff: number) =>
        15.94 * Math.sqrt(m * vehicleType.muMultiplier * d * (eff / 100));
      const muMin = Math.max(0.05, mu - 0.05);
      const muMax = Math.min(1.0, mu + 0.05);
      const dMin = distance * 0.95;
      const dMax = distance * 1.05;
      const effMin = Math.max(30, efficiency - 10);
      const effMax = Math.min(100, efficiency + 10);
      const candidates = [
        calc(muMin, dMin, effMin),
        calc(muMin, dMin, effMax),
        calc(muMax, dMax, effMin),
        calc(muMax, dMax, effMax),
      ];
      setSpeedMin(Math.min(...candidates));
      setSpeedMax(Math.max(...candidates));

      // Eğim senaryoları (±%10 eğim: μetkin = μ ± tan10° ≈ ±0.176)
      const tan10 = Math.tan((10 * Math.PI) / 180);
      setGradeSpeed({
        up: 15.94 * Math.sqrt(Math.min(1.0, mu + tan10) * vehicleType.muMultiplier * distance * (efficiency / 100)),
        down: 15.94 * Math.sqrt(Math.max(0.05, mu - tan10) * vehicleType.muMultiplier * distance * (efficiency / 100)),
      });
    } else {
      setSpeed(0);
      setSpeedMin(0);
      setSpeedMax(0);
      setGradeSpeed({ up: 0, down: 0 });
    }
  }, [distance, mu, efficiency, vehicleType]);

  const report = useMemo(() => ({
    title: 'FREN İZİ (SKID MARK) İNCELEMESİ',
    topic: 'Kaza yerinde tespit edilen fren izi uzunluğu ile zemin sürtünme katsayısı ve araç fren karakteristiğinden hareketle, aracın frenleme başlangıcındaki hızının adli teknik yönden değerlendirilmesi.',
    evidence: [
      `Fren izi uzunluğu: ${distance} m (ölçüm hata payı ±%5)`,
      `Zemin tipi/katsayısı: μ=${mu.toFixed(2)} (katsayı belirsizliği ±0.05)`,
      `Araç tipi: ${vehicleType.name} — fren verimi %${efficiency} (±10 puan)`,
    ],
    method: [
      'Kinetik enerji-iş denklemi: v = √(2·μ·g·d·η), pratik form: v = 15.94·√(μ·d·η) [km/s, d metre].',
      'Tüm tekerleklerin kilitli olduğu ve iz boyunca tam frenlemenin sürdüğü varsayılmıştır.',
      'Belirsizlik analizi: μ±0.05, iz boyu ±%5 ve verim ±%10 uç değerlerinin tüm kombinasyonlarıyla min–max hız hesaplanmıştır.',
    ],
    findings: [
      `Hesaplanan nokta hız: ${trNum(speed, 0)} km/s`,
      `Muhtemel hız aralığı: ${trNum(speedMin, 0)} – ${trNum(speedMax, 0)} km/s`,
      `Bu hız fren izinin BAŞLANGIÇ noktasına aittir; çarpma anındaki hız, frenleme sürdüyse bu değerin altındadır.`,
      `Eğim düzeltmeli alternatifler: %10 rampa yukarı ${trNum(gradeSpeed.up, 0)} km/s, %10 rampa aşağı ${trNum(gradeSpeed.down, 0)} km/s.`,
    ],
    scenarios: [
      'ABS aktif ise tekerlek kilitlenmez, iz kısa/kesik kalır → gerçek hız hesaplanandan DAHA YÜKSEK olabilir (alt sınır yorumu).',
      'Kısmi (tam olmayan) frenlemede enerji kaybı azalır → hesaplanan hız gerçek hızın alt sınırını verir.',
      'Motor freni ve hava direnci ek yavaşlatma sağlar → minimum hız yorumunu destekler.',
      'Yokuş yukarı frenlemede eğim ek yavaşlatma yapar → gerçek hız hesaplanandan düşük çıkabilir (eğim düzeltmesi gerekir).',
      'Yokuş aşağı frenlemede hesap gerçek hızdan YÜKSEK çıkabilir → eğim düzeltmesi yapılmadan sonuç kullanılmamalıdır.',
      'İz çarpma anından önce sona ermişse sürücü freni bırakmış olabilir → çarpma anı hızı ayrı değerlendirilmelidir.',
      'Islak/karlı zeminde yer yer kayganlık iz boyunu uzatır → üst aralık sınırı daha temsili olabilir.',
      'Ağır vasıtada yük kayması veya fren fade (ısınma) verimi düşürür → gerçek hız alt aralığa yakın olur.',
    ],
    conclusion: [
      `İnceleme sonucunda aracın fren izinin başladığı andaki hızının en az ${trNum(speed, 0)} km/s, ölçüm belirsizlikleri hesaba katıldığında ${trNum(speedMin, 0)} – ${trNum(speedMax, 0)} km/s aralığında bulunduğu kanaatine varılmıştır.`,
      'Kesin değere ilişkin sağlam kanıt, zeminde yapılacak çekme (drag) testi veya araç EDR verisidir.',
    ],
    caveats: [
      'Sonuç; iz boyu, μ ve fren verimi ölçümlerinin saha doğruluğuna bağımlıdır.',
      'ABS/kilitlenmesiz frenlemede formül yalnızca alt sınır verir; mutlak hız olarak okunmamalıdır.',
      'Eğim, yük durumu ve lastik durumu için verim/katsayı manuel düzeltmesi yapılmadıkça sonuç yerel doğruluk taşır.',
    ],
  }), [speed, speedMin, speedMax, gradeSpeed, distance, mu, efficiency, vehicleType]);
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
    <div className="space-y-6 relative">
      <HelpTooltip 
        title="Fren İzi Analizi"
        description="Fren izi uzunluğu ve zemin sürtünmesinden yola çıkarak aracın fren anındaki minimum hızını hesaplar."
        formula="v = 15.94 * sqrt(μ * d * η * k)"
        usage="Zemin tipini seçin, fren izi uzunluğunu girin ve araç modelini belirleyin. ABS durumu verimi (%) otomatik ayarlar."
      />
      <div className="space-y-4 p-1">
        {/* Vehicle Type Selection */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Info size={12} className="text-[#F5C518]" />
            Araç Modeli / Tipi
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {VEHICLE_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setVehicleType(type)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[9px] font-black transition-all ${
                  vehicleType.id === type.id 
                    ? 'bg-[#F5C518] border-[#F5C518] text-black shadow-lg shadow-[#F5C518]/20' 
                    : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:border-gray-600'
                }`}
              >
                {type.icon}
                {type.name.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Distance Input */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Zap size={12} className="text-[#F5C518]" />
            Fren İzi Uzunluğu (Metre)
          </label>
          <div className="relative">
            <input
              type="number"
              value={distance}
              onChange={(e) => setDistance(Math.max(0, Number(e.target.value)))}
              className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white focus:border-[#F5C518]/50 outline-none transition-all font-mono"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600">M</span>
          </div>
        </div>

        {/* Friction Coefficient */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <TrendingUp size={12} className="text-[#F5C518]" />
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

        {/* Efficiency */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
            <Activity size={12} className="text-[#F5C518]" />
            Fren Verimi (Araç Durumu): %{efficiency}
          </label>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={efficiency}
            onChange={(e) => setEfficiency(parseInt(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#F5C518]"
          />
          <p className="text-[8px] text-gray-600 italic">
            * ABS'li binek araçlarda genellikle %100, ABS'sizlerde %80-90 civarıdır.
          </p>
        </div>

        {/* Results Card */}
        <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] border border-[#333] rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <Zap size={80} className="text-[#F5C518]" />
          </div>
          
          <div className="relative z-10 space-y-4">
            <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest text-center">TAHMİNİ HIZ</div>
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

            <button
              onClick={handleAddToCanvas}
              className="w-full flex items-center justify-center gap-2 py-4 bg-[#F5C518] text-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[#ffcf24] transition-all shadow-lg active:scale-95"
            >
              <PlusCircle size={14} />
              RAPORA EKLE
            </button>
          </div>
        </div>

        <ForensicReportPreview text={reportText} report={report} />

        <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl flex gap-3 items-start">
          <AlertTriangle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-orange-200">ADLİ ANALİZ NOTU</p>
            <p className="text-[8px] text-gray-500 leading-relaxed italic">
              Bu hesaplama, belirlenen araç tipinin standart ağırlık ve fren karakteristiği üzerinden yapılmaktadır. 
              Eğim, aşırı yük ve lastik aşınması gibi faktörler için verim ayarını manuel güncelleyiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
