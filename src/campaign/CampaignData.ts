/** Static definition of the campaign world: 10 hex territories. */

export type BonusType = 'scrip' | 'flux' | 'squadSlot' | 'hp' | 'damage' | 'build' | 'turret' | 'throne';

export interface TerritoryDef {
  id: string;
  name: string;
  /** Axial hex coordinates (pointy-top). */
  q: number;
  r: number;
  bonus: BonusType;
  bonusText: string;
  mapIndex: number;
  /** Extra starting Scrip for the Horde here (harder territories). */
  enemyBonus: number;
}

export const BONUS_ICON: Record<BonusType, string> = {
  scrip: 'icon_scrip',
  flux: 'icon_flux',
  squadSlot: 'icon_squads',
  hp: 'icon_cover',
  damage: 'icon_damage',
  build: 'icon_build',
  turret: 'icon_turret',
  throne: 'icon_throne',
};

export const TERRITORIES: TerritoryDef[] = [
  { id: 'ascalon', name: 'Forge of Ascalon', q: 0, r: 2, bonus: 'scrip', bonusText: '+50 Scrip per battle', mapIndex: 0, enemyBonus: 0 },
  { id: 'veyra', name: 'Veyra Wastes', q: -1, r: 2, bonus: 'flux', bonusText: '+75 Flux per battle', mapIndex: 1, enemyBonus: 0 },
  { id: 'khorvan', name: 'Khorvan Deep', q: 1, r: 1, bonus: 'squadSlot', bonusText: 'Extra squad slot', mapIndex: 2, enemyBonus: 0 },
  { id: 'ossuary', name: 'The Ossuary', q: 0, r: 1, bonus: 'hp', bonusText: '+15% unit HP', mapIndex: 1, enemyBonus: 100 },
  { id: 'mourn', name: 'Mourngate', q: -1, r: 1, bonus: 'damage', bonusText: '+10% unit damage', mapIndex: 2, enemyBonus: 100 },
  { id: 'cinder', name: 'Cinder Spires', q: 1, r: 0, bonus: 'build', bonusText: '+25% build speed', mapIndex: 0, enemyBonus: 100 },
  { id: 'halcyon', name: 'Halcyon Ruin', q: -1, r: 0, bonus: 'turret', bonusText: '+20% turret damage', mapIndex: 0, enemyBonus: 200 },
  { id: 'nadir', name: 'Nadir Rift', q: 1, r: -1, bonus: 'scrip', bonusText: '+50 Scrip per battle', mapIndex: 1, enemyBonus: 200 },
  { id: 'spire', name: 'Hollow Spire', q: 0, r: -1, bonus: 'squadSlot', bonusText: 'Extra squad slot', mapIndex: 2, enemyBonus: 200 },
  { id: 'throne', name: 'Iron Void Throne', q: 0, r: 0, bonus: 'throne', bonusText: 'Final objective', mapIndex: 0, enemyBonus: 400 },
];

export const START_TERRITORY = 'ascalon';
export const THRONE = 'throne';

const HEX_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

export function getTerritory(id: string): TerritoryDef {
  const t = TERRITORIES.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown territory ${id}`);
  return t;
}

export function neighbors(id: string): TerritoryDef[] {
  const t = getTerritory(id);
  return TERRITORIES.filter((o) => HEX_DIRS.some(([dq, dr]) => o.q === t.q + dq && o.r === t.r + dr));
}

/** Pairs of adjacent territory ids (each pair once). */
export function adjacencyPairs(): [string, string][] {
  const out: [string, string][] = [];
  for (const t of TERRITORIES) {
    for (const n of neighbors(t.id)) if (t.id < n.id) out.push([t.id, n.id]);
  }
  return out;
}
