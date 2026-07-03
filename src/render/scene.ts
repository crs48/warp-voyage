import { Scene, WebGLRenderer } from "three";

import { createCameraRig, type CameraRig } from "./camera";
import { createObstacleView } from "./obstacles";
import { createParticleSystem, type ParticleSystem } from "./particles/system";
import { createShipView } from "./ship";
import { createTubeView } from "./tubeMesh";

export type RenderScene = {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly cameraRig: CameraRig;
  readonly tube: ReturnType<typeof createTubeView>;
  readonly obstacles: ReturnType<typeof createObstacleView>;
  readonly ship: ReturnType<typeof createShipView>;
  readonly particles: ParticleSystem;
  readonly dispose: () => void;
};

export type RenderSceneOptions = {
  readonly preserveDrawingBuffer?: boolean;
  // The particle substrate is a purely additive layer; with it off, the scene
  // graph is exactly the pre-substrate one, so rendering is byte-identical.
  readonly showParticles?: boolean;
};

export const createRenderScene = (
  host: HTMLElement,
  options: RenderSceneOptions = {},
): RenderScene => {
  const renderer = new WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
  });
  renderer.setClearColor(0xffffff, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  host.append(renderer.domElement);

  const scene = new Scene();
  const cameraRig = createCameraRig();
  const tube = createTubeView();
  const obstacles = createObstacleView();
  const ship = createShipView();
  const particles = createParticleSystem(renderer.getPixelRatio());
  scene.add(tube.group, obstacles.group, ship.group);
  if (options.showParticles ?? true) {
    scene.add(particles.tubePoints);
  }

  const resize = (): void => {
    cameraRig.camera.aspect = window.innerWidth / window.innerHeight;
    cameraRig.camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
  };

  window.addEventListener("resize", resize);

  return {
    renderer,
    scene,
    cameraRig,
    tube,
    obstacles,
    ship,
    particles,
    dispose: () => {
      window.removeEventListener("resize", resize);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
};
