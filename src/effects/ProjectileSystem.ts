import Phaser from 'phaser';
import { DEPTH, UNITS } from '../config';
import type { ExplosionEffect } from './ExplosionEffect';

export type ProjectileKind = 'bullet' | 'shell' | 'spit' | 'spine' | 'flame' | 'sniper' | 'psy' | 'lob' | 'acidlob' | 'cannon' | 'rocket';

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

const LOOK: Record<ProjectileKind, { tex: string; tint: number; add: boolean; arc: number; scale: number; speed: number }> = {
  bullet: { tex: 'fx_tracer', tint: 0xffe0a0, add: true, arc: 0, scale: 1, speed: 1 },
  shell: { tex: 'fx_bolt', tint: 0xffb060, add: true, arc: 0, scale: 1.3, speed: 1 },
  spit: { tex: 'fx_glob', tint: 0xb0ff60, add: true, arc: 34, scale: 1, speed: 1 },
  spine: { tex: 'proj_spine', tint: 0xffffff, add: false, arc: 14, scale: 1.2, speed: 1 },
  flame: { tex: 'fx_soft', tint: 0xffa040, add: true, arc: 4, scale: 0.5, speed: 0.55 },
  sniper: { tex: 'fx_tracer', tint: 0xe0f4ff, add: true, arc: 0, scale: 1.8, speed: 3 },
  psy: { tex: 'fx_glob', tint: 0xd070ff, add: true, arc: 16, scale: 1.2, speed: 0.8 },
  lob: { tex: 'fx_bolt', tint: 0xffc070, add: true, arc: 170, scale: 1.7, speed: 0.5 },
  acidlob: { tex: 'fx_glob', tint: 0xa0ff50, add: true, arc: 160, scale: 2.2, speed: 0.45 },
  cannon: { tex: 'fx_bolt', tint: 0xffe0a0, add: true, arc: 0, scale: 2, speed: 1.6 },
  rocket: { tex: 'fx_bolt', tint: 0xfff0c0, add: true, arc: 60, scale: 1.4, speed: 0.8 },
};

/** Kinds that arc high regardless of distance (indirect fire). */
const HIGH_ARC = new Set<ProjectileKind>(['lob', 'acidlob']);

/** Pooled projectiles in view space: straight tracers/bolts, arcing globs and spines, with trails. */
export class ProjectileSystem {
  private pool: Phaser.GameObjects.Image[] = [];
  private live: Shot[] = [];
  private smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private acid: Phaser.GameObjects.Particles.ParticleEmitter;
  private flame: Phaser.GameObjects.Particles.ParticleEmitter;
  private streak: Phaser.GameObjects.Particles.ParticleEmitter;
  private psy: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private scene: Phaser.Scene, private explosions: ExplosionEffect) {
    this.smoke = scene.add.particles(0, 0, 'fx_soft', {
      emitting: false, scale: { start: 0.35, end: 0.9 }, alpha: { start: 0.35, end: 0 }, lifespan: 500, tint: 0x6a6460,
    }).setDepth(DEPTH.projectiles - 1);
    this.acid = scene.add.particles(0, 0, 'fx_dot', {
      emitting: false, scale: { start: 0.35, end: 0 }, alpha: { start: 0.8, end: 0 }, lifespan: 300, tint: 0x90ff40,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.projectiles - 1);
    this.flame = scene.add.particles(0, 0, 'fx_soft', {
      emitting: false, scale: { start: 0.25, end: 0.8 }, alpha: { start: 0.9, end: 0 }, lifespan: { min: 180, max: 320 },
      tint: [0xffe080, 0xffa030, 0xff5010], speed: { min: 5, max: 30 }, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.projectiles - 1);
    this.streak = scene.add.particles(0, 0, 'fx_dot', {
      emitting: false, scale: { start: 0.22, end: 0.05 }, alpha: { start: 0.7, end: 0 }, lifespan: 260, tint: 0xd8ecff,
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.projectiles - 1);
    this.psy = scene.add.particles(0, 0, 'fx_dot', {
      emitting: false, scale: { start: 0.4, end: 0 }, alpha: { start: 0.9, end: 0 }, lifespan: 340, tint: [0xd070ff, 0x9040ff],
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.projectiles - 1);
  }

  /** Splash of acid at a view-space point (spore mines). */
  burst(x: number, y: number): void {
    this.acid.emitParticleAt(x, y, 24);
    this.psy.emitParticleAt(x, y, 6);
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
      dur: Math.max(0.06, dist / (UNITS.projectileSpeed * look.speed)), arc: HIGH_ARC.has(kind) ? look.arc * Math.min(1.4, 0.5 + dist / 600) : look.arc * Math.min(1, dist / 250), trailT: 0, onArrive,
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
        if (s.kind === 'shell' || s.kind === 'lob' || s.kind === 'cannon' || s.kind === 'rocket') {
          s.trailT = s.kind === 'shell' ? 0.03 : s.kind === 'rocket' ? 0.01 : 0.018;
          this.smoke.emitParticleAt(s.img.x, s.img.y, 1);
        } else if (s.kind === 'spit' || s.kind === 'acidlob') {
          s.trailT = 0.025;
          this.acid.emitParticleAt(s.img.x, s.img.y, 1);
        } else if (s.kind === 'flame') {
          s.trailT = 0.014;
          this.flame.emitParticleAt(s.img.x + (Math.random() - 0.5) * 6, s.img.y + (Math.random() - 0.5) * 6, 1);
        } else if (s.kind === 'sniper') {
          s.trailT = 0.004;
          this.streak.emitParticleAt(s.img.x, s.img.y, 1);
        } else if (s.kind === 'psy') {
          s.trailT = 0.02;
          this.psy.emitParticleAt(s.img.x, s.img.y, 1);
        }
      }
      if (s.t < s.dur) continue;
      this.live.splice(i, 1);
      s.img.setVisible(false);
      this.pool.push(s.img);
      if (s.kind === 'shell') this.explosions.impact(s.x1, s.y1);
      else if (s.kind === 'lob' || s.kind === 'cannon' || s.kind === 'rocket') this.explosions.blast(s.x1, s.y1, s.kind === 'lob' ? 1 : 0.6);
      else if (s.kind === 'acidlob') this.acid.emitParticleAt(s.x1, s.y1, 18);
      else if (s.kind === 'flame') this.flame.emitParticleAt(s.x1, s.y1, 4);
      else if (s.kind === 'psy') this.psy.emitParticleAt(s.x1, s.y1, 6);
      s.onArrive();
    }
  }
}
