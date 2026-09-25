import Phaser from 'phaser';
import { DEPTH } from '../config';

/** Brief pulse where an order was issued. */
export function spawnOrderMarker(scene: Phaser.Scene, x: number, y: number, attack: boolean): void {
  const img = scene.add.image(x, y, 'move_marker').setDepth(DEPTH.overlay).setTint(attack ? 0xff4040 : 0x40ff60);
  img.setScale(1.4);
  scene.tweens.add({ targets: img, scale: 0.4, alpha: 0, duration: 450, onComplete: () => img.destroy() });
}
