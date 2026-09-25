import { PROJECTION, TILE, TILE_SIZE } from '../config';
import { makeRng } from '../utils/rng';
import { makeCanvas, rgb } from './CanvasUtil';
import { ValueNoise, smoothstep } from './Noise';
import { Biome } from './Biomes';
import { TerrainTextures, createTerrainTextures } from './TerrainTextures';
import { TerrainDecal, paintDecal, scatterDecals } from './TerrainDecals';
import { Projection } from './Projection';
import type { MapSystem } from '../systems/MapSystem';

const T = TILE_SIZE;
const MASK_RES = 16;

export function tileHash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Paints any region of the projected terrain into a chunk canvas. Deterministic, so repaints match. */
export class TerrainPainter {
  private tex: TerrainTextures;
  private masks: HTMLCanvasElement[];
  private shadeMap: HTMLCanvasElement;
  private decals: TerrainDecal[];
  private scratch: CanvasRenderingContext2D;
  private patterns = new Map<CanvasRenderingContext2D, Map<HTMLCanvasElement, CanvasPattern>>();

  constructor(private map: MapSystem, biome: Biome, private seed: number, chunkSize: number) {
    this.tex = createTerrainTextures(biome, seed);
    const n = new ValueNoise(seed + 31);
    this.masks = [1, 2].map((i) => this.noiseMask((x, y) => smoothstep(0.5, 0.62, n.fbm(x / 14 + i * 40, y / 14, 4))));
    this.shadeMap = this.noiseMask((x, y) => 0.55 + 0.45 * smoothstep(0.25, 0.75, n.fbm(x / 30 + 90, y / 30 + 90, 3)), true);
    this.decals = scatterDecals(map, seed + 77);
    this.scratch = makeCanvas(chunkSize, chunkSize).ctx;
  }

