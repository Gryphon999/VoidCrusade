import Phaser from 'phaser';
import { EV } from '../events';
import { Owner } from '../types';
import { Projection } from '../render/Projection';
import { Building } from '../buildings/Building';
import { UNIT_DEFS, UnitId } from '../units/UnitDefs';
import { Resources } from './ResourceSystem';
import type { MessageKey } from '../i18n';
import type { BattleScene } from '../scenes/BattleScene';

/** Squads the Orbital Beacon / Hive Portal can drop. */
export const DROPPABLE: Record<'ironvoid' | 'nullhorde', UnitId[]> = {
  ironvoid: ['rifleman', 'breacher', 'heavy'],
  nullhorde: ['crawler', 'leaper', 'burrower'],
};
export const DROP = { warning: 3, cooldown: 45, extraFlux: 50, blastRadius: 70, blastDamage: 60 };

/**
 * Reinforcement drops: pick a squad at the Orbital Beacon (drop pod) or Hive Portal (brood rift),
 * target a visible spot; a warning marker appears, then the squad lands with a small blast.
 */
export class DropSystem {
  constructor(private battle: BattleScene) {}

  cost(id: UnitId): Resources {
    const c = UNIT_DEFS[id].cost;
    return { scrip: c.scrip, flux: c.flux + DROP.extraFlux };
  }

  check(b: Building, id: UnitId): MessageKey | null {
    const bt = this.battle;
    if (!b.isReady || b.def.role !== 'beacon') return 'err.notReady';
    if (bt.elapsed < b.dropReady) return 'err.cooldown';
    if (bt.production.lockReason(b, id)) return 'err.requires';
    if (bt.production.supplyUsed(b.owner) + UNIT_DEFS[id].supply > bt.units.supplyCap(b.owner)) return 'err.supply';
    if (!bt.resources.canAfford(b.owner, this.cost(id))) return 'err.resources';
    return null;
  }

  /** Orders a drop at a logical point; returns false (with a message) if not possible. */
  order(b: Building, id: UnitId, x: number, y: number): boolean {
    const bt = this.battle;
    let err = this.check(b, id);
    if (!err && !bt.map.isPassableWorld(x, y)) err = 'err.blocked';
    if (!err && !bt.fogVisibleFor(b.owner, x, y)) err = 'err.notVisible';
    if (err) {
      if (b.owner === 'player') bt.events.emit(EV.message, err);
      return false;
    }
    bt.resources.spend(b.owner, this.cost(id));
    b.dropReady = bt.elapsed + DROP.cooldown;
    const horde = b.def.faction === 'nullhorde';
    bt.effects.targetMarker(x, y, 60, DROP.warning, horde ? 0xd060ff : 0x60c0ff);
    bt.events.emit(EV.dropIncoming, b.owner, x, y);
    bt.time.delayedCall(DROP.warning * 1000, () => this.land(b.owner, id, x, y, horde));
    return true;
  }

  private land(owner: Owner, id: UnitId, x: number, y: number, horde: boolean): void {
    const bt = this.battle;
    if (bt.ended) return;
    const vy = Projection.vy(y);
    const fx = bt.effects;
    const arrive = (): void => {
      bt.combat.splashAt(x, y, DROP.blastRadius, DROP.blastDamage, owner, null, horde ? 'acid' : 'explosive');
      if (horde) {
        fx.pulseRing(x, y, 120, 0xd060ff);
        fx.projectiles.burst(x, vy);
      } else {
        fx.explosions.blast(x, vy, 1.3);
        fx.blood.scorch(x, y, 50);
        fx.lights.flash(x, vy, 200, 0x9ad0ff, 500, 1);
      }
      const s = bt.units.spawnSquad(id, owner, x, y);
      s.guard = { x: s.x, y: s.y };
      for (const u of s.units) {
        u.sprite.setAlpha(0);
        bt.tweens.add({ targets: u.sprite, alpha: 1, duration: 300 });
      }
    };
    if (horde) arrive();
    else fx.projectiles.launch('cannon', { x: x + 90, y: vy - 900 }, { x, y: vy }, arrive);
  }

  /** Where drops can go for `owner` right now (for the AI). */
  static canTarget(bt: BattleScene, owner: Owner, x: number, y: number): boolean {
    return bt.map.isPassableWorld(x, y) && bt.fogVisibleFor(owner, x, y)
      && Phaser.Math.Distance.Between(x, y, bt.map.worldWidth / 2, bt.map.worldHeight / 2) >= 0;
  }
}
