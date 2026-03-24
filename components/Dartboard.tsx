import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import {
  Canvas,
  Path,
  Rect,
  Circle,
  Text,
  matchFont,
  Skia,
  Group,
} from '@shopify/react-native-skia';
import { SEGMENT_ORDER, RING_RADII, DartHit } from '../lib/dartboard';

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

export default function Dartboard({ size, darts = [], aimIndicator, boardEffects }: DartboardProps) {
  const cx = size / 2;
  const cy = size / 2;
  // boardR = radius of the scoring area (double ring outer edge)
  // Numbers sit just outside this, so boardR must leave room in canvas
  const boardR = size * 0.38;
  const numRadius = boardR * 1.22;
  const fontSize = Math.max(9, boardR * 0.1);

  const font = useMemo(() => {
    try {
      return matchFont({
        fontFamily: Platform.select({ ios: 'Helvetica', android: 'sans-serif' }) ?? 'sans-serif',
        fontSize,
        fontWeight: 'bold',
      });
    } catch {
      return null;
    }
  }, [fontSize]);

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

  const starFieldPath = useMemo(() => makeStarField(size), [size]);
  const plaidHLines = useMemo(() => makePlaidLines(size, 14, 'h'), [size]);
  const plaidVLines = useMemo(() => makePlaidLines(size, 14, 'v'), [size]);
  const diamondLines1 = useMemo(() => makeDiamondLines(size, 16, 1), [size]);
  const diamondLines2 = useMemo(() => makeDiamondLines(size, 16, -1), [size]);

  return (
    <Canvas style={{ width: size, height: size }}>
      {/* Wooden border */}
      <Circle cx={cx} cy={cy} r={boardR * 1.18} color={COLORS.border} />

      {/* Board background */}
      <Circle cx={cx} cy={cy} r={boardR} color={COLORS.singleBlack} />

      {/* Segments */}
      {segments.map(({ num, innerSingle, triple, outerSingle, double, singleColor, tripleColor, doubleColor }) => (
        <Group key={num}>
          <Path path={innerSingle} color={singleColor} />
          <Path path={triple} color={tripleColor} />
          <Path path={outerSingle} color={singleColor} />
          <Path path={double} color={doubleColor} />
        </Group>
      ))}

      {/* Outer bull (25) */}
      <Circle cx={cx} cy={cy} r={boardR * RING_RADII.outerBull} color={COLORS.outerBull} />

      {/* Inner bull (50) */}
      <Circle cx={cx} cy={cy} r={boardR * RING_RADII.bull} color={COLORS.bull} />

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
        }
        return null;
      })}

      {/* Re-render inner bull on top when sector 25 has an overlay (effect only on ring) */}
      {boardEffects?.some(e => e.sector === 25 && (e.effectType === 'bonus_sector' || e.effectType === 'mult_sector' || e.effectType === 'diamond_sector')) && (
        <Circle cx={cx} cy={cy} r={boardR * RING_RADII.bull} color={COLORS.bull} />
      )}

      {/* Segment numbers */}
      {font &&
        segments.map(({ num, nx, ny }) => {
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

      {/* Dart markers */}
      {darts.map((dart, i) => (
        <Group key={`dart-${i}`}>
          {/* Shadow */}
          <Circle cx={dart.x + 1} cy={dart.y + 1} r={6} color="rgba(0,0,0,0.4)" />
          {/* Dart dot */}
          <Circle cx={dart.x} cy={dart.y} r={5} color={dart.color} />
          {/* Highlight */}
          <Circle cx={dart.x - 1} cy={dart.y - 1} r={2} color="rgba(255,255,255,0.4)" />
        </Group>
      ))}
    </Canvas>
  );
}

// Converts a board-canvas (x, y) to absolute screen position for hit testing
export function boardRadius(size: number): number {
  return size * 0.38;
}
