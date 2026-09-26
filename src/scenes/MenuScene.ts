import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, GOTHIC_FONT } from '../config';
import { headingFont, onLanguageChange, t } from '../i18n';
import { CampaignState } from '../campaign/CampaignState';
import { MenuBackground } from '../ui/MenuBackground';
import { Button } from '../ui/Button';
import { drawPanel, textStyle } from '../ui/uiStyle';
import { Settings } from '../systems/Settings';
import { SkirmishSetup } from '../ui/SkirmishSetup';
import { Ambience } from '../systems/Ambience';

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
    const logo = this.add.text(GAME_WIDTH / 2, 170, 'VOIDCRUSADE', {
      fontFamily: GOTHIC_FONT, fontSize: '120px', fontStyle: 'bold', stroke: '#1a0000', strokeThickness: 10,
      shadow: { offsetX: 0, offsetY: 0, color: '#ff2010', blur: 28, fill: false, stroke: true },
    }).setOrigin(0.5);
    const grd = logo.context.createLinearGradient(0, 0, 0, logo.height);
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
      [t('menu.newCampaign'), () => this.go('CampaignScene', { fresh: true })],
      ...(hasSave ? [[t('menu.continue'), () => this.go('CampaignScene', {})] as [string, () => void]] : []),
      [t('menu.skirmish'), () => this.openSkirmish()],
      [t('menu.tutorial'), () => this.go('BattleScene', { mode: 'tutorial', difficulty: 'easy' })],
      [t('menu.encyclopedia'), () => this.openEncyclopedia()],
      [t('menu.settings'), () => this.openSettings()],
    ];
    items.forEach(([label, fn], i) => {
      const b = new Button(this, { x: GAME_WIDTH / 2, y: 330 + i * 54, w: 300, h: 44, label, onClick: () => !this.busy && fn() });
      b.container.setAlpha(0);
      this.tweens.add({ targets: b.container, alpha: 1, duration: 500, delay: 900 + i * 120 });
    });
    this.add.text(GAME_WIDTH - 12, GAME_HEIGHT - 10, t('menu.hint'),
      textStyle(12, '#667')).setOrigin(1, 1);
    this.input.keyboard?.on('keydown-F1', () => !this.busy && this.openEncyclopedia());
    if (!Settings.get().tutorialPrompted) this.time.delayedCall(1600, () => this.promptTutorial());
  }

  /** Asked once per profile: offer the tutorial to new players. */
  private promptTutorial(): void {
    if (this.busy) return;
    Settings.set({ tutorialPrompted: true });
    this.busy = true;
    const root = this.add.container(0, 0).setDepth(300);
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    drawPanel(g, GAME_WIDTH / 2 - 260, GAME_HEIGHT / 2 - 110, 520, 220);
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, t('prompt.title'), { fontFamily: headingFont(), fontSize: '30px', color: '#ffd060' }).setOrigin(0.5);
    const body = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12, t('prompt.body'), { ...textStyle(15, '#d8d0c0'), align: 'center', wordWrap: { width: 460 } }).setOrigin(0.5);
    const yes = new Button(this, { x: GAME_WIDTH / 2 - 110, y: GAME_HEIGHT / 2 + 60, w: 190, h: 42, label: t('prompt.yes'), onClick: () => {
      root.destroy();
      this.busy = false;
      this.go('BattleScene', { mode: 'tutorial', difficulty: 'easy' });
    } });
    const no = new Button(this, { x: GAME_WIDTH / 2 + 110, y: GAME_HEIGHT / 2 + 60, w: 190, h: 42, label: t('prompt.no'), onClick: () => {
      root.destroy();
      this.busy = false;
    } });
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

  update(_t: number, delta: number): void {
    this.bg.update(delta / 1000);
  }
}
