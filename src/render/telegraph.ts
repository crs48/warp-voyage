// Telegraph field: for every visible panel, how strongly it should warn
// about the next cube (or advertise the next boost) ahead in its lane. The
// warning is a trail painted down the lane *approaching* the target — the
// panel under a cube is hidden by the cube itself, so the runway in front
// of it is what the player actually reads. Each trail carries the palette
// index of the cube it leads to, and the horizon stretches with speed.

import {
  CELL_DEPTH,
  LANES,
  TELEGRAPH_FAR_CELLS,
  VISIBLE_CELLS,
} from "../tube/space";
import { hasLane } from "../game/coordinates";
import { boostKey, frameAtDistance, type World } from "../game/world";

export type TelegraphField = {
  // VISIBLE_CELLS * LANES strengths in [0, 1], indexed cellOffset * LANES + lane.
  readonly cube: readonly number[];
  readonly boost: readonly number[];
  // Palette index of the cube each trail leads to.
  readonly colorIndex: readonly number[];
};

// Strength of a panel `cellsToTarget` cells before its cube/boost: 1 on the
// target's own cell, easing to 0 at the horizon.
export const trailStrength = (
  cellsToTarget: number,
  horizonCells = TELEGRAPH_FAR_CELLS,
): number => {
  if (cellsToTarget > horizonCells) {
    return 0;
  }

  const t = 1 - cellsToTarget / horizonCells;
  return t * t * (3 - 2 * t);
};

export const computeTelegraphField = (
  world: World,
  baseCell: number,
  collectedBoosts: ReadonlySet<string>,
  horizonCells = TELEGRAPH_FAR_CELLS,
): TelegraphField => {
  const lookaheadCells = VISIBLE_CELLS + horizonCells;
  const cube = new Array<number>(VISIBLE_CELLS * LANES).fill(0);
  const boost = new Array<number>(VISIBLE_CELLS * LANES).fill(0);
  const colorIndex = new Array<number>(VISIBLE_CELLS * LANES).fill(0);
  const cellsToCube = new Array<number>(LANES).fill(Number.POSITIVE_INFINITY);
  const cellsToBoost = new Array<number>(LANES).fill(Number.POSITIVE_INFINITY);
  const cubeColor = new Array<number>(LANES).fill(0);

  // Walk back from the horizon so each panel knows the distance to the next
  // occupied cell ahead of it in the same lane.
  for (let offset = lookaheadCells - 1; offset >= 0; offset -= 1) {
    const absoluteCell = baseCell + offset;
    const frame = frameAtDistance(world, absoluteCell * CELL_DEPTH + CELL_DEPTH * 0.5);
    const mask = frame?.obstacleMask ?? 0;
    const boostLane =
      frame?.boost !== undefined &&
      !collectedBoosts.has(boostKey(frame.section.id, frame.boost.cell))
        ? frame.boost.lane
        : undefined;

    for (let lane = 0; lane < LANES; lane += 1) {
      if (hasLane(mask, lane)) {
        cellsToCube[lane] = 0;
        cubeColor[lane] = frame?.colorIndex ?? 0;
      } else {
        cellsToCube[lane] = (cellsToCube[lane] ?? Infinity) + 1;
      }

      cellsToBoost[lane] = boostLane === lane ? 0 : (cellsToBoost[lane] ?? Infinity) + 1;

      if (offset < VISIBLE_CELLS) {
        const index = offset * LANES + lane;
        cube[index] = trailStrength(cellsToCube[lane] ?? Infinity, horizonCells);
        boost[index] = trailStrength(cellsToBoost[lane] ?? Infinity, horizonCells);
        colorIndex[index] = cubeColor[lane] ?? 0;
      }
    }
  }

  return { cube, boost, colorIndex };
};
