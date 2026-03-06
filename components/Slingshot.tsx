import React from 'react';
import { View } from 'react-native';
import {
  Canvas,
  Path,
  Circle,
  Skia,
  StrokeCap,
  StrokeJoin,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  useSharedValue,
  useDerivedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

interface SlingshotProps {
  width: number;
  height: number;
  disabled?: boolean;
  onThrow: (normX: number, normY: number) => void;
  onAimUpdate: (normX: number, normY: number) => void;
}

const MAX_PULL = 85;
const FORK_COLOR = '#1a3a5c';
const FORK_HIGHLIGHT = '#00d4ff';
const BAND_COLOR = '#cc2200';

export default function Slingshot({
  width,
  height,
  disabled,
  onThrow,
  onAimUpdate,
}: SlingshotProps) {
  const cx = width / 2;

  // Fork geometry
  const forkSplitY = height * 0.52;
  const leftTipX = cx - 54;
  const leftTipY = height * 0.10;
  const rightTipX = cx + 54;
  const rightTipY = height * 0.10;
  const forkBaseY = height - 8;

  // Dart rests at fork split
  const restX = cx;
  const restY = forkSplitY;

  // Animated pull position
  const pullX = useSharedValue(restX);
  const pullY = useSharedValue(restY);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const active = useSharedValue(false);

  const emitAim = (normX: number, normY: number) => onAimUpdate(normX, normY);
  const emitThrow = (normX: number, normY: number) => onThrow(normX, normY);

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin(e => {
      startX.value = e.x;
      startY.value = e.y;
      active.value = true;
    })
    .onChange(e => {
      if (!active.value) return;
      let dx = e.x - startX.value;
      let dy = Math.max(0, e.y - startY.value); // only downward
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > MAX_PULL) {
        const s = MAX_PULL / dist;
        dx *= s;
        dy *= s;
      }
      pullX.value = restX + dx;
      pullY.value = restY + dy;
      runOnJS(emitAim)(dx / MAX_PULL, dy / MAX_PULL);
    })
    .onEnd(() => {
      if (!active.value) return;
      active.value = false;
      const dx = pullX.value - restX;
      const dy = pullY.value - restY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const normX = dx / MAX_PULL;
      const normY = dy / MAX_PULL;
      pullX.value = withSpring(restX, { damping: 5, stiffness: 160 });
      pullY.value = withSpring(restY, { damping: 5, stiffness: 160 });
      if (dist / MAX_PULL >= 0.12) {
        runOnJS(emitThrow)(normX, normY);
      }
      runOnJS(emitAim)(0, 0);
    })
    .onFinalize(() => {
      active.value = false;
      pullX.value = withSpring(restX, { damping: 5, stiffness: 160 });
      pullY.value = withSpring(restY, { damping: 5, stiffness: 160 });
      runOnJS(emitAim)(0, 0);
    });

  // ---- Animated paths ----

  const leftBand = useDerivedValue(() => {
    const p = Skia.Path.Make();
    p.moveTo(leftTipX, leftTipY);
    p.lineTo(pullX.value, pullY.value);
    return p;
  });

  const rightBand = useDerivedValue(() => {
    const p = Skia.Path.Make();
    p.moveTo(rightTipX, rightTipY);
    p.lineTo(pullX.value, pullY.value);
    return p;
  });

  // Dashed trajectory line from pull point upward in throw direction
  const trajectoryPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const dx = pullX.value - restX;
    const dy = pullY.value - restY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 8) return p;

    // Throw direction = opposite of pull
    const throwDX = -dx / dist;
    const throwDY = -dy / dist;
    const power = Math.min(1, dist / MAX_PULL);
    const lineLen = power * height * 0.9;

    const sx = pullX.value;
    const sy = pullY.value;
    const dashLen = 9;
    const gapLen = 6;
    let drawn = 0;
    let dash = true;
    while (drawn < lineLen) {
      const seg = Math.min(dash ? dashLen : gapLen, lineLen - drawn);
      if (dash) {
        p.moveTo(sx + throwDX * drawn, sy + throwDY * drawn);
        p.lineTo(sx + throwDX * (drawn + seg), sy + throwDY * (drawn + seg));
      }
      drawn += seg;
      dash = !dash;
    }
    return p;
  });

  // Dart shape — kite pointing in throw direction
  const dartPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const px = pullX.value;
    const py = pullY.value;
    const dx = restX - px;
    const dy = restY - py;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const perpX = -ny;
    const perpY = nx;

    // Tip (front, pointing toward board)
    const tipX = px + nx * 14;
    const tipY = py + ny * 14;
    // Widest point
    const w1x = px + perpX * 5;
    const w1y = py + perpY * 5;
    const w2x = px - perpX * 5;
    const w2y = py - perpY * 5;
    // Tail (back, flights area)
    const tailX = px - nx * 18;
    const tailY = py - ny * 18;

    p.moveTo(tipX, tipY);
    p.lineTo(w1x, w1y);
    p.lineTo(tailX, tailY);
    p.lineTo(w2x, w2y);
    p.close();
    return p;
  });

  // Dart flights (fins at the tail)
  const flightsPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const px = pullX.value;
    const py = pullY.value;
    const dx = restX - px;
    const dy = restY - py;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const perpX = -ny;
    const perpY = nx;

    const tailX = px - nx * 18;
    const tailY = py - ny * 18;
    const f1x = tailX - nx * 6 + perpX * 8;
    const f1y = tailY - ny * 6 + perpY * 8;
    const f2x = tailX - nx * 6 - perpX * 8;
    const f2y = tailY - ny * 6 - perpY * 8;

    p.moveTo(tailX, tailY);
    p.lineTo(f1x, f1y);
    p.moveTo(tailX, tailY);
    p.lineTo(f2x, f2y);
    return p;
  });

  // Static fork (Y shape)
  const forkPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    p.moveTo(cx, forkBaseY);
    p.lineTo(cx, forkSplitY);
    p.moveTo(cx, forkSplitY);
    p.lineTo(leftTipX, leftTipY);
    p.moveTo(cx, forkSplitY);
    p.lineTo(rightTipX, rightTipY);
    return p;
  });

  return (
    <GestureDetector gesture={disabled ? Gesture.Pan() : gesture}>
      <View style={{ width, height, opacity: disabled ? 0.35 : 1 }}>
        <Canvas style={{ width, height }}>
          {/* Trajectory preview */}
          <Path
            path={trajectoryPath}
            color="rgba(245,197,24,0.80)"
            style="stroke"
            strokeWidth={2.5}
          />

          {/* Fork shadow */}
          <Path
            path={forkPath}
            color="rgba(0,0,0,0.35)"
            style="stroke"
            strokeWidth={16}
            strokeCap={StrokeCap.Round}
            strokeJoin={StrokeJoin.Round}
          />
          {/* Fork body */}
          <Path
            path={forkPath}
            color={FORK_COLOR}
            style="stroke"
            strokeWidth={13}
            strokeCap={StrokeCap.Round}
            strokeJoin={StrokeJoin.Round}
          />
          {/* Fork grain highlight */}
          <Path
            path={forkPath}
            color={FORK_HIGHLIGHT}
            style="stroke"
            strokeWidth={5}
            strokeCap={StrokeCap.Round}
            strokeJoin={StrokeJoin.Round}
          />

          {/* Rubber band shadow */}
          <Path path={leftBand} color="rgba(100,10,0,0.4)" style="stroke" strokeWidth={9} strokeCap={StrokeCap.Round} />
          <Path path={rightBand} color="rgba(100,10,0,0.4)" style="stroke" strokeWidth={9} strokeCap={StrokeCap.Round} />

          {/* Rubber band */}
          <Path path={leftBand} color={BAND_COLOR} style="stroke" strokeWidth={6} strokeCap={StrokeCap.Round} />
          <Path path={rightBand} color={BAND_COLOR} style="stroke" strokeWidth={6} strokeCap={StrokeCap.Round} />

          {/* Fork tips (small knobs) */}
          <Circle cx={leftTipX} cy={leftTipY} r={7} color={FORK_COLOR} />
          <Circle cx={rightTipX} cy={rightTipY} r={7} color={FORK_COLOR} />

          {/* Dart shadow */}
          <Path path={dartPath} color="rgba(0,0,0,0.4)" style="fill" />
          {/* Dart body */}
          <Path path={dartPath} color="#C8C8C8" style="fill" />
          {/* Dart flights */}
          <Path path={flightsPath} color="#00d4ff" style="stroke" strokeWidth={3} strokeCap={StrokeCap.Round} />
          {/* Dart center glint */}
          <Circle cx={pullX} cy={pullY} r={2.5} color="rgba(255,255,255,0.6)" />
        </Canvas>
      </View>
    </GestureDetector>
  );
}
