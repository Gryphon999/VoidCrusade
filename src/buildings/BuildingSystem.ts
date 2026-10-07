import Phaser from 'phaser';
import { BUILD, RESOURCES, TILE_SIZE } from '../config';
import { EV } from '../events';
import type { MessageKey } from '../i18n';
import { roleName } from '../i18n/names';
import { Owner } from '../types';
import { MapSystem } from '../systems/MapSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { Building } from './Building';
import { BUILDING_DEFS, BuildingId, BuildingRole } from './BuildingDefs';

export interface PlacementCheck {
  ok: boolean;
  /** Translation key explaining why placement is invalid. */
  reason?: MessageKey;
  params?: Record<string, string>;
}

/** Owns every building on the field: placement rules, construction, damage and destruction. */
export class BuildingSystem {
  readonly buildings: Building[] = [];
  /** Tile indices where nothing may be built (capture zones). */
  readonly reserved = new Set<number>();
  /** Per-owner construction speed multiplier. */
  buildSpeed: Record<Owner, number> = { player: 1, enemy: 1 };
  /** Damage multiplier for every structure (attrition in long battles, set by the victory rules). */
  wear = 1;
  /** Current tech tier per owner (wired to TechSystem by the battle). */
  tierOf: (owner: Owner) => number = () => 3;
  /** Forward-base points an owner holds (wired by the battle). */
  forwardBases?: (owner: Owner) => { x: number; y: number }[];
  /** Capture point whose zone contains a world point (wired by the battle). */
  pointAt?: (x: number, y: number) => { x: number; y: number; owner: Owner | null } | null;

  constructor(
    private scene: Phaser.Scene,
    private map: MapSystem,
    private resources: ResourceSystem,
  ) {}

  /** Creates a building without cost checks (used for starting HQs and by tryPlace). */
  spawn(id: BuildingId, owner: Owner, tx: number, ty: number, instant = false, rot = 0): Building {
    const def = BUILDING_DEFS[id];
    const b = new Building(this.scene, def, owner, tx, ty, instant, rot);
    this.buildings.push(b);
    this.map.setOccupied(tx, ty, def.size, def.size, true, def.gate ? owner : undefined);
    if (b.isReady) this.onComplete(b, false);
    this.scene.events.emit(EV.buildingPlaced, b);
    return b;
  }

  /** Snaps a world position to the placement grid for a building of the given size. */
  snap(wx: number, wy: number, id: BuildingId): { tx: number; ty: number } {
    const def = BUILDING_DEFS[id];
    const size = def.size;
    const grid = def.snap ?? BUILD.grid;
    if (grid < size) {
      // Fine grid: centre the footprint on the cursor.
      return { tx: Math.round(wx / TILE_SIZE - size / 2), ty: Math.round(wy / TILE_SIZE - size / 2) };
    }
    const off = Math.floor((grid - size) / 2);
    const cx = Math.floor(wx / TILE_SIZE / grid) * grid;
    const cy = Math.floor(wy / TILE_SIZE / grid) * grid;
    return { tx: cx + off, ty: cy + off };
  }

