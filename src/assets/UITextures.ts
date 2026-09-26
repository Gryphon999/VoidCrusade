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
  bakeTexture(scene, 'icon_cover', 14, 16, (g) => {
    g.fillStyle(0x0a3010, 1).fillTriangle(0, 1, 14, 1, 7, 16);
    g.fillStyle(0x40e060, 1).fillTriangle(2, 2, 12, 2, 7, 13);
  });
  bakeTexture(scene, 'icon_damage', 24, 24, (g) => {
    g.fillStyle(0x5a1010, 1).fillCircle(12, 12, 11);
    g.fillStyle(0xff5040, 1).fillTriangle(12, 2, 7, 18, 17, 18);
    g.fillStyle(0xffd0a0, 1).fillRect(10, 18, 4, 4);
  });
  bakeTexture(scene, 'icon_build', 24, 24, (g) => {
    g.fillStyle(0x3a3a20, 1).fillCircle(12, 12, 11);
    g.fillStyle(0xe0b030, 1).fillRect(5, 13, 14, 6).fillRect(9, 6, 6, 8);
  });
  bakeTexture(scene, 'icon_turret', 24, 24, (g) => {
    g.fillStyle(0x20283a, 1).fillCircle(12, 12, 11);
    g.fillStyle(0x9ab0d0, 1).fillCircle(10, 13, 6).fillRect(12, 9, 10, 3);
  });
  bakeTexture(scene, 'icon_throne', 24, 24, (g) => {
    g.fillStyle(0x3a2a08, 1).fillCircle(12, 12, 11);
    g.fillStyle(0xf0c040, 1).fillTriangle(4, 18, 7, 6, 10, 18).fillTriangle(9, 18, 12, 3, 15, 18).fillTriangle(14, 18, 17, 6, 20, 18);
    g.fillRect(4, 17, 16, 3);
  });
}
