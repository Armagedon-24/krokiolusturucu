import React, { useRef, useEffect, useState } from 'react';
import { Rect, Line, Group, Text, Star, Circle, Wedge } from 'react-konva';
import { useStore } from '../../store/useStore';
import type { VehicleData, VehicleType, PedestrianData } from '../../types';

// Realistic vehicle dimensions (meters) - used for proportional rendering
const VEHICLE_DIMENSIONS: Record<VehicleType,{w:number;h:number;name:string}> = {
  car:       { w:4.5, h:1.8, name:'Otomobil' },
  suv:       { w:4.7, h:1.9, name:'SUV' },
  truck:     { w:7.5, h:2.5, name:'Kamyon' },
  bus:       { w:12.0, h:2.5, name:'Otobüs' },
  motorcycle:{ w:2.2, h:0.8, name:'Motosiklet' },
  van:       { w:5.5, h:2.2, name:'Minibüs' },
  pickup:    { w:5.3, h:1.9, name:'Pickup' },
  other:     { w:4.5, h:1.8, name:'Diğer' },
};

// Calculate interpolated position for a vehicle at a given progress (0..1)
function getVehicleState(vehicle: VehicleData, progress: number) {
  const brakeProgress = 0.25;
  const collisionProgress = 0.55;

  let x: number, y: number, rotation: number;
  let showBrake: boolean;
  let opacity: number;

  const evasiveOffsetX = (vehicle.evasiveAction === 'swerve_left' ? -vehicle.evasiveOffset : vehicle.evasiveAction === 'swerve_right' ? vehicle.evasiveOffset : 0);
  const evasiveOn = evasiveOffsetX !== 0 && progress >= vehicle.evasiveStartProgress && progress < collisionProgress;

  if (progress < brakeProgress) {
    const t = progress / brakeProgress;
    const baseX = vehicle.startX + (vehicle.collisionX - vehicle.startX) * t * 0.3;
    const baseY = vehicle.startY + (vehicle.collisionY - vehicle.startY) * t * 0.3;
    if (evasiveOn) {
      const evT = (progress - vehicle.evasiveStartProgress) / (collisionProgress - vehicle.evasiveStartProgress);
      const ease = Math.min(1, evT * 3);
      x = baseX + evasiveOffsetX * ease;
      y = baseY;
    } else {
      x = baseX;
      y = baseY;
    }
    rotation = vehicle.startRotation;
    showBrake = false;
    opacity = 1;
  } else if (progress < collisionProgress) {
    const t = (progress - brakeProgress) / (collisionProgress - brakeProgress);
    const brakeStartX = vehicle.startX + (vehicle.collisionX - vehicle.startX) * 0.3;
    const brakeStartY = vehicle.startY + (vehicle.collisionY - vehicle.startY) * 0.3;
    let baseX = brakeStartX + (vehicle.collisionX - brakeStartX) * t;
    let baseY = brakeStartY + (vehicle.collisionY - brakeStartY) * t;
    if (evasiveOn) {
      const evT = (progress - vehicle.evasiveStartProgress) / (collisionProgress - vehicle.evasiveStartProgress);
      const ease = Math.min(1, evT * 3);
      baseX += evasiveOffsetX * ease;
    }
    x = baseX;
    y = baseY;
    rotation = vehicle.startRotation + (vehicle.impactAngle - vehicle.startRotation) * t * 0.3;
    showBrake = true;
    opacity = 1;
  } else if (progress < 0.7) {
    x = vehicle.collisionX + (vehicle.evasiveAction === 'swerve_left' ? -vehicle.evasiveOffset : vehicle.evasiveAction === 'swerve_right' ? vehicle.evasiveOffset : 0);
    y = vehicle.collisionY;
    rotation = vehicle.impactAngle;
    showBrake = true;
    opacity = 1;
  } else {
    const t = (progress - 0.7) / 0.3;
    const evasiveResidual = (vehicle.evasiveAction === 'swerve_left' ? -vehicle.evasiveOffset : vehicle.evasiveAction === 'swerve_right' ? vehicle.evasiveOffset : 0);
    x = (vehicle.collisionX + evasiveResidual) + (vehicle.finalX - vehicle.collisionX) * t;
    y = vehicle.collisionY + (vehicle.finalY - vehicle.collisionY) * t;
    rotation = vehicle.impactAngle + (vehicle.finalRotation - vehicle.impactAngle) * t;
    showBrake = true;
    opacity = 1;
  }

  return { x, y, rotation, showBrake, opacity };
}

