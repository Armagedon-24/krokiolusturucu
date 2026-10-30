import React, { useState } from 'react';
import { Car, RotateCcw, Settings, ChevronDown, ChevronUp, AlertTriangle, Eye, User, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import type { VehicleType, VehicleData } from '../../../types';
import { AccidentAnimationPlayer } from '../../UI/AccidentAnimationPlayer';

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'car', label: 'Otomobil' },
  { value: 'suv', label: 'SUV' },
  { value: 'truck', label: 'Kamyon' },
  { value: 'bus', label: 'Otobüs' },
  { value: 'motorcycle', label: 'Motosiklet' },
  { value: 'van', label: 'Minibüs' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'other', label: 'Diğer' },
];

const ROAD_SURFACES = [
  { value: 'asphalt_dry', label: 'Asfalt (Kuru)', friction: 0.7 },
  { value: 'asphalt_wet', label: 'Asfalt (Islak)', friction: 0.5 },
  { value: 'concrete_dry', label: 'Beton (Kuru)', friction: 0.8 },
  { value: 'concrete_wet', label: 'Beton (Islak)', friction: 0.6 },
  { value: 'gravel', label: 'Çakıl/Stabilize', friction: 0.5 },
  { value: 'soil', label: 'Toprak', friction: 0.4 },
  { value: 'snow', label: 'Kar', friction: 0.2 },
  { value: 'ice', label: 'Buz', friction: 0.1 },
];

const WEATHER_OPTIONS = [
  { value: 'clear', label: 'Açık' },
  { value: 'rain', label: 'Yağmurlu' },
  { value: 'snow', label: 'Karlı' },
  { value: 'fog', label: 'Sisli' },
  { value: 'night', label: 'Gece' },
  { value: 'dawn_dusk', label: 'Şafak/Alacakaranlık' },
];

const LIGHTING_OPTIONS = [
  { value: 'daylight', label: 'Gün Işığı' },
  { value: 'street_light', label: 'Sokak Lambası' },
  { value: 'no_lighting', label: 'Işık Yok' },
  { value: 'twilight', label: 'Alacakaranlık' },
];

const ROAD_TYPES = [
  { value: 'highway', label: 'Otoyol' },
  { value: 'urban', label: 'Şehir İçi' },
  { value: 'rural', label: 'Şehir Dışı' },
  { value: 'intersection', label: 'Kavşak' },
  { value: 'parking_lot', label: 'Otopark' },
  { value: 'other', label: 'Diğer' },
];

const INPUT_CLASS = "w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm font-bold text-white focus:border-[#F5C518]/50 focus:ring-1 focus:ring-[#F5C518]/50 outline-none transition-all";
const LABEL_CLASS = "block text-[9px] font-bold text-gray-500 uppercase tracking-wide mb-1";
const SELECT_CLASS = "w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm font-bold text-white focus:border-[#F5C518]/50 outline-none transition-all cursor-pointer";

