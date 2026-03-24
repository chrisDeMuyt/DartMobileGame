import { DartHit } from '../dartboard';
import { OwnedBoardItem, createOwnedItem } from '../items';
import {
  RoundsState,
  computeTarget,
  initGameState,
  addDart,
  advanceTurn,
  buyItem,
  claimPackItem,
  buyPowerup,
  assignBoardSector,
} from '../gameLogic';

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

// ---- Scenario 1: Full losing turn (3 misses) ----

describe('Scenario 1: full losing turn', () => {
  let state: RoundsState;
  beforeEach(() => {
    state = baseState({ currency: 0 });
    state = addDart(state, miss());
    state = addDart(state, miss());
    state = addDart(state, miss());
  });

  test('turnOutcome is lost', () => expect(state.turnOutcome).toBe('lost'));
  test('currency unchanged', () => expect(state.currency).toBe(0));
  test('turnScore is 0', () => expect(state.turnScore).toBe(0));
  test('3 darts recorded', () => expect(state.currentTurnDarts).toHaveLength(3));
});

// ---- Scenario 2: Win on last dart ----

describe('Scenario 2: win on last dart', () => {
  let state: RoundsState;
  beforeEach(() => {
    state = baseState({ currency: 0, turnTarget: 20 });
    state = addDart(state, miss());
    state = addDart(state, miss());
    state = addDart(state, hit(20, 20));
  });

  test('turnOutcome is won', () => expect(state.turnOutcome).toBe('won'));
  test('turnScore is 20', () => expect(state.turnScore).toBe(20));
  test('mult is 1', () => expect(state.mult).toBe(1));
  test('currency increased by 5 (TURN_REWARDS[0])', () => expect(state.currency).toBe(5));
});

// ---- Scenario 3: Early win on first dart ----

describe('Scenario 3: early win on first dart', () => {
  test('turnOutcome is won after 1 dart', () => {
    let state = baseState({ turnTarget: 1 });
    state = addDart(state, hit(1, 1));
    expect(state.turnOutcome).toBe('won');
    expect(state.currentTurnDarts).toHaveLength(1);
  });
});

// ---- Scenario 4: Win then advance — state resets ----

describe('Scenario 4: win then advance resets state', () => {
  let state: RoundsState;
  beforeEach(() => {
    state = baseState({ turnTarget: 1 });
    state = addDart(state, hit(1, 1));   // win
    state = advanceTurn(state);
  });

  test('turnIndex advances to 1', () => expect(state.turnIndex).toBe(1));
  test('globalTurnIndex is 1', () => expect(state.globalTurnIndex).toBe(1));
  test('turnScore reset to 0', () => expect(state.turnScore).toBe(0));
  test('mult reset to 0', () => expect(state.mult).toBe(0));
  test('currentTurnDarts is empty', () => expect(state.currentTurnDarts).toHaveLength(0));
  test('turnOutcome is null', () => expect(state.turnOutcome).toBeNull());
  test('turnTarget = computeTarget(1) = 40', () => expect(state.turnTarget).toBe(computeTarget(1)));
});

// ---- Scenario 5: Complete full round — roundIndex increments ----

describe('Scenario 5: complete full round', () => {
  let state: RoundsState;
  beforeEach(() => {
    // Turn 0: target=20, win with hit(20,20)
    state = baseState();
    state = addDart(state, hit(20, 20));
    state = advanceTurn(state);

    // Turn 1: target=40, win with D20 (score=40, mult=1)
    state = addDart(state, hit(20, 40, 2));
    state = advanceTurn(state);

    // Turn 2: target=80, win with two T20s (score=120, mult=4, 480≥80)
    state = addDart(state, hit(20, 60, 3));
    state = addDart(state, hit(20, 60, 3));
    state = advanceTurn(state);
  });

  test('turnIndex wraps back to 0', () => expect(state.turnIndex).toBe(0));
  test('roundIndex increments to 1', () => expect(state.roundIndex).toBe(1));
  test('globalTurnIndex is 3', () => expect(state.globalTurnIndex).toBe(3));
  test('turnTarget = computeTarget(3) = 100', () => expect(state.turnTarget).toBe(computeTarget(3)));
});

// ---- Scenario 6: Currency accumulates across won turns ----

describe('Scenario 6: currency accumulates across turns', () => {
  test('win turn 0 (+5) then win turn 1 (+10) → currency=15', () => {
    let state = baseState({ currency: 0 });

    // Turn 0: win with hit(20,20) → +5
    state = addDart(state, hit(20, 20));
    expect(state.currency).toBe(5);
    state = advanceTurn(state);

    // Turn 1: target=40, win with D20 → +10
    state = addDart(state, hit(20, 40, 2));
    expect(state.currency).toBe(15);
    state = advanceTurn(state);

    expect(state.currency).toBe(15);
  });
});

// ---- Scenario 7: Sector replacement — one item per sector enforced ----

