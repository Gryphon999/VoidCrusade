import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { BUILDING_DEFS, BuildingId } from '../buildings/BuildingDefs';
import { bakeTexture } from './TileTextures';
import { drawHive, drawSpire, drawBrood, drawMaw, drawSpine, drawSpineGun } from './HordeTextures';

type G = Phaser.GameObjects.Graphics;
const STEEL = 0x5a6070;
const STEEL_D = 0x33373f;
const STEEL_L = 0x80889a;
const BLUE = 0x3a8dff;

function plate(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(STEEL_D, 1).fillRect(x, y, w, h);
  g.fillStyle(STEEL, 1).fillRect(x + 3, y + 3, w - 6, h - 6);
  g.lineStyle(2, STEEL_L, 1).strokeRect(x + 3, y + 3, w - 6, h - 6);
}

function drawStronghold(g: G, s: number): void {
  plate(g, 16, 16, s - 32, s - 32);
  for (const [x, y] of [[4, 4], [s - 60, 4], [4, s - 60], [s - 60, s - 60]]) {
    g.fillStyle(STEEL_D, 1).fillRect(x, y, 56, 56);
    g.fillStyle(STEEL_L, 1).fillRect(x + 6, y + 6, 44, 44);
    g.fillStyle(BLUE, 1).fillRect(x + 20, y + 20, 16, 16);
  }
  g.fillStyle(0x23262d, 1).fillRect(s / 2 - 48, s / 2 - 48, 96, 96);
  g.fillStyle(BLUE, 1).fillTriangle(s / 2, s / 2 - 36, s / 2 - 34, s / 2 + 24, s / 2 + 34, s / 2 + 24);
  g.fillStyle(0xd8d8e8, 1).fillRect(s / 2 - 40, s / 2 - 6, 80, 10);
  g.fillStyle(0xd8d8e8, 1).fillCircle(s / 2, s / 2 - 8, 10);
}

function drawGenerator(g: G, s: number): void {
  const c = s / 2;
  g.fillStyle(STEEL_D, 1).fillRect(10, c - 10, s - 20, 20).fillRect(c - 10, 10, 20, s - 20);
  g.fillStyle(STEEL_D, 1).fillCircle(c, c, s * 0.36);
  g.fillStyle(STEEL, 1).fillCircle(c, c, s * 0.31);
  g.fillStyle(0x0c3a48, 1).fillCircle(c, c, s * 0.2);
  g.fillStyle(0x40e0ff, 1).fillCircle(c, c, s * 0.13);
  g.fillStyle(0xd0ffff, 1).fillCircle(c, c, s * 0.06);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.fillStyle(STEEL_L, 1).fillCircle(c + Math.cos(a) * s * 0.26, c + Math.sin(a) * s * 0.26, 5);
  }
}

function drawBarracks(g: G, s: number): void {
  plate(g, 8, 28, s - 16, s - 44);
  for (let i = 0; i < 5; i++) g.fillStyle(i % 2 ? STEEL_D : STEEL_L, 1).fillRect(20 + i * 32, 40, 24, 70);
  g.fillStyle(0x1a1a1f, 1).fillRect(s / 2 - 22, s - 50, 44, 34);
  g.fillStyle(BLUE, 1).fillRect(12, 16, s - 24, 12);
  g.fillStyle(0xffcc33, 1).fillRect(s / 2 - 22, s - 54, 44, 4);
}

function drawMechanis(g: G, s: number): void {
  plate(g, 6, 6, s - 12, s - 12);
  const c = s / 2;
  g.fillStyle(STEEL_D, 1).fillCircle(c, c - 10, 52);
  g.fillStyle(0xc08a2a, 1);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.fillRect(c + Math.cos(a) * 44 - 7, c - 10 + Math.sin(a) * 44 - 7, 14, 14);
  }
  g.fillStyle(0xe0a030, 1).fillCircle(c, c - 10, 40);
  g.fillStyle(STEEL_D, 1).fillCircle(c, c - 10, 16);
  g.fillStyle(0x222222, 1).fillRect(20, s - 44, s - 40, 30);
  for (let i = 0; i < 8; i++) g.fillStyle(0xffcc33, 1).fillTriangle(24 + i * 19, s - 14, 34 + i * 19, s - 14, 29 + i * 19, s - 22);
  g.fillStyle(BLUE, 1).fillRect(10, 10, 20, 20).fillRect(s - 30, 10, 20, 20);
}

function drawTurret(g: G, s: number): void {
  const c = s / 2;
  g.fillStyle(STEEL_D, 1).fillRect(8, 8, s - 16, s - 16);
  g.fillStyle(0xffcc33, 1);
  for (let i = 0; i < 4; i++) g.fillRect(8 + i * 30, 8, 14, 6).fillRect(8 + i * 30, s - 14, 14, 6);
  g.fillStyle(STEEL, 1).fillCircle(c, c, 40);
  g.lineStyle(3, STEEL_L, 1).strokeCircle(c, c, 40);
}

