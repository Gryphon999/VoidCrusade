import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, GOTHIC_FONT } from '../config';
import { CardDef } from '../campaign/UpgradeCards';
import { textStyle } from './uiStyle';

/** Modal: choose one of three upgrade cards. */
export function showCardPicker(scene: Phaser.Scene, cards: CardDef[], onPick: (c: CardDef) => void): void {
  const root = scene.add.container(0, 0).setDepth(400);
  const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setOrigin(0).setInteractive();
  const title = scene.add.text(GAME_WIDTH / 2, 110, 'Spoils of War', {
    fontFamily: GOTHIC_FONT, fontSize: '56px', color: '#ffd060', stroke: '#000', strokeThickness: 6,
  }).setOrigin(0.5);
  const sub = scene.add.text(GAME_WIDTH / 2, 165, 'Choose one boon for the crusade', textStyle(18, '#bbc')).setOrigin(0.5);
  root.add([dim, title, sub]);
  cards.forEach((c, i) => {
    const x = GAME_WIDTH / 2 + (i - 1) * 260;
    const y = 390;
    const card = scene.add.container(x, y + 40).setAlpha(0);
    const bg = scene.add.rectangle(0, 0, 220, 300, 0x14142a).setStrokeStyle(3, 0x8a7a40);
    const inner = scene.add.rectangle(0, 0, 204, 284).setStrokeStyle(1, 0x3a3a5a);
    const icon = scene.add.image(0, -70, c.icon).setScale(3);
    const name = scene.add.text(0, 10, c.name, { ...textStyle(20, '#ffe8a0'), align: 'center', wordWrap: { width: 190 } }).setOrigin(0.5);
    const desc = scene.add.text(0, 70, c.description, { ...textStyle(15, '#ccd'), align: 'center', wordWrap: { width: 180 } }).setOrigin(0.5);
    card.add([bg, inner, icon, name, desc]);
    root.add(card);
    scene.tweens.add({ targets: card, alpha: 1, y, duration: 450, delay: 150 * i, ease: 'Back.easeOut' });
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      bg.setStrokeStyle(3, 0xffd060);
      scene.tweens.add({ targets: card, scale: 1.06, duration: 120 });
    });
    bg.on('pointerout', () => {
      bg.setStrokeStyle(3, 0x8a7a40);
      scene.tweens.add({ targets: card, scale: 1, duration: 120 });
    });
    bg.on('pointerdown', () => {
      root.destroy();
      onPick(c);
    });
  });
}
