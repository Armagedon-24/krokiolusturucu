import React, { useRef, useEffect, useState } from 'react';
import { Rect, Line, Group, Text, Star } from 'react-konva';
import { useStore } from '../../store/useStore';
import type { VehicleData } from '../../types';

const VEHICLE_WIDTH = 60;
const VEHICLE_HEIGHT = 30;

// Calculate interpolated position for a vehicle at a given progress (0..1)
function getVehicleState(vehicle: VehicleData, progress: number) {
  const brakeProgress = 0.25; // 0-25%: pre-brake phase
  const collisionProgress = 0.55; // 25-55%: braking phase, collision at 55%

  let x: number, y: number, rotation: number;
  let showBrake: boolean;
  let opacity: number;

  if (progress < brakeProgress) {
    // Phase 1: Moving at constant speed toward brake point
    const t = progress / brakeProgress;
    x = vehicle.startX + (vehicle.collisionX - vehicle.startX) * t * 0.3;
    y = vehicle.startY + (vehicle.collisionY - vehicle.startY) * t * 0.3;
    rotation = vehicle.startRotation;
    showBrake = false;
    opacity = 1;
  } else if (progress < collisionProgress) {
    // Phase 2: Braking, brake marks appearing
    const t = (progress - brakeProgress) / (collisionProgress - brakeProgress);
    const brakeStartX = vehicle.startX + (vehicle.collisionX - vehicle.startX) * 0.3;
    const brakeStartY = vehicle.startY + (vehicle.collisionY - vehicle.startY) * 0.3;
    x = brakeStartX + (vehicle.collisionX - brakeStartX) * t;
    y = brakeStartY + (vehicle.collisionY - brakeStartY) * t;
    rotation = vehicle.startRotation + (vehicle.impactAngle - vehicle.startRotation) * t * 0.3;
    showBrake = true;
    opacity = 1;
  } else if (progress < 0.7) {
    // Phase 3: Collision moment
    x = vehicle.collisionX;
    y = vehicle.collisionY;
    rotation = vehicle.impactAngle;
    showBrake = true;
    opacity = 1;
  } else {
    // Phase 4: Post-collision drift to final position
    const t = (progress - 0.7) / 0.3;
    x = vehicle.collisionX + (vehicle.finalX - vehicle.collisionX) * t;
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

  const { enabled, vehicles } = accidentReconstruction;
  const { isPlaying, currentTime, speed, loop } = accidentAnimation;

  // Animation loop
  useEffect(() => {
    if (!isPlaying || !enabled) {
      lastTimeRef.current = 0;
      return;
    }

    const duration = accidentReconstruction.animationDuration / speed;

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaMs = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      const deltaSec = deltaMs / 1000;
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
  }, [isPlaying, enabled, speed, loop, currentTime, accidentReconstruction.animationDuration, setAccidentAnimation]);

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
            {/* Path line */}
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

            {/* Brake marks */}
            {vehicle.showBrakeMarks && vehicle.brakeMarkType !== 'none' && state.showBrake && visibleBrakePoints.length >= 4 && (
              <>
                {/* Double line for paired brake marks */}
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

            {/* Collision indicator */}
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

            {/* Vehicle */}
            <Group
              x={state.x}
              y={state.y}
              rotation={state.rotation}
              opacity={state.opacity}
            >
              {/* Vehicle body */}
              <Rect
                x={-VEHICLE_WIDTH / 2}
                y={-VEHICLE_HEIGHT / 2}
                width={VEHICLE_WIDTH}
                height={VEHICLE_HEIGHT}
                fill={vehicle.color}
                stroke="#fff"
                strokeWidth={2}
                cornerRadius={4}
                shadowColor="rgba(0,0,0,0.4)"
                shadowBlur={8}
                shadowOffset={{ x: 2, y: 2 }}
              />
              {/* Windshield indicator (front of vehicle) */}
              <Rect
                x={VEHICLE_WIDTH / 2 - 8}
                y={-VEHICLE_HEIGHT / 2 + 3}
                width={6}
                height={VEHICLE_HEIGHT - 6}
                fill="rgba(255,255,255,0.3)"
                cornerRadius={2}
              />
              {/* Vehicle label */}
              <Text
                x={-VEHICLE_WIDTH / 2}
                y={-VEHICLE_HEIGHT / 2 - 14}
                width={VEHICLE_WIDTH}
                height={14}
                text={vehicle.name}
                fontSize={9}
                fontStyle="bold"
                fill="#fff"
                align="center"
                shadowColor="rgba(0,0,0,0.8)"
                shadowBlur={4}
              />
            </Group>
          </Group>
        );
      })}

      {/* Playback indicator (top-right of canvas) */}
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
