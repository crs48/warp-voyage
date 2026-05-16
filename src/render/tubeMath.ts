import { Vector3 } from "three";

import { CELL_DEPTH, TUBE_RADIUS } from "../game/config";
import { panelCenterAngle, type Lane } from "../game/coordinates";

export const centerlinePoint = (distance: number, originDistance: number): Vector3 =>
  new Vector3(
    Math.sin(distance * 0.012) * 3.2 + Math.sin(distance * 0.004 + 2.1) * 2.4,
    Math.cos(distance * 0.01 + 0.7) * 2.2,
    -(distance - originDistance),
  );

export const radialForAngle = (angle: number): Vector3 =>
  new Vector3(Math.sin(angle), -Math.cos(angle), 0).normalize();

export const inwardForAngle = (angle: number): Vector3 =>
  radialForAngle(angle).negate();

export const tangentForAngle = (angle: number): Vector3 =>
  new Vector3(Math.cos(angle), Math.sin(angle), 0).normalize();

export const tubePoint = (
  distance: number,
  angle: number,
  originDistance: number,
  radius = TUBE_RADIUS,
): Vector3 =>
  centerlinePoint(distance, originDistance)
    .sub(centerlinePoint(originDistance, originDistance))
    .add(radialForAngle(angle).multiplyScalar(radius));

export const lanePanelPoint = (
  cell: number,
  lane: Lane,
  originDistance: number,
  inwardOffset: number,
): Vector3 =>
  tubePoint(
    cell * CELL_DEPTH + CELL_DEPTH * 0.5,
    panelCenterAngle(lane),
    originDistance,
    TUBE_RADIUS - inwardOffset,
  );
