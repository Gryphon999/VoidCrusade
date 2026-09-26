import type { Modifiers } from '../systems/Modifiers';
import type { Faction } from '../units/UnitDefs';

export type WargearSlot = 'weapon' | 'armor' | 'relic';
export const WARGEAR_SLOTS: WargearSlot[] = ['weapon', 'armor', 'relic'];

export interface WargearDef {
  id: string;
  faction: Faction;
  slot: WargearSlot;
  icon: string;
  apply(m: Modifiers): void;
}

export type WargearPick = Record<WargearSlot, string>;

/** Hero wargear: one of three per slot, picked before each battle. */
export const WARGEAR: WargearDef[] = [
  // ---- Void Commander
  { id: 'powersword', faction: 'ironvoid', slot: 'weapon', icon: 'glyph_attack', apply: (m) => (m.heroDamageMult *= 1.3) },
  { id: 'plasmapistol', faction: 'ironvoid', slot: 'weapon', icon: 'glyph_plasma', apply: (m) => (m.heroRangeBonus += 70) },
  { id: 'thunderhammer', faction: 'ironvoid', slot: 'weapon', icon: 'glyph_barrage', apply: (m) => {
    m.heroDamageMult *= 1.15;
    m.heroSplash += 50;
  } },
  { id: 'artificer', faction: 'ironvoid', slot: 'armor', icon: 'glyph_ceramite', apply: (m) => (m.heroHpMult *= 1.35) },
  { id: 'ironhalo', faction: 'ironvoid', slot: 'armor', icon: 'glyph_hardened', apply: (m) => (m.heroArmorMult *= 0.75) },
  { id: 'jumppack', faction: 'ironvoid', slot: 'armor', icon: 'glyph_sprint', apply: (m) => (m.heroSpeedMult *= 1.3) },
  { id: 'banner', faction: 'ironvoid', slot: 'relic', icon: 'glyph_rally', apply: (m) => (m.heroMoraleAura = true) },
  { id: 'voidrelic', faction: 'ironvoid', slot: 'relic', icon: 'glyph_relic', apply: (m) => (m.heroCooldownMult *= 0.75) },
  { id: 'auspex', faction: 'ironvoid', slot: 'relic', icon: 'glyph_tech', apply: (m) => (m.heroDetector += 400) },
  // ---- Null Overlord
  { id: 'bonescythe', faction: 'nullhorde', slot: 'weapon', icon: 'glyph_spines', apply: (m) => (m.heroDamageMult *= 1.3) },
  { id: 'psyblast', faction: 'nullhorde', slot: 'weapon', icon: 'glyph_scream', apply: (m) => (m.heroRangeBonus += 70) },
  { id: 'crushingtalons', faction: 'nullhorde', slot: 'weapon', icon: 'glyph_pounce', apply: (m) => {
    m.heroDamageMult *= 1.15;
    m.heroSplash += 50;
  } },
  { id: 'hivecarapace', faction: 'nullhorde', slot: 'armor', icon: 'glyph_chitin', apply: (m) => (m.heroHpMult *= 1.35) },
  { id: 'mendingflesh', faction: 'nullhorde', slot: 'armor', icon: 'glyph_regenerate', apply: (m) => (m.heroArmorMult *= 0.75) },
  { id: 'leatherwings', faction: 'nullhorde', slot: 'armor', icon: 'glyph_musculature', apply: (m) => (m.heroSpeedMult *= 1.3) },
  { id: 'synapsecrown', faction: 'nullhorde', slot: 'relic', icon: 'glyph_broodmind', apply: (m) => (m.heroMoraleAura = true) },
  { id: 'hivenode', faction: 'nullhorde', slot: 'relic', icon: 'glyph_relic', apply: (m) => (m.heroCooldownMult *= 0.75) },
  { id: 'thirdeye', faction: 'nullhorde', slot: 'relic', icon: 'glyph_tech', apply: (m) => (m.heroDetector += 400) },
];

export function wargearFor(faction: Faction, slot: WargearSlot): WargearDef[] {
  return WARGEAR.filter((w) => w.faction === faction && w.slot === slot);
}

export function defaultPick(faction: Faction): WargearPick {
  return {
    weapon: wargearFor(faction, 'weapon')[0].id,
    armor: wargearFor(faction, 'armor')[0].id,
    relic: wargearFor(faction, 'relic')[0].id,
  };
}

export function randomPick(faction: Faction): WargearPick {
  const r = (slot: WargearSlot): string => {
    const list = wargearFor(faction, slot);
    return list[Math.floor(Math.random() * list.length)].id;
  };
  return { weapon: r('weapon'), armor: r('armor'), relic: r('relic') };
}

export function applyWargear(pick: WargearPick, m: Modifiers): void {
  for (const slot of WARGEAR_SLOTS) WARGEAR.find((w) => w.id === pick[slot])?.apply(m);
}
