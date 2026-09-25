import Phaser from 'phaser';
import { makeCanvas } from '../render/CanvasUtil';
import { makeRng } from '../utils/rng';

/** Procedural gothic HUD art: metal frames with gold trim, rivets, crest, button frames. */

export const HUD = {
  bottomH: 172,
  topH: 38,
  minimap: { x: 20, y: 568, w: 200, h: 140 },
  center: { x: 246, y: 562, w: 560, h: 152 },
  grid: { x: 824, y: 562, w: 446, h: 152 },
  gold: '#c9a044',
  goldHi: '#f0d27a',
  text: '#e8e0c8',
} as const;

function metal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, light = 0x3a3c42): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  const r = (light >> 16) & 255;
  const gg = (light >> 8) & 255;
  const b = light & 255;
  g.addColorStop(0, `rgb(${r + 22},${gg + 22},${b + 24})`);
  g.addColorStop(0.5, `rgb(${r},${gg},${b})`);
  g.addColorStop(1, `rgb(${r - 22},${gg - 22},${b - 20})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // Brushed/grimy texture.
  const rnd = makeRng(seed);
  for (let i = 0; i < (w * h) / 60; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.035)';
    ctx.fillRect(x + rnd() * w, y + rnd() * h, 1 + rnd() * 6, 1);
  }
  for (let i = 0; i < 6; i++) {
    const cx = x + rnd() * w;
    const cy = y + rnd() * h;
    const rr = 10 + rnd() * 30;
    const s = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
    s.addColorStop(0, 'rgba(60,30,10,0.18)');
    s.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = s;
    ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  }
}

function rivet(ctx: CanvasRenderingContext2D, x: number, y: number, r = 2.4): void {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r);
  g.addColorStop(0, '#f6e6b0');
  g.addColorStop(0.6, '#a07c30');
  g.addColorStop(1, '#3a2a10');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Recessed well with gold trim and corner ornaments. */
export function well(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#0a0a0e');
  g.addColorStop(1, '#16151a');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = HUD.gold;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
  ctx.strokeStyle = 'rgba(240,210,122,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 4.5, y - 4.5, w + 9, h + 9);
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    ctx.fillStyle = HUD.gold;
    ctx.beginPath();
    ctx.moveTo(cx - sx * 5, cy - sy * 5);
    ctx.lineTo(cx + sx * 14, cy - sy * 5);
    ctx.lineTo(cx - sx * 5, cy + sy * 14);
    ctx.closePath();
    ctx.fill();
    rivet(ctx, cx - sx * 1, cy - sy * 1, 2);
  }
}

/** Winged skull-shield crest (original design). */
export function drawCrest(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  const gold = ctx.createLinearGradient(0, -s, 0, s);
  gold.addColorStop(0, HUD.goldHi);
  gold.addColorStop(1, '#7a5a20');
  ctx.fillStyle = gold;
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(d * s * 0.3, -s * 0.2);
    for (let i = 0; i < 4; i++) ctx.lineTo(d * s * (0.9 + i * 0.35), -s * (0.7 - i * 0.12) + (i % 2) * s * 0.3);
    ctx.lineTo(d * s * 1.6, s * 0.2);
    ctx.lineTo(d * s * 0.4, s * 0.45);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, -s * 0.6);
  ctx.lineTo(s * 0.55, -s * 0.6);
  ctx.lineTo(s * 0.5, s * 0.3);
  ctx.lineTo(0, s * 0.9);
  ctx.lineTo(-s * 0.5, s * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2a1a08';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#e8dcc0';
  ctx.beginPath();
  ctx.arc(0, -s * 0.12, s * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-s * 0.18, s * 0.1, s * 0.36, s * 0.2);
  ctx.fillStyle = '#140c08';
  ctx.fillRect(-s * 0.2, -s * 0.18, s * 0.14, s * 0.14);
  ctx.fillRect(s * 0.06, -s * 0.18, s * 0.14, s * 0.14);
  ctx.restore();
}

function bottomFrame(): HTMLCanvasElement {
  const W = 1280;
  const H = HUD.bottomH + 26;
  const top = 26;
  const { canvas, ctx } = makeCanvas(W, H);
  metal(ctx, 0, top, W, H - top, 4);
  // Raised top ridge with gold trim.
  ctx.fillStyle = '#50525a';
  ctx.fillRect(0, top, W, 5);
  ctx.fillStyle = HUD.gold;
  ctx.fillRect(0, top + 5, W, 1.5);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, top + 6.5, W, 2);
  for (let x = 12; x < W; x += 40) rivet(ctx, x, top + 14, 2);
  const m = HUD.minimap;
  const c = HUD.center;
  const g = HUD.grid;
  well(ctx, m.x - 2, m.y - (1280 - 1280) - (720 - H), m.w + 4, m.h + 4);
  well(ctx, c.x, c.y - (720 - H), c.w, c.h);
  well(ctx, g.x, g.y - (720 - H), g.w, g.h);
  // Crest plate protruding above the frame between the panels.
  const cx = (c.x + c.w + g.x) / 2;
  ctx.fillStyle = '#3a3c42';
  ctx.beginPath();
  ctx.moveTo(cx - 34, top);
  ctx.lineTo(cx - 20, 2);
  ctx.lineTo(cx + 20, 2);
  ctx.lineTo(cx + 34, top);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = HUD.gold;
  ctx.stroke();
  drawCrest(ctx, cx, 22, 16);
  return canvas;
}

function topFrame(): HTMLCanvasElement {
  const W = 1280;
  const H = HUD.topH + 6;
  const { canvas, ctx } = makeCanvas(W, H);
  metal(ctx, 0, 0, W, HUD.topH, 9, 0x2e3036);
  ctx.fillStyle = HUD.gold;
  ctx.fillRect(0, HUD.topH - 2, W, 1.5);
  const sh = ctx.createLinearGradient(0, HUD.topH, 0, H);
  sh.addColorStop(0, 'rgba(0,0,0,0.6)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, HUD.topH, W, 6);
  // Resource plaques.
  for (const [x, w] of [[8, 200], [216, 176], [400, 110], [560, 160], [728, 150]]) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, 5, w, HUD.topH - 11);
    ctx.strokeStyle = 'rgba(201,160,68,0.7)';
    ctx.strokeRect(x + 0.5, 5.5, w - 1, HUD.topH - 12);
    rivet(ctx, x + 5, HUD.topH / 2 - 1, 1.6);
    rivet(ctx, x + w - 5, HUD.topH / 2 - 1, 1.6);
  }
  return canvas;
}

function buttonFrame(state: 'up' | 'hover' | 'active'): HTMLCanvasElement {
  const S = 60;
  const { canvas, ctx } = makeCanvas(S, S);
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, state === 'hover' ? '#5a5048' : '#3e3a36');
  g.addColorStop(1, state === 'hover' ? '#2a2420' : '#1a1816');
  ctx.fillStyle = g;
  ctx.fillRect(2, 2, S - 4, S - 4);
  ctx.strokeStyle = state === 'active' ? '#60ff70' : state === 'hover' ? HUD.goldHi : HUD.gold;
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, S - 4, S - 4);
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(5.5, 5.5, S - 11, S - 11);
  for (const [x, y] of [[5, 5], [S - 5, 5], [5, S - 5], [S - 5, S - 5]]) rivet(ctx, x, y, 1.6);
  return canvas;
}

export function createHudArt(scene: Phaser.Scene): void {
  if (scene.textures.exists('hud_bottom')) return;
  scene.textures.addCanvas('hud_bottom', bottomFrame());
  scene.textures.addCanvas('hud_top', topFrame());
  for (const st of ['up', 'hover', 'active'] as const) scene.textures.addCanvas(`hud_btn_${st}`, buttonFrame(st));
  const crest = makeCanvas(64, 64);
  drawCrest(crest.ctx, 32, 30, 18);
  scene.textures.addCanvas('hud_crest', crest.canvas);
}
