import Phaser from 'phaser';
import { textStyle } from './uiStyle';
import { AudioSystem } from '../systems/AudioSystem';

/** A command slot: framed icon, hotkey letter, badge, disabled veil and radial cooldown sweep. */
export class IconButton {
  readonly container: Phaser.GameObjects.Container;
  private frame: Phaser.GameObjects.Image;
  private icon: Phaser.GameObjects.Image;
  private key: Phaser.GameObjects.Text;
  private badge: Phaser.GameObjects.Text;
  private sweep: Phaser.GameObjects.Graphics;
  private lock: Phaser.GameObjects.Graphics;
  private locked = false;
  private hovered = false;
  private enabled = true;
  private active = false;
  onClick: () => void = () => undefined;
  onHover: (over: boolean) => void = () => undefined;

  constructor(scene: Phaser.Scene, x: number, y: number, readonly size = 58) {
    this.frame = scene.add.image(0, 0, 'hud_btn_up').setDisplaySize(size, size);
    this.icon = scene.add.image(0, 0, 'glyph_move');
    this.sweep = scene.add.graphics();
    this.lock = scene.add.graphics().setVisible(false);
    // Padlock in the bottom-left corner of locked commands.
    const lx = -size / 2 + 12;
    const ly = size / 2 - 13;
    this.lock.fillStyle(0x000000, 0.6).fillCircle(lx, ly, 9);
    this.lock.lineStyle(2, 0xd8c8a0, 1).beginPath().arc(lx, ly - 2, 3.5, Math.PI, 0).strokePath();
    this.lock.fillStyle(0xd8c8a0, 1).fillRect(lx - 5, ly - 1, 10, 7);
    this.key = scene.add.text(-size / 2 + 5, -size / 2 + 3, '', textStyle(11, '#f0d27a')).setStroke('#000', 3);
    this.badge = scene.add.text(size / 2 - 4, size / 2 - 3, '', textStyle(11, '#e8e0c8')).setOrigin(1, 1).setStroke('#000', 3);
    this.container = scene.add.container(x, y, [this.frame, this.icon, this.sweep, this.lock, this.key, this.badge]);
    this.frame.setInteractive({ useHandCursor: true });
    this.frame.on('pointerover', () => {
      this.hovered = true;
      AudioSystem.uiHover();
      this.refreshFrame();
      this.onHover(true);
    });
    this.frame.on('pointerout', () => {
      this.hovered = false;
      this.container.setScale(1);
      this.refreshFrame();
      this.onHover(false);
    });
    this.frame.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!p.leftButtonDown()) return;
      AudioSystem.uiClick();
      this.container.setScale(0.94);
      if (this.enabled) this.onClick();
    });
    this.frame.on('pointerup', () => this.container.setScale(1));
  }

  set(icon: string, hotkey = ''): this {
    this.icon.setTexture(icon);
    const max = this.size - 12;
    this.icon.setScale(Math.min(max / this.icon.width, max / this.icon.height));
    this.key.setText(hotkey);
    this.container.setVisible(true);
    return this;
  }

  setBadge(t: string): this {
    this.badge.setText(t);
    return this;
  }

  setEnabled(v: boolean): this {
    if (v === this.enabled) return this;
    this.enabled = v;
    this.icon.setAlpha(v ? 1 : 0.35).setTint(v ? 0xffffff : 0x888888);
    return this;
  }

  setLocked(v: boolean): this {
    if (v === this.locked) return this;
    this.locked = v;
    this.lock.setVisible(v);
    return this;
  }

  setActive(v: boolean): this {
    if (v !== this.active) {
      this.active = v;
      this.refreshFrame();
    }
    return this;
  }

  /** Radial "clock" sweep showing remaining time (0..1 done). */
  setProgress(f: number | null): this {
    const g = this.sweep.clear();
    if (f === null || f <= 0 || f >= 1) return this;
    const r = this.size / 2 - 5;
    g.fillStyle(0x000000, 0.55);
    g.slice(0, 0, r, -Math.PI / 2 + f * Math.PI * 2, Math.PI * 1.5, false).fillPath();
    g.lineStyle(2, 0x60d0ff, 0.9).beginPath().arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2).strokePath();
    return this;
  }

  hide(): void {
    this.container.setVisible(false);
    this.setProgress(null).setBadge('').setLocked(false);
  }

  private refreshFrame(): void {
    this.frame.setTexture(this.active ? 'hud_btn_active' : this.hovered ? 'hud_btn_hover' : 'hud_btn_up');
  }
}
