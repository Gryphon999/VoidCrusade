import * as THREE from 'three';
import { TILE, TILE_SIZE } from '../config';
import { TILE_COLORS, biomeForMap } from '../render/Biomes';
import { createTerrainTextures } from '../render/TerrainTextures';
import { ValueNoise } from '../render/Noise';
import { detailTexture, groundMaterials, platingCanvas, rockTexture } from './Materials3D';
import type { MapSystem } from '../systems/MapSystem';

/** Height of raised cliff blocks in 3D (px). Nothing walks on cliffs, so this is purely visual. */
export const CLIFF_3D = 105;
/** Unplayable ring of mountains around the map so the view never shows a void (tiles). */
export const MARGIN = 8;
/** Texture resolution: canvas pixels per tile. */
const TPX = 32;
/** Mesh subdivisions per tile; large maps use fewer so the ground stays near the same triangle count. */
const subFor = (w: number, h: number): number => ((w + MARGIN * 2) * (h + MARGIN * 2) > 8000 ? 3 : 4);
/** Tiles along one side of a terrain chunk. */
const CHUNK = 16;
/** Marker for tiles outside the playable map. */
const OUT = -1;

/**
 * Height-field battlefield ground.
 *
 * - Shape: flat rolling ground, cliffs raised as steep rock blocks with rough tops, flat roads,
 *   and a ring of mountains outside the playable map.
 * - Colour: a baked top-down albedo blends the biome's seamless materials with noise masks.
 * - Shader (onBeforeCompile on a standard PBR material): world-space detail grain and bump so
 *   the ground holds up close, and triplanar layered rock on steep faces so cliff walls are
 *   real rock instead of a stretched top texture.
 */
export class Terrain3D {
  /** The ground, cut into chunks so that only the part in view (and in the shadow map) is drawn. */
  readonly mesh = new THREE.Group();
  private material!: THREE.Material;
  private cliff: Float32Array;
  /** Shell craters on open ground: dents with raised rims (visual only). */
  readonly craters: { x: number; y: number; r: number }[] = [];
  private noise: ValueNoise;
  private textures: THREE.Texture[] = [];
  private readonly W: number;
  private readonly H: number;
  private readonly sub: number;
  private readonly vw: number;
  private readonly vh: number;

