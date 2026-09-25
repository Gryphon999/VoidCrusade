import Phaser from 'phaser';
import { DEPTH } from '../config';
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
  private shown = true;

  constructor(scene: Phaser.Scene, squad: Squad, x: number, y: number, hpMult: number) {
    this.def = squad.def;
    this.owner = squad.owner;
    this.squad = squad;
    this.x = x;
    this.y = y;
    this.maxHp = this.def.hp * hpMult;
    this.hp = this.maxHp;
    this.cooldown = Math.random() * this.def.cooldown;
    this.ring = scene.add.image(x, y, 'sel_ring').setDepth(DEPTH.selection).setVisible(false);
    this.ring.setScale((this.def.size * 2 + 8) / 28);
    this.sprite = scene.add.image(x, y, unitTextureKey(this.def.id)).setDepth(DEPTH.units);
    this.sprite.rotation = this.owner === 'player' ? -Math.PI / 4 : (Math.PI * 3) / 4;
    this.shield = scene.add.image(x, y - this.def.size - 8, 'icon_cover').setDepth(DEPTH.units + 1);
    this.shield.setVisible(false);
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
    this.sprite.rotation = Phaser.Math.Angle.RotateTo(
      this.sprite.rotation,
      Phaser.Math.Angle.Between(this.x, this.y, tx, ty),
      0.25,
    );
  }

  setSelected(sel: boolean): void {
    this.ring.setVisible(sel && this.shown);
  }

  setShown(shown: boolean): void {
    if (this.shown === shown) return;
    this.shown = shown;
    this.sprite.setVisible(shown);
    if (!shown) {
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

  syncSprite(): void {
    this.sprite.setPosition(this.x, this.y);
    this.ring.setPosition(this.x, this.y);
    this.shield.setPosition(this.x, this.y - this.def.size - 8);
  }

  destroy(): void {
    this.sprite.destroy();
    this.ring.destroy();
    this.shield.destroy();
  }
}