// Calculate brake mark line points (from brake start to collision point)
function getBrakeMarkPoints(vehicle: VehicleData) {
  const brakeStartX = vehicle.startX + (vehicle.collisionX - vehicle.startX) * 0.3;
  const brakeStartY = vehicle.startY + (vehicle.collisionY - vehicle.startY) * 0.3;

  const points: number[] = [];
  const segments = 20;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    let x = brakeStartX + (vehicle.collisionX - brakeStartX) * t;
    let y = brakeStartY + (vehicle.collisionY - brakeStartY) * t;
    if (vehicle.brakeMarkType === 'curved') {
      const curveOffset = Math.sin(t * Math.PI) * vehicle.brakeMarkCurvature * 20;
      const dx = vehicle.collisionX - brakeStartX;
      const dy = vehicle.collisionY - brakeStartY;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len;
      const ny = dx / len;
      x += nx * curveOffset;
      y += ny * curveOffset;
    }
    points.push(x, y);
  }
  return points;
}

// Get path points from start through collision to final
function getPathPoints(vehicle: VehicleData) {
  return [
    vehicle.startX, vehicle.startY,
    vehicle.collisionX, vehicle.collisionY,
    vehicle.finalX, vehicle.finalY,
  ];
}

function getPedestrianState(pedestrian: PedestrianData, progress: number) {
  const localProgress = progress - pedestrian.appearProgress;
  const duration = 1 - pedestrian.appearProgress;
  const t = duration > 0 ? Math.max(0, Math.min(1, localProgress / (duration * 0.6))) : 0;
  const x = pedestrian.startX + (pedestrian.endX - pedestrian.startX) * t;
  const y = pedestrian.startY + (pedestrian.endY - pedestrian.startY) * t;
  const visible = progress >= pedestrian.appearProgress && t < 1;
  const opacity = visible ? (t < 0.05 ? t / 0.05 : 1) : 0;
  return { x, y, opacity, visible };
}

