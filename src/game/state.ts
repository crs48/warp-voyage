import {
  BASE_SPEED,
  BOOST_MULTIPLIERS,
  LANE_ANGLE,
  PLAYER_LANES_PER_SECOND,
} from "./config";
import type { PlayerState } from "./collision";

export type SteeringIntent = {
  readonly steer: number;
};

export type GameState = {
  readonly player: PlayerState;
  readonly highScore: number;
  readonly seed: number;
};

export const createInitialPlayer = (): PlayerState => ({
  distance: 0,
  angle: 0,
  boostLevel: 0,
  shielded: false,
  invulnerableSeconds: 0,
  status: "running",
});

export const createInitialGameState = (
  highScore = 0,
  seed = 1337,
): GameState => ({
  player: createInitialPlayer(),
  highScore,
  seed,
});

export const speedForBoostLevel = (boostLevel: PlayerState["boostLevel"]): number =>
  BASE_SPEED * BOOST_MULTIPLIERS[boostLevel];

export const advancePlayer = (
  player: PlayerState,
  intent: SteeringIntent,
  dtSeconds: number,
): PlayerState => {
  if (player.status === "gameOver") {
    return player;
  }

  const safeDt = Math.min(Math.max(dtSeconds, 0), 0.05);
  const steer = Math.max(-1, Math.min(1, intent.steer));

  return {
    ...player,
    distance: player.distance + speedForBoostLevel(player.boostLevel) * safeDt,
    angle: player.angle + steer * PLAYER_LANES_PER_SECOND * LANE_ANGLE * safeDt,
    invulnerableSeconds: Math.max(0, player.invulnerableSeconds - safeDt),
  };
};
