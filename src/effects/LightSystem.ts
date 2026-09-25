import Phaser from 'phaser';
import { DEPTH, GFX } from '../config';
import { Settings } from '../systems/Settings';
import { makeCanvas } from '../render/CanvasUtil';

interface Light {
  img: Phaser.GameObjects.Image;
  until: number;
}

/**
 * Cheap dynamic lighting: pooled additive radial sprites for muzzle flashes, explosions and fires.
 * The number of simultaneous lights is capped by the graphics quality setting.
 */
export class LightSystem {
  private free: Phaser.GameObjects.Image[] = [];
  private active: Light[] = [];
  private readonly max: number;

  constructor(private scene: Phaser.Scene) {
    this.max = GFX[Settings.get().graphics].lights;
    if (!scene.textures.exists('light')) {
      const { canvas, ctx } = makeCanvas(128, 128);
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      scene.textures.addCanvas('light', canvas);
    }
  }

  /** A short flash of light at a view-space point, squashed onto the ground. */
  flash(x: number, y: number, radius: number, color: number, ms: number, intensity = 0.8): void {
    if (this.active.length >= this.max) return;
    const img = this.free.pop() ?? this.scene.add.image(0, 0, 'light').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.effects - 5);
    img.setPosition(x, y).setTint(color).setAlpha(intensity).setVisible(true);
    img.setScale((radius * 2) / 128, (radius * 1.4) / 128);
    this.active.push({ img, until: this.scene.time.now + ms });
    this.scene.tweens.add({ targets: img, alpha: 0, duration: ms, ease: 'Quad.easeIn' });
  }

  /** A flickering light that lasts `seconds` (burning ruins). */
  fire(x: number, y: number, radius: number, seconds: number): void {
    const img = this.scene.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.effects - 5)
      .setTint(0xff7a28).setScale((radius * 2) / 128, (radius * 1.4) / 128).setAlpha(0.6);
    const flicker = this.scene.tweens.add({ targets: img, alpha: { from: 0.35, to: 0.7 }, duration: 120, yoyo: true, repeat: -1 });
    this.scene.time.delayedCall(seconds * 1000, () => {
      flicker.stop();
      this.scene.tweens.add({ targets: img, alpha: 0, duration: 2500, onComplete: () => img.destroy() });
    });
  }

  update(): void {
    const now = this.scene.time.now;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const l = this.active[i];
      if (now < l.until) continue;
      l.img.setVisible(false);
      this.free.push(l.img);
      this.active.splice(i, 1);
    }
  }
}
