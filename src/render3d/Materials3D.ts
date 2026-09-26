import * as THREE from 'three';
import { ValueNoise } from '../render/Noise';
import { makeRng } from '../utils/rng';

/** Seamless procedural textures for the 3D battlefield (generated once per battle). */

function canvas(size: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, ctx: c.getContext('2d') as CanvasRenderingContext2D };
}

function toTexture(c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * Ground detail (grayscale, linear): fine grain, pebbles and hairline cracks. Used both to
 * modulate the albedo up close and as a bump source, so the ground never looks like a flat print.
 */
export function detailTexture(seed: number, size = 512): THREE.CanvasTexture {
  const { c, ctx } = canvas(size);
  const n = new ValueNoise(seed);
  const img = ctx.createImageData(size, size);
  const period = 16;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * period;
      const v = (y / size) * period;
      let h = n.fbm(u, v, 5, period) * 0.7 + n.noise(u * 6, v * 6, period * 6) * 0.3;
      h = Math.min(1, Math.max(0, (h - 0.5) * 1.6 + 0.5));
      const k = (y * size + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = h * 255;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const rnd = makeRng(seed + 5);
  // Pebbles: raised dots with a darker rim.
  for (let i = 0; i < 260; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 1 + rnd() * 3.5;
    for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      const g = ctx.createRadialGradient(x + dx - r * 0.3, y + dy - r * 0.3, 0, x + dx, y + dy, r * 1.4);
      g.addColorStop(0, 'rgba(255,255,255,0.75)');
      g.addColorStop(0.7, 'rgba(150,150,150,0.4)');
      g.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Hairline cracks (dark grooves).
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  for (let i = 0; i < 18; i++) {
    let x = rnd() * size;
    let y = rnd() * size;
    let a = rnd() * Math.PI * 2;
    ctx.lineWidth = 0.6 + rnd() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 14; s++) {
      a += (rnd() - 0.5) * 0.9;
      x += Math.cos(a) * 7;
      y += Math.sin(a) * 7;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return toTexture(c, false);
}

/**
 * Rock face (sRGB): horizontal strata bands, vertical fractures and weathering, tileable in
 * both directions so it can be projected on any cliff (triplanar).
 */
export function rockTexture(dark: number, light: number, seed: number, size = 512): THREE.CanvasTexture {
  const { c, ctx } = canvas(size);
  const n = new ValueNoise(seed);
  const img = ctx.createImageData(size, size);
  // Interpolate in sRGB bytes (the canvas is an sRGB image).
  const cd = { r: ((dark >> 16) & 255) / 255, g: ((dark >> 8) & 255) / 255, b: (dark & 255) / 255 };
  const cl = { r: ((light >> 16) & 255) / 255, g: ((light >> 8) & 255) / 255, b: (light & 255) / 255 };
  const period = 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * period;
      const v = (y / size) * period;
      const warp = n.fbm(u * 0.5, v * 0.5, 3, period / 2) * 5;
      const strata = Math.sin((v * 3 + warp) * Math.PI) * 0.5 + 0.5;
      const grain = n.fbm(u * 2, v * 2, 4, period * 2);
      const frac = Math.abs(n.noise(u * 1.5 + 11, v * 0.3, period * 1.5) - 0.5) < 0.03 ? 0.35 : 1;
      let t = (strata * 0.2 + grain * 0.95 - 0.1) * frac;
      t = Math.min(1, Math.max(0, t));
      const k = (y * size + x) * 4;
      img.data[k] = (cd.r + (cl.r - cd.r) * t) * 255;
      img.data[k + 1] = (cd.g + (cl.g - cd.g) * t) * 255;
      img.data[k + 2] = (cd.b + (cl.b - cd.b) * t) * 255;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, true);
}

/**
 * Road plating for the 3D terrain (sRGB canvas, tileable): staggered plates of slightly
 * different tone, dark seams, bolt heads at the corners, rust streaks and scratches.
 */
export function platingCanvas(dark: number, light: number, seed: number, size = 256): HTMLCanvasElement {
  const { c, ctx } = canvas(size);
  const rnd = makeRng(seed);
  const hex = (n: number): [number, number, number] => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const [dr, dg, db] = hex(dark);
  const [lr, lg, lb] = hex(light);
  const mix = (t: number): string => `rgb(${Math.round(dr + (lr - dr) * t)},${Math.round(dg + (lg - dg) * t)},${Math.round(db + (lb - db) * t)})`;
  const rows = 4;
  const ph = size / rows;
  const pw = size / 2;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? pw / 2 : 0;
    for (let i = -1; i < 3; i++) {
      const x = i * pw + off;
      const y = r * ph;
      ctx.fillStyle = mix(0.35 + rnd() * 0.35);
      ctx.fillRect(x, y, pw, ph);
      // Soft top-left light and bottom-right shade per plate.
      const g = ctx.createLinearGradient(x, y, x + pw, y + ph);
      g.addColorStop(0, 'rgba(255,255,255,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, pw, ph);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, pw - 2, ph - 2);
      for (const [bx, by] of [[x + 7, y + 7], [x + pw - 7, y + 7], [x + 7, y + ph - 7], [x + pw - 7, y + ph - 7]]) {
        ctx.fillStyle = 'rgba(20,20,22,0.8)';
        ctx.beginPath();
        ctx.arc(bx, by, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(200,200,205,0.35)';
        ctx.beginPath();
        ctx.arc(bx - 0.6, by - 0.6, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Rust streaks running down from seams, and scratches.
  for (let i = 0; i < 14; i++) {
    const x = rnd() * size;
    const y = Math.floor(rnd() * rows) * ph + 2;
    const g = ctx.createLinearGradient(x, y, x, y + ph * 0.8);
    g.addColorStop(0, 'rgba(120,58,26,0.55)');
    g.addColorStop(1, 'rgba(120,58,26,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 3, y, 6 + rnd() * 6, ph * 0.8);
  }
  ctx.strokeStyle = 'rgba(210,210,215,0.18)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 40; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const a = rnd() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * (6 + rnd() * 14), y + Math.sin(a) * (6 + rnd() * 14));
    ctx.stroke();
  }
  return c;
}

let sharedDetail: THREE.CanvasTexture | null = null;
/** One detail map shared by every model surface (buildings, props, units). */
export function surfaceDetail(): THREE.CanvasTexture {
  if (!sharedDetail) sharedDetail = detailTexture(4242, 256);
  return sharedDetail;
}

export type SurfaceKind = 'metal' | 'organic' | 'stone';

/**
 * Patches a vertex-coloured standard material with procedural surface work in model space, so
 * kit-bashed primitives stop reading as flat plastic:
 * - metal: riveted panel seams, per-panel tone variation, rain streaks and grime;
 * - organic: mottled wet skin with glossy ridges;
 * - stone: grain and chips;
 * plus contact darkening near the ground and a micro bump from the detail map.
 * `panel` is the seam spacing in px.
 */
export function surfaceMaterial(mat: THREE.MeshStandardMaterial, kind: SurfaceKind, panel = 18, strength = 1): THREE.MeshStandardMaterial {
  const detail = surfaceDetail();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uDetail = { value: detail };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocalPos;\nvarying vec3 vLocalNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalPos = position;\nvLocalNormal = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vLocalPos;
varying vec3 vLocalNormal;
uniform sampler2D uDetail;
float surfHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float triDetail(vec3 p, vec3 n, float s) {
  vec3 w = pow(abs(n), vec3(3.0));
  w /= (w.x + w.y + w.z + 1e-4);
  return texture2D(uDetail, p.zy / s).r * w.x + texture2D(uDetail, p.xz / s).r * w.y + texture2D(uDetail, p.xy / s).r * w.z;
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec3 sN = normalize(vLocalNormal);
  float sD = mix(0.5, triDetail(vLocalPos, sN, 70.0) * 0.55 + triDetail(vLocalPos + 13.0, sN, 23.0) * 0.45, ${strength.toFixed(2)});
  // Contact shadow: the lowest part of every model sits darker in the ground.
  diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 16.0, vLocalPos.y));
  ${kind === 'metal' ? `
  {
    vec3 q = fract(vLocalPos / ${panel.toFixed(1)} + 0.5);
    vec3 e = smoothstep(0.0, 0.05, q) * smoothstep(1.0, 0.95, q);
    e = mix(e, vec3(1.0), step(0.7, abs(sN)));
    float seam = e.x * e.y * e.z;
    float tone = 0.9 + surfHash(floor(vLocalPos / ${panel.toFixed(1)} + 0.5)) * 0.2;
    // Streaks run down vertical faces.
    float streak = texture2D(uDetail, vec2((vLocalPos.x + vLocalPos.z) / 90.0, vLocalPos.y / 900.0)).r;
    float vert = 1.0 - abs(sN.y);
    diffuseColor.rgb *= mix(mix(0.55, 0.8, abs(sN.y)), 1.0, seam) * tone * (0.8 + sD * 0.35) * mix(1.0, 0.75 + streak * 0.4, vert);
  }` : kind === 'organic' ? `
  diffuseColor.rgb *= 0.65 + sD * 0.6;
  diffuseColor.rgb += vec3(0.05, 0.0, 0.04) * smoothstep(0.6, 0.8, sD);` : `
  diffuseColor.rgb *= 0.7 + sD * 0.5;`}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  ${kind === 'organic' ? 'roughnessFactor *= 0.45 + sD * 0.8;' : kind === 'metal' ? 'roughnessFactor *= 0.8 + sD * 0.5;' : ''}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    vec2 dH = vec2(dFdx(sD), dFdy(sD)) * ${kind === 'organic' ? '1.6' : '0.9'};
    vec3 vSigmaX = dFdx(-vViewPosition);
    vec3 vSigmaY = dFdy(-vViewPosition);
    vec3 R1 = cross(vSigmaY, normal);
    vec3 R2 = cross(normal, vSigmaX);
    float fDet = dot(vSigmaX, R1);
    vec3 grad = sign(fDet) * (dH.x * R1 + dH.y * R2);
    normal = normalize(abs(fDet) * normal - grad);
  }`);
  };
  mat.customProgramCacheKey = () => `surface-${kind}-${panel}-${strength}`;
  return mat;
}
