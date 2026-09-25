import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { HUD } from './HudArt';
import { textStyle } from './uiStyle';

/** Gothic tooltip: gold title, body text, framed dark panel. Anchored above a point. */
export class Tooltip {
  private root: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Text;
  private warn: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.bg = scene.add.graphics();
    this.title = scene.add.text(10, 8, '', textStyle(15, HUD.goldHi));
    this.body = scene.add.text(10, 30, '', { ...textStyle(13, '#d8d0c0'), wordWrap: { width: 280 }, lineSpacing: 3 });
    this.warn = scene.add.text(10, 30, '', { ...textStyle(13, '#ff6a50'), wordWrap: { width: 280 } });
    this.root = scene.add.container(0, 0, [this.bg, this.title, this.body, this.warn]).setDepth(300).setVisible(false);
  }

  /** `warn` is an optional red line (e.g. what is still required). */
  show(title: string, body: string, x: number, y: number, warn = ''): void {
    this.title.setText(title);
    this.body.setText(body).setY(30).setVisible(!!body);
    let bottom = body ? 30 + this.body.height : 8 + this.title.height;
    this.warn.setText(warn).setY(bottom + 4).setVisible(!!warn);
    if (warn) bottom += 4 + this.warn.height;
    const w = Math.max(this.title.width, body ? this.body.width : 0, warn ? this.warn.width : 0) + 20;
    const h = bottom + 10;
    const g = this.bg.clear();
    g.fillStyle(0x0c0b10, 0.94).fillRect(0, 0, w, h);
    g.lineStyle(1.5, 0xc9a044, 1).strokeRect(0.5, 0.5, w - 1, h - 1);
    g.lineStyle(1, 0xc9a044, 0.3).strokeRect(3.5, 3.5, w - 7, h - 7);
    this.root.setPosition(Phaser.Math.Clamp(x - w / 2, 4, GAME_WIDTH - w - 4), Math.max(44, y - h - 8)).setVisible(true);
  }

  hide(): void {
    this.root.setVisible(false);
  }
}
