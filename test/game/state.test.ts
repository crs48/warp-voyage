import { describe, expect, it } from "vitest";

import { advancePlayer, createInitialPlayer, speedForBoostLevel } from "../../src/game/state";

describe("game state", () => {
  it("scales speed by boost level", () => {
    expect(speedForBoostLevel(0)).toBeLessThan(speedForBoostLevel(1));
    expect(speedForBoostLevel(3)).toBe(speedForBoostLevel(0) * 4);
  });

  it("advances distance and steering intent with a clamped delta", () => {
    const player = createInitialPlayer();
    const advanced = advancePlayer(player, { steer: 1 }, 1);

    expect(advanced.distance).toBeCloseTo(speedForBoostLevel(0) * 0.05);
    expect(advanced.angle).toBeGreaterThan(player.angle);
  });
});
