import Phaser from 'phaser';
import { DEPTH } from '../config';
import { Squad, Target, targetPos } from '../units/Squad';
import type { BattleScene } from '../scenes/BattleScene';

const DRAG_THRESHOLD = 8;
export type CommandMode = 'none' | 'move' | 'attackMove';

export function isShift(p: Phaser.Input.Pointer): boolean {
  const e = p.event as MouseEvent | undefined;
  return !!e && 'shiftKey' in e && e.shiftKey;
}

/** Routes world mouse input to placement, selection and orders. */
export class InputController {
  mode: CommandMode = 'none';
  private downAt: Phaser.Math.Vector2 | null = null;
  private dragRect: Phaser.GameObjects.Graphics;

  constructor(private battle: BattleScene) {
    const input = battle.input;
    input.on('pointerdown', this.onDown, this);
    input.on('pointerup', this.onUp, this);
    this.dragRect = battle.add.graphics().setDepth(DEPTH.overlay);
    const kb = input.keyboard;
    kb?.on('keydown-B', () => {
      const hq = battle.buildings.getHQ('player');
      if (hq) battle.selection.selectBuilding(hq);
    });
    kb?.on('keydown-R', () => this.reinforceSelected());
    kb?.on('keydown-H', () => battle.selection.squads.forEach((s) => s.hold()));
    kb?.on('keydown-X', () => battle.selection.squads.forEach((s) => s.stop()));
    kb?.on('keydown-M', () => this.setMode('move'));
    kb?.on('keydown-G', () => this.setMode('attackMove'));
    kb?.on('keydown-Q', () => battle.selection.selectSquads(battle.units.getSquads('player')));
    kb?.on('keydown-ESC', () => this.setMode('none'));
    kb?.on('keydown-SPACE', () => {
      const s = battle.selection.squads[0] ?? battle.selection.building;
      if (!s) return;
      const pos = targetPos(s);
      battle.cameraSystem.centerOn(pos.x, pos.y);
    });
  }

  setMode(m: CommandMode): void {
    this.mode = this.battle.selection.hasSquads ? m : 'none';
    this.battle.hud?.setCursor(this.mode === 'attackMove' ? 'attack' : this.mode === 'move' ? 'move' : 'default');
  }

  reinforceSelected(): void {
    for (const s of this.battle.selection.squads) this.battle.units.reinforce(s);
  }

  private overUI(p: Phaser.Input.Pointer): boolean {
    return this.battle.hud?.isOverUI(p.x, p.y) ?? false;
  }

  private world(p: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return this.battle.cameras.main.getWorldPoint(p.x, p.y);
  }

  /** Visible enemy squad or building under a world point. */
  enemyAt(wx: number, wy: number): Target | null {
    const s = this.battle.units.squadAt(wx, wy, 'enemy');
    if (s && s.units.some((u) => u.isShown)) return s;
    const b = this.battle.buildings.buildingAt(wx, wy);
    return b && b.owner === 'enemy' && b.discovered ? b : null;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.overUI(p)) return;
    const b = this.battle;
    if (p.rightButtonDown()) {
      if (b.placement.isActive) b.placement.cancel();
      else if (this.mode !== 'none') this.setMode('none');
      else this.issueRightClick(this.world(p));
      return;
    }
    if (p.leftButtonDown()) this.downAt = new Phaser.Math.Vector2(p.x, p.y);
  }

  private issueRightClick(w: Phaser.Math.Vector2): void {
    const sel = this.battle.selection;
    if (sel.hasSquads) {
      const enemy = this.enemyAt(w.x, w.y);
      if (enemy) sel.squads.forEach((s) => s.attack(enemy));
      else this.moveSquads(sel.squads, w.x, w.y, false);
      this.battle.effects.orderMarker(w.x, w.y, !!enemy);
    } else if (sel.building && sel.building.def.produces.length) {
      sel.building.rally = { x: w.x, y: w.y };
      this.battle.effects.orderMarker(w.x, w.y, false);
    }
  }

  /** Spreads several squads in a grid around the destination. */
  moveSquads(squads: Squad[], x: number, y: number, attackMove: boolean): void {
    const cols = Math.ceil(Math.sqrt(squads.length));
    const spacing = 90;
    squads.forEach((s, i) => {
      const cx = (i % cols) - (cols - 1) / 2;
      const cy = Math.floor(i / cols) - (Math.ceil(squads.length / cols) - 1) / 2;
      const p = this.battle.units.findOpenSpot(x + cx * spacing, y + cy * spacing);
      s.moveTo(p.x, p.y, attackMove);
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
    if (b.placement.isActive) {
      b.placement.confirm(shift);
      return;
    }
    if (this.mode !== 'none' && !dragged) {
      const enemy = this.enemyAt(w.x, w.y);
      if (enemy && this.mode === 'attackMove') b.selection.squads.forEach((s) => s.attack(enemy));
      else this.moveSquads(b.selection.squads, w.x, w.y, this.mode === 'attackMove');
      b.effects.orderMarker(w.x, w.y, this.mode === 'attackMove');
      this.setMode('none');
      return;
    }
    if (dragged) {
      const a = b.cameras.main.getWorldPoint(start.x, start.y);
      const rect = new Phaser.Geom.Rectangle(Math.min(a.x, w.x), Math.min(a.y, w.y), Math.abs(w.x - a.x), Math.abs(w.y - a.y));
      const found = b.units.squadsInRect(rect, 'player');
      if (found.length || !shift) b.selection.selectSquads(found, shift);
      return;
    }
    const squad = b.units.squadAt(w.x, w.y, 'player');
    if (squad) {
      if (shift) b.selection.toggleSquad(squad);
      else b.selection.selectSquads([squad]);
      return;
    }
    const building = b.buildings.buildingAt(w.x, w.y);
    if (building && building.owner === 'player') b.selection.selectBuilding(building);
    else if (!shift) b.selection.clear();
  }

  /** Per-frame: draw the drag rectangle. */
  update(): void {
    const g = this.dragRect;
    if (!this.downAt || this.battle.placement.isActive) return;
    const p = this.battle.input.activePointer;
    if (!p.leftButtonDown()) return;
    if (Phaser.Math.Distance.Between(this.downAt.x, this.downAt.y, p.x, p.y) <= DRAG_THRESHOLD) return;
    const a = this.battle.cameras.main.getWorldPoint(this.downAt.x, this.downAt.y);
    const w = this.world(p);
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
