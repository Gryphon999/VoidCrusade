import Phaser from 'phaser';
import { EV } from '../events';
import { Projection } from '../render/Projection';
import { opponent } from '../types';
import { Squad, isSquad } from './Squad';
import { Unit } from './Unit';
import type { BattleScene } from '../scenes/BattleScene';

/** Vehicles whose running gear leaves marks on the ground. */
const TRACKED = new Set(['apc', 'tank', 'buggy']);
/** Distance (px beyond the hull) at which infantry climbs into a transport. */
const BOARD_RANGE = 70;

/**
 * Vehicle and war-beast rules: deploy/pack-up for artillery, crushing, regeneration,
 * transports (boarding, riding, unloading, ejecting), plus exhaust and tread marks.
 */
export class VehicleSystem {
  private fxT = new WeakMap<Unit, { puff: number; track: number; lx: number; ly: number }>();

  constructor(private battle: BattleScene) {
    battle.events.on(EV.unitDied, (_x: number, _y: number, u: Unit) => {
      if (u.squad.cargo.length) this.unload(u.squad, true);
    });
  }

  update(dt: number): void {
    for (const s of this.battle.units.squads) {
      if (!s.alive) continue;
      if (s.def.regen) for (const u of s.units) if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + s.def.regen * dt);
      if (s.def.deploy) this.deploy(s, dt);
      if (s.boardTarget) this.boarding(s);
      if (s.cargo.length) this.carry(s, dt);
      if (s.isVehicle) {
        for (const u of s.units) {
          if (s.def.crush) this.crush(u, dt);
          this.effects(u, dt);
        }
      }
    }
  }

  // ---- Deploy --------------------------------------------------------------

  /** Toggles deploy / pack-up (the command-grid button). */
  toggleDeploy(s: Squad): void {
    if (!s.def.deploy) return;
    if (s.deployState === 'mobile') {
      s.path = [];
      s.waypoints = [];
      s.deployState = 'deploying';
      s.deployT = 0;
    } else if (s.deployState === 'deployed' || s.deployState === 'deploying') {
      s.deployState = 'packing';
      s.deployT = 0;
    }
  }

  private deploy(s: Squad, dt: number): void {
    const cfg = s.def.deploy;
    if (!cfg) return;
    if (s.deployState === 'deploying') {
      s.deployT += dt;
      if (s.deployT >= cfg.time) s.deployState = 'deployed';
      return;
    }
    if (s.deployState === 'packing') {
      s.deployT += dt;
      if (s.deployT >= cfg.time * 0.6) {
        s.deployState = 'mobile';
        const m = s.pendingMove;
        s.pendingMove = null;
        if (m) s.moveTo(m.x, m.y, m.attack);
      }
      return;
    }
    // Auto-deploy when halted with a target inside the deployed range.
    if (s.deployState !== 'mobile' || s.isMoving() || s.order === 'move' || s.retreating) return;
    const t = s.engaged ?? this.battle.units.findTarget(s.owner, s.center.x, s.center.y, s.def.range + cfg.rangeBonus);
    if (!t) return;
    const tp = isSquad(t) ? t.center : { x: t.x, y: t.y };
    const d = Phaser.Math.Distance.Between(s.center.x, s.center.y, tp.x, tp.y);
    if (d <= s.def.range + cfg.rangeBonus && d >= (s.def.minRange ?? 0)) {
      s.target = t;
      this.toggleDeploy(s);
    }
  }

  // ---- Crush ---------------------------------------------------------------

  /** Moving treads and titan feet grind light infantry and shove it aside. */
  private crush(u: Unit, dt: number): void {
    if (Math.hypot(u.vx, u.vy) < 20) return;
    const foe = opponent(u.owner);
    for (const o of this.battle.units.neighbors(u.x, u.y, u.radius + 16)) {
      if (o.owner !== foe || o.def.armor !== 'light' || o.squad.embarked || !o.alive) continue;
      const d = Math.hypot(o.x - u.x, o.y - u.y);
      const min = u.radius + o.radius;
      if (d >= min) continue;
      this.battle.combat.applyDamage(o, (u.def.crush ?? 0) * dt, u.squad);
      if (d > 0.1) {
        const push = (min - d) / d;
        const nx = o.x + (o.x - u.x) * push;
        const ny = o.y + (o.y - u.y) * push;
        if (this.battle.map.isPassableWorld(nx, ny)) {
          o.x = nx;
          o.y = ny;
        }
      }
    }
  }

  // ---- Transports ------------------------------------------------------------

  canBoard(s: Squad, t: Squad): boolean {
    return t.alive && t.owner === s.owner && !!t.def.transport && t.cargo.length < (t.def.transport ?? 0)
      && s.def.category === 'infantry' && !s.embarked && s !== t;
  }

  private boarding(s: Squad): void {
    const t = s.boardTarget;
    if (!t || !this.canBoard(s, t)) {
      s.boardTarget = null;
      return;
    }
    const d = Phaser.Math.Distance.Between(s.center.x, s.center.y, t.center.x, t.center.y);
    if (d > BOARD_RANGE + t.def.size) {
      // Keep chasing a moving transport.
      if (!s.isMoving()) s.pathTo(t.center.x, t.center.y);
      return;
    }
    this.embark(s, t);
  }

  embark(s: Squad, t: Squad): void {
    s.boardTarget = null;
    s.carrier = t;
    t.cargo.push(s);
    s.path = [];
    s.waypoints = [];
    s.target = null;
    s.order = 'idle';
    s.setSelected(false);
    for (const u of s.units) u.setEmbarked(true);
    this.battle.selection.prune();
    this.battle.events.emit(EV.transportChanged, t);
  }

  /** Lets every passenger out around the transport; `wrecked` = the transport was destroyed. */
  unload(t: Squad, wrecked = false): void {
    const c = t.units[0] ?? { x: t.x, y: t.y };
    const out = t.cargo.splice(0);
    out.forEach((s, i) => {
      s.carrier = null;
      const a = (i / Math.max(1, out.length)) * Math.PI * 2 + Math.PI / 2;
      const p = this.battle.units.findOpenSpot(c.x + Math.cos(a) * 50, c.y + Math.sin(a) * 50);
      s.x = p.x;
      s.y = p.y;
      s.guard = { x: p.x, y: p.y };
      s.units.forEach((u, j) => {
        u.x = p.x + (j % 3) * 14 - 14;
        u.y = p.y + Math.floor(j / 3) * 14;
        u.setEmbarked(false);
      });
      if (wrecked) for (const u of s.units.slice()) this.battle.combat.applyDamage(u, u.maxHp * 0.3, null);
    });
    this.battle.events.emit(EV.transportChanged, t);
  }

  /** Passengers ride along (positions follow the hull) and Iron Void transports patch them up. */
  private carry(t: Squad, dt: number): void {
    const c = t.units[0];
    if (!c) return;
    const heal = t.def.faction === 'ironvoid' ? 0.02 : 0.01;
    for (const s of t.cargo) {
      s.x = c.x;
      s.y = c.y;
      for (const u of s.units) {
        u.x = c.x;
        u.y = c.y;
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * heal * dt);
      }
    }
  }

  // ---- Visuals ---------------------------------------------------------------

  private effects(u: Unit, dt: number): void {
    let st = this.fxT.get(u);
    if (!st) {
      st = { puff: 0, track: 0, lx: u.x, ly: u.y };
      this.fxT.set(u, st);
    }
    const moving = Math.hypot(u.vx, u.vy) > 15;
    if (!u.isShown || !moving) {
      st.lx = u.x;
      st.ly = u.y;
      return;
    }
    const fx = this.battle.effects;
    const back = u.angle + Math.PI;
    st.puff -= dt;
    if (st.puff <= 0) {
      st.puff = u.def.faction === 'ironvoid' ? 0.14 : 0.3;
      const bx = u.x + Math.cos(back) * u.radius * 0.9;
      const by = Projection.vy(u.y + Math.sin(back) * u.radius * 0.9);
      if (u.def.faction === 'ironvoid') fx.exhaust(bx, by - u.height * 0.35);
      else if (!u.def.flying) fx.dust(bx, by);
    }
    if (TRACKED.has(u.def.id)) {
      const d = Math.hypot(u.x - st.lx, u.y - st.ly);
      if (d >= 18) {
        fx.trackMark(u.x, u.y, u.angle, u.def.id === 'buggy' ? 0.7 : u.def.id === 'tank' ? 1.25 : 1);
        st.lx = u.x;
        st.ly = u.y;
      }
    }
  }
}
