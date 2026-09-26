import Phaser from 'phaser';
import { DEPTH } from '../config';
import { Projection } from '../render/Projection';
import { Owner } from '../types';
import { UnitDef } from './UnitDefs';
import { MODEL_HEIGHT, UNIT_MODELS, atlasKey, dirFromAngle, frameName, turretKey } from '../render/puppet/UnitAtlas';
import { AnimName } from '../render/puppet/Models';
import { hide2D } from '../render3d/hide2D';
import type { Squad } from './Squad';

let nextUnitId = 1;

/** A single soldier: logic state plus its animated 8-facing sprite. Squads own and steer these. */
export class Unit {
  readonly uid = nextUnitId++;
  readonly def: UnitDef;
  readonly owner: Owner;
  squad: Squad;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  hp: number;
  maxHp: number;
  cooldown: number;
  /** Formation slot index within the squad. */
  slot = 0;
  inCover = false;
  /** Private path back to the squad when the unit is snagged behind an obstacle. */
  detour: { x: number; y: number }[] = [];
  stuckTime = 0;
  alive = true;
  /** True when a cliff or building is drawn over this unit. */
  occluded = false;
  /** Facing in logical space (radians, 0 = east). */
  angle: number;
  /** Height above ground (leaps), px. */
  lift = 0;
  /** Turret facing (tanks); follows the hull when there is nothing to shoot. */
  turretAngle: number;
  private turret?: Phaser.GameObjects.Image;
  private turretFrame = '';
  private hoverT = Math.random() * 6;
  /** Multiplier for the next attack (leap landing, ambush). */
  strikeMult = 1;
  /** Active leap arc. */
  leapArc: { x0: number; y0: number; x1: number; y1: number; t: number; dur: number } | null = null;
  readonly sprite: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Image;
  private shield: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private silhouette: Phaser.GameObjects.Image;
  private aura?: Phaser.GameObjects.Image;
  private mound?: Phaser.GameObjects.Image;
  private shown = true;
  private frameKey = '';
  /** Current animation and frame (read by the 3D renderer). */
  anim: AnimName = 'idle';
  animFrame = 0;
  /** Turret firing frame (0 rest, 1 fire). */
  turretFire = 0;
  private walkT = Math.random() * 10;
  private idleT = Math.random() * 3;
  private fidgetIn = 3 + Math.random() * 7;
  private fidgetT = 0;
  private fireT = 0;
  private aimT = 0;
  private hitT = 0;

