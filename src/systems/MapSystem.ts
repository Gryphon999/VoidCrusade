import Phaser from 'phaser';
import { TERRAIN, TILE, TILE_SIZE, TerrainRule, TileType } from '../config';
import { canStepLevels } from '../battle/Elevation';
import { MapDef } from '../maps/MapBuilder';
import { TerrainRenderer } from '../render/TerrainRenderer';
import { Owner } from '../types';

/** Owns the battle terrain: tile data, rendering, and passability queries. */
export class MapSystem {
  readonly def: MapDef;
  /** Size in tiles and in world px; every map has its own. */
  readonly width: number;
  readonly height: number;
  readonly worldWidth: number;
  readonly worldHeight: number;
  private tiles: number[][];
  /** Ground level per tile (0 low, 1 high); null on a flat map. */
  private levels: number[][] | null;
  /** Tiles occupied by buildings (blocks movement). */
  private occupied: Uint8Array;
  /** Tiles blocked by wrecks (counter, so overlapping wrecks stack). */
  private blocked: Uint8Array;
  private terrain?: TerrainRenderer;

  constructor(def: MapDef) {
    this.def = def;
    this.tiles = def.tiles.map((r) => r.slice());
    this.levels = def.levels ? def.levels.map((r) => r.slice()) : null;
    this.width = def.w;
    this.height = def.h;
    this.worldWidth = def.w * TILE_SIZE;
    this.worldHeight = def.h * TILE_SIZE;
    this.occupied = new Uint8Array(def.w * def.h);
    this.blocked = new Uint8Array(def.w * def.h);
  }

  /** Bakes the projected terrain. */
  render(scene: Phaser.Scene): void {
    this.terrain = new TerrainRenderer(scene, this);
  }

  /** Repaints any tiles changed this frame. */
  flushRender(): void {
    this.terrain?.flush();
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  getTile(tx: number, ty: number): TileType {
    if (!this.inBounds(tx, ty)) return TILE.CLIFF;
    return this.tiles[ty][tx] as TileType;
  }

  /** Changes a tile at runtime (e.g. building rubble) and refreshes the render. */
  setTile(tx: number, ty: number, t: TileType): void {
    if (!this.inBounds(tx, ty)) return;
    this.tiles[ty][tx] = t;
    this.terrain?.markDirty(tx, ty);
  }

  /** Terrain-only passability: cliffs are impassable. */
  isTerrainPassable(tx: number, ty: number): boolean {
    return this.inBounds(tx, ty) && this.tiles[ty][tx] !== TILE.CLIFF;
  }

  /** The gameplay rule of a tile (cliff outside the map). */
  rule(tx: number, ty: number): TerrainRule {
    return TERRAIN[this.getTile(tx, ty)];
  }

  /** Vehicles may drive here (open ground that is not water). */
  isVehicleTerrain(tx: number, ty: number): boolean {
    return this.isTerrainPassable(tx, ty) && this.rule(tx, ty).vehicles;
  }

  /** Structures may stand here. */
  isBuildable(tx: number, ty: number): boolean {
    return this.isTerrainPassable(tx, ty) && this.rule(tx, ty).buildable;
  }

  /** Movement speed factor of the terrain under a world point. */
  speedAt(wx: number, wy: number): number {
    const t = this.worldToTile(wx, wy);
    return this.rule(t.tx, t.ty).speed;
  }

  /** Rule of the terrain under a world point. */
  ruleAt(wx: number, wy: number): TerrainRule {
    const t = this.worldToTile(wx, wy);
    return this.rule(t.tx, t.ty);
  }

  /** Ground level of a tile: 0 low, 1 high (0 outside the map and on flat maps). */
  level(tx: number, ty: number): number {
    return this.levels && this.inBounds(tx, ty) ? this.levels[ty][tx] : 0;
  }

  levelAt(wx: number, wy: number): number {
    const t = this.worldToTile(wx, wy);
    return this.level(t.tx, t.ty);
  }

  isRamp(tx: number, ty: number): boolean {
    return this.getTile(tx, ty) === TILE.RAMP;
  }

  /** A unit may walk from tile a to tile b: same level, or one of them is a ramp. */
  canStep(ax: number, ay: number, bx: number, by: number): boolean {
    return !this.levels || canStepLevels(this.level(ax, ay), this.level(bx, by), this.isRamp(ax, ay), this.isRamp(bx, by));
  }

  /** Does the map have any high ground at all? */
  get hasLevels(): boolean {
    return this.levels !== null;
  }

  /** Passable for units: not a cliff and not covered by a building (own gates are open to `owner`). */
  isPassable(tx: number, ty: number, owner?: Owner): boolean {
    if (!this.isTerrainPassable(tx, ty) || this.blocked[ty * this.width + tx] !== 0) return false;
    const o = this.occupied[ty * this.width + tx];
    return o === 0 || (!!owner && ((o === 2 && owner === 'player') || (o === 3 && owner === 'enemy')));
  }

  isPassableWorld(wx: number, wy: number, owner?: Owner): boolean {
    const t = this.worldToTile(wx, wy);
    return this.isPassable(t.tx, t.ty, owner);
  }

  isOccupied(tx: number, ty: number): boolean {
    return !this.inBounds(tx, ty) || this.occupied[ty * this.width + tx] !== 0 || this.blocked[ty * this.width + tx] !== 0;
  }

  /** Adds/removes a wreck blocker on one tile. */
  setBlocked(tx: number, ty: number, on: boolean): void {
    if (!this.inBounds(tx, ty)) return;
    const i = ty * this.width + tx;
    this.blocked[i] = Math.max(0, this.blocked[i] + (on ? 1 : -1));
  }

  isBlocked(tx: number, ty: number): boolean {
    return this.inBounds(tx, ty) && this.blocked[ty * this.width + tx] !== 0;
  }

  /** Marks a building footprint; a gate's footprint stays passable for `gateOwner`'s units. */
  setOccupied(tx: number, ty: number, w: number, h: number, value: boolean, gateOwner?: Owner): void {
    const v = !value ? 0 : gateOwner === 'player' ? 2 : gateOwner === 'enemy' ? 3 : 1;
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (this.inBounds(x, y)) this.occupied[y * this.width + x] = v;
      }
    }
  }

  /** True if the tile is a gate owned by `owner`. */
  isGateFor(tx: number, ty: number, owner: Owner): boolean {
    if (!this.inBounds(tx, ty)) return false;
    const o = this.occupied[ty * this.width + tx];
    return (o === 2 && owner === 'player') || (o === 3 && owner === 'enemy');
  }

  worldToTile(wx: number, wy: number): { tx: number; ty: number } {
    return { tx: Math.floor(wx / TILE_SIZE), ty: Math.floor(wy / TILE_SIZE) };
  }

  /** Returns the world-space center of a tile. */
  tileToWorld(tx: number, ty: number): { x: number; y: number } {
    return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
  }

  /** Raw copy of the terrain grid (used by mini-map and pathfinding). */
  getTiles(): readonly (readonly number[])[] {
    return this.tiles;
  }
}
