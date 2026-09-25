import Phaser from 'phaser';
import { bakeTexture } from './TileTextures';

/** Procedural UI icons. */
export function createUITextures(scene: Phaser.Scene): void {
  bakeTexture(scene, 'icon_scrip', 24, 24, (g) => {
    // Gold command seal: octagon with a skull-like notch.
    g.fillStyle(0x6b4a10, 1).fillCircle(12, 12, 11);
    g.fillStyle(0xf0c040, 1).fillCircle(12, 12, 9);
    g.fillStyle(0x6b4a10, 1).fillRect(8, 8, 3, 3).fillRect(13, 8, 3, 3).fillRect(10, 14, 4, 3);
  });
  bakeTexture(scene, 'icon_flux', 24, 24, (g) => {
    g.fillStyle(0x0c3a48, 1).fillCircle(12, 12, 11);
    g.fillStyle(0x40e0ff, 1);
    g.fillTriangle(13, 2, 5, 14, 12, 13);
    g.fillTriangle(11, 22, 19, 10, 12, 11);
  });
  bakeTexture(scene, 'icon_time', 24, 24, (g) => {
    g.lineStyle(2, 0xc0c0d0, 1).strokeCircle(12, 12, 9);
    g.lineBetween(12, 12, 12, 6).lineBetween(12, 12, 16, 14);
  });
  bakeTexture(scene, 'icon_squads', 24, 24, (g) => {
    g.fillStyle(0x3a8dff, 1).fillCircle(7, 9, 4).fillCircle(17, 9, 4).fillCircle(12, 16, 5);
  });
}
