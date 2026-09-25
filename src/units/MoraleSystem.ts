import Phaser from 'phaser';
import { EV } from '../events';
import { Owner } from '../types';
import { Squad } from './Squad';
import { Unit } from './Unit';
import type { DamageType } from './Damage';
import type { BattleScene } from '../scenes/BattleScene';

/** XP needed for ranks 1..3. */
export const RANK_XP = [120, 320, 700];
const BREAK_AT = 20;
const RECOVER_AT = 70;

/**
 * Suppression, morale and veterancy.
 * - Sustained ranged fire suppresses Iron Void infantry (slower, weaker, pinned above 85).
 * - Casualties and pinning drain morale; below 20 the squad breaks and falls back, then returns when recovered.
 *   Heroes (and the banner relic) restore morale nearby.
 * - The Null Horde is fearless, but loses its synapse (takes +25% damage) when the Overlord or a Shaman dies.
 * - Kills give XP; three ranks add damage and toughness (heroes also shorten their cooldowns).
 */
export class MoraleSystem {
  constructor(private battle: BattleScene) {
    battle.events.on(EV.unitDied, (_x: number, _y: number, u: Unit, killer?: Squad | null) => this.onDeath(u, killer ?? null));
  }

  /** Only Iron Void rank-and-file infantry feel fear. */
  subject(s: Squad): boolean {
    return s.def.faction === 'ironvoid' && s.def.category === 'infantry';
  }

  /** Adds suppression (halved in cover). */
  suppress(s: Squad, amount: number): void {
    if (!this.subject(s) || !s.alive || s.embarked) return;
    const inCover = s.units.some((u) => u.inCover);
    s.suppression = Math.min(100, s.suppression + amount * (inCover ? 0.5 : 1));
    s.lastSuppressedAt = this.battle.elapsed;
  }

  /** Suppresses every enemy squad around a blast. */
  suppressArea(x: number, y: number, r: number, amount: number, byOwner: Owner): void {
    for (const s of this.battle.units.squads) {
      if (s.owner === byOwner || !s.alive) continue;
      if (Phaser.Math.Distance.Between(s.center.x, s.center.y, x, y) <= r + 30) this.suppress(s, amount);
    }
  }

  /** A hit landed: ranged fire suppresses in proportion to the damage dealt. */
  onHit(u: Unit, dmg: number, type: DamageType | undefined): void {
    if (!type || type === 'melee' || type === 'acid') return;
    this.suppress(u.squad, (dmg / u.maxHp) * (type === 'bullet' ? 38 : 30));
  }

  recover(s: Squad): void {
    s.broken = false;
    s.morale = Math.max(s.morale, RECOVER_AT);
    const p = s.rallyPoint;
    s.rallyPoint = null;
    if (p && s.alive) s.moveTo(p.x, p.y, true);
  }

  private onDeath(u: Unit, killer: Squad | null): void {
    const b = this.battle;
    const s = u.squad;
    // Fear: the squad and its neighbours are shaken.
    if (this.subject(s)) s.morale -= 12;
    for (const o of b.units.squads) {
      if (o === s || o.owner !== s.owner || !this.subject(o)) continue;
      if (Phaser.Math.Distance.Between(o.center.x, o.center.y, u.x, u.y) < 260) o.morale -= 3;
    }
    // Horde synapse breaks when its leaders fall.
    if (u.def.id === 'overlord' || u.def.id === 'shaman') {
      const r = u.def.id === 'overlord' ? Infinity : 320;
      const until = b.elapsed + (u.def.id === 'overlord' ? 30 : 15);
      for (const o of b.units.squads) {
        if (o.owner !== s.owner || !o.alive) continue;
        if (Phaser.Math.Distance.Between(o.center.x, o.center.y, u.x, u.y) <= r) o.buffs.synapse = Math.max(o.buffs.synapse ?? 0, until);
      }
      if (s.owner !== 'player' && u.def.id === 'overlord') b.events.emit(EV.message, 'note.synapse');
    }
    // Veterancy.
    if (killer && killer.alive && killer.owner !== s.owner) {
      const heroBonus = killer.def.isHero ? b.capture.relicHeroXp(killer.owner) : 1;
      this.addXp(killer, (u.def.cost.scrip / Math.max(1, u.def.squadSize) + u.maxHp / 20 + (u.def.isHero ? 60 : 0)) * heroBonus);
    }
  }

  addXp(s: Squad, xp: number): void {
    s.xp += xp;
    while (s.rank < RANK_XP.length && s.xp >= RANK_XP[s.rank]) {
      s.rank++;
      for (const u of s.units) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.2);
      this.battle.events.emit(EV.squadRankUp, s);
    }
  }

  update(dt: number): void {
    const b = this.battle;
    const now = b.elapsed;
    const heroes = b.units.squads.filter((s) => s.alive && s.def.isHero && !s.embarked);
    for (const s of b.units.squads) {
      if (!s.alive) continue;
      if (now - s.lastSuppressedAt > 2) s.suppression = Math.max(0, s.suppression - 16 * dt);
      if (!this.subject(s)) continue;
      // Morale regeneration: slow alone, quick beside a hero or a banner relic.
      let regen = s.suppression > 50 ? 0 : 2;
      for (const h of heroes) {
        if (h.owner !== s.owner) continue;
        const aura = b.modifiers[h.owner].heroMoraleAura ? 460 : 340;
        if (Phaser.Math.Distance.Between(h.center.x, h.center.y, s.center.x, s.center.y) < aura) regen += b.modifiers[h.owner].heroMoraleAura ? 9 : 5;
      }
      if (s.broken) regen += 4;
      if (s.suppression >= 85) regen -= 6;
      s.morale = Phaser.Math.Clamp(s.morale + regen * dt, 0, 100);
      if (!s.broken && s.morale < BREAK_AT) {
        s.broken = true;
        s.rallyPoint = { x: s.center.x, y: s.center.y };
        s.suppression = 0;
        s.retreat();
        b.events.emit(EV.squadBroken, s);
      } else if (s.broken && s.morale >= RECOVER_AT) {
        this.recover(s);
      }
    }
  }
}
