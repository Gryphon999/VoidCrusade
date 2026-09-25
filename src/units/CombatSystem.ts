import Phaser from 'phaser';
import { DEPTH } from '../config';
import { EV } from '../events';
import { Owner, opponent } from '../types';
import { Unit } from './Unit';
import { Squad, isSquad } from './Squad';
import { Building } from '../buildings/Building';
import type { BattleScene } from '../scenes/BattleScene';
import { Projection } from '../render/Projection';
import { DamageType, damageMult } from './Damage';
import { ProjectileLook } from './UnitDefs';

export type Victim = Unit | Building;
type ProjKind = ProjectileLook | 'spine' | 'rocket';

/** Weapon fire for squads and turrets: target selection, projectiles, damage application. */
export class CombatSystem {

  constructor(private battle: BattleScene) {}

  update(dt: number): void {
    for (const s of this.battle.units.squads) {
      if (!s.alive || s.order === 'move' || s.order === 'retreat' || s.carrier) continue;
      const t = s.engaged;
      // Artillery only fires once deployed.
      const armed = !s.def.deploy || s.deployState === 'deployed';
      if (!t || s.burrowed || !armed || (isSquad(t) && t.hiddenFrom(s.owner))) {
        for (const u of s.units) u.cooldown = Math.max(0, u.cooldown - dt);
        if (t && isSquad(t) && t.hiddenFrom(s.owner)) s.target = null;
        continue;
      }
      for (const u of s.units) {
        u.cooldown -= dt;
        if (u.cooldown > 0 || u.leapArc) continue;
        const victim = isSquad(t) ? (u.def.precision ? this.weakestUnit(t) : this.nearestUnit(t, u.x, u.y)) : t;
        if (!victim) continue;
        const reach = s.range + victim.radius;
        const dist = Phaser.Math.Distance.Between(u.x, u.y, victim.x, victim.y);
        if (dist > reach || (u.def.minRange && dist < u.def.minRange)) continue;
        u.cooldown = u.def.cooldown * Phaser.Math.FloatBetween(0.85, 1.15);
        let dmg = u.def.damage * this.battle.modifiers[u.owner].damageMult * u.strikeMult;
        u.strikeMult = 1;
        if (u.def.precision && dist < u.def.precision.closeRange) dmg *= 0.5;
        u.aim(victim.x, victim.y);
        u.playAttack();
        this.fire(u.x, u.y, u.owner, victim, dmg, u.def.projectile, u.squad, u.aimPoint(), u.def.damageType);
      }
    }
    this.updateTurrets(dt);
  }

  private updateTurrets(dt: number): void {
    for (const b of this.battle.buildings.buildings) {
      const atk = b.def.attack;
      if (!atk || !b.isReady) continue;
      b.attackCooldown -= dt;
      if (b.attackCooldown > 0) continue;
      const victim = this.nearestEnemyUnit(b.owner, b.x, b.y, atk.range, atk.minRange ?? 0);
      if (!victim) continue;
      b.attackCooldown = atk.cooldown;
      b.aimAt(victim.x, victim.y);
      const dmg = atk.damage * this.battle.modifiers[b.owner].turretDamageMult;
      const look = atk.projectile ?? (b.def.faction === 'ironvoid' ? 'bullet' : 'spine');
      this.fire(b.x, b.y, b.owner, victim, dmg, look, null, b.gunTip, atk.damageType,
        { splash: atk.splash, indirect: look === 'rocket' || look === 'acidlob' });
    }
  }

  /** Precision targeting: the lowest-HP soldier (heroes are single-soldier squads, so they are always picked). */
  weakestUnit(s: Squad): Unit | null {
    let best: Unit | null = null;
    for (const u of s.units) if (!best || u.hp < best.hp) best = u;
    return best;
  }

