import {
  BoxGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from "three";

import { CELL_DEPTH, LANES, VISIBLE_CELLS } from "../game/config";
import { hasLane } from "../game/coordinates";
import { frameAtDistance, type World } from "../game/world";
import { laneCenterPoint } from "./tubeMath";

export type ObstacleView = {
  readonly group: Group;
  readonly cubes: InstancedMesh;
  readonly boosts: InstancedMesh;
  readonly dummy: Object3D;
};

const MAX_CUBES = VISIBLE_CELLS * LANES;
const MAX_BOOSTS = VISIBLE_CELLS;

const cubeColor = (sectionId: number, cell: number, lane: number): Color => {
  const hue = ((sectionId * 47 + cell * 7 + lane * 29) % 360) / 360;
  return new Color().setHSL(hue, 0.78, 0.54);
};

export const boostKey = (sectionId: number, cell: number): string =>
  `${String(sectionId)}:${String(cell)}`;

export const createObstacleView = (): ObstacleView => {
  const group = new Group();
  const cubeGeometry = new BoxGeometry(1.55, 1.55, 1.55);
  const cubeMaterial = new MeshBasicMaterial({ vertexColors: true });
  const cubes = new InstancedMesh(cubeGeometry, cubeMaterial, MAX_CUBES);
  cubes.instanceMatrix.setUsage(DynamicDrawUsage);

  const boostGeometry = new BoxGeometry(2.2, 0.18, 2.2);
  const boostMaterial = new MeshBasicMaterial({ color: 0x00d5ff });
  const boosts = new InstancedMesh(boostGeometry, boostMaterial, MAX_BOOSTS);
  boosts.instanceMatrix.setUsage(DynamicDrawUsage);

  group.add(cubes, boosts);

  return {
    group,
    cubes,
    boosts,
    dummy: new Object3D(),
  };
};

const setInstance = (
  mesh: InstancedMesh,
  index: number,
  matrix: Matrix4,
  color?: Color,
): void => {
  mesh.setMatrixAt(index, matrix);

  if (color !== undefined) {
    mesh.setColorAt(index, color);
  }
};

export const updateObstacleView = (
  view: ObstacleView,
  world: World,
  distance: number,
  collectedBoosts: ReadonlySet<string>,
): void => {
  const baseCell = Math.floor(distance / CELL_DEPTH);
  let cubeCount = 0;
  let boostCount = 0;

  for (let offset = 1; offset <= VISIBLE_CELLS; offset += 1) {
    const absoluteCell = baseCell + offset;
    const cellDistance = absoluteCell * CELL_DEPTH + CELL_DEPTH * 0.5;
    const frame = frameAtDistance(world, cellDistance);

    if (frame === undefined) {
      continue;
    }

    for (let lane = 0; lane < LANES; lane += 1) {
      if (!hasLane(frame.obstacleMask, lane) || cubeCount >= MAX_CUBES) {
        continue;
      }

      const position = laneCenterPoint(absoluteCell, lane, distance);
      view.dummy.position.copy(position);
      view.dummy.scale.setScalar(1);
      view.dummy.updateMatrix();

      setInstance(
        view.cubes,
        cubeCount,
        view.dummy.matrix,
        cubeColor(frame.section.id, frame.sectionCell, lane),
      );
      cubeCount += 1;
    }

    if (
      frame.boost !== undefined &&
      boostCount < MAX_BOOSTS &&
      !collectedBoosts.has(boostKey(frame.section.id, frame.boost.cell))
    ) {
      const position = laneCenterPoint(absoluteCell, frame.boost.lane, distance, -0.05);
      view.dummy.position.copy(position);
      view.dummy.scale.copy(new Vector3(1, 1, 1));
      view.dummy.updateMatrix();
      setInstance(view.boosts, boostCount, view.dummy.matrix);
      boostCount += 1;
    }
  }

  view.cubes.count = cubeCount;
  view.boosts.count = boostCount;
  view.cubes.instanceMatrix.needsUpdate = true;
  view.cubes.instanceColor?.setUsage(DynamicDrawUsage);
  if (view.cubes.instanceColor !== null) {
    view.cubes.instanceColor.needsUpdate = true;
  }
  view.boosts.instanceMatrix.needsUpdate = true;
};
