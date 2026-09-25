import Phaser from 'phaser';
import { textStyle } from './uiStyle';

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

/** Simple HUD button with icon/label, disabled state and tooltip hook. */
export class Button {
  readonly container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private icon?: Phaser.GameObjects.Image;
  private label?: Phaser.GameObjects.Text;
  private enabled = true;
  onHover?: (tip: string | null, x: number, y: number) => void;

  constructor(scene: Phaser.Scene, opts: ButtonOpts) {
    const { x, y, w, h } = opts;
    this.bg = scene.add.rectangle(0, 0, w, h, 0x22222e).setStrokeStyle(2, 0x5a5a7a);
    const parts: Phaser.GameObjects.GameObject[] = [this.bg];
    if (opts.icon) {
      this.icon = scene.add.image(0, opts.label ? -8 : 0, opts.icon);
      const max = (opts.label ? h - 22 : h - 8);
      this.icon.setScale(Math.min(max / this.icon.width, max / this.icon.height, 3));
      parts.push(this.icon);
    }
    if (opts.label) {
      const ly = opts.icon ? h / 2 - 11 : 0;
      this.label = scene.add.text(0, ly, opts.label, textStyle(opts.icon ? 11 : 13)).setOrigin(0.5);
      parts.push(this.label);
    }
    if (opts.hotkey) parts.push(scene.add.text(-w / 2 + 3, -h / 2 + 1, opts.hotkey, textStyle(10, '#aab')));
    this.container = scene.add.container(x, y, parts);
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerover', () => {
      this.bg.setFillStyle(0x33334a);
      if (opts.tooltip) this.onHover?.(opts.tooltip(), x, y - h / 2);
    });
    this.bg.on('pointerout', () => {
      this.bg.setFillStyle(0x22222e);
      this.onHover?.(null, 0, 0);
    });
    this.bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.leftButtonDown() && this.enabled) opts.onClick();
    });
  }

  setEnabled(v: boolean): this {
    this.enabled = v;
    this.icon?.setAlpha(v ? 1 : 0.35);
    this.label?.setAlpha(v ? 1 : 0.45);
    return this;
  }

  setActive(v: boolean): this {
    this.bg.setStrokeStyle(2, v ? 0x30ff60 : 0x5a5a7a);
    return this;
  }

  setLabel(t: string): this {
    this.label?.setText(t);
    return this;
  }

  destroy(): void {
    this.container.destroy();
  }
}
