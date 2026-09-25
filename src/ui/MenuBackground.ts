import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
  alpha: number;
}

/** Drifting parallax starfield with distant explosions flaring on the horizon. */
export class MenuBackground {
  private stars: Star[] = [];
  private gfx: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {
    const bg = scene.add.graphics();
    bg.fillGradientStyle(0x020208, 0x020208, 0x1a0812, 0x100a20, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    for (let i = 0; i < 6; i++) {
      scene.add.image(Phaser.Math.Between(0, GAME_WIDTH), Phaser.Math.Between(0, GAME_HEIGHT), 'aura')
        .setScale(Phaser.Math.FloatBetween(4, 8)).setTint([0x501080, 0x102060, 0x601020][i % 3])
        .setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD);
    }
    for (let i = 0; i < 220; i++) {
      const layer = Math.random();
      this.stars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        speed: 4 + layer * 30,
        size: layer > 0.9 ? 2 : layer > 0.5 ? 1.3 : 0.8,
        alpha: 0.3 + layer * 0.7,
      });
    }
    this.gfx = scene.add.graphics();
    // Burning world on the horizon.
    const planet = scene.add.graphics();
    planet.fillStyle(0x2a0a08, 1).fillCircle(GAME_WIDTH / 2, GAME_HEIGHT + 520, 700);
    planet.lineStyle(3, 0xff5020, 0.5).strokeCircle(GAME_WIDTH / 2, GAME_HEIGHT + 520, 700);
    planet.fillStyle(0x0a0404, 1).fillCircle(GAME_WIDTH / 2, GAME_HEIGHT + 530, 700);
    scene.time.addEvent({ delay: 900, loop: true, callback: () => this.explosion() });
    const storm = (): void => {
      this.lightning();
      scene.time.delayedCall(4000 + Math.random() * 5000, storm);
    };
    scene.time.delayedCall(2500, storm);
  }

  /** Sky flash with a jagged bolt. */
  private lightning(): void {
    const s = this.scene;
    const flash = s.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xc8d0ff, 0.12).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    s.tweens.add({ targets: flash, alpha: 0, duration: 380, onComplete: () => flash.destroy() });
    const g = s.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    let x = Phaser.Math.Between(100, GAME_WIDTH - 100);
    let y = 0;
    g.lineStyle(2, 0xe0e8ff, 0.9).beginPath().moveTo(x, y);
    while (y < GAME_HEIGHT * 0.45) {
      x += Phaser.Math.Between(-28, 28);
      y += Phaser.Math.Between(14, 40);
      g.lineTo(x, y);
    }
    g.strokePath();
    s.tweens.add({ targets: g, alpha: 0, duration: 300, delay: 60, onComplete: () => g.destroy() });
  }

  private explosion(): void {
    const x = Phaser.Math.Between(80, GAME_WIDTH - 80);
    const y = Phaser.Math.Between(GAME_HEIGHT - 190, GAME_HEIGHT - 110);
    const flash = this.scene.add.image(x, y, 'aura').setTint(Phaser.Utils.Array.GetRandom([0xff6020, 0xffa040, 0xff3010]) as number)
      .setBlendMode(Phaser.BlendModes.ADD).setScale(0.1).setAlpha(0.9);
    this.scene.tweens.add({
      targets: flash, scale: Phaser.Math.FloatBetween(0.6, 1.6), alpha: 0, duration: Phaser.Math.Between(700, 1300),
      ease: 'Cubic.easeOut', onComplete: () => flash.destroy(),
    });
  }

  update(dt: number): void {
    const g = this.gfx.clear();
    for (const s of this.stars) {
      s.x -= s.speed * dt;
      if (s.x < 0) {
        s.x = GAME_WIDTH;
        s.y = Math.random() * GAME_HEIGHT;
      }
      g.fillStyle(0xffffff, s.alpha).fillCircle(s.x, s.y, s.size);
    }
  }
}
