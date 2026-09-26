import Phaser from 'phaser';
import { DEPTH, FX } from '../config';
import { Projection } from '../render/Projection';
import { Culler } from '../render/Culler';
import { UNIT_MODELS, atlasKey, frameName } from '../render/puppet/UnitAtlas';
import { ANIM_FRAMES } from '../render/puppet/Models';
import { Unit } from '../units/Unit';
import { hide2D } from '../render3d/hide2D';
import type { UnitId } from '../units/UnitDefs';

/** A body on the ground, as the 3D renderer draws it (the 2D image keeps its lifetime and fade). */
export interface Body {
  id: UnitId;
  x: number;
  y: number;
  angle: number;
  /** scene.time.now when the death animation started. */
  born: number;
  img: Phaser.GameObjects.Image;
}

/** Plays death animations and leaves bodies on the ground; the oldest fade out past the cap. */
export class CorpseSystem {
  private corpses: Phaser.GameObjects.Image[] = [];
  readonly bodies: Body[] = [];

  constructor(private scene: Phaser.Scene) {}

  spawn(u: Unit): Phaser.GameObjects.Image {
    const m = UNIT_MODELS[u.def.id];
    const dir = u.dir;
    const img = this.scene.add.image(u.x, Projection.vy(u.y), atlasKey(u.def.id), frameName('death', 0, dir));
    img.setOrigin(m.anchorX / m.cellW, m.anchorY / m.cellH).setDepth(Projection.depth(u.y));
    hide2D(this.scene, img);
    this.bodies.push({ id: u.def.id, x: u.x, y: u.y, angle: u.angle, born: this.scene.time.now, img });
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
          // Infantry bodies lie under the living; wrecks stay Y-sorted (they block movement).
          if (u.def.category !== 'vehicle') img.setDepth(DEPTH.decals + 1);
          img.setTint(0xb8b0a8);
          Culler.for(this.scene).add(img, img.x, img.y);
        }
      },
    });
    this.corpses.push(img);
    while (this.corpses.length > FX.maxCorpses) {
      const old = this.corpses.shift() as Phaser.GameObjects.Image;
      this.scene.tweens.add({ targets: old, alpha: 0, duration: 1500, onComplete: () => old.destroy() });
    }
    return img;
  }

  /** Drops bodies whose image is gone (called by the 3D renderer each frame). */
  pruneBodies(): void {
    for (let i = this.bodies.length - 1; i >= 0; i--) if (!this.bodies[i].img.active) this.bodies.splice(i, 1);
  }
}
