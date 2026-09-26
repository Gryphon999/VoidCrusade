import { rgb, shade } from '../CanvasUtil';

/**
 * Oblique drawing helpers for structures, matching the battlefield projection:
 * screen = (ox + x, oy + y * k - z). Local x = east, y = south (depth), z = up, in px.
 */
export class Oblique {
  constructor(readonly ctx: CanvasRenderingContext2D, readonly ox: number, readonly oy: number, readonly k: number,
    readonly glow?: CanvasRenderingContext2D) {}

  sx(x: number): number {
    return this.ox + x;
  }

  sy(y: number, z = 0): number {
    return this.oy + y * this.k - z;
  }

  /** Axis-aligned block: lit top, darker front face, shaded east edge, highlit west edge. */
  box(x: number, y: number, z: number, w: number, d: number, h: number, col: number, opts: { top?: number; front?: number } = {}): void {
    const c = this.ctx;
    const X = this.sx(x);
    const yTop0 = this.sy(y, z + h);
    const yTop1 = this.sy(y + d, z + h);
    const yBot = this.sy(y + d, z);
    const front = opts.front ?? shade(col, 0.72);
    const g = c.createLinearGradient(0, yTop1, 0, yBot);
    g.addColorStop(0, rgb(shade(front, 1.1)));
    g.addColorStop(1, rgb(shade(front, 0.7)));
    c.fillStyle = g;
    c.fillRect(X, yTop1, w, yBot - yTop1);
    c.fillStyle = rgb(opts.top ?? shade(col, 1.12));
    c.fillRect(X, yTop0, w, yTop1 - yTop0);
    c.fillStyle = 'rgba(255,236,210,0.2)';
    c.fillRect(X, yTop0, w, 1.2);
    c.fillRect(X, yTop0, 1.2, yBot - yTop0);
    const e = c.createLinearGradient(X + w - Math.min(10, w * 0.3), 0, X + w, 0);
    e.addColorStop(0, 'rgba(0,0,0,0)');
    e.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = e;
    c.fillRect(X + w - Math.min(10, w * 0.3), yTop0, Math.min(10, w * 0.3), yBot - yTop0);
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineWidth = 1;
    c.strokeRect(X + 0.5, yTop0 + 0.5, w - 1, yBot - yTop0 - 1);
    c.beginPath();
    c.moveTo(X, yTop1);
    c.lineTo(X + w, yTop1);
    c.stroke();
  }

  /** Upright cylinder with an elliptical cap. */
  cylinder(cx: number, cy: number, z: number, r: number, h: number, col: number, cap?: number): void {
    const c = this.ctx;
    const X = this.sx(cx);
    const yb = this.sy(cy, z);
    const yt = this.sy(cy, z + h);
    const ry = r * this.k;
    const g = c.createLinearGradient(X - r, 0, X + r, 0);
    g.addColorStop(0, rgb(shade(col, 1.2)));
    g.addColorStop(0.35, rgb(col));
    g.addColorStop(1, rgb(shade(col, 0.45)));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(X - r, yt);
    c.lineTo(X - r, yb);
    c.ellipse(X, yb, r, ry, 0, Math.PI, 0, true);
    c.lineTo(X + r, yt);
    c.closePath();
    c.fill();
    c.fillStyle = rgb(cap ?? shade(col, 1.15));
    c.beginPath();
    c.ellipse(X, yt, r, ry, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.45)';
    c.lineWidth = 1;
    c.stroke();
  }

  /** Cone/spire standing on (cx, cy, z). */
  cone(cx: number, cy: number, z: number, r: number, h: number, col: number): void {
    const c = this.ctx;
    const X = this.sx(cx);
    const yb = this.sy(cy, z);
    const g = c.createLinearGradient(X - r, 0, X + r, 0);
    g.addColorStop(0, rgb(shade(col, 1.25)));
    g.addColorStop(1, rgb(shade(col, 0.45)));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(X, this.sy(cy, z + h));
    c.lineTo(X + r, yb);
    c.ellipse(X, yb, r, r * this.k, 0, 0, Math.PI);
    c.closePath();
    c.fill();
  }

