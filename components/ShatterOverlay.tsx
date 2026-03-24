import React, { useEffect, useRef, useMemo } from 'react';
import { Animated } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { SEGMENT_ORDER, RING_RADII } from '../lib/dartboard';

interface Props {
  size: number;
  sector: number;
}

export default function ShatterOverlay({ size, sector }: Props) {
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const crackOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Flash: 0→1 over 80ms then 1→0 over 120ms
    Animated.sequence([
      Animated.timing(flashOpacity, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(flashOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start();

    // Cracks appear at 80ms, hold briefly, then fade out
    const t = setTimeout(() => {
      Animated.sequence([
        Animated.timing(crackOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.delay(130),
        Animated.timing(crackOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }, 80);
    return () => clearTimeout(t);
  }, []);

  const cx = size / 2;
  const cy = size / 2;
  const boardR = size * 0.38;

  const flashPath = useMemo(() => {
    const sectorIndex = SEGMENT_ORDER.indexOf(sector >= 1 && sector <= 20 ? sector : 20);
    const startAngle = sectorIndex * 18 - 99;
    const sweepAngle = 18;
    const innerR = boardR * RING_RADII.outerBull;
    const outerR = boardR * RING_RADII.doubleOuter;
    const startRad = (startAngle * Math.PI) / 180;
    const endAngle = startAngle + sweepAngle;
    const endRad = (endAngle * Math.PI) / 180;

    const path = Skia.Path.Make();
    path.moveTo(cx + innerR * Math.cos(startRad), cy + innerR * Math.sin(startRad));
    path.lineTo(cx + outerR * Math.cos(startRad), cy + outerR * Math.sin(startRad));
    path.arcToOval(
      { x: cx - outerR, y: cy - outerR, width: outerR * 2, height: outerR * 2 },
      startAngle, sweepAngle, false
    );
    path.lineTo(cx + innerR * Math.cos(endRad), cy + innerR * Math.sin(endRad));
    path.arcToOval(
      { x: cx - innerR, y: cy - innerR, width: innerR * 2, height: innerR * 2 },
      endAngle, -sweepAngle, false
    );
    path.close();
    return path;
  }, [size, sector]);

  const crackPath = useMemo(() => {
    const sectorIndex = SEGMENT_ORDER.indexOf(sector >= 1 && sector <= 20 ? sector : 20);
    const midAngle = sectorIndex * 18 - 90;
    const crackAngles = [midAngle - 6, midAngle - 2.5, midAngle + 0.5, midAngle + 3.5, midAngle + 7];
    const innerR = boardR * RING_RADII.trebleInner;
    const outerR = boardR * RING_RADII.doubleOuter;
    const midR = (innerR + outerR) * 0.52;

    const path = Skia.Path.Make();
    for (const angle of crackAngles) {
      const rad = (angle * Math.PI) / 180;
      const jagRad = ((angle + 2.2) * Math.PI) / 180;
      path.moveTo(cx + innerR * Math.cos(rad), cy + innerR * Math.sin(rad));
      path.lineTo(cx + midR * Math.cos(jagRad), cy + midR * Math.sin(jagRad));
      path.lineTo(cx + outerR * Math.cos(rad), cy + outerR * Math.sin(rad));
    }
    return path;
  }, [size, sector]);

  return (
    <>
      <Animated.View
        style={{ position: 'absolute', top: 0, left: 0, opacity: flashOpacity }}
        pointerEvents="none"
      >
        <Canvas style={{ width: size, height: size }}>
          <Path path={flashPath} color="rgba(255, 255, 255, 0.90)" style="fill" />
        </Canvas>
      </Animated.View>
      <Animated.View
        style={{ position: 'absolute', top: 0, left: 0, opacity: crackOpacity }}
        pointerEvents="none"
      >
        <Canvas style={{ width: size, height: size }}>
          <Path path={crackPath} color="rgba(255, 255, 255, 0.95)" style="stroke" strokeWidth={2.5} />
        </Canvas>
      </Animated.View>
    </>
  );
}
