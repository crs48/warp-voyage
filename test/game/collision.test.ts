import { describe, expect, it } from "vitest";

import { LANE_ANGLE, cellCenterS } from "../../src/tube/space";
import { angleForLane, laneMask } from "../../src/game/coordinates";
import { resolveCollisionFrame, type PlayerState } from "../../src/game/collision";

const playerAtLane = (
  lane: number,
  boostLevel: PlayerState["boostLevel"] = 0,
  distance = cellCenterS(0),
): PlayerState => ({
  distance,
  angle: angleForLane(lane),
  boostLevel,
  shielded: boostLevel > 0,
  invulnerableSeconds: 0,
  status: "running",
});

describe("resolveCollisionFrame", () => {
  it("ends the run when hitting a cube without a boost shield", () => {
    const result = resolveCollisionFrame(playerAtLane(4), {
      cell: 0,
      obstacleMask: laneMask(4),
    });

    expect(result.crashed).toBe(true);
    expect(result.player.status).toBe("gameOver");
  });

  it("spends boost protection instead of ending the run", () => {
    const result = resolveCollisionFrame(playerAtLane(4, 2), {
      cell: 0,
      obstacleMask: laneMask(4),
    });

    expect(result.crashed).toBe(true);
    expect(result.player.status).toBe("running");
    expect(result.player.boostLevel).toBe(0);
    expect(result.player.shielded).toBe(false);
    expect(result.player.invulnerableSeconds).toBeGreaterThan(0);
  });

  it("does not crash before the ship reaches the cube's cell", () => {
    const result = resolveCollisionFrame(playerAtLane(4), {
      cell: 3,
      obstacleMask: laneMask(4),
    });

    expect(result.crashed).toBe(false);
    expect(result.player.status).toBe("running");
  });

  it("does not crash after the ship has already passed the cube", () => {
    const result = resolveCollisionFrame(playerAtLane(4, 0, 6.5), {
      cell: 0,
      obstacleMask: laneMask(4),
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
      cell: 0,
      obstacleMask: laneMask(4),
    });

    expect(result.crashed).toBe(false);
    expect(result.player.status).toBe("running");
  });

  it("crashes on a cube in the adjacent lane the ship is steering through", () => {
    const player = {
      ...playerAtLane(4),
      angle: angleForLane(4) + LANE_ANGLE * 0.6,
    };
    const result = resolveCollisionFrame(player, {
      cell: 0,
      obstacleMask: laneMask(5),
    });

    expect(result.crashed).toBe(true);
  });

  it("collects boost patches up to the cap", () => {
    const result = resolveCollisionFrame(playerAtLane(2, 2), {
      cell: 0,
      obstacleMask: 0,
      boostLane: 2,
    });

    expect(result.collectedBoost).toBe(true);
    expect(result.player.boostLevel).toBe(3);
    expect(result.player.shielded).toBe(true);
  });

  it("does not collect boost patches before overlap", () => {
    const result = resolveCollisionFrame(playerAtLane(2, 2), {
      cell: 3,
      obstacleMask: 0,
      boostLane: 2,
    });

    expect(result.collectedBoost).toBe(false);
    expect(result.player.boostLevel).toBe(2);
  });

  it("ignores collisions while invulnerable after a shielded crash", () => {
    const result = resolveCollisionFrame(
      { ...playerAtLane(4), invulnerableSeconds: 0.5 },
      { cell: 0, obstacleMask: laneMask(4) },
    );

    expect(result.crashed).toBe(false);
    expect(result.player.status).toBe("running");
  });
});
