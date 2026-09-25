import Phaser from 'phaser';
import { getMap } from '../maps';
import { MapSystem } from '../systems/MapSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { TILE_SIZE } from '../config';

export interface BattleData {
  mapIndex?: number;
}

export class BattleScene extends Phaser.Scene {
  map!: MapSystem;
  cameraSystem!: CameraSystem;

  constructor() {
    super('BattleScene');
  }

  create(data: BattleData): void {
    this.map = new MapSystem(getMap(data.mapIndex ?? 0));
    this.map.render(this);
    this.cameraSystem = new CameraSystem(this, this.map.worldWidth, this.map.worldHeight);
    const base = this.map.def.playerBase;
    this.cameraSystem.centerOn((base.tx + 2) * TILE_SIZE, (base.ty + 2) * TILE_SIZE);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cameraSystem.destroy());
  }

  update(_time: number, delta: number): void {
    this.cameraSystem.update(delta / 1000);
  }
}
