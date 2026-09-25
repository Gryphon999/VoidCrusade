import Phaser from 'phaser';
import { CAMERA } from '../config';

type ScrollKeys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

/** RTS camera: keyboard + edge scroll, middle-mouse drag pan, wheel zoom, clamped to the map. */
export class CameraSystem {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private keys?: ScrollKeys;
  private dragging = false;
  private dragLast = new Phaser.Math.Vector2();
  enabled = true;

  constructor(private scene: Phaser.Scene, worldW: number, worldH: number) {
    this.cam = scene.cameras.main;
    this.cam.setBounds(0, 0, worldW, worldH);
    const kb = scene.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = kb.addKeys(
        { up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D },
        false,
      ) as ScrollKeys;
    }
    scene.input.on('wheel', this.onWheel, this);
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
  }

  centerOn(x: number, y: number): void {
    this.cam.centerOn(x, y);
  }

  update(dtSec: number): void {
    if (!this.enabled) return;
    let dx = 0;
    let dy = 0;
    const k = this.keys;
    if (k) {
      if (k.left.isDown || k.a.isDown) dx -= 1;
      if (k.right.isDown || k.d.isDown) dx += 1;
      if (k.up.isDown || k.w.isDown) dy -= 1;
      if (k.down.isDown || k.s.isDown) dy += 1;
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
    if (dx !== 0 || dy !== 0) {
      const speed = (CAMERA.scrollSpeed * dtSec) / this.cam.zoom;
      this.cam.scrollX += dx * speed;
      this.cam.scrollY += dy * speed;
    }
  }

  private onWheel(pointer: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number): void {
    if (!this.enabled) return;
    const before = this.cam.getWorldPoint(pointer.x, pointer.y);
    const step = dy > 0 ? -CAMERA.zoomStep : CAMERA.zoomStep;
    const zoom = Phaser.Math.Clamp(this.cam.zoom + step, CAMERA.minZoom, CAMERA.maxZoom);
    this.cam.setZoom(zoom);
    // Keep the point under the cursor stationary while zooming.
    this.cam.preRender();
    const after = this.cam.getWorldPoint(pointer.x, pointer.y);
    this.cam.scrollX += before.x - after.x;
    this.cam.scrollY += before.y - after.y;
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
