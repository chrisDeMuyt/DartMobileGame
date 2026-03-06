// Clockwise from top (12 o'clock = segment 20)
export const SEGMENT_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Radii as a fraction of board scoring radius (based on real dartboard dimensions)
export const RING_RADII = {
  bull: 0.0374,        // inner bull (50 pts) - 6.35mm / 170mm
  outerBull: 0.0935,   // outer bull (25 pts) - 15.9mm / 170mm
  trebleInner: 0.582,  // inner edge of treble ring - 99mm / 170mm
  trebleOuter: 0.629,  // outer edge of treble ring - 107mm / 170mm
  doubleInner: 0.953,  // inner edge of double ring - 162mm / 170mm
  doubleOuter: 1.0,    // outer edge of board (double ring outer)
};

export interface DartHit {
  x: number;           // canvas pixel position (board-relative)
  y: number;
  score: number;
  label: string;       // e.g. "T20", "D16", "25", "Bull", "Miss"
  segment: number;     // raw segment number (1-20, 25, 50, or 0 for miss)
  multiplier: 1 | 2 | 3;
}

export function getDartScore(
  dx: number,           // relative to board center (pixels)
  dy: number,
  boardRadius: number   // radius of the scoring area
): Omit<DartHit, 'x' | 'y'> {
  const dist = Math.sqrt(dx * dx + dy * dy);
  const norm = dist / boardRadius;

  if (norm <= RING_RADII.bull) {
    return { score: 50, label: 'Bull', segment: 50, multiplier: 2 };
  }
  if (norm <= RING_RADII.outerBull) {
    return { score: 25, label: '25', segment: 25, multiplier: 1 };
  }
  if (norm > RING_RADII.doubleOuter) {
    return { score: 0, label: 'Miss', segment: 0, multiplier: 1 };
  }

  // atan2(dx, -dy) gives angle from top (12 o'clock), positive clockwise
  let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
  if (angle < 0) angle += 360;

  // Each segment is 18 degrees; segment 20 is centered at 0 degrees (top)
  const segIndex = Math.floor(((angle + 9) % 360) / 18);
  const segment = SEGMENT_ORDER[segIndex];

  let multiplier: 1 | 2 | 3 = 1;
  let prefix = '';

  if (norm >= RING_RADII.trebleInner && norm <= RING_RADII.trebleOuter) {
    multiplier = 3;
    prefix = 'T';
  } else if (norm >= RING_RADII.doubleInner) {
    multiplier = 2;
    prefix = 'D';
  }

  return {
    score: segment * multiplier,
    label: `${prefix}${segment}`,
    segment,
    multiplier,
  };
}
