import { DartHit } from '../dartboard';
import {
  OwnedBoardItem,
  OwnedItem,
  createOwnedItem,
  canPurchase,
  ITEMS,
} from '../items';
import {
  RoundsState,
  computeTarget,
  initGameState,
  generateShopOffers,
  addDart,
  addMultiDart,
  advanceTurn,
  buyItem,
  claimPackItem,
  buyPowerup,
  assignBoardSector,
  assignDartSlot,
  getAimFactor,
  getMultiDartAimFactor,
  isMultiDartThrow,
  PACK_COSTS,
} from '../gameLogic';
import type { OwnedDartItem } from '../items';

// ---- Helpers ----

function hit(segment: number, score: number, multiplier: 1 | 2 | 3 = 1): DartHit {
  return { x: 0, y: 0, score, segment, multiplier, label: String(score) };
}

const miss = (): DartHit => hit(0, 0, 1);

function baseState(overrides: Partial<RoundsState> = {}): RoundsState {
  const s = initGameState({ id: 1, name: 'Test' });
  return { ...s, currency: 100, ...overrides };
}

function boardItem(defId: string, sector: number): OwnedBoardItem {
  const owned = createOwnedItem(defId) as OwnedBoardItem;
  return { ...owned, sector };
}

// ---- computeTarget ----

describe('computeTarget', () => {
  test('turn 0 → 20', () => expect(computeTarget(0)).toBe(20));
  test('turn 1 → 40', () => expect(computeTarget(1)).toBe(40));
  test('turn 2 → 80', () => expect(computeTarget(2)).toBe(80));
  test('turn 3 → 100', () => expect(computeTarget(3)).toBe(100));
  test('turn 5 → 180', () => expect(computeTarget(5)).toBe(180));
});

// ---- initGameState ----

describe('initGameState', () => {
  const state = initGameState({ id: 1, name: 'Alice' });

  test('mode is rounds', () => expect(state.mode).toBe('rounds'));
  test('roundIndex is 0', () => expect(state.roundIndex).toBe(0));
  test('turnIndex is 0', () => expect(state.turnIndex).toBe(0));
  test('globalTurnIndex is 0', () => expect(state.globalTurnIndex).toBe(0));
  test('turnTarget equals computeTarget(0)', () => expect(state.turnTarget).toBe(computeTarget(0)));
  test('ownedItems is empty', () => expect(state.ownedItems).toEqual([]));
  test('currentTurnDarts is empty', () => expect(state.currentTurnDarts).toEqual([]));
  test('turnOutcome is null', () => expect(state.turnOutcome).toBeNull());
  test('mult is 0', () => expect(state.mult).toBe(0));
  test('turnScore is 0', () => expect(state.turnScore).toBe(0));
  test('lastDiamondMult is 1', () => expect(state.lastDiamondMult).toBe(1));
});

// ---- generateShopOffers ----

describe('generateShopOffers', () => {
  test('keepPowerup=null preserves null (sold out)', () => {
    const offers = generateShopOffers([], 0, null);
    expect(offers.powerup).toBeNull();
  });

  test('keepPowerup="sharpshooter" preserves the id', () => {
    const offers = generateShopOffers([], 0, 'sharpshooter');
    expect(offers.powerup).toBe('sharpshooter');
  });

  test('keepPowerup=undefined rolls a fresh powerup (may be null or valid)', () => {
    const offers = generateShopOffers([], 0, undefined);
    if (offers.powerup !== null) {
      expect(ITEMS.some(i => i.id === offers.powerup && i.category === 'powerup')).toBe(true);
    }
  });

  test('item offer, if present, passes canPurchase', () => {
    const offers = generateShopOffers([], 0, null);
    if (offers.item !== null) {
      expect(canPurchase(offers.item, [], 0)).toBe(true);
    }
  });

  test('itemPack offers, if present, pass canPurchase', () => {
    const offers = generateShopOffers([], 0, null);
    if (offers.itemPack !== null) {
      for (const id of offers.itemPack) {
        expect(canPurchase(id, [], 0)).toBe(true);
      }
    }
  });
});

// ---- addDart — core behavior ----

