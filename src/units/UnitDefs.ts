import { Resources } from '../systems/ResourceSystem';
import type { BuildingRole } from '../buildings/BuildingDefs';
import { ArmorClass, DamageType } from './Damage';
import type { AbilityId } from './Abilities';

export type UnitId =
  | 'rifleman' | 'ranger' | 'breacher' | 'marksman' | 'engineer' | 'heavy' | 'commander'
  | 'buggy' | 'apc' | 'tank' | 'artillery'
  | 'crawler' | 'spitter' | 'leaper' | 'burrower' | 'shaman' | 'behemoth' | 'overlord'
  | 'skimmer' | 'carrier' | 'siegebeast' | 'titan';
export type Faction = 'ironvoid' | 'nullhorde';

export type UnitCategory = 'infantry' | 'vehicle' | 'monster' | 'hero';
export type Tier = 1 | 2 | 3;
/** Visual weapon effect (the damage rules come from damageType). */
export type ProjectileLook = 'bullet' | 'shell' | 'spit' | 'melee' | 'flame' | 'sniper' | 'psy' | 'lob' | 'acidlob' | 'cannon';

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
  // ---- Vehicles & monsters ----
  /** Has a turret that turns independently of the hull. */
  turret?: boolean;
  /** Number of infantry squads it can carry. */
  transport?: number;
  /** Damage per second dealt to light infantry it drives over. */
  crush?: number;
  /** Fires over obstacles (no line of sight needed); cannot hit targets closer than minRange. */
  indirect?: boolean;
  minRange?: number;
  /** Area damage radius around the impact (px). */
  splash?: number;
  /** Must deploy (immobile) before firing; deploying takes `time` seconds and adds range. */
  deploy?: { time: number; rangeBonus: number };
  /** Hovers: crosses cliffs and structures, ignores terrain for pathing. */
  flying?: boolean;
  /** HP regenerated per second (Horde beasts). */
  regen?: number;
  /** Maximum number alive at once (Titans). */
  limit?: number;
  /** Active abilities on the Q / W / E slots. */
  abilities?: AbilityId[];
  description: string;
}

const Z = { scrip: 0, flux: 0 };

