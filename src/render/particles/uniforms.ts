// Shared uniform objects for the particle substrate. Every material that runs
// displace() (the point skin now; cubes later) holds references to the *same*
// uniform objects, so one per-frame update drives the whole magnetic medium and
// nothing can drift out of sync. Mirrors the onBeforeCompile sketch in the
// exploration doc.

import { Color } from "three";

import { CELL_DEPTH, TUBE_RADIUS } from "../../tube/space";
import type { BendParams } from "../../tube/centerline";
import {
  BEND_RAMP_DISTANCE,
  bendToUniformArrays,
} from "./anchor";

// Points sit a hair inside the wall so the opaque tube panels never z-fight or
// occlude them.
export const POINT_RADIAL_INSET = 0.08;

const VIB_AMPLITUDE = 0.14;
const VIB_FREQUENCY = 0.22;
const VIB_DRIFT = 0.5;
const POINT_SIZE = 46;
const PARTICLE_COLOR = new Color(0.04, 0.04, 0.05);
const PARTICLE_OPACITY = 0.55;

type FloatUniform = { value: number };
type FloatArrayUniform = { value: number[] };

export type ParticleUniforms = {
  readonly uTime: FloatUniform;
  readonly uOriginS: FloatUniform;
  readonly uBaseCellS: FloatUniform;
  readonly uRadius: FloatUniform;
  readonly uRampDistance: FloatUniform;
  readonly uBendXAmp: FloatArrayUniform;
  readonly uBendXFreq: FloatArrayUniform;
  readonly uBendXPhase: FloatArrayUniform;
  readonly uBendYAmp: FloatArrayUniform;
  readonly uBendYFreq: FloatArrayUniform;
  readonly uBendYPhase: FloatArrayUniform;
  readonly uVibAmplitude: FloatUniform;
  readonly uVibFrequency: FloatUniform;
  readonly uVibDrift: FloatUniform;
  readonly uPointSize: FloatUniform;
  readonly uPixelRatio: FloatUniform;
  readonly uColor: { value: Color };
  readonly uOpacity: FloatUniform;
};

export const createParticleUniforms = (
  bend: BendParams,
  pixelRatio: number,
): ParticleUniforms => {
  const arrays = bendToUniformArrays(bend);
  return {
    uTime: { value: 0 },
    uOriginS: { value: 0 },
    uBaseCellS: { value: 0 },
    uRadius: { value: TUBE_RADIUS - POINT_RADIAL_INSET },
    uRampDistance: { value: BEND_RAMP_DISTANCE },
    uBendXAmp: { value: [...arrays.xAmplitude] },
    uBendXFreq: { value: [...arrays.xFrequency] },
    uBendXPhase: { value: [...arrays.xPhase] },
    uBendYAmp: { value: [...arrays.yAmplitude] },
    uBendYFreq: { value: [...arrays.yFrequency] },
    uBendYPhase: { value: [...arrays.yPhase] },
    uVibAmplitude: { value: VIB_AMPLITUDE },
    uVibFrequency: { value: VIB_FREQUENCY },
    uVibDrift: { value: VIB_DRIFT },
    uPointSize: { value: POINT_SIZE },
    uPixelRatio: { value: pixelRatio },
    uColor: { value: PARTICLE_COLOR.clone() },
    uOpacity: { value: PARTICLE_OPACITY },
  };
};

const writeInto = (target: number[], source: readonly number[]): void => {
  for (let i = 0; i < target.length; i += 1) {
    target[i] = source[i] ?? 0;
  }
};

// Push a run's bend into the fixed-size uniform arrays in place. Bend is stable
// within a run, so callers should invoke this only when it actually changes.
export const setParticleBend = (
  uniforms: ParticleUniforms,
  bend: BendParams,
): void => {
  const arrays = bendToUniformArrays(bend);
  writeInto(uniforms.uBendXAmp.value, arrays.xAmplitude);
  writeInto(uniforms.uBendXFreq.value, arrays.xFrequency);
  writeInto(uniforms.uBendXPhase.value, arrays.xPhase);
  writeInto(uniforms.uBendYAmp.value, arrays.yAmplitude);
  writeInto(uniforms.uBendYFreq.value, arrays.yFrequency);
  writeInto(uniforms.uBendYPhase.value, arrays.yPhase);
};

export type ParticleFrame = {
  readonly timeSeconds: number;
  readonly playerS: number;
  readonly pixelRatio: number;
};

// The whole per-frame CPU cost of the substrate: advance time and slide the
// render origin. Everything spatial is recomputed on the GPU from these.
export const updateParticleUniforms = (
  uniforms: ParticleUniforms,
  frame: ParticleFrame,
): void => {
  uniforms.uTime.value = frame.timeSeconds;
  uniforms.uOriginS.value = frame.playerS;
  uniforms.uBaseCellS.value = Math.floor(frame.playerS / CELL_DEPTH) * CELL_DEPTH;
  uniforms.uPixelRatio.value = frame.pixelRatio;
};
