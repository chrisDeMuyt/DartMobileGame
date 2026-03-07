import { DartHit } from './dartboard';
import {
  OwnedItem,
  OwnedBoardItem,
  ItemCategory,
  ITEMS,
  canPurchase,
  createOwnedItem,
  getAdjustedCost,
  getItemDef,
} from './items';

export type GameMode = 'rounds';

export interface Player { id: number; name: string; }

export type TurnOutcome = 'won' | 'lost' | null;

// ---- Shop offers ----

export interface ShopOffers {
  /** Single random item (board / dart / decoration) */
  item: string | null;
  /** Two decoration defIds for the decoration pack; null = none available */
  decorationPack: [string, string] | null;
  /** Two board/dart defIds for the item pack; null = none available */
  itemPack: [string, string] | null;
  /** Single powerup offer; null = sold out this round */
  powerup: string | null;
}

/** Fixed costs for packs (not tied to individual item costs). */
export const PACK_COSTS = { decoration: 10, item: 8 } as const;

// ---- Game state ----

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
  ownedItems: OwnedItem[];
  shopOffers: ShopOffers;
  lastTurnReward: number;
  lastDartBonus: number;
}

export type GameState = RoundsState;

// ---- Target scaling ----

export function computeTarget(globalTurnIndex: number): number {
  if (globalTurnIndex < 3) return 20 * Math.pow(2, globalTurnIndex);
  return 60 + (globalTurnIndex - 2) * 40;
}

// ---- Shop offer generation ----

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function pick2Random<T>(arr: T[]): [T, T] | null {
  if (arr.length < 2) return null;
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

function eligiblePool(categories: ItemCategory[], ownedDefIds: string[]) {
  return ITEMS.filter(
    def => (categories as string[]).includes(def.category) && canPurchase(def.id, ownedDefIds)
  );
}

/**
 * Generate shop offers for a new turn.
 * keepPowerup: undefined = roll a fresh powerup; null = keep sold-out; string = keep existing offer.
 */
export function generateShopOffers(
  ownedItems: OwnedItem[],
  keepPowerup?: string | null,
): ShopOffers {
  const ownedDefIds = ownedItems.map(i => i.defId);

  const itemPool       = eligiblePool(['board', 'dart', 'decoration'], ownedDefIds);
  const decorationPool = eligiblePool(['decoration'], ownedDefIds);
  const boardDartPool  = eligiblePool(['board', 'dart'], ownedDefIds);
  const powerupPool    = eligiblePool(['powerup'], ownedDefIds);

  const itemOffer  = pickRandom(itemPool);
  const decoPair   = pick2Random(decorationPool);
  const bdPair     = pick2Random(boardDartPool);

  let powerup: string | null;
  if (keepPowerup !== undefined) {
    powerup = keepPowerup; // null (sold) or existing string id — preserve as-is
  } else {
    powerup = pickRandom(powerupPool)?.id ?? null;
  }

  return {
    item:            itemOffer?.id ?? null,
    decorationPack:  decoPair  ? [decoPair[0].id,  decoPair[1].id]  : null,
    itemPack:        bdPair    ? [bdPair[0].id,    bdPair[1].id]    : null,
    powerup,
  };
}

// ---- Init ----

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
    ownedItems: [],
    shopOffers: { ...generateShopOffers([]), item: 'bonus_sector' },
    lastTurnReward: 0,
    lastDartBonus: 0,
  };
}

// ---- Mult computation ----

function computeMult(darts: DartHit[]): number {
  const scoring = darts.filter(d => d.score > 0);
  let mult = 0;
  const counts: Record<number, number> = {};
  for (const d of scoring) {
    counts[d.segment] = (counts[d.segment] ?? 0) + 1;
    const n = counts[d.segment];
    if (n >= 2) {
      mult = (mult + 1) * n;
    } else {
      mult += 1;
    }
  }
  return mult;
}

// ---- Turn actions ----

const TURN_REWARDS = [5, 10, 15];

