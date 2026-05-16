import { describe, expect, it } from "vitest";

import { createRng } from "../../src/generation/rng";

describe("createRng", () => {
  it("produces deterministic sequences from the same seed", () => {
    const first = createRng(1234);
    const second = createRng(1234);

    const firstValues = Array.from({ length: 8 }, () => first.next());
    const secondValues = Array.from({ length: 8 }, () => second.next());

    expect(firstValues).toEqual(secondValues);
  });

  it("bounds integer generation to the requested half-open range", () => {
    const rng = createRng(42);

    const values = Array.from({ length: 100 }, () => rng.nextInt(3, 7));

    expect(values.every((value) => value >= 3 && value < 7)).toBe(true);
  });
});
