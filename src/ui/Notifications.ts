import Phaser from 'phaser';
import { HUD } from './HudArt';
import { textStyle } from './uiStyle';

export type NoticeKind = 'info' | 'good' | 'bad' | 'warn';

const COLORS: Record<NoticeKind, string> = { info: '#e8e0c8', good: '#9fe09f', bad: '#ff7a6a', warn: '#ffd060' };
const ICONS: Record<NoticeKind, string> = { info: 'glyph_rally', good: 'glyph_capture', bad: 'glyph_attack', warn: 'glyph_stop' };
const MAX = 5;

/** Stacked event feed above the bottom HUD ("Point captured", "Under attack", "Squad lost"). */
export class Notifications {
  private lines: { root: Phaser.GameObjects.Container; born: number }[] = [];

  constructor(private scene: Phaser.Scene) {}

  push(text: string, kind: NoticeKind = 'info'): void {
    // Collapse exact repeats that arrive in quick succession.
    const last = this.lines[this.lines.length - 1];
    if (last && last.root.getData('text') === text && this.scene.time.now - last.born < 1500) return;
    const icon = this.scene.add.image(12, 0, ICONS[kind]).setScale(0.45);
    const label = this.scene.add.text(28, 0, text, textStyle(15, COLORS[kind])).setOrigin(0, 0.5).setStroke('#000', 4);
    const bg = this.scene.add.rectangle(0, 0, label.width + 44, 26, 0x0a0a0e, 0.72).setOrigin(0, 0.5).setStrokeStyle(1, 0x7a6030);
    const root = this.scene.add.container(16, 0, [bg, icon, label]).setDepth(150).setAlpha(0);
    root.setData('text', text);
    this.scene.tweens.add({ targets: root, alpha: 1, x: 20, duration: 200 });
    this.lines.push({ root, born: this.scene.time.now });
    while (this.lines.length > MAX) this.lines.shift()?.root.destroy();
    this.layout();
  }

  private layout(): void {
    const base = 720 - HUD.bottomH - 28;
    this.lines.forEach((l, i) => l.root.setY(base - (this.lines.length - 1 - i) * 30));
  }

  update(): void {
    const now = this.scene.time.now;
    let changed = false;
    for (const l of this.lines) {
      const age = now - l.born;
      if (age > 4500) l.root.setAlpha(Math.max(0, 1 - (age - 4500) / 800));
    }
    while (this.lines.length && now - this.lines[0].born > 5300) {
      this.lines.shift()?.root.destroy();
      changed = true;
    }
    if (changed) this.layout();
  }
}
