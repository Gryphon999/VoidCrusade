import Phaser from 'phaser';
import { createTileTextures } from '../assets/TileTextures';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  create(): void {
    createTileTextures(this);
    this.scene.start('MenuScene');
  }
}
