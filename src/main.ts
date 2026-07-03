import "./styles.css";

import { BOOST_MULTIPLIERS } from "./game/config";
import { guidanceAhead, type Guidance } from "./game/guidance";
import { createRunState, updateRun, type RunState } from "./game/run";
import { readHighScore, scoreFromDistance } from "./game/scoring";
import { findSection } from "./game/world";
import { createInputController } from "./input/controller";
import { CELL_DEPTH, TELEGRAPH_FAR_CELLS } from "./tube/space";
import { updateCameraRig } from "./render/camera";
import { magnetizationCoherence } from "./render/particles/coherence";
import { createDebugOverlay, updateDebugOverlay } from "./render/debugOverlay";
import { createHud, updateHud } from "./render/hud";
import { updateObstacleView } from "./render/obstacles";
import { updateParticleSystem } from "./render/particles/system";
import { createRenderScene } from "./render/scene";
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
        readonly boostLevel: number;
      };
      readonly getGuidance: () => Guidance;
      readonly setAngle: (angle: number) => void;
      readonly forceGameOver: () => void;
      readonly restart: () => void;
    };
  }
}

const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error("Missing #app root element");
}

app.replaceChildren();
const canvasHost = document.createElement("div");
canvasHost.className = "game";
app.append(canvasHost);

const hud = createHud(app);
const debugOverlay = createDebugOverlay(app);
const renderScene = createRenderScene(canvasHost, {
  preserveDrawingBuffer: import.meta.env.MODE === "test",
  // Opt out with ?particles=off to confirm the substrate is a clean layer.
  showParticles:
    new URLSearchParams(window.location.search).get("particles") !== "off",
});
const input = createInputController(hud.gyro, hud.gyroStatus);

const newRun = (): RunState => {
  const seed = import.meta.env.MODE === "test" ? 24_681 : Date.now() % 100_000;
  return createRunState(readHighScore(window.localStorage), seed);
};

let run = newRun();
let lastTimeMs: number | undefined;
let elapsedSeconds = 0;

const restart = (): void => {
  run = newRun();
  lastTimeMs = undefined;
};

hud.restart.addEventListener("click", restart);
window.addEventListener("keydown", () => {
  if (run.game.player.status === "gameOver") {
    restart();
  }
});

const renderFrame = (state: RunState, dtSeconds: number): void => {
  const player = state.game.player;
  const section = findSection(state.world, player.distance);
  const speedFactor = BOOST_MULTIPLIERS[player.boostLevel];
  const guidance = guidanceAhead(state.world, player.distance, state.collectedBoosts);
  const coherence = magnetizationCoherence({
    timeSeconds: elapsedSeconds,
    boostLevel: player.boostLevel,
    obstacleDistance:
      guidance.obstacle === undefined
        ? Number.POSITIVE_INFINITY
        : guidance.obstacle.cell * CELL_DEPTH - player.distance,
  });

  updateTubeView(
    renderScene.tube,
    state.world,
    player.distance,
    state.bend,
    state.collectedBoosts,
    speedFactor,
  );
  updateObstacleView(
    renderScene.obstacles,
    state.world,
    player.distance,
    state.bend,
    state.collectedBoosts,
    state.impacts,
  );
  updateCameraRig(
    renderScene.cameraRig,
    player.angle,
    player.distance,
    state.bend,
    dtSeconds,
  );
  updateShipView(
    renderScene.ship,
    player.angle,
    player.distance,
    state.bend,
    state.crashFlashSeconds,
  );
  updateParticleSystem(renderScene.particles, {
    bend: state.bend,
    playerS: player.distance,
    playerAngle: player.angle,
    speedFactor,
    timeSeconds: elapsedSeconds,
    pixelRatio: renderScene.renderer.getPixelRatio(),
    impacts: state.impacts,
    coherence,
  });
  renderScene.renderer.render(renderScene.scene, renderScene.cameraRig.camera);
  updateDebugOverlay(
    debugOverlay,
    state.world,
    player.distance,
    player.angle,
    state.collectedBoosts,
    Math.round(TELEGRAPH_FAR_CELLS * speedFactor),
  );
  updateHud(hud, {
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
  elapsedSeconds = timeMs / 1_000;

  run = updateRun(run, input.getSteer(), dtSeconds, window.localStorage);
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
        boostLevel: run.game.player.boostLevel,
      }),
      getGuidance: () =>
        guidanceAhead(run.world, run.game.player.distance, run.collectedBoosts),
      setAngle: (angle: number) => {
        run = {
          ...run,
          game: {
            ...run.game,
            player: { ...run.game.player, angle },
          },
        };
      },
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
