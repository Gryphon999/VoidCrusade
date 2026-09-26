import { MAP_H, MAP_W, TILE, TileType } from '../config';

/** Strategic (Scrip), Relic (Flux + hero XP), Forward base (build radius). */
export type PointKind = 'strategic' | 'relic' | 'forward';

export interface TilePoint {
  tx: number;
  ty: number;
}

export interface MapDef {
  id: string;
  name: string;
  tiles: number[][];
  playerBase: TilePoint; // top-left tile of the stronghold footprint
  enemyBase: TilePoint;
  /** Capture point centers in tile units (may be fractional). */
  /** Capture point centres in tiles; `kind` overrides the default layout (centre = relic, next two = forward bases). */
  capturePoints: { x: number; y: number; kind?: PointKind }[];
}

/**
 * Helper for hand-authoring point-symmetric maps: paint the player half,
 * then mirror() copies it rotated 180 degrees so both sides are fair.
 */
export class MapBuilder {
  readonly tiles: number[][];

  constructor(fill: TileType = TILE.GROUND) {
    this.tiles = [];
    for (let y = 0; y < MAP_H; y++) this.tiles.push(new Array<number>(MAP_W).fill(fill));
  }

  set(x: number, y: number, t: TileType): this {
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) this.tiles[y][x] = t;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, t: TileType): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, t);
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, t: TileType): this {
    for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++) {
      for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
        const dx = (i + 0.5 - cx) / rx;
        const dy = (j + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(i, j, t);
      }
    }
    return this;
  }

  /** Thick line of tiles (Bresenham-ish sampling). */
  line(x0: number, y0: number, x1: number, y1: number, t: TileType, thickness = 1, onlyOver?: TileType): this {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / steps);
      const y = Math.round(y0 + ((y1 - y0) * s) / steps);
      for (let j = 0; j < thickness; j++) {
        for (let i = 0; i < thickness; i++) {
          const px = x + i;
          const py = y + j;
          if (onlyOver !== undefined && this.get(px, py) !== onlyOver) continue;
          this.set(px, py, t);
        }
      }
    }
    return this;
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return TILE.CLIFF;
    return this.tiles[y][x];
  }

  border(t: TileType = TILE.CLIFF): this {
    this.rect(0, 0, MAP_W, 1, t).rect(0, MAP_H - 1, MAP_W, 1, t);
    this.rect(0, 0, 1, MAP_H, t).rect(MAP_W - 1, 0, 1, MAP_H, t);
    return this;
  }

  /** Copies the bottom-left half (below the TL->BR diagonal) onto its 180-degree mirror. */
  mirror(): this {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (y / (MAP_H - 1) > x / (MAP_W - 1)) this.tiles[MAP_H - 1 - y][MAP_W - 1 - x] = this.tiles[y][x];
      }
    }
    return this;
  }

  build(): number[][] {
    return this.tiles.map((r) => r.slice());
  }
}

/** Mirrors a player-side tile position to the enemy side for a footprint of size n. */
export function mirrorTile(p: TilePoint, size: number): TilePoint {
  return { tx: MAP_W - p.tx - size, ty: MAP_H - p.ty - size };
}

export function mirrorPoint(p: { x: number; y: number }): { x: number; y: number } {
  return { x: MAP_W - p.x, y: MAP_H - p.y };
}
