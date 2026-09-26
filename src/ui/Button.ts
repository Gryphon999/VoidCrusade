import Phaser from 'phaser';
import { textStyle } from './uiStyle';
import { AudioSystem } from '../systems/AudioSystem';

export interface ButtonOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  icon?: string;
  hotkey?: string;
  tooltip?: () => string;
  onClick: () => void;
}

type Look = 'up' | 'hover' | 'down' | 'active';

/** Gothic plate button: dark iron with gold trim and notched corners; hover glow, pressed, active and disabled states. */
export class Button {
  readonly container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private hit: Phaser.GameObjects.Zone;
  private icon?: Phaser.GameObjects.Image;
  private label?: Phaser.GameObjects.Text;
  private enabled = true;
  private active = false;
  private look: Look = 'up';
  onHover?: (tip: string | null, x: number, y: number) => void;

  constructor(scene: Phaser.Scene, private opts: ButtonOpts) {
    const { x, y, w, h } = opts;
    this.bg = scene.add.graphics();
    this.hit = scene.add.zone(0, 0, w, h);
    const parts: Phaser.GameObjects.GameObject[] = [this.bg];
    if (opts.icon) {
      this.icon = scene.add.image(0, opts.label ? -8 : 0, opts.icon);
      const max = opts.label ? h - 22 : h - 8;
      this.icon.setScale(Math.min(max / this.icon.width, max / this.icon.height, 3));
      parts.push(this.icon);
    }
    if (opts.label) {
      const ly = opts.icon ? h / 2 - 11 : 0;
      const size = opts.icon ? 11 : h >= 44 ? 17 : 14;
      this.label = scene.add.text(0, ly, opts.label, { ...textStyle(size, '#ecdcb0'), align: 'center' }).setOrigin(0.5).setStroke('#000', 3);
      // Shrink long (e.g. Russian) labels to fit.
      const maxW = w - 16;
      if (this.label.width > maxW) this.label.setScale(maxW / this.label.width);
      parts.push(this.label);
    }
    if (opts.hotkey) parts.push(scene.add.text(-w / 2 + 5, -h / 2 + 3, opts.hotkey, textStyle(10, '#c9a044')));
    parts.push(this.hit);
    this.container = scene.add.container(x, y, parts);
    this.draw();
    this.hit.setInteractive({ useHandCursor: true });
    this.hit.on('pointerover', () => {
      this.setLook('hover');
      if (this.enabled) AudioSystem.uiHover();
      if (opts.tooltip) this.onHover?.(opts.tooltip(), x, y - h / 2);
    });
    this.hit.on('pointerout', () => {
      this.setLook('up');
      this.onHover?.(null, 0, 0);
    });
    this.hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!p.leftButtonDown()) return;
      this.setLook('down');
      AudioSystem.uiClick();
      if (this.enabled) opts.onClick();
    });
    this.hit.on('pointerup', () => this.setLook('hover'));
  }

  private setLook(l: Look): void {
    this.look = l;
    this.draw();
  }

  private draw(): void {
    const { w, h } = this.opts;
    const g = this.bg.clear();
    const c = 6;
    const hover = this.look === 'hover' && this.enabled;
    const down = this.look === 'down' && this.enabled;
    const pts = [
      { x: -w / 2 + c, y: -h / 2 }, { x: w / 2 - c, y: -h / 2 }, { x: w / 2, y: -h / 2 + c }, { x: w / 2, y: h / 2 - c },
      { x: w / 2 - c, y: h / 2 }, { x: -w / 2 + c, y: h / 2 }, { x: -w / 2, y: h / 2 - c }, { x: -w / 2, y: -h / 2 + c },
    ];
    g.fillStyle(0x000000, 0.5).fillPoints(pts.map((p) => ({ x: p.x + 2, y: p.y + 3 })), true);
    const top = down ? 0x1e1a18 : hover ? 0x4a3e30 : 0x302a26;
    const bot = down ? 0x2c2622 : hover ? 0x221a14 : 0x141210;
    g.fillStyle(bot, 1).fillPoints(pts, true);
    g.fillStyle(top, 1).fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h / 2 - 2);
    g.fillStyle(0xffffff, 0.04).fillRect(-w / 2 + 3, -h / 2 + 3, w - 6, 3);
    const trim = this.active ? 0x60ff70 : hover ? 0xf0d27a : this.enabled ? 0xb08a3c : 0x5a4a30;
    g.lineStyle(2, trim, 1).strokePoints(pts, true);
    g.lineStyle(1, 0xf0d27a, hover ? 0.4 : 0.15).strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
    if (hover) g.fillStyle(0xffd080, 0.06).fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, h / 2 - 4);
    this.container?.setScale(down ? 0.97 : 1);
  }

  setEnabled(v: boolean): this {
    this.enabled = v;
    this.icon?.setAlpha(v ? 1 : 0.35);
    this.label?.setAlpha(v ? 1 : 0.45);
    this.draw();
    return this;
  }

  setActive(v: boolean): this {
    this.active = v;
    this.draw();
    return this;
  }

  setLabel(t: string): this {
    if (!this.label) return this;
    this.label.setScale(1).setText(t);
    const maxW = this.opts.w - 16;
    if (this.label.width > maxW) this.label.setScale(maxW / this.label.width);
    return this;
  }

  destroy(): void {
    this.container.destroy();
  }
}
