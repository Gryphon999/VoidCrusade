import { EV } from '../events';
import type { MessageKey } from '../i18n';
import { t } from '../i18n';
import { buildingName, roleName } from '../i18n/names';
import { BuildingRole, defForRole } from '../buildings/BuildingDefs';
import { Faction, Tier } from '../units/UnitDefs';
import { Resources } from './ResourceSystem';
import { Owner } from '../types';
import type { BattleScene } from '../scenes/BattleScene';

export interface TierUpgrade {
  to: Tier;
  cost: Resources;
  time: number;
  /** Building roles that must be standing (and complete). */
  requires: BuildingRole[];
}

/** HQ upgrades that unlock the next tech tier. */
export const TIER_UPGRADES: Record<2 | 3, TierUpgrade> = {
  2: { to: 2, cost: { scrip: 200, flux: 100 }, time: 40, requires: ['infantry'] },
  3: { to: 3, cost: { scrip: 350, flux: 250 }, time: 60, requires: ['heavy', 'vehicles'] },
};

/** Tech tiers per side; the HQ advances them like a research project. */
export class TechSystem {
  private tier: Record<Owner, Tier> = { player: 1, enemy: 1 };
  private active: Partial<Record<Owner, { up: TierUpgrade; t: number }>> = {};

  constructor(private battle: BattleScene, private factions: Record<Owner, Faction>) {}

  tierOf(owner: Owner): Tier {
    return this.tier[owner];
  }

  /** Next available upgrade, or null at Tier 3. */
  next(owner: Owner): TierUpgrade | null {
    const n = this.tier[owner] + 1;
    return n === 2 || n === 3 ? TIER_UPGRADES[n] : null;
  }

  progress(owner: Owner): number | null {
    const a = this.active[owner];
    return a ? a.t / a.up.time : null;
  }

  /** Missing-requirement text for a tier + role list (localised), or null when unlocked. */
  lockReason(owner: Owner, tier: Tier, requires: BuildingRole[]): string | null {
    if (this.tier[owner] < tier) return t('lock.tier', { n: tier });
    const missing = requires.filter((r) => !this.battle.buildings.hasRole(owner, r));
    if (!missing.length) return null;
    const names = missing.map((r) => {
      const d = defForRole(this.factions[owner], r);
      return d ? buildingName(d.id) : roleName(r);
    });
    return t('lock.requires', { what: names.join(', ') });
  }

  /** Why the next tier cannot be started now (null = can start). */
  checkAdvance(owner: Owner): MessageKey | null {
    const up = this.next(owner);
    if (!up) return 'err.maxTier';
    if (this.active[owner]) return 'err.busy';
    if (this.lockReason(owner, 1, up.requires)) return 'err.requires';
    if (!this.battle.resources.canAfford(owner, up.cost)) return 'err.resources';
    return null;
  }

  advance(owner: Owner): boolean {
    const err = this.checkAdvance(owner);
    const up = this.next(owner);
    if (err || !up) {
      if (owner === 'player' && err) this.battle.events.emit(EV.message, err);
      return false;
    }
    this.battle.resources.spend(owner, up.cost);
    this.active[owner] = { up, t: 0 };
    return true;
  }

  /** Cancels an in-progress advance with a full refund. */
  cancel(owner: Owner): void {
    const a = this.active[owner];
    if (!a) return;
    this.battle.resources.refund(owner, a.up.cost);
    delete this.active[owner];
  }

  update(dt: number): void {
    for (const o of ['player', 'enemy'] as Owner[]) {
      const a = this.active[o];
      if (!a) continue;
      if (!this.battle.buildings.getHQ(o)) {
        delete this.active[o];
        continue;
      }
      a.t += dt;
      if (a.t >= a.up.time) {
        delete this.active[o];
        this.tier[o] = a.up.to;
        this.battle.events.emit(EV.tierUp, o, a.up.to);
        if (o === 'player') this.battle.events.emit(EV.message, 'note.tierUp', { n: a.up.to });
      }
    }
  }

  /** Grants a tier directly (tutorial / campaign bonus). */
  setTier(owner: Owner, tier: Tier): void {
    this.tier[owner] = tier;
  }
}
