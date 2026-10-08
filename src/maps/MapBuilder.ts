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
  /** Size in tiles. */
  w: number;
  h: number;
  tiles: number[][];
  /** Ground level per tile (0 low, 1 high); absent = all low. Ramps (TILE.RAMP) are the only way between levels. */
  levels?: number[][];
  playerBase: TilePoint; // top-left tile of the stronghold footprint
  enemyBase: TilePoint;
  /** Capture point centres in tiles; `kind` overrides the default layout (centre = relic, next two = forward bases). */
  capturePoints: { x: number; y: number; kind?: PointKind }[];
}

/**
 * Helper for hand-authoring point-symmetric maps: paint the player half,
 * then mirror() copies it rotated 180 degrees so both sides are fair.
 *
 * Shapes are given in design units; `scale` turns them into tiles, so a layout drawn for a
 * small map can be built larger without redrawing it. `w` and `h` are the size in tiles.
 */
export class MapBuilder {
  readonly tiles: number[][];
  /** Ground level per tile; raised by raise()/raiseEllipse(), entered through ramp(). */
  readonly levels: number[][];
  private raised = false;

  constructor(fill: TileType = TILE.GROUND, readonly w: number = MAP_W, readonly h: number = MAP_H, readonly scale = 1) {
    this.tiles = [];
    this.levels = [];
    for (let y = 0; y < h; y++) {
      this.tiles.push(new Array<number>(w).fill(fill));
      this.levels.push(new Array<number>(w).fill(0));
    }
  }

  /** Raises a rectangle (design units) to high ground. */
  raise(x: number, y: number, w: number, h: number): this {
    const k = this.scale;
    for (let j = Math.round(y * k); j < Math.round((y + h) * k); j++) {
      for (let i = Math.round(x * k); i < Math.round((x + w) * k); i++) this.setLevel(i, j, 1);
    }
    return this;
  }

  /** Raises an ellipse (design units) to high ground. */
  raiseEllipse(cx: number, cy: number, rx: number, ry: number): this {
    const k = this.scale;
    const [X, Y, RX, RY] = [cx * k, cy * k, rx * k, ry * k];
    for (let j = Math.floor(Y - RY); j <= Math.ceil(Y + RY); j++) {
      for (let i = Math.floor(X - RX); i <= Math.ceil(X + RX); i++) {
        const dx = (i + 0.5 - X) / RX;
        const dy = (j + 0.5 - Y) / RY;
        if (dx * dx + dy * dy <= 1) this.setLevel(i, j, 1);
      }
    }
    return this;
  }

  /**
   * A ramp (design units): its tiles become RAMP on high ground, so a rectangle laid across a
   * plateau's edge joins the two levels; it cuts through any cliff in its way. Make it at least two
   * tiles wide for vehicles.
   */
  ramp(x: number, y: number, w: number, h: number): this {
    const k = this.scale;
    for (let j = Math.round(y * k); j < Math.round((y + h) * k); j++) {
      for (let i = Math.round(x * k); i < Math.round((x + w) * k); i++) {
        this.set(i, j, TILE.RAMP);
        this.setLevel(i, j, 1);
      }
    }
    return this;
  }

