import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { EV } from '../events';
import { Projection } from '../render/Projection';
import { Unit } from './Unit';
import { Building } from '../buildings/Building';
import type { BattleScene } from '../scenes/BattleScene';

/** A destroyed building's rubble: heavy cover to occupy, scrap for engineers. */
export interface Ruin {
  x: number;
  y: number;
  radius: number;
  img: Phaser.GameObjects.Image;
  value: number;
  work: number;
  alive: boolean;
}

/** A burnt-out vehicle hull or beast carcass: blocks movement, gives cover, can be salvaged. */
export interface Wreck {
  x: number;
  y: number;
  radius: number;
  tiles: { tx: number; ty: number }[];
  img: Phaser.GameObjects.Image | null;
  /** Scrip granted to engineers who strip it. */
  value: number;
  /** Engineer-seconds of work done so far. */
  work: number;
  expires: number;
  alive: boolean;
}

const LIFETIME = 90;
export const SALVAGE_WORK = 6;

export class WreckSystem {
  readonly wrecks: Wreck[] = [];
  readonly ruins: Ruin[] = [];

  constructor(private battle: BattleScene) {
    battle.events.on(EV.buildingDestroyed, (b: Building) => {
      if (b.def.mine || b.def.neutral) return;
      const img = battle.effects.leaveRuin(b);
      this.ruins.push({ x: b.x, y: b.y, radius: b.radius, img, value: Math.round(b.def.cost.scrip * 0.2 + 15), work: 0, alive: true });
    });
    battle.events.on(EV.unitDied, (_x: number, _y: number, u: Unit) => {
      if (u.def.category === 'vehicle') this.add(u, battle.effects.vehicleDeath(u));
    });
  }

  /** Called after the corpse sprite is placed for a dead vehicle. */
  add(u: Unit, img: Phaser.GameObjects.Image | null): void {
    const map = this.battle.map;
    const r = u.radius * 0.8;
    const tiles: { tx: number; ty: number }[] = [];
    const t0 = map.worldToTile(u.x - r, u.y - r);
    const t1 = map.worldToTile(u.x + r, u.y + r);
    for (let ty = t0.ty; ty <= t1.ty; ty++) {
      for (let tx = t0.tx; tx <= t1.tx; tx++) {
        const cx = (tx + 0.5) * TILE_SIZE;
        const cy = (ty + 0.5) * TILE_SIZE;
        if (Math.hypot(cx - u.x, cy - u.y) > r + TILE_SIZE * 0.5 || !map.isTerrainPassable(tx, ty) || map.isOccupied(tx, ty)) continue;
        tiles.push({ tx, ty });
      }
    }
    if (!tiles.length) {
      const t = map.worldToTile(u.x, u.y);
      if (map.isTerrainPassable(t.tx, t.ty) && !map.isOccupied(t.tx, t.ty)) tiles.push(t);
    }
    for (const t of tiles) map.setBlocked(t.tx, t.ty, true);
    const w: Wreck = {
      x: u.x, y: u.y, radius: Math.max(u.radius, 18), tiles, img, value: Math.round(u.def.cost.scrip * 0.3 + 20), work: 0,
      expires: this.battle.elapsed + LIFETIME, alive: true,
    };
    this.wrecks.push(w);
    this.battle.events.emit(EV.wreckChanged);
  }

  remove(w: Wreck, fade = true): void {
    if (!w.alive) return;
    w.alive = false;
    for (const t of w.tiles) this.battle.map.setBlocked(t.tx, t.ty, false);
    const img = w.img;
    if (img?.active) {
      if (fade) this.battle.tweens.add({ targets: img, alpha: 0, duration: 1500, onComplete: () => img.destroy() });
      else img.destroy();
    }
    const i = this.wrecks.indexOf(w);
    if (i >= 0) this.wrecks.splice(i, 1);
    this.battle.events.emit(EV.wreckChanged);
  }

  /** Wreck drawn under a view-space point (for salvage orders). */
  wreckAtView(vx: number, vy: number): Wreck | null {
    for (const w of this.wrecks) {
      const gy = Projection.vy(w.y);
      if (Math.abs(vx - w.x) <= w.radius + 6 && vy >= gy - w.radius * 1.4 && vy <= gy + 10) return w;
    }
    return null;
  }

  ruinAtView(vx: number, vy: number): Ruin | null {
    for (const r of this.ruins) {
      if (!r.alive) continue;
      const gy = Projection.vy(r.y);
      if (Math.abs(vx - r.x) <= r.radius && Math.abs(vy - gy) <= r.radius * Projection.tilt + 20) return r;
    }
    return null;
  }

  /** Engineers stripped the ruin: the scrap is gone but the rubble tiles stay as cover. */
  removeRuin(r: Ruin): void {
    if (!r.alive) return;
    r.alive = false;
    const img = r.img;
    if (img.active) this.battle.tweens.add({ targets: img, alpha: 0.35, duration: 800 });
  }

  isWreckTile(tx: number, ty: number): boolean {
    return this.wrecks.some((w) => w.tiles.some((t) => t.tx === tx && t.ty === ty));
  }

  update(): void {
    for (const w of this.wrecks.slice()) if (this.battle.elapsed >= w.expires) this.remove(w);
  }
}
