/** What the gestures read from a pointer (a Phaser pointer fits; tests pass plain objects). */
export interface Finger {
  id: number;
  x: number;
  y: number;
}

const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(bx - ax, by - ay);

/** How far (screen px) a finger may wander and still count as a tap or a long press. */
const TAP_SLOP = 14;
/** Holding this long without moving turns the drag into a selection box. */
const LONG_PRESS_MS = 380;

export type GestureState = 'idle' | 'pending' | 'pan' | 'pinch' | 'box';

export interface GestureHandlers<P extends Finger> {
  /** A short touch without movement. */
  tap(p: P): void;
  /** Long press reached: a selection box starts at (x, y). */
  boxStart(x: number, y: number): void;
  /** The finger of a selection box lifted. */
  boxEnd(p: P): void;
  /** One finger moved the view by a screen delta. */
  pan(dx: number, dy: number): void;
  /** Two fingers: new zoom factor relative to the start, around the screen point (x, y), plus the pan of their midpoint. */
  pinch(scale: number, x: number, y: number, dx: number, dy: number): void;
  /** Pinch started (the handler remembers the zoom to scale from). */
  pinchStart(): void;
  /** While true a one-finger drag belongs to someone else (drawing a wall line while placing). */
  dragTaken(): boolean;
}

/**
 * Phone controls on the battlefield, read from touch pointers:
 * tap → select or order, one-finger drag → pan, two-finger pinch → zoom, long press + drag → selection box.
 * Mouse pointers are ignored here (they keep the desktop controls).
 */
export class TouchGestures<P extends Finger> {
  state: GestureState = 'idle';
  private fingers = new Map<number, { x: number; y: number }>();
  private start = { x: 0, y: 0, at: 0 };
  private pinch0 = { dist: 1, mx: 0, my: 0 };

  constructor(private h: GestureHandlers<P>) {}

  /** Finger down (`overUI`: the first finger landed on the HUD, so the HUD owns this touch). */
  down(p: P, now: number, overUI: boolean): void {
    if (this.fingers.size === 0 && overUI) return;
    this.fingers.set(p.id, { x: p.x, y: p.y });
    if (this.fingers.size === 1) {
      this.state = 'pending';
      this.start = { x: p.x, y: p.y, at: now };
    } else if (this.fingers.size === 2 && this.state !== 'box') {
      // A second finger always means pinch, whatever the first one was doing.
      const [a, b] = [...this.fingers.values()];
      this.pinch0 = { dist: Math.max(1, dist(a.x, a.y, b.x, b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      this.state = 'pinch';
      this.h.pinchStart();
    }
  }

  move(p: P): void {
    const f = this.fingers.get(p.id);
    if (!f) return;
    const dx = p.x - f.x;
    const dy = p.y - f.y;
    f.x = p.x;
    f.y = p.y;
    if (this.state === 'pending' && dist(this.start.x, this.start.y, p.x, p.y) > TAP_SLOP) {
      this.state = this.h.dragTaken() ? 'box' : 'pan';
      if (this.state === 'box') this.h.boxStart(this.start.x, this.start.y);
      // The finger already travelled past the slop: apply that part too, so the view does not jump.
      else this.h.pan(p.x - this.start.x, p.y - this.start.y);
      return;
    }
    if (this.state === 'pan') this.h.pan(dx, dy);
    else if (this.state === 'pinch' && this.fingers.size >= 2) {
      const [a, b] = [...this.fingers.values()];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const d = Math.max(1, dist(a.x, a.y, b.x, b.y));
      this.h.pinch(d / this.pinch0.dist, mx, my, mx - this.pinch0.mx, my - this.pinch0.my);
      this.pinch0.mx = mx;
      this.pinch0.my = my;
    }
  }

  /** Per frame: a finger held still long enough starts a selection box. */
  update(now: number): void {
    if (this.state === 'pending' && this.fingers.size === 1 && now - this.start.at >= LONG_PRESS_MS) {
      this.state = 'box';
      this.h.boxStart(this.start.x, this.start.y);
    }
  }

  up(p: P): void {
    if (!this.fingers.delete(p.id)) return;
    const was = this.state;
    if (was === 'pending') this.h.tap(p);
    else if (was === 'box') this.h.boxEnd(p);
    // A finger still down after a pinch must not suddenly pan or tap: it waits for all to lift.
    this.state = this.fingers.size ? 'pinch' : 'idle';
  }

  /** The box is drawn while true. */
  get boxing(): boolean {
    return this.state === 'box';
  }
}
