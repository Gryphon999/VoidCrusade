import Phaser from 'phaser';
import { BUILD, TILE, TILE_SIZE } from '../config';
import { EV } from '../events';
import { Owner } from '../types';
import { MapSystem } from '../systems/MapSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { Building } from './Building';
import { BUILDING_DEFS, BuildingId, BuildingRole } from './BuildingDefs';

export interface PlacementCheck {
  ok: boolean;
  reason?: string;
}

/** Owns every building on the field: placement rules, construction, damage and destruction. */
export class BuildingSystem {
  readonly buildings: Building[] = [];
  /** Tile indices where nothing may be built (capture zones). */
  readonly reserved = new Set<number>();
  /** Per-owner construction speed multiplier. */
  buildSpeed: Record<Owner, number> = { player: 1, enemy: 1 };

  constructor(
    private scene: Phaser.Scene,
    private map: MapSystem,
    private resources: ResourceSystem,
  ) {}

  /** Creates a building without cost checks (used for starting HQs and by tryPlace). */
  spawn(id: BuildingId, owner: Owner, tx: number, ty: number, instant = false): Building {
    const def = BUILDING_DEFS[id];
    const b = new Building(this.scene, def, owner, tx, ty, instant);
    this.buildings.push(b);
    this.map.setOccupied(tx, ty, def.size, def.size, true);
    if (b.isReady) this.onComplete(b, false);
    this.scene.events.emit(EV.buildingPlaced, b);
    return b;
  }

  /** Snaps a world position to the placement grid for a building of the given size. */
  snap(wx: number, wy: number, id: BuildingId): { tx: number; ty: number } {
    const size = BUILDING_DEFS[id].size;
    const off = Math.floor((BUILD.snap - size) / 2);
    const cx = Math.floor(wx / TILE_SIZE / BUILD.snap) * BUILD.snap;
    const cy = Math.floor(wy / TILE_SIZE / BUILD.snap) * BUILD.snap;
    return { tx: cx + off, ty: cy + off };
  }

  validate(owner: Owner, id: BuildingId, tx: number, ty: number): PlacementCheck {
    const def = BUILDING_DEFS[id];
    for (let y = ty; y < ty + def.size; y++) {
      for (let x = tx; x < tx + def.size; x++) {
        if (!this.map.isTerrainPassable(x, y)) return { ok: false, reason: 'Blocked terrain' };
        if (this.map.isOccupied(x, y)) return { ok: false, reason: 'Space occupied' };
        if (this.reserved.has(y * this.map.width + x)) return { ok: false, reason: 'Too close to a Void-Nexus' };
      }
    }
    const missing = def.requires.find((r) => !this.hasRole(owner, r));
    if (missing) return { ok: false, reason: `Requires ${missing} building` };
    const cx = tx + def.size / 2;
    const cy = ty + def.size / 2;
    const inRange = this.buildings.some((b) => {
      if (b.owner !== owner || !b.alive) return false;
      const d = Phaser.Math.Distance.Between(cx, cy, b.tx + b.def.size / 2, b.ty + b.def.size / 2);
      return d <= b.def.buildRadius;
    });
    if (!inRange) return { ok: false, reason: 'Outside buildable area' };
    if (!this.resources.canAfford(owner, def.cost)) return { ok: false, reason: 'Not enough resources' };
    return { ok: true };
  }

  /** Validates, pays for and starts constructing a building. */
  tryPlace(owner: Owner, id: BuildingId, tx: number, ty: number): Building | null {
    if (!this.validate(owner, id, tx, ty).ok) return null;
    this.resources.spend(owner, BUILDING_DEFS[id].cost);
    return this.spawn(id, owner, tx, ty, false);
  }

  update(dt: number): void {
    for (const b of this.buildings) {
      if (!b.alive) continue;
      if (b.updateConstruction(dt, this.buildSpeed[b.owner])) this.onComplete(b, true);
      b.view.update(dt);
      if (b.def.regen && b.isReady) b.heal(b.def.regen * dt);
    }
  }

  private onComplete(b: Building, announce: boolean): void {
    if (b.def.fluxGen > 0) this.resources.addIncome(b.owner, 'flux', b.def.fluxGen);
    if (announce) this.scene.events.emit(EV.buildingComplete, b);
  }

  /** Deals damage; handles destruction (rubble, income loss, events). */
  damage(b: Building, amount: number): void {
    if (!b.alive) return;
    const wasReady = b.isReady;
    this.scene.events.emit(EV.buildingDamaged, b, amount);
    if (!b.takeDamage(amount)) return;
    if (wasReady && b.def.fluxGen > 0) this.resources.removeIncome(b.owner, 'flux', b.def.fluxGen);
    this.map.setOccupied(b.tx, b.ty, b.def.size, b.def.size, false);
    for (let y = b.ty; y < b.ty + b.def.size; y++) {
      for (let x = b.tx; x < b.tx + b.def.size; x++) this.map.setTile(x, y, TILE.RUINS);
    }
    this.scene.events.emit(EV.buildingDestroyed, b);
    b.destroy();
    const idx = this.buildings.indexOf(b);
    if (idx >= 0) this.buildings.splice(idx, 1);
  }

  /** Front-most building whose drawn volume covers a view-space point. */
  buildingAtView(vx: number, vy: number): Building | undefined {
    let best: Building | undefined;
    for (const b of this.buildings) {
      if (!b.alive || !b.view.viewBounds().contains(vx, vy)) continue;
      if (!best || b.view.depth > best.view.depth) best = b;
    }
    return best;
  }

  buildingAt(wx: number, wy: number): Building | undefined {
    return this.buildings.find((b) => b.alive && b.containsPoint(wx, wy));
  }

  getOwned(owner: Owner): Building[] {
    return this.buildings.filter((b) => b.owner === owner && b.alive);
  }

  hasRole(owner: Owner, role: BuildingRole, readyOnly = true): boolean {
    return this.buildings.some((b) => b.owner === owner && b.def.role === role && (readyOnly ? b.isReady : b.alive));
  }

  countRole(owner: Owner, role: BuildingRole): number {
    return this.buildings.filter((b) => b.owner === owner && b.def.role === role && b.alive).length;
  }

  getHQ(owner: Owner): Building | undefined {
    return this.buildings.find((b) => b.owner === owner && b.def.role === 'hq' && b.alive);
  }
}
