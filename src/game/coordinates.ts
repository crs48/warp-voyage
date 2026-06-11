import { CELL_DEPTH, LANE_ANGLE, LANES } from "../tube/space";

export type Lane = number;
export type CellIndex = number;
export type LaneMask = number;

export const normalizeLane = (lane: number): Lane =>
  ((Math.round(lane) % LANES) + LANES) % LANES;

export const laneMask = (lane: number): LaneMask => 1 << normalizeLane(lane);

export const hasLane = (mask: LaneMask, lane: number): boolean =>
  (mask & laneMask(lane)) !== 0;

export const clearLane = (mask: LaneMask, lane: number): LaneMask =>
  mask & ~laneMask(lane);

export const laneDistance = (from: Lane, to: Lane): number => {
  const delta = Math.abs(normalizeLane(from) - normalizeLane(to));
  return Math.min(delta, LANES - delta);
};

export const corridorMask = (centerLane: Lane, width: number): LaneMask =>
  Array.from({ length: width * 2 + 1 }, (_, index) => centerLane + index - width)
    .reduce<LaneMask>((mask, lane) => mask | laneMask(lane), 0);

export const invertLaneMask = (mask: LaneMask): LaneMask =>
  ((1 << LANES) - 1) & ~mask;

export const openLaneMask = (blockedMask: LaneMask): LaneMask =>
  invertLaneMask(blockedMask);

export const lanesFromMask = (mask: LaneMask): readonly Lane[] =>
  Array.from({ length: LANES }, (_, lane) => lane)
    .filter((lane) => hasLane(mask, lane));

const normalizeAngle = (angle: number): number => {
  const fullTurn = Math.PI * 2;
  return ((angle % fullTurn) + fullTurn) % fullTurn;
};

export const angularDistance = (first: number, second: number): number => {
  const fullTurn = Math.PI * 2;
  const raw = Math.abs(normalizeAngle(first) - normalizeAngle(second));
  return Math.min(raw, fullTurn - raw);
};

export const laneFromAngle = (angle: number): Lane =>
  Math.floor(normalizeAngle(angle) / LANE_ANGLE);

export const angleForLane = (lane: Lane): number =>
  (normalizeLane(lane) + 0.5) * LANE_ANGLE;

export const panelCenterAngle = angleForLane;

export const cellFromDistance = (distance: number): CellIndex =>
  Math.max(0, Math.floor(distance / CELL_DEPTH));
