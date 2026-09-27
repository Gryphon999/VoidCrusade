import { Difficulty } from '../config';
import { BuildingRole } from '../buildings/BuildingDefs';
import { Personality } from './Personality';

/**
 * How well the AI plays. No difficulty gets extra income: harder AIs think faster, queue more,
 * counter-pick, micro (retreat, focus fire, abilities), scout and harass. Easier ones also keep
 * a smaller army and a longer truce before their first attack.
 */
export interface SkillProfile {
  /** Seconds between decisions. */
  think: number;
  /** Units queued per production building. */
  queue: number;
  /** Chance per AI tick that a ready ability is actually used. */
  abilityUse: number;
  /** 0 = random unit picks, 1 = always the best counter to what it has scouted. */
  counter: number;
  /** Squads retreat below this fraction of health (0 = never). */
  retreatHp: number;
  focusFire: boolean;
  garrison: boolean;
  /** Keep a scout squad walking the map. */
  scout: boolean;
  /** Send fast squads at undefended points. */
  harass: boolean;
  /** React to enemy drops and attacks on held points. */
  reactive: boolean;
  research: boolean;
  /** Uses its own Portal / Beacon drops. */
  drops: boolean;
  /** Seconds between attack waves (before personality). */
  waveEvery: number;
  /** Multiplier on the army size a wave waits for. */
  waveSize: number;
  /**
   * Seconds between two construction orders (slow hands). A person places a building, looks at
   * the field and comes back; these pauses keep the AI from out-building a human at the same level.
   */
  buildDelay: number;
  /**
   * Seconds of truce at the start of a battle: until then the AI takes the free points on its own
   * half, guards them and builds, but sends nothing at the enemy's points or stronghold.
   */
  peace: number;
  /** Squads posted at its own points, nearest to the enemy first. */
  guards: number;
  /** Share of its supply the AI lets itself fill with troops. */
  armyCap: number;
  /** Seconds between two training orders. */
  trainEvery: number;
}

export const SKILL: Record<Difficulty, SkillProfile> = {
  easy: {
    think: 2.5, queue: 1, abilityUse: 0.2, counter: 0, retreatHp: 0, focusFire: false, garrison: false, scout: false,
    harass: false, reactive: false, research: false, drops: false, waveEvery: 110, waveSize: 0.8, buildDelay: 16, peace: 720, guards: 2, armyCap: 0.55, trainEvery: 14,
  },
  normal: {
    think: 1.5, queue: 2, abilityUse: 0.55, counter: 0.5, retreatHp: 0.2, focusFire: false, garrison: true, scout: false,
    harass: false, reactive: true, research: true, drops: false, waveEvery: 75, waveSize: 1, buildDelay: 9, peace: 600, guards: 3, armyCap: 0.8, trainEvery: 7,
  },
  hard: {
    think: 0.9, queue: 3, abilityUse: 0.9, counter: 0.8, retreatHp: 0.3, focusFire: true, garrison: true, scout: true,
    harass: true, reactive: true, research: true, drops: true, waveEvery: 55, waveSize: 1, buildDelay: 4, peace: 420, guards: 3, armyCap: 1, trainEvery: 2,
  },
  brutal: {
    think: 0.6, queue: 4, abilityUse: 1, counter: 1, retreatHp: 0.32, focusFire: true, garrison: true, scout: true,
    harass: true, reactive: true, research: true, drops: true, waveEvery: 40, waveSize: 0.85, buildDelay: 1.5, peace: 240, guards: 4, armyCap: 1, trainEvery: 0,
  },
};

/** How the AI likes to play, independent of skill. */
export interface Style {
  /** Build order (roles), run once, then the AI reacts. */
  order: BuildingRole[];
  /** Squads kept at home. */
  homeGuard: number;
  /** Army supply a wave waits for. */
  waveSupply: number;
  /** Attack-wave interval multiplier. */
  waveMult: number;
  /** Extra defensive structures per held point / at home. */
  towers: number;
  /** Walls around the base. */
  walls: boolean;
  /** Share of military supply it wants in vehicles and monsters once available. */
  heavyShare: number;
  /** Goes straight for the HQ when ahead. */
  allIn: boolean;
}

export const STYLE: Record<Personality, Style> = {
  rusher: {
    order: ['power', 'infantry', 'supply', 'infantry', 'power', 'supply', 'heavy', 'vehicles', 'supply', 'defense', 'research', 'supply', 'hospital', 'beacon'],
    homeGuard: 1, waveSupply: 10, waveMult: 0.65, towers: 0, walls: false, heavyShare: 0.25, allIn: true,
  },
  turtler: {
    // Army first even for turtlers: towers without a field army lose the map to an early rush.
    order: ['power', 'infantry', 'supply', 'power', 'defense', 'supply', 'heavy', 'defense', 'research', 'supply', 'vehicles', 'defense', 'hospital',
      'supply', 'longrange', 'sensor', 'defense', 'beacon'],
    homeGuard: 3, waveSupply: 26, waveMult: 1.5, towers: 2, walls: true, heavyShare: 0.45, allIn: false,
  },
  balanced: {
    order: ['power', 'power', 'infantry', 'supply', 'defense', 'power', 'supply', 'heavy', 'research', 'vehicles', 'supply', 'hospital', 'infantry',
      'longrange', 'defense', 'sensor', 'supply', 'beacon'],
    homeGuard: 2, waveSupply: 16, waveMult: 1, towers: 1, walls: false, heavyShare: 0.35, allIn: true,
  },
};
