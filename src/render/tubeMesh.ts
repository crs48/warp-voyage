import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";

import {
  CELL_DEPTH,
  LANE_ANGLE,
  LANES,
  TELEGRAPH_FAR_CELLS,
  TELEGRAPH_NEAR_CELLS,
  VISIBLE_CELLS,
} from "../tube/space";
import type { BendParams } from "../tube/centerline";
import { tubePoint } from "../tube/transform";
import { hasLane } from "../game/coordinates";
import { boostKey, frameAtDistance, type World } from "../game/world";

export type TubeView = {
  readonly group: Group;
  readonly panelPositions: Float32Array;
  readonly panelColors: Float32Array;
  readonly panelGeometry: BufferGeometry;
  readonly gridPositions: Float32Array;
  readonly gridGeometry: BufferGeometry;
};

const PANEL_VERTEX_COUNT = VISIBLE_CELLS * LANES * 6;
const GRID_SEGMENT_COUNT = (VISIBLE_CELLS + 1) * LANES + VISIBLE_CELLS * LANES;
const GRID_VERTEX_COUNT = GRID_SEGMENT_COUNT * 2;

const TUBE_WHITE = [0.96, 0.96, 0.95] as const;
const CUBE_TINT = [0.05, 0.05, 0.06] as const;
const BOOST_TINT = [0.0, 0.84, 1.0] as const;

const scratch = new Vector3();

const writePoint = (
  target: Float32Array,
  offset: number,
  point: { readonly x: number; readonly y: number; readonly z: number },
): number => {
  target[offset] = point.x;
  target[offset + 1] = point.y;
  target[offset + 2] = point.z;
  return offset + 3;
};

