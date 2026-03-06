import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  GameState,
  X01State,
  CricketState,
  PracticeState,
  CRICKET_NUMBERS,
  getCricketMarkSymbol,
  getCurrentTurnScore,
} from '../lib/gameLogic';
import { DartHit } from '../lib/dartboard';

interface Props {
  state: GameState;
}

export default function Scoreboard({ state }: Props) {
  if (state.mode === 'practice') return <PracticeBoard state={state as PracticeState} />;
  if (state.mode === 'cricket') return <CricketBoard state={state as CricketState} />;
  return <X01Board state={state as X01State} />;
}

// ---- Practice ----

function PracticeBoard({ state }: { state: PracticeState }) {
  const turnScore = state.currentTurnDarts.reduce((s, d) => s + d.score, 0);
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Stat label="Total" value={state.totalScore} highlight />
        <Stat label="This turn" value={turnScore} />
        <Stat label="Darts" value={state.dartsThrown} />
        <Stat label="Rounds" value={state.rounds} />
      </View>
      <DartHistory darts={state.currentTurnDarts} />
    </View>
  );
}

// ---- X01 ----

function X01Board({ state }: { state: X01State }) {
  const turnScore = getCurrentTurnScore(state);
  const currentPlayer = state.players[state.currentPlayerIndex];

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {state.players.map((p, i) => {
          const isActive = i === state.currentPlayerIndex;
          const remaining = state.scores[i];
          const wouldBust = isActive && state.scores[i] - turnScore < 0;
          return (
            <View key={p.id} style={[styles.playerCard, isActive && styles.activeCard]}>
              <Text style={[styles.playerName, isActive && styles.activeText]}>{p.name}</Text>
              <Text style={[styles.bigScore, wouldBust && styles.bustScore]}>{remaining}</Text>
              {isActive && turnScore > 0 && (
                <Text style={styles.turnScoreText}>-{turnScore}</Text>
              )}
            </View>
          );
        })}
      </View>
      {state.isBust && <Text style={styles.bustBanner}>BUST!</Text>}
      <DartHistory darts={state.currentTurnDarts} />
    </View>
  );
}

// ---- Cricket ----

function CricketBoard({ state }: { state: CricketState }) {
  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.cricketRow}>
        <Text style={[styles.cricketCell, styles.cricketHeader, styles.cricketNum]}>#</Text>
        {state.players.map((p, i) => (
          <Text
            key={p.id}
            style={[
              styles.cricketCell,
              styles.cricketHeader,
              styles.cricketMark,
              i === state.currentPlayerIndex && styles.activeText,
            ]}
          >
            {p.name}
          </Text>
        ))}
      </View>

      {/* Number rows */}
      {CRICKET_NUMBERS.map(n => (
        <View key={n} style={styles.cricketRow}>
          <Text style={[styles.cricketCell, styles.cricketNum, styles.cricketNumLabel]}>
            {n === 25 ? 'Bull' : n}
          </Text>
          {state.players.map((p, i) => {
            const marks = state.marks[i][n] ?? 0;
            return (
              <Text
                key={p.id}
                style={[
                  styles.cricketCell,
                  styles.cricketMark,
                  marks >= 3 && styles.cricketClosed,
                ]}
              >
                {getCricketMarkSymbol(marks)}
              </Text>
            );
          })}
        </View>
      ))}

      {/* Points row */}
      <View style={[styles.cricketRow, styles.cricketPointsRow]}>
        <Text style={[styles.cricketCell, styles.cricketNum, styles.cricketNumLabel]}>Pts</Text>
        {state.players.map((p, i) => (
          <Text
            key={p.id}
            style={[
              styles.cricketCell,
              styles.cricketMark,
              styles.cricketPoints,
              i === state.currentPlayerIndex && styles.activeText,
            ]}
          >
            {state.points[i]}
          </Text>
        ))}
      </View>

      <DartHistory darts={state.currentTurnDarts} />
    </View>
  );
}

// ---- Dart history chips ----

function DartHistory({ darts }: { darts: DartHit[] }) {
  if (darts.length === 0) return null;
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

// ---- Stat block ----

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && styles.statHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  playerCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1e1e2e',
    borderRadius: 10,
    padding: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeCard: {
    borderColor: '#4a9eff',
    backgroundColor: '#1a2a4a',
  },
  playerName: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
  activeText: {
    color: '#4a9eff',
  },
  bigScore: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
  },
  bustScore: {
    color: '#ff4444',
  },
  turnScoreText: {
    color: '#ff6b6b',
    fontSize: 13,
    fontWeight: '600',
  },
  bustBanner: {
    textAlign: 'center',
    color: '#ff4444',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    color: '#888',
    fontSize: 11,
  },
  statValue: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  statHighlight: {
    color: '#4a9eff',
    fontSize: 28,
  },
  dartHistory: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dartChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2a2a3a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#444',
  },
  dartChipMiss: {
    borderColor: '#ff4444',
  },
  dartChipLabel: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
  dartChipScore: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dartChipEmpty: {
    width: 60,
    height: 28,
    backgroundColor: '#1a1a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  // Cricket styles
  cricketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3a',
    paddingVertical: 2,
  },
  cricketPointsRow: {
    borderTopWidth: 2,
    borderTopColor: '#333',
    borderBottomWidth: 0,
    marginTop: 2,
    paddingTop: 4,
  },
  cricketCell: {
    color: 'white',
    fontSize: 13,
  },
  cricketHeader: {
    fontWeight: 'bold',
    color: '#888',
    fontSize: 11,
    paddingBottom: 2,
  },
  cricketNum: {
    width: 44,
  },
  cricketNumLabel: {
    color: '#ccc',
    fontWeight: '600',
  },
  cricketMark: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cricketClosed: {
    color: '#4a9eff',
  },
  cricketPoints: {
    fontSize: 15,
    color: '#ffd700',
  },
});
