import { PerspectiveCamera, Vector3 } from "three";

import { TUBE_RADIUS } from "../tube/space";
import type { BendParams } from "../tube/centerline";
import { centerlinePoint, radialForAngle } from "../tube/transform";

// The "tube rotates around the player" feel: the camera's roll is locked to
// a damped copy of the player's angle, so the ship stays at screen-bottom
// and steering visibly spins the world.
export type CameraRig = {
  readonly camera: PerspectiveCamera;
  angle: number;
};

const CAMERA_RADIAL_INSET = 3.1;
const CAMERA_BEHIND = 8;
const LOOK_AHEAD = 14;
const LOOK_RADIAL_BIAS = 0.45;
const ROLL_DAMPING = 12;

export const createCameraRig = (): CameraRig => {
  const camera = new PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    260,
  );
  camera.position.set(0, -(TUBE_RADIUS - CAMERA_RADIAL_INSET), CAMERA_BEHIND);
  return { camera, angle: 0 };
};

const shortestAngleDelta = (from: number, to: number): number => {
  const fullTurn = Math.PI * 2;
  return ((((to - from) % fullTurn) + fullTurn * 1.5) % fullTurn) - Math.PI;
};

const radial = new Vector3();
const lookTarget = new Vector3();

export const updateCameraRig = (
  rig: CameraRig,
  playerAngle: number,
  playerS: number,
  bend: BendParams,
  dtSeconds: number,
): void => {
  const damp = 1 - Math.exp(-ROLL_DAMPING * Math.max(0, dtSeconds));
  rig.angle += shortestAngleDelta(rig.angle, playerAngle) * damp;

  radialForAngle(rig.angle, radial);
  rig.camera.position
    .copy(radial)
    .multiplyScalar(TUBE_RADIUS - CAMERA_RADIAL_INSET)
    .add(lookTarget.set(0, 0, CAMERA_BEHIND));
  rig.camera.up.copy(radial).negate();

  centerlinePoint(playerS + LOOK_AHEAD, playerS, bend, lookTarget)
    .addScaledVector(radial, TUBE_RADIUS * LOOK_RADIAL_BIAS);
  rig.camera.lookAt(lookTarget);
};
