import Phaser from 'phaser';
import { COVER, TILE, TILE_SIZE } from '../config';
import { EV } from '../events';
import { Unit } from '../units/Unit';
import { Squad } from '../units/Squad';
import type { BattleScene, CoverQueries } from '../scenes/BattleScene';

/**
 * Cover: ruins and ground tiles hugging a cliff edge halve incoming damage.
 * Line of sight: cliff tiles stop projectiles.
 */
export class CoverSystem implements CoverQueries {
  private grid: Uint8Array;
  private timer = 0;

  constructor(private battle: BattleScene) {
    this.grid = new Uint8Array(battle.map.width * battle.map.height);
    this.rebuild();
    battle.events.on(EV.buildingDestroyed, () => this.rebuild());
  }

  rebuild(): void {
    const m = this.battle.map;
    for (let ty = 0; ty < m.height; ty++) {
      for (let tx = 0; tx < m.width; tx++) {
        const t = m.getTile(tx, ty);
        let cover = t === TILE.RUINS;
        if (!cover && t !== TILE.CLIFF) {
          for (let dy = -1; dy <= 1 && !cover; dy++) {
            for (let dx = -1; dx <= 1 && !cover; dx++) {
              if ((dx || dy) && m.inBounds(tx + dx, ty + dy) && m.getTile(tx + dx, ty + dy) === TILE.CLIFF) cover = true;
            }
          }
        }
        this.grid[ty * m.width + tx] = cover ? 1 : 0;
      }
    }
  }

  isCoverTile(tx: number, ty: number): boolean {
    return this.battle.map.inBounds(tx, ty) && this.grid[ty * this.battle.map.width + tx] === 1;
  }

  isCoverWorld(x: number, y: number): boolean {
    const t = this.battle.map.worldToTile(x, y);
    return this.isCoverTile(t.tx, t.ty);
  }

  damageMultiplier(u: Unit): number {
    return u.inCover ? COVER.damageMult : 1;
  }

  update(dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = COVER.updateInterval;
    for (const s of this.battle.units.squads) {
      for (const u of s.units) u.setCover(this.isCoverWorld(u.x, u.y));
    }
  }

  /** First cliff point along a segment, or null if the line is clear. */
  blockPoint(x0: number, y0: number, x1: number, y1: number): { x: number; y: number } | null {
    const map = this.battle.map;
    const d = Phaser.Math.Distance.Between(x0, y0, x1, y1);
    const steps = Math.ceil(d / COVER.losStep);
    const start = map.worldToTile(x0, y0);
    const end = map.worldToTile(x1, y1);
    for (let i = 1; i < steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      const y = y0 + ((y1 - y0) * i) / steps;
      const t = map.worldToTile(x, y);
      if ((t.tx === start.tx && t.ty === start.ty) || (t.tx === end.tx && t.ty === end.ty)) continue;
      if (map.getTile(t.tx, t.ty) === TILE.CLIFF) return { x, y };
    }
    return null;
  }

  hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    return this.blockPoint(x0, y0, x1, y1) === null;
  }

  /** Assigns each soldier of a holding squad to a nearby free cover tile, if any. */
  seekCover(s: Squad): void {
    const map = this.battle.map;
    const c = map.worldToTile(s.x, s.y);
    const r = COVER.seekRadius;
    const tiles: { x: number; y: number; d: number }[] = [];
    for (let ty = c.ty - r; ty <= c.ty + r; ty++) {
      for (let tx = c.tx - r; tx <= c.tx + r; tx++) {
        if (!this.isCoverTile(tx, ty) || !map.isPassable(tx, ty)) continue;
        const w = map.tileToWorld(tx, ty);
        const d = Phaser.Math.Distance.Between(w.x, w.y, s.x, s.y);
        if (d <= r * TILE_SIZE) tiles.push({ x: w.x, y: w.y, d });
      }
    }
    if (tiles.length === 0) {
      s.coverSlots = null;
      return;
    }
    tiles.sort((a, b) => a.d - b.d);
    // Two soldiers per tile, offset inside it.
    const slots: { x: number; y: number }[] = [];
    for (let i = 0; i < s.maxSize; i++) {
      const t = tiles[Math.floor(i / 2) % tiles.length];
      const off = i % 2 === 0 ? -12 : 12;
      slots.push({ x: t.x + off, y: t.y + (Math.floor(i / 2) >= tiles.length ? 14 : 0) });
    }
    s.coverSlots = slots;
    if (s.owner === 'player') this.battle.events.emit(EV.message, 'Squad taking cover');
  }
}
