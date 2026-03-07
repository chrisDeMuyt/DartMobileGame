import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import {
  Canvas,
  Path,
  Circle,
  Text as SkiaText,
  matchFont,
  Skia,
  Group,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SEGMENT_ORDER, RING_RADII, getDartScore } from '../lib/dartboard';
import { PIXEL_FONT, COLORS, pixelShadow } from '../lib/theme';

const BOARD_COLORS = {
  singleBlack:    '#1a1a1a',
  singleCream:    '#f0e0b0',
  tripleGreenEven:'#1a7a30',
  tripleRedOdd:   '#cc2200',
  doubleRedEven:  '#cc2200',
  doubleGreenOdd: '#1a7a30',
  outerBull:      '#1a7a30',
  bull:           '#cc2200',
  border:         '#0a1628',
  numberColor:    '#f5c518',
};

function makeAnnularSector(
  cx: number, cy: number,
  innerR: number, outerR: number,
  startAngle: number, sweepAngle: number,
) {
  const path = Skia.Path.Make();
  const startRad = (startAngle * Math.PI) / 180;
  const endAngle = startAngle + sweepAngle;
  const endRad   = (endAngle * Math.PI) / 180;

  path.moveTo(cx + innerR * Math.cos(startRad), cy + innerR * Math.sin(startRad));
  path.lineTo(cx + outerR * Math.cos(startRad), cy + outerR * Math.sin(startRad));
  path.arcToOval(
    { x: cx - outerR, y: cy - outerR, width: outerR * 2, height: outerR * 2 },
    startAngle, sweepAngle, false,
  );
  path.lineTo(cx + innerR * Math.cos(endRad), cy + innerR * Math.sin(endRad));
  path.arcToOval(
    { x: cx - innerR, y: cy - innerR, width: innerR * 2, height: innerR * 2 },
    endAngle, -sweepAngle, false,
  );
  path.close();
  return path;
}

function sectorLabel(sector: number): string {
  if (sector === 50) return 'BULLSEYE';
  if (sector === 25) return 'OUTER BULL';
  return `SECTOR  ${sector}`;
}

interface Props {
  size: number;
  itemName: string;
  itemDescription: string;
  onConfirm: (sector: number) => void;
  onSkip: () => void;
}

