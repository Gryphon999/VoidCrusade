import Phaser from 'phaser';
import { bakeTexture } from './TileTextures';

export function createFxTextures(scene: Phaser.Scene): void {
  bakeTexture(scene, 'fx_dot', 12, 12, (g) => {
    g.fillStyle(0xffffff, 1).fillCircle(6, 6, 6);
  });
  bakeTexture(scene, 'fx_soft', 32, 32, (g) => {
    for (let r = 16; r > 0; r -= 2) g.fillStyle(0xffffff, 0.12).fillCircle(16, 16, r);
  });
  bakeTexture(scene, 'fx_spark', 6, 6, (g) => {
    g.fillStyle(0xffffff, 1).fillRect(0, 2, 6, 2).fillRect(2, 0, 2, 6);
  });
}
