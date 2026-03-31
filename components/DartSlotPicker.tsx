import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getItemDef } from '../lib/items';
import type { OwnedItem, OwnedDartItem } from '../lib/items';
import { PIXEL_FONT, COLORS, pixelShadow, pixelShadowSm } from '../lib/theme';

interface Props {
  itemName: string;
  itemDescription: string;
  ownedItems: OwnedItem[];
  onConfirm: (dartIndex: number) => void;
  onSkip: () => void;
}

function getSlotOccupant(slotIndex: number, ownedItems: OwnedItem[]): string | null {
  for (const item of ownedItems) {
    const di = item as OwnedDartItem;
    if (di.dartIndex === slotIndex) {
      const def = getItemDef(item.defId);
      if (def?.category === 'dart') return def.name;
    }
  }
  return null;
}

export default function DartSlotPicker({ itemName, itemDescription, ownedItems, onConfirm, onSkip }: Props) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  return (
    <View style={styles.bg}>
      <Text style={styles.title}>ASSIGN TO DART</Text>
      <Text style={styles.itemName}>{itemName}</Text>
      <Text style={styles.itemDesc}>{itemDescription}</Text>

      <View style={styles.slotsRow}>
        {[0, 1, 2].map(i => {
          const occupant = getSlotOccupant(i, ownedItems);
          const isSelected = selectedSlot === i;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.slotBtn, isSelected && styles.slotBtnSelected]}
              onPress={() => setSelectedSlot(i)}
            >
              <Text style={[styles.slotLabel, isSelected && styles.slotLabelSelected]}>
                DART {i + 1}
              </Text>
              {occupant ? (
                <Text style={styles.slotOccupant}>{occupant}</Text>
              ) : (
                <Text style={styles.slotEmpty}>empty</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedSlot !== null ? (
        <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm(selectedSlot)}>
          <Text style={styles.confirmBtnText}>CONFIRM</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.hintText}>TAP A SLOT TO SELECT</Text>
      )}

      <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
        <Text style={styles.skipText}>ASSIGN LATER</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(5, 15, 35, 0.98)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 16,
  },
  title: {
    fontFamily: PIXEL_FONT,
    color: COLORS.gold,
    fontSize: 14,
    letterSpacing: 4,
  },
  itemName: {
    fontFamily: PIXEL_FONT,
    color: COLORS.bright,
    fontSize: 9,
    letterSpacing: 1,
  },
  itemDesc: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 5,
    letterSpacing: 0.5,
    textAlign: 'center',
    maxWidth: 260,
  },
  slotsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  slotBtn: {
    width: 90,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: COLORS.bgCard,
    backgroundColor: COLORS.bgPanel,
    ...pixelShadowSm,
  },
  slotBtnSelected: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.bgCard,
  },
  slotLabel: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 7,
    letterSpacing: 1,
  },
  slotLabelSelected: {
    color: COLORS.gold,
  },
  slotOccupant: {
    fontFamily: PIXEL_FONT,
    color: COLORS.cyan,
    fontSize: 5,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  slotEmpty: {
    fontFamily: PIXEL_FONT,
    color: COLORS.bgCard,
    fontSize: 5,
    letterSpacing: 0.5,
  },
  hintText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 6,
    letterSpacing: 2,
  },
  confirmBtn: {
    backgroundColor: COLORS.gold,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderWidth: 2,
    borderColor: COLORS.bright,
    ...pixelShadow,
  },
  confirmBtnText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.bgDark,
    fontSize: 8,
    letterSpacing: 1,
  },
  skipBtn: { paddingVertical: 8 },
  skipText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 6,
    letterSpacing: 1,
  },
});
