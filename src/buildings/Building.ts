import Phaser from 'phaser';
import { BUILD, DEPTH, TILE_SIZE } from '../config';
import { Owner } from '../types';
import { BuildingDef } from './BuildingDefs';
import { buildingTextureKey } from '../assets/BuildingTextures';
import { UNIT_DEFS, UnitId } from '../units/UnitDefs';

export type BuildingState = 'constructing' | 'ready' | 'destroyed';

let nextBuildingId = 1;

export class Building {
  readonly uid = nextBuildingId++;
  readonly def: BuildingDef;
  readonly owner: Owner;
  readonly tx: number;
  readonly ty: number;
  readonly x: number;
  readonly y: number;
  state: BuildingState;
  hp: number;
  maxHp: number;
  progress: number;
  /** Production queue and progress (seconds) on the head item. */
  queue: UnitId[] = [];
  queueTime = 0;
  rally: { x: number; y: number };
  attackCooldown = 0;
  /** True once the enemy has ever seen it (fog of war). */
  discovered = false;

  private sprite: Phaser.GameObjects.Image;
  private gun?: Phaser.GameObjects.Image;
  private bars: Phaser.GameObjects.Graphics;
  private ring: Phaser.GameObjects.Graphics;
  private selected = false;
  private shown = true;

  constructor(scene: Phaser.Scene, def: BuildingDef, owner: Owner, tx: number, ty: number, instant: boolean) {
    this.def = def;
    this.owner = owner;
    this.tx = tx;
    this.ty = ty;
    const px = def.size * TILE_SIZE;
    this.x = tx * TILE_SIZE + px / 2;
    this.y = ty * TILE_SIZE + px / 2;
    this.maxHp = def.hp;
    this.state = instant || def.buildTime <= 0 ? 'ready' : 'constructing';
    this.progress = this.state === 'ready' ? 1 : 0;
    this.hp = this.state === 'ready' ? def.hp : def.hp * BUILD.startHpFraction;
    this.rally = { x: this.x, y: this.y + px / 2 + 48 };

    this.ring = scene.add.graphics().setDepth(DEPTH.selection).setVisible(false);
    this.ring.lineStyle(3, 0x3a8dff, 1).strokeEllipse(this.x, this.y, px * 1.2, px * 1.2);
    this.sprite = scene.add.image(this.x, this.y, buildingTextureKey(def.id)).setDepth(DEPTH.buildings);
    if (def.attack) {
      const key = def.faction === 'ironvoid' ? 'bld_turret_gun' : 'bld_spine_gun';
      this.gun = scene.add.image(this.x, this.y, key).setOrigin(24 / 90, 0.5).setDepth(DEPTH.buildings + 1);
      this.gun.rotation = owner === 'player' ? -Math.PI / 4 : (Math.PI * 3) / 4;
    }
    this.bars = scene.add.graphics().setDepth(DEPTH.buildings + 2);
    this.refreshVisual();
  }

  get radius(): number {
    return (this.def.size * TILE_SIZE) / 2;
  }

  get alive(): boolean {
    return this.state !== 'destroyed';
  }

  get isReady(): boolean {
    return this.state === 'ready';
  }

  containsPoint(wx: number, wy: number): boolean {
    const r = this.radius;
    return Math.abs(wx - this.x) <= r && Math.abs(wy - this.y) <= r;
  }

  /** Advances construction; returns true on the frame construction completes. */
  updateConstruction(dt: number, speedMult = 1): boolean {
    if (this.state !== 'constructing') return false;
    const step = (dt * speedMult) / this.def.buildTime;
    this.progress = Math.min(1, this.progress + step);
    this.hp = Math.min(this.maxHp, this.hp + step * this.maxHp * (1 - BUILD.startHpFraction));
    if (this.progress >= 1) this.state = 'ready';
    this.refreshVisual();
    return this.state === 'ready';
  }

  /** Applies damage; returns true if this hit destroyed the building. */
  takeDamage(amount: number): boolean {
    if (!this.alive) return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'destroyed';
      return true;
    }
    this.refreshVisual();
    return false;
  }

  heal(amount: number): void {
    if (!this.alive || this.hp >= this.maxHp) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.refreshVisual();
  }

  aimAt(x: number, y: number): void {
    if (this.gun) this.gun.rotation = Phaser.Math.Angle.Between(this.x, this.y, x, y);
  }

  get gunTip(): { x: number; y: number } {
    const rot = this.gun?.rotation ?? 0;
    return { x: this.x + Math.cos(rot) * 56, y: this.y + Math.sin(rot) * 56 };
  }

  setSelected(sel: boolean): void {
    this.selected = sel;
    this.ring.setVisible(sel && this.shown);
  }

  setShown(shown: boolean): void {
    if (this.shown === shown) return;
    this.shown = shown;
    this.sprite.setVisible(shown);
    this.gun?.setVisible(shown);
    this.bars.setVisible(shown);
    this.ring.setVisible(shown && this.selected);
  }

  refreshVisual(): void {
    const constructing = this.state === 'constructing';
    this.sprite.setAlpha(constructing ? 0.3 + 0.7 * this.progress : 1);
    this.gun?.setAlpha(this.sprite.alpha);
    const g = this.bars.clear();
    const w = Math.max(60, this.def.size * TILE_SIZE * 0.8);
    const x = this.x - w / 2;
    const y = this.y - this.radius - 14;
    const frac = this.hp / this.maxHp;
    const col = frac > 0.6 ? 0x40d040 : frac > 0.3 ? 0xe0c020 : 0xe03020;
    g.fillStyle(0x000000, 0.7).fillRect(x - 1, y - 1, w + 2, 8);
    g.fillStyle(col, 1).fillRect(x, y, w * frac, 6);
    if (constructing) {
      g.fillStyle(0x000000, 0.7).fillRect(x - 1, y + 8, w + 2, 6);
      g.fillStyle(0xffa020, 1).fillRect(x, y + 9, w * this.progress, 4);
    } else if (this.queue.length > 0) {
      g.fillStyle(0x000000, 0.7).fillRect(x - 1, y + 8, w + 2, 6);
      g.fillStyle(0x40c0ff, 1).fillRect(x, y + 9, w * this.productionFraction(), 4);
    }
  }

  productionFraction(): number {
    const head = this.queue[0];
    return head ? Math.min(1, this.queueTime / UNIT_DEFS[head].trainTime) : 0;
  }

  destroy(): void {
    this.sprite.destroy();
    this.gun?.destroy();
    this.bars.destroy();
    this.ring.destroy();
  }
}
