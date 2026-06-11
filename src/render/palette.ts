// Cube colors. Every cube in one pattern event shares a color, and the
// telegraph trail leading to a cube inherits it, so color = "this lane has
// this thing coming". Boost cyan is reserved and must stay distinct.

export type PaletteColor = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
};

export const CUBE_PALETTE: readonly PaletteColor[] = [
  { r: 0.88, g: 0.11, b: 0.28 }, // crimson
  { r: 0.96, g: 0.45, b: 0.09 }, // orange
  { r: 0.55, g: 0.36, b: 0.96 }, // violet
  { r: 0.02, g: 0.59, b: 0.41 }, // emerald
  { r: 0.86, g: 0.15, b: 0.47 }, // magenta
  { r: 0.2, g: 0.32, b: 0.9 }, // indigo
];

const FALLBACK: PaletteColor = { r: 0.05, g: 0.05, b: 0.06 };

export const cubeColorFor = (index: number): PaletteColor =>
  CUBE_PALETTE[((index % CUBE_PALETTE.length) + CUBE_PALETTE.length) % CUBE_PALETTE.length] ??
  FALLBACK;

export const cubeColorCss = (index: number, alpha: number): string => {
  const { r, g, b } = cubeColorFor(index);
  return `rgba(${String(Math.round(r * 255))}, ${String(Math.round(g * 255))}, ${String(
    Math.round(b * 255),
  )}, ${String(alpha)})`;
};
