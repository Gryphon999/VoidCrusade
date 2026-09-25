import { Resources } from '../systems/ResourceSystem';
import type { BuildingRole } from '../buildings/BuildingDefs';
import { ArmorClass, DamageType } from './Damage';

export type UnitId =
  | 'rifleman' | 'ranger' | 'breacher' | 'marksman' | 'engineer' | 'heavy' | 'commander'
  | 'crawler' | 'spitter' | 'leaper' | 'burrower' | 'shaman' | 'behemoth' | 'overlord';
export type Faction = 'ironvoid' | 'nullhorde';

export type UnitCategory = 'infantry' | 'vehicle' | 'monster' | 'hero';
export type Tier = 1 | 2 | 3;
/** Visual weapon effect (the damage rules come from damageType). */
export type ProjectileLook = 'bullet' | 'shell' | 'spit' | 'melee' | 'flame' | 'sniper' | 'psy';

export interface UnitDef {
  id: UnitId;
  name: string;
  faction: Faction;
  category: UnitCategory;
  tier: Tier;
  /** Building roles the owner must have (besides the producing building). */
  requires: BuildingRole[];
  /** Population cost of the whole squad (heroes are free). */
  supply: number;
  damageType: DamageType;
  armor: ArmorClass;
  /** Fog-of-war vision radius (px). */
  sight: number;
  squadSize: number;
  hp: number;
  damage: number;
  range: number;
  speed: number;
  cost: Resources;
  /** Seconds between shots per soldier. */
  cooldown: number;
  trainTime: number;
  /** Visual radius of one soldier in px. */
  size: number;
  projectile: ProjectileLook;
  isHero?: boolean;
  /** Vehicles and monsters-as-machines cannot hold capture points. */
  canCapture: boolean;
  // ---- Role passives ----
  /** Capture speed multiplier (Rangers take points fast). */
  captureRate?: number;
  /** Reveals stealthed (burrowed) enemies within this radius. */
  detector?: number;
  /** Ignores the target's cover bonus (flamers, shotguns). */
  ignoresCover?: boolean;
  /** Picks off the weakest soldier / the hero first; damage halved inside `closeRange`. */
  precision?: { closeRange: number };
  /** HP per second each soldier restores to friendly structures (and vehicles) it stands next to. */
  repairRate?: number;
  /** Jumps onto targets within `range`; the landing strike deals `mult`× damage. */
  leap?: { range: number; cooldown: number; mult: number };
  /** Moves underground when out of combat: invisible unless detected; first strike after surfacing deals `ambush`×. */
  burrow?: { ambush: number; speedMult: number };
  /** Heals nearby friendly soldiers (HP/s each) and speeds them up. */
  aura?: { radius: number; heal: number; speed: number };
  description: string;
}

const Z = { scrip: 0, flux: 0 };

