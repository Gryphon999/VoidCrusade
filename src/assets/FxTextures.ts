import Phaser from 'phaser';
import { bakeTexture } from './TileTextures';
import { makeCanvas } from '../render/CanvasUtil';

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, paint: (c: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const { canvas, ctx } = makeCanvas(w, h);
  paint(ctx);
  scene.textures.addCanvas(key, canvas);
}

export function createFxTextures(scene: Phaser.Scene): void {
  bakeTexture(scene, 'fx_dot', 12, 12, (g) => {
    g.fillStyle(0xffffff, 1).fillCircle(6, 6, 6);
  });
  bakeTexture(scene, 'fx_soft', 32, 32, (g) => {
    for (let r = 16; r > 0; r -= 2) g.fillStyle(0xffffff, 0.12).fillCircle(16, 16, r);
  });
  bakeTexture(scene, 'fx_spark', 6, 6, (g) => {
    g.fillStyle(0xffffff, 1).fillRect(0, 2, 6, 2).fillRect(2, 0, 2, 6);
  });
  // Tracer streak: bright head, fading tail (points +x).
  canvasTex(scene, 'fx_tracer', 32, 6, (c) => {
    const g = c.createLinearGradient(0, 0, 32, 0);
    g.addColorStop(0, 'rgba(255,200,90,0)');
    g.addColorStop(0.7, 'rgba(255,220,120,0.8)');
    g.addColorStop(1, 'rgba(255,255,230,1)');
    c.fillStyle = g;
    c.fillRect(0, 2, 32, 2);
    c.fillStyle = 'rgba(255,240,200,0.35)';
    c.fillRect(8, 1, 24, 4);
  });
  canvasTex(scene, 'fx_bolt', 24, 12, (c) => {
    const g = c.createRadialGradient(18, 6, 0, 18, 6, 10);
    g.addColorStop(0, 'rgba(255,255,220,1)');
    g.addColorStop(0.4, 'rgba(255,160,60,0.9)');
    g.addColorStop(1, 'rgba(255,90,20,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 24, 12);
  });
  canvasTex(scene, 'fx_glob', 16, 16, (c) => {
    const g = c.createRadialGradient(7, 7, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(230,255,160,1)');
    g.addColorStop(0.5, 'rgba(130,255,60,0.9)');
    g.addColorStop(1, 'rgba(60,160,20,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 16, 16);
  });
  canvasTex(scene, 'fx_muzzle', 32, 32, (c) => {
    c.translate(16, 16);
    for (let i = 0; i < 6; i++) {
      c.rotate(Math.PI / 3);
      const g = c.createLinearGradient(0, 0, 15, 0);
      g.addColorStop(0, 'rgba(255,255,220,1)');
      g.addColorStop(1, 'rgba(255,160,40,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, -2);
      c.lineTo(i % 2 ? 15 : 10, 0);
      c.lineTo(0, 2);
      c.fill();
    }
  });
  canvasTex(scene, 'fx_casing', 4, 2, (c) => {
    c.fillStyle = '#e0b040';
    c.fillRect(0, 0, 4, 2);
  });
  canvasTex(scene, 'fx_chunk', 10, 8, (c) => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(1, 3);
    c.lineTo(5, 0);
    c.lineTo(10, 2);
    c.lineTo(8, 8);
    c.lineTo(2, 7);
    c.closePath();
    c.fill();
  });
}
