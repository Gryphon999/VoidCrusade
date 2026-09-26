import * as THREE from 'three';
import { MAP_H, MAP_W, TILE, TILE_SIZE } from '../config';
import { biomeForMap } from '../render/Biomes';
import { createTerrainTextures } from '../render/TerrainTextures';
import { ValueNoise } from '../render/Noise';
import type { MapSystem } from '../systems/MapSystem';

/** Height of raised cliff blocks in 3D (px). Nothing walks on cliffs, so this is purely visual. */
export const CLIFF_3D = 80;
/** Texture resolution: canvas pixels per tile. */
const TPX = 32;
/** Mesh subdivisions per tile. */
const SUB = 4;

/**
 * Height-field battlefield ground: cliffs rise as rock blocks with steep lit faces, the ground
 * rolls slightly, and a baked top-down albedo blends the biome's seamless materials
 * (three ground variants, plating for roads, rubble for ruins, rock for cliff tops) with noise
 * masks so no tile grid shows. Crevices at cliff feet are darkened (baked contact occlusion).
 */
export class Terrain3D {
  readonly mesh: THREE.Mesh;
  private cliff: Float32Array;
  private noise: ValueNoise;
  private texture: THREE.CanvasTexture;

  constructor(private map: MapSystem, anisotropy: number) {
    let seed = 17;
    for (const ch of map.def.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    this.noise = new ValueNoise(seed + 3);
    this.cliff = this.cliffField();
    const geo = this.buildGeometry();
    this.texture = this.bakeAlbedo(seed);
    this.texture.anisotropy = anisotropy;
    const mat = new THREE.MeshStandardMaterial({ map: this.texture, vertexColors: true, roughness: 0.93, metalness: 0.02 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
  }

  private tile(tx: number, ty: number): number {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return TILE.CLIFF;
    return this.map.def.tiles[ty][tx];
  }

  /** Smoothed 0..1 cliff coverage sampled at vertex resolution (so blocks get bevelled edges). */
  private cliffField(): Float32Array {
    const W = MAP_W * SUB + 1;
    const H = MAP_H * SUB + 1;
    const f = new Float32Array(W * H);
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const x = i / SUB;
        const y = j / SUB;
        // Average of the four tiles touching this vertex, then a small neighbourhood blur.
        let s = 0;
        let n = 0;
        for (let dy = -0.75; dy <= 0.76; dy += 0.75) {
          for (let dx = -0.75; dx <= 0.76; dx += 0.75) {
            s += this.tile(Math.floor(x + dx - 0.01), Math.floor(y + dy - 0.01)) === TILE.CLIFF ? 1 : 0;
            n++;
          }
        }
        f[j * W + i] = s / n;
      }
    }
    return f;
  }

  /** Ground height (px) at a logical point: rolling ground, raised cliffs, flat roads. */
  heightAt(x: number, y: number): number {
    const W = MAP_W * SUB + 1;
    const fx = Math.min(W - 1.001, Math.max(0, (x / TILE_SIZE) * SUB));
    const fy = Math.min(MAP_H * SUB - 0.001, Math.max(0, (y / TILE_SIZE) * SUB));
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const u = fx - i;
    const v = fy - j;
    const c = this.cliff;
    const k = c[j * W + i] * (1 - u) * (1 - v) + c[j * W + i + 1] * u * (1 - v) + c[(j + 1) * W + i] * (1 - u) * v + c[(j + 1) * W + i + 1] * u * v;
    return this.shape(k, x, y);
  }

  private shape(cliff: number, x: number, y: number): number {
    const n = this.noise.fbm(x / 260, y / 260, 3);
    // Steep S-curve: flat ground, a sharp wall, a rough rocky top.
    const wall = cliff <= 0.2 ? 0 : cliff >= 0.8 ? 1 : (cliff - 0.2) / 0.6;
    const s = wall * wall * (3 - 2 * wall);
    const rough = this.noise.fbm(x / 70, y / 70, 3) - 0.5;
    const t = this.tile(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE));
    const ground = (n - 0.5) * (t === TILE.ROAD ? 2 : 7);
    return ground + s * (CLIFF_3D + rough * 30);
  }

  private buildGeometry(): THREE.BufferGeometry {
    const w = MAP_W * TILE_SIZE;
    const h = MAP_H * TILE_SIZE;
    const g = new THREE.PlaneGeometry(w, h, MAP_W * SUB, MAP_H * SUB);
    g.rotateX(-Math.PI / 2);
    g.translate(w / 2, 0, h / 2);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.heightAt(x, z);
      pos.setY(i, y);
      // Contact occlusion: dark at the foot of walls, slightly lit on cliff rims.
      const around = Math.max(this.heightAt(x + 40, z), this.heightAt(x - 40, z), this.heightAt(x, z + 40), this.heightAt(x, z - 40));
      const occl = Math.min(1, Math.max(0, (around - y) / CLIFF_3D));
      const shade = 1 - occl * 0.55;
      col[i * 3] = shade;
      col[i * 3 + 1] = shade;
      col[i * 3 + 2] = shade * 1.02;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }

  /** Paints the albedo map: tileable biome materials blended by noise masks. */
  private bakeAlbedo(seed: number): THREE.CanvasTexture {
    const biome = biomeForMap(this.map.def.id);
    const tex = createTerrainTextures(biome, seed);
    const W = MAP_W * TPX;
    const H = MAP_H * TPX;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d') as CanvasRenderingContext2D;
    const layer = (src: HTMLCanvasElement, alpha: (tx: number, ty: number, px: number, py: number) => number, res = 4): void => {
      // Pattern-filled layer, then masked by a per-pixel alpha field drawn at 1/res resolution.
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
          const wx = ((px + 0.5) * res * TILE_SIZE) / TPX;
          const wy = ((py + 0.5) * res * TILE_SIZE) / TPX;
          const a = alpha(Math.floor(wx / TILE_SIZE), Math.floor(wy / TILE_SIZE), wx, wy);
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
    // Soft tile membership: distance-weighted, so roads and ruins get ragged, feathered borders.
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
    layer(tex.ground[1], (_tx, _ty, wx, wy) => edge(n.fbm(wx / 420, wy / 420, 4), 0.45, 0.62));
    layer(tex.ground[2], (_tx, _ty, wx, wy) => edge(n.fbm(wx / 300 + 40, wy / 300 + 17, 4), 0.55, 0.7));
    layer(tex.rubble, (_tx, _ty, wx, wy) => edge(near(TILE.RUINS, wx, wy, 26) + (n.fbm(wx / 40, wy / 40, 3) - 0.5) * 0.6, 0.35, 0.6));
    layer(tex.plating, (_tx, _ty, wx, wy) => edge(near(TILE.ROAD, wx, wy, 22) + (n.fbm(wx / 30, wy / 30, 3) - 0.5) * 0.5, 0.45, 0.62));
    layer(tex.cliffTop, (_tx, _ty, wx, wy) => edge(this.heightAt(wx, wy) / CLIFF_3D + (n.fbm(wx / 50, wy / 50, 2) - 0.5) * 0.3, 0.35, 0.55));
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
    this.texture.dispose();
  }
}
