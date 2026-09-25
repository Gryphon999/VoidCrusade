import { Part, Pose } from './Puppet3D';

export type AnimName = 'idle' | 'walk' | 'attack' | 'hit' | 'death';
export const ANIMS: AnimName[] = ['idle', 'walk', 'attack', 'hit', 'death'];
export const ANIM_FRAMES: Record<AnimName, number> = { idle: 3, walk: 6, attack: 2, hit: 1, death: 4 };

/** A unit model: sprite cell size, feet anchor, and a pose builder per animation frame. */
export interface UnitModel {
  cellW: number;
  cellH: number;
  /** Feet position inside the cell. */
  anchorX: number;
  anchorY: number;
  /** Muzzle/strike point in model space for the attack frame (px, before scale). */
  build(anim: AnimName, frame: number): { parts: Part[]; pose: Pose };
}

/** Normalised animation phase helpers. */
export function walkPhase(frame: number): number {
  return (frame / ANIM_FRAMES.walk) * Math.PI * 2;
}

export const DEATH_FALL = [0.45, 0.95, 1.38, 1.57];
