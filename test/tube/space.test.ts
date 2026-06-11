import { describe, expect, it } from "vitest";

import { Quaternion, Vector3 } from "three";

import { STRAIGHT_BEND, bendOffset, createBend } from "../../src/tube/centerline";
import {
  CELL_DEPTH,
  LANE_ANGLE,
  LANES,
  TUBE_RADIUS,
  cellCenterS,
  cellRect,
  overlaps,
  panelCenterAngle,
  playerRect,
} from "../../src/tube/space";
import { cellTransform, tubePoint } from "../../src/tube/transform";

describe("cellRect", () => {
  it("tiles the tube exactly: one cell deep, one lane wide", () => {
    const rect = cellRect(3, 5);

    expect(rect.s0).toBe(3 * CELL_DEPTH);
    expect(rect.s1).toBe(4 * CELL_DEPTH);
    expect(rect.theta0).toBeCloseTo(5 * LANE_ANGLE);
    expect(rect.theta1).toBeCloseTo(6 * LANE_ANGLE);
  });
});

describe("overlaps", () => {
  it("hits when the player rect is inside an occupied cell", () => {
    const player = playerRect(cellCenterS(2), panelCenterAngle(4));

    expect(overlaps(player, cellRect(2, 4))).toBe(true);
  });

  it("misses cells ahead and behind in s", () => {
    const player = playerRect(cellCenterS(2), panelCenterAngle(4));

    expect(overlaps(player, cellRect(4, 4))).toBe(false);
    expect(overlaps(player, cellRect(0, 4))).toBe(false);
  });

  it("misses laterally adjacent lanes from a lane center", () => {
    const player = playerRect(cellCenterS(2), panelCenterAngle(4));

    expect(overlaps(player, cellRect(2, 3))).toBe(false);
    expect(overlaps(player, cellRect(2, 5))).toBe(false);
  });

  it("handles angular wraparound between lane 11 and lane 0", () => {
    const nearSeam = playerRect(cellCenterS(2), LANES * LANE_ANGLE - 0.01);

    expect(overlaps(nearSeam, cellRect(2, 11))).toBe(true);
    expect(overlaps(nearSeam, cellRect(2, 0))).toBe(true);
    expect(overlaps(nearSeam, cellRect(2, 6))).toBe(false);
  });

  it("handles player angles outside [0, 2π)", () => {
    const player = playerRect(cellCenterS(2), panelCenterAngle(4) - Math.PI * 4);

    expect(overlaps(player, cellRect(2, 4))).toBe(true);
  });
});

describe("cellTransform", () => {
  it("places a cube exactly at its cellRect center on the wall", () => {
    const position = new Vector3();
    const quaternion = new Quaternion();
    const inset = 1.2;
    cellTransform(7, 3, 0, STRAIGHT_BEND, inset, position, quaternion);

    const expected = tubePoint(
      cellCenterS(7),
      panelCenterAngle(3),
      0,
      STRAIGHT_BEND,
      TUBE_RADIUS - inset,
    );

    expect(position.distanceTo(expected)).toBeLessThan(1e-9);
  });

  it("keeps cubes glued to the wall when the tube bends", () => {
    const bend = createBend(42);
    const position = new Vector3();
    const quaternion = new Quaternion();
    cellTransform(50, 0, 0, bend, 0, position, quaternion);

    const center = tubePoint(cellCenterS(50), panelCenterAngle(0), 0, bend, 0);

    expect(position.distanceTo(center)).toBeCloseTo(TUBE_RADIUS);
  });
});

describe("bendOffset", () => {
  it("starts straight and ramps in over the warmup stretch", () => {
    const bend = createBend(1337);

    const start = bendOffset(0, bend);
    expect(start.x).toBeCloseTo(0);
    expect(start.y).toBeCloseTo(0);
    const far = bendOffset(2_000, bend);
    expect(Math.abs(far.x) + Math.abs(far.y)).toBeGreaterThan(0);
  });
});
