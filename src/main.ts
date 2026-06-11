import "./styles.css";

import { resolveCollisionFrame } from "./game/collision";
import { scoreFromDistance, maybeUpdateHighScore, readHighScore } from "./game/scoring";
import { advancePlayer, createInitialGameState, type GameState } from "./game/state";
import {
  boostKey,
  createWorld,
  ensureWorldAhead,
  findSection,
  framesNearDistance,
  trimWorldBehind,
  type World,
} from "./game/world";
import { createInputController, type InputController } from "./input/controller";
import { createBend, type BendParams } from "./tube/centerline";
import { updateCameraRig } from "./render/camera";
import { createHud, updateHud, type Hud } from "./render/hud";
import { updateObstacleView } from "./render/obstacles";
import { createRenderScene, type RenderScene } from "./render/scene";
import { updateShipView } from "./render/ship";
import { updateTubeView } from "./render/tubeMesh";

declare global {
  // Window augmentation requires an interface declaration.
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window {
    readonly __warpVoyageTest?: {
      readonly getSnapshot: () => {
        readonly distance: number;
        readonly angle: number;
        readonly status: string;
        readonly scoreText: string;
        readonly crashFlashSeconds: number;
      };
      readonly forceGameOver: () => void;
      readonly restart: () => void;
    };
  }
}

const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error("Missing #app root element");
}

type Runtime = {
  readonly renderScene: RenderScene;
  readonly hud: Hud;
  readonly input: InputController;
};

type RunState = {
  readonly game: GameState;
  readonly world: World;
  readonly bend: BendParams;
  readonly collectedBoosts: ReadonlySet<string>;
  readonly crashFlashSeconds: number;
};

const createRunState = (highScore: number): RunState => {
  const seed = import.meta.env.MODE === "test" ? 24_681 : Date.now() % 100_000;
  return {
    game: createInitialGameState(highScore, seed),
    world: createWorld(seed, 0),
    bend: createBend(seed),
    collectedBoosts: new Set(),
    crashFlashSeconds: 0,
  };
};

app.replaceChildren();
const canvasHost = document.createElement("div");
canvasHost.className = "game";
app.append(canvasHost);

const hud = createHud(app);
const renderScene = createRenderScene(canvasHost, {
  preserveDrawingBuffer: import.meta.env.MODE === "test",
});
const input = createInputController(
  hud.gyro,
  hud.gyroStatus,
);
const runtime: Runtime = { renderScene, hud, input };
let run = createRunState(readHighScore(window.localStorage));
let lastTimeMs: number | undefined;

const restart = (): void => {
  run = createRunState(readHighScore(window.localStorage));
  lastTimeMs = undefined;
};

hud.restart.addEventListener("click", restart);
window.addEventListener("keydown", () => {
  if (run.game.player.status === "gameOver") {
    restart();
  }
});

const updateRun = (state: RunState, dtSeconds: number): RunState => {
  const advancedPlayer = advancePlayer(
    state.game.player,
    { steer: runtime.input.getSteer() },
    dtSeconds,
  );
  const world = trimWorldBehind(
    ensureWorldAhead(state.world, advancedPlayer.distance),
    advancedPlayer.distance,
  );
  const nearbyFrames = framesNearDistance(world, advancedPlayer.distance);
  const collisionState = nearbyFrames.reduce<{
    readonly player: typeof advancedPlayer;
    readonly collectedBoosts: ReadonlySet<string>;
    readonly collectedBoost: boolean;
    readonly crashed: boolean;
  }>(
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
        collectedBoost: current.collectedBoost || collision.collectedBoost,
        crashed: collision.crashed,
      };
    },
    {
      player: advancedPlayer,
      collectedBoosts: state.collectedBoosts,
      collectedBoost: false,
      crashed: false,
    },
  );
  const score = scoreFromDistance(collisionState.player.distance);
  const highScore =
    collisionState.player.status === "gameOver"
      ? maybeUpdateHighScore(window.localStorage, score)
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

const renderFrame = (state: RunState, dtSeconds: number): void => {
  const { renderScene: scene, hud: frameHud } = runtime;
  const player = state.game.player;
  const section = findSection(state.world, player.distance);

  updateTubeView(
    scene.tube,
    state.world,
    player.distance,
    state.bend,
    state.collectedBoosts,
  );
  updateObstacleView(
    scene.obstacles,
    state.world,
    player.distance,
    state.bend,
    state.collectedBoosts,
  );
  updateCameraRig(
    scene.cameraRig,
    player.angle,
    player.distance,
    state.bend,
    dtSeconds,
  );
  updateShipView(
    scene.ship,
    player.angle,
    player.distance,
    state.bend,
    state.crashFlashSeconds,
  );
  scene.renderer.render(scene.scene, scene.cameraRig.camera);
  updateHud(frameHud, {
    score: scoreFromDistance(player.distance),
    highScore: state.game.highScore,
    pattern: section?.pattern ?? "semiRandom",
    player,
    crashFlashSeconds: state.crashFlashSeconds,
  });
};

renderScene.renderer.setAnimationLoop((timeMs: number) => {
  const dtSeconds =
    lastTimeMs === undefined ? 0 : (timeMs - lastTimeMs) / 1_000;
  lastTimeMs = timeMs;

  run = updateRun(run, dtSeconds);
  renderFrame(run, dtSeconds);
});

if (import.meta.env.MODE === "test") {
  Object.defineProperty(window, "__warpVoyageTest", {
    configurable: true,
    value: {
      getSnapshot: () => ({
        distance: run.game.player.distance,
        angle: run.game.player.angle,
        status: run.game.player.status,
        scoreText: hud.score.textContent,
        crashFlashSeconds: run.crashFlashSeconds,
      }),
      forceGameOver: () => {
        run = {
          ...run,
          game: {
            ...run.game,
            player: {
              ...run.game.player,
              status: "gameOver",
            },
          },
          crashFlashSeconds: 0.75,
        };
        renderFrame(run, 0);
      },
      restart,
    },
  });
}
