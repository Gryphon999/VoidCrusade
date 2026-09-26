import { Resources } from '../systems/ResourceSystem';
import { Faction, Tier, UnitId } from '../units/UnitDefs';
import { DamageType } from '../units/Damage';

export type BuildingId =
  | 'stronghold' | 'generator' | 'depot' | 'barracks' | 'mechanis' | 'foundry' | 'turret' | 'relay' | 'research'
  | 'wall' | 'gate' | 'listening' | 'minefield' | 'bunker' | 'armoury' | 'hospital' | 'sensor' | 'shield' | 'missile' | 'beacon'
  | 'hive' | 'spire' | 'nest' | 'brood' | 'maw' | 'vat' | 'spine'
  | 'thornwall' | 'sporenode' | 'sporemine' | 'evolution' | 'pool' | 'organ' | 'acidspire' | 'portal'
  | 'derelict';

/** Functional role — lets the AI and rules treat both factions uniformly. */
export type BuildingRole =
  | 'hq' | 'power' | 'supply' | 'infantry' | 'heavy' | 'vehicles' | 'defense' | 'relay' | 'research'
  | 'wall' | 'gate' | 'outpost' | 'mine' | 'bunker' | 'armoury' | 'hospital' | 'sensor' | 'shield' | 'longrange' | 'beacon';

/** Build-menu page a structure appears on. */
export type BuildCategory = 'economy' | 'military' | 'defense' | 'tech';
export const BUILD_CATEGORIES: BuildCategory[] = ['economy', 'military', 'defense', 'tech'];

export interface BuildingDef {
  id: BuildingId;
  name: string;
  faction: Faction;
  role: BuildingRole;
  category: BuildCategory;
  /** Tech tier the owner must reach before it can be built. */
  tier: Tier;
  /** Supply (population cap) it provides once complete. */
  supply?: number;
  cost: Resources;
  fluxGen: number;
  hp: number;
  buildTime: number;
  /** Footprint size in tiles (square). */
  size: number;
  /** Visual height of the structure in screen px (2.5D extrusion; no gameplay effect). */
  height: number;
  /** Tiles around this building in which new buildings may be placed. */
  buildRadius: number;
  requires: BuildingRole[];
  produces: UnitId[];
  attack?: {
    damage: number; range: number; cooldown: number; damageType: DamageType;
    splash?: number; minRange?: number; projectile?: 'bullet' | 'spine' | 'rocket' | 'acidlob';
  };
  /** Reveals burrowed enemies within this radius. */
  detector?: number;
  /** Fog-of-war vision radius override (px). */
  vision?: number;
  /** Placement grid in tiles (defaults to BUILD.snap). */
  snap?: number;
  /** Engineers can raise it anywhere (no build radius); it then needs a builder standing by to progress. */
  fieldBuild?: boolean;
  /** Must be placed inside a capture zone the owner holds (one per point). */
  onPoint?: boolean;
  /** Extra Scrip/s for the point it stands on. */
  incomeBonus?: number;
  /** Low barrier: blocks movement and shelters the tiles next to it. */
  wall?: boolean;
  /** Opens for its owner's units. */
  gate?: boolean;
  /** Number of infantry squads that can garrison it. */
  garrison?: number;
  /** Heals nearby soldiers; `revive` = seconds per fallen member restored (costs Scrip). */
  heal?: { radius: number; hps: number; revive?: number };
  /** Activated dome that stops ranged shots; costs Flux and has a cooldown. */
  shield?: { radius: number; duration: number; cooldown: number; cost: number };
  /** Flux drained per second while it stands. */
  upkeep?: number;
  /** Hidden explosive trap. */
  mine?: { trigger: number; damage: number; splash: number; damageType: DamageType };
  /** Invisible to the enemy unless detected. */
  stealth?: boolean;
  /** Map feature captured rather than built (never in a build menu). */
  neutral?: boolean;
  /** HP regenerated per second (Null Horde structures). */
  regen?: number;
  description: string;
}

const Z: Resources = { scrip: 0, flux: 0 };

