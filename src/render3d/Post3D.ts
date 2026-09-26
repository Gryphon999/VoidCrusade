import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { LUTPass } from 'three/examples/jsm/postprocessing/LUTPass.js';
import ashfall from '../assets/baked/lut-ashfall.png';
import veyra from '../assets/baked/lut-veyra.png';
import khorvan from '../assets/baked/lut-khorvan.png';
import proving from '../assets/baked/lut-proving.png';

const LUTS: Record<string, string> = { ashfall, veyra, khorvan, proving };
const SIZE = 16;

/** Colour grade from the baked LUT strip for a map (loaded async; the pass is off until ready). */
export function gradePass(mapId: string): LUTPass {
  const pass = new LUTPass({ intensity: 1 });
  pass.enabled = false;
  const img = new Image();
  img.onload = (): void => {
    const c = document.createElement('canvas');
    c.width = SIZE * SIZE;
    c.height = SIZE;
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    const data = new Uint8Array(SIZE * SIZE * SIZE * 4);
    for (let b = 0; b < SIZE; b++) {
      for (let g = 0; g < SIZE; g++) {
        for (let r = 0; r < SIZE; r++) {
          const s = (g * SIZE * SIZE + b * SIZE + r) * 4;
          const d = (b * SIZE * SIZE + g * SIZE + r) * 4;
          data[d] = px[s];
          data[d + 1] = px[s + 1];
          data[d + 2] = px[s + 2];
          data[d + 3] = 255;
        }
      }
    }
    const tex = new THREE.Data3DTexture(data, SIZE, SIZE, SIZE);
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    pass.lut = tex;
    pass.enabled = true;
  };
  img.src = LUTS[mapId] ?? LUTS.ashfall;
  return pass;
}

/** Lens finish: soft vignette and fine animated film grain (display-referred, after grading). */
export function finishPass(vignette: number, grain: number): ShaderPass {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uVignette: { value: vignette },
      uGrain: { value: grain },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uVignette;
      uniform float uGrain;
      varying vec2 vUv;
      float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        vec2 d = vUv - 0.5;
        float v = 1.0 - uVignette * smoothstep(0.35, 0.85, length(d * vec2(1.25, 1.0)));
        c.rgb *= v;
        float n = h(vUv * 1024.0 + fract(uTime * 7.13) * 91.0) - 0.5;
        c.rgb += n * uGrain * (1.0 - c.rgb * 0.6);
        gl_FragColor = c;
      }`,
  });
}

/**
 * Fog of war as a post effect: world position is rebuilt from the depth buffer and looked up
 * in the fog grid (bilinear plus a small blur, with drifting smoke noise on the edges).
 * Explored ground turns cold and desaturated; unexplored ground sinks into dark smoke.
 */
export function fogPass(noise: THREE.Texture): ShaderPass {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null },
      tFog: { value: null },
      uInvPV: { value: new THREE.Matrix4() },
      uFogOrigin: { value: new THREE.Vector2() },
      uFogSize: { value: new THREE.Vector2(1, 1) },
      uTexel: { value: new THREE.Vector2(1, 1) },
      uNoise: { value: noise },
      uTime: { value: 0 },
      uOn: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform sampler2D tDepth;
      uniform sampler2D tFog;
      uniform sampler2D uNoise;
      uniform mat4 uInvPV;
      uniform vec2 uFogOrigin;
      uniform vec2 uFogSize;
      uniform vec2 uTexel;
      uniform float uTime;
      uniform float uOn;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        if (uOn < 0.5) { gl_FragColor = c; return; }
        float d = texture2D(tDepth, vUv).r;
        vec4 w = uInvPV * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
        w /= w.w;
        vec2 f = (w.xz - uFogOrigin) / uFogSize;
        float a = texture2D(tFog, f).a * 0.4;
        a += texture2D(tFog, f + vec2(uTexel.x, 0.0) * 0.8).a * 0.15;
        a += texture2D(tFog, f - vec2(uTexel.x, 0.0) * 0.8).a * 0.15;
        a += texture2D(tFog, f + vec2(0.0, uTexel.y) * 0.8).a * 0.15;
        a += texture2D(tFog, f - vec2(0.0, uTexel.y) * 0.8).a * 0.15;
        float n = texture2D(uNoise, w.xz / 700.0 + vec2(uTime * 0.006, uTime * 0.003)).r;
        float n2 = texture2D(uNoise, w.xz / 260.0 - vec2(uTime * 0.01, 0.0)).r;
        // Smoky, drifting edges: noise pushes the boundary in and out.
        float edge = a * (1.0 - a) * 4.0;
        a = clamp(a + (n * 0.6 + n2 * 0.4 - 0.5) * 0.5 * edge, 0.0, 1.0);
        float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 cold = vec3(l) * vec3(0.72, 0.8, 1.0);
        float explored = smoothstep(0.08, 0.45, a);
        vec3 col = mix(c.rgb, cold * 0.62, explored * 0.85);
        float dark = smoothstep(0.55, 0.95, a);
        vec3 smoke = vec3(0.006, 0.0065, 0.009) * (0.5 + 1.0 * n);
        col = mix(col, smoke, dark * 0.96);
        gl_FragColor = vec4(col, c.a);
      }`,
  });
}

/**
 * Colour grade (baked 16³ LUT) and lens finish (vignette, grain) in one full-screen pass.
 * Until the LUT image has loaded the grade is skipped.
 */
export function gradeFinishPass(mapId: string, vignette: number, grain: number): ShaderPass {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      tLut: { value: null },
      uHasLut: { value: 0 },
      uTime: { value: 0 },
      uVignette: { value: vignette },
      uGrain: { value: grain },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      precision highp sampler3D;
      uniform sampler2D tDiffuse;
      uniform sampler3D tLut;
      uniform float uHasLut;
      uniform float uTime;
      uniform float uVignette;
      uniform float uGrain;
      varying vec2 vUv;
      float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        if (uHasLut > 0.5) {
          vec3 uvw = clamp(c.rgb, 0.0, 1.0) * (15.0 / 16.0) + 0.5 / 16.0;
          c.rgb = texture(tLut, uvw).rgb;
        }
        vec2 d = vUv - 0.5;
        c.rgb *= 1.0 - uVignette * smoothstep(0.35, 0.85, length(d * vec2(1.25, 1.0)));
        float n = h(vUv * 1024.0 + fract(uTime * 7.13) * 91.0) - 0.5;
        c.rgb += n * uGrain * (1.0 - c.rgb * 0.6);
        gl_FragColor = c;
      }`,
  });
  const lut = gradePass(mapId);
  // Borrow the loader of gradePass: poll until its texture is ready.
  const poll = (): void => {
    if (lut.lut) {
      pass.uniforms.tLut.value = lut.lut;
      pass.uniforms.uHasLut.value = 1;
    } else setTimeout(poll, 50);
  };
  poll();
  return pass;
}