const writePanelColor = (
  target: Float32Array,
  panelIndex: number,
  tint: readonly [number, number, number] | typeof TUBE_WHITE,
  mix: number,
): void => {
  const red = TUBE_WHITE[0] + (tint[0] - TUBE_WHITE[0]) * mix;
  const green = TUBE_WHITE[1] + (tint[1] - TUBE_WHITE[1]) * mix;
  const blue = TUBE_WHITE[2] + (tint[2] - TUBE_WHITE[2]) * mix;

  for (let vertex = 0; vertex < 6; vertex += 1) {
    const offset = (panelIndex * 6 + vertex) * 3;
    target[offset] = red;
    target[offset + 1] = green;
    target[offset + 2] = blue;
  }
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// Telegraph strength for a cell whose near edge is `aheadCells` in front of
// the player: 0 beyond FAR, eased up to 1 at NEAR and closer.
export const telegraphStrength = (aheadCells: number): number => {
  const linear = clamp01(
    (TELEGRAPH_FAR_CELLS - aheadCells) / (TELEGRAPH_FAR_CELLS - TELEGRAPH_NEAR_CELLS),
  );
  return linear * linear;
};

export const createTubeView = (): TubeView => {
  const group = new Group();
  const panelPositions = new Float32Array(PANEL_VERTEX_COUNT * 3);
  const panelColors = new Float32Array(PANEL_VERTEX_COUNT * 3);
  const panelGeometry = new BufferGeometry();
  panelGeometry.setAttribute("position", new BufferAttribute(panelPositions, 3));
  panelGeometry.setAttribute("color", new BufferAttribute(panelColors, 3));
  const panelMaterial = new MeshBasicMaterial({
    vertexColors: true,
    side: DoubleSide,
  });
  const panels = new Mesh(panelGeometry, panelMaterial);

  const gridPositions = new Float32Array(GRID_VERTEX_COUNT * 3);
  const gridGeometry = new BufferGeometry();
  gridGeometry.setAttribute("position", new BufferAttribute(gridPositions, 3));
  const gridMaterial = new LineBasicMaterial({ color: 0x111111 });
  const grid = new LineSegments(gridGeometry, gridMaterial);

  group.add(panels, grid);

  return {
    group,
    panelPositions,
    panelColors,
    panelGeometry,
    gridPositions,
    gridGeometry,
  };
};

export const updateTubeView = (
  view: TubeView,
  world: World,
  playerS: number,
  bend: BendParams,
  collectedBoosts: ReadonlySet<string>,
): void => {
  const baseCell = Math.floor(playerS / CELL_DEPTH);
  let panelOffset = 0;
  let gridOffset = 0;
  let panelIndex = 0;

  for (let cellOffset = 0; cellOffset < VISIBLE_CELLS; cellOffset += 1) {
    const absoluteCell = baseCell + cellOffset;
    const nearDistance = absoluteCell * CELL_DEPTH;
    const farDistance = nearDistance + CELL_DEPTH;
    const frame = frameAtDistance(world, nearDistance + CELL_DEPTH * 0.5);
    const aheadCells = (nearDistance - playerS) / CELL_DEPTH;
    const warn = telegraphStrength(aheadCells);
    const boostLane =
      frame?.boost !== undefined &&
      !collectedBoosts.has(boostKey(frame.section.id, frame.boost.cell))
        ? frame.boost.lane
        : undefined;

    for (let lane = 0; lane < LANES; lane += 1) {
      const a0 = lane * LANE_ANGLE;
      const a1 = (lane + 1) * LANE_ANGLE;

      panelOffset = writePoint(
        view.panelPositions,
        panelOffset,
        tubePoint(nearDistance, a0, playerS, bend, undefined, scratch),
      );
      const p10 = tubePoint(farDistance, a0, playerS, bend, undefined, scratch);
      panelOffset = writePoint(view.panelPositions, panelOffset, p10);
      const p11 = tubePoint(farDistance, a1, playerS, bend, undefined, scratch);
      panelOffset = writePoint(view.panelPositions, panelOffset, p11);
      panelOffset = writePoint(
        view.panelPositions,
        panelOffset,
        tubePoint(nearDistance, a0, playerS, bend, undefined, scratch),
      );
      panelOffset = writePoint(
        view.panelPositions,
        panelOffset,
        tubePoint(farDistance, a1, playerS, bend, undefined, scratch),
      );
      panelOffset = writePoint(
        view.panelPositions,
        panelOffset,
        tubePoint(nearDistance, a1, playerS, bend, undefined, scratch),
      );

      gridOffset = writePoint(
        view.gridPositions,
        gridOffset,
        tubePoint(nearDistance, a0, playerS, bend, undefined, scratch),
      );
      gridOffset = writePoint(
        view.gridPositions,
        gridOffset,
        tubePoint(nearDistance, a1, playerS, bend, undefined, scratch),
      );
      gridOffset = writePoint(
        view.gridPositions,
        gridOffset,
        tubePoint(nearDistance, a0, playerS, bend, undefined, scratch),
      );
      gridOffset = writePoint(view.gridPositions, gridOffset, p10);

      if (frame !== undefined && hasLane(frame.obstacleMask, lane)) {
        writePanelColor(view.panelColors, panelIndex, CUBE_TINT, warn * 0.85);
      } else if (boostLane === lane) {
        writePanelColor(view.panelColors, panelIndex, BOOST_TINT, warn * 0.9);
      } else {
        writePanelColor(view.panelColors, panelIndex, TUBE_WHITE, 0);
      }

      panelIndex += 1;
    }
  }

  const farDistance = (baseCell + VISIBLE_CELLS) * CELL_DEPTH;
  for (let lane = 0; lane < LANES; lane += 1) {
    gridOffset = writePoint(
      view.gridPositions,
      gridOffset,
      tubePoint(farDistance, lane * LANE_ANGLE, playerS, bend, undefined, scratch),
    );
    gridOffset = writePoint(
      view.gridPositions,
      gridOffset,
      tubePoint(farDistance, (lane + 1) * LANE_ANGLE, playerS, bend, undefined, scratch),
    );
  }

  view.panelGeometry.getAttribute("position").needsUpdate = true;
  view.panelGeometry.getAttribute("color").needsUpdate = true;
  view.panelGeometry.computeBoundingSphere();
  view.gridGeometry.getAttribute("position").needsUpdate = true;
  view.gridGeometry.computeBoundingSphere();
};
