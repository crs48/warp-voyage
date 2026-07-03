// GPU-side tube-space -> world transform for the particle skin, plus a TS
// mirror of the exact same math. The point cloud carries only static
// (windowed-s, theta) attributes; the vertex shader realises them into
// camera-relative world anchors each frame from a handful of uniforms, so the
// per-frame CPU cost is O(uniforms) rather than O(particles).
//
// The GLSL and the TS `anchorWorld` below are two renderings of one formula —
// a faithful port of `bendOffset` (src/tube/centerline.ts) + `tubePoint`
// (src/tube/transform.ts). The parity test in test/render/particles keeps them
// from drifting.

import type { BendParams } from "../../tube/centerline";
import { TUBE_RADIUS } from "../../tube/space";

// Fixed-size bend arrays keep the shader loop unrollable. createBend emits two
// components per axis; STRAIGHT_BEND emits none. Unused slots carry amplitude 0
// and contribute nothing, so no per-run component count is needed.
export const MAX_BEND_COMPONENTS = 4;

// Must match RAMP_DISTANCE in src/tube/centerline.ts (the bend eases in over the
// warmup stretch). Kept as a uniform so the port stays a pure function of it.
export const BEND_RAMP_DISTANCE = 600;

export type BendUniformArrays = {
  readonly xAmplitude: readonly number[];
  readonly xFrequency: readonly number[];
  readonly xPhase: readonly number[];
  readonly yAmplitude: readonly number[];
  readonly yFrequency: readonly number[];
  readonly yPhase: readonly number[];
};

const padded = (
  components: BendParams["x"],
  pick: (component: BendParams["x"][number]) => number,
): number[] =>
  Array.from({ length: MAX_BEND_COMPONENTS }, (_, index) => {
    const component = components[index];
    return component === undefined ? 0 : pick(component);
  });

// Flatten a BendParams into the fixed-size arrays the shader uniforms expect.
export const bendToUniformArrays = (bend: BendParams): BendUniformArrays => ({
  xAmplitude: padded(bend.x, (c) => c.amplitude),
  xFrequency: padded(bend.x, (c) => c.frequency),
  xPhase: padded(bend.x, (c) => c.phase),
  yAmplitude: padded(bend.y, (c) => c.amplitude),
  yFrequency: padded(bend.y, (c) => c.frequency),
  yPhase: padded(bend.y, (c) => c.phase),
});

const smoothRamp = (s: number): number => {
  const t = Math.min(1, Math.max(0, s / BEND_RAMP_DISTANCE));
  return t * t * (3 - 2 * t);
};

const sumSines = (
  amplitude: readonly number[],
  frequency: readonly number[],
  phase: readonly number[],
  s: number,
): number => {
  let total = 0;
  for (let i = 0; i < MAX_BEND_COMPONENTS; i += 1) {
    total +=
      (amplitude[i] ?? 0) * Math.sin(s * (frequency[i] ?? 0) + (phase[i] ?? 0));
  }
  return total;
};

export type WorldAnchor = { readonly x: number; readonly y: number; readonly z: number };

// TS mirror of the vertex shader. `winS` is windowed arc length in
// [0, VISIBLE_CELLS * CELL_DEPTH); absolute arc length is baseCellS + winS.
export const anchorWorld = (
  winS: number,
  theta: number,
  originS: number,
  baseCellS: number,
  bend: BendUniformArrays,
  radius = TUBE_RADIUS,
): WorldAnchor => {
  const s = baseCellS + winS;
  const bendX =
    smoothRamp(s) * sumSines(bend.xAmplitude, bend.xFrequency, bend.xPhase, s);
  const bendY =
    smoothRamp(s) * sumSines(bend.yAmplitude, bend.yFrequency, bend.yPhase, s);
  const originBendX =
    smoothRamp(originS) *
    sumSines(bend.xAmplitude, bend.xFrequency, bend.xPhase, originS);
  const originBendY =
    smoothRamp(originS) *
    sumSines(bend.yAmplitude, bend.yFrequency, bend.yPhase, originS);

  return {
    x: bendX - originBendX + Math.sin(theta) * radius,
    y: bendY - originBendY - Math.cos(theta) * radius,
    z: -(s - originS),
  };
};

// The GLSL twin. `wv_bendAxis` sums one axis' sines; `tubeAnchor` reproduces
// centerlinePoint + tubePoint. inwardFor gives the unit normal toward the axis,
// the direction ripples and wake push along.
export const TUBE_ANCHOR_GLSL = /* glsl */ `
uniform float uOriginS;
uniform float uBaseCellS;
uniform float uRadius;
uniform float uRampDistance;
uniform float uBendXAmp[${String(MAX_BEND_COMPONENTS)}];
uniform float uBendXFreq[${String(MAX_BEND_COMPONENTS)}];
uniform float uBendXPhase[${String(MAX_BEND_COMPONENTS)}];
uniform float uBendYAmp[${String(MAX_BEND_COMPONENTS)}];
uniform float uBendYFreq[${String(MAX_BEND_COMPONENTS)}];
uniform float uBendYPhase[${String(MAX_BEND_COMPONENTS)}];

float wv_ramp(float s){
  float t = clamp(s / uRampDistance, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

float wv_bendAxis(float amp[${String(MAX_BEND_COMPONENTS)}], float freq[${String(MAX_BEND_COMPONENTS)}], float phase[${String(MAX_BEND_COMPONENTS)}], float s){
  float total = 0.0;
  for (int i = 0; i < ${String(MAX_BEND_COMPONENTS)}; i++){
    total += amp[i] * sin(s * freq[i] + phase[i]);
  }
  return total * wv_ramp(s);
}

vec3 inwardFor(float theta){
  return vec3(-sin(theta), cos(theta), 0.0);
}

vec3 tubeAnchor(float winS, float theta){
  float s = uBaseCellS + winS;
  float bx = wv_bendAxis(uBendXAmp, uBendXFreq, uBendXPhase, s);
  float by = wv_bendAxis(uBendYAmp, uBendYFreq, uBendYPhase, s);
  float ox = wv_bendAxis(uBendXAmp, uBendXFreq, uBendXPhase, uOriginS);
  float oy = wv_bendAxis(uBendYAmp, uBendYFreq, uBendYPhase, uOriginS);
  return vec3(
    bx - ox + sin(theta) * uRadius,
    by - oy - cos(theta) * uRadius,
    -(s - uOriginS)
  );
}
`;
