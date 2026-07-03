// The particle "skin" for the tunnel wall: a THREE.Points cloud scattered over
// the visible tube, realised into world space and displaced entirely on the
// GPU. The solid panel mesh stays underneath (see scene.ts) so silhouettes and
// the telegraph white-path never dissolve — this is a decorative shell on top,
// the "solid core + particle shell" pattern.

import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  NormalBlending,
  Points,
  ShaderMaterial,
} from "three";

import { CELL_DEPTH, VISIBLE_CELLS } from "../../tube/space";
import { createRng } from "../../generation/rng";
import {
  CURL_NOISE_GLSL,
  DISPLACE_GLSL,
  DISPLACE_UNIFORMS_GLSL,
  SIMPLEX_NOISE_GLSL,
} from "./displacement.glsl";
import { TUBE_ANCHOR_GLSL } from "./anchor";
import type { ParticleUniforms } from "./uniforms";

// ~384 points per cell over 36 cells ≈ 13.8k points — grainy without going
// solid, and a single draw call. Tunable purely for density.
export const POINTS_PER_CELL = 384;
const POINT_COUNT = VISIBLE_CELLS * POINTS_PER_CELL;
const TWO_PI = Math.PI * 2;
// Deterministic scatter so tests and replays are stable (no Math.random).
const SCATTER_SEED = 0x50f7_ba11;

export type PointSkinView = {
  readonly points: Points;
  readonly material: ShaderMaterial;
};

const VERTEX_SHADER = /* glsl */ `
attribute float aWinS;
attribute float aTheta;
attribute float aSeed;

uniform float uPointSize;
uniform float uPixelRatio;

varying float vSeed;

${SIMPLEX_NOISE_GLSL}
${CURL_NOISE_GLSL}
${TUBE_ANCHOR_GLSL}
${DISPLACE_UNIFORMS_GLSL}
${DISPLACE_GLSL}

void main(){
  vec3 anchor = tubeAnchor(aWinS, aTheta);
  vec3 inward = inwardFor(aTheta);
  vec3 displaced = displace(anchor, inward, aSeed);

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float sizeJitter = 0.6 + 0.8 * fract(aSeed);
  float size = uPointSize * sizeJitter * uPixelRatio / max(0.001, -mvPosition.z);
  // Cap so points near the camera stay grains, not distracting blobs.
  gl_PointSize = min(size, 9.0 * uPixelRatio);

  vSeed = aSeed;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform vec3 uColor;
uniform float uOpacity;

varying float vSeed;

void main(){
  vec2 fromCenter = gl_PointCoord - vec2(0.5);
  float radiusSq = dot(fromCenter, fromCenter);
  if (radiusSq > 0.25) discard;

  float alpha = uOpacity * smoothstep(0.25, 0.03, radiusSq);
  vec3 color = uColor * (0.7 + 0.6 * fract(vSeed * 1.7));
  gl_FragColor = vec4(color, alpha);
}
`;

// Scatter the cloud once. Points carry only their windowed arc length, angle,
// and a stable per-point seed; the vertex shader does the rest each frame.
const buildGeometry = (): BufferGeometry => {
  const rng = createRng(SCATTER_SEED);
  const positions = new Float32Array(POINT_COUNT * 3);
  const winS = new Float32Array(POINT_COUNT);
  const theta = new Float32Array(POINT_COUNT);
  const seed = new Float32Array(POINT_COUNT);

  for (let cell = 0; cell < VISIBLE_CELLS; cell += 1) {
    for (let k = 0; k < POINTS_PER_CELL; k += 1) {
      const index = cell * POINTS_PER_CELL + k;
      winS[index] = (cell + rng.next()) * CELL_DEPTH;
      theta[index] = rng.next() * TWO_PI;
      seed[index] = rng.next() * 100;
    }
  }

  const geometry = new BufferGeometry();
  // `position` exists only to give the draw its vertex count; the real position
  // is computed in the shader from aWinS/aTheta.
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aWinS", new Float32BufferAttribute(winS, 1));
  geometry.setAttribute("aTheta", new Float32BufferAttribute(theta, 1));
  geometry.setAttribute("aSeed", new Float32BufferAttribute(seed, 1));
  return geometry;
};

export const createPointSkin = (uniforms: ParticleUniforms): PointSkinView => {
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });

  const points = new Points(buildGeometry(), material);
  // The zeroed `position` attribute gives a degenerate bounding sphere; the real
  // geometry lives in the shader, so cull manually never.
  points.frustumCulled = false;

  return { points, material };
};
