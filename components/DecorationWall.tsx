import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PIXEL_FONT, pixelShadowSm, COLORS } from '../lib/theme';
import { OwnedItem, OwnedDecorationItem, getItemDef, MAX_DECORATIONS } from '../lib/items';

interface Props {
  ownedItems: OwnedItem[];
  onSell: (instanceId: string) => void;
}

// ---- Shared ----

function Rope({ height = 8 }: { height?: number }) {
  return <View style={{ width: 2, height, backgroundColor: '#8B7355', alignSelf: 'center' }} />;
}

// ---- Empty slot nail ----

function Nail() {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={styles.nailHead} />
      <View style={styles.nailShaft} />
    </View>
  );
}

// ---- Cricket visual ----

function CricketVisual() {
  const green = '#2d6b1a';
  const lightGreen = '#3d8f25';
  const wingGreen = '#4aaf30';
  const ropeColor = '#8B7355';
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Rope height={5} />
      {/* Antennae */}
      <View style={{ flexDirection: 'row', gap: 5, marginBottom: -3 }}>
        <View style={{ width: 1.5, height: 8, backgroundColor: green, transform: [{ rotate: '-20deg' }] }} />
        <View style={{ width: 1.5, height: 8, backgroundColor: green, transform: [{ rotate: '20deg' }] }} />
      </View>
      {/* Head */}
      <View style={{ width: 10, height: 8, backgroundColor: lightGreen, borderRadius: 3 }} />
      {/* Wings + Body */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 9, height: 12, backgroundColor: wingGreen, borderRadius: 5, marginRight: -3 }} />
        <View style={{ width: 18, height: 13, backgroundColor: green, borderRadius: 5, alignItems: 'center', justifyContent: 'center' }}>
          {/* Rope tied around belly */}
          <View style={{ width: 18, height: 2, backgroundColor: ropeColor }} />
        </View>
        <View style={{ width: 9, height: 12, backgroundColor: wingGreen, borderRadius: 5, marginLeft: -3 }} />
      </View>
      {/* Legs */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: 34, marginTop: 2 }}>
        <View style={{ gap: 2, alignItems: 'flex-end' }}>
          <View style={{ width: 7, height: 2, backgroundColor: green, transform: [{ rotate: '-15deg' }] }} />
          <View style={{ width: 7, height: 2, backgroundColor: green }} />
          <View style={{ width: 7, height: 2, backgroundColor: green, transform: [{ rotate: '15deg' }] }} />
        </View>
        <View style={{ gap: 2, alignItems: 'flex-start' }}>
          <View style={{ width: 7, height: 2, backgroundColor: green, transform: [{ rotate: '15deg' }] }} />
          <View style={{ width: 7, height: 2, backgroundColor: green }} />
          <View style={{ width: 7, height: 2, backgroundColor: green, transform: [{ rotate: '-15deg' }] }} />
        </View>
      </View>
    </View>
  );
}

// ---- $Slots$ visual ----

// Pixel-art reel symbols built from View blocks
function PixelCherry() {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 3, marginBottom: 1 }}>
        <View style={{ width: 2, height: 4, backgroundColor: '#2d8a1a' }} />
        <View style={{ width: 2, height: 4, backgroundColor: '#2d8a1a' }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        <View style={{ width: 4, height: 4, backgroundColor: COLORS.red }} />
        <View style={{ width: 4, height: 4, backgroundColor: COLORS.red }} />
      </View>
    </View>
  );
}
function PixelSeven() {
  // "7" shape: top bar + diagonal + bottom stub
  return (
    <View style={{ gap: 1 }}>
      <View style={{ width: 8, height: 2, backgroundColor: COLORS.gold }} />
      <View style={{ width: 2, height: 2, backgroundColor: COLORS.gold, alignSelf: 'flex-end' }} />
      <View style={{ width: 2, height: 2, backgroundColor: COLORS.gold, alignSelf: 'flex-end', marginRight: 2 }} />
      <View style={{ width: 2, height: 2, backgroundColor: COLORS.gold, alignSelf: 'flex-start', marginLeft: 2 }} />
    </View>
  );
}
function PixelDiamond() {
  return (
    <View style={{ alignItems: 'center', gap: 0 }}>
      <View style={{ width: 4, height: 2, backgroundColor: COLORS.cyan }} />
      <View style={{ width: 8, height: 2, backgroundColor: COLORS.cyan }} />
      <View style={{ width: 4, height: 2, backgroundColor: COLORS.cyan }} />
      <View style={{ width: 2, height: 2, backgroundColor: COLORS.cyan }} />
    </View>
  );
}

