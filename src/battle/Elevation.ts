/**
 * High ground rules (two levels: 0 low, 1 high). Pure constants and checks; MapSystem answers which
 * level a tile is on, systems ask here what that means.
 */
export const ELEVATION = {
  /** Sight multiplier for units standing on high ground. */
  highSightMult: 1.25,
  /** Extra weapon reach (px) for squads on high ground. */
  highRangeBonus: 40,
  /** Low ground still sees a high-ground squad this close (melee contact). */
  lowSeesHighWithin: 90,
  /** Height of a plateau in the 3D view (px). */
  plateau3d: 56,
} as const;

export const sightMultAt = (level: number): number => (level > 0 ? ELEVATION.highSightMult : 1);
export const rangeBonusAt = (level: number): number => (level > 0 ? ELEVATION.highRangeBonus : 0);

/** Can a viewer at `viewerLevel` see a target at `targetLevel` from `dist` px away (sight already checked)? */
export function canSeeAcrossLevels(viewerLevel: number, targetLevel: number, dist: number): boolean {
  return viewerLevel >= targetLevel || dist <= ELEVATION.lowSeesHighWithin;
}

/** Stepping between two tiles: same level, or either one is a ramp. */
export function canStepLevels(levelA: number, levelB: number, rampA: boolean, rampB: boolean): boolean {
  return levelA === levelB || rampA || rampB;
}
