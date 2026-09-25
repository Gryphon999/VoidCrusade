import Phaser from 'phaser';
import { spawnOrderMarker } from './OrderMarker';
import { BloodEffect } from './BloodEffect';
import { ExplosionEffect } from './ExplosionEffect';
import { CorpseSystem } from './CorpseSystem';
import { LightSystem } from './LightSystem';
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
  readonly lights: LightSystem;

  constructor(private scene: Phaser.Scene) {
    this.blood = new BloodEffect(scene);
    this.explosions = new ExplosionEffect(scene);
    this.corpses = new CorpseSystem(scene);
    this.lights = new LightSystem(scene);
    const ev = scene.events;
    ev.on(EV.unitDied, (x: number, y: number, u: Unit) => {
      this.blood.spawnDeath(x, y, 8 + u.def.size * 0.6);
      this.corpses.spawn(u);
    });
    ev.on(EV.unitHit, (x: number, y: number) => this.blood.spawnHit(x, y));
    ev.on(EV.buildingDestroyed, (b: Building) => {
      this.explosions.explode(b.x, b.y, b.radius, b.def.height * 0.5);
      this.lights.flash(b.x, Projection.vy(b.y), b.radius * 4, 0xff8a30, 900, 1);
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
    this.lights.fire(b.x, Projection.vy(b.y), b.radius * 2.2, 25);
  }

  update(): void {
    this.lights.update();
  }

  /** Muzzle flash light at a view-space point. */
  muzzle(x: number, y: number, kind: string): void {
    const col = kind === 'spit' ? 0x80ff50 : kind === 'spine' ? 0xd070ff : 0xffc060;
    this.lights.flash(x, y + 6, kind === 'shell' ? 60 : 36, col, 90, 0.7);
  }

  orderMarker(x: number, y: number, attack: boolean): void {
    spawnOrderMarker(this.scene, x, y, attack);
  }
}
