import { describe, expect, it } from "vitest";

import { magnetizationCoherence } from "../../../src/render/particles/coherence";

const FAR = Number.POSITIVE_INFINITY;

describe("magnetizationCoherence", () => {
  it("always stays within [0, 1]", () => {
    for (let t = 0; t < 60; t += 0.37) {
      for (const boostLevel of [0, 1, 2, 3]) {
        for (const obstacleDistance of [0, 5, 11, 22, 50, FAR]) {
          const value = magnetizationCoherence({ timeSeconds: t, boostLevel, obstacleDistance });
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("breathes over time when nothing else is acting", () => {
    const samples = Array.from({ length: 48 }, (_, index) =>
      magnetizationCoherence({ timeSeconds: index * 0.25, boostLevel: 0, obstacleDistance: FAR }),
    );
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    // A visible in-and-out swing, never a hard toggle.
    expect(max - min).toBeGreaterThan(0.3);
    expect(min).toBeGreaterThanOrEqual(0);
  });

  it("rises with boost level", () => {
    const none = magnetizationCoherence({ timeSeconds: 0, boostLevel: 0, obstacleDistance: FAR });
    const some = magnetizationCoherence({ timeSeconds: 0, boostLevel: 1, obstacleDistance: FAR });
    const full = magnetizationCoherence({ timeSeconds: 0, boostLevel: 3, obstacleDistance: FAR });

    expect(some).toBeGreaterThan(none);
    expect(full).toBeGreaterThan(some);
  });

  it("is damped toward zero as danger closes in, so danger reads crisp", () => {
    const inputs = { timeSeconds: 0, boostLevel: 3 } as const;
    const far = magnetizationCoherence({ ...inputs, obstacleDistance: FAR });
    const near = magnetizationCoherence({ ...inputs, obstacleDistance: 11 });
    const onTop = magnetizationCoherence({ ...inputs, obstacleDistance: 0 });

    expect(near).toBeLessThan(far);
    expect(onTop).toBe(0);
  });

  it("ignores obstacles beyond the danger range", () => {
    const far = magnetizationCoherence({ timeSeconds: 3, boostLevel: 2, obstacleDistance: FAR });
    const justOutside = magnetizationCoherence({ timeSeconds: 3, boostLevel: 2, obstacleDistance: 40 });
    expect(justOutside).toBeCloseTo(far, 10);
  });
});
