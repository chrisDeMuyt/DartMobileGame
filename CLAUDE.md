# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start dev server (Expo Go on device, or web browser)
npx expo start

# Platform-specific
npx expo start --ios
npx expo start --android

# Install packages (always use --legacy-peer-deps)
npm install --legacy-peer-deps
```

There are no automated tests in this project.

## Architecture

Single-screen mobile dart game built with Expo Router. Two routes: home (`app/index.tsx`) and game (`app/game.tsx`).

### Skia / Web initialization

`app/_layout.tsx` must load Skia's WASM before any Skia component renders. On web, it dynamically imports `LoadSkiaWeb` and awaits it before rendering children. All Skia-dependent components (`Dartboard`, `FlyingDartOverlay`, `Slingshot`, `BoardSectorPicker`) are lazy-imported in `game.tsx` to ensure they only evaluate after `global.CanvasKit` is set. The `canvaskit.wasm` file is copied to `public/` by the `postinstall` script.

### State management

All game state lives in a single `RoundsState` (defined in `lib/gameLogic.ts`) managed by `useReducer` in `game.tsx`. State is pure and immutable — every action returns a new state object. The reducer dispatches to pure functions: `addDart`, `advanceTurn`, `buyItem`, `claimPackItem`, `buyPowerup`, `assignBoardSector`.

### Game loop (Rounds mode)

- Player has 3 darts per turn; 3 turns per round.
- Each turn has a `turnTarget` (score × mult ≥ target = win; else game over).
- `computeTarget(globalTurnIndex)` drives escalating difficulty.
- Winning a turn triggers the TurnWon overlay → optional Shop → next turn.
- `turnOutcome` (`'won' | 'lost' | null`) gates overlays; `overlayReady` adds a delay so animations finish first.

### Throw / aim mechanic

Slingshot gesture in the bottom zone produces `(normX, normY)` in `handleThrow`. These map to a board aim position, then a random offset (polar, power-distributed) within `AIM_SPREAD` determines the final landing point. `AIM_SPREAD = bRadius × 0.22 × getAimFactor(ownedItems)` — powerups shrink this radius. `getDartScore` in `lib/dartboard.ts` converts canvas-relative coordinates to score/segment/multiplier.

### Item system (`lib/items.ts`)

Single source of truth: the `ITEMS` array. Adding a new item only requires adding an entry there — no other file needs changing. Items are categorized as `board`, `dart`, `powerup`, or `decoration`, each with a typed `effect` discriminated union. Owned instances (`OwnedItem`) are separate from definitions (`ItemDef`) and track per-purchase state (e.g., `sector`, `shattered`). Shop offers are regenerated on `advanceTurn`; powerup slot only refreshes at round boundaries.

### Scoring / mult formula

`turnScore` = sum of raw dart scores + any `bonus_sector` / `bonus_dart` item bonuses.
`mult` = computed by `computeMult()` in `gameLogic.ts`; starts at 0, accumulates per scoring dart, with combo multipliers for hitting the same segment multiple times.
Final score = `turnScore × mult`.

### Components

- **`Dartboard.tsx`** — Skia canvas; renders board rings, segment labels, dart markers, aim indicator circle, and `BoardEffectMarker` overlays for placed board items.
- **`Slingshot.tsx` / `Slingshot.web.tsx`** — Platform-split gesture handler. Native uses Reanimated worklet + `runOnJS`; web version adapts for mouse/touch events.
- **`FlyingDartOverlay.tsx`** — Animated dart-in-flight from slingshot origin to board target; calls `onLanded` on arrival.
- **`ShopModal.tsx`** — Full-screen shop; renders item/pack/powerup offers from `state.shopOffers`.
- **`BoardSectorPicker.tsx`** — Skia mini-board overlay for assigning a purchased board item to a specific sector.
- **`Scoreboard.tsx`** — Displays current turn score, mult, target progress.

### Hooks

- **`hooks/useBackgroundMusic.ts`** — Manages looping background audio via `expo-av`; exports `useMuteState()` and `toggleMusicMute()`.

### Theming

All colors and fonts are in `lib/theme.ts`. Use `COLORS.*` and `PIXEL_FONT` (PressStart2P) consistently. Pixel-art styling uses zero-blur hard drop shadows (`pixelShadow`, `pixelShadowSm`).
