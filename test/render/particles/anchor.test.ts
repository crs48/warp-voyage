import { describe, expect, it } from "vitest";

import { createBend, STRAIGHT_BEND } from "../../../src/tube/centerline";
import { CELL_DEPTH, TUBE_RADIUS } from "../../../src/tube/space";
import { tubePoint } from "../../../src/tube/transform";
import { anchorWorld, bendToUniformArrays } from "../../../src/render/particles/anchor";

// The point-skin vertex shader realises (windowed-s, theta) into world space on
// the GPU; anchorWorld is its TS twin. This proves the twin — and therefore the
// GLSL it mirrors — agrees with the canonical tubePoint transform, so the two
// can never silently drift.
describe("anchorWorld matches tubePoint", () => {
  const bends = [
    { name: "straight", bend: STRAIGHT_BEND },
    { name: "seeded", bend: createBend(24_681) },
    { name: "other seed", bend: createBend(1_337) },
  ];
  const players = [0, 3.2, 136.7, 812.4, 2_051.9];
  const winValues = [0, 1.5, 4, 37, 120];
  const angles = [0, 1, Math.PI / 2, Math.PI, 5.1];
  const radius = TUBE_RADIUS - 0.08;

  for (const { name, bend } of bends) {
    it(`agrees for the ${name} bend across the window`, () => {
      const arrays = bendToUniformArrays(bend);

      for (const playerS of players) {
        const baseCellS = Math.floor(playerS / CELL_DEPTH) * CELL_DEPTH;

        for (const winS of winValues) {
          for (const theta of angles) {
            const s = baseCellS + winS;
            const expected = tubePoint(s, theta, playerS, bend, radius);
            const actual = anchorWorld(winS, theta, playerS, baseCellS, arrays, radius);

            expect(actual.x).toBeCloseTo(expected.x, 6);
            expect(actual.y).toBeCloseTo(expected.y, 6);
            expect(actual.z).toBeCloseTo(expected.z, 6);
          }
        }
      }
    });
  }

  it("defaults to the full tube radius", () => {
    const actual = anchorWorld(0, 0, 0, 0, bendToUniformArrays(STRAIGHT_BEND));
    const expected = tubePoint(0, 0, 0, STRAIGHT_BEND);
    expect(actual.x).toBeCloseTo(expected.x, 6);
    expect(actual.y).toBeCloseTo(expected.y, 6);
  });
});