export const BUILDING_DEFS: Record<BuildingId, BuildingDef> = {
  stronghold: {
    id: 'stronghold', name: 'Command Bastion', faction: 'ironvoid', role: 'hq', category: 'economy', tier: 1, cost: Z, fluxGen: 0, hp: 3000,
    buildTime: 0, size: 4, height: 96, buildRadius: 12, requires: [], produces: ['commander', 'engineer'], supply: 10,
    description: 'Starting HQ. If it falls, the crusade is lost.',
  },
  generator: {
    id: 'generator', name: 'Flux Conduit', faction: 'ironvoid', role: 'power', category: 'economy', tier: 1, cost: { scrip: 100, flux: 0 },
    fluxGen: 10, hp: 600, buildTime: 10, size: 3, height: 54, buildRadius: 10, requires: [], produces: [],
    description: 'Power source. +10 Flux/sec. Required for most buildings.',
  },
  depot: {
    id: 'depot', name: 'Supply Depot', faction: 'ironvoid', role: 'supply', category: 'economy', tier: 1, cost: { scrip: 100, flux: 0 },
    fluxGen: 0, hp: 500, buildTime: 12, size: 2, height: 46, buildRadius: 6, requires: [], produces: [], supply: 8,
    description: 'Stores rations and munitions. +8 supply.',
  },
  barracks: {
    id: 'barracks', name: 'Assault Barracks', faction: 'ironvoid', role: 'infantry', category: 'military', tier: 1, cost: { scrip: 150, flux: 50 },
    fluxGen: 0, hp: 1000, buildTime: 15, size: 3, height: 62, buildRadius: 10, requires: ['power'], produces: ['rifleman', 'ranger', 'breacher', 'marksman'],
    description: 'Trains Riflemen, Rangers, Breachers and Marksmen.',
  },
  mechanis: {
    id: 'mechanis', name: 'Mechanis Bay', faction: 'ironvoid', role: 'heavy', category: 'military', tier: 2, cost: { scrip: 200, flux: 100 },
    fluxGen: 0, hp: 1200, buildTime: 20, size: 3, height: 70, buildRadius: 10, requires: ['power', 'infantry'], produces: ['heavy'],
    description: 'Trains Iron Guard heavy squads.',
  },
  foundry: {
    id: 'foundry', name: 'Vehicle Foundry', faction: 'ironvoid', role: 'vehicles', category: 'military', tier: 2, cost: { scrip: 250, flux: 150 },
    fluxGen: 0, hp: 1500, buildTime: 25, size: 4, height: 78, buildRadius: 10, requires: ['power', 'infantry'],
    produces: ['buggy', 'apc', 'tank', 'artillery'], description: 'Assembles buggies, transports, tanks and siege walkers.',
  },
  turret: {
    id: 'turret', name: 'Void Turret', faction: 'ironvoid', role: 'defense', category: 'defense', tier: 1, cost: { scrip: 75, flux: 50 },
    fluxGen: 0, hp: 700, buildTime: 10, size: 2, height: 40, buildRadius: 6, requires: ['power'], produces: [],
    attack: { damage: 22, range: 280, cooldown: 0.9, damageType: 'bullet' },
    description: 'Static defense. Auto-attacks enemies in range.',
  },
  relay: {
    id: 'relay', name: 'Signal Relay', faction: 'ironvoid', role: 'relay', category: 'economy', tier: 1, cost: { scrip: 100, flux: 75 },
    fluxGen: 0, hp: 500, buildTime: 12, size: 2, height: 84, buildRadius: 16, requires: ['power'], produces: [],
    description: 'Extends the buildable area.',
  },
  research: {
    id: 'research', name: 'Void Foundry', faction: 'ironvoid', role: 'research', category: 'tech', tier: 2, cost: { scrip: 250, flux: 150 },
    fluxGen: 0, hp: 1000, buildTime: 25, size: 3, height: 72, buildRadius: 10, requires: ['power', 'infantry'], produces: [],
    description: 'Unlocks upgrades.',
  },
  wall: {
    id: 'wall', name: 'Barricade', faction: 'ironvoid', role: 'wall', category: 'defense', tier: 1, cost: { scrip: 15, flux: 0 },
    fluxGen: 0, hp: 450, buildTime: 4, size: 1, height: 26, buildRadius: 0, requires: [], produces: [], snap: 1,
    fieldBuild: true, wall: true, description: 'Cheap plasteel barricade. Blocks movement; troops behind it are in cover. Shift-click to lay a line.',
  },
  gate: {
    id: 'gate', name: 'Blast Gate', faction: 'ironvoid', role: 'gate', category: 'defense', tier: 1, cost: { scrip: 40, flux: 0 },
    fluxGen: 0, hp: 800, buildTime: 6, size: 2, height: 40, buildRadius: 0, requires: [], produces: [], snap: 1,
    fieldBuild: true, wall: true, gate: true, description: 'A gate in your barricades that opens only for your own troops.',
  },
  listening: {
    id: 'listening', name: 'Listening Post', faction: 'ironvoid', role: 'outpost', category: 'economy', tier: 1, cost: { scrip: 80, flux: 20 },
    fluxGen: 0, hp: 600, buildTime: 10, size: 2, height: 64, buildRadius: 0, requires: [], produces: [], snap: 1,
    fieldBuild: true, onPoint: true, incomeBonus: 10, attack: { damage: 10, range: 220, cooldown: 1, damageType: 'bullet' },
    description: 'Fortifies a captured Void-Nexus: +10 Scrip/s, a light gun, and the enemy captures it half as fast.',
  },
  minefield: {
    id: 'minefield', name: 'Tank Mines', faction: 'ironvoid', role: 'mine', category: 'defense', tier: 1, cost: { scrip: 40, flux: 10 },
    fluxGen: 0, hp: 60, buildTime: 4, size: 1, height: 6, buildRadius: 0, requires: [], produces: [], snap: 1,
    fieldBuild: true, stealth: true, mine: { trigger: 40, damage: 170, splash: 64, damageType: 'explosive' },
    description: 'Hidden explosives. Detonate under the first enemy to step close. Revealed by detectors.',
  },
  bunker: {
    id: 'bunker', name: 'Bunker', faction: 'ironvoid', role: 'bunker', category: 'defense', tier: 2, cost: { scrip: 150, flux: 0 },
    fluxGen: 0, hp: 1500, buildTime: 15, size: 2, height: 40, buildRadius: 6, requires: [], produces: [], snap: 2,
    fieldBuild: true, garrison: 1,
    description: 'Ferrocrete strongpoint. One infantry squad inside fires safely (+40 range). Flamers can burn them out.',
  },
  armoury: {
    id: 'armoury', name: 'Armoury', faction: 'ironvoid', role: 'armoury', category: 'military', tier: 2, cost: { scrip: 200, flux: 100 },
    fluxGen: 0, hp: 1000, buildTime: 20, size: 3, height: 60, buildRadius: 10, requires: ['power'], produces: [],
    description: 'Forges wargear and weapon upgrades for your infantry and commander.',
  },
  hospital: {
    id: 'hospital', name: 'Field Hospital', faction: 'ironvoid', role: 'hospital', category: 'tech', tier: 2, cost: { scrip: 150, flux: 80 },
    fluxGen: 0, hp: 900, buildTime: 18, size: 3, height: 50, buildRadius: 10, requires: ['power'], produces: [],
    heal: { radius: 260, hps: 4, revive: 12 },
    description: 'Heals infantry nearby and slowly returns fallen soldiers to their squads (costs Scrip).',
  },
  sensor: {
    id: 'sensor', name: 'Sensor Array', faction: 'ironvoid', role: 'sensor', category: 'tech', tier: 3, cost: { scrip: 150, flux: 150 },
    fluxGen: 0, hp: 600, buildTime: 15, size: 2, height: 96, buildRadius: 8, requires: ['power'], produces: [],
    detector: 900, vision: 800, description: 'Wide-area auspex. Huge vision radius and reveals burrowed enemies and mines within 900 px.',
  },
  shield: {
    id: 'shield', name: 'Shield Projector', faction: 'ironvoid', role: 'shield', category: 'tech', tier: 3, cost: { scrip: 200, flux: 200 },
    fluxGen: 0, hp: 800, buildTime: 20, size: 2, height: 72, buildRadius: 8, requires: ['power'], produces: [],
    shield: { radius: 280, duration: 12, cooldown: 40, cost: 60 }, upkeep: 3,
    description: 'Raises a void dome that stops every ranged shot fired into it for 12 s. Drains 3 Flux/s.',
  },
  missile: {
    id: 'missile', name: 'Missile Battery', faction: 'ironvoid', role: 'longrange', category: 'defense', tier: 3, cost: { scrip: 200, flux: 150 },
    fluxGen: 0, hp: 900, buildTime: 18, size: 2, height: 58, buildRadius: 6, requires: ['power'], produces: [],
    attack: { damage: 70, range: 560, cooldown: 4, damageType: 'explosive', splash: 50, minRange: 150, projectile: 'rocket' },
    description: 'Long-range rocket launcher. Splash damage, cannot hit targets closer than 150 px.',
  },
  beacon: {
    id: 'beacon', name: 'Orbital Beacon', faction: 'ironvoid', role: 'beacon', category: 'tech', tier: 3, cost: { scrip: 300, flux: 250 },
    fluxGen: 0, hp: 1200, buildTime: 30, size: 3, height: 110, buildRadius: 10, requires: ['power'], produces: [],
    description: 'Uplink to the fleet in orbit. Unlocks the Commander\'s Void Barrage and drop-pod reinforcements.',
  },
  hive: {
    id: 'hive', name: 'Null Hive', faction: 'nullhorde', role: 'hq', category: 'economy', tier: 1, cost: Z, fluxGen: 0, hp: 3000, buildTime: 0,
    size: 4, height: 84, buildRadius: 12, requires: [], produces: ['overlord', 'shaman'], supply: 10, regen: 4, description: 'Heart of the swarm.',
  },
  spire: {
    id: 'spire', name: 'Flux Spire', faction: 'nullhorde', role: 'power', category: 'economy', tier: 1, cost: { scrip: 100, flux: 0 }, fluxGen: 10,
    hp: 500, buildTime: 10, size: 3, height: 96, buildRadius: 10, requires: [], produces: [], regen: 2,
    description: 'Siphons flux from the void.',
  },
  nest: {
    id: 'nest', name: 'Brood Nest', faction: 'nullhorde', role: 'supply', category: 'economy', tier: 1, cost: { scrip: 100, flux: 0 },
    fluxGen: 0, hp: 450, buildTime: 12, size: 2, height: 40, buildRadius: 6, requires: [], produces: [], supply: 8, regen: 2,
    description: 'A pulsing egg-clutch. +8 supply.',
  },
  brood: {
    id: 'brood', name: 'Brood Pit', faction: 'nullhorde', role: 'infantry', category: 'military', tier: 1, cost: { scrip: 150, flux: 50 },
    fluxGen: 0, hp: 900, buildTime: 15, size: 3, height: 38, buildRadius: 10, requires: ['power'], produces: ['crawler', 'spitter', 'leaper'],
    regen: 3, description: 'Spawns Crawlers, Spitters and Leapers.',
  },
  maw: {
    id: 'maw', name: 'Gestation Maw', faction: 'nullhorde', role: 'heavy', category: 'military', tier: 2, cost: { scrip: 200, flux: 100 },
    fluxGen: 0, hp: 1100, buildTime: 20, size: 3, height: 60, buildRadius: 10, requires: ['power', 'infantry'],
    produces: ['behemoth', 'burrower'], regen: 3, description: 'Births Behemoths and Burrowers.',
  },
  vat: {
    id: 'vat', name: 'Gestation Vat', faction: 'nullhorde', role: 'vehicles', category: 'military', tier: 2, cost: { scrip: 250, flux: 150 },
    fluxGen: 0, hp: 1400, buildTime: 25, size: 4, height: 70, buildRadius: 10, requires: ['power', 'infantry'],
    produces: ['skimmer', 'carrier', 'siegebeast', 'titan'], regen: 4, description: 'A womb-pool that grows skimmers, carriers, siege beasts and titans.',
  },
  spine: {
    id: 'spine', name: 'Spine Tower', faction: 'nullhorde', role: 'defense', category: 'defense', tier: 1, cost: { scrip: 75, flux: 50 },
    fluxGen: 0, hp: 650, buildTime: 10, size: 2, height: 54, buildRadius: 6, requires: ['power'], produces: [],
    attack: { damage: 20, range: 260, cooldown: 0.9, damageType: 'bullet' }, regen: 2, description: 'Hurls bone spines.',
  },
  thornwall: {
    id: 'thornwall', name: 'Thorn Wall', faction: 'nullhorde', role: 'wall', category: 'defense', tier: 1, cost: { scrip: 15, flux: 0 },
    fluxGen: 0, hp: 400, buildTime: 4, size: 1, height: 30, buildRadius: 2, requires: [], produces: [], snap: 1, regen: 1,
    wall: true, description: 'A hedge of bone thorns. Blocks movement and shelters the swarm.',
  },
  sporenode: {
    id: 'sporenode', name: 'Spore Node', faction: 'nullhorde', role: 'outpost', category: 'economy', tier: 1, cost: { scrip: 80, flux: 20 },
    fluxGen: 0, hp: 550, buildTime: 10, size: 2, height: 60, buildRadius: 0, requires: [], produces: [], snap: 1, regen: 2,
    onPoint: true, incomeBonus: 10, attack: { damage: 10, range: 220, cooldown: 1, damageType: 'acid', projectile: 'spine' },
    description: 'Roots into a held Void-Nexus: +10 Scrip/s, spits spines, halves the enemy\'s capture speed.',
  },
  sporemine: {
    id: 'sporemine', name: 'Spore Mine', faction: 'nullhorde', role: 'mine', category: 'defense', tier: 1, cost: { scrip: 40, flux: 10 },
    fluxGen: 0, hp: 60, buildTime: 4, size: 1, height: 10, buildRadius: 12, requires: [], produces: [], snap: 1,
    stealth: true, mine: { trigger: 44, damage: 140, splash: 72, damageType: 'acid' },
    description: 'A buried pod that bursts into acid when prey walks by. Revealed by detectors.',
  },
  evolution: {
    id: 'evolution', name: 'Evolution Pit', faction: 'nullhorde', role: 'research', category: 'tech', tier: 2, cost: { scrip: 250, flux: 150 },
    fluxGen: 0, hp: 1000, buildTime: 25, size: 3, height: 64, buildRadius: 10, requires: ['power', 'infantry'], produces: [], regen: 3,
    description: 'Mutates the swarm: sharper claws, thicker carapace, faster growth.',
  },
  pool: {
    id: 'pool', name: 'Healing Pool', faction: 'nullhorde', role: 'hospital', category: 'tech', tier: 2, cost: { scrip: 150, flux: 80 },
    fluxGen: 0, hp: 850, buildTime: 18, size: 3, height: 36, buildRadius: 10, requires: ['power'], produces: [], regen: 3,
    heal: { radius: 260, hps: 5, revive: 12 }, description: 'Regrows the flesh of nearby beasts and spawns replacements for the fallen.',
  },
  organ: {
    id: 'organ', name: 'Sensory Organ', faction: 'nullhorde', role: 'sensor', category: 'tech', tier: 3, cost: { scrip: 150, flux: 150 },
    fluxGen: 0, hp: 550, buildTime: 15, size: 2, height: 90, buildRadius: 8, requires: ['power'], produces: [], regen: 2,
    detector: 900, vision: 800, description: 'A towering eye-stalk. Sees far and exposes hidden enemies.',
  },
  acidspire: {
    id: 'acidspire', name: 'Acid Spire', faction: 'nullhorde', role: 'longrange', category: 'defense', tier: 3, cost: { scrip: 200, flux: 150 },
    fluxGen: 0, hp: 900, buildTime: 18, size: 2, height: 80, buildRadius: 6, requires: ['power'], produces: [], regen: 2,
    attack: { damage: 60, range: 520, cooldown: 3.5, damageType: 'acid', splash: 55, minRange: 140, projectile: 'acidlob' },
    description: 'Long-range spire that arcs globs of acid onto attackers.',
  },
  portal: {
    id: 'portal', name: 'Hive Portal', faction: 'nullhorde', role: 'beacon', category: 'tech', tier: 3, cost: { scrip: 300, flux: 250 },
    fluxGen: 0, hp: 1200, buildTime: 30, size: 3, height: 100, buildRadius: 10, requires: ['power'], produces: [], regen: 4,
    description: 'A rift in the void that lets the swarm burst out anywhere. Unlocks brood drops and the Overlord\'s Spawn Brood.',
  },
  derelict: {
    id: 'derelict', name: 'Derelict Turret', faction: 'ironvoid', role: 'defense', category: 'defense', tier: 1, cost: Z,
    fluxGen: 0, hp: 900, buildTime: 0, size: 2, height: 44, buildRadius: 0, requires: [], produces: [], neutral: true,
    attack: { damage: 26, range: 300, cooldown: 1, damageType: 'bullet' },
    description: 'An ancient automated gun. Stand beside it for 6 seconds to wake it for your side.',
  },
};

/** Buildings the player may construct, in build-menu order. */
export const PLAYER_BUILD_LIST: BuildingId[] = buildList('ironvoid');

export function buildList(faction: Faction): BuildingId[] {
  return (Object.values(BUILDING_DEFS) as BuildingDef[]).filter((d) => d.faction === faction && d.role !== 'hq' && !d.neutral).map((d) => d.id);
}

export function defForRole(faction: Faction, role: BuildingRole): BuildingDef | undefined {
  return Object.values(BUILDING_DEFS).find((d) => d.faction === faction && d.role === role);
}
