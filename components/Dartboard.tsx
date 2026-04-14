import React, { useMemo } from 'react';
import {
  Canvas,
  Path,
  Rect,
  Circle,
  Text,
  useFont,
  Skia,
  Group,
} from '@shopify/react-native-skia';
import { SEGMENT_ORDER, RING_RADII, DartHit, getDartScore } from '../lib/dartboard';

export interface DartMarker {
  x: number;
  y: number;
  color: string;
}

export interface BoardEffectMarker {
  sector: number;
  effectType: string;
}

interface DartboardProps {
  size: number;
  darts?: DartMarker[];
  aimIndicator?: { x: number; y: number; radius: number } | null;
  boardEffects?: BoardEffectMarker[];
  deadSectors?: number[];
}

const COLORS = {
  singleBlack: '#1a1a1a',
  singleCream: '#f0e0b0',
  tripleGreenEven: '#1a7a30',
  tripleRedOdd: '#cc2200',
  doubleRedEven: '#cc2200',
  doubleGreenOdd: '#1a7a30',
  outerBull: '#1a7a30',
  bull: '#cc2200',
  border: '#0a1628',
  wire: '#7ab3cc',
  numberColor: '#f5c518',
};

function makeStarField(size: number, spacing = 20, outerR = 5, innerR = 2) {
  const path = Skia.Path.Make();
  for (let row = 0; row * spacing <= size + spacing; row++) {
    const offsetX = row % 2 === 0 ? 0 : spacing / 2;
    for (let col = 0; col * spacing <= size + spacing; col++) {
      const x = col * spacing + offsetX;
      const y = row * spacing;
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI / 4) - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        if (i === 0) path.moveTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
        else path.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
      }
      path.close();
    }
  }
  return path;
}

function makeDiamondLines(size: number, spacing = 16, direction: 1 | -1) {
  const path = Skia.Path.Make();
  for (let i = -size; i <= size * 2; i += spacing) {
    if (direction === 1) {
      path.moveTo(i, 0);
      path.lineTo(i + size, size);
    } else {
      path.moveTo(i, size);
      path.lineTo(i + size, 0);
    }
  }
  return path;
}

function makeGlassStreaks(size: number) {
  const path = Skia.Path.Make();
  const streaks = [
    { x0: size * 0.05, angle: 80 },
    { x0: size * 0.25, angle: 76 },
    { x0: size * 0.50, angle: 82 },
    { x0: size * 0.70, angle: 77 },
    { x0: size * 0.88, angle: 79 },
  ];
  for (const { x0, angle } of streaks) {
    const rad = (angle * Math.PI) / 180;
    path.moveTo(x0, 0);
    path.lineTo(x0 + size * Math.cos(rad), size * Math.sin(rad));
  }
  return path;
}

function makePlaidLines(size: number, spacing = 14, direction: 'h' | 'v') {
  const path = Skia.Path.Make();
  if (direction === 'h') {
    for (let y = 0; y <= size + spacing; y += spacing) {
      path.moveTo(0, y);
      path.lineTo(size, y);
    }
  } else {
    for (let x = 0; x <= size + spacing; x += spacing) {
      path.moveTo(x, 0);
      path.lineTo(x, size);
    }
  }
  return path;
}

