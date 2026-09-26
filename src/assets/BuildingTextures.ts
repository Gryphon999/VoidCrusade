import Phaser from 'phaser';
import { bakeTexture } from './TileTextures';
import { drawSpineGun } from './HordeTextures';

type G = Phaser.GameObjects.Graphics;
const STEEL_D = 0x33373f;
const STEEL_L = 0x80889a;
const BLUE = 0x3a8dff;

function drawTurretGun(g: G): void {
  // Barrel pointing right; origin at (24, 24).
  g.fillStyle(STEEL_D, 1).fillCircle(24, 24, 22);
  g.fillStyle(STEEL_L, 1).fillCircle(24, 24, 16);
  g.fillStyle(BLUE, 1).fillCircle(24, 24, 7);
  g.fillStyle(0x2a2d33, 1).fillRect(34, 14, 50, 7).fillRect(34, 27, 50, 7);
  g.fillStyle(0x111111, 1).fillRect(80, 14, 6, 7).fillRect(80, 27, 6, 7);
}

/** Rotating turret guns (building bodies are painted in render/buildings). */
export function createBuildingTextures(scene: Phaser.Scene): void {
  bakeTexture(scene, 'bld_turret_gun', 90, 48, drawTurretGun);
  bakeTexture(scene, 'bld_spine_gun', 90, 48, drawSpineGun);
}
