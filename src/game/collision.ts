import {
  MAX_BOOST_LEVEL,
  POST_CRASH_INVULNERABLE_SECONDS,
} from "./config";
import { cellFromDistance, hasLane, laneFromAngle, type LaneMask } from "./coordinates";

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
  readonly obstacleMask: LaneMask;
  readonly boostLane?: number;
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

export const resolveCollisionFrame = (
  player: PlayerState,
  frame: CollisionFrame,
): CollisionResult => {
  if (player.status === "gameOver" || player.invulnerableSeconds > 0) {
    return { player, collectedBoost: false, crashed: false };
  }

  const lane = laneFromAngle(player.angle);
  const collectedBoost = frame.boostLane === lane;
  const boostedPlayer = collectedBoost ? addBoost(player) : player;
  const hitObstacle = hasLane(frame.obstacleMask, lane);

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
