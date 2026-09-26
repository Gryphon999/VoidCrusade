import Phaser from 'phaser';
import { hide2D } from '../render3d/hide2D';
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
  private exhaustFx: Phaser.GameObjects.Particles.ParticleEmitter;
  private tracks: Phaser.GameObjects.Image[] = [];
  private trackBorn = new WeakMap<Phaser.GameObjects.Image, number>();
  private trackIdx = 0;
  private trackFade = 0;
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
    this.exhaustFx = scene.add.particles(0, 0, 'fx_soft', {
      emitting: false, lifespan: { min: 600, max: 1000 }, speedY: { min: -30, max: -14 }, speedX: { min: -8, max: 8 },
      scale: { start: 0.25, end: 0.9 }, alpha: { start: 0.4, end: 0 }, tint: [0x3a3836, 0x5a5652],
    }).setDepth(DEPTH.effects - 1);
    const trackLayer = scene.add.layer().setDepth(DEPTH.decals + 0.5);
    for (let i = 0; i < 180; i++) {
      const img = scene.add.image(0, 0, 'fx_track').setVisible(false);
      trackLayer.add(img);
      this.tracks.push(img);
    }
    const ev = scene.events;
    ev.on(EV.unitDied, (x: number, y: number, u: Unit) => this.onDeath(x, y, u));
    ev.on(EV.unitHit, (x: number, y: number, u: Unit, dir: number) => this.blood.spawnHit(x, y, u.owner === 'enemy', dir));
    ev.on(EV.buildingDestroyed, (b: Building) => {
      this.explosions.explode(b.x, b.y, b.radius, b.def.height * 0.5);
      this.lights.flash(b.x, Projection.vy(b.y), b.radius * 4, 0xff8a30, 900, 1);
      this.blood.scorch(b.x, b.y, b.radius * 1.3);
    });
    ev.on(EV.buildingDamaged, (b: Building) => {
      if (Math.random() >= 0.3) return;
      const p = b.view.aimPoint();
      this.explosions.impact(p.x + Phaser.Math.Between(-20, 20), p.y + Phaser.Math.Between(-20, 20));
    });
  }

  private onDeath(x: number, y: number, u: Unit): void {
    // Vehicles and war-beasts are handled by vehicleDeath (called by the wreck system).
    if (u.def.category === 'vehicle') return;
    const alien = u.owner === 'enemy';
    this.blood.spawnDeath(x, y, (8 + u.def.size * 0.6) * this.detail, alien);
    if (u.def.id === 'crawler' && Math.random() < 0.3) {
      // Burst apart instead of leaving a body.
      this.blood.gib(x, y, 0x5a1f4e, 10);
      return;
    }
    this.corpses.spawn(u);
  }

  /** Burnt-out ruin sprite with flames and smoke where a building stood (called by the wreck system). */
  leaveRuin(b: Building): Phaser.GameObjects.Image {
    const bottom = b.y + b.radius;
    const key = ruinKey(this.scene, b.def.size, Projection.tilt, b.def.faction === 'nullhorde');
    const ruin = this.scene.add.image(b.x, Projection.vy(bottom) + 4, key).setOrigin(0.5, 1).setDepth(Projection.depth(bottom - 8));
    Culler.for(this.scene).add(ruin, b.x, Projection.vy(b.y));
    hide2D(this.scene, ruin);
    this.explosions.burn(b.x, Projection.vy(b.y), b.radius, b.def.size >= 3 ? 25 : 10);
    this.lights.fire(b.x, Projection.vy(b.y), b.radius * 2.2, b.def.size >= 3 ? 25 : 10);
    return ruin;
  }

  update(dt: number): void {
    this.lights.update();
    this.projectiles.update(dt);
    this.trackFade -= dt;
    if (this.trackFade <= 0) {
      this.trackFade = 0.25;
      this.fadeTracks();
    }
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

  /** A vehicle blows up (or a war-beast collapses) and leaves its wreck sprite; returns that sprite. */
  vehicleDeath(u: Unit): Phaser.GameObjects.Image {
    const vy = Projection.vy(u.y);
    if (u.def.faction === 'ironvoid') {
      this.explosions.explode(u.x, u.y, u.radius * 2, u.height * 0.4);
      this.lights.flash(u.x, vy, u.radius * 6, 0xff8a30, 700, 1);
      this.blood.scorch(u.x, u.y, u.radius * 1.4);
      this.explosions.burn(u.x, vy - 6, u.radius * 0.8, 12);
    } else {
      this.blood.spawnDeath(u.x, u.y, 16 * this.detail, true);
      this.blood.gib(u.x, u.y, 0x5a1f4e, Math.round(8 + u.radius / 3));
      this.lights.flash(u.x, vy, u.radius * 4, 0xc050ff, 500, 0.8);
    }
    return this.corpses.spawn(u);
  }

  /** Translucent void dome over a logical point for `seconds`. */
  shieldDome(x: number, y: number, r: number, seconds: number): void {
    const k = Projection.tilt;
    const vy = Projection.vy(y);
    const dome = this.scene.add.graphics({ x, y: vy }).setDepth(DEPTH.effects - 3).setBlendMode(Phaser.BlendModes.ADD);
    // Rim ellipse on the ground plus a few latitude arcs: reads as a hemisphere in the tilted view.
    dome.fillStyle(0x60b0ff, 0.08).fillEllipse(0, 0, r * 2, r * 2 * k);
    dome.lineStyle(3, 0x80c8ff, 0.7).strokeEllipse(0, 0, r * 2, r * 2 * k);
    for (let i = 1; i <= 3; i++) {
      const f = i / 4;
      const rr = r * Math.cos(f * Math.PI / 2);
      const h = r * Math.sin(f * Math.PI / 2) * 0.9;
      dome.lineStyle(1.5, 0x80c8ff, 0.35).strokeEllipse(0, -h, rr * 2, rr * 2 * k);
    }
    dome.lineStyle(1.5, 0x80c8ff, 0.35).beginPath().arc(0, 0, r, Math.PI, 0).strokePath();
    dome.setAlpha(0);
    this.scene.tweens.add({ targets: dome, alpha: 1, duration: 300 });
    this.scene.tweens.add({ targets: dome, alpha: { from: 1, to: 0.6 }, duration: 700, yoyo: true, repeat: Math.max(0, Math.floor(seconds / 1.4) - 1), delay: 300 });
    this.scene.time.delayedCall(seconds * 1000, () => {
      this.scene.tweens.add({ targets: dome, alpha: 0, duration: 400, onComplete: () => dome.destroy() });
    });
    this.lights.flash(x, vy, r * 1.6, 0x60b0ff, 600, 0.8);
  }

  /** Thick grey smoke over a logical point for `seconds`. */
  smokeCloud(x: number, y: number, r: number, seconds: number): void {
    const vy = Projection.vy(y);
    const k = Projection.tilt;
    const em = this.scene.add.particles(x, vy, 'fx_soft', {
      frequency: 60, quantity: 2, x: { min: -r * 0.8, max: r * 0.8 }, y: { min: -r * 0.8 * k, max: r * 0.8 * k },
      speedY: { min: -14, max: -4 }, speedX: { min: -8, max: 8 }, scale: { start: r / 30, end: r / 14 },
      alpha: { start: 0.55, end: 0 }, lifespan: { min: 2200, max: 3400 }, tint: [0x8a8680, 0x9a968e, 0x6a6660],
    }).setDepth(DEPTH.effects + 8);
    em.explode(24);
    this.scene.time.delayedCall(seconds * 1000 - 1500, () => em.stop());
    this.scene.time.delayedCall(seconds * 1000 + 3000, () => em.destroy());
  }

  /** Hissing green acid haze over a logical point for `seconds`. */
  acidCloud(x: number, y: number, r: number, seconds: number): void {
    const vy = Projection.vy(y);
    const k = Projection.tilt;
    const em = this.scene.add.particles(x, vy, 'fx_soft', {
      frequency: 70, quantity: 2, x: { min: -r * 0.8, max: r * 0.8 }, y: { min: -r * 0.8 * k, max: r * 0.8 * k },
      speedY: { min: -18, max: -6 }, scale: { start: r / 40, end: r / 18 }, alpha: { start: 0.45, end: 0 },
      lifespan: { min: 1200, max: 2000 }, tint: [0x80ff40, 0x60c020, 0xb0ff70], blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH.effects + 6);
    this.scene.time.delayedCall(seconds * 1000, () => em.stop());
    this.scene.time.delayedCall(seconds * 1000 + 2200, () => em.destroy());
    this.lights.flash(x, vy, r * 2, 0x80ff40, seconds * 1000, 0.5);
  }

  /** Expanding ground ring (auras, screams, rallies). */
  pulseRing(x: number, y: number, r: number, color: number): void {
    const k = Projection.tilt;
    const img = this.scene.add.image(x, Projection.vy(y), 'capture_ring').setTint(color).setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.groundFx).setScale(0.2, 0.2 * k);
    const s = (r * 2) / 256;
    this.scene.tweens.add({ targets: img, scaleX: s, scaleY: s * k, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => img.destroy() });
    this.lights.flash(x, Projection.vy(y), r, color, 400, 0.8);
  }

  /** Red warning circle for incoming strikes and drop pods (`seconds` long). */
  targetMarker(x: number, y: number, r: number, seconds: number, color = 0xff4030): void {
    const k = Projection.tilt;
    const g = this.scene.add.graphics({ x, y: Projection.vy(y) }).setDepth(DEPTH.groundFx);
    g.lineStyle(3, color, 0.9).strokeEllipse(0, 0, r * 2, r * 2 * k);
    g.lineStyle(1.5, color, 0.6).strokeEllipse(0, 0, r, r * k);
    g.lineBetween(-r * 0.3, 0, r * 0.3, 0).lineBetween(0, -r * 0.3 * k, 0, r * 0.3 * k);
    this.scene.tweens.add({ targets: g, alpha: 0.35, duration: 250, yoyo: true, repeat: Math.max(1, Math.round(seconds * 2)) });
    this.scene.time.delayedCall(seconds * 1000 + 300, () => g.destroy());
  }

  /** A shot stopped by a shield: blue ripple at a view-space point. */
  shieldHit(x: number, y: number): void {
    this.lights.flash(x, y, 40, 0x80c8ff, 200, 0.7);
    this.sparkFx.setParticleTint(0x9ad8ff);
    this.sparkFx.emitParticleAt(x, y, 3);
    this.sparkFx.setParticleTint(0xffd080);
  }

  /** Engine exhaust puff at a view-space point. */
  exhaust(x: number, y: number): void {
    this.exhaustFx.emitParticleAt(x, y, 1);
  }

  /** Tread/tyre marks pressed into the ground behind a vehicle (logical position and heading). */
  trackMark(x: number, y: number, heading: number, width: number): void {
    const img = this.tracks[this.trackIdx];
    this.trackIdx = (this.trackIdx + 1) % this.tracks.length;
    const vy = Projection.vy(y);
    const rot = Math.atan2(Math.sin(heading) * Projection.tilt, Math.cos(heading));
    img.setPosition(x, vy).setRotation(rot).setScale(1, width).setAlpha(0.5).setVisible(true);
    this.trackBorn.set(img, this.scene.time.now);
  }

  /** Fades old tread marks (called from update). */
  private fadeTracks(): void {
    const now = this.scene.time.now;
    for (const img of this.tracks) {
      if (!img.visible) continue;
      const age = (now - (this.trackBorn.get(img) ?? now)) / 1000;
      if (age > 14) img.setVisible(false);
      else if (age > 6) img.setAlpha(0.5 * (1 - (age - 6) / 8));
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