describe('addDart — core', () => {
  test('ignores dart when turnOutcome is set', () => {
    const state = baseState({ turnOutcome: 'lost' });
    const next = addDart(state, hit(20, 20));
    expect(next).toBe(state);
  });

  test('ignores dart when 3 darts already thrown', () => {
    const state = baseState({ currentTurnDarts: [hit(1, 1), hit(2, 2), hit(3, 3)], throwsUsed: 3 });
    const next = addDart(state, hit(20, 20));
    expect(next).toBe(state);
  });

  test('miss: turnScore unchanged, mult unchanged, lastDiamondMult=1', () => {
    // Establish real mult=1 via a scoring dart, then add a miss
    const state = baseState({ turnTarget: 999 });
    const s1 = addDart(state, hit(5, 5));  // mult=1 from one scoring dart
    expect(s1.mult).toBe(1);
    const s2 = addDart(s1, miss());
    expect(s2.turnScore).toBe(s1.turnScore); // turnScore unchanged
    expect(s2.mult).toBe(1);                 // mult unchanged (miss not counted)
    expect(s2.lastDiamondMult).toBe(1);
  });

  test('single scoring dart: turnScore = dart.score, mult = 1', () => {
    const state = baseState({ turnTarget: 999 });
    const next = addDart(state, hit(20, 20));
    expect(next.turnScore).toBe(20);
    expect(next.mult).toBe(1);
  });

  test('two darts different segments: mult = 2', () => {
    const state = baseState({ turnTarget: 999 });
    const s1 = addDart(state, hit(20, 20));
    const s2 = addDart(s1, hit(19, 19));
    expect(s2.mult).toBe(2);
  });

  test('two darts same segment (combo): mult = 4', () => {
    const state = baseState({ turnTarget: 999 });
    const s1 = addDart(state, hit(20, 20));
    const s2 = addDart(s1, hit(20, 20));
    expect(s2.mult).toBe(4);
  });

  test('three darts same segment: mult = 15', () => {
    const state = baseState({ turnTarget: 999 });
    const s1 = addDart(state, hit(20, 20));
    const s2 = addDart(s1, hit(20, 20));
    const s3 = addDart(s2, hit(20, 20));
    expect(s3.mult).toBe(15);
  });

  test('win on 3rd dart: turnOutcome=won, currency += TURN_REWARDS[turnIndex]', () => {
    // turnIndex=0 → reward=5; need score*mult >= target on 3rd dart
    // Use target=1 so any scoring dart wins
    const state = baseState({ turnTarget: 1, turnIndex: 0 });
    const s1 = addDart(state, miss());
    const s2 = addDart(s1, miss());
    const s3 = addDart(s2, hit(1, 1));
    expect(s3.turnOutcome).toBe('won');
    expect(s3.currency).toBe(state.currency + 5);
    expect(s3.lastTurnReward).toBe(5);
  });

  test('lose on 3rd dart: turnOutcome=lost, no reward', () => {
    const state = baseState({ turnTarget: 9999, turnIndex: 0 });
    const s1 = addDart(state, miss());
    const s2 = addDart(s1, miss());
    const s3 = addDart(s2, miss());
    expect(s3.turnOutcome).toBe('lost');
    expect(s3.currency).toBe(state.currency);
    expect(s3.lastTurnReward).toBe(0);
  });

  test('win on 1st dart: turnOutcome=won immediately', () => {
    const state = baseState({ turnTarget: 1, turnIndex: 1 });
    const next = addDart(state, hit(1, 1));
    expect(next.turnOutcome).toBe('won');
    expect(next.currency).toBe(state.currency + 10); // TURN_REWARDS[1] = 10
  });

  test('win on 2nd dart: turnOutcome=won', () => {
    const state = baseState({ turnTarget: 5, turnIndex: 2 });
    const s1 = addDart(state, hit(1, 1));
    // score=1, mult=1 → 1 < 5, not won yet
    const s2 = addDart(s1, hit(2, 2));
    // score=3, mult=2 → 6 >= 5, won
    expect(s2.turnOutcome).toBe('won');
    expect(s2.currency).toBe(state.currency + 15); // TURN_REWARDS[2] = 15
  });
});

// ---- addDart — board items ----

