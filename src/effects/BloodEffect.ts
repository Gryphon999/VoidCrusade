import Phaser from 'phaser';
import { DEPTH, FX } from '../config';
import { DragProcessor } from './DragProcessor';

const BLOOD_COLORS = [0x8a0000, 0xa00808, 0x6a0000, 0xc01010];

/** Blood droplets (particles) and permanent ground decals. */
export class BloodEffect {
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private hitEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private decalLayer: Phaser.GameObjects.Layer;
  private decals: Phaser.GameObjects.Graphics[] = [];

  constructor(private scene: Phaser.Scene) {
    this.decalLayer = scene.add.layer().setDepth(DEPTH.decals);
    this.emitter = scene.add.particles(0, 0, 'fx_dot', {
      emitting: false,
      speed: { min: 60, max: 240 },
      angle: { min: 0, max: 360 },
      // Random radius 2-6px per droplet (texture radius is 6px).
      scale: { min: 0.33, max: 1 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 400, max: 800 },
      tint: BLOOD_COLORS,
    });
    this.emitter.addParticleProcessor(new DragProcessor(0.02));
    this.emitter.setDepth(DEPTH.effects);

    this.hitEmitter = scene.add.particles(0, 0, 'fx_dot', {
      emitting: false,
      speed: { min: 30, max: 120 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.35, end: 0.1 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 200, max: 400 },
      tint: BLOOD_COLORS,
    });
    this.hitEmitter.addParticleProcessor(new DragProcessor(0.05));
    this.hitEmitter.setDepth(DEPTH.effects);
  }

  /** Big splatter on death: 8-16 droplets plus a permanent decal. */
  spawnDeath(x: number, y: number, amount: number): void {
    const n = Phaser.Math.Clamp(Math.round(amount), 8, 16);
    this.emitter.explode(n, x, y);
    this.addDecal(x, y, 6 + n * 0.8);
  }

  /** Small splatter when a unit takes damage. */
  spawnHit(x: number, y: number): void {
    this.hitEmitter.explode(Phaser.Math.Between(3, 5), x, y);
    if (Math.random() < 0.15) this.addDecal(x, y, 4);
  }

  private addDecal(x: number, y: number, size: number): void {
    const g = this.scene.add.graphics({ x, y });
    const main = Phaser.Utils.Array.GetRandom(BLOOD_COLORS.slice(0, 3)) as number;
    g.fillStyle(0x3a0000, 1).fillEllipse(0, 0, size * 1.6, size * 1.2);
    g.fillStyle(main, 1);
    const blobs = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < blobs; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * size * 0.7;
      g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, size * (0.25 + Math.random() * 0.35));
    }
    // Flung droplets around the pool.
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = size * (0.9 + Math.random() * 1.2);
      g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, 1 + Math.random() * 2);
    }
    g.setAlpha(FX.decalAlpha).setRotation(Math.random() * Math.PI * 2);
    this.decalLayer.add(g);
    this.decals.push(g);
    while (this.decals.length > FX.maxDecals) this.decals.shift()?.destroy();
  }

  get decalCount(): number {
    return this.decals.length;
  }
}
