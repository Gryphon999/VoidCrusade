import Phaser from 'phaser';
import { HUD } from './HudArt';
import { IconButton } from './IconButton';
import { Tooltip } from './Tooltip';

export interface Command {
  icon: string;
  title: string;
  /** Tooltip body (cost, time, description). */
  body?: () => string;
  /** Grid slot 0..13 (row-major); defaults to the next free slot. The hotkey follows the slot. */
  slot?: number;
  onClick: () => void;
  enabled?: () => boolean;
  /** Why the command is unavailable (tier / missing building); shown in red and as a padlock. */
  locked?: () => string | null;
  active?: () => boolean;
  progress?: () => number | null;
  badge?: () => string;
}

export const GRID_COLS = 7;
export const GRID_ROWS = 2;
/** Positional hotkeys: the grid mirrors the left-hand keyboard block. */
export const GRID_KEYS = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'A', 'S', 'D', 'F', 'G', 'H', 'J'];

/** Slot index for a hotkey letter (e.g. slotOf('A') === 7). */
export function slotOf(key: string): number {
  return GRID_KEYS.indexOf(key);
}

/** Right-hand command grid: build / train / research / orders. */
export class CommandGrid {
  private buttons: IconButton[] = [];
  private cmds: (Command | null)[] = [];
  private hovered = -1;

  constructor(scene: Phaser.Scene, private tip: Tooltip) {
    const g = HUD.grid;
    const cell = 62;
    const x0 = g.x + (g.w - GRID_COLS * cell) / 2 + cell / 2;
    const y0 = g.y + (g.h - GRID_ROWS * cell) / 2 + cell / 2;
    for (let i = 0; i < GRID_COLS * GRID_ROWS; i++) {
      const b = new IconButton(scene, x0 + (i % GRID_COLS) * cell, y0 + Math.floor(i / GRID_COLS) * cell);
      b.hide();
      this.buttons.push(b);
    }
    scene.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const i = GRID_KEYS.indexOf(e.key.toUpperCase());
      const c = i >= 0 ? this.cmds[i] : null;
      if (c && this.usable(c)) c.onClick();
    });
  }

  private usable(c: Command): boolean {
    return !(c.locked?.() ?? null) && (c.enabled?.() ?? true);
  }

  /** Lays commands out by slot (explicit slots first, then the rest in order). */
  setCommands(cmds: Command[]): void {
    const out: (Command | null)[] = new Array(GRID_COLS * GRID_ROWS).fill(null);
    for (const c of cmds) if (c.slot !== undefined && c.slot < out.length) out[c.slot] = c;
    let next = 0;
    for (const c of cmds) {
      if (c.slot !== undefined) continue;
      while (next < out.length && out[next]) next++;
      if (next < out.length) out[next] = c;
    }
    this.cmds = out;
    this.hovered = -1;
    this.tip.hide();
    this.buttons.forEach((b, i) => {
      const c = out[i];
      if (!c) {
        b.hide();
        b.onClick = () => undefined;
        b.onHover = () => undefined;
        return;
      }
      b.set(c.icon, GRID_KEYS[i]);
      b.onClick = () => {
        if (this.usable(c)) c.onClick();
      };
      b.onHover = (over) => {
        this.hovered = over ? i : -1;
        if (over) this.showTip(i);
        else this.tip.hide();
      };
    });
    this.update();
  }

  private showTip(i: number): void {
    const c = this.cmds[i];
    const b = this.buttons[i];
    if (!c) return;
    this.tip.show(c.title, c.body?.() ?? '', b.container.x, b.container.y - b.size / 2, c.locked?.() ?? '');
  }

  update(): void {
    this.cmds.forEach((c, i) => {
      if (!c) return;
      const b = this.buttons[i];
      const locked = !!(c.locked?.() ?? null);
      b.setLocked(locked).setEnabled(!locked && (c.enabled?.() ?? true)).setActive(c.active?.() ?? false)
        .setProgress(c.progress?.() ?? null).setBadge(c.badge?.() ?? '');
    });
    // Keep the tooltip live (costs, progress and lock state change while hovering).
    if (this.hovered >= 0) this.showTip(this.hovered);
  }
}
