import Phaser from 'phaser';
import { CAPTURE, COLORS, DEPTH, TILE_SIZE } from '../config';
import { Owner } from '../types';

export function ownerColor(o: Owner | null): number {
  return o === 'player' ? COLORS.player : o === 'enemy' ? COLORS.enemy : COLORS.neutral;
}

/** One Void-Nexus obelisk with its capture state and visuals. */
export class CapturePoint {
  owner: Owner | null = null;
  /** Side currently filling the bar (may differ from owner). */
  claimant: Owner | null = null;
  progress = 0;
  contested = false;
  readonly half = CAPTURE.zoneHalfTiles * TILE_SIZE;
  private aura: Phaser.GameObjects.Image;
  private zone: Phaser.GameObjects.Graphics;
  private bar: Phaser.GameObjects.Graphics;
  private runes: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, readonly index: number, readonly x: number, readonly y: number) {
    this.zone = scene.add.graphics().setDepth(DEPTH.capture);
    this.aura = scene.add.image(x, y, 'aura').setDepth(DEPTH.capture).setBlendMode(Phaser.BlendModes.ADD);
    this.aura.setScale(2.2);
    scene.tweens.add({ targets: this.aura, scale: 2.7, alpha: 0.55, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.add.image(x, y - 40, 'obelisk').setDepth(DEPTH.units + 2);
    this.runes = scene.add.image(x, y - 40, 'obelisk').setDepth(DEPTH.units + 3).setBlendMode(Phaser.BlendModes.ADD);
    this.runes.setAlpha(0.35);
    scene.tweens.add({ targets: this.runes, alpha: 0.8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.bar = scene.add.graphics().setDepth(DEPTH.overlay - 2);
    this.refresh();
  }

  contains(px: number, py: number): boolean {
    return Math.abs(px - this.x) <= this.half && Math.abs(py - this.y) <= this.half;
  }

  refresh(): void {
    const col = ownerColor(this.owner);
    this.aura.setTint(col);
    this.runes.setTint(col);
    const g = this.zone.clear();
    g.fillStyle(col, 0.08).fillRect(this.x - this.half, this.y - this.half, this.half * 2, this.half * 2);
    g.lineStyle(2, col, 0.6);
    const h = this.half;
    const seg = 16;
    for (let t = -h; t < h; t += seg * 2) {
      const e = Math.min(t + seg, h);
      g.lineBetween(this.x + t, this.y - h, this.x + e, this.y - h).lineBetween(this.x + t, this.y + h, this.x + e, this.y + h);
      g.lineBetween(this.x - h, this.y + t, this.x - h, this.y + e).lineBetween(this.x + h, this.y + t, this.x + h, this.y + e);
    }
    this.drawBar();
  }

  drawBar(): void {
    const g = this.bar.clear();
    if (this.progress <= 0 || (this.claimant === this.owner && this.progress >= 1)) return;
    const w = 80;
    const x = this.x - w / 2;
    const y = this.y - 118;
    g.fillStyle(0x000000, 0.75).fillRect(x - 2, y - 2, w + 4, 10);
    g.fillStyle(this.contested ? 0xffd040 : ownerColor(this.claimant), 1).fillRect(x, y, w * this.progress, 6);
  }

  setShown(v: boolean): void {
    this.bar.setVisible(v);
  }
}
