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
  /** Hero ability cooldowns (wargear relic). */
  heroCooldownMult: number;
  /** Hero HP / damage from wargear. */
  heroHpMult: number;
  heroDamageMult: number;
  /** Extra hero ranged reach (wargear). */
  heroRangeBonus: number;
  /** Morale aura from a banner relic. */
  heroMoraleAura: boolean;
  heroSplash: number;
  heroArmorMult: number;
  heroSpeedMult: number;
  /** Detector radius granted to the hero (auspex relic). */
  heroDetector: number;
  /** Vision of every unit. */
  sightMult: number;
  /** Ability cooldowns of rank-and-file squads. */
  abilityCooldownMult: number;
  /** Vehicle and war-beast HP. */
  vehicleHpMult: number;
}

export function defaultModifiers(): Modifiers {
  return { damageMult: 1, hpMult: 1, turretDamageMult: 1, squadSizeBonus: 0, supplyBonus: 0, buildSpeedMult: 1, infantryArmorMult: 1, infantrySpeedMult: 1,
    heroCooldownMult: 1, heroHpMult: 1, heroDamageMult: 1, heroRangeBonus: 0, heroMoraleAura: false,
    heroSplash: 0, heroArmorMult: 1, heroSpeedMult: 1, heroDetector: 0, sightMult: 1, abilityCooldownMult: 1, vehicleHpMult: 1 };
}

export type ModifierTable = Record<Owner, Modifiers>;
