import Phaser from 'phaser';
import type { BattleScene } from './BattleScene';
import { TopBar, TOP_BAR_H } from '../ui/TopBar';
import { formatTime } from '../ui/uiStyle';
import { GAME_WIDTH } from '../config';

/** Screen-space HUD overlay running on top of BattleScene. */
export class HudScene extends Phaser.Scene {
  battle!: BattleScene;
  private topBar!: TopBar;
  /** Screen rects that swallow world clicks. */
  private blockers: Phaser.Geom.Rectangle[] = [];

  constructor() {
    super('HudScene');
  }

  init(data: { battle: BattleScene }): void {
    this.battle = data.battle;
    this.blockers = [];
  }

  create(): void {
    this.topBar = new TopBar(this, this.battle.resources);
    this.addBlocker(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, TOP_BAR_H));
  }

  addBlocker(r: Phaser.Geom.Rectangle): void {
    this.blockers.push(r);
  }

  /** True if a screen point is over an active HUD element. */
  isOverUI(x: number, y: number): boolean {
    return this.blockers.some((r) => r.contains(x, y));
  }

  update(): void {
    this.topBar.update(formatTime(this.battle.elapsed));
  }
}
