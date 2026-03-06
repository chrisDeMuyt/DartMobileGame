// Web-specific Slingshot: computes Skia paths in regular useMemo (no Reanimated worklets)
// because Reanimated cannot serialize JSI Skia path objects on web.
import React, { useState, useMemo, useRef } from 'react';
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

export default function Slingshot({ width, height, disabled, onThrow, onAimUpdate }: SlingshotProps) {
  const cx = width / 2;
  const forkSplitY = height * 0.52;
  const leftTipX = cx - 54;
  const leftTipY = height * 0.10;
  const rightTipX = cx + 54;
  const rightTipY = height * 0.10;
  const forkBaseY = height - 8;
  const restX = cx;
  const restY = forkSplitY;

  const [pull, setPull] = useState({ x: restX, y: restY });
  // Ref so onEnd always reads the latest pull without stale closure issues
  const pullRef = useRef({ x: restX, y: restY });
  const startRef = useRef({ x: 0, y: 0 });

  const paths = useMemo(() => {
    const px = pull.x;
    const py = pull.y;

    const leftBand = Skia.Path.Make();
    leftBand.moveTo(leftTipX, leftTipY);
    leftBand.lineTo(px, py);

    const rightBand = Skia.Path.Make();
    rightBand.moveTo(rightTipX, rightTipY);
    rightBand.lineTo(px, py);

    const forkPath = Skia.Path.Make();
    forkPath.moveTo(cx, forkBaseY);
    forkPath.lineTo(cx, forkSplitY);
    forkPath.moveTo(cx, forkSplitY);
    forkPath.lineTo(leftTipX, leftTipY);
    forkPath.moveTo(cx, forkSplitY);
    forkPath.lineTo(rightTipX, rightTipY);

    const trajectoryPath = Skia.Path.Make();
    const tdx = px - restX;
    const tdy = py - restY;
    const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
    if (tdist >= 8) {
      const throwDX = -tdx / tdist;
      const throwDY = -tdy / tdist;
      const power = Math.min(1, tdist / MAX_PULL);
      const lineLen = power * height * 0.9;
      let drawn = 0;
      let dash = true;
      while (drawn < lineLen) {
        const seg = Math.min(dash ? 9 : 6, lineLen - drawn);
        if (dash) {
          trajectoryPath.moveTo(px + throwDX * drawn, py + throwDY * drawn);
          trajectoryPath.lineTo(px + throwDX * (drawn + seg), py + throwDY * (drawn + seg));
        }
        drawn += seg;
        dash = !dash;
      }
    }

    const ddx = restX - px;
    const ddy = restY - py;
    const dlen = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
    const nx = ddx / dlen;
    const ny = ddy / dlen;
    const perpX = -ny;
    const perpY = nx;

    const dartPath = Skia.Path.Make();
    dartPath.moveTo(px + nx * 14, py + ny * 14);
    dartPath.lineTo(px + perpX * 5, py + perpY * 5);
    dartPath.lineTo(px - nx * 18, py - ny * 18);
    dartPath.lineTo(px - perpX * 5, py - perpY * 5);
    dartPath.close();

    const tailX = px - nx * 18;
    const tailY = py - ny * 18;
    const flightsPath = Skia.Path.Make();
    flightsPath.moveTo(tailX, tailY);
    flightsPath.lineTo(tailX - nx * 6 + perpX * 8, tailY - ny * 6 + perpY * 8);
    flightsPath.moveTo(tailX, tailY);
    flightsPath.lineTo(tailX - nx * 6 - perpX * 8, tailY - ny * 6 - perpY * 8);

    return { leftBand, rightBand, forkPath, trajectoryPath, dartPath, flightsPath };
  }, [pull.x, pull.y, cx, forkSplitY, leftTipX, leftTipY, rightTipX, rightTipY, forkBaseY, restX, restY, height]);

  const gesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin(e => {
      startRef.current = { x: e.x, y: e.y };
    })
    .onChange(e => {
      let dx = e.x - startRef.current.x;
      let dy = Math.max(0, e.y - startRef.current.y);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > MAX_PULL) {
        const s = MAX_PULL / dist;
        dx *= s;
        dy *= s;
      }
      const next = { x: restX + dx, y: restY + dy };
      pullRef.current = next;
      setPull(next);
      onAimUpdate(dx / MAX_PULL, dy / MAX_PULL);
    })
    .onEnd(() => {
      const dx = pullRef.current.x - restX;
      const dy = pullRef.current.y - restY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist / MAX_PULL >= 0.12) {
        onThrow(dx / MAX_PULL, dy / MAX_PULL);
      }
      const rest = { x: restX, y: restY };
      pullRef.current = rest;
      setPull(rest);
      onAimUpdate(0, 0);
    })
    .onFinalize(() => {
      const rest = { x: restX, y: restY };
      pullRef.current = rest;
      setPull(rest);
      onAimUpdate(0, 0);
    });

  return (
    <GestureDetector gesture={disabled ? Gesture.Pan().runOnJS(true) : gesture}>
      <View style={{ width, height, opacity: disabled ? 0.35 : 1 }}>
        <Canvas style={{ width, height }}>
          <Path path={paths.trajectoryPath} color="rgba(245,197,24,0.80)" style="stroke" strokeWidth={2.5} />

          <Path path={paths.forkPath} color="rgba(0,0,0,0.35)" style="stroke" strokeWidth={16}
            strokeCap={StrokeCap.Round} strokeJoin={StrokeJoin.Round} />
          <Path path={paths.forkPath} color={FORK_COLOR} style="stroke" strokeWidth={13}
            strokeCap={StrokeCap.Round} strokeJoin={StrokeJoin.Round} />
          <Path path={paths.forkPath} color={FORK_HIGHLIGHT} style="stroke" strokeWidth={5}
            strokeCap={StrokeCap.Round} strokeJoin={StrokeJoin.Round} />

          <Path path={paths.leftBand} color="rgba(100,10,0,0.4)" style="stroke" strokeWidth={9} strokeCap={StrokeCap.Round} />
          <Path path={paths.rightBand} color="rgba(100,10,0,0.4)" style="stroke" strokeWidth={9} strokeCap={StrokeCap.Round} />
          <Path path={paths.leftBand} color={BAND_COLOR} style="stroke" strokeWidth={6} strokeCap={StrokeCap.Round} />
          <Path path={paths.rightBand} color={BAND_COLOR} style="stroke" strokeWidth={6} strokeCap={StrokeCap.Round} />

          <Circle cx={leftTipX} cy={leftTipY} r={7} color={FORK_COLOR} />
          <Circle cx={rightTipX} cy={rightTipY} r={7} color={FORK_COLOR} />

          <Path path={paths.dartPath} color="rgba(0,0,0,0.4)" style="fill" />
          <Path path={paths.dartPath} color="#C8C8C8" style="fill" />
          <Path path={paths.flightsPath} color="#00d4ff" style="stroke" strokeWidth={3} strokeCap={StrokeCap.Round} />
          <Circle cx={pull.x} cy={pull.y} r={2.5} color="rgba(255,255,255,0.6)" />
        </Canvas>
      </View>
    </GestureDetector>
  );
}
