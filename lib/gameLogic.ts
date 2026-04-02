import { DartHit } from './dartboard';
import {
  OwnedItem,
  OwnedBoardItem,
  OwnedDartItem,
  ItemCategory,
  ITEMS,
  canPurchase,
  createOwnedItem,
  getAdjustedCost,
  getItemDef,
} from './items';

/** Normalises inner bull (50) to outer bull (25) so both count as the same sector. */
function bullseyeNorm(segment: number): number {
  return segment === 50 ? 25 : segment;
}

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
  /** Number of throw actions used this turn (1 multi-dart throw = 1, even though it adds 2 darts). */
  throwsUsed: number;
  turnScore: number;
  turnOutcome: TurnOutcome;
  mult: number;
  currency: number;
  ownedItems: OwnedItem[];
  shopOffers: ShopOffers;
  lastTurnReward: number;
  lastDartBonus: number;
  lastDartMultBonus: number;
  lastDiamondMult: number;
  lastGlassMult: number;
  lastShatterSector: number | null;
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

function eligiblePool(categories: ItemCategory[], ownedDefIds: string[], globalTurnIndex: number) {
  return ITEMS.filter(
    def => (categories as string[]).includes(def.category) && canPurchase(def.id, ownedDefIds, globalTurnIndex)
  );
}

/**
 * Generate shop offers for a new turn.
 * keepPowerup: undefined = roll a fresh powerup; null = keep sold-out; string = keep existing offer.
 */
export function generateShopOffers(
  ownedItems: OwnedItem[],
  globalTurnIndex: number,
  keepPowerup?: string | null,
): ShopOffers {
  const ownedDefIds = ownedItems.map(i => i.defId);

  const itemPool       = eligiblePool(['board', 'dart', 'decoration'], ownedDefIds, globalTurnIndex);
  const decorationPool = eligiblePool(['decoration'], ownedDefIds, globalTurnIndex);
  const boardDartPool  = eligiblePool(['board', 'dart'], ownedDefIds, globalTurnIndex);
  const powerupPool    = eligiblePool(['powerup'], ownedDefIds, globalTurnIndex);

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
    throwsUsed: 0,
    turnScore: 0,
    turnOutcome: null,
    mult: 0,
    currency: 100, // TODO: remove (testing)
    ownedItems: [],
    shopOffers: generateShopOffers([], 0),
    lastTurnReward: 0,
    lastDartBonus: 0,
    lastDartMultBonus: 0,
    lastDiamondMult: 1,
    lastGlassMult: 1,
    lastShatterSector: null,
  };
}

// ---- Mult computation ----

function computeMult(darts: DartHit[], ownedItems: OwnedItem[]): number {
  const scoring = darts.filter(d => d.score > 0);
  let mult = 0;
  const counts: Record<number, number> = {};
  for (const d of scoring) {
    const seg = bullseyeNorm(d.segment);
    counts[seg] = (counts[seg] ?? 0) + 1;
    const n = counts[seg];
    let dartMultBonus = 0;
    for (const item of ownedItems) {
      const bi = item as OwnedBoardItem;
      if (bi.sector == null || bullseyeNorm(bi.sector) !== seg) continue;
      const def = getItemDef(item.defId);
      if (def?.category === 'board' && def.effect.type === 'mult_sector') {
        dartMultBonus += def.effect.multBonus;
      }
    }
    if (n >= 2) {
      mult = (mult + 1 + dartMultBonus) * n;
    } else {
      mult += 1 + dartMultBonus;
    }
  }
  return mult;
}

/**
 * Incrementally applies the current dart's additive mult contribution
 * (including combo logic and mult_sector bonuses) on top of the existing mult.
 * Multiplicative bonuses (diamond/glass) are NOT applied here — they are
 * one-shot events handled directly in addDart.
 */
function applyDartAdditive(
  currentMult: number,
  dart: DartHit,
  prevDarts: DartHit[],
  ownedItems: OwnedItem[],
): number {
  if (dart.score === 0) return currentMult;

  const dartSeg = bullseyeNorm(dart.segment);
  const prevHits = prevDarts.filter(d => d.score > 0 && bullseyeNorm(d.segment) === dartSeg).length;
  const n = prevHits + 1;

  let multBonus = 0;
  for (const item of ownedItems) {
    const bi = item as OwnedBoardItem;
    if (bi.sector == null || bullseyeNorm(bi.sector) !== dartSeg) continue;
    const def = getItemDef(item.defId);
    if (def?.category === 'board' && def.effect.type === 'mult_sector') {
      multBonus += def.effect.multBonus;
    }
  }

  if (n >= 2) {
    return (currentMult + 1 + multBonus) * n;
  }
  return currentMult + 1 + multBonus;
}

// ---- Turn actions ----

const TURN_REWARDS = [5, 10, 15];

