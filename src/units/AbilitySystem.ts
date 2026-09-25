import Phaser from 'phaser';
import { EV } from '../events';
import { Owner, opponent } from '../types';
import { Projection } from '../render/Projection';
import { Building } from '../buildings/Building';
import { ABILITIES, AbilityDef, AbilityId } from './Abilities';
import { Squad } from './Squad';
import type { MessageKey } from '../i18n';
import type { BattleScene } from '../scenes/BattleScene';

interface Zone {
  kind: 'smoke' | 'acid';
  x: number;
  y: number;
  r: number;
  until: number;
  owner: Owner;
  from: Squad | null;
}

interface Strike {
  at: number;
  x: number;
  y: number;
  owner: Owner;
  from: Squad | null;
}

const AI_TICK = 1;

/**
 * Active abilities: validation, cooldowns, walking into range, the effects themselves
 * (grenades, smoke, clouds, barrages, buffs, spawns) and a simple autocast for the AI.
 */
export class AbilitySystem {
  readonly zones: Zone[] = [];
  private strikes: Strike[] = [];
  private tick = 0;
  private aiTimer = 0;

  constructor(private battle: BattleScene) {}

  def(id: AbilityId): AbilityDef {
    return ABILITIES[id];
  }

  /** Seconds left on a squad's cooldown (0 = ready). */
  cooldownLeft(s: Squad, id: AbilityId): number {
    return Math.max(0, (s.cooldowns.get(id) ?? 0) - this.battle.elapsed);
  }

  /** Localised lock text (missing building), or null. */
  lockReason(owner: Owner, id: AbilityId): string | null {
    const req = ABILITIES[id].requires;
    return req ? this.battle.tech.lockReason(owner, 1, req) : null;
  }

  /** Why the squad cannot cast right now (null = it can). */
  check(s: Squad, id: AbilityId): MessageKey | null {
    const d = ABILITIES[id];
    if (!s.alive || s.embarked) return 'err.cannotCast';
    if (this.lockReason(s.owner, id)) return 'err.requires';
    if (this.cooldownLeft(s, id) > 0) return 'err.cooldown';
    if (s.buffActive('stun') || s.broken) return 'err.cannotCast';
    if (d.cost && !this.battle.resources.canAfford(s.owner, d.cost)) return 'err.resources';
    return null;
  }

  /** Casts `id` (the target is ignored for untargeted abilities). Walks into range first if needed. */
  cast(s: Squad, id: AbilityId, x = s.center.x, y = s.center.y, target: Squad | Building | null = null): boolean {
    const err = this.check(s, id);
    if (err) {
      if (s.owner === 'player') this.battle.events.emit(EV.message, err);
      return false;
    }
    const d = ABILITIES[id];
    if (d.targeting !== 'none' && d.range > 0) {
      const tp = target ? (target instanceof Squad ? target.center : { x: target.x, y: target.y }) : { x, y };
      if (Phaser.Math.Distance.Between(s.center.x, s.center.y, tp.x, tp.y) > d.range) {
        s.moveTo(tp.x, tp.y);
        s.pendingCast = { id, x: tp.x, y: tp.y, target };
        return true;
      }
    }
    return this.execute(s, id, x, y, target);
  }

