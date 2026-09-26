import * as THREE from 'three';
import { MAP_H, MAP_W, TILE, TILE_SIZE } from '../config';
import { biomeForMap } from '../render/Biomes';
import { createTerrainTextures } from '../render/TerrainTextures';
import { ValueNoise } from '../render/Noise';
import { detailTexture, platingCanvas, rockTexture } from './Materials3D';
import type { MapSystem } from '../systems/MapSystem';

/** Height of raised cliff blocks in 3D (px). Nothing walks on cliffs, so this is purely visual. */
export const CLIFF_3D = 105;
/** Unplayable ring of mountains around the map so the view never shows a void (tiles). */
export const MARGIN = 8;
/** Texture resolution: canvas pixels per tile. */
const TPX = 32;
/** Mesh subdivisions per tile. */
const SUB = 4;
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
  readonly mesh: THREE.Mesh;
  private cliff: Float32Array;
  /** Shell craters on open ground: dents with raised rims (visual only). */
  readonly craters: { x: number; y: number; r: number }[] = [];
  private noise: ValueNoise;
  private textures: THREE.Texture[] = [];
  private readonly vw = (MAP_W + MARGIN * 2) * SUB + 1;
  private readonly vh = (MAP_H + MARGIN * 2) * SUB + 1;

  constructor(private map: MapSystem, anisotropy: number) {
    let seed = 17;
    for (const ch of map.def.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    this.noise = new ValueNoise(seed + 3);
    this.cliff = this.cliffField();
    this.craters = this.placeCraters(seed);
    const geo = this.buildGeometry();
    const biome = biomeForMap(map.def.id);
    const albedo = this.bakeAlbedo(seed);
    albedo.anisotropy = anisotropy;
    const detail = detailTexture(seed + 11);
    const rock = rockTexture(biome.cliffFace[0], biome.cliffTop[1], seed + 13);
    this.textures.push(albedo, detail, rock);
    const mat = new THREE.MeshStandardMaterial({ map: albedo, vertexColors: true, roughness: 0.92, metalness: 0.02 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uDetail = { value: detail };
      sh.uniforms.uRock = { value: rock };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNormal;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWorldNormal = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
uniform sampler2D uDetail;
uniform sampler2D uRock;
vec3 triRock(vec3 p, vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= (w.x + w.y + w.z);
  vec3 x = texture2D(uRock, p.zy / 220.0).rgb;
  vec3 y = texture2D(uRock, p.xz / 220.0).rgb;
  vec3 z = texture2D(uRock, p.xy / 220.0).rgb;
  return x * w.x + y * w.y + z * w.z;
}`)
        .replace('#include <map_fragment>', `#include <map_fragment>
  // Close-up grain from a world-space detail map (two scales so it never visibly repeats).
  float d1 = texture2D(uDetail, vWorldPos.xz / 180.0).r;
  float d2 = texture2D(uDetail, vWorldPos.xz / 47.0 + 0.37).r;
  float detail = d1 * 0.6 + d2 * 0.4;
  diffuseColor.rgb *= 0.72 + detail * 0.56;
  // Large-scale tint so wide views are not one uniform brown.
  float macro = texture2D(uDetail, vWorldPos.xz / 3100.0).r;
  diffuseColor.rgb *= 0.9 + macro * 0.18;
  // Steep faces and raised plateaus: layered rock projected in world space.
  float steep = smoothstep(0.45, 0.75, 1.0 - abs(vWorldNormal.y));
  float raised = smoothstep(${(CLIFF_3D * 0.45).toFixed(1)}, ${(CLIFF_3D * 0.7).toFixed(1)}, vWorldPos.y);
  vec3 rockCol = triRock(vWorldPos, normalize(vWorldNormal));
  // Plateau tops: rock broken up by patches of the surrounding ground.
  float patchy = smoothstep(0.45, 0.62, texture2D(uDetail, vWorldPos.xz / 390.0 + 0.21).r);
  vec3 topCol = mix(rockCol * 0.85, diffuseColor.rgb, patchy * 0.6);
  diffuseColor.rgb = mix(diffuseColor.rgb, topCol * (0.8 + detail * 0.4), raised * (1.0 - steep));
  diffuseColor.rgb = mix(diffuseColor.rgb, rockCol * (0.7 + detail * 0.5), steep);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  // World-space bump from the detail map (screen-space derivatives).
  {
    float h = (texture2D(uDetail, vWorldPos.xz / 180.0).r * 0.6 + texture2D(uDetail, vWorldPos.xz / 47.0 + 0.37).r * 0.4);
    vec2 dH = vec2(dFdx(h), dFdy(h)) * 2.2;
    vec3 vSigmaX = dFdx(-vViewPosition);
    vec3 vSigmaY = dFdy(-vViewPosition);
    vec3 R1 = cross(vSigmaY, normal);
    vec3 R2 = cross(normal, vSigmaX);
    float fDet = dot(vSigmaX, R1);
    vec3 grad = sign(fDet) * (dH.x * R1 + dH.y * R2);
    normal = normalize(abs(fDet) * normal - grad);
  }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, 0.78, steep);`);
    };
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
  }

  private placeCraters(seed: number): { x: number; y: number; r: number }[] {
    const out: { x: number; y: number; r: number }[] = [];
    let s = seed;
    const rnd = (): number => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    const bases = [this.map.def.playerBase, this.map.def.enemyBase];
    for (let tries = 0; tries < 400 && out.length < 26; tries++) {
      const tx = 2 + Math.floor(rnd() * (MAP_W - 4));
      const ty = 2 + Math.floor(rnd() * (MAP_H - 4));
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
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return OUT;
    return this.map.def.tiles[ty][tx];
  }

  /** Smoothed 0..1 cliff coverage at vertex resolution (so blocks get bevelled edges). */
  private cliffField(): Float32Array {
    const f = new Float32Array(this.vw * this.vh);
    for (let j = 0; j < this.vh; j++) {
      for (let i = 0; i < this.vw; i++) {
        const x = i / SUB - MARGIN;
        const y = j / SUB - MARGIN;
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
    const dx = Math.max(0, -tx, tx - MAP_W);
    const dy = Math.max(0, -ty, ty - MAP_H);
    return Math.hypot(dx, dy);
  }

  /** Ground height (px) at a logical point. */
  heightAt(x: number, y: number): number {
    const fx = Math.min(this.vw - 1.001, Math.max(0, (x / TILE_SIZE + MARGIN) * SUB));
    const fy = Math.min(this.vh - 1.001, Math.max(0, (y / TILE_SIZE + MARGIN) * SUB));
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
    const ground = (n - 0.5) * (t === TILE.ROAD ? 2 : 7);
    // Rough, terraced tops: a second, lower shelf in places.
    const shelf = this.noise.fbm(x / 160 + 3, y / 160, 3) > 0.58 ? 0.72 : 1;
    let h = ground + s * (CLIFF_3D * shelf + rough * 42);
    if (this.craters.length && s < 0.05) h += this.craterAt(x, y);
    // Mountains beyond the map edge: climb away from the playable area.
    const out = this.outside(x, y);
    if (out > 0) h += Math.min(1, out / 5) * (90 + this.noise.fbm(x / 400, y / 400, 4) * 260);
    return h;
  }

  private buildGeometry(): THREE.BufferGeometry {
    const w = (MAP_W + MARGIN * 2) * TILE_SIZE;
    const h = (MAP_H + MARGIN * 2) * TILE_SIZE;
    const g = new THREE.PlaneGeometry(w, h, (MAP_W + MARGIN * 2) * SUB, (MAP_H + MARGIN * 2) * SUB);
    g.rotateX(-Math.PI / 2);
    g.translate(w / 2 - MARGIN * TILE_SIZE, 0, h / 2 - MARGIN * TILE_SIZE);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.heightAt(x, z);
      pos.setY(i, y);
      // Contact occlusion: dark at the foot of walls.
      const around = Math.max(this.heightAt(x + 40, z), this.heightAt(x - 40, z), this.heightAt(x, z + 40), this.heightAt(x, z - 40));
      const occl = Math.min(1, Math.max(0, (around - y) / CLIFF_3D));
      // Outlands fade a little darker so the playable area reads first.
      const fade = 1 - Math.min(1, this.outside(x, z) / 6) * 0.35;
      const shade = (1 - occl * 0.55) * fade;
      col[i * 3] = shade;
      col[i * 3 + 1] = shade;
      col[i * 3 + 2] = shade * 1.02;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }

  /** Paints the albedo map (playable area + margin): tileable biome materials blended by noise masks. */
  private bakeAlbedo(seed: number): THREE.CanvasTexture {
    const biome = biomeForMap(this.map.def.id);
    const tex = createTerrainTextures(biome, seed);
    const W = (MAP_W + MARGIN * 2) * TPX;
    const H = (MAP_H + MARGIN * 2) * TPX;
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
    layer(platingCanvas(biome.plating[0], biome.plating[1], seed + 900), (wx, wy) => edge(road(wx, wy), 0.5, 0.62));
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
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    for (const t of this.textures) t.dispose();
  }
}
