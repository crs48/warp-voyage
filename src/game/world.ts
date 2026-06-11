import { CELL_DEPTH, VISIBLE_CELLS } from "../tube/space";
import {
  cellFromDistance,
  type CellIndex,
  type Lane,
  type LaneMask,
} from "./coordinates";
import {
  generateSection,
  sectionCellFromDistance,
  type BoostCell,
  type Section,
} from "../generation/sections";

export type World = {
  readonly seed: number;
  readonly sections: readonly Section[];
};

export type WorldFrame = {
  readonly absoluteCell: CellIndex;
  readonly section: Section;
  readonly sectionCell: CellIndex;
  readonly obstacleMask: LaneMask;
  readonly boost?: BoostCell;
};

export const boostKey = (sectionId: number, cell: CellIndex): string =>
  `${String(sectionId)}:${String(cell)}`;

export const createWorld = (seed: number, startLane: Lane): World => ({
  seed,
  sections: [generateSection({ id: 0, seed, startLane })],
});

const appendSection = (world: World): World => {
  const last = world.sections.at(-1);

  if (last === undefined) {
    return createWorld(world.seed, 0);
  }

  const nextId = last.id + 1;
  const startLane = last.safePath.at(-1) ?? 0;
  const section = generateSection({
    id: nextId,
    seed: world.seed,
    startLane,
    startDistance: last.endDistance,
  });

  return {
    ...world,
    sections: [...world.sections, section],
  };
};

export const ensureWorldAhead = (world: World, distance: number): World => {
  const requiredDistance = distance + VISIBLE_CELLS * 4;
  const last = world.sections.at(-1);

  if (last !== undefined && last.endDistance >= requiredDistance) {
    return world;
  }

  return ensureWorldAhead(appendSection(world), distance);
};

export const trimWorldBehind = (world: World, distance: number): World => ({
  ...world,
  sections:
    world.sections.length <= 2
      ? world.sections
      : world.sections.filter((section) => section.endDistance >= distance - 100),
});

export const findSection = (
  world: World,
  distance: number,
): Section | undefined =>
  world.sections.find(
    (section) => distance >= section.startDistance && distance < section.endDistance,
  ) ?? world.sections.at(-1);

export const frameAtDistance = (
  world: World,
  distance: number,
): WorldFrame | undefined => {
  const section = findSection(world, distance);

  if (section === undefined) {
    return undefined;
  }

  const sectionCell = sectionCellFromDistance(section, distance);
  const obstacleMask = section.obstacleMasks[sectionCell] ?? 0;
  const boost = section.boostCells.find((candidate) => candidate.cell === sectionCell);

  return {
    absoluteCell: cellFromDistance(distance),
    section,
    sectionCell,
    obstacleMask,
    ...(boost === undefined ? {} : { boost }),
  };
};

export const framesNearDistance = (
  world: World,
  distance: number,
  radiusCells = 2,
): readonly WorldFrame[] => {
  const centerCell = cellFromDistance(distance);

  return Array.from(
    { length: radiusCells * 2 + 1 },
    (_, index) => centerCell + index - radiusCells,
  )
    .filter((absoluteCell) => absoluteCell >= 0)
    .map((absoluteCell) =>
      frameAtDistance(world, absoluteCell * CELL_DEPTH + CELL_DEPTH * 0.5),
    )
    .filter((frame): frame is WorldFrame => frame !== undefined);
};
