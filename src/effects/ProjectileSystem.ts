import Phaser from 'phaser';
import { DEPTH, UNITS } from '../config';
import type { ExplosionEffect } from './ExplosionEffect';

export type ProjectileKind = 'bullet' | 'shell' | 'spit' | 'spine';

interface Shot {
  img: Phaser.GameObjects.Image;
  kind: ProjectileKind;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  arc: number;
  trailT: number;
  onArrive: () => void;
}

const LOOK: Record<ProjectileKind, { tex: string; tint: number; add: boolean; arc: number; scale: number }> = {
  bullet: { tex: 'fx_tracer', tint: 0xffe0a0, add: true, arc: 0, scale: 1 },
  shell: { tex: 'fx_bolt', tint: 0xffb060, add: true, arc: 0, scale: 1.3 },
  spit: { tex: 'fx_glob', tint: 0xb0ff60, add: true, arc: 34, scale: 1 },
  spine: { tex: 'proj_spine', tint: 0xffffff, add: false, arc: 14, scale: 1.2 },
};

/** Pooled projectiles in view space: straight tracers/bolts, arcing globs and spines, with trails. */
export class ProjectileSystem {
  private pool: Phaser.GameObjects.Image[] = [];
  private live: Shot[] = [];
  private smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private acid: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private scene: Phaser.Scene, private explosions: ExplosionEffect) {
    this.smoke = scene.add.particles(0, 0, 'fx_soft', {
      emitting: false, scale: { start: 0.35, end: 0.9 }, alpha: { start: 0.35, end: 0 }, lifespan: 500, tint: 0x6a6460,
    }).setDepth(DEPTH.projectiles - 1);
    this.acid = scene.add.particles(0, 0, 'fx_dot', {
      emitting: false, scale: { start: 0.35, end: 0 }, alpha: { start: 0.8, end: 0 }, lifespan: 300, tint: 0x90ff40,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.projectiles - 1);
  }

  /** Launches a projectile from `from` to `to` (view space); `onArrive` fires on impact. */
  launch(kind: ProjectileKind, from: { x: number; y: number }, to: { x: number; y: number }, onArrive: () => void): void {
    const look = LOOK[kind];
    const img = this.pool.pop() ?? this.scene.add.image(0, 0, look.tex).setDepth(DEPTH.projectiles);
    img.setTexture(look.tex).setTint(look.tint).setVisible(true).setAlpha(1).setScale(look.scale);
    img.setBlendMode(look.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    const dist = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    this.live.push({
      img, kind, x0: from.x, y0: from.y, x1: to.x, y1: to.y, t: 0,
      dur: Math.max(0.06, dist / UNITS.projectileSpeed), arc: look.arc * Math.min(1, dist / 250), trailT: 0, onArrive,
    });
    this.place(this.live[this.live.length - 1]);
  }

  private place(s: Shot): void {
    const f = Math.min(1, s.t / s.dur);
    const x = s.x0 + (s.x1 - s.x0) * f;
    const y = s.y0 + (s.y1 - s.y0) * f - Math.sin(f * Math.PI) * s.arc;
    // Heading follows the arc's tangent.
    const dy = (s.y1 - s.y0) - Math.cos(f * Math.PI) * Math.PI * s.arc;
    s.img.setPosition(x, y).setRotation(Math.atan2(dy, s.x1 - s.x0));
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const s = this.live[i];
      s.t += dt;
      this.place(s);
      s.trailT -= dt;
      if (s.trailT <= 0) {
        if (s.kind === 'shell') {
          s.trailT = 0.03;
          this.smoke.emitParticleAt(s.img.x, s.img.y, 1);
        } else if (s.kind === 'spit') {
          s.trailT = 0.025;
          this.acid.emitParticleAt(s.img.x, s.img.y, 1);
        }
      }
      if (s.t < s.dur) continue;
      this.live.splice(i, 1);
      s.img.setVisible(false);
      this.pool.push(s.img);
      if (s.kind === 'shell') this.explosions.impact(s.x1, s.y1);
      s.onArrive();
    }
  }
}
