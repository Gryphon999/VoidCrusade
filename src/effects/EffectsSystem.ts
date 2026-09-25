import Phaser from 'phaser';
import { spawnOrderMarker } from './OrderMarker';
import { BloodEffect } from './BloodEffect';
import { ExplosionEffect } from './ExplosionEffect';
import { CorpseSystem } from './CorpseSystem';
import { ruinKey } from '../render/buildings/BuildingArt';
import { Projection } from '../render/Projection';
import { EV } from '../events';
import { Unit } from '../units/Unit';
import { Building } from '../buildings/Building';

/** Facade for visual effects; subscribes to gameplay events. */
export class EffectsSystem {
  readonly blood: BloodEffect;
  readonly explosions: ExplosionEffect;
  readonly corpses: CorpseSystem;

  constructor(private scene: Phaser.Scene) {
    this.blood = new BloodEffect(scene);
    this.explosions = new ExplosionEffect(scene);
    this.corpses = new CorpseSystem(scene);
    const ev = scene.events;
    ev.on(EV.unitDied, (x: number, y: number, u: Unit) => {
      this.blood.spawnDeath(x, y, 8 + u.def.size * 0.6);
      this.corpses.spawn(u);
    });
    ev.on(EV.unitHit, (x: number, y: number) => this.blood.spawnHit(x, y));
    ev.on(EV.buildingDestroyed, (b: Building) => {
      this.explosions.explode(b.x, b.y, b.radius, b.def.height * 0.5);
      this.leaveRuin(b);
    });
    ev.on(EV.buildingDamaged, (b: Building) => {
      if (Math.random() >= 0.3) return;
      const p = b.view.aimPoint();
      this.explosions.impact(p.x + Phaser.Math.Between(-20, 20), p.y + Phaser.Math.Between(-20, 20));
    });
  }

  /** Burnt-out ruin sprite with flames and smoke where a building stood. */
  private leaveRuin(b: Building): void {
    const bottom = b.y + b.radius;
    const key = ruinKey(this.scene, b.def.size, Projection.tilt, b.def.faction === 'nullhorde');
    this.scene.add.image(b.x, Projection.vy(bottom) + 4, key).setOrigin(0.5, 1).setDepth(Projection.depth(bottom - 8));
    this.explosions.burn(b.x, Projection.vy(b.y), b.radius, 25);
  }

  orderMarker(x: number, y: number, attack: boolean): void {
    spawnOrderMarker(this.scene, x, y, attack);
  }
}
