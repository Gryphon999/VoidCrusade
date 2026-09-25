import Phaser from 'phaser';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../config';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'VOIDCRUSADE', {
        fontFamily: FONT_FAMILY,
        fontSize: '72px',
        color: COLORS.uiText,
      })
      .setOrigin(0.5);
    const start = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, '[ Skirmish ]', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        color: '#9ab',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    start.on('pointerdown', () => this.scene.start('BattleScene'));
  }
}
