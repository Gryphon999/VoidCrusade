import { makeRng } from '../utils/rng';

/**
 * Value noise with optional periodic wrap (for seamless tiling) and fBm octaves.
 * Returns values in [0, 1].
 */
export class ValueNoise {
  private lattice: Float32Array;
  private readonly size = 256;

  constructor(seed: number) {
    const rnd = makeRng(seed);
    this.lattice = new Float32Array(this.size * this.size);
    for (let i = 0; i < this.lattice.length; i++) this.lattice[i] = rnd();
  }

  private at(ix: number, iy: number, period: number): number {
    const p = period > 0 ? period : this.size;
    const x = ((ix % p) + p) % p % this.size;
    const y = ((iy % p) + p) % p % this.size;
    return this.lattice[y * this.size + x];
  }

  /** Smoothly interpolated noise at (x, y); `period` in lattice cells makes it tile. */
  noise(x: number, y: number, period = 0): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = this.at(ix, iy, period);
    const b = this.at(ix + 1, iy, period);
    const c = this.at(ix, iy + 1, period);
    const d = this.at(ix + 1, iy + 1, period);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  /** Fractal Brownian motion: `octaves` layers, each double frequency and half amplitude. */
  fbm(x: number, y: number, octaves = 4, period = 0): number {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    let f = 1;
    for (let o = 0; o < octaves; o++) {
      sum += this.noise(x * f, y * f, period > 0 ? period * f : 0) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  }
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
