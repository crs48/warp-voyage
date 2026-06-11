import { describe, expect, it } from "vitest";

import { STRAIGHT_BEND } from "../../src/tube/centerline";
import { CELL_DEPTH, LANES, TELEGRAPH_FAR_CELLS } from "../../src/tube/space";
import { hasLane, lanesFromMask } from "../../src/game/coordinates";
import { createWorld } from "../../src/game/world";
import { trailStrength } from "../../src/render/telegraph";
import { createTubeView, updateTubeView } from "../../src/render/tubeMesh";

const panelLuminance = (colors: Float32Array, panelIndex: number): number => {
  const offset = panelIndex * 6 * 3;
  return (colors[offset] ?? 0) + (colors[offset + 1] ?? 0) + (colors[offset + 2] ?? 0);
};

describe("trailStrength", () => {
  it("is full on the target cell and silent beyond the horizon", () => {
    expect(trailStrength(0)).toBe(1);
    expect(trailStrength(TELEGRAPH_FAR_CELLS)).toBe(0);
    expect(trailStrength(TELEGRAPH_FAR_CELLS + 5)).toBe(0);
  });

  it("grows monotonically toward the target", () => {
    expect(trailStrength(10)).toBeGreaterThan(0);
    expect(trailStrength(5)).toBeGreaterThan(trailStrength(10));
    expect(trailStrength(1)).toBeGreaterThan(trailStrength(5));
  });
});

// Find a cube whose lane is clear for `clearCells` cells before it, so the
// approach trail belongs to that cube alone.
const findCubeWithClearApproach = (
  masks: readonly number[],
  clearCells: number,
): { readonly cell: number; readonly lane: number } => {
  for (let cell = clearCells; cell < masks.length; cell += 1) {
    for (const lane of lanesFromMask(masks[cell] ?? 0)) {
      const approachClear = Array.from(
        { length: clearCells },
        (_, index) => masks[cell - 1 - index] ?? 0,
      ).every((mask) => !hasLane(mask, lane));

      if (approachClear) {
        return { cell, lane };
      }
    }
  }

  throw new Error("no cube with a clear approach found");
};

describe("updateTubeView telegraph trail", () => {
  it("paints a darkening runway in the cube's lane before the cube", () => {
    const world = createWorld(24_681, 0);
    const section = world.sections[0];

    if (section === undefined) {
      throw new Error("expected a generated section");
    }

    const cube = findCubeWithClearApproach(section.obstacleMasks, 5);
    const baseCell = cube.cell - 6;
    const playerS = baseCell * CELL_DEPTH;
    const view = createTubeView();
    updateTubeView(view, world, playerS, STRAIGHT_BEND, new Set());

    const panelAt = (cellsBeforeCube: number): number =>
      (cube.cell - baseCell - cellsBeforeCube) * LANES + cube.lane;

    const nearCube = panelLuminance(view.panelColors, panelAt(1));
    const farFromCube = panelLuminance(view.panelColors, panelAt(5));

    // The runway exists (both darker than white)…
    expect(nearCube).toBeLessThan(2.8);
    expect(farFromCube).toBeLessThan(2.87);
    // …and darkens as it approaches the cube.
    expect(nearCube).toBeLessThan(farFromCube);
  });

  it("leaves lanes with nothing ahead pure white", () => {
    const world = createWorld(24_681, 0);
    const view = createTubeView();
    updateTubeView(view, world, 0, STRAIGHT_BEND, new Set());

    // The spawn zone row: some lane must have no cube or boost within the
    // telegraph horizon and stay at full white.
    const whitePanels = Array.from({ length: LANES }, (_, lane) =>
      panelLuminance(view.panelColors, lane),
    ).filter((luminance) => luminance > 2.85);

    expect(whitePanels.length).toBeGreaterThan(0);
  });
});

describe("updateTubeView grid", () => {
  it("draws longitudinal lane edges spanning the cell depth, not just rings", () => {
    const world = createWorld(24_681, 0);
    const view = createTubeView();
    updateTubeView(view, world, 0, STRAIGHT_BEND, new Set());

    // Each panel writes 2 segments: ring (verts 0-1) then longitudinal
    // (verts 2-3). The longitudinal segment must span CELL_DEPTH in z.
    const zOf = (vertex: number): number => view.gridPositions[vertex * 3 + 2] ?? 0;

    expect(Math.abs(zOf(2) - zOf(3))).toBeCloseTo(CELL_DEPTH);
    // And the ring segment stays at constant depth.
    expect(Math.abs(zOf(0) - zOf(1))).toBeCloseTo(0);
  });
});
