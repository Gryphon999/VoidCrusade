import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../config';

export function textStyle(size = 16, color: string = COLORS.uiText): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color };
}

/** Draws a gothic panel: dark iron plate, double gold trim, corner ornaments and rivets. */
export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, alpha = 0.94): void {
  g.fillStyle(0x000000, 0.45 * alpha).fillRect(x + 4, y + 5, w, h);
  g.fillStyle(0x16151a, alpha).fillRect(x, y, w, h);
  g.fillStyle(0x24222a, alpha).fillRect(x + 3, y + 3, w - 6, Math.min(40, h / 3));
  g.lineStyle(2, 0xc9a044, 1).strokeRect(x + 1, y + 1, w - 2, h - 2);
  g.lineStyle(1, 0xf0d27a, 0.3).strokeRect(x + 6.5, y + 6.5, w - 13, h - 13);
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    g.fillStyle(0xc9a044, 1).fillTriangle(cx, cy, cx + sx * 18, cy, cx, cy + sy * 18);
    g.fillStyle(0x3a2a10, 1).fillCircle(cx + sx * 5, cy + sy * 5, 2.4);
    g.fillStyle(0xf6e6b0, 1).fillCircle(cx + sx * 4.6, cy + sy * 4.6, 1.2);
  }
}

export function formatTime(sec: number): string {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}
