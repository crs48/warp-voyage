// The single source of truth for how every particle moves. Injected into the
// point-skin material (and, later, the tube/cube/ship materials) so a ripple
// crossing from the tunnel wall onto a cube is literally the same wave math.
//
// This is the render-layer analogue of src/tube/transform.ts: that module is
// the one place tube-space becomes world-space; this is the one place a
// world-space anchor becomes a *displaced* world-space position. Nothing here
// feeds back into collision — it is pure presentation, exactly like the
// centerline bend in src/tube/centerline.ts.

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
// Later stages (ship wake, impact ripples, magnetization) add their own; this
// is the vibration-only baseline.
export const DISPLACE_UNIFORMS_GLSL = /* glsl */ `
uniform float uTime;
uniform float uVibAmplitude;
uniform float uVibFrequency;
uniform float uVibDrift;
`;

// displace: nudge a world-space (camera-relative) anchor by the sum of every
// active effect. Sampling noise at the *camera-relative* anchor keeps motion
// continuous across the tube's per-cell scroll wrap — particles never boil or
// reseed, so a single one stays trackable for its whole life on screen.
export const DISPLACE_GLSL = /* glsl */ `
vec3 displace(vec3 anchor, vec3 inward, float seed){
  vec3 samplePoint = anchor * uVibFrequency + vec3(0.0, 0.0, uTime * uVibDrift) + seed;
  vec3 vibration = curlNoise(samplePoint) * uVibAmplitude;
  return anchor + vibration;
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