  private execute(s: Squad, id: AbilityId, x: number, y: number, target: Squad | Building | null): boolean {
    const d = ABILITIES[id];
    const b = this.battle;
    const now = b.elapsed;
    const heroCd = s.def.isHero ? 1 - Math.min(0.45, s.rank * 0.15) : 1;
    const relicCd = s.def.isHero ? b.modifiers[s.owner].heroCooldownMult : b.modifiers[s.owner].abilityCooldownMult;
    if (d.cost) b.resources.spend(s.owner, d.cost);
    s.cooldowns.set(id, now + d.cooldown * heroCd * relicCd);
    s.pendingCast = null;
    const c = s.center;
    const fx = b.effects;
    switch (id) {
      case 'frag': {
        for (const u of s.units.slice(0, 2)) u.playAttack();
        fx.projectiles.launch('lob', { x: c.x, y: Projection.vy(c.y) - 20 }, { x, y: Projection.vy(y) }, () => {
          b.combat.splashAt(x, y, d.radius ?? 60, d.damage ?? 50, s.owner, s, 'explosive');
          b.morale.suppressArea(x, y, d.radius ?? 60, 60, s.owner);
          b.world.explodeProps(x, y, d.radius ?? 60);
        });
        break;
      }
      case 'sprint':
      case 'frenzy': {
        s.buffs[id] = now + (d.duration ?? 6);
        if (id === 'frenzy') for (const u of s.units) u.hp = Math.max(1, u.hp - u.maxHp * 0.1);
        break;
      }
      case 'smoke': {
        this.zones.push({ kind: 'smoke', x, y, r: d.radius ?? 100, until: now + (d.duration ?? 15), owner: s.owner, from: s });
        fx.projectiles.launch('lob', { x: c.x, y: Projection.vy(c.y) - 20 }, { x, y: Projection.vy(y) }, () => {
          fx.smokeCloud(x, y, d.radius ?? 100, d.duration ?? 15);
        });
        break;
      }
      case 'acidcloud': {
        fx.projectiles.launch('acidlob', { x: c.x, y: Projection.vy(c.y) - 20 }, { x, y: Projection.vy(y) }, () => {
          this.zones.push({ kind: 'acid', x, y, r: d.radius ?? 90, until: b.elapsed + (d.duration ?? 8), owner: s.owner, from: s });
          fx.acidCloud(x, y, d.radius ?? 90, d.duration ?? 8);
        });
        break;
      }
      case 'overcharge': {
        const bld = target instanceof Building ? target : null;
        if (!bld || bld.owner !== s.owner) return false;
        // Conduits and turrets are overcharged; anything else gets an emergency weld (+300 HP).
        if (b.structures.canOvercharge(bld)) b.structures.overcharge(bld);
        else {
          bld.heal(300);
          fx.sparks(bld.x, Projection.vy(bld.y) - bld.def.height * 0.5);
        }
        break;
      }
      case 'smite': {
        const t = target instanceof Squad ? target : null;
        const v = t && b.combat.weakestUnit(t);
        if (!t || !v) return false;
        const u = s.units[0];
        if (u) {
          u.aim(v.x, v.y);
          u.playAttack();
        }
        fx.projectiles.launch('sniper', u ? u.aimPoint() : { x: c.x, y: Projection.vy(c.y) }, v.aimPoint(), () => {
          b.combat.applyDamage(v, d.damage ?? 150, s, 'bullet');
          b.morale.suppress(t, 50);
        });
        break;
      }
      case 'rally': {
        for (const o of b.units.squads) {
          if (o.owner !== s.owner || !o.alive || Phaser.Math.Distance.Between(o.center.x, o.center.y, c.x, c.y) > (d.radius ?? 300)) continue;
          o.buffs.rally = now + (d.duration ?? 12);
          o.suppression = 0;
          o.morale = Math.min(100, o.morale + 50);
          if (o.broken) b.morale.recover(o);
        }
        fx.pulseRing(c.x, c.y, d.radius ?? 300, 0xffd070);
        break;
      }
      case 'barrage': {
        fx.targetMarker(x, y, d.radius ?? 140, 3);
        for (let i = 0; i < 8; i++) this.strikes.push({ at: now + 3 + i * 0.35, x, y, owner: s.owner, from: s });
        break;
      }
      case 'pounce': {
        const t = target instanceof Squad ? target : null;
        if (!t) return false;
        s.target = t;
        b.support.leapAt(s, t);
        break;
      }
      case 'burrow': {
        b.support.toggleBurrow(s);
        break;
      }
      case 'regenerate': {
        for (const o of b.units.squads) {
          if (o.owner !== s.owner || !o.alive || Phaser.Math.Distance.Between(o.center.x, o.center.y, c.x, c.y) > (d.radius ?? 220)) continue;
          o.buffs.regen = now + (d.duration ?? 5);
        }
        fx.pulseRing(c.x, c.y, d.radius ?? 220, 0x90ff60);
        break;
      }
      case 'scream': {
        const foe = opponent(s.owner);
        for (const o of b.units.squads) {
          if (o.owner !== foe || !o.alive || o.embarked) continue;
          if (Phaser.Math.Distance.Between(o.center.x, o.center.y, c.x, c.y) > (d.radius ?? 260)) continue;
          o.buffs.stun = now + (d.duration ?? 2.5);
          b.morale.suppress(o, 70);
        }
        fx.pulseRing(c.x, c.y, d.radius ?? 260, 0xd060ff);
        break;
      }
      case 'spawnbrood': {
        const sq = b.units.spawnSquad('crawler', s.owner, c.x + 40, c.y + 40, 5);
        sq.moveTo(c.x + 60, c.y + 60, true);
        fx.pulseRing(c.x, c.y, 120, 0xd060ff);
        break;
      }
    }
    b.events.emit(EV.abilityUsed, s, id);
    return true;
  }

  /** Smoke clouds between two logical points block line of sight. */
  smokeBlocks(x0: number, y0: number, x1: number, y1: number): { x: number; y: number } | null {
    for (const z of this.zones) {
      if (z.kind !== 'smoke' || z.until <= this.battle.elapsed) continue;
      // Closest point of the segment to the cloud centre.
      const dx = x1 - x0;
      const dy = y1 - y0;
      const L = dx * dx + dy * dy || 1;
      const t = Phaser.Math.Clamp(((z.x - x0) * dx + (z.y - y0) * dy) / L, 0, 1);
      const px = x0 + dx * t;
      const py = y0 + dy * t;
      // Shooters standing inside the cloud can still fire out of it at point-blank targets.
      if (Math.hypot(px - z.x, py - z.y) < z.r && Math.hypot(x0 - z.x, y0 - z.y) > z.r * 0.6) return { x: px, y: py };
    }
    return null;
  }

