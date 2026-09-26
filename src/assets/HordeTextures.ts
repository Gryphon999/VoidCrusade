import Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;
const FLESH_L = 0x8a3448;
const GLOW = 0xc040ff;
const BONE = 0xd8cfb0;

export function drawSpineGun(g: G): void {
  g.fillStyle(FLESH_L, 1).fillCircle(24, 24, 18);
  g.fillStyle(GLOW, 1).fillCircle(24, 24, 7);
  g.fillStyle(BONE, 1).fillTriangle(34, 16, 34, 32, 86, 24);
}
