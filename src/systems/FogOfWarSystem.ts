import Phaser from 'phaser';
import { DEPTH, FOG, TILE_SIZE } from '../config';
import type { BattleScene, FogQueries } from '../scenes/BattleScene';

const UNEXPLORED = 0;
const EXPLORED = 1;
const VISIBLE = 2;

/** Low-resolution fog grid: unexplored (black), explored (dim), visible (clear). */
export class FogOfWarSystem implements FogQueries {
  readonly cols: number;
  readonly rows: number;
  readonly cellPx = FOG.cellTiles * TILE_SIZE;
  private state: Uint8Array;
  private gfx: Phaser.GameObjects.Graphics;
  private timer = 0;
  enabled = true;

  constructor(private battle: BattleScene) {
    this.cols = Math.ceil(battle.map.worldWidth / this.cellPx);
    this.rows = Math.ceil(battle.map.worldHeight / this.cellPx);
    this.state = new Uint8Array(this.cols * this.rows);
    this.gfx = battle.add.graphics().setDepth(DEPTH.fog);
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
      for (const u of s.units) this.reveal(u.x, u.y, FOG.unitVision);
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
      for (const u of s.units) u.setShown(this.isVisibleWorld(u.x, u.y));
    }
    for (const b of this.battle.buildings.buildings) {
      if (b.owner !== 'enemy') continue;
      if (!b.discovered && this.isVisibleWorld(b.x, b.y)) b.discovered = true;
      b.setShown(b.discovered);
    }
  }

  private draw(): void {
    const g = this.gfx.clear();
    this.forEachCell((x, y, w, h, a) => {
      if (a > 0) g.fillStyle(0x000000, a).fillRect(x, y, w, h);
    });
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
