import React, { useReducer, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Dartboard, { DartMarker, boardRadius } from '../components/Dartboard';
import Slingshot from '../components/Slingshot';
import Scoreboard from '../components/Scoreboard';
import { getDartScore, DartHit } from '../lib/dartboard';
import {
  GameState,
  GameMode,
  Player,
  initGameState,
  addDart,
  endTurn,
} from '../lib/gameLogic';

// ---- Reducer ----

type Action =
  | { type: 'THROW'; dart: DartHit }
  | { type: 'RESTART' };

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'THROW': {
      const hasWinner = 'winner' in state && state.winner !== null;
      if (hasWinner) return state;
      if (state.currentTurnDarts.length >= 3) return state;
      const next = addDart(state, action.dart);
      if (next.currentTurnDarts.length === 3) return endTurn(next);
      return next;
    }
    case 'RESTART':
      return initGameState(state.mode, state.players);
    default:
      return state;
  }
}

// ---- Helpers ----

function getWinner(state: GameState): number | null {
  return 'winner' in state ? state.winner : null;
}

function getCurrentPlayerIndex(state: GameState): number {
  return 'currentPlayerIndex' in state ? (state.currentPlayerIndex as number) : 0;
}

function getDartColor(playerIndex: number, dartIndex: number): string {
  const palettes = [
    ['#ff6b6b', '#ff5252', '#ff3030'],
    ['#4a9eff', '#3a8eef', '#2a7edf'],
  ];
  return palettes[playerIndex % palettes.length][dartIndex % 3];
}

// ---- Screen ----

export default function GameScreen() {
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{
    mode: string;
    numPlayers: string;
    player1: string;
    player2: string;
  }>();

  const mode = (params.mode ?? '301') as GameMode;
  const numPlayers = parseInt(params.numPlayers ?? '2', 10);

  const players: Player[] = [{ id: 0, name: params.player1 ?? 'Player 1' }];
  if (numPlayers >= 2 && mode !== 'practice') {
    players.push({ id: 1, name: params.player2 ?? 'Player 2' });
  }

  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    initGameState(mode, players)
  );

  const [aimPreview, setAimPreview] = useState<{ x: number; y: number; radius: number } | null>(null);

  // Board sizing
  const boardSize = Math.min(width, height * 0.46);
  const bRadius = boardRadius(boardSize);
  const boardCX = boardSize / 2;
  const boardCY = boardSize / 2;

  const slingshotHeight = Math.max(155, height * 0.30);

  const currentPI = getCurrentPlayerIndex(state);
  const dartMarkers: DartMarker[] = state.currentTurnDarts.map((d, i) => ({
    x: d.x,
    y: d.y,
    color: getDartColor(currentPI, i),
  }));

  // normX: -1 (left) to 1 (right), power: 0 to 1
  const AIM_SPREAD = bRadius * 0.22; // constant aim circle size

  const handleThrow = useCallback(
    (normX: number, normY: number) => {
      // X: pull left → dart goes right (inverted, natural slingshot)
      const aimX = boardCX - normX * bRadius * 1.15;
      // Y: pull further down → dart goes higher on board
      const aimY = boardCY + bRadius * (0.8 - 1.6 * normY);

      // Uniform random landing anywhere within the constant aim circle
      const angle = Math.random() * 2 * Math.PI;
      const r = Math.pow(Math.random(), 1.8) * AIM_SPREAD;
      const finalX = aimX + r * Math.cos(angle);
      const finalY = aimY + r * Math.sin(angle);

      const scoreData = getDartScore(finalX - boardCX, finalY - boardCY, bRadius);
      const dart: DartHit = { x: finalX, y: finalY, ...scoreData };

      Vibration.vibrate(30);
      dispatch({ type: 'THROW', dart });
      setAimPreview(null);
    },
    [boardCX, boardCY, bRadius]
  );

  const handleAimUpdate = useCallback(
    (normX: number, normY: number) => {
      if (normX === 0 && normY === 0) {
        setAimPreview(null);
        return;
      }
      setAimPreview({
        x: boardCX - normX * bRadius * 1.15,
        y: boardCY + bRadius * (0.8 - 1.6 * normY),
        radius: AIM_SPREAD,
      });
    },
    [boardCX, boardCY, bRadius]
  );

  const winner = getWinner(state);
  const currentPlayer = state.players[getCurrentPlayerIndex(state)];
  const dartsLeft = 3 - state.currentTurnDarts.length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>Menu</Text>
        </TouchableOpacity>
        <Text style={styles.modeLabel}>{mode.toUpperCase()}</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Dartboard */}
      <View style={styles.boardContainer}>
        <Dartboard size={boardSize} darts={dartMarkers} aimIndicator={aimPreview} />
      </View>

      {/* Scoreboard */}
      <View style={styles.scoreboardContainer}>
        <Scoreboard state={state} />
      </View>

      {/* Win overlay */}
      {winner !== null && (
        <View style={styles.winOverlay}>
          <Text style={styles.winEmoji}>🎯</Text>
          <Text style={styles.winTitle}>
            {mode === 'practice' ? 'Done!' : `${state.players[winner].name} Wins!`}
          </Text>
          <TouchableOpacity
            style={styles.restartBtn}
            onPress={() => dispatch({ type: 'RESTART' })}
          >
            <Text style={styles.restartBtnText}>Play Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuBtn} onPress={() => router.back()}>
            <Text style={styles.menuBtnText}>Main Menu</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Slingshot throw zone */}
      {winner === null && (
        <View style={[styles.slingshotZone, { height: slingshotHeight }]}>
          {/* Player + dart counter */}
          <View style={styles.throwInfo}>
            <Text style={styles.playerTurnText}>{currentPlayer.name}</Text>
            <View style={styles.dartDotsRow}>
              {[0, 1, 2].map(i => (
                <View
                  key={i}
                  style={[
                    styles.dartDot,
                    i < state.currentTurnDarts.length ? styles.dartDotUsed : styles.dartDotFull,
                  ]}
                />
              ))}
              <Text style={styles.dartsLeftText}>
                {dartsLeft} dart{dartsLeft !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          <Slingshot
            width={width}
            height={slingshotHeight - 44}
            disabled={winner !== null}
            onThrow={handleThrow}
            onAimUpdate={handleAimUpdate}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  backBtn: { width: 60 },
  backText: {
    color: '#4a9eff',
    fontSize: 14,
    fontWeight: '600',
  },
  modeLabel: {
    color: '#555',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  boardContainer: {
    alignItems: 'center',
  },
  scoreboardContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  slingshotZone: {
    backgroundColor: '#0a0a18',
    borderTopWidth: 1,
    borderTopColor: '#1e1e3a',
  },
  throwInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 2,
    height: 44,
  },
  playerTurnText: {
    color: '#4a9eff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  dartDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dartDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  dartDotFull: {
    backgroundColor: '#ff6b6b',
  },
  dartDotUsed: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  dartsLeftText: {
    color: '#333',
    fontSize: 11,
    marginLeft: 2,
  },
  // Win overlay
  winOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  winEmoji: { fontSize: 72 },
  winTitle: {
    color: 'white',
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  restartBtn: {
    backgroundColor: '#4a9eff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 44,
    marginTop: 8,
  },
  restartBtnText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  menuBtn: { paddingVertical: 10 },
  menuBtnText: {
    color: '#555',
    fontSize: 15,
  },
});
