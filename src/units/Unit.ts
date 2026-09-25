import Phaser from 'phaser';
import { DEPTH } from '../config';
import { Projection } from '../render/Projection';
import { Owner } from '../types';
import { UnitDef } from './UnitDefs';
import { unitTextureKey } from '../assets/UnitTextures';
import type { Squad } from './Squad';

let nextUnitId = 1;

/** A single soldier. Squads own and steer these. */
export class Unit {
  readonly uid = nextUnitId++;
  readonly def: UnitDef;
  readonly owner: Owner;
  squad: Squad;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  hp: number;
  maxHp: number;
  cooldown: number;
  /** Formation slot index within the squad. */
  slot = 0;
  inCover = false;
  alive = true;
  readonly sprite: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Image;
  private shield: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private silhouette: Phaser.GameObjects.Image;
  private shown = true;
  /** True when a cliff or building is drawn over this unit. */
  occluded = false;

  constructor(scene: Phaser.Scene, squad: Squad, x: number, y: number, hpMult: number) {
    this.def = squad.def;
    this.owner = squad.owner;
    this.squad = squad;
    this.x = x;
    this.y = y;
    this.maxHp = this.def.hp * hpMult;
    this.hp = this.maxHp;
    this.cooldown = Math.random() * this.def.cooldown;
    const k = Projection.tilt;
    this.shadow = scene.add.image(x, Projection.vy(y), 'fx_soft').setTint(0x000000).setAlpha(0.6).setDepth(DEPTH.shadows);
    this.shadow.setScale((this.def.size * 2.6) / 32, (this.def.size * 2.6 * k) / 32);
    this.ring = scene.add.image(x, Projection.vy(y), 'sel_ring').setDepth(DEPTH.selection).setVisible(false);
    this.ring.setScale((this.def.size * 2 + 8) / 28, ((this.def.size * 2 + 8) / 28) * k);
    this.sprite = scene.add.image(x, Projection.vy(y), unitTextureKey(this.def.id)).setDepth(Projection.depth(y));
    this.sprite.rotation = this.owner === 'player' ? -Math.PI / 4 : (Math.PI * 3) / 4;
    this.silhouette = scene.add.image(x, y, unitTextureKey(this.def.id)).setDepth(DEPTH.silhouettes);
    this.silhouette.setTintFill(0x9ad0ff).setAlpha(0.35).setVisible(false);
    this.shield = scene.add.image(x, y, 'icon_cover').setDepth(DEPTH.bars - 1);
    this.shield.setVisible(false);
  }

  /** Visual height of the model in view px. */
  get height(): number {
    return this.def.size * 2.4;
  }

  /** Chest-height point in view space (projectile origin / impact). */
  aimPoint(): { x: number; y: number } {
    return { x: this.x, y: Projection.vy(this.y) - this.height * 0.5 };
  }

  /** True if a view-space point lies on this unit's drawn body. */
  containsView(vx: number, vy: number): boolean {
    const gy = Projection.vy(this.y);
    const r = this.def.size + 5;
    return vx >= this.x - r && vx <= this.x + r && vy >= gy - this.height - 4 && vy <= gy + 5;
  }

  get radius(): number {
    return this.def.size;
  }

  /** Applies damage; returns true if this hit killed the unit. */
  takeDamage(amount: number): boolean {
    if (!this.alive) return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  face(tx: number, ty: number): void {
    const k = Projection.tilt;
    this.sprite.rotation = Phaser.Math.Angle.RotateTo(this.sprite.rotation, Math.atan2((ty - this.y) * k, tx - this.x), 0.25);
  }

  setSelected(sel: boolean): void {
    this.ring.setVisible(sel && this.shown);
  }

  setShown(shown: boolean): void {
    if (this.shown === shown) return;
    this.shown = shown;
    this.sprite.setVisible(shown);
    this.shadow.setVisible(shown);
    if (!shown) {
      this.silhouette.setVisible(false);
      this.ring.setVisible(false);
      this.shield.setVisible(false);
    }
  }

  get isShown(): boolean {
    return this.shown;
  }

  setCover(cover: boolean): void {
    this.inCover = cover;
    this.shield.setVisible(cover && this.shown);
  }

  setOccluded(occ: boolean): void {
    this.occluded = occ;
    this.silhouette.setVisible(occ && this.shown);
  }

  syncSprite(): void {
    const gy = Projection.vy(this.y);
    const bodyY = gy - this.def.size * 0.9;
    this.sprite.setPosition(this.x, bodyY).setDepth(Projection.depth(this.y));
    this.shadow.setPosition(this.x + 2, gy + 1);
    this.ring.setPosition(this.x, gy);
    this.shield.setPosition(this.x, gy - this.height - 8);
    if (this.occluded) this.silhouette.setPosition(this.x, bodyY).setRotation(this.sprite.rotation);
  }

  destroy(): void {
    for (const o of [this.sprite, this.ring, this.shield, this.shadow, this.silhouette]) o.destroy();
  }
}
