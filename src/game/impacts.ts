// Ripple impacts: presentational events (near-miss shivers) that the particle
// substrate reads. Like `crashFlashSeconds`, these live on RunState, are
// computed in updateRun, and never touch collision — a cube that is grazed and
// a cube that is hit are decided by the same pure (s, θ) rects; this module only
// decides how the *rendered* world reacts to a graze.
//
// The ripple constants and `impactRadialOffset` below are the TS twin of the
// GLSL in src/render/particles/displacement.glsl.ts. The point skin ripples on
// the GPU; cubes shiver on the CPU (a radial nudge, see obstacles.ts); both read
// these same numbers so the tunnel wall and the cube it surrounds ripple as one.

import { cellCenterS, LANE_ANGLE, TUBE_RADIUS } from "../tube/space";
import { angleForLane, lanesFromMask, type LaneMask } from "./coordinates";

export type RippleImpact = {
  readonly s: number;
  readonly theta: number;
  readonly age: number; // seconds since the graze
  readonly strength: number; // [0, 1]
};

export const MAX_IMPACTS = 16;
export const IMPACT_LIFETIME_SECONDS = 0.9;

// Shared ripple shape (see the GLSL twin). Amplitude is the world-space peak
// radial displacement; the rest shape the expanding, decaying ring.
export const IMPACT_AMPLITUDE = 0.9;
export const IMPACT_FREQUENCY = 1.4;
export const IMPACT_SPEED = 7;
export const IMPACT_FALLOFF = 0.06;

// A pass closer than the inner edge would have clipped the cube (player
// half-angle 0.3 + cube half-angle 0.5 = 0.8 lanes); beyond the outer edge the
// pass is too wide to feel. Strength runs 1 at the grazing edge to 0 at the
// outer edge.
const NEAR_MISS_INNER = 0.8 * LANE_ANGLE;
const NEAR_MISS_OUTER = 2.2 * LANE_ANGLE;

const wrapAngle = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

// Strength of a near miss at a given angular gap. 0 for a hit (gap ≤ inner) or a
// wide pass (gap ≥ outer); rises monotonically as the gap narrows toward the
// grazing edge.
export const nearMissStrength = (angleGap: number): number => {
  const gap = Math.abs(angleGap);
  if (gap <= NEAR_MISS_INNER || gap >= NEAR_MISS_OUTER) {
    return 0;
  }
  const t = (NEAR_MISS_OUTER - gap) / (NEAR_MISS_OUTER - NEAR_MISS_INNER);
  return t * t * (3 - 2 * t);
};

export type NearMissFrame = {
  readonly absoluteCell: number;
  readonly obstacleMask: LaneMask;
};

// Emit a ripple the single frame the player passes a cube's centre without
// hitting it. Firing on the centre-crossing makes it exactly once per pass, with
// no growing "already seen" set to carry on RunState.
export const detectNearMisses = (
  frames: readonly NearMissFrame[],
  previousDistance: number,
  currentDistance: number,
  angle: number,
): readonly RippleImpact[] => {
  const impacts: RippleImpact[] = [];

  for (const frame of frames) {
    const centerS = cellCenterS(frame.absoluteCell);
    const crossedThisFrame = previousDistance < centerS && centerS <= currentDistance;

    if (!crossedThisFrame) {
      continue;
    }

    for (const lane of lanesFromMask(frame.obstacleMask)) {
      const laneAngle = angleForLane(lane);
      const strength = nearMissStrength(wrapAngle(angle - laneAngle));

      if (strength > 0) {
        impacts.push({ s: centerS, theta: laneAngle, age: 0, strength });
      }
    }
  }

  return impacts;
};

// Age the live ripples, drop the expired, append the new, and keep the freshest
// MAX_IMPACTS (the ring buffer the shader reads).
export const advanceImpacts = (
  impacts: readonly RippleImpact[],
  detected: readonly RippleImpact[],
  dtSeconds: number,
): readonly RippleImpact[] => {
  const aged = impacts
    .map((impact) => ({ ...impact, age: impact.age + dtSeconds }))
    .filter((impact) => impact.age < IMPACT_LIFETIME_SECONDS);
  const merged = [...aged, ...detected];
  return merged.length <= MAX_IMPACTS
    ? merged
    : merged.slice(merged.length - MAX_IMPACTS);
};

// TS twin of the GLSL ripple sum: the world-space radial displacement at a point
// in tube space. Cubes use it to shiver; the point skin computes the same on the
// GPU for the surrounding wall.
export const impactRadialOffset = (
  s: number,
  theta: number,
  impacts: readonly RippleImpact[],
): number => {
  let total = 0;

  for (const impact of impacts) {
    if (impact.strength <= 0) {
      continue;
    }
    const ds = s - impact.s;
    const dTheta = wrapAngle(theta - impact.theta);
    const dist = Math.hypot(ds, dTheta * TUBE_RADIUS);
    const ageNorm = Math.min(1, impact.age / IMPACT_LIFETIME_SECONDS);
    const envelope =
      smoothstep(0, 0.12, ageNorm) * (1 - smoothstep(0.45, 1, ageNorm));
    const ring = Math.sin(dist * IMPACT_FREQUENCY - impact.age * IMPACT_SPEED);
    const spatial = Math.exp(-dist * dist * IMPACT_FALLOFF);
    total += impact.strength * envelope * ring * spatial;
  }

  return total * IMPACT_AMPLITUDE;
};
