import { Scene, WebGLRenderer } from "three";

import { createCamera } from "./camera";
import { createObstacleView } from "./obstacles";
import { createTubeView } from "./tubeMesh";

export type RenderScene = {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: ReturnType<typeof createCamera>;
  readonly tube: ReturnType<typeof createTubeView>;
  readonly obstacles: ReturnType<typeof createObstacleView>;
  readonly dispose: () => void;
};

export type RenderSceneOptions = {
  readonly preserveDrawingBuffer?: boolean;
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
  const camera = createCamera();
  const tube = createTubeView();
  const obstacles = createObstacleView();
  scene.add(tube.group, obstacles.group);

  const resize = (): void => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
  };

  window.addEventListener("resize", resize);

  return {
    renderer,
    scene,
    camera,
    tube,
    obstacles,
    dispose: () => {
      window.removeEventListener("resize", resize);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
};
