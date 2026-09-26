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
import { TechSystem } from '../systems/TechSystem';
import { Faction } from '../units/UnitDefs';
import { CapturePointSystem } from '../systems/CapturePointSystem';
import { AIController } from '../ai/AIController';
import { Battle3D } from '../render3d/Battle3D';
import { Stage3D } from '../render3d/Stage3D';
import { FogOfWarSystem } from '../systems/FogOfWarSystem';
import { AudioBridge } from '../systems/AudioBridge';
import { CoverSystem } from '../systems/CoverSystem';
import { ModifierTable, defaultModifiers } from '../systems/Modifiers';
import { BuildingSystem } from '../buildings/BuildingSystem';
import { BuildingPlacementUI } from '../buildings/BuildingPlacementUI';
import { UnitSystem } from '../units/UnitSystem';
import { CombatSystem } from '../units/CombatSystem';
import { SupportSystem } from '../units/SupportSystem';
import { VehicleSystem } from '../units/VehicleSystem';
import { WreckSystem } from '../units/WreckSystem';
import { StructureSystem } from '../buildings/StructureSystem';
import { AbilitySystem } from '../units/AbilitySystem';
import { MoraleSystem } from '../units/MoraleSystem';
import { WorldSystem } from '../systems/WorldSystem';
import { DropSystem } from '../systems/DropSystem';
import { VictorySystem } from '../systems/VictorySystem';
import { TutorialDirector } from '../tutorial/TutorialDirector';
import { buildTutorialMap } from '../maps/tutorialMap';
import { applyWargear, defaultPick, randomPick } from '../campaign/Wargear';
import { Unit } from '../units/Unit';
import { Squad } from '../units/Squad';
import { RESOURCES, SUPPLY } from '../config';
import { BattleData, BattleResult, BattleStats } from './BattleTypes';
import { EV } from '../events';
import { Building } from '../buildings/Building';
import { Owner, opponent } from '../types';
import { EffectsSystem } from '../effects/EffectsSystem';
import { Projection } from '../render/Projection';
import { Settings } from '../systems/Settings';
import { PropSystem } from '../render/PropSystem';
import { Atmosphere } from '../render/Atmosphere';
import { Culler } from '../render/Culler';
import { VoiceBridge } from '../systems/VoiceBridge';
import type { HudScene } from './HudScene';

export type { BattleData } from './BattleTypes';

/** Cover/LOS queries (implemented by CoverSystem). */
export interface CoverQueries {
  hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean;
  blockPoint(x0: number, y0: number, x1: number, y1: number): { x: number; y: number } | null;
  damageMultiplier(u: Unit): number;
  seekCover(s: Squad): void;
}

/** Fog-of-war queries (implemented by FogOfWarSystem). */
export interface FogQueries {
  isVisibleWorld(x: number, y: number): boolean;
  forEachCell(cb: (x: number, y: number, w: number, h: number, alpha: number) => void): void;
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
  support!: SupportSystem;
  vehicles!: VehicleSystem;
  wrecks!: WreckSystem;
  structures!: StructureSystem;
  abilities!: AbilitySystem;
  morale!: MoraleSystem;
  world!: WorldSystem;
  drops!: DropSystem;
  victory!: VictorySystem;
  tutorial: TutorialDirector | null = null;
  /** Sides driven by the AI (abilities autocast, etc.). */
  aiOwners: Owner[] = ['enemy'];
  /** True when the battlefield is drawn by the 3D renderer (see src/render3d). */
  render3d = false;
  r3d: Battle3D | null = null;
  props!: PropSystem;
  production!: ProductionSystem;
  research!: ResearchSystem;
  tech!: TechSystem;
  /** Which faction each side plays. */
  factions: Record<Owner, Faction> = { player: 'ironvoid', enemy: 'nullhorde' };
  capture!: CapturePointSystem;
  ai!: AIController;
  modifiers!: ModifierTable;
  cover?: CoverSystem;
  fog?: FogOfWarSystem;
  audio!: AudioBridge;
  atmosphere!: Atmosphere;
  effects!: EffectsSystem;
  hud!: HudScene;
  elapsed = 0;
  battleData!: BattleData;
  stats!: BattleStats;
  result: BattleResult | null = null;

  constructor() {
    super('BattleScene');
  }