  constructor(scene: Phaser.Scene, squad: Squad, x: number, y: number, hpMult: number) {
    this.def = squad.def;
    this.owner = squad.owner;
    this.squad = squad;
    this.x = x;
    this.y = y;
    this.maxHp = this.def.hp * hpMult;
    this.hp = this.maxHp;
    this.cooldown = Math.random() * this.def.cooldown;
    this.angle = this.owner === 'player' ? -Math.PI / 4 : (Math.PI * 3) / 4;
    this.turretAngle = this.angle;
    const k = Projection.tilt;
    const m = UNIT_MODELS[this.def.id];
    const w = this.def.size * 3;
    this.shadow = scene.add.image(x, Projection.vy(y), 'fx_soft').setTint(0x000000).setAlpha(0.65).setDepth(DEPTH.shadows);
    this.shadow.setScale(w / 32, (w * k) / 32);
    this.ring = scene.add.image(x, Projection.vy(y), 'sel_ring').setDepth(DEPTH.selection).setVisible(false);
    this.ring.setScale((this.def.size * 2 + 10) / 28, ((this.def.size * 2 + 10) / 28) * k);
    if (this.def.isHero) {
      this.aura = scene.add.image(x, Projection.vy(y), 'aura').setTint(0xffc860).setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.shadows + 0.5).setAlpha(0.55).setScale(1.1, 1.1 * k);
      scene.tweens.add({ targets: this.aura, alpha: 0.25, scaleX: 1.35, scaleY: 1.35 * k, duration: 900, yoyo: true, repeat: -1 });
    }
    const key = atlasKey(this.def.id);
    this.sprite = scene.add.image(x, Projection.vy(y), key, frameName('idle', 0, 2)).setDepth(Projection.depth(y));
    this.sprite.setOrigin(m.anchorX / m.cellW, m.anchorY / m.cellH);
    if (this.def.turret) {
      this.turret = scene.add.image(x, Projection.vy(y), turretKey(this.def.id), 'turret0_2').setDepth(Projection.depth(y) + 0.5);
      this.turret.setOrigin(this.sprite.originX, this.sprite.originY);
    }
    this.silhouette = scene.add.image(x, y, key, frameName('idle', 0, 2)).setDepth(DEPTH.silhouettes);
    this.silhouette.setOrigin(this.sprite.originX, this.sprite.originY).setTintFill(0x9ad0ff).setAlpha(0.35).setVisible(false);
    this.shield = scene.add.image(x, y, 'icon_cover').setDepth(DEPTH.bars - 1).setVisible(false);
    for (const o of [this.sprite, this.shadow, this.silhouette, this.turret]) if (o) hide2D(scene, o);
  }

  /** On-screen height of the model (px at zoom 1). */
  get height(): number {
    return MODEL_HEIGHT[this.def.id];
  }

  /** Current 8-way facing index (0 = east, 2 = south). */
  get dir(): number {
    return dirFromAngle(this.angle);
  }

  /** Chest-height point in view space (projectile origin / impact). */
  aimPoint(): { x: number; y: number } {
    return { x: this.x, y: Projection.vy(this.y) - this.lift - this.height * 0.55 };
  }

  /** True if a view-space point lies on this unit's drawn body. */
  containsView(vx: number, vy: number): boolean {
    const gy = Projection.vy(this.y) - this.lift;
    const r = Math.max(this.def.size + 5, this.height * 0.3);
    return vx >= this.x - r && vx <= this.x + r && vy >= gy - this.height - 2 && vy <= gy + 6;
  }

  get radius(): number {
    return this.def.size;
  }

  /** Applies damage; returns true if this hit killed the unit. */
  takeDamage(amount: number): boolean {
    if (!this.alive) return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return true;
    }
    this.hitT = 0.14;
    return false;
  }

  /** Turns toward a logical point (smoothed). Vehicles turn slowly. */
  face(tx: number, ty: number): void {
    const rate = this.def.category === 'vehicle' ? 0.12 : 0.3;
    this.angle = Phaser.Math.Angle.RotateTo(this.angle, Math.atan2(ty - this.y, tx - this.x), rate);
  }

  /** Points the weapon at a logical point: the turret if there is one, else the whole body. */
  aim(tx: number, ty: number): void {
    if (this.turret) this.turretAngle = Phaser.Math.Angle.RotateTo(this.turretAngle, Math.atan2(ty - this.y, tx - this.x), 0.4);
    else this.face(tx, ty);
  }

  /** Muzzle flash / strike frame; holds the aim pose afterwards. */
  playAttack(): void {
    this.fireT = 0.1;
    this.aimT = 0.9;
  }

  setSelected(sel: boolean): void {
    this.ring.setVisible(sel && this.shown);
  }

  setShown(shown: boolean): void {
    if (this.shown === shown) return;
    this.shown = shown;
    this.sprite.setVisible(shown);
    this.turret?.setVisible(shown);
    this.shadow.setVisible(shown && !this.squad.burrowed);
    this.aura?.setVisible(shown);
    this.mound?.setVisible(shown && this.squad.burrowed);
    if (!shown) {
      this.silhouette.setVisible(false);
      this.ring.setVisible(false);
      this.shield.setVisible(false);
    }
  }

  get isShown(): boolean {
    return this.shown;
  }

  /** Underground look: a dirt hump with a faint ghost of the body. */
  setBurrowed(on: boolean): void {
    if (on && !this.mound) {
      const k = Projection.tilt;
      this.mound = this.sprite.scene.add.image(this.x, Projection.vy(this.y), 'fx_soft').setTint(0x3a2c20).setDepth(DEPTH.shadows + 0.4)
        .setScale((this.def.size * 3.4) / 32, (this.def.size * 2.2 * k) / 32);
    }
    this.mound?.setVisible(on && this.shown);
    this.sprite.setAlpha(on ? 0.3 : 1);
    this.shadow.setVisible(!on && this.shown);
  }

  /** Starts a jump to (x, y); position is driven by the arc until landing. */
  startLeap(x: number, y: number): void {
    const d = Math.hypot(x - this.x, y - this.y);
    this.leapArc = { x0: this.x, y0: this.y, x1: x, y1: y, t: 0, dur: 0.3 + d / 900 };
    this.angle = Math.atan2(y - this.y, x - this.x);
  }

  /** Advances a leap; returns true on the frame it lands. */
  updateLeap(dt: number): boolean {
    const a = this.leapArc;
    if (!a) return false;
    a.t += dt;
    const f = Math.min(1, a.t / a.dur);
    this.x = a.x0 + (a.x1 - a.x0) * f;
    this.y = a.y0 + (a.y1 - a.y0) * f;
    this.lift = Math.sin(f * Math.PI) * (26 + Math.hypot(a.x1 - a.x0, a.y1 - a.y0) * 0.12);
    if (f < 1) return false;
    this.leapArc = null;
    this.lift = 0;
    return true;
  }

  /** Riding in a transport: nothing of the soldier is drawn. */
  setEmbarked(on: boolean): void {
    for (const o of [this.sprite, this.shadow, this.ring, this.shield, this.silhouette]) o.setVisible(false);
    this.aura?.setVisible(false);
    this.turret?.setVisible(false);
    if (!on) {
      this.sprite.setVisible(this.shown);
      this.shadow.setVisible(this.shown);
      this.aura?.setVisible(this.shown);
    }
  }

  setCover(cover: boolean): void {
    this.inCover = cover;
    this.shield.setVisible(cover && this.shown);
  }

  setOccluded(occ: boolean): void {
    this.occluded = occ;
    this.silhouette.setVisible(occ && this.shown);
  }

  /** Picks the animation frame: hit > fire > walk > aim > idle (with fidgets). */
  private animate(dt: number): void {
    const speed = Math.hypot(this.vx, this.vy);
    let anim: AnimName = 'idle';
    let frame = 0;
    this.fireT -= dt;
    this.aimT -= dt;
    this.hitT -= dt;
    if (this.hitT > 0) {
      anim = 'hit';
    } else if (this.fireT > 0) {
      anim = 'attack';
      frame = 1;
    } else if (this.leapArc) {
      anim = 'attack';
    } else if (this.squad.deployState === 'deployed' || this.squad.deployState === 'deploying') {
      // Braced firing stance.
      anim = 'attack';
      frame = this.fireT > -0.15 && this.fireT < 0.1 ? 1 : 0;
    } else if (speed > 12) {
      this.walkT += dt * (speed / this.def.speed) * 9;
      anim = 'walk';
      frame = Math.floor(this.walkT) % 6;
    } else if (this.aimT > 0) {
      anim = 'attack';
    } else {
      this.idleT += dt;
      this.fidgetIn -= dt;
      if (this.fidgetIn <= 0) {
        this.fidgetT = 0.9;
        this.fidgetIn = 3 + Math.random() * 7;
      }
      this.fidgetT -= dt;
      frame = this.fidgetT > 0 ? 2 : Math.floor(this.idleT / 0.8) % 2;
    }
    this.anim = anim;
    this.animFrame = frame;
    this.turretFire = this.fireT > 0 ? 1 : 0;
    const name = frameName(anim, frame, this.dir);
    if (name !== this.frameKey) {
      this.frameKey = name;
      this.sprite.setFrame(name);
      if (this.occluded) this.silhouette.setFrame(name);
    }
    if (this.turret) {
      if (!this.squad.engaged) this.turretAngle = Phaser.Math.Angle.RotateTo(this.turretAngle, this.angle, dt * 1.5);
      const tn = `turret${this.fireT > 0 ? 1 : 0}_${dirFromAngle(this.turretAngle)}`;
      if (tn !== this.turretFrame) {
        this.turretFrame = tn;
        this.turret.setFrame(tn);
      }
    }
  }

  syncSprite(dt = 0): void {
    this.animate(dt);
    if (this.def.flying) {
      this.hoverT += dt;
      this.lift = 30 + Math.sin(this.hoverT * 2.2) * 4;
    }
    const gy = Projection.vy(this.y);
    this.sprite.setPosition(this.x, gy - this.lift).setDepth(Projection.depth(this.y) + (this.def.flying ? 60 : 0));
    this.turret?.setPosition(this.x, gy - this.lift).setDepth(this.sprite.depth + 0.5);
    this.shadow.setPosition(this.x + 3 + this.lift * 0.3, gy + 1);
    this.mound?.setPosition(this.x, gy);
    this.ring.setPosition(this.x, gy);
    this.aura?.setPosition(this.x, gy);
    this.shield.setPosition(this.x, gy - this.height - 8);
    if (this.occluded) this.silhouette.setPosition(this.x, gy - this.lift);
  }

  destroy(): void {
    for (const o of [this.sprite, this.ring, this.shield, this.shadow, this.silhouette]) o.destroy();
    this.aura?.destroy();
    this.mound?.destroy();
    this.turret?.destroy();
  }
}
