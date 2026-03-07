import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { PIXEL_FONT, pixelShadowSm, COLORS } from '../lib/theme';
import { RoundsState } from '../lib/gameLogic';
import { DartHit } from '../lib/dartboard';

interface Props { state: RoundsState; }

// Returns the combo multiplier (1 = none, 2 = pair, 3 = triple) from a dart list
function getComboMult(darts: DartHit[]): number {
  const counts: Record<number, number> = {};
  for (const d of darts) {
    if (d.score > 0) counts[d.segment] = (counts[d.segment] ?? 0) + 1;
  }
  const max = Object.values(counts).reduce((m, v) => Math.max(m, v), 0);
  return max >= 3 ? 3 : max >= 2 ? 2 : 1;
}

export default function Scoreboard({ state }: Props) {
  const { turnTarget, turnScore, currentTurnDarts, mult, lastDartBonus } = state;
  const score = turnScore * mult;
  const delta = turnTarget - score;
  const targetMet = score >= turnTarget;
  const comboMult = getComboMult(currentTurnDarts);

  const [multTrigger, setMultTrigger] = useState(0);
  const [scoreTrigger, setScoreTrigger] = useState(0);
  const multTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // POINTS done → fire MULT after its duration
  const handlePointsDone = useCallback((duration: number) => {
    if (multTimerRef.current) clearTimeout(multTimerRef.current);
    multTimerRef.current = setTimeout(() => setMultTrigger(t => t + 1), duration);
  }, []);

  // MULT done → fire SCORE after its duration
  const handleMultDone = useCallback((duration: number) => {
    if (scoreTimerRef.current) clearTimeout(scoreTimerRef.current);
    scoreTimerRef.current = setTimeout(() => setScoreTrigger(t => t + 1), duration);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <StatBox label="TARGET" value={String(turnTarget)} valueStyle={styles.goldValue} />
        <AnimatedStatBox label="POINTS" numericValue={turnScore} labelStyle={styles.cyanLabel} valueStyle={styles.cyanValue} deltaColor={COLORS.cyan} onAnimDone={handlePointsDone} bonusDelta={lastDartBonus} />
        <Text style={styles.multSymbol}>×</Text>
        <AnimatedStatBox label="MULT" numericValue={mult} comboMult={comboMult} labelStyle={styles.redLabel} valueStyle={styles.redValue} deltaColor={COLORS.red} triggerKey={multTrigger} onAnimDone={handleMultDone} />
        <AnimatedStatBox label="SCORE" numericValue={score} valueStyle={styles.goldValue} deltaColor={COLORS.gold} triggerKey={scoreTrigger} />
      </View>

      <View style={styles.divider} />

      <DartChips darts={currentTurnDarts} />

      <Text style={[styles.deltaHint, targetMet ? styles.deltaHintMet : styles.deltaHintNeed]}>
        {targetMet ? 'TARGET MET!' : `NEED ${delta} MORE`}
      </Text>
    </View>
  );
}

// ---- Floating popup (text + color) ----

function DeltaPopup({ text, color }: { text: string; color: string }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -38, duration: 750, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(opacity, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.Text style={[styles.deltaPopup, { color, transform: [{ translateY }], opacity }]}>
      {text}
    </Animated.Text>
  );
}

// ---- Stat box with animated delta ----

type Popup = { id: number; text: string; color: string };

function AnimatedStatBox({
  label,
  numericValue,
  comboMult,
  valueStyle,
  labelStyle,
  deltaColor,
  triggerKey,
  onAnimDone,
  bonusDelta,
}: {
  label: string;
  numericValue: number;
  comboMult?: number;
  valueStyle?: object;
  labelStyle?: object;
  deltaColor: string;
  // undefined = fire immediately on value change (POINTS)
  // number = hold until triggerKey increments (MULT, SCORE)
  triggerKey?: number;
  onAnimDone?: (duration: number) => void;
  bonusDelta?: number;
}) {
  const prevRef = useRef(numericValue);
  const prevComboRef = useRef(comboMult ?? 1);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [displayedValue, setDisplayedValue] = useState(numericValue);
  const pendingRef = useRef<{ diff: number; newValue: number; newCombo: number; prevCombo: number } | null>(null);

  const spawn = useCallback((text: string, color: string, delay = 0) => {
    const id = Date.now() + Math.random();
    setTimeout(() => {
      setPopups(p => [...p, { id, text, color }]);
      setTimeout(() => setPopups(p => p.filter(x => x.id !== id)), 900);
    }, delay);
  }, []);

  const fireAnim = useCallback((diff: number, newCombo: number, prevCombo: number, newValue: number, bonusDeltaArg = 0) => {
    let duration: number;
    if (newCombo > prevCombo) {
      // Step 1: show +1 dart at intermediate value, Step 2: apply ×N multiplier
      const intermediate = newValue - diff + 1;
      setDisplayedValue(intermediate);
      spawn('+1', deltaColor, 0);
      setTimeout(() => setDisplayedValue(newValue), 380);
      spawn(`×${newCombo}`, COLORS.gold, 380);
      duration = 380 + 900;
    } else {
      const dartDiff = diff - bonusDeltaArg;
      setDisplayedValue(bonusDeltaArg > 0 ? newValue - bonusDeltaArg : newValue);
      spawn(`+${dartDiff}`, deltaColor, 0);
      duration = 900;
    }
    if (bonusDeltaArg > 0) {
      setTimeout(() => setDisplayedValue(newValue), duration);
      spawn(`+${bonusDeltaArg} BONUS!`, COLORS.gold, duration);
      duration = duration + 900;
    }
    onAnimDone?.(duration);
  }, [spawn, deltaColor, onAnimDone]);

  // Detect value changes
  useEffect(() => {
    const diff = numericValue - prevRef.current;
    const prevCombo = prevComboRef.current;
    const newCombo = comboMult ?? 1;
    prevRef.current = numericValue;
    prevComboRef.current = newCombo;

    if (diff <= 0) {
      // Reset (new turn) — update display immediately, clear any stale pending
      setDisplayedValue(numericValue);
      pendingRef.current = null;
      return;
    }

    if (triggerKey === undefined) {
      // POINTS: fire immediately
      fireAnim(diff, newCombo, prevCombo, numericValue, bonusDelta ?? 0);
    } else {
      // MULT / SCORE: hold until triggerKey fires
      pendingRef.current = { diff, newValue: numericValue, newCombo, prevCombo };
    }
  }, [numericValue]);

  // Fire pending animation when parent signals this box
  useEffect(() => {
    if (triggerKey === undefined) return;
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    fireAnim(p.diff, p.newCombo, p.prevCombo, p.newValue);
  }, [triggerKey]);

  return (
    <View style={[styles.stat, { overflow: 'visible' }]}>
      <Text style={[styles.statLabel, labelStyle]}>{label}</Text>
      <Text style={[styles.statValue, valueStyle]}>{displayedValue}</Text>
      {popups.map(({ id, text, color }) => (
        <DeltaPopup key={id} text={text} color={color} />
      ))}
    </View>
  );
}

// ---- Plain stat box ----

function StatBox({ label, value, valueStyle }: { label: string; value: string; valueStyle?: object }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueStyle]}>{value}</Text>
    </View>
  );
}

