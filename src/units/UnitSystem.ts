import Phaser from 'phaser';
import { DEPTH, SUPPLY, TILE, TILE_SIZE, UNITS } from '../config';
import { Projection } from '../render/Projection';
import { EV } from '../events';
import { Owner, opponent } from '../types';
import { UNIT_DEFS, UnitId } from './UnitDefs';
import { Squad, Target } from './Squad';
import { Unit } from './Unit';
import { Resources } from '../systems/ResourceSystem';
import type { BattleScene } from '../scenes/BattleScene';

const CELL = 64;

/** Manages all squads: spawning, soldier steering, spatial queries, reinforcement. */
export class UnitSystem {
  readonly squads: Squad[] = [];
  private grid = new Map<number, Unit[]>();
  private bars: Phaser.GameObjects.Graphics;
  private occlusionTimer = 0;

  constructor(private battle: BattleScene) {
    this.bars = battle.add.graphics().setDepth(DEPTH.bars);
  }

  spawnSquad(id: UnitId, owner: Owner, x: number, y: number, size?: number): Squad {
    const def = UNIT_DEFS[id];
    const bonus = def.isHero ? 0 : this.battle.modifiers[owner].squadSizeBonus;
    const max = def.squadSize + bonus;
    const p = this.findOpenSpot(x, y);
    const squad = new Squad(this.battle, def, owner, p.x, p.y, size ?? max, max);
    this.squads.push(squad);
    this.battle.events.emit(EV.squadSpawned, squad);
    return squad;
  }

  /** Nearest passable world point to (x, y). */
  findOpenSpot(x: number, y: number): { x: number; y: number } {
    if (this.battle.map.isPassableWorld(x, y)) return { x, y };
    const t = this.battle.map.worldToTile(x, y);
    const alt = this.battle.pathfinder.nearestPassable(t.tx, t.ty);
    return alt ? this.battle.map.tileToWorld(alt.tx, alt.ty) : { x, y };
  }

  getSquads(owner: Owner): Squad[] {
    return this.squads.filter((s) => s.owner === owner && s.alive);
  }

  /** Squads counted against the population cap (heroes excluded). */
  armyCount(owner: Owner): number {
    return this.squads.filter((s) => s.owner === owner && s.alive && !s.def.isHero).length;
  }

  /** Supply used by living squads (queued units are counted by ProductionSystem). */
  supplyUsed(owner: Owner): number {
    let n = 0;
    for (const s of this.squads) if (s.owner === owner && s.alive) n += s.def.supply;
    return n;
  }

  /** Supply cap: HQ + finished supply buildings + bonuses, clamped to the hard maximum. */
  supplyCap(owner: Owner): number {
    let n = this.battle.modifiers[owner].supplyBonus;
    for (const b of this.battle.buildings.buildings) if (b.owner === owner && b.isReady) n += b.def.supply ?? 0;
    return Math.min(SUPPLY.hardMax, n);
  }

  squadAt(wx: number, wy: number, owner?: Owner): Squad | undefined {
    return this.squads.find((s) => s.alive && (!owner || s.owner === owner) && s.containsPoint(wx, wy));
  }

  squadsInRect(r: Phaser.Geom.Rectangle, owner: Owner): Squad[] {
    return this.squads.filter((s) => s.alive && s.owner === owner && s.units.some((u) => r.contains(u.x, u.y)));
  }

  /** Squad whose drawn body is under a view-space point (front-most first). */
  squadAtView(vx: number, vy: number, owner?: Owner): Squad | undefined {
    let best: Squad | undefined;
    let bestY = -Infinity;
    for (const s of this.squads) {
      if (!s.alive || (owner && s.owner !== owner)) continue;
      for (const u of s.units) {
        if (u.y > bestY && u.containsView(vx, vy)) {
          best = s;
          bestY = u.y;
        }
      }
    }
    return best;
  }

  /** Squads with any soldier's body inside a view-space rectangle (drag box). */
  squadsInViewRect(r: Phaser.Geom.Rectangle, owner: Owner): Squad[] {
    return this.squads.filter((s) => s.alive && s.owner === owner
      && s.units.some((u) => r.contains(u.x, Projection.vy(u.y) - u.height * 0.5)));
  }