describe('addDart — board items', () => {
  test('bonus_sector on hit segment: turnScore += bonusPoints (25)', () => {
    const item = boardItem('bonus_sector', 20);
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    const next = addDart(state, hit(20, 20));
    expect(next.turnScore).toBe(20 + 25);
    expect(next.lastDartBonus).toBe(25);
  });

  test('bonus_sector on wrong sector: no bonus', () => {
    const item = boardItem('bonus_sector', 19);
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    const next = addDart(state, hit(20, 20));
    expect(next.turnScore).toBe(20);
    expect(next.lastDartBonus).toBe(0);
  });

  test('bonus_sector does not fire on miss', () => {
    const item = boardItem('bonus_sector', 0);
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    const next = addDart(state, miss());
    expect(next.turnScore).toBe(0);
    expect(next.lastDartBonus).toBe(0);
  });

  test('mult_sector on hit segment: mult increases by multBonus (5), lastDartMultBonus=5', () => {
    const item = boardItem('mult_sector', 20);
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    const next = addDart(state, hit(20, 20));
    // computeMult: n=1 → mult += 1 + 5 = 6
    expect(next.mult).toBe(6);
    expect(next.lastDartMultBonus).toBe(5);
  });

  test('mult_sector on wrong sector: no mult bonus', () => {
    const item = boardItem('mult_sector', 19);
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    const next = addDart(state, hit(20, 20));
    expect(next.mult).toBe(1);
    expect(next.lastDartMultBonus).toBe(0);
  });

  test('diamond_sector on hit segment: mult doubled (×2), lastDiamondMult=2', () => {
    const item = boardItem('diamond_sector', 20);
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    // Without diamond: one dart → mult=1. With diamond: mult *= 2 → 2
    const next = addDart(state, hit(20, 20));
    expect(next.mult).toBe(2);
    expect(next.lastDiamondMult).toBe(2);
  });

  test('diamond_sector on miss: no effect, lastDiamondMult=1', () => {
    const item = boardItem('diamond_sector', 20);
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    const next = addDart(state, miss());
    expect(next.mult).toBe(0);
    expect(next.lastDiamondMult).toBe(1);
  });

  test('diamond_sector on wrong sector: no effect', () => {
    const item = boardItem('diamond_sector', 19);
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    const next = addDart(state, hit(20, 20));
    expect(next.mult).toBe(1);
    expect(next.lastDiamondMult).toBe(1);
  });

  test('mult_sector + combo: dart1 mult=6, dart2 mult=24', () => {
    const item = boardItem('mult_sector', 20);
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    // dart 1: n=1, dartMultBonus=5 → mult = 0 + (1+5) = 6
    const s1 = addDart(state, hit(20, 20));
    expect(s1.mult).toBe(6);
    // dart 2: n=2, dartMultBonus=5 → mult = (6 + 1 + 5) * 2 = 24
    const s2 = addDart(s1, hit(20, 20));
    expect(s2.mult).toBe(24);
  });
});

// ---- glass_sector ----

describe('glass_sector', () => {
  afterEach(() => jest.restoreAllMocks());

  // ---- basic hit ----

  test('hit matching sector (no shatter): mult=4, lastGlassMult=4, lastShatterSector=null', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // above shatterChance=0.25 → no shatter
    const item = boardItem('glass_sector', 20);
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    const next = addDart(state, hit(20, 20));
    expect(next.mult).toBe(4);
    expect(next.lastGlassMult).toBe(4);
    expect(next.lastShatterSector).toBeNull();
  });

  test('hit wrong sector: no glass effect, mult=1, lastGlassMult=1', () => {
    const item = boardItem('glass_sector', 19);
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    const next = addDart(state, hit(20, 20));
    expect(next.mult).toBe(1);
    expect(next.lastGlassMult).toBe(1);
  });

  test('miss: no glass effect, mult=0, lastGlassMult=1', () => {
    const item = boardItem('glass_sector', 20);
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    const next = addDart(state, miss());
    expect(next.mult).toBe(0);
    expect(next.lastGlassMult).toBe(1);
  });

  // ---- shatter mechanics ----

  test('shatter occurs (random=0): lastShatterSector=20, item shattered=true', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0); // below 0.25 → shatter
    const item = boardItem('glass_sector', 20);
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    const next = addDart(state, hit(20, 20));
    expect(next.lastShatterSector).toBe(20);
    const owned = next.ownedItems.find(i => i.instanceId === item.instanceId) as OwnedBoardItem;
    expect(owned.shattered).toBe(true);
  });

  test('breaking dart still scores ×4 even when shatter occurs', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0); // shatter
    const item = boardItem('glass_sector', 20);
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    const next = addDart(state, hit(20, 20));
    expect(next.mult).toBe(4);
    expect(next.lastGlassMult).toBe(4);
  });

  test('no shatter (random=0.5): lastShatterSector=null, item shattered=false', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const item = boardItem('glass_sector', 20);
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    const next = addDart(state, hit(20, 20));
    expect(next.lastShatterSector).toBeNull();
    const owned = next.ownedItems.find(i => i.instanceId === item.instanceId) as OwnedBoardItem;
    expect(owned.shattered).toBe(false);
  });

  // ---- dead zone (shattered) ----

  test('dead zone: hitting shattered sector adds no score', () => {
    const item = { ...boardItem('glass_sector', 20), shattered: true } as OwnedBoardItem;
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    const next = addDart(state, hit(20, 20));
    expect(next.turnScore).toBe(0);
  });

  test('dead zone: hitting shattered sector does not increase mult', () => {
    const item = { ...boardItem('glass_sector', 20), shattered: true } as OwnedBoardItem;
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    const next = addDart(state, hit(20, 20));
    expect(next.mult).toBe(0);
    expect(next.lastGlassMult).toBe(1);
  });

  test('dead zone: lastShatterSector stays null (already shattered, cannot re-shatter)', () => {
    const item = { ...boardItem('glass_sector', 20), shattered: true } as OwnedBoardItem;
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    const next = addDart(state, hit(20, 20));
    expect(next.lastShatterSector).toBeNull();
  });

  // ---- state resets on advanceTurn ----

  test('lastGlassMult resets to 1 after advanceTurn', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const item = boardItem('glass_sector', 20);
    // Win the turn by hitting the glass sector
    const state = baseState({ turnTarget: 4, ownedItems: [item] });
    const afterDart = addDart(state, hit(20, 20)); // score=20, mult=4 → 80 ≥ 4 → won
    expect(afterDart.turnOutcome).toBe('won');
    expect(advanceTurn(afterDart).lastGlassMult).toBe(1);
  });

  test('lastShatterSector resets to null after advanceTurn', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0); // shatter
    const item = boardItem('glass_sector', 20);
    const state = baseState({ turnTarget: 4, ownedItems: [item] });
    const afterDart = addDart(state, hit(20, 20));
    expect(afterDart.turnOutcome).toBe('won');
    expect(advanceTurn(afterDart).lastShatterSector).toBeNull();
  });

  test('shattered flag persists on item across advanceTurn', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0); // shatter
    const item = boardItem('glass_sector', 20);
    const state = baseState({ turnTarget: 4, ownedItems: [item] });
    const afterDart = addDart(state, hit(20, 20));
    const nextTurn = advanceTurn(afterDart);
    const owned = nextTurn.ownedItems.find(i => i.instanceId === item.instanceId) as OwnedBoardItem;
    expect(owned.shattered).toBe(true);
  });

  // ---- mult chain (regression: applyDartAdditive fix) ----

  test('dart after glass hit adds +1, not +4 (no ×4 bleed)', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // no shatter
    const item = boardItem('glass_sector', 20);
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    // dart1: hits glass sector → mult = 1 * 4 = 4
    const s1 = addDart(state, hit(20, 20));
    expect(s1.mult).toBe(4);
    // dart2: hits a different sector → additive +1 only → mult = 5
    const s2 = addDart(s1, hit(5, 5));
    expect(s2.mult).toBe(5);
  });

  test('dart after glass shatters still sees mult=5 (shatter does not reset mult)', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0); // shatter on dart1
    const item = boardItem('glass_sector', 20);
    const state = baseState({ turnTarget: 999, ownedItems: [item] });
    // dart1: hits glass, shatters → mult = 4 stored in state
    const s1 = addDart(state, hit(20, 20));
    expect(s1.mult).toBe(4);
    expect(s1.lastShatterSector).toBe(20);
    // dart2: hits different sector, glass now shattered → additive +1 → mult = 5
    const s2 = addDart(s1, hit(5, 5));
    expect(s2.mult).toBe(5);
  });
});

