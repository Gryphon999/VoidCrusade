import Phaser from 'phaser';
import { DEPTH, FX } from '../config';
import { DragProcessor } from './DragProcessor';
import { Projection } from '../render/Projection';
import { Culler } from '../render/Culler';
import { makeCanvas } from '../render/CanvasUtil';

const HUMAN = [0x8a0000, 0xa00808, 0x6a0000, 0xc01010];
/** Null Horde ichor: violet with a sickly green sheen. */
const ALIEN = [0x6a1a6a, 0x8a2a8a, 0x4a8a20, 0x9a40a0];

/** Decal textures are baked for size BASE and scaled per splat. */
const BASE = 24;
const VARIANTS = 6;

const hex = (c: number, a = 1): string => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

/** Pre-renders blood pools, ichor pools and scorch marks once per game (canvas textures). */
function bakeDecals(scene: Phaser.Scene): void {
  if (scene.textures.exists('decal_human_0')) return;
  const S = BASE * 5;
  const c = S / 2;
  const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void => {
    ctx.beginPath();
    ctx.arc(c + x, c + y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const [kind, pal] of [['human', HUMAN], ['alien', ALIEN]] as const) {
    for (let v = 0; v < VARIANTS; v++) {
      const { canvas, ctx } = makeCanvas(S, S);
      const size = BASE;
      const main = pal[v % 3];
      ctx.fillStyle = hex(kind === 'alien' ? 0x1a0a1a : 0x3a0000);
      ctx.beginPath();
      ctx.ellipse(c, c, size * 0.8, size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hex(main);
      const blobs = 4 + ((v * 3) % 4);
      for (let i = 0; i < blobs; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * size * 0.7;
        circle(ctx, Math.cos(a) * d, Math.sin(a) * d, size * (0.25 + Math.random() * 0.35));
      }
      // Wet highlight and flung droplets.
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.ellipse(c - size * 0.2, c - size * 0.2, size * 0.25, size * 0.125, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hex(main);
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = size * (0.9 + Math.random() * 1.2);
        circle(ctx, Math.cos(a) * d, Math.sin(a) * d, 1 + Math.random() * 2);
      }
      scene.textures.addCanvas(`decal_${kind}_${v}`, canvas);
    }
  }
  for (let v = 0; v < VARIANTS; v++) {
    const { canvas, ctx } = makeCanvas(S, S);
    ctx.fillStyle = 'rgba(8,6,4,0.18)';
    for (let i = 0; i < 6; i++) {
      circle(ctx, (Math.random() - 0.5) * BASE * 0.6, (Math.random() - 0.5) * BASE * 0.6, BASE * (0.4 + Math.random() * 0.6));
    }
    scene.textures.addCanvas(`decal_scorch_${v}`, canvas);
  }
}

/** Blood droplets, directional sprays, gibs and persistent ground decals (oldest fade out). */
export class BloodEffect {
  private drops: Phaser.GameObjects.Particles.ParticleEmitter;
  private spray: Phaser.GameObjects.Particles.ParticleEmitter;
  private chunks: Phaser.GameObjects.Particles.ParticleEmitter;
  private decalLayer: Phaser.GameObjects.Layer;
  private decals: Phaser.GameObjects.Image[] = [];
  private free: Phaser.GameObjects.Image[] = [];
  private culler: Culler;

  constructor(private scene: Phaser.Scene) {
    this.decalLayer = scene.add.layer().setDepth(DEPTH.decals);
    this.culler = Culler.for(scene);
    bakeDecals(scene);
    this.drops = scene.add.particles(0, 0, 'fx_dot', {
      emitting: false, speed: { min: 60, max: 240 }, angle: { min: 0, max: 360 },
      // Random radius 2-6px per droplet (texture radius is 6px).
      scale: { min: 0.33, max: 1 }, alpha: { start: 1, end: 0 }, lifespan: { min: 400, max: 800 }, gravityY: 180,
    });
    this.drops.addParticleProcessor(new DragProcessor(0.02));
    this.drops.setDepth(DEPTH.effects);
    this.spray = scene.add.particles(0, 0, 'fx_dot', {
      emitting: false, speed: { min: 90, max: 220 }, scale: { start: 0.35, end: 0.12 }, alpha: { start: 1, end: 0 },
      lifespan: { min: 220, max: 420 }, gravityY: 260,
    });
    this.spray.addParticleProcessor(new DragProcessor(0.05));
    this.spray.setDepth(DEPTH.effects);
    this.chunks = scene.add.particles(0, 0, 'fx_chunk', {
      emitting: false, speed: { min: 80, max: 220 }, angle: { min: 200, max: 340 }, gravityY: 420, rotate: { min: 0, max: 360 },
      scale: { min: 0.6, max: 1.2 }, lifespan: { min: 500, max: 800 }, alpha: { start: 1, end: 0.7 },
    }).setDepth(DEPTH.effects);
  }

  /** Big splatter on death: 8-16 droplets plus a permanent pool. */
  spawnDeath(x: number, y: number, amount: number, alien = false): void {
    const n = Phaser.Math.Clamp(Math.round(amount), 8, 16);
    const pal = alien ? ALIEN : HUMAN;
    this.drops.setParticleTint(Phaser.Utils.Array.GetRandom(pal) as number);
    this.drops.explode(n, x, Projection.vy(y) - 8);
    this.addDecal(x, y, 6 + n * 0.8, pal);
  }

  /** Arterial spray away from the shooter when a unit is hit (dir = logical angle of the shot). */
  spawnHit(x: number, y: number, alien = false, dir = Math.random() * Math.PI * 2): void {
    const pal = alien ? ALIEN : HUMAN;
    const a = Phaser.Math.RadToDeg(Math.atan2(Math.sin(dir) * Projection.tilt, Math.cos(dir)));
    this.spray.setParticleTint(Phaser.Utils.Array.GetRandom(pal) as number);
    this.spray.setEmitterAngle({ min: a - 28, max: a + 28 });
    this.spray.explode(Phaser.Math.Between(3, 5), x, Projection.vy(y) - 12);
    if (Math.random() < 0.2) this.addDecal(x + Math.cos(dir) * 8, y + Math.sin(dir) * 8, 4, pal);
  }

  /** Body bursts into chunks (used for some Crawler deaths). */
  gib(x: number, y: number, flesh: number, n: number): void {
    this.chunks.setParticleTint(flesh);
    this.chunks.explode(n, x, Projection.vy(y) - 10);
    this.drops.setParticleTint(ALIEN[0]);
    this.drops.explode(14, x, Projection.vy(y) - 8);
    this.addDecal(x, y, 18, ALIEN);
  }

  /** Scorched blast mark on the ground. */
  scorch(x: number, y: number, r: number): void {
    this.place(`decal_scorch_${Phaser.Math.Between(0, VARIANTS - 1)}`, x, y, r / BASE, 1);
  }

  private addDecal(x: number, y: number, size: number, pal: number[]): void {
    const kind = pal === ALIEN ? 'alien' : 'human';
    this.place(`decal_${kind}_${Phaser.Math.Between(0, VARIANTS - 1)}`, x, y, size / BASE, FX.decalAlpha);
  }

  /** Recycles a pooled decal image; squashed so it lies flat on the tilted ground. */
  private place(key: string, x: number, y: number, scale: number, alpha: number): void {
    const vy = Projection.vy(y);
    const img = this.free.pop() ?? this.scene.add.image(0, 0, key);
    img.setTexture(key).setPosition(x, vy).setAlpha(alpha).setVisible(true).setFlipX(Math.random() < 0.5)
      .setScale(scale, scale * Projection.tilt);
    this.decalLayer.add(img);
    this.culler.add(img, x, vy);
    this.decals.push(img);
    while (this.decals.length > FX.maxDecals) {
      const old = this.decals.shift() as Phaser.GameObjects.Image;
      this.scene.tweens.add({ targets: old, alpha: 0, duration: 2000, onComplete: () => this.recycle(old) });
    }
  }

  private recycle(img: Phaser.GameObjects.Image): void {
    img.setVisible(false);
    this.culler.remove(img);
    this.free.push(img);
  }

  get decalCount(): number {
    return this.decals.length;
  }
}
