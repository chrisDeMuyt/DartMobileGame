// ============================================================
// Item System
// To add a new item: add an entry to ITEMS. No other file needs changing.
// ============================================================

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type ItemCategory = 'board' | 'dart' | 'powerup' | 'decoration';

// ---- Effect payloads (discriminated unions per category) ----

export type BoardEffect =
  | { type: 'bonus_sector';   bonusPoints: number }
  | { type: 'mult_sector';    multBonus: number }
  | { type: 'diamond_sector'; multMultiplier: number }
  | { type: 'glass_sector';   multMultiplier: number; shatterChance: number };

export type DartEffect =
  | { type: 'multi_dart';    dartCount: number; aimMultiplier: number }
  | { type: 'bullseye_dart' }
  | { type: 'bonus_dart';    bonusPoints: number }
  | { type: 'mult_dart';     multBonus: number };

export type PowerupEffect =
  | { type: 'reduce_aim';  factor: number }   // multiplied together; <1 = smaller circle
  | { type: 'reduce_cost'; factor: number };  // multiplied together; <1 = cheaper shop

export type DecorationEffect =
  | { type: 'cricket';     segments: number[]; multBonus: number }
  | { type: 'slots';       minReward: number; maxReward: number }
  | { type: 'leftovers';   scoreMultiplier: number }
  | { type: 'extra_darts'; count: number };

// ---- Item definitions ----

interface BaseItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  rarity: Rarity;
  cost: number;
  /** Item id that must be owned before this appears as purchasable */
  requires?: string;
  /** Max number of instances the player can own (undefined = unlimited) */
  maxOwned?: number;
}

export interface BoardItemDef extends BaseItemDef {
  category: 'board';
  effect: BoardEffect;
}

export interface DartItemDef extends BaseItemDef {
  category: 'dart';
  effect: DartEffect;
}

export interface PowerupItemDef extends BaseItemDef {
  category: 'powerup';
  effect: PowerupEffect;
}

export interface DecorationItemDef extends BaseItemDef {
  category: 'decoration';
  effect: DecorationEffect;
}

export type ItemDef =
  | BoardItemDef
  | DartItemDef
  | PowerupItemDef
  | DecorationItemDef;

// ---- Owned item instances (stored in game state) ----
// Definitions describe what an item does.
// Instances track per-purchase data (assignment, shattered state, etc.).

export interface OwnedBoardItem {
  instanceId: string;
  defId: string;
  /** Board sector this item is assigned to (null = not yet assigned) */
  sector: number | null;
  /** Glass Sector only: true once the sector has shattered */
  shattered: boolean;
}

export interface OwnedDartItem {
  instanceId: string;
  defId: string;
  /** Dart slot this item is assigned to: 0, 1, or 2 (null = not yet assigned) */
  dartIndex: number | null;
}

export interface OwnedPowerupItem {
  instanceId: string;
  defId: string;
}

export interface OwnedDecorationItem {
  instanceId: string;
  defId: string;
}

export type OwnedItem =
  | OwnedBoardItem
  | OwnedDartItem
  | OwnedPowerupItem
  | OwnedDecorationItem;

// ---- Item catalogue ----

