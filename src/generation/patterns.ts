import { LANES } from "../game/config";
import {
  clearLane,
  corridorMask,
  hasLane,
  invertLaneMask,
  laneMask,
  normalizeLane,
  type Lane,
  type LaneMask,
} from "../game/coordinates";
import type { Rng } from "./rng";

export const PATTERN_FAMILIES = [
  "semiRandom",
  "staggered",
  "spiral",
  "line",
  "wall",
] as const;

export type PatternFamily = (typeof PATTERN_FAMILIES)[number];

export type PatternInput = {
  readonly rng: Rng;
  readonly family: PatternFamily;
  readonly cellIndex: number;
  readonly safeLane: Lane;
  readonly safeWidth: number;
  readonly density: number;
  readonly sectionId: number;
};

const addRandomBlockers = (
  rng: Rng,
  availableMask: LaneMask,
  density: number,
): LaneMask =>
  Array.from({ length: LANES }, (_, lane) => lane)
    .filter((lane) => hasLane(availableMask, lane))
    .reduce<LaneMask>(
      (mask, lane) => (rng.next() < density ? mask | laneMask(lane) : mask),
      0,
    );

const createSemiRandomMask = (input: PatternInput, availableMask: LaneMask): LaneMask =>
  addRandomBlockers(input.rng, availableMask, input.density);

const createStaggeredMask = (input: PatternInput, availableMask: LaneMask): LaneMask => {
  const side = Math.floor(input.cellIndex / 2) % 2 === 0 ? -1 : 1;
  const offsets = [side * 2, side * 3, -side * 5];

  return offsets.reduce<LaneMask>((mask, offset) => {
    const lane = normalizeLane(input.safeLane + offset);
    return hasLane(availableMask, lane) ? mask | laneMask(lane) : mask;
  }, 0);
};

const createSpiralMask = (input: PatternInput, availableMask: LaneMask): LaneMask => {
  const direction = input.sectionId % 2 === 0 ? 1 : -1;
  const baseLane = normalizeLane(input.sectionId * 3);
  const leadLane = normalizeLane(baseLane + input.cellIndex * direction);
  const mask = [leadLane, leadLane + direction, leadLane + direction * 3]
    .reduce<LaneMask>((acc, lane) => acc | laneMask(lane), 0);

  return mask & availableMask;
};

const createLineMask = (input: PatternInput, availableMask: LaneMask): LaneMask => {
  const firstLine = normalizeLane(input.sectionId + Math.floor(input.cellIndex / 10));
  const secondLine = normalizeLane(firstLine + 6);

  return [firstLine, secondLine].reduce<LaneMask>(
    (mask, lane) => (hasLane(availableMask, lane) ? mask | laneMask(lane) : mask),
    0,
  );
};

const createWallMask = (input: PatternInput, safeMask: LaneMask): LaneMask => {
  if (input.cellIndex % 9 !== 0) {
    return createSemiRandomMask(input, invertLaneMask(safeMask)) & 0b001_001_001_001;
  }

  const widerSafeMask = corridorMask(input.safeLane, Math.max(input.safeWidth, 1));
  const wallMask = invertLaneMask(widerSafeMask);
  const reliefLane = normalizeLane(input.safeLane + (input.sectionId % 2 === 0 ? 4 : -4));

  return clearLane(wallMask, reliefLane);
};

export const createPatternMask = (input: PatternInput): LaneMask => {
  const safeMask = corridorMask(input.safeLane, input.safeWidth);
  const availableMask = invertLaneMask(safeMask);

  const rawMask = (() => {
    switch (input.family) {
      case "semiRandom":
        return createSemiRandomMask(input, availableMask);
      case "staggered":
        return createStaggeredMask(input, availableMask);
      case "spiral":
        return createSpiralMask(input, availableMask);
      case "line":
        return createLineMask(input, availableMask);
      case "wall":
        return createWallMask(input, safeMask);
    }
  })();

  return rawMask & availableMask;
};
