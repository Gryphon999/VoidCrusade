import Phaser from 'phaser';
import { EV } from '../events';
import { Owner, opponent } from '../types';
import { Projection } from '../render/Projection';
import { Building } from './Building';
import { Squad } from '../units/Squad';
import { UNITS } from '../config';
import type { BattleScene } from '../scenes/BattleScene';

const TICK = 0.25;

/**
 * Special structure rules: mines, healing/revival, shield domes, Flux upkeep, outposts on
 * capture points and bunker garrisons. Runs on a coarse tick.
 */
export class StructureSystem {
  private timer = 0;
  /** Outposts currently paying their bonus (so income can be removed exactly once). */
  private paying = new Set<Building>();
  private reviveT = new WeakMap<Squad, number>();

  constructor(private battle: BattleScene) {
    const ev = battle.events;
    ev.on(EV.buildingComplete, (b: Building) => this.onReady(b));
    ev.on(EV.buildingPlaced, (b: Building) => {
      if (b.isReady) this.onReady(b);
    });
    ev.on(EV.buildingDestroyed, (b: Building) => this.onLost(b));
  }

  private onReady(b: Building): void {
    if (b.def.upkeep) this.battle.resources.addIncome(b.owner, 'flux', -b.def.upkeep);
  }

  private onLost(b: Building): void {
    if (b.def.upkeep && b.completed) this.battle.resources.addIncome(b.owner, 'flux', b.def.upkeep);
    if (this.paying.delete(b)) this.battle.resources.removeIncome(b.owner, 'scrip', b.def.incomeBonus ?? 0);
    if (b.garrison.length) this.ejectAll(b, true);
  }

  update(dt: number): void {
    for (const b of this.battle.buildings.buildings) if (b.garrison.length) this.holdGarrison(b);
    for (const s of this.battle.units.squads) {
      const b = s.garrisonTarget;
      if (!b || !s.alive) continue;
      if (!this.canGarrison(s, b)) {
        s.garrisonTarget = null;
        continue;
      }
      const d = Phaser.Math.Distance.Between(s.center.x, s.center.y, b.x, b.y) - b.radius;
      if (d < 60) {
        s.garrisonTarget = null;
        this.enter(s, b);
      } else if (!s.isMoving()) {
        s.pathTo(b.x, b.y + b.radius + 20);
      }
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = TICK;
    for (const b of this.battle.buildings.buildings.slice()) {
      if (!b.alive || !b.isReady) continue;
      if (b.def.mine) this.checkMine(b);
      if (b.def.heal) this.heal(b);
      if (b.def.onPoint) this.outpost(b);
    }
  }

  // ---- Mines ---------------------------------------------------------------

  private checkMine(b: Building): void {
    const m = b.def.mine;
    if (!m) return;
    const foe = opponent(b.owner);
    const hit = this.battle.units.squads.some((s) => s.alive && s.owner === foe && !s.embarked && !s.def.flying
      && s.units.some((u) => Phaser.Math.Distance.Between(u.x, u.y, b.x, b.y) <= m.trigger + u.radius));
    if (!hit) return;
    this.battle.combat.splashAt(b.x, b.y, m.splash, m.damage, b.owner, null, m.damageType);
    const fx = this.battle.effects;
    if (b.def.faction === 'ironvoid') fx.explosions.blast(b.x, Projection.vy(b.y), 1.2);
    else fx.projectiles.burst(b.x, Projection.vy(b.y));
    fx.blood.scorch(b.x, b.y, m.splash * 0.6);
    this.battle.buildings.damage(b, b.hp + 1);
  }

  /** Mines are invisible to `viewer` unless one of its detectors is close. */
  hiddenFrom(b: Building, viewer: Owner): boolean {
    if (!b.def.stealth || viewer === b.owner) return false;
    const squads = this.battle.units.squads;
    const seen = squads.some((d) => d.alive && d.owner === viewer && !!d.def.detector
      && Phaser.Math.Distance.Between(d.center.x, d.center.y, b.x, b.y) <= (d.def.detector ?? 0))
      || this.battle.buildings.buildings.some((s) => s.alive && s.owner === viewer && s.isReady && !!s.def.detector
        && Phaser.Math.Distance.Between(s.x, s.y, b.x, b.y) <= (s.def.detector ?? 0));
    return !seen;
  }

  // ---- Healing ---------------------------------------------------------------

  /** Hospitals mend nearby soldiers and slowly return fallen members (paying for each). */
  private heal(b: Building): void {
    const h = b.def.heal;
    if (!h) return;
    for (const s of this.battle.units.squads) {
      if (!s.alive || s.owner !== b.owner || s.embarked) continue;
      if (b.def.faction === 'ironvoid' && s.def.category === 'vehicle') continue;
      if (Phaser.Math.Distance.Between(s.center.x, s.center.y, b.x, b.y) > h.radius) continue;
      for (const u of s.units) if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + h.hps * TICK);
      if (!h.revive || !this.battle.units.canReinforce(s) || s.pendingReinforce > 0) continue;
      const t = (this.reviveT.get(s) ?? 0) + TICK;
      if (t < h.revive) {
        this.reviveT.set(s, t);
        continue;
      }
      this.reviveT.set(s, 0);
      const cost = { scrip: Math.ceil((s.def.cost.scrip / s.def.squadSize) * UNITS.reinforceCostFactor), flux: 0 };
      if (!this.battle.resources.trySpend(s.owner, cost)) continue;
      const u = s.addUnit(b.x, b.y + b.radius + 10);
      u.sprite.setAlpha(0);
      this.battle.tweens.add({ targets: u.sprite, alpha: 1, duration: 500 });
      this.battle.effects.lights.flash(u.x, Projection.vy(u.y), 50, b.def.faction === 'ironvoid' ? 0x80ff90 : 0xd070ff, 400, 0.8);
    }
  }

