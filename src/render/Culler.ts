import Phaser from 'phaser';
import type { HiddenIn3D } from '../render3d/hide2D';

const CELL = 512;

interface Entry {
  obj: Phaser.GameObjects.GameObject & { cameraFilter: number };
  cell: number;
}

const culler = new WeakMap<Phaser.Scene, Culler>();

/**
 * Hides static, off-screen world sprites (props, occluders, corpses, decals, ruins) from the main
 * camera. Objects are bucketed into a coarse view-space grid; only cells entering or leaving the
 * padded viewport are touched. Uses the camera filter, so it never fights other code over `visible`.
 */
export class Culler {
  private cells = new Map<number, Set<Entry>>();
  private shown = new Set<number>();
  private hooked = new WeakSet<Phaser.GameObjects.GameObject>();
  private entries = new Map<Phaser.GameObjects.GameObject, Entry>();
  private cols = 1;
  private cam: Phaser.Cameras.Scene2D.Camera;

  static for(scene: Phaser.Scene): Culler {
    let c = culler.get(scene);
    if (!c) {
      c = new Culler(scene);
      culler.set(scene, c);
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => culler.delete(scene));
    }
    return c;
  }

  private constructor(scene: Phaser.Scene) {
    this.cam = scene.cameras.main;
    this.cols = 256;
  }

  /** Registers a static object anchored near view point (x, y); it may extend up to one cell away. */
  add(obj: Phaser.GameObjects.GameObject, x: number, y: number): void {
    // Replaced by the 3D renderer: stays hidden, nothing to cull.
    if ((obj as HiddenIn3D).hiddenIn3D) return;
    const cell = Math.floor(Math.max(0, y) / CELL) * this.cols + Math.floor(Math.max(0, x) / CELL);
    this.remove(obj);
    const e: Entry = { obj: obj as Entry['obj'], cell };
    let set = this.cells.get(cell);
    if (!set) this.cells.set(cell, (set = new Set()));
    set.add(e);
    this.entries.set(obj, e);
    e.obj.cameraFilter = this.shown.has(cell) ? 0 : this.cam.id;
    if (!this.hooked.has(obj)) {
      this.hooked.add(obj);
      obj.once(Phaser.GameObjects.Events.DESTROY, () => this.remove(obj));
    }
  }

  remove(obj: Phaser.GameObjects.GameObject): void {
    const e = this.entries.get(obj);
    if (!e) return;
    this.cells.get(e.cell)?.delete(e);
    this.entries.delete(obj);
    e.obj.cameraFilter = 0;
  }

  /** Per-frame: flips cells that crossed the padded viewport edge. */
  update(): void {
    const v = this.cam.worldView;
    const cx0 = Math.max(0, Math.floor(v.x / CELL) - 1);
    const cy0 = Math.max(0, Math.floor(v.y / CELL) - 1);
    const cx1 = Math.floor(v.right / CELL) + 1;
    const cy1 = Math.floor(v.bottom / CELL) + 1;
    const want = new Set<number>();
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) want.add(cy * this.cols + cx);
    for (const c of this.shown) if (!want.has(c)) this.flip(c, this.cam.id);
    for (const c of want) if (!this.shown.has(c)) this.flip(c, 0);
    this.shown = want;
  }

  private flip(cell: number, filter: number): void {
    const set = this.cells.get(cell);
    if (set) for (const e of set) e.obj.cameraFilter = filter;
  }

  /** Objects currently registered (for profiling). */
  get size(): number {
    return this.entries.size;
  }
}
