import Phaser from 'phaser';
import { MAP_H, MAP_W, TILE, TILE_SIZE, TileType } from '../config';
import { MapDef } from '../maps/MapBuilder';
import { TerrainRenderer } from '../render/TerrainRenderer';

/** Owns the battle terrain: tile data, rendering, and passability queries. */
export class MapSystem {
  readonly def: MapDef;
  readonly width = MAP_W;
  readonly height = MAP_H;
  readonly worldWidth = MAP_W * TILE_SIZE;
  readonly worldHeight = MAP_H * TILE_SIZE;
  private tiles: number[][];
  /** Tiles occupied by buildings (blocks movement). */
  private occupied: Uint8Array;
  /** Tiles blocked by wrecks (counter, so overlapping wrecks stack). */
  private blocked: Uint8Array;
  private terrain?: TerrainRenderer;

  constructor(def: MapDef) {
    this.def = def;
    this.tiles = def.tiles.map((r) => r.slice());
    this.occupied = new Uint8Array(MAP_W * MAP_H);
    this.blocked = new Uint8Array(MAP_W * MAP_H);
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
    return tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
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

  /** Passable for units: not a cliff and not covered by a building. */
  isPassable(tx: number, ty: number): boolean {
    return this.isTerrainPassable(tx, ty) && this.occupied[ty * MAP_W + tx] === 0 && this.blocked[ty * MAP_W + tx] === 0;
  }

  isPassableWorld(wx: number, wy: number): boolean {
    const t = this.worldToTile(wx, wy);
    return this.isPassable(t.tx, t.ty);
  }

  isOccupied(tx: number, ty: number): boolean {
    return !this.inBounds(tx, ty) || this.occupied[ty * MAP_W + tx] !== 0 || this.blocked[ty * MAP_W + tx] !== 0;
  }

  /** Adds/removes a wreck blocker on one tile. */
  setBlocked(tx: number, ty: number, on: boolean): void {
    if (!this.inBounds(tx, ty)) return;
    const i = ty * MAP_W + tx;
    this.blocked[i] = Math.max(0, this.blocked[i] + (on ? 1 : -1));
  }

  isBlocked(tx: number, ty: number): boolean {
    return this.inBounds(tx, ty) && this.blocked[ty * MAP_W + tx] !== 0;
  }

  setOccupied(tx: number, ty: number, w: number, h: number, value: boolean): void {
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (this.inBounds(x, y)) this.occupied[y * MAP_W + x] = value ? 1 : 0;
      }
    }
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
