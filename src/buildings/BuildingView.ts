import Phaser from 'phaser';
import { DEPTH, TILE_SIZE } from '../config';
import { Projection } from '../render/Projection';
import { ensureBuildingVolumes, volumeTextureKey } from '../assets/BuildingTextures';
import type { Building } from './Building';

/** All rendering for one building: extruded body, turret gun, bars, selection ring, shadow. */
export class BuildingView {
  private body: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private gun?: Phaser.GameObjects.Image;
  private bars: Phaser.GameObjects.Graphics;
  private ring: Phaser.GameObjects.Graphics;
  private selected = false;
  private shown = true;
  /** Footprint bottom edge in logical Y and roof height. */
  private readonly bottom: number;
  private readonly top: number;

  constructor(scene: Phaser.Scene, private b: Building) {
    const def = b.def;
    const px = def.size * TILE_SIZE;
    const k = Projection.tilt;
    ensureBuildingVolumes(scene, k);
    this.bottom = b.y + px / 2;
    this.top = b.y - px / 2;
    const depth = Projection.depth(this.bottom);
    this.shadow = scene.add.image(b.x + px * 0.12, Projection.vy(b.y) + 6, 'fx_soft').setTint(0x000000)
      .setAlpha(0.55).setScale((px * 1.5) / 32, (px * 1.2 * k) / 32).setDepth(DEPTH.shadows);
    this.ring = scene.add.graphics().setDepth(DEPTH.selection).setVisible(false);
    this.ring.lineStyle(3, 0x3a8dff, 1).strokeEllipse(b.x, Projection.vy(b.y), px * 1.3, px * 1.3 * k);
    this.body = scene.add.image(b.x, Projection.vy(this.bottom), volumeTextureKey(def.id, k)).setOrigin(0.5, 1).setDepth(depth);
    if (def.attack) {
      const key = def.faction === 'ironvoid' ? 'bld_turret_gun' : 'bld_spine_gun';
      this.gun = scene.add.image(b.x, Projection.vy(b.y) - def.height, key).setOrigin(24 / 90, 0.5).setDepth(depth + 0.5);
      this.gun.setScale(1, 0.8 + 0.2 * k);
      this.gun.rotation = b.owner === 'player' ? -Math.PI / 4 : (Math.PI * 3) / 4;
    }
    this.bars = scene.add.graphics().setDepth(DEPTH.bars);
  }

  /** Screen-space (view) bounds of the whole volume, for picking. */
  viewBounds(): Phaser.Geom.Rectangle {
    const r = (this.b.def.size * TILE_SIZE) / 2;
    const y0 = Projection.vy(this.top) - this.b.def.height;
    return new Phaser.Geom.Rectangle(this.b.x - r, y0, r * 2, Projection.vy(this.bottom) - y0);
  }

  get depth(): number {
    return this.body.depth;
  }

  /** Point at mid-height on the building (view space) for projectiles and effects. */
  aimPoint(): { x: number; y: number } {
    return { x: this.b.x, y: Projection.vy(this.b.y) - this.b.def.height * 0.5 };
  }

  aimAt(x: number, y: number): void {
    if (this.gun) this.gun.rotation = Phaser.Math.Angle.Between(this.b.x, Projection.vy(this.b.y), x, Projection.vy(y));
  }

  /** Muzzle position in view space. */
  gunTip(): { x: number; y: number } {
    const g = this.gun;
    if (!g) return this.aimPoint();
    return { x: g.x + Math.cos(g.rotation) * 56, y: g.y + Math.sin(g.rotation) * 56 * Projection.tilt };
  }

  setSelected(sel: boolean): void {
    this.selected = sel;
    this.ring.setVisible(sel && this.shown);
  }

  setShown(shown: boolean): void {
    if (this.shown === shown) return;
    this.shown = shown;
    for (const o of [this.body, this.shadow, this.bars]) o.setVisible(shown);
    this.gun?.setVisible(shown);
    this.ring.setVisible(shown && this.selected);
  }

  refresh(): void {
    const b = this.b;
    const constructing = b.state === 'constructing';
    this.body.setAlpha(constructing ? 0.3 + 0.7 * b.progress : 1);
    this.gun?.setAlpha(this.body.alpha);
    const g = this.bars.clear();
    const w = Math.max(60, b.def.size * TILE_SIZE * 0.8);
    const x = b.x - w / 2;
    const y = Projection.vy(this.top) - b.def.height - 16;
    const frac = b.hp / b.maxHp;
    const col = frac > 0.6 ? 0x40d040 : frac > 0.3 ? 0xe0c020 : 0xe03020;
    g.fillStyle(0x000000, 0.7).fillRect(x - 1, y - 1, w + 2, 8);
    g.fillStyle(col, 1).fillRect(x, y, w * frac, 6);
    if (constructing) {
      g.fillStyle(0x000000, 0.7).fillRect(x - 1, y + 8, w + 2, 6);
      g.fillStyle(0xffa020, 1).fillRect(x, y + 9, w * b.progress, 4);
    } else if (b.queue.length > 0) {
      g.fillStyle(0x000000, 0.7).fillRect(x - 1, y + 8, w + 2, 6);
      g.fillStyle(0x40c0ff, 1).fillRect(x, y + 9, w * b.productionFraction(), 4);
    }
  }

  destroy(): void {
    for (const o of [this.body, this.shadow, this.bars, this.ring]) o.destroy();
    this.gun?.destroy();
  }
}
