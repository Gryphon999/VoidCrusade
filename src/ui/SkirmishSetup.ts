import Phaser from 'phaser';
import { Difficulty, DIFFICULTIES, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { dyn, headingFont, t } from '../i18n';
import { mapName } from '../i18n/names';
import { MAP_BUILDERS } from '../maps';
import { Settings } from '../systems/Settings';
import { BattleData, WinMode } from '../scenes/BattleTypes';
import { defaultPick } from '../campaign/Wargear';
import { PERSONALITIES } from '../ai/Personality';
import { Button } from './Button';
import { WargearPicker } from './WargearPicker';
import { drawPanel, textStyle } from './uiStyle';

const MODES: WinMode[] = ['annihilation', 'control', 'survival'];

/** Skirmish setup: map, victory condition, difficulty, AI personality, ash storms, commander wargear. */
export class SkirmishSetup {
  constructor(scene: Phaser.Scene, onStart: (data: BattleData) => void, onCancel: () => void) {
    const s = Settings.get();
    const state = {
      map: 0,
      mode: (s.skirmishMode ?? 'annihilation') as WinMode,
      difficulty: s.difficulty as Difficulty,
      personality: s.skirmishPersonality ?? 'random',
      storms: !!s.skirmishStorms,
      wargear: s.wargear ?? defaultPick('ironvoid'),
    };
    const root = scene.add.container(0, 0).setDepth(200);
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
    const w = 760;
    const h = 560;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;
    const g = scene.add.graphics();
    drawPanel(g, x, y, w, h);
    const title = scene.add.text(GAME_WIDTH / 2, y + 40, t('skirmish.title'), { fontFamily: headingFont(), fontSize: '42px', color: '#ffd060' }).setOrigin(0.5);
    root.add([dim, g, title]);
    const label = (ly: number, key: string): void => {
      root.add(scene.add.text(x + 40, ly, t(dyn(key)), textStyle(15, '#c9a044')).setOrigin(0, 0.5));
    };
    const refresh: (() => void)[] = [];
    const row = <T,>(ly: number, key: string, options: T[], get: () => T, set: (v: T) => void, name: (v: T) => string, bw = 150): void => {
      label(ly, key);
      options.forEach((o, i) => {
        const b = new Button(scene, { x: x + 250 + i * (bw + 10), y: ly, w: bw, h: 34, label: name(o), onClick: () => {
          set(o);
          for (const r of refresh) r();
        } });
        refresh.push(() => b.setActive(get() === o));
        root.add(b.container);
      });
    };
    const maps = MAP_BUILDERS.map((b) => b().id);
    row(y + 100, 'skirmish.map', maps.map((_, i) => i), () => state.map, (v) => (state.map = v), (i) => mapName(maps[i]), 150);
    row(y + 150, 'skirmish.mode', MODES, () => state.mode, (v) => (state.mode = v), (m) => t(dyn(`mode.${m}`)), 150);
    const modeDesc = scene.add.text(x + 250, y + 180, '', { ...textStyle(12, '#9a9280'), wordWrap: { width: w - 290 } });
    root.add(modeDesc);
    refresh.push(() => modeDesc.setText(t(dyn(`mode.${state.mode}.desc`))));
    row(y + 230, 'settings.difficulty', DIFFICULTIES, () => state.difficulty, (v) => (state.difficulty = v), (d) => t(dyn(`diff.${d}`)), 110);
    row(y + 280, 'skirmish.personality', ['random', ...PERSONALITIES], () => state.personality, (v) => (state.personality = v),
      (p) => t(dyn(`ai.${p}`)), 110);
    const aiDesc = scene.add.text(x + 250, y + 300, '', textStyle(11, '#9a9280'));
    root.add(aiDesc);
    refresh.push(() => aiDesc.setText(state.personality === 'random' ? t('skirmish.randomHint') : t(dyn(`ai.${state.personality}.desc`))));
    row(y + 330, 'skirmish.storms', [false, true], () => state.storms, (v) => (state.storms = v), (v) => t(v ? 'common.on' : 'common.off'), 110);
    label(y + 380, 'skirmish.wargear');
    const wg = new Button(scene, { x: x + 330, y: y + 380, w: 310, h: 34, label: t('wargear.choose'), onClick: () => {
      new WargearPicker(scene, 'ironvoid', state.wargear, (p) => (state.wargear = p));
    } });
    root.add(wg.container);
    for (const r of refresh) r();
    const start = new Button(scene, { x: GAME_WIDTH / 2 + 90, y: y + h - 46, w: 200, h: 46, label: t('skirmish.start'), onClick: () => {
      Settings.set({
        difficulty: state.difficulty, skirmishMode: state.mode, skirmishPersonality: state.personality,
        skirmishStorms: state.storms, wargear: state.wargear,
      });
      root.destroy();
      onStart({
        mode: 'skirmish', mapIndex: state.map, difficulty: state.difficulty, winMode: state.mode, ashStorms: state.storms,
        wargear: state.wargear, personality: state.personality === 'random' ? undefined : state.personality,
      });
    } });
    const cancel = new Button(scene, { x: GAME_WIDTH / 2 - 130, y: y + h - 46, w: 160, h: 40, label: t('common.back'), onClick: () => {
      root.destroy();
      onCancel();
    } });
    root.add([start.container, cancel.container]);
  }
}
