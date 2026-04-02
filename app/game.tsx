import React, { useReducer, useCallback, useState, useRef, useEffect, Suspense, lazy, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Vibration,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import type { DartMarker, BoardEffectMarker } from '../components/Dartboard';
// Lazy imports so @shopify/react-native-skia (and Skia.web.js) is only evaluated
// after global.CanvasKit is set (guarded by skiaReady in _layout.tsx).
const Dartboard = lazy(() => import('../components/Dartboard'));
const FlyingDartOverlay = lazy(() => import('../components/FlyingDartOverlay'));
const Slingshot = lazy(() => import('../components/Slingshot'));
const BoardSectorPicker = lazy(() => import('../components/BoardSectorPicker'));
const ShatterOverlay = lazy(() => import('../components/ShatterOverlay'));
import Scoreboard from '../components/Scoreboard';
import ShopModal from '../components/ShopModal';
import { getDartScore, DartHit, RING_RADII } from '../lib/dartboard';
import {
  RoundsState,
  Player,
  initGameState,
  addDart,
  addMultiDart,
  advanceTurn,
  buyItem,
  claimPackItem,
  buyPowerup,
  assignBoardSector,
  assignDartSlot,
  getAimFactor,
  isMultiDartThrow,
  getMultiDartAimFactor,
  isBullseyeDartThrow,
} from '../lib/gameLogic';
import { getItemDef } from '../lib/items';
import type { OwnedBoardItem, OwnedDartItem } from '../lib/items';
import DartSlotPicker from '../components/DartSlotPicker';
import { PIXEL_FONT, pixelShadow, pixelShadowSm, COLORS } from '../lib/theme';

// ---- Reducer ----

type Action =
  | { type: 'THROW'; dart: DartHit }
  | { type: 'MULTI_THROW'; darts: [DartHit, DartHit] }
  | { type: 'ADVANCE_TURN' }
  | { type: 'BUY_ITEM'; defId: string }
  | { type: 'CLAIM_PACK'; packType: 'decoration' | 'item'; chosenDefId: string }
  | { type: 'BUY_POWERUP' }
  | { type: 'ASSIGN_BOARD_SECTOR'; instanceId: string; sector: number }
  | { type: 'ASSIGN_DART_SLOT'; instanceId: string; dartIndex: number }
  | { type: 'RESTART' };

function gameReducer(state: RoundsState, action: Action): RoundsState {
  switch (action.type) {
    case 'THROW':
      if (state.turnOutcome !== null) return state;
      return addDart(state, action.dart);
    case 'ADVANCE_TURN':
      return advanceTurn(state);
    case 'BUY_ITEM':
      return buyItem(state, action.defId);
    case 'CLAIM_PACK':
      return claimPackItem(state, action.packType, action.chosenDefId);
    case 'BUY_POWERUP':
      return buyPowerup(state);
    case 'MULTI_THROW':
      if (state.turnOutcome !== null) return state;
      return addMultiDart(state, action.darts[0], action.darts[1]);
    case 'ASSIGN_BOARD_SECTOR':
      return assignBoardSector(state, action.instanceId, action.sector);
    case 'ASSIGN_DART_SLOT':
      return assignDartSlot(state, action.instanceId, action.dartIndex);
    case 'RESTART':
      return initGameState(state.player);
    default:
      return state;
  }
}

// ---- Helpers ----

function getDartColor(throwIndex: number): string {
  return ['#f5c518', '#e0b010', '#c89c00'][throwIndex % 3];
}

// ---- Throw slot indicator ----

const SLOT_BOX = 14;
const SLOT_DIAG = Math.ceil(Math.sqrt(2) * SLOT_BOX * 1.1); // wide enough to span corner-to-corner

function ThrowSlot({ used, isMulti }: { used: boolean; isMulti: boolean }) {
  const boxes = isMulti ? 2 : 1;
  return (
    <View style={slotStyles.column}>
      {Array.from({ length: boxes }).map((_, i) => (
        <View key={i} style={[slotStyles.box, used && slotStyles.boxUsed]}>
          {used && (
            <>
              <View style={slotStyles.xLine1} />
              <View style={slotStyles.xLine2} />
            </>
          )}
        </View>
      ))}
    </View>
  );
}

const slotStyles = StyleSheet.create({
  column: {
    alignItems: 'center',
    gap: 2,
  },
  box: {
    width: SLOT_BOX,
    height: SLOT_BOX,
    backgroundColor: COLORS.gold,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxUsed: {
    backgroundColor: COLORS.bgCard,
  },
  xLine1: {
    position: 'absolute',
    width: SLOT_DIAG,
    height: 2,
    backgroundColor: '#000000',
    transform: [{ rotate: '45deg' }],
  },
  xLine2: {
    position: 'absolute',
    width: SLOT_DIAG,
    height: 2,
    backgroundColor: '#000000',
    transform: [{ rotate: '-45deg' }],
  },
});

// ---- TurnWonOverlay ----

function TurnWonOverlay({
  score,
  turnTarget,
  reward,
  onShop,
  onContinue,
}: {
  score: number;
  turnTarget: number;
  reward: number;
  onShop: () => void;
  onContinue: () => void;
}) {
  return (
    <View style={overlayStyles.wonBg}>
      <Text style={overlayStyles.wonTitle}>TURN CLEARED</Text>
      <Text style={overlayStyles.wonScore}>
        {score} / {turnTarget} pts
      </Text>
      <Text style={overlayStyles.wonBonus}>+${reward} earned</Text>
      <View style={overlayStyles.wonButtons}>
        <TouchableOpacity style={overlayStyles.shopBtn} onPress={onShop}>
          <Text style={overlayStyles.shopBtnText}>SHOP</Text>
        </TouchableOpacity>
        <TouchableOpacity style={overlayStyles.continueBtn} onPress={onContinue}>
          <Text style={overlayStyles.continueBtnText}>CONTINUE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---- GameOverOverlay ----

function GameOverOverlay({
  state,
  onRestart,
  onMenu,
}: {
  state: RoundsState;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const { roundIndex, turnIndex, turnTarget, turnScore, mult, globalTurnIndex } = state;
  const score = turnScore * mult;

  return (
    <View style={overlayStyles.overBg}>
      <Text style={overlayStyles.overTitle}>GAME OVER</Text>
      <Text style={overlayStyles.overName}>{state.player.name}</Text>

      <View style={overlayStyles.statsCard}>
        <StatRow label="REACHED" value={`Round ${roundIndex + 1}  Turn ${turnIndex + 1}`} valueStyle={overlayStyles.statBright} />
        <StatRow label="NEEDED" value={`${turnTarget} pts`} valueStyle={overlayStyles.statGold} />
        <StatRow label="SCORED" value={`${score} pts`} valueStyle={overlayStyles.statRed} />
        <StatRow label="TURNS WON" value={String(globalTurnIndex)} valueStyle={overlayStyles.statBright} />
      </View>

      <TouchableOpacity style={overlayStyles.restartBtn} onPress={onRestart}>
        <Text style={overlayStyles.restartBtnText}>PLAY AGAIN</Text>
      </TouchableOpacity>
      <TouchableOpacity style={overlayStyles.menuBtn} onPress={onMenu}>
        <Text style={overlayStyles.menuBtnText}>MAIN MENU</Text>
      </TouchableOpacity>
    </View>
  );
}

function StatRow({ label, value, valueStyle }: { label: string; value: string; valueStyle?: object }) {
  return (
    <View style={overlayStyles.statRow}>
      <Text style={overlayStyles.statLabel}>{label}</Text>
      <Text style={[overlayStyles.statValue, valueStyle]}>{value}</Text>
    </View>
  );
}

// ---- Screen ----

export default function GameScreen() {
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ playerName: string }>();
  const player: Player = { id: 0, name: params.playerName ?? 'Player' };

  const [state, dispatch] = useReducer(gameReducer, undefined, () => initGameState(player));

  const [aimPreview, setAimPreview] = useState<{ x: number; y: number; radius: number } | null>(null);
  const [showShop, setShowShop] = useState(false);
  const [pendingBoardDefId, setPendingBoardDefId] = useState<string | null>(null);
  const [pendingDartDefId, setPendingDartDefId] = useState<string | null>(null);

  const boardSize = Math.min(width, height * 0.46);
  const bRadius = boardSize * 0.38; // mirrors boardRadius() in Dartboard.tsx
  const boardCX = boardSize / 2;
  const boardCY = boardSize / 2;
  const slingshotHeight = Math.max(155, height * 0.30);

  const dartMarkers: DartMarker[] = state.currentTurnDarts.map((d, i) => ({
    x: d.x,
    y: d.y,
    color: getDartColor(i),
  }));

  const multiDartFactor = getMultiDartAimFactor(state.throwsUsed, state.ownedItems);
  const AIM_SPREAD = bRadius * 0.22 * getAimFactor(state.ownedItems) * multiDartFactor;

  const deadSectors = useMemo(() =>
    state.ownedItems
      .filter(item => {
        const bi = item as OwnedBoardItem;
        const def = getItemDef(item.defId);
        return def?.category === 'board' && def.effect.type === 'glass_sector'
          && bi.shattered && bi.sector != null;
      })
      .map(item => (item as OwnedBoardItem).sector as number),
    [state.ownedItems],
  );

  const boardEffects = useMemo<BoardEffectMarker[]>(() =>
    state.ownedItems
      .filter(item => {
        const def = getItemDef(item.defId);
        const bi = item as OwnedBoardItem;
        if (def?.category === 'board' && def.effect.type === 'glass_sector' && bi.shattered) return false;
        return def?.category === 'board' && bi.sector !== null;
      })
      .map(item => ({
        sector: (item as OwnedBoardItem).sector!,
        effectType: (getItemDef(item.defId) as any).effect.type,
      })),
    [state.ownedItems],
  );

  const insets = useSafeAreaInsets();
  const boardViewRef = useRef<View>(null);
  const boardScreenYRef = useRef(0);
  const pendingDartRef = useRef<DartHit | null>(null);
  const lastDartScoreRef = useRef(0);
  const throwContextRef = useRef({ dartCount: state.throwsUsed });
  throwContextRef.current = { dartCount: state.throwsUsed };

  type MultiDartPhase =
    | { phase: 'dart1_flying'; dart2: DartHit; dart2ScreenTo: { x: number; y: number } }
    | { phase: 'dart2_flying'; dart1: DartHit };
  const multiDartStateRef = useRef<MultiDartPhase | null>(null);
  const throwFromRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [flyingDart, setFlyingDart] = useState<{
    from: { x: number; y: number };
    to: { x: number; y: number };
    flightColor: string;
  } | null>(null);
  const [throwLocked, setThrowLocked] = useState(false);
  const throwLockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onBoardLayout = useCallback(() => {
    boardViewRef.current?.measure((_x, _y, _w, _h, _pageX, pageY) => {
      boardScreenYRef.current = pageY - insets.top;
    });
  }, [insets.top]);

  const onDartLanded = useCallback(() => {
    const multiState = multiDartStateRef.current;

    // Multi-dart: first dart just landed — queue second dart flight
    if (multiState?.phase === 'dart1_flying') {
      const dart1 = pendingDartRef.current!;
      pendingDartRef.current = multiState.dart2;
      multiDartStateRef.current = { phase: 'dart2_flying', dart1 };
      Vibration.vibrate(30);
      setFlyingDart({
        from: throwFromRef.current,
        to: multiState.dart2ScreenTo,
        flightColor: getDartColor(throwContextRef.current.dartCount),
      });
      return;
    }

    // Multi-dart: second dart just landed — dispatch both together
    if (multiState?.phase === 'dart2_flying') {
      const dart1 = multiState.dart1;
      const dart2 = pendingDartRef.current!;
      multiDartStateRef.current = null;
      pendingDartRef.current = null;
      Vibration.vibrate(30);
      lastDartScoreRef.current = dart1.score + dart2.score;
      dispatch({ type: 'MULTI_THROW', darts: [dart1, dart2] });
      setFlyingDart(null);
      if (dart1.score > 0 || dart2.score > 0) {
        setThrowLocked(true);
        if (throwLockTimer.current) clearTimeout(throwLockTimer.current);
        throwLockTimer.current = setTimeout(() => setThrowLocked(false), 3100);
      }
      return;
    }

    // Normal single dart
    const dart = pendingDartRef.current;
    if (!dart) return;
    pendingDartRef.current = null;
    Vibration.vibrate(30);
    lastDartScoreRef.current = dart.score;
    dispatch({ type: 'THROW', dart });
    setFlyingDart(null);
    // Only lock if the dart scored — misses have no animations to wait for
    if (dart.score > 0) {
      setThrowLocked(true);
      if (throwLockTimer.current) clearTimeout(throwLockTimer.current);
      throwLockTimer.current = setTimeout(() => setThrowLocked(false), 3100);
    }
  }, []);

  const handleThrow = useCallback(
    (normX: number, normY: number) => {
      const aimX = boardCX - normX * bRadius * 1.15;
      const aimY = boardCY + bRadius * (1.1 - 2.2 * normY);

      const boardLeft = (width - boardSize) / 2;
      const contentHeight = height - insets.top - insets.bottom;
      const fromX = width / 2;
      const fromY = contentHeight - slingshotHeight + 44 + (slingshotHeight - 44) * 0.52;
      throwFromRef.current = { x: fromX, y: fromY };

      const { dartCount } = throwContextRef.current;
      const isMulti = isMultiDartThrow(dartCount, state.ownedItems);
      const isBullseye = isBullseyeDartThrow(dartCount, state.ownedItems);

      setAimPreview(null);

      if (isBullseye) {
        const isInnerBull = Math.random() < 0.5;
        let finalX: number;
        let finalY: number;

        if (isInnerBull) {
          // Exact center → inner bull (score 50, red)
          finalX = boardCX;
          finalY = boardCY;
        } else {
          // Midpoint of outer bull ring → outer bull (score 25, green)
          const outerBullR = ((RING_RADII.bull + RING_RADII.outerBull) / 2) * bRadius;
          const angle = Math.random() * 2 * Math.PI;
          finalX = boardCX + outerBullR * Math.cos(angle);
          finalY = boardCY + outerBullR * Math.sin(angle);
        }

        const scoreData = getDartScore(finalX - boardCX, finalY - boardCY, bRadius);
        const dart: DartHit = { x: finalX, y: finalY, ...scoreData };
        pendingDartRef.current = dart;

        setFlyingDart({
          from: { x: fromX, y: fromY },
          to: { x: boardLeft + finalX, y: boardScreenYRef.current + finalY },
          flightColor: getDartColor(dartCount),
        });
        return;
      }

      if (isMulti) {
        // Calculate two independent landing positions — edge-biased distribution (low exponent = less center-heavy)
        const angle1 = Math.random() * 2 * Math.PI;
        const r1 = Math.pow(Math.random(), 0.4) * AIM_SPREAD;
        const finalX1 = aimX + r1 * Math.cos(angle1);
        const finalY1 = aimY + r1 * Math.sin(angle1);
        const dart1: DartHit = { x: finalX1, y: finalY1, ...getDartScore(finalX1 - boardCX, finalY1 - boardCY, bRadius) };

        const angle2 = Math.random() * 2 * Math.PI;
        const r2 = Math.pow(Math.random(), 0.4) * AIM_SPREAD;
        const finalX2 = aimX + r2 * Math.cos(angle2);
        const finalY2 = aimY + r2 * Math.sin(angle2);
        const dart2: DartHit = { x: finalX2, y: finalY2, ...getDartScore(finalX2 - boardCX, finalY2 - boardCY, bRadius) };

        pendingDartRef.current = dart1;
        multiDartStateRef.current = {
          phase: 'dart1_flying',
          dart2,
          dart2ScreenTo: { x: boardLeft + dart2.x, y: boardScreenYRef.current + dart2.y },
        };

        setFlyingDart({
          from: { x: fromX, y: fromY },
          to: { x: boardLeft + dart1.x, y: boardScreenYRef.current + dart1.y },
          flightColor: getDartColor(dartCount),
        });
        return;
      }

      // Normal single dart
      const angle = Math.random() * 2 * Math.PI;
      const r = Math.pow(Math.random(), 1.8) * AIM_SPREAD;
      const finalX = aimX + r * Math.cos(angle);
      const finalY = aimY + r * Math.sin(angle);

      const scoreData = getDartScore(finalX - boardCX, finalY - boardCY, bRadius);
      const dart: DartHit = { x: finalX, y: finalY, ...scoreData };
      pendingDartRef.current = dart;

      setFlyingDart({
        from: { x: fromX, y: fromY },
        to: { x: boardLeft + finalX, y: boardScreenYRef.current + finalY },
        flightColor: getDartColor(dartCount),
      });
    },
    [boardCX, boardCY, bRadius, width, height, boardSize, slingshotHeight, insets, AIM_SPREAD, state.ownedItems]
  );

  const handleAimUpdate = useCallback(
    (normX: number, normY: number) => {
      if (normX === 0 && normY === 0) {
        setAimPreview(null);
        return;
      }
      setAimPreview({
        x: boardCX - normX * bRadius * 1.15,
        y: boardCY + bRadius * (1.1 - 2.2 * normY),
        radius: AIM_SPREAD,
      });
    },
    [boardCX, boardCY, bRadius, AIM_SPREAD]
  );

  // Find the instanceId of the most-recently-bought unassigned board item for a given defId
  const getPendingBoardInstanceId = (defId: string): string | null => {
    for (let i = state.ownedItems.length - 1; i >= 0; i--) {
      const item = state.ownedItems[i];
      if (item.defId === defId && (item as OwnedBoardItem).sector === null) {
        return item.instanceId;
      }
    }
    return null;
  };

  // Find the instanceId of the most-recently-bought unassigned dart item for a given defId
  const getPendingDartInstanceId = (defId: string): string | null => {
    for (let i = state.ownedItems.length - 1; i >= 0; i--) {
      const item = state.ownedItems[i];
      if (item.defId === defId && (item as OwnedDartItem).dartIndex === null) {
        return item.instanceId;
      }
    }
    return null;
  };

  const handleBuyItem = (defId: string) => {
    dispatch({ type: 'BUY_ITEM', defId });
    const cat = getItemDef(defId)?.category;
    if (cat === 'board') setPendingBoardDefId(defId);
    else if (cat === 'dart') setPendingDartDefId(defId);
  };

  const handleClaimPack = (packType: 'decoration' | 'item', chosenDefId: string) => {
    dispatch({ type: 'CLAIM_PACK', packType, chosenDefId });
    const cat = getItemDef(chosenDefId)?.category;
    if (cat === 'board') setPendingBoardDefId(chosenDefId);
    else if (cat === 'dart') setPendingDartDefId(chosenDefId);
  };

  const handleSectorConfirm = (sector: number) => {
    if (!pendingBoardDefId) return;
    const instanceId = getPendingBoardInstanceId(pendingBoardDefId);
    if (instanceId) dispatch({ type: 'ASSIGN_BOARD_SECTOR', instanceId, sector });
    setPendingBoardDefId(null);
  };

  const handleDartSlotConfirm = (dartIndex: number) => {
    if (!pendingDartDefId) return;
    const instanceId = getPendingDartInstanceId(pendingDartDefId);
    if (instanceId) dispatch({ type: 'ASSIGN_DART_SLOT', instanceId, dartIndex });
    setPendingDartDefId(null);
  };

  const [shatterAnim, setShatterAnim] = useState<{ sector: number } | null>(null);
  useEffect(() => {
    if (!state.lastShatterSector) return;
    setShatterAnim({ sector: state.lastShatterSector });
    const t = setTimeout(() => setShatterAnim(null), 700);
    return () => clearTimeout(t);
  }, [state.lastShatterSector]);

  const [overlayReady, setOverlayReady] = useState(false);
  useEffect(() => {
    if (state.turnOutcome !== null && flyingDart === null) {
      // If the dart scored, wait for full animation chain; misses have no animations
      const delay = lastDartScoreRef.current > 0 ? 3200 : 800;
      const timer = setTimeout(() => setOverlayReady(true), delay);
      return () => clearTimeout(timer);
    } else {
      setOverlayReady(false);
    }
  }, [state.turnOutcome, flyingDart]);

  const showWon = state.turnOutcome === 'won' && overlayReady;
  const showOver = state.turnOutcome === 'lost' && overlayReady;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>Menu</Text>
        </TouchableOpacity>
        <Text style={styles.modeLabel}>
          ROUND {state.roundIndex + 1} - TURN {state.turnIndex + 1}
        </Text>
        <Text style={styles.currencyText}>${state.currency}</Text>
      </View>

      {/* Scoreboard */}
      <View style={styles.scoreboardContainer}>
        <Scoreboard state={state} />
      </View>

      {/* Dartboard */}
      <View ref={boardViewRef} style={styles.boardContainer} onLayout={onBoardLayout}>
        <View style={{ width: boardSize, height: boardSize }}>
          <Suspense fallback={<View style={{ width: boardSize, height: boardSize }} />}>
            <Dartboard size={boardSize} darts={dartMarkers} aimIndicator={aimPreview} boardEffects={boardEffects} deadSectors={deadSectors} />
          </Suspense>
          {shatterAnim && (
            <Suspense fallback={null}>
              <ShatterOverlay size={boardSize} sector={shatterAnim.sector} />
            </Suspense>
          )}
        </View>
      </View>

      {/* Slingshot throw zone */}
      <View style={[styles.slingshotZone, { height: slingshotHeight }]}>
        <View style={styles.throwInfo}>
          <Text style={styles.playerTurnText}>{state.player.name}</Text>
          <View style={styles.dartDotsRow}>
            {[0, 1, 2].map(i => {
              const isMulti = state.ownedItems.some(
                item => item.defId === 'multi_dart' && (item as OwnedDartItem).dartIndex === i
              );
              return (
                <ThrowSlot key={i} used={i < state.throwsUsed} isMulti={isMulti} />
              );
            })}
            <Text style={styles.dartsLeftText}>
              {3 - state.throwsUsed} dart{3 - state.throwsUsed !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <Suspense fallback={null}>
          <Slingshot
            width={width}
            height={slingshotHeight - 44}
            disabled={state.turnOutcome !== null || flyingDart !== null || throwLocked}
            onThrow={handleThrow}
            onAimUpdate={handleAimUpdate}
          />
        </Suspense>
      </View>

      {/* Flying dart animation */}
      {flyingDart && (
        <Suspense fallback={null}>
          <FlyingDartOverlay
            key={`${flyingDart.to.x.toFixed(1)}-${flyingDart.to.y.toFixed(1)}`}
            from={flyingDart.from}
            to={flyingDart.to}
            flightColor={flyingDart.flightColor}
            width={width}
            height={height - insets.top - insets.bottom}
            onLanded={onDartLanded}
          />
        </Suspense>
      )}

      {/* Turn Won overlay */}
      {showWon && !showShop && (
        <TurnWonOverlay
          score={state.turnScore * state.mult}
          turnTarget={state.turnTarget}
          reward={state.lastTurnReward}
          onShop={() => { dispatch({ type: 'ADVANCE_TURN' }); setShowShop(true); }}
          onContinue={() => dispatch({ type: 'ADVANCE_TURN' })}
        />
      )}

      {/* Shop */}
      {showShop && (
        <ShopModal
          state={state}
          onBuyItem={handleBuyItem}
          onClaimPack={handleClaimPack}
          onBuyPowerup={() => dispatch({ type: 'BUY_POWERUP' })}
          onClose={() => setShowShop(false)}
        />
      )}

      {/* Board sector picker — shown after buying a board-category item */}
      {pendingBoardDefId && (() => {
        const def = getItemDef(pendingBoardDefId);
        if (!def) return null;
        const pickerSize = Math.min(width * 0.85, 300);
        return (
          <Suspense fallback={null}>
            <BoardSectorPicker
              size={pickerSize}
              itemName={def.name}
              itemDescription={def.description}
              onConfirm={handleSectorConfirm}
              onSkip={() => setPendingBoardDefId(null)}
            />
          </Suspense>
        );
      })()}

      {/* Dart slot picker — shown after buying a dart-category item */}
      {pendingDartDefId && (() => {
        const def = getItemDef(pendingDartDefId);
        if (!def) return null;
        return (
          <DartSlotPicker
            itemName={def.name}
            itemDescription={def.description}
            ownedItems={state.ownedItems}
            onConfirm={handleDartSlotConfirm}
            onSkip={() => setPendingDartDefId(null)}
          />
        );
      })()}

      {/* Game Over overlay */}
      {showOver && (
        <GameOverOverlay
          state={state}
          onRestart={() => dispatch({ type: 'RESTART' })}
          onMenu={() => router.back()}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.bgCard,
  },
  backBtn: { width: 70 },
  currencyText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.gold,
    fontSize: 9,
    letterSpacing: 1,
    width: 60,
    textAlign: 'right',
  },
  backText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.cyan,
    fontSize: 8,
    letterSpacing: 1,
  },
  modeLabel: {
    fontFamily: PIXEL_FONT,
    color: COLORS.gold,
    fontSize: 10,
    letterSpacing: 4,
  },
  boardContainer: {
    alignItems: 'center',
  },
  scoreboardContainer: {
    paddingHorizontal: 8,
  },
  slingshotZone: {
    backgroundColor: COLORS.bgPanel,
    borderTopWidth: 2,
    borderTopColor: COLORS.bgCard,
  },
  throwInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 2,
    height: 44,
  },
  playerTurnText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.cyan,
    fontSize: 9,
    letterSpacing: 2,
  },
  dartDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dartDot: {
    width: 10,
    height: 10,
    borderRadius: 0,
  },
  dartDotFull: {
    backgroundColor: COLORS.gold,
  },
  dartDotUsed: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.bgCard,
  },
  dartsLeftText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 7,
    marginLeft: 4,
  },
});

