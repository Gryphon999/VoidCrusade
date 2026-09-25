import Phaser from 'phaser';
import type { BattleScene } from './BattleScene';
import { TopBar, TOP_BAR_H } from '../ui/TopBar';
import { BuildToolbar } from '../ui/BuildToolbar';
import { formatTime, textStyle } from '../ui/uiStyle';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { EV } from '../events';

interface Blocker {
  rect: Phaser.Geom.Rectangle;
  active: () => boolean;
}

/** Screen-space HUD overlay running on top of BattleScene. */
export class HudScene extends Phaser.Scene {
  battle!: BattleScene;
  private topBar!: TopBar;
  private toolbar!: BuildToolbar;
  private messageText!: Phaser.GameObjects.Text;
  private messageTimer?: Phaser.Time.TimerEvent;
  private blockers: Blocker[] = [];

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
    this.toolbar = new BuildToolbar(this, this.battle);
    this.toolbar.setVisible(false);
    this.addBlocker(this.toolbar.bounds, () => this.toolbar.container.visible);
    this.messageText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 200, '', textStyle(18, '#ffd060'));
    this.messageText.setOrigin(0.5).setStroke('#000', 4).setVisible(false);

    const onSel = (): void => this.refreshSelection();
    const onMsg = (m: string): void => this.showMessage(m);
    this.battle.events.on(EV.selectionChanged, onSel);
    this.battle.events.on(EV.message, onMsg);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.battle.events.off(EV.selectionChanged, onSel);
      this.battle.events.off(EV.message, onMsg);
    });
  }

  addBlocker(rect: Phaser.Geom.Rectangle, active: () => boolean = () => true): void {
    this.blockers.push({ rect, active });
  }

  /** True if a screen point is over an active HUD element. */
  isOverUI(x: number, y: number): boolean {
    return this.blockers.some((b) => b.active() && b.rect.contains(x, y));
  }

  showMessage(msg: string): void {
    this.messageText.setText(msg).setVisible(true).setAlpha(1);
    this.messageTimer?.remove();
    this.messageTimer = this.time.delayedCall(2200, () => this.messageText.setVisible(false));
  }

  private refreshSelection(): void {
    const b = this.battle.selection.building;
    this.toolbar.setVisible(!!b && b.def.role === 'hq');
  }

  update(): void {
    this.topBar.update(formatTime(this.battle.elapsed));
    this.toolbar.update();
  }
}
