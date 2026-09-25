import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { ResourceSystem } from '../systems/ResourceSystem';
import { HUD } from './HudArt';
import { textStyle } from './uiStyle';

export const TOP_BAR_H = HUD.topH;

/** Top HUD strip on a riveted metal plate: Scrip, Flux, squad cap, clock, Nexus count, pause. */
export class TopBar {
  private scripText: Phaser.GameObjects.Text;
  private fluxText: Phaser.GameObjects.Text;
  private timeText: Phaser.GameObjects.Text;
  private armyText: Phaser.GameObjects.Text;
  private pointsText: Phaser.GameObjects.Text;
  readonly pauseButton: Phaser.GameObjects.Text;
  readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, private resources: ResourceSystem) {
    const y = HUD.topH / 2 - 1;
    const bg = scene.add.image(0, 0, 'hud_top').setOrigin(0);
    const t = (x: number, color: string): Phaser.GameObjects.Text => scene.add.text(x, y, '', textStyle(17, color)).setOrigin(0, 0.5).setStroke('#000', 3);
    const scripIcon = scene.add.image(28, y, 'icon_scrip');
    this.scripText = t(46, '#f0c850');
    const fluxIcon = scene.add.image(236, y, 'icon_flux');
    this.fluxText = t(254, '#60e8ff');
    const armyIcon = scene.add.image(420, y, 'icon_squads');
    this.armyText = t(438, '#9cc8ff');
    const timeIcon = scene.add.image(580, y, 'icon_time');
    this.timeText = t(598, '#e8e0c8');
    const nexusIcon = scene.add.image(748, y, 'glyph_capture').setScale(0.5);
    this.pointsText = t(766, '#e8e0c8');
    this.pauseButton = scene.add.text(GAME_WIDTH - 16, y, '❚❚  Pause', textStyle(16, '#e8e0c8'))
      .setOrigin(1, 0.5).setStroke('#000', 3).setInteractive({ useHandCursor: true });
    this.pauseButton.on('pointerover', () => this.pauseButton.setColor(HUD.goldHi));
    this.pauseButton.on('pointerout', () => this.pauseButton.setColor('#e8e0c8'));
    this.container = scene.add.container(0, 0, [bg, scripIcon, this.scripText, fluxIcon, this.fluxText, armyIcon, this.armyText,
      timeIcon, this.timeText, nexusIcon, this.pointsText, this.pauseButton]);
  }

  setArmy(count: number, max: number, points: number, enemyPoints: number): void {
    this.armyText.setText(`${count}/${max}`);
    this.pointsText.setText(`${points} : ${enemyPoints}`);
  }

  update(timeText: string): void {
    const r = this.resources.getResources('player');
    const inc = this.resources.getIncome('player');
    this.scripText.setText(`${Math.floor(r.scrip)}  +${Math.round(inc.scrip)}/s`);
    this.fluxText.setText(`${Math.floor(r.flux)}  +${Math.round(inc.flux)}/s`);
    this.timeText.setText(timeText);
  }
}
