import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { dyn, headingFont, t } from '../i18n';
import { WARGEAR_SLOTS, WargearPick, wargearFor } from '../campaign/Wargear';
import type { Faction } from '../units/UnitDefs';
import { Button } from './Button';
import { drawPanel, textStyle } from './uiStyle';

/** Choose-one-of-three for each hero wargear slot (weapon, armour, relic). */
export class WargearPicker {
  constructor(scene: Phaser.Scene, faction: Faction, initial: WargearPick, onDone: (p: WargearPick) => void) {
    const pick: WargearPick = { ...initial };
    const root = scene.add.container(0, 0).setDepth(300);
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setOrigin(0).setInteractive();
    const w = 900;
    const h = 560;
    const x0 = (GAME_WIDTH - w) / 2;
    const y0 = (GAME_HEIGHT - h) / 2;
    const g = scene.add.graphics();
    drawPanel(g, x0, y0, w, h);
    const title = scene.add.text(GAME_WIDTH / 2, y0 + 36, t('wargear.title'), { fontFamily: headingFont(), fontSize: '34px', color: '#ffd060' }).setOrigin(0.5);
    const sub = scene.add.text(GAME_WIDTH / 2, y0 + 70, t('wargear.sub'), textStyle(14, '#bcb4a0')).setOrigin(0.5);
    root.add([dim, g, title, sub]);
    const refreshers: (() => void)[] = [];
    WARGEAR_SLOTS.forEach((slot, row) => {
      const y = y0 + 110 + row * 136;
      root.add(scene.add.text(x0 + 30, y + 44, t(dyn(`wargear.slot.${slot}`)), textStyle(16, '#c9a044')).setOrigin(0, 0.5));
      wargearFor(faction, slot).forEach((wg, col) => {
        const cx = x0 + 150 + col * 245;
        const card = scene.add.graphics();
        const icon = scene.add.image(cx + 34, y + 44, wg.icon).setScale(1.1);
        const name = scene.add.text(cx + 66, y + 10, t(dyn(`wg.${wg.id}`)), textStyle(14, '#f0d27a'));
        const desc = scene.add.text(cx + 66, y + 32, t(dyn(`wg.${wg.id}.desc`)), { ...textStyle(11, '#bcb4a0'), wordWrap: { width: 160 } });
        const zone = scene.add.zone(cx, y, 230, 88).setOrigin(0).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => {
          pick[slot] = wg.id;
          for (const r of refreshers) r();
        });
        const draw = (): void => {
          const on = pick[slot] === wg.id;
          card.clear().fillStyle(on ? 0x3a3020 : 0x1a1814, 0.95).fillRect(cx, y, 230, 88);
          card.lineStyle(on ? 2.5 : 1, on ? 0xffd060 : 0x6a5a38, 1).strokeRect(cx + 0.5, y + 0.5, 229, 87);
          icon.setAlpha(on ? 1 : 0.6);
        };
        draw();
        refreshers.push(draw);
        root.add([card, icon, name, desc, zone]);
      });
    });
    const ok = new Button(scene, { x: GAME_WIDTH / 2, y: y0 + h - 40, w: 220, h: 44, label: t('wargear.confirm'), onClick: () => {
      root.destroy();
      onDone(pick);
    } });
    root.add(ok.container);
  }
}
