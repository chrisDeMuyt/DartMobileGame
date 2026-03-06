import React, { useReducer, useCallback, useState, useRef, useEffect, Suspense, lazy } from 'react';
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
import type { DartMarker } from '../components/Dartboard';
// Lazy imports so @shopify/react-native-skia (and Skia.web.js) is only evaluated
// after global.CanvasKit is set (guarded by skiaReady in _layout.tsx).
const Dartboard = lazy(() => import('../components/Dartboard'));
const FlyingDartOverlay = lazy(() => import('../components/FlyingDartOverlay'));
const Slingshot = lazy(() => import('../components/Slingshot'));
import Scoreboard from '../components/Scoreboard';
import ShopModal from '../components/ShopModal';
import { getDartScore, DartHit } from '../lib/dartboard';
import {
  RoundsState,
  Player,
  initGameState,
  addDart,
  advanceTurn,
  buyUpgrade,
} from '../lib/gameLogic';
import { PIXEL_FONT, pixelShadow, pixelShadowSm, COLORS } from '../lib/theme';

// ---- Reducer ----

type Action =
  | { type: 'THROW'; dart: DartHit }
  | { type: 'ADVANCE_TURN' }
  | { type: 'BUY_UPGRADE'; itemId: string }
  | { type: 'RESTART' };

function gameReducer(state: RoundsState, action: Action): RoundsState {
  switch (action.type) {
    case 'THROW':
      if (state.turnOutcome !== null) return state;
      return addDart(state, action.dart);
    case 'ADVANCE_TURN':
      return advanceTurn(state);
    case 'BUY_UPGRADE':
      return buyUpgrade(state, action.itemId);
    case 'RESTART':
      return initGameState(state.player);
    default:
      return state;
  }
}

// ---- Helpers ----

function getDartColor(dartIndex: number): string {
  return ['#f5c518', '#e0b010', '#c89c00'][dartIndex % 3];
}

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

  const steadyHand = state.upgrades['steady_hand'] ?? 0;
  const AIM_SPREAD = bRadius * 0.22 * Math.pow(0.85, steadyHand);

  const insets = useSafeAreaInsets();
  const boardViewRef = useRef<View>(null);
  const boardScreenYRef = useRef(0);
  const pendingDartRef = useRef<DartHit | null>(null);
  const throwContextRef = useRef({ dartCount: state.currentTurnDarts.length });
  throwContextRef.current = { dartCount: state.currentTurnDarts.length };

  const [flyingDart, setFlyingDart] = useState<{
    from: { x: number; y: number };
    to: { x: number; y: number };
    flightColor: string;
  } | null>(null);

  const onBoardLayout = useCallback(() => {
    boardViewRef.current?.measure((_x, _y, _w, _h, _pageX, pageY) => {
      boardScreenYRef.current = pageY - insets.top;
    });
  }, [insets.top]);

  const onDartLanded = useCallback(() => {
    const dart = pendingDartRef.current;
    if (!dart) return;
    pendingDartRef.current = null;
    Vibration.vibrate(30);
    dispatch({ type: 'THROW', dart });
    setFlyingDart(null);
  }, []);

  const handleThrow = useCallback(
    (normX: number, normY: number) => {
      const aimX = boardCX - normX * bRadius * 1.15;
      const aimY = boardCY + bRadius * (1.1 - 2.2 * normY);

      const angle = Math.random() * 2 * Math.PI;
      const r = Math.pow(Math.random(), 1.8) * AIM_SPREAD;
      const finalX = aimX + r * Math.cos(angle);
      const finalY = aimY + r * Math.sin(angle);

      const scoreData = getDartScore(finalX - boardCX, finalY - boardCY, bRadius);
      const dart: DartHit = { x: finalX, y: finalY, ...scoreData };
      pendingDartRef.current = dart;

      const boardLeft = (width - boardSize) / 2;
      const toX = boardLeft + finalX;
      const toY = boardScreenYRef.current + finalY;

      const contentHeight = height - insets.top - insets.bottom;
      const fromX = width / 2;
      const fromY = contentHeight - slingshotHeight + 44 + (slingshotHeight - 44) * 0.52;

      const { dartCount } = throwContextRef.current;

      setAimPreview(null);
      setFlyingDart({
        from: { x: fromX, y: fromY },
        to: { x: toX, y: toY },
        flightColor: getDartColor(dartCount),
      });
    },
    [boardCX, boardCY, bRadius, width, height, boardSize, slingshotHeight, insets]
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
    [boardCX, boardCY, bRadius]
  );

  const [overlayReady, setOverlayReady] = useState(false);
  useEffect(() => {
    if (state.turnOutcome !== null && flyingDart === null) {
      const timer = setTimeout(() => setOverlayReady(true), 1400);
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
        <Suspense fallback={<View style={{ width: boardSize, height: boardSize }} />}>
          <Dartboard size={boardSize} darts={dartMarkers} aimIndicator={aimPreview} />
        </Suspense>
      </View>

      {/* Slingshot throw zone */}
      <View style={[styles.slingshotZone, { height: slingshotHeight }]}>
        <View style={styles.throwInfo}>
          <Text style={styles.playerTurnText}>{state.player.name}</Text>
          <View style={styles.dartDotsRow}>
            {[0, 1, 2].map(i => (
              <View
                key={i}
                style={[
                  styles.dartDot,
                  i < state.currentTurnDarts.length ? styles.dartDotUsed : styles.dartDotFull,
                ]}
              />
            ))}
            <Text style={styles.dartsLeftText}>
              {3 - state.currentTurnDarts.length} dart{3 - state.currentTurnDarts.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <Suspense fallback={null}>
          <Slingshot
            width={width}
            height={slingshotHeight - 44}
            disabled={state.turnOutcome !== null || flyingDart !== null}
            onThrow={handleThrow}
            onAimUpdate={handleAimUpdate}
          />
        </Suspense>
      </View>

      {/* Flying dart animation */}
      {flyingDart && (
        <Suspense fallback={null}>
          <FlyingDartOverlay
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
          onShop={() => setShowShop(true)}
          onContinue={() => dispatch({ type: 'ADVANCE_TURN' })}
        />
      )}

      {/* Shop */}
      {showShop && (
        <ShopModal
          state={state}
          onBuy={itemId => dispatch({ type: 'BUY_UPGRADE', itemId })}
          onClose={() => {
            setShowShop(false);
            dispatch({ type: 'ADVANCE_TURN' });
          }}
        />
      )}

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
