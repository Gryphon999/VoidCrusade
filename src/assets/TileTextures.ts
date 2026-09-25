import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { makeRng } from '../utils/rng';

export const TILE_KEYS = ['tile_ground', 'tile_cliff', 'tile_road', 'tile_ruins'] as const;
export const TILESET_KEY = 'tileset';

/** Draws graphics into a RenderTexture and saves it as a named texture. */
export function bakeTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  const rt = scene.make.renderTexture({ x: 0, y: 0, width: w, height: h }, false);
  rt.draw(g, 0, 0);
  rt.saveTexture(key);
  g.destroy();
}

function drawGround(g: Phaser.GameObjects.Graphics): void {
  const s = TILE_SIZE;
  const rnd = makeRng(11);
  g.fillStyle(0x2d2d2d, 1).fillRect(0, 0, s, s);
  for (let i = 0; i < 40; i++) {
    const c = rnd() < 0.5 ? 0x353535 : 0x262626;
    g.fillStyle(c, 1).fillRect(Math.floor(rnd() * s), Math.floor(rnd() * s), 2 + Math.floor(rnd() * 3), 2);
  }
  for (let i = 0; i < 3; i++) {
    g.fillStyle(0x3a3a3a, 1).fillCircle(8 + rnd() * 48, 8 + rnd() * 48, 2 + rnd() * 3);
  }
  g.lineStyle(1, 0x3d3d3d, 1).strokeRect(0.5, 0.5, s - 1, s - 1);
}

function drawCliff(g: Phaser.GameObjects.Graphics): void {
  const s = TILE_SIZE;
  const rnd = makeRng(23);
  g.fillStyle(0x1a1108, 1).fillRect(0, 0, s, s);
  for (let i = 0; i < 90; i++) {
    const c = [0x2b1d0e, 0x0e0904, 0x3a2812][Math.floor(rnd() * 3)];
    g.fillStyle(c, 1).fillRect(Math.floor(rnd() * s), Math.floor(rnd() * s), 1 + Math.floor(rnd() * 3), 1 + Math.floor(rnd() * 2));
  }
  g.lineStyle(2, 0x0a0602, 1);
  g.lineBetween(6, 12, 30, 26).lineBetween(30, 26, 44, 20).lineBetween(20, 50, 52, 44);
}

function drawRoad(g: Phaser.GameObjects.Graphics): void {
  const s = TILE_SIZE;
  const rnd = makeRng(37);
  g.fillStyle(0x4a4238, 1).fillRect(0, 0, s, s);
  for (let i = 0; i < 50; i++) {
    const c = rnd() < 0.5 ? 0x544b40 : 0x3f382f;
    g.fillStyle(c, 1).fillRect(Math.floor(rnd() * s), Math.floor(rnd() * s), 2, 2);
  }
  g.fillStyle(0x3a332b, 1).fillRect(0, 20, s, 3).fillRect(0, 42, s, 3);
}

function drawRuins(g: Phaser.GameObjects.Graphics): void {
  const s = TILE_SIZE;
  const rnd = makeRng(51);
  g.fillStyle(0x2a2826, 1).fillRect(0, 0, s, s);
  for (let i = 0; i < 14; i++) {
    const x = rnd() * s;
    const y = rnd() * s;
    const w = 4 + rnd() * 12;
    const h = 3 + rnd() * 8;
    g.fillStyle(rnd() < 0.5 ? 0x55504a : 0x46413c, 1).fillRect(x, y, w, h);
    g.fillStyle(0x1c1a18, 1).fillRect(x, y + h, w, 2);
  }
  g.fillStyle(0x625c55, 1).fillRect(6, 8, 22, 6).fillRect(6, 8, 6, 24);
  g.fillStyle(0x625c55, 1).fillRect(40, 38, 18, 6).fillRect(52, 26, 6, 18);
}

export function createTileTextures(scene: Phaser.Scene): void {
  const s = TILE_SIZE;
  bakeTexture(scene, 'tile_ground', s, s, drawGround);
  bakeTexture(scene, 'tile_cliff', s, s, drawCliff);
  bakeTexture(scene, 'tile_road', s, s, drawRoad);
  bakeTexture(scene, 'tile_ruins', s, s, drawRuins);
  if (!scene.textures.exists(TILESET_KEY)) {
    const rt = scene.make.renderTexture({ x: 0, y: 0, width: s * TILE_KEYS.length, height: s }, false);
    TILE_KEYS.forEach((k, i) => rt.draw(k, i * s, 0));
    rt.saveTexture(TILESET_KEY);
  }
}
