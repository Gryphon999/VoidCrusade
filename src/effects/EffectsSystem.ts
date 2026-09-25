import Phaser from 'phaser';
import { spawnOrderMarker } from './OrderMarker';
import { BloodEffect } from './BloodEffect';
import { ExplosionEffect } from './ExplosionEffect';
import { CorpseSystem } from './CorpseSystem';
import { LightSystem } from './LightSystem';
import { ProjectileSystem } from './ProjectileSystem';
import { ruinKey } from '../render/buildings/BuildingArt';
import { Projection } from '../render/Projection';
import { Culler } from '../render/Culler';
import { DEPTH, GFX } from '../config';
import { EV } from '../events';
import { Settings } from '../systems/Settings';
import { Unit } from '../units/Unit';
import { Building } from '../buildings/Building';

/** Facade for visual effects; subscribes to gameplay events. */
export class EffectsSystem {
  readonly blood: BloodEffect;
  readonly explosions: ExplosionEffect;
  readonly corpses: CorpseSystem;
  readonly lights: LightSystem;
  readonly projectiles: ProjectileSystem;
  private flashes: Phaser.GameObjects.Particles.ParticleEmitter;
  private casings: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkFx: Phaser.GameObjects.Particles.ParticleEmitter;
  private dustFx: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly detail = GFX[Settings.get().graphics].particleMult;

  constructor(private scene: Phaser.Scene) {
    this.blood = new BloodEffect(scene);
    this.explosions = new ExplosionEffect(scene);
    this.corpses = new CorpseSystem(scene);
    this.lights = new LightSystem(scene);
    this.projectiles = new ProjectileSystem(scene, this.explosions);
    this.flashes = scene.add.particles(0, 0, 'fx_muzzle', {
      emitting: false, lifespan: 70, scale: { start: 0.9, end: 0.4 }, alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 }, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.projectiles + 1);
    this.casings = scene.add.particles(0, 0, 'fx_casing', {
      emitting: false, lifespan: 380, speedY: { min: -70, max: -40 }, gravityY: 320, rotate: { min: 0, max: 360 },
      alpha: { start: 1, end: 0.6 },
    }).setDepth(DEPTH.projectiles);
    this.dustFx = scene.add.particles(0, 0, 'fx_soft', {
      emitting: false, lifespan: 600, speed: { min: 10, max: 40 }, scale: { start: 0.4, end: 1.2 }, alpha: { start: 0.45, end: 0 },
      tint: 0x8a7a66,
    }).setDepth(DEPTH.effects);
    this.sparkFx = scene.add.particles(0, 0, 'fx_dot', {
      emitting: false, lifespan: { min: 200, max: 420 }, speed: { min: 40, max: 140 }, angle: { min: 200, max: 340 },
      gravityY: 380, scale: { start: 0.28, end: 0 }, tint: [0xfff0a0, 0xffb040], blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.effects);
    const ev = scene.events;
    ev.on(EV.unitDied, (x: number, y: number, u: Unit) => this.onDeath(x, y, u));
    ev.on(EV.unitHit, (x: number, y: number, u: Unit, dir: number) => this.blood.spawnHit(x, y, u.owner === 'enemy', dir));
    ev.on(EV.buildingDestroyed, (b: Building) => {
      this.explosions.explode(b.x, b.y, b.radius, b.def.height * 0.5);
      this.lights.flash(b.x, Projection.vy(b.y), b.radius * 4, 0xff8a30, 900, 1);
      this.blood.scorch(b.x, b.y, b.radius * 1.3);
      this.leaveRuin(b);
    });
    ev.on(EV.buildingDamaged, (b: Building) => {
      if (Math.random() >= 0.3) return;
      const p = b.view.aimPoint();
      this.explosions.impact(p.x + Phaser.Math.Between(-20, 20), p.y + Phaser.Math.Between(-20, 20));
    });
  }

  private onDeath(x: number, y: number, u: Unit): void {
    const alien = u.owner === 'enemy';
    this.blood.spawnDeath(x, y, (8 + u.def.size * 0.6) * this.detail, alien);
    if (u.def.id === 'crawler' && Math.random() < 0.3) {
      // Burst apart instead of leaving a body.
      this.blood.gib(x, y, 0x5a1f4e, 10);
      return;
    }
    this.corpses.spawn(u);
  }

  /** Burnt-out ruin sprite with flames and smoke where a building stood. */
  private leaveRuin(b: Building): void {
    const bottom = b.y + b.radius;
    const key = ruinKey(this.scene, b.def.size, Projection.tilt, b.def.faction === 'nullhorde');
    const ruin = this.scene.add.image(b.x, Projection.vy(bottom) + 4, key).setOrigin(0.5, 1).setDepth(Projection.depth(bottom - 8));
    Culler.for(this.scene).add(ruin, b.x, Projection.vy(b.y));
    this.explosions.burn(b.x, Projection.vy(b.y), b.radius, 25);
    this.lights.fire(b.x, Projection.vy(b.y), b.radius * 2.2, 25);
  }

  update(dt: number): void {
    this.lights.update();
    this.projectiles.update(dt);
  }

  /** Muzzle flash sprite + light, and a spent casing for kinetic weapons (view space). */
  muzzle(x: number, y: number, kind: string, towardX: number): void {
    const col = kind === 'spit' ? 0x80ff50 : kind === 'spine' || kind === 'psy' ? 0xd070ff : kind === 'flame' ? 0xff8030 : 0xffc060;
    this.lights.flash(x, y + 6, kind === 'shell' || kind === 'flame' ? 60 : kind === 'sniper' ? 50 : 36, col, 90, 0.7);
    if (kind === 'bullet' || kind === 'shell' || kind === 'sniper') {
      this.flashes.emitParticleAt(x, y, 1);
      this.casings.speedX = towardX > 0 ? -40 : 40;
      if (Math.random() < 0.6 * this.detail) this.casings.emitParticleAt(x, y, 1);
    }
  }

  /** Welding sparks (engineer repairs). */
  sparks(x: number, y: number): void {
    this.sparkFx.emitParticleAt(x, y, 4);
    this.lights.flash(x, y, 26, 0xffd080, 80, 0.5);
  }

  /** Dust kicked up where a shot hits rock. */
  dust(x: number, y: number): void {
    this.dustFx.emitParticleAt(x, y, 3);
    this.explosions.impact(x, y);
  }

  orderMarker(x: number, y: number, attack: boolean): void {
    spawnOrderMarker(this.scene, x, y, attack);
  }
}
