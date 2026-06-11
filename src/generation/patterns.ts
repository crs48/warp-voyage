// Pattern events: instead of rolling density dice per cell, sections place
// deliberate "events" — a gate, a slalom cluster, a rail — separated by
// blank cells. The player always reads one intentional thing at a time, and
// the section can stretch the gaps when it is generated at boost speed.

import {
  corridorMask,
  invertLaneMask,
  laneMask,
  normalizeLane,
  type Lane,
  type LaneMask,
} from "../game/coordinates";
import type { Rng } from "./rng";

export const PATTERN_FAMILIES = [
  "slalom",
  "gates",
  "spiral",
  "rail",
  "weave",
] as const;

export type PatternFamily = (typeof PATTERN_FAMILIES)[number];

export type PatternEvent = {
  // One mask per cell of the event's span, relative to the event's start.
  readonly masks: readonly LaneMask[];
  // Blank cells after the event at base speed; scaled up while boosted.
  readonly gapAfter: number;
};

export type EventInput = {
  readonly rng: Rng;
  readonly family: PatternFamily;
  readonly eventIndex: number;
  // Safe path from the event's first cell onward.
  readonly safeLanes: readonly Lane[];
  readonly safeWidth: number;
  // 0 (warmup) … 1 (late game).
  readonly difficulty: number;
};

const lanesToMask = (lanes: readonly number[]): LaneMask =>
  lanes.reduce<LaneMask>((mask, lane) => mask | laneMask(normalizeLane(lane)), 0);

const safeLaneAt = (input: EventInput, offset: number): Lane =>
  input.safeLanes[Math.min(offset, input.safeLanes.length - 1)] ?? 0;

// One small cluster right beside the corridor, alternating sides: cubes
// flick past the player's shoulder and punish drifting.
const slalomEvent = (input: EventInput): PatternEvent => {
  const side = input.eventIndex % 2 === 0 ? 1 : -1;
  const edge = input.safeWidth + 1;
  const safe = safeLaneAt(input, 0);
  const offsets = input.difficulty > 0.4 ? [edge, edge + 1] : [edge];

  return {
    masks: [lanesToMask(offsets.map((offset) => safe + side * offset))],
    gapAfter: input.difficulty > 0.7 ? 2 : 3,
  };
};

// A full ring with a gap centered on the safe path: see the wall, find the
// hole, steer to it.
const gatesEvent = (input: EventInput): PatternEvent => {
  const gapHalf = input.difficulty > 0.5 ? 1 : 2;
  const safe = safeLaneAt(input, 0);

  return {
    masks: [invertLaneMask(corridorMask(safe, Math.max(gapHalf, input.safeWidth)))],
    gapAfter: 5 - Math.round(input.difficulty * 2),
  };
};

// A short two-lane-thick helix sweeping around the ring beside the corridor,
// alternating sweep direction between events.
const spiralEvent = (input: EventInput): PatternEvent => {
  const direction = input.eventIndex % 2 === 0 ? 1 : -1;
  const span = 5;
  const masks = Array.from({ length: span }, (_, step) => {
    const base = safeLaneAt(input, step) + direction * (input.safeWidth + 1 + step);
    return lanesToMask([base, base + direction]);
  });

  return { masks, gapAfter: 4 };
};

// A solid two-lane ribbon riding one side of the corridor for several cells:
// a wall that travels with you and frames the path.
const railEvent = (input: EventInput): PatternEvent => {
  const side = input.eventIndex % 2 === 0 ? -1 : 1;
  const span = 8 + input.rng.nextInt(0, 4);
  const masks = Array.from({ length: span }, (_, step) => {
    const safe = safeLaneAt(input, step);
    return lanesToMask([
      safe + side * (input.safeWidth + 1),
      safe + side * (input.safeWidth + 2),
    ]);
  });

  return { masks, gapAfter: 4 };
};

// A pinch: cubes flanking both sides of the corridor at once — hold the line.
const weaveEvent = (input: EventInput): PatternEvent => {
  const edge = input.safeWidth + 1;
  const safe = safeLaneAt(input, 0);
  const offsets =
    input.difficulty > 0.5 ? [edge, edge + 1, -edge, -edge - 1] : [edge, -edge];

  return {
    masks: [lanesToMask(offsets.map((offset) => safe + offset))],
    gapAfter: 3,
  };
};

export const createPatternEvent = (input: EventInput): PatternEvent => {
  switch (input.family) {
    case "slalom":
      return slalomEvent(input);
    case "gates":
      return gatesEvent(input);
    case "spiral":
      return spiralEvent(input);
    case "rail":
      return railEvent(input);
    case "weave":
      return weaveEvent(input);
  }
};
