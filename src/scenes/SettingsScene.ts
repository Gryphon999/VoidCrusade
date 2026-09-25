import Phaser from 'phaser';
import { Difficulty, GAME_HEIGHT, GAME_WIDTH, GOTHIC_FONT } from '../config';
import { Settings } from '../systems/Settings';
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
    const h = 400;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    drawPanel(g, x, y, w, h);
    this.add.text(GAME_WIDTH / 2, y + 42, 'Settings', { fontFamily: GOTHIC_FONT, fontSize: '44px', color: '#ffd060' }).setOrigin(0.5);
    new Slider(this, x + 60, y + 120, 340, 'Music volume', s.musicVolume, (v) => Settings.set({ musicVolume: v }));
    new Slider(this, x + 60, y + 190, 340, 'SFX volume', s.sfxVolume, (v) => Settings.set({ sfxVolume: v }));
    this.add.text(x + 60, y + 232, 'Difficulty', textStyle(16));
    const desc = this.add.text(GAME_WIDTH / 2, y + 318, DIFF_TEXT[s.difficulty], textStyle(13, '#99a')).setOrigin(0.5);
    const buttons: Button[] = [];
    DIFFS.forEach((d, i) => {
      const b = new Button(this, {
        x: x + 120 + i * 140, y: y + 278, w: 124, h: 38, label: d[0].toUpperCase() + d.slice(1),
        onClick: () => {
          Settings.set({ difficulty: d });
          buttons.forEach((o, j) => o.setActive(j === i));
          desc.setText(DIFF_TEXT[d]);
        },
      });
      b.setActive(d === s.difficulty);
      buttons.push(b);
    });
    new Button(this, { x: GAME_WIDTH / 2, y: y + h - 30, w: 160, h: 36, label: 'Close', onClick: () => this.close(data.onClose) });
    this.input.keyboard?.once('keydown-ESC', () => this.close(data.onClose));
  }

  private close(cb?: () => void): void {
    this.scene.stop();
    cb?.();
  }
}
