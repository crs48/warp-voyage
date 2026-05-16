import { PerspectiveCamera, Vector3 } from "three";

import { TUBE_RADIUS } from "../game/config";
import { radialForAngle } from "./tubeMath";

export const createCamera = (): PerspectiveCamera => {
  const camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 260);
  camera.position.set(0, -3, 8);
  return camera;
};

export const updateCamera = (
  camera: PerspectiveCamera,
  playerAngle: number,
): void => {
  const radial = radialForAngle(playerAngle);
  const position = radial.clone().multiplyScalar(TUBE_RADIUS - 3.2).add(new Vector3(0, 0, 7));
  const target = radial.clone().multiplyScalar(TUBE_RADIUS - 1.4).add(new Vector3(0, 0, -36));

  camera.position.lerp(position, 0.18);
  camera.up.lerp(radial, 0.15).normalize();
  camera.lookAt(target);
};
