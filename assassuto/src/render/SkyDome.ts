import * as THREE from 'three';

export interface SkyColors {
  top: number;
  horizon: number;
  sun: number;
  cloud: number;
  cloudShadow: number;
  cloudCover: number;
}

/**
 * Stylized gradient sky with a soft sun halo and drifting procedural clouds (anime look).
 * Writes linear colour; tone mapping is applied by the output pass like the rest of the scene.
 */
export function createSkyDome(c: SkyColors, sunDir: THREE.Vector3, radius = 820): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(c.top) },
      horizonColor: { value: new THREE.Color(c.horizon) },
      sunColor: { value: new THREE.Color(c.sun) },
      cloudColor: { value: new THREE.Color(c.cloud) },
      cloudShadow: { value: new THREE.Color(c.cloudShadow) },
      cloudCover: { value: c.cloudCover },
      sunDir: { value: sunDir.clone().normalize() },
      time: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor, horizonColor, sunColor, cloudColor, cloudShadow, sunDir;
      uniform float cloudCover, time;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float s = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
        return s;
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -1.0, 1.0);
        vec3 col = mix(horizonColor, topColor, pow(smoothstep(0.0, 0.75, h), 0.8));
        col = mix(col, horizonColor * 0.92, smoothstep(0.0, -0.25, h));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(sd, 6.0) * 0.25 + pow(sd, 64.0) * 0.6);
        col = mix(col, sunColor * 3.0, smoothstep(0.9993, 0.9997, sd));
        if (h > 0.02) {
          vec2 uv = d.xz / (h + 0.18) * 1.6 + vec2(time * 0.006, time * 0.002);
          float n = fbm(uv);
          float cov = smoothstep(1.0 - cloudCover, 1.0 - cloudCover + 0.22, n);
          float shade = smoothstep(0.35, 0.8, fbm(uv * 1.7 + 3.1));
          vec3 cc = mix(cloudColor, cloudShadow, shade * 0.55) + sunColor * pow(sd, 8.0) * 0.4;
          col = mix(col, cc, cov * smoothstep(0.02, 0.2, h) * 0.95);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.name = 'sky';
  return mesh;
}
