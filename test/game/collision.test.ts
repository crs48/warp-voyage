import { describe, expect, it } from "vitest";

import { LANE_ANGLE } from "../../src/game/config";
import { angleForLane, laneMask } from "../../src/game/coordinates";
import { resolveCollisionFrame, type PlayerState } from "../../src/game/collision";

const playerAtLane = (
  lane: number,
  boostLevel: PlayerState["boostLevel"] = 0,
): PlayerState => ({
  distance: 0,
  angle: angleForLane(lane),
  boostLevel,
  shielded: boostLevel > 0,
  invulnerableSeconds: 0,
  status: "running",
});

describe("resolveCollisionFrame", () => {
  it("ends the run when hitting a cube without a boost shield", () => {
    const result = resolveCollisionFrame(playerAtLane(4), {
      obstacleMask: laneMask(4),
    });

    expect(result.crashed).toBe(true);
    expect(result.player.status).toBe("gameOver");
  });

  it("spends boost protection instead of ending the run", () => {
    const result = resolveCollisionFrame(playerAtLane(4, 2), {
      obstacleMask: laneMask(4),
    });

    expect(result.crashed).toBe(true);
    expect(result.player.status).toBe("running");
    expect(result.player.boostLevel).toBe(0);
    expect(result.player.shielded).toBe(false);
    expect(result.player.invulnerableSeconds).toBeGreaterThan(0);
  });

  it("does not crash until the ship visually overlaps the cube distance", () => {
    const result = resolveCollisionFrame(playerAtLane(4), {
      obstacleMask: laneMask(4),
      obstacleCenterDistance: 12,
    });

    expect(result.crashed).toBe(false);
    expect(result.player.status).toBe("running");
  });

  it("does not crash when the ship is outside the cube angular overlap", () => {
    const player = {
      ...playerAtLane(4),
      angle: angleForLane(4) + LANE_ANGLE * 0.9,
    };
    const result = resolveCollisionFrame(player, {
      obstacleMask: laneMask(4),
      obstacleCenterDistance: 0,
    });

    expect(result.crashed).toBe(false);
    expect(result.player.status).toBe("running");
  });

  it("collects boost patches up to the cap", () => {
    const result = resolveCollisionFrame(playerAtLane(2, 2), {
      obstacleMask: 0,
      boostLane: 2,
    });

    expect(result.collectedBoost).toBe(true);
    expect(result.player.boostLevel).toBe(3);
    expect(result.player.shielded).toBe(true);
  });

  it("does not collect boost patches before overlap", () => {
    const result = resolveCollisionFrame(playerAtLane(2, 2), {
      obstacleMask: 0,
      boostLane: 2,
      boostCenterDistance: 12,
    });

    expect(result.collectedBoost).toBe(false);
    expect(result.player.boostLevel).toBe(2);
  });
});
