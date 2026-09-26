import Phaser from 'phaser';

/** Particle processor that bleeds off velocity each frame (air drag). */
export class DragProcessor extends Phaser.GameObjects.Particles.ParticleProcessor {
  constructor(private factor: number) {
    super(0, 0, true);
  }

  update(particle: Phaser.GameObjects.Particles.Particle, _delta: number, step: number): void {
    const k = Math.pow(this.factor, step);
    particle.velocityX *= k;
    particle.velocityY *= k;
  }
}
