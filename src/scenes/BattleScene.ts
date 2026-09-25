import Phaser from 'phaser';
import { getMap } from '../maps';
import { MapSystem } from '../systems/MapSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { SelectionSystem } from '../systems/SelectionSystem';
import { InputController } from '../systems/InputController';
import { BuildingSystem } from '../buildings/BuildingSystem';
import { BuildingPlacementUI } from '../buildings/BuildingPlacementUI';
import { RESOURCES, TILE_SIZE } from '../config';
import type { HudScene } from './HudScene';

export interface BattleData {
  mapIndex?: number;
}

export class BattleScene extends Phaser.Scene {
  map!: MapSystem;
  cameraSystem!: CameraSystem;
  resources!: ResourceSystem;
  buildings!: BuildingSystem;
  placement!: BuildingPlacementUI;
  selection!: SelectionSystem;
  inputController!: InputController;
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
    this.buildings = new BuildingSystem(this, this.map, this.resources);
    this.selection = new SelectionSystem(this);
    this.placement = new BuildingPlacementUI(this, this.buildings);

    const { playerBase, enemyBase } = this.map.def;
    this.buildings.spawn('stronghold', 'player', playerBase.tx, playerBase.ty, true);
    this.buildings.spawn('hive', 'enemy', enemyBase.tx, enemyBase.ty, true);

    this.cameraSystem = new CameraSystem(this, this.map.worldWidth, this.map.worldHeight);
    this.cameraSystem.centerOn((playerBase.tx + 2) * TILE_SIZE, (playerBase.ty + 2) * TILE_SIZE);
    this.inputController = new InputController(this);
    this.input.keyboard?.on('keydown-B', () => {
      const hq = this.buildings.getHQ('player');
      if (hq) this.selection.selectBuilding(hq);
    });

    this.scene.launch('HudScene', { battle: this });
    this.hud = this.scene.get('HudScene') as HudScene;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cameraSystem.destroy();
      this.inputController.destroy();
      this.scene.stop('HudScene');
    });
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    this.elapsed += dt;
    this.resources.tick(dt);
    this.buildings.update(dt);
    this.selection.prune();
    this.cameraSystem.update(dt);
    if (this.placement.isActive) {
      const p = this.input.activePointer;
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      this.placement.updatePointer(w.x, w.y);
    }
  }
}
