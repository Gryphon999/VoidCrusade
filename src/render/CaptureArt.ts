import Phaser from 'phaser';
import { makeCanvas } from './CanvasUtil';
import { Oblique } from './buildings/Oblique';

/** Pylon art for Void-Nexus points: body, rune glow, tintable banner and ground ring. */
export function createCaptureArt(scene: Phaser.Scene): void {
  if (scene.textures.exists('pylon')) return;
  const W = 90;
  const H = 170;
  const base = 150;
  const body = makeCanvas(W, H);
  const glow = makeCanvas(W, H);
  const o = new Oblique(body.ctx, W / 2 - 22, base - 22 * 0.65, 0.65, glow.ctx);
  o.groundShadow(0, 0, 44, 44);
  o.box(0, 0, 0, 44, 44, 12, 0x3c3731);
  o.box(8, 8, 12, 28, 28, 10, 0x4a443e);
  const c = body.ctx;
  // Tapering spire.
  const g = c.createLinearGradient(W / 2 - 10, 0, W / 2 + 10, 0);
  g.addColorStop(0, '#6a6460');
  g.addColorStop(0.4, '#3a3634');
  g.addColorStop(1, '#141212');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(W / 2 - 11, o.sy(26, 22));
  c.lineTo(W / 2 - 4, 14);
  c.lineTo(W / 2, 4);
  c.lineTo(W / 2 + 4, 14);
  c.lineTo(W / 2 + 11, o.sy(26, 22));
  c.closePath();
  c.fill();
  // Runes (white so they can be tinted by owner).
  const runes = (x: CanvasRenderingContext2D): void => {
    x.fillStyle = '#ffffff';
    for (let i = 0; i < 7; i++) {
      const y = 26 + i * 14;
      x.fillRect(W / 2 - 1.5, y, 3, 8);
      if (i % 2) x.fillRect(W / 2 - 4.5, y + 3, 9, 2);
    }
  };
  runes(glow.ctx);
  runes(c);
  scene.textures.addCanvas('pylon', body.canvas);
  scene.textures.addCanvas('pylon_runes', glow.canvas);
  // Banner cloth (white, tinted at runtime).
  const f = makeCanvas(30, 44);
  const fg = f.ctx.createLinearGradient(0, 0, 30, 0);
  fg.addColorStop(0, '#ffffff');
  fg.addColorStop(1, '#8a8a8a');
  f.ctx.fillStyle = fg;
  f.ctx.beginPath();
  f.ctx.moveTo(0, 0);
  f.ctx.lineTo(30, 2);
  f.ctx.lineTo(28, 40);
  f.ctx.lineTo(15, 32);
  f.ctx.lineTo(2, 44);
  f.ctx.closePath();
  f.ctx.fill();
  f.ctx.fillStyle = 'rgba(0,0,0,0.35)';
  f.ctx.fillRect(12, 10, 6, 12);
  scene.textures.addCanvas('pylon_flag', f.canvas);
  // Glowing ring (drawn round; squashed by the projection at runtime).
  const r = makeCanvas(256, 256);
  const rg = r.ctx.createRadialGradient(128, 128, 96, 128, 128, 126);
  rg.addColorStop(0, 'rgba(255,255,255,0)');
  rg.addColorStop(0.55, 'rgba(255,255,255,0.9)');
  rg.addColorStop(0.7, 'rgba(255,255,255,0.35)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  r.ctx.fillStyle = rg;
  r.ctx.fillRect(0, 0, 256, 256);
  r.ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  r.ctx.lineWidth = 3;
  r.ctx.setLineDash([14, 10]);
  r.ctx.beginPath();
  r.ctx.arc(128, 128, 88, 0, Math.PI * 2);
  r.ctx.stroke();
  scene.textures.addCanvas('capture_ring', r.canvas);
}

/** Pylon origin: its ground contact inside the 90x170 canvas. */
export const PYLON_ORIGIN = { x: 0.5, y: 150 / 170 };
