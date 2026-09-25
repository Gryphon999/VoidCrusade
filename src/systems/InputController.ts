import Phaser from 'phaser';
import { DEPTH } from '../config';
import { Squad, Target, targetPos } from '../units/Squad';
import type { BattleScene } from '../scenes/BattleScene';
import { AudioSystem } from './AudioSystem';
import { VoiceBridge } from './VoiceBridge';
import { EV } from '../events';
import { ABILITIES, AbilityId } from '../units/Abilities';
import { Building } from '../buildings/Building';
import { UnitId } from '../units/UnitDefs';
import { Projection } from '../render/Projection';

const DRAG_THRESHOLD = 8;
const DOUBLE_MS = 350;
export type CommandMode = 'none' | 'move' | 'attackMove';

/** A pending targeted command: an ability for the selected squads, or a drop from a beacon. */
export type Targeting =
  | { kind: 'ability'; id: AbilityId }
  | { kind: 'drop'; building: Building; unit: UnitId };

export function isShift(p: Phaser.Input.Pointer): boolean {
  const e = p.event as MouseEvent | undefined;
  return !!e && 'shiftKey' in e && e.shiftKey;
}

/** Routes world mouse input to placement, selection and orders. */
export class InputController {
  mode: CommandMode = 'none';
  targeting: Targeting | null = null;
  private aimGfx: Phaser.GameObjects.Graphics;
  private downAt: Phaser.Math.Vector2 | null = null;
  private dragRect: Phaser.GameObjects.Graphics;
  private waypointLines: Phaser.GameObjects.Graphics;
  /** Control groups 1-9. */
  private groups = new Map<number, Squad[]>();
  private lastGroupTap = { n: -1, at: 0 };
  private lastClick = { id: '', at: 0 };
  private idleIndex = 0;

  constructor(private battle: BattleScene) {
    const input = battle.input;
    input.on('pointerdown', this.onDown, this);
    input.on('pointerup', this.onUp, this);
    this.dragRect = battle.add.graphics().setDepth(DEPTH.overlay);
    this.waypointLines = battle.add.graphics().setDepth(DEPTH.groundFx);
    this.aimGfx = battle.add.graphics().setDepth(DEPTH.overlay - 1);
    const kb = input.keyboard;
    kb?.on('keydown-B', () => {
      const hq = battle.buildings.getHQ('player');
      if (hq) battle.selection.selectBuilding(hq);
    });
    // Grid hotkeys (QWERTYU/ASDFGHJ) are handled by the HUD command grid; these are extra aliases.
    kb?.on('keydown-X', () => battle.selection.squads.forEach((s) => s.stop()));
    kb?.on('keydown-M', () => this.setMode('move'));
    kb?.on('keydown-ESC', () => {
      this.setMode('none');
      this.targeting = null;
    });
    kb?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    kb?.on('keydown-SPACE', () => {
      const s = battle.selection.squads[0] ?? battle.selection.building;
      if (!s) return;
      const pos = targetPos(s);
      battle.cameraSystem.centerOn(pos.x, pos.y);
    });
  }

  /** Starts targeting an ability (untargeted ones fire at once on every selected squad that has it). */
  useAbility(id: AbilityId): void {
    const b = this.battle;
    const casters = b.selection.squads.filter((s) => s.def.abilities?.includes(id));
    if (!casters.length) return;
    if (ABILITIES[id].targeting === 'none') {
      let any = false;
      for (const s of casters) if (!b.abilities.check(s, id)) any = b.abilities.cast(s, id) || any;
      if (!any) b.abilities.cast(casters[0], id);
      return;
    }
    this.mode = 'none';
    this.targeting = { kind: 'ability', id };
  }

  /** Beacon / portal drop: pick the landing spot next. */
  startDrop(building: Building, unit: UnitId): void {
    const err = this.battle.drops.check(building, unit);
    if (err) {
      this.battle.events.emit(EV.message, err);
      return;
    }
    this.targeting = { kind: 'drop', building, unit };
  }

