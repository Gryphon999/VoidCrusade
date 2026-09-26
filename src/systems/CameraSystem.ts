import Phaser from 'phaser';
import { CAMERA, PROJECTION } from '../config';
import { Projection } from '../render/Projection';

type ScrollKeys = Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

/**
 * RTS camera: keyboard + edge scroll, middle-mouse drag pan, wheel zoom, clamped to the map.
 * The Phaser camera works in projected view space; use worldToScreen/screenToWorld to convert
 * to and from logical (top-down) world coordinates.
 */
export class CameraSystem {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private keys?: ScrollKeys;
  private dragging = false;
  private dragLast = new Phaser.Math.Vector2();
  enabled = true;
  /** Scroll velocity (view px/s) with inertia, and the smoothed zoom target. */
  private vel = new Phaser.Math.Vector2();
  private targetZoom = 1;
  private lastZoom = 1;
  private zoomAnchor: { x: number; y: number } | null = null;
  /** Scripted camera move (battle fly-in, final shot); input is ignored while it plays. */
  private fly: { fromX: number; fromY: number; fromZ: number; toX: number; toY: number; toZ: number; t: number; dur: number } | null = null;

  constructor(private scene: Phaser.Scene, worldW: number, worldH: number) {
    this.cam = scene.cameras.main;
    // Extra room so the map edges can scroll clear of the top bar and the bottom HUD frame.
    const top = PROJECTION.cliffHeight + 40 + 40;
    const bottom = 180;
    this.cam.setBounds(0, -top, worldW, Projection.vy(worldH) + top + bottom);
    const kb = scene.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = kb.addKeys(
        { up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT },
        false,
      ) as ScrollKeys;
    }
    scene.input.on('wheel', this.onWheel, this);
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
  }

  /** Centers the camera on a logical world point. */
  centerOn(x: number, y: number): void {
    this.cam.centerOn(x, Projection.vy(y));
  }

  /** Screen (canvas) pixel → logical ground point. */
  screenToWorld(px: number, py: number): Phaser.Math.Vector2 {
    const v = this.cam.getWorldPoint(px, py);
    return new Phaser.Math.Vector2(v.x, Projection.groundY(v.y));
  }

  /** Screen pixel → projected view-space point (what sprites are positioned in). */
  screenToView(px: number, py: number): Phaser.Math.Vector2 {
    return this.cam.getWorldPoint(px, py);
  }

  /** Logical world point (optionally lifted by z) → screen pixel. */
  worldToScreen(x: number, y: number, z = 0): Phaser.Math.Vector2 {
    const c = this.cam;
    const vx = x;
    const vy = Projection.vy(y, z);
    return new Phaser.Math.Vector2((vx - c.worldView.x) * c.zoom, (vy - c.worldView.y) * c.zoom);
  }

  /** Logical-world rectangle currently visible on screen. */
  visibleWorldRect(): Phaser.Geom.Rectangle {
    const v = this.cam.worldView;
    return new Phaser.Geom.Rectangle(v.x, Projection.groundY(v.y), v.width, Projection.groundY(v.height));
  }

  /** Glides the view to a logical point and zoom (ease in-out). */
  flyTo(x: number, y: number, zoom: number, ms: number): void {
    const c = this.cam;
    this.fly = { fromX: c.midPoint.x, fromY: c.midPoint.y, fromZ: c.zoom, toX: x, toY: Projection.vy(y), toZ: zoom, t: 0, dur: ms / 1000 };
    this.vel.set(0, 0);
  }

  get flying(): boolean {
    return this.fly !== null;
  }

  private updateFly(dt: number): void {
    const f = this.fly;
    if (!f) return;
    f.t = Math.min(f.dur, f.t + dt);
    const k = f.t / f.dur;
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    this.cam.setZoom(f.fromZ + (f.toZ - f.fromZ) * e);
    this.cam.centerOn(f.fromX + (f.toX - f.fromX) * e, f.fromY + (f.toY - f.fromY) * e);
    this.targetZoom = this.lastZoom = this.cam.zoom;
    if (f.t >= f.dur) this.fly = null;
  }

  update(dtSec: number): void {
    if (this.fly) {
      this.updateFly(dtSec);
      return;
    }
    if (!this.enabled) return;
    // Zoom set from outside (scripts, focus-on-event): adopt it.
    if (Math.abs(this.cam.zoom - this.lastZoom) > 1e-4) this.targetZoom = this.lastZoom = this.cam.zoom;
    if (Math.abs(this.targetZoom - this.cam.zoom) > 1e-3) {
      const a = this.zoomAnchor;
      const before = a ? this.cam.getWorldPoint(a.x, a.y) : null;
      const z = this.cam.zoom + (this.targetZoom - this.cam.zoom) * Math.min(1, dtSec * 14);
      this.cam.setZoom(Math.abs(z - this.targetZoom) < 1e-3 ? this.targetZoom : z);
      if (a && before) {
        // Keep the point under the cursor stationary while zooming.
        this.cam.preRender();
        const after = this.cam.getWorldPoint(a.x, a.y);
        this.cam.scrollX += before.x - after.x;
        this.cam.scrollY += before.y - after.y;
      }
      this.lastZoom = this.cam.zoom;
    }
    let dx = 0;
    let dy = 0;
    const k = this.keys;
    if (k) {
      // Letters belong to the command grid (QWERTYU/ASDFGHJ), so only the arrows scroll.
      if (k.left.isDown) dx -= 1;
      if (k.right.isDown) dx += 1;
      if (k.up.isDown) dy -= 1;
      if (k.down.isDown) dy += 1;
    }
    const p = this.scene.input.activePointer;
    if (this.scene.game.input.isOver && !this.dragging) {
      const e = CAMERA.edgeSize;
      const { width, height } = this.scene.scale;
      if (p.x <= e) dx -= 1;
      else if (p.x >= width - e) dx += 1;
      if (p.y <= e) dy -= 1;
      else if (p.y >= height - e) dy += 1;
    }
    // Inertia: accelerate towards the wanted speed, glide to a stop when released.
    const want = CAMERA.scrollSpeed / this.cam.zoom;
    const rate = dx !== 0 || dy !== 0 ? 10 : 7;
    const blend = Math.min(1, dtSec * rate);
    this.vel.x += (dx * want - this.vel.x) * blend;
    this.vel.y += (dy * want - this.vel.y) * blend;
    if (Math.abs(this.vel.x) < 1 && Math.abs(this.vel.y) < 1) this.vel.set(0, 0);
    this.cam.scrollX += this.vel.x * dtSec;
    this.cam.scrollY += this.vel.y * dtSec;
  }

  private onWheel(pointer: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number): void {
    if (!this.enabled || this.fly) return;
    const step = dy > 0 ? -CAMERA.zoomStep : CAMERA.zoomStep;
    this.targetZoom = Phaser.Math.Clamp(this.targetZoom + step, CAMERA.minZoom, CAMERA.maxZoom);
    this.zoomAnchor = { x: pointer.x, y: pointer.y };
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.middleButtonDown()) {
      this.dragging = true;
      this.dragLast.set(pointer.x, pointer.y);
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging) return;
    this.cam.scrollX -= (pointer.x - this.dragLast.x) / this.cam.zoom;
    this.cam.scrollY -= (pointer.y - this.dragLast.y) / this.cam.zoom;
    this.dragLast.set(pointer.x, pointer.y);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!pointer.middleButtonDown()) this.dragging = false;
  }

  destroy(): void {
    this.scene.input.off('wheel', this.onWheel, this);
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
  }
}
