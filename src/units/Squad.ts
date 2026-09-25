import Phaser from 'phaser';
import { UNITS } from '../config';
import { EV } from '../events';
import { Owner } from '../types';
import { UnitDef } from './UnitDefs';
import { Unit } from './Unit';
import { Building } from '../buildings/Building';
import type { BattleScene } from '../scenes/BattleScene';
import type { Wreck } from './WreckSystem';

export type SquadOrder = 'idle' | 'move' | 'attackMove' | 'attack' | 'hold' | 'retreat';
/** Hold = never move; Defend = fight nearby then return to the guard point; Aggressive = chase anything. */
export type Stance = 'hold' | 'defend' | 'aggressive';

/** How far (px) a defensive squad will chase beyond its weapon range before returning. */
const LEASH = 260;
export type Target = Squad | Building;

interface Pt {
  x: number;
  y: number;
}

let nextSquadId = 1;

export function isSquad(t: Target): t is Squad {
  return t instanceof Squad;
}

export function targetPos(t: Target): Pt {
  return isSquad(t) ? t.center : { x: t.x, y: t.y };
}

export function targetAlive(t: Target | null): t is Target {
  return !!t && t.alive;
}

/** A group of soldiers that moves, fights and is selected as one entity. */
export class Squad {
  readonly uid = nextSquadId++;
  readonly def: UnitDef;
  readonly owner: Owner;
  readonly units: Unit[] = [];
  maxSize: number;
  /** Virtual anchor the formation is built around. */
  x: number;
  y: number;
  order: SquadOrder = 'idle';
  path: Pt[] = [];
  moveGoal: Pt | null = null;
  target: Target | null = null;
  pendingReinforce = 0;
  selected = false;
  alive = true;
  /** Per-soldier positions while holding in cover. */
  coverSlots: Pt[] | null = null;
  /** AI bookkeeping tag (e.g. 'defend', 'raid'). */
  role = '';
  stance: Stance;
  /** Where a defensive squad returns to after a skirmish. */
  guard: Pt;
  /** Shift-queued destinations after the current path. */
  waypoints: { x: number; y: number; attack: boolean }[] = [];
  // ---- Role state (driven by SupportSystem) ----
  /** Underground (Burrowers): invisible to the enemy unless detected. */
  burrowed = false;
  /** Seen by an enemy detector this tick. */
  detected = false;
  /** Seconds out of combat (burrowing starts after a short calm). */
  calm = 0;
  leapCd = 0;
  /** Structure the engineers were ordered to repair. */
  repairTarget: Building | null = null;
  /** Speed bonus from a friendly aura, and until when (battle seconds). */
  auraSpeed = 0;
  auraUntil = 0;
  // ---- Vehicle state (driven by VehicleSystem) ----
  deployState: 'mobile' | 'deploying' | 'deployed' | 'packing' = 'mobile';
  deployT = 0;
  /** Move order waiting until a deployed weapon has packed up. */
  pendingMove: { x: number; y: number; attack: boolean } | null = null;
  /** Squads riding inside this transport. */
  readonly cargo: Squad[] = [];
  /** The transport this squad rides in (null when on foot). */
  carrier: Squad | null = null;
  /** Transport this squad is walking toward to board. */
  boardTarget: Squad | null = null;
  /** Bunker this squad shelters in, or is walking to. */
  garrisonIn: Building | null = null;
  garrisonTarget: Building | null = null;
  /** Wreck the engineers were ordered to salvage. */
  salvageTarget: Wreck | null = null;
  private offsets: Pt[];
  private repathTimer = 0;
  private retargetTimer = 0;
  private reinforceTimer = 0;
  private cachedCenter: Pt = { x: 0, y: 0 };

  constructor(private battle: BattleScene, def: UnitDef, owner: Owner, x: number, y: number, size: number, maxSize: number) {
    this.def = def;
    this.owner = owner;
    this.x = x;
    this.y = y;
    this.maxSize = maxSize;
    this.offsets = Squad.formation(maxSize, Math.max(UNITS.formationSpacing, def.size * 2 + 8));
    this.heading = owner === 'player' ? -Math.PI / 4 : (Math.PI * 3) / 4;
    this.stance = owner === 'player' ? 'defend' : 'aggressive';
    this.guard = { x, y };
    for (let i = 0; i < size; i++) {
      const u = this.addUnit(x, y);
      const p = this.slotPos(u);
      u.x = p.x;
      u.y = p.y;
    }
    this.updateCenter();
  }

