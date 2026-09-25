import type { BuildingRole } from '../buildings/BuildingDefs';
import type { Resources } from '../systems/ResourceSystem';
import type { DamageType } from './Damage';

export type AbilityId =
  | 'frag' | 'sprint' | 'smoke' | 'overcharge' | 'smite' | 'rally' | 'barrage'
  | 'frenzy' | 'pounce' | 'burrow' | 'acidcloud' | 'regenerate' | 'scream' | 'spawnbrood';

/** none = instant on the caster; point = ground target; enemy = an enemy squad; building = a friendly structure. */
export type Targeting = 'none' | 'point' | 'enemy' | 'building';

export interface AbilityDef {
  id: AbilityId;
  targeting: Targeting;
  /** Cast range from the squad centre (px); 0 = anywhere visible. */
  range: number;
  /** Area of effect radius (px). */
  radius?: number;
  cooldown: number;
  cost?: Resources;
  /** Building roles that must stand before it can be used. */
  requires?: BuildingRole[];
  duration?: number;
  damage?: number;
  damageType?: DamageType;
  /** Command-grid glyph. */
  icon: string;
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  // ---- Iron Void
  frag: { id: 'frag', targeting: 'point', range: 230, radius: 70, cooldown: 25, cost: { scrip: 15, flux: 0 },
    damage: 55, damageType: 'explosive', icon: 'glyph_frag' },
  sprint: { id: 'sprint', targeting: 'none', range: 0, cooldown: 20, duration: 6, icon: 'glyph_sprint' },
  smoke: { id: 'smoke', targeting: 'point', range: 260, radius: 110, cooldown: 40, duration: 15, icon: 'glyph_smoke' },
  overcharge: { id: 'overcharge', targeting: 'building', range: 160, cooldown: 60, duration: 20, icon: 'glyph_overcharge' },
  smite: { id: 'smite', targeting: 'enemy', range: 480, cooldown: 30, damage: 170, damageType: 'bullet', icon: 'glyph_smite' },
  rally: { id: 'rally', targeting: 'none', range: 0, radius: 300, cooldown: 45, duration: 12, icon: 'glyph_rally' },
  barrage: { id: 'barrage', targeting: 'point', range: 0, radius: 140, cooldown: 90, cost: { scrip: 0, flux: 100 },
    requires: ['beacon'], damage: 90, damageType: 'explosive', icon: 'glyph_barrage' },
  // ---- Null Horde
  frenzy: { id: 'frenzy', targeting: 'none', range: 0, cooldown: 30, duration: 8, icon: 'glyph_frenzy' },
  pounce: { id: 'pounce', targeting: 'enemy', range: 320, cooldown: 10, icon: 'glyph_pounce' },
  burrow: { id: 'burrow', targeting: 'none', range: 0, cooldown: 2, icon: 'glyph_burrow' },
  acidcloud: { id: 'acidcloud', targeting: 'point', range: 260, radius: 90, cooldown: 35, duration: 8,
    damage: 12, damageType: 'acid', icon: 'glyph_acidcloud' },
  regenerate: { id: 'regenerate', targeting: 'none', range: 0, radius: 220, cooldown: 45, duration: 5, icon: 'glyph_regenerate' },
  scream: { id: 'scream', targeting: 'none', range: 0, radius: 260, cooldown: 40, duration: 2.5, icon: 'glyph_scream' },
  spawnbrood: { id: 'spawnbrood', targeting: 'none', range: 0, cooldown: 120, requires: ['beacon'], icon: 'glyph_spawnbrood' },
};