function buildPixelPaths(
  boardR: number, cx: number, cy: number,
  pixelSize: number,
  deadSectors: number[]
): Map<string, ReturnType<typeof Skia.Path.Make>> {
  const borderR = boardR * 1.18;
  const colorPaths = new Map<string, ReturnType<typeof Skia.Path.Make>>();

  const get = (color: string) => {
    if (!colorPaths.has(color)) colorPaths.set(color, Skia.Path.Make());
    return colorPaths.get(color)!;
  };

  const minX = Math.floor(cx - borderR);
  const maxX = Math.ceil(cx + borderR);
  const minY = Math.floor(cy - borderR);
  const maxY = Math.ceil(cy + borderR);

  for (let px = minX; px < maxX; px += pixelSize) {
    for (let py = minY; py < maxY; py += pixelSize) {
      const pcx = px + pixelSize / 2;
      const pcy = py + pixelSize / 2;
      const dx = pcx - cx;
      const dy = pcy - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > borderR) continue;

      let color: string;

      if (dist > boardR) {
        color = COLORS.border;
      } else {
        const { segment, multiplier } = getDartScore(dx, dy, boardR);
        if (deadSectors.includes(segment)) {
          color = COLORS.border;
        } else if (segment === 50) {
          color = COLORS.bull;
        } else if (segment === 25) {
          color = COLORS.outerBull;
        } else {
          const segIdx = SEGMENT_ORDER.indexOf(segment);
          const isEven = segIdx % 2 === 0;
          if (multiplier === 3) {
            color = isEven ? COLORS.tripleGreenEven : COLORS.tripleRedOdd;
          } else if (multiplier === 2) {
            color = isEven ? COLORS.doubleRedEven : COLORS.doubleGreenOdd;
          } else {
            color = isEven ? COLORS.singleBlack : COLORS.singleCream;
          }
        }
      }

      get(color).addRect(Skia.XYWHRect(px, py, pixelSize, pixelSize));
    }
  }

  return colorPaths;
}

function makeAnnularSector(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  sweepAngle: number
) {
  const path = Skia.Path.Make();
  const startRad = (startAngle * Math.PI) / 180;
  const endAngle = startAngle + sweepAngle;
  const endRad = (endAngle * Math.PI) / 180;

  path.moveTo(cx + innerR * Math.cos(startRad), cy + innerR * Math.sin(startRad));
  path.lineTo(cx + outerR * Math.cos(startRad), cy + outerR * Math.sin(startRad));
  path.arcToOval(
    { x: cx - outerR, y: cy - outerR, width: outerR * 2, height: outerR * 2 },
    startAngle,
    sweepAngle,
    false
  );
  path.lineTo(cx + innerR * Math.cos(endRad), cy + innerR * Math.sin(endRad));
  path.arcToOval(
    { x: cx - innerR, y: cy - innerR, width: innerR * 2, height: innerR * 2 },
    endAngle,
    -sweepAngle,
    false
  );
  path.close();
  return path;
}

