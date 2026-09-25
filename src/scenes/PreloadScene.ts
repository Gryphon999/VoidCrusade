import Phaser from 'phaser';
import { createTileTextures } from '../assets/TileTextures';
import { createUITextures } from '../assets/UITextures';
import { createBuildingTextures } from '../assets/BuildingTextures';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  create(): void {
    createTileTextures(this);
    createUITextures(this);
    createBuildingTextures(this);
    this.scene.start('MenuScene');
  }
}
