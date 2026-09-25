import Phaser from 'phaser';
import { spawnOrderMarker } from './OrderMarker';
import { BloodEffect } from './BloodEffect';
import { ExplosionEffect } from './ExplosionEffect';
import { EV } from '../events';
import { Unit } from '../units/Unit';
import { Building } from '../buildings/Building';

/** Facade for visual effects; subscribes to gameplay events. */
export class EffectsSystem {
  readonly blood: BloodEffect;
  readonly explosions: ExplosionEffect;

  constructor(private scene: Phaser.Scene) {
    this.blood = new BloodEffect(scene);
    this.explosions = new ExplosionEffect(scene);
    const ev = scene.events;
    ev.on(EV.unitDied, (x: number, y: number, u: Unit) => this.blood.spawnDeath(x, y, 8 + u.def.size * 0.6));
    ev.on(EV.unitHit, (x: number, y: number) => this.blood.spawnHit(x, y));
    ev.on(EV.buildingDestroyed, (b: Building) => this.explosions.explode(b.x, b.y, b.radius));
    ev.on(EV.buildingDamaged, (b: Building) => {
      if (Math.random() < 0.3) this.explosions.impact(b.x + Phaser.Math.Between(-20, 20), b.y + Phaser.Math.Between(-20, 20));
    });
  }

  orderMarker(x: number, y: number, attack: boolean): void {
    spawnOrderMarker(this.scene, x, y, attack);
  }
}
