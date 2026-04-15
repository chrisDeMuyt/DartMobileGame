import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { PIXEL_FONT, pixelShadowSm, COLORS } from '../lib/theme';
import { RoundsState } from '../lib/gameLogic';

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
  const { turnTarget, turnScore, currentTurnDarts, mult, lastDartBonus, lastDartMultBonus } = state;
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
        <AnimatedStatBox label="MULT" numericValue={mult} comboMult={comboMult} labelStyle={styles.redLabel} valueStyle={styles.redValue} deltaColor={COLORS.red} triggerKey={multTrigger} onAnimDone={handleMultDone} multSectorBonus={lastDartMultBonus} multDartBonus={state.lastMultDartBonus} diamondMult={state.lastDiamondMult} glassMult={state.lastGlassMult} />
        <AnimatedStatBox label="SCORE" numericValue={score} valueStyle={styles.goldValue} deltaColor={COLORS.gold} triggerKey={scoreTrigger} />
      </View>

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
  multSectorBonus,
  multDartBonus,
  diamondMult,
  glassMult,
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
  multSectorBonus?: number;
  multDartBonus?: number;
  diamondMult?: number;
  glassMult?: number;
}) {
  const prevRef = useRef(numericValue);
  const prevComboRef = useRef(comboMult ?? 1);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [displayedValue, setDisplayedValue] = useState(numericValue);
  const pendingRef = useRef<{ diff: number; newValue: number; newCombo: number; prevCombo: number; multSectorBonus: number; multDartBonus: number; diamondMult: number; glassMult: number } | null>(null);

  const spawn = useCallback((text: string, color: string, delay = 0) => {
    const id = Date.now() + Math.random();
    setTimeout(() => {
      setPopups(p => [...p, { id, text, color }]);
      setTimeout(() => setPopups(p => p.filter(x => x.id !== id)), 900);
    }, delay);
  }, []);

  const fireAnim = useCallback((diff: number, newCombo: number, prevCombo: number, newValue: number, bonusDeltaArg = 0, multSectorBonusArg = 0, multDartBonusArg = 0, diamondMultArg = 1, glassMultArg = 1) => {
    // Separate out the diamond multiplier so we can animate it as a distinct step
    const prevValue = newValue - diff;
    const combinedMult = diamondMultArg * glassMultArg;
    const baseNewValue = combinedMult > 1 ? Math.round(newValue / combinedMult) : newValue;
    const baseDiff = baseNewValue - prevValue;

    let duration: number;
    if (newCombo > prevCombo) {
      // Combo: show +1, optionally +multSectorBonus MULT!, optionally +multDartBonus DART MULT!, then ×N
      const afterDart = prevValue + 1;
      setDisplayedValue(afterDart);
      spawn('+1', deltaColor, 0);
      let preComboDelay = 380;
      if (multSectorBonusArg > 0) {
        setTimeout(() => setDisplayedValue(afterDart + multSectorBonusArg), 380);
        spawn(`+${multSectorBonusArg} MULT!`, COLORS.red, 380);
        preComboDelay = 760;
      }
      if (multDartBonusArg > 0) {
        setTimeout(() => setDisplayedValue(afterDart + multSectorBonusArg + multDartBonusArg), preComboDelay);
        spawn(`+${multDartBonusArg} DART MULT!`, COLORS.gold, preComboDelay);
        preComboDelay += 380;
      }
      setTimeout(() => setDisplayedValue(baseNewValue), preComboDelay);
      spawn(`×${newCombo}`, COLORS.gold, preComboDelay);
      duration = preComboDelay + 900;
    } else {
      const dartDiff = baseDiff - bonusDeltaArg - multSectorBonusArg - multDartBonusArg;
      const totalExtra = bonusDeltaArg + multSectorBonusArg + multDartBonusArg;
      setDisplayedValue(totalExtra > 0 ? baseNewValue - totalExtra : baseNewValue);
      spawn(`+${dartDiff}`, deltaColor, 0);
      duration = 900;
      if (bonusDeltaArg > 0) {
        setTimeout(() => setDisplayedValue(baseNewValue - multSectorBonusArg - multDartBonusArg), duration);
        spawn(`+${bonusDeltaArg} BONUS!`, COLORS.gold, duration);
        duration += 900;
      }
      if (multSectorBonusArg > 0) {
        setTimeout(() => setDisplayedValue(baseNewValue - multDartBonusArg), duration);
        spawn(`+${multSectorBonusArg} MULT!`, COLORS.red, duration);
        duration += 900;
      }
      if (multDartBonusArg > 0) {
        setTimeout(() => setDisplayedValue(baseNewValue), duration);
        spawn(`+${multDartBonusArg} DART MULT!`, COLORS.gold, duration);
        duration += 900;
      }
    }
    // Diamond sector: show multiplicative step last
    if (diamondMultArg > 1) {
      const afterDiamondValue = glassMultArg > 1 ? Math.round(baseNewValue * diamondMultArg) : newValue;
      setTimeout(() => setDisplayedValue(afterDiamondValue), duration);
      spawn(`×${diamondMultArg} DIAMOND!`, COLORS.cyan, duration);
      duration += 900;
    }
    // Glass sector: show after diamond
    if (glassMultArg > 1) {
      setTimeout(() => setDisplayedValue(newValue), duration);
      spawn(`×${glassMultArg} GLASS!`, '#b8e8ff', duration);
      duration += 900;
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
      fireAnim(diff, newCombo, prevCombo, numericValue, bonusDelta ?? 0, 0);
    } else {
      // MULT / SCORE: hold until triggerKey fires
      pendingRef.current = { diff, newValue: numericValue, newCombo, prevCombo, multSectorBonus: multSectorBonus ?? 0, multDartBonus: multDartBonus ?? 0, diamondMult: diamondMult ?? 1, glassMult: glassMult ?? 1 };
    }
  }, [numericValue]);

  // Fire pending animation when parent signals this box
  useEffect(() => {
    if (triggerKey === undefined) return;
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    fireAnim(p.diff, p.newCombo, p.prevCombo, p.newValue, 0, p.multSectorBonus, p.multDartBonus, p.diamondMult, p.glassMult);
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
});