  /**
   * Wedge formation in squad-local space (x = forward, y = right): a point man, then ranks of
   * 2, 3, ... behind him, with a little per-soldier jitter so it never looks drilled.
   */
  static formation(n: number, spacing: number): Pt[] {
    const out: Pt[] = [];
    let row = 0;
    while (out.length < n) {
      const width = Math.min(row + 1, n - out.length);
      for (let i = 0; i < width; i++) {
        const j = out.length;
        const jx = Math.sin(j * 12.9898) * 3;
        const jy = Math.cos(j * 78.233) * 3;
        out.push({ x: -row * spacing * 0.8 + jx, y: (i - (width - 1) / 2) * spacing + jy });
      }
      row++;
    }
    const mx = out.reduce((a, p) => a + p.x, 0) / n;
    for (const p of out) p.x -= mx;
    return out;
  }

  /** Formation facing (radians, logical space). */
  heading = 0;

  addUnit(x: number, y: number): Unit {
    const u = new Unit(this.battle, this, x, y, this.battle.modifiers[this.owner].hpMult);
    u.setSelected(this.selected);
    this.units.push(u);
    this.reslot();
    return u;
  }

  removeUnit(u: Unit): void {
    const i = this.units.indexOf(u);
    if (i >= 0) this.units.splice(i, 1);
    u.destroy();
    this.reslot();
    if (this.units.length === 0) this.alive = false;
  }

  private reslot(): void {
    if (this.offsets.length < this.maxSize) {
      this.offsets = Squad.formation(this.maxSize, Math.max(UNITS.formationSpacing, this.def.size * 2 + 8));
    }
    this.units.forEach((u, i) => (u.slot = i));
  }

  get center(): Pt {
    return this.cachedCenter;
  }

  get hp(): number {
    return this.units.reduce((s, u) => s + u.hp, 0);
  }

  get maxHp(): number {
    return this.units.length ? this.units[0].maxHp * this.maxSize : 1;
  }

  setSelected(sel: boolean): void {
    this.selected = sel;
    for (const u of this.units) u.setSelected(sel);
  }

  // ---- Orders -------------------------------------------------------------

  /** Move order; with `queue` the destination is appended after the current path (shift-click). */
  moveTo(x: number, y: number, attackMove = false, queue = false): void {
    this.repairTarget = null;
    this.boardTarget = null;
    this.garrisonTarget = null;
    this.salvageTarget = null;
    if (this.deployState !== 'mobile') {
      // Artillery must pack up first; the move resumes when it is mobile again.
      this.pendingMove = { x, y, attack: attackMove };
      if (this.deployState === 'deployed' || this.deployState === 'deploying') {
        this.deployState = 'packing';
        this.deployT = 0;
      }
      return;
    }
    if (queue && (this.order === 'move' || this.order === 'attackMove') && (this.path.length || this.waypoints.length)) {
      this.waypoints.push({ x, y, attack: attackMove });
      return;
    }
    this.waypoints = [];
    this.order = attackMove ? 'attackMove' : 'move';
    this.target = null;
    this.coverSlots = null;
    this.moveGoal = { x, y };
    this.setPath(x, y);
  }

  attack(t: Target): void {
    this.waypoints = [];
    this.order = 'attack';
    this.target = t;
    this.coverSlots = null;
    this.moveGoal = null;
    this.repathTimer = 0;
  }

  hold(): void {
    this.stance = 'hold';
    this.waypoints = [];
    this.order = 'hold';
    this.target = null;
    this.path = [];
    this.moveGoal = null;
    this.battle.cover?.seekCover(this);
  }

  setStance(st: Stance): void {
    if (st === 'hold') {
      this.hold();
      return;
    }
    this.stance = st;
    if (this.order === 'hold') {
      this.order = 'idle';
      this.coverSlots = null;
    }
    this.guard = { x: this.x, y: this.y };
  }

  /** Runs home to the headquarters (or the nearest friendly building), ignoring enemies. */
  retreat(): void {
    const bs = this.battle.buildings;
    const home = bs.getHQ(this.owner) ?? bs.getOwned(this.owner)[0];
    if (!home) return;
    this.waypoints = [];
    this.target = null;
    this.coverSlots = null;
    this.order = 'retreat';
    const gx = home.x + (Math.random() - 0.5) * 80;
    const gy = home.y + home.radius + 70;
    this.moveGoal = { x: gx, y: gy };
    this.setPath(gx, gy);
    if (this.stance === 'hold') this.stance = 'defend';
  }

  get retreating(): boolean {
    return this.order === 'retreat';
  }

