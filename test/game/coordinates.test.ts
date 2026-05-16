import { describe, expect, it } from "vitest";

import {
  angleForLane,
  corridorMask,
  hasLane,
  laneDistance,
  laneFromAngle,
  normalizeLane,
} from "../../src/game/coordinates";

describe("lane coordinates", () => {
  it("normalizes lane indexes around the tube", () => {
    expect(normalizeLane(-1)).toBe(11);
    expect(normalizeLane(12)).toBe(0);
    expect(normalizeLane(25)).toBe(1);
  });

  it("computes wrapped lane distance", () => {
    expect(laneDistance(0, 11)).toBe(1);
    expect(laneDistance(2, 8)).toBe(6);
  });

  it("maps lane angles back to lanes", () => {
    expect(laneFromAngle(angleForLane(7))).toBe(7);
  });

  it("builds wrapped corridor masks", () => {
    const mask = corridorMask(0, 1);

    expect(hasLane(mask, 11)).toBe(true);
    expect(hasLane(mask, 0)).toBe(true);
    expect(hasLane(mask, 1)).toBe(true);
    expect(hasLane(mask, 2)).toBe(false);
  });
});