  create(data: BattleData): void {
    this.elapsed = 0;
    this.battleData = data;
    this.result = null;
    this.stats = { kills: 0, losses: 0, buildingsLost: 0, buildingsDestroyed: 0 };
    this.modifiers = { player: defaultModifiers(), enemy: defaultModifiers() };
    const bonus = data.bonuses;
    if (bonus) {
      Object.assign(this.modifiers.player, {
        hpMult: bonus.hpMult, damageMult: bonus.damageMult, turretDamageMult: bonus.turretDamageMult,
        squadSizeBonus: bonus.squadSizeBonus, supplyBonus: bonus.maxSquadsBonus * SUPPLY.perSquadSlot, buildSpeedMult: bonus.buildSpeedMult,
      });
    }
    // Hero wargear: the player's pick, a random loadout for the AI hero.
    applyWargear(data.wargear ?? defaultPick(this.factions.player), this.modifiers.player);
    applyWargear(randomPick(this.factions.enemy), this.modifiers.enemy);
    Projection.setTilt(Settings.get().tilt);
    const tutorial = data.mode === 'tutorial';
    // 3D battlefield (Three.js under a transparent Phaser canvas) unless unsupported or turned off.
    this.render3d = Stage3D.wanted();
    // Create the WebGL2 context before any world object exists; on failure fall back to 2D.
    if (this.render3d) {
      try {
        Stage3D.attach(this.game);
      } catch (e) {
        console.warn('3D renderer unavailable, using 2D:', e);
        this.render3d = false;
      }
    }
    this.map = new MapSystem(tutorial ? buildTutorialMap() : getMap(data.mapIndex ?? 0));
    this.cameras.main.setBackgroundColor(this.render3d ? 'rgba(0,0,0,0)' : 0x07060a);
    this.map.render(this);
    this.pathfinder = new Pathfinder(this.map);
    this.cover = new CoverSystem(this);
    this.resources = new ResourceSystem({
      player: { scrip: RESOURCES.startScrip + (bonus?.startScrip ?? 0), flux: RESOURCES.startFlux + (bonus?.startFlux ?? 0) },
      enemy: { scrip: RESOURCES.startScrip + (data.enemyBonusScrip ?? 0) },
    });
    this.resources.addIncome('player', 'scrip', RESOURCES.baseScripIncome);
    this.resources.addIncome('enemy', 'scrip', RESOURCES.baseScripIncome);
    this.buildings = new BuildingSystem(this, this.map, this.resources);
    this.buildings.buildSpeed.player = this.modifiers.player.buildSpeedMult;
    this.units = new UnitSystem(this);
    this.combat = new CombatSystem(this);
    this.support = new SupportSystem(this);
    this.vehicles = new VehicleSystem(this);
    this.production = new ProductionSystem(this);
    this.research = new ResearchSystem(this);
    this.tech = new TechSystem(this, this.factions);
    this.buildings.tierOf = (o) => this.tech.tierOf(o);
    this.capture = new CapturePointSystem(this);
    this.props = new PropSystem(this, this.map.def.id.length * 7919 + (data.mapIndex ?? 0));
    this.world = new WorldSystem(this, this.map.def.id.length * 131 + (data.mapIndex ?? 0), !!data.ashStorms);
    this.selection = new SelectionSystem(this);
    this.effects = new EffectsSystem(this);
    this.wrecks = new WreckSystem(this);
    this.structures = new StructureSystem(this);
    this.abilities = new AbilitySystem(this);
    this.morale = new MoraleSystem(this);
    this.drops = new DropSystem(this);
    this.buildings.pointAt = (x, y) => this.capture.points.find((p) => p.contains(x, y)) ?? null;
    this.buildings.forwardBases = (o) => this.capture.points.filter((p) => p.kind === 'forward' && p.owner === o);
    this.placement = new BuildingPlacementUI(this, this.buildings, (x, y) => this.cameraSystem.screenToWorld(x, y));

    const { playerBase, enemyBase } = this.map.def;
    const hq = this.buildings.spawn('stronghold', 'player', playerBase.tx, playerBase.ty, true);
    this.victory = new VictorySystem(this, data.winMode);
    const survival = this.victory.mode === 'survival';
    hq.rally = { x: hq.x + 230, y: hq.y - 80 };
    this.production.spawnFrom(hq, 'commander');
    this.production.spawnFrom(hq, 'rifleman');
    if (tutorial) this.production.spawnFrom(hq, 'rifleman');
    // Survival has no Horde base: waves come from its corner instead; the tutorial has a small outpost.
    if (tutorial) {
      TutorialDirector.setupOutpost(this);
    } else if (!survival) {
      const hive = this.buildings.spawn('hive', 'enemy', enemyBase.tx, enemyBase.ty, true);
      hive.rally = { x: hive.x - 120, y: hive.y + 160 };
      this.production.spawnFrom(hive, 'overlord');
      this.production.spawnFrom(hive, 'crawler');
    }
    this.ai = new AIController(this, data.difficulty ?? 'normal', data.personality);
    this.tutorial = null;
    if (tutorial) {
      this.ai.enabled = false;
      this.aiOwners = [];
      this.tutorial = new TutorialDirector(this);
    }
    this.r3d = this.render3d ? new Battle3D(this) : null;
    this.fog = new FogOfWarSystem(this);
    this.audio = new AudioBridge(this);
    this.atmosphere = new Atmosphere(this);
    new VoiceBridge(this);

    this.cameraSystem = new CameraSystem(this, this.map.worldWidth, this.map.worldHeight);
    this.cameraSystem.centerOn(hq.x + 200, hq.y - 100);
    // Opening shot: from high over the battlefield down to the base (not in the tutorial,
    // whose first lesson is moving the camera).
    if (data.mode !== 'tutorial' && Settings.get().cinematics !== false) {
      // Start high above the base (explored ground, not black fog) and swoop down onto it.
      this.cameras.main.setZoom(0.6);
      this.cameraSystem.centerOn(hq.x + 60, hq.y - 260);
      this.cameraSystem.flyTo(hq.x + 200, hq.y - 100, 1, 2600);
    }
    this.inputController = new InputController(this);

    this.events.on(EV.buildingDestroyed, (b: Building) => {
      this.production.cancelAll(b);
      if (b.owner === 'player') this.stats.buildingsLost++;
      else this.stats.buildingsDestroyed++;
      if (b.def.role === 'hq') {
        // Final shot: push in slowly on the fallen stronghold.
        if (!this.result && Settings.get().cinematics !== false) this.cameraSystem.flyTo(b.x, b.y, 1.35, 2200);
        this.endBattle(opponent(b.owner));
      }
    });
    this.events.on(EV.unitDied, (_x: number, _y: number, u: Unit) => {
      if (u.owner === 'player') this.stats.losses++;
      else this.stats.kills++;
    });

    this.scene.launch('HudScene', { battle: this });
    this.tutorial?.start();
    if (data.mode === 'skirmish') this.time.delayedCall(2500, () => this.ai.announce());
    this.hud = this.scene.get('HudScene') as HudScene;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // Scene events survive a restart, so drop every gameplay listener registered this battle.
      for (const e of Object.values(EV)) this.events.removeAllListeners(e);
      this.r3d?.dispose();
      this.r3d = null;
      this.cameraSystem.destroy();
      this.inputController.destroy();
      this.scene.stop('HudScene');
    });
  }

  /** Can `owner` see a logical point? The player uses the fog; the AI sees only what its own units and buildings see. */
  fogVisibleFor(owner: Owner, x: number, y: number): boolean {
    if (owner === 'player') return this.fog ? this.fog.isVisibleWorld(x, y) : true;
    const mult = this.world?.visionMult ?? 1;
    return this.units.squads.some((s) => s.owner === owner && s.alive
      && Math.hypot(s.center.x - x, s.center.y - y) <= s.def.sight * mult)
      || this.buildings.buildings.some((b) => b.owner === owner && b.alive
        && Math.hypot(b.x - x, b.y - y) <= (b.def.vision ?? 200) + b.radius);
  }

  get ended(): boolean {
    return this.result !== null;
  }

  endBattle(winner: Owner): void {
    if (this.result) return;
    this.result = { winner, time: this.elapsed, stats: { ...this.stats }, data: this.battleData };
    this.selection.clear();
    this.placement.cancel();
    this.events.emit(EV.battleEnded, this.result);
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    if (this.ended) {
      this.cameraSystem.update(dt);
      Culler.for(this).update();
      return;
    }
    this.elapsed += dt;
    this.resources.tick(dt);
    this.buildings.update(dt);
    this.production.update(dt);
    this.research.update(dt);
    this.tech.update(dt);
    this.units.update(dt);
    this.combat.update(dt);
    this.support.update(dt);
    this.vehicles.update(dt);
    this.wrecks.update();
    this.structures.update(dt);
    this.abilities.update(dt);
    this.morale.update(dt);
    this.world.update(dt);
    this.victory.update(dt);
    this.tutorial?.update();
    this.cover?.update(dt);
    this.capture.update(dt);
    this.ai.update(dt);
    this.fog?.update(dt);
    this.audio.update(dt);
    this.effects.update(dt);
    this.atmosphere.update();
    this.selection.prune();
    this.cameraSystem.update(dt);
    Culler.for(this).update();
    this.map.flushRender();
    if (this.placement.isActive) {
      const p = this.input.activePointer;
      const w = this.cameraSystem.screenToWorld(p.x, p.y);
      this.placement.updatePointer(w.x, w.y);
    }
    this.inputController.update();
  }
}