export const UNIT_DEFS: Record<UnitId, UnitDef> = {
  // ---------------------------------------------------------------- Iron Void
  rifleman: {
    abilities: ['frag'],
    id: 'rifleman', name: 'Void Riflemen', faction: 'ironvoid', category: 'infantry', tier: 1, requires: [], supply: 2,
    damageType: 'bullet', armor: 'light', sight: 300, canCapture: true, squadSize: 6, hp: 90, damage: 12, range: 200,
    speed: 100, cost: { scrip: 80, flux: 0 }, cooldown: 1.0, trainTime: 8, size: 7, projectile: 'bullet',
    description: 'Line infantry. Cheap, reliable, expendable.',
  },
  ranger: {
    abilities: ['sprint'],
    id: 'ranger', name: 'Void Rangers', faction: 'ironvoid', category: 'infantry', tier: 1, requires: [], supply: 2,
    damageType: 'bullet', armor: 'light', sight: 440, canCapture: true, squadSize: 4, hp: 60, damage: 11, range: 260,
    speed: 122, cost: { scrip: 90, flux: 10 }, cooldown: 1.1, trainTime: 9, size: 7, projectile: 'bullet',
    captureRate: 2, detector: 320,
    description: 'Fast scouts with long rifles. See far, capture points twice as fast and spot burrowed foes.',
  },
  breacher: {
    abilities: ['smoke'],
    id: 'breacher', name: 'Breacher Squad', faction: 'ironvoid', category: 'infantry', tier: 1, requires: ['power'], supply: 2,
    damageType: 'flame', armor: 'heavy', sight: 260, canCapture: true, squadSize: 5, hp: 115, damage: 9, range: 120,
    speed: 92, cost: { scrip: 120, flux: 30 }, cooldown: 0.5, trainTime: 11, size: 8, projectile: 'flame',
    ignoresCover: true,
    description: 'Close-assault troops with flamers. Burn infantry out of cover and scorch structures.',
  },
  marksman: {
    abilities: ['smite'],
    id: 'marksman', name: 'Void Marksmen', faction: 'ironvoid', category: 'infantry', tier: 2, requires: [], supply: 2,
    damageType: 'bullet', armor: 'light', sight: 460, canCapture: true, squadSize: 3, hp: 60, damage: 48, range: 400,
    speed: 80, cost: { scrip: 110, flux: 40 }, cooldown: 3.0, trainTime: 12, size: 7, projectile: 'sniper',
    precision: { closeRange: 120 },
    description: 'Snipers. Pick off the weakest soldier or the enemy hero from extreme range; poor up close.',
  },
  engineer: {
    abilities: ['overcharge'],
    id: 'engineer', name: 'Field Engineers', faction: 'ironvoid', category: 'infantry', tier: 1, requires: [], supply: 1,
    damageType: 'bullet', armor: 'light', sight: 280, canCapture: true, squadSize: 3, hp: 70, damage: 6, range: 150,
    speed: 90, cost: { scrip: 70, flux: 0 }, cooldown: 1.2, trainTime: 8, size: 7, projectile: 'bullet',
    repairRate: 10,
    description: 'Support. Repair structures and vehicles, and raise fortifications in the field. Barely armed.',
  },
  heavy: {
    id: 'heavy', name: 'Iron Guard', faction: 'ironvoid', category: 'infantry', tier: 2, requires: [], supply: 3,
    damageType: 'explosive', armor: 'heavy', sight: 280, canCapture: true, squadSize: 4, hp: 150, damage: 30, range: 180,
    speed: 60, cost: { scrip: 120, flux: 40 }, cooldown: 1.6, trainTime: 12, size: 9, projectile: 'shell',
    description: 'Armoured heavy weapons team. Strong against vehicles and heavy infantry.',
  },
  commander: {
    abilities: ['rally', 'barrage'],
    id: 'commander', name: 'Void Commander', faction: 'ironvoid', category: 'hero', tier: 1, requires: [], supply: 0,
    damageType: 'explosive', armor: 'heavy', sight: 340, canCapture: true, squadSize: 1, hp: 400, damage: 50, range: 180,
    speed: 80, cost: Z, cooldown: 1.2, trainTime: 30, size: 12, projectile: 'shell',
    isHero: true, description: 'Hero of the crusade. Inspires nearby troops.',
  },
  buggy: {
    id: 'buggy', name: 'Scout Buggy', faction: 'ironvoid', category: 'vehicle', tier: 2, requires: [], supply: 3,
    damageType: 'bullet', armor: 'vehicle', sight: 480, canCapture: false, squadSize: 1, hp: 340, damage: 16, range: 240,
    speed: 190, cost: { scrip: 140, flux: 40 }, cooldown: 0.35, trainTime: 12, size: 16, projectile: 'bullet',
    detector: 260,
    description: 'Fast raider with twin autoguns. Scouts the map and hunts infantry in the open.',
  },
  apc: {
    id: 'apc', name: 'Rhino APC', faction: 'ironvoid', category: 'vehicle', tier: 2, requires: [], supply: 3,
    damageType: 'bullet', armor: 'vehicle', sight: 320, canCapture: false, squadSize: 1, hp: 850, damage: 14, range: 220,
    speed: 125, cost: { scrip: 180, flux: 60 }, cooldown: 0.5, trainTime: 16, size: 20, projectile: 'bullet',
    transport: 1,
    description: 'Armoured transport. Carries one infantry squad safely and patches up its wounded.',
  },
  tank: {
    id: 'tank', name: 'Iron Tyrant Tank', faction: 'ironvoid', category: 'vehicle', tier: 3, requires: [], supply: 5,
    damageType: 'explosive', armor: 'vehicle', sight: 340, canCapture: false, squadSize: 1, hp: 1250, damage: 95, range: 300,
    speed: 70, cost: { scrip: 300, flux: 150 }, cooldown: 2.6, trainTime: 24, size: 24, projectile: 'cannon',
    turret: true, crush: 45, splash: 40,
    description: 'Main battle tank. Heavy cannon on a rotating turret; crushes infantry under its treads.',
  },
  artillery: {
    id: 'artillery', name: 'Thunder Mortar', faction: 'ironvoid', category: 'vehicle', tier: 3, requires: [], supply: 5,
    damageType: 'explosive', armor: 'vehicle', sight: 300, canCapture: false, squadSize: 1, hp: 520, damage: 120, range: 560,
    speed: 55, cost: { scrip: 280, flux: 180 }, cooldown: 5.0, trainTime: 26, size: 22, projectile: 'lob',
    indirect: true, minRange: 200, splash: 80, deploy: { time: 3, rangeBonus: 140 },
    description: 'Siege walker. Must deploy to fire; lobs shells over walls and cliffs at extreme range.',
  },
  // ---------------------------------------------------------------- Null Horde
  crawler: {
    abilities: ['frenzy'],
    id: 'crawler', name: 'Void Crawler', faction: 'nullhorde', category: 'infantry', tier: 1, requires: [], supply: 2,
    damageType: 'acid', armor: 'light', sight: 280, canCapture: true, squadSize: 8, hp: 60, damage: 7, range: 120,
    speed: 120, cost: { scrip: 75, flux: 0 }, cooldown: 0.9, trainTime: 7, size: 6, projectile: 'spit',
    description: 'Fast chitinous swarm-beasts.',
  },
  spitter: {
    abilities: ['acidcloud'],
    id: 'spitter', name: 'Acid Spitters', faction: 'nullhorde', category: 'infantry', tier: 1, requires: [], supply: 2,
    damageType: 'acid', armor: 'light', sight: 300, canCapture: true, squadSize: 5, hp: 55, damage: 12, range: 230,
    speed: 95, cost: { scrip: 90, flux: 20 }, cooldown: 1.4, trainTime: 8, size: 7, projectile: 'spit',
    description: 'Bloated ranged beasts that lob corrosive bile. Melt vehicles; fragile.',
  },
  leaper: {
    abilities: ['pounce'],
    id: 'leaper', name: 'Void Leapers', faction: 'nullhorde', category: 'infantry', tier: 2, requires: [], supply: 2,
    damageType: 'melee', armor: 'light', sight: 300, canCapture: true, squadSize: 4, hp: 90, damage: 20, range: 40,
    speed: 130, cost: { scrip: 100, flux: 30 }, cooldown: 1.0, trainTime: 9, size: 8, projectile: 'melee',
    leap: { range: 300, cooldown: 10, mult: 2.5 },
    description: 'Bounding killers that leap onto their prey. Devastating first strike; weak if left unsupported.',
  },
  burrower: {
    abilities: ['burrow'],
    id: 'burrower', name: 'Burrowers', faction: 'nullhorde', category: 'infantry', tier: 2, requires: [], supply: 3,
    damageType: 'melee', armor: 'heavy', sight: 260, canCapture: true, squadSize: 3, hp: 140, damage: 26, range: 44,
    speed: 72, cost: { scrip: 130, flux: 50 }, cooldown: 1.3, trainTime: 12, size: 9, projectile: 'melee',
    burrow: { ambush: 2, speedMult: 0.8 },
    description: 'Tunnel under the battlefield unseen and erupt among the enemy. Revealed by detectors.',
  },
  shaman: {
    abilities: ['regenerate'],
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
  skimmer: {
    id: 'skimmer', name: 'Void Skimmer', faction: 'nullhorde', category: 'vehicle', tier: 2, requires: [], supply: 3,
    damageType: 'acid', armor: 'monster', sight: 420, canCapture: false, squadSize: 1, hp: 290, damage: 12, range: 200,
    speed: 210, cost: { scrip: 130, flux: 40 }, cooldown: 0.4, trainTime: 11, size: 16, projectile: 'spit',
    flying: true, regen: 2,
    description: 'Winged hunter that glides over cliffs and walls. Hit-and-run raider.',
  },
  carrier: {
    id: 'carrier', name: 'Carrier Beast', faction: 'nullhorde', category: 'vehicle', tier: 2, requires: [], supply: 3,
    damageType: 'melee', armor: 'monster', sight: 300, canCapture: false, squadSize: 1, hp: 820, damage: 22, range: 60,
    speed: 115, cost: { scrip: 170, flux: 60 }, cooldown: 1.2, trainTime: 16, size: 22, projectile: 'melee',
    transport: 1, regen: 6,
    description: 'Armoured brood-mother. Carries one swarm squad in its belly and regenerates.',
  },
  siegebeast: {
    id: 'siegebeast', name: 'Siege Beast', faction: 'nullhorde', category: 'vehicle', tier: 3, requires: [], supply: 5,
    damageType: 'acid', armor: 'monster', sight: 300, canCapture: false, squadSize: 1, hp: 760, damage: 105, range: 620,
    speed: 45, cost: { scrip: 260, flux: 160 }, cooldown: 4.5, trainTime: 24, size: 24, projectile: 'acidlob',
    indirect: true, minRange: 180, splash: 70, regen: 4,
    description: 'Lumbering artillery beast that hurls sacs of acid over any obstacle.',
  },
  titan: {
    id: 'titan', name: 'Hive Titan', faction: 'nullhorde', category: 'vehicle', tier: 3, requires: [], supply: 10,
    damageType: 'melee', armor: 'monster', sight: 380, canCapture: false, squadSize: 1, hp: 3200, damage: 150, range: 100,
    speed: 44, cost: { scrip: 600, flux: 400 }, cooldown: 2.2, trainTime: 45, size: 36, projectile: 'melee',
    splash: 60, crush: 70, regen: 10, limit: 1,
    description: 'The swarm\'s living siege engine. Tramples everything; only one can walk the field.',
  },
  overlord: {
    abilities: ['scream', 'spawnbrood'],
    id: 'overlord', name: 'Null Overlord', faction: 'nullhorde', category: 'hero', tier: 1, requires: [], supply: 0,
    damageType: 'acid', armor: 'monster', sight: 340, canCapture: true, squadSize: 1, hp: 450, damage: 44, range: 160,
    speed: 78, cost: Z, cooldown: 1.2, trainTime: 30, size: 13, projectile: 'psy',
    isHero: true, description: 'Psychic tyrant of the swarm. Its death breaks the Horde\'s will.',
  },
};