function SlotsVisual() {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Rope height={5} />
      <View style={slotsStyles.machine}>
        {/* Display strip */}
        <View style={slotsStyles.display}>
          <Text style={slotsStyles.displayText}>$SLOTS$</Text>
        </View>
        {/* Reels */}
        <View style={slotsStyles.reelsRow}>
          <View style={slotsStyles.reel}><PixelCherry /></View>
          <View style={slotsStyles.reel}><PixelSeven /></View>
          <View style={slotsStyles.reel}><PixelDiamond /></View>
        </View>
        {/* Lever */}
        <View style={slotsStyles.leverRow}>
          <View style={slotsStyles.leverBar} />
          <View style={slotsStyles.leverKnob} />
        </View>
      </View>
    </View>
  );
}

const slotsStyles = StyleSheet.create({
  machine: {
    width: 46,
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: COLORS.gold,
    padding: 3,
    gap: 3,
    ...pixelShadowSm,
  },
  display: {
    backgroundColor: COLORS.bgDark,
    paddingVertical: 2,
    alignItems: 'center',
  },
  displayText: {
    fontFamily: PIXEL_FONT,
    fontSize: 4,
    color: COLORS.gold,
  },
  reelsRow: {
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'center',
  },
  reel: {
    width: 12,
    height: 14,
    backgroundColor: '#ddeeff',
    borderWidth: 1,
    borderColor: '#6688aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leverRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  leverBar: {
    width: 18,
    height: 4,
    backgroundColor: COLORS.red,
  },
  leverKnob: {
    width: 6,
    height: 6,
    backgroundColor: '#ff6644',
  },
});

// ---- Leftovers visual ----

// Pixel art circle plate: 10 rows × 4px = 40×40
// Each row: [offsetLeft, width]. Rim pixels drawn separately.
const PLATE_ROWS: [number, number][] = [
  [12, 16],
  [4,  32],
  [4,  32],
  [0,  40],
  [0,  40],
  [0,  40],
  [0,  40],
  [4,  32],
  [4,  32],
  [12, 16],
];
const PIXEL = 4;
const PLATE_COLOR = '#f0e8d8';
const RIM_COLOR   = '#c8b898';

function PixelPlate({ children }: { children?: React.ReactNode }) {
  return (
    <View style={{ width: 40, height: 40 }}>
      {PLATE_ROWS.map(([offset, width], row) => {
        const top = row * PIXEL;
        const isEdge = row === 0 || row === PLATE_ROWS.length - 1;
        if (isEdge) {
          return <View key={row} style={{ position: 'absolute', top, left: offset, width, height: PIXEL, backgroundColor: RIM_COLOR }} />;
        }
        return (
          <React.Fragment key={row}>
            <View style={{ position: 'absolute', top, left: offset,                     width: PIXEL,           height: PIXEL, backgroundColor: RIM_COLOR }} />
            <View style={{ position: 'absolute', top, left: offset + PIXEL,             width: width - PIXEL*2, height: PIXEL, backgroundColor: PLATE_COLOR }} />
            <View style={{ position: 'absolute', top, left: offset + width - PIXEL,     width: PIXEL,           height: PIXEL, backgroundColor: RIM_COLOR }} />
          </React.Fragment>
        );
      })}
      {children}
    </View>
  );
}

function PixelBroccoli({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 2 : 3;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 1 }}>
        <View style={{ width: s + 1, height: s, backgroundColor: '#3d8f25' }} />
        <View style={{ width: s + 1, height: s, backgroundColor: '#2d7a1a' }} />
      </View>
      <View style={{ width: s - 1, height: s, backgroundColor: '#2d6b1a' }} />
    </View>
  );
}

function LeftoversVisual() {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Rope height={5} />
      <PixelPlate>
        {/* Steak — L-shape */}
        <View style={{ position: 'absolute', left: 4, top: 6 }}>
          <View style={{ width: 14, height: 5, backgroundColor: '#8B4513' }} />
          <View style={{ width: 9,  height: 5, backgroundColor: '#8B4513' }} />
          <View style={{ position: 'absolute', left: 2, top: 1, width: 4, height: 2, backgroundColor: '#d4a574' }} />
          <View style={{ position: 'absolute', left: 7, top: 2, width: 3, height: 2, backgroundColor: '#c49060' }} />
        </View>
        {/* Broccoli */}
        <View style={{ position: 'absolute', right: 4, top: 4 }}>
          <PixelBroccoli size="md" />
        </View>
        <View style={{ position: 'absolute', right: 6, bottom: 5 }}>
          <PixelBroccoli size="sm" />
        </View>
      </PixelPlate>
    </View>
  );
}

// ---- Extra Extra visual ----

function ExtraExtraVisual() {
  return (
    <View style={{ flex: 1 }}>
      <Text style={paperStyles.headline}>EXTRA{'\n'}EXTRA!</Text>
      <View style={paperStyles.divider} />
      <View style={paperStyles.textLine} />
      <View style={paperStyles.textLine} />
      <View style={[paperStyles.textLine, { width: '60%' }]} />
      <View style={paperStyles.subDivider} />
      <Text style={paperStyles.subline}>READ ALL{'\n'}ABOUT IT!</Text>
      <View style={paperStyles.textLine} />
      <View style={[paperStyles.textLine, { width: '75%' }]} />
    </View>
  );
}

