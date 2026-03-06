export type ShopCategory = 'item' | 'pack' | 'powerup';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  maxOwned: number;
  category: ShopCategory;
}

export const SHOP_ITEMS: ShopItem[] = [
  // Items (left column)
  {
    id: 'steady_hand',
    name: 'STEADY HAND',
    description: 'Reduces aim spread by 15%',
    cost: 8,
    maxOwned: 3,
    category: 'item',
  },
  {
    id: 'piggy_bank',
    name: 'PIGGY BANK',
    description: '+$5 reward per turn won',
    cost: 15,
    maxOwned: 3,
    category: 'item',
  },

  // Packs (right column)
  {
    id: 'hot_streak',
    name: 'HOT STREAK',
    description: 'Start next turn with MULT +2',
    cost: 12,
    maxOwned: 5,
    category: 'pack',
  },
  {
    id: 'score_pack',
    name: 'SCORE PACK',
    description: 'Gain $25 instantly',
    cost: 20,
    maxOwned: 99,
    category: 'pack',
  },

  // PowerUp (bottom section)
  {
    id: 'double_down',
    name: 'DOUBLE DOWN',
    description: 'Double your current SCORE this turn',
    cost: 30,
    maxOwned: 1,
    category: 'powerup',
  },
];