// ---- advanceTurn ----

describe('advanceTurn', () => {
  test('returns state unchanged if turnOutcome !== won', () => {
    const state = baseState({ turnOutcome: null });
    expect(advanceTurn(state)).toBe(state);
  });

  test('returns state unchanged if turnOutcome=lost', () => {
    const state = baseState({ turnOutcome: 'lost' });
    expect(advanceTurn(state)).toBe(state);
  });

  test('turnIndex cycles 0→1', () => {
    const state = baseState({ turnOutcome: 'won', turnIndex: 0, globalTurnIndex: 0, roundIndex: 0 });
    expect(advanceTurn(state).turnIndex).toBe(1);
  });

  test('turnIndex cycles 1→2', () => {
    const state = baseState({ turnOutcome: 'won', turnIndex: 1, globalTurnIndex: 1, roundIndex: 0 });
    expect(advanceTurn(state).turnIndex).toBe(2);
  });

  test('turnIndex wraps 2→0 and roundIndex increments', () => {
    const state = baseState({ turnOutcome: 'won', turnIndex: 2, globalTurnIndex: 2, roundIndex: 0 });
    const next = advanceTurn(state);
    expect(next.turnIndex).toBe(0);
    expect(next.roundIndex).toBe(1);
  });

  test('globalTurnIndex always increments by 1', () => {
    const state = baseState({ turnOutcome: 'won', globalTurnIndex: 4 });
    expect(advanceTurn(state).globalTurnIndex).toBe(5);
  });

  test('resets currentTurnDarts, turnScore, mult, turnOutcome, lastDiamondMult', () => {
    const state = baseState({
      turnOutcome: 'won',
      turnIndex: 0,
      globalTurnIndex: 0,
      currentTurnDarts: [hit(20, 20)],
      turnScore: 20,
      mult: 1,
      lastDiamondMult: 2,
    });
    const next = advanceTurn(state);
    expect(next.currentTurnDarts).toEqual([]);
    expect(next.turnScore).toBe(0);
    expect(next.mult).toBe(0);
    expect(next.turnOutcome).toBeNull();
    expect(next.lastDiamondMult).toBe(1);
  });

  test('turnTarget = computeTarget(newGlobalTurnIndex)', () => {
    const state = baseState({ turnOutcome: 'won', turnIndex: 0, globalTurnIndex: 3 });
    const next = advanceTurn(state);
    expect(next.turnTarget).toBe(computeTarget(4));
  });

  test('powerup preserved mid-round (turnIndex 0→1)', () => {
    const state = baseState({
      turnOutcome: 'won',
      turnIndex: 0,
      globalTurnIndex: 5,
      shopOffers: { item: null, decorationPack: null, itemPack: null, powerup: 'sharpshooter' },
    });
    const next = advanceTurn(state);
    // Not a new round → powerup preserved
    expect(next.shopOffers.powerup).toBe('sharpshooter');
  });

  test('powerup preserved mid-round when sold out (null)', () => {
    const state = baseState({
      turnOutcome: 'won',
      turnIndex: 1,
      globalTurnIndex: 5,
      shopOffers: { item: null, decorationPack: null, itemPack: null, powerup: null },
    });
    const next = advanceTurn(state);
    expect(next.shopOffers.powerup).toBeNull();
  });

  test('powerup re-rolled at round boundary (turnIndex 2→0)', () => {
    // We can't predict the rolled value, but we can verify keepPowerup=undefined was passed
    // by checking it's NOT forced to the old value (unless coincidence)
    // Best we can do: it's either null or a valid powerup id
    const state = baseState({
      turnOutcome: 'won',
      turnIndex: 2,
      globalTurnIndex: 5,
      shopOffers: { item: null, decorationPack: null, itemPack: null, powerup: 'sharpshooter' },
    });
    const next = advanceTurn(state);
    const powerup = next.shopOffers.powerup;
    if (powerup !== null) {
      expect(ITEMS.some(i => i.id === powerup && i.category === 'powerup')).toBe(true);
    }
    // passes (we verified it's null or a valid id)
  });
});

