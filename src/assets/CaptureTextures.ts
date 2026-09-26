import Phaser from 'phaser';
import { bakeTexture } from './TileTextures';

export function createCaptureTextures(scene: Phaser.Scene): void {
  bakeTexture(scene, 'obelisk', 48, 120, (g) => {
    g.fillStyle(0x000000, 0.4).fillEllipse(24, 112, 44, 14);
    g.fillStyle(0x1a1a24, 1).fillRect(6, 96, 36, 18);
    g.fillStyle(0x2a2a38, 1).fillRect(10, 90, 28, 8);
    g.fillStyle(0x15151e, 1).fillTriangle(12, 92, 36, 92, 24, 4);
    g.fillStyle(0x2c2c3c, 1).fillTriangle(24, 92, 36, 92, 24, 4);
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 5; i++) g.fillRect(22, 24 + i * 13, 4, 7);
    g.fillRect(18, 30, 3, 3).fillRect(27, 56, 3, 3).fillRect(18, 70, 3, 3);
  });
  bakeTexture(scene, 'aura', 128, 128, (g) => {
    for (let r = 64; r > 0; r -= 4) g.fillStyle(0xffffff, 0.06 + (1 - r / 64) * 0.05).fillCircle(64, 64, r);
  });
}
