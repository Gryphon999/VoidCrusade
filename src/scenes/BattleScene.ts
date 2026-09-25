import Phaser from 'phaser';
import { getMap } from '../maps';
import { MapSystem } from '../systems/MapSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { SelectionSystem } from '../systems/SelectionSystem';
import { InputController } from '../systems/InputController';
import { Pathfinder } from '../systems/Pathfinder';
import { ProductionSystem } from '../systems/ProductionSystem';
import { ResearchSystem } from '../systems/ResearchSystem';
import { CapturePointSystem } from '../systems/CapturePointSystem';
import { ModifierTable, defaultModifiers } from '../systems/Modifiers';
import { BuildingSystem } from '../buildings/BuildingSystem';
import { BuildingPlacementUI } from '../buildings/BuildingPlacementUI';
import { UnitSystem } from '../units/UnitSystem';
import { CombatSystem } from '../units/CombatSystem';
import { Unit } from '../units/Unit';
import { Squad } from '../units/Squad';
import { RESOURCES } from '../config';
import { EffectsSystem } from '../effects/EffectsSystem';
import type { HudScene } from './HudScene';

export interface BattleData {
  mapIndex?: number;
}

/** Cover/LOS queries (implemented by CoverSystem). */
export interface CoverQueries {
  hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean;
  blockPoint(x0: number, y0: number, x1: number, y1: number): { x: number; y: number } | null;
  damageMultiplier(u: Unit): number;
  seekCover(s: Squad): void;
}

export class BattleScene extends Phaser.Scene {
  map!: MapSystem;
  cameraSystem!: CameraSystem;
  resources!: ResourceSystem;
  buildings!: BuildingSystem;
  placement!: BuildingPlacementUI;
  selection!: SelectionSystem;
  inputController!: InputController;
  pathfinder!: Pathfinder;
  units!: UnitSystem;
  combat!: CombatSystem;
  production!: ProductionSystem;
  research!: ResearchSystem;
  capture!: CapturePointSystem;
  modifiers!: ModifierTable;
  cover?: CoverQueries;
  effects!: EffectsSystem;
  hud!: HudScene;
  elapsed = 0;

  constructor() {
    super('BattleScene');
  }

  create(data: BattleData): void {
    this.elapsed = 0;
    this.modifiers = { player: defaultModifiers(), enemy: defaultModifiers() };
    this.map = new MapSystem(getMap(data.mapIndex ?? 0));
    this.map.render(this);
    this.pathfinder = new Pathfinder(this.map);
    this.resources = new ResourceSystem();
    this.resources.addIncome('player', 'scrip', RESOURCES.baseScripIncome);
    this.resources.addIncome('enemy', 'scrip', RESOURCES.baseScripIncome);
    this.buildings = new BuildingSystem(this, this.map, this.resources);
    this.units = new UnitSystem(this);
    this.combat = new CombatSystem(this);
    this.production = new ProductionSystem(this);
    this.research = new ResearchSystem(this);
    this.capture = new CapturePointSystem(this);
    this.selection = new SelectionSystem(this);
    this.effects = new EffectsSystem(this);
    this.placement = new BuildingPlacementUI(this, this.buildings);

    const { playerBase, enemyBase } = this.map.def;
    const hq = this.buildings.spawn('stronghold', 'player', playerBase.tx, playerBase.ty, true);
    const hive = this.buildings.spawn('hive', 'enemy', enemyBase.tx, enemyBase.ty, true);
    this.production.spawnFrom(hq, 'commander');
    this.production.spawnFrom(hq, 'rifleman');
    hive.rally = { x: hive.x - 120, y: hive.y + 160 };
    this.production.spawnFrom(hive, 'crawler');

    this.cameraSystem = new CameraSystem(this, this.map.worldWidth, this.map.worldHeight);
    this.cameraSystem.centerOn(hq.x + 200, hq.y - 100);
    this.inputController = new InputController(this);

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
    this.production.update(dt);
    this.research.update(dt);
    this.units.update(dt);
    this.combat.update(dt);
    this.capture.update(dt);
    this.selection.prune();
    this.cameraSystem.update(dt);
    this.inputController.update();
  }
}