export const AccidentReconstructionCalculator: React.FC = () => {
  const {
    accidentReconstruction, setAccidentData,
    setAccidentVehicle, setAccidentAnimation,
    accidentAnimation, resetAccidentReconstruction,
    addPedestrian, updatePedestrian, removePedestrian,
    addObject, showConfirm,
  } = useStore();

  const [activeVehicleTab, setActiveVehicleTab] = useState<0 | 1>(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [hasSecondVehicle, setHasSecondVehicle] = useState(
    accidentReconstruction.vehicles.length > 1
  );

  const currentVehicle = accidentReconstruction.vehicles[activeVehicleTab];

  const handleVehicleField = (field: string, value: any) => {
    setAccidentVehicle(activeVehicleTab, { [field]: value });
  };

  const handleSurfaceChange = (value: string) => {
    const surface = ROAD_SURFACES.find(s => s.value === value);
    setAccidentData({ roadSurface: value as any, frictionCoefficient: surface?.friction ?? 0.7 });
  };

  const toggleSecondVehicle = () => {
    if (hasSecondVehicle) {
      setAccidentData({ vehicles: [accidentReconstruction.vehicles[0]] as [VehicleData, VehicleData?] });
      setHasSecondVehicle(false);
    } else {
      const v2: VehicleData = {
        id: 'v2',
        type: 'car',
        name: 'Araç 2',
        color: '#1E88E5',
        startX: 600,
        startY: 300,
        startRotation: 180,
        initialSpeed: 50,
        brakeReactionTime: 0.8,
        brakeEfficiency: 85,
        brakeMarkLength: 15,
        brakeMarkWidth: 0.3,
        brakeMarkType: 'straight',
        brakeMarkCurvature: 0,
        collisionX: 600,
        collisionY: 500,
        impactSpeed: 25,
        impactAngle: 0,
        finalX: 500,
        finalY: 700,
        finalRotation: 180,
        showPath: true,
        showBrakeMarks: true,
        showVehicle: true,
        evasiveAction: 'none',
        evasiveOffset: 0,
        evasiveStartProgress: 0.3,
      };
      setAccidentData({ vehicles: [accidentReconstruction.vehicles[0], v2] as [VehicleData, VehicleData?] });
      setHasSecondVehicle(true);
    }
  };

  const handleAddToCanvas = () => {
    const baseX = 200;
    const baseY = 200;

    accidentReconstruction.vehicles.filter((v): v is VehicleData => !!v).forEach((v) => {
      addObject({
        type: 'rect',
        x: baseX + v.startX,
        y: baseY + v.startY,
        width: 60,
        height: 30,
        rotation: v.startRotation,
        fill: v.color,
        stroke: '#000',
        strokeWidth: 1,
      });

      addObject({
        type: 'line',
        x: baseX + v.startX,
        y: baseY + v.startY,
        width: Math.abs(v.collisionX - v.startX) + Math.abs(v.finalX - v.collisionX) + 20,
        height: Math.abs(v.collisionY - v.startY) + Math.abs(v.finalY - v.collisionY) + 20,
        fill: v.color,
        points: [
          0, 0,
          v.collisionX - v.startX, v.collisionY - v.startY,
          v.finalX - v.startX, v.finalY - v.startY,
        ],
        dash: [6, 4],
        stroke: v.color,
        strokeWidth: 2,
      });

      if (v.showBrakeMarks && v.brakeMarkType !== 'none') {
        const brakeStartX = baseX + v.startX + (v.collisionX - v.startX) * 0.3;
        const brakeStartY = baseY + v.startY + (v.collisionY - v.startY) * 0.3;
        const pts: number[] = [];
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          const bx = brakeStartX + (baseX + v.collisionX - brakeStartX) * t;
          const by = brakeStartY + (baseY + v.collisionY - brakeStartY) * t;
          const curve = v.brakeMarkType === 'curved' ? Math.sin(t * Math.PI) * v.brakeMarkCurvature * 15 : 0;
          const dx = v.collisionX - v.startX;
          const dy = v.collisionY - v.startY;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          pts.push(bx + (-dy / len) * curve - baseX, by + (dx / len) * curve - baseY);
        }
        addObject({
          type: 'line',
          x: baseX,
          y: baseY,
          width: Math.abs(v.collisionX - v.startX) + 40,
          height: Math.abs(v.collisionY - v.startY) + 40,
          points: pts,
          stroke: '#333',
          strokeWidth: Math.max(2, v.brakeMarkWidth * 3),
        });
      }

      addObject({
        type: 'rect',
        x: baseX + v.collisionX - 5,
        y: baseY + v.collisionY - 5,
        width: 10,
        height: 10,
        rotation: 45,
        fill: '#FF5722',
        stroke: '#fff',
        strokeWidth: 2,
      });

      addObject({
        type: 'text',
        text: `${v.name}: ${v.initialSpeed} km/h`,
        x: baseX + v.startX - 20,
        y: baseY + v.startY - 25,
        width: 120,
        fontSize: 10,
        fill: '#333',
        fontFamily: 'Inter',
        fontStyle: 'bold',
      });

      addObject({
        type: 'text',
        text: `Çarpışma: ${v.impactSpeed} km/h ${v.impactAngle}°`,
        x: baseX + v.collisionX + 10,
        y: baseY + v.collisionY - 10,
        width: 140,
        fontSize: 9,
        fill: '#E53935',
        fontFamily: 'Inter',
        fontStyle: 'bold',
      });
    });

    const surfaceLabels: Record<string, string> = {
      asphalt_dry: 'Asfalt (Kuru)', asphalt_wet: 'Asfalt (Islak)',
      concrete_dry: 'Beton (Kuru)', concrete_wet: 'Beton (Islak)',
      gravel: 'Çakıl', soil: 'Toprak', snow: 'Kar', ice: 'Buz',
    };
    addObject({
      type: 'text',
      text: `KAZA YENİDEN CANLANDIRMA\nYol: ${surfaceLabels[accidentReconstruction.roadSurface] || accidentReconstruction.roadSurface}\nμ: ${accidentReconstruction.frictionCoefficient} | Hız Limiti: ${accidentReconstruction.speedLimit} km/h\nHava: ${accidentReconstruction.weather} | Aydınlatma: ${accidentReconstruction.lighting}`,
      x: baseX + 10,
      y: baseY - 80,
      width: 260,
      fontSize: 10,
      fill: '#000',
      fontFamily: 'Inter',
      fontStyle: 'bold',
    });

    // Draw pedestrians
    (accidentReconstruction.pedestrians || []).filter(p => p.show).forEach((p) => {
      const px = baseX + p.startX;
      const py = baseY + p.startY;
      const pSize = p.size === 'child' ? 10 : 16;

      addObject({
        type: 'image',
        symbolId: 'pedestrian',
        x: px - pSize,
        y: py - pSize * 2.5,
        width: pSize * 2,
        height: pSize * 2.5,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        fill: p.color,
        stroke: '#000',
        strokeWidth: 1,
      });

      addObject({
        type: 'line',
        x: baseX,
        y: baseY,
        width: Math.abs(p.endX - p.startX) + 20,
        height: Math.abs(p.endY - p.startY) + 20,
        points: [
          p.startX, p.startY,
          p.endX, p.endY,
        ],
        dash: [4, 4],
        stroke: p.color,
        strokeWidth: 1.5,
      });

      addObject({
        type: 'text',
        text: `${p.name} (${p.speed} km/h)`,
        x: px - 30,
        y: py - pSize * 2.5 - 20,
        width: 100,
        fontSize: 9,
        fill: '#333',
        fontFamily: 'Inter',
        fontStyle: 'bold',
      });
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2a2a2a] bg-[#111] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-red-500/10 rounded-lg border border-red-500/20">
            <AlertTriangle size={14} className="text-red-400" />
          </div>
          <h3 className="text-[11px] font-bold text-gray-100 tracking-wide uppercase">Kaza Yeniden Canlandırma</h3>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4 space-y-4">
          {/* Vehicle Tabs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Araç Bilgileri</span>
              <button
                onClick={toggleSecondVehicle}
                className={`text-[10px] font-bold px-3 py-1 rounded-md border transition-all ${
                  hasSecondVehicle
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                }`}
              >
                {hasSecondVehicle ? 'Tek Araç' : 'İkinci Araç Ekle'}
              </button>
            </div>

            <div className="flex gap-1">
              {accidentReconstruction.vehicles.filter((v): v is VehicleData => !!v).map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => setActiveVehicleTab(i as 0 | 1)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-bold transition-all ${
                    activeVehicleTab === i
                      ? 'bg-red-500/10 border-red-500/40 text-red-400'
                      : 'bg-[#111] border-[#333] text-gray-500 hover:border-[#555]'
                  }`}
                >
                  <Car size={14} />
                  {v.name}
                </button>
              ))}
            </div>

            {currentVehicle && (
              <div className="bg-[#111] border border-[#333] rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={LABEL_CLASS}>İsim</label>
                    <input className={INPUT_CLASS} value={currentVehicle.name}
                      onChange={e => handleVehicleField('name', e.target.value)} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Tür</label>
                    <select className={SELECT_CLASS} value={currentVehicle.type}
                      onChange={e => handleVehicleField('type', e.target.value)}>
                      {VEHICLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Renk</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" className="w-9 h-9 rounded-lg border border-[#333] cursor-pointer bg-transparent"
                        value={currentVehicle.color}
                        onChange={e => handleVehicleField('color', e.target.value)} />
                      <span className="text-xs text-gray-500 font-mono">{currentVehicle.color}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#2a2a2a] pt-3">
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide block mb-2">Başlangıç Konumu</span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={LABEL_CLASS}>X (px)</label>
                      <input type="number" className={INPUT_CLASS} value={currentVehicle.startX}
                        onChange={e => handleVehicleField('startX', Number(e.target.value))} />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Y (px)</label>
                      <input type="number" className={INPUT_CLASS} value={currentVehicle.startY}
                        onChange={e => handleVehicleField('startY', Number(e.target.value))} />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Yön (°)</label>
                      <input type="number" className={INPUT_CLASS} value={currentVehicle.startRotation}
                        onChange={e => handleVehicleField('startRotation', Number(e.target.value))} />
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#2a2a2a] pt-3">
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide block mb-2">Hız & Fren</span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={LABEL_CLASS}>Başlangıç Hızı (km/h)</label>
                      <input type="number" className={INPUT_CLASS} value={currentVehicle.initialSpeed}
                        onChange={e => handleVehicleField('initialSpeed', Number(e.target.value))} />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Tepki Süresi (sn)</label>
                      <input type="number" step="0.1" className={INPUT_CLASS} value={currentVehicle.brakeReactionTime}
                        onChange={e => handleVehicleField('brakeReactionTime', Number(e.target.value))} />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Fren Verimi (%)</label>
                      <input type="number" className={INPUT_CLASS} value={currentVehicle.brakeEfficiency}
                        onChange={e => handleVehicleField('brakeEfficiency', Number(e.target.value))} />
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#2a2a2a] pt-3">
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide block mb-2">Fren İzi</span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={LABEL_CLASS}>Uzunluk (m)</label>
                      <input type="number" step="0.1" className={INPUT_CLASS} value={currentVehicle.brakeMarkLength}
                        onChange={e => handleVehicleField('brakeMarkLength', Number(e.target.value))} />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Genişlik (m)</label>
                      <input type="number" step="0.01" className={INPUT_CLASS} value={currentVehicle.brakeMarkWidth}
                        onChange={e => handleVehicleField('brakeMarkWidth', Number(e.target.value))} />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Tip</label>
                      <select className={SELECT_CLASS} value={currentVehicle.brakeMarkType}
                        onChange={e => handleVehicleField('brakeMarkType', e.target.value)}>
                        <option value="straight">Düz</option>
                        <option value="curved">Kavisli</option>
                        <option value="yaw">Savrulma</option>
                        <option value="none">Yok</option>
                      </select>
                    </div>
                  </div>
                  {currentVehicle.brakeMarkType === 'curved' && (
                    <div className="mt-2">
                      <label className={LABEL_CLASS}>Kavis Derecesi</label>
                      <input type="number" step="0.1" className={INPUT_CLASS} value={currentVehicle.brakeMarkCurvature}
                        onChange={e => handleVehicleField('brakeMarkCurvature', Number(e.target.value))} />
                    </div>
                  )}
                </div>

                <div className="border-t border-[#2a2a2a] pt-3">
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide block mb-2">Çarpışma & Son Durum</span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={LABEL_CLASS}>Çarpışma X</label>
                      <input type="number" className={INPUT_CLASS} value={currentVehicle.collisionX}
                        onChange={e => handleVehicleField('collisionX', Number(e.target.value))} />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Çarpışma Y</label>
                      <input type="number" className={INPUT_CLASS} value={currentVehicle.collisionY}
                        onChange={e => handleVehicleField('collisionY', Number(e.target.value))} />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Çarpışma Hızı (km/h)</label>
                      <input type="number" className={INPUT_CLASS} value={currentVehicle.impactSpeed}
                        onChange={e => handleVehicleField('impactSpeed', Number(e.target.value))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <div>
                      <label className={LABEL_CLASS}>Çarpışma Açısı (°)</label>
                      <input type="number" className={INPUT_CLASS} value={currentVehicle.impactAngle}
                        onChange={e => handleVehicleField('impactAngle', Number(e.target.value))} />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Son X</label>
                      <input type="number" className={INPUT_CLASS} value={currentVehicle.finalX}
                        onChange={e => handleVehicleField('finalX', Number(e.target.value))} />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Son Y</label>
                      <input type="number" className={INPUT_CLASS} value={currentVehicle.finalY}
                        onChange={e => handleVehicleField('finalY', Number(e.target.value))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <div>
                      <label className={LABEL_CLASS}>Son Yön (°)</label>
                      <input type="number" className={INPUT_CLASS} value={currentVehicle.finalRotation}
                        onChange={e => handleVehicleField('finalRotation', Number(e.target.value))} />
                    </div>
                    <div className="flex items-end gap-3 pb-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={currentVehicle.showVehicle}
                          onChange={e => handleVehicleField('showVehicle', e.target.checked)}
                          className="accent-[#F5C518]" />
                        <span className="text-[10px] text-gray-400">Göster</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={currentVehicle.showPath}
                          onChange={e => handleVehicleField('showPath', e.target.checked)}
                          className="accent-[#F5C518]" />
                        <span className="text-[10px] text-gray-400">Yol</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={currentVehicle.showBrakeMarks}
                          onChange={e => handleVehicleField('showBrakeMarks', e.target.checked)}
                          className="accent-[#F5C518]" />
                        <span className="text-[10px] text-gray-400">Fren İzi</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pedestrians */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Yayalar</span>
              <button
                onClick={() => addPedestrian()}
                className="flex items-center gap-1 px-3 py-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded-md hover:bg-blue-500/20 transition-all"
              >
                <Plus size={12} />
                YAYA EKLE
              </button>
            </div>
            {(!accidentReconstruction.pedestrians || accidentReconstruction.pedestrians.length === 0) ? (
              <div className="bg-[#111] border border-[#333] rounded-lg p-4">
                <p className="text-[10px] text-gray-500 text-center italic">Henüz yaya eklenmedi. "YAYA EKLE" butonuna tıklayarak yaya ekleyebilirsiniz.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                {accidentReconstruction.pedestrians.map((pedestrian) => (
                  <div key={pedestrian.id} className="bg-[#111] border border-[#333] rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-green-500/10 rounded border border-green-500/20">
                          <User size={12} className="text-green-400" />
                        </div>
                        <input className="w-28 bg-transparent border-b border-[#333] text-xs font-bold text-white focus:border-[#F5C518] outline-none pb-0.5"
                          value={pedestrian.name}
                          onChange={e => updatePedestrian(pedestrian.id, { name: e.target.value })} />
                      </div>
                      <button
                        onClick={() => {
                          showConfirm({
                            title: 'YAYAYI KALDIR',
                            message: `"${pedestrian.name}" silinecektir. Devam etmek istiyor musunuz?`,
                            onConfirm: () => removePedestrian(pedestrian.id)
                          });
                        }}
                        className="p-1 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className={LABEL_CLASS}>Başlangıç X</label>
                        <input type="number" className={INPUT_CLASS} value={pedestrian.startX}
                          onChange={e => updatePedestrian(pedestrian.id, { startX: Number(e.target.value) })} />
                      </div>
                      <div>
                        <label className={LABEL_CLASS}>Başlangıç Y</label>
                        <input type="number" className={INPUT_CLASS} value={pedestrian.startY}
                          onChange={e => updatePedestrian(pedestrian.id, { startY: Number(e.target.value) })} />
                      </div>
                      <div>
                        <label className={LABEL_CLASS}>Hız (km/h)</label>
                        <input type="number" step="0.5" className={INPUT_CLASS} value={pedestrian.speed}
                          onChange={e => updatePedestrian(pedestrian.id, { speed: Number(e.target.value) })} />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className={LABEL_CLASS}>Bitiş X</label>
                        <input type="number" className={INPUT_CLASS} value={pedestrian.endX}
                          onChange={e => updatePedestrian(pedestrian.id, { endX: Number(e.target.value) })} />
                      </div>
                      <div>
                        <label className={LABEL_CLASS}>Bitiş Y</label>
                        <input type="number" className={INPUT_CLASS} value={pedestrian.endY}
                          onChange={e => updatePedestrian(pedestrian.id, { endY: Number(e.target.value) })} />
                      </div>
                      <div>
                        <label className={LABEL_CLASS}>Boyut</label>
                        <select className={SELECT_CLASS} value={pedestrian.size}
                          onChange={e => updatePedestrian(pedestrian.id, { size: e.target.value as 'adult' | 'child' })}>
                          <option value="adult">Yetişkin</option>
                          <option value="child">Çocuk</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <input type="color" className="w-7 h-7 rounded border border-[#333] cursor-pointer bg-transparent"
                            value={pedestrian.color}
                            onChange={e => updatePedestrian(pedestrian.id, { color: e.target.value })} />
                          <span className="text-[9px] text-gray-500 font-mono">{pedestrian.color}</span>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={pedestrian.show}
                            onChange={e => updatePedestrian(pedestrian.id, { show: e.target.checked })}
                            className="accent-[#F5C518]" />
                          <span className="text-[9px] text-gray-400">Göster</span>
                        </label>
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-[9px] text-gray-500">Görünme:</label>
                        <input type="number" min="0" max="1" step="0.05" className="w-16 bg-[#0a0a0a] border border-[#333] rounded px-2 py-1 text-[10px] font-bold text-white text-center"
                          value={pedestrian.appearProgress}
                          onChange={e => updatePedestrian(pedestrian.id, { appearProgress: Number(e.target.value) })} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Road & Environmental */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Yol & Çevre Bilgileri</span>
            <div className="bg-[#111] border border-[#333] rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLASS}>Yol Yüzeyi</label>
                  <select className={SELECT_CLASS} value={accidentReconstruction.roadSurface}
                    onChange={e => handleSurfaceChange(e.target.value)}>
                    {ROAD_SURFACES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Sürtünme Katsayısı (μ)</label>
                  <input type="number" step="0.01" min="0" max="1" className={INPUT_CLASS}
                    value={accidentReconstruction.frictionCoefficient}
                    onChange={e => setAccidentData({ frictionCoefficient: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Hava Durumu</label>
                  <select className={SELECT_CLASS} value={accidentReconstruction.weather}
                    onChange={e => setAccidentData({ weather: e.target.value as any })}>
                    {WEATHER_OPTIONS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Aydınlatma</label>
                  <select className={SELECT_CLASS} value={accidentReconstruction.lighting}
                    onChange={e => setAccidentData({ lighting: e.target.value as any })}>
                    {LIGHTING_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Yol Tipi</label>
                  <select className={SELECT_CLASS} value={accidentReconstruction.roadType}
                    onChange={e => setAccidentData({ roadType: e.target.value as any })}>
                    {ROAD_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASS}>Hız Limiti (km/h)</label>
                  <input type="number" className={INPUT_CLASS} value={accidentReconstruction.speedLimit}
                    onChange={e => setAccidentData({ speedLimit: Number(e.target.value) })} />
                </div>
              </div>

              {/* Advanced */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 mt-3 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                <Settings size={12} />
                Gelişmiş Animasyon Ayarları
                {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              {showAdvanced && (
                <div className="mt-3 pt-3 border-t border-[#2a2a2a] space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLASS}>Animasyon Süresi (sn)</label>
                      <input type="number" step="0.5" min="1" max="30" className={INPUT_CLASS}
                        value={accidentReconstruction.animationDuration}
                        onChange={e => setAccidentData({ animationDuration: Math.max(1, Number(e.target.value) || 5) })} />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Oynatma Hızı</label>
                      <select className={SELECT_CLASS} value={accidentAnimation.speed}
                        onChange={e => setAccidentAnimation({ speed: Number(e.target.value) })}>
                        <option value="0.25">0.25x</option>
                        <option value="0.5">0.5x</option>
                        <option value="1">1x (Normal)</option>
                        <option value="2">2x</option>
                        <option value="4">4x</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={accidentAnimation.loop}
                          onChange={e => setAccidentAnimation({ loop: e.target.checked })}
                          className="accent-[#F5C518]" />
                        <span className="text-[10px] text-gray-400">Döngü</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Notlar</label>
                    <textarea className={`${INPUT_CLASS} resize-none h-16`} value={accidentReconstruction.notes}
                      onChange={e => setAccidentData({ notes: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controls Bar — always at top */}
        <div className="sticky top-0 px-4 py-3 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { resetAccidentReconstruction(); setHasSecondVehicle(false); }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 hover:text-red-400 transition-colors"
              title="Tümünü Temizle"
            >
              <RotateCcw size={14} />
              TEMİZLE
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddToCanvas}
              className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold text-gray-400 hover:text-[#F5C518] border border-[#333] hover:border-[#F5C518]/50 rounded-lg transition-all"
              title="Tuvale Aktar"
            >
              TUVALE AKTAR
            </button>
            <button
              onClick={() => setShowPlayer(true)}
              className="flex items-center gap-2 px-5 py-2 bg-[#F5C518] hover:bg-[#E2B616] text-black text-xs font-black rounded-md transition-all shadow-lg active:scale-95"
            >
              <Eye size={14} />
              ANİMASYONU İZLE
            </button>
          </div>
        </div>
      </div>

      <AccidentAnimationPlayer isOpen={showPlayer} onClose={() => setShowPlayer(false)} />
    </div>
  );
};