  update(dt: number): void {
    const b = this.battle;
    const now = b.elapsed;
    for (const s of b.units.squads) {
      const pc = s.pendingCast;
      if (!pc || !s.alive) continue;
      const d = ABILITIES[pc.id as AbilityId];
      const tp = pc.target ? (pc.target instanceof Squad ? pc.target.center : { x: pc.target.x, y: pc.target.y }) : pc;
      if (pc.target && !pc.target.alive) {
        s.pendingCast = null;
        continue;
      }
      if (Phaser.Math.Distance.Between(s.center.x, s.center.y, tp.x, tp.y) <= d.range) {
        s.stop();
        this.execute(s, pc.id as AbilityId, tp.x, tp.y, pc.target);
      } else if (s.order !== 'move') {
        s.pendingCast = null;
      }
    }
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const st = this.strikes[i];
      if (now < st.at) continue;
      this.strikes.splice(i, 1);
      const r = ABILITIES.barrage.radius ?? 140;
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r;
      const x = st.x + Math.cos(a) * d;
      const y = st.y + Math.sin(a) * d;
      b.effects.projectiles.launch('lob', { x: x - 60, y: Projection.vy(y) - 700 }, { x, y: Projection.vy(y) }, () => {
        b.combat.splashAt(x, y, 70, ABILITIES.barrage.damage ?? 90, st.owner, st.from, 'explosive');
        b.morale.suppressArea(x, y, 90, 40, st.owner);
        b.world.explodeProps(x, y, 70);
      });
    }
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.5;
      this.zoneTick(0.5);
      for (const s of b.units.squads) {
        if (!s.buffActive('regen')) continue;
        for (const u of s.units) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.08 * 0.5);
      }
    }
    for (let i = this.zones.length - 1; i >= 0; i--) if (this.zones[i].until <= now) this.zones.splice(i, 1);
    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.aiTimer = AI_TICK;
      for (const o of ['player', 'enemy'] as Owner[]) if (b.aiOwners.includes(o)) this.autocast(o);
    }
  }

  private zoneTick(dt: number): void {
    for (const z of this.zones) {
      if (z.kind !== 'acid') continue;
      const foe = opponent(z.owner);
      for (const s of this.battle.units.squads) {
        if (s.owner !== foe || !s.alive || s.embarked || s.def.flying) continue;
        for (const u of s.units.slice()) {
          if (Math.hypot(u.x - z.x, u.y - z.y) <= z.r) this.battle.combat.applyDamage(u, (ABILITIES.acidcloud.damage ?? 12) * dt, z.from, 'acid');
        }
      }
    }
  }

  // ---- AI autocast ------------------------------------------------------------

  /** Simple heuristics: area abilities on clusters, buffs in melee, heals when hurt. */
  private autocast(owner: Owner): void {
    const b = this.battle;
    const foe = opponent(owner);
    const enemies = b.units.squads.filter((s) => s.owner === foe && s.alive && !s.hiddenFrom(owner));
    for (const s of b.units.getSquads(owner)) {
      for (const id of s.def.abilities ?? []) {
        if (this.check(s, id)) continue;
        const d = ABILITIES[id];
        const c = s.center;
        const near = (r: number): Squad[] => enemies.filter((e) => Phaser.Math.Distance.Between(e.center.x, e.center.y, c.x, c.y) <= r);
        const t = s.engaged;
        switch (id) {
          case 'frag':
          case 'acidcloud':
          case 'smoke': {
            const list = near(d.range);
            if (!list.length || !t) break;
            const e = list.sort((p, q) => q.units.length - p.units.length)[0];
            if (id === 'smoke' && s.hp > s.maxHp * 0.6) break;
            this.execute(s, id, e.center.x, e.center.y, null);
            break;
          }
          case 'barrage': {
            const e = enemies.filter((q) => q.units.length >= 3 && b.fogVisibleFor(owner, q.center.x, q.center.y))
              .sort((p, q) => q.units.length - p.units.length)[0];
            if (e) this.execute(s, id, e.center.x, e.center.y, null);
            break;
          }
          case 'sprint':
          case 'frenzy':
          case 'rally':
            if (t && near(300).length) this.execute(s, id, c.x, c.y, null);
            break;
          case 'smite': {
            const e = near(d.range).sort((p, q) => Number(!!q.def.isHero) - Number(!!p.def.isHero))[0];
            if (e) this.execute(s, id, 0, 0, e);
            break;
          }
          case 'pounce': {
            const e = near(d.range).find((q) => !q.def.flying);
            if (e && Phaser.Math.Distance.Between(e.center.x, e.center.y, c.x, c.y) > s.range + 40) this.execute(s, id, 0, 0, e);
            break;
          }
          case 'regenerate':
            if (b.units.squads.some((o) => o.owner === owner && o.alive && o.hp < o.maxHp * 0.6
              && Phaser.Math.Distance.Between(o.center.x, o.center.y, c.x, c.y) < (d.radius ?? 200))) this.execute(s, id, c.x, c.y, null);
            break;
          case 'scream':
            if (near(d.radius ?? 260).length >= 2) this.execute(s, id, c.x, c.y, null);
            break;
          case 'spawnbrood':
            if (t) this.execute(s, id, c.x, c.y, null);
            break;
          default:
            break;
        }
      }
    }
  }
}
