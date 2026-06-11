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
  VISIBLE_CELLS,
} from "../tube/space";
import type { BendParams } from "../tube/centerline";
import { tubePoint } from "../tube/transform";
import { cubeColorFor } from "./palette";
import { computeTelegraphField } from "./telegraph";
import type { World } from "../game/world";

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

const TUBE_WHITE = { r: 0.96, g: 0.96, b: 0.95 } as const;
const BOOST_TINT = { r: 0.0, g: 0.84, b: 1.0 } as const;

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
  tint: { readonly r: number; readonly g: number; readonly b: number },
  mix: number,
): void => {
  const red = TUBE_WHITE.r + (tint.r - TUBE_WHITE.r) * mix;
  const green = TUBE_WHITE.g + (tint.g - TUBE_WHITE.g) * mix;
  const blue = TUBE_WHITE.b + (tint.b - TUBE_WHITE.b) * mix;

  for (let vertex = 0; vertex < 6; vertex += 1) {
    const offset = (panelIndex * 6 + vertex) * 3;
    target[offset] = red;
    target[offset + 1] = green;
    target[offset + 2] = blue;
  }
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
  speedFactor = 1,
): void => {
  const baseCell = Math.floor(playerS / CELL_DEPTH);
  // Faster play needs earlier warnings: the trail horizon stretches with
  // the boost multiplier, capped just inside the render window.
  const horizonCells = Math.min(
    VISIBLE_CELLS - 2,
    Math.round(TELEGRAPH_FAR_CELLS * speedFactor),
  );
  const telegraph = computeTelegraphField(world, baseCell, collectedBoosts, horizonCells);
  let panelOffset = 0;
  let gridOffset = 0;
  let panelIndex = 0;

  for (let cellOffset = 0; cellOffset < VISIBLE_CELLS; cellOffset += 1) {
    const nearDistance = (baseCell + cellOffset) * CELL_DEPTH;
    const farDistance = nearDistance + CELL_DEPTH;

    for (let lane = 0; lane < LANES; lane += 1) {
      const a0 = lane * LANE_ANGLE;
      const a1 = (lane + 1) * LANE_ANGLE;

      // Two triangles per panel; every point is written immediately because
      // tubePoint reuses one scratch vector.
      panelOffset = writePoint(
        view.panelPositions,
        panelOffset,
        tubePoint(nearDistance, a0, playerS, bend, undefined, scratch),
      );
      panelOffset = writePoint(
        view.panelPositions,
        panelOffset,
        tubePoint(farDistance, a0, playerS, bend, undefined, scratch),
      );
      panelOffset = writePoint(
        view.panelPositions,
        panelOffset,
        tubePoint(farDistance, a1, playerS, bend, undefined, scratch),
      );
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

      // Ring segment along the cell's near edge…
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
      // …and the longitudinal segment along the lane edge, so panels read
      // as squares instead of rings.
      gridOffset = writePoint(
        view.gridPositions,
        gridOffset,
        tubePoint(nearDistance, a0, playerS, bend, undefined, scratch),
      );
      gridOffset = writePoint(
        view.gridPositions,
        gridOffset,
        tubePoint(farDistance, a0, playerS, bend, undefined, scratch),
      );

      const cubeStrength = telegraph.cube[panelIndex] ?? 0;
      const boostStrength = telegraph.boost[panelIndex] ?? 0;

      if (cubeStrength > 0 && cubeStrength >= boostStrength) {
        writePanelColor(
          view.panelColors,
          panelIndex,
          cubeColorFor(telegraph.colorIndex[panelIndex] ?? 0),
          cubeStrength * 0.8,
        );
      } else if (boostStrength > 0) {
        writePanelColor(view.panelColors, panelIndex, BOOST_TINT, boostStrength * 0.9);
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
