import { describe, expect, it } from "vitest";

import { STRAIGHT_BEND } from "../../src/tube/centerline";
import { CELL_DEPTH, LANES } from "../../src/tube/space";
import { hasLane, lanesFromMask } from "../../src/game/coordinates";
import { createWorld } from "../../src/game/world";
import {
  createTubeView,
  telegraphStrength,
  updateTubeView,
} from "../../src/render/tubeMesh";

const panelLuminance = (
  colors: Float32Array,
  panelIndex: number,
): number => {
  const offset = panelIndex * 6 * 3;
  return (colors[offset] ?? 0) + (colors[offset + 1] ?? 0) + (colors[offset + 2] ?? 0);
};

describe("telegraphStrength", () => {
  it("is silent beyond the horizon and full strength up close", () => {
    expect(telegraphStrength(20)).toBe(0);
    expect(telegraphStrength(10)).toBe(0);
    expect(telegraphStrength(3)).toBe(1);
    expect(telegraphStrength(0)).toBe(1);
  });

  it("grows monotonically as the cell approaches", () => {
    expect(telegraphStrength(8)).toBeGreaterThan(0);
    expect(telegraphStrength(5)).toBeGreaterThan(telegraphStrength(8));
  });
});

describe("updateTubeView telegraph tinting", () => {
  it("darkens panels holding an upcoming cube and leaves clean panels white", () => {
    const world = createWorld(24_681, 0);
    const section = world.sections[0];

    if (section === undefined) {
      throw new Error("expected a generated section");
    }

    // Find a cell with at least one cube and one free lane.
    const cellIndex = section.obstacleMasks.findIndex((mask) => mask !== 0);
    const mask = section.obstacleMasks[cellIndex] ?? 0;
    const cubeLane = lanesFromMask(mask)[0] ?? 0;
    const freeLane = Array.from({ length: LANES }, (_, lane) => lane).find(
      (lane) => !hasLane(mask, lane) && section.boostCells.every((b) => b.cell !== cellIndex || b.lane !== lane),
    );

    if (freeLane === undefined) {
      throw new Error("expected a free lane in the test cell");
    }

    // Stand 4 cells short of the cube: inside the telegraph horizon.
    const playerS = (cellIndex - 4) * CELL_DEPTH;
    const view = createTubeView();
    updateTubeView(view, world, playerS, STRAIGHT_BEND, new Set());

    const baseCell = Math.floor(playerS / CELL_DEPTH);
    const panelRow = cellIndex - baseCell;
    const cubePanel = panelRow * LANES + cubeLane;
    const freePanel = panelRow * LANES + freeLane;

    expect(panelLuminance(view.panelColors, cubePanel)).toBeLessThan(
      panelLuminance(view.panelColors, freePanel) * 0.6,
    );
    expect(panelLuminance(view.panelColors, freePanel)).toBeGreaterThan(2.8);
  });
});
