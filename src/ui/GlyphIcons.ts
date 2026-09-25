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
  defend: (c) => {
    // Shield with a sword behind it.
    line(c, [[C - 12, C + 14], [C + 12, C - 14]], 2.5);
    poly(c, [[C - 10, C - 10], [C + 10, C - 10], [C + 9, C + 3], [C, C + 13], [C - 9, C + 3]]);
    c.fillStyle = '#1a140c';
    c.fillRect(C - 1.5, C - 7, 3, 16);
    c.fillRect(C - 6, C - 3, 12, 3);
  },
  aggressive: (c) => {
    // Charging arrow with speed lines.
    poly(c, [[C - 14, C - 4], [C + 4, C - 4], [C + 4, C - 12], [C + 15, C], [C + 4, C + 12], [C + 4, C + 4], [C - 14, C + 4]]);
    line(c, [[C - 12, C - 12], [C - 4, C - 12]], 2);
    line(c, [[C - 12, C + 12], [C - 4, C + 12]], 2);
  },
  retreat: (c) => {
    poly(c, [[C + 14, C - 4], [C - 2, C - 4], [C - 2, C - 12], [C - 15, C], [C - 2, C + 12], [C - 2, C + 4], [C + 14, C + 4]]);
    c.fillRect(C + 8, C - 14, 3, 28);
  },
  repeat: (c) => {
    c.lineWidth = 3.5;
    c.beginPath();
    c.arc(C, C, 11, -Math.PI * 0.9, Math.PI * 0.55);
    c.stroke();
    poly(c, [[C - 16, C - 6], [C - 6, C - 8], [C - 12, C + 1]]);
  },
  tierUp: (c) => {
    poly(c, [[C, C - 16], [C + 12, C - 3], [C + 5, C - 3], [C + 5, C + 4], [C - 5, C + 4], [C - 5, C - 3], [C - 12, C - 3]]);
    c.fillRect(C - 11, C + 7, 22, 3);
    c.fillRect(C - 11, C + 12, 22, 3);
  },
  economy: (c) => {
    // Cog.
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 === 0 ? 15 : 11;
      c.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.fillStyle = '#1a140c';
    c.beginPath();
    c.arc(C, C, 5, 0, Math.PI * 2);
    c.fill();
  },
  military: (c) => {
    // Crossed rifles over a helmet.
    line(c, [[C - 14, C + 12], [C + 10, C - 14]], 3);
    line(c, [[C + 14, C + 12], [C - 10, C - 14]], 3);
    c.beginPath();
    c.arc(C, C + 6, 8, Math.PI, 0);
    c.fill();
    c.fillRect(C - 10, C + 6, 20, 3);
  },
  defense: (c) => {
    // Tower with crenellations.
    c.fillRect(C - 9, C - 6, 18, 20);
    for (let i = 0; i < 3; i++) c.fillRect(C - 11 + i * 8, C - 13, 6, 6);
    c.fillStyle = '#1a140c';
    c.fillRect(C - 3, C + 5, 6, 9);
  },
  tech: (c) => {
    // Atom-like orbit around a core.
    c.lineWidth = 2;
    for (const a of [0, Math.PI / 3, -Math.PI / 3]) {
      c.beginPath();
      c.ellipse(C, C, 15, 5.5, a, 0, Math.PI * 2);
      c.stroke();
    }
    c.beginPath();
    c.arc(C, C, 4, 0, Math.PI * 2);
    c.fill();
  },
  deploy: (c) => {
    // Mortar tube on braced legs.
    line(c, [[C - 4, C + 6], [C + 10, C - 13]], 5);
    line(c, [[C - 12, C + 14], [C - 2, C + 4], [C + 8, C + 14]], 2.5);
    line(c, [[C - 15, C + 14], [C + 15, C + 14]], 2);
  },
  unload: (c) => {
    // Figures stepping out of a hatch.
    c.fillRect(C - 14, C - 4, 12, 16);
    c.fillStyle = '#1a140c';
    c.fillRect(C - 11, C, 6, 12);
    c.fillStyle = c.strokeStyle;
    c.beginPath();
    c.arc(C + 7, C - 8, 3.5, 0, Math.PI * 2);
    c.fill();
    line(c, [[C + 7, C - 4], [C + 7, C + 5], [C + 3, C + 13]], 2.5);
    line(c, [[C + 7, C + 5], [C + 11, C + 13]], 2.5);
    line(c, [[C + 2, C - 1], [C + 12, C - 1]], 2.2);
  },
  shield: (c) => {
    c.lineWidth = 3;
    c.beginPath();
    c.arc(C, C + 8, 15, Math.PI, 0);
    c.stroke();
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(C, C + 8, 9, Math.PI, 0);
    c.stroke();
    c.fillRect(C - 16, C + 8, 32, 3);
  },
  carapace: (c) => {
    poly(c, [[C - 12, C - 10], [C + 12, C - 10], [C + 14, C + 4], [C, C + 14], [C - 14, C + 4]]);
    c.fillStyle = '#1a140c';
    for (let i = 0; i < 3; i++) c.fillRect(C - 9, C - 6 + i * 6, 18, 2);
  },
  servos: (c) => {
    line(c, [[C - 4, C - 14], [C + 2, C - 2], [C - 4, C + 12]], 4);
    line(c, [[C - 4, C + 12], [C + 10, C + 12]], 4);
    c.beginPath();
    c.arc(C + 2, C - 2, 4, 0, Math.PI * 2);
    c.fill();
    line(c, [[C + 8, C - 10], [C + 14, C - 10]], 2);
    line(c, [[C + 8, C - 5], [C + 16, C - 5]], 2);
  },
  adrenal: (c) => {
    c.beginPath();
    c.ellipse(C, C + 2, 9, 12, 0, 0, Math.PI * 2);
    c.fill();
    poly(c, [[C + 3, C - 14], [C - 5, C], [C + 1, C], [C - 3, C + 12], [C + 7, C - 3], [C + 1, C - 3]]);
  },
  chitin: (c) => {
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.ellipse(C, C - 8 + i * 8, 13 - i * 2, 5, 0, 0, Math.PI * 2);
      c.fill();
    }
  },
  spines: (c) => {
    for (const a of [-0.6, 0, 0.6]) poly(c, [[C + Math.sin(a) * 16, C - 14 + Math.abs(a) * 6], [C - 4 + a * 6, C + 12], [C + 4 + a * 6, C + 12]]);
  },
  accelerated: (c) => {
    c.beginPath();
    c.arc(C - 4, C + 4, 8, 0, Math.PI * 2);
    c.fill();
    poly(c, [[C + 2, C - 14], [C + 14, C - 6], [C + 6, C - 4]]);
    line(c, [[C + 4, C - 2], [C + 10, C - 10]], 3);
  },
  broodmind: (c) => {
    c.beginPath();
    c.arc(C, C - 2, 11, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1a140c';
    line(c, [[C - 7, C - 4], [C - 2, C - 8], [C + 3, C - 2], [C + 8, C - 6]], 2);
    c.fillStyle = c.strokeStyle;
    for (const x of [-9, 0, 9]) c.fillRect(C + x - 1.5, C + 9, 3, 6);
  },
  musculature: (c) => {
    c.beginPath();
    c.ellipse(C - 3, C, 11, 7, -0.5, 0, Math.PI * 2);
    c.fill();
    line(c, [[C + 6, C - 4], [C + 14, C - 12]], 4);
    line(c, [[C - 12, C + 6], [C - 16, C + 14]], 4);
  },
  hardened: (c) => {
    poly(c, [[C, C - 15], [C + 13, C - 6], [C + 10, C + 10], [C, C + 15], [C - 10, C + 10], [C - 13, C - 6]]);
    c.fillStyle = '#1a140c';
    poly(c, [[C, C - 8], [C + 6, C - 3], [C + 4, C + 5], [C, C + 8], [C - 4, C + 5], [C - 6, C - 3]]);
  },
  back: (c) => {
    poly(c, [[C - 14, C], [C - 2, C - 12], [C - 2, C - 5], [C + 13, C - 5], [C + 13, C + 5], [C - 2, C + 5], [C - 2, C + 12]]);
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
  defend: 'glyph_defend', aggressive: 'glyph_aggressive', retreat: 'glyph_retreat', repeat: 'glyph_repeat',
  tierUp: 'glyph_tierUp', economy: 'glyph_economy', military: 'glyph_military', defense: 'glyph_defense',
  tech: 'glyph_tech', back: 'glyph_back', deploy: 'glyph_deploy', unload: 'glyph_unload', shield: 'glyph_shield',
} as const;

export function researchGlyph(id: string): string {
  return `glyph_${id}`;
}
