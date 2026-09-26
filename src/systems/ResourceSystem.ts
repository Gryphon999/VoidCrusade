import { RESOURCES } from '../config';
import { Owner, ResourceType } from '../types';

export interface Resources {
  scrip: number;
  flux: number;
}

export const ZERO_COST: Resources = { scrip: 0, flux: 0 };

/** Tracks each side's stockpile and per-second income. */
export class ResourceSystem {
  private resources: Record<Owner, Resources>;
  private income: Record<Owner, Resources>;
  private multiplier: Record<Owner, number> = { player: 1, enemy: 1 };

  constructor(start: Partial<Record<Owner, Partial<Resources>>> = {}) {
    const init = (o: Owner): Resources => ({
      scrip: start[o]?.scrip ?? RESOURCES.startScrip,
      flux: start[o]?.flux ?? RESOURCES.startFlux,
    });
    this.resources = { player: init('player'), enemy: init('enemy') };
    this.income = { player: { scrip: 0, flux: 0 }, enemy: { scrip: 0, flux: 0 } };
  }

  /** Scales all income for an owner (used for AI difficulty). */
  setIncomeMultiplier(owner: Owner, mult: number): void {
    this.multiplier[owner] = mult;
  }

  /** Called every frame; dt in seconds. */
  tick(dt: number): void {
    for (const o of ['player', 'enemy'] as const) {
      const m = this.multiplier[o];
      // Income can be negative (Flux upkeep) but stockpiles never go below zero.
      const fi = this.income[o].flux;
      this.resources[o].scrip += this.income[o].scrip * m * dt;
      this.resources[o].flux = Math.max(0, this.resources[o].flux + (fi > 0 ? fi * m : fi) * dt);
    }
  }

  canAfford(owner: Owner, cost: Resources): boolean {
    const r = this.resources[owner];
    return r.scrip >= cost.scrip && r.flux >= cost.flux;
  }

  spend(owner: Owner, cost: Resources): void {
    const r = this.resources[owner];
    r.scrip = Math.max(0, r.scrip - cost.scrip);
    r.flux = Math.max(0, r.flux - cost.flux);
  }

  /** Attempts to spend; returns false (and spends nothing) if unaffordable. */
  trySpend(owner: Owner, cost: Resources): boolean {
    if (!this.canAfford(owner, cost)) return false;
    this.spend(owner, cost);
    return true;
  }

  refund(owner: Owner, cost: Resources, fraction = 1): void {
    this.resources[owner].scrip += cost.scrip * fraction;
    this.resources[owner].flux += cost.flux * fraction;
  }

  grant(owner: Owner, type: ResourceType, amount: number): void {
    this.resources[owner][type] += amount;
  }

  addIncome(owner: Owner, type: ResourceType, amount: number): void {
    this.income[owner][type] += amount;
  }

  removeIncome(owner: Owner, type: ResourceType, amount: number): void {
    this.income[owner][type] -= amount;
    if (this.income[owner][type] > -1e-6 && this.income[owner][type] < 1e-6) this.income[owner][type] = 0;
  }

  getResources(owner: Owner): Resources {
    return this.resources[owner];
  }

  /** Effective per-second income including multiplier. */
  getIncome(owner: Owner): Resources {
    const m = this.multiplier[owner];
    return { scrip: this.income[owner].scrip * m, flux: this.income[owner].flux * m };
  }
}
