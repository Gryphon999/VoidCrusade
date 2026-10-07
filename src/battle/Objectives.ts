import type { UnitId } from '../units/UnitDefs';

/**
 * Rules of the mission objectives (Hold the Line, Burn the Nests, Evacuation): constants and small
 * pure step functions. VictorySystem wires them to the battle; the tests run them in Node.
 */

// ---- Hold the Line ------------------------------------------------------------------------

/** Seconds of owning the position (in all) that win the battle. */
export const HOLD_TIME = 240;
/** The meter drains this many times faster than it fills while the enemy owns the position. */
export const HOLD_DRAIN = 2;

/** One tick of the hold meter: fills under the player, drains under the enemy, freezes when neutral. */
export function holdStep(progress: number, owner: 'player' | 'enemy' | null, dt: number): number {
  if (owner === 'player') return Math.min(HOLD_TIME, progress + dt);
  if (owner === 'enemy') return Math.max(0, progress - dt * HOLD_DRAIN);
  return progress;
}

// ---- Burn the Nests -----------------------------------------------------------------------

export const NEST_COUNT = 4;
export const NEST_HP = 2000;
/** Seconds between spawns at each living nest, and the grace before the first one. */
export const NEST_SPAWN_EVERY = 40;
export const NEST_FIRST_SPAWN = 60;
/** The battle is lost when the clock reaches this (seconds). */
export const NEST_TIME_LIMIT = 900;

/** What a nest can spawn at a given battle second: the brood grows nastier with time. */
export function nestPool(elapsed: number): UnitId[] {
  const pool: UnitId[] = ['crawler', 'crawler', 'spitter'];
  if (elapsed >= 180) pool.push('leaper', 'shaman');
  if (elapsed >= 360) pool.push('behemoth', 'burrower');
  return pool;
}

/**
 * Where the nests stand: the `n` capture points nearest the enemy corner, never the first point
 * (the centre). Points are given in any unit; distances are compared, not measured.
 */
export function pickNestPoints<T extends { x: number; y: number }>(points: readonly T[], enemyCorner: { x: number; y: number }, n = NEST_COUNT): T[] {
  return points.slice(1)
    .map((p) => ({ p, d: Math.hypot(p.x - enemyCorner.x, p.y - enemyCorner.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((e) => e.p);
}

// ---- Evacuation ---------------------------------------------------------------------------

/** Battle second when the transport arrives and the landing zone opens. */
export const EVAC_ARRIVAL = 300;
/** Squads (besides the Commander) that must be in the zone. */
export const EVAC_SQUADS = 3;
/** Seconds the party must stay in the zone to board. */
export const EVAC_LOAD = 10;
/** Radius of the landing zone (px). */
export const EVAC_ZONE = 190;

/** One tick of the boarding meter: fills while everyone needed is in the zone, drains otherwise. */
export function evacStep(load: number, boarding: boolean, dt: number): number {
  return boarding ? Math.min(EVAC_LOAD, load + dt) : Math.max(0, load - dt);
}

/** Whether a party is ready to board: the Commander present plus enough other squads. */
export function evacReady(commanderInZone: boolean, othersInZone: number): boolean {
  return commanderInZone && othersInZone >= EVAC_SQUADS;
}

// ---- King of the Hill ---------------------------------------------------------------------

/** Points a side needs to win, and points per second for owning the hill. */
export const KOTH_GOAL = 300;
export const KOTH_RATE = 1;

/** One tick of the hill: the owner scores, a neutral hill scores for nobody. */
export function kothStep(score: { player: number; enemy: number }, owner: 'player' | 'enemy' | null, dt: number): { player: number; enemy: number } {
  if (!owner) return score;
  return { ...score, [owner]: Math.min(KOTH_GOAL, score[owner] + KOTH_RATE * dt) };
}

// ---- Survival -----------------------------------------------------------------------------

/** Wave at which the first tide is declared broken (a milestone, not the end: survival is endless). */
export const SURVIVAL_MILESTONE = 15;
