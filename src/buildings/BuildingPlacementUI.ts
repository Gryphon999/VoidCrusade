import Phaser from 'phaser';
import { DEPTH, TILE_SIZE } from '../config';
import { BuildingSystem } from './BuildingSystem';
import { BUILDING_DEFS, BuildingId } from './BuildingDefs';
import { ensureBuildingVolumes, volumeTextureKey } from '../assets/BuildingTextures';
import { Projection } from '../render/Projection';
import { EV } from '../events';

/** Ghost preview + click-to-place for player construction. Positions are logical world coords. */
export class BuildingPlacementUI {
  private active: BuildingId | null = null;
  private ghost: Phaser.GameObjects.Image;
  private overlay: Phaser.GameObjects.Graphics;
  private tile = { tx: 0, ty: 0 };

  constructor(private scene: Phaser.Scene, private buildings: BuildingSystem, private toWorld: (px: number, py: number) => Phaser.Math.Vector2) {
    ensureBuildingVolumes(scene, Projection.tilt);
    this.ghost = scene.add.image(0, 0, volumeTextureKey('generator', Projection.tilt)).setVisible(false).setAlpha(0.6);
    this.ghost.setOrigin(0.5, 1).setDepth(DEPTH.overlay);
    this.overlay = scene.add.graphics().setDepth(DEPTH.overlay - 1);
    scene.input.keyboard?.on('keydown-ESC', () => this.cancel());
  }

  get isActive(): boolean {
    return this.active !== null;
  }

  get activeId(): BuildingId | null {
    return this.active;
  }

  start(id: BuildingId): void {
    this.active = id;
    this.ghost.setTexture(volumeTextureKey(id, Projection.tilt)).setVisible(true);
    const p = this.scene.input.activePointer;
    const w = this.toWorld(p.x, p.y);
    this.updatePointer(w.x, w.y);
  }

  cancel(): void {
    this.active = null;
    this.ghost.setVisible(false);
    this.overlay.clear();
  }

  updatePointer(wx: number, wy: number): void {
    if (!this.active) return;
    const def = BUILDING_DEFS[this.active];
    this.tile = this.buildings.snap(wx, wy, this.active);
    const px = def.size * TILE_SIZE;
    const k = Projection.tilt;
    const x = this.tile.tx * TILE_SIZE;
    const y = this.tile.ty * TILE_SIZE;
    const check = this.buildings.validate('player', this.active, this.tile.tx, this.tile.ty);
    const color = check.ok ? 0x30ff60 : 0xff3030;
    this.ghost.setPosition(x + px / 2, Projection.vy(y + px)).setTint(color);
    const g = this.overlay.clear();
    // Buildable areas around friendly structures (circles on the ground → ellipses).
    for (const b of this.buildings.getOwned('player')) {
      const r = b.def.buildRadius * TILE_SIZE;
      g.lineStyle(2, 0x3a8dff, 0.25).strokeEllipse(b.x, Projection.vy(b.y), r * 2, r * 2 * k);
    }
    g.fillStyle(color, 0.25).fillRect(x, Projection.vy(y), px, px * k);
    g.lineStyle(2, color, 0.9).strokeRect(x, Projection.vy(y), px, px * k);
  }

  /** Attempts to place at the current ghost position. Returns true if placed. */
  confirm(keepPlacing: boolean): boolean {
    if (!this.active) return false;
    const id = this.active;
    const check = this.buildings.validate('player', id, this.tile.tx, this.tile.ty);
    if (!check.ok) {
      this.scene.events.emit(EV.message, check.reason ?? 'Cannot build here');
      return false;
    }
    this.buildings.tryPlace('player', id, this.tile.tx, this.tile.ty);
    if (!keepPlacing) this.cancel();
    return true;
  }
}