export const ITEMS: ItemDef[] = [
  // ================================================================
  // BOARD ITEMS — applied to a specific sector chosen by the player
  // ================================================================
  {
    id: 'bonus_sector',
    name: 'Bonus Sector',
    category: 'board',
    description: 'A chosen sector awards +25 bonus points when hit.',
    rarity: 'common',
    cost: 10,
    effect: { type: 'bonus_sector', bonusPoints: 25 },
  },
  {
    id: 'mult_sector',
    name: 'MULT Sector',
    category: 'board',
    description: 'A chosen sector adds +5 to the MULT when hit.',
    rarity: 'uncommon',
    cost: 15,
    effect: { type: 'mult_sector', multBonus: 5 },
  },
  {
    id: 'diamond_sector',
    name: 'Diamond Sector',
    category: 'board',
    description: 'A chosen sector multiplies the current MULT ×2 when hit.',
    rarity: 'rare',
    cost: 25,
    effect: { type: 'diamond_sector', multMultiplier: 2 },
  },
  {
    id: 'glass_sector',
    name: 'Glass Sector',
    category: 'board',
    description:
      'A chosen sector multiplies MULT ×4 when hit — but has a 25% chance to shatter. Once shattered, that sector can no longer be scored.',
    rarity: 'legendary',
    cost: 35,
    effect: { type: 'glass_sector', multMultiplier: 4, shatterChance: 0.25 },
  },

  // ================================================================
  // DART ITEMS — applied to a specific dart slot chosen by the player
  // ================================================================
  {
    id: 'multi_dart',
    name: 'Multi-Dart',
    category: 'dart',
    description: 'Splits into 2 darts on throw, but the aim circle is 2× larger.',
    rarity: 'uncommon',
    cost: 20,
    effect: { type: 'multi_dart', dartCount: 2, aimMultiplier: 2 },
  },
  {
    id: 'bullseye_dart',
    name: 'Bullseye Dart',
    category: 'dart',
    description: 'Always lands on either the green or red bullseye (random).',
    rarity: 'rare',
    cost: 30,
    effect: { type: 'bullseye_dart' },
  },
  {
    id: 'bonus_dart',
    name: 'Bonus Dart',
    category: 'dart',
    description: 'Adds +15 bonus points to the score tally on landing.',
    rarity: 'common',
    cost: 12,
    effect: { type: 'bonus_dart', bonusPoints: 15 },
  },
  {
    id: 'mult_dart',
    name: 'Mult Dart',
    category: 'dart',
    description: 'Adds +3 to the MULT on landing.',
    rarity: 'uncommon',
    cost: 18,
    effect: { type: 'mult_dart', multBonus: 3 },
  },

  // ================================================================
  // POWERUPS — affect global game mechanics
  // ================================================================
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    category: 'powerup',
    description: 'Reduces aim circle size by 25%.',
    rarity: 'common',
    cost: 10,
    maxOwned: 1,
    effect: { type: 'reduce_aim', factor: 0.75 },
  },
  {
    id: 'sharpshooter_plus',
    name: 'Sharpshooter+',
    category: 'powerup',
    description: 'Reduces aim circle by another 25%. Requires Sharpshooter.',
    rarity: 'uncommon',
    cost: 20,
    maxOwned: 1,
    requires: 'sharpshooter',
    effect: { type: 'reduce_aim', factor: 0.75 },
  },
  {
    id: 'sale',
    name: 'Sale',
    category: 'powerup',
    description: 'All shop items cost 25% less.',
    rarity: 'uncommon',
    cost: 15,
    maxOwned: 1,
    effect: { type: 'reduce_cost', factor: 0.75 },
  },
  {
    id: 'sale_plus',
    name: 'Sale+',
    category: 'powerup',
    description: 'All shop items cost another 25% less. Requires Sale.',
    rarity: 'rare',
    cost: 25,
    maxOwned: 1,
    requires: 'sale',
    effect: { type: 'reduce_cost', factor: 0.75 },
  },

  // ================================================================
  // DECORATIONS — passive effects that alter rules or scoring
  // ================================================================
  {
    id: 'cricket',
    name: 'Cricket',
    category: 'decoration',
    description: 'Hitting numbers 15–20 or the bullseye adds +6 MULT.',
    rarity: 'uncommon',
    cost: 20,
    // segments 15-20 + outer bull (25) + inner bull (50)
    effect: { type: 'cricket', segments: [15, 16, 17, 18, 19, 20, 25, 50], multBonus: 6 },
  },
  {
    id: 'slots',
    name: '$Slots$',
    category: 'decoration',
    description: 'At the start of each turn, a random sector is chosen. Hit it to earn $1–$3.',
    rarity: 'uncommon',
    cost: 15,
    effect: { type: 'slots', minReward: 1, maxReward: 3 },
  },
  {
    id: 'leftovers',
    name: 'Leftovers',
    category: 'decoration',
    description: 'Any unused darts at the end of a turn multiply the total SCORE ×2.',
    rarity: 'rare',
    cost: 25,
    effect: { type: 'leftovers', scoreMultiplier: 2 },
  },
  {
    id: 'extra_extra',
    name: 'Extra Extra',
    category: 'decoration',
    description: 'Player gets 2 additional darts per turn.',
    rarity: 'legendary',
    cost: 40,
    effect: { type: 'extra_darts', count: 2 },
  },
];

// ---- Helpers ----

/** Look up an item definition by id. */
export function getItemDef(id: string): ItemDef | undefined {
  return ITEMS.find(item => item.id === id);
}

/**
 * Returns true if the player meets the prerequisite to purchase this item.
 * Pass the list of defIds already owned.
 */
export function prerequisiteMet(defId: string, ownedDefIds: string[]): boolean {
  const def = getItemDef(defId);
  if (!def) return false;
  if (def.requires && !ownedDefIds.includes(def.requires)) return false;
  return true;
}

/**
 * Returns true if the player can purchase one more of this item.
 * Checks both prerequisite and maxOwned cap.
 */
export function canPurchase(defId: string, ownedDefIds: string[]): boolean {
  const def = getItemDef(defId);
  if (!def) return false;
  if (!prerequisiteMet(defId, ownedDefIds)) return false;
  if (def.maxOwned !== undefined) {
    const count = ownedDefIds.filter(id => id === defId).length;
    if (count >= def.maxOwned) return false;
  }
  return true;
}

/**
 * Apply Sale / Sale+ cost reduction from owned powerups.
 * Pass all owned items; returns the adjusted cost (floored to integer).
 */
export function getAdjustedCost(baseCost: number, ownedItems: OwnedItem[]): number {
  let factor = 1;
  for (const owned of ownedItems) {
    const def = getItemDef(owned.defId);
    if (def?.category === 'powerup' && def.effect.type === 'reduce_cost') {
      factor *= def.effect.factor;
    }
  }
  return Math.max(1, Math.floor(baseCost * factor));
}

/** Create a fresh owned-item instance for a given definition. */
export function createOwnedItem(defId: string): OwnedItem {
  const instanceId = `${defId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const def = getItemDef(defId);
  if (!def) throw new Error(`Unknown item: ${defId}`);

  switch (def.category) {
    case 'board':
      return { instanceId, defId, sector: null, shattered: false } satisfies OwnedBoardItem;
    case 'dart':
      return { instanceId, defId, dartIndex: null } satisfies OwnedDartItem;
    case 'powerup':
      return { instanceId, defId } satisfies OwnedPowerupItem;
    case 'decoration':
      return { instanceId, defId } satisfies OwnedDecorationItem;
  }
}
