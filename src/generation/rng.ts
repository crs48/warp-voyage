export type Rng = {
  readonly next: () => number;
  readonly nextInt: (minInclusive: number, maxExclusive: number) => number;
};

const normalizeSeed = (seed: number): number => seed >>> 0;

export const createRng = (seed: number): Rng => {
  let state = normalizeSeed(seed) || 0x9e3779b9;

  const nextUint32 = (): number => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0);
  };

  const next = (): number => nextUint32() / 0x100000000;

  const nextInt = (minInclusive: number, maxExclusive: number): number => {
    if (maxExclusive <= minInclusive) {
      throw new RangeError("maxExclusive must be greater than minInclusive");
    }

    return Math.floor(next() * (maxExclusive - minInclusive)) + minInclusive;
  };

  return { next, nextInt };
};
