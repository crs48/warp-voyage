// Tube-space debug view (toggle with "h"): draws the (s, θ) grid the
// collision code actually tests — cubes, boosts, telegraph shading, and the
// player rect — so hitbox tuning is done against the source of truth.

import {
  CELL_DEPTH,
  LANE_ANGLE,
  LANES,
  PLAYER_HALF_ANGLE,
  PLAYER_HALF_DEPTH,
} from "../tube/space";
import { hasLane } from "../game/coordinates";
import { frameAtDistance, type World } from "../game/world";
import { cubeColorCss } from "./palette";
import { computeTelegraphField } from "./telegraph";

export type DebugOverlay = {
  readonly canvas: HTMLCanvasElement;
  visible: boolean;
};

const ROWS = 24;
const CELL_PX = 16;
const ROW_PX = 10;
const WIDTH = LANES * CELL_PX;
const HEIGHT = ROWS * ROW_PX;

export const createDebugOverlay = (host: HTMLElement): DebugOverlay => {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.className = "debug-overlay";
  canvas.style.cssText =
    "position:fixed;left:12px;bottom:12px;background:rgba(255,255,255,0.92);" +
    "border:1px solid #111;display:none;image-rendering:pixelated;";
  host.append(canvas);

  const overlay: DebugOverlay = { canvas, visible: false };

  window.addEventListener("keydown", (event) => {
    if (event.key === "h" || event.key === "H") {
      overlay.visible = !overlay.visible;
      canvas.style.display = overlay.visible ? "block" : "none";
    }
  });

  return overlay;
};

const TWO_PI = Math.PI * 2;

export const updateDebugOverlay = (
  overlay: DebugOverlay,
  world: World,
  playerS: number,
  playerAngle: number,
  collectedBoosts: ReadonlySet<string>,
  horizonCells?: number,
): void => {
  if (!overlay.visible) {
    return;
  }

  const context = overlay.canvas.getContext("2d");

  if (context === null) {
    return;
  }

  context.clearRect(0, 0, WIDTH, HEIGHT);
  const baseCell = Math.floor(playerS / CELL_DEPTH);
  const telegraph = computeTelegraphField(world, baseCell, collectedBoosts, horizonCells);

  for (let row = 0; row < ROWS; row += 1) {
    const absoluteCell = baseCell + row;
    const frame = frameAtDistance(world, absoluteCell * CELL_DEPTH + CELL_DEPTH * 0.5);
    const y = HEIGHT - (row + 1) * ROW_PX;

    for (let lane = 0; lane < LANES; lane += 1) {
      const x = lane * CELL_PX;
      const index = row * LANES + lane;

      if (frame !== undefined && hasLane(frame.obstacleMask, lane)) {
        context.fillStyle = cubeColorCss(frame.colorIndex, 0.95);
        context.fillRect(x, y, CELL_PX, ROW_PX);
      } else if (frame?.boost?.lane === lane) {
        context.fillStyle = "rgba(0, 213, 255, 0.9)";
        context.fillRect(x, y, CELL_PX, ROW_PX);
      } else if ((telegraph.cube[index] ?? 0) > 0) {
        context.fillStyle = cubeColorCss(
          telegraph.colorIndex[index] ?? 0,
          (telegraph.cube[index] ?? 0) * 0.5,
        );
        context.fillRect(x, y, CELL_PX, ROW_PX);
      } else if ((telegraph.boost[index] ?? 0) > 0) {
        context.fillStyle = `rgba(0, 213, 255, ${String((telegraph.boost[index] ?? 0) * 0.4)})`;
        context.fillRect(x, y, CELL_PX, ROW_PX);
      }

      context.strokeStyle = "rgba(0, 0, 0, 0.15)";
      context.strokeRect(x + 0.5, y + 0.5, CELL_PX, ROW_PX);
    }
  }

  // Player rect in tube space; drawn twice when it crosses the lane seam.
  const theta = ((playerAngle % TWO_PI) + TWO_PI) % TWO_PI;
  const centerX = (theta / LANE_ANGLE) * CELL_PX;
  const halfWidth = (PLAYER_HALF_ANGLE / LANE_ANGLE) * CELL_PX;
  const halfHeight = (PLAYER_HALF_DEPTH / CELL_DEPTH) * ROW_PX;
  const centerY = HEIGHT - ((playerS - baseCell * CELL_DEPTH) / CELL_DEPTH) * ROW_PX;

  context.strokeStyle = "#ff2555";
  context.lineWidth = 2;
  for (const offset of [0, -WIDTH, WIDTH]) {
    context.strokeRect(
      centerX - halfWidth + offset,
      centerY - halfHeight,
      halfWidth * 2,
      halfHeight * 2,
    );
  }
  context.lineWidth = 1;
};
