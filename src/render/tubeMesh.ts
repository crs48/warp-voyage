import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
} from "three";

import { CELL_DEPTH, LANE_ANGLE, LANES, VISIBLE_CELLS } from "../game/config";
import { tubePoint } from "./tubeMath";

export type TubeView = {
  readonly group: Group;
  readonly panelPositions: Float32Array;
  readonly panelGeometry: BufferGeometry;
  readonly gridPositions: Float32Array;
  readonly gridGeometry: BufferGeometry;
};

const PANEL_VERTEX_COUNT = VISIBLE_CELLS * LANES * 6;
const GRID_SEGMENT_COUNT = (VISIBLE_CELLS + 1) * LANES + VISIBLE_CELLS * LANES;
const GRID_VERTEX_COUNT = GRID_SEGMENT_COUNT * 2;

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

export const createTubeView = (): TubeView => {
  const group = new Group();
  const panelPositions = new Float32Array(PANEL_VERTEX_COUNT * 3);
  const panelGeometry = new BufferGeometry();
  panelGeometry.setAttribute("position", new BufferAttribute(panelPositions, 3));
  const panelMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    side: DoubleSide,
  });
  const panels = new Mesh(panelGeometry, panelMaterial);

  const gridPositions = new Float32Array(GRID_VERTEX_COUNT * 3);
  const gridGeometry = new BufferGeometry();
  gridGeometry.setAttribute("position", new BufferAttribute(gridPositions, 3));
  const gridMaterial = new LineBasicMaterial({ color: 0x050505 });
  const grid = new LineSegments(gridGeometry, gridMaterial);

  group.add(panels, grid);

  return { group, panelPositions, panelGeometry, gridPositions, gridGeometry };
};

export const updateTubeView = (view: TubeView, distance: number): void => {
  const baseCell = Math.floor(distance / CELL_DEPTH);
  let panelOffset = 0;
  let gridOffset = 0;

  for (let cell = 0; cell < VISIBLE_CELLS; cell += 1) {
    const nearDistance = (baseCell + cell) * CELL_DEPTH;
    const farDistance = nearDistance + CELL_DEPTH;

    for (let lane = 0; lane < LANES; lane += 1) {
      const a0 = lane * LANE_ANGLE;
      const a1 = (lane + 1) * LANE_ANGLE;
      const p00 = tubePoint(nearDistance, a0, distance);
      const p01 = tubePoint(nearDistance, a1, distance);
      const p10 = tubePoint(farDistance, a0, distance);
      const p11 = tubePoint(farDistance, a1, distance);

      panelOffset = writePoint(view.panelPositions, panelOffset, p00);
      panelOffset = writePoint(view.panelPositions, panelOffset, p10);
      panelOffset = writePoint(view.panelPositions, panelOffset, p11);
      panelOffset = writePoint(view.panelPositions, panelOffset, p00);
      panelOffset = writePoint(view.panelPositions, panelOffset, p11);
      panelOffset = writePoint(view.panelPositions, panelOffset, p01);

      gridOffset = writePoint(view.gridPositions, gridOffset, p00);
      gridOffset = writePoint(view.gridPositions, gridOffset, p01);
      gridOffset = writePoint(view.gridPositions, gridOffset, p00);
      gridOffset = writePoint(view.gridPositions, gridOffset, p10);
    }
  }

  const farDistance = (baseCell + VISIBLE_CELLS) * CELL_DEPTH;
  for (let lane = 0; lane < LANES; lane += 1) {
    gridOffset = writePoint(
      view.gridPositions,
      gridOffset,
      tubePoint(farDistance, lane * LANE_ANGLE, distance),
    );
    gridOffset = writePoint(
      view.gridPositions,
      gridOffset,
      tubePoint(farDistance, (lane + 1) * LANE_ANGLE, distance),
    );
  }

  view.panelGeometry.getAttribute("position").needsUpdate = true;
  view.panelGeometry.computeBoundingSphere();
  view.gridGeometry.getAttribute("position").needsUpdate = true;
  view.gridGeometry.computeBoundingSphere();
};
