// World-space realization of tube-space coordinates. Everything rendered —
// tube panels, grid lines, cubes, boosts, ship, camera — goes through these
// helpers, so a cell's drawn position is definitionally its collision rect.

import { Matrix4, Quaternion, Vector3 } from "three";

import { bendOffset, type BendParams } from "./centerline";
import { cellCenterS, panelCenterAngle, TUBE_RADIUS } from "./space";

export const radialForAngle = (angle: number, out = new Vector3()): Vector3 =>
  out.set(Math.sin(angle), -Math.cos(angle), 0);

export const inwardForAngle = (angle: number, out = new Vector3()): Vector3 =>
  out.set(-Math.sin(angle), Math.cos(angle), 0);

export const tangentForAngle = (angle: number, out = new Vector3()): Vector3 =>
  out.set(Math.cos(angle), Math.sin(angle), 0);

// Centerline point relative to the render origin (the centerline at the
// player's s), so coordinates stay near zero for float precision.
export const centerlinePoint = (
  s: number,
  originS: number,
  bend: BendParams,
  out = new Vector3(),
): Vector3 => {
  const offset = bendOffset(s, bend);
  const originOffset = bendOffset(originS, bend);
  return out.set(offset.x - originOffset.x, offset.y - originOffset.y, -(s - originS));
};

export const tubePoint = (
  s: number,
  theta: number,
  originS: number,
  bend: BendParams,
  radius = TUBE_RADIUS,
  out = new Vector3(),
): Vector3 => {
  centerlinePoint(s, originS, bend, out);
  return out.set(
    out.x + Math.sin(theta) * radius,
    out.y - Math.cos(theta) * radius,
    out.z,
  );
};

const basisTangent = new Vector3();
const basisInward = new Vector3();
const basisForward = new Vector3(0, 0, 1);
const basisMatrix = new Matrix4();

// Panel-center transform shared by cubes, boosts, and the ship: x along the
// tube tangent, y inward (toward the axis), z along travel. radialInset
// pulls the position off the wall toward the axis.
export const cellTransform = (
  cell: number,
  lane: number,
  originS: number,
  bend: BendParams,
  radialInset: number,
  outPosition: Vector3,
  outQuaternion: Quaternion,
): void => {
  const angle = panelCenterAngle(lane);
  tubePoint(cellCenterS(cell), angle, originS, bend, TUBE_RADIUS - radialInset, outPosition);
  tangentForAngle(angle, basisTangent);
  inwardForAngle(angle, basisInward);
  basisMatrix.makeBasis(basisTangent, basisInward, basisForward);
  outQuaternion.setFromRotationMatrix(basisMatrix);
};
