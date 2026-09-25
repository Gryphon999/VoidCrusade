import { Resources } from '../systems/ResourceSystem';
import { Faction, UnitId } from '../units/UnitDefs';

export type BuildingId =
  | 'stronghold' | 'generator' | 'barracks' | 'mechanis' | 'turret' | 'relay' | 'research'
  | 'hive' | 'spire' | 'brood' | 'maw' | 'spine';

/** Functional role — lets the AI and rules treat both factions uniformly. */
export type BuildingRole = 'hq' | 'power' | 'infantry' | 'heavy' | 'defense' | 'relay' | 'research';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  faction: Faction;
  role: BuildingRole;
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
  attack?: { damage: number; range: number; cooldown: number };
  /** HP regenerated per second (Null Horde structures). */
  regen?: number;
  hotkey?: string;
  description: string;
}

const Z: Resources = { scrip: 0, flux: 0 };

export const BUILDING_DEFS: Record<BuildingId, BuildingDef> = {
  stronghold: {
    id: 'stronghold', name: 'Command Bastion', faction: 'ironvoid', role: 'hq', cost: Z, fluxGen: 0, hp: 3000,
    buildTime: 0, size: 4, height: 96, buildRadius: 12, requires: [], produces: ['commander'],
    description: 'Starting HQ. If it falls, the crusade is lost.',
  },
  generator: {
    id: 'generator', name: 'Flux Conduit', faction: 'ironvoid', role: 'power', cost: { scrip: 100, flux: 0 },
    fluxGen: 10, hp: 600, buildTime: 10, size: 3, height: 54, buildRadius: 10, requires: [], produces: [], hotkey: 'ONE',
    description: 'Power source. +10 Flux/sec. Required for most buildings.',
  },
  barracks: {
    id: 'barracks', name: 'Assault Barracks', faction: 'ironvoid', role: 'infantry', cost: { scrip: 150, flux: 50 },
    fluxGen: 0, hp: 1000, buildTime: 15, size: 3, height: 62, buildRadius: 10, requires: ['power'], produces: ['rifleman'],
    hotkey: 'TWO', description: 'Trains Void Riflemen squads.',
  },
  mechanis: {
    id: 'mechanis', name: 'Mechanis Bay', faction: 'ironvoid', role: 'heavy', cost: { scrip: 200, flux: 100 },
    fluxGen: 0, hp: 1200, buildTime: 20, size: 3, height: 70, buildRadius: 10, requires: ['power', 'infantry'], produces: ['heavy'],
    hotkey: 'THREE', description: 'Trains Iron Guard heavy squads.',
  },
  turret: {
    id: 'turret', name: 'Void Turret', faction: 'ironvoid', role: 'defense', cost: { scrip: 75, flux: 50 },
    fluxGen: 0, hp: 700, buildTime: 10, size: 2, height: 40, buildRadius: 6, requires: ['power'], produces: [],
    attack: { damage: 22, range: 280, cooldown: 0.9 }, hotkey: 'FOUR',
    description: 'Static defense. Auto-attacks enemies in range.',
  },
  relay: {
    id: 'relay', name: 'Signal Relay', faction: 'ironvoid', role: 'relay', cost: { scrip: 100, flux: 75 },
    fluxGen: 0, hp: 500, buildTime: 12, size: 2, height: 84, buildRadius: 16, requires: ['power'], produces: [], hotkey: 'FIVE',
    description: 'Extends the buildable area.',
  },
  research: {
    id: 'research', name: 'Void Foundry', faction: 'ironvoid', role: 'research', cost: { scrip: 250, flux: 150 },
    fluxGen: 0, hp: 1000, buildTime: 25, size: 3, height: 72, buildRadius: 10, requires: ['power', 'infantry'], produces: [],
    hotkey: 'SIX', description: 'Unlocks upgrades.',
  },
  hive: {
    id: 'hive', name: 'Null Hive', faction: 'nullhorde', role: 'hq', cost: Z, fluxGen: 0, hp: 3000, buildTime: 0,
    size: 4, height: 84, buildRadius: 12, requires: [], produces: [], regen: 4, description: 'Heart of the swarm.',
  },
  spire: {
    id: 'spire', name: 'Flux Spire', faction: 'nullhorde', role: 'power', cost: { scrip: 100, flux: 0 }, fluxGen: 10,
    hp: 500, buildTime: 10, size: 3, height: 96, buildRadius: 10, requires: [], produces: [], regen: 2,
    description: 'Siphons flux from the void.',
  },
  brood: {
    id: 'brood', name: 'Brood Pit', faction: 'nullhorde', role: 'infantry', cost: { scrip: 150, flux: 50 },
    fluxGen: 0, hp: 900, buildTime: 15, size: 3, height: 38, buildRadius: 10, requires: ['power'], produces: ['crawler'],
    regen: 3, description: 'Spawns Void Crawlers.',
  },
  maw: {
    id: 'maw', name: 'Gestation Maw', faction: 'nullhorde', role: 'heavy', cost: { scrip: 200, flux: 100 },
    fluxGen: 0, hp: 1100, buildTime: 20, size: 3, height: 60, buildRadius: 10, requires: ['power', 'infantry'],
    produces: ['behemoth'], regen: 3, description: 'Births Null Behemoths.',
  },
  spine: {
    id: 'spine', name: 'Spine Tower', faction: 'nullhorde', role: 'defense', cost: { scrip: 75, flux: 50 },
    fluxGen: 0, hp: 650, buildTime: 10, size: 2, height: 54, buildRadius: 6, requires: ['power'], produces: [],
    attack: { damage: 20, range: 260, cooldown: 0.9 }, regen: 2, description: 'Hurls bone spines.',
  },
};

/** Buildings the player may construct, in toolbar order. */
export const PLAYER_BUILD_LIST: BuildingId[] = ['generator', 'barracks', 'mechanis', 'turret', 'relay', 'research'];

export function defForRole(faction: Faction, role: BuildingRole): BuildingDef | undefined {
  return Object.values(BUILDING_DEFS).find((d) => d.faction === faction && d.role === role);
}
