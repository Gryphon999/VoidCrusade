/** Damage types and armour classes: one multiplier table decides who counters whom. */

export type DamageType = 'bullet' | 'explosive' | 'melee' | 'acid' | 'flame';
export type ArmorClass = 'light' | 'heavy' | 'vehicle' | 'monster' | 'building';

export const DAMAGE_TYPES: DamageType[] = ['bullet', 'explosive', 'melee', 'acid', 'flame'];
export const ARMOR_CLASSES: ArmorClass[] = ['light', 'heavy', 'vehicle', 'monster', 'building'];

/** DAMAGE_TABLE[damage][armour] = multiplier applied to every hit. */
export const DAMAGE_TABLE: Record<DamageType, Record<ArmorClass, number>> = {
  bullet: { light: 1.0, heavy: 0.7, vehicle: 0.35, monster: 0.7, building: 0.5 },
  explosive: { light: 0.8, heavy: 1.0, vehicle: 1.2, monster: 1.0, building: 1.5 },
  melee: { light: 1.1, heavy: 0.9, vehicle: 0.6, monster: 0.8, building: 1.0 },
  acid: { light: 0.9, heavy: 1.0, vehicle: 1.3, monster: 0.7, building: 1.1 },
  flame: { light: 1.4, heavy: 0.8, vehicle: 0.4, monster: 1.1, building: 0.9 },
};

export function damageMult(type: DamageType, armor: ArmorClass): number {
  return DAMAGE_TABLE[type][armor];
}

/** Armour classes this damage type is good (≥1.1) or poor (≤0.6) against. */
export function strongVs(type: DamageType): ArmorClass[] {
  return ARMOR_CLASSES.filter((a) => DAMAGE_TABLE[type][a] >= 1.1);
}

export function weakVs(type: DamageType): ArmorClass[] {
  return ARMOR_CLASSES.filter((a) => DAMAGE_TABLE[type][a] <= 0.6);
}

/** Damage types that hurt an armour class the most / least. */
export function vulnerableTo(armor: ArmorClass): DamageType[] {
  return DAMAGE_TYPES.filter((d) => DAMAGE_TABLE[d][armor] >= 1.1);
}

export function resists(armor: ArmorClass): DamageType[] {
  return DAMAGE_TYPES.filter((d) => DAMAGE_TABLE[d][armor] <= 0.6);
}
