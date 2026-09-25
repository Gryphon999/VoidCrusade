import Phaser from 'phaser';
import { DEPTH, PROJECTION, TILE, TILE_SIZE } from '../config';
import { Projection } from './Projection';
import { TerrainPainter } from './TerrainPainter';
import { biomeForMap } from './Biomes';
import { makeCanvas } from './CanvasUtil';
import type { MapSystem } from '../systems/MapSystem';

const CHUNK = 1024;
const T = TILE_SIZE;

interface Chunk {
  key: string;
  x0: number;
  y0: number;
  ctx: CanvasRenderingContext2D;
  tex: Phaser.Textures.CanvasTexture;
}

/**
 * Bakes the projected terrain (ground squashed by the tilt, cliffs raised as walls) into
 * 1024px canvas chunks once, then only repaints dirty regions (e.g. rubble).
 * Cliff tops that could hide units get Y-sorted occluder sprites cut from the same chunks.
 */
export class TerrainRenderer {
  private chunks: Chunk[] = [];
  private painter: TerrainPainter;
  private dirty: Phaser.Geom.Rectangle | null = null;
  private occluders: Phaser.GameObjects.Image[] = [];
  readonly viewTop: number;
  readonly viewBottom: number;
  private static serial = 0;

  constructor(private scene: Phaser.Scene, private map: MapSystem) {
    let seed = 17;
    for (const ch of map.def.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    this.painter = new TerrainPainter(map, biomeForMap(map.def.id), seed, CHUNK);
    this.viewTop = -PROJECTION.cliffHeight - 40;
    this.viewBottom = Projection.vy(map.worldHeight) + 8;
    const id = TerrainRenderer.serial++;
    for (let y0 = this.viewTop; y0 < this.viewBottom; y0 += CHUNK) {
      for (let x0 = 0; x0 < map.worldWidth; x0 += CHUNK) {
        const h = Math.min(CHUNK, Math.ceil(this.viewBottom - y0));
        const { canvas, ctx } = makeCanvas(CHUNK, h);
        const key = `terrain_${id}_${x0}_${y0}`;
        const tex = scene.textures.addCanvas(key, canvas);
        if (!tex) throw new Error('terrain texture failed');
        this.chunks.push({ key, x0, y0, ctx, tex });
        scene.add.image(x0, y0, key).setOrigin(0).setDepth(DEPTH.terrain);
      }
    }
    this.paint(0, 0, map.width - 1, map.height - 1);
    for (const c of this.chunks) c.tex.refresh();
    this.buildOccluders();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const c of this.chunks) scene.textures.remove(c.key);
    });
  }

  private isCliff(tx: number, ty: number): boolean {
    return this.map.getTile(tx, ty) === TILE.CLIFF;
  }

  /** View-space rectangle covered by a tile range, including raised cliff tops. */
  private viewRect(tx0: number, ty0: number, tx1: number, ty1: number): Phaser.Geom.Rectangle {
    const top = Projection.vy(ty0 * T) - PROJECTION.cliffHeight - 2;
    const bottom = Projection.vy((ty1 + 1) * T) + 2;
    return new Phaser.Geom.Rectangle(tx0 * T, top, (tx1 - tx0 + 1) * T, bottom - top);
  }

  /** Repaints a tile range into every chunk it touches. */
  private paint(tx0: number, ty0: number, tx1: number, ty1: number): void {
    const clip = this.viewRect(tx0, ty0, tx1, ty1);
    // Cliffs one row south raise their tops into this region; include them.
    const rows = [Math.max(0, ty0 - 1), Math.min(this.map.height - 1, ty1 + 1)];
    for (const c of this.chunks) {
      const cr = new Phaser.Geom.Rectangle(c.x0, c.y0, CHUNK, c.ctx.canvas.height);
      if (!Phaser.Geom.Intersects.RectangleToRectangle(cr, clip)) continue;
      const ctx = c.ctx;
      ctx.save();
      ctx.translate(-c.x0, -c.y0);
      ctx.beginPath();
      ctx.rect(clip.x, clip.y, clip.width, clip.height);
      ctx.clip();
      ctx.fillStyle = '#07060a';
      ctx.fillRect(clip.x, clip.y, clip.width, clip.height);
      this.painter.paint(ctx, c.x0, c.y0, tx0, rows[0], tx1, rows[1]);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.restore();
    }
  }

  /** Queues a tile for repainting (flushed once per frame). */
  markDirty(tx: number, ty: number): void {
    if (!this.dirty) this.dirty = new Phaser.Geom.Rectangle(tx, ty, 0, 0);
    else Phaser.Geom.Rectangle.MergeXY(this.dirty, tx, ty);
  }

  flush(): void {
    const d = this.dirty;
    if (!d) return;
    this.dirty = null;
    this.paint(d.x, d.y, d.right, d.bottom);
    for (const c of this.chunks) c.tex.refresh();
  }

  /**
   * Cliff tops whose north side is walkable can hide units standing behind them.
   * They get sprites cut from the baked chunks, Y-sorted with units and buildings.
   */
  private buildOccluders(): void {
    for (const o of this.occluders) o.destroy();
    this.occluders = [];
    const k = Projection.tilt;
    for (let ty = 0; ty < this.map.height; ty++) {
      let run = -1;
      for (let tx = 0; tx <= this.map.width; tx++) {
        const need = tx < this.map.width && this.isCliff(tx, ty)
          && (!this.isCliff(tx, ty - 1) || !this.isCliff(tx - 1, ty - 1) || !this.isCliff(tx + 1, ty - 1));
        if (need && run < 0) run = tx;
        if (!need && run >= 0) {
          const top = ty * T * k - PROJECTION.cliffHeight;
          this.addOccluder(run * T, top, (tx - run) * T, T * k, Projection.depth((ty + 1) * T - 1));
          run = -1;
        }
      }
    }
  }

  private addOccluder(x: number, y: number, w: number, h: number, depth: number): void {
    for (const c of this.chunks) {
      const ix0 = Math.max(x, c.x0);
      const iy0 = Math.max(y, c.y0);
      const ix1 = Math.min(x + w, c.x0 + CHUNK);
      const iy1 = Math.min(y + h, c.y0 + c.ctx.canvas.height);
      if (ix1 <= ix0 || iy1 <= iy0) continue;
      const name = `occ_${ix0}_${iy0}`;
      if (!c.tex.has(name)) c.tex.add(name, 0, ix0 - c.x0, Math.floor(iy0 - c.y0), ix1 - ix0, Math.ceil(iy1 - iy0));
      const img = this.scene.add.image(ix0, Math.floor(iy0), c.key, name).setOrigin(0).setDepth(depth);
      this.occluders.push(img);
    }
  }
}
