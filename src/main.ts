import "./styles.css";

import { CELL_DEPTH } from "./game/config";
import { resolveCollisionFrame } from "./game/collision";
import { scoreFromDistance, maybeUpdateHighScore, readHighScore } from "./game/scoring";
import { advancePlayer, createInitialGameState, type GameState } from "./game/state";
import {
  createWorld,
  ensureWorldAhead,
  findSection,
  frameAtDistance,
  trimWorldBehind,
  type World,
} from "./game/world";
import { createInputController, type InputController } from "./input/controller";
import { updateCamera } from "./render/camera";
import { createHud, updateHud, type Hud } from "./render/hud";
import { boostKey, updateObstacleView } from "./render/obstacles";
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
  readonly collectedBoosts: ReadonlySet<string>;
  readonly crashFlashSeconds: number;
};

const createRunState = (highScore: number): RunState => {
  const seed = import.meta.env.MODE === "test" ? 24_681 : Date.now() % 100_000;
  return {
    game: createInitialGameState(highScore, seed),
    world: createWorld(seed, 0),
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
  const frame = frameAtDistance(world, advancedPlayer.distance);
  const key =
    frame?.boost === undefined
      ? undefined
      : boostKey(frame.section.id, frame.boost.cell);
  const frameCenterDistance =
    frame === undefined
      ? undefined
      : frame.section.startDistance + (frame.sectionCell + 0.5) * CELL_DEPTH;
  const collision = resolveCollisionFrame(advancedPlayer, {
    obstacleMask: frame?.obstacleMask ?? 0,
    ...(frameCenterDistance === undefined
      ? {}
      : { obstacleCenterDistance: frameCenterDistance }),
    ...(frame?.boost !== undefined &&
    key !== undefined &&
    !state.collectedBoosts.has(key)
      ? {
          boostLane: frame.boost.lane,
          ...(frameCenterDistance === undefined
            ? {}
            : { boostCenterDistance: frameCenterDistance }),
        }
      : {}),
  });
  const collectedBoosts =
    collision.collectedBoost && key !== undefined
      ? new Set([...state.collectedBoosts, key])
      : state.collectedBoosts;
  const score = scoreFromDistance(collision.player.distance);
  const highScore =
    collision.player.status === "gameOver"
      ? maybeUpdateHighScore(window.localStorage, score)
      : Math.max(state.game.highScore, score);
  const safeDt = Math.min(Math.max(dtSeconds, 0), 0.05);

  return {
    game: {
      ...state.game,
      player: collision.player,
      highScore,
    },
    world,
    collectedBoosts,
    crashFlashSeconds: collision.crashed
      ? 0.75
      : Math.max(0, state.crashFlashSeconds - safeDt),
  };
};

const renderFrame = (state: RunState): void => {
  const { renderScene: scene, hud: frameHud } = runtime;
  const player = state.game.player;
  const section = findSection(state.world, player.distance);

  updateTubeView(scene.tube, player.distance);
  updateObstacleView(
    scene.obstacles,
    state.world,
    player.distance,
    state.collectedBoosts,
  );
  updateCamera(scene.camera, player.angle);
  updateShipView(scene.ship, player.angle, state.crashFlashSeconds);
  scene.renderer.render(scene.scene, scene.camera);
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
  renderFrame(run);
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
        renderFrame(run);
      },
      restart,
    },
  });
}
