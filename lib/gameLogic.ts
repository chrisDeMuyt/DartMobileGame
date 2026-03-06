import { DartHit } from './dartboard';

export type GameMode = 'rounds';

export interface Player { id: number; name: string; }

export type TurnOutcome = 'won' | 'lost' | null;

export interface RoundsState {
  mode: 'rounds';
  player: Player;
  roundIndex: number;
  turnIndex: number;
  globalTurnIndex: number;
  turnTarget: number;
  currentTurnDarts: DartHit[];
  turnScore: number;
  turnOutcome: TurnOutcome;
}

export type GameState = RoundsState;

export function computeTarget(globalTurnIndex: number): number {
  // Round 1: doubles each turn (20 → 40 → 80)
  if (globalTurnIndex < 3) return 20 * Math.pow(2, globalTurnIndex);
  // Round 2+: linear +40 per turn starting at 100
  return 60 + (globalTurnIndex - 2) * 40;
}

export function initGameState(player: Player): RoundsState {
  return {
    mode: 'rounds',
    player,
    roundIndex: 0,
    turnIndex: 0,
    globalTurnIndex: 0,
    turnTarget: computeTarget(0),
    currentTurnDarts: [],
    turnScore: 0,
    turnOutcome: null,
  };
}

export function addDart(state: RoundsState, dart: DartHit): RoundsState {
  if (state.turnOutcome !== null) return state;
  if (state.currentTurnDarts.length >= 3) return state;
  const newDarts = [...state.currentTurnDarts, dart];
  const newScore = state.turnScore + dart.score;
  if (newDarts.length < 3) {
    return { ...state, currentTurnDarts: newDarts, turnScore: newScore };
  }
  return {
    ...state,
    currentTurnDarts: newDarts,
    turnScore: newScore,
    turnOutcome: newScore >= state.turnTarget ? 'won' : 'lost',
  };
}

export function advanceTurn(state: RoundsState): RoundsState {
  if (state.turnOutcome !== 'won') return state;
  const newTurnIndex = (state.turnIndex + 1) % 3;
  const newRoundIndex = newTurnIndex === 0 ? state.roundIndex + 1 : state.roundIndex;
  const newGlobalTurnIndex = state.globalTurnIndex + 1;
  return {
    ...state,
    roundIndex: newRoundIndex,
    turnIndex: newTurnIndex,
    globalTurnIndex: newGlobalTurnIndex,
    turnTarget: computeTarget(newGlobalTurnIndex),
    currentTurnDarts: [],
    turnScore: 0,
    turnOutcome: null,
  };
}
