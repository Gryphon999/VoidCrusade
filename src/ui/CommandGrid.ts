import Phaser from 'phaser';
import { HUD } from './HudArt';
import { IconButton } from './IconButton';
import { Tooltip } from './Tooltip';

export interface Command {
  icon: string;
  title: string;
  /** Tooltip body (cost, time, description). */
  body?: () => string;
  hotkey?: string;
  /** Phaser key name if the grid itself should handle the hotkey. */
  key?: string;
  onClick: () => void;
  enabled?: () => boolean;
  active?: () => boolean;
  progress?: () => number | null;
  badge?: () => string;
}

const COLS = 7;
const ROWS = 2;

/** Right-hand command grid: build / train / research / orders. */
export class CommandGrid {
  private buttons: IconButton[] = [];
  private cmds: Command[] = [];

  constructor(scene: Phaser.Scene, private tip: Tooltip) {
    const g = HUD.grid;
    const cell = 62;
    const x0 = g.x + (g.w - COLS * cell) / 2 + cell / 2;
    const y0 = g.y + (g.h - ROWS * cell) / 2 + cell / 2;
    for (let i = 0; i < COLS * ROWS; i++) {
      const b = new IconButton(scene, x0 + (i % COLS) * cell, y0 + Math.floor(i / COLS) * cell);
      b.hide();
      this.buttons.push(b);
    }
    scene.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const c = this.cmds.find((x) => x.key && x.key === e.code);
      if (c && (c.enabled?.() ?? true)) c.onClick();
    });
  }

  setCommands(cmds: Command[]): void {
    this.cmds = cmds.slice(0, COLS * ROWS);
    this.buttons.forEach((b, i) => {
      const c = this.cmds[i];
      if (!c) {
        b.hide();
        b.onClick = () => undefined;
        b.onHover = () => undefined;
        return;
      }
      b.set(c.icon, c.hotkey ?? '');
      b.onClick = c.onClick;
      b.onHover = (over) => {
        if (over) this.tip.show(c.title, c.body?.() ?? '', b.container.x, b.container.y - b.size / 2);
        else this.tip.hide();
      };
    });
    this.update();
  }

  update(): void {
    this.cmds.forEach((c, i) => {
      const b = this.buttons[i];
      b.setEnabled(c.enabled?.() ?? true).setActive(c.active?.() ?? false).setProgress(c.progress?.() ?? null).setBadge(c.badge?.() ?? '');
    });
  }
}