function drawTurretGun(g: G): void {
  // Barrel pointing right; origin at (24, 24).
  g.fillStyle(STEEL_D, 1).fillCircle(24, 24, 22);
  g.fillStyle(STEEL_L, 1).fillCircle(24, 24, 16);
  g.fillStyle(BLUE, 1).fillCircle(24, 24, 7);
  g.fillStyle(0x2a2d33, 1).fillRect(34, 14, 50, 7).fillRect(34, 27, 50, 7);
  g.fillStyle(0x111111, 1).fillRect(80, 14, 6, 7).fillRect(80, 27, 6, 7);
}

function drawRelay(g: G, s: number): void {
  const c = s / 2;
  g.fillStyle(STEEL_D, 1).fillTriangle(c, 16, 20, s - 12, s - 20, s - 12);
  g.fillStyle(STEEL, 1).fillTriangle(c, 28, 32, s - 18, s - 32, s - 18);
  g.lineStyle(3, BLUE, 0.9);
  for (let r = 18; r <= 46; r += 14) g.beginPath().arc(c, 30, r, Math.PI * 1.15, Math.PI * 1.85).strokePath();
  g.fillStyle(0xd0e8ff, 1).fillCircle(c, 26, 8);
}

function drawResearch(g: G, s: number): void {
  plate(g, 8, 36, s - 16, s - 44);
  g.fillStyle(STEEL_D, 1).fillRect(24, 4, 28, 50).fillRect(s - 52, 4, 28, 50);
  g.fillStyle(0x201510, 1).fillRect(28, 4, 20, 8).fillRect(s - 48, 4, 20, 8);
  g.fillStyle(0xff6a1a, 1).fillCircle(s / 2, s / 2 + 22, 30);
  g.fillStyle(0xffd060, 1).fillCircle(s / 2, s / 2 + 22, 16);
  g.lineStyle(4, STEEL_L, 1).strokeCircle(s / 2, s / 2 + 22, 32);
  g.fillStyle(BLUE, 1).fillRect(16, s - 26, s - 32, 8);
}

const DRAWERS: Record<BuildingId, (g: G, s: number) => void> = {
  stronghold: drawStronghold,
  generator: drawGenerator,
  barracks: drawBarracks,
  mechanis: drawMechanis,
  turret: drawTurret,
  relay: drawRelay,
  research: drawResearch,
  hive: drawHive,
  spire: drawSpire,
  brood: drawBrood,
  maw: drawMaw,
  spine: drawSpine,
};

export function buildingTextureKey(id: BuildingId): string {
  return `bld_${id}`;
}

export function createBuildingTextures(scene: Phaser.Scene): void {
  for (const def of Object.values(BUILDING_DEFS)) {
    const s = def.size * TILE_SIZE;
    bakeTexture(scene, buildingTextureKey(def.id), s, s, (g) => DRAWERS[def.id](g, s));
  }
  bakeTexture(scene, 'bld_turret_gun', 90, 48, drawTurretGun);
  bakeTexture(scene, 'bld_spine_gun', 90, 48, drawSpineGun);
}

/** Key of the 2.5D (extruded) building image for the current tilt. */
export function volumeTextureKey(id: BuildingId, tilt: number): string {
  return `bld3d_${id}_${Math.round(tilt * 100)}`;
}

/**
 * Bakes extruded building images for a tilt: a lit roof (the top-down art squashed by the tilt)
 * raised on a front wall of `def.height` px. Origin of the result is the footprint's bottom edge.
 */
export function ensureBuildingVolumes(scene: Phaser.Scene, tilt: number): void {
  for (const def of Object.values(BUILDING_DEFS)) {
    const key = volumeTextureKey(def.id, tilt);
    if (scene.textures.exists(key)) continue;
    const w = def.size * TILE_SIZE;
    const roofH = Math.round(w * tilt);
    const h = def.height;
    const rt = scene.make.renderTexture({ x: 0, y: 0, width: w, height: roofH + h }, false);
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const wall = def.faction === 'ironvoid' ? 0x2c3038 : 0x3a1220;
    g.fillStyle(wall, 1).fillRect(4, roofH, w - 8, h);
    g.fillStyle(0x000000, 0.35).fillRect(4, roofH + h - 6, w - 8, 6);
    g.fillStyle(0xffffff, 0.08).fillRect(4, roofH, w - 8, 3);
    for (let x = 16; x < w - 12; x += 22) g.fillStyle(0x000000, 0.25).fillRect(x, roofH + 6, 3, h - 12);
    rt.draw(g, 0, 0);
    const roof = scene.make.image({ x: w / 2, y: roofH / 2, key: buildingTextureKey(def.id) }, false);
    roof.setScale(1, tilt);
    rt.draw(roof);
    rt.saveTexture(key);
    g.destroy();
    roof.destroy();
  }
}
