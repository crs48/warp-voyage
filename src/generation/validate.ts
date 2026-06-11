import { LANES } from "../tube/space";
import {
  hasLane,
  laneMask,
  normalizeLane,
  type Lane,
  type LaneMask,
} from "../game/coordinates";

export type ReachabilityInput = {
  readonly masks: readonly LaneMask[];
  readonly startLane: Lane;
  readonly maxStepPerCell: number;
};

const expandReachable = (
  previous: ReadonlySet<Lane>,
  maxStepPerCell: number,
): ReadonlySet<Lane> =>
  new Set(
    [...previous].flatMap((lane) =>
      Array.from(
        { length: maxStepPerCell * 2 + 1 },
        (_, index) => normalizeLane(lane + index - maxStepPerCell),
      ),
    ),
  );

const removeBlocked = (
  reachable: ReadonlySet<Lane>,
  blockedMask: LaneMask,
): ReadonlySet<Lane> =>
  new Set([...reachable].filter((lane) => !hasLane(blockedMask, lane)));

export const reachableAfterMask = (
  previous: ReadonlySet<Lane>,
  blockedMask: LaneMask,
  maxStepPerCell: number,
): ReadonlySet<Lane> =>
  removeBlocked(expandReachable(previous, maxStepPerCell), blockedMask);

export const validateReachability = ({
  masks,
  startLane,
  maxStepPerCell,
}: ReachabilityInput): boolean => {
  const initial = new Set<Lane>([normalizeLane(startLane)]);

  const finalReachable = masks.reduce<ReadonlySet<Lane>>(
    (reachable, mask) =>
      reachable.size === 0
        ? reachable
        : reachableAfterMask(reachable, mask, maxStepPerCell),
    initial,
  );

  return finalReachable.size > 0;
};

export const singleGapMask = (gapLane: Lane): LaneMask =>
  Array.from({ length: LANES }, (_, lane) => lane)
    .reduce<LaneMask>(
      (mask, lane) => (normalizeLane(lane) === normalizeLane(gapLane) ? mask : mask | laneMask(lane)),
      0,
    );
