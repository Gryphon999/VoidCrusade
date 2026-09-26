import Phaser from 'phaser';
import { makeRng } from '../utils/rng';
import { makeCanvas, rgb, shade } from './CanvasUtil';

export type PropKind = 'tree' | 'skulls' | 'banner' | 'wreck' | 'rocks' | 'wall' | 'pillar' | 'crates';

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number) => void;

interface PropSpec {
  w: number;
  h: number;
  /** Where the ground contact sits, as a fraction of height. */
  base: number;
  paint: Painter;
}

function branch(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, len: number, wdt: number, depth: number, rnd: () => number): void {
  const x2 = x + Math.cos(a) * len;
  const y2 = y + Math.sin(a) * len;
  ctx.lineWidth = wdt;
  ctx.strokeStyle = depth > 2 ? '#2a221c' : '#3a3028';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo((x + x2) / 2 + (rnd() - 0.5) * len * 0.4, (y + y2) / 2, x2, y2);
  ctx.stroke();
  if (depth > 0) {
    const n = 2 + (rnd() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) branch(ctx, x2, y2, a + (rnd() - 0.5) * 1.4, len * (0.55 + rnd() * 0.2), wdt * 0.62, depth - 1, rnd);
  }
}

function skull(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r * 1.2);
  g.addColorStop(0, '#efe6cc');
  g.addColorStop(1, '#8a8068');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - r * 0.55, y + r * 0.5, r * 1.1, r * 0.7);
  ctx.fillStyle = '#140c08';
  ctx.beginPath();
  ctx.arc(x - r * 0.38, y + r * 0.05, r * 0.26, 0, Math.PI * 2);
  ctx.arc(x + r * 0.38, y + r * 0.05, r * 0.26, 0, Math.PI * 2);
  ctx.fill();
}

/** Oblique block: top face squashed, front face below; light from the north-west. */
function block(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number, col: number): void {
  ctx.fillStyle = rgb(shade(col, 0.6));
  ctx.fillRect(x, y + d, w, h);
  ctx.fillStyle = rgb(shade(col, 1.15));
  ctx.fillRect(x, y, w, d);
  ctx.fillStyle = 'rgba(255,240,220,0.18)';
  ctx.fillRect(x, y, w, 1.5);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + w - 2, y, 2, d + h);
}

