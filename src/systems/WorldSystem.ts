import Phaser from 'phaser';
import { DEPTH, TILE, TILE_SIZE } from '../config';
import { EV } from '../events';
import { Owner } from '../types';
import { Projection } from '../render/Projection';
import { Culler } from '../render/Culler';
import { makeRng } from '../utils/rng';
import { Building } from '../buildings/Building';
import type { BattleScene } from '../scenes/BattleScene';

interface Barrel {
  x: number;
  y: number;
  tx: number;
  ty: number;
  hp: number;
  img: Phaser.GameObjects.Image;
  alive: boolean;
}

interface Derelict {
  x: number;
  y: number;
  tx: number;
  ty: number;
  img: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  progress: number;
  claimant: Owner | null;
  building: Building | null;
  /** Battle second when a destroyed turret becomes capturable again. */
  respawnAt: number;
}

const BARREL_BLAST = { radius: 95, damage: 75 };
const CAPTURE_TIME = 6;
const STORM_EVERY = [170, 230];
const STORM_LENGTH = 45;

/**
 * Neutral map elements: fuel barrels that chain-explode, derelict turrets anyone can capture,
 * and (optional) ash storms that shrink vision and slow projectiles.
 */
export class WorldSystem {
  private barrels: Barrel[] = [];
  private derelicts: Derelict[] = [];
  private stormAt = 0;
  private stormUntil = 0;
  private warned = false;
  private tick = 0;

  constructor(private battle: BattleScene, seed: number, private storms: boolean) {
    this.makeTextures();
    const rnd = makeRng(seed * 31 + 7);
    const map = battle.map;
    const W = map.width;
    const H = map.height;
    const bases = [map.def.playerBase, map.def.enemyBase];
    const points = map.def.capturePoints;
    const ok = (tx: number, ty: number): boolean => map.getTile(tx, ty) !== TILE.CLIFF && map.isPassable(tx, ty)
      && !battle.buildings.reserved.has(ty * W + tx)
      && bases.every((b) => Math.hypot(b.tx + 2 - tx, b.ty + 2 - ty) > 10)
      && points.every((p) => Math.hypot(p.x - tx, p.y - ty) > 4);
    // Barrel dumps, mirrored for fairness.
    for (let n = 0, tries = 0; n < 4 && tries < 400; tries++) {
      const tx = 4 + Math.floor(rnd() * (W - 8));
      const ty = 4 + Math.floor(rnd() * (H / 2 - 4));
      const mx = W - 1 - tx;
      const my = H - 1 - ty;
      if (!ok(tx, ty) || !ok(mx, my) || !ok(tx + 1, ty) || !ok(mx - 1, my)) continue;
      this.addBarrel(tx, ty);
      this.addBarrel(tx + 1, ty);
      this.addBarrel(mx, my);
      this.addBarrel(mx - 1, my);
      n++;
    }
    // Two derelict turrets on opposite flanks.
    for (let tries = 0; tries < 400; tries++) {
      const tx = Math.floor(W * 0.2 + rnd() * W * 0.25);
      const ty = Math.floor(H * 0.55 + rnd() * H * 0.3);
      const mx = W - 2 - tx;
      const my = H - 2 - ty;
      if (![[0, 0], [1, 0], [0, 1], [1, 1]].every(([dx, dy]) => ok(tx + dx, ty + dy) && ok(mx + dx, my + dy))) continue;
      this.addDerelict(tx, ty);
      this.addDerelict(mx, my);
      break;
    }
    this.stormAt = STORM_EVERY[0] + rnd() * (STORM_EVERY[1] - STORM_EVERY[0]);
    battle.events.on(EV.buildingDestroyed, (b: Building) => {
      const d = this.derelicts.find((q) => q.building === b);
      if (d) {
        d.building = null;
        d.respawnAt = battle.elapsed + 20;
      }
    });
  }

