import Phaser from 'phaser';
import type { BattleScene } from './BattleScene';
import { TopBar, TOP_BAR_H } from '../ui/TopBar';
import { BuildToolbar } from '../ui/BuildToolbar';
import { SelectionPanel } from '../ui/SelectionPanel';
import { MiniMap } from '../ui/MiniMap';
import { showEndScreen } from '../ui/EndScreen';
import { BattleResult } from './BattleTypes';
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
  private panel!: SelectionPanel;
  private minimap!: MiniMap;
  private tooltip!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private messageTimer?: Phaser.Time.TimerEvent;
  private blockers: Blocker[] = [];
  private ended = false;

  constructor() {
    super('HudScene');
  }

  init(data: { battle: BattleScene }): void {
    this.battle = data.battle;
    this.blockers = [];
    this.ended = false;
  }

  create(): void {
    this.topBar = new TopBar(this, this.battle.resources);
    this.addBlocker(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, TOP_BAR_H));
    this.toolbar = new BuildToolbar(this, this.battle);
    this.toolbar.setVisible(false);
    this.addBlocker(this.toolbar.bounds, () => this.toolbar.container.visible);
    this.tooltip = this.add.text(0, 0, '', { ...textStyle(13), backgroundColor: '#10101cee', padding: { x: 8, y: 6 } });
    this.tooltip.setOrigin(0.5, 1).setDepth(100).setVisible(false);
    this.panel = new SelectionPanel(this, this.battle, (t, x, y) => this.showTooltip(t, x, y));
    this.addBlocker(this.panel.bounds, () => this.panel.visible);
    this.minimap = new MiniMap(this, this.battle);
    this.addBlocker(this.minimap.bounds);
    this.messageText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 200, '', textStyle(18, '#ffd060'));
    this.messageText.setOrigin(0.5).setStroke('#000', 4).setVisible(false);

    const onSel = (): void => this.refreshSelection();
    const onMsg = (m: string): void => this.showMessage(m);
    const onEnd = (r: BattleResult): void => {
      this.ended = true;
      this.addBlocker(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT));
      this.time.delayedCall(1200, () => showEndScreen(this, this.battle, r));
    };
    this.battle.events.on(EV.selectionChanged, onSel);
    this.battle.events.on(EV.message, onMsg);
    this.battle.events.on(EV.battleEnded, onEnd);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.battle.events.off(EV.selectionChanged, onSel);
      this.battle.events.off(EV.message, onMsg);
      this.battle.events.off(EV.battleEnded, onEnd);
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

  showTooltip(text: string | null, x: number, y: number): void {
    if (!text) {
      this.tooltip.setVisible(false);
      return;
    }
    this.tooltip.setText(text).setVisible(true);
    const half = this.tooltip.width / 2;
    this.tooltip.setPosition(Phaser.Math.Clamp(x, half + 4, GAME_WIDTH - half - 4), y - 6);
  }

  setCursor(kind: 'default' | 'move' | 'attack'): void {
    const css = kind === 'attack' ? 'crosshair' : kind === 'move' ? 'pointer' : 'default';
    this.input.setDefaultCursor(css);
  }

  private refreshSelection(): void {
    this.panel.refresh();
    const b = this.battle.selection.building;
    this.toolbar.setVisible(!!b && b.def.role === 'hq');
  }

  update(): void {
    if (this.ended) return;
    this.topBar.update(formatTime(this.battle.elapsed));
    this.toolbar.update();
    this.panel.update();
    this.minimap.update();
  }
}