  /** Resolves a click while targeting; returns true if the click was consumed. */
  private confirmTarget(p: Phaser.Input.Pointer): boolean {
    const tg = this.targeting;
    if (!tg) return false;
    const b = this.battle;
    const w = this.world(p);
    if (!isShift(p)) this.targeting = null;
    if (tg.kind === 'drop') {
      b.drops.order(tg.building, tg.unit, w.x, w.y);
      return true;
    }
    const d = ABILITIES[tg.id];
    const v = this.view(p);
    let target: Squad | Building | null = null;
    if (d.targeting === 'enemy') {
      const e = this.enemyAt(p);
      target = e && 'units' in e ? e : null;
      if (!target) {
        b.events.emit(EV.message, 'err.needTarget');
        return true;
      }
    } else if (d.targeting === 'building') {
      const own = b.buildings.buildingAtView(v.x, v.y);
      target = own && own.owner === 'player' ? own : null;
      if (!target) {
        b.events.emit(EV.message, 'err.needTarget');
        return true;
      }
    }
    // The ready caster closest to the target does it.
    const tp = target ? ('units' in target ? target.center : { x: target.x, y: target.y }) : w;
    const casters = b.selection.squads.filter((s) => s.def.abilities?.includes(tg.id) && !b.abilities.check(s, tg.id))
      .sort((a, c) => Phaser.Math.Distance.Between(a.center.x, a.center.y, tp.x, tp.y) - Phaser.Math.Distance.Between(c.center.x, c.center.y, tp.x, tp.y));
    const s = casters[0] ?? b.selection.squads.find((q) => q.def.abilities?.includes(tg.id));
    if (s) b.abilities.cast(s, tg.id, w.x, w.y, target);
    return true;
  }

  /** Range ring around the casters and the area of effect at the cursor. */
  private drawAim(): void {
    const g = this.aimGfx.clear();
    const tg = this.targeting;
    if (!tg) return;
    const b = this.battle;
    const k = Projection.tilt;
    const w = this.world(b.input.activePointer);
    const vy = Projection.vy(w.y);
    if (tg.kind === 'drop') {
      g.lineStyle(2, 0x60c0ff, 0.9).strokeEllipse(w.x, vy, 120, 120 * k);
      return;
    }
    const d = ABILITIES[tg.id];
    if (d.range > 0) {
      for (const s of b.selection.squads) {
        if (!s.def.abilities?.includes(tg.id)) continue;
        g.lineStyle(1.5, 0xf0d27a, 0.5).strokeEllipse(s.center.x, Projection.vy(s.center.y), d.range * 2, d.range * 2 * k);
      }
    }
    const r = d.radius ?? 24;
    g.fillStyle(0xff6040, 0.12).fillEllipse(w.x, vy, r * 2, r * 2 * k);
    g.lineStyle(2, 0xff8050, 0.9).strokeEllipse(w.x, vy, r * 2, r * 2 * k);
  }

  setMode(m: CommandMode): void {
    this.mode = this.battle.selection.hasSquads ? m : 'none';
    this.refreshCursor();
  }

  /** Contextual cursor: build while placing, attack over enemies, capture over Void-Nexus zones, move otherwise. */
  private refreshCursor(): void {
    const b = this.battle;
    const p = b.input.activePointer;
    let kind: 'default' | 'move' | 'attack' | 'capture' | 'build' = 'default';
    if (b.placement.isActive) kind = 'build';
    else if (this.targeting) kind = 'attack';
    else if (this.mode === 'attackMove') kind = 'attack';
    else if (this.mode === 'move') kind = 'move';
    else if (b.selection.hasSquads && !this.overUI(p)) {
      if (this.enemyAt(p)) kind = 'attack';
      else {
        const w = this.world(p);
        const pt = b.capture.points.find((c) => c.contains(w.x, w.y) && c.owner !== 'player');
        kind = pt ? 'capture' : 'move';
      }
    }
    b.hud?.setCursor(kind);
  }

  /** Voice acknowledgement from the first selected squad; a synth grunt if no line was spoken. */
  acknowledge(kind: 'select' | 'move' | 'attack' | 'capture' = 'select'): void {
    const s = this.battle.selection.squads[0];
    if (!s) return;
    if (VoiceBridge.acknowledge(s, kind)) return;
    const pitch = s.def.id === 'commander' ? 0.7 : s.def.id === 'heavy' ? 0.82 : 1;
    AudioSystem.grunt(pitch);
  }

  /** Which acknowledgement fits an order at this pointer position. */
  private orderKind(p: Phaser.Input.Pointer, enemy: boolean): 'move' | 'attack' | 'capture' {
    if (enemy) return 'attack';
    const w = this.world(p);
    return this.battle.capture.points.some((c) => c.contains(w.x, w.y) && c.owner !== 'player') ? 'capture' : 'move';
  }