const overlayStyles = StyleSheet.create({
  wonBg: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 50, 70, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  wonTitle: {
    fontFamily: PIXEL_FONT,
    color: COLORS.cyan,
    fontSize: 20,
    letterSpacing: 4,
    textShadowColor: COLORS.cyan,
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
  },
  wonScore: {
    fontFamily: PIXEL_FONT,
    color: COLORS.bright,
    fontSize: 12,
    letterSpacing: 2,
  },
  wonBonus: {
    fontFamily: PIXEL_FONT,
    color: COLORS.gold,
    fontSize: 9,
    letterSpacing: 2,
  },
  wonButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  shopBtn: {
    backgroundColor: COLORS.gold,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderWidth: 2,
    borderColor: COLORS.bright,
    ...pixelShadow,
  },
  shopBtnText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.bgDark,
    fontSize: 10,
    letterSpacing: 2,
  },
  continueBtn: {
    borderWidth: 2,
    borderColor: COLORS.muted,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  continueBtnText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 10,
    letterSpacing: 2,
  },
  overBg: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(50, 0, 0, 0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  overTitle: {
    fontFamily: PIXEL_FONT,
    color: COLORS.red,
    fontSize: 22,
    letterSpacing: 4,
    textShadowColor: COLORS.red,
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
  },
  overName: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 9,
    letterSpacing: 2,
  },
  statsCard: {
    backgroundColor: COLORS.bgPanel,
    borderWidth: 2,
    borderColor: COLORS.bgCard,
    padding: 16,
    gap: 10,
    width: 240,
    ...pixelShadowSm,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 7,
    letterSpacing: 1,
  },
  statValue: {
    fontFamily: PIXEL_FONT,
    fontSize: 9,
    letterSpacing: 1,
  },
  statBright: { color: COLORS.bright },
  statGold: { color: COLORS.gold },
  statRed: { color: COLORS.red },
  restartBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 0,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderWidth: 2,
    borderColor: COLORS.bright,
    ...pixelShadow,
  },
  restartBtnText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.bgDark,
    fontSize: 10,
    letterSpacing: 2,
  },
  menuBtn: { paddingVertical: 12 },
  menuBtnText: {
    fontFamily: PIXEL_FONT,
    color: COLORS.muted,
    fontSize: 8,
    letterSpacing: 1,
  },
});