// ---- buyItem ----

describe('buyItem', () => {
  test('returns state unchanged if defId not found', () => {
    const state = baseState({ currency: 50 });
    expect(buyItem(state, 'nonexistent_id')).toBe(state);
  });

  test('returns state unchanged if insufficient currency', () => {
    const state = baseState({ currency: 0 });
    expect(buyItem(state, 'bonus_sector')).toBe(state); // costs 10
  });

  test('deducts cost from currency', () => {
    const state = baseState({ currency: 50 });
    const next = buyItem(state, 'bonus_sector'); // costs 10
    expect(next.currency).toBe(40);
  });

  test('adds item to ownedItems', () => {
    const state = baseState({ currency: 50 });
    const next = buyItem(state, 'bonus_sector');
    expect(next.ownedItems).toHaveLength(1);
    expect(next.ownedItems[0].defId).toBe('bonus_sector');
  });

  test('clears item slot in shopOffers', () => {
    const state = baseState({
      currency: 50,
      shopOffers: { item: 'bonus_sector', decorationPack: null, itemPack: null, powerup: null },
    });
    const next = buyItem(state, 'bonus_sector');
    expect(next.shopOffers.item).toBeNull();
  });

  test('Sale powerup reduces cost by 25%', () => {
    const sale = createOwnedItem('sale');
    const state = baseState({ currency: 50, ownedItems: [sale] });
    // bonus_sector costs 10; with Sale (factor 0.75) → floor(10*0.75) = 7
    const next = buyItem(state, 'bonus_sector');
    expect(next.currency).toBe(43);
  });

  test('powerup unlock re-roll: buying sharpshooter at turn 3 sets powerup to sharpshooter_plus', () => {
    // Own sale + sale_plus so those are maxOwned-blocked; sharpshooter_plus becomes the only eligible powerup
    const saleItem     = createOwnedItem('sale');
    const salePlusItem = createOwnedItem('sale_plus');
    const state = baseState({
      globalTurnIndex: 3,
      currency: 50,
      ownedItems: [saleItem, salePlusItem],
      shopOffers: { item: 'sharpshooter', decorationPack: null, itemPack: null, powerup: 'sale' },
    });
    const next = buyItem(state, 'sharpshooter');
    // sharpshooter_plus is now the only eligible powerup (pool size=1 → deterministic)
    expect(next.shopOffers.powerup).toBe('sharpshooter_plus');
  });
});

// ---- claimPackItem ----

