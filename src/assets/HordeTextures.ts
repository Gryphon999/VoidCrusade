import Phaser from 'phaser';
import { makeRng } from '../utils/rng';

type G = Phaser.GameObjects.Graphics;
const FLESH = 0x5a1f2e;
const FLESH_D = 0x2e0c16;
const FLESH_L = 0x8a3448;
const GLOW = 0xc040ff;
const BONE = 0xd8cfb0;

function blob(g: G, cx: number, cy: number, r: number, color: number, seed: number): void {
  const rnd = makeRng(seed);
  g.fillStyle(color, 1);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const d = r * (0.45 + rnd() * 0.3);
    g.fillCircle(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * (0.45 + rnd() * 0.2));
  }
  g.fillCircle(cx, cy, r * 0.7);
}

export function drawHive(g: G, s: number): void {
  const c = s / 2;
  const rnd = makeRng(99);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    g.lineStyle(10, FLESH_D, 1).lineBetween(c, c, c + Math.cos(a) * s * 0.48, c + Math.sin(a) * s * 0.48);
  }
  blob(g, c, c, s * 0.42, FLESH_D, 5);
  blob(g, c, c, s * 0.36, FLESH, 6);
  for (let i = 0; i < 12; i++) {
    g.fillStyle(FLESH_L, 1).fillCircle(c + (rnd() - 0.5) * s * 0.5, c + (rnd() - 0.5) * s * 0.5, 6 + rnd() * 8);
  }
  g.fillStyle(0x16040a, 1).fillCircle(c, c, 34);
  g.fillStyle(GLOW, 1).fillCircle(c, c, 20);
  g.fillStyle(0xffe0ff, 1).fillCircle(c, c, 8);
}

export function drawSpire(g: G, s: number): void {
  const c = s / 2;
  blob(g, c, c + 20, s * 0.34, FLESH_D, 12);
  g.fillStyle(BONE, 1).fillTriangle(c, 6, c - 26, c + 40, c + 26, c + 40);
  g.fillStyle(0xa89f80, 1).fillTriangle(c, 18, c - 10, c + 36, c + 4, c + 36);
  g.fillStyle(GLOW, 1).fillCircle(c, c + 10, 12);
  g.fillStyle(0xffe0ff, 1).fillCircle(c, c + 10, 5);
}

export function drawBrood(g: G, s: number): void {
  const c = s / 2;
  const rnd = makeRng(41);
  blob(g, c, c, s * 0.44, FLESH_D, 21);
  g.fillStyle(0x0e0206, 1).fillEllipse(c, c, s * 0.62, s * 0.5);
  for (let i = 0; i < 9; i++) {
    const x = c + (rnd() - 0.5) * s * 0.44;
    const y = c + (rnd() - 0.5) * s * 0.3;
    g.fillStyle(0xb8a060, 1).fillEllipse(x, y, 20, 26);
    g.fillStyle(0xe8d890, 1).fillEllipse(x - 3, y - 4, 7, 9);
  }
}

export function drawMaw(g: G, s: number): void {
  const c = s / 2;
  blob(g, c, c, s * 0.45, FLESH, 33);
  g.fillStyle(0x12020a, 1).fillCircle(c, c, s * 0.28);
  g.fillStyle(BONE, 1);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x = c + Math.cos(a) * s * 0.28;
    const y = c + Math.sin(a) * s * 0.28;
    const ix = c + Math.cos(a) * s * 0.16;
    const iy = c + Math.sin(a) * s * 0.16;
    const px = Math.cos(a + Math.PI / 2) * 7;
    const py = Math.sin(a + Math.PI / 2) * 7;
    g.fillTriangle(x + px, y + py, x - px, y - py, ix, iy);
  }
  g.fillStyle(0xff3030, 1).fillCircle(c, c, 8);
}

export function drawSpine(g: G, s: number): void {
  const c = s / 2;
  blob(g, c, c, s * 0.42, FLESH_D, 44);
  blob(g, c, c, s * 0.32, FLESH, 45);
  g.fillStyle(BONE, 1);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.fillTriangle(c + Math.cos(a) * 30, c + Math.sin(a) * 30, c + Math.cos(a + 0.3) * 20, c + Math.sin(a + 0.3) * 20,
      c + Math.cos(a) * 52, c + Math.sin(a) * 52);
  }
}

export function drawSpineGun(g: G): void {
  g.fillStyle(FLESH_L, 1).fillCircle(24, 24, 18);
  g.fillStyle(GLOW, 1).fillCircle(24, 24, 7);
  g.fillStyle(BONE, 1).fillTriangle(34, 16, 34, 32, 86, 24);
}
