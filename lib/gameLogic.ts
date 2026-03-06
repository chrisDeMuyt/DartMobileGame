import { DartHit } from './dartboard';
import { SHOP_ITEMS } from './shopItems';

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
  mult: number;
  currency: number;
  upgrades: Record<string, number>;
  lastTurnReward: number;
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
    mult: 0,
    currency: 10,
    upgrades: {},
    lastTurnReward: 0,
  };
}

function computeMult(darts: DartHit[]): number {
  const scoring = darts.filter(d => d.score > 0);
  const base = scoring.length;

  // Count how many darts hit each segment
  const counts: Record<number, number> = {};
  for (const d of scoring) {
    counts[d.segment] = (counts[d.segment] ?? 0) + 1;
  }
  const maxGroup = Object.values(counts).reduce((m, v) => Math.max(m, v), 0);

  if (maxGroup >= 3) return base * 3;
  if (maxGroup >= 2) return base * 2;
  return base;
}

export function addDart(state: RoundsState, dart: DartHit): RoundsState {
  if (state.turnOutcome !== null) return state;
  if (state.currentTurnDarts.length >= 3) return state;
  const newDarts = [...state.currentTurnDarts, dart];
  const newScore = state.turnScore + dart.score;
  const newMult = computeMult(newDarts);
  if (newDarts.length < 3) {
    return { ...state, currentTurnDarts: newDarts, turnScore: newScore, mult: newMult };
  }
  const won = newScore * newMult >= state.turnTarget;
  const piggyBonus = (state.upgrades['piggy_bank'] ?? 0) * 5;
  const reward = won ? TURN_REWARDS[state.turnIndex] + piggyBonus : 0;
  return {
    ...state,
    currentTurnDarts: newDarts,
    turnScore: newScore,
    mult: newMult,
    turnOutcome: won ? 'won' : 'lost',
    currency: state.currency + reward,
    lastTurnReward: reward,
  };
}

const TURN_REWARDS = [5, 10, 15];

export function advanceTurn(state: RoundsState): RoundsState {
  if (state.turnOutcome !== 'won') return state;
  const newTurnIndex = (state.turnIndex + 1) % 3;
  const newRoundIndex = newTurnIndex === 0 ? state.roundIndex + 1 : state.roundIndex;
  const newGlobalTurnIndex = state.globalTurnIndex + 1;
  const hotStreak = state.upgrades['hot_streak'] ?? 0;
  return {
    ...state,
    roundIndex: newRoundIndex,
    turnIndex: newTurnIndex,
    globalTurnIndex: newGlobalTurnIndex,
    turnTarget: computeTarget(newGlobalTurnIndex),
    currentTurnDarts: [],
    turnScore: 0,
    turnOutcome: null,
    mult: hotStreak * 2,
    lastTurnReward: 0,
  };
}

export function buyUpgrade(state: RoundsState, itemId: string): RoundsState {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return state;
  if (state.currency < item.cost) return state;
  const owned = state.upgrades[itemId] ?? 0;
  if (owned >= item.maxOwned) return state;
  const next: RoundsState = {
    ...state,
    currency: state.currency - item.cost,
    upgrades: { ...state.upgrades, [itemId]: owned + 1 },
  };
  // Instant effects
  if (itemId === 'score_pack') {
    return { ...next, currency: next.currency + 25 };
  }
  return next;
}