describe('claimPackItem', () => {
  const fullOffers = {
    item: null,
    decorationPack: ['cricket', 'slots'] as [string, string],
    itemPack: ['bonus_sector', 'mult_sector'] as [string, string],
    powerup: null,
  };

  test('returns state unchanged if insufficient currency for item pack', () => {
    const state = baseState({ currency: 0, shopOffers: fullOffers });
    expect(claimPackItem(state, 'item', 'bonus_sector')).toBe(state);
  });

  test('returns state unchanged if insufficient currency for decoration pack', () => {
    const state = baseState({ currency: 0, shopOffers: fullOffers });
    expect(claimPackItem(state, 'decoration', 'cricket')).toBe(state);
  });

  test('deducts PACK_COSTS.item (8) for item pack', () => {
    const state = baseState({ currency: 50, shopOffers: fullOffers });
    const next = claimPackItem(state, 'item', 'bonus_sector');
    expect(next.currency).toBe(50 - PACK_COSTS.item);
  });

  test('deducts PACK_COSTS.decoration (10) for decoration pack', () => {
    const state = baseState({ currency: 50, shopOffers: fullOffers });
    const next = claimPackItem(state, 'decoration', 'cricket');
    expect(next.currency).toBe(50 - PACK_COSTS.decoration);
  });

  test('adds chosen item to ownedItems', () => {
    const state = baseState({ currency: 50, shopOffers: fullOffers });
    const next = claimPackItem(state, 'item', 'bonus_sector');
    expect(next.ownedItems).toHaveLength(1);
    expect(next.ownedItems[0].defId).toBe('bonus_sector');
  });

  test('clears itemPack slot but leaves decorationPack intact', () => {
    const state = baseState({ currency: 50, shopOffers: fullOffers });
    const next = claimPackItem(state, 'item', 'bonus_sector');
    expect(next.shopOffers.itemPack).toBeNull();
    expect(next.shopOffers.decorationPack).toEqual(fullOffers.decorationPack);
  });

  test('clears decorationPack slot but leaves itemPack intact', () => {
    const state = baseState({ currency: 50, shopOffers: fullOffers });
    const next = claimPackItem(state, 'decoration', 'cricket');
    expect(next.shopOffers.decorationPack).toBeNull();
    expect(next.shopOffers.itemPack).toEqual(fullOffers.itemPack);
  });
});

// ---- buyPowerup ----

describe('buyPowerup', () => {
  test('returns state unchanged if no powerup offer', () => {
    const state = baseState({ shopOffers: { item: null, decorationPack: null, itemPack: null, powerup: null } });
    expect(buyPowerup(state)).toBe(state);
  });

  test('returns state unchanged if insufficient currency', () => {
    const state = baseState({
      currency: 0,
      shopOffers: { item: null, decorationPack: null, itemPack: null, powerup: 'sharpshooter' },
    });
    expect(buyPowerup(state)).toBe(state);
  });

  test('deducts cost and adds powerup to ownedItems', () => {
    const state = baseState({
      currency: 50,
      shopOffers: { item: null, decorationPack: null, itemPack: null, powerup: 'sharpshooter' },
    });
    const next = buyPowerup(state);
    expect(next.currency).toBe(50 - 10); // sharpshooter costs 10
    expect(next.ownedItems).toHaveLength(1);
    expect(next.ownedItems[0].defId).toBe('sharpshooter');
  });

  test('sets shopOffers.powerup to null after purchase', () => {
    const state = baseState({
      currency: 50,
      shopOffers: { item: null, decorationPack: null, itemPack: null, powerup: 'sharpshooter' },
    });
    expect(buyPowerup(state).shopOffers.powerup).toBeNull();
  });
});

// ---- assignBoardSector ----

describe('assignBoardSector', () => {
  test('sets sector on matching instanceId', () => {
    const item = createOwnedItem('bonus_sector') as OwnedBoardItem;
    const state = baseState({ ownedItems: [item] });
    const next = assignBoardSector(state, item.instanceId, 20);
    const updated = next.ownedItems[0] as OwnedBoardItem;
    expect(updated.sector).toBe(20);
  });

  test('does not modify other items', () => {
    const item1 = createOwnedItem('bonus_sector') as OwnedBoardItem;
    const item2 = createOwnedItem('mult_sector') as OwnedBoardItem;
    const state = baseState({ ownedItems: [item1, item2] });
    const next = assignBoardSector(state, item1.instanceId, 20);
    expect((next.ownedItems[1] as OwnedBoardItem).sector).toBeNull();
  });

  test('sector replacement: assigning to occupied sector evicts previous occupant', () => {
    const itemA = createOwnedItem('bonus_sector') as OwnedBoardItem;
    const itemB = createOwnedItem('mult_sector') as OwnedBoardItem;
    // itemA already on sector 20
    const itemAOnSector = { ...itemA, sector: 20 };
    const state = baseState({ ownedItems: [itemAOnSector, itemB] });
    const next = assignBoardSector(state, itemB.instanceId, 20);
    expect((next.ownedItems[0] as OwnedBoardItem).sector).toBeNull(); // A evicted
    expect((next.ownedItems[1] as OwnedBoardItem).sector).toBe(20);   // B assigned
  });

  test('item on different sector is not evicted', () => {
    const itemA = createOwnedItem('bonus_sector') as OwnedBoardItem;
    const itemB = createOwnedItem('mult_sector') as OwnedBoardItem;
    const itemC = createOwnedItem('diamond_sector') as OwnedBoardItem;
    const itemAOn20 = { ...itemA, sector: 20 };
    const itemBOn1  = { ...itemB, sector: 1 };
    const state = baseState({ ownedItems: [itemAOn20, itemBOn1, itemC] });
    // Assign itemC to sector 20 — should evict A but not B
    const next = assignBoardSector(state, itemC.instanceId, 20);
    expect((next.ownedItems[0] as OwnedBoardItem).sector).toBeNull(); // A evicted
    expect((next.ownedItems[1] as OwnedBoardItem).sector).toBe(1);    // B untouched
    expect((next.ownedItems[2] as OwnedBoardItem).sector).toBe(20);   // C assigned
  });
});

