import Phaser from 'phaser';
import { DEPTH, FX } from '../config';
import { Projection } from '../render/Projection';
import { UNIT_MODELS, atlasKey, frameName } from '../render/puppet/UnitAtlas';
import { ANIM_FRAMES } from '../render/puppet/Models';
import { Unit } from '../units/Unit';

/** Plays death animations and leaves bodies on the ground; the oldest fade out past the cap. */
export class CorpseSystem {
  private corpses: Phaser.GameObjects.Image[] = [];

  constructor(private scene: Phaser.Scene) {}

  spawn(u: Unit): void {
    const m = UNIT_MODELS[u.def.id];
    const dir = u.dir;
    const img = this.scene.add.image(u.x, Projection.vy(u.y), atlasKey(u.def.id), frameName('death', 0, dir));
    img.setOrigin(m.anchorX / m.cellW, m.anchorY / m.cellH).setDepth(Projection.depth(u.y));
    let f = 0;
    this.scene.time.addEvent({
      delay: 110,
      repeat: ANIM_FRAMES.death - 2,
      callback: () => {
        if (!img.active) return;
        f++;
        img.setFrame(frameName('death', f, dir));
        // Once down, bodies lie under the living.
        if (f === ANIM_FRAMES.death - 1) {
          img.setDepth(DEPTH.decals + 1);
          img.setTint(0xb8b0a8);
        }
      },
    });
    this.corpses.push(img);
    while (this.corpses.length > FX.maxCorpses) {
      const old = this.corpses.shift() as Phaser.GameObjects.Image;
      this.scene.tweens.add({ targets: old, alpha: 0, duration: 1500, onComplete: () => old.destroy() });
    }
  }
}
