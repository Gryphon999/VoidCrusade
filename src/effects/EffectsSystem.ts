import Phaser from 'phaser';
import { spawnOrderMarker } from './OrderMarker';

/** Facade for visual effects triggered by gameplay. */
export class EffectsSystem {
  constructor(private scene: Phaser.Scene) {}

  orderMarker(x: number, y: number, attack: boolean): void {
    spawnOrderMarker(this.scene, x, y, attack);
  }
}
