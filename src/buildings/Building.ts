import Phaser from 'phaser';
import { BUILD, TILE_SIZE } from '../config';
import { Owner } from '../types';
import { BuildingDef } from './BuildingDefs';
import { BuildingView } from './BuildingView';
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
  /** Re-queue each finished unit automatically. */
  repeat = false;
  rally: { x: number; y: number };
  attackCooldown = 0;
  /** True once the enemy has ever seen it (fog of war). */
  discovered = false;
  /** Has ever finished construction (upkeep bookkeeping). */
  completed = false;
  /** Engineer-raised site: construction only advances while engineers work on it. */
  needsBuilder = false;
  /** Squads sheltering inside (bunkers). */
  readonly garrison: import('../units/Squad').Squad[] = [];
  /** Shield dome: active until (battle s), ready again at (battle s). */
  shieldUntil = 0;
  shieldReady = 0;

  readonly view: BuildingView;

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

    this.view = new BuildingView(scene, this);
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
    this.view.aimAt(x, y);
  }

  /** Muzzle position in view space. */
  get gunTip(): { x: number; y: number } {
    return this.view.gunTip();
  }

  setSelected(sel: boolean): void {
    this.view.setSelected(sel);
  }

  setShown(shown: boolean): void {
    this.view.setShown(shown);
  }

  refreshVisual(): void {
    this.view.refresh();
  }

  productionFraction(): number {
    const head = this.queue[0];
    return head ? Math.min(1, this.queueTime / UNIT_DEFS[head].trainTime) : 0;
  }

  destroy(): void {
    this.view.destroy();
  }
}
