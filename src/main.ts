import "./styles.css";

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
};

const createRunState = (highScore: number): RunState => {
  const seed = Date.now() % 100_000;
  return {
    game: createInitialGameState(highScore, seed),
    world: createWorld(seed, 0),
    collectedBoosts: new Set(),
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
  renderScene.renderer.domElement,
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
  const collision = resolveCollisionFrame(advancedPlayer, {
    obstacleMask: frame?.obstacleMask ?? 0,
    ...(frame?.boost !== undefined &&
    key !== undefined &&
    !state.collectedBoosts.has(key)
      ? { boostLane: frame.boost.lane }
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

  return {
    game: {
      ...state.game,
      player: collision.player,
      highScore,
    },
    world,
    collectedBoosts,
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
  scene.renderer.render(scene.scene, scene.camera);
  updateHud(frameHud, {
    score: scoreFromDistance(player.distance),
    highScore: state.game.highScore,
    pattern: section?.pattern ?? "semiRandom",
    player,
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
        };
        renderFrame(run);
      },
      restart,
    },
  });
}