  // ---- Outposts ----------------------------------------------------------------

  /** Listening posts / spore nodes pay a bonus while their point stays in friendly hands. */
  private outpost(b: Building): void {
    const p = this.battle.capture.points.find((q) => q.contains(b.x, b.y));
    const active = !!p && p.owner === b.owner;
    if (active && !this.paying.has(b)) {
      this.paying.add(b);
      this.battle.resources.addIncome(b.owner, 'scrip', b.def.incomeBonus ?? 0);
    } else if (!active && this.paying.delete(b)) {
      this.battle.resources.removeIncome(b.owner, 'scrip', b.def.incomeBonus ?? 0);
    }
  }

  /** True if `owner` has a finished outpost standing on this point (enemy captures slower). */
  fortified(px: number, py: number, owner: Owner): boolean {
    return this.battle.buildings.buildings.some((b) => b.alive && b.isReady && b.owner === owner && !!b.def.onPoint
      && Phaser.Math.Distance.Between(b.x, b.y, px, py) < 3 * 64);
  }

  // ---- Shields -------------------------------------------------------------------

  canRaiseShield(b: Building): boolean {
    const sh = b.def.shield;
    return !!sh && b.isReady && this.battle.elapsed >= b.shieldReady && this.battle.resources.canAfford(b.owner, { scrip: 0, flux: sh.cost });
  }

  raiseShield(b: Building): boolean {
    const sh = b.def.shield;
    if (!sh || !this.canRaiseShield(b)) {
      if (b.owner === 'player') this.battle.events.emit(EV.message, sh && this.battle.elapsed < b.shieldReady ? 'err.cooldown' : 'err.resources');
      return false;
    }
    this.battle.resources.spend(b.owner, { scrip: 0, flux: sh.cost });
    b.shieldUntil = this.battle.elapsed + sh.duration;
    b.shieldReady = this.battle.elapsed + sh.cooldown;
    this.battle.effects.shieldDome(b.x, b.y, sh.radius, sh.duration);
    if (b.owner === 'player') this.battle.events.emit(EV.message, 'note.shield');
    this.battle.events.emit(EV.shieldRaised, b);
    return true;
  }

  /** Is a logical point under one of `owner`'s active shield domes? */
  shielded(x: number, y: number, owner: Owner): boolean {
    for (const b of this.battle.buildings.buildings) {
      if (b.owner !== owner || !b.alive || b.shieldUntil <= this.battle.elapsed || !b.def.shield) continue;
      if (Phaser.Math.Distance.Between(x, y, b.x, b.y) <= b.def.shield.radius) return true;
    }
    return false;
  }

  // ---- Garrisons -----------------------------------------------------------------

  canGarrison(s: Squad, b: Building): boolean {
    return !!b.def.garrison && b.alive && b.isReady && b.owner === s.owner && s.def.category === 'infantry'
      && b.garrison.length < b.def.garrison && !s.embarked;
  }

  /** Squad walks in and shelters (called when it reaches the door). */
  enter(s: Squad, b: Building): void {
    s.garrisonIn = b;
    b.garrison.push(s);
    s.path = [];
    s.waypoints = [];
    s.order = 'hold';
    s.setSelected(false);
    for (const u of s.units) u.setEmbarked(true);
    this.battle.selection.prune();
    this.battle.events.emit(EV.transportChanged, b);
  }

  ejectAll(b: Building, hurt = false): void {
    const out = b.garrison.splice(0);
    out.forEach((s, i) => {
      s.garrisonIn = null;
      const a = Math.PI / 2 + (i - (out.length - 1) / 2) * 0.6;
      const p = this.battle.units.findOpenSpot(b.x + Math.cos(a) * (b.radius + 30), b.y + Math.sin(a) * (b.radius + 30));
      s.x = p.x;
      s.y = p.y;
      s.guard = { x: p.x, y: p.y };
      s.order = 'idle';
      s.units.forEach((u, j) => {
        u.x = p.x + (j % 3) * 14 - 14;
        u.y = p.y + Math.floor(j / 3) * 14;
        u.setEmbarked(false);
      });
      if (hurt) for (const u of s.units.slice()) this.battle.combat.applyDamage(u, u.maxHp * 0.3, null);
    });
    this.battle.events.emit(EV.transportChanged, b);
  }

  /** Flames licking into a bunker scorch the squad inside. */
  burnGarrison(b: Building, dmg: number, from: Squad | null): void {
    for (const s of b.garrison) {
      for (const u of s.units.slice()) this.battle.combat.applyDamage(u, (dmg * 0.4) / Math.max(1, s.units.length), from);
    }
  }

  /** Keeps garrisoned soldiers at the bunker (they shoot from its firing slits). */
  private holdGarrison(b: Building): void {
    for (const s of b.garrison) {
      s.x = b.x;
      s.y = b.y;
      s.path = [];
      for (const u of s.units) {
        u.x = b.x;
        u.y = b.y;
      }
    }
  }
}
