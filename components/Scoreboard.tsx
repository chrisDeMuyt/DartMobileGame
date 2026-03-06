import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PIXEL_FONT, pixelShadowSm, COLORS } from '../lib/theme';
import { RoundsState } from '../lib/gameLogic';
import { DartHit } from '../lib/dartboard';

interface Props { state: RoundsState; }

export default function Scoreboard({ state }: Props) {
  const { turnTarget, turnScore, roundIndex, turnIndex, currentTurnDarts } = state;
  const delta = turnTarget - turnScore;
  const targetMet = turnScore >= turnTarget;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <StatBox label="TARGET" value={String(turnTarget)} valueStyle={styles.goldValue} />
        <StatBox label="THIS TURN" value={String(turnScore)} valueStyle={styles.cyanValue} />
        <StatBox label="ROUND" value={String(roundIndex + 1)} />
        <StatBox label="TURN" value={`${turnIndex + 1}/3`} />
      </View>

      <View style={styles.divider} />

      <DartChips darts={currentTurnDarts} />

      <Text style={[styles.deltaHint, targetMet ? styles.deltaHintMet : styles.deltaHintNeed]}>
        {targetMet ? 'TARGET MET!' : `NEED ${delta} MORE`}
      </Text>
    </View>
  );
}

function StatBox({ label, value, valueStyle }: { label: string; value: string; valueStyle?: object }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueStyle]}>{value}</Text>
    </View>
  );
}

function DartChips({ darts }: { darts: DartHit[] }) {
  return (
    <View style={styles.dartHistory}>
      {darts.map((d, i) => (
        <View key={i} style={[styles.dartChip, d.score === 0 && styles.dartChipMiss]}>
          <Text style={styles.dartChipLabel}>{d.label}</Text>
          <Text style={styles.dartChipScore}>{d.score}</Text>
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
  goldValue: {
    color: COLORS.gold,
    fontSize: 18,
  },
  cyanValue: {
    color: COLORS.cyan,
    fontSize: 18,
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
  dartChipMiss: {
    borderColor: COLORS.red,
  },
  dartChipLabel: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 7,
  },
  dartChipScore: {
    fontFamily: PIXEL_FONT,
    color: COLORS.bright,
    fontSize: 9,
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
  deltaHintNeed: {
    color: COLORS.muted,
  },
  deltaHintMet: {
    color: COLORS.cyan,
  },
});