  /** Movement speed multiplier (retreat sprint, burrowing, auras). */
  get speedMult(): number {
    let m = this.order === 'retreat' ? 1.5 : 1;
    if (this.burrowed && this.def.burrow) m *= this.def.burrow.speedMult;
    if (this.auraUntil > this.battle.elapsed) m *= 1 + this.auraSpeed;
    if (this.def.category === 'infantry') m *= this.battle.modifiers[this.owner].infantrySpeedMult;
    return m;
  }

  /** True if `viewer` cannot see this squad at all (burrowed and undetected, or riding in a transport). */
  hiddenFrom(viewer: Owner): boolean {
    return !!this.carrier || !!this.garrisonIn || (viewer !== this.owner && this.burrowed && !this.detected);
  }

  /** Inside a transport or a bunker (not drawn, not selectable, cannot capture). */
  get embarked(): boolean {
    return !!this.carrier || !!this.garrisonIn;
  }

  get isVehicle(): boolean {
    return this.def.category === 'vehicle';
  }

  /** Weapon reach, including the deployed-artillery bonus. */
  get range(): number {
    return this.def.range + (this.deployState === 'deployed' ? this.def.deploy?.rangeBonus ?? 0 : 0) + (this.garrisonIn ? 40 : 0);
  }

  /** Walk to a friendly bunker and shelter inside. */
  enterBunker(b: Building): void {
    this.stop();
    this.garrisonTarget = b;
    this.setPath(b.x, b.y + b.radius + 20);
    this.order = 'move';
  }

  /** Walk to a friendly transport and climb in. */
  board(t: Squad): void {
    this.stop();
    this.boardTarget = t;
    this.setPath(t.center.x, t.center.y);
    this.order = 'move';
  }

  /** Orders engineers to walk over and repair a friendly structure. */
  repair(b: Building): void {
    this.stop();
    this.repairTarget = b;
  }

  stop(): void {
    this.waypoints = [];
    this.guard = { x: this.x, y: this.y };
    this.order = 'idle';
    this.target = null;
    this.path = [];
    this.moveGoal = null;
    this.coverSlots = null;
  }

  private setPath(x: number, y: number): void {
    if (this.def.flying) {
      const m = this.battle.map;
      this.path = [{ x: Phaser.Math.Clamp(x, 32, m.worldWidth - 32), y: Phaser.Math.Clamp(y, 32, m.worldHeight - 32) }];
      return;
    }
    this.path = this.battle.pathfinder.find(this.x, this.y, x, y, this.isVehicle && this.def.size >= 18, this.owner);
  }

  /** Public path request (used by support systems). */
  pathTo(x: number, y: number): void {
    this.setPath(x, y);
  }

  // ---- Update -------------------------------------------------------------

  update(dt: number): void {
    if (!this.alive) return;
    this.updateReinforce(dt);
    this.updateTargeting(dt);
    this.updateAnchor(dt);
    this.updateCenter();
  }

  private updateCenter(): void {
    if (!this.units.length) return;
    let sx = 0;
    let sy = 0;
    for (const u of this.units) {
      sx += u.x;
      sy += u.y;
    }
    this.cachedCenter = { x: sx / this.units.length, y: sy / this.units.length };
  }

  /** Current combat target (explicit or auto-acquired), or null. */
  get engaged(): Target | null {
    return targetAlive(this.target) ? this.target : null;
  }

