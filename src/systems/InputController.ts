import Phaser from 'phaser';
import type { BattleScene } from '../scenes/BattleScene';

const DRAG_THRESHOLD = 8;

export function isShift(p: Phaser.Input.Pointer): boolean {
  const e = p.event as MouseEvent | undefined;
  return !!e && 'shiftKey' in e && e.shiftKey;
}

/** Routes world mouse input to placement, selection and orders. */
export class InputController {
  private downAt: Phaser.Math.Vector2 | null = null;

  constructor(private battle: BattleScene) {
    const input = battle.input;
    input.on('pointerdown', this.onDown, this);
    input.on('pointermove', this.onMove, this);
    input.on('pointerup', this.onUp, this);
  }

  private overUI(p: Phaser.Input.Pointer): boolean {
    return this.battle.hud?.isOverUI(p.x, p.y) ?? false;
  }

  private world(p: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return this.battle.cameras.main.getWorldPoint(p.x, p.y);
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.overUI(p)) return;
    const b = this.battle;
    if (p.rightButtonDown()) {
      if (b.placement.isActive) b.placement.cancel();
      return;
    }
    if (p.leftButtonDown()) this.downAt = new Phaser.Math.Vector2(p.x, p.y);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const w = this.world(p);
    this.battle.placement.updatePointer(w.x, w.y);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (!this.downAt || p.button !== 0) return;
    const start = this.downAt;
    this.downAt = null;
    if (this.overUI(p)) return;
    const b = this.battle;
    const dragged = Phaser.Math.Distance.Between(start.x, start.y, p.x, p.y) > DRAG_THRESHOLD;
    const shift = isShift(p);
    if (b.placement.isActive) {
      b.placement.confirm(shift);
      return;
    }
    if (dragged) return;
    const w = this.world(p);
    const building = b.buildings.buildingAt(w.x, w.y);
    if (building && building.owner === 'player') b.selection.selectBuilding(building);
    else b.selection.clear();
  }

  destroy(): void {
    const input = this.battle.input;
    input.off('pointerdown', this.onDown, this);
    input.off('pointermove', this.onMove, this);
    input.off('pointerup', this.onUp, this);
  }
}
