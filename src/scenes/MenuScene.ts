import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TITLE_FONT } from '../config';
import { headingFont, onLanguageChange, t, touchKey } from '../i18n';
import { CampaignState } from '../campaign/CampaignState';
import { MenuBackground } from '../ui/MenuBackground';
import { Button } from '../ui/Button';
import { drawPanel, textStyle } from '../ui/uiStyle';
import { Settings } from '../systems/Settings';
import { SkirmishSetup } from '../ui/SkirmishSetup';
import { RecordsPanel } from '../ui/RecordsPanel';
import { Ambience } from '../systems/Ambience';
import { Platform } from '../platform/Platform';

export class MenuScene extends Phaser.Scene {
  private bg!: MenuBackground;
  private busy = false;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.busy = false;
    this.input.setDefaultCursor('default');
    this.bg = new MenuBackground(this);
    // Rebuild the menu in the new language as soon as it changes.
    const off = onLanguageChange(() => this.scene.restart());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    Ambience.menu();
    // The menu is the first playable screen: tell Yandex loading is over (sent once).
    Platform.ready();
    Platform.setGameplay(false);
    // The glow is drawn inside the text's own canvas: without padding its blur is cut off into a hard rectangle.
    const pad = 48;
    const logo = this.add.text(GAME_WIDTH / 2, 170, 'VOIDCRUSADE', {
      fontFamily: TITLE_FONT, fontSize: '104px', fontStyle: '900', stroke: '#1a0000', strokeThickness: 8,
      shadow: { offsetX: 0, offsetY: 0, color: '#ff2010', blur: 28, fill: false, stroke: true },
      padding: { x: pad, y: pad },
    }).setOrigin(0.5);
    const grd = logo.context.createLinearGradient(0, pad, 0, logo.height - pad);
    grd.addColorStop(0, '#fff4d0');
    grd.addColorStop(0.45, '#c8a060');
    grd.addColorStop(0.55, '#8a5a20');
    grd.addColorStop(1, '#e0c080');
    logo.setFill(grd);
    logo.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: logo, scale: 1, alpha: 1, duration: 1200, ease: 'Cubic.easeOut' });
    const sub = this.add.text(GAME_WIDTH / 2, 262, t('menu.subtitle'),
      { ...textStyle(24, '#c8c8d8'), fontStyle: 'italic' }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 1200, delay: 600 });

    const hasSave = !!CampaignState.load();
    const items: [string, () => void][] = [
      [t('menu.newCampaign'), () => this.newCampaign()],
      ...(hasSave ? [[t('menu.continue'), () => this.go('CampaignScene', {})] as [string, () => void]] : []),
      [t('menu.skirmish'), () => this.openSkirmish()],
      [t('menu.records'), () => this.openRecords()],
      [t('menu.tutorial'), () => this.openTutorial()],
      [t('menu.encyclopedia'), () => this.openEncyclopedia()],
      [t('menu.settings'), () => this.openSettings()],
    ];
    items.forEach(([label, fn], i) => {
      const b = new Button(this, { x: GAME_WIDTH / 2, y: 330 + i * 54, w: 300, h: 44, label, onClick: () => !this.busy && fn() });
      b.container.setAlpha(0);
      this.tweens.add({ targets: b.container, alpha: 1, duration: 500, delay: 900 + i * 120 });
    });
    this.add.text(GAME_WIDTH - 12, GAME_HEIGHT - 10, t(touchKey('menu.hint')),
      textStyle(12, '#667')).setOrigin(1, 1);
    this.input.keyboard?.on('keydown-F1', () => !this.busy && this.openEncyclopedia());
    if (!Settings.get().tutorialPrompted) this.time.delayedCall(700, () => this.firstRun());
  }

  /** First launch: straight into lesson 1, the game teaches itself by play (no question first). */
  private firstRun(): void {
    if (this.busy) return;
    Settings.set({ tutorialPrompted: true });
    this.startLesson(1);
  }

  private startLesson(lesson: 1 | 2): void {
    this.go('BattleScene', { mode: 'tutorial', difficulty: 'easy', lesson });
  }

  /** Lesson 1 until it is done; after that a choice between the two lessons. */
  private openTutorial(): void {
    if ((Settings.get().tutorialDone ?? 0) < 1) {
      this.startLesson(1);
      return;
    }
    this.confirm(t('tutMenu.title'), t('tutMenu.body'), t('tutMenu.lesson2'), t('tutMenu.lesson1'),
      () => this.startLesson(2), () => this.startLesson(1));
  }

  /** "New Campaign" over a campaign in progress overwrites it, so ask first. */
  private newCampaign(): void {
    const save = CampaignState.load();
    const inProgress = !!save && !save.won && (save.battles > 0 || save.owned.length > 1);
    if (!inProgress) {
      this.go('CampaignScene', { fresh: true });
      return;
    }
    this.confirm(t('newCamp.title'), t('newCamp.body'), t('newCamp.yes'), t('newCamp.no'),
      () => this.go('CampaignScene', { fresh: true }));
  }

  /**
   * A modal yes/no panel over the menu; "no" closes it (and runs `onNo` if given). With an `onNo`
   * both buttons act, so a click on the dark backdrop is the way to just close it.
   */
  private confirm(titleText: string, bodyText: string, yesLabel: string, noLabel: string, onYes: () => void, onNo?: () => void): void {
    this.busy = true;
    const root = this.add.container(0, 0).setDepth(300);
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    drawPanel(g, GAME_WIDTH / 2 - 260, GAME_HEIGHT / 2 - 110, 520, 220);
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, titleText, { fontFamily: headingFont(), fontSize: '30px', color: '#ffd060' }).setOrigin(0.5);
    const body = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12, bodyText, { ...textStyle(15, '#d8d0c0'), align: 'center', wordWrap: { width: 460 } }).setOrigin(0.5);
    const yes = new Button(this, { x: GAME_WIDTH / 2 - 110, y: GAME_HEIGHT / 2 + 60, w: 190, h: 42, label: yesLabel, onClick: () => {
      root.destroy();
      this.busy = false;
      onYes();
    } });
    const no = new Button(this, { x: GAME_WIDTH / 2 + 110, y: GAME_HEIGHT / 2 + 60, w: 190, h: 42, label: noLabel, onClick: () => {
      root.destroy();
      this.busy = false;
      onNo?.();
    } });
    if (onNo) dim.on('pointerdown', () => {
      root.destroy();
      this.busy = false;
    });
    root.add([dim, g, title, body, yes.container, no.container]);
  }

  private openEncyclopedia(): void {
    this.busy = true;
    this.scene.launch('EncyclopediaScene', { onClose: () => (this.busy = false) });
    this.scene.bringToTop('EncyclopediaScene');
  }

  private go(key: string, data: object): void {
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.busy = true;
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key, data));
  }

  private openSettings(): void {
    this.busy = true;
    this.scene.launch('SettingsScene', { onClose: () => (this.busy = false) });
    this.scene.bringToTop('SettingsScene');
  }

  private openSkirmish(): void {
    this.busy = true;
    new SkirmishSetup(this, (data) => this.go('BattleScene', data),
      () => (this.busy = false));
  }

  private openRecords(): void {
    this.busy = true;
    new RecordsPanel(this, () => (this.busy = false));
  }

  update(_t: number, delta: number): void {
    this.bg.update(delta / 1000);
  }
}
