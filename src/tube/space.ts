// Single source of truth for tube-space geometry. No module outside
// src/tube/ may define spatial constants or transforms; rendering and
// collision both read the cell definitions below, so they cannot drift.

export const LANES = 12;
export const LANE_ANGLE = (Math.PI * 2) / LANES;
export const TUBE_RADIUS = 6;
export const CELL_DEPTH = 4;
export const VISIBLE_CELLS = 36;

// Cube cross-section: chord of one lane at the wall, minus a hair so grid
// lines stay readable. Depth nearly fills the cell so the rendered cube
// matches its collision rect.
export const CUBE_SIZE = 2 * TUBE_RADIUS * Math.sin(LANE_ANGLE / 2) * 0.98;
export const CUBE_DEPTH = CELL_DEPTH * 0.96;
export const CUBE_SURFACE_GAP = 0.03;

// Player hitbox half-extents in tube space — forgiving on purpose.
export const PLAYER_HALF_DEPTH = 0.35 * CELL_DEPTH;
export const PLAYER_HALF_ANGLE = 0.3 * LANE_ANGLE;

// Telegraph: panels tint when their cell is within FAR cells of the player,
// reaching full strength at NEAR cells out.
export const TELEGRAPH_FAR_CELLS = 10;
export const TELEGRAPH_NEAR_CELLS = 3;

export type TubeRect = {
  readonly s0: number;
  readonly s1: number;
  readonly theta0: number;
  readonly theta1: number;
};

export const cellCenterS = (cell: number): number =>
  (cell + 0.5) * CELL_DEPTH;

export const panelCenterAngle = (lane: number): number =>
  (lane + 0.5) * LANE_ANGLE;

export const cellRect = (cell: number, lane: number): TubeRect => ({
  s0: cell * CELL_DEPTH,
  s1: (cell + 1) * CELL_DEPTH,
  theta0: lane * LANE_ANGLE,
  theta1: (lane + 1) * LANE_ANGLE,
});

export const playerRect = (s: number, theta: number): TubeRect => ({
  s0: s - PLAYER_HALF_DEPTH,
  s1: s + PLAYER_HALF_DEPTH,
  theta0: theta - PLAYER_HALF_ANGLE,
  theta1: theta + PLAYER_HALF_ANGLE,
});

const TWO_PI = Math.PI * 2;

const normalizeAngle = (angle: number): number =>
  ((angle % TWO_PI) + TWO_PI) % TWO_PI;

export const angularIntervalsOverlap = (a: TubeRect, b: TubeRect): boolean => {
  const halfWidthA = (a.theta1 - a.theta0) / 2;
  const halfWidthB = (b.theta1 - b.theta0) / 2;
  const raw = Math.abs(
    normalizeAngle(a.theta0 + halfWidthA) - normalizeAngle(b.theta0 + halfWidthB),
  );
  const distance = Math.min(raw, TWO_PI - raw);
  return distance < halfWidthA + halfWidthB;
};

export const overlaps = (a: TubeRect, b: TubeRect): boolean =>
  a.s1 > b.s0 && a.s0 < b.s1 && angularIntervalsOverlap(a, b);
