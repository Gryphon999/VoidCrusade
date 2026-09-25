import Phaser from 'phaser';
import { DEPTH, FOG, TILE_SIZE } from '../config';
import type { BattleScene, FogQueries } from '../scenes/BattleScene';
import { Projection } from '../render/Projection';
import { makeCanvas } from '../render/CanvasUtil';

const UNEXPLORED = 0;
const EXPLORED = 1;
const VISIBLE = 2;

/** Low-resolution fog grid: unexplored (black), explored (dim), visible (clear). */
export class FogOfWarSystem implements FogQueries {
  readonly cols: number;
  readonly rows: number;
  readonly cellPx = FOG.cellTiles * TILE_SIZE;
  private state: Uint8Array;
  private ctx: CanvasRenderingContext2D;
  private tex: Phaser.Textures.CanvasTexture;
  private img: ImageData;
  private jitter: Float32Array;
  private readonly texKey: string;
  private static serial = 0;
  private timer = 0;
  enabled = true;

  constructor(private battle: BattleScene) {
    this.cols = Math.ceil(battle.map.worldWidth / this.cellPx);
    this.rows = Math.ceil(battle.map.worldHeight / this.cellPx);
    this.state = new Uint8Array(this.cols * this.rows);
    // Two texels per cell (plus a 1-texel border), stretched with bilinear filtering: soft, smoky edges.
    const w = this.cols * 2 + 2;
    const h = this.rows * 2 + 2;
    const c = makeCanvas(w, h);
    this.ctx = c.ctx;
    this.img = c.ctx.createImageData(w, h);
    this.jitter = new Float32Array(w * h).map(() => (Math.random() - 0.5) * 0.12);
    this.texKey = `fog_${FogOfWarSystem.serial++}`;
    this.tex = battle.textures.addCanvas(this.texKey, c.canvas) as Phaser.Textures.CanvasTexture;
    const texel = this.cellPx / 2;
    battle.add.image(-texel, Projection.vy(-texel), this.texKey).setOrigin(0).setDepth(DEPTH.fog)
      .setScale(texel, texel * Projection.tilt);
    battle.events.once(Phaser.Scenes.Events.SHUTDOWN, () => battle.textures.remove(this.texKey));
    this.recompute();
  }

  update(dt: number): void {
    this.timer -= dt * 1000;
    if (this.timer > 0) return;
    this.timer = FOG.updateMs;
    this.recompute();
  }

  private reveal(x: number, y: number, r: number): void {
    const c = this.cellPx;
    const x0 = Math.max(0, Math.floor((x - r) / c));
    const x1 = Math.min(this.cols - 1, Math.floor((x + r) / c));
    const y0 = Math.max(0, Math.floor((y - r) / c));
    const y1 = Math.min(this.rows - 1, Math.floor((y + r) / c));
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const dx = (cx + 0.5) * c - x;
        const dy = (cy + 0.5) * c - y;
        if (dx * dx + dy * dy <= r2) this.state[cy * this.cols + cx] = VISIBLE;
      }
    }
  }

  recompute(): void {
    for (let i = 0; i < this.state.length; i++) if (this.state[i] === VISIBLE) this.state[i] = EXPLORED;
    if (!this.enabled) this.state.fill(VISIBLE);
    for (const s of this.battle.units.squads) {
      if (s.owner !== 'player' || !s.alive) continue;
      for (const u of s.units) this.reveal(u.x, u.y, u.def.sight);
    }
    for (const b of this.battle.buildings.buildings) {
      if (b.owner !== 'player' || !b.alive) continue;
      this.reveal(b.x, b.y, (b.def.role === 'hq' ? FOG.hqVision : FOG.buildingVision) + b.radius);
    }
    this.applyVisibility();
    this.draw();
  }

  private applyVisibility(): void {
    for (const s of this.battle.units.squads) {
      if (s.owner !== 'enemy') continue;
      const hidden = s.hiddenFrom('player');
      for (const u of s.units) u.setShown(!hidden && this.isVisibleWorld(u.x, u.y));
    }
    for (const b of this.battle.buildings.buildings) {
      if (b.owner !== 'enemy') continue;
      if (!b.discovered && this.isVisibleWorld(b.x, b.y)) b.discovered = true;
      b.setShown(b.discovered);
    }
  }

  private draw(): void {
    const w = this.cols * 2 + 2;
    const h = this.rows * 2 + 2;
    const d = this.img.data;
    for (let ty = 0; ty < h; ty++) {
      const cy = Math.min(this.rows - 1, Math.max(0, Math.floor((ty - 1) / 2)));
      for (let tx = 0; tx < w; tx++) {
        const cx = Math.min(this.cols - 1, Math.max(0, Math.floor((tx - 1) / 2)));
        const st = this.state[cy * this.cols + cx];
        const i = ty * w + tx;
        let a = st === VISIBLE ? 0 : st === EXPLORED ? FOG.exploredAlpha : FOG.unexploredAlpha;
        if (a > 0) a = Math.min(1, Math.max(0, a + this.jitter[i]));
        // Explored ground is veiled in a cold, desaturated haze; unexplored is near-black smoke.
        const p = i * 4;
        d[p] = st === EXPLORED ? 14 : 4;
        d[p + 1] = st === EXPLORED ? 17 : 4;
        d[p + 2] = st === EXPLORED ? 24 : 8;
        d[p + 3] = Math.round(a * 255);
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
    this.tex.refresh();
  }

  /** Iterates fog cells in world pixels with the alpha each should be darkened by. */
  forEachCell(cb: (x: number, y: number, w: number, h: number, alpha: number) => void): void {
    const c = this.cellPx;
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const s = this.state[cy * this.cols + cx];
        const a = s === VISIBLE ? 0 : s === EXPLORED ? FOG.exploredAlpha : FOG.unexploredAlpha;
        cb(cx * c, cy * c, c, c, a);
      }
    }
  }

  private cellState(x: number, y: number): number {
    const cx = Math.floor(x / this.cellPx);
    const cy = Math.floor(y / this.cellPx);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return UNEXPLORED;
    return this.state[cy * this.cols + cx];
  }

  isVisibleWorld(x: number, y: number): boolean {
    return this.cellState(x, y) === VISIBLE;
  }

  isExploredWorld(x: number, y: number): boolean {
    return this.cellState(x, y) !== UNEXPLORED;
  }
}
