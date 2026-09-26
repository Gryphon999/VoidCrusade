import Phaser from 'phaser';
import { DEPTH, GFX } from '../config';
import { Settings } from '../systems/Settings';
import { Projection } from './Projection';
import type { BattleScene } from '../scenes/BattleScene';

/** Dusk colour grading, vignette, optional bloom, drifting ash/embers and low ground fog. */
export class Atmosphere {
  private ash?: Phaser.GameObjects.Particles.ParticleEmitter;
  private embers?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private battle: BattleScene) {
    const q = GFX[Settings.get().graphics];
    const cam = battle.cameras.main;
    const fx = cam.postFX;
    if (fx && q.grade) {
      // Grimdark dusk: slightly desaturated, cool ambient with warm highlights.
      const cm = fx.addColorMatrix();
      cm.saturate(-0.18);
      cm.brightness(0.95, true);
      cm.contrast(0.12, true);
      fx.addVignette(0.5, 0.5, 0.82, 0.35);
    }
    if (fx && q.bloom) fx.addBloom(0xffffff, 1, 1, 1, 1.15, 4);
    if (q.ash > 0) {
      const view = cam.worldView;
      const zone = new Phaser.Geom.Rectangle(0, 0, view.width, view.height);
      this.ash = battle.add.particles(0, 0, 'fx_dot', {
        frequency: 1000 / q.ash, emitZone: { type: 'random', source: zone, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        speedX: { min: 8, max: 26 }, speedY: { min: 6, max: 18 }, scale: { min: 0.12, max: 0.3 },
        alpha: { start: 0.5, end: 0 }, lifespan: { min: 4000, max: 7000 }, tint: [0x9a9088, 0x6a625c],
      }).setDepth(DEPTH.effects + 20);
      this.embers = battle.add.particles(0, 0, 'fx_dot', {
        frequency: 3000 / q.ash, emitZone: { type: 'random', source: zone, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        speedX: { min: 5, max: 20 }, speedY: { min: -30, max: -10 }, scale: { min: 0.1, max: 0.22 },
        alpha: { start: 0.9, end: 0 }, lifespan: { min: 2500, max: 4500 }, tint: [0xff8030, 0xffb050], blendMode: Phaser.BlendModes.ADD,
      }).setDepth(DEPTH.effects + 21);
    }
    // Low ground fog drifting over the plain (under units).
    const W = battle.map.worldWidth;
    const H = battle.map.worldHeight;
    for (let i = 0; i < q.fogPatches; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const s = 6 + Math.random() * 8;
      const img = battle.add.image(x, Projection.vy(y), 'fx_soft').setTint(0x9aa0a8).setAlpha(0.05 + Math.random() * 0.06)
        .setScale(s, s * Projection.tilt * 0.6).setDepth(DEPTH.groundFx);
      battle.tweens.add({ targets: img, x: x + 200 + Math.random() * 200, duration: 30000 + Math.random() * 30000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private storm?: Phaser.GameObjects.Particles.ParticleEmitter;
  private stormVeil?: Phaser.GameObjects.Rectangle;

  /** Ash storm: dense wind-driven ash and a brown veil over the battlefield. */
  setStorm(on: boolean): void {
    const b = this.battle;
    if (on && !this.storm) {
      const v = b.cameras.main.worldView;
      const zone = new Phaser.Geom.Rectangle(-200, 0, v.width + 200, v.height);
      this.storm = b.add.particles(0, 0, 'fx_soft', {
        frequency: 40, quantity: 2, emitZone: { type: 'random', source: zone, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        speedX: { min: 160, max: 280 }, speedY: { min: 10, max: 40 }, scale: { min: 1.2, max: 3.2 },
        alpha: { start: 0.28, end: 0 }, lifespan: { min: 1600, max: 2600 }, tint: [0x6a5a48, 0x8a7a64, 0x4a4038],
      }).setDepth(DEPTH.effects + 30);
      this.stormVeil = b.add.rectangle(0, 0, 4000, 3000, 0x3a2c1c, 0).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.fog - 1);
      b.tweens.add({ targets: this.stormVeil, fillAlpha: 0.32, duration: 3000 });
    } else if (!on && this.storm) {
      const em = this.storm;
      const veil = this.stormVeil;
      this.storm = undefined;
      this.stormVeil = undefined;
      em.stop();
      b.time.delayedCall(3000, () => em.destroy());
      if (veil) b.tweens.add({ targets: veil, fillAlpha: 0, duration: 3000, onComplete: () => veil.destroy() });
    }
  }

  update(): void {
    if (this.storm) {
      const v = this.battle.cameras.main.worldView;
      this.storm.setPosition(v.x, v.y);
    }
    if (!this.ash) return;
    const v = this.battle.cameras.main.worldView;
    this.ash.setPosition(v.x, v.y);
    this.embers?.setPosition(v.x, v.y);
  }
}