  private makeTextures(): void {
    const tex = this.battle.textures;
    if (!tex.exists('prop_barrels')) {
      const c = document.createElement('canvas');
      c.width = 48;
      c.height = 52;
      const ctx = c.getContext('2d') as CanvasRenderingContext2D;
      const drum = (x: number, y: number, col: string): void => {
        const g = ctx.createLinearGradient(x - 9, 0, x + 9, 0);
        g.addColorStop(0, col);
        g.addColorStop(0.4, '#ffb070');
        g.addColorStop(1, '#3a1008');
        ctx.fillStyle = g;
        ctx.fillRect(x - 9, y - 22, 18, 22);
        ctx.fillStyle = '#5a2010';
        ctx.beginPath();
        ctx.ellipse(x, y - 22, 9, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(x - 9, y - 15, 18, 2);
        ctx.fillRect(x - 9, y - 7, 18, 2);
        ctx.fillStyle = '#e8c030';
        ctx.fillRect(x - 4, y - 13, 8, 4);
      };
      drum(16, 44, '#8a2a18');
      drum(32, 48, '#9a3a1a');
      drum(26, 30, '#7a2414');
      tex.addCanvas('prop_barrels', c);
    }
  }

  private addBarrel(tx: number, ty: number): void {
    const x = (tx + 0.5) * TILE_SIZE;
    const y = (ty + 0.5) * TILE_SIZE;
    const img = this.battle.add.image(x, Projection.vy(y) + 8, 'prop_barrels').setOrigin(0.5, 1).setDepth(Projection.depth(y));
    Culler.for(this.battle).add(img, x, Projection.vy(y));
    this.battle.map.setBlocked(tx, ty, true);
    this.barrels.push({ x, y, tx, ty, hp: 30, img, alive: true });
  }

  private addDerelict(tx: number, ty: number): void {
    const x = (tx + 1) * TILE_SIZE;
    const y = (ty + 1) * TILE_SIZE;
    const k = Projection.tilt;
    const ring = this.battle.add.image(x, Projection.vy(y), 'capture_ring').setDepth(DEPTH.capture).setAlpha(0.35)
      .setTint(0x9a9a9a).setScale(180 / 256, (180 / 256) * k);
    const img = this.battle.add.image(x, Projection.vy(y + TILE_SIZE), 'bldicon_derelict').setOrigin(0.5, 0.86).setDepth(Projection.depth(y + TILE_SIZE));
    const bar = this.battle.add.graphics().setDepth(DEPTH.overlay - 2);
    this.battle.map.setBlocked(tx, ty, true);
    this.battle.map.setBlocked(tx + 1, ty, true);
    this.battle.map.setBlocked(tx, ty + 1, true);
    this.battle.map.setBlocked(tx + 1, ty + 1, true);
    this.derelicts.push({ x, y, tx, ty, img, ring, bar, progress: 0, claimant: null, building: null, respawnAt: 0 });
  }

  /** Blasts near fuel barrels (shells, grenades, mines) set them off. */
  explodeProps(x: number, y: number, r: number): void {
    for (const b of this.barrels) {
      if (!b.alive || Math.hypot(b.x - x, b.y - y) > r + 24) continue;
      b.hp = 0;
      this.detonate(b);
    }
  }

  private detonate(b: Barrel): void {
    if (!b.alive) return;
    b.alive = false;
    const battle = this.battle;
    battle.map.setBlocked(b.tx, b.ty, false);
    battle.time.delayedCall(120 + Math.random() * 120, () => {
      b.img.destroy();
      battle.effects.explosions.explode(b.x, b.y, 60, 20);
      battle.effects.lights.flash(b.x, Projection.vy(b.y), 260, 0xff8a30, 700, 1);
      battle.effects.blood.scorch(b.x, b.y, 70);
      // Barrels are neutral: everyone nearby gets hurt.
      for (const o of ['player', 'enemy'] as Owner[]) {
        battle.combat.splashAt(b.x, b.y, BARREL_BLAST.radius, BARREL_BLAST.damage, o === 'player' ? 'enemy' : 'player', null, 'explosive');
      }
      this.explodeProps(b.x, b.y, BARREL_BLAST.radius);
    });
  }

  get storming(): boolean {
    return this.stormUntil > this.battle.elapsed;
  }

  /** Vision multiplier during an ash storm. */
  get visionMult(): number {
    return this.storming ? 0.6 : 1;
  }

  update(dt: number): void {
    const b = this.battle;
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.25;
      for (const d of this.derelicts) this.updateDerelict(d, 0.25);
    }
    if (!this.storms) return;
    if (!this.warned && b.elapsed >= this.stormAt - 10) {
      this.warned = true;
      b.events.emit(EV.message, 'note.ashWarn');
    }
    if (b.elapsed >= this.stormAt && !this.storming) {
      this.stormUntil = b.elapsed + STORM_LENGTH;
      this.stormAt = b.elapsed + STORM_LENGTH + STORM_EVERY[0] + Math.random() * (STORM_EVERY[1] - STORM_EVERY[0]);
      this.warned = false;
      b.effects.projectiles.speedMult = 0.7;
      b.atmosphere.setStorm(true);
      b.events.emit(EV.mapEvent, 'storm', true);
      b.events.emit(EV.message, 'note.ashStorm');
    } else if (this.stormUntil > 0 && b.elapsed >= this.stormUntil) {
      this.stormUntil = 0;
      b.effects.projectiles.speedMult = 1;
      b.atmosphere.setStorm(false);
      b.events.emit(EV.mapEvent, 'storm', false);
    }
  }

  /** Squads standing by a derelict turret for 6 s (uncontested) bring it online for their side. */
  private updateDerelict(d: Derelict, dt: number): void {
    const b = this.battle;
    const online = !!d.building?.alive;
    d.img.setVisible(!online);
    d.ring.setVisible(!online);
    if (online || b.elapsed < d.respawnAt) {
      d.bar.clear();
      return;
    }
    const near: Owner[] = [];
    for (const s of b.units.squads) {
      if (!s.alive || s.embarked || !s.def.canCapture) continue;
      if (Phaser.Math.Distance.Between(s.center.x, s.center.y, d.x, d.y) < 110 && !near.includes(s.owner)) near.push(s.owner);
    }
    if (near.length === 1) {
      if (d.claimant !== near[0]) {
        d.claimant = near[0];
        d.progress = 0;
      }
      d.progress += dt / CAPTURE_TIME;
      if (d.progress >= 1) {
        d.building = b.buildings.spawn('derelict', d.claimant, d.tx, d.ty, true);
        d.progress = 0;
        if (d.claimant === 'player') b.events.emit(EV.message, 'note.derelict');
        d.claimant = null;
      }
    } else if (near.length === 0) {
      d.progress = Math.max(0, d.progress - dt / (CAPTURE_TIME * 2));
    }
    const g = d.bar.clear();
    if (d.progress > 0 && d.claimant) {
      const w = 60;
      const y = Projection.vy(d.y) - 70;
      g.fillStyle(0x000000, 0.75).fillRect(d.x - w / 2 - 2, y - 2, w + 4, 9);
      g.fillStyle(d.claimant === 'player' ? 0x3a8dff : 0xe0303a, 1).fillRect(d.x - w / 2, y, w * d.progress, 5);
    }
  }
}
