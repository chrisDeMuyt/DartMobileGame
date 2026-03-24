import {
  getItemDef,
  prerequisiteMet,
  canPurchase,
  getAdjustedCost,
  createOwnedItem,
  OwnedBoardItem,
  OwnedDartItem,
  OwnedPowerupItem,
  OwnedDecorationItem,
  ITEMS,
} from '../items';

// ---- getItemDef ----

describe('getItemDef', () => {
  test('known id returns the definition', () => {
    const def = getItemDef('bonus_sector');
    expect(def).toBeDefined();
    expect(def!.id).toBe('bonus_sector');
  });

  test('unknown id returns undefined', () => {
    expect(getItemDef('fake_item')).toBeUndefined();
  });
});

// ---- prerequisiteMet ----

describe('prerequisiteMet', () => {
  test('item with no requires — always true', () => {
    expect(prerequisiteMet('sharpshooter', [])).toBe(true);
    expect(prerequisiteMet('sharpshooter', ['bonus_sector'])).toBe(true);
  });

  test('sharpshooter_plus: owned has sharpshooter → true', () => {
    expect(prerequisiteMet('sharpshooter_plus', ['sharpshooter'])).toBe(true);
  });

  test('sharpshooter_plus: owned empty → false', () => {
    expect(prerequisiteMet('sharpshooter_plus', [])).toBe(false);
  });

  test('unknown defId → false', () => {
    expect(prerequisiteMet('fake_item', [])).toBe(false);
    expect(prerequisiteMet('fake_item', ['sharpshooter'])).toBe(false);
  });
});

// ---- canPurchase ----

describe('canPurchase', () => {
  test('unknown id → false', () => {
    expect(canPurchase('fake_item', [])).toBe(false);
  });

  test('sharpshooter, not owned, turn 0 → true', () => {
    expect(canPurchase('sharpshooter', [], 0)).toBe(true);
  });

  test('sharpshooter already owned (maxOwned=1) → false', () => {
    expect(canPurchase('sharpshooter', ['sharpshooter'], 0)).toBe(false);
  });

  test('sharpshooter_plus: prereq met, globalTurn=3 → true', () => {
    expect(canPurchase('sharpshooter_plus', ['sharpshooter'], 3)).toBe(true);
  });

  test('sharpshooter_plus: globalTurn=2 (below minGlobalTurn=3) → false', () => {
    expect(canPurchase('sharpshooter_plus', ['sharpshooter'], 2)).toBe(false);
  });

  test('sharpshooter_plus: prereq not met, globalTurn=3 → false', () => {
    expect(canPurchase('sharpshooter_plus', [], 3)).toBe(false);
  });

  test('bonus_sector (no maxOwned): owned twice → still true (unlimited)', () => {
    expect(canPurchase('bonus_sector', ['bonus_sector', 'bonus_sector'])).toBe(true);
  });

  test('sale already owned (maxOwned=1) → false', () => {
    expect(canPurchase('sale', ['sale'])).toBe(false);
  });
});

// ---- getAdjustedCost ----

describe('getAdjustedCost', () => {
  test('no owned items — baseCost returned unchanged', () => {
    expect(getAdjustedCost(10, [])).toBe(10);
  });

  test('sale owned (factor=0.75) — cost floored', () => {
    const sale = createOwnedItem('sale');
    expect(getAdjustedCost(10, [sale])).toBe(7); // floor(10 * 0.75)
  });

  test('sale + sale_plus owned (0.75×0.75) — stacks multiplicatively', () => {
    const sale = createOwnedItem('sale');
    const salePlus = createOwnedItem('sale_plus');
    expect(getAdjustedCost(10, [sale, salePlus])).toBe(5); // floor(10 * 0.5625)
  });

  test('minimum clamp: sale owned, baseCost=1 → never below 1', () => {
    const sale = createOwnedItem('sale');
    expect(getAdjustedCost(1, [sale])).toBe(1); // max(1, floor(0.75)) = max(1, 0) = 1
  });

  test('non-powerup items do not affect cost', () => {
    const board = createOwnedItem('bonus_sector');
    expect(getAdjustedCost(10, [board])).toBe(10);
  });
});

// ---- createOwnedItem ----

describe('createOwnedItem', () => {
  test('board item has sector=null and shattered=false', () => {
    const item = createOwnedItem('bonus_sector') as OwnedBoardItem;
    expect(item.sector).toBeNull();
    expect(item.shattered).toBe(false);
    expect(item.defId).toBe('bonus_sector');
    expect(item.instanceId).toContain('bonus_sector');
  });

  test('dart item has dartIndex=null', () => {
    const item = createOwnedItem('multi_dart') as OwnedDartItem;
    expect(item.dartIndex).toBeNull();
    expect(item.defId).toBe('multi_dart');
  });

  test('powerup item has only instanceId and defId', () => {
    const item = createOwnedItem('sharpshooter') as OwnedPowerupItem;
    expect(item.defId).toBe('sharpshooter');
    expect(item.instanceId).toBeDefined();
    expect((item as any).sector).toBeUndefined();
    expect((item as any).dartIndex).toBeUndefined();
  });

  test('decoration item has only instanceId and defId', () => {
    const item = createOwnedItem('cricket') as OwnedDecorationItem;
    expect(item.defId).toBe('cricket');
    expect(item.instanceId).toBeDefined();
    expect((item as any).sector).toBeUndefined();
  });

  test('unknown defId throws Error', () => {
    expect(() => createOwnedItem('fake_item')).toThrow(Error);
  });

  test('each call produces a unique instanceId', () => {
    const a = createOwnedItem('bonus_sector');
    const b = createOwnedItem('bonus_sector');
    expect(a.instanceId).not.toBe(b.instanceId);
  });
});

// ---- ITEMS catalogue sanity ----

describe('ITEMS catalogue', () => {
  test('all item ids are unique', () => {
    const ids = ITEMS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every item has a non-empty name and description', () => {
    for (const item of ITEMS) {
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
    }
  });
});
