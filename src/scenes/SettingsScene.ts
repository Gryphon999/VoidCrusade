import Phaser from 'phaser';
import { Difficulty, GAME_HEIGHT, GAME_WIDTH, PROJECTION } from '../config';
import { GraphicsQuality, Settings } from '../systems/Settings';
import { Slider } from '../ui/Slider';
import { Button } from '../ui/Button';
import { drawPanel, textStyle } from '../ui/uiStyle';
import { Lang, dyn, getLanguage, headingFont, onLanguageChange, t } from '../i18n';
import { Voice } from '../systems/VoiceSystem';

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];
const GFXQ: GraphicsQuality[] = ['low', 'medium', 'high'];
const LANGS: [Lang, string][] = [['en', 'English'], ['ru', 'Русский']];

export interface SettingsData {
  onClose?: () => void;
}

/** Modal settings overlay (two columns), persisted to localStorage; rebuilds itself on language change. */
export class SettingsScene extends Phaser.Scene {
  private data0: SettingsData = {};
  /** Extra rows for the left column (audio/voice), appended by later systems. */
  protected leftY = 0;

  constructor() {
    super('SettingsScene');
  }

  create(data: SettingsData): void {
    this.data0 = data;
    const s = Settings.get();
    const w = 820;
    const h = 580;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    drawPanel(g, x, y, w, h);
    this.add.text(GAME_WIDTH / 2, y + 40, t('settings.title'), { fontFamily: headingFont(), fontSize: '42px', color: '#f0d27a' }).setOrigin(0.5);
    const L = x + 50;
    const R = x + w / 2 + 20;
    // Left column: audio.
    this.leftY = y + 96;
    this.slider(L, t('settings.master'), s.masterVolume, (v) => Settings.set({ masterVolume: v }));
    this.slider(L, t('settings.music'), s.musicVolume, (v) => Settings.set({ musicVolume: v }));
    this.slider(L, t('settings.sfx'), s.sfxVolume, (v) => Settings.set({ sfxVolume: v }));
    // Right column: language, difficulty, graphics, camera.
    let ry = y + 90;
    this.add.text(R, ry, t('settings.language'), textStyle(16, '#e8e0c8'));
    this.choice(R, ry + 44, LANGS.map(([l, name]) => ({ label: name, on: getLanguage() === l, pick: () => Settings.set({ language: l }) })));
    ry += 96;
    this.add.text(R, ry, t('settings.difficulty'), textStyle(16, '#e8e0c8'));
    const desc = this.add.text(R, ry + 72, t(dyn(`diff.${s.difficulty}.desc`)), { ...textStyle(12, '#9a9488'), wordWrap: { width: 340 } });
    this.choice(R, ry + 44, DIFFS.map((d) => ({
      label: t(dyn(`diff.${d}`)), on: s.difficulty === d,
      pick: () => {
        Settings.set({ difficulty: d });
        desc.setText(t(dyn(`diff.${d}.desc`)));
      },
    })));
    ry += 116;
    this.add.text(R, ry, t('settings.graphics'), textStyle(16, '#e8e0c8'));
    this.choice(R, ry + 44, GFXQ.map((q) => ({ label: t(dyn(`gfx.${q}`)), on: s.graphics === q, pick: () => Settings.set({ graphics: q }) })));
    ry += 100;
    const span = PROJECTION.maxTilt - PROJECTION.minTilt;
    new Slider(this, R, ry + 20, 280, t('settings.tilt'), (s.tilt - PROJECTION.minTilt) / span,
      (v) => Settings.set({ tilt: PROJECTION.minTilt + v * span }));
    const onOff = (v: boolean): string => (v ? t('common.on') : t('common.off'));
    const shake = new Button(this, {
      x: R + 140, y: ry + 70, w: 280, h: 34, label: t('settings.shake', { v: onOff(s.screenShake) }),
      onClick: () => {
        Settings.set({ screenShake: !Settings.get().screenShake });
        shake.setLabel(t('settings.shake', { v: onOff(Settings.get().screenShake) }));
      },
    });
    this.addLeftRows(L);
    new Button(this, { x: GAME_WIDTH / 2, y: y + h - 34, w: 180, h: 38, label: t('common.close'), onClick: () => this.close() });
    this.input.keyboard?.once('keydown-ESC', () => this.close());
    const off = onLanguageChange(() => this.scene.restart(this.data0));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  /** Voice-over controls: volume, on/off, subtitles, test, and a note when no voice exists. */
  protected addLeftRows(x: number): void {
    const s = Settings.get();
    this.slider(x, t('settings.voice'), s.voiceVolume, (v) => Settings.set({ voiceVolume: v }));
    const onOff = (v: boolean): string => (v ? t('common.on') : t('common.off'));
    const y = this.leftY;
    const voice = new Button(this, {
      x: x + 140, y, w: 280, h: 34, label: t('settings.voiceOn', { v: onOff(s.voiceEnabled) }),
      onClick: () => {
        Settings.set({ voiceEnabled: !Settings.get().voiceEnabled });
        voice.setLabel(t('settings.voiceOn', { v: onOff(Settings.get().voiceEnabled) }));
      },
    });
    const subs = new Button(this, {
      x: x + 140, y: y + 44, w: 280, h: 34, label: t('settings.subtitles', { v: onOff(Voice.subtitlesOn()) }),
      onClick: () => {
        Settings.set({ subtitles: !Voice.subtitlesOn() });
        subs.setLabel(t('settings.subtitles', { v: onOff(Voice.subtitlesOn()) }));
      },
    });
    new Button(this, { x: x + 140, y: y + 88, w: 280, h: 34, label: t('settings.voiceTest'), onClick: () => {
      Voice.stop();
      Voice.say('vo.test', 'commander', 'alert', true);
    } });
    if (!Voice.hasVoice()) {
      this.add.text(x, y + 116, t('settings.noVoice', { lang: getLanguage() === 'ru' ? 'Русский' : 'English' }),
        { ...textStyle(12, '#e0a060'), wordWrap: { width: 300 } });
    }
  }

  protected slider(x: number, label: string, value: number, set: (v: number) => void): void {
    new Slider(this, x, this.leftY + 20, 280, label, value, set);
    this.leftY += 62;
  }

  private choice(x: number, y: number, opts: { label: string; on: boolean; pick: () => void }[]): void {
    const bw = Math.min(124, 360 / opts.length - 8);
    const buttons: Button[] = [];
    opts.forEach((o, i) => {
      const b = new Button(this, {
        x: x + bw / 2 + i * (bw + 8), y, w: bw, h: 36, label: o.label,
        onClick: () => {
          o.pick();
          buttons.forEach((q, j) => q.setActive(j === i));
        },
      });
      b.setActive(o.on);
      buttons.push(b);
    });
  }

  private close(): void {
    this.scene.stop();
    this.data0.onClose?.();
  }
}
