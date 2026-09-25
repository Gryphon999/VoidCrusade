import Phaser from 'phaser';
import { DEPTH } from '../config';
import { Projection } from '../render/Projection';

/** Brief pulse where an order was issued. */
export function spawnOrderMarker(scene: Phaser.Scene, x: number, y: number, attack: boolean): void {
  const k = Projection.tilt;
  const img = scene.add.image(x, Projection.vy(y), 'move_marker').setDepth(DEPTH.groundFx).setTint(attack ? 0xff4040 : 0x40ff60);
  img.setScale(1.4, 1.4 * k);
  scene.tweens.add({ targets: img, scaleX: 0.4, scaleY: 0.4 * k, alpha: 0, duration: 450, onComplete: () => img.destroy() });
}
