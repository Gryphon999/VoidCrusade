import Phaser from 'phaser';
import { makeCanvas } from '../render/CanvasUtil';
import { makeRng } from '../utils/rng';
import { ValueNoise } from '../render/Noise';

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

/**
 * Lit steel plate: a height field (edge bevel, plate seams, scratches, hammered mottling) is
 * shaded per pixel with a key light from the upper left and a tight specular, so the frame
 * reads as machined metal rather than a flat gradient.
 */
function metal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, light = 0x3a3c42): void {
  const W = Math.round(w);
  const H = Math.round(h);
  const hf = new Float32Array(W * H);
  const n = new ValueNoise(seed);
  const rnd = makeRng(seed);
  const seamX = new Set<number>();
  for (let sx = 150 + Math.floor(rnd() * 60); sx < W - 40; sx += 180 + Math.floor(rnd() * 80)) seamX.add(sx);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const e = Math.min(px, py, W - 1 - px, H - 1 - py);
      let v = Math.min(1, e / 5) * 1.2;
      v += n.fbm(px / 40, py / 40, 4) * 0.35 + n.noise(px / 3.1, py / 3.1) * 0.05;
      for (const sx of seamX) {
        const d = Math.abs(px - sx);
        if (d < 3) v -= (1 - d / 3) * 0.9;
      }
      hf[py * W + px] = v;
    }
  }
  // Scratches: short bright-edged gouges.
  for (let i = 0; i < (W * H) / 900; i++) {
    let sx = rnd() * W;
    let sy = rnd() * H;
    const a = rnd() * Math.PI;
    const len = 6 + rnd() * 30;
    for (let k = 0; k < len; k++) {
      sx += Math.cos(a);
      sy += Math.sin(a) * 0.3;
      const ix = Math.round(sx);
      const iy = Math.round(sy);
      if (ix > 0 && iy > 0 && ix < W && iy < H) hf[iy * W + ix] -= 0.25;
    }
  }
  const img = ctx.createImageData(W, H);
  const br = (light >> 16) & 255;
  const bg = (light >> 8) & 255;
  const bb = light & 255;
  const L = { x: -0.45, y: -0.7, z: 0.55 };
  const ll = Math.hypot(L.x, L.y, L.z);
  L.x /= ll;
  L.y /= ll;
  L.z /= ll;
  const Hh = { x: L.x, y: L.y, z: L.z + 1 };
  const hl = Math.hypot(Hh.x, Hh.y, Hh.z);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = py * W + px;
      const gx = (hf[py * W + Math.min(W - 1, px + 1)] - hf[py * W + Math.max(0, px - 1)]) * 1.6;
      const gy = (hf[Math.min(H - 1, py + 1) * W + px] - hf[Math.max(0, py - 1) * W + px]) * 1.6;
      const nl = Math.hypot(gx, gy, 1);
      const nx = -gx / nl;
      const ny = -gy / nl;
      const nz = 1 / nl;
      const diff = Math.max(0, nx * L.x + ny * L.y + nz * L.z);
      const spec = Math.pow(Math.max(0, (nx * Hh.x + ny * Hh.y + nz * Hh.z) / hl), 28);
      // Vertical falloff: the plate is lit from above.
      const fall = 1.12 - (py / H) * 0.35;
      const grime = 0.82 + n.fbm(px / 90 + 7, py / 60 + 3, 3) * 0.3;
      const k = (0.42 + 0.78 * diff) * fall * grime;
      const p = i * 4;
      img.data[p] = Math.min(255, br * k + spec * 95);
      img.data[p + 1] = Math.min(255, bg * k + spec * 92);
      img.data[p + 2] = Math.min(255, bb * k + spec * 90);
      img.data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, x, y);
  // Rust and soot blooms.
  for (let i = 0; i < 6; i++) {
    const cx = x + rnd() * w;
    const cy = y + rnd() * h;
    const rr = 10 + rnd() * 30;
    const s = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
    s.addColorStop(0, 'rgba(60,30,10,0.16)');
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
  g.addColorStop(0, '#07080c');
  g.addColorStop(0.5, '#0d0f15');
  g.addColorStop(1, '#14151b');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // Recessed glass: inner shadow at the top, faint hex lattice, a cold glint.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const inner = ctx.createLinearGradient(0, y, 0, y + 14);
  inner.addColorStop(0, 'rgba(0,0,0,0.75)');
  inner.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = inner;
  ctx.fillRect(x, y, w, 14);
  ctx.strokeStyle = 'rgba(120,160,220,0.045)';
  ctx.lineWidth = 1;
  const hs = 9;
  for (let yy = y; yy < y + h + hs; yy += hs * 1.5) {
    for (let xx = x - hs; xx < x + w + hs; xx += hs * Math.sqrt(3)) {
      const ox = (Math.round((yy - y) / (hs * 1.5)) % 2) * hs * Math.sqrt(3) / 2;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        const px = xx + ox + Math.cos(a) * hs * 0.55;
        const py = yy + Math.sin(a) * hs * 0.55;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  const glint = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
  glint.addColorStop(0, 'rgba(160,190,255,0.06)');
  glint.addColorStop(0.4, 'rgba(160,190,255,0)');
  ctx.fillStyle = glint;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
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