  /** Low-res map-wide mask (one pixel per 16 logical px), smoothed when stretched. */
  private noiseMask(f: (x: number, y: number) => number, grey = false): HTMLCanvasElement {
    const w = (this.map.worldWidth / MASK_RES) | 0;
    const h = (this.map.worldHeight / MASK_RES) | 0;
    const { canvas, ctx } = makeCanvas(w, h);
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = f(x, y);
        const i = (y * w + x) * 4;
        const g = grey ? Math.round(v * 255) : 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = g;
        img.data[i + 3] = grey ? 255 : Math.round(v * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  private pattern(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement): CanvasPattern {
    let m = this.patterns.get(ctx);
    if (!m) {
      m = new Map();
      this.patterns.set(ctx, m);
    }
    let p = m.get(src);
    if (!p) {
      p = ctx.createPattern(src, 'repeat') as CanvasPattern;
      m.set(src, p);
    }
    return p;
  }

  private isCliff(tx: number, ty: number): boolean {
    return this.map.getTile(tx, ty) === TILE.CLIFF;
  }

  /**
   * Paints tiles [tx0..tx1]x[ty0..ty1] (plus neighbours whose art spills over) into `ctx`, whose
   * pixel (0,0) is view point (x0, y0). The caller has already clipped to the dirty view rect.
   */
  paint(ctx: CanvasRenderingContext2D, x0: number, y0: number, tx0: number, ty0: number, tx1: number, ty1: number): void {
    const k = Projection.tilt;
    const W = this.map.worldWidth;
    const H = this.map.worldHeight;
    const lx = tx0 * T - T;
    const ly = ty0 * T - T;
    const lw = (tx1 - tx0 + 3) * T;
    const lh = (ty1 - ty0 + 3) * T;
    // Logical ground → chunk pixels.
    const ground = (c: CanvasRenderingContext2D): void => c.setTransform(1, 0, 0, k, -x0, -y0);
    ground(ctx);
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = this.pattern(ctx, this.tex.ground[0]);
    ctx.fillRect(lx, ly, lw, lh);
    // Blend the other ground materials through smooth noise masks.
    const s = this.scratch;
    this.masks.forEach((mask, i) => {
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.globalCompositeOperation = 'source-over';
      s.clearRect(0, 0, s.canvas.width, s.canvas.height);
      ground(s);
      s.fillStyle = this.pattern(s, this.tex.ground[i + 1]);
      s.fillRect(lx, ly, lw, lh);
      s.globalCompositeOperation = 'destination-in';
      s.imageSmoothingEnabled = true;
      s.drawImage(mask, 0, 0, W, H);
      s.globalCompositeOperation = 'source-over';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(s.canvas, 0, 0);
      ground(ctx);
    });
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.shadeMap, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    for (const d of this.decals) {
      if (d.x + d.r > lx && d.x - d.r < lx + lw && d.y + d.r > ly && d.y - d.r < ly + lh) paintDecal(ctx, d);
    }
    for (let ty = ty0 - 1; ty <= ty1 + 1; ty++) {
      for (let tx = tx0 - 1; tx <= tx1 + 1; tx++) {
        const t = this.map.getTile(tx, ty);
        if (t === TILE.ROAD) this.surface(ctx, tx, ty, TILE.ROAD, this.tex.plating);
        else if (t === TILE.RUINS) this.surface(ctx, tx, ty, TILE.RUINS, this.tex.rubble);
      }
    }
    for (let ty = ty0 - 1; ty <= ty1 + 1; ty++) {
      for (let tx = tx0 - 1; tx <= tx1 + 1; tx++) if (this.isCliff(tx, ty)) this.cliff(ctx, x0, y0, tx, ty);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** A road or ruin patch: seamless toward same-type neighbours, crumbling edge elsewhere. */
  private surface(ctx: CanvasRenderingContext2D, tx: number, ty: number, type: number, tex: HTMLCanvasElement): void {
    const rnd = makeRng(tileHash(tx, ty) ^ this.seed);
    const same = (dx: number, dy: number): boolean => this.map.getTile(tx + dx, ty + dy) === type;
    const x = tx * T;
    const y = ty * T;
    const jag = (): number => 3 + rnd() * 9;
    const pts: [number, number][] = [];
    const N = 5;
    const edge = (sx: number, sy: number, ex: number, ey: number, nx: number, ny: number, open: boolean): void => {
      for (let i = 0; i < N; i++) {
        const f = i / N;
        const d = open ? -1.5 : jag();
        pts.push([sx + (ex - sx) * f + nx * d, sy + (ey - sy) * f + ny * d]);
      }
    };
    edge(x, y, x + T, y, 0, 1, same(0, -1));
    edge(x + T, y, x + T, y + T, -1, 0, same(1, 0));
    edge(x + T, y + T, x, y + T, 0, -1, same(0, 1));
    edge(x, y + T, x, y, 1, 0, same(-1, 0));
    const path = (): void => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
    };
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.save();
    ctx.translate(2, 3);
    path();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = this.pattern(ctx, tex);
    path();
    ctx.fill();
    ctx.strokeStyle = type === TILE.ROAD ? 'rgba(20,16,12,0.7)' : 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (type === TILE.ROAD) {
      const roll = rnd();
      if (roll < 0.1) {
        // Hazard stripes.
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 8, y + T / 2 - 6, T - 16, 12);
        ctx.clip();
        for (let i = -2; i < 8; i++) {
          ctx.fillStyle = i % 2 ? 'rgba(20,18,14,0.85)' : 'rgba(190,150,40,0.7)';
          ctx.beginPath();
          ctx.moveTo(x + 8 + i * 8, y + T / 2 + 6);
          ctx.lineTo(x + 16 + i * 8, y + T / 2 - 6);
          ctx.lineTo(x + 24 + i * 8, y + T / 2 - 6);
          ctx.lineTo(x + 16 + i * 8, y + T / 2 + 6);
          ctx.fill();
        }
        ctx.restore();
      } else if (roll < 0.2) {
        // Drain grate.
        ctx.fillStyle = 'rgba(8,8,8,0.9)';
        ctx.fillRect(x + 18, y + 20, 28, 24);
        ctx.fillStyle = 'rgba(120,120,120,0.5)';
        for (let i = 0; i < 5; i++) ctx.fillRect(x + 20 + i * 5.5, y + 21, 2, 22);
      }
    }
  }

  /** A raised cliff block: rocky top lit from the north-west, strata wall, scree and cast shadow. */
  private cliff(ctx: CanvasRenderingContext2D, x0: number, y0: number, tx: number, ty: number): void {
    const k = Projection.tilt;
    const ch = PROJECTION.cliffHeight;
    const x = tx * T;
    const baseY = (ty + 1) * T * k;
    const topY = ty * T * k - ch;
    const rnd = makeRng(tileHash(tx, ty) + 3);
    ctx.setTransform(1, 0, 0, 1, -x0, -y0);
    const southOpen = !this.isCliff(tx, ty + 1);
    const eastOpen = !this.isCliff(tx + 1, ty);
    if (southOpen) {
      const g = ctx.createLinearGradient(0, baseY, 0, baseY + 30);
      g.addColorStop(0, 'rgba(0,0,0,0.6)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 2, baseY, T + 16, 30);
    }
    if (eastOpen) {
      const g = ctx.createLinearGradient(x + T, 0, x + T + 24, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.5)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x + T, topY + ch, 24, T * k);
    }
    if (southOpen) {
      ctx.fillStyle = this.pattern(ctx, this.tex.cliffFace);
      ctx.fillRect(x, baseY - ch, T, ch);
      const g = ctx.createLinearGradient(0, baseY - ch, 0, baseY);
      g.addColorStop(0, 'rgba(255,220,180,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = g;
      ctx.fillRect(x, baseY - ch, T, ch);
      // Scree at the foot of the wall.
      for (let i = 0; i < 6; i++) {
        const sx = x + rnd() * T;
        const r = 2 + rnd() * 4;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(sx + 1, baseY + 2, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgb(0x4a4038, 0.9);
        ctx.beginPath();
        ctx.ellipse(sx, baseY, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Top surface (raised by the wall height).
    ctx.setTransform(1, 0, 0, k, -x0, -y0 - ch);
    ctx.fillStyle = this.pattern(ctx, this.tex.cliffTop);
    ctx.fillRect(x, ty * T, T, T + 0.5 / k);
    // Large-scale light/dark variation so plateaus don't read as one repeated texture.
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.shadeMap, x / MASK_RES, (ty * T) / MASK_RES, T / MASK_RES, T / MASK_RES, x, ty * T, T, T + 0.5 / k);
    ctx.globalCompositeOperation = 'source-over';
    if (rnd() < 0.35) {
      // A boulder or two lying on the plateau, lit from the north-west.
      for (let i = 0; i < 1 + Math.floor(rnd() * 2); i++) {
        const bx = x + 10 + rnd() * (T - 20);
        const by = ty * T + 10 + rnd() * (T - 20);
        const r = 4 + rnd() * 7;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(bx + r * 0.5, by + r * 0.6, r, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        const g = ctx.createRadialGradient(bx - r * 0.4, by - r * 0.4, 0, bx, by, r);
        g.addColorStop(0, 'rgba(150,140,130,0.9)');
        g.addColorStop(1, 'rgba(40,36,34,0.95)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(bx, by, r, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.setTransform(1, 0, 0, 1, -x0, -y0);
    const th = T * k;
    if (!this.isCliff(tx, ty - 1)) {
      ctx.fillStyle = 'rgba(255,225,190,0.22)';
      ctx.fillRect(x, topY, T, 2);
    }
    if (!this.isCliff(tx - 1, ty)) {
      const g = ctx.createLinearGradient(x, 0, x + 8, 0);
      g.addColorStop(0, 'rgba(255,225,190,0.16)');
      g.addColorStop(1, 'rgba(255,225,190,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, topY, 8, th);
    }
    if (eastOpen) {
      const g = ctx.createLinearGradient(x + T - 10, 0, x + T, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = g;
      ctx.fillRect(x + T - 10, topY, 10, th + (southOpen ? ch : 0));
    }
    if (southOpen) {
      // Jagged lip overhanging the wall.
      ctx.fillStyle = this.pattern(ctx, this.tex.cliffTop);
      for (let i = 0; i < 5; i++) {
        const bx = x + rnd() * T;
        const r = 3 + rnd() * 5;
        ctx.beginPath();
        ctx.ellipse(bx, topY + th, r, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x, topY + th - 1, T, 2);
    }
  }
}
