import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Speaker, Voice } from '../systems/VoiceSystem';
import { textStyle } from '../ui/uiStyle';

const SPEAKER_COLOR: Record<Speaker, string> = {
  rifleman: '#9cc8ff', heavy: '#9cc8ff', commander: '#f0d27a', announcer: '#e8e0c8',
};

/** Always-on-top overlay that shows voice-line subtitles in every scene. */
export class SubtitleScene extends Phaser.Scene {
  private box!: Phaser.GameObjects.Container;
  private bg!: Phaser.GameObjects.Rectangle;
  private text!: Phaser.GameObjects.Text;

  constructor() {
    super('SubtitleScene');
  }

  create(): void {
    this.text = this.add.text(0, 0, '', { ...textStyle(18), align: 'center', wordWrap: { width: 760 } }).setOrigin(0.5).setStroke('#000', 4);
    this.bg = this.add.rectangle(0, 0, 10, 10, 0x05050a, 0.7).setStrokeStyle(1, 0x7a6030);
    this.box = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT - 212, [this.bg, this.text]).setAlpha(0);
    const off = Voice.onSubtitle((line, speaker) => this.show(line, speaker));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  private show(line: string | null, speaker: Speaker): void {
    this.tweens.killTweensOf(this.box);
    if (!line) {
      this.tweens.add({ targets: this.box, alpha: 0, duration: 300, delay: 400 });
      return;
    }
    this.text.setText(`« ${line} »`).setColor(SPEAKER_COLOR[speaker]);
    this.bg.setSize(this.text.width + 36, this.text.height + 14);
    this.box.setAlpha(1);
  }
}
