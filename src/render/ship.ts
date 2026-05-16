import {
  BoxGeometry,
  ConeGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from "three";

import { TUBE_RADIUS } from "../game/config";
import { radialForAngle } from "./tubeMath";

export type ShipView = {
  readonly group: Group;
  readonly body: Mesh;
  readonly coreMaterial: MeshBasicMaterial;
  readonly crashMaterial: MeshBasicMaterial;
};

const createPart = (
  geometry: BoxGeometry | ConeGeometry,
  material: MeshBasicMaterial,
  position: Vector3,
  scale: Vector3,
): Mesh => {
  const mesh = new Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.scale.copy(scale);
  return mesh;
};

export const createShipView = (): ShipView => {
  const group = new Group();
  const coreMaterial = new MeshBasicMaterial({ color: 0x050505 });
  const crashMaterial = new MeshBasicMaterial({ color: 0xff2555 });
  const accentMaterial = new MeshBasicMaterial({ color: 0x00d5ff });

  const body = createPart(
    new BoxGeometry(1, 1, 1),
    coreMaterial,
    new Vector3(0, 0, 0),
    new Vector3(0.85, 0.32, 1.45),
  );
  const nose = new Mesh(new ConeGeometry(0.52, 1.35, 4), accentMaterial);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -1.15;
  const leftFin = createPart(
    new BoxGeometry(1, 1, 1),
    coreMaterial,
    new Vector3(-0.78, -0.12, 0.36),
    new Vector3(0.52, 0.16, 0.74),
  );
  leftFin.rotation.z = 0.22;
  const rightFin = createPart(
    new BoxGeometry(1, 1, 1),
    coreMaterial,
    new Vector3(0.78, -0.12, 0.36),
    new Vector3(0.52, 0.16, 0.74),
  );
  rightFin.rotation.z = -0.22;

  group.add(body, nose, leftFin, rightFin);

  return { group, body, coreMaterial, crashMaterial };
};

export const updateShipView = (
  ship: ShipView,
  playerAngle: number,
  crashFlashSeconds: number,
): void => {
  const radial = radialForAngle(playerAngle);
  const inward = radial.clone().negate();
  const backward = new Vector3(0, 0, 1);
  const tangent = inward.clone().cross(backward).normalize();
  const basis = new Matrix4().makeBasis(tangent, inward, backward);
  const carrier = new Object3D();

  carrier.quaternion.setFromRotationMatrix(basis);
  ship.group.position.copy(radial.multiplyScalar(TUBE_RADIUS - 0.85).add(new Vector3(0, 0, 0.8)));
  ship.group.quaternion.slerp(carrier.quaternion, 0.38);
  ship.group.scale.setScalar(1 + Math.min(0.45, crashFlashSeconds * 0.55));
  ship.body.material = crashFlashSeconds > 0 ? ship.crashMaterial : ship.coreMaterial;
};