  /**
   * Placement rules. `field` = raised by engineers: no build radius needed (only fieldBuild structures).
   * Outposts go inside a capture zone the owner holds.
   */
  validate(owner: Owner, id: BuildingId, tx: number, ty: number, field = false): PlacementCheck {
    const def = BUILDING_DEFS[id];
    for (let y = ty; y < ty + def.size; y++) {
      for (let x = tx; x < tx + def.size; x++) {
        if (!this.map.isBuildable(x, y)) return { ok: false, reason: 'err.blocked' };
        if (this.map.isOccupied(x, y)) return { ok: false, reason: 'err.occupied' };
        if (!def.onPoint && this.reserved.has(y * this.map.width + x)) return { ok: false, reason: 'err.nexus' };
      }
    }
    if (this.crowded(def, tx, ty)) return { ok: false, reason: 'err.tooClose' };
    if (def.limit && this.buildings.filter((b) => b.alive && b.owner === owner && b.def.id === id).length >= def.limit) {
      return { ok: false, reason: 'err.maxCount', params: { n: `${def.limit}` } };
    }
    if (this.tierOf(owner) < def.tier) return { ok: false, reason: 'err.tier', params: { n: `${def.tier}` } };
    const missing = def.requires.find((r) => !this.hasRole(owner, r));
    if (missing) return { ok: false, reason: 'err.requires', params: { what: roleName(missing) } };
    const cx = tx + def.size / 2;
    const cy = ty + def.size / 2;
    if (def.onPoint) {
      const pt = this.pointAt?.(cx * TILE_SIZE, cy * TILE_SIZE);
      if (!pt || pt.owner !== owner) return { ok: false, reason: 'err.onPoint' };
      if (this.buildings.some((b) => b.alive && b.def.onPoint && Phaser.Math.Distance.Between(b.x, b.y, pt.x, pt.y) < TILE_SIZE * 3)) {
        return { ok: false, reason: 'err.pointTaken' };
      }
    } else if (!(field && def.fieldBuild)) {
      const inRange = this.buildings.some((b) => {
        if (b.owner !== owner || !b.alive) return false;
        const d = Phaser.Math.Distance.Between(cx, cy, b.tx + b.def.size / 2, b.ty + b.def.size / 2);
        return d <= b.def.buildRadius;
      }) || (this.forwardBases?.(owner) ?? []).some((p) => Phaser.Math.Distance.Between(cx, cy, p.x / TILE_SIZE, p.y / TILE_SIZE) <= RESOURCES.forwardBuildRadius);
      if (!inRange) return { ok: false, reason: 'err.outside' };
    }
    if (!this.resources.canAfford(owner, def.cost)) return { ok: false, reason: 'err.resources' };
    return { ok: true };
  }

  /** Small structures (walls, gates, mines) may touch anything; other buildings keep a lane between them. */
  private static hugs(def: { size: number; wall?: boolean; mine?: unknown }): boolean {
    return !!def.wall || !!def.mine || def.size <= 1;
  }

  /** True when a building would stand closer than BUILD.gap tiles to another one (troops need a way out). */
  private crowded(def: (typeof BUILDING_DEFS)[BuildingId], tx: number, ty: number): boolean {
    if (BuildingSystem.hugs(def)) return false;
    const g = BUILD.gap;
    return this.buildings.some((b) => b.alive && !BuildingSystem.hugs(b.def)
      && tx < b.tx + b.def.size + g && b.tx < tx + def.size + g
      && ty < b.ty + b.def.size + g && b.ty < ty + def.size + g);
  }

  /** Validates, pays for and starts constructing a building. */
  tryPlace(owner: Owner, id: BuildingId, tx: number, ty: number, field = false, rot = 0): Building | null {
    if (!this.validate(owner, id, tx, ty, field).ok) return null;
    this.resources.spend(owner, BUILDING_DEFS[id].cost);
    const b = this.spawn(id, owner, tx, ty, false, rot);
    // Outside the base, construction only advances while engineers work on it.
    if (field) b.needsBuilder = true;
    return b;
  }

  update(dt: number): void {
    for (const b of this.buildings) {
      if (!b.alive) continue;
      if (!b.needsBuilder && b.updateConstruction(dt, this.buildSpeed[b.owner])) this.onComplete(b, true);
      b.view.update(dt);
      b.sinceHit += dt;
      if (b.def.regen && b.isReady && b.sinceHit >= BUILD.regenDelay) b.heal(b.def.regen * dt);
    }
  }

  /** Called when an engineer-built site finishes (construction driven by SupportSystem). */
  completeBy(b: Building): void {
    this.onComplete(b, true);
  }

  private onComplete(b: Building, announce: boolean): void {
    b.completed = true;
    if (b.def.fluxGen > 0) this.resources.addIncome(b.owner, 'flux', b.def.fluxGen);
    if (announce) this.scene.events.emit(EV.buildingComplete, b);
  }

  /** Deals damage; handles destruction (rubble, income loss, events). */
  damage(b: Building, amount: number): void {
    if (!b.alive) return;
    const wasReady = b.isReady;
    b.sinceHit = 0;
    this.scene.events.emit(EV.buildingDamaged, b, amount);
    if (!b.takeDamage(amount * this.wear)) return;
    if (wasReady && b.def.fluxGen > 0) this.resources.removeIncome(b.owner, 'flux', b.def.fluxGen);
    // The ground stays as it was: the rubble heap burns out and clears away (WreckSystem).
    this.map.setOccupied(b.tx, b.ty, b.def.size, b.def.size, false);
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