/**
 * Applies a single dart's scoring to state (board effects, mult, score).
 * Does NOT check turn limits, increment throwsUsed, or check win condition.
 * Safe to call multiple times in sequence (e.g., for multi-dart).
 */
function scoreSingleDart(state: RoundsState, dartArg: DartHit): RoundsState {
  // Shattered glass sector = dead zone: treat as a complete miss
  const shatteredSectors = new Set(
    state.ownedItems
      .filter(item => {
        const bi = item as OwnedBoardItem;
        const def = getItemDef(item.defId);
        return def?.category === 'board' && def.effect.type === 'glass_sector' && bi.shattered && bi.sector != null;
      })
      .map(item => bullseyeNorm((item as OwnedBoardItem).sector as number))
  );
  const dart = shatteredSectors.has(bullseyeNorm(dartArg.segment)) ? { ...dartArg, score: 0, label: 'MISS' } : dartArg;

  const newDarts = [...state.currentTurnDarts, dart];

  // Check board item effects
  let bonus = 0;
  if (dart.score > 0) {
    for (const item of state.ownedItems) {
      const bi = item as OwnedBoardItem;
      if (bi.sector == null || bullseyeNorm(bi.sector) !== bullseyeNorm(dart.segment)) continue;
      const def = getItemDef(item.defId);
      if (def?.category === 'board' && def.effect.type === 'bonus_sector') {
        bonus += def.effect.bonusPoints;
      }
    }
  }

  // Current dart's mult bonus only (for animation)
  let multBonus = 0;
  let diamondMult = 1;
  let glassMult = 1;
  if (dart.score > 0) {
    for (const item of state.ownedItems) {
      const bi = item as OwnedBoardItem;
      if (bi.sector == null || bullseyeNorm(bi.sector) !== bullseyeNorm(dart.segment)) continue;
      const def = getItemDef(item.defId);
      if (def?.category === 'board' && def.effect.type === 'mult_sector') {
        multBonus += def.effect.multBonus;
      } else if (def?.category === 'board' && def.effect.type === 'diamond_sector') {
        diamondMult *= def.effect.multMultiplier;
      } else if (def?.category === 'board' && def.effect.type === 'glass_sector' && !bi.shattered) {
        glassMult *= def.effect.multMultiplier;
      }
    }
  }

  // Shatter check: 25% chance when a live glass sector was hit
  let shatterSector: number | null = null;
  let newOwnedItems = state.ownedItems;
  if (glassMult > 1) {
    for (const item of state.ownedItems) {
      const bi = item as OwnedBoardItem;
      if (bi.sector == null || bullseyeNorm(bi.sector) !== bullseyeNorm(dart.segment)) continue;
      const def = getItemDef(item.defId);
      if (def?.category === 'board' && def.effect.type === 'glass_sector' && !bi.shattered) {
        if (Math.random() < def.effect.shatterChance) {
          shatterSector = dart.segment;
          newOwnedItems = state.ownedItems.map(i =>
            i.instanceId === item.instanceId ? { ...i, shattered: true } as OwnedBoardItem : i
          );
        }
        break;
      }
    }
  }

  const newScore = state.turnScore + dart.score + bonus;
  const additiveMult = applyDartAdditive(state.mult, dart, state.currentTurnDarts, state.ownedItems);
  const newMult = additiveMult * diamondMult * glassMult;

  return {
    ...state,
    currentTurnDarts: newDarts,
    turnScore: newScore,
    mult: newMult,
    ownedItems: newOwnedItems,
    lastDartBonus: bonus,
    lastDartMultBonus: multBonus,
    lastDiamondMult: diamondMult,
    lastGlassMult: glassMult,
    lastShatterSector: shatterSector,
  };
}

export function addDart(state: RoundsState, dartArg: DartHit): RoundsState {
  if (state.turnOutcome !== null) return state;
  if (state.throwsUsed >= 3) return state;

  const next = { ...scoreSingleDart(state, dartArg), throwsUsed: state.throwsUsed + 1 };

  const won = next.turnScore * next.mult >= next.turnTarget;
  if (!won && next.throwsUsed < 3) return next;

  const reward = won ? TURN_REWARDS[state.turnIndex] : 0;
  return {
    ...next,
    turnOutcome: won ? 'won' : 'lost',
    currency: next.currency + reward,
    lastTurnReward: reward,
  };
}

