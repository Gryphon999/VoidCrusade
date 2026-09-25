import Phaser from 'phaser';
import { bakeTexture } from './TileTextures';

export function createUnitTextures(scene: Phaser.Scene): void {
  bakeTexture(scene, 'sel_ring', 32, 32, (g) => {
    g.lineStyle(3, 0x0a2a0a, 0.8).strokeCircle(16, 16, 13.5);
    g.lineStyle(1.6, 0x60ff70, 1).strokeCircle(16, 16, 13.5);
  });
  bakeTexture(scene, 'proj_bullet', 12, 4, (g) => {
    g.fillStyle(0xfff0a0, 1).fillRect(0, 1, 12, 2);
    g.fillStyle(0xffffff, 1).fillRect(8, 1, 4, 2);
  });
  bakeTexture(scene, 'proj_shell', 10, 10, (g) => {
    g.fillStyle(0xff8020, 0.6).fillCircle(5, 5, 5);
    g.fillStyle(0xffe070, 1).fillCircle(5, 5, 3);
  });
  bakeTexture(scene, 'proj_spit', 10, 10, (g) => {
    g.fillStyle(0x80ff40, 0.5).fillCircle(5, 5, 5);
    g.fillStyle(0xd0ff80, 1).fillCircle(5, 5, 2.5);
  });
  bakeTexture(scene, 'proj_spine', 16, 6, (g) => {
    g.fillStyle(0xe8dcb0, 1).fillTriangle(0, 0, 0, 6, 16, 3);
  });
  bakeTexture(scene, 'fx_slash', 24, 24, (g) => {
    g.lineStyle(3, 0xffffff, 0.9).beginPath().arc(12, 12, 9, -1.2, 1.2).strokePath();
  });
  bakeTexture(scene, 'move_marker', 32, 32, (g) => {
    g.lineStyle(2, 0x40ff60, 1).strokeCircle(16, 16, 12);
    g.lineBetween(16, 2, 16, 8).lineBetween(16, 24, 16, 30).lineBetween(2, 16, 8, 16).lineBetween(24, 16, 30, 16);
  });
}