export const UNIT_DEFS: Record<UnitId, UnitDef> = {
  // ---------------------------------------------------------------- Iron Void
  rifleman: {
    id: 'rifleman', name: 'Void Riflemen', faction: 'ironvoid', category: 'infantry', tier: 1, requires: [], supply: 2,
    damageType: 'bullet', armor: 'light', sight: 300, canCapture: true, squadSize: 6, hp: 80, damage: 12, range: 200,
    speed: 90, cost: { scrip: 80, flux: 0 }, cooldown: 1.0, trainTime: 8, size: 7, projectile: 'bullet',
    description: 'Line infantry. Cheap, reliable, expendable.',
  },
  ranger: {
    id: 'ranger', name: 'Void Rangers', faction: 'ironvoid', category: 'infantry', tier: 1, requires: [], supply: 2,
    damageType: 'bullet', armor: 'light', sight: 440, canCapture: true, squadSize: 4, hp: 60, damage: 11, range: 260,
    speed: 122, cost: { scrip: 90, flux: 10 }, cooldown: 1.1, trainTime: 9, size: 7, projectile: 'bullet',
    captureRate: 2, detector: 320,
    description: 'Fast scouts with long rifles. See far, capture points twice as fast and spot burrowed foes.',
  },
  breacher: {
    id: 'breacher', name: 'Breacher Squad', faction: 'ironvoid', category: 'infantry', tier: 1, requires: ['power'], supply: 3,
    damageType: 'flame', armor: 'heavy', sight: 260, canCapture: true, squadSize: 5, hp: 100, damage: 9, range: 95,
    speed: 84, cost: { scrip: 120, flux: 30 }, cooldown: 0.5, trainTime: 11, size: 8, projectile: 'flame',
    ignoresCover: true,
    description: 'Close-assault troops with flamers. Burn infantry out of cover and scorch structures.',
  },
  marksman: {
    id: 'marksman', name: 'Void Marksmen', faction: 'ironvoid', category: 'infantry', tier: 2, requires: [], supply: 2,
    damageType: 'bullet', armor: 'light', sight: 460, canCapture: true, squadSize: 3, hp: 60, damage: 48, range: 400,
    speed: 80, cost: { scrip: 110, flux: 40 }, cooldown: 3.0, trainTime: 12, size: 7, projectile: 'sniper',
    precision: { closeRange: 120 },
    description: 'Snipers. Pick off the weakest soldier or the enemy hero from extreme range; poor up close.',
  },
  engineer: {
    id: 'engineer', name: 'Field Engineers', faction: 'ironvoid', category: 'infantry', tier: 1, requires: [], supply: 1,
    damageType: 'bullet', armor: 'light', sight: 280, canCapture: true, squadSize: 3, hp: 70, damage: 6, range: 150,
    speed: 90, cost: { scrip: 70, flux: 0 }, cooldown: 1.2, trainTime: 8, size: 7, projectile: 'bullet',
    repairRate: 10,
    description: 'Support. Repair structures and vehicles, and raise fortifications in the field. Barely armed.',
  },
  heavy: {
    id: 'heavy', name: 'Iron Guard', faction: 'ironvoid', category: 'infantry', tier: 2, requires: [], supply: 3,
    damageType: 'explosive', armor: 'heavy', sight: 280, canCapture: true, squadSize: 4, hp: 150, damage: 30, range: 150,
    speed: 60, cost: { scrip: 120, flux: 40 }, cooldown: 1.6, trainTime: 12, size: 9, projectile: 'shell',
    description: 'Armoured heavy weapons team. Strong against vehicles and heavy infantry.',
  },
  commander: {
    id: 'commander', name: 'Void Commander', faction: 'ironvoid', category: 'hero', tier: 1, requires: [], supply: 0,
    damageType: 'explosive', armor: 'heavy', sight: 340, canCapture: true, squadSize: 1, hp: 400, damage: 50, range: 180,
    speed: 80, cost: Z, cooldown: 1.2, trainTime: 30, size: 12, projectile: 'shell',
    isHero: true, description: 'Hero of the crusade. Inspires nearby troops.',
  },
  // ---------------------------------------------------------------- Null Horde
  crawler: {
    id: 'crawler', name: 'Void Crawler', faction: 'nullhorde', category: 'infantry', tier: 1, requires: [], supply: 2,
    damageType: 'acid', armor: 'light', sight: 280, canCapture: true, squadSize: 8, hp: 60, damage: 10, range: 120,
    speed: 120, cost: { scrip: 70, flux: 0 }, cooldown: 0.9, trainTime: 7, size: 6, projectile: 'spit',
    description: 'Fast chitinous swarm-beasts.',
  },
  spitter: {
    id: 'spitter', name: 'Acid Spitters', faction: 'nullhorde', category: 'infantry', tier: 1, requires: [], supply: 2,
    damageType: 'acid', armor: 'light', sight: 300, canCapture: true, squadSize: 5, hp: 55, damage: 15, range: 240,
    speed: 95, cost: { scrip: 85, flux: 20 }, cooldown: 1.4, trainTime: 8, size: 7, projectile: 'spit',
    description: 'Bloated ranged beasts that lob corrosive bile. Melt vehicles; fragile.',
  },
  leaper: {
    id: 'leaper', name: 'Void Leapers', faction: 'nullhorde', category: 'infantry', tier: 2, requires: [], supply: 2,
    damageType: 'melee', armor: 'light', sight: 300, canCapture: true, squadSize: 4, hp: 90, damage: 20, range: 40,
    speed: 130, cost: { scrip: 100, flux: 30 }, cooldown: 1.0, trainTime: 9, size: 8, projectile: 'melee',
    leap: { range: 300, cooldown: 10, mult: 2.5 },
    description: 'Bounding killers that leap onto their prey. Devastating first strike; weak if left unsupported.',
  },
  burrower: {
    id: 'burrower', name: 'Burrowers', faction: 'nullhorde', category: 'infantry', tier: 2, requires: [], supply: 3,
    damageType: 'melee', armor: 'heavy', sight: 260, canCapture: true, squadSize: 3, hp: 140, damage: 26, range: 44,
    speed: 72, cost: { scrip: 130, flux: 50 }, cooldown: 1.3, trainTime: 12, size: 9, projectile: 'melee',
    burrow: { ambush: 2, speedMult: 0.8 },
    description: 'Tunnel under the battlefield unseen and erupt among the enemy. Revealed by detectors.',
  },
  shaman: {
    id: 'shaman', name: 'Brood-shamans', faction: 'nullhorde', category: 'infantry', tier: 2, requires: [], supply: 2,
    damageType: 'acid', armor: 'light', sight: 300, canCapture: true, squadSize: 2, hp: 90, damage: 8, range: 180,
    speed: 88, cost: { scrip: 100, flux: 50 }, cooldown: 1.5, trainTime: 10, size: 8, projectile: 'psy',
    aura: { radius: 170, heal: 3, speed: 0.15 },
    description: 'Support. Mend the flesh of nearby swarm-beasts and quicken their stride. Weak in combat.',
  },
  behemoth: {
    id: 'behemoth', name: 'Null Behemoth', faction: 'nullhorde', category: 'monster', tier: 2, requires: [], supply: 4,
    damageType: 'melee', armor: 'monster', sight: 260, canCapture: true, squadSize: 2, hp: 300, damage: 60, range: 100,
    speed: 45, cost: { scrip: 160, flux: 60 }, cooldown: 2.0, trainTime: 14, size: 14, projectile: 'melee',
    description: 'Hulking bio-titan. Crushes armour and bone alike.',
  },
  overlord: {
    id: 'overlord', name: 'Null Overlord', faction: 'nullhorde', category: 'hero', tier: 1, requires: [], supply: 0,
    damageType: 'acid', armor: 'monster', sight: 340, canCapture: true, squadSize: 1, hp: 450, damage: 44, range: 160,
    speed: 78, cost: Z, cooldown: 1.2, trainTime: 30, size: 13, projectile: 'psy',
    isHero: true, description: 'Psychic tyrant of the swarm. Its death breaks the Horde\'s will.',
  },
};
