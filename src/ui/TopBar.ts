import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { ResourceSystem } from '../systems/ResourceSystem';
import { drawPanel, textStyle } from './uiStyle';

export const TOP_BAR_H = 40;

/** Top HUD strip: Scrip, Flux, income, battle clock. */
export class TopBar {
  private scripText: Phaser.GameObjects.Text;
  private fluxText: Phaser.GameObjects.Text;
  private timeText: Phaser.GameObjects.Text;
  private armyText: Phaser.GameObjects.Text;
  private pointsText: Phaser.GameObjects.Text;
  readonly pauseButton: Phaser.GameObjects.Text;
  readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, private resources: ResourceSystem) {
    const g = scene.add.graphics();
    drawPanel(g, 0, 0, GAME_WIDTH, TOP_BAR_H);
    const scripIcon = scene.add.image(26, TOP_BAR_H / 2, 'icon_scrip');
    this.scripText = scene.add.text(44, TOP_BAR_H / 2, '', textStyle(18, '#f0c040')).setOrigin(0, 0.5);
    const fluxIcon = scene.add.image(236, TOP_BAR_H / 2, 'icon_flux');
    this.fluxText = scene.add.text(254, TOP_BAR_H / 2, '', textStyle(18, '#40e0ff')).setOrigin(0, 0.5);
    const timeIcon = scene.add.image(GAME_WIDTH / 2 - 40, TOP_BAR_H / 2, 'icon_time');
    this.timeText = scene.add.text(GAME_WIDTH / 2 - 22, TOP_BAR_H / 2, '00:00', textStyle(18)).setOrigin(0, 0.5);
    const armyIcon = scene.add.image(446, TOP_BAR_H / 2, 'icon_squads');
    this.armyText = scene.add.text(464, TOP_BAR_H / 2, '', textStyle(18, '#9cf')).setOrigin(0, 0.5);
    this.pointsText = scene.add.text(GAME_WIDTH / 2 + 110, TOP_BAR_H / 2, '', textStyle(16, '#ccd')).setOrigin(0, 0.5);
    this.pauseButton = scene.add.text(GAME_WIDTH - 14, TOP_BAR_H / 2, '❚❚ Pause', textStyle(16, '#ccd'))
      .setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    this.pauseButton.on('pointerover', () => this.pauseButton.setColor('#ffd060'));
    this.pauseButton.on('pointerout', () => this.pauseButton.setColor('#ccd'));
    this.container = scene.add.container(0, 0, [g, scripIcon, this.scripText, fluxIcon, this.fluxText, timeIcon, this.timeText,
      armyIcon, this.armyText, this.pointsText, this.pauseButton]);
  }

  setArmy(count: number, max: number, points: number, enemyPoints: number): void {
    this.armyText.setText(`${count}/${max}`);
    this.pointsText.setText(`Nexus  ${points} : ${enemyPoints}`);
  }

  update(timeText: string): void {
    const r = this.resources.getResources('player');
    const inc = this.resources.getIncome('player');
    this.scripText.setText(`${Math.floor(r.scrip)}  (+${Math.round(inc.scrip)}/s)`);
    this.fluxText.setText(`${Math.floor(r.flux)}  (+${Math.round(inc.flux)}/s)`);
    this.timeText.setText(timeText);
  }

  add(obj: Phaser.GameObjects.GameObject): void {
    this.container.add(obj);
  }
}