describe('Scenario 7: sector replacement enforced end-to-end', () => {
  test('assigning diamond_sector to occupied sector evicts bonus_sector; only diamond effect fires', () => {
    let state = baseState({
      currency: 50,
      shopOffers: {
        item: 'bonus_sector',
        decorationPack: null,
        itemPack: ['diamond_sector', 'mult_sector'],
        powerup: null,
      },
      turnTarget: 999,
    });

    // Buy bonus_sector and assign to sector 20
    state = buyItem(state, 'bonus_sector');
    const bonusInstanceId = state.ownedItems[0].instanceId;
    state = assignBoardSector(state, bonusInstanceId, 20);
    expect((state.ownedItems[0] as OwnedBoardItem).sector).toBe(20);

    // Claim diamond_sector from pack and assign to sector 20 (same sector)
    state = claimPackItem(state, 'item', 'diamond_sector');
    const diamondInstanceId = state.ownedItems[1].instanceId;
    state = assignBoardSector(state, diamondInstanceId, 20);

    // bonus_sector should be evicted (sector → null), diamond_sector on 20
    expect((state.ownedItems[0] as OwnedBoardItem).sector).toBeNull();
    expect((state.ownedItems[1] as OwnedBoardItem).sector).toBe(20);

    // Hit sector 20: diamond doubles mult (×2), no bonus_sector +25
    state = addDart(state, hit(20, 20));
    expect(state.turnScore).toBe(20);  // no +25 bonus
    expect(state.mult).toBe(2);        // diamond_sector ×2 applied
  });
});

// ---- Scenario 8: Buy sale powerup, then item at reduced cost ----

describe('Scenario 8: sale powerup reduces item cost', () => {
  test('sale (cost=15) reduces bonus_sector cost from 10 to 7', () => {
    let state = baseState({
      currency: 50,
      shopOffers: {
        item: 'bonus_sector',
        decorationPack: null,
        itemPack: null,
        powerup: 'sale',
      },
    });

    state = buyPowerup(state);
    expect(state.currency).toBe(35); // 50 - 15

    state = buyItem(state, 'bonus_sector');
    expect(state.currency).toBe(28); // 35 - 7 (floor(10 * 0.75))
  });
});

// ---- Scenario 9: Diamond sector doubles mult → score over target ----

describe('Scenario 9: diamond_sector doubles mult', () => {
  test('one hit on diamond segment: score=20, mult=2, wins target=40', () => {
    const diamond = boardItem('diamond_sector', 20);
    let state = baseState({
      ownedItems: [diamond],
      turnTarget: 40,
    });
    state = addDart(state, hit(20, 20));

    expect(state.turnScore).toBe(20);
    expect(state.mult).toBe(2);
    expect(state.turnOutcome).toBe('won');
  });
});

// ---- Scenario 10: Combo mult + diamond sector stacks correctly ----

describe('Scenario 10: combo mult + diamond sector order-of-operations', () => {
  test('three T20 darts with diamond on seg 20 → mult=120, turnScore=60', () => {
    const diamond = boardItem('diamond_sector', 20);
    let state = baseState({
      ownedItems: [diamond],
      turnTarget: 9999,
    });

    state = addDart(state, hit(20, 20));
    expect(state.mult).toBe(2); // pass1: 1; pass2: 1*2=2

    state = addDart(state, hit(20, 20));
    expect(state.mult).toBe(16); // pass1: (1+1)*2=4; pass2: 4*2*2=16

    state = addDart(state, hit(20, 20));
    expect(state.mult).toBe(120); // pass1: (4+1)*3=15; pass2: 15*2*2*2=120

    expect(state.turnScore).toBe(60);
    expect(state.turnOutcome).toBe('lost'); // 60*120=7200 < 9999
  });
});

// ---- Scenario 11: Powerup slot resets at round boundary ----

describe('Scenario 11: powerup slot resets at round boundary', () => {
  test('after 3 won turns (full round), sold-out powerup is re-rolled', () => {
    // Start with powerup sold out (null)
    let state = baseState({
      shopOffers: {
        item: null,
        decorationPack: null,
        itemPack: null,
        powerup: null,
      },
    });

    // Win turn 0
    state = addDart(state, hit(20, 20));
    state = advanceTurn(state);
    expect(state.shopOffers.powerup).toBeNull(); // not a round boundary

    // Win turn 1
    state = addDart(state, hit(20, 40, 2));
    state = advanceTurn(state);
    expect(state.shopOffers.powerup).toBeNull(); // not a round boundary

    // Win turn 2 (need target=80: two T20s gives score=120, mult=4, 480≥80)
    state = addDart(state, hit(20, 60, 3));
    state = addDart(state, hit(20, 60, 3));
    state = advanceTurn(state);

    // Round boundary: powerup should be re-rolled (non-null since eligible pool is non-empty)
    expect(state.shopOffers.powerup).not.toBeNull();
  });
});

// ---- Scenario 12: claimPackItem → item immediately usable ----

describe('Scenario 12: claimPackItem item is immediately usable', () => {
  test('claimed bonus_sector can be assigned and triggers bonus on hit', () => {
    let state = baseState({
      currency: 50,
      shopOffers: {
        item: null,
        decorationPack: null,
        itemPack: ['bonus_sector', 'mult_sector'],
        powerup: null,
      },
    });

    state = claimPackItem(state, 'item', 'bonus_sector');
    expect(state.ownedItems).toHaveLength(1);

    const instanceId = state.ownedItems[0].instanceId;
    state = assignBoardSector(state, instanceId, 20);
    state = addDart(state, hit(20, 20));

    expect(state.turnScore).toBe(45); // 20 + 25 bonus
  });
});