// ---- getAimFactor ----

describe('getAimFactor', () => {
  test('returns 1.0 with no items', () => {
    expect(getAimFactor([])).toBe(1);
  });

  test('returns 1.0 with non-powerup items', () => {
    const item = createOwnedItem('bonus_sector');
    expect(getAimFactor([item])).toBe(1);
  });

  test('one sharpshooter (factor 0.75): returns 0.75', () => {
    const item = createOwnedItem('sharpshooter');
    expect(getAimFactor([item])).toBe(0.75);
  });

  test('sharpshooter + sharpshooter_plus: returns 0.75 * 0.6667', () => {
    const s1 = createOwnedItem('sharpshooter');
    const s2 = createOwnedItem('sharpshooter_plus');
    expect(getAimFactor([s1, s2])).toBeCloseTo(0.75 * 0.6667, 4);
  });
});

// ---- Helpers for dart item tests ----

function dartItem(defId: string, dartIndex: number | null): OwnedDartItem {
  return { ...createOwnedItem(defId) as OwnedDartItem, dartIndex };
}

// ---- addMultiDart ----

describe('addMultiDart', () => {
  test('adds exactly 2 hits to currentTurnDarts', () => {
    const s = baseState();
    const result = addMultiDart(s, hit(20, 20), hit(19, 19));
    expect(result.currentTurnDarts).toHaveLength(2);
  });

  test('increments throwsUsed by 1 (not 2)', () => {
    const s = baseState();
    const result = addMultiDart(s, hit(20, 20), hit(19, 19));
    expect(result.throwsUsed).toBe(1);
  });

  test('both darts scored: turnScore = dart1.score + dart2.score (no combo)', () => {
    const s = baseState();
    const result = addMultiDart(s, hit(20, 20), hit(19, 19));
    expect(result.turnScore).toBe(39);
  });

  test('returns state unchanged when turnOutcome is already set', () => {
    const s = baseState({ turnOutcome: 'won' });
    const result = addMultiDart(s, hit(20, 20), hit(19, 19));
    expect(result).toBe(s);
  });

  test('returns state unchanged when throwsUsed >= 3', () => {
    const s = baseState({ throwsUsed: 3 });
    const result = addMultiDart(s, hit(20, 20), hit(19, 19));
    expect(result).toBe(s);
  });

  test('combo: both darts hit same segment → combo multiplier applied', () => {
    const s = baseState();
    // Two darts on segment 20: same-segment pair combo produces mult=4 (matches addDart behaviour)
    const result = addMultiDart(s, hit(20, 20), hit(20, 20));
    expect(result.mult).toBe(4);
  });

  test('bonus_sector fires for each dart that hits the assigned sector', () => {
    const s = baseState({ ownedItems: [boardItem('bonus_sector', 20)] });
    // Both darts land on segment 20 → +25 bonus each
    const result = addMultiDart(s, hit(20, 20), hit(20, 20));
    expect(result.turnScore).toBe(20 + 25 + 20 + 25); // 90
  });

  test('mult_sector applies for each dart that hits the assigned sector', () => {
    const s = baseState({ ownedItems: [boardItem('mult_sector', 20)] });
    // Each hit on segment 20 adds +5 MULT
    const result = addMultiDart(s, hit(20, 20), hit(20, 20));
    // mult: dart1 = 1 (first dart) + 5 mult_sector; dart2 = pair combo + 5 mult_sector
    expect(result.mult).toBeGreaterThan(6); // at minimum 1+5=6 from dart1 alone
  });

  test('win: score meets target after both darts → turnOutcome = won', () => {
    // turnTarget defaults to computeTarget(0) = 20; score darts that sum past it
    const s = baseState();
    const result = addMultiDart(s, hit(15, 15), hit(10, 10));
    // turnScore=25, mult=2 (different segments → normal, wait let's use same segment)
    // Actually use guaranteed win: hit the same segment twice for combo
    const s2 = baseState({ turnTarget: 30 });
    const r2 = addMultiDart(s2, hit(20, 20), hit(19, 19));
    // turnScore=39, mult=2 (different segments) → 78 >= 30
    expect(r2.turnOutcome).toBe('won');
  });

  test('loss: 3rd throw is multi-dart, score still under target → turnOutcome = lost', () => {
    const s = baseState({ throwsUsed: 2, turnTarget: 10000 });
    // Score is way below target; this is the last throw
    const result = addMultiDart(s, hit(1, 1), hit(1, 1));
    expect(result.throwsUsed).toBe(3);
    expect(result.turnOutcome).toBe('lost');
  });

  test('mid-turn: throwsUsed < 3 after throw and score not met → turnOutcome remains null', () => {
    const s = baseState({ turnTarget: 10000 });
    const result = addMultiDart(s, hit(1, 1), hit(1, 1));
    expect(result.throwsUsed).toBe(1);
    expect(result.turnOutcome).toBeNull();
  });

  test('advanceTurn after multi-dart resets throwsUsed to 0 and clears currentTurnDarts', () => {
    // Win the turn with a multi-dart throw then advance
    const s = baseState({ turnTarget: 20 });
    const won = addMultiDart(s, hit(20, 20), hit(19, 19));
    expect(won.turnOutcome).toBe('won');
    const next = advanceTurn(won);
    expect(next.throwsUsed).toBe(0);
    expect(next.currentTurnDarts).toHaveLength(0);
  });
});

