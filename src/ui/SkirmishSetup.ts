import Phaser from 'phaser';
import { Difficulty, DIFFICULTIES, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { dyn, headingFont, t } from '../i18n';
import { mapName } from '../i18n/names';
import { MAP_BUILDERS } from '../maps';
import { Settings } from '../systems/Settings';
import { BattleData, WIN_MODES, WinMode } from '../scenes/BattleTypes';
import { defaultPick } from '../campaign/Wargear';
import { PERSONALITIES } from '../ai/Personality';
import { Button } from './Button';
import { WargearPicker } from './WargearPicker';
import { ModifierPicker } from './ModifierPicker';
import { ModifierId, normalizeModifiers } from '../battle/BattleModifiers';
import { FACTIONS } from '../battle/Factions';
import type { Faction } from '../units/UnitDefs';
import { drawPanel, textStyle } from './uiStyle';

/** Skirmish setup: map, victory condition, difficulty, AI personality, battle modifiers, commander wargear. */
export class SkirmishSetup {
  constructor(scene: Phaser.Scene, onStart: (data: BattleData) => void, onCancel: () => void) {
    const s = Settings.get();
    const state = {
      map: Math.min(MAP_BUILDERS.length - 1, Math.max(0, s.skirmishMap ?? 0)),
      mode: (s.skirmishMode ?? 'annihilation') as WinMode,
      difficulty: s.difficulty as Difficulty,
      personality: s.skirmishPersonality ?? 'random',
      modifiers: normalizeModifiers(s.skirmishModifiers ?? []) as ModifierId[],
      faction: (s.skirmishFaction === 'nullhorde' ? 'nullhorde' : 'ironvoid') as Faction,
      wargear: s.wargear ?? defaultPick(s.skirmishFaction === 'nullhorde' ? 'nullhorde' : 'ironvoid'),
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
      if (key) root.add(scene.add.text(x + 40, ly, t(dyn(key)), textStyle(15, '#c9a044')).setOrigin(0, 0.5));
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
    // Map: step through the list; the line under the name gives its size and point count.
    const maps = MAP_BUILDERS.map((b) => b());
    label(y + 100, 'skirmish.map');
    const mapTitle = scene.add.text(x + 250 + 235, y + 92, '', textStyle(17, '#f0e0b0')).setOrigin(0.5);
    const mapInfo = scene.add.text(x + 250 + 235, y + 112, '', textStyle(11, '#9a9280')).setOrigin(0.5);
    root.add([mapTitle, mapInfo]);
    const step = (d: number): void => {
      state.map = (state.map + d + maps.length) % maps.length;
      for (const r of refresh) r();
    };
    root.add(new Button(scene, { x: x + 250 + 20, y: y + 100, w: 40, h: 34, label: '◀', onClick: () => step(-1) }).container);
    root.add(new Button(scene, { x: x + 250 + 450, y: y + 100, w: 40, h: 34, label: '▶', onClick: () => step(1) }).container);
    refresh.push(() => {
      const m = maps[state.map];
      mapTitle.setText(mapName(m.id));
      mapInfo.setText(t('map.size', { w: m.w, h: m.h, n: m.capturePoints.length }));
    });
    // Seven victory conditions in rows of three (only the first row has the label).
    row(y + 150, 'skirmish.mode', WIN_MODES.slice(0, 3), () => state.mode, (v) => (state.mode = v), (m) => t(dyn(`mode.${m}`)), 150);
    row(y + 190, '', WIN_MODES.slice(3, 6), () => state.mode, (v) => (state.mode = v), (m) => t(dyn(`mode.${m}`)), 150);
    row(y + 230, '', WIN_MODES.slice(6), () => state.mode, (v) => (state.mode = v), (m) => t(dyn(`mode.${m}`)), 150);
    const modeDesc = scene.add.text(x + 250, y + 258, '', { ...textStyle(12, '#9a9280'), wordWrap: { width: w - 290 } });
    root.add(modeDesc);
    refresh.push(() => modeDesc.setText(t(dyn(`mode.${state.mode}.desc`))));
    row(y + 314, 'settings.difficulty', DIFFICULTIES, () => state.difficulty, (v) => (state.difficulty = v), (d) => t(dyn(`diff.${d}`)), 110);
    row(y + 358, 'skirmish.personality', ['random', ...PERSONALITIES], () => state.personality, (v) => (state.personality = v),
      (p) => t(dyn(`ai.${p}`)), 110);
    const aiDesc = scene.add.text(x + 250, y + 378, '', textStyle(11, '#9a9280'));
    root.add(aiDesc);
    refresh.push(() => aiDesc.setText(state.personality === 'random' ? t('skirmish.randomHint') : t(dyn(`ai.${state.personality}.desc`))));
    // Battle modifiers: a picker window, the button says how many are on.
    // Modifiers and the hero's wargear share a row; the wargear follows the chosen faction.
    label(y + 408, 'skirmish.modifiers');
    const modsLabel = (): string => (state.modifiers.length ? t('skirmish.modifiers.choose', { n: state.modifiers.length }) : t('skirmish.modifiers.none'));
    const mods = new Button(scene, { x: x + 365, y: y + 408, w: 230, h: 34, label: modsLabel(), onClick: () => {
      new ModifierPicker(scene, state.modifiers, (ids) => {
        state.modifiers = ids;
        mods.setLabel(modsLabel());
      });
    } });
    root.add(mods.container);
    const wg = new Button(scene, { x: x + 615, y: y + 408, w: 230, h: 34, label: t('wargear.choose'), onClick: () => {
      new WargearPicker(scene, state.faction, state.wargear, (p) => (state.wargear = p));
    } });
    root.add(wg.container);
    // Faction: the Iron Void or the Null Horde; a change resets the wargear to that faction's default.
    row(y + 456, 'skirmish.faction', [...FACTIONS], () => state.faction, (v) => {
      if (v !== state.faction) state.wargear = defaultPick(v);
      state.faction = v;
    }, (f) => t(dyn(`faction.${f}`)), 230);
    for (const r of refresh) r();
    const start = new Button(scene, { x: GAME_WIDTH / 2 + 90, y: y + h - 46, w: 200, h: 46, label: t('skirmish.start'), onClick: () => {
      Settings.set({
        difficulty: state.difficulty, skirmishMode: state.mode, skirmishPersonality: state.personality, skirmishMap: state.map,
        skirmishModifiers: state.modifiers, skirmishFaction: state.faction, wargear: state.wargear,
      });
      root.destroy();
      onStart({
        mode: 'skirmish', faction: state.faction, mapIndex: state.map, difficulty: state.difficulty, winMode: state.mode, modifiers: state.modifiers,
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