export function addDart(state: RoundsState, dart: DartHit): RoundsState {
  if (state.turnOutcome !== null) return state;
  if (state.currentTurnDarts.length >= 3) return state;
  const newDarts = [...state.currentTurnDarts, dart];

  // Check board item effects
  let bonus = 0;
  if (dart.score > 0) {
    for (const item of state.ownedItems) {
      const bi = item as OwnedBoardItem;
      if (bi.sector == null || bi.sector !== dart.segment) continue;
      const def = getItemDef(item.defId);
      if (def?.category === 'board' && def.effect.type === 'bonus_sector') {
        bonus += def.effect.bonusPoints;
      }
    }
  }

  const newScore = state.turnScore + dart.score + bonus;
  const newMult  = computeMult(newDarts);
  if (newDarts.length < 3) {
    return { ...state, currentTurnDarts: newDarts, turnScore: newScore, mult: newMult, lastDartBonus: bonus };
  }
  const won    = newScore * newMult >= state.turnTarget;
  const reward = won ? TURN_REWARDS[state.turnIndex] : 0;
  return {
    ...state,
    currentTurnDarts: newDarts,
    turnScore: newScore,
    mult: newMult,
    turnOutcome: won ? 'won' : 'lost',
    currency: state.currency + reward,
    lastTurnReward: reward,
    lastDartBonus: bonus,
  };
}

export function advanceTurn(state: RoundsState): RoundsState {
  if (state.turnOutcome !== 'won') return state;
  const newTurnIndex      = (state.turnIndex + 1) % 3;
  const newRoundIndex     = newTurnIndex === 0 ? state.roundIndex + 1 : state.roundIndex;
  const newGlobalTurnIndex = state.globalTurnIndex + 1;
  const isNewRound        = newTurnIndex === 0;

  // Item/pack offers refresh every turn; powerup only refreshes at round boundaries.
  const newOffers = generateShopOffers(
    state.ownedItems,
    isNewRound ? undefined : state.shopOffers.powerup,
  );

  return {
    ...state,
    roundIndex:       newRoundIndex,
    turnIndex:        newTurnIndex,
    globalTurnIndex:  newGlobalTurnIndex,
    turnTarget:       computeTarget(newGlobalTurnIndex),
    currentTurnDarts: [],
    turnScore:        0,
    turnOutcome:      null,
    mult:             0,
    shopOffers:       newOffers,
    lastTurnReward:   0,
    lastDartBonus:    0,
  };
}

// ---- Shop purchase actions ----

/** Buy the single item offer (board / dart / decoration slot). */
export function buyItem(state: RoundsState, defId: string): RoundsState {
  const def = getItemDef(defId);
  if (!def) return state;
  const cost = getAdjustedCost(def.cost, state.ownedItems);
  if (state.currency < cost) return state;
  return {
    ...state,
    currency:   state.currency - cost,
    ownedItems: [...state.ownedItems, createOwnedItem(defId)],
    // Clear the offer slot so it can't be bought again this visit
    shopOffers: { ...state.shopOffers, item: null },
  };
}

/** Claim one item from a pack after the player has made their choice. */
export function claimPackItem(
  state: RoundsState,
  packType: 'decoration' | 'item',
  chosenDefId: string,
): RoundsState {
  const adjustedCost = getAdjustedCost(PACK_COSTS[packType], state.ownedItems);
  if (state.currency < adjustedCost) return state;
  // Clear the pack offer so it can't be opened again this visit
  const shopOffers: ShopOffers = {
    ...state.shopOffers,
    decorationPack: packType === 'decoration' ? null : state.shopOffers.decorationPack,
    itemPack:       packType === 'item'       ? null : state.shopOffers.itemPack,
  };
  return {
    ...state,
    currency:   state.currency - adjustedCost,
    ownedItems: [...state.ownedItems, createOwnedItem(chosenDefId)],
    shopOffers,
  };
}

/** Buy the powerup offer. Sets powerup to null (sold out) for the rest of the round. */
export function buyPowerup(state: RoundsState): RoundsState {
  const defId = state.shopOffers.powerup;
  if (!defId) return state;
  const def = getItemDef(defId);
  if (!def) return state;
  const cost = getAdjustedCost(def.cost, state.ownedItems);
  if (state.currency < cost) return state;
  return {
    ...state,
    currency:   state.currency - cost,
    ownedItems: [...state.ownedItems, createOwnedItem(defId)],
    shopOffers: { ...state.shopOffers, powerup: null },
  };
}

/** Assign a board sector to a specific owned board item instance. */
export function assignBoardSector(state: RoundsState, instanceId: string, sector: number): RoundsState {
  return {
    ...state,
    ownedItems: state.ownedItems.map(item =>
      item.instanceId === instanceId ? { ...item, sector } : item
    ),
  };
}

// ---- Derived helpers (used by game.tsx) ----

/** Cumulative aim-size factor from all owned Sharpshooter powerups. */
export function getAimFactor(ownedItems: OwnedItem[]): number {
  return ownedItems.reduce((f, owned) => {
    const def = getItemDef(owned.defId);
    if (def?.category === 'powerup' && def.effect.type === 'reduce_aim') {
      return f * def.effect.factor;
    }
    return f;
  }, 1);
}
