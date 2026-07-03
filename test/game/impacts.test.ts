import { describe, expect, it } from "vitest";

import { LANE_ANGLE, cellCenterS } from "../../src/tube/space";
import { angleForLane, laneMask } from "../../src/game/coordinates";
import {
  advanceImpacts,
  detectNearMisses,
  IMPACT_LIFETIME_SECONDS,
  MAX_IMPACTS,
  nearMissStrength,
  type RippleImpact,
} from "../../src/game/impacts";

describe("nearMissStrength", () => {
  it("is silent for a direct hit and for a wide pass", () => {
    // Inside 0.8 lanes the player would clip the cube; past 2.2 it is unremarkable.
    expect(nearMissStrength(0)).toBe(0);
    expect(nearMissStrength(0.5 * LANE_ANGLE)).toBe(0);
    expect(nearMissStrength(0.8 * LANE_ANGLE)).toBe(0);
    expect(nearMissStrength(2.2 * LANE_ANGLE)).toBe(0);
    expect(nearMissStrength(3 * LANE_ANGLE)).toBe(0);
  });

  it("rises as the gap narrows toward the grazing edge", () => {
    const wide = nearMissStrength(1.9 * LANE_ANGLE);
    const mid = nearMissStrength(1.3 * LANE_ANGLE);
    const close = nearMissStrength(0.9 * LANE_ANGLE);

    expect(wide).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(wide);
    expect(close).toBeGreaterThan(mid);
    expect(close).toBeLessThanOrEqual(1);
  });

  it("is symmetric in the sign of the gap", () => {
    expect(nearMissStrength(-1.2 * LANE_ANGLE)).toBeCloseTo(
      nearMissStrength(1.2 * LANE_ANGLE),
      10,
    );
  });
});

describe("detectNearMisses", () => {
  const cell = 10;
  const lane = 3;
  const centerS = cellCenterS(cell);
  const frames = [{ absoluteCell: cell, obstacleMask: laneMask(lane) }];
  // One lane to the side: clears the cube (a miss) but close enough to feel.
  const grazeAngle = angleForLane(lane + 1);

  it("fires once, the frame the player crosses the cube's centre", () => {
    const impacts = detectNearMisses(frames, centerS - 0.5, centerS + 0.5, grazeAngle);
    expect(impacts).toHaveLength(1);
    expect(impacts[0]?.s).toBeCloseTo(centerS);
    expect(impacts[0]?.theta).toBeCloseTo(angleForLane(lane));
    expect(impacts[0]?.age).toBe(0);
    expect(impacts[0]?.strength).toBeGreaterThan(0);
  });

  it("does not re-fire once the centre is behind the player", () => {
    expect(detectNearMisses(frames, centerS + 0.5, centerS + 1.5, grazeAngle)).toHaveLength(0);
  });

  it("does not fire before the player reaches the centre", () => {
    expect(detectNearMisses(frames, centerS - 2, centerS - 1, grazeAngle)).toHaveLength(0);
  });

  it("does not fire on a direct hit", () => {
    // Dead-on the cube's lane: this is a collision, not a near miss.
    expect(
      detectNearMisses(frames, centerS - 0.5, centerS + 0.5, angleForLane(lane)),
    ).toHaveLength(0);
  });

  it("does not fire on a clean pass several lanes away", () => {
    expect(
      detectNearMisses(frames, centerS - 0.5, centerS + 0.5, angleForLane(lane + 3)),
    ).toHaveLength(0);
  });
});

describe("advanceImpacts", () => {
  const impact = (age: number, strength = 1): RippleImpact => ({
    s: 0,
    theta: 0,
    age,
    strength,
  });

  it("ages live impacts and appends new ones", () => {
    const result = advanceImpacts([impact(0.1)], [impact(0)], 0.05);
    expect(result).toHaveLength(2);
    expect(result[0]?.age).toBeCloseTo(0.15);
    expect(result[1]?.age).toBe(0);
  });

  it("drops impacts past their lifetime", () => {
    const result = advanceImpacts([impact(IMPACT_LIFETIME_SECONDS - 0.01)], [], 0.05);
    expect(result).toHaveLength(0);
  });

  it("keeps only the freshest MAX_IMPACTS", () => {
    const many = Array.from({ length: MAX_IMPACTS + 5 }, () => impact(0));
    const result = advanceImpacts(many, [], 0.01);
    expect(result).toHaveLength(MAX_IMPACTS);
  });
});
