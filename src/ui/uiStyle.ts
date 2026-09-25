import Phaser from 'phaser';
import { COLORS, FONT_FAMILY } from '../config';

export function textStyle(size = 16, color: string = COLORS.uiText): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT_FAMILY, fontSize: `${size}px`, color };
}

/** Draws a bevelled dark panel. */
export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, alpha = 0.92): void {
  g.fillStyle(COLORS.uiPanel, alpha).fillRect(x, y, w, h);
  g.lineStyle(2, COLORS.uiBorder, 1).strokeRect(x + 1, y + 1, w - 2, h - 2);
  g.lineStyle(1, 0x000000, 0.8).strokeRect(x + 4, y + 4, w - 8, h - 8);
}

export function formatTime(sec: number): string {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}
