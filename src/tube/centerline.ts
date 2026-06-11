// Centerline model: the tube advances linearly in -Z and offsets laterally
// by smooth functions of s. No Frenet frames, no twist, and s stays exact
// arc length along the tube axis, so (s, θ) collision math is unaffected by
// any amount of undulation. Collision never calls into this file.

import { createRng } from "../generation/rng";

export type BendComponent = {
  readonly amplitude: number;
  readonly frequency: number;
  readonly phase: number;
};

export type BendParams = {
  readonly x: readonly BendComponent[];
  readonly y: readonly BendComponent[];
};

export const STRAIGHT_BEND: BendParams = { x: [], y: [] };

// Ease undulation in over the warmup stretch so the run starts readable.
const RAMP_DISTANCE = 600;

const wavelengthToFrequency = (wavelength: number): number =>
  (Math.PI * 2) / wavelength;

const randomComponent = (
  rng: () => number,
  maxAmplitude: number,
): BendComponent => ({
  amplitude: maxAmplitude * (0.45 + rng() * 0.55),
  frequency: wavelengthToFrequency(150 + rng() * 250),
  phase: rng() * Math.PI * 2,
});

export const createBend = (seed: number): BendParams => {
  const { next } = createRng(seed ^ 0x5eed);
  return {
    x: [randomComponent(next, 12), randomComponent(next, 5)],
    y: [randomComponent(next, 8), randomComponent(next, 4)],
  };
};

const ramp = (s: number): number => {
  const t = Math.min(1, Math.max(0, s / RAMP_DISTANCE));
  return t * t * (3 - 2 * t);
};

const sumComponents = (
  components: readonly BendComponent[],
  s: number,
): number =>
  components.reduce(
    (total, { amplitude, frequency, phase }) =>
      total + amplitude * Math.sin(s * frequency + phase),
    0,
  );

export type LateralOffset = {
  readonly x: number;
  readonly y: number;
};

export const bendOffset = (s: number, bend: BendParams): LateralOffset => {
  const strength = ramp(s);
  return {
    x: sumComponents(bend.x, s) * strength,
    y: sumComponents(bend.y, s) * strength,
  };
};
