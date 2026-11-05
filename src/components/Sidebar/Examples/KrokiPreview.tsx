import React, { useMemo, useRef, useState, useEffect } from 'react';
import { buildScenarioObjects, type KrokiScenario } from '../../../data/krokiScenarios';

/** Senaryoların tasarlandığı yerleşim alanı (landscape kroki şablonu). */
const DESIGN_W = 1366;
const DESIGN_H = 706;

interface KrokiPreviewProps {
  scenario: KrokiScenario;
  /** Görüntü genişliği (px) — yükseklik orana göre hesaplanır */
  width?: number;
  className?: string;
}

/**
 * Senaryo krokisinin küçük önizlemesi. buildScenarioObjects ile üretilen TÜYLE
 * BİREBİR AYNI nesneleri (aynı semboller, konumlar, döndürmeler) ölçekleyerek
 * HTML/CSS ile çizer — böylece kartta görülen kroki, tuvale aktarılan krokidir.
 * Kart genişliğine göre ölçeklenir (duyarlı genişlik): dar kenar çubuğunda da
 * okunabilirlik korunur.
 */
export const KrokiPreview: React.FC<KrokiPreviewProps> = ({ scenario, width = 330, className = '' }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(width);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 50) setCw(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const s = cw / DESIGN_W;
  const height = Math.round(DESIGN_H * s);

  const objects = useMemo(
    () => buildScenarioObjects(scenario, { x: 0, y: 0, width: DESIGN_W, height: DESIGN_H }),
    [scenario],
  );

  const symbols = objects.filter(
    (o) => o.type === 'symbol' && o.src && !['a-4', 'a-5', 'ev-callout', 'ev-circle', 'ev-square', 'st-1', 'st-cadde', 'st-sokak', 'arch-w1i', 'arch-w1vi'].includes(o.symbolId || ''),
  );
  // Düz yollar tuvaldeki dinamik motorla aynı biçimde çizilir (beyaz bant + siyah kenar/şerit)
  const roads = objects.filter((o) => o.type === 'symbol' && ['st-1', 'st-cadde', 'st-sokak'].includes(o.symbolId || ''));
  // Duvarlar: PNG kaynak %92 şeffaf olduğundan önizlemede kaybolur — düz çubuk olarak çizilir
  const walls = objects.filter((o) => o.type === 'symbol' && (o.symbolId === 'arch-w1i' || o.symbolId === 'arch-w1vi'));
  // Kapılar: duvar çubuğu kapı açıklığının üzerinden geçmesin — kapı imajının alt %15'lik
  // beyaz bandının duvara denk gelen bölgesi, imajla aynı döndürmeyle beyaz olarak çizilir
  const doors = objects.filter((o) => o.type === 'symbol' && ['arch-d1l', 'arch-d1r', 'arch-d2'].includes(o.symbolId || ''));
  const markers = objects.filter((o) => o.symbolId === 'ev-circle' || o.symbolId === 'ev-square');
  const texts = objects.filter((o) => o.type === 'text');
  const arrows = objects.filter(
    (o) => ['a-4', 'a-5'].includes(o.symbolId || '') && o.startX !== undefined && o.endX !== undefined,
  );
  const callouts = objects.filter((o) => o.symbolId === 'ev-callout');

  return (
    <div
      ref={wrapRef}
      className={`relative bg-white border border-[#444] rounded-lg overflow-hidden shadow-inner w-full ${className}`}
      style={{ height }}
      title="Kroki önizlemesi — tuvale aktarınca düzenlenebilir"
    >
      {/* Düz yollar (dinamik yol motoruyla birebir) */}
      {roads.map((o) => (
        <div
          key={o.id}
          className="absolute pointer-events-none"
          style={{
            left: (o.x || 0) * s,
            top: (o.y || 0) * s,
            width: (o.width || 0) * s,
            height: (o.height || 0) * s,
            transform: `rotate(${o.rotation || 0}deg)`,
            transformOrigin: '0 0',
            background: '#ffffff',
            borderTop: '2px solid #000000',
            borderBottom: '2px solid #000000',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '50%',
              borderTop: o.roadMiddleLine !== false ? '2px dashed #000000' : 'none',
            }}
          />
          {!!(o.streetName || '').trim() && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: Math.max(6, Math.min(16, (o.height || 40) * 0.32) * s),
                fontWeight: 700,
                color: '#000000',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {o.streetName}
            </div>
          )}
        </div>
      ))}

      {/* Duvarlar (karakalem PNG önizlemede kaybolduğundan düz çubuk) */}
      {walls.map((o) => (
        <div
          key={o.id}
          className="absolute pointer-events-none"
          style={{
            left: (o.x || 0) * s,
            top: (o.y || 0) * s,
            width: (o.width || 0) * s,
            height: (o.height || 0) * s,
            transform: `rotate(${o.rotation || 0}deg)`,
            transformOrigin: '0 0',
            background: '#2e2e2e',
          }}
        />
      ))}

      {/* Kapı açıklıkları: duvar çubuğunu kapı boşluğunda kes (imajla aynı döndürme) */}
      {doors.map((o) => (
        <div
          key={`gap-${o.id}`}
          className="absolute pointer-events-none"
          style={{
            left: (o.x || 0) * s,
            top: (o.y || 0) * s,
            width: (o.width || 0) * s,
            height: (o.height || 0) * s,
            transform: `rotate(${o.rotation || 0}deg)`,
            transformOrigin: '0 0',
          }}
        >
          <div style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: '15%', background: '#ffffff' }} />
        </div>
      ))}

      {/* Semboller */}
      {symbols.map((o) => (
        <img
          key={o.id}
          src={o.src}
          alt={o.name || 'sembol'}
          draggable={false}
          className="absolute select-none pointer-events-none"
          style={{
            left: (o.x || 0) * s,
            top: (o.y || 0) * s,
            width: Math.max((o.width || 0) * s, 2),
            height: Math.max((o.height || 0) * s, 2),
            transform: `rotate(${o.rotation || 0}deg)`,
            transformOrigin: '0 0',
            mixBlendMode: 'multiply',
            opacity: o.opacity ?? 1,
          }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ))}

      {/* Numaratörler (sarı daire/kare + bulgu no) */}
      {markers.map((o) => {
        const size = (o.width || 34) * s;
        const isSquare = o.symbolId === 'ev-square';
        return (
          <div
            key={o.id}
            className="absolute flex items-center justify-center font-black text-black"
            style={{
              left: (o.x || 0) * s,
              top: (o.y || 0) * s,
              width: size,
              height: size,
              background: '#F5C518',
              border: '1px solid #000',
              borderRadius: isSquare ? 2 : '50%',
              fontSize: Math.max(size * 0.45, 5),
              lineHeight: 1,
              boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
            }}
          >
            {o.findingNo}
          </div>
        );
      })}

      {/* Metin etiketleri (minik) */}
      {texts.map((o) => (
        <div
          key={o.id}
          className="absolute pointer-events-none"
          style={{
            left: (o.x || 0) * s,
            top: (o.y || 0) * s,
            width: (o.width || 220) * s,
            fontSize: Math.max((o.fontSize || 10) * s, 4),
            fontWeight: o.fontStyle === 'bold' ? 800 : 400,
            textAlign: (o.align as 'left' | 'center' | 'right') || 'left',
            color: '#111',
            lineHeight: 1.25,
            whiteSpace: 'pre-wrap',
          }}
        >
          {o.text}
        </div>
      ))}

      {/* Açıklama balonları */}
      {callouts.map((o) => (
        <div
          key={o.id}
          className="absolute bg-white border border-black rounded"
          style={{
            left: (o.x || 0) * s,
            top: (o.y || 0) * s,
            width: Math.max((o.width || 120) * s, 8),
            height: Math.max((o.height || 60) * s, 6),
            fontSize: Math.max((o.distanceFontSize || 12) * s, 4),
            lineHeight: 1.15,
            color: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 1px',
            textAlign: 'center',
            overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
          }}
        >
          <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {o.distance}
          </span>
        </div>
      ))}

      {/* Ölçü / yön okları */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={cw}
        height={height}
        viewBox={`0 0 ${cw} ${height}`}
      >
        <defs>
          {/* st-5 tarzı İÇİ BOŞ chevron uçlar (dolu üçgen marker değil) */}
          <marker id="kroki-prev-arr" markerWidth="6" markerHeight="6" refX="4.4" refY="3" orient="auto">
            <path d="M1.4,0.9 L4.6,3 L1.4,5.1" fill="none" stroke="#000" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
          <marker id="kroki-prev-arr-start" markerWidth="6" markerHeight="6" refX="1.6" refY="3" orient="auto">
            <path d="M4.6,0.9 L1.4,3 L4.6,5.1" fill="none" stroke="#000" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
        {arrows.map((o) => {
          const x1 = (o.startX || 0) * s;
          const y1 = (o.startY || 0) * s;
          const x2 = (o.endX || 0) * s;
          const y2 = (o.endY || 0) * s;
          const isMeasure = o.symbolId === 'a-4' || o.isDistanceArrow;
          const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
          const labelRot = angle > 90 ? angle - 180 : angle < -90 ? angle + 180 : angle;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const fs = Math.max((o.distanceFontSize || 11) * s, 4.5);
          return (
            <g key={o.id}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#000"
                strokeWidth={Math.max(1.1 * s * 4, 0.9)}
                markerEnd="url(#kroki-prev-arr)"
                markerStart={isMeasure ? 'url(#kroki-prev-arr-start)' : undefined}
              />
              {o.distance ? (
                <text
                  x={mx}
                  y={my - fs * 0.7}
                  fontSize={fs}
                  fontWeight={700}
                  fill="#000"
                  textAnchor="middle"
                  transform={`rotate(${labelRot} ${mx} ${my})`}
                >
                  {o.distance}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
