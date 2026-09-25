import Phaser from 'phaser';
import { createTileTextures } from '../assets/TileTextures';
import { createUITextures } from '../assets/UITextures';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  create(): void {
    createTileTextures(this);
    createUITextures(this);
    this.scene.start('MenuScene');
  }
}