  nearestUnit(s: Squad, x: number, y: number): Unit | null {
    let best: Unit | null = null;
    let bestD = Infinity;
    for (const u of s.units) {
      const d = (u.x - x) ** 2 + (u.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best;
  }

  nearestEnemyUnit(owner: Owner, x: number, y: number, range: number, minRange = 0): Unit | null {
    const enemy = opponent(owner);
    let best: Unit | null = null;
    let bestD = range;
    for (const s of this.battle.units.squads) {
      if (s.owner !== enemy || !s.alive || s.hiddenFrom(owner)) continue;
      for (const u of s.units) {
        const d = Phaser.Math.Distance.Between(x, y, u.x, u.y);
        if (d < bestD && d >= minRange) {
          bestD = d;
          best = u;
        }
      }
    }
    return best;
  }

  /**
   * Launches an attack from logical point (x, y). Projectiles fly in view space from `muzzle`
   * to the victim's body and deal damage on impact.
   */
  fire(x: number, y: number, owner: Owner, victim: Victim, dmg: number, kind: ProjKind, from: Squad | null,
    muzzle: { x: number; y: number }, type: DamageType, opts: { splash?: number; indirect?: boolean } = {}): void {
    const aim = victim instanceof Building ? victim.view.aimPoint() : victim.aimPoint();
    const lobbed = opts.indirect || (!!from && (!!from.def.indirect || !!from.def.flying || !!from.garrisonIn));
    const los = lobbed || (this.battle.cover?.hasLineOfSight(x, y, victim.x, victim.y) ?? true);
    const splash = opts.splash ?? from?.def.splash ?? 0;
    const gx = victim.x;
    const gy = victim.y;
    this.battle.events.emit(EV.unitFired, x, y, kind, owner);
    if (kind === 'melee') {
      const fx = this.battle.add.image(aim.x, aim.y, 'fx_slash').setDepth(DEPTH.effects);
      fx.rotation = Phaser.Math.Angle.Between(muzzle.x, muzzle.y, aim.x, aim.y);
      this.battle.tweens.add({ targets: fx, alpha: 0, scale: 1.6, duration: 220, onComplete: () => fx.destroy() });
      this.applyDamage(victim, dmg, from, type);
      if (splash) this.splash(gx, gy, splash, dmg * 0.5, owner, from, type, victim);
      return;
    }
    this.battle.effects.muzzle(muzzle.x, muzzle.y, kind, aim.x - muzzle.x);
    let tx = aim.x + Phaser.Math.Between(-4, 4);
    let ty = aim.y + Phaser.Math.Between(-4, 4);
    let blocked = false;
    if (!los) {
      // The shot smacks into the cliff at a point along the line.
      const p = this.battle.cover?.blockPoint(x, y, victim.x, victim.y);
      if (p) {
        tx = p.x;
        ty = Projection.vy(p.y) - 12;
        blocked = true;
      }
    }
    // Indirect shells land where the target stood.
    if (lobbed && (opts.indirect || from?.def.indirect)) {
      tx = gx + Phaser.Math.Between(-10, 10);
      ty = Projection.vy(gy);
    }
    this.battle.effects.projectiles.launch(kind, muzzle, { x: tx, y: ty }, () => {
      if (blocked) {
        this.battle.effects.dust(tx, ty);
        return;
      }
      // Void shields swallow ranged shots aimed at anything under the dome.
      if (this.battle.structures.shielded(gx, gy, opponent(owner))) {
        this.battle.effects.shieldHit(tx, ty);
        return;
      }
      this.applyDamage(victim, dmg, from, type);
      if (splash) this.splash(gx, gy, splash, dmg * 0.5, owner, from, type, victim);
    });
  }

  /** Area damage with no primary victim (mines, drop impacts). */
  splashAt(x: number, y: number, r: number, dmg: number, owner: Owner, from: Squad | null, type: DamageType): void {
    this.splash(x, y, r, dmg, owner, from, type, null);
  }

  /** Area damage around a logical point (half damage at the rim). */
  private splash(x: number, y: number, r: number, dmg: number, owner: Owner, from: Squad | null, type: DamageType, skip: Victim | null): void {
    const foe = opponent(owner);
    for (const s of this.battle.units.squads) {
      if (!s.alive || s.owner !== foe || s.embarked) continue;
      for (const u of s.units.slice()) {
        if (u === skip) continue;
        const d = Phaser.Math.Distance.Between(x, y, u.x, u.y);
        if (d <= r) this.applyDamage(u, dmg * (1 - (d / r) * 0.5), from, type);
      }
    }
    for (const b of this.battle.buildings.buildings) {
      if (b === skip || !b.alive || b.owner !== foe) continue;
      if (Phaser.Math.Distance.Between(x, y, b.x, b.y) <= r + b.radius) this.applyDamage(b, dmg * 0.5, from, type);
    }
  }

  applyDamage(victim: Victim, dmg: number, from: Squad | null, type?: DamageType): void {
    if (!victim.alive) return;
    if (type) dmg *= damageMult(type, victim instanceof Building ? 'building' : victim.def.armor);
    if (victim instanceof Building) {
      if (type === 'flame' && victim.garrison.length) this.battle.structures.burnGarrison(victim, dmg, from);
      this.battle.buildings.damage(victim, dmg);
      return;
    }
    const cover = from?.def.ignoresCover ? 1 : this.battle.cover?.damageMultiplier(victim) ?? 1;
    const armour = victim.def.category === 'infantry' ? this.battle.modifiers[victim.owner].infantryArmorMult : 1;
    const mult = cover * armour * (victim.squad.retreating ? 0.6 : 1);
    const killed = victim.takeDamage(dmg * mult);
    const squad = victim.squad;
    if (from && from.alive && squad.alive && !squad.engaged && squad.order !== 'move') squad.target = from;
    if (killed) {
      this.battle.events.emit(EV.unitDied, victim.x, victim.y, victim);
      squad.removeUnit(victim);
    } else {
      const dir = from ? Math.atan2(victim.y - from.center.y, victim.x - from.center.x) : Math.random() * Math.PI * 2;
      this.battle.events.emit(EV.unitHit, victim.x, victim.y, victim, dir);
    }
  }
}