const SPECS: Record<PropKind, PropSpec> = {
  tree: { w: 90, h: 100, base: 0.95, paint: (ctx, w, h, rnd) => {
    ctx.lineCap = 'round';
    branch(ctx, w / 2, h * 0.95, -Math.PI / 2 + (rnd() - 0.5) * 0.3, h * 0.36, 7, 4, rnd);
  } },
  skulls: { w: 30, h: 70, base: 0.96, paint: (ctx, w, h, rnd) => {
    ctx.fillStyle = '#3a2e24';
    ctx.fillRect(w / 2 - 2, 8, 4, h - 10);
    ctx.fillStyle = 'rgba(255,230,200,0.2)';
    ctx.fillRect(w / 2 - 2, 8, 1, h - 10);
    ctx.fillStyle = '#6a5a44';
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2 - 3, 10);
    ctx.lineTo(w / 2 + 3, 10);
    ctx.fill();
    skull(ctx, w / 2, 16, 6);
    skull(ctx, w / 2 + (rnd() < 0.5 ? -5 : 5), 32, 5);
    ctx.strokeStyle = '#2a2018';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2, 40 + i * 7);
      ctx.lineTo(w / 2 + (i % 2 ? 9 : -9), 36 + i * 7);
      ctx.stroke();
    }
  } },
  banner: { w: 44, h: 90, base: 0.97, paint: (ctx, w, h, rnd) => {
    ctx.fillStyle = '#2c2620';
    ctx.fillRect(8, 4, 4, h - 6);
    ctx.fillStyle = '#b09040';
    ctx.fillRect(6, 10, w - 10, 3);
    ctx.beginPath();
    ctx.arc(10, 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
    const cloth = rnd() < 0.5 ? 0x6a1418 : 0x2a3450;
    const g = ctx.createLinearGradient(12, 0, w - 4, 0);
    g.addColorStop(0, rgb(shade(cloth, 1.3)));
    g.addColorStop(1, rgb(shade(cloth, 0.6)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(12, 13);
    ctx.lineTo(w - 4, 13);
    for (let i = 0; i <= 5; i++) ctx.lineTo(w - 4 - i * ((w - 16) / 5), 58 + (i % 2 ? -10 : 0) + rnd() * 6);
    ctx.closePath();
    ctx.fill();
    // Faded emblem: a winged skull-shield.
    ctx.fillStyle = 'rgba(210,190,140,0.45)';
    ctx.beginPath();
    ctx.moveTo(w / 2 + 4, 22);
    ctx.lineTo(w / 2 + 12, 30);
    ctx.lineTo(w / 2 + 4, 42);
    ctx.lineTo(w / 2 - 4, 30);
    ctx.fill();
  } },
  wreck: { w: 110, h: 70, base: 0.9, paint: (ctx, w, _h, rnd) => {
    block(ctx, 8, 22, w - 20, 22, 18, 0x3a3430);
    ctx.fillStyle = '#1a1614';
    for (let i = 0; i < 6; i++) ctx.fillRect(10 + i * 15, 58, 11, 6);
    block(ctx, 30, 10, 38, 14, 12, 0x413a34);
    ctx.save();
    ctx.translate(66, 18);
    ctx.rotate(0.35 + rnd() * 0.3);
    ctx.fillStyle = '#2a2624';
    ctx.fillRect(0, -3, 40, 6);
    ctx.restore();
    // Rust and scorch.
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(110,50,20,0.45)' : 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(12 + rnd() * (w - 30), 24 + rnd() * 30, 4 + rnd() * 8, 3 + rnd() * 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } },
  rocks: { w: 60, h: 40, base: 0.85, paint: (ctx, w, h, rnd) => {
    for (let i = 0; i < 4; i++) {
      const r = 6 + rnd() * 10;
      const x = 12 + rnd() * (w - 24);
      const y = h - 8 - r * 0.6 - rnd() * 6;
      const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.5, 1, x, y, r * 1.1);
      g.addColorStop(0, '#8a8278');
      g.addColorStop(1, '#2a2622');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } },
  wall: { w: 72, h: 64, base: 0.92, paint: (ctx, w, h, rnd) => {
    const col = 0x4c4640;
    const top = 8 + rnd() * 6;
    ctx.fillStyle = rgb(shade(col, 0.72));
    ctx.beginPath();
    ctx.moveTo(4, h - 6);
    ctx.lineTo(4, top + 10);
    for (let x = 4; x <= w - 4; x += 8) ctx.lineTo(x, top + rnd() * 18 + (x > w * 0.6 ? 16 : 0));
    ctx.lineTo(w - 4, h - 6);
    ctx.fill();
    // Gothic arched window.
    ctx.fillStyle = '#0c0a09';
    ctx.beginPath();
    ctx.moveTo(24, h - 14);
    ctx.lineTo(24, 30);
    ctx.quadraticCurveTo(31, 18, 38, 30);
    ctx.lineTo(38, h - 14);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,235,210,0.14)';
    ctx.fillRect(4, top + 10, 3, h - top - 16);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let y = top + 16; y < h - 8; y += 9) ctx.fillRect(4, y, w - 8, 1);
    ctx.fillStyle = rgb(shade(col, 0.9));
    for (let i = 0; i < 5; i++) ctx.fillRect(4 + rnd() * (w - 16), h - 10 - rnd() * 6, 6 + rnd() * 6, 5);
  } },
  pillar: { w: 30, h: 76, base: 0.95, paint: (ctx, w, h, rnd) => {
    const top = 6 + rnd() * 20;
    const g = ctx.createLinearGradient(6, 0, w - 6, 0);
    g.addColorStop(0, '#77706a');
    g.addColorStop(0.5, '#4c4640');
    g.addColorStop(1, '#221e1b');
    ctx.fillStyle = g;
    ctx.fillRect(8, top, w - 16, h - top - 6);
    ctx.fillStyle = '#3a3531';
    ctx.fillRect(4, h - 12, w - 8, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let x = 11; x < w - 8; x += 4) ctx.fillRect(x, top, 1, h - top - 12);
    ctx.fillStyle = '#5a534c';
    ctx.beginPath();
    ctx.moveTo(8, top);
    ctx.lineTo(w / 2, top - 5);
    ctx.lineTo(w - 8, top + 3);
    ctx.fill();
  } },
  crates: { w: 56, h: 44, base: 0.9, paint: (ctx, w, _h, rnd) => {
    block(ctx, 6, 18, 20, 10, 14, 0x5a4a30);
    block(ctx, 24, 22, 18, 9, 12, 0x4e4028);
    // Fuel drum.
    const x = w - 12;
    ctx.fillStyle = '#6a2a18';
    ctx.fillRect(x - 7, 14, 14, 24);
    ctx.fillStyle = '#8a3c20';
    ctx.beginPath();
    ctx.ellipse(x, 14, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,160,40,0.6)';
    ctx.fillRect(x - 7, 22 + rnd() * 4, 14, 2);
  } },
};

export const PROP_KINDS = Object.keys(SPECS) as PropKind[];
export const PROP_VARIANTS = 3;

export function propKey(kind: PropKind, v: number): string {
  return `prop_${kind}_${v}`;
}

export function propBase(kind: PropKind): number {
  return SPECS[kind].base;
}

/** Paints all prop textures once. */
export function createPropTextures(scene: Phaser.Scene): void {
  for (const kind of PROP_KINDS) {
    const spec = SPECS[kind];
    for (let v = 0; v < PROP_VARIANTS; v++) {
      const key = propKey(kind, v);
      if (scene.textures.exists(key)) continue;
      const { canvas, ctx } = makeCanvas(spec.w, spec.h);
      spec.paint(ctx, spec.w, spec.h, makeRng(kind.length * 1000 + v * 97 + 5));
      scene.textures.addCanvas(key, canvas);
    }
  }
}
