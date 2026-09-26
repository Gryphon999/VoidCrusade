import * as THREE from 'three';
import { Projection } from '../render/Projection';
import type { LightSource } from '../effects/LightSystem';

/** A light the 3D renderer may spend a slot on. `y` is logical ground y; `h` height above it. */
export interface Spot {
  x: number;
  y: number;
  h: number;
  radius: number;
  color: number;
  /** 0..1 */
  strength: number;
  /** Transient flashes outrank static building lights. */
  dynamic: boolean;
}

/**
 * Dynamic point lights: a fixed pool (the tier's budget, so shaders never recompile) handed each
 * frame to the strongest light sources in view: muzzle flashes, explosions, burning ruins,
 * lit windows and energy cores, capture obelisks.
 */
export class Lights3D {
  private pool: THREE.PointLight[] = [];
  private spots: Spot[] = [];

  constructor(scene: THREE.Scene, count: number) {
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 100, 2);
      l.castShadow = false;
      scene.add(l);
      this.pool.push(l);
    }
  }

  /** Limits active lights (tier change) without changing the pool size. */
  budget = Infinity;

  update(flashes: LightSource[], statics: Spot[], view: Phaser.Geom.Rectangle, heightAt: (x: number, y: number) => number): void {
    const spots = this.spots;
    spots.length = 0;
    for (const f of flashes) {
      if (f.strength < 0.03) continue;
      spots.push({ x: f.x, y: Projection.groundY(f.vy), h: 26, radius: f.radius, color: f.color, strength: f.strength, dynamic: true });
    }
    for (const s of statics) spots.push(s);
    const cx = view.centerX;
    const cy = view.centerY;
    const reach = Math.max(view.width, view.height) * 0.75;
    const score = (s: Spot): number => {
      const vy = Projection.vy(s.y);
      const d = Math.hypot(s.x - cx, vy - cy);
      if (d > reach + s.radius) return -1;
      return s.strength * s.radius * (s.dynamic ? 3 : 1) * (1 - 0.5 * Math.min(1, d / reach));
    };
    const ranked = spots.map((s) => ({ s, k: score(s) })).filter((r) => r.k > 0).sort((a, b) => b.k - a.k);
    const n = Math.min(this.pool.length, this.budget);
    for (let i = 0; i < this.pool.length; i++) {
      const l = this.pool[i];
      const r = i < n ? ranked[i] : undefined;
      if (!r) {
        // Stay visible at zero intensity: toggling visibility changes the light count and
        // recompiles every shader.
        l.intensity = 0;
        continue;
      }
      const s = r.s;
      l.color.setHex(s.color);
      l.distance = s.radius * 2.4;
      l.intensity = s.radius * s.radius * s.strength * (s.dynamic ? 1.1 : 0.45);
      l.position.set(s.x, heightAt(s.x, s.y) + s.h, s.y);
    }
  }
}
