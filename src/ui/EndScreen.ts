import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { dyn, headingFont, t } from '../i18n';
import { normalizeModifiers } from '../battle/BattleModifiers';
import { BattleResult } from '../scenes/BattleTypes';
import { Platform } from '../platform/Platform';
import type { BattleScene } from '../scenes/BattleScene';
import { Button } from './Button';
import { formatTime, textStyle } from './uiStyle';
import { recordRun } from '../battle/Records';
import { mapName } from '../i18n/names';

/** Animated Victory/Defeat overlay with battle stats. */
export function showEndScreen(scene: Phaser.Scene, battle: BattleScene, result: BattleResult): Phaser.GameObjects.Container {
  const win = result.winner === 'player';
  const cx = GAME_WIDTH / 2;
  const cy = GAME_HEIGHT / 2;
  const root = scene.add.container(0, 0).setDepth(500);
  const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setOrigin(0).setInteractive();
  dim.setAlpha(0);
  scene.tweens.add({ targets: dim, alpha: 1, duration: 600 });
  const color = win ? '#ffd060' : '#ff3030';
  const title = scene.add.text(cx, cy - 120, win ? t('end.victory') : t('end.defeat'), {
    fontFamily: headingFont(), fontSize: '110px', color, stroke: '#000', strokeThickness: 10,
  }).setOrigin(0.5).setScale(3).setAlpha(0);
  scene.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 700, ease: 'Back.easeOut', delay: 200 });
  const sub = win ? t('end.victory.sub') : t('end.defeat.sub');
  const subtitle = scene.add.text(cx, cy - 30, sub, textStyle(22, '#dde')).setOrigin(0.5).setAlpha(0);
  const s = result.stats;
  const lines = [
    t('end.time', { t: formatTime(result.time) }),
    t('end.kills', { k: s.kills, l: s.losses }),
    t('end.structures', { d: s.buildingsDestroyed, l: s.buildingsLost }),
  ];
  const mods = normalizeModifiers(result.data.modifiers ?? []);
  if (mods.length) lines.push(t('end.modifiers', { list: mods.map((m) => t(dyn(`mod.${m}`))).join(', ') }));
  if (battle.victory?.mode === 'survival') {
    // Waves survived = full waves beaten before the fall. The run goes into the records table of
    // this map, difficulty and modifier set (a modified run never mixes with plain ones).
    const waves = Math.max(0, battle.victory.wave - 1);
    const p = { w: waves, score: battle.victory.score };
    lines.unshift(mods.length ? t('end.survivalMod', p) : t('end.survival', p));
    const { rank, table } = recordRun(battle.map.def.id, result.data.difficulty ?? 'normal', mods, { score: battle.victory.score, waves, time: result.time });
    if (rank) lines.unshift(t('end.record', { n: rank }));
    const top = table.slice(0, 5).map((e, i) => t('end.recordRow', { n: i + 1, score: e.score, w: e.waves, d: e.date }));
    if (top.length) lines.push('', t('end.recordTop', { map: mapName(battle.map.def.id) }), ...top);
  }
  if (battle.victory?.mode === 'control' && win) lines.unshift(t('end.control'));
  if (win && (battle.victory?.mode === 'hold' || battle.victory?.mode === 'nests' || battle.victory?.mode === 'evac' || battle.victory?.mode === 'koth')) lines.unshift(t(dyn(`end.${battle.victory.mode}`)));
  // The block grows with records lines: it hangs from under the subtitle and pushes the buttons down.
  const stats = scene.add.text(cx, cy, lines.join('\n'), { ...textStyle(lines.length > 6 ? 16 : 18, '#aab'), align: 'center', lineSpacing: lines.length > 6 ? 4 : 8 });
  stats.setOrigin(0.5, 0).setAlpha(0);
  const buttonY = Math.min(GAME_HEIGHT - 56, Math.max(cy + 150, cy + stats.height + 44));
  scene.tweens.add({ targets: [subtitle, stats], alpha: 1, duration: 600, delay: 900 });
  root.add([dim, title, subtitle, stats]);
  // Pulsing glow behind title.
  scene.tweens.add({ targets: title, alpha: { from: 1, to: 0.8 }, duration: 900, yoyo: true, repeat: -1, delay: 1000 });

  const campaign = result.data.mode === 'campaign';
  const buttons: { label: string; action: () => void }[] = campaign
    ? [{ label: win ? t('end.continue') : t('end.backToCampaign'), action: () => battle.scene.start('CampaignScene', { result }) }]
    : [
        { label: t('end.again'), action: () => battle.scene.restart(result.data) },
        { label: t('end.menu'), action: () => battle.scene.start('MenuScene') },
      ];
  buttons.forEach((b, i) => {
    const x = cx + (i - (buttons.length - 1) / 2) * 220;
    // Between battles is the one place a fullscreen ad may show (the SDK itself spaces them out).
    let leaving = false;
    const go = (): void => {
      if (leaving) return;
      leaving = true;
      void Platform.showInterstitial().then(b.action);
    };
    const btn = new Button(scene, { x, y: buttonY, w: 200, h: 48, label: b.label, onClick: go });
    btn.container.setAlpha(0);
    scene.tweens.add({ targets: btn.container, alpha: 1, duration: 400, delay: 1400 });
    root.add(btn.container);
  });
  return root;
}
