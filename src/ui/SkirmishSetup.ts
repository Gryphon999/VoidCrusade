import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { dyn, headingFont, t } from '../i18n';
import { mapName } from '../i18n/names';
import { MAP_BUILDERS } from '../maps';
import { Settings } from '../systems/Settings';
import { Button } from './Button';
import { drawPanel, textStyle } from './uiStyle';

/** Map picker overlay for skirmish games. */
export class SkirmishSetup {
  constructor(scene: Phaser.Scene, onStart: (mapIndex: number) => void, onCancel: () => void) {
    const root = scene.add.container(0, 0).setDepth(200);
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
    const w = 560;
    const h = 150 + MAP_BUILDERS.length * 56;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;
    const g = scene.add.graphics();
    drawPanel(g, x, y, w, h);
    const title = scene.add.text(GAME_WIDTH / 2, y + 40, t('skirmish.title'), { fontFamily: headingFont(), fontSize: '42px', color: '#ffd060' }).setOrigin(0.5);
    const diff = Settings.get().difficulty;
    const note = scene.add.text(GAME_WIDTH / 2, y + 80, t('skirmish.difficulty', { d: t(dyn(`diff.${diff}`)) }), textStyle(14, '#99a')).setOrigin(0.5);
    root.add([dim, g, title, note]);
    MAP_BUILDERS.forEach((build, i) => {
      const m = build();
      const b = new Button(scene, { x: GAME_WIDTH / 2, y: y + 124 + i * 56, w: 360, h: 44, label: mapName(m.id), onClick: () => onStart(i) });
      root.add(b.container);
    });
    const cancel = new Button(scene, { x: GAME_WIDTH / 2, y: y + h - 30, w: 140, h: 34, label: t('common.back'), onClick: () => {
      root.destroy();
      onCancel();
    } });
    root.add(cancel.container);
  }
}
