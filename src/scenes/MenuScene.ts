import Phaser from 'phaser';
import { COLORS, FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Settings } from '../systems/Settings';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, 'VOIDCRUSADE', { fontFamily: FONT_FAMILY, fontSize: '72px', color: COLORS.uiText })
      .setOrigin(0.5);
    const items: [string, () => void][] = [
      ['[ New Campaign ]', () => this.scene.start('CampaignScene', { fresh: true })],
      ['[ Continue Campaign ]', () => this.scene.start('CampaignScene', {})],
      ['[ Skirmish ]', () => this.scene.start('BattleScene', { mode: 'skirmish', difficulty: Settings.get().difficulty })],
    ];
    items.forEach(([label, fn], i) => {
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20 + i * 50, label, { fontFamily: FONT_FAMILY, fontSize: '28px', color: '#9ab' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', fn);
    });
  }
}
