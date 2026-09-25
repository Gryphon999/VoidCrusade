import Phaser from 'phaser';
import { DEPTH, FX } from '../config';
import { DragProcessor } from './DragProcessor';
import { Projection } from '../render/Projection';

const HUMAN = [0x8a0000, 0xa00808, 0x6a0000, 0xc01010];
/** Null Horde ichor: violet with a sickly green sheen. */
const ALIEN = [0x6a1a6a, 0x8a2a8a, 0x4a8a20, 0x9a40a0];

/** Blood droplets, directional sprays, gibs and persistent ground decals (oldest fade out). */
export class BloodEffect {
  private drops: Phaser.GameObjects.Particles.ParticleEmitter;
  private spray: Phaser.GameObjects.Particles.ParticleEmitter;
  private chunks: Phaser.GameObjects.Particles.ParticleEmitter;
  private decalLayer: Phaser.GameObjects.Layer;
  private decals: Phaser.GameObjects.Graphics[] = [];

  constructor(private scene: Phaser.Scene) {
    this.decalLayer = scene.add.layer().setDepth(DEPTH.decals);
    this.drops = scene.add.particles(0, 0, 'fx_dot', {
      emitting: false, speed: { min: 60, max: 240 }, angle: { min: 0, max: 360 },
      // Random radius 2-6px per droplet (texture radius is 6px).
      scale: { min: 0.33, max: 1 }, alpha: { start: 1, end: 0 }, lifespan: { min: 400, max: 800 }, gravityY: 180,
    });
    this.drops.addParticleProcessor(new DragProcessor(0.02));
    this.drops.setDepth(DEPTH.effects);
    this.spray = scene.add.particles(0, 0, 'fx_dot', {
      emitting: false, speed: { min: 90, max: 220 }, scale: { start: 0.35, end: 0.12 }, alpha: { start: 1, end: 0 },
      lifespan: { min: 220, max: 420 }, gravityY: 260,
    });
    this.spray.addParticleProcessor(new DragProcessor(0.05));
    this.spray.setDepth(DEPTH.effects);
    this.chunks = scene.add.particles(0, 0, 'fx_chunk', {
      emitting: false, speed: { min: 80, max: 220 }, angle: { min: 200, max: 340 }, gravityY: 420, rotate: { min: 0, max: 360 },
      scale: { min: 0.6, max: 1.2 }, lifespan: { min: 500, max: 800 }, alpha: { start: 1, end: 0.7 },
    }).setDepth(DEPTH.effects);
  }

  /** Big splatter on death: 8-16 droplets plus a permanent pool. */
  spawnDeath(x: number, y: number, amount: number, alien = false): void {
    const n = Phaser.Math.Clamp(Math.round(amount), 8, 16);
    const pal = alien ? ALIEN : HUMAN;
    this.drops.setParticleTint(Phaser.Utils.Array.GetRandom(pal) as number);
    this.drops.explode(n, x, Projection.vy(y) - 8);
    this.addDecal(x, y, 6 + n * 0.8, pal);
  }

  /** Arterial spray away from the shooter when a unit is hit (dir = logical angle of the shot). */
  spawnHit(x: number, y: number, alien = false, dir = Math.random() * Math.PI * 2): void {
    const pal = alien ? ALIEN : HUMAN;
    const a = Phaser.Math.RadToDeg(Math.atan2(Math.sin(dir) * Projection.tilt, Math.cos(dir)));
    this.spray.setParticleTint(Phaser.Utils.Array.GetRandom(pal) as number);
    this.spray.setEmitterAngle({ min: a - 28, max: a + 28 });
    this.spray.explode(Phaser.Math.Between(3, 5), x, Projection.vy(y) - 12);
    if (Math.random() < 0.2) this.addDecal(x + Math.cos(dir) * 8, y + Math.sin(dir) * 8, 4, pal);
  }

  /** Body bursts into chunks (used for some Crawler deaths). */
  gib(x: number, y: number, flesh: number, n: number): void {
    this.chunks.setParticleTint(flesh);
    this.chunks.explode(n, x, Projection.vy(y) - 10);
    this.drops.setParticleTint(ALIEN[0]);
    this.drops.explode(14, x, Projection.vy(y) - 8);
    this.addDecal(x, y, 18, ALIEN);
  }

  /** Scorched blast mark on the ground. */
  scorch(x: number, y: number, r: number): void {
    const g = this.scene.add.graphics({ x, y: Projection.vy(y) });
    for (let i = 0; i < 6; i++) {
      g.fillStyle(0x080604, 0.18).fillCircle((Math.random() - 0.5) * r * 0.6, (Math.random() - 0.5) * r * 0.6, r * (0.4 + Math.random() * 0.6));
    }
    g.setScale(1, Projection.tilt);
    this.push(g);
  }

  private addDecal(x: number, y: number, size: number, pal: number[]): void {
    const g = this.scene.add.graphics({ x, y: Projection.vy(y) });
    const main = Phaser.Utils.Array.GetRandom(pal.slice(0, 3)) as number;
    g.fillStyle(pal === ALIEN ? 0x1a0a1a : 0x3a0000, 1).fillEllipse(0, 0, size * 1.6, size * 1.2);
    g.fillStyle(main, 1);
    const blobs = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < blobs; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * size * 0.7;
      g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, size * (0.25 + Math.random() * 0.35));
    }
    // Wet highlight and flung droplets.
    g.fillStyle(0xffffff, 0.12).fillEllipse(-size * 0.2, -size * 0.2, size * 0.5, size * 0.25);
    g.fillStyle(main, 1);
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = size * (0.9 + Math.random() * 1.2);
      g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, 1 + Math.random() * 2);
    }
    // Squashed so the splat lies flat on the tilted ground.
    g.setAlpha(FX.decalAlpha).setScale(1, Projection.tilt);
    this.push(g);
  }

  private push(g: Phaser.GameObjects.Graphics): void {
    this.decalLayer.add(g);
    this.decals.push(g);
    while (this.decals.length > FX.maxDecals) {
      const old = this.decals.shift() as Phaser.GameObjects.Graphics;
      this.scene.tweens.add({ targets: old, alpha: 0, duration: 2000, onComplete: () => old.destroy() });
    }
  }

  get decalCount(): number {
    return this.decals.length;
  }
}
