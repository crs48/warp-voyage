// One run of the game: player + world + bend + per-run pickup state.
// updateRun is the whole simulation step; main.ts only feeds it input and
// hands the result to the render layer.

import { resolveCollisionFrame } from "./collision";
import { maybeUpdateHighScore, scoreFromDistance } from "./scoring";
import { advancePlayer, createInitialGameState, type GameState } from "./state";
import {
  boostKey,
  createWorld,
  ensureWorldAhead,
  framesNearDistance,
  trimWorldBehind,
  type World,
} from "./world";
import { createBend, type BendParams } from "../tube/centerline";

export type RunState = {
  readonly game: GameState;
  readonly world: World;
  readonly bend: BendParams;
  readonly collectedBoosts: ReadonlySet<string>;
  readonly crashFlashSeconds: number;
};

export const createRunState = (highScore: number, seed: number): RunState => ({
  game: createInitialGameState(highScore, seed),
  world: createWorld(seed, 0),
  bend: createBend(seed),
  collectedBoosts: new Set(),
  crashFlashSeconds: 0,
});

type CollisionPass = {
  readonly player: RunState["game"]["player"];
  readonly collectedBoosts: ReadonlySet<string>;
  readonly crashed: boolean;
};

export const updateRun = (
  state: RunState,
  steer: number,
  dtSeconds: number,
  storage: Pick<Storage, "getItem" | "setItem">,
): RunState => {
  const advancedPlayer = advancePlayer(state.game.player, { steer }, dtSeconds);
  const world = trimWorldBehind(
    ensureWorldAhead(state.world, advancedPlayer.distance),
    advancedPlayer.distance,
  );
  const collisionState = framesNearDistance(world, advancedPlayer.distance).reduce<CollisionPass>(
    (current, frame) => {
      if (current.crashed) {
        return current;
      }

      const key =
        frame.boost === undefined
          ? undefined
          : boostKey(frame.section.id, frame.boost.cell);
      const collision = resolveCollisionFrame(current.player, {
        cell: frame.absoluteCell,
        obstacleMask: frame.obstacleMask,
        ...(frame.boost !== undefined &&
        key !== undefined &&
        !current.collectedBoosts.has(key)
          ? { boostLane: frame.boost.lane }
          : {}),
      });

      return {
        player: collision.player,
        collectedBoosts:
          collision.collectedBoost && key !== undefined
            ? new Set([...current.collectedBoosts, key])
            : current.collectedBoosts,
        crashed: collision.crashed,
      };
    },
    {
      player: advancedPlayer,
      collectedBoosts: state.collectedBoosts,
      crashed: false,
    },
  );
  const score = scoreFromDistance(collisionState.player.distance);
  const highScore =
    collisionState.player.status === "gameOver"
      ? maybeUpdateHighScore(storage, score)
      : Math.max(state.game.highScore, score);
  const safeDt = Math.min(Math.max(dtSeconds, 0), 0.05);

  return {
    game: {
      ...state.game,
      player: collisionState.player,
      highScore,
    },
    world,
    bend: state.bend,
    collectedBoosts: collisionState.collectedBoosts,
    crashFlashSeconds: collisionState.crashed
      ? 0.75
      : Math.max(0, state.crashFlashSeconds - safeDt),
  };
};
