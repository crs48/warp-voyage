import { Vector3 } from "three";

import { CELL_DEPTH, LANE_ANGLE, TUBE_RADIUS } from "../game/config";
import type { Lane } from "../game/coordinates";

export const centerlinePoint = (distance: number, originDistance: number): Vector3 =>
  new Vector3(
    Math.sin(distance * 0.012) * 3.2 + Math.sin(distance * 0.004 + 2.1) * 2.4,
    Math.cos(distance * 0.01 + 0.7) * 2.2,
    -(distance - originDistance),
  );

export const radialForAngle = (angle: number): Vector3 =>
  new Vector3(Math.sin(angle), -Math.cos(angle), 0).normalize();

export const tubePoint = (
  distance: number,
  angle: number,
  originDistance: number,
  radius = TUBE_RADIUS,
): Vector3 =>
  centerlinePoint(distance, originDistance)
    .sub(centerlinePoint(originDistance, originDistance))
    .add(radialForAngle(angle).multiplyScalar(radius));

export const laneCenterPoint = (
  cell: number,
  lane: Lane,
  originDistance: number,
  radialOffset = -0.55,
): Vector3 =>
  tubePoint(
    cell * CELL_DEPTH + CELL_DEPTH * 0.5,
    lane * LANE_ANGLE,
    originDistance,
    TUBE_RADIUS + radialOffset,
  );
