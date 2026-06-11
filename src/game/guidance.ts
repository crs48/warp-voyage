// Look-ahead guidance over the generated world: the next safe lane, the
// nearest obstacle, and the nearest safely-reachable boost. Used by the e2e
// test driver; also the natural seed for a future autopilot/tutorial.

import { CELL_DEPTH } from "../tube/space";
import { lanesFromMask, type CellIndex, type Lane } from "./coordinates";
import { boostKey, frameAtDistance, type World, type WorldFrame } from "./world";

export type Guidance = {
  readonly safeLane: Lane;
  readonly obstacle?: { readonly cell: CellIndex; readonly lane: Lane };
  readonly boost?: { readonly cell: CellIndex; readonly lane: Lane };
};

const LOOKAHEAD_CELLS = 24;

type AheadEntry = {
  readonly cell: CellIndex;
  readonly frame: WorldFrame | undefined;
};

export const guidanceAhead = (
  world: World,
  distance: number,
  collectedBoosts: ReadonlySet<string>,
): Guidance => {
  const playerCellIndex = Math.floor(distance / CELL_DEPTH);
  const ahead: readonly AheadEntry[] = Array.from(
    { length: LOOKAHEAD_CELLS },
    (_, index) => playerCellIndex + 1 + index,
  ).map((cell) => ({
    cell,
    frame: frameAtDistance(world, cell * CELL_DEPTH + CELL_DEPTH * 0.5),
  }));

  const obstacleEntry = ahead.find(
    ({ frame }) => frame !== undefined && frame.obstacleMask !== 0,
  );
  const obstacleLane =
    obstacleEntry?.frame === undefined
      ? undefined
      : lanesFromMask(obstacleEntry.frame.obstacleMask)[0];

  // A boost is only offered as a target when its lane is unblocked the whole
  // way there, so a driver can beeline to it safely.
  const boostEntry = ahead.find(
    ({ cell, frame }) =>
      frame?.boost !== undefined &&
      !collectedBoosts.has(boostKey(frame.section.id, frame.boost.cell)) &&
      ahead
        .filter((candidate) => candidate.cell <= cell)
        .every(
          ({ frame: between }) =>
            between === undefined ||
            frame.boost === undefined ||
            (between.obstacleMask & (1 << frame.boost.lane)) === 0,
        ),
  );

  // The next cell's safe lane: with maxLaneStep 1, it always sits inside the
  // current cell's cleared corridor too, so snapping straight to it is safe.
  const safeFrame = ahead[0]?.frame;
  const safeLane =
    safeFrame?.section.safePath[
      Math.min(safeFrame.sectionCell, safeFrame.section.safePath.length - 1)
    ] ?? 0;

  return {
    safeLane,
    ...(obstacleEntry !== undefined && obstacleLane !== undefined
      ? { obstacle: { cell: obstacleEntry.cell, lane: obstacleLane } }
      : {}),
    ...(boostEntry?.frame?.boost === undefined
      ? {}
      : { boost: { cell: boostEntry.cell, lane: boostEntry.frame.boost.lane } }),
  };
};
