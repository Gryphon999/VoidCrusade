import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { headingFont, t } from '../i18n';
import { BattleResult } from '../scenes/BattleTypes';
import type { BattleScene } from '../scenes/BattleScene';
import { Button } from './Button';
import { formatTime, textStyle } from './uiStyle';
import { SURVIVAL_WAVES } from '../systems/VictorySystem';

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
  if (battle.victory?.mode === 'survival') lines.unshift(t('end.survival', { w: Math.min(battle.victory.wave, SURVIVAL_WAVES), score: battle.victory.score }));
  if (battle.victory?.mode === 'control' && win) lines.unshift(t('end.control'));
  const stats = scene.add.text(cx, cy + 40, lines.join('\n'), { ...textStyle(18, '#aab'), align: 'center', lineSpacing: 8 });
  stats.setOrigin(0.5).setAlpha(0);
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
    const btn = new Button(scene, { x, y: cy + 150, w: 200, h: 48, label: b.label, onClick: b.action });
    btn.container.setAlpha(0);
    scene.tweens.add({ targets: btn.container, alpha: 1, duration: 400, delay: 1400 });
    root.add(btn.container);
  });
  return root;
}
