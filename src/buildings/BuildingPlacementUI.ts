import Phaser from 'phaser';
import { DEPTH, TILE_SIZE } from '../config';
import { BuildingSystem } from './BuildingSystem';
import { BUILDING_DEFS, BuildingId } from './BuildingDefs';
import { buildingArt } from '../render/buildings/BuildingArt';
import { Projection } from '../render/Projection';
import { EV } from '../events';
import { t } from '../i18n';
import type { Squad } from '../units/Squad';

/** Ghost preview + click-to-place for player construction. Positions are logical world coords. */
export class BuildingPlacementUI {
  private active: BuildingId | null = null;
  private ghost: Phaser.GameObjects.Image;
  private overlay: Phaser.GameObjects.Graphics;
  private tile = { tx: 0, ty: 0 };
  /** Engineers raising this structure in the field (no build radius; they walk over to build it). */
  private builders: Squad[] = [];
  /** Facing of the next structure in quarter turns (fortifications only). */
  private rot = 0;
  private hint: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene, private buildings: BuildingSystem, private toWorld: (px: number, py: number) => Phaser.Math.Vector2) {
    this.ghost = scene.add.image(0, 0, buildingArt(scene, 'generator', Projection.tilt).body).setVisible(false).setAlpha(0.6);
    this.ghost.setDepth(DEPTH.overlay);
    this.overlay = scene.add.graphics().setDepth(DEPTH.overlay - 1);
    this.hint = scene.add.text(0, 0, '', { fontFamily: 'sans-serif', fontSize: '13px', color: '#e8f0ff', backgroundColor: '#0b1220cc', padding: { x: 5, y: 2 } })
      .setDepth(DEPTH.overlay + 1).setOrigin(0.5, 0).setVisible(false);
    scene.input.keyboard?.on('keydown-ESC', () => this.cancel());
    scene.input.keyboard?.on('keydown-V', () => this.rotate(1));
  }

  /** True when the structure being placed can be turned (fortifications). */
  get rotatable(): boolean {
    return !!this.active && BUILDING_DEFS[this.active].category === 'defense';
  }

  /** Turns the ghost a quarter turn (V key or mouse wheel while placing). */
  rotate(dir: number): void {
    if (!this.rotatable) return;
    this.rot = (this.rot + (dir < 0 ? 3 : 1)) % 4;
    const p = this.scene.input.activePointer;
    const w = this.toWorld(p.x, p.y);
    this.updatePointer(w.x, w.y);
  }

  get isActive(): boolean {
    return this.active !== null;
  }

  get activeId(): BuildingId | null {
    return this.active;
  }

  start(id: BuildingId, builders: Squad[] = []): void {
    this.active = id;
    this.builders = builders.filter((s) => s.alive);
    const art = buildingArt(this.scene, id, Projection.tilt);
    this.ghost.setTexture(art.body).setOrigin(art.originX, art.originY).setVisible(true);
    const p = this.scene.input.activePointer;
    const w = this.toWorld(p.x, p.y);
    this.updatePointer(w.x, w.y);
  }

  cancel(): void {
    this.active = null;
    this.ghost.setVisible(false);
    this.hint.setVisible(false);
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
    const field = this.builders.length > 0;
    const check = this.buildings.validate('player', this.active, this.tile.tx, this.tile.ty, field);
    const color = check.ok ? 0x30ff60 : 0xff3030;
    this.ghost.setPosition(x + px / 2, Projection.vy(y + px)).setTint(color);
    const g = this.overlay.clear();
    // Buildable areas around friendly structures (circles on the ground → ellipses).
    if (!field && !def.onPoint) {
      for (const b of this.buildings.getOwned('player')) {
        const r = b.def.buildRadius * TILE_SIZE;
        if (r > 0) g.lineStyle(2, 0x3a8dff, 0.25).strokeEllipse(b.x, Projection.vy(b.y), r * 2, r * 2 * k);
      }
    }
    g.fillStyle(color, 0.25).fillRect(x, Projection.vy(y), px, px * k);
    g.lineStyle(2, color, 0.9).strokeRect(x, Projection.vy(y), px, px * k);
    if (this.rotatable) {
      // Facing marker: a bar along a wall's length, or an arrow to the front of other defences.
      const cx = x + px / 2;
      const cy = y + px / 2;
      const a = (-this.rot * Math.PI) / 2;
      const fx = Math.sin(a);
      const fy = Math.cos(a);
      const L = Math.max(px * 0.45, 14);
      g.lineStyle(4, 0xffe070, 0.95);
      if (def.wall) g.lineBetween(cx - fy * L, Projection.vy(cy - fx * L), cx + fy * L, Projection.vy(cy + fx * L));
      else {
        g.lineBetween(cx, Projection.vy(cy), cx + fx * L, Projection.vy(cy + fy * L));
        g.fillStyle(0xffe070, 0.95).fillCircle(cx + fx * L, Projection.vy(cy + fy * L), 4);
      }
      this.hint.setText(t('hint.rotate')).setPosition(cx, Projection.vy(y + px) + 6).setVisible(true);
    } else this.hint.setVisible(false);
  }

  /** Attempts to place at the current ghost position. Returns true if placed. */
  confirm(keepPlacing: boolean): boolean {
    if (!this.active) return false;
    const ok = this.placeAt(this.tile.tx, this.tile.ty, true);
    if (ok && !keepPlacing) this.cancel();
    return ok;
  }

  /** Walls: drag from one tile to another lays a straight line of segments. */
  placeLine(x0: number, y0: number, x1: number, y1: number): number {
    const id = this.active;
    if (!id || !BUILDING_DEFS[id].wall || BUILDING_DEFS[id].gate) return 0;
    const a = this.buildings.snap(x0, y0, id);
    const b = this.buildings.snap(x1, y1, id);
    const n = Math.max(Math.abs(b.tx - a.tx), Math.abs(b.ty - a.ty));
    // Segments line up with the drag: along it for a horizontal line, turned for a vertical one.
    if (n > 0) this.rot = Math.abs(b.tx - a.tx) >= Math.abs(b.ty - a.ty) ? 0 : 1;
    let placed = 0;
    for (let i = 0; i <= n; i++) {
      const tx = Math.round(a.tx + ((b.tx - a.tx) * i) / Math.max(1, n));
      const ty = Math.round(a.ty + ((b.ty - a.ty) * i) / Math.max(1, n));
      if (this.placeAt(tx, ty, placed === 0)) placed++;
    }
    return placed;
  }

  private placeAt(tx: number, ty: number, report: boolean): boolean {
    const id = this.active;
    if (!id) return false;
    const field = this.builders.some((s) => s.alive);
    const check = this.buildings.validate('player', id, tx, ty, field);
    if (!check.ok) {
      if (report) this.scene.events.emit(EV.message, check.reason ?? 'err.cannotBuild', check.params);
      return false;
    }
    const b = this.buildings.tryPlace('player', id, tx, ty, field, this.rotatable ? this.rot : 0);
    if (b && field) {
      // Sites queue up for the engineers who ordered them.
      for (const s of this.builders) if (s.alive && (!s.repairTarget || !s.repairTarget.alive)) s.repair(b);
    }
    return !!b;
  }

  /** True if the active structure can be laid by dragging a line. */
  get draggable(): boolean {
    return !!this.active && !!BUILDING_DEFS[this.active].wall && !BUILDING_DEFS[this.active].gate;
  }
}
