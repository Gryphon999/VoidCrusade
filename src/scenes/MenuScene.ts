import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, GOTHIC_FONT } from '../config';
import { onLanguageChange, t } from '../i18n';
import { CampaignState } from '../campaign/CampaignState';
import { MenuBackground } from '../ui/MenuBackground';
import { Button } from '../ui/Button';
import { textStyle } from '../ui/uiStyle';
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
      [t('menu.settings'), () => this.openSettings()],
    ];
    items.forEach(([label, fn], i) => {
      const b = new Button(this, { x: GAME_WIDTH / 2, y: 360 + i * 62, w: 300, h: 48, label, onClick: () => !this.busy && fn() });
      b.container.setAlpha(0);
      this.tweens.add({ targets: b.container, alpha: 1, duration: 500, delay: 900 + i * 120 });
    });
    this.add.text(GAME_WIDTH - 12, GAME_HEIGHT - 10, t('menu.hint'),
      textStyle(12, '#667')).setOrigin(1, 1);
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