  reinforceSelected(): void {
    for (const s of this.battle.selection.squads) this.battle.units.reinforce(s);
  }

  retreatSelected(): void {
    const squads = this.battle.selection.squads;
    squads.forEach((s) => s.retreat());
    if (squads.length) VoiceBridge.retreat(squads[0]);
  }

  /** Control groups (Ctrl/Alt+1-9 assign, Shift+1-9 add, 1-9 select, double tap centres), Ctrl+A, '.' idle cycling. */
  private onKey(e: KeyboardEvent): void {
    const b = this.battle;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
      e.preventDefault();
      b.selection.selectSquads(b.units.getSquads('player'));
      return;
    }
    if (e.code === 'Period' || e.code === 'NumpadDecimal') {
      this.cycleIdle();
      return;
    }
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (!m) return;
    const n = Number(m[1]);
    const sel = b.selection.squads.filter((s) => s.alive);
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      if (!sel.length) return;
      this.groups.set(n, sel.slice());
      b.events.emit(EV.message, 'note.group', { n });
      return;
    }
    if (e.shiftKey) {
      if (!sel.length) return;
      const g = (this.groups.get(n) ?? []).filter((s) => s.alive);
      for (const s of sel) if (!g.includes(s)) g.push(s);
      this.groups.set(n, g);
      b.events.emit(EV.message, 'note.group', { n });
      return;
    }
    const g = (this.groups.get(n) ?? []).filter((s) => s.alive);
    if (!g.length) return;
    this.groups.set(n, g);
    const now = b.time.now;
    if (this.lastGroupTap.n === n && now - this.lastGroupTap.at < DOUBLE_MS) {
      const c = g[0].center;
      b.cameraSystem.centerOn(c.x, c.y);
    }
    this.lastGroupTap = { n, at: now };
    b.selection.selectSquads(g);
  }

  /** Selects and centres on the next player squad with nothing to do. */
  private cycleIdle(): void {
    const b = this.battle;
    const idle = b.units.getSquads('player').filter((s) => s.order === 'idle' && !s.engaged && !s.isMoving());
    if (!idle.length) return;
    const s = idle[this.idleIndex++ % idle.length];
    b.selection.selectSquads([s]);
    b.cameraSystem.centerOn(s.center.x, s.center.y);
  }

  /** Every player squad of the same type visible on screen. */
  private selectSameType(squad: Squad): void {
    const b = this.battle;
    const view = b.cameras.main.worldView;
    const same = b.units.getSquads('player').filter((s) => s.def.id === squad.def.id
      && s.units.some((u) => view.contains(u.x, Projection.vy(u.y))));
    b.selection.selectSquads(same);
  }

  private overUI(p: Phaser.Input.Pointer): boolean {
    return this.battle.hud?.isOverUI(p.x, p.y) ?? false;
  }

  /** Pointer → logical ground point (through the tilted projection). */
  private world(p: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return this.battle.cameraSystem.screenToWorld(p.x, p.y);
  }

  /** Pointer → projected view point (where sprites are drawn). */
  private view(p: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return this.battle.cameraSystem.screenToView(p.x, p.y);
  }

  /** Visible enemy squad or building drawn under the pointer. */
  enemyAt(p: Phaser.Input.Pointer): Target | null {
    const v = this.view(p);
    const s = this.battle.units.squadAtView(v.x, v.y, 'enemy');
    if (s && s.units.some((u) => u.isShown)) return s;
    const b = this.battle.buildings.buildingAtView(v.x, v.y);
    return b && b.owner === 'enemy' && b.discovered ? b : null;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.overUI(p)) return;
    const b = this.battle;
    if (p.rightButtonDown()) {
      if (this.targeting) this.targeting = null;
      else if (b.placement.isActive) b.placement.cancel();
      else if (this.mode !== 'none') this.setMode('none');
      else this.issueRightClick(p);
      return;
    }
    if (p.leftButtonDown()) this.downAt = new Phaser.Math.Vector2(p.x, p.y);
  }

  private issueRightClick(p: Phaser.Input.Pointer): void {
    const sel = this.battle.selection;
    const w = this.world(p);
    if (sel.hasSquads) {
      const enemy = this.enemyAt(p);
      const v = this.view(p);
      const own = enemy ? undefined : this.battle.buildings.buildingAtView(v.x, v.y);
      // Infantry right-clicking a friendly transport climbs in.
      const ride = enemy ? undefined : this.battle.units.squadAtView(v.x, v.y, 'player');
      if (ride && ride.def.transport) {
        const riders = sel.squads.filter((s) => this.battle.vehicles.canBoard(s, ride));
        if (riders.length) {
          riders.slice(0, ride.def.transport - ride.cargo.length).forEach((s) => s.board(ride));
          this.battle.effects.orderMarker(ride.center.x, ride.center.y, false);
          this.acknowledge('move');
          return;
        }
      }
      // Infantry right-clicking a friendly bunker shelters inside.
      if (own && own.def.garrison) {
        const inf = sel.squads.filter((s) => this.battle.structures.canGarrison(s, own));
        if (inf.length) {
          inf.slice(0, own.def.garrison - own.garrison.length).forEach((s) => s.enterBunker(own));
          this.battle.effects.orderMarker(own.x, own.y, false);
          this.acknowledge('move');
          return;
        }
      }
      // Engineers right-clicking a wreck strip it for Scrip.
      const wreck = enemy ? null : this.battle.wrecks.wreckAtView(v.x, v.y);
      const salvagers = wreck ? sel.squads.filter((s) => s.def.repairRate) : [];
      if (wreck && salvagers.length) {
        salvagers.forEach((s) => {
          s.stop();
          s.salvageTarget = wreck;
        });
        this.battle.effects.orderMarker(wreck.x, wreck.y, false);
        if (!VoiceBridge.repair(salvagers[0])) this.acknowledge('move');
        return;
      }
      // Ruins: engineers strip them for scrap, other infantry dig into the rubble.
      const ruin = enemy || own ? null : this.battle.wrecks.ruinAtView(v.x, v.y);
      if (ruin) {
        const eng = sel.squads.filter((s) => s.def.repairRate);
        const inf = sel.squads.filter((s) => !s.def.repairRate && s.def.category === 'infantry');
        eng.forEach((s) => {
          s.stop();
          s.salvageTarget = ruin;
        });
        if (inf.length) {
          this.moveSquads(inf, ruin.x, ruin.y, false);
          inf.forEach((s) => (s.holdOnArrival = true));
        }
        if (eng.length || inf.length) {
          this.battle.effects.orderMarker(ruin.x, ruin.y, false);
          this.acknowledge('move');
          return;
        }
      }
      const fixers = own && own.owner === 'player' && (own.hp < own.maxHp || !own.isReady) ? sel.squads.filter((s) => s.def.repairRate) : [];
      if (own && fixers.length) {
        fixers.forEach((s) => s.repair(own));
        const rest = sel.squads.filter((s) => !fixers.includes(s));
        if (rest.length) this.moveSquads(rest, w.x, w.y, false, isShift(p));
        this.battle.effects.orderMarker(own.x, own.y, false);
        if (!VoiceBridge.repair(fixers[0])) this.acknowledge('move');
        return;
      }
      if (enemy) sel.squads.forEach((s) => s.attack(enemy));
      else this.moveSquads(sel.squads, w.x, w.y, false, isShift(p));
      this.battle.effects.orderMarker(w.x, w.y, !!enemy);
      this.acknowledge(this.orderKind(p, !!enemy));
    } else if (sel.building && sel.building.def.produces.length) {
      sel.building.rally = { x: w.x, y: w.y };
      this.battle.effects.orderMarker(w.x, w.y, false);
    }
  }

  /** Spreads several squads in a grid around the destination; `queue` appends a waypoint. */
  moveSquads(squads: Squad[], x: number, y: number, attackMove: boolean, queue = false): void {
    const cols = Math.ceil(Math.sqrt(squads.length));
    const spacing = 90;
    squads.forEach((s, i) => {
      const cx = (i % cols) - (cols - 1) / 2;
      const cy = Math.floor(i / cols) - (Math.ceil(squads.length / cols) - 1) / 2;
      const p = this.battle.units.findOpenSpot(x + cx * spacing, y + cy * spacing);
      s.moveTo(p.x, p.y, attackMove, queue);
    });
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (!this.downAt || p.button !== 0) return;
    const start = this.downAt;
    this.downAt = null;
    this.dragRect.clear();
    const b = this.battle;
    const dragged = Phaser.Math.Distance.Between(start.x, start.y, p.x, p.y) > DRAG_THRESHOLD;
    if (!dragged && this.overUI(p)) return;
    const shift = isShift(p);
    const w = this.world(p);
    if (this.targeting && !dragged && this.confirmTarget(p)) return;
    if (b.placement.isActive) {
      if (dragged && b.placement.draggable) {
        const a = b.cameraSystem.screenToWorld(start.x, start.y);
        if (b.placement.placeLine(a.x, a.y, w.x, w.y) > 0 && !shift) b.placement.cancel();
        return;
      }
      b.placement.updatePointer(w.x, w.y);
      b.placement.confirm(shift);
      return;
    }
    if (this.mode !== 'none' && !dragged) {
      const enemy = this.enemyAt(p);
      if (enemy && this.mode === 'attackMove') b.selection.squads.forEach((s) => s.attack(enemy));
      else this.moveSquads(b.selection.squads, w.x, w.y, this.mode === 'attackMove', shift);
      b.effects.orderMarker(w.x, w.y, this.mode === 'attackMove');
      this.acknowledge(this.mode === 'attackMove' ? 'attack' : this.orderKind(p, !!enemy));
      // Shift keeps the order mode for chaining waypoints.
      if (!shift) this.setMode('none');
      return;
    }
    if (dragged) {
      const a = b.cameraSystem.screenToView(start.x, start.y);
      const v = this.view(p);
      const rect = new Phaser.Geom.Rectangle(Math.min(a.x, v.x), Math.min(a.y, v.y), Math.abs(v.x - a.x), Math.abs(v.y - a.y));
      const found = b.units.squadsInViewRect(rect, 'player');
      if (found.length || !shift) b.selection.selectSquads(found, shift);
      if (found.length) this.acknowledge();
      return;
    }
    const v = this.view(p);
    const squad = b.units.squadAtView(v.x, v.y, 'player');
    if (squad) {
      const now = b.time.now;
      if (!shift && this.lastClick.id === squad.def.id && now - this.lastClick.at < DOUBLE_MS) {
        this.selectSameType(squad);
        this.lastClick = { id: '', at: 0 };
        return;
      }
      this.lastClick = { id: squad.def.id, at: now };
      if (shift) b.selection.toggleSquad(squad);
      else b.selection.selectSquads([squad]);
      this.acknowledge();
      return;
    }
    const building = b.buildings.buildingAtView(v.x, v.y);
    if (building && building.owner === 'player') b.selection.selectBuilding(building);
    else if (!shift) b.selection.clear();
  }

  /** Dashed lines from each selected squad through its queued waypoints. */
  private drawWaypoints(): void {
    const g = this.waypointLines.clear();
    for (const s of this.battle.selection.squads) {
      if (!s.waypoints.length && !s.moveGoal) continue;
      if (!s.isMoving() && !s.waypoints.length) continue;
      let px = s.center.x;
      let py = Projection.vy(s.center.y);
      const pts = [...(s.moveGoal && s.isMoving() ? [{ ...s.moveGoal, attack: s.order === 'attackMove' }] : []), ...s.waypoints];
      for (const w of pts) {
        const wy = Projection.vy(w.y);
        g.lineStyle(1.5, w.attack ? 0xff6040 : 0x60ff70, 0.55).lineBetween(px, py, w.x, wy);
        g.fillStyle(w.attack ? 0xff6040 : 0x60ff70, 0.8).fillCircle(w.x, wy, 3);
        px = w.x;
        py = wy;
      }
    }
  }

  /** Per-frame: draw the drag rectangle. */
  update(): void {
    this.refreshCursor();
    this.drawWaypoints();
    this.drawAim();
    const g = this.dragRect;
    if (!this.downAt || this.battle.placement.isActive) return;
    const p = this.battle.input.activePointer;
    if (!p.leftButtonDown()) return;
    if (Phaser.Math.Distance.Between(this.downAt.x, this.downAt.y, p.x, p.y) <= DRAG_THRESHOLD) return;
    const a = this.battle.cameraSystem.screenToView(this.downAt.x, this.downAt.y);
    const w = this.view(p);
    g.clear().fillStyle(0x40ff60, 0.12).lineStyle(1, 0x40ff60, 0.9);
    g.fillRect(Math.min(a.x, w.x), Math.min(a.y, w.y), Math.abs(w.x - a.x), Math.abs(w.y - a.y));
    g.strokeRect(Math.min(a.x, w.x), Math.min(a.y, w.y), Math.abs(w.x - a.x), Math.abs(w.y - a.y));
  }

  destroy(): void {
    const input = this.battle.input;
    input.off('pointerdown', this.onDown, this);
    input.off('pointerup', this.onUp, this);
  }
}
