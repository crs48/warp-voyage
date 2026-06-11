import { SECTION_CELLS, SECTION_LENGTH } from "../game/config";
import { CELL_DEPTH } from "../tube/space";
import {
  corridorMask,
  hasLane,
  normalizeLane,
  type CellIndex,
  type Lane,
  type LaneMask,
} from "../game/coordinates";
import { createPatternEvent, PATTERN_FAMILIES, type PatternFamily } from "./patterns";
import { createRng } from "./rng";
import { generateSafePath } from "./safePath";
import { validateReachability } from "./validate";

export type BoostCell = {
  readonly cell: CellIndex;
  readonly lane: Lane;
};

export type Section = {
  readonly id: number;
  readonly startDistance: number;
  readonly endDistance: number;
  readonly pattern: PatternFamily;
  readonly seed: number;
  readonly safePath: readonly Lane[];
  readonly obstacleMasks: readonly LaneMask[];
  // Palette index per cell; all cubes of one event share a color.
  readonly cellColors: readonly number[];
  readonly boostCells: readonly BoostCell[];
};

export type SectionOptions = {
  readonly id: number;
  readonly seed: number;
  readonly startLane: Lane;
  readonly startDistance?: number;
  // Boost multiplier at generation time: event gaps stretch with it so the
  // player gets the same reaction time at any speed.
  readonly speedFactor?: number;
};

const selectPattern = (id: number): PatternFamily =>
  PATTERN_FAMILIES[id % PATTERN_FAMILIES.length] ?? "slalom";

const difficultyForSection = (id: number): number => Math.min(1, id * 0.08);

const safeWidthForSection = (id: number): number =>
  id < 2 ? 2 : 1;

// The opening stretch of the first section stays empty so a fresh run is
// never lost before the player has seen a single telegraph.
const SPAWN_CLEAR_CELLS = 10;
// Breather at the start of every later section.
const SECTION_ENTRY_GAP = 3;

const COLOR_VARIANTS = 6;

const createBoostCells = (safePath: readonly Lane[], sectionId: number): readonly BoostCell[] =>
  [34, 78, 112]
    .map((cell) => ({
      cell,
      lane: normalizeLane((safePath[cell] ?? safePath.at(-1) ?? 0) + (sectionId % 2)),
    }))
    .filter(({ cell }) => cell < safePath.length);

const clearBoostLanes = (
  masks: readonly LaneMask[],
  boostCells: readonly BoostCell[],
): readonly LaneMask[] =>
  masks.map((mask, cell) =>
    boostCells.some((boost) => boost.cell === cell)
      ? mask & ~boostCells
        .filter((boost) => boost.cell === cell)
        .reduce<LaneMask>((boostMask, boost) => boostMask | (1 << boost.lane), 0)
      : mask,
  );

export const generateSection = ({
  id,
  seed,
  startLane,
  startDistance = id * SECTION_LENGTH,
  speedFactor = 1,
}: SectionOptions): Section => {
  const pattern = selectPattern(id);
  const maxLaneStep = 1;
  const safeWidth = safeWidthForSection(id);
  const difficulty = difficultyForSection(id);
  const pacing = Math.min(4, Math.max(1, speedFactor));
  const rng = createRng(seed + id * 9973);
  const safePath = generateSafePath({
    length: SECTION_CELLS,
    startLane,
    maxLaneStep,
    rng,
    turnChance: pattern === "rail" || pattern === "spiral" ? 0.34 : 0.58,
  });
  const boostCells = createBoostCells(safePath, id);

  const masks = new Array<LaneMask>(SECTION_CELLS).fill(0);
  const colors = new Array<number>(SECTION_CELLS).fill(0);
  let cursor = id === 0 ? SPAWN_CLEAR_CELLS : SECTION_ENTRY_GAP;
  let eventIndex = 0;

  while (cursor < SECTION_CELLS) {
    const event = createPatternEvent({
      rng,
      family: pattern,
      eventIndex,
      safeLanes: safePath.slice(cursor),
      safeWidth,
      difficulty,
    });
    const colorIndex = rng.nextInt(0, COLOR_VARIANTS);

    event.masks.forEach((mask, step) => {
      const cell = cursor + step;

      if (cell >= SECTION_CELLS) {
        return;
      }

      const safeLane = safePath[cell] ?? startLane;
      const placed = mask & ~corridorMask(safeLane, safeWidth);
      masks[cell] = placed;

      if (placed !== 0) {
        colors[cell] = colorIndex;
      }
    });

    cursor += event.masks.length + Math.max(1, Math.round(event.gapAfter * pacing));
    eventIndex += 1;
  }

  const masksWithBoosts = clearBoostLanes(masks, boostCells);

  if (!validateReachability({ masks: masksWithBoosts, startLane, maxStepPerCell: maxLaneStep })) {
    throw new Error(`Generated invalid section ${String(id)}`);
  }

  return {
    id,
    startDistance,
    endDistance: startDistance + SECTION_CELLS * CELL_DEPTH,
    pattern,
    seed,
    safePath,
    obstacleMasks: masksWithBoosts,
    cellColors: colors,
    boostCells: boostCells.filter(({ cell, lane }) => !hasLane(masksWithBoosts[cell] ?? 0, lane)),
  };
};

export const sectionCellFromDistance = (
  section: Section,
  distance: number,
): CellIndex =>
  Math.max(0, Math.floor((distance - section.startDistance) / CELL_DEPTH));