  private setLevel(x: number, y: number, level: number): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) {
      this.levels[y][x] = level;
      if (level) this.raised = true;
    }
  }

  /** Writes one tile (tile coordinates, not design units). */
  set(x: number, y: number, t: TileType): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.tiles[y][x] = t;
    return this;
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return TILE.CLIFF;
    return this.tiles[y][x];
  }

  rect(x: number, y: number, w: number, h: number, t: TileType): this {
    const k = this.scale;
    const x1 = Math.round((x + w) * k);
    const y1 = Math.round((y + h) * k);
    for (let j = Math.round(y * k); j < y1; j++) for (let i = Math.round(x * k); i < x1; i++) this.set(i, j, t);
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, t: TileType): this {
    const k = this.scale;
    const [X, Y, RX, RY] = [cx * k, cy * k, rx * k, ry * k];
    for (let j = Math.floor(Y - RY); j <= Math.ceil(Y + RY); j++) {
      for (let i = Math.floor(X - RX); i <= Math.ceil(X + RX); i++) {
        const dx = (i + 0.5 - X) / RX;
        const dy = (j + 0.5 - Y) / RY;
        if (dx * dx + dy * dy <= 1) this.set(i, j, t);
      }
    }
    return this;
  }

  /** Thick line of tiles (Bresenham-ish sampling). */
  line(x0: number, y0: number, x1: number, y1: number, t: TileType, thickness = 1, onlyOver?: TileType): this {
    const k = this.scale;
    const [X0, Y0, X1, Y1] = [x0 * k, y0 * k, x1 * k, y1 * k];
    const thick = Math.max(1, Math.round(thickness * k));
    const steps = Math.max(Math.abs(X1 - X0), Math.abs(Y1 - Y0)) * 2 + 1;
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(X0 + ((X1 - X0) * s) / steps);
      const y = Math.round(Y0 + ((Y1 - Y0) * s) / steps);
      for (let j = 0; j < thick; j++) {
        for (let i = 0; i < thick; i++) {
          const px = x + i;
          const py = y + j;
          if (onlyOver !== undefined && this.get(px, py) !== onlyOver) continue;
          this.set(px, py, t);
        }
      }
    }
    return this;
  }

  /**
   * Makes room for capture points (design units): rock within three tiles of each becomes open
   * ground, so a point never sits inside a cliff. Call it before mirror().
   */
  pads(points: [number, number, PointKind?][]): this {
    for (const [x, y] of points) {
      const cx = x * this.scale;
      const cy = y * this.scale;
      for (let j = Math.floor(cy - 3); j <= Math.ceil(cy + 3); j++) {
        for (let i = Math.floor(cx - 3); i <= Math.ceil(cx + 3); i++) {
          if (Math.hypot(i + 0.5 - cx, j + 0.5 - cy) <= 3.2 && this.get(i, j) === TILE.CLIFF) this.set(i, j, TILE.GROUND);
        }
      }
    }
    return this;
  }

  /** One tile of `t` around the whole map. */
  border(t: TileType = TILE.CLIFF): this {
    const { w, h } = this;
    for (let x = 0; x < w; x++) this.set(x, 0, t).set(x, h - 1, t);
    for (let y = 0; y < h; y++) this.set(0, y, t).set(w - 1, y, t);
    return this;
  }

  /** Copies the bottom-left half (below the TL->BR diagonal) onto its 180-degree mirror. */
  mirror(): this {
    const { w, h } = this;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (y / (h - 1) > x / (w - 1)) {
          this.tiles[h - 1 - y][w - 1 - x] = this.tiles[y][x];
          this.levels[h - 1 - y][w - 1 - x] = this.levels[y][x];
        }
      }
    }
    return this;
  }

  build(): number[][] {
    return this.tiles.map((r) => r.slice());
  }

  /** The level grid, or undefined when nothing was raised (a flat map). */
  buildLevels(): number[][] | undefined {
    return this.raised ? this.levels.map((r) => r.slice()) : undefined;
  }

  /** Design-unit position of a footprint's top-left corner, as a tile. */
  tile(x: number, y: number): TilePoint {
    return { tx: Math.round(x * this.scale), ty: Math.round(y * this.scale) };
  }

  /** Design-unit point in tiles (capture points may sit between tiles). */
  point(x: number, y: number, kind?: PointKind): { x: number; y: number; kind?: PointKind } {
    return { x: x * this.scale, y: y * this.scale, ...(kind ? { kind } : {}) };
  }

  /** The enemy-side position of a player-side footprint of `size` tiles. */
  mirrorTile(p: TilePoint, size: number): TilePoint {
    return { tx: this.w - p.tx - size, ty: this.h - p.ty - size };
  }

  /** The enemy-side twin of a point given in tiles. */
  mirrorPoint<T extends { x: number; y: number }>(p: T): T {
    return { ...p, x: this.w - p.x, y: this.h - p.y };
  }

  /**
   * Capture points for a symmetric map: every point of the player half gets its mirror twin;
   * `centre` points sit on the axis of symmetry and are not doubled.
   */
  points(centre: [number, number, PointKind?][], half: [number, number, PointKind?][]): MapDef['capturePoints'] {
    const own = half.map(([x, y, k]) => this.point(x, y, k));
    return [...centre.map(([x, y, k]) => this.point(x, y, k)), ...own, ...own.map((p) => this.mirrorPoint(p))];
  }
}
