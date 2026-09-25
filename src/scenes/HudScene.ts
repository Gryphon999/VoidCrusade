import Phaser from 'phaser';
import type { BattleScene } from './BattleScene';
import { TopBar, TOP_BAR_H } from '../ui/TopBar';
import { SelectionPanel } from '../ui/SelectionPanel';
import { MiniMap } from '../ui/MiniMap';
import { CommandGrid } from '../ui/CommandGrid';
import { commandsFor } from '../ui/Commands';
import { Tooltip } from '../ui/Tooltip';
import { Notifications, NoticeKind } from '../ui/Notifications';
import { HUD } from '../ui/HudArt';
import { showEndScreen } from '../ui/EndScreen';
import { PauseMenu } from '../ui/PauseMenu';
import { CursorKind, getCursors } from '../assets/Cursors';
import { GAME_HEIGHT, GAME_WIDTH, GFX } from '../config';
import { Settings } from '../systems/Settings';
import { makeCanvas } from '../render/CanvasUtil';
import { BattleResult } from './BattleTypes';
import { formatTime } from '../ui/uiStyle';
import { EV } from '../events';
import { Building } from '../buildings/Building';
import { Squad } from '../units/Squad';
import { Unit } from '../units/Unit';
import { CapturePoint } from '../systems/CapturePoint';
import { Owner } from '../types';
import { AudioSystem } from '../systems/AudioSystem';
import { MessageKey, onLanguageChange, t } from '../i18n';
import { buildingName, unitName } from '../i18n/names';
import { BuildCategory } from '../buildings/BuildingDefs';

interface Blocker {
  rect: Phaser.Geom.Rectangle;
  active: () => boolean;
}

/** Screen-space HUD overlay running on top of BattleScene (Dawn of War style bottom frame). */
export class HudScene extends Phaser.Scene {
  battle!: BattleScene;
  private topBar!: TopBar;
  private panel!: SelectionPanel;
  private grid!: CommandGrid;
  private minimap!: MiniMap;
  private pause!: PauseMenu;
  private tooltip!: Tooltip;
  private notes!: Notifications;
  private blockers: Blocker[] = [];
  private ended = false;
  private grain?: Phaser.GameObjects.TileSprite;
  private lastAlarm = -99999;
  private cursor = '';
  /** Build-menu page shown while the HQ is selected. */
  private page: BuildCategory | null = null;
  private selectedBefore: unknown = null;

  constructor() {
    super('HudScene');
  }

  init(data: { battle: BattleScene }): void {
    this.battle = data.battle;
    this.blockers = [];
    this.ended = false;
    this.cursor = '';
    this.lastAlarm = -99999;
    this.page = null;
    this.selectedBefore = null;
  }

