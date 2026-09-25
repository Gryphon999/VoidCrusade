import { Owner } from '../types';

/** Stat multipliers from research and campaign bonuses. */
export interface Modifiers {
  damageMult: number;
  hpMult: number;
  turretDamageMult: number;
  squadSizeBonus: number;
  /** Extra supply cap. */
  supplyBonus: number;
  buildSpeedMult: number;
  /** Damage taken by infantry (Armoury carapace). */
  infantryArmorMult: number;
  infantrySpeedMult: number;
}

export function defaultModifiers(): Modifiers {
  return { damageMult: 1, hpMult: 1, turretDamageMult: 1, squadSizeBonus: 0, supplyBonus: 0, buildSpeedMult: 1, infantryArmorMult: 1, infantrySpeedMult: 1 };
}

export type ModifierTable = Record<Owner, Modifiers>;
