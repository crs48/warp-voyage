import { describe, expect, it } from "vitest";

import { corridorMask } from "../../src/game/coordinates";
import { PATTERN_FAMILIES } from "../../src/generation/patterns";
import { generateSection } from "../../src/generation/sections";
import { validateReachability } from "../../src/generation/validate";

describe("generateSection", () => {
  it("cycles through every MVP pattern family", () => {
    const patterns = Array.from({ length: PATTERN_FAMILIES.length }, (_, id) =>
      generateSection({ id, seed: 99, startLane: 0 }).pattern,
    );

    expect(patterns).toEqual(PATTERN_FAMILIES);
  });

  it("keeps the safe corridor clear and reachable", () => {
    const sections = Array.from({ length: 12 }, (_, id) =>
      generateSection({ id, seed: 2026, startLane: id % 12 }),
    );

    expect(
      sections.every((section) =>
        section.obstacleMasks.every((mask, cell) => {
          const safeLane = section.safePath[cell] ?? 0;
          const safeWidth = section.id < 2 ? 2 : 1;
          return (mask & corridorMask(safeLane, safeWidth)) === 0;
        }),
      ),
    ).toBe(true);

    expect(
      sections.every((section) =>
        validateReachability({
          masks: section.obstacleMasks,
          startLane: section.safePath[0] ?? 0,
          maxStepPerCell: 1,
        }),
      ),
    ).toBe(true);
  });
});