export default function Dartboard({ size, darts = [], aimIndicator, boardEffects, deadSectors }: DartboardProps) {
  const cx = size / 2;
  const cy = size / 2;
  // boardR = radius of the scoring area (double ring outer edge)
  // Numbers sit just outside this, so boardR must leave room in canvas
  const boardR = size * 0.38;
  const numRadius = boardR * 1.22;
  const fontSize = Math.max(9, boardR * 0.1);

  const font = useFont(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@expo-google-fonts/press-start-2p/400Regular/PressStart2P_400Regular.ttf'),
    fontSize
  );

  const segments = useMemo(() => {
    return SEGMENT_ORDER.map((num, i) => {
      // In canvas coords: 0° = East, positive = clockwise
      // Segment 20 is at top (North = -90°), centered, so startAngle = i*18 - 90 - 9
      const startAngle = i * 18 - 99;
      const sweep = 18;
      const centerAngle = i * 18 - 90;

      const isEven = i % 2 === 0;
      const singleColor = isEven ? COLORS.singleBlack : COLORS.singleCream;
      const tripleColor = isEven ? COLORS.tripleGreenEven : COLORS.tripleRedOdd;
      const doubleColor = isEven ? COLORS.doubleRedEven : COLORS.doubleGreenOdd;

      const innerSingle = makeAnnularSector(
        cx, cy,
        boardR * RING_RADII.outerBull, boardR * RING_RADII.trebleInner,
        startAngle, sweep
      );
      const triple = makeAnnularSector(
        cx, cy,
        boardR * RING_RADII.trebleInner, boardR * RING_RADII.trebleOuter,
        startAngle, sweep
      );
      const outerSingle = makeAnnularSector(
        cx, cy,
        boardR * RING_RADII.trebleOuter, boardR * RING_RADII.doubleInner,
        startAngle, sweep
      );
      const double = makeAnnularSector(
        cx, cy,
        boardR * RING_RADII.doubleInner, boardR * RING_RADII.doubleOuter,
        startAngle, sweep
      );

      const centerRad = (centerAngle * Math.PI) / 180;
      const nx = cx + numRadius * Math.cos(centerRad);
      const ny = cy + numRadius * Math.sin(centerRad);

      return { num, innerSingle, triple, outerSingle, double, singleColor, tripleColor, doubleColor, nx, ny };
    });
  }, [size]);

  const pixelSize = Math.max(2, Math.round(boardR / 50));
  const pixelPaths = useMemo(
    () => buildPixelPaths(boardR, cx, cy, pixelSize, deadSectors ?? []),
    [boardR, cx, cy, pixelSize, deadSectors]
  );

  const starFieldPath = useMemo(() => makeStarField(size), [size]);
  const plaidHLines = useMemo(() => makePlaidLines(size, 14, 'h'), [size]);
  const plaidVLines = useMemo(() => makePlaidLines(size, 14, 'v'), [size]);
  const diamondLines1 = useMemo(() => makeDiamondLines(size, 16, 1), [size]);
  const diamondLines2 = useMemo(() => makeDiamondLines(size, 16, -1), [size]);
  const glassStreaks  = useMemo(() => makeGlassStreaks(size), [size]);

  return (
    <Canvas style={{ width: size, height: size }}>
      {/* Pixel grid board */}
      {Array.from(pixelPaths.entries()).map(([color, path]) => (
        <Path key={color} path={path} color={color} />
      ))}

      {/* Board effect overlays — inner and outer single only (no triple/double) */}
      {boardEffects?.map((effect) => {
        if (effect.effectType === 'bonus_sector') {
          if (effect.sector >= 1 && effect.sector <= 20) {
            const seg = segments.find(s => s.num === effect.sector);
            if (!seg) return null;
            return (
              <React.Fragment key={`bonus-star-${effect.sector}`}>
                <Group clip={seg.innerSingle}>
                  <Path path={starFieldPath} color="rgba(245, 197, 24, 0.75)" style="fill" />
                </Group>
                <Group clip={seg.outerSingle}>
                  <Path path={starFieldPath} color="rgba(245, 197, 24, 0.75)" style="fill" />
                </Group>
              </React.Fragment>
            );
          } else if (effect.sector === 25) {
            const clipPath = Skia.Path.Make();
            (clipPath as any).addCircle(cx, cy, boardR * RING_RADII.outerBull);
            return (
              <Group key={`bonus-star-${effect.sector}`} clip={clipPath}>
                <Path path={starFieldPath} color="rgba(245, 197, 24, 0.75)" style="fill" />
              </Group>
            );
          } else if (effect.sector === 50) {
            const clipPath = Skia.Path.Make();
            (clipPath as any).addCircle(cx, cy, boardR * RING_RADII.bull);
            return (
              <Group key={`bonus-star-${effect.sector}`} clip={clipPath}>
                <Path path={starFieldPath} color="rgba(245, 197, 24, 0.75)" style="fill" />
              </Group>
            );
          }
          return null;
        } else if (effect.effectType === 'mult_sector') {
          if (effect.sector >= 1 && effect.sector <= 20) {
            const seg = segments.find(s => s.num === effect.sector);
            if (!seg) return null;
            return (
              <React.Fragment key={`mult-plaid-${effect.sector}`}>
                <Group clip={seg.innerSingle}>
                  <Rect x={0} y={0} width={size} height={size} color="rgba(10, 30, 80, 0.75)" />
                  <Path path={plaidHLines} color="rgba(255, 255, 255, 0.55)" style="stroke" strokeWidth={2} />
                  <Path path={plaidVLines} color="rgba(100, 180, 255, 0.55)" style="stroke" strokeWidth={2} />
                </Group>
                <Group clip={seg.outerSingle}>
                  <Rect x={0} y={0} width={size} height={size} color="rgba(10, 30, 80, 0.75)" />
                  <Path path={plaidHLines} color="rgba(255, 255, 255, 0.55)" style="stroke" strokeWidth={2} />
                  <Path path={plaidVLines} color="rgba(100, 180, 255, 0.55)" style="stroke" strokeWidth={2} />
                </Group>
              </React.Fragment>
            );
          } else if (effect.sector === 25) {
            const clipPath = Skia.Path.Make();
            (clipPath as any).addCircle(cx, cy, boardR * RING_RADII.outerBull);
            return (
              <Group key={`mult-plaid-${effect.sector}`} clip={clipPath}>
                <Rect x={0} y={0} width={size} height={size} color="rgba(10, 30, 80, 0.75)" />
                <Path path={plaidHLines} color="rgba(255, 255, 255, 0.55)" style="stroke" strokeWidth={2} />
                <Path path={plaidVLines} color="rgba(100, 180, 255, 0.55)" style="stroke" strokeWidth={2} />
              </Group>
            );
          } else if (effect.sector === 50) {
            const clipPath = Skia.Path.Make();
            (clipPath as any).addCircle(cx, cy, boardR * RING_RADII.bull);
            return (
              <Group key={`mult-plaid-${effect.sector}`} clip={clipPath}>
                <Rect x={0} y={0} width={size} height={size} color="rgba(10, 30, 80, 0.75)" />
                <Path path={plaidHLines} color="rgba(255, 255, 255, 0.55)" style="stroke" strokeWidth={2} />
                <Path path={plaidVLines} color="rgba(100, 180, 255, 0.55)" style="stroke" strokeWidth={2} />
              </Group>
            );
          }
          return null;
        } else if (effect.effectType === 'diamond_sector') {
          if (effect.sector >= 1 && effect.sector <= 20) {
            const seg = segments.find(s => s.num === effect.sector);
            if (!seg) return null;
            return (
              <React.Fragment key={`diamond-${effect.sector}`}>
                <Group clip={seg.innerSingle}>
                  <Rect x={0} y={0} width={size} height={size} color="rgba(0, 200, 220, 0.45)" />
                  <Path path={diamondLines1} color="rgba(0, 240, 255, 0.5)" style="stroke" strokeWidth={1.5} />
                  <Path path={diamondLines2} color="rgba(0, 240, 255, 0.5)" style="stroke" strokeWidth={1.5} />
                </Group>
                <Group clip={seg.outerSingle}>
                  <Rect x={0} y={0} width={size} height={size} color="rgba(0, 200, 220, 0.45)" />
                  <Path path={diamondLines1} color="rgba(0, 240, 255, 0.5)" style="stroke" strokeWidth={1.5} />
                  <Path path={diamondLines2} color="rgba(0, 240, 255, 0.5)" style="stroke" strokeWidth={1.5} />
                </Group>
              </React.Fragment>
            );
          } else if (effect.sector === 25) {
            const clipPath = Skia.Path.Make();
            (clipPath as any).addCircle(cx, cy, boardR * RING_RADII.outerBull);
            return (
              <Group key={`diamond-${effect.sector}`} clip={clipPath}>
                <Rect x={0} y={0} width={size} height={size} color="rgba(0, 200, 220, 0.45)" />
                <Path path={diamondLines1} color="rgba(0, 240, 255, 0.5)" style="stroke" strokeWidth={1.5} />
                <Path path={diamondLines2} color="rgba(0, 240, 255, 0.5)" style="stroke" strokeWidth={1.5} />
              </Group>
            );
          } else if (effect.sector === 50) {
            const clipPath = Skia.Path.Make();
            (clipPath as any).addCircle(cx, cy, boardR * RING_RADII.bull);
            return (
              <Group key={`diamond-${effect.sector}`} clip={clipPath}>
                <Rect x={0} y={0} width={size} height={size} color="rgba(0, 200, 220, 0.45)" />
                <Path path={diamondLines1} color="rgba(0, 240, 255, 0.5)" style="stroke" strokeWidth={1.5} />
                <Path path={diamondLines2} color="rgba(0, 240, 255, 0.5)" style="stroke" strokeWidth={1.5} />
              </Group>
            );
          }
          return null;
        } else if (effect.effectType === 'glass_sector') {
          if (effect.sector >= 1 && effect.sector <= 20) {
            const seg = segments.find(s => s.num === effect.sector);
            if (!seg) return null;
            return (
              <React.Fragment key={`glass-${effect.sector}`}>
                <Path path={seg.innerSingle} color={COLORS.border} />
                <Path path={seg.outerSingle} color={COLORS.border} />
                <Group clip={seg.innerSingle}>
                  <Rect x={0} y={0} width={size} height={size} color="rgba(200, 235, 255, 0.22)" />
                  <Path path={glassStreaks} color="rgba(255, 255, 255, 0.6)" style="stroke" strokeWidth={2.5} />
                </Group>
                <Group clip={seg.outerSingle}>
                  <Rect x={0} y={0} width={size} height={size} color="rgba(200, 235, 255, 0.22)" />
                  <Path path={glassStreaks} color="rgba(255, 255, 255, 0.6)" style="stroke" strokeWidth={2.5} />
                </Group>
              </React.Fragment>
            );
          } else if (effect.sector === 25) {
            const clipPath = Skia.Path.Make();
            (clipPath as any).addCircle(cx, cy, boardR * RING_RADII.outerBull);
            return (
              <React.Fragment key={`glass-${effect.sector}`}>
                <Circle cx={cx} cy={cy} r={boardR * RING_RADII.outerBull} color={COLORS.border} />
                <Group clip={clipPath}>
                  <Rect x={0} y={0} width={size} height={size} color="rgba(200, 235, 255, 0.22)" />
                  <Path path={glassStreaks} color="rgba(255, 255, 255, 0.6)" style="stroke" strokeWidth={2.5} />
                </Group>
              </React.Fragment>
            );
          } else if (effect.sector === 50) {
            const clipPath = Skia.Path.Make();
            (clipPath as any).addCircle(cx, cy, boardR * RING_RADII.bull);
            return (
              <React.Fragment key={`glass-${effect.sector}`}>
                <Circle cx={cx} cy={cy} r={boardR * RING_RADII.bull} color={COLORS.border} />
                <Group clip={clipPath}>
                  <Rect x={0} y={0} width={size} height={size} color="rgba(200, 235, 255, 0.22)" />
                  <Path path={glassStreaks} color="rgba(255, 255, 255, 0.6)" style="stroke" strokeWidth={2.5} />
                </Group>
              </React.Fragment>
            );
          }
          return null;
        }
        return null;
      })}

      {/* Re-render inner bull on top when sector 25 has an overlay (effect only on ring) */}
      {boardEffects?.some(e => e.sector === 25 && (['bonus_sector', 'mult_sector', 'diamond_sector', 'glass_sector'] as string[]).includes(e.effectType)) && (
        <Circle cx={cx} cy={cy} r={boardR * RING_RADII.bull} color={COLORS.bull} />
      )}

      {/* Segment numbers */}
      {font &&
        segments.map(({ num, nx, ny }) => {
          if (deadSectors?.includes(num)) return null;
          const text = num.toString();
          const measured = font.measureText(text);
          return (
            <Text
              key={`num-${num}`}
              x={nx - measured.width / 2}
              y={ny + measured.height / 4}
              text={text}
              font={font}
              color={COLORS.numberColor}
            />
          );
        })}

      {/* Aim indicator — large fuzzy zone, no center */}
      {aimIndicator && (
        <Group>
          <Circle cx={aimIndicator.x} cy={aimIndicator.y} r={aimIndicator.radius} color="rgba(0,212,255,0.08)" />
          <Circle cx={aimIndicator.x} cy={aimIndicator.y} r={aimIndicator.radius} color="rgba(0,212,255,0.5)" style="stroke" strokeWidth={1.5} />
        </Group>
      )}

      {/* Dart markers — 3 flight lines meeting at impact point */}
      {darts.map((dart, i) => {
        const cx = dart.x;
        const cy = dart.y;
        const flightLen = 7;
        return (
          <Group key={`dart-${i}`}>
            {[Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3].map((θ, j) => (
              <Path
                key={j}
                path={`M ${cx} ${cy} L ${(cx + flightLen * Math.cos(θ)).toFixed(1)} ${(cy + flightLen * Math.sin(θ)).toFixed(1)}`}
                color="#00d4ff"
                style="stroke"
                strokeWidth={2}
              />
            ))}
          </Group>
        );
      })}
    </Canvas>
  );
}

// Converts a board-canvas (x, y) to absolute screen position for hit testing
export function boardRadius(size: number): number {
  return size * 0.38;
}
