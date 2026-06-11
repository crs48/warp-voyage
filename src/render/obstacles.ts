import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
} from "three";

import {
  CELL_DEPTH,
  CUBE_DEPTH,
  CUBE_SIZE,
  CUBE_SURFACE_GAP,
  LANES,
  VISIBLE_CELLS,
} from "../tube/space";
import type { BendParams } from "../tube/centerline";
import { cellTransform } from "../tube/transform";
import { hasLane } from "../game/coordinates";
import { boostKey, frameAtDistance, type World } from "../game/world";
import { CUBE_PALETTE } from "./palette";

export type ObstacleView = {
  readonly group: Group;
  readonly cubes: InstancedMesh;
  readonly boosts: InstancedMesh;
  readonly dummy: Object3D;
};

const MAX_CUBES = VISIBLE_CELLS * LANES;
const MAX_BOOSTS = VISIBLE_CELLS;
const BOOST_THICKNESS = 0.14;

const PALETTE_COLORS: readonly Color[] = CUBE_PALETTE.map(
  ({ r, g, b }) => new Color(r, g, b),
);
const FALLBACK_COLOR = new Color(0x0a0a0c);

export const createObstacleView = (): ObstacleView => {
  const group = new Group();
  const cubeGeometry = new BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_DEPTH);
  // White base; per-instance colors from the palette multiply it.
  const cubeMaterial = new MeshBasicMaterial({ color: 0xffffff });
  const cubes = new InstancedMesh(cubeGeometry, cubeMaterial, MAX_CUBES);
  cubes.instanceMatrix.setUsage(DynamicDrawUsage);
  cubes.frustumCulled = false;

  const boostGeometry = new BoxGeometry(
    CUBE_SIZE * 0.72,
    BOOST_THICKNESS,
    CELL_DEPTH * 0.55,
  );
  const boostMaterial = new MeshBasicMaterial({ color: 0x00d5ff });
  const boosts = new InstancedMesh(boostGeometry, boostMaterial, MAX_BOOSTS);
  boosts.instanceMatrix.setUsage(DynamicDrawUsage);
  boosts.frustumCulled = false;

  group.add(cubes, boosts);

  return {
    group,
    cubes,
    boosts,
    dummy: new Object3D(),
  };
};

const placeInstance = (
  mesh: InstancedMesh,
  index: number,
  dummy: Object3D,
  cell: number,
  lane: number,
  playerS: number,
  bend: BendParams,
  radialInset: number,
): void => {
  cellTransform(cell, lane, playerS, bend, radialInset, dummy.position, dummy.quaternion);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
};

export const updateObstacleView = (
  view: ObstacleView,
  world: World,
  playerS: number,
  bend: BendParams,
  collectedBoosts: ReadonlySet<string>,
): void => {
  const baseCell = Math.floor(playerS / CELL_DEPTH);
  let cubeCount = 0;
  let boostCount = 0;

  for (let offset = 0; offset <= VISIBLE_CELLS; offset += 1) {
    const absoluteCell = baseCell + offset;
    const frame = frameAtDistance(world, absoluteCell * CELL_DEPTH + CELL_DEPTH * 0.5);

    if (frame === undefined) {
      continue;
    }

    for (let lane = 0; lane < LANES; lane += 1) {
      if (!hasLane(frame.obstacleMask, lane) || cubeCount >= MAX_CUBES) {
        continue;
      }

      placeInstance(
        view.cubes,
        cubeCount,
        view.dummy,
        absoluteCell,
        lane,
        playerS,
        bend,
        CUBE_SIZE / 2 + CUBE_SURFACE_GAP,
      );
      view.cubes.setColorAt(
        cubeCount,
        PALETTE_COLORS[
          ((frame.colorIndex % PALETTE_COLORS.length) + PALETTE_COLORS.length) %
            PALETTE_COLORS.length
        ] ?? FALLBACK_COLOR,
      );
      cubeCount += 1;
    }

    if (
      frame.boost !== undefined &&
      boostCount < MAX_BOOSTS &&
      !collectedBoosts.has(boostKey(frame.section.id, frame.boost.cell))
    ) {
      placeInstance(
        view.boosts,
        boostCount,
        view.dummy,
        absoluteCell,
        frame.boost.lane,
        playerS,
        bend,
        BOOST_THICKNESS / 2 + CUBE_SURFACE_GAP,
      );
      boostCount += 1;
    }
  }

  view.cubes.count = cubeCount;
  view.boosts.count = boostCount;
  view.cubes.instanceMatrix.needsUpdate = true;
  if (view.cubes.instanceColor !== null) {
    view.cubes.instanceColor.needsUpdate = true;
  }
  view.boosts.instanceMatrix.needsUpdate = true;
};
