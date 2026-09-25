import Phaser from 'phaser';
import { createTileTextures } from '../assets/TileTextures';
import { createUITextures } from '../assets/UITextures';
import { createBuildingTextures } from '../assets/BuildingTextures';
import { createUnitTextures } from '../assets/UnitTextures';
import { createFxTextures } from '../assets/FxTextures';
import { createCaptureTextures } from '../assets/CaptureTextures';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  create(): void {
    createTileTextures(this);
    createUITextures(this);
    createBuildingTextures(this);
    createUnitTextures(this);
    createFxTextures(this);
    createCaptureTextures(this);
    this.scene.start('MenuScene');
  }
}
