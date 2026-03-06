import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Canvas, Path, Skia, StrokeCap } from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  runOnJS,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

interface Props {
  from: { x: number; y: number };
  to: { x: number; y: number };
  flightColor: string;
  width: number;
  height: number;
  onLanded: () => void;
}

export default function FlyingDartOverlay({ from, to, flightColor, width, height, onLanded }: Props) {
  // Bezier control point — arc the dart slightly so it feels like it's thrown upward
  const cpX = from.x * 0.4 + to.x * 0.6;
  const cpY = to.y - 40;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 380,
      easing: Easing.out(Easing.cubic),
    }, (finished) => {
      if (finished) runOnJS(onLanded)();
    });
    return () => cancelAnimation(progress);
  }, []);

  // Dart body (kite shape pointing in direction of travel)
  const dartBodyPath = useDerivedValue(() => {
    const t = progress.value;
    const inv = 1 - t;

    // Quadratic bezier position
    const px = inv * inv * from.x + 2 * inv * t * cpX + t * t * to.x;
    const py = inv * inv * from.y + 2 * inv * t * cpY + t * t * to.y;

    // Bezier tangent = direction of travel
    const dvx = 2 * inv * (cpX - from.x) + 2 * t * (to.x - cpX);
    const dvy = 2 * inv * (cpY - from.y) + 2 * t * (to.y - cpY);
    const len = Math.sqrt(dvx * dvx + dvy * dvy) || 1;
    const nx = dvx / len;
    const ny = dvy / len;
    const perpX = -ny;
    const perpY = nx;

    // Scale up as it gets closer (perspective illusion)
    const scale = 0.5 + 0.5 * t;
    const tipLen = 16 * scale;
    const tailLen = 22 * scale;
    const hw = 5 * scale;

    const p = Skia.Path.Make();
    p.moveTo(px + nx * tipLen, py + ny * tipLen);
    p.lineTo(px + perpX * hw, py + perpY * hw);
    p.lineTo(px - nx * tailLen, py - ny * tailLen);
    p.lineTo(px - perpX * hw, py - perpY * hw);
    p.close();
    return p;
  });

  // Flight fins at the tail
  const dartFlightsPath = useDerivedValue(() => {
    const t = progress.value;
    const inv = 1 - t;

    const px = inv * inv * from.x + 2 * inv * t * cpX + t * t * to.x;
    const py = inv * inv * from.y + 2 * inv * t * cpY + t * t * to.y;
    const dvx = 2 * inv * (cpX - from.x) + 2 * t * (to.x - cpX);
    const dvy = 2 * inv * (cpY - from.y) + 2 * t * (to.y - cpY);
    const len = Math.sqrt(dvx * dvx + dvy * dvy) || 1;
    const nx = dvx / len;
    const ny = dvy / len;
    const perpX = -ny;
    const perpY = nx;

    const scale = 0.5 + 0.5 * t;
    const tailLen = 22 * scale;
    const fw = 9 * scale;
    const fl = 10 * scale;

    const tailX = px - nx * tailLen;
    const tailY = py - ny * tailLen;

    const p = Skia.Path.Make();
    p.moveTo(tailX, tailY);
    p.lineTo(tailX - nx * fl + perpX * fw, tailY - ny * fl + perpY * fw);
    p.moveTo(tailX, tailY);
    p.lineTo(tailX - nx * fl - perpX * fw, tailY - ny * fl - perpY * fw);
    return p;
  });

  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, width, height }}
      pointerEvents="none"
    >
      <Canvas style={{ width, height }}>
        <Path path={dartBodyPath} color="#d0d0d0" style="fill" />
        <Path
          path={dartFlightsPath}
          color={flightColor}
          style="stroke"
          strokeWidth={3}
          strokeCap={StrokeCap.Round}
        />
      </Canvas>
    </View>
  );
}