  private updateTargeting(dt: number): void {
    if (this.target && !targetAlive(this.target)) {
      this.target = null;
      if (this.order === 'attack') this.order = 'idle';
      if (this.order === 'attackMove' && this.moveGoal) this.setPath(this.moveGoal.x, this.moveGoal.y);
    }
    if (this.order === 'move' || this.order === 'retreat') return;
    this.retargetTimer -= dt;
    if (this.retargetTimer > 0) return;
    this.retargetTimer = UNITS.retargetInterval;
    const c = this.center;
    if (this.order !== 'attack') {
      const deployedArty = !!this.def.deploy && this.deployState === 'deployed';
      const reach = this.range + (this.order === 'hold' || deployedArty ? 0 : this.stance === 'aggressive' ? UNITS.acquireBonus * 2 : UNITS.acquireBonus);
      const found = this.battle.units.findTarget(this.owner, c.x, c.y, reach);
      if (found) this.target = found;
      else if (this.target) {
        // Keep a retaliation target only while it stays reasonably close.
        const tp0 = targetPos(this.target);
        if (Phaser.Math.Distance.Between(c.x, c.y, tp0.x, tp0.y) > reach * 2.5) this.target = null;
      }
      // Defensive squads give up the chase once the enemy leads them too far from their post.
      if (this.target && this.stance === 'defend' && this.order === 'idle') {
        const tp1 = targetPos(this.target);
        if (Phaser.Math.Distance.Between(this.guard.x, this.guard.y, tp1.x, tp1.y) > this.range + LEASH) {
          this.target = null;
          if (Phaser.Math.Distance.Between(c.x, c.y, this.guard.x, this.guard.y) > 40) this.setPath(this.guard.x, this.guard.y);
        }
      }
    }
    const t = this.engaged;
    if (!t || this.order === 'hold') return;
    const tp = targetPos(t);
    const gap = Phaser.Math.Distance.Between(c.x, c.y, tp.x, tp.y) - (isSquad(t) ? 0 : t.radius);
    this.repathTimer -= UNITS.retargetInterval;
    const clear = this.def.indirect || this.def.flying || (this.battle.cover?.hasLineOfSight(c.x, c.y, tp.x, tp.y) ?? true);
    // Deployed or deploying artillery never walks after targets.
    if (this.deployState !== 'mobile') {
      this.path = [];
      return;
    }
    if (gap > this.range * 0.85 || !clear) {
      if (this.repathTimer <= 0 || this.path.length === 0) {
        this.repathTimer = UNITS.repathInterval;
        this.setPath(tp.x, tp.y);
      }
    } else {
      this.path = [];
      this.x = c.x;
      this.y = c.y;
      // Dress the line toward the enemy.
      this.heading = Phaser.Math.Angle.RotateTo(this.heading, Math.atan2(tp.y - c.y, tp.x - c.x), 0.35);
    }
  }

  private updateAnchor(dt: number): void {
    const next = this.path[0];
    if (!next) {
      const wp = this.waypoints[0];
      if (wp && (this.order === 'move' || (this.order === 'attackMove' && !this.engaged))) {
        this.waypoints.shift();
        this.order = wp.attack ? 'attackMove' : 'move';
        this.moveGoal = { x: wp.x, y: wp.y };
        this.setPath(wp.x, wp.y);
        return;
      }
      if (this.order === 'move' || this.order === 'retreat' || (this.order === 'attackMove' && !this.engaged)) {
        this.order = 'idle';
        this.guard = { x: this.x, y: this.y };
      }
      return;
    }
    const c = this.center;
    const lag = Phaser.Math.Distance.Between(this.x, this.y, c.x, c.y);
    const factor = Phaser.Math.Clamp(1 - (lag - 50) / 90, 0.15, 1);
    const step = this.def.speed * this.speedMult * factor * dt;
    const d = Phaser.Math.Distance.Between(this.x, this.y, next.x, next.y);
    if (d > 4) this.heading = Phaser.Math.Angle.RotateTo(this.heading, Math.atan2(next.y - this.y, next.x - this.x), 3 * dt);
    if (d <= step) {
      this.x = next.x;
      this.y = next.y;
      this.path.shift();
    } else {
      this.x += ((next.x - this.x) / d) * step;
      this.y += ((next.y - this.y) / d) * step;
    }
  }

  private updateReinforce(dt: number): void {
    if (this.pendingReinforce <= 0) return;
    this.reinforceTimer -= dt;
    if (this.reinforceTimer > 0) return;
    this.reinforceTimer = UNITS.reinforceInterval;
    this.pendingReinforce--;
    if (this.pendingReinforce === 0 && this.owner === 'player') this.battle.events.emit(EV.message, 'note.reinforced');
    const u = this.addUnit(this.x, this.y);
    u.sprite.setAlpha(0);
    this.battle.tweens.add({ targets: u.sprite, alpha: 1, duration: 400 });
  }

  /** World position of a unit's formation slot. */
  slotPos(u: Unit): Pt {
    if (this.order === 'hold' && this.coverSlots) return this.coverSlots[u.slot] ?? { x: this.x, y: this.y };
    const o = this.offsets[u.slot] ?? { x: 0, y: 0 };
    const c = Math.cos(this.heading);
    const n = Math.sin(this.heading);
    return { x: this.x + o.x * c - o.y * n, y: this.y + o.x * n + o.y * c };
  }

  containsPoint(wx: number, wy: number): boolean {
    return this.units.some((u) => Phaser.Math.Distance.Between(u.x, u.y, wx, wy) <= u.radius + 6);
  }

  isMoving(): boolean {
    return this.path.length > 0;
  }

  destroy(): void {
    for (const u of this.units) u.destroy();
    this.units.length = 0;
    this.alive = false;
  }
}
