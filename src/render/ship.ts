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

import { TUBE_RADIUS } from "../tube/space";
import type { BendParams } from "../tube/centerline";
import { inwardForAngle, tangentForAngle, tubePoint } from "../tube/transform";

export type ShipView = {
  readonly group: Group;
  readonly body: Mesh;
  readonly coreMaterial: MeshBasicMaterial;
  readonly crashMaterial: MeshBasicMaterial;
};

const SHIP_RADIAL_INSET = 0.85;
const SHIP_BEHIND = 0.8;

export const createShipView = (): ShipView => {
  const group = new Group();
  const coreMaterial = new MeshBasicMaterial({ color: 0x0a0a0c });
  const crashMaterial = new MeshBasicMaterial({ color: 0xff2555 });
  const accentMaterial = new MeshBasicMaterial({ color: 0x00d5ff });

  const body = new Mesh(new BoxGeometry(0.85, 0.3, 1.35), coreMaterial);
  const nose = new Mesh(new ConeGeometry(0.44, 1.1, 4), coreMaterial);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -1.15;
  const accent = new Mesh(new BoxGeometry(0.9, 0.08, 0.3), accentMaterial);
  accent.position.set(0, 0.16, 0.4);

  group.add(body, nose, accent);

  return { group, body, coreMaterial, crashMaterial };
};

const basis = new Matrix4();
const tangent = new Vector3();
const inward = new Vector3();
const forward = new Vector3(0, 0, 1);
const carrier = new Object3D();

export const updateShipView = (
  ship: ShipView,
  playerAngle: number,
  playerS: number,
  bend: BendParams,
  crashFlashSeconds: number,
): void => {
  tangentForAngle(playerAngle, tangent);
  inwardForAngle(playerAngle, inward);
  basis.makeBasis(tangent, inward, forward);
  carrier.quaternion.setFromRotationMatrix(basis);

  tubePoint(
    playerS - SHIP_BEHIND,
    playerAngle,
    playerS,
    bend,
    TUBE_RADIUS - SHIP_RADIAL_INSET,
    ship.group.position,
  );
  ship.group.quaternion.slerp(carrier.quaternion, 0.38);
  ship.group.scale.setScalar(1 + Math.min(0.45, crashFlashSeconds * 0.55));
  ship.body.material = crashFlashSeconds > 0 ? ship.crashMaterial : ship.coreMaterial;
};
