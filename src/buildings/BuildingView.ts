import Phaser from 'phaser';
import { DEPTH, TILE_SIZE } from '../config';
import { Projection } from '../render/Projection';
import { BuildingArtInfo, buildingArt, scaffoldKey } from '../render/buildings/BuildingArt';
import type { Building } from './Building';
import type { BattleScene } from '../scenes/BattleScene';

/** All rendering for one building: painted volume, glow layer, lights, smoke, scaffolding, bars, ring. */
export class BuildingView {
  private body: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private lights: Phaser.GameObjects.Image[] = [];
  private scaffold?: Phaser.GameObjects.Image;
  private gun?: Phaser.GameObjects.Image;
  private bars: Phaser.GameObjects.Graphics;
  private ring: Phaser.GameObjects.Graphics;
  private art: BuildingArtInfo;
  private selected = false;
  private shown = true;
  private fxTimer = Math.random();
  private readonly bottom: number;
  private readonly top: number;

  constructor(private scene: Phaser.Scene, private b: Building) {
    const def = b.def;
    const px = def.size * TILE_SIZE;
    const k = Projection.tilt;
    this.art = buildingArt(scene, def.id, k);
    this.bottom = b.y + px / 2;
    this.top = b.y - px / 2;
    const bx = b.x;
    const by = Projection.vy(this.bottom);
    const depth = Projection.depth(this.bottom);
    this.ring = scene.add.graphics().setDepth(DEPTH.selection).setVisible(false);
    this.ring.lineStyle(3, 0x3a8dff, 1).strokeEllipse(b.x, Projection.vy(b.y), px * 1.3, px * 1.3 * k);
    this.body = scene.add.image(bx, by, this.art.body).setOrigin(this.art.originX, this.art.originY).setDepth(depth);
    this.glow = scene.add.image(bx, by, this.art.glow).setOrigin(this.art.originX, this.art.originY)
      .setDepth(depth + 0.2).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: this.glow, alpha: { from: 1, to: 0.55 }, duration: 1300 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    for (const l of this.art.lights) {
      const img = scene.add.image(bx + l.x, by + l.y, 'aura').setScale(0.22).setBlendMode(Phaser.BlendModes.ADD)
        .setTint(def.faction === 'ironvoid' ? 0xff5030 : 0xd060ff).setDepth(depth + 0.3);
      scene.tweens.add({ targets: img, alpha: { from: 1, to: 0.1 }, duration: 500 + Math.random() * 700, yoyo: true, repeat: -1, delay: Math.random() * 800 });
      this.lights.push(img);
    }
    if (def.attack) {
      const key = def.faction === 'ironvoid' ? 'bld_turret_gun' : 'bld_spine_gun';
      const g = this.art.gun ?? { x: 0, y: -def.height };
      this.gun = scene.add.image(bx + g.x, by + g.y, key).setOrigin(24 / 90, 0.5).setDepth(depth + 0.5);
      this.gun.setScale(1.1, 0.8 + 0.3 * k);
      this.gun.rotation = b.owner === 'player' ? -Math.PI / 4 : (Math.PI * 3) / 4;
    }
    if (b.state === 'constructing') {
      this.scaffold = scene.add.image(bx, by, scaffoldKey(scene, def.size, def.height, k)).setOrigin(0.5, 1).setDepth(depth + 0.4);
      this.scaffold.setY(by + 4);
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

  aimPoint(): { x: number; y: number } {
    return { x: this.b.x, y: Projection.vy(this.b.y) - this.b.def.height * 0.5 };
  }

  aimAt(x: number, y: number): void {
    if (this.gun) this.gun.rotation = Phaser.Math.Angle.Between(this.gun.x, this.gun.y, x, Projection.vy(y));
  }

  gunTip(): { x: number; y: number } {
    const g = this.gun;
    if (!g) return this.aimPoint();
    return { x: g.x + Math.cos(g.rotation) * 60, y: g.y + Math.sin(g.rotation) * 60 * Projection.tilt };
  }

  setSelected(sel: boolean): void {
    this.selected = sel;
    this.ring.setVisible(sel && this.shown);
  }

  setShown(shown: boolean): void {
    if (this.shown === shown) return;
    this.shown = shown;
    for (const o of [this.body, this.glow, this.bars, ...this.lights]) o.setVisible(shown);
    this.gun?.setVisible(shown);
    this.scaffold?.setVisible(shown);
    this.ring.setVisible(shown && this.selected);
    if (shown) this.refresh();
  }

  /** Per-frame: smoke from chimneys, welding sparks while under construction. */
  update(dt: number): void {
    if (!this.shown) return;
    this.fxTimer -= dt;
    if (this.fxTimer > 0) return;
    const fx = (this.scene as BattleScene).effects;
    if (!fx) return;
    if (this.b.state === 'constructing') {
      this.fxTimer = 0.18;
      const r = this.b.radius;
      const yLine = this.body.y - this.b.def.height * this.b.progress - 6;
      fx.explosions.impact(this.b.x + (Math.random() - 0.5) * r * 1.6, yLine + (Math.random() - 0.5) * 10);
    } else {
      this.fxTimer = 0.35 + Math.random() * 0.3;
      for (const s of this.art.smoke) fx.explosions.puff(this.body.x + s.x, this.body.y + s.y);
    }
  }

  refresh(): void {
    const b = this.b;
    const constructing = b.state === 'constructing';
    if (constructing) {
      // Rises from the ground up as work progresses.
      const h = this.art.height;
      const visible = (h * (1 - this.art.originY)) + (h * this.art.originY) * (0.15 + 0.85 * b.progress);
      this.body.setCrop(0, h - visible, this.art.width, visible).setAlpha(0.85);
      this.glow.setVisible(false);
      for (const l of this.lights) l.setVisible(false);
    } else if (this.scaffold) {
      this.body.setCrop().setAlpha(1);
      this.glow.setVisible(this.shown);
      for (const l of this.lights) l.setVisible(this.shown);
      this.scaffold.destroy();
      this.scaffold = undefined;
    }
    this.gun?.setAlpha(constructing ? 0.4 : 1);
    const g = this.bars.clear();
    const w = Math.max(60, b.def.size * TILE_SIZE * 0.8);
    const x = b.x - w / 2;
    const y = Projection.vy(this.top) - b.def.height - 18;
    const frac = b.hp / b.maxHp;
    const col = frac > 0.6 ? 0x40d040 : frac > 0.3 ? 0xe0c020 : 0xe03020;
    g.fillStyle(0x0a0a0c, 0.85).fillRect(x - 2, y - 2, w + 4, 10);
    g.lineStyle(1, b.owner === 'player' ? 0xb0903a : 0x7a3040, 0.9).strokeRect(x - 2, y - 2, w + 4, 10);
    g.fillStyle(col, 1).fillRect(x, y, w * frac, 6);
    if (constructing) {
      g.fillStyle(0x000000, 0.7).fillRect(x - 1, y + 9, w + 2, 6);
      g.fillStyle(0xffa020, 1).fillRect(x, y + 10, w * b.progress, 4);
    } else if (b.queue.length > 0) {
      g.fillStyle(0x000000, 0.7).fillRect(x - 1, y + 9, w + 2, 6);
      g.fillStyle(0x40c0ff, 1).fillRect(x, y + 10, w * b.productionFraction(), 4);
    }
  }

  destroy(): void {
    for (const o of [this.body, this.glow, this.bars, this.ring, ...this.lights]) o.destroy();
    this.gun?.destroy();
    this.scaffold?.destroy();
  }
}