  /** `rich` samples every material at two scales; the Low tier takes one sample of each. */
  constructor(private map: MapSystem, anisotropy: number, rich = true) {
    this.W = map.width;
    this.H = map.height;
    this.sub = subFor(this.W, this.H);
    this.vw = (this.W + MARGIN * 2) * this.sub + 1;
    this.vh = (this.H + MARGIN * 2) * this.sub + 1;
    let seed = 17;
    for (const ch of map.def.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    this.noise = new ValueNoise(seed + 3);
    this.cliff = this.cliffField();
    this.craters = this.placeCraters(seed);
    const biome = biomeForMap(map.def.id);
    const albedo = this.bakeAlbedo(seed);
    albedo.anisotropy = anisotropy;
    const detail = detailTexture(seed + 11);
    const rock = rockTexture(biome.cliffFace[0], biome.cliffTop[1], seed + 13);
    const ground = groundMaterials(seed + 17);
    const plating = new THREE.CanvasTexture(platingCanvas(biome.plating[0], biome.plating[1], seed + 900));
    plating.wrapS = plating.wrapT = THREE.RepeatWrapping;
    plating.colorSpace = THREE.SRGBColorSpace;
    plating.anisotropy = anisotropy;
    ground.tone.anisotropy = ground.height.anisotropy = anisotropy;
    const mask = this.bakeMask();
    const mask2 = this.bakeMask2();
    this.textures.push(albedo, detail, rock, ground.tone, ground.height, plating, mask, mask2);
    const lava = new THREE.Color(biome.lava ?? 0x000000);
    const magma = new THREE.Color((biome.magma ?? TILE_COLORS.magma)[1]);
    const water = new THREE.Color((biome.water ?? TILE_COLORS.water)[1]);
    const waterDark = new THREE.Color((biome.water ?? TILE_COLORS.water)[0]);
    const scrub = new THREE.Color((biome.scrub ?? TILE_COLORS.scrub)[1]);
    const ice = new THREE.Color((biome.ice ?? TILE_COLORS.ice)[1]);
    const mat = new THREE.MeshStandardMaterial({ map: albedo, vertexColors: true, roughness: 0.92, metalness: 0.02 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uDetail = { value: detail };
      sh.uniforms.uRock = { value: rock };
      sh.uniforms.uTone = { value: ground.tone };
      sh.uniforms.uHeight = { value: ground.height };
      sh.uniforms.uPlating = { value: plating };
      sh.uniforms.uMask = { value: mask };
      sh.uniforms.uMaskRect = { value: new THREE.Vector4(MARGIN * TILE_SIZE, MARGIN * TILE_SIZE, (this.W + MARGIN * 2) * TILE_SIZE, (this.H + MARGIN * 2) * TILE_SIZE) };
      sh.uniforms.uWet = { value: biome.wet ?? 0 };
      sh.uniforms.uLava = { value: lava };
      sh.uniforms.uLavaOn = { value: biome.lava ? 1 : 0 };
      sh.uniforms.uMask2 = { value: mask2 };
      sh.uniforms.uMagma = { value: magma };
      sh.uniforms.uWater = { value: water };
      sh.uniforms.uWaterDark = { value: waterDark };
      sh.uniforms.uScrub = { value: scrub };
      sh.uniforms.uIce = { value: ice };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNormal;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWorldNormal = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
${rich ? '#define GROUND_RICH' : ''}
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
uniform sampler2D uDetail;
uniform sampler2D uRock;
uniform sampler2D uTone;
uniform sampler2D uHeight;
uniform sampler2D uPlating;
uniform sampler2D uMask;
uniform vec4 uMaskRect;
uniform float uWet;
uniform vec3 uLava;
uniform float uLavaOn;
uniform sampler2D uMask2;
uniform vec3 uMagma;
uniform vec3 uWater;
uniform vec3 uWaterDark;
uniform vec3 uScrub;
uniform vec3 uIce;
// Layered rock at two scales, projected from three sides so no face is stretched.
vec3 triRock(vec3 p, vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= (w.x + w.y + w.z);
  vec3 x = texture2D(uRock, p.zy / 220.0).rgb;
  vec3 y = texture2D(uRock, p.xz / 220.0).rgb;
  vec3 z = texture2D(uRock, p.xy / 220.0).rgb;
#ifdef GROUND_RICH
  x = x * 0.65 + texture2D(uRock, p.zy / 61.0 + 0.31).rgb * 0.35;
  y = y * 0.65 + texture2D(uRock, p.xz / 61.0 + 0.31).rgb * 0.35;
  z = z * 0.65 + texture2D(uRock, p.xy / 61.0 + 0.31).rgb * 0.35;
#endif
  return x * w.x + y * w.y + z * w.z;
}
// Relief of the rock face: fractures and ledges, for bump and for dark cracks.
float triRelief(vec3 p, vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= (w.x + w.y + w.z);
  return texture2D(uHeight, p.zy / 150.0).r * w.x + texture2D(uHeight, p.xz / 150.0).r * w.y + texture2D(uHeight, p.xy / 150.0).r * w.z;
}
float gRelief;
float gWet;
float gLava;
float gMagma;
float gIce;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
  vec2 gp = vWorldPos.xz;
  vec3 mk = texture2D(uMask, (gp + uMaskRect.xy) / uMaskRect.zw).rgb;
  // Three ground materials, each sampled at two scales so the tiling never shows.
  vec3 hA = texture2D(uHeight, gp / 330.0).rgb;
  vec3 tA = texture2D(uTone, gp / 330.0).rgb;
#ifdef GROUND_RICH
  vec3 hts = hA * 0.62 + texture2D(uHeight, gp / 97.0 + 0.43).rgb * 0.38;
  vec3 tones = tA * 0.62 + texture2D(uTone, gp / 97.0 + 0.43).rgb * 0.38;
#else
  vec3 hts = hA;
  vec3 tones = tA;
#endif
  // Where each material lies: broad noise fields, pushed along by the relief so the borders
  // follow crack lines and the gaps between stones. Scree gathers at the foot of cliffs.
  float fieldG = texture2D(uDetail, gp / 2300.0 + 0.11).r * 0.7 + texture2D(uDetail, gp / 610.0).r * 0.3;
  float fieldD = texture2D(uDetail, gp / 1900.0 + 0.57).r * 0.7 + texture2D(uDetail, gp / 530.0 + 0.2).r * 0.3;
  float wG = smoothstep(0.5, 0.58, fieldG + (hts.g - 0.5) * 0.3 + mk.b * 0.4 + mk.g * 0.25);
  float wD = smoothstep(0.52, 0.6, fieldD + (hts.b - 0.5) * 0.22 - mk.b * 0.3) * (1.0 - wG);
  float wC = 1.0 - wG - wD;
  float tone = tones.r * wC + tones.g * wG + tones.b * wD;
  gRelief = hts.r * wC + hts.g * wG + hts.b * wD;
  // Each material leans the biome colour its own way: earth warm, stone cold, dust pale.
  vec3 tint = vec3(1.06, 1.0, 0.92) * wC + vec3(0.9, 0.96, 1.06) * wG + vec3(1.12, 1.08, 0.98) * wD;
  vec3 groundCol = diffuseColor.rgb * tint * (0.38 + tone * 1.3);
  // Broad warm and cool drifts, so a wide view is never one flat colour.
  float macro = texture2D(uDetail, gp / 3100.0).r;
  float macro2 = texture2D(uDetail, gp / 5200.0 + 0.7).r;
  groundCol *= mix(vec3(0.84, 0.88, 0.96), vec3(1.14, 1.06, 0.92), macro) * (0.88 + macro2 * 0.26);
  // Damp, darker earth at the foot of cliffs and around ruins.
  groundCol *= 1.0 - mk.b * 0.28;
  // Roads: plating at full sharpness, worn through to the ground along its edges.
  vec3 plate = texture2D(uPlating, gp / 256.0).rgb;
  float plateH = dot(plate, vec3(0.33));
  float roadW = smoothstep(0.45, 0.62, mk.r + (gRelief - 0.5) * 0.25);
  groundCol = mix(groundCol, plate * (0.75 + tone * 0.5) * (0.9 + macro * 0.2), roadW);
  gRelief = mix(gRelief, plateH * 0.6 + 0.2, roadW);
  // Standing water in the hollows of wet ground.
  gWet = uWet * smoothstep(0.62, 0.7, texture2D(uDetail, gp / 1400.0 + 0.33).r * 0.75 + (1.0 - gRelief) * 0.3) * (1.0 - roadW) * (1.0 - mk.b);
  groundCol = mix(groundCol, groundCol * vec3(0.32, 0.4, 0.36), gWet);
  // Fire under the crust: the cracks of volcanic ground glow where the field runs hot.
  float hot = smoothstep(0.56, 0.74, texture2D(uDetail, gp / 1700.0 + 0.81).r);
  gLava = uLavaOn * hot * (1.0 - roadW) * (1.0 - mk.g) * (1.0 - smoothstep(0.06, 0.3, hA.r));
  groundCol = mix(groundCol, groundCol * 0.35, gLava);
  // Special tiles from the second mask: shallows, magma, thicket, ice.
  vec4 m2 = texture2D(uMask2, (gp + uMaskRect.xy) / uMaskRect.zw);
  float waterW = smoothstep(0.35, 0.6, m2.r + (gRelief - 0.5) * 0.15);
  gMagma = smoothstep(0.4, 0.6, m2.g + (gRelief - 0.5) * 0.2);
  float scrubW = smoothstep(0.35, 0.6, m2.b + (gRelief - 0.5) * 0.3);
  gIce = smoothstep(0.4, 0.6, m2.a + (gRelief - 0.5) * 0.1);
  // Shallows: dark water, pale ripples, the silt bed showing through near the bank.
  float ripple = texture2D(uDetail, gp / 140.0 + 0.5).r * 0.6 + texture2D(uDetail, gp / 47.0 + 0.2).r * 0.4;
  float depth = smoothstep(0.4, 0.75, m2.r);
  vec3 waterCol = mix(uWaterDark, uWater, smoothstep(0.5, 0.9, ripple) * 0.8);
  waterCol = mix(groundCol * 0.3 + waterCol * 0.7, waterCol, depth);
  groundCol = mix(groundCol, waterCol, waterW);
  gWet = max(gWet, waterW);
  float crust = smoothstep(0.35, 0.65, hts.r);
  groundCol = mix(groundCol, mix(uMagma, vec3(0.03, 0.02, 0.02), crust), gMagma);
  gLava = max(gLava, gMagma * (1.0 - crust * 0.85));
  groundCol = mix(groundCol, uScrub * (0.32 + tone * 0.9), scrubW);
  gRelief = mix(gRelief, hts.b * 1.2, scrubW);
  groundCol = mix(groundCol, uIce * (0.58 + tone * 0.32), gIce);
  diffuseColor.rgb = groundCol;
  // Steep faces and raised plateaus: layered rock projected in world space.
  vec3 wn = normalize(vWorldNormal);
  float steep = smoothstep(0.4, 0.72, 1.0 - abs(wn.y));
  float raised = smoothstep(0.0 + ${(CLIFF_3D * 0.45).toFixed(1)}, ${(CLIFF_3D * 0.7).toFixed(1)}, vWorldPos.y);
  float relief = triRelief(vWorldPos, wn);
  vec3 rockCol = triRock(vWorldPos, wn);
  // Strata: bands of lighter and darker stone across the wall, bent by the relief.
  float band = sin((vWorldPos.y + relief * 26.0 + texture2D(uDetail, gp / 800.0).r * 40.0) * 0.21) * 0.5 + 0.5;
  rockCol *= 0.74 + band * 0.4;
  // Fractures go dark, weathered edges of the blocks go pale; rain streaks run down the face.
  rockCol *= 0.45 + smoothstep(0.05, 0.4, relief) * 0.75;
  rockCol += vec3(0.05, 0.045, 0.04) * smoothstep(0.75, 0.95, relief);
  float streak = texture2D(uDetail, vec2((gp.x + gp.y) / 70.0, vWorldPos.y / 900.0)).r;
  rockCol *= mix(1.0, 0.7 + streak * 0.5, steep);
  // Dust and scree settle on every ledge that is not too steep.
  float ledge = (1.0 - steep) * smoothstep(0.45, 0.6, texture2D(uDetail, gp / 390.0 + 0.21).r + (relief - 0.5) * 0.3);
  vec3 topCol = mix(rockCol, groundCol * 1.05, ledge * 0.75);
  diffuseColor.rgb = mix(diffuseColor.rgb, topCol, raised * (1.0 - steep));
  diffuseColor.rgb = mix(diffuseColor.rgb, rockCol, steep);
  gRelief = mix(gRelief, relief, max(steep, raised * (1.0 - ledge)));
  gWet *= 1.0 - max(steep, raised);
  gLava *= 1.0 - max(steep, raised);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  // World-space bump from the relief of whatever material lies here (screen-space derivatives).
  {
    float h = gRelief * mix(1.0, 0.15, gWet);
    vec2 dH = vec2(dFdx(h), dFdy(h)) * mix(3.2, 5.0, steep);
    vec3 vSigmaX = dFdx(-vViewPosition);
    vec3 vSigmaY = dFdy(-vViewPosition);
    vec3 R1 = cross(vSigmaY, normal);
    vec3 R2 = cross(normal, vSigmaX);
    float fDet = dot(vSigmaX, R1);
    vec3 grad = sign(fDet) * (dH.x * R1 + dH.y * R2);
    normal = normalize(abs(fDet) * normal - grad);
  }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.78, steep);
  roughnessFactor = mix(roughnessFactor, 0.62, roadW * 0.6);
  roughnessFactor = mix(roughnessFactor, 0.08, gWet);
  roughnessFactor = mix(roughnessFactor, 0.22, gIce);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += mix(uLava, uMagma, gMagma) * gLava * 3.5;`);
    };
    mat.customProgramCacheKey = () => `terrain-${rich ? 'rich' : 'lean'}`;
    this.material = mat;
    for (const geo of this.buildChunks()) {
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      m.castShadow = true;
      this.mesh.add(m);
    }
  }

  private placeCraters(seed: number): { x: number; y: number; r: number }[] {
    const out: { x: number; y: number; r: number }[] = [];
    let s = seed;
    const rnd = (): number => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    const bases = [this.map.def.playerBase, this.map.def.enemyBase];
    for (let tries = 0; tries < 400 && out.length < Math.round((this.W * this.H) / 118); tries++) {
      const tx = 2 + Math.floor(rnd() * (this.W - 4));
      const ty = 2 + Math.floor(rnd() * (this.H - 4));
      if (this.tile(tx, ty) !== TILE.GROUND) continue;
      if (bases.some((b) => Math.hypot(b.tx - tx, b.ty - ty) < 8)) continue;
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (this.tile(tx + dx, ty + dy) !== TILE.GROUND) ok = false;
      if (!ok || out.some((c) => Math.hypot(c.x - tx * TILE_SIZE, c.y - ty * TILE_SIZE) < 200)) continue;
      out.push({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE, r: 22 + rnd() * 34 });
    }
    return out;
  }

  /** Crater profile at a point: dent below the rim, raised lip around it. */
  private craterAt(x: number, y: number): number {
    let h = 0;
    for (const c of this.craters) {
      const d = Math.hypot(x - c.x, y - c.y) / c.r;
      if (d > 1.6) continue;
      h += d < 1 ? -c.r * 0.28 * (1 - d * d) + c.r * 0.1 * d * d * d : c.r * 0.1 * Math.max(0, 1 - (d - 1) / 0.6) ** 2;
    }
    return h;
  }

  private tile(tx: number, ty: number): number {
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return OUT;
    return this.map.def.tiles[ty][tx];
  }

  /** Depth (px) of the water and magma hollows at a point, blurred over half a tile so the banks slope. */
  private lowField(x: number, y: number): number {
    let s = 0;
    for (let dy = -0.5; dy <= 0.51; dy += 0.5) {
      for (let dx = -0.5; dx <= 0.51; dx += 0.5) {
        const t = this.tile(Math.floor(x / TILE_SIZE + dx), Math.floor(y / TILE_SIZE + dy));
        s += t === TILE.WATER ? 14 : t === TILE.LAVA ? 6 : 0;
      }
    }
    return s / 9;
  }

  /** Smoothed 0..1 cliff coverage at vertex resolution (so blocks get bevelled edges). */
  private cliffField(): Float32Array {
    const f = new Float32Array(this.vw * this.vh);
    for (let j = 0; j < this.vh; j++) {
      for (let i = 0; i < this.vw; i++) {
        const x = i / this.sub - MARGIN;
        const y = j / this.sub - MARGIN;
        let s = 0;
        let n = 0;
        for (let dy = -0.75; dy <= 0.76; dy += 0.75) {
          for (let dx = -0.75; dx <= 0.76; dx += 0.75) {
            const t = this.tile(Math.floor(x + dx - 0.01), Math.floor(y + dy - 0.01));
            s += t === TILE.CLIFF || t === OUT ? 1 : 0;
            n++;
          }
        }
        f[j * this.vw + i] = s / n;
      }
    }
    return f;
  }

  /** Distance (tiles) outside the playable rectangle, 0 inside. */
  private outside(x: number, y: number): number {
    const tx = x / TILE_SIZE;
    const ty = y / TILE_SIZE;
    const dx = Math.max(0, -tx, tx - this.W);
    const dy = Math.max(0, -ty, ty - this.H);
    return Math.hypot(dx, dy);
  }

  /** Ground height (px) at a logical point. */
  heightAt(x: number, y: number): number {
    const fx = Math.min(this.vw - 1.001, Math.max(0, (x / TILE_SIZE + MARGIN) * this.sub));
    const fy = Math.min(this.vh - 1.001, Math.max(0, (y / TILE_SIZE + MARGIN) * this.sub));
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const u = fx - i;
    const v = fy - j;
    const c = this.cliff;
    const W = this.vw;
    const k = c[j * W + i] * (1 - u) * (1 - v) + c[j * W + i + 1] * u * (1 - v) + c[(j + 1) * W + i] * (1 - u) * v + c[(j + 1) * W + i + 1] * u * v;
    return this.shape(k, x, y);
  }

  private shape(cliff: number, x: number, y: number): number {
    const n = this.noise.fbm(x / 260, y / 260, 3);
    // Organic outlines: push the wall line in and out by noise (about ±0.2 tile).
    cliff += (this.noise.fbm(x / 90 + 7.3, y / 90 - 2.1, 3) - 0.5) * 0.5;
    const wall = cliff <= 0.3 ? 0 : cliff >= 0.7 ? 1 : (cliff - 0.3) / 0.4;
    const s = wall * wall * (3 - 2 * wall);
    const rough = this.noise.fbm(x / 70, y / 70, 3) - 0.5;
    const t = this.tile(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE));
    const ground = (n - 0.5) * (t === TILE.ROAD || t === TILE.ICE ? 2 : 7);
    // Rough, terraced tops: a second, lower shelf in places.
    const shelf = this.noise.fbm(x / 160 + 3, y / 160, 3) > 0.58 ? 0.72 : 1;
    let h = ground + s * (CLIFF_3D * shelf + rough * 42);
    // Shallows and magma lie in hollows (smoothed over the tile edge so banks slope).
    const dip = this.lowField(x, y);
    if (dip > 0) h -= dip;
    if (this.craters.length && s < 0.05) h += this.craterAt(x, y);
    // Mountains beyond the map edge: climb away from the playable area.
    const out = this.outside(x, y);
    if (out > 0) h += Math.min(1, out / 5) * (90 + this.noise.fbm(x / 400, y / 400, 4) * 260);
    return h;
  }

  /** One grid of vertices per chunk of tiles; heights, normals and UVs come from world position, so chunks meet without a seam. */
  private buildChunks(): THREE.BufferGeometry[] {
    const out: THREE.BufferGeometry[] = [];
    const tw = this.W + MARGIN * 2;
    const th = this.H + MARGIN * 2;
    const step = TILE_SIZE / this.sub;
    const x0 = -MARGIN * TILE_SIZE;
    const z0 = -MARGIN * TILE_SIZE;
    for (let cz = 0; cz < th; cz += CHUNK) {
      for (let cx = 0; cx < tw; cx += CHUNK) {
        const nx = Math.min(CHUNK, tw - cx) * this.sub;
        const nz = Math.min(CHUNK, th - cz) * this.sub;
        const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
        const nor = new Float32Array(pos.length);
        const col = new Float32Array(pos.length);
        const uv = new Float32Array((nx + 1) * (nz + 1) * 2);
        for (let j = 0; j <= nz; j++) {
          for (let i = 0; i <= nx; i++) {
            const x = x0 + cx * TILE_SIZE + i * step;
            const z = z0 + cz * TILE_SIZE + j * step;
            const y = this.heightAt(x, z);
            const k = j * (nx + 1) + i;
            pos[k * 3] = x;
            pos[k * 3 + 1] = y;
            pos[k * 3 + 2] = z;
            // Normal from the slope of the height field.
            const dx = this.heightAt(x + step, z) - this.heightAt(x - step, z);
            const dz = this.heightAt(x, z + step) - this.heightAt(x, z - step);
            const len = Math.hypot(dx, 2 * step, dz);
            nor[k * 3] = -dx / len;
            nor[k * 3 + 1] = (2 * step) / len;
            nor[k * 3 + 2] = -dz / len;
            // Contact occlusion: dark at the foot of walls.
            const around = Math.max(this.heightAt(x + 40, z), this.heightAt(x - 40, z), this.heightAt(x, z + 40), this.heightAt(x, z - 40));
            const occl = Math.min(1, Math.max(0, (around - y) / CLIFF_3D));
            // Outlands fade a little darker so the playable area reads first.
            const fade = 1 - Math.min(1, this.outside(x, z) / 6) * 0.35;
            const shade = (1 - occl * 0.55) * fade;
            col[k * 3] = shade;
            col[k * 3 + 1] = shade;
            col[k * 3 + 2] = shade * 1.02;
            uv[k * 2] = (x - x0) / (tw * TILE_SIZE);
            uv[k * 2 + 1] = 1 - (z - z0) / (th * TILE_SIZE);
          }
        }
        const index = new Uint32Array(nx * nz * 6);
        let n = 0;
        for (let j = 0; j < nz; j++) {
          for (let i = 0; i < nx; i++) {
            const p = j * (nx + 1) + i;
            index[n++] = p;
            index[n++] = p + nx + 1;
            index[n++] = p + 1;
            index[n++] = p + 1;
            index[n++] = p + nx + 1;
            index[n++] = p + nx + 2;
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setIndex(new THREE.BufferAttribute(index, 1));
        g.computeBoundingSphere();
        g.computeBoundingBox();
        out.push(g);
      }
    }
    return out;
  }

  /**
   * Where things are, for the shader: R roads (ragged edges), G ruins, B the foot of cliffs.
   * Eight texels per tile; the shader reads it smoothed.
   */
  private bakeMask(): THREE.DataTexture {
    const res = 8;
    const W = (this.W + MARGIN * 2) * res;
    const H = (this.H + MARGIN * 2) * res;
    const data = new Uint8Array(W * H * 4);
    const n = this.noise;
    const step = TILE_SIZE / res;
    const near = (kind: number, wx: number, wy: number, r: number): number => {
      let s = 0;
      for (let dy = -r; dy <= r; dy += r) {
        for (let dx = -r; dx <= r; dx += r) {
          const t = this.tile(Math.floor((wx + dx) / TILE_SIZE), Math.floor((wy + dy) / TILE_SIZE));
          s += t === kind || (kind === TILE.CLIFF && t === OUT) ? 1 : 0;
        }
      }
      return s / 9;
    };
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const wx = (px + 0.5) * step - MARGIN * TILE_SIZE;
        const wy = (py + 0.5) * step - MARGIN * TILE_SIZE;
        const road = near(TILE.ROAD, wx, wy, 26) + (n.fbm(wx / 26, wy / 26, 4) - 0.5) * 0.7;
        const ruin = near(TILE.RUINS, wx, wy, 34) + (n.fbm(wx / 40, wy / 40, 3) - 0.5) * 0.6;
        const here = this.tile(Math.floor(wx / TILE_SIZE), Math.floor(wy / TILE_SIZE));
        const foot = here === TILE.CLIFF || here === OUT ? 0 : Math.max(near(TILE.CLIFF, wx, wy, 58), near(TILE.CLIFF, wx, wy, 100) * 0.6);
        const k = (py * W + px) * 4;
        data[k] = Math.max(0, Math.min(255, road * 255));
        data[k + 1] = Math.max(0, Math.min(255, ruin * 255));
        data[k + 2] = Math.max(0, Math.min(255, foot * 2.2 * 255));
        data[k + 3] = 255;
      }
    }
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }

  /** The special tiles for the shader: R shallows, G magma, B thicket, A ice (ragged edges like the first mask). */
  private bakeMask2(): THREE.DataTexture {
    const res = 8;
    const W = (this.W + MARGIN * 2) * res;
    const H = (this.H + MARGIN * 2) * res;
    const data = new Uint8Array(W * H * 4);
    const n = this.noise;
    const step = TILE_SIZE / res;
    const near = (kind: number, wx: number, wy: number, r: number): number => {
      let s = 0;
      for (let dy = -r; dy <= r; dy += r) {
        for (let dx = -r; dx <= r; dx += r) s += this.tile(Math.floor((wx + dx) / TILE_SIZE), Math.floor((wy + dy) / TILE_SIZE)) === kind ? 1 : 0;
      }
      return s / 9;
    };
    const kinds = [TILE.WATER, TILE.LAVA, TILE.SCRUB, TILE.ICE];
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const wx = (px + 0.5) * step - MARGIN * TILE_SIZE;
        const wy = (py + 0.5) * step - MARGIN * TILE_SIZE;
        const k = (py * W + px) * 4;
        kinds.forEach((kind, i) => {
          const v = near(kind, wx, wy, 22) + (n.fbm(wx / 44 + i * 9, wy / 44, 3) - 0.5) * 0.9;
          data[k + i] = Math.max(0, Math.min(255, v * 255));
        });
      }
    }
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }

  /** Paints the albedo map (playable area + margin): tileable biome materials blended by noise masks. */
  private bakeAlbedo(seed: number): THREE.CanvasTexture {
    const biome = biomeForMap(this.map.def.id);
    const tex = createTerrainTextures(biome, seed);
    const W = (this.W + MARGIN * 2) * TPX;
    const H = (this.H + MARGIN * 2) * TPX;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d') as CanvasRenderingContext2D;
    const toWorld = (px: number): number => (px * TILE_SIZE) / TPX - MARGIN * TILE_SIZE;
    const layer = (src: HTMLCanvasElement, alpha: (wx: number, wy: number) => number, res = 4): void => {
      const lc = document.createElement('canvas');
      lc.width = W;
      lc.height = H;
      const l = lc.getContext('2d') as CanvasRenderingContext2D;
      const pat = l.createPattern(src, 'repeat') as CanvasPattern;
      pat.setTransform(new DOMMatrix().scale(TPX / TILE_SIZE));
      l.fillStyle = pat;
      l.fillRect(0, 0, W, H);
      const mw = Math.ceil(W / res);
      const mh = Math.ceil(H / res);
      const mc = document.createElement('canvas');
      mc.width = mw;
      mc.height = mh;
      const m = mc.getContext('2d') as CanvasRenderingContext2D;
      const img = m.createImageData(mw, mh);
      for (let py = 0; py < mh; py++) {
        for (let px = 0; px < mw; px++) {
          const a = alpha(toWorld((px + 0.5) * res), toWorld((py + 0.5) * res));
          const k = (py * mw + px) * 4;
          img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
          img.data[k + 3] = Math.max(0, Math.min(255, a * 255));
        }
      }
      m.putImageData(img, 0, 0);
      l.globalCompositeOperation = 'destination-in';
      l.imageSmoothingEnabled = true;
      l.drawImage(mc, 0, 0, W, H);
      ctx.drawImage(lc, 0, 0);
    };
    const n = this.noise;
    const edge = (v: number, lo: number, hi: number): number => Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
    const near = (kind: number, wx: number, wy: number, r: number): number => {
      let s = 0;
      let c = 0;
      for (let dy = -r; dy <= r; dy += r) {
        for (let dx = -r; dx <= r; dx += r) {
          s += this.tile(Math.floor((wx + dx) / TILE_SIZE), Math.floor((wy + dy) / TILE_SIZE)) === kind ? 1 : 0;
          c++;
        }
      }
      return s / c;
    };
    layer(tex.ground[0], () => 1);
    layer(tex.ground[1], (wx, wy) => edge(n.fbm(wx / 420, wy / 420, 4), 0.45, 0.62));
    layer(tex.ground[2], (wx, wy) => edge(n.fbm(wx / 300 + 40, wy / 300 + 17, 4), 0.55, 0.7));
    layer(tex.rubble, (wx, wy) => edge(near(TILE.RUINS, wx, wy, 30) + (n.fbm(wx / 40, wy / 40, 3) - 0.5) * 0.8, 0.35, 0.55));
    // Roads: broken plating with ragged, eroded edges and a darker worn border.
    const road = (wx: number, wy: number): number => near(TILE.ROAD, wx, wy, 26) + (n.fbm(wx / 26, wy / 26, 4) - 0.5) * 0.7;
    layer(tex.rubble, (wx, wy) => edge(road(wx, wy), 0.25, 0.4) * 0.9);
    // Scorched crater floors.
    for (const c of this.craters) {
      const px = (c.x / TILE_SIZE + MARGIN) * TPX;
      const py = (c.y / TILE_SIZE + MARGIN) * TPX;
      const r = (c.r / TILE_SIZE) * TPX * 1.25;
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(10,8,6,0.75)');
      g.addColorStop(0.6, 'rgba(20,14,10,0.45)');
      g.addColorStop(1, 'rgba(20,14,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const t = new THREE.CanvasTexture(out);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }

  dispose(): void {
    for (const m of this.mesh.children) (m as THREE.Mesh).geometry.dispose();
    this.material.dispose();
    for (const t of this.textures) t.dispose();
  }
}
