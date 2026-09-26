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