export default function BoardSectorPicker({ size, itemName, itemDescription, onConfirm, onSkip }: Props) {
  const [selectedSector, setSelectedSector] = useState<number | null>(null);

  const cx     = size / 2;
  const cy     = size / 2;
  const boardR = size * 0.38;
  const numRadius = boardR * 1.22;
  const fontSize  = Math.max(9, boardR * 0.1);

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
      const startAngle  = i * 18 - 99;
      const sweep       = 18;
      const centerAngle = i * 18 - 90;
      const isEven = i % 2 === 0;

      const singleColor = isEven ? BOARD_COLORS.singleBlack  : BOARD_COLORS.singleCream;
      const tripleColor = isEven ? BOARD_COLORS.tripleGreenEven : BOARD_COLORS.tripleRedOdd;
      const doubleColor = isEven ? BOARD_COLORS.doubleRedEven : BOARD_COLORS.doubleGreenOdd;

      const innerSingle = makeAnnularSector(cx, cy, boardR * RING_RADII.outerBull,   boardR * RING_RADII.trebleInner, startAngle, sweep);
      const triple      = makeAnnularSector(cx, cy, boardR * RING_RADII.trebleInner,  boardR * RING_RADII.trebleOuter, startAngle, sweep);
      const outerSingle = makeAnnularSector(cx, cy, boardR * RING_RADII.trebleOuter,  boardR * RING_RADII.doubleInner, startAngle, sweep);
      const double      = makeAnnularSector(cx, cy, boardR * RING_RADII.doubleInner,  boardR * RING_RADII.doubleOuter, startAngle, sweep);
      // Highlight path spans the full sector width (excludes bull area)
      const highlight   = makeAnnularSector(cx, cy, boardR * RING_RADII.outerBull,    boardR * RING_RADII.doubleOuter, startAngle, sweep);

      const centerRad = (centerAngle * Math.PI) / 180;
      const nx = cx + numRadius * Math.cos(centerRad);
      const ny = cy + numRadius * Math.sin(centerRad);

      return { num, innerSingle, triple, outerSingle, double, highlight, singleColor, tripleColor, doubleColor, nx, ny };
    });
  }, [size]);

  const tapGesture = useMemo(() =>
    Gesture.Tap()
      .runOnJS(true)
      .onEnd(e => {
        const hit = getDartScore(e.x - cx, e.y - cy, boardR);
        if (hit.segment !== 0) setSelectedSector(hit.segment);
      }),
    [cx, cy, boardR],
  );

  const highlightSeg = (selectedSector !== null && selectedSector >= 1 && selectedSector <= 20)
    ? segments.find(s => s.num === selectedSector) ?? null
    : null;

  return (
    <View style={styles.bg}>
      <Text style={styles.title}>CHOOSE A SECTOR</Text>
      <Text style={styles.itemName}>{itemName}</Text>
      <Text style={styles.itemDesc}>{itemDescription}</Text>

      <GestureDetector gesture={tapGesture}>
        <View style={{ width: size, height: size }}>
          <Canvas style={{ width: size, height: size }}>
            {/* Border */}
            <Circle cx={cx} cy={cy} r={boardR * 1.18} color={BOARD_COLORS.border} />
            {/* Board background */}
            <Circle cx={cx} cy={cy} r={boardR} color={BOARD_COLORS.singleBlack} />

            {/* Segments */}
            {segments.map(({ num, innerSingle, triple, outerSingle, double, singleColor, tripleColor, doubleColor }) => (
              <Group key={num}>
                <Path path={innerSingle} color={singleColor} />
                <Path path={triple}      color={tripleColor} />
                <Path path={outerSingle} color={singleColor} />
                <Path path={double}      color={doubleColor} />
              </Group>
            ))}

            {/* Bulls */}
            <Circle cx={cx} cy={cy} r={boardR * RING_RADII.outerBull} color={BOARD_COLORS.outerBull} />
            <Circle cx={cx} cy={cy} r={boardR * RING_RADII.bull}      color={BOARD_COLORS.bull} />

            {/* Highlight: sector 1–20 */}
            {highlightSeg && (
              <Path path={highlightSeg.highlight} color="rgba(255, 220, 0, 0.45)" />
            )}

            {/* Highlight: outer bull (25) — ring only, re-draw inner bull on top */}
            {selectedSector === 25 && (
              <Group>
                <Circle cx={cx} cy={cy} r={boardR * RING_RADII.outerBull} color="rgba(255, 220, 0, 0.5)" />
                <Circle cx={cx} cy={cy} r={boardR * RING_RADII.bull}      color={BOARD_COLORS.bull} />
              </Group>
            )}

            {/* Highlight: inner bull (50) */}
            {selectedSector === 50 && (
              <Circle cx={cx} cy={cy} r={boardR * RING_RADII.bull} color="rgba(255, 220, 0, 0.85)" />
            )}

            {/* Numbers */}
            {font && segments.map(({ num, nx, ny }) => {
              const text     = num.toString();
              const measured = font.measureText(text);
              return (
                <SkiaText
                  key={`n-${num}`}
                  x={nx - measured.width / 2}
                  y={ny + measured.height / 4}
                  text={text}
                  font={font}
                  color={BOARD_COLORS.numberColor}
                />
              );
            })}
          </Canvas>
        </View>
      </GestureDetector>

      {/* Selection status */}
      {selectedSector !== null ? (
        <View style={styles.confirmRow}>
          <Text style={styles.selectedText}>{sectorLabel(selectedSector)}</Text>
          <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm(selectedSector)}>
            <Text style={styles.confirmBtnText}>CONFIRM</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.hintText}>TAP A SECTOR TO SELECT</Text>
      )}

      <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
        <Text style={styles.skipText}>ASSIGN LATER</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(5, 15, 35, 0.98)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
  },
  title: {
    fontFamily: PIXEL_FONT,
    color: COLORS.gold,
    fontSize: 14,
    letterSpacing: 4,
  },
  itemName: {
    fontFamily: PIXEL_FONT,
    color: COLORS.bright,
    fontSize: 9,
    letterSpacing: 1,
  },
  itemDesc: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 5,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  hintText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 6,
    letterSpacing: 2,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  selectedText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.gold,
    fontSize: 8,
    letterSpacing: 2,
  },
  confirmBtn: {
    backgroundColor: COLORS.gold,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: COLORS.bright,
    ...pixelShadow,
  },
  confirmBtnText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.bgDark,
    fontSize: 8,
    letterSpacing: 1,
  },
  skipBtn: { paddingVertical: 8 },
  skipText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 6,
    letterSpacing: 1,
  },
});
