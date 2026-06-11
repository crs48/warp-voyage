// Collision lives entirely in tube space: the player rect and each occupied
// cell rect are 2D intervals in (s, θ). No Vector3, no ship-geometry
// constants — the rendered cube fills the same cellRect by definition.

import { MAX_BOOST_LEVEL, POST_CRASH_INVULNERABLE_SECONDS } from "./config";
import { cellRect, overlaps, playerRect, type TubeRect } from "../tube/space";
import {
  cellFromDistance,
  lanesFromMask,
  type CellIndex,
  type Lane,
  type LaneMask,
} from "./coordinates";

export type PlayerStatus = "running" | "gameOver";

export type PlayerState = {
  readonly distance: number;
  readonly angle: number;
  readonly boostLevel: 0 | 1 | 2 | 3;
  readonly shielded: boolean;
  readonly invulnerableSeconds: number;
  readonly status: PlayerStatus;
};

export type CollisionFrame = {
  readonly cell: CellIndex;
  readonly obstacleMask: LaneMask;
  readonly boostLane?: Lane;
};

export type CollisionResult = {
  readonly player: PlayerState;
  readonly collectedBoost: boolean;
  readonly crashed: boolean;
};

const addBoost = (player: PlayerState): PlayerState => ({
  ...player,
  boostLevel: Math.min(MAX_BOOST_LEVEL, player.boostLevel + 1) as 0 | 1 | 2 | 3,
  shielded: true,
});

const crashPlayer = (player: PlayerState): PlayerState =>
  player.boostLevel > 0 || player.shielded
    ? {
        ...player,
        boostLevel: 0,
        shielded: false,
        invulnerableSeconds: POST_CRASH_INVULNERABLE_SECONDS,
      }
    : {
        ...player,
        status: "gameOver",
      };

const hitsLane = (player: TubeRect, cell: CellIndex, lane: Lane): boolean =>
  overlaps(player, cellRect(cell, lane));

export const resolveCollisionFrame = (
  player: PlayerState,
  frame: CollisionFrame,
): CollisionResult => {
  if (player.status === "gameOver" || player.invulnerableSeconds > 0) {
    return { player, collectedBoost: false, crashed: false };
  }

  const rect = playerRect(player.distance, player.angle);
  const collectedBoost =
    frame.boostLane !== undefined && hitsLane(rect, frame.cell, frame.boostLane);
  const boostedPlayer = collectedBoost ? addBoost(player) : player;
  const hitObstacle = lanesFromMask(frame.obstacleMask).some((lane) =>
    hitsLane(rect, frame.cell, lane),
  );

  if (!hitObstacle) {
    return { player: boostedPlayer, collectedBoost, crashed: false };
  }

  return {
    player: crashPlayer(boostedPlayer),
    collectedBoost,
    crashed: true,
  };
};

export const playerCell = (player: Pick<PlayerState, "distance">): number =>
  cellFromDistance(player.distance);
