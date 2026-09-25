import { DEPTH, PROJECTION } from '../config';

/**
 * Oblique (3/4) projection used to draw the battlefield as if seen from a tilted camera.
 *
 * Gameplay runs in logical top-down world coordinates (x, y). The renderer squashes the ground
 * plane vertically by `tilt` and lifts things by their height: view = (x, y * tilt - z).
 * Phaser's camera then works in these "view" coordinates.
 */
export const Projection = {
  tilt: PROJECTION.defaultTilt as number,

  setTilt(t: number): void {
    this.tilt = Math.min(PROJECTION.maxTilt, Math.max(PROJECTION.minTilt, t));
  },

  /** View-space Y of a ground point, optionally lifted by a height z (px). */
  vy(y: number, z = 0): number {
    return y * this.tilt - z;
  },

  /** Logical ground Y for a view-space Y (assumes z = 0). */
  groundY(viewY: number): number {
    return viewY / this.tilt;
  },

  /** Depth for an upright object standing at logical ground Y. */
  depth(y: number): number {
    return DEPTH.sorted + y;
  },
};
