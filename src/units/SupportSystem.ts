import Phaser from 'phaser';
import { Owner, opponent } from '../types';
import { Building } from '../buildings/Building';
import { Squad, isSquad } from './Squad';
import { Unit } from './Unit';
import type { BattleScene } from '../scenes/BattleScene';
import { Projection } from '../render/Projection';
import { EV } from '../events';
import { SALVAGE_WORK } from './WreckSystem';

const TICK = 0.25;

/**
 * Role passives that are not plain shooting: detection and burrowing, healing/speed auras,
 * engineer repairs and leaps. Runs on a coarse tick so it stays cheap with many squads.
 */
export class SupportSystem {
  private timer = 0;
  /** Last time (battle s) an engineer squad asked for a path to its repair target. */
  private repairPathAt = new WeakMap<Squad, number>();

  constructor(private battle: BattleScene) {}

  update(dt: number): void {
    for (const s of this.battle.units.squads) {
      if (!s.alive) continue;
      s.leapCd = Math.max(0, s.leapCd - dt);
      if (s.def.repairRate) this.repair(s, dt);
      if (s.def.leap) this.tryLeap(s);
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = TICK;
    this.detection();
    for (const s of this.battle.units.squads) {
      if (!s.alive) continue;
      if (s.def.burrow) this.burrow(s);
      if (s.def.aura) this.aura(s);
    }
  }

  // ---- Stealth -------------------------------------------------------------

  /** A burrowed squad is detected by any enemy detector unit (or detector structure) in range. */
  private detection(): void {
    const squads = this.battle.units.squads;
    for (const s of squads) {
      if (!s.burrowed) {
        s.detected = false;
        continue;
      }
      const c = s.center;
      const foe = opponent(s.owner);
      s.detected = squads.some((d) => d.alive && d.owner === foe && !!d.def.detector
        && Phaser.Math.Distance.Between(d.center.x, d.center.y, c.x, c.y) <= (d.def.detector ?? 0))
        || this.battle.buildings.buildings.some((b) => b.alive && b.owner === foe && b.isReady && !!b.def.detector
          && Phaser.Math.Distance.Between(b.x, b.y, c.x, c.y) <= (b.def.detector ?? 0));
    }
  }

  /** Burrowers dig in after a short calm and surface (with an ambush bonus) when prey is in reach. */
  private burrow(s: Squad): void {
    const cfg = s.def.burrow;
    if (!cfg) return;
    const t = s.engaged;
    let close = false;
    if (t) {
      const tp = isSquad(t) ? t.center : { x: t.x, y: t.y };
      close = Phaser.Math.Distance.Between(s.center.x, s.center.y, tp.x, tp.y) <= s.def.range + 60 + (isSquad(t) ? 0 : t.radius);
    }
    if (s.burrowed && (close || s.order === 'hold')) {
      this.setBurrowed(s, false);
      for (const u of s.units) u.strikeMult = cfg.ambush;
      s.calm = 0;
      return;
    }
    if (!s.burrowed) {
      s.calm = close || s.retreating ? 0 : s.calm + TICK;
      if (s.calm >= 1.5 && s.order !== 'hold') this.setBurrowed(s, true);
    }
  }

  private warnedBurrow = false;

  private setBurrowed(s: Squad, on: boolean): void {
    s.burrowed = on;
    if (!on && s.owner === 'enemy' && !this.warnedBurrow) {
      this.warnedBurrow = true;
      this.battle.events.emit(EV.message, 'note.burrowed');
    }
    for (const u of s.units) {
      u.setBurrowed(on);
      this.battle.effects.dust(u.x, this.viewY(u));
    }
  }

  /** Units of `viewer`'s opponent that `viewer` can currently target. */
  canTarget(viewer: Owner, s: Squad): boolean {
    return !s.hiddenFrom(viewer);
  }

  // ---- Auras ---------------------------------------------------------------

  private aura(s: Squad): void {
    const a = s.def.aura;
    if (!a) return;
    const c = s.center;
    const heal = a.heal * TICK * s.units.length;
    for (const o of this.battle.units.squads) {
      if (!o.alive || o.owner !== s.owner) continue;
      if (Phaser.Math.Distance.Between(o.center.x, o.center.y, c.x, c.y) > a.radius) continue;
      for (const u of o.units) if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + heal);
      o.auraSpeed = a.speed;
      o.auraUntil = this.battle.elapsed + TICK * 2;
    }
  }

  // ---- Repair --------------------------------------------------------------

  /** Engineers strip a wreck for Scrip. */
  private salvage(s: Squad, dt: number): boolean {
    const w = s.salvageTarget;
    if (!w) return false;
    if (!w.alive) {
      s.salvageTarget = null;
      return false;
    }
    const c = s.center;
    const gap = Phaser.Math.Distance.Between(c.x, c.y, w.x, w.y) - w.radius;
    if (gap > 40) {
      const last = this.repairPathAt.get(s) ?? -99;
      if (!s.isMoving() && this.battle.elapsed - last > 1.5) {
        this.repairPathAt.set(s, this.battle.elapsed);
        s.pathTo(w.x + (c.x > w.x ? 1 : -1) * (w.radius + 26), w.y + 20);
      }
      return true;
    }
    w.work += dt * s.units.length;
    for (const u of s.units) {
      u.face(w.x, w.y);
      if (Math.random() < dt * 2) {
        u.playAttack();
        this.battle.effects.sparks(u.x + Math.cos(u.angle) * 14, this.viewY(u) - 10);
      }
    }
    if (w.work >= SALVAGE_WORK) {
      this.battle.resources.grant(s.owner, 'scrip', w.value);
      if (s.owner === 'player') this.battle.events.emit(EV.message, 'note.salvage', { n: w.value });
      this.battle.wrecks.remove(w);
      s.salvageTarget = null;
    }
    return true;
  }

