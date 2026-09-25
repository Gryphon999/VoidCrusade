import Phaser from 'phaser';
import { EV } from '../events';
import { Building } from '../buildings/Building';

/** Tracks what the player currently has selected. */
export class SelectionSystem {
  building: Building | null = null;

  constructor(private scene: Phaser.Scene) {}

  selectBuilding(b: Building | null): void {
    this.clear(false);
    this.building = b;
    b?.setSelected(true);
    this.changed();
  }

  clear(emit = true): void {
    this.building?.setSelected(false);
    this.building = null;
    if (emit) this.changed();
  }

  /** Drops references to dead objects. */
  prune(): void {
    if (this.building && !this.building.alive) {
      this.building = null;
      this.changed();
    }
  }

  private changed(): void {
    this.scene.events.emit(EV.selectionChanged);
  }
}