/** Scores two darts from a single multi-dart throw (counts as 1 throw slot). */
export function addMultiDart(state: RoundsState, dart1: DartHit, dart2: DartHit): RoundsState {
  if (state.turnOutcome !== null) return state;
  if (state.throwsUsed >= 3) return state;

  let s = scoreSingleDart(state, dart1);
  s = scoreSingleDart(s, dart2);
  const next = { ...s, throwsUsed: state.throwsUsed + 1 };

  const won = next.turnScore * next.mult >= next.turnTarget;
  if (!won && next.throwsUsed < 3) return next;

  const reward = won ? TURN_REWARDS[state.turnIndex] : 0;
  return {
    ...next,
    turnOutcome: won ? 'won' : 'lost',
    currency: next.currency + reward,
    lastTurnReward: reward,
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
    newGlobalTurnIndex,
    isNewRound ? undefined : state.shopOffers.powerup,
  );
  if (newGlobalTurnIndex === 1) newOffers.item = 'bullseye_dart'; // TODO: remove (testing)

  return {
    ...state,
    roundIndex:       newRoundIndex,
    turnIndex:        newTurnIndex,
    globalTurnIndex:  newGlobalTurnIndex,
    turnTarget:       computeTarget(newGlobalTurnIndex),
    currentTurnDarts: [],
    throwsUsed:       0,
    turnScore:        0,
    turnOutcome:      null,
    mult:             0,
    shopOffers:       newOffers,
    lastTurnReward:   0,
    lastDartBonus:    0,
    lastDartMultBonus: 0,
    lastDiamondMult:  1,
    lastGlassMult:    1,
    lastShatterSector: null,
  };
}

// ---- Shop purchase actions ----

/** Buy the single item offer (board / dart / decoration slot). */
export function buyItem(state: RoundsState, defId: string): RoundsState {
  const def = getItemDef(defId);
  if (!def) return state;
  const cost = getAdjustedCost(def.cost, state.ownedItems);
  if (state.currency < cost) return state;
  const newOwnedItems = [...state.ownedItems, createOwnedItem(defId)];
  const newOwnedDefIds = newOwnedItems.map(i => i.defId);

  // If this purchase unlocks a powerup that requires it, re-roll the powerup slot
  const unlocksNewPowerup = ITEMS.some(
    item => item.category === 'powerup'
      && item.requires === defId
      && canPurchase(item.id, newOwnedDefIds, state.globalTurnIndex),
  );
  const powerup = unlocksNewPowerup
    ? pickRandom(ITEMS.filter(item => item.category === 'powerup' && canPurchase(item.id, newOwnedDefIds, state.globalTurnIndex)))?.id ?? state.shopOffers.powerup
    : state.shopOffers.powerup;

  return {
    ...state,
    currency:   state.currency - cost,
    ownedItems: newOwnedItems,
    // Clear the offer slot so it can't be bought again this visit
    shopOffers: { ...state.shopOffers, item: null, powerup },
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
    ownedItems: state.ownedItems.map(item => {
      if (item.instanceId === instanceId) {
        const bi = item as OwnedBoardItem;
        const def = getItemDef(item.defId);
        if (def?.category === 'board' && def.effect.type === 'glass_sector' && bi.shattered) return item;
        return { ...item, sector };
      }
      // Evict any other item currently occupying this sector
      const bi = item as OwnedBoardItem;
      if (bi.sector === sector) return { ...item, sector: null };
      return item;
    }),
  };
}

/** Assign a dart slot index to a specific owned dart item instance. */
export function assignDartSlot(state: RoundsState, instanceId: string, dartIndex: number): RoundsState {
  return {
    ...state,
    ownedItems: state.ownedItems.map(item => {
      if (item.instanceId === instanceId) {
        return { ...item, dartIndex } as OwnedDartItem;
      }
      // Evict any other dart item already assigned to this slot
      const di = item as OwnedDartItem;
      if (di.dartIndex === dartIndex && getItemDef(item.defId)?.category === 'dart') {
        return { ...item, dartIndex: null } as OwnedDartItem;
      }
      return item;
    }),
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

/**
 * Returns the aimMultiplier for the current throw slot if it has a multi_dart assigned, else 1.
 * throwsUsed is the number of throws already completed this turn (= index of the next throw).
 */
export function getMultiDartAimFactor(throwsUsed: number, ownedItems: OwnedItem[]): number {
  for (const item of ownedItems) {
    if (item.defId !== 'multi_dart') continue;
    const di = item as OwnedDartItem;
    if (di.dartIndex === throwsUsed) {
      const def = getItemDef(item.defId);
      if (def?.category === 'dart' && def.effect.type === 'multi_dart') {
        return def.effect.aimMultiplier;
      }
    }
  }
  return 1;
}

/** Returns true if the current throw slot has a multi_dart assigned to it. */
export function isMultiDartThrow(throwsUsed: number, ownedItems: OwnedItem[]): boolean {
  return ownedItems.some(item => {
    if (item.defId !== 'multi_dart') return false;
    return (item as OwnedDartItem).dartIndex === throwsUsed;
  });
}

/** Returns true if the current throw slot has a bullseye_dart assigned to it. */
export function isBullseyeDartThrow(throwsUsed: number, ownedItems: OwnedItem[]): boolean {
  return ownedItems.some(item => {
    if (item.defId !== 'bullseye_dart') return false;
    return (item as OwnedDartItem).dartIndex === throwsUsed;
  });
}
