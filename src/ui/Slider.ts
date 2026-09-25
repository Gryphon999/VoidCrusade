import Phaser from 'phaser';
import { textStyle } from './uiStyle';

/** Horizontal 0..1 slider with label and percentage readout. */
export class Slider {
  readonly container: Phaser.GameObjects.Container;
  private knob: Phaser.GameObjects.Arc;
  private fill: Phaser.GameObjects.Rectangle;
  private readout: Phaser.GameObjects.Text;
  private value: number;

  constructor(scene: Phaser.Scene, x: number, y: number, private width: number, label: string, initial: number,
    private onChange: (v: number) => void) {
    this.value = initial;
    const lbl = scene.add.text(0, -26, label, textStyle(16));
    const track = scene.add.rectangle(0, 0, width, 8, 0x22222e).setOrigin(0, 0.5).setStrokeStyle(1, 0x5a5a7a);
    this.fill = scene.add.rectangle(0, 0, width * initial, 8, 0x3a8dff).setOrigin(0, 0.5);
    this.knob = scene.add.circle(width * initial, 0, 11, 0xd8d8e8).setStrokeStyle(2, 0x3a8dff);
    this.readout = scene.add.text(width + 18, 0, '', textStyle(15, '#bcc')).setOrigin(0, 0.5);
    const hit = scene.add.rectangle(-10, 0, width + 20, 30, 0x000000, 0).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    this.container = scene.add.container(x, y, [lbl, track, this.fill, this.knob, this.readout, hit]);
    let dragging = false;
    const apply = (p: Phaser.Input.Pointer): void => {
      const local = p.x - this.container.x - (this.container.parentContainer?.x ?? 0);
      this.set(Phaser.Math.Clamp(local / this.width, 0, 1), true);
    };
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragging = true;
      apply(p);
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragging && p.isDown) apply(p);
    });
    scene.input.on('pointerup', () => (dragging = false));
    this.set(initial, false);
  }

  set(v: number, notify: boolean): void {
    this.value = v;
    this.fill.width = this.width * v;
    this.knob.x = this.width * v;
    this.readout.setText(`${Math.round(v * 100)}%`);
    if (notify) this.onChange(v);
  }

  get(): number {
    return this.value;
  }
}