  /** Flat shape on a front face (window, door...) given in face coords: x along width, z up. */
  frontRect(x: number, y: number, z: number, w: number, h: number, fill: string): void {
    this.ctx.fillStyle = fill;
    this.ctx.fillRect(this.sx(x), this.sy(y, z + h), w, h);
  }

  /** Gothic lancet window on a front face; lit windows also go to the glow layer. */
  lancet(x: number, y: number, z: number, w: number, h: number, lit: string | null): void {
    const paint = (c: CanvasRenderingContext2D, fill: string): void => {
      const X = this.sx(x);
      const yb = this.sy(y, z);
      const yt = this.sy(y, z + h);
      c.fillStyle = fill;
      c.beginPath();
      c.moveTo(X, yb);
      c.lineTo(X, yt + w * 0.6);
      c.quadraticCurveTo(X, yt, X + w / 2, yt - w * 0.2);
      c.quadraticCurveTo(X + w, yt, X + w, yt + w * 0.6);
      c.lineTo(X + w, yb);
      c.closePath();
      c.fill();
    };
    paint(this.ctx, lit ?? '#0b0908');
    if (lit && this.glow) paint(this.glow, lit);
  }

  /** Glowing element: drawn on the body and, brighter, on the additive glow layer. */
  light(x: number, y: number, z: number, r: number, col: number): void {
    const X = this.sx(x);
    const Y = this.sy(y, z);
    this.ctx.fillStyle = rgb(shade(col, 1.3));
    this.ctx.beginPath();
    this.ctx.arc(X, Y, r, 0, Math.PI * 2);
    this.ctx.fill();
    if (!this.glow) return;
    const g = this.glow.createRadialGradient(X, Y, 0, X, Y, r * 4);
    g.addColorStop(0, rgb(col, 0.9));
    g.addColorStop(1, rgb(col, 0));
    this.glow.fillStyle = g;
    this.glow.fillRect(X - r * 4, Y - r * 4, r * 8, r * 8);
  }

  /** Blob (organic mass) with radial shading. */
  blob(cx: number, cy: number, z: number, rx: number, rz: number, col: number): void {
    const c = this.ctx;
    const X = this.sx(cx);
    const Y = this.sy(cy, z);
    const g = c.createRadialGradient(X - rx * 0.35, Y - rz * 0.45, rx * 0.05, X, Y, Math.max(rx, rz) * 1.05);
    g.addColorStop(0, rgb(shade(col, 1.5)));
    g.addColorStop(0.5, rgb(col));
    g.addColorStop(1, rgb(shade(col, 0.4)));
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(X, Y, rx, rz, 0, 0, Math.PI * 2);
    c.fill();
  }

  /** Thick tapered line (pipes, spikes, tentacles, lattice struts). */
  strut(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, w: number, col: number): void {
    const c = this.ctx;
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineWidth = w + 1.2;
    c.beginPath();
    c.moveTo(this.sx(x0), this.sy(y0, z0));
    c.lineTo(this.sx(x1), this.sy(y1, z1));
    c.stroke();
    c.strokeStyle = rgb(col);
    c.lineWidth = w;
    c.stroke();
    c.strokeStyle = rgb(shade(col, 1.4), 0.6);
    c.lineWidth = Math.max(0.6, w * 0.35);
    c.beginPath();
    c.moveTo(this.sx(x0) - w * 0.2, this.sy(y0, z0) - w * 0.2);
    c.lineTo(this.sx(x1) - w * 0.2, this.sy(y1, z1) - w * 0.2);
    c.stroke();
  }

  /** Soft ambient-occlusion shadow on the ground around a footprint. */
  groundShadow(x: number, y: number, w: number, d: number): void {
    const c = this.ctx;
    const X = this.sx(x + w / 2 + 8);
    const Y = this.sy(y + d / 2 + 6);
    const g = c.createRadialGradient(X, Y, 0, X, Y, w * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.save();
    c.translate(X, Y);
    c.scale(1, this.k);
    c.translate(-X, -Y);
    c.fillStyle = g;
    c.fillRect(X - w, Y - w, w * 2, w * 2);
    c.restore();
  }
}
