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

export type Victim = Unit | Building;
type ProjKind = 'bullet' | 'shell' | 'spit' | 'melee' | 'spine';

/** Weapon fire for squads and turrets: target selection, projectiles, damage application. */
export class CombatSystem {

  constructor(private battle: BattleScene) {}

  update(dt: number): void {
    for (const s of this.battle.units.squads) {
      if (!s.alive || s.order === 'move' || s.order === 'retreat') continue;
      const t = s.engaged;
      if (!t) {
        for (const u of s.units) u.cooldown = Math.max(0, u.cooldown - dt);
        continue;
      }
      for (const u of s.units) {
        u.cooldown -= dt;
        if (u.cooldown > 0) continue;
        const victim = isSquad(t) ? this.nearestUnit(t, u.x, u.y) : t;
        if (!victim) continue;
        const reach = u.def.range + victim.radius;
        if (Phaser.Math.Distance.Between(u.x, u.y, victim.x, victim.y) > reach) continue;
        u.cooldown = u.def.cooldown * Phaser.Math.FloatBetween(0.85, 1.15);
        const dmg = u.def.damage * this.battle.modifiers[u.owner].damageMult;
        u.face(victim.x, victim.y);
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
      const victim = this.nearestEnemyUnit(b.owner, b.x, b.y, atk.range);
      if (!victim) continue;
      b.attackCooldown = atk.cooldown;
      b.aimAt(victim.x, victim.y);
      const dmg = atk.damage * this.battle.modifiers[b.owner].turretDamageMult;
      this.fire(b.x, b.y, b.owner, victim, dmg, b.def.faction === 'ironvoid' ? 'bullet' : 'spine', null, b.gunTip, atk.damageType);
    }
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

  nearestEnemyUnit(owner: Owner, x: number, y: number, range: number): Unit | null {
    const enemy = opponent(owner);
    let best: Unit | null = null;
    let bestD = range;
    for (const s of this.battle.units.squads) {
      if (s.owner !== enemy || !s.alive) continue;
      for (const u of s.units) {
        const d = Phaser.Math.Distance.Between(x, y, u.x, u.y);
        if (d < bestD) {
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
    muzzle: { x: number; y: number }, type: DamageType): void {
    dmg *= damageMult(type, victim instanceof Building ? 'building' : victim.def.armor);
    const aim = victim instanceof Building ? victim.view.aimPoint() : victim.aimPoint();
    const los = this.battle.cover?.hasLineOfSight(x, y, victim.x, victim.y) ?? true;
    this.battle.events.emit(EV.unitFired, x, y, kind, owner);
    if (kind === 'melee') {
      const fx = this.battle.add.image(aim.x, aim.y, 'fx_slash').setDepth(DEPTH.effects);
      fx.rotation = Phaser.Math.Angle.Between(muzzle.x, muzzle.y, aim.x, aim.y);
      this.battle.tweens.add({ targets: fx, alpha: 0, scale: 1.6, duration: 220, onComplete: () => fx.destroy() });
      this.applyDamage(victim, dmg, from);
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
    this.battle.effects.projectiles.launch(kind, muzzle, { x: tx, y: ty }, () => {
      if (blocked) this.battle.effects.dust(tx, ty);
      else this.applyDamage(victim, dmg, from);
    });
  }

  applyDamage(victim: Victim, dmg: number, from: Squad | null): void {
    if (!victim.alive) return;
    if (victim instanceof Building) {
      this.battle.buildings.damage(victim, dmg);
      return;
    }
    const mult = (this.battle.cover?.damageMultiplier(victim) ?? 1) * (victim.squad.retreating ? 0.6 : 1);
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
