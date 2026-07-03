// The single source of truth for how every particle moves. Injected into the
// point-skin material (and, later, the tube/cube/ship materials) so a ripple
// crossing from the tunnel wall onto a cube is literally the same wave math.
//
// This is the render-layer analogue of src/tube/transform.ts: that module is
// the one place tube-space becomes world-space; this is the one place a
// world-space anchor becomes a *displaced* world-space position. Nothing here
// feeds back into collision — it is pure presentation, exactly like the
// centerline bend in src/tube/centerline.ts.

import { MAX_IMPACTS } from "../../game/impacts";

// Ashima / Stefan Gustavson 3D simplex noise (webgl-noise, MIT). The canonical
// GPU noise primitive; `curlNoise` below is built from it.
export const SIMPLEX_NOISE_GLSL = /* glsl */ `
vec3 wv_mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 wv_mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 wv_permute(vec4 x){ return wv_mod289(((x * 34.0) + 1.0) * x); }
vec4 wv_taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = wv_mod289(i);
  vec4 p = wv_permute(wv_permute(wv_permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = wv_taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

// Divergence-free curl of a vector potential built from three decorrelated
// snoise fields. Divergence-free flow is what makes neighbouring particles
// swirl *together* into filaments — the coherent, faintly magnetic motion the
// brief asks for — without any particle ever consulting its neighbours.
export const CURL_NOISE_GLSL = /* glsl */ `
vec3 curlNoise(vec3 p){
  const float e = 0.1;
  const vec3 o2 = vec3(123.4, 0.0, 0.0);
  const vec3 o3 = vec3(0.0, 234.5, 0.0);
  float inv = 1.0 / (2.0 * e);

  float dp3dy = (snoise(p + o3 + vec3(0.0, e, 0.0)) - snoise(p + o3 - vec3(0.0, e, 0.0))) * inv;
  float dp2dz = (snoise(p + o2 + vec3(0.0, 0.0, e)) - snoise(p + o2 - vec3(0.0, 0.0, e))) * inv;
  float dp1dz = (snoise(p      + vec3(0.0, 0.0, e)) - snoise(p      - vec3(0.0, 0.0, e))) * inv;
  float dp3dx = (snoise(p + o3 + vec3(e, 0.0, 0.0)) - snoise(p + o3 - vec3(e, 0.0, 0.0))) * inv;
  float dp2dx = (snoise(p + o2 + vec3(e, 0.0, 0.0)) - snoise(p + o2 - vec3(e, 0.0, 0.0))) * inv;
  float dp1dy = (snoise(p      + vec3(0.0, e, 0.0)) - snoise(p      - vec3(0.0, e, 0.0))) * inv;

  return vec3(dp3dy - dp2dz, dp1dz - dp3dx, dp2dx - dp1dy);
}
`;

// The displacement uniforms shared by every material that uses displace().
// uRadius is declared by the tube-anchor chunk, so it is not repeated here.
export const DISPLACE_UNIFORMS_GLSL = /* glsl */ `
uniform float uTime;
uniform float uVibAmplitude;
uniform float uVibFrequency;
uniform float uVibDrift;

uniform float uShipS;
uniform float uShipTheta;
uniform float uShipSpeed;
uniform float uWakeAmplitude;

uniform float uImpactAmplitude;
uniform float uImpactFrequency;
uniform float uImpactSpeed;
uniform float uImpactFalloff;
uniform float uImpactLifetime;
uniform vec4 uImpacts[${String(MAX_IMPACTS)}];

uniform float uCoherence;
uniform float uMagAmplitude;
uniform float uMagFrequency;
uniform float uMagDrift;
`;

// displace: nudge a world-space (camera-relative) anchor by the sum of every
// active effect. Sampling noise at the *camera-relative* anchor keeps motion
// continuous across the tube's per-cell scroll wrap — particles never boil or
// reseed, so a single one stays trackable for its whole life on screen. The wake
// and impact terms take the particle's tube-space (s, θ) so their geometry is a
// pure function of tube space — the same input collision uses, never mutated.
export const DISPLACE_GLSL = /* glsl */ `
float wv_wrapAngle(float a){ return atan(sin(a), cos(a)); }

// A trailing, oscillating ring behind the ship's angular line: the wall lifts as
// the ship skims it and settles ahead of it.
float wv_wakeRadial(float sTube, float thetaTube){
  float dTheta = wv_wrapAngle(thetaTube - uShipTheta);
  float ds = sTube - uShipS;                       // >0 ahead of the ship, <0 behind
  float angularGate = exp(-dTheta * dTheta * 6.0);
  float trail = smoothstep(-10.0, -1.0, ds) * (1.0 - smoothstep(0.0, 3.0, ds));
  float ripple = sin(ds * 1.1 - uTime * 6.0);
  float speedBoost = 0.7 + 0.3 * uShipSpeed;
  return uWakeAmplitude * angularGate * trail * ripple * speedBoost;
}

// Sum of expanding, decaying rings from the live near-miss impacts.
float wv_impactRadial(float sTube, float thetaTube){
  float total = 0.0;
  for (int i = 0; i < ${String(MAX_IMPACTS)}; i++){
    vec4 impact = uImpacts[i];                      // (s, theta, age, strength)
    if (impact.w <= 0.0) continue;
    float ds = sTube - impact.x;
    float dTheta = wv_wrapAngle(thetaTube - impact.y);
    float dist = length(vec2(ds, dTheta * uRadius));
    float ageNorm = clamp(impact.z / uImpactLifetime, 0.0, 1.0);
    float envelope = smoothstep(0.0, 0.12, ageNorm) * (1.0 - smoothstep(0.45, 1.0, ageNorm));
    float ring = sin(dist * uImpactFrequency - impact.z * uImpactSpeed);
    float spatial = exp(-dist * dist * uImpactFalloff);
    total += impact.w * envelope * ring * spatial;
  }
  return total * uImpactAmplitude;
}

vec3 displace(vec3 anchor, vec3 inward, float sTube, float thetaTube, float seed){
  vec3 samplePoint = anchor * uVibFrequency + vec3(0.0, 0.0, uTime * uVibDrift) + seed;
  vec3 pos = anchor + curlNoise(samplePoint) * uVibAmplitude;

  float radial = wv_wakeRadial(sTube, thetaTube) + wv_impactRadial(sTube, thetaTube);
  pos += inward * radial;

  // Magnetization: neighbouring particles share this curl-noise flow field, so
  // they drift into clumps and filaments together. uCoherence scales it in and
  // out; at 0 the particles sit crisply on the lattice.
  vec3 flow = curlNoise(anchor * uMagFrequency + vec3(uTime * uMagDrift));
  pos += flow * uMagAmplitude * uCoherence;
  return pos;
}
`;

// Everything a consumer needs, in dependency order, ready to concatenate ahead
// of a vertex shader's main().
export const DISPLACEMENT_CHUNK = [
  SIMPLEX_NOISE_GLSL,
  CURL_NOISE_GLSL,
  DISPLACE_UNIFORMS_GLSL,
  DISPLACE_GLSL,
].join("\n");
