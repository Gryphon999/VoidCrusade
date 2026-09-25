import { Resources } from '../systems/ResourceSystem';
import { Faction, Tier, UnitId } from '../units/UnitDefs';
import { DamageType } from '../units/Damage';

export type BuildingId =
  | 'stronghold' | 'generator' | 'depot' | 'barracks' | 'mechanis' | 'turret' | 'relay' | 'research'
  | 'hive' | 'spire' | 'nest' | 'brood' | 'maw' | 'spine';

/** Functional role — lets the AI and rules treat both factions uniformly. */
export type BuildingRole = 'hq' | 'power' | 'supply' | 'infantry' | 'heavy' | 'defense' | 'relay' | 'research';

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
  attack?: { damage: number; range: number; cooldown: number; damageType: DamageType };
  /** HP regenerated per second (Null Horde structures). */
  regen?: number;
  description: string;
}

const Z: Resources = { scrip: 0, flux: 0 };

export const BUILDING_DEFS: Record<BuildingId, BuildingDef> = {
  stronghold: {
    id: 'stronghold', name: 'Command Bastion', faction: 'ironvoid', role: 'hq', category: 'economy', tier: 1, cost: Z, fluxGen: 0, hp: 3000,
    buildTime: 0, size: 4, height: 96, buildRadius: 12, requires: [], produces: ['commander'], supply: 10,
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
    fluxGen: 0, hp: 1000, buildTime: 15, size: 3, height: 62, buildRadius: 10, requires: ['power'], produces: ['rifleman'],
    description: 'Trains Void Riflemen squads.',
  },
  mechanis: {
    id: 'mechanis', name: 'Mechanis Bay', faction: 'ironvoid', role: 'heavy', category: 'military', tier: 2, cost: { scrip: 200, flux: 100 },
    fluxGen: 0, hp: 1200, buildTime: 20, size: 3, height: 70, buildRadius: 10, requires: ['power', 'infantry'], produces: ['heavy'],
    description: 'Trains Iron Guard heavy squads.',
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
  hive: {
    id: 'hive', name: 'Null Hive', faction: 'nullhorde', role: 'hq', category: 'economy', tier: 1, cost: Z, fluxGen: 0, hp: 3000, buildTime: 0,
    size: 4, height: 84, buildRadius: 12, requires: [], produces: [], supply: 10, regen: 4, description: 'Heart of the swarm.',
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
    fluxGen: 0, hp: 900, buildTime: 15, size: 3, height: 38, buildRadius: 10, requires: ['power'], produces: ['crawler'],
    regen: 3, description: 'Spawns Void Crawlers.',
  },
  maw: {
    id: 'maw', name: 'Gestation Maw', faction: 'nullhorde', role: 'heavy', category: 'military', tier: 2, cost: { scrip: 200, flux: 100 },
    fluxGen: 0, hp: 1100, buildTime: 20, size: 3, height: 60, buildRadius: 10, requires: ['power', 'infantry'],
    produces: ['behemoth'], regen: 3, description: 'Births Null Behemoths.',
  },
  spine: {
    id: 'spine', name: 'Spine Tower', faction: 'nullhorde', role: 'defense', category: 'defense', tier: 1, cost: { scrip: 75, flux: 50 },
    fluxGen: 0, hp: 650, buildTime: 10, size: 2, height: 54, buildRadius: 6, requires: ['power'], produces: [],
    attack: { damage: 20, range: 260, cooldown: 0.9, damageType: 'bullet' }, regen: 2, description: 'Hurls bone spines.',
  },
};

/** Buildings the player may construct, in build-menu order. */
export const PLAYER_BUILD_LIST: BuildingId[] = ['generator', 'depot', 'relay', 'barracks', 'mechanis', 'turret', 'research'];

export function buildList(faction: Faction): BuildingId[] {
  return (Object.values(BUILDING_DEFS) as BuildingDef[]).filter((d) => d.faction === faction && d.role !== 'hq').map((d) => d.id);
}

export function defForRole(faction: Faction, role: BuildingRole): BuildingDef | undefined {
  return Object.values(BUILDING_DEFS).find((d) => d.faction === faction && d.role === role);
}
