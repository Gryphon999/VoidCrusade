import Phaser from 'phaser';
import { getMap } from '../maps';
import { MapSystem } from '../systems/MapSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { RESOURCES, TILE_SIZE } from '../config';
import type { HudScene } from './HudScene';

export interface BattleData {
  mapIndex?: number;
}

export class BattleScene extends Phaser.Scene {
  map!: MapSystem;
  cameraSystem!: CameraSystem;
  resources!: ResourceSystem;
  hud!: HudScene;
  elapsed = 0;

  constructor() {
    super('BattleScene');
  }

  create(data: BattleData): void {
    this.elapsed = 0;
    this.map = new MapSystem(getMap(data.mapIndex ?? 0));
    this.map.render(this);
    this.resources = new ResourceSystem();
    this.resources.addIncome('player', 'scrip', RESOURCES.baseScripIncome);
    this.resources.addIncome('enemy', 'scrip', RESOURCES.baseScripIncome);
    this.cameraSystem = new CameraSystem(this, this.map.worldWidth, this.map.worldHeight);
    const base = this.map.def.playerBase;
    this.cameraSystem.centerOn((base.tx + 2) * TILE_SIZE, (base.ty + 2) * TILE_SIZE);

    this.scene.launch('HudScene', { battle: this });
    this.hud = this.scene.get('HudScene') as HudScene;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cameraSystem.destroy();
      this.scene.stop('HudScene');
    });
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    this.elapsed += dt;
    this.resources.tick(dt);
    this.cameraSystem.update(dt);
  }
}
