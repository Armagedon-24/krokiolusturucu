import React, { useEffect, useMemo, useState } from 'react';
import { Stage, Layer, Image as KImage, Rect, Line, Text as KText } from 'react-konva';
import type { CanvasObject } from '../../../types';
import { buildKrokiObjects, type KrokiArea } from '../../../utils/krokiTransfer';
import type { KrokiScenario } from '../../../data/krokiExamples';

/** Sembol görsellerini paylaşılan önbellekte tutar. */
const imgCache = new Map<string, HTMLImageElement>();

function useSymbolImages(srcs: string[]): void {
  const key = srcs.join('|');
  const [, force] = useState(0);
  useEffect(() => {
    let alive = true;
    const pending = Array.from(new Set(srcs)).filter((s) => s && !imgCache.has(s));
    if (!pending.length) return;
    Promise.all(
      pending.map(
        (s) =>
          new Promise<void>((res) => {
            const img = new window.Image();
            img.onload = () => { imgCache.set(s, img); res(); };
            img.onerror = () => { imgCache.set(s, img); res(); };
            img.src = s;
          })
      )
    ).then(() => {
      if (alive) force((n) => n + 1);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

interface Props {
  scenario: KrokiScenario;
  width: number;
  /** Önizleme alanı (tasarım uzayındaki krokiyi sığdırmak için kullanılır). */
  area: KrokiArea;
}

/**
 * Kroki senaryosunun küçük önizlemesi. Tuvalde kullanılanla aynı
 * buildKrokiObjects mantığıyla çizilir; etkileşimsizdir.
 */
export const KrokiPreview: React.FC<Props> = ({ scenario, width, area }) => {
  const scale = width / area.width;
  const height = Math.round(area.height * scale);
  const objects = useMemo(() => buildKrokiObjects(scenario, area) as CanvasObject[], [scenario, area]);
  const srcs = useMemo(
    () => objects.map((o) => (o.type === 'symbol' ? String(o.src ?? '') : '')),
    [objects]
  );
  useSymbolImages(srcs);

  return (
    <div className="rounded-xl border border-[#333] bg-white overflow-hidden" style={{ lineHeight: 0 }}>
      <Stage width={width} height={height} listening={false}>
        <Layer>
          <Rect x={0} y={0} width={width} height={height} fill="#ffffff" />
          {objects.map((o, i) => {
            const x = (Number(o.x) - area.x) * scale;
            const y = (Number(o.y) - area.y) * scale;
            const w = Number(o.width) * scale;
            const h = Number(o.height ?? o.width) * scale;
            if (o.type === 'rect') {
              return (
                <Rect
                  key={i}
                  x={x} y={y} width={w} height={h}
                  rotation={o.rotation ?? 0}
                  fill={o.fill ?? 'transparent'}
                  stroke={o.stroke ?? '#000000'}
                  strokeWidth={(o.strokeWidth ?? 1.5) * scale}
                  dash={o.dash?.map((d) => d * scale)}
                />
              );
            }
            if (o.type === 'line') {
              if (o.dash) {
                const horizontal = Number(o.width) >= Number(o.height);
                return (
                  <Line
                    key={i}
                    x={x} y={y}
                    rotation={o.rotation ?? 0}
                    points={horizontal ? [0, 0, w, 0] : [0, 0, 0, h]}
                    stroke={o.fill ?? '#000000'}
                    strokeWidth={Math.min(w, h) || 1}
                    dash={o.dash.map((d) => d * scale)}
                  />
                );
              }
              return (
                <Rect key={i} x={x} y={y} width={Math.max(w, 1)} height={Math.max(h, 1)} rotation={o.rotation ?? 0} fill={o.fill ?? '#000000'} />
              );
            }
            if (o.type === 'text') {
              const fs = Number(o.fontSize ?? 10) * scale;
              return (
                <KText
                  key={i}
                  x={x} y={y}
                  width={w}
                  text={String(o.text ?? '')}
                  fontSize={Math.max(4, fs)}
                  fontStyle={o.fontStyle ?? 'normal'}
                  fill={o.fill ?? '#000000'}
                  align={o.align ?? 'center'}
                />
              );
            }
            // sembol
            const img = o.src ? imgCache.get(String(o.src)) : undefined;
            if (!img || !img.complete || !img.naturalWidth) return null;
            if (o.symbolId === 'ev-callout') {
              // Balon: basit çizim (gövde + metin)
              return (
                <React.Fragment key={i}>
                  <Rect
                    x={x} y={y} width={w} height={h * 0.78}
                    stroke="#000000" strokeWidth={Math.max(1, 2 * scale)} fill="#ffffff" cornerRadius={4 * scale}
                  />
                  <KText
                    x={x + 2} y={y + h * 0.12} width={w - 4}
                    text={String(o.distance ?? '')}
                    fontSize={Number(o.distanceFontSize ?? 9) * scale}
                    fill="#000000" align="center"
                  />
                  <Line
                    points={[x + w * 0.15, y + h * 0.78, x, y + h, x + w * 0.3, y + h * 0.78]}
                    closed fill="#ffffff" stroke="#000000" strokeWidth={Math.max(1, 2 * scale)}
                  />
                </React.Fragment>
              );
            }
            if (o.symbolId === 'a-4' || o.symbolId === 'a-5') {
              const rad = (o.rotation ?? 0) * (Math.PI / 180);
              const cx = x + (w / 2) * Math.cos(rad) - (h / 2) * Math.sin(rad);
              const cy = y + (w / 2) * Math.sin(rad) + (h / 2) * Math.cos(rad);
              return (
                <React.Fragment key={i}>
                  <Line
                    x={x} y={y} rotation={o.rotation ?? 0}
                    points={[0, h / 2, w, h / 2]}
                    stroke="#000000" strokeWidth={Math.max(1, 2 * scale)}
                  />
                  {o.distance ? (
                    <KText
                      x={cx - w / 2} y={cy - h / 2 - 12 * scale} width={w}
                      text={String(o.distance)}
                      fontSize={Math.max(5, Number(o.distanceFontSize ?? 9) * scale)}
                      fill="#000000" align="center"
                    />
                  ) : null}
                </React.Fragment>
              );
            }
            return <KImage key={i} x={x} y={y} width={w} height={h} rotation={o.rotation ?? 0} image={img} />;
          })}
        </Layer>
      </Stage>
    </div>
  );
};
