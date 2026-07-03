// The particle substrate as one unit: the shared uniforms plus every cloud that
// reads them. scene.ts creates it; main.ts drives it once per frame. Keeping the
// wiring here keeps scene.ts and main.ts unaware of shader internals.

import type { Points } from "three";

import { STRAIGHT_BEND, type BendParams } from "../../tube/centerline";
import type { RippleImpact } from "../../game/impacts";
import { createPointSkin } from "./pointSkin";
import {
  createParticleUniforms,
  setImpactUniforms,
  setParticleBend,
  setParticleShip,
  updateParticleUniforms,
  type ParticleUniforms,
} from "./uniforms";

export type ParticleSystem = {
  readonly tubePoints: Points;
  readonly uniforms: ParticleUniforms;
  // Last bend uploaded, so we only recompute the uniform arrays on change.
  lastBend: BendParams | null;
};

export const createParticleSystem = (pixelRatio: number): ParticleSystem => {
  const uniforms = createParticleUniforms(STRAIGHT_BEND, pixelRatio);
  const skin = createPointSkin(uniforms);
  return { tubePoints: skin.points, uniforms, lastBend: null };
};

export type ParticleUpdate = {
  readonly bend: BendParams;
  readonly playerS: number;
  readonly playerAngle: number;
  readonly speedFactor: number;
  readonly timeSeconds: number;
  readonly pixelRatio: number;
  readonly impacts: readonly RippleImpact[];
};

export const updateParticleSystem = (
  system: ParticleSystem,
  update: ParticleUpdate,
): void => {
  if (system.lastBend !== update.bend) {
    setParticleBend(system.uniforms, update.bend);
    system.lastBend = update.bend;
  }

  updateParticleUniforms(system.uniforms, {
    timeSeconds: update.timeSeconds,
    playerS: update.playerS,
    pixelRatio: update.pixelRatio,
  });
  setParticleShip(system.uniforms, {
    s: update.playerS,
    theta: update.playerAngle,
    speed: update.speedFactor,
  });
  setImpactUniforms(system.uniforms, update.impacts);
};
