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

import { CELL_DEPTH, LANES, TUBE_RADIUS, VISIBLE_CELLS } from "../game/config";
import { hasLane } from "../game/coordinates";
import { frameAtDistance, type World } from "../game/world";
import {
  inwardForAngle,
  lanePanelPoint,
  panelCenterAngle,
  tangentForAngle,
} from "./tubeMath";

export type ObstacleView = {
  readonly group: Group;
  readonly cubes: InstancedMesh;
  readonly boosts: InstancedMesh;
  readonly dummy: Object3D;
};

const MAX_CUBES = VISIBLE_CELLS * LANES;
const MAX_BOOSTS = VISIBLE_CELLS;
const PANEL_FLAT_WIDTH = 2 * TUBE_RADIUS * Math.sin(Math.PI / LANES);
const CUBE_SIZE = PANEL_FLAT_WIDTH * 0.98;
const CUBE_WIDTH = CUBE_SIZE;
const CUBE_HEIGHT = CUBE_SIZE;
const CUBE_DEPTH = CUBE_SIZE;
const CUBE_SURFACE_GAP = 0.03;
const BOOST_SURFACE_GAP = 0.05;

const cubeColor = (sectionId: number, cell: number, lane: number): Color => {
  const hue = ((sectionId * 47 + cell * 7 + lane * 29) % 360) / 360;
  return new Color().setHSL(hue, 0.78, 0.54);
};

export const boostKey = (sectionId: number, cell: number): string =>
  `${String(sectionId)}:${String(cell)}`;

export const createObstacleView = (): ObstacleView => {
  const group = new Group();
  const cubeGeometry = new BoxGeometry(CUBE_WIDTH, CUBE_DEPTH, CUBE_HEIGHT);
  const cubeMaterial = new MeshBasicMaterial({ vertexColors: true });
  const cubes = new InstancedMesh(cubeGeometry, cubeMaterial, MAX_CUBES);
  cubes.instanceMatrix.setUsage(DynamicDrawUsage);

  const boostGeometry = new BoxGeometry(2.05, 0.16, 2.05);
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

const orientToPanel = (
  dummy: Object3D,
  lane: number,
  distanceAxisScale = 1,
): void => {
  const angle = panelCenterAngle(lane);
  const tangent = tangentForAngle(angle);
  const inward = inwardForAngle(angle);
  const forward = new Vector3(0, 0, -1);
  const basis = new Matrix4().makeBasis(tangent, inward, forward);

  dummy.quaternion.setFromRotationMatrix(basis);
  dummy.scale.set(1, 1, distanceAxisScale);
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

      const position = lanePanelPoint(
        absoluteCell,
        lane,
        distance,
        CUBE_DEPTH / 2 + CUBE_SURFACE_GAP,
      );
      view.dummy.position.copy(position);
      orientToPanel(view.dummy, lane);
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
      const position = lanePanelPoint(
        absoluteCell,
        frame.boost.lane,
        distance,
        BOOST_SURFACE_GAP,
      );
      view.dummy.position.copy(position);
      orientToPanel(view.dummy, frame.boost.lane, 0.72);
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
