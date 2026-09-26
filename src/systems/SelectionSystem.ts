import Phaser from 'phaser';
import { EV } from '../events';
import { Building } from '../buildings/Building';
import { Squad } from '../units/Squad';

/** Tracks what the player currently has selected (squads or one building). */
export class SelectionSystem {
  building: Building | null = null;
  squads: Squad[] = [];

  constructor(private scene: Phaser.Scene) {}

  selectBuilding(b: Building | null): void {
    this.clear(false);
    this.building = b;
    b?.setSelected(true);
    this.changed();
  }

  selectSquads(list: Squad[], additive = false): void {
    if (!additive) this.clear(false);
    this.building?.setSelected(false);
    this.building = null;
    for (const s of list) {
      if (!this.squads.includes(s)) this.squads.push(s);
      s.setSelected(true);
    }
    this.changed();
  }

  toggleSquad(s: Squad): void {
    if (this.squads.includes(s)) {
      this.squads = this.squads.filter((q) => q !== s);
      s.setSelected(false);
      this.changed();
    } else {
      this.selectSquads([s], true);
    }
  }

  clear(emit = true): void {
    this.building?.setSelected(false);
    this.building = null;
    for (const s of this.squads) s.setSelected(false);
    this.squads = [];
    if (emit) this.changed();
  }

  get hasSquads(): boolean {
    return this.squads.length > 0;
  }

  /** Drops references to dead objects. */
  prune(): void {
    let dirty = false;
    if (this.building && !this.building.alive) {
      this.building = null;
      dirty = true;
    }
    const alive = this.squads.filter((s) => s.alive && !s.embarked);
    if (alive.length !== this.squads.length) {
      this.squads = alive;
      dirty = true;
    }
    if (dirty) this.changed();
  }

  private changed(): void {
    this.scene.events.emit(EV.selectionChanged);
  }
}