  /** Engineers walk to a damaged friendly structure (or vehicle) and weld it back together. */
  private repair(s: Squad, dt: number): void {
    if (this.salvage(s, dt)) return;
    if (this.repairVehicle(s, dt)) return;
    let b = s.repairTarget;
    if (b && (!b.alive || b.owner !== s.owner || (b.hp >= b.maxHp && b.isReady))) {
      b = s.repairTarget = null;
    }
    const idle = s.order === 'idle' || s.order === 'hold';
    if (!b && idle && !s.engaged) b = this.nearestDamaged(s, 260);
    if (!b) return;
    const c = s.center;
    const gap = Phaser.Math.Distance.Between(c.x, c.y, b.x, b.y) - b.radius;
    if (gap > 46) {
      const last = this.repairPathAt.get(s) ?? -99;
      if (!s.isMoving() && s.repairTarget && this.battle.elapsed - last > 1.5) {
        this.repairPathAt.set(s, this.battle.elapsed);
        const a = Math.atan2(c.y - b.y, c.x - b.x);
        const tx = b.x + Math.cos(a) * (b.radius + 28);
        const ty = b.y + Math.sin(a) * (b.radius + 28);
        s.path = this.battle.pathfinder.find(s.x, s.y, tx, ty);
      }
      return;
    }
    const n = s.units.length;
    if (b.state === 'constructing') b.updateConstruction(dt * 0.35 * n, this.battle.buildings.buildSpeed[s.owner]);
    else b.heal((s.def.repairRate ?? 0) * n * dt);
    for (const u of s.units) {
      u.face(b.x, b.y);
      if (Math.random() < dt * 2) {
        u.playAttack();
        this.battle.effects.sparks(u.x + Math.cos(u.angle) * 14, this.viewY(u) - 10);
      }
    }
  }

  /** Iron Void engineers also patch up damaged friendly vehicles standing close by. */
  private repairVehicle(s: Squad, dt: number): boolean {
    if (s.repairTarget || s.order !== 'idle' || s.engaged) return false;
    const c = s.center;
    for (const o of this.battle.units.squads) {
      if (!o.alive || o.owner !== s.owner || !o.isVehicle || o.def.faction !== s.def.faction) continue;
      const v = o.units[0];
      if (!v || v.hp >= v.maxHp) continue;
      if (Phaser.Math.Distance.Between(c.x, c.y, v.x, v.y) > 110) continue;
      v.hp = Math.min(v.maxHp, v.hp + (s.def.repairRate ?? 0) * s.units.length * dt * 0.6);
      for (const u of s.units) {
        u.face(v.x, v.y);
        if (Math.random() < dt * 2) {
          u.playAttack();
          this.battle.effects.sparks(v.x + (Math.random() - 0.5) * 20, this.viewY(v) - v.height * 0.4);
        }
      }
      return true;
    }
    return false;
  }

  private nearestDamaged(s: Squad, reach: number): Building | null {
    let best: Building | null = null;
    let bestD = reach;
    for (const b of this.battle.buildings.buildings) {
      if (!b.alive || b.owner !== s.owner || (b.hp >= b.maxHp && b.isReady)) continue;
      const d = Phaser.Math.Distance.Between(s.center.x, s.center.y, b.x, b.y) - b.radius;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  // ---- Leaps ---------------------------------------------------------------

  /** Leapers pounce on a target squad that is out of melee reach but within leap range. */
  private tryLeap(s: Squad): void {
    const cfg = s.def.leap;
    const t = s.engaged;
    if (!cfg || s.leapCd > 0 || !t || !isSquad(t) || s.retreating || s.burrowed) return;
    const d = Phaser.Math.Distance.Between(s.center.x, s.center.y, t.center.x, t.center.y);
    if (d > cfg.range || d < s.def.range + 50) return;
    s.leapCd = cfg.cooldown;
    for (const u of s.units) {
      const v = this.battle.combat.nearestUnit(t, u.x, u.y);
      if (!v) continue;
      const a = Math.atan2(u.y - v.y, u.x - v.x);
      const p = this.battle.units.findOpenSpot(v.x + Math.cos(a) * (v.radius + u.radius + 4), v.y + Math.sin(a) * (v.radius + u.radius + 4));
      u.startLeap(p.x, p.y);
    }
    s.x = t.center.x;
    s.y = t.center.y;
    s.path = [];
  }

  /** Called by UnitSystem when a leaping unit touches down. */
  onLand(u: Unit): void {
    u.strikeMult = u.def.leap?.mult ?? 1;
    u.cooldown = 0;
    this.battle.effects.dust(u.x, this.viewY(u));
  }

  private viewY(u: Unit): number {
    return Projection.vy(u.y);
  }
}
