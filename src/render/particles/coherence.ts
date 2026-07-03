// Magnetization coherence: a single scalar in [0, 1] that blends the tunnel
// particles between *lattice* (0 — crisp, sitting on their anchors) and
// *magnetized* (1 — drifting along a shared curl-noise flow field into clumps
// and filaments). Because it is one number, "sometimes magnetized to each
// other" costs almost nothing and stays fully art-directable.
//
// Only the tunnel point skin reads coherence, so the ship and cubes never
// magnetize — per-surface coherence by scoping, and the ship stays the one
// crisp "you" amid the shimmer.

import { MAX_BOOST_LEVEL } from "../../game/config";

// Magnetism breathes in and out over this period, so it comes and goes rather
// than sitting on.
const COHERENCE_PERIOD_SECONDS = 11;
const BREATHE_PEAK = 0.5;
const BOOST_KICK = 0.35;
// A cube within this many world units damps magnetization toward 0 so the
// danger — and the white safe path — reads crisp when it matters most.
const DANGER_RANGE = 22;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export type CoherenceInputs = {
  readonly timeSeconds: number;
  readonly boostLevel: number;
  // Distance to the nearest obstacle ahead in world units; Infinity if none.
  readonly obstacleDistance: number;
};

export const magnetizationCoherence = (inputs: CoherenceInputs): number => {
  const phase = (inputs.timeSeconds * 2 * Math.PI) / COHERENCE_PERIOD_SECONDS;
  const breathe = BREATHE_PEAK * (0.5 + 0.5 * Math.sin(phase));
  const boostKick = BOOST_KICK * clamp01(inputs.boostLevel / MAX_BOOST_LEVEL);
  const raw = breathe + boostKick;

  const danger = clamp01(1 - inputs.obstacleDistance / DANGER_RANGE);
  return clamp01(raw * (1 - danger));
};
