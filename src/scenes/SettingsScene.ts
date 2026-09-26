import Phaser from 'phaser';
import { DIFFICULTIES, Difficulty, GAME_HEIGHT, GAME_WIDTH, PROJECTION } from '../config';
import { GraphicsQuality, RendererChoice, Settings } from '../systems/Settings';
import { Slider } from '../ui/Slider';
import { Button } from '../ui/Button';
import { drawPanel, textStyle } from '../ui/uiStyle';
import { Lang, dyn, getLanguage, headingFont, onLanguageChange, t } from '../i18n';
import { Voice } from '../systems/VoiceSystem';

const DIFFS: Difficulty[] = DIFFICULTIES;
const GFXQ: GraphicsQuality[] = ['low', 'medium', 'high', 'ultra'];
const RENDERERS: RendererChoice[] = ['auto', '3d', '2d'];
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
    const h = 680;
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
    new Button(this, { x: R + 300, y: ry + 12, w: 120, h: 28, label: t('settings.advanced'), onClick: () => this.graphicsPanel() });
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
    const hints = new Button(this, {
      x: R + 140, y: ry + 114, w: 280, h: 34, label: t('settings.hints', { v: onOff(Settings.get().hints !== false) }),
      onClick: () => {
        Settings.set({ hints: Settings.get().hints === false });
        hints.setLabel(t('settings.hints', { v: onOff(Settings.get().hints !== false) }));
      },
    });
    new Button(this, { x: R + 140, y: ry + 158, w: 280, h: 34, label: t('settings.hintsReset'), onClick: () => Settings.set({ hintsSeen: [], hints: true, tutorialPrompted: false }) });
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

  /** Advanced graphics: renderer, 3D resolution scale, FPS counter, adaptive quality. */
  private graphicsPanel(): void {
    const s = Settings.get();
    const w = 560;
    const h = 380;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;
    const layer: Phaser.GameObjects.GameObject[] = [];
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      layer.push(o);
      return o;
    };
    keep(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8).setOrigin(0).setInteractive().setDepth(50));
    const g = keep(this.add.graphics().setDepth(51));
    drawPanel(g, x, y, w, h);
    keep(this.add.text(GAME_WIDTH / 2, y + 30, t('settings.gfxTitle'), { fontFamily: headingFont(), fontSize: '30px', color: '#f0d27a' }).setOrigin(0.5).setDepth(52));
    const L = x + 40;
    keep(this.add.text(L, y + 64, t('settings.renderer'), textStyle(15, '#e8e0c8')).setDepth(52));
    const before = this.children.list.length;
    this.choice(L, y + 102, RENDERERS.map((r) => ({ label: t(dyn(`renderer.${r}`)), on: (s.renderer ?? 'auto') === r, pick: () => Settings.set({ renderer: r }) })));
    keep(this.add.text(L, y + 126, t('settings.rendererNote'), { ...textStyle(11, '#9a9488'), wordWrap: { width: w - 80 } }).setDepth(52));
    const slider = new Slider(this, L, y + 180, 300, t('settings.resScale'), ((s.resolutionScale ?? 1) - 0.5) / 0.5,
      (v) => Settings.set({ resolutionScale: Math.round((0.5 + v * 0.5) * 20) / 20 }));
    const onOff = (v: boolean): string => (v ? t('common.on') : t('common.off'));
    const fps = new Button(this, { x: L + 150, y: y + 240, w: 300, h: 34, label: t('settings.showFps', { v: onOff(!!s.showFps) }), onClick: () => {
      Settings.set({ showFps: !Settings.get().showFps });
      fps.setLabel(t('settings.showFps', { v: onOff(!!Settings.get().showFps) }));
    } });
    const ad = new Button(this, { x: L + 150, y: y + 284, w: 300, h: 34, label: t('settings.adaptive', { v: onOff(s.adaptiveQuality !== false) }), onClick: () => {
      Settings.set({ adaptiveQuality: Settings.get().adaptiveQuality === false });
      ad.setLabel(t('settings.adaptive', { v: onOff(Settings.get().adaptiveQuality !== false) }));
    } });
    keep(this.add.text(L, y + 306, t('settings.adaptiveNote'), textStyle(11, '#9a9488')).setDepth(52));
    // Everything created by the helpers above belongs to this panel too.
    for (const o of this.children.list.slice(before)) if (!layer.includes(o)) layer.push(o);
    // Lift the panel's widgets above the dimmer.
    for (const o of layer) {
      const d = o as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth;
      if (typeof d.setDepth === 'function' && d.depth < 52) d.setDepth(52);
    }
    const closeBtn = new Button(this, { x: GAME_WIDTH / 2, y: y + h - 30, w: 160, h: 34, label: t('common.close'), onClick: () => {
      for (const o of layer) o.destroy();
      slider.container.destroy();
      fps.destroy();
      ad.destroy();
      closeBtn.destroy();
    } });
    for (const b of [fps, ad, closeBtn]) b.container.setDepth(53);
  }

  private close(): void {
    this.scene.stop();
    this.data0.onClose?.();
  }
}
