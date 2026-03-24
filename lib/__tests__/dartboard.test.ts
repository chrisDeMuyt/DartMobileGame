import { getDartScore, RING_RADII, SEGMENT_ORDER } from '../dartboard';

// All tests use boardRadius=1 so norm === dist

describe('getDartScore — bull / outer bull / miss', () => {
  test('dead center → Bull (score=50, segment=50, multiplier=2)', () => {
    const r = getDartScore(0, 0, 1);
    expect(r).toEqual({ score: 50, label: 'Bull', segment: 50, multiplier: 2 });
  });

  test('norm=RING_RADII.bull (exact boundary) → Bull', () => {
    const r = getDartScore(RING_RADII.bull, 0, 1);
    expect(r.label).toBe('Bull');
    expect(r.score).toBe(50);
  });

  test('just outside bull, inside outer bull → 25', () => {
    const r = getDartScore(0, -0.06, 1);
    expect(r).toEqual({ score: 25, label: '25', segment: 25, multiplier: 1 });
  });

  test('norm=RING_RADII.outerBull (exact boundary) → 25', () => {
    const r = getDartScore(0, -RING_RADII.outerBull, 1);
    expect(r.score).toBe(25);
    expect(r.label).toBe('25');
  });

  test('norm=1.5 → Miss', () => {
    const r = getDartScore(0, -1.5, 1);
    expect(r).toEqual({ score: 0, label: 'Miss', segment: 0, multiplier: 1 });
  });

  test('norm=1.01 (just outside board) → Miss', () => {
    const r = getDartScore(0, -1.01, 1);
    expect(r.label).toBe('Miss');
    expect(r.score).toBe(0);
  });
});

describe('getDartScore — segment detection (single area, norm=0.3)', () => {
  test('top (12 o\'clock) → segment 20', () => {
    const r = getDartScore(0, -0.3, 1);
    expect(r.segment).toBe(20);
    expect(r.score).toBe(20);
    expect(r.multiplier).toBe(1);
    expect(r.label).toBe('20');
  });

  test('right (3 o\'clock) → segment 6', () => {
    const r = getDartScore(0.3, 0, 1);
    expect(r.segment).toBe(6);
    expect(r.score).toBe(6);
    expect(r.multiplier).toBe(1);
    expect(r.label).toBe('6');
  });

  test('bottom (6 o\'clock) → segment 3', () => {
    const r = getDartScore(0, 0.3, 1);
    expect(r.segment).toBe(3);
    expect(r.score).toBe(3);
    expect(r.multiplier).toBe(1);
    expect(r.label).toBe('3');
  });

  test('left (9 o\'clock) → segment 11', () => {
    const r = getDartScore(-0.3, 0, 1);
    expect(r.segment).toBe(11);
    expect(r.score).toBe(11);
    expect(r.multiplier).toBe(1);
    expect(r.label).toBe('11');
  });
});

describe('getDartScore — ring multipliers (aiming at segment 20)', () => {
  test('norm=0.3 (single area) → multiplier=1, label="20", score=20', () => {
    const r = getDartScore(0, -0.3, 1);
    expect(r.multiplier).toBe(1);
    expect(r.label).toBe('20');
    expect(r.score).toBe(20);
  });

  test('norm=0.6 (treble ring) → multiplier=3, label="T20", score=60', () => {
    const r = getDartScore(0, -0.6, 1);
    expect(r.multiplier).toBe(3);
    expect(r.label).toBe('T20');
    expect(r.score).toBe(60);
  });

  test('norm=0.97 (double ring) → multiplier=2, label="D20", score=40', () => {
    const r = getDartScore(0, -0.97, 1);
    expect(r.multiplier).toBe(2);
    expect(r.label).toBe('D20');
    expect(r.score).toBe(40);
  });

  test('norm=1.0 exactly (double outer boundary) → not a miss, score=40, label="D20"', () => {
    const r = getDartScore(0, -1.0, 1);
    expect(r.score).toBe(40);
    expect(r.label).toBe('D20');
    expect(r.multiplier).toBe(2);
  });
});

describe('getDartScore — board radius scaling', () => {
  test('getDartScore(0, -60, 200) equals getDartScore(0, -0.3, 1) — same norm', () => {
    const a = getDartScore(0, -60, 200);
    const b = getDartScore(0, -0.3, 1);
    expect(a).toEqual(b);
  });
});

describe('getDartScore — SEGMENT_ORDER and RING_RADII exports', () => {
  test('SEGMENT_ORDER has 20 entries', () => {
    expect(SEGMENT_ORDER).toHaveLength(20);
  });

  test('SEGMENT_ORDER contains all segments 1–20 exactly once', () => {
    const sorted = [...SEGMENT_ORDER].sort((a, b) => a - b);
    expect(sorted).toEqual([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]);
  });

  test('RING_RADII.bull < RING_RADII.outerBull < RING_RADII.trebleInner', () => {
    expect(RING_RADII.bull).toBeLessThan(RING_RADII.outerBull);
    expect(RING_RADII.outerBull).toBeLessThan(RING_RADII.trebleInner);
  });

  test('RING_RADII.trebleInner < RING_RADII.trebleOuter < RING_RADII.doubleInner', () => {
    expect(RING_RADII.trebleInner).toBeLessThan(RING_RADII.trebleOuter);
    expect(RING_RADII.trebleOuter).toBeLessThan(RING_RADII.doubleInner);
  });

  test('RING_RADII.doubleOuter === 1.0', () => {
    expect(RING_RADII.doubleOuter).toBe(1.0);
  });
});
