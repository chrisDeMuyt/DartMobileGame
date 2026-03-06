import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import {
  Canvas,
  Path,
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

interface DartboardProps {
  size: number;
  darts?: DartMarker[];
  aimIndicator?: { x: number; y: number; radius: number } | null;
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

export default function Dartboard({ size, darts = [], aimIndicator }: DartboardProps) {
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