const paperStyles = StyleSheet.create({
  headline: {
    fontFamily: PIXEL_FONT,
    fontSize: 5,
    color: '#1a1a1a',
    textAlign: 'center',
    lineHeight: 8,
    marginBottom: 2,
  },
  divider: {
    height: 2,
    backgroundColor: '#1a1a1a',
    marginBottom: 2,
  },
  subDivider: {
    height: 1,
    backgroundColor: '#555',
    marginVertical: 2,
  },
  textLine: {
    height: 2,
    backgroundColor: '#555555',
    marginBottom: 2,
    borderRadius: 1,
    opacity: 0.7,
  },
  subline: {
    fontFamily: PIXEL_FONT,
    fontSize: 3,
    color: '#1a1a1a',
    textAlign: 'center',
    lineHeight: 6,
    marginBottom: 2,
  },
});

// ---- Decoration card ----

function DecoCard({ item, onTap }: { item: OwnedDecorationItem; onTap: () => void }) {
  const isNewspaper = item.defId === 'extra_extra';
  const isHanging = !isNewspaper;
  return (
    <TouchableOpacity
      onPress={onTap}
      activeOpacity={0.75}
      style={[styles.card, isNewspaper && styles.cardNewspaper, isHanging && styles.cardHanging]}
    >
      <View style={[styles.cardPin, isNewspaper && styles.cardPinNewspaper]} />
      {item.defId === 'cricket'     && <CricketVisual />}
      {item.defId === 'slots'       && <SlotsVisual />}
      {item.defId === 'leftovers'   && <LeftoversVisual />}
      {item.defId === 'extra_extra' && <ExtraExtraVisual />}
    </TouchableOpacity>
  );
}

// ---- Main component ----

export default function DecorationWall({ ownedItems, onSell }: Props) {
  const [pendingSell, setPendingSell] = useState<string | null>(null);

  const decorations = ownedItems
    .filter(item => getItemDef(item.defId)?.category === 'decoration')
    .slice(0, MAX_DECORATIONS) as OwnedDecorationItem[];

  const slots = Array.from({ length: MAX_DECORATIONS }, (_, i) => decorations[i] ?? null);

  return (
    <View style={styles.wall}>
      {slots.map((item, i) => (
        <View key={i} style={styles.slot}>
          {item ? (
            <DecoCard item={item} onTap={() => setPendingSell(item.instanceId)} />
          ) : (
            <Nail />
          )}
        </View>
      ))}

      {pendingSell && (() => {
        const item = ownedItems.find(i => i.instanceId === pendingSell);
        if (!item) return null;
        const def = getItemDef(item.defId);
        if (!def) return null;
        const refund = Math.floor(def.cost * 0.75);
        return (
          <View style={styles.sellOverlay}>
            <Text style={styles.sellPrompt}>SELL FOR ${refund}?</Text>
            <View style={styles.sellButtons}>
              <TouchableOpacity
                style={styles.sellConfirm}
                onPress={() => { onSell(pendingSell); setPendingSell(null); }}
              >
                <Text style={styles.sellBtnText}>YES</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sellCancel}
                onPress={() => setPendingSell(null)}
              >
                <Text style={styles.sellBtnText}>NO</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  wall: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
    paddingTop: 0,
  },
  slot: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  // Nail (empty slot)
  nailHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4a3f2f',
    borderWidth: 1,
    borderColor: '#6b5a44',
    ...pixelShadowSm,
  },
  nailShaft: {
    width: 3,
    height: 14,
    backgroundColor: '#3d3428',
    marginTop: 1,
  },
  // Decoration card
  card: {
    width: 58,
    height: 58,
    backgroundColor: COLORS.bgCard,
    borderWidth: 2,
    borderColor: COLORS.muted,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 3,
    paddingTop: 4,
    overflow: 'hidden',
    ...pixelShadowSm,
  },
  cardNewspaper: {
    backgroundColor: '#f0e8c8',
    borderWidth: 3,
    borderColor: '#1a1a1a',
  },
  cardHanging: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  cardPin: {
    position: 'absolute',
    top: -5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6b5a44',
    borderWidth: 1,
    borderColor: '#8a7060',
  },
  cardPinNewspaper: {
    backgroundColor: '#4a3f2f',
    borderColor: '#6b5a44',
  },
  // Sell overlay
  sellOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,22,40,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  sellPrompt: {
    fontFamily: PIXEL_FONT,
    color: COLORS.gold,
    fontSize: 7,
    letterSpacing: 1,
  },
  sellButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  sellConfirm: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 2,
    borderColor: '#ff4400',
    ...pixelShadowSm,
  },
  sellCancel: {
    backgroundColor: COLORS.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 2,
    borderColor: COLORS.muted,
    ...pixelShadowSm,
  },
  sellBtnText: {
    fontFamily: PIXEL_FONT,
    fontSize: 7,
    color: COLORS.bright,
  },
});
