import Phaser from 'phaser';
import { CAPTURE, COLORS, DEPTH, TILE_SIZE } from '../config';
import { Owner } from '../types';
import { Projection } from '../render/Projection';
import { PYLON_ORIGIN } from '../render/CaptureArt';

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
  private ring: Phaser.GameObjects.Image;
  private flag: Phaser.GameObjects.Image;

  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, readonly index: number, readonly x: number, readonly y: number) {
    const vy = Projection.vy(y);
    const k = Projection.tilt;
    this.zone = scene.add.graphics().setDepth(DEPTH.capture);
    this.aura = scene.add.image(x, vy, 'aura').setDepth(DEPTH.capture).setBlendMode(Phaser.BlendModes.ADD);
    this.aura.setScale(2.2, 2.2 * k);
    scene.tweens.add({ targets: this.aura, scaleX: 2.7, scaleY: 2.7 * k, alpha: 0.55, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.ring = scene.add.image(x, vy, 'capture_ring').setDepth(DEPTH.capture + 0.5).setBlendMode(Phaser.BlendModes.ADD);
    this.ring.setScale((this.half * 2.1) / 256, ((this.half * 2.1) / 256) * k).setAlpha(0.8);
    scene.tweens.add({ targets: this.ring, alpha: 0.35, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const depth = Projection.depth(y);
    scene.add.image(x, vy, 'pylon').setOrigin(PYLON_ORIGIN.x, PYLON_ORIGIN.y).setDepth(depth);
    this.runes = scene.add.image(x, vy, 'pylon_runes').setOrigin(PYLON_ORIGIN.x, PYLON_ORIGIN.y).setDepth(depth + 0.1)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: this.runes, alpha: 0.5, duration: 800, yoyo: true, repeat: -1 });
    this.flag = scene.add.image(x + 4, vy - 112, 'pylon_flag').setOrigin(0, 0).setDepth(depth + 0.2);
    scene.tweens.add({ targets: this.flag, scaleX: 0.85, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.scene = scene;
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
    this.ring.setTint(col);
    this.flag.setTint(col);
    const g = this.zone.clear();
    const h = this.half;
    const k = Projection.tilt;
    const cy = Projection.vy(this.y);
    g.fillStyle(col, 0.08).fillRect(this.x - h, cy - h * k, h * 2, h * 2 * k);
    g.lineStyle(2, col, 0.6);
    const seg = 16;
    for (let t = -h; t < h; t += seg * 2) {
      const e = Math.min(t + seg, h);
      g.lineBetween(this.x + t, cy - h * k, this.x + e, cy - h * k).lineBetween(this.x + t, cy + h * k, this.x + e, cy + h * k);
      g.lineBetween(this.x - h, cy + t * k, this.x - h, cy + e * k).lineBetween(this.x + h, cy + t * k, this.x + h, cy + e * k);
    }
    this.drawBar();
  }

  /** Expanding shockwave when the point changes hands. */
  pulse(): void {
    const k = Projection.tilt;
    const img = this.scene.add.image(this.x, Projection.vy(this.y), 'capture_ring').setTint(ownerColor(this.owner))
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.groundFx).setScale(0.3, 0.3 * k);
    this.scene.tweens.add({ targets: img, scaleX: 2.4, scaleY: 2.4 * k, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => img.destroy() });
  }

  drawBar(): void {
    const g = this.bar.clear();
    if (this.progress <= 0 || (this.claimant === this.owner && this.progress >= 1)) return;
    const w = 80;
    const x = this.x - w / 2;
    const y = Projection.vy(this.y) - 160;
    g.fillStyle(0x000000, 0.75).fillRect(x - 2, y - 2, w + 4, 10);
    g.fillStyle(this.contested ? 0xffd040 : ownerColor(this.claimant), 1).fillRect(x, y, w * this.progress, 6);
  }

  setShown(v: boolean): void {
    this.bar.setVisible(v);
  }
}
