import { describe, expect, it } from "vitest";

import { laneMask, type LaneMask } from "../../src/game/coordinates";
import { validateReachability } from "../../src/generation/validate";

const blockAllExcept = (...openLanes: readonly number[]): LaneMask =>
  Array.from({ length: 12 }, (_, lane) => lane)
    .filter((lane) => !openLanes.includes(lane))
    .reduce<LaneMask>((mask, lane) => mask | laneMask(lane), 0);

describe("validateReachability", () => {
  it("accepts a path that wraps around the lane 11 → lane 0 seam", () => {
    // Only lanes 11 and 0 are ever open; reaching lane 11 from lane 0
    // requires stepping across the seam, which must count as adjacent.
    const masks = [
      blockAllExcept(0, 11),
      blockAllExcept(11),
      blockAllExcept(11, 0),
      blockAllExcept(0),
    ];

    expect(
      validateReachability({ masks, startLane: 0, maxStepPerCell: 1 }),
    ).toBe(true);
  });

  it("rejects a field with no survivable lane sequence", () => {
    const masks = [
      blockAllExcept(0),
      blockAllExcept(6),
    ];

    expect(
      validateReachability({ masks, startLane: 0, maxStepPerCell: 1 }),
    ).toBe(false);
  });
});
