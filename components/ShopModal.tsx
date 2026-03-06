import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { PIXEL_FONT, pixelShadow, pixelShadowSm, COLORS } from '../lib/theme';
import { RoundsState, PACK_COSTS } from '../lib/gameLogic';
import { getItemDef, getAdjustedCost, ItemDef, Rarity } from '../lib/items';

interface Props {
  state: RoundsState;
  onBuyItem:    (defId: string) => void;
  onClaimPack:  (packType: 'decoration' | 'item', chosenDefId: string) => void;
  onBuyPowerup: () => void;
  onClose:      () => void;
}

const RARITY_COLORS: Record<Rarity, string> = {
  common:    COLORS.muted,
  uncommon:  COLORS.cyan,
  rare:      '#b48aff',
  legendary: COLORS.gold,
};

// ---- Pack choice overlay ----

type PackChoice = { packType: 'decoration' | 'item'; options: [string, string] };

function PackChoiceOverlay({
  choice,
  state,
  onPick,
  onCancel,
}: {
  choice: PackChoice;
  state: RoundsState;
  onPick: (defId: string) => void;
  onCancel: () => void;
}) {
  const cost = getAdjustedCost(PACK_COSTS[choice.packType], state.ownedItems);
  const canAfford = state.currency >= cost;

  return (
    <View style={overlay.bg}>
      <Text style={overlay.title}>
        {choice.packType === 'decoration' ? 'DECORATION PACK' : 'ITEM PACK'}
      </Text>
      <Text style={overlay.subtitle}>Choose one · ${cost}</Text>
      <View style={overlay.cards}>
        {choice.options.map(defId => {
          const def = getItemDef(defId)!;
          return (
            <TouchableOpacity
              key={defId}
              style={overlay.card}
              onPress={() => onPick(defId)}
              disabled={!canAfford}
            >
              <Text style={[overlay.rarity, { color: RARITY_COLORS[def.rarity] }]}>
                {def.rarity.toUpperCase()}
              </Text>
              <Text style={overlay.name}>{def.name}</Text>
              <Text style={overlay.desc}>{def.description}</Text>
              <View style={[overlay.pickBtn, !canAfford && overlay.pickBtnDisabled]}>
                <Text style={[overlay.pickBtnText, !canAfford && overlay.pickBtnTextDisabled]}>
                  PICK
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity style={overlay.cancelBtn} onPress={onCancel}>
        <Text style={overlay.cancelText}>CANCEL</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---- Main modal ----

export default function ShopModal({ state, onBuyItem, onClaimPack, onBuyPowerup, onClose }: Props) {
  const [packChoice, setPackChoice] = useState<PackChoice | null>(null);
  const { shopOffers, currency, ownedItems } = state;

  const handleClaimPack = (defId: string) => {
    if (!packChoice) return;
    onClaimPack(packChoice.packType, defId);
    setPackChoice(null);
  };

  if (packChoice) {
    return (
      <PackChoiceOverlay
        choice={packChoice}
        state={state}
        onPick={handleClaimPack}
        onCancel={() => setPackChoice(null)}
      />
    );
  }

  return (
    <View style={styles.bg}>
      <Text style={styles.title}>SHOP</Text>
      <Text style={styles.currency}>${currency}</Text>

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
            {shopOffers.item ? (
              <ItemCard
                defId={shopOffers.item}
                ownedItems={ownedItems}
                currency={currency}
                onBuy={() => onBuyItem(shopOffers.item!)}
              />
            ) : (
              <SoldOut />
            )}
          </View>

          {/* Packs column */}
          <View style={styles.column}>
            <Text style={styles.colHeader}>PACKS</Text>
            <PackCard
              label="Item Pack"
              description="Choose 1 of 2 board or dart items"
              packType="item"
              available={shopOffers.itemPack !== null}
              ownedItems={ownedItems}
              currency={currency}
              onOpen={() =>
                shopOffers.itemPack &&
                setPackChoice({ packType: 'item', options: shopOffers.itemPack })
              }
            />
            <PackCard
              label="Deco Pack"
              description="Choose 1 of 2 decorations"
              packType="decoration"
              available={shopOffers.decorationPack !== null}
              ownedItems={ownedItems}
              currency={currency}
              onOpen={() =>
                shopOffers.decorationPack &&
                setPackChoice({ packType: 'decoration', options: shopOffers.decorationPack })
              }
            />
          </View>
        </View>

        {/* PowerUp section */}
        <View style={styles.powerupSection}>
          <Text style={styles.powerupHeader}>POWERUP</Text>
          {shopOffers.powerup ? (
            <ItemCard
              defId={shopOffers.powerup}
              ownedItems={ownedItems}
              currency={currency}
              onBuy={onBuyPowerup}
              horizontal
            />
          ) : (
            <SoldOut label="SOLD OUT THIS ROUND" />
          )}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.continueBtn} onPress={onClose}>
        <Text style={styles.continueBtnText}>CONTINUE</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---- Item card ----

function ItemCard({
  defId,
  ownedItems,
  currency,
  onBuy,
  horizontal,
}: {
  defId: string;
  ownedItems: ReturnType<typeof getItemDef> extends ItemDef | undefined ? any : never;
  currency: number;
  onBuy: () => void;
  horizontal?: boolean;
}) {
  const def = getItemDef(defId);
  if (!def) return null;
  const cost       = getAdjustedCost(def.cost, ownedItems);
  const canAfford  = currency >= cost;

  return (
    <View style={[styles.card, horizontal && styles.cardHorizontal]}>
      <View style={styles.cardInfo}>
        <Text style={[styles.rarity, { color: RARITY_COLORS[def.rarity] }]}>
          {def.rarity.toUpperCase()}
        </Text>
        <Text style={styles.itemName}>{def.name}</Text>
        <Text style={styles.itemDesc}>{def.description}</Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.itemCost}>${cost}</Text>
        <TouchableOpacity
          style={[styles.buyBtn, !canAfford && styles.buyBtnDisabled]}
          onPress={onBuy}
          disabled={!canAfford}
        >
          <Text style={[styles.buyBtnText, !canAfford && styles.buyBtnTextDisabled]}>BUY</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---- Pack card ----

function PackCard({
  label,
  description,
  packType,
  available,
  ownedItems,
  currency,
  onOpen,
}: {
  label: string;
  description: string;
  packType: 'decoration' | 'item';
  available: boolean;
  ownedItems: any;
  currency: number;
  onOpen: () => void;
}) {
  const cost      = getAdjustedCost(PACK_COSTS[packType], ownedItems);
  const canAfford = currency >= cost && available;

  return (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        <Text style={styles.itemName}>{label}</Text>
        <Text style={styles.itemDesc}>{description}</Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.itemCost}>${cost}</Text>
        <TouchableOpacity
          style={[styles.buyBtn, !canAfford && styles.buyBtnDisabled]}
          onPress={onOpen}
          disabled={!canAfford}
        >
          <Text style={[styles.buyBtnText, !canAfford && styles.buyBtnTextDisabled]}>
            {available ? 'OPEN' : 'NONE'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---- Sold-out placeholder ----

function SoldOut({ label = 'SOLD OUT' }: { label?: string }) {
  return (
    <View style={[styles.card, styles.soldOut]}>
      <Text style={styles.soldOutText}>{label}</Text>
    </View>
  );
}

// ---- Styles ----

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
  scroll: { width: '100%' },
  scrollContent: { paddingHorizontal: 16, gap: 16, paddingBottom: 8 },

  columns: { flexDirection: 'row', gap: 10 },
  column:  { flex: 1, gap: 8 },
  colHeader: {
    fontFamily: PIXEL_FONT,
    color: COLORS.cyan,
    fontSize: 8,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 2,
  },

  powerupSection: { gap: 8 },
  powerupHeader: {
    fontFamily: PIXEL_FONT,
    color: COLORS.gold,
    fontSize: 8,
    letterSpacing: 2,
    textAlign: 'center',
  },

  card: {
    backgroundColor: COLORS.bgPanel,
    borderWidth: 2,
    borderColor: COLORS.bgCard,
    padding: 10,
    gap: 8,
    ...pixelShadowSm,
  },
  cardHorizontal: { flexDirection: 'row', alignItems: 'center' },
  cardInfo:  { flex: 1, gap: 3 },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  rarity: {
    fontFamily: PIXEL_FONT,
    fontSize: 5,
    letterSpacing: 1,
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
  buyBtnDisabled:     { backgroundColor: COLORS.bgCard, borderColor: COLORS.muted },
  buyBtnText:         { fontFamily: PIXEL_FONT, color: COLORS.bgDark, fontSize: 7, letterSpacing: 1 },
  buyBtnTextDisabled: { color: COLORS.muted },

  soldOut: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  soldOutText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 6,
    letterSpacing: 2,
  },

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

// ---- Pack choice overlay styles ----

const overlay = StyleSheet.create({
  bg: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(5, 15, 35, 0.98)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    fontFamily: PIXEL_FONT,
    color: COLORS.gold,
    fontSize: 14,
    letterSpacing: 4,
  },
  subtitle: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 7,
    letterSpacing: 2,
  },
  cards: { flexDirection: 'row', gap: 12, width: '100%' },
  card: {
    flex: 1,
    backgroundColor: COLORS.bgPanel,
    borderWidth: 2,
    borderColor: COLORS.bgCard,
    padding: 14,
    gap: 8,
    alignItems: 'center',
    ...pixelShadowSm,
  },
  rarity: {
    fontFamily: PIXEL_FONT,
    fontSize: 5,
    letterSpacing: 1,
  },
  name: {
    fontFamily: PIXEL_FONT,
    color: COLORS.bright,
    fontSize: 8,
    letterSpacing: 1,
    textAlign: 'center',
  },
  desc: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 5,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  pickBtn: {
    backgroundColor: COLORS.gold,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: COLORS.bright,
    marginTop: 4,
    ...pixelShadow,
  },
  pickBtnDisabled:     { backgroundColor: COLORS.bgCard, borderColor: COLORS.muted },
  pickBtnText:         { fontFamily: PIXEL_FONT, color: COLORS.bgDark, fontSize: 7, letterSpacing: 1 },
  pickBtnTextDisabled: { color: COLORS.muted },
  cancelBtn: { paddingVertical: 10 },
  cancelText: { fontFamily: PIXEL_FONT, color: COLORS.muted, fontSize: 7, letterSpacing: 2 },
});
