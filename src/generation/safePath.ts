import { LANES } from "../game/config";
import { normalizeLane, type Lane } from "../game/coordinates";
import type { Rng } from "./rng";

export type SafePathOptions = {
  readonly length: number;
  readonly startLane: Lane;
  readonly maxLaneStep: number;
  readonly rng: Rng;
  readonly turnChance?: number;
};

const randomStep = (rng: Rng, maxLaneStep: number): number => {
  const span = maxLaneStep * 2 + 1;
  return rng.nextInt(0, span) - maxLaneStep;
};

export const generateSafePath = ({
  length,
  startLane,
  maxLaneStep,
  rng,
  turnChance = 0.64,
}: SafePathOptions): readonly Lane[] => {
  if (length <= 0) {
    return [];
  }

  return Array.from({ length }).reduce<readonly Lane[]>((lanes, _, index) => {
    if (index === 0) {
      return [normalizeLane(startLane)];
    }

    const previous = lanes[index - 1] ?? startLane;
    const shouldTurn = rng.next() < turnChance;
    const step = shouldTurn ? randomStep(rng, maxLaneStep) : 0;
    return [...lanes, normalizeLane(previous + step + LANES)];
  }, []);
};
