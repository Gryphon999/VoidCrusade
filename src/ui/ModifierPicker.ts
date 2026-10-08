import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { dyn, headingFont, t } from '../i18n';
import { MODIFIERS, ModifierId, getModifier, toggleModifier } from '../battle/BattleModifiers';
import { Button } from './Button';
import { drawPanel, textStyle } from './uiStyle';

/** Switch battle modifiers on and off: two columns of cards, exclusions greyed out. */
export class ModifierPicker {
  constructor(scene: Phaser.Scene, initial: readonly ModifierId[], onDone: (ids: ModifierId[]) => void) {
    let picked: ModifierId[] = [...initial];
    const root = scene.add.container(0, 0).setDepth(300);
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setOrigin(0).setInteractive();
    const w = 920;
    const h = 600;
    const x0 = (GAME_WIDTH - w) / 2;
    const y0 = (GAME_HEIGHT - h) / 2;
    const g = scene.add.graphics();
    drawPanel(g, x0, y0, w, h);
    const title = scene.add.text(GAME_WIDTH / 2, y0 + 36, t('mods.title'), { fontFamily: headingFont(), fontSize: '34px', color: '#ffd060' }).setOrigin(0.5);
    const sub = scene.add.text(GAME_WIDTH / 2, y0 + 70, t('mods.sub'), { ...textStyle(13, '#bcb4a0'), wordWrap: { width: w - 80 }, align: 'center' }).setOrigin(0.5);
    root.add([dim, g, title, sub]);
    const refreshers: (() => void)[] = [];
    const cardW = 430;
    const cardH = 78;
    MODIFIERS.forEach((def, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = x0 + 24 + col * (cardW + 12);
      const cy = y0 + 100 + row * (cardH + 8);
      const card = scene.add.graphics();
      const icon = scene.add.image(cx + 30, cy + cardH / 2, def.icon).setScale(1.3);
      const name = scene.add.text(cx + 60, cy + 10, t(dyn(`mod.${def.id}`)), textStyle(15, '#f0d27a'));
      const desc = scene.add.text(cx + 60, cy + 32, t(dyn(`mod.${def.id}.desc`)), { ...textStyle(11, '#bcb4a0'), wordWrap: { width: cardW - 72 } });
      const zone = scene.add.zone(cx, cy, cardW, cardH).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        picked = toggleModifier(picked, def.id);
        for (const r of refreshers) r();
      });
      const draw = (): void => {
        const on = picked.includes(def.id);
        // Excluded by a current pick: shown dim; clicking it still works and swaps the two.
        const excluded = !on && (def.excludes ?? []).some((e) => picked.includes(e));
        card.clear().fillStyle(on ? 0x3a3020 : 0x1a1814, 0.95).fillRect(cx, cy, cardW, cardH);
        card.lineStyle(on ? 2.5 : 1, on ? 0xffd060 : 0x6a5a38, 1).strokeRect(cx + 0.5, cy + 0.5, cardW - 1, cardH - 1);
        const a = on ? 1 : excluded ? 0.35 : 0.65;
        icon.setAlpha(a);
        name.setAlpha(a);
        desc.setAlpha(a);
      };
      draw();
      refreshers.push(draw);
      root.add([card, icon, name, desc, zone]);
    });
    const clear = new Button(scene, { x: GAME_WIDTH / 2 - 150, y: y0 + h - 40, w: 200, h: 44, label: t('mods.clear'), onClick: () => {
      picked = [];
      for (const r of refreshers) r();
    } });
    const ok = new Button(scene, { x: GAME_WIDTH / 2 + 110, y: y0 + h - 40, w: 220, h: 44, label: t('mods.confirm'), onClick: () => {
      root.destroy();
      onDone(picked.map((id) => getModifier(id).id));
    } });
    root.add([clear.container, ok.container]);
  }
}
