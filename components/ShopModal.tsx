import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { PIXEL_FONT, pixelShadow, pixelShadowSm, COLORS } from '../lib/theme';
import { SHOP_ITEMS, ShopItem } from '../lib/shopItems';
import { RoundsState } from '../lib/gameLogic';

interface Props {
  state: RoundsState;
  onBuy: (itemId: string) => void;
  onClose: () => void;
}

export default function ShopModal({ state, onBuy, onClose }: Props) {
  const items   = SHOP_ITEMS.filter(i => i.category === 'item');
  const packs   = SHOP_ITEMS.filter(i => i.category === 'pack');
  const powerup = SHOP_ITEMS.find(i => i.category === 'powerup')!;

  return (
    <View style={styles.bg}>
      <Text style={styles.title}>SHOP</Text>
      <Text style={styles.currency}>${state.currency}</Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Two columns */}
        <View style={styles.columns}>
          {/* Items column */}
          <View style={styles.column}>
            <Text style={styles.colHeader}>ITEMS</Text>
            {items.map(item => (
              <ShopCard key={item.id} item={item} state={state} onBuy={onBuy} />
            ))}
          </View>

          {/* Packs column */}
          <View style={styles.column}>
            <Text style={styles.colHeader}>PACKS</Text>
            {packs.map(item => (
              <ShopCard key={item.id} item={item} state={state} onBuy={onBuy} />
            ))}
          </View>
        </View>

        {/* PowerUp section */}
        <View style={styles.powerupSection}>
          <Text style={styles.powerupHeader}>POWERUP</Text>
          <ShopCard item={powerup} state={state} onBuy={onBuy} horizontal />
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.continueBtn} onPress={onClose}>
        <Text style={styles.continueBtnText}>CONTINUE</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---- Shared card component ----

function ShopCard({
  item,
  state,
  onBuy,
  horizontal,
}: {
  item: ShopItem;
  state: RoundsState;
  onBuy: (id: string) => void;
  horizontal?: boolean;
}) {
  const owned = state.upgrades[item.id] ?? 0;
  const canAfford = state.currency >= item.cost;
  const maxed = owned >= item.maxOwned;

  return (
    <View style={[styles.card, horizontal && styles.cardHorizontal]}>
      <View style={styles.cardInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemDesc}>{item.description}</Text>
        {item.maxOwned < 99 && (
          <Text style={styles.itemOwned}>OWNED: {owned}/{item.maxOwned}</Text>
        )}
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.itemCost}>${item.cost}</Text>
        <TouchableOpacity
          style={[styles.buyBtn, (!canAfford || maxed) && styles.buyBtnDisabled]}
          onPress={() => onBuy(item.id)}
          disabled={!canAfford || maxed}
        >
          <Text style={[styles.buyBtnText, (!canAfford || maxed) && styles.buyBtnTextDisabled]}>
            {maxed ? 'MAX' : 'BUY'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(5, 15, 35, 0.97)',
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
  },
  title: {
    fontFamily: PIXEL_FONT,
    color: COLORS.gold,
    fontSize: 20,
    letterSpacing: 6,
    textShadowColor: COLORS.gold,
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
  },
  currency: {
    fontFamily: PIXEL_FONT,
    color: COLORS.gold,
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 6,
    marginBottom: 12,
  },
  scroll: {
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 8,
  },

  // Two columns
  columns: {
    flexDirection: 'row',
    gap: 10,
  },
  column: {
    flex: 1,
    gap: 8,
  },
  colHeader: {
    fontFamily: PIXEL_FONT,
    color: COLORS.cyan,
    fontSize: 8,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 2,
  },

  // PowerUp section
  powerupSection: {
    gap: 8,
  },
  powerupHeader: {
    fontFamily: PIXEL_FONT,
    color: COLORS.gold,
    fontSize: 8,
    letterSpacing: 2,
    textAlign: 'center',
  },

  // Card
  card: {
    flexDirection: 'column',
    backgroundColor: COLORS.bgPanel,
    borderWidth: 2,
    borderColor: COLORS.bgCard,
    padding: 10,
    gap: 8,
    ...pixelShadowSm,
  },
  cardHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  itemName: {
    fontFamily: PIXEL_FONT,
    color: COLORS.bright,
    fontSize: 7,
    letterSpacing: 1,
  },
  itemDesc: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 5,
    letterSpacing: 0.5,
  },
  itemOwned: {
    fontFamily: PIXEL_FONT,
    color: COLORS.cyan,
    fontSize: 5,
    letterSpacing: 1,
    marginTop: 2,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemCost: {
    fontFamily: PIXEL_FONT,
    color: COLORS.gold,
    fontSize: 9,
    letterSpacing: 1,
  },
  buyBtn: {
    backgroundColor: COLORS.gold,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: COLORS.bright,
    ...pixelShadow,
  },
  buyBtnDisabled: {
    backgroundColor: COLORS.bgCard,
    borderColor: COLORS.muted,
  },
  buyBtnText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.bgDark,
    fontSize: 7,
    letterSpacing: 1,
  },
  buyBtnTextDisabled: {
    color: COLORS.muted,
  },

  // Continue
  continueBtn: {
    marginTop: 12,
    borderWidth: 2,
    borderColor: COLORS.cyan,
    paddingVertical: 12,
    paddingHorizontal: 36,
    ...pixelShadow,
  },
  continueBtnText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.cyan,
    fontSize: 9,
    letterSpacing: 3,
  },
});
