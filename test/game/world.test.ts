import { describe, expect, it } from "vitest";

import { createWorld, ensureWorldAhead, frameAtDistance } from "../../src/game/world";

describe("world section buffer", () => {
  it("extends sections far enough ahead of the player", () => {
    const world = ensureWorldAhead(createWorld(123, 0), 900);

    expect(world.sections.length).toBeGreaterThan(1);
    expect(world.sections.at(-1)?.endDistance).toBeGreaterThan(900);
  });

  it("returns frame data for a world distance", () => {
    const world = createWorld(123, 0);
    const frame = frameAtDistance(world, 12);

    expect(frame?.section.id).toBe(0);
    expect(frame?.sectionCell).toBe(3);
    expect(typeof frame?.obstacleMask).toBe("number");
  });
});
