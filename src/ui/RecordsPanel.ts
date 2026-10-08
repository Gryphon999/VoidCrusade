import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { dyn, headingFont, t } from '../i18n';
import { mapName } from '../i18n/names';
import { bestRecords, loadRecords } from '../battle/Records';
import { Button } from './Button';
import { drawPanel, formatTime, textStyle } from './uiStyle';

/** Survival records: the best run of every battlefield / difficulty / modifier table, best first. */
export class RecordsPanel {
  constructor(scene: Phaser.Scene, onClose: () => void) {
    const root = scene.add.container(0, 0).setDepth(300);
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65).setOrigin(0).setInteractive();
    const w = 860;
    const h = 580;
    const x0 = (GAME_WIDTH - w) / 2;
    const y0 = (GAME_HEIGHT - h) / 2;
    const g = scene.add.graphics();
    drawPanel(g, x0, y0, w, h);
    const title = scene.add.text(GAME_WIDTH / 2, y0 + 40, t('records.title'), { fontFamily: headingFont(), fontSize: '38px', color: '#ffd060' }).setOrigin(0.5);
    const sub = scene.add.text(GAME_WIDTH / 2, y0 + 78, t('records.sub'), textStyle(13, '#9a9280')).setOrigin(0.5);
    root.add([dim, g, title, sub]);
    const best = bestRecords(loadRecords()).slice(0, 14);
    const rows = best.length
      ? best.map((r, i) => `${i + 1}. ${t('records.row', {
        map: mapName(r.mapId), diff: t(dyn(`diff.${r.difficulty}`)), mods: r.modifiers.length ? t('records.mods', { list: r.modifiers.map((m) => t(dyn(`mod.${m}`))).join(', ') }) : '',
        score: r.best.score, w: r.best.waves, t: formatTime(r.best.time), d: r.best.date,
      })}`)
      : [t('records.empty')];
    const list = scene.add.text(x0 + 40, y0 + 110, rows.join('\n'), { ...textStyle(15, '#dcd4c0'), lineSpacing: 8, wordWrap: { width: w - 80 } });
    const close = new Button(scene, { x: GAME_WIDTH / 2, y: y0 + h - 40, w: 200, h: 44, label: t('common.back'), onClick: () => {
      root.destroy();
      onClose();
    } });
    root.add([list, close.container]);
  }
}