export const AccidentAnimation: React.FC = () => {
  const {
    accidentReconstruction,
    accidentAnimation,
    setAccidentAnimation,
    scaleCalibration,
  } = useStore();

  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [impactFlash, setImpactFlash] = useState(false);

  const { enabled, vehicles, pedestrians } = accidentReconstruction;
  const { isPlaying, currentTime, speed, loop } = accidentAnimation;

  // Animation loop
  useEffect(() => {
    // Modal oynatıcı (AccidentAnimationPlayer) açıkken tuval döngüsü çalışmaz;
    // iki döngünün aynı store alanına yazışması kare titremesine yol açıyordu.
    if (!isPlaying || !enabled || accidentAnimation.playerOpen) {
      lastTimeRef.current = 0;
      return;
    }

    const duration = Math.max(accidentReconstruction.animationDuration, 0.1);

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaMs = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // Hız çarpanı delta'ya uygulanır (duration'a bölünmesi ilerlemenin
      // speed!=1 iken yarında donmasına yol açıyordu).
      const deltaSec = (deltaMs / 1000) * speed;
      const newTime = Math.min(currentTime + deltaSec, duration);

      const wasUnderCollision = currentTime / duration < 0.55;
      const isUnderCollision = newTime / duration < 0.7 && newTime / duration >= 0.55;

      if (isUnderCollision && wasUnderCollision) {
        setImpactFlash(true);
        setTimeout(() => setImpactFlash(false), 300);
      }

      setAccidentAnimation({ currentTime: newTime });

      if (newTime >= duration) {
        if (loop) {
          setAccidentAnimation({ currentTime: 0 });
          lastTimeRef.current = 0;
        } else {
          setAccidentAnimation({ isPlaying: false });
        }
        return;
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, enabled, speed, loop, currentTime, accidentReconstruction.animationDuration, accidentAnimation.playerOpen, setAccidentAnimation]);

  if (!enabled) return null;

  const progress = accidentReconstruction.animationDuration > 0
    ? Math.min(currentTime / accidentReconstruction.animationDuration, 1)
    : 0;

  const scale = scaleCalibration.realDistance / scaleCalibration.pixelDistance;
  const pxPerMeter = 1 / (scale / 100); // Convert cm/px to px/m

  return (
    <>
      {vehicles.filter((v): v is VehicleData => !!v).map((vehicle) => {
        if (!vehicle.showVehicle) return null;
        const state = getVehicleState(vehicle, progress);
        const brakeWidthPx = Math.max(2, vehicle.brakeMarkWidth * pxPerMeter);

        // Determine which portion of brake marks to show based on progress
        const brakeProgress = Math.max(0, Math.min(1, (progress - 0.25) / 0.3));
        const brakePoints = getBrakeMarkPoints(vehicle);
        const visibleBrakeCount = Math.floor(brakeProgress * (brakePoints.length / 2 - 1)) + 1;
        const visibleBrakePoints = brakePoints.slice(0, (visibleBrakeCount) * 2);

        const pathPoints = getPathPoints(vehicle);
        const pathProgress = progress < 0.7 ? progress / 0.7 : 1;
        const visiblePathCount = Math.floor(pathProgress * (pathPoints.length / 2 - 2)) + 2;
        const visiblePathPoints = pathPoints.slice(0, Math.min(visiblePathCount * 2, pathPoints.length));

        // Calculate collision indicator
        const showCollision = progress >= 0.55;
        const collisionScale = showCollision
          ? Math.min(1, (progress - 0.55) / 0.05)
          : 0;

        return (
          <Group key={vehicle.id}>
            
            {vehicle.showPath && (
              <Line
                points={visiblePathPoints}
                stroke={vehicle.color + '40'}
                strokeWidth={2}
                dash={[6, 4]}
                lineCap="round"
                lineJoin="round"
              />
            )}

            
            {vehicle.showBrakeMarks && vehicle.brakeMarkType !== 'none' && state.showBrake && visibleBrakePoints.length >= 4 && (
              <>
                
                <Line
                  points={visibleBrakePoints}
                  stroke="#333"
                  strokeWidth={brakeWidthPx}
                  lineCap="round"
                  lineJoin="round"
                  opacity={0.8}
                />
                <Line
                  points={visibleBrakePoints.map((p, i) =>
                    i % 2 === 0 ? p : p + brakeWidthPx * 1.5
                  )}
                  stroke="#222"
                  strokeWidth={brakeWidthPx * 0.8}
                  lineCap="round"
                  lineJoin="round"
                  opacity={0.6}
                />
              </>
            )}

            
            {showCollision && (
              <Star
                x={vehicle.collisionX}
                y={vehicle.collisionY}
                numPoints={8}
                innerRadius={10 * collisionScale}
                outerRadius={25 * collisionScale}
                fill={impactFlash ? '#FFD600' : '#FF5722'}
                stroke="#fff"
                strokeWidth={2}
                opacity={0.9 * collisionScale}
              />
            )}

            
            <Group
              x={state.x}
              y={state.y}
              rotation={state.rotation}
              opacity={state.opacity}
            >
              {(() => {
                const dim = VEHICLE_DIMENSIONS[vehicle.type] || VEHICLE_DIMENSIONS.car;
                const bp = 30;
                const W = dim.w * bp;
                const H = dim.h * bp;
                const hw = W / 2;
                const hh = H / 2;
                const wr = Math.max(3, H * 0.07);
                const mirW = Math.max(2, H * 0.04);
                const col = vehicle.color;
                const glassC = 'rgba(130,200,255,0.35)';
                const glassStroke = 'rgba(255,255,255,0.25)';
                const dark = '#1a1a1a';
                const tireC = '#1a1a1a';
                const lightC = '#FFEA00';
                const tailC = '#FF1744';

                const isLong = vehicle.type === 'truck' || vehicle.type === 'bus' || vehicle.type === 'van';

                const shadow = (
                  <Rect x={-hw} y={-hh} width={W} height={H} fill="rgba(0,0,0,0.18)" cornerRadius={isLong ? 3 : 8} />
                );

                // --- MOTORCYCLE ---
                if (vehicle.type === 'motorcycle') {
                  const bw = W * 0.18;
                  return (
                    <>
                      {shadow}
                      <Circle x={-hw*0.35} y={0} radius={wr*1.3} fill={tireC} stroke="#444" strokeWidth={1} />
                      <Circle x={-hw*0.35} y={0} radius={wr*0.6} fill="#666" />
                      <Circle x={hw*0.35} y={0} radius={wr*1.3} fill={tireC} stroke="#444" strokeWidth={1} />
                      <Circle x={hw*0.35} y={0} radius={wr*0.6} fill="#666" />
                      <Rect x={-bw/2} y={-H*0.35} width={bw} height={H*0.7} fill={col} stroke="#fff" strokeWidth={1.5} cornerRadius={3} />
                      <Rect x={-bw/2} y={-H*0.2} width={bw} height={H*0.4} fill={dark} cornerRadius={2} />
                      <Circle x={hw*0.38} y={0} radius={wr*0.7} fill={lightC} />
                      <Rect x={-hw*0.38} y={-wr*0.5} width={wr*0.6} height={wr} fill={tailC} />
                    </>
                  );
                }

                // Each profile is an array of [x, y] points in clockwise order
                const getBodyPoints = (): number[] => {
                  const f = (x: number, y: number) => [x, y];
                  switch (vehicle.type) {
                    case 'truck': {
                      // Cabin (front 30%) + Cargo bed (rear 70%)
                      const cabLen = W * 0.3;
                      const bedLen = W * 0.7;
                      return [
                        ...f(hw, -hh*0.85),         // front bumper top
                        ...f(hw - cabLen*0.15, -hh*0.85), // hood
                        ...f(hw - cabLen, -hh),       // cab rear top (full width)
                        ...f(-hw + bedLen*0.1, -hh),  // bed rear top
                        ...f(-hw, -hh*0.9),           // rear bumper top
                        ...f(-hw, hh*0.9),            // rear bumper bottom
                        ...f(-hw + bedLen*0.1, hh),   // bed rear bottom
                        ...f(hw - cabLen, hh),        // cab rear bottom (full width)
                        ...f(hw - cabLen*0.15, hh*0.85), // hood
                        ...f(hw, hh*0.85),            // front bumper bottom
                      ];
                    }
                    case 'bus': {
                      return [
                        ...f(hw, -hh*0.92),          // front top
                        ...f(-hw, -hh*0.92),          // rear top
                        ...f(-hw, hh*0.92),           // rear bottom
                        ...f(hw, hh*0.92),            // front bottom
                      ];
                    }
                    case 'suv': {
                      const fw = H * 0.4; // front overhang
                      const rw = H * 0.35; // rear overhang
                      return [
                        ...f(hw, -hh*0.7),            // front bumper top
                        ...f(hw - fw*(1/3), -hh*0.7), 
                        ...f(hw - fw*(2/3), -hh*0.85),
                        ...f(hw - fw, -hh),            // windshield top (full width)
                        ...f(-hw + rw, -hh),           // rear window top
                        ...f(-hw + rw*0.5, -hh*0.85),
                        ...f(-hw, -hh*0.7),            // rear bumper top
                        ...f(-hw, hh*0.7),             // rear bumper bottom
                        ...f(-hw + rw*0.5, hh*0.85),
                        ...f(-hw + rw, hh),            // rear window bottom (full width)
                        ...f(hw - fw, hh),             // windshield bottom
                        ...f(hw - fw*(2/3), hh*0.85),
                        ...f(hw - fw*(1/3), hh*0.7),
                        ...f(hw, hh*0.7),              // front bumper bottom
                      ];
                    }
                    case 'van': {
                      // Van: boxy, cab-forward
                      return [
                        ...f(hw, -hh*0.9),           // front
                        ...f(-hw + W*0.05, -hh*0.9),  // rear top
                        ...f(-hw + W*0.05, hh*0.9),   // rear bottom
                        ...f(hw, hh*0.9),             // front bottom
                      ];
                    }
                    case 'pickup': {
                      const cabLen = W * 0.4;
                      return [
                        ...f(hw, -hh*0.75),           // front bumper
                        ...f(hw - cabLen*0.2, -hh*0.85),
                        ...f(hw - cabLen, -hh),        // cab rear (full width)
                        ...f(-hw + W*0.05, -hh*0.95),
                        ...f(-hw, -hh*0.75),           // rear bumper
                        ...f(-hw, hh*0.75),
                        ...f(-hw + W*0.05, hh*0.95),
                        ...f(hw - cabLen, hh),         // cab rear bottom
                        ...f(hw - cabLen*0.2, hh*0.85),
                        ...f(hw, hh*0.75),             // front bumper
                      ];
                    }
                    default: {
                      // Sedan / other: classic 3-box profile
                      const fw = H * 0.45; // front overhang (hood)
                      const rw = H * 0.4;  // rear overhang (trunk)
                      return [
                        ...f(hw, -hh*0.65),           // front bumper top
                        ...f(hw - fw*0.3, -hh*0.65),
                        ...f(hw - fw*0.7, -hh*0.85),
                        ...f(hw - fw, -hh),            // windshield base (full width at cabin)
                        ...f(-hw + rw, -hh),           // rear window base
                        ...f(-hw + rw*0.3, -hh*0.85),
                        ...f(-hw, -hh*0.65),           // rear bumper top
                        ...f(-hw, hh*0.65),            // rear bumper bottom
                        ...f(-hw + rw*0.3, hh*0.85),
                        ...f(-hw + rw, hh),            // rear window bottom
                        ...f(hw - fw, hh),             // windshield bottom
                        ...f(hw - fw*0.7, hh*0.85),
                        ...f(hw - fw*0.3, hh*0.65),
                        ...f(hw, hh*0.65),             // front bumper bottom
                      ];
                    }
                  }
                };

                const bodyPoints = getBodyPoints();

                const fwLen = vehicle.type === 'suv' ? H*0.4 : H*0.45;
                const rwLen = vehicle.type === 'suv' ? H*0.35 : H*0.4;
                const isTruckBus = vehicle.type === 'truck' || vehicle.type === 'bus';

                const windshieldPts = vehicle.type === 'bus' ? [] : vehicle.type === 'truck' ? [
                  hw, -hh*0.65,
                  hw - W*0.25, -hh*0.65,
                  hw - W*0.28, hh*0.65,
                  hw, hh*0.65,
                ] : [
                  hw - fwLen*0.85, -hh*0.55,
                  hw - fwLen*0.15, -hh*0.85,
                  hw - fwLen*0.15, hh*0.85,
                  hw - fwLen*0.85, hh*0.55,
                ];

                const rearGlassPts = vehicle.type === 'bus' || vehicle.type === 'truck' ? [] : [
                  -hw + rwLen*0.85, -hh*0.55,
                  -hw + rwLen*0.15, -hh*0.85,
                  -hw + rwLen*0.15, hh*0.85,
                  -hw + rwLen*0.85, hh*0.55,
                ];

                return (
                  <>
                    {shadow}
                    <Line
                      points={bodyPoints}
                      closed={true}
                      fill={col}
                      stroke="#fff"
                      strokeWidth={2}
                      lineJoin="round"
                      shadowColor="rgba(0,0,0,0.4)"
                      shadowBlur={6}
                      shadowOffset={{ x: 2, y: 2 }}
                    />
                    
                    {!isTruckBus && (
                      <Line
                        points={[
                          hw - fwLen*0.2, -hh*0.55,
                          hw - fwLen*0.9, -hh*0.58,
                          -hw + rwLen*0.9, -hh*0.58,
                          -hw + rwLen*0.2, -hh*0.55,
                          -hw + rwLen*0.2, hh*0.55,
                          -hw + rwLen*0.9, hh*0.58,
                          hw - fwLen*0.9, hh*0.58,
                          hw - fwLen*0.2, hh*0.55,
                          hw - fwLen*0.2, -hh*0.55,
                        ]}
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth={1.5}
                        lineJoin="round"
                        closed={true}
                      />
                    )}
                    
                    {windshieldPts.length > 0 && (
                      <Line
                        points={windshieldPts}
                        closed={true}
                        fill={glassC}
                        stroke={glassStroke}
                        strokeWidth={1}
                        lineJoin="round"
                      />
                    )}
                    
                    {rearGlassPts.length > 0 && (
                      <Line
                        points={rearGlassPts}
                        closed={true}
                        fill="rgba(130,200,255,0.2)"
                        stroke={glassStroke}
                        strokeWidth={1}
                        lineJoin="round"
                      />
                    )}
                    
                    {!isTruckBus && (
                      <>
                        <Rect x={hw-4} y={-hh*0.45} width={3} height={Math.max(4, H*0.08)} fill={lightC} cornerRadius={1} />
                        <Rect x={hw-4} y={hh*0.45-Math.max(4, H*0.08)} width={3} height={Math.max(4, H*0.08)} fill={lightC} cornerRadius={1} />
                      </>
                    )}
                    
                    <Rect x={-hw-1} y={-hh*0.4} width={2} height={Math.max(3, H*0.06)} fill={tailC} />
                    <Rect x={-hw-1} y={hh*0.4-Math.max(3, H*0.06)} width={2} height={Math.max(3, H*0.06)} fill={tailC} />
                    
                    {isTruckBus && (
                      <Rect x={hw-2} y={-hh*0.5} width={2} height={H*0.6} fill={dark} cornerRadius={1} />
                    )}
                    
                    <Circle x={-hw*0.55} y={-hh - mirW} radius={mirW} fill={dark} />
                    <Circle x={-hw*0.55} y={hh + mirW} radius={mirW} fill={dark} />
                    
                    <Circle x={hw*0.3} y={-hh - wr*0.3} radius={wr} fill={tireC} stroke="#444" strokeWidth={1} />
                    <Circle x={hw*0.3} y={hh + wr*0.3} radius={wr} fill={tireC} stroke="#444" strokeWidth={1} />
                    <Circle x={-hw*0.3} y={-hh - wr*0.3} radius={wr} fill={tireC} stroke="#444" strokeWidth={1} />
                    <Circle x={-hw*0.3} y={hh + wr*0.3} radius={wr} fill={tireC} stroke="#444" strokeWidth={1} />
                    
                    {vehicle.type === 'truck' && (
                      <>
                        <Circle x={0} y={-hh - wr*0.3} radius={wr} fill={tireC} stroke="#444" strokeWidth={1} />
                        <Circle x={0} y={hh + wr*0.3} radius={wr} fill={tireC} stroke="#444" strokeWidth={1} />
                      </>
                    )}
                    
                    <Circle x={hw*0.1} y={0} radius={Math.max(5, H*0.12)} fill="rgba(245,197,24,0.5)" />
                    <Wedge
                      x={hw*0.4}
                      y={0}
                      radius={Math.max(5, H*0.12)}
                      angle={40}
                      rotation={-90}
                      fill="#F5C518"
                      stroke="#fff"
                      strokeWidth={1}
                    />
                  </>
                );
              })()}
              
              {(() => {
                const dim = VEHICLE_DIMENSIONS[vehicle.type] || VEHICLE_DIMENSIONS.car;
                const bp = 30;
                const W = dim.w * bp;
                const H = dim.h * bp;
                return (
                  <Text
                    x={-W/2}
                    y={-H/2 - 18}
                    width={W}
                    height={16}
                    text={`${vehicle.name} · ${vehicle.initialSpeed} km/h`}
                    fontSize={10}
                    fontStyle="bold"
                    fill="#fff"
                    align="center"
                    shadowColor="rgba(0,0,0,0.9)"
                    shadowBlur={5}
                  />
                );
              })()}
            </Group>
          </Group>
        );
      })}

      {/* Pedestrians */}
      {(pedestrians || []).filter(p => p.show).map((pedestrian) => {
        const state = getPedestrianState(pedestrian, progress);
        if (!state.visible) return null;
        const headR = pedestrian.size === 'child' ? 5 : 7;
        const bodyH = pedestrian.size === 'child' ? 14 : 20;
        return (
          <Group key={pedestrian.id} opacity={state.opacity}>
            <Circle x={state.x} y={state.y - bodyH/2 - headR} radius={headR} fill={pedestrian.color} stroke="#fff" strokeWidth={1.5} />
            <Line
              points={[state.x, state.y - bodyH/2, state.x, state.y + bodyH/2]}
              stroke={pedestrian.color} strokeWidth={3} lineCap="round"
            />
            <Line
              points={[state.x - 6, state.y - 4, state.x - 2, state.y, state.x + 2, state.y - 4, state.x + 6, state.y]}
              stroke={pedestrian.color} strokeWidth={2.5} lineCap="round" lineJoin="round"
            />
            <Text
              x={state.x - 15} y={state.y + bodyH/2 + 2} width={30} height={12}
              text={pedestrian.name} fontSize={8} fontStyle="bold" fill="#fff" align="center"
              shadowColor="rgba(0,0,0,0.8)" shadowBlur={3}
            />
          </Group>
        );
      })}

      
      <Text
        x={920}
        y={10}
        text={`▶ ${Math.round(progress * 100)}%`}
        fontSize={11}
        fontStyle="bold"
        fill={progress >= 1 ? '#4CAF50' : '#F5C518'}
        listening={false}
      />
    </>
  );
};
