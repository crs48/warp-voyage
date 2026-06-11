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
import { createPatternMask, PATTERN_FAMILIES, type PatternFamily } from "./patterns";
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
  readonly boostCells: readonly BoostCell[];
};

export type SectionOptions = {
  readonly id: number;
  readonly seed: number;
  readonly startLane: Lane;
  readonly startDistance?: number;
};

const selectPattern = (id: number): PatternFamily =>
  PATTERN_FAMILIES[id % PATTERN_FAMILIES.length] ?? "semiRandom";

const densityForSection = (id: number): number =>
  Math.min(0.42, 0.14 + id * 0.025);

const safeWidthForSection = (id: number): number =>
  id < 2 ? 2 : 1;

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
}: SectionOptions): Section => {
  const pattern = selectPattern(id);
  const maxLaneStep = 1;
  const safeWidth = safeWidthForSection(id);
  const rng = createRng(seed + id * 9973);
  const safePath = generateSafePath({
    length: SECTION_CELLS,
    startLane,
    maxLaneStep,
    rng,
    turnChance: pattern === "line" ? 0.32 : 0.58,
  });
  const boostCells = createBoostCells(safePath, id);

  const obstacleMasks = Array.from({ length: SECTION_CELLS }, (_, cellIndex) => {
    const safeLane = safePath[cellIndex] ?? startLane;
    const mask = createPatternMask({
      rng,
      family: pattern,
      cellIndex,
      safeLane,
      safeWidth,
      density: densityForSection(id),
      sectionId: id,
    });

    return mask & ~corridorMask(safeLane, safeWidth);
  });
  const masksWithBoosts = clearBoostLanes(obstacleMasks, boostCells);

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
    boostCells: boostCells.filter(({ cell, lane }) => !hasLane(masksWithBoosts[cell] ?? 0, lane)),
  };
};

export const sectionCellFromDistance = (
  section: Section,
  distance: number,
): CellIndex =>
  Math.max(0, Math.floor((distance - section.startDistance) / CELL_DEPTH));
