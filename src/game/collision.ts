import {
  LANE_ANGLE,
  MAX_BOOST_LEVEL,
  OBSTACLE_CUBE_SIZE,
  POST_CRASH_INVULNERABLE_SECONDS,
  TUBE_RADIUS,
} from "./config";
import {
  angularDistance,
  cellFromDistance,
  lanesFromMask,
  panelCenterAngle,
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
  readonly obstacleMask: LaneMask;
  readonly obstacleCenterDistance?: number;
  readonly boostLane?: number;
  readonly boostCenterDistance?: number;
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

const SHIP_COLLISION_HALF_DEPTH = 0.9;
const SHIP_COLLISION_HALF_ANGLE = LANE_ANGLE * 0.22;
const CUBE_COLLISION_HALF_ANGLE = Math.asin((OBSTACLE_CUBE_SIZE / 2) / TUBE_RADIUS);

const isDistanceOverlapping = (
  playerDistance: number,
  targetDistance: number | undefined,
): boolean =>
  targetDistance === undefined ||
  Math.abs(playerDistance - targetDistance) <=
    OBSTACLE_CUBE_SIZE / 2 + SHIP_COLLISION_HALF_DEPTH;

const isAngleOverlapping = (playerAngle: number, lane: Lane): boolean =>
  angularDistance(playerAngle, panelCenterAngle(lane)) <=
  CUBE_COLLISION_HALF_ANGLE + SHIP_COLLISION_HALF_ANGLE;

const overlappingLane = (
  player: PlayerState,
  lanes: readonly Lane[],
  centerDistance: number | undefined,
): Lane | undefined =>
  isDistanceOverlapping(player.distance, centerDistance)
    ? lanes.find((lane) => isAngleOverlapping(player.angle, lane))
    : undefined;

export const resolveCollisionFrame = (
  player: PlayerState,
  frame: CollisionFrame,
): CollisionResult => {
  if (player.status === "gameOver" || player.invulnerableSeconds > 0) {
    return { player, collectedBoost: false, crashed: false };
  }

  const boostLane =
    frame.boostLane === undefined
      ? undefined
      : overlappingLane(
          player,
          [frame.boostLane],
          frame.boostCenterDistance ?? frame.obstacleCenterDistance,
        );
  const collectedBoost = boostLane !== undefined;
  const boostedPlayer = collectedBoost ? addBoost(player) : player;
  const hitObstacle =
    overlappingLane(
      player,
      lanesFromMask(frame.obstacleMask),
      frame.obstacleCenterDistance,
    ) !== undefined;

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
