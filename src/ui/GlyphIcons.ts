import Phaser from 'phaser';
import { makeCanvas } from '../render/CanvasUtil';

type Glyph = (c: CanvasRenderingContext2D) => void;

const S = 44;
const C = S / 2;

function line(c: CanvasRenderingContext2D, pts: [number, number][], w = 3): void {
  c.lineWidth = w;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
}

function poly(c: CanvasRenderingContext2D, pts: [number, number][]): void {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill();
}

const GLYPHS: Record<string, Glyph> = {
  move: (c) => {
    poly(c, [[C - 12, C + 10], [C + 10, C - 2], [C - 2, C - 6], [C + 2, C - 14], [C - 4, C - 16], [C - 8, C - 8], [C - 14, C - 12]]);
  },
  attack: (c) => {
    line(c, [[C - 13, C + 13], [C + 12, C - 12]]);
    line(c, [[C + 13, C + 13], [C - 12, C - 12]]);
    line(c, [[C - 15, C + 7], [C - 7, C + 15]], 2.5);
    line(c, [[C + 15, C + 7], [C + 7, C + 15]], 2.5);
  },
  hold: (c) => {
    poly(c, [[C - 12, C - 13], [C + 12, C - 13], [C + 11, C + 2], [C, C + 15], [C - 11, C + 2]]);
    c.fillStyle = '#1a140c';
    poly(c, [[C - 7, C - 8], [C + 7, C - 8], [C + 6, C + 1], [C, C + 8], [C - 6, C + 1]]);
  },
  stop: (c) => {
    c.fillRect(C - 11, C - 11, 22, 22);
    c.fillStyle = '#1a140c';
    c.fillRect(C - 6, C - 6, 12, 12);
  },
  reinforce: (c) => {
    for (const [x, y] of [[C - 9, C + 3], [C + 9, C + 3]]) {
      c.beginPath();
      c.arc(x, y, 6, Math.PI, 0);
      c.fill();
      c.fillRect(x - 6, y, 12, 5);
    }
    c.fillRect(C - 2, C - 16, 4, 14);
    c.fillRect(C - 7, C - 11, 14, 4);
  },
  plasma: (c) => {
    poly(c, [[C + 4, C - 16], [C - 9, C + 2], [C - 1, C + 2], [C - 5, C + 16], [C + 9, C - 3], [C + 1, C - 3]]);
  },
  ceramite: (c) => {
    poly(c, [[C - 13, C - 8], [C, C - 14], [C + 13, C - 8], [C + 10, C + 8], [C, C + 14], [C - 10, C + 8]]);
    c.fillStyle = '#1a140c';
    c.fillRect(C - 1.5, C - 10, 3, 20);
  },
  overcharge: (c) => {
    c.beginPath();
    c.arc(C - 3, C + 5, 8, 0, Math.PI * 2);
    c.fill();
    c.fillRect(C, C - 1, 14, 5);
    poly(c, [[C + 2, C - 16], [C - 5, C - 6], [C, C - 6], [C - 3, C + 1], [C + 7, C - 10], [C + 2, C - 10]]);
  },
  fabrication: (c) => {
    c.save();
    c.translate(C, C);
    c.rotate(-0.7);
    c.fillRect(-2, -4, 4, 20);
    c.fillRect(-9, -14, 18, 9);
    c.restore();
  },
  conscription: (c) => {
    for (const [x, y, r] of [[C - 10, C + 4, 5], [C + 10, C + 4, 5], [C, C - 3, 6.5]]) {
      c.beginPath();
      c.arc(x, y, r, Math.PI, 0);
      c.fill();
      c.fillRect(x - r, y, r * 2, r * 0.8);
    }
  },
  build: (c) => {
    c.save();
    c.translate(C, C);
    c.rotate(0.7);
    c.fillRect(-2, -6, 4, 22);
    c.fillRect(-10, -15, 20, 8);
    c.restore();
  },
  rally: (c) => {
    c.fillRect(C - 10, C - 15, 3, 30);
    poly(c, [[C - 7, C - 15], [C + 13, C - 10], [C - 7, C - 3]]);
  },
  capture: (c) => {
    c.fillRect(C - 1.5, C - 16, 3, 30);
    poly(c, [[C + 1.5, C - 15], [C + 14, C - 11], [C + 1.5, C - 6]]);
    c.beginPath();
    c.ellipse(C, C + 13, 12, 4, 0, 0, Math.PI * 2);
    c.lineWidth = 2;
    c.stroke();
  },
};

/** Gold glyph on a dark bronze roundel, 44x44. */
export function createGlyphIcons(scene: Phaser.Scene): void {
  for (const [name, glyph] of Object.entries(GLYPHS)) {
    const key = `glyph_${name}`;
    if (scene.textures.exists(key)) continue;
    const { canvas, ctx } = makeCanvas(S, S);
    const bg = ctx.createRadialGradient(C - 6, C - 8, 2, C, C, C);
    bg.addColorStop(0, '#4a3a24');
    bg.addColorStop(1, '#140e08');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(C, C, C - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6a2a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const gold = ctx.createLinearGradient(0, 4, 0, S - 4);
    gold.addColorStop(0, '#fbe6a0');
    gold.addColorStop(1, '#b08030');
    ctx.fillStyle = gold;
    ctx.strokeStyle = gold;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1.5;
    glyph(ctx);
    scene.textures.addCanvas(key, canvas);
  }
}

export const GLYPH = {
  move: 'glyph_move', attack: 'glyph_attack', hold: 'glyph_hold', stop: 'glyph_stop', reinforce: 'glyph_reinforce',
  build: 'glyph_build', rally: 'glyph_rally', capture: 'glyph_capture',
} as const;

export function researchGlyph(id: string): string {
  return `glyph_${id}`;
}