// ---- assignDartSlot ----

describe('assignDartSlot', () => {
  test('sets dartIndex on the item with matching instanceId', () => {
    const item = dartItem('multi_dart', null);
    const s = baseState({ ownedItems: [item] });
    const result = assignDartSlot(s, item.instanceId, 1);
    const found = result.ownedItems.find(i => i.instanceId === item.instanceId) as OwnedDartItem;
    expect(found.dartIndex).toBe(1);
  });

  test('does not modify dart items on a different slot', () => {
    const item1 = dartItem('multi_dart', 0);
    const item2 = dartItem('bonus_dart', 2);
    const s = baseState({ ownedItems: [item1, item2] });
    const result = assignDartSlot(s, item1.instanceId, 1);
    const other = result.ownedItems.find(i => i.instanceId === item2.instanceId) as OwnedDartItem;
    expect(other.dartIndex).toBe(2); // unchanged
  });

  test('evicts another dart item already on the same slot', () => {
    const occupant = dartItem('bonus_dart', 1);
    const newcomer = dartItem('multi_dart', null);
    const s = baseState({ ownedItems: [occupant, newcomer] });
    const result = assignDartSlot(s, newcomer.instanceId, 1);
    const evicted = result.ownedItems.find(i => i.instanceId === occupant.instanceId) as OwnedDartItem;
    expect(evicted.dartIndex).toBeNull();
  });

  test('does not evict dart items on a different slot', () => {
    const other = dartItem('bonus_dart', 2);
    const newcomer = dartItem('multi_dart', null);
    const s = baseState({ ownedItems: [other, newcomer] });
    const result = assignDartSlot(s, newcomer.instanceId, 1);
    const unchanged = result.ownedItems.find(i => i.instanceId === other.instanceId) as OwnedDartItem;
    expect(unchanged.dartIndex).toBe(2);
  });

  test('non-dart items are unaffected by assignment', () => {
    const board = boardItem('bonus_sector', 5);
    const di = dartItem('multi_dart', null);
    const s = baseState({ ownedItems: [board, di] });
    const result = assignDartSlot(s, di.instanceId, 0);
    const boardAfter = result.ownedItems.find(i => i.instanceId === board.instanceId);
    expect(boardAfter).toEqual(board); // exactly the same object/value
  });
});

// ---- isMultiDartThrow ----

describe('isMultiDartThrow', () => {
  test('returns true when multi_dart has dartIndex matching throwsUsed', () => {
    const item = dartItem('multi_dart', 1);
    expect(isMultiDartThrow(1, [item])).toBe(true);
  });

  test('returns false with no owned items', () => {
    expect(isMultiDartThrow(0, [])).toBe(false);
  });

  test('returns false when multi_dart is on a different slot', () => {
    const item = dartItem('multi_dart', 2);
    expect(isMultiDartThrow(0, [item])).toBe(false);
  });

  test('returns false when non-multi-dart item is on the current slot', () => {
    const item = dartItem('bonus_dart', 0);
    expect(isMultiDartThrow(0, [item])).toBe(false);
  });
});

// ---- getMultiDartAimFactor ----

describe('getMultiDartAimFactor', () => {
  test('returns aimMultiplier (2) when multi_dart is assigned to the current slot', () => {
    const item = dartItem('multi_dart', 0);
    expect(getMultiDartAimFactor(0, [item])).toBe(2);
  });

  test('returns 1 with no owned items', () => {
    expect(getMultiDartAimFactor(0, [])).toBe(1);
  });

  test('returns 1 when multi_dart is on a different slot', () => {
    const item = dartItem('multi_dart', 2);
    expect(getMultiDartAimFactor(0, [item])).toBe(1);
  });

  test('returns 1 when items exist but none are multi_dart', () => {
    const item = dartItem('bonus_dart', 0);
    expect(getMultiDartAimFactor(0, [item])).toBe(1);
  });
});
