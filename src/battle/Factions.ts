import { BUILDING_DEFS, BuildingId, defForRole } from '../buildings/BuildingDefs';
import { UNIT_DEFS, UnitId, Faction } from '../units/UnitDefs';

/** The squad each faction starts with (kept here, not in DropSystem, so this module loads without Phaser). */
const FIRST_SQUAD: Record<Faction, UnitId> = { ironvoid: 'rifleman', nullhorde: 'crawler' };

/** Everything that differs by faction when a battle starts or when the enemy has no base. */

export const FACTIONS: readonly Faction[] = ['ironvoid', 'nullhorde'];

export function opponentFaction(f: Faction): Faction {
  return f === 'ironvoid' ? 'nullhorde' : 'ironvoid';
}

export interface StartKit {
  hq: BuildingId;
  hero: UnitId;
  squad: UnitId;
}

/** Headquarters, hero and first squad of a faction, read from the data. */
export function startKitFor(faction: Faction): StartKit {
  const hq = defForRole(faction, 'hq');
  const hero = (Object.keys(UNIT_DEFS) as UnitId[]).find((id) => UNIT_DEFS[id].faction === faction && UNIT_DEFS[id].isHero);
  if (!hq || !hero) throw new Error(`No start kit for ${faction}`);
  return { hq: hq.id, hero, squad: FIRST_SQUAD[faction] };
}

/** Survival / nest broods: what an enemy of this faction sends, growing with the wave (or minute). */
export function wavePool(faction: Faction, stage: number): UnitId[] {
  if (faction === 'nullhorde') {
    const pool: UnitId[] = ['crawler', 'crawler', 'spitter'];
    if (stage >= 3) pool.push('leaper', 'shaman');
    if (stage >= 5) pool.push('behemoth', 'burrower', 'skimmer');
    if (stage >= 8) pool.push('carrier', 'siegebeast');
    return pool;
  }
  const pool: UnitId[] = ['rifleman', 'rifleman', 'ranger'];
  if (stage >= 3) pool.push('breacher', 'heavy');
  if (stage >= 5) pool.push('tank', 'buggy', 'marksman');
  if (stage >= 8) pool.push('apc', 'artillery');
  return pool;
}

/** The monster that leads every twelfth wave. */
export function bossFor(faction: Faction): UnitId {
  return faction === 'nullhorde' ? 'titan' : 'tank';
}

/** Burn the Nests: the enemy's brood structure (Brood Nest, or a Barracks for the Iron Void). */
export function nestBuildingFor(faction: Faction): BuildingId {
  const id: BuildingId = faction === 'nullhorde' ? 'nest' : 'barracks';
  if (!BUILDING_DEFS[id]) throw new Error(`No nest building for ${faction}`);
  return id;
}
