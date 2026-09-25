import Phaser from 'phaser';
import { DEPTH, FX } from '../config';
import { DragProcessor } from './DragProcessor';
import { Projection } from '../render/Projection';
import { Settings } from '../systems/Settings';

/** Fireball, shockwave, lingering smoke and screen shake for destroyed buildings. */
export class ExplosionEffect {
  private fire: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private chimney: Phaser.GameObjects.Particles.ParticleEmitter;
  private debris: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private scene: Phaser.Scene) {
    this.fire = scene.add.particles(0, 0, 'fx_soft', {
      emitting: false,
      speed: { min: 40, max: 260 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.2, end: 4 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 500, max: 900 },
      tint: [0xff4010, 0xff8020, 0xffc040, 0xe02010],
      blendMode: Phaser.BlendModes.ADD,
    });
    this.fire.addParticleProcessor(new DragProcessor(0.1));
    this.fire.setDepth(DEPTH.effects + 2);
    this.sparks = scene.add.particles(0, 0, 'fx_spark', {
      emitting: false,
      speed: { min: 150, max: 420 },
      angle: { min: 0, max: 360 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 300, max: 700 },
      tint: [0xffd080, 0xff9a40],
      scale: { start: 0.8, end: 0.2 },
      blendMode: Phaser.BlendModes.ADD,
    });
    this.sparks.addParticleProcessor(new DragProcessor(0.2));
    this.sparks.setDepth(DEPTH.effects + 3);
    this.chimney = scene.add.particles(0, 0, 'fx_soft', {
      emitting: false, speedY: { min: -32, max: -18 }, speedX: { min: 4, max: 14 }, scale: { start: 0.5, end: 2.2 },
      alpha: { start: 0.4, end: 0 }, lifespan: { min: 1800, max: 2600 }, tint: [0x3a3836, 0x504c48, 0x2a2826],
    });
    this.chimney.setDepth(DEPTH.effects - 2);
    this.debris = scene.add.particles(0, 0, 'fx_chunk', {
      emitting: false, speed: { min: 120, max: 340 }, angle: { min: 190, max: 350 }, gravityY: 500,
      rotate: { start: 0, end: 540 }, scale: { min: 0.7, max: 1.8 }, lifespan: { min: 700, max: 1300 },
      tint: [0x3a3530, 0x55504a, 0x2a2420, 0x6a5a40],
    }).setDepth(DEPTH.effects + 4);
  }

  /** Explosion at a logical ground point, centred `lift` px above the ground. */
  explode(x: number, groundY: number, radius: number, lift = radius * 0.4): void {
    const y = Projection.vy(groundY) - lift;
    this.fire.explode(Phaser.Math.Between(20, 30), x, y);
    this.sparks.explode(18, x, y);
    this.debris.explode(Math.round(10 + radius / 8), x, y);
    const ring = this.scene.add.graphics({ x, y: Projection.vy(groundY) }).setDepth(DEPTH.groundFx);
    ring.lineStyle(6, 0xffa040, 1).strokeEllipse(0, 0, radius, radius * Projection.tilt);
    this.scene.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
    this.smoke(x, y, radius);
    const view = this.scene.cameras.main.worldView;
    if (Settings.get().screenShake && view.contains(x, y)) {
      this.scene.cameras.main.shake(FX.shakeDuration, FX.shakeIntensity);
    }
  }

  /** Shell blast at a view-space ground point (artillery, tank cannon): fireball, sparks, a little debris. */
  blast(x: number, y: number, size = 1): void {
    this.fire.explode(Math.round(6 + 6 * size), x, y - 6);
    this.sparks.explode(Math.round(6 * size), x, y - 6);
    this.debris.explode(Math.round(3 + 3 * size), x, y);
    this.chimney.emitParticleAt(x, y - 10, 2);
  }

  /** Small burst at a view-space point. */
  impact(x: number, y: number): void {
    this.sparks.explode(3, x, y);
  }

  /** One chimney/exhaust smoke puff at a view-space point. */
  puff(x: number, y: number): void {
    this.chimney.emitParticleAt(x, y, 1);
  }

  /** A burning ruin: flames and smoke for a while after a building falls. */
  burn(x: number, y: number, radius: number, seconds: number): void {
    const flames = this.scene.add.particles(x, y, 'fx_soft', {
      frequency: 90, quantity: 1, x: { min: -radius * 0.5, max: radius * 0.5 }, y: { min: -radius * 0.2, max: radius * 0.2 },
      speedY: { min: -60, max: -25 }, scale: { start: 1.1, end: 0.2 }, alpha: { start: 0.9, end: 0 },
      lifespan: { min: 400, max: 800 }, tint: [0xff5010, 0xff9020, 0xffc040], blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.effects);
    const smoke = this.scene.add.particles(x, y - 10, 'fx_soft', {
      frequency: 160, x: { min: -radius * 0.4, max: radius * 0.4 }, speedY: { min: -50, max: -20 }, speedX: { min: 4, max: 18 },
      scale: { start: 1.2, end: 3.5 }, alpha: { start: 0.35, end: 0 }, lifespan: 2400, tint: [0x2a2a2a, 0x3a3634],
    }).setDepth(DEPTH.effects - 1);
    this.scene.time.delayedCall(seconds * 1000, () => {
      flames.stop();
      smoke.stop();
    });
    this.scene.time.delayedCall(seconds * 1000 + 3000, () => {
      flames.destroy();
      smoke.destroy();
    });
  }

  private smoke(x: number, y: number, radius: number): void {
    const smoke = this.scene.add.particles(x, y, 'fx_soft', {
      frequency: 60,
      quantity: 2,
      x: { min: -radius * 0.5, max: radius * 0.5 },
      y: { min: -radius * 0.3, max: radius * 0.3 },
      speedY: { min: -80, max: -30 },
      speedX: { min: -20, max: 20 },
      scale: { start: 1.5, end: 4 },
      alpha: { start: 0.45, end: 0 },
      lifespan: { min: 1200, max: 1800 },
      tint: [0x404040, 0x606060, 0x303030],
    });
    smoke.setDepth(DEPTH.effects + 1);
    this.scene.time.delayedCall(2000, () => smoke.stop());
    this.scene.time.delayedCall(4000, () => smoke.destroy());
  }
}