  /** Nearest visible enemy squad or building within `reach` of (x, y). */
  findTarget(owner: Owner, x: number, y: number, reach: number): Target | null {
    const enemy = opponent(owner);
    let best: Target | null = null;
    let bestD = reach;
    for (const s of this.squads) {
      if (!s.alive || s.owner !== enemy || s.hiddenFrom(owner)) continue;
      for (const u of s.units) {
        const d = Phaser.Math.Distance.Between(x, y, u.x, u.y);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
    }
    // Squads take priority; only consider buildings if no squad is close.
    if (best) return best;
    for (const b of this.battle.buildings.buildings) {
      if (!b.alive || b.owner !== enemy) continue;
      const d = Phaser.Math.Distance.Between(x, y, b.x, b.y) - b.radius;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  reinforceCost(s: Squad): Resources {
    const missing = s.maxSize - s.units.length - s.pendingReinforce;
    const f = (UNITS.reinforceCostFactor * missing) / s.def.squadSize;
    return { scrip: Math.ceil(s.def.cost.scrip * f), flux: Math.ceil(s.def.cost.flux * f) };
  }

  canReinforce(s: Squad): boolean {
    return s.alive && !s.def.isHero && s.units.length + s.pendingReinforce < s.maxSize;
  }

  reinforce(s: Squad): boolean {
    if (!this.canReinforce(s)) return false;
    const cost = this.reinforceCost(s);
    if (!this.battle.resources.trySpend(s.owner, cost)) {
      if (s.owner === 'player') this.battle.events.emit(EV.message, 'err.resources');
      return false;
    }
    s.pendingReinforce = s.maxSize - s.units.length;
    return true;
  }

  update(dt: number): void {
    this.rebuildGrid();
    for (const s of this.squads) s.update(dt);
    for (const s of this.squads) {
      for (const u of s.units) this.steer(u, dt);
    }
    this.drawBars();
    this.occlusionTimer -= dt;
    if (this.occlusionTimer <= 0) {
      this.occlusionTimer = 0.2;
      this.updateOcclusion();
    }
    for (let i = this.squads.length - 1; i >= 0; i--) {
      const s = this.squads[i];
      if (!s.alive || s.units.length === 0) {
        s.alive = false;
        this.squads.splice(i, 1);
        this.battle.events.emit(EV.squadDestroyed, s);
      }
    }
  }

  /** Squad HP bars for selected squads and any visible damaged squad. */
  private drawBars(): void {
    const g = this.bars.clear();
    for (const s of this.squads) {
      if (!s.alive || s.units.length === 0) continue;
      const frac = s.hp / s.maxHp;
      if (!s.selected && frac >= 0.999) continue;
      if (s.owner === 'enemy' && !s.units.some((u) => u.isShown)) continue;
      let top = Infinity;
      let x0 = Infinity;
      let x1 = -Infinity;
      let bottom = -Infinity;
      for (const u of s.units) {
        const gy = Projection.vy(u.y);
        top = Math.min(top, gy - u.height);
        bottom = Math.max(bottom, gy + 4);
        x0 = Math.min(x0, u.x - 10);
        x1 = Math.max(x1, u.x + 10);
      }
      const cx = (x0 + x1) / 2;
      const w = Math.max(36, Math.min(70, s.maxSize * 7));
      const x = cx - w / 2;
      const y = top - 14;
      const enemy = s.owner === 'enemy';
      const col = enemy ? 0xd83030 : frac > 0.6 ? 0x48d848 : frac > 0.3 ? 0xe0c020 : 0xe03020;
      // Frame with brass trim, HP fill, then one pip per soldier (filled = alive).
      g.fillStyle(0x0a0a0c, 0.85).fillRect(x - 2, y - 2, w + 4, 10);
      g.lineStyle(1, enemy ? 0x7a3040 : 0xb0903a, 0.9).strokeRect(x - 2, y - 2, w + 4, 10);
      g.fillStyle(col, 1).fillRect(x, y, w * Math.min(1, frac), 3);
      const pip = w / s.maxSize;
      for (let i = 0; i < s.maxSize; i++) {
        g.fillStyle(i < s.units.length ? 0xe8e0c8 : 0x3a3a3a, 1).fillRect(x + i * pip + 0.5, y + 4.5, Math.max(1, pip - 1.5), 2);
      }
      if (s.selected) {
        // Corner brackets around the squad.
        const bx0 = x0 - 4;
        const bx1 = x1 + 4;
        const by0 = top - 2;
        const by1 = bottom + 2;
        const L = 8;
        g.lineStyle(2, 0x60ff70, 0.9);
        for (const [px, py, dx, dy] of [[bx0, by0, 1, 1], [bx1, by0, -1, 1], [bx0, by1, 1, -1], [bx1, by1, -1, -1]]) {
          g.lineBetween(px, py, px + dx * L, py).lineBetween(px, py, px, py + dy * L);
        }
      }
    }
  }

  /** Player soldiers hidden behind a raised cliff or a building show a silhouette. */
  private updateOcclusion(): void {
    const map = this.battle.map;
    const blds = this.battle.buildings.buildings.map((b) => ({ r: b.view.viewBounds(), d: b.view.depth }));
    for (const s of this.squads) {
      if (s.owner !== 'player') continue;
      for (const u of s.units) {
        const t = map.worldToTile(u.x, u.y);
        const nearFront = (u.y % TILE_SIZE) > TILE_SIZE * 0.35;
        let occ = map.getTile(t.tx, t.ty + 1) === TILE.CLIFF && nearFront;
        if (!occ) {
          const d = Projection.depth(u.y);
          const p = u.aimPoint();
          occ = blds.some((b) => b.d > d && b.r.contains(p.x, p.y));
        }
        if (occ !== u.occluded) u.setOccluded(occ);
      }
    }
  }

  private rebuildGrid(): void {
    this.grid.clear();
    for (const s of this.squads) {
      for (const u of s.units) {
        const k = Math.floor(u.x / CELL) * 1000 + Math.floor(u.y / CELL);
        const cell = this.grid.get(k);
        if (cell) cell.push(u);
        else this.grid.set(k, [u]);
      }
    }
  }

  /** Units in cells overlapping a radius around (x, y). */
  neighbors(x: number, y: number, r: number, out: Unit[] = []): Unit[] {
    out.length = 0;
    const x0 = Math.floor((x - r) / CELL);
    const x1 = Math.floor((x + r) / CELL);
    const y0 = Math.floor((y - r) / CELL);
    const y1 = Math.floor((y + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const cell = this.grid.get(cx * 1000 + cy);
        if (cell) for (const u of cell) out.push(u);
      }
    }
    return out;
  }

  private scratch: Unit[] = [];

  /** Seek formation slot with arrival, separate from neighbours, slide along obstacles. */
  private steer(u: Unit, dt: number): void {
    const map = this.battle.map;
    if (u.leapArc) {
      if (u.updateLeap(dt)) this.battle.support.onLand(u);
      u.syncSprite(dt);
      return;
    }
    let goal = u.squad.slotPos(u);
    if (!map.isPassableWorld(goal.x, goal.y)) goal = { x: u.squad.x, y: u.squad.y };
    let dx = goal.x - u.x;
    let dy = goal.y - u.y;
    const dist = Math.hypot(dx, dy);
    const speed = u.def.speed * u.squad.speedMult * (dist > 60 ? 1.15 : 1);
    let vx = 0;
    let vy = 0;
    if (dist > 2) {
      const s = Math.min(speed, (dist / 20) * speed);
      vx = (dx / dist) * s;
      vy = (dy / dist) * s;
    }
    const sepR = UNITS.separationRadius + u.radius;
    for (const o of this.neighbors(u.x, u.y, sepR, this.scratch)) {
      if (o === u) continue;
      dx = u.x - o.x;
      dy = u.y - o.y;
      const d = Math.hypot(dx, dy);
      const min = u.radius + o.radius + 4;
      if (d > 0.01 && d < min) {
        const push = ((min - d) / min) * UNITS.separationForce;
        vx += (dx / d) * push;
        vy += (dy / d) * push;
      }
    }
    u.vx = vx;
    u.vy = vy;
    const nx = u.x + vx * dt;
    const ny = u.y + vy * dt;
    if (map.isPassableWorld(nx, ny)) {
      u.x = nx;
      u.y = ny;
    } else if (map.isPassableWorld(nx, u.y)) {
      u.x = nx;
    } else if (map.isPassableWorld(u.x, ny)) {
      u.y = ny;
    } else if (!map.isPassableWorld(u.x, u.y)) {
      // Pushed into a wall (e.g. new building): pop out.
      const p = this.findOpenSpot(u.x, u.y);
      u.x = p.x;
      u.y = p.y;
    }
    const t = u.squad.engaged;
    if (t && !u.squad.isMoving()) {
      const tp = 'units' in t ? t.center : { x: t.x, y: t.y };
      u.face(tp.x, tp.y);
    } else if (Math.abs(vx) + Math.abs(vy) > 8) {
      u.face(u.x + vx, u.y + vy);
    }
    u.syncSprite(dt);
  }

  destroyAll(): void {
    for (const s of this.squads) s.destroy();
    this.squads.length = 0;
  }
}
