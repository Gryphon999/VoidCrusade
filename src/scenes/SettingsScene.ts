import Phaser from 'phaser';
import { Difficulty, GAME_HEIGHT, GAME_WIDTH, GOTHIC_FONT, PROJECTION } from '../config';
import { GraphicsQuality, Settings } from '../systems/Settings';
import { Slider } from '../ui/Slider';
import { Button } from '../ui/Button';
import { drawPanel, textStyle } from '../ui/uiStyle';

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];
const DIFF_TEXT: Record<Difficulty, string> = {
  easy: 'Horde income ×0.5, raids every 60s, never rushes.',
  normal: 'Horde income ×1.0, raids every 30s.',
  hard: 'Horde income ×1.5, raids every 20s, smarter targeting.',
};

/** Modal settings overlay: volumes and difficulty, persisted to localStorage. */
export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('SettingsScene');
  }

  create(data: { onClose?: () => void }): void {
    const s = Settings.get();
    const w = 520;
    const h = 610;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    drawPanel(g, x, y, w, h);
    this.add.text(GAME_WIDTH / 2, y + 42, 'Settings', { fontFamily: GOTHIC_FONT, fontSize: '44px', color: '#ffd060' }).setOrigin(0.5);
    new Slider(this, x + 60, y + 120, 340, 'Music volume', s.musicVolume, (v) => Settings.set({ musicVolume: v }));
    new Slider(this, x + 60, y + 190, 340, 'SFX volume', s.sfxVolume, (v) => Settings.set({ sfxVolume: v }));
    const span = PROJECTION.maxTilt - PROJECTION.minTilt;
    new Slider(this, x + 60, y + 260, 340, 'Camera tilt (next battle)', (s.tilt - PROJECTION.minTilt) / span,
      (v) => Settings.set({ tilt: PROJECTION.minTilt + v * span }));
    this.add.text(x + 60, y + 302, 'Difficulty', textStyle(16));
    const desc = this.add.text(GAME_WIDTH / 2, y + 388, DIFF_TEXT[s.difficulty], textStyle(13, '#99a')).setOrigin(0.5);
    const buttons: Button[] = [];
    DIFFS.forEach((d, i) => {
      const b = new Button(this, {
        x: x + 120 + i * 140, y: y + 348, w: 124, h: 38, label: d[0].toUpperCase() + d.slice(1),
        onClick: () => {
          Settings.set({ difficulty: d });
          buttons.forEach((o, j) => o.setActive(j === i));
          desc.setText(DIFF_TEXT[d]);
        },
      });
      b.setActive(d === s.difficulty);
      buttons.push(b);
    });
    this.add.text(x + 60, y + 414, 'Graphics (next battle)', textStyle(16));
    const gfx: GraphicsQuality[] = ['low', 'medium', 'high'];
    const gButtons: Button[] = [];
    gfx.forEach((q, i) => {
      const b = new Button(this, {
        x: x + 120 + i * 140, y: y + 460, w: 124, h: 38, label: q[0].toUpperCase() + q.slice(1),
        onClick: () => {
          Settings.set({ graphics: q });
          gButtons.forEach((o, j) => o.setActive(j === i));
        },
      });
      b.setActive(q === s.graphics);
      gButtons.push(b);
    });
    const shake = new Button(this, {
      x: GAME_WIDTH / 2, y: y + 516, w: 220, h: 34, label: `Screen shake: ${s.screenShake ? 'On' : 'Off'}`,
      onClick: () => {
        Settings.set({ screenShake: !Settings.get().screenShake });
        shake.setLabel(`Screen shake: ${Settings.get().screenShake ? 'On' : 'Off'}`);
      },
    });
    new Button(this, { x: GAME_WIDTH / 2, y: y + h - 30, w: 160, h: 36, label: 'Close', onClick: () => this.close(data.onClose) });
    this.input.keyboard?.once('keydown-ESC', () => this.close(data.onClose));
  }

  private close(cb?: () => void): void {
    this.scene.stop();
    cb?.();
  }
}
