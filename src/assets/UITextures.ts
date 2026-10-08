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
  createModifierIcons(scene);
}

/** Battle modifier icons (24×24 discs): one per entry of BattleModifiers. */
function createModifierIcons(scene: Phaser.Scene): void {
  const disc = (g: Phaser.GameObjects.Graphics, color: number): void => {
    g.fillStyle(color, 1).fillCircle(12, 12, 11);
  };
  bakeTexture(scene, 'icon_mod_storms', 24, 24, (g) => {
    // Swirling ash: three grey arcs.
    disc(g, 0x3a3630);
    g.lineStyle(2, 0xb0a898, 1);
    g.beginPath().arc(12, 12, 7, 0.2, 2.6).strokePath();
    g.beginPath().arc(12, 12, 4, 3.4, 5.9).strokePath();
    g.fillStyle(0xd8d0c0, 1).fillCircle(16, 8, 1.5).fillCircle(7, 15, 1.2);
  });
  bakeTexture(scene, 'icon_mod_night', 24, 24, (g) => {
    // Crescent moon on deep blue.
    disc(g, 0x101a3a);
    g.fillStyle(0xcfdcff, 1).fillCircle(12, 12, 7);
    g.fillStyle(0x101a3a, 1).fillCircle(15, 10, 6);
    g.fillStyle(0xcfdcff, 1).fillCircle(6, 7, 1).fillCircle(18, 18, 1);
  });
  bakeTexture(scene, 'icon_mod_plenty', 24, 24, (g) => {
    // Overflowing seals.
    disc(g, 0x4a3a10);
    g.fillStyle(0xf0c040, 1).fillCircle(9, 14, 5).fillCircle(15, 14, 5).fillCircle(12, 9, 5);
    g.fillStyle(0x6b4a10, 1).fillCircle(9, 14, 2).fillCircle(15, 14, 2).fillCircle(12, 9, 2);
  });
  bakeTexture(scene, 'icon_mod_scarcity', 24, 24, (g) => {
    // A single cracked seal.
    disc(g, 0x2e2416);
    g.fillStyle(0xb08a30, 1).fillCircle(12, 12, 7);
    g.lineStyle(2, 0x2e2416, 1).lineBetween(9, 6, 13, 12).lineBetween(13, 12, 10, 18);
  });
  bakeTexture(scene, 'icon_mod_noDefense', 24, 24, (g) => {
    // Turret under a red bar.
    disc(g, 0x20283a);
    g.fillStyle(0x9ab0d0, 1).fillCircle(10, 13, 5).fillRect(12, 10, 8, 3);
    g.lineStyle(3, 0xff4040, 1).lineBetween(5, 5, 19, 19);
  });
  bakeTexture(scene, 'icon_mod_smallWar', 24, 24, (g) => {
    // Three soldiers.
    disc(g, 0x1a2a40);
    g.fillStyle(0x6aa0ff, 1).fillCircle(8, 12, 2.5).fillCircle(12, 12, 2.5).fillCircle(16, 12, 2.5);
  });
  bakeTexture(scene, 'icon_mod_bigWar', 24, 24, (g) => {
    // A full phalanx.
    disc(g, 0x1a2a40);
    g.fillStyle(0x6aa0ff, 1);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) g.fillCircle(6 + c * 4, 8 + r * 4, 1.6);
  });
  bakeTexture(scene, 'icon_mod_veterans', 24, 24, (g) => {
    // Two rank chevrons.
    disc(g, 0x3a2e14);
    g.lineStyle(3, 0xf0c040, 1);
    g.lineBetween(6, 9, 12, 14).lineBetween(12, 14, 18, 9);
    g.lineBetween(6, 14, 12, 19).lineBetween(12, 19, 18, 14);
  });
  bakeTexture(scene, 'icon_mod_glassCannon', 24, 24, (g) => {
    // Shattering shot.
    disc(g, 0x4a1010);
    g.fillStyle(0xff6a40, 1).fillTriangle(12, 3, 7, 17, 17, 17);
    g.lineStyle(1.5, 0xffe0c0, 1).lineBetween(12, 8, 10, 14).lineBetween(12, 8, 14, 13).lineBetween(10, 14, 12, 17);
  });
  bakeTexture(scene, 'icon_mod_blitz', 24, 24, (g) => {
    // Lightning bolt.
    disc(g, 0x3a3010);
    g.fillStyle(0xffe060, 1).fillTriangle(14, 3, 6, 13, 12, 13).fillTriangle(10, 21, 18, 11, 12, 11);
  });
}
