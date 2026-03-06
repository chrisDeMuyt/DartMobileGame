import { DartHit } from './dartboard';

export type GameMode = '301' | '501' | 'cricket' | 'practice';

export interface Player {
  id: number;
  name: string;
}

// ---- X01 (301 / 501) ----

export interface X01State {
  mode: '301' | '501';
  players: Player[];
  scores: number[];
  currentPlayerIndex: number;
  currentTurnDarts: DartHit[];
  winner: number | null;
  isBust: boolean;
}

// ---- Cricket ----

export const CRICKET_NUMBERS = [15, 16, 17, 18, 19, 20, 25];

export interface CricketState {
  mode: 'cricket';
  players: Player[];
  marks: Array<Record<number, number>>;  // marks[playerIdx][segment] = 0..3
  points: number[];
  currentPlayerIndex: number;
  currentTurnDarts: DartHit[];
  winner: number | null;
}

// ---- Practice ----

export interface PracticeState {
  mode: 'practice';
  players: Player[];
  currentTurnDarts: DartHit[];
  totalScore: number;
  dartsThrown: number;
  rounds: number;
}

export type GameState = X01State | CricketState | PracticeState;

// ---- Initialisation ----

export function initGameState(mode: GameMode, players: Player[]): GameState {
  switch (mode) {
    case '301':
    case '501': {
      const start = mode === '301' ? 301 : 501;
      return {
        mode,
        players,
        scores: players.map(() => start),
        currentPlayerIndex: 0,
        currentTurnDarts: [],
        winner: null,
        isBust: false,
      };
    }
    case 'cricket': {
      const marks: Array<Record<number, number>> = players.map(() => {
        const m: Record<number, number> = {};
        CRICKET_NUMBERS.forEach(n => (m[n] = 0));
        return m;
      });
      return {
        mode: 'cricket',
        players,
        marks,
        points: players.map(() => 0),
        currentPlayerIndex: 0,
        currentTurnDarts: [],
        winner: null,
      };
    }
    case 'practice':
      return {
        mode: 'practice',
        players,
        currentTurnDarts: [],
        totalScore: 0,
        dartsThrown: 0,
        rounds: 0,
      };
  }
}

// ---- Add a dart to the current turn ----

export function addDart(state: GameState, dart: DartHit): GameState {
  if (state.mode === 'practice') {
    return {
      ...state,
      currentTurnDarts: [...state.currentTurnDarts, dart],
      totalScore: state.totalScore + dart.score,
      dartsThrown: state.dartsThrown + 1,
    };
  }
  if ('winner' in state && state.winner !== null) return state;
  return { ...state, currentTurnDarts: [...state.currentTurnDarts, dart] } as GameState;
}

// ---- End turn (called after 3 darts) ----

export function endTurn(state: GameState): GameState {
  if (state.mode === 'practice') {
    return { ...state, currentTurnDarts: [], rounds: state.rounds + 1 };
  }
  if ('winner' in state && state.winner !== null) return state;
  if (state.mode === '301' || state.mode === '501') return endX01Turn(state as X01State);
  if (state.mode === 'cricket') return endCricketTurn(state as CricketState);
  return state;
}

function endX01Turn(state: X01State): X01State {
  const pi = state.currentPlayerIndex;
  const turnScore = state.currentTurnDarts.reduce((s, d) => s + d.score, 0);
  const newScore = state.scores[pi] - turnScore;

  const newScores = [...state.scores];
  let isBust = false;
  let winner: number | null = null;

  if (newScore < 0) {
    isBust = true;
    // Score stays the same (bust)
  } else if (newScore === 0) {
    newScores[pi] = 0;
    winner = pi;
  } else {
    newScores[pi] = newScore;
  }

  return {
    ...state,
    scores: newScores,
    currentPlayerIndex: (pi + 1) % state.players.length,
    currentTurnDarts: [],
    winner,
    isBust,
  };
}

function endCricketTurn(state: CricketState): CricketState {
  const pi = state.currentPlayerIndex;
  const newMarks = state.marks.map(m => ({ ...m }));
  const newPoints = [...state.points];

  for (const dart of state.currentTurnDarts) {
    // Inner bull (50) counts as 25 in cricket
    const seg = dart.segment === 50 ? 25 : dart.segment;
    if (!CRICKET_NUMBERS.includes(seg)) continue;

    const hits = dart.multiplier; // 1, 2, or 3
    const current = newMarks[pi][seg] ?? 0;
    const newCount = Math.min(3, current + hits);
    const overflow = current + hits - 3; // extra hits after closing

    newMarks[pi][seg] = newCount;

    if (overflow > 0) {
      const allOpponentsClosed = state.players.every(
        (_, i) => i === pi || (newMarks[i][seg] ?? 0) >= 3
      );
      if (!allOpponentsClosed) {
        newPoints[pi] += seg * overflow;
      }
    }
  }

  // Win: all segments closed AND points >= all opponents
  const winner = (() => {
    for (let i = 0; i < state.players.length; i++) {
      const allClosed = CRICKET_NUMBERS.every(n => (newMarks[i][n] ?? 0) >= 3);
      if (!allClosed) continue;
      const winsPoints = state.players.every((_, j) => j === i || newPoints[i] >= newPoints[j]);
      if (winsPoints) return i;
    }
    return null;
  })();

  return {
    ...state,
    marks: newMarks,
    points: newPoints,
    currentPlayerIndex: (pi + 1) % state.players.length,
    currentTurnDarts: [],
    winner,
  };
}

// ---- Helpers ----

export function getCurrentTurnScore(state: X01State): number {
  return state.currentTurnDarts.reduce((s, d) => s + d.score, 0);
}

export function getCricketMarkSymbol(marks: number): string {
  if (marks === 0) return '';
  if (marks === 1) return '/';
  if (marks === 2) return 'X';
  return 'O';
}
