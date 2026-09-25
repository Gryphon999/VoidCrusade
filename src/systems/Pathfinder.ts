import { TILE_SIZE } from '../config';
import { MapSystem } from './MapSystem';
import { Owner } from '../types';

interface Pt {
  x: number;
  y: number;
}

/** Binary min-heap keyed on f-score. */
class Heap {
  private items: number[] = [];
  constructor(private score: Float32Array) {}
  get size(): number {
    return this.items.length;
  }
  push(i: number): void {
    const a = this.items;
    a.push(i);
    let n = a.length - 1;
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (this.score[a[p]] <= this.score[a[n]]) break;
      [a[p], a[n]] = [a[n], a[p]];
      n = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0];
    const last = a.pop() as number;
    if (a.length > 0) {
      a[0] = last;
      let n = 0;
      for (;;) {
        const l = n * 2 + 1;
        const r = l + 1;
        let m = n;
        if (l < a.length && this.score[a[l]] < this.score[a[m]]) m = l;
        if (r < a.length && this.score[a[r]] < this.score[a[m]]) m = r;
        if (m === n) break;
        [a[m], a[n]] = [a[n], a[m]];
        n = m;
      }
    }
    return top;
  }
}

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/** 8-directional A* over the tile grid with line-of-sight path smoothing. */
export class Pathfinder {
  private g: Float32Array;
  private f: Float32Array;
  private parent: Int32Array;
  private stamp: Uint32Array;
  private closed: Uint32Array;
  private run = 0;
  /** Side whose gates count as open for the current query. */
  private owner?: Owner;

  constructor(private map: MapSystem) {
    const n = map.width * map.height;
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
  }

  /**
   * Wide-body passability: the tile is open and belongs to at least one fully open 2x2 block,
   * so vehicles never squeeze through one-tile gaps.
   */
  isWidePassable(tx: number, ty: number, owner?: Owner): boolean {
    const m = this.map;
    const p = (x: number, y: number): boolean => m.isPassable(x, y, owner);
    if (!p(tx, ty)) return false;
    for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
      const x = tx + ox;
      const y = ty + oy;
      if (p(x, y) && p(x + 1, y) && p(x, y + 1) && p(x + 1, y + 1)) return true;
    }
    return false;
  }

  /** Returns world-space waypoints from start to goal (excluding start). `wide` = vehicle clearance. */
  find(sx: number, sy: number, gx: number, gy: number, wide = false, owner?: Owner): Pt[] {
    const m = this.map;
    const W = m.width;
    this.owner = owner;
    const pass = wide ? (x: number, y: number): boolean => this.isWidePassable(x, y, owner) : (x: number, y: number): boolean => m.isPassable(x, y, owner);
    const clearance = wide ? 26 : 10;
    const s = m.worldToTile(sx, sy);
    let goal = m.worldToTile(gx, gy);
    if (!pass(goal.tx, goal.ty)) {
      const alt = this.nearestPassable(goal.tx, goal.ty, pass);
      if (!alt) return [];
      goal = alt;
      const w = m.tileToWorld(alt.tx, alt.ty);
      gx = w.x;
      gy = w.y;
    }
    if (this.hasLine(sx, sy, gx, gy, clearance)) return [{ x: gx, y: gy }];
    this.run++;
    const start = s.ty * W + s.tx;
    const target = goal.ty * W + goal.tx;
    const h = (i: number): number => Math.hypot((i % W) - goal.tx, Math.floor(i / W) - goal.ty);
    const heap = new Heap(this.f);
    this.visit(start, 0, h(start), -1);
    heap.push(start);
    let found = false;
    let iterations = 0;
    while (heap.size > 0 && iterations++ < 6000) {
      const cur = heap.pop();
      if (this.closed[cur] === this.run) continue;
      this.closed[cur] = this.run;
      if (cur === target) {
        found = true;
        break;
      }
      const cx = cur % W;
      const cy = Math.floor(cur / W);
      for (const [dx, dy, cost] of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!pass(nx, ny)) continue;
        if (dx !== 0 && dy !== 0 && (!pass(cx + dx, cy) || !pass(cx, cy + dy))) continue;
        const ni = ny * W + nx;
        if (this.closed[ni] === this.run) continue;
        const ng = this.g[cur] + cost;
        if (this.stamp[ni] === this.run && ng >= this.g[ni]) continue;
        this.visit(ni, ng, ng + h(ni), cur);
        heap.push(ni);
      }
    }
    if (!found) return [{ x: gx, y: gy }];
    const tiles: Pt[] = [];
    for (let i = target; i !== -1 && i !== start; i = this.parent[i]) {
      tiles.push(m.tileToWorld(i % W, Math.floor(i / W)));
    }
    tiles.reverse();
    if (tiles.length) tiles[tiles.length - 1] = { x: gx, y: gy };
    return this.smooth({ x: sx, y: sy }, tiles, clearance);
  }

  private visit(i: number, g: number, f: number, parent: number): void {
    this.stamp[i] = this.run;
    this.g[i] = g;
    this.f[i] = f;
    this.parent[i] = parent;
  }

  private smooth(start: Pt, pts: Pt[], clearance: number): Pt[] {
    const out: Pt[] = [];
    let anchor = start;
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.hasLine(anchor.x, anchor.y, pts[j].x, pts[j].y, clearance)) j--;
      out.push(pts[j]);
      anchor = pts[j];
      i = j + 1;
    }
    return out;
  }

  /** True if a straight walk between two world points stays on passable tiles (with body clearance). */
  hasLine(x0: number, y0: number, x1: number, y1: number, clearance = 10): boolean {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / (TILE_SIZE / 4));
    const nx = d > 0 ? (-(y1 - y0) / d) * clearance : 0;
    const ny = d > 0 ? ((x1 - x0) / d) * clearance : 0;
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      if (!this.map.isPassableWorld(x + nx, y + ny, this.owner) || !this.map.isPassableWorld(x - nx, y - ny, this.owner)) return false;
    }
    return true;
  }

  nearestPassable(tx: number, ty: number, pass = (x: number, y: number): boolean => this.map.isPassable(x, y)): { tx: number; ty: number } | null {
    for (let r = 1; r < 12; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (pass(tx + dx, ty + dy)) return { tx: tx + dx, ty: ty + dy };
        }
      }
    }
    return null;
  }
}