  create(): void {
    this.createGrain();
    this.add.image(0, GAME_HEIGHT, 'hud_bottom').setOrigin(0, 1);
    this.addBlocker(new Phaser.Geom.Rectangle(0, GAME_HEIGHT - HUD.bottomH, GAME_WIDTH, HUD.bottomH));
    // The crest plate pokes above the frame.
    this.addBlocker(new Phaser.Geom.Rectangle(780, GAME_HEIGHT - HUD.bottomH - 26, 70, 26));
    this.topBar = new TopBar(this, this.battle.resources);
    this.addBlocker(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, TOP_BAR_H));
    this.tooltip = new Tooltip(this);
    this.panel = new SelectionPanel(this, this.battle);
    this.grid = new CommandGrid(this, this.tooltip);
    this.minimap = new MiniMap(this, this.battle);
    this.notes = new Notifications(this);
    this.pause = new PauseMenu(this, this.battle);
    this.addBlocker(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT), () => this.pause.isOpen);
    this.topBar.pauseButton.on('pointerdown', () => this.pause.toggle());
    this.input.keyboard?.on('keydown-P', () => this.pause.toggle());
    this.input.keyboard?.on('keydown-F10', () => this.pause.toggle());
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.page && !this.battle.placement.isActive) this.setPage(null);
    });
    this.panel.refresh();
    this.wireEvents();
    // Language switch: rebuild the HUD in place (keeping the pause menu open if the battle is paused).
    const off = onLanguageChange(() => this.scene.restart({ battle: this.battle }));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    if (this.battle.scene.isPaused()) this.pause.open(true);
    this.refreshSelection();
  }

  private createGrain(): void {
    if (!GFX[Settings.get().graphics].grain) return;
    if (!this.textures.exists('grain')) {
      const { canvas, ctx } = makeCanvas(256, 256);
      const img = ctx.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      this.textures.addCanvas('grain', canvas);
    }
    this.grain = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'grain').setOrigin(0).setAlpha(0.045).setDepth(-10);
  }

  private wireEvents(): void {
    const ev = this.battle.events;
    const handlers: [string, (...a: never[]) => void][] = [
      [EV.selectionChanged, () => this.refreshSelection()],
      [EV.message, (m: MessageKey, p?: Record<string, string | number>) => this.notify(t(m, p), 'warn')],
      [EV.battleEnded, (r: BattleResult) => {
        this.ended = true;
        this.tooltip.hide();
        this.addBlocker(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT));
        this.time.delayedCall(1200, () => showEndScreen(this, this.battle, r));
      }],
      [EV.pointCaptured, (_p: CapturePoint, owner: Owner, old: Owner | null) => {
        if (owner === 'player') this.notify(t('note.captured'), 'good');
        else if (old === 'player') this.notify(t('note.lost'), 'bad');
      }],
      [EV.squadDestroyed, (s: Squad) => {
        if (s.owner === 'player') this.notify(t('note.squadLost', { name: unitName(s.def.id) }), 'bad');
      }],
      [EV.buildingComplete, (b: Building) => {
        if (b.owner === 'player') this.notify(t('note.complete', { name: buildingName(b.def.id) }), 'good');
      }],
      [EV.unitHit, (_x: number, _y: number, u: Unit) => {
        if (u.owner === 'player') this.alarm();
      }],
      [EV.buildingDamaged, (b: Building) => {
        if (b.owner === 'player') this.alarm();
      }],
      [EV.tierUp, () => this.refreshCommands()],
      [EV.buildingComplete, () => this.refreshCommands()],
    ];
    for (const [e, h] of handlers) ev.on(e, h);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const [e, h] of handlers) ev.off(e, h);
    });
  }

  /** "Under attack" at most every 20 s. */
  private alarm(): void {
    if (this.time.now - this.lastAlarm < 20000) return;
    this.lastAlarm = this.time.now;
    this.notify(t('note.underAttack'), 'bad');
    AudioSystem.horn();
  }

  notify(text: string, kind: NoticeKind = 'info'): void {
    this.notes.push(text, kind);
    this.events.emit('notice', text, kind);
  }

  addBlocker(rect: Phaser.Geom.Rectangle, active: () => boolean = () => true): void {
    this.blockers.push({ rect, active });
  }

  /** True if a screen point is over an active HUD element. */
  isOverUI(x: number, y: number): boolean {
    return this.blockers.some((b) => b.active() && b.rect.contains(x, y));
  }

  showMessage(key: MessageKey, params?: Record<string, string>): void {
    this.notify(t(key, params), 'warn');
  }

  setCursor(kind: CursorKind | 'default'): void {
    if (kind === this.cursor) return;
    this.cursor = kind;
    this.input.setDefaultCursor(kind === 'default' ? 'default' : getCursors()[kind]);
  }

  private refreshSelection(): void {
    const sel = this.battle.selection.building ?? this.battle.selection.squads[0] ?? null;
    if (sel !== this.selectedBefore) this.page = null;
    this.selectedBefore = sel;
    this.panel.refresh();
    this.refreshCommands();
  }

  private setPage(p: BuildCategory | null): void {
    this.page = p;
    this.refreshCommands();
  }

  /** Rebuilds the command grid (selection, page, tier or unlock changed). */
  refreshCommands(): void {
    this.grid.setCommands(commandsFor(this.battle, { page: this.page, setPage: (p) => this.setPage(p) }));
  }

  update(): void {
    this.grain?.setTilePosition(Math.random() * 256, Math.random() * 256);
    this.notes.update();
    if (this.ended) return;
    this.topBar.update(formatTime(this.battle.elapsed));
    const u = this.battle.units;
    const cap = this.battle.capture;
    this.topBar.setArmy(this.battle.production.supplyUsed('player'), u.supplyCap('player'), cap.countOwned('player'), cap.countOwned('enemy'),
      this.battle.tech.tierOf('player'));
    this.panel.update();
    this.grid.update();
    this.minimap.update();
  }
}