// ---- Dart chips ----

function DartChips({ darts }: { darts: DartHit[] }) {
  return (
    <View style={styles.dartHistory}>
      {darts.map((d, i) => (
        <View key={i} style={[styles.dartChip, d.score === 0 && styles.dartChipMiss]}>
          <Text style={styles.dartChipLabel}>{d.label}</Text>
        </View>
      ))}
      {[...Array(3 - darts.length)].map((_, i) => (
        <View key={`empty-${i}`} style={styles.dartChipEmpty} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.bgPanel,
    borderWidth: 2,
    borderColor: COLORS.bgCard,
    padding: 8,
    ...pixelShadowSm,
  },
  statLabel: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 6,
    letterSpacing: 1,
  },
  statValue: {
    fontFamily: PIXEL_FONT,
    color: COLORS.bright,
    fontSize: 16,
    marginTop: 4,
  },
  goldValue: { color: COLORS.gold, fontSize: 18 },
  cyanValue: { color: COLORS.cyan, fontSize: 18 },
  cyanLabel: { color: COLORS.cyan },
  redLabel:  { color: COLORS.red },
  redValue:  { color: COLORS.red, fontSize: 18 },
  multSymbol: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 14,
    alignSelf: 'center',
  },
  deltaPopup: {
    position: 'absolute',
    top: 0,
    fontFamily: PIXEL_FONT,
    fontSize: 11,
    letterSpacing: 1,
  },
  divider: {
    height: 2,
    backgroundColor: COLORS.bgCard,
  },
  dartHistory: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dartChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.bgPanel,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: COLORS.bgCard,
    ...pixelShadowSm,
  },
  dartChipMiss: { borderColor: COLORS.red },
  dartChipLabel: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 7,
  },
  dartChipEmpty: {
    width: 68,
    height: 32,
    backgroundColor: COLORS.bgDark,
    borderWidth: 2,
    borderColor: COLORS.bgCard,
    borderStyle: 'dashed',
  },
  deltaHint: {
    fontFamily: PIXEL_FONT,
    fontSize: 7,
    letterSpacing: 2,
    textAlign: 'center',
  },
  deltaHintNeed: { color: COLORS.muted },
  deltaHintMet:  { color: COLORS.cyan },
});
