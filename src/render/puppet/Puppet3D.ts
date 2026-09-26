import { rgb, shade } from '../CanvasUtil';

/**
 * Minimal 3D puppet rasteriser for procedural unit sprites.
 * Local model space: f = forward, s = right, z = up (px). The model is yawed to a facing,
 * projected with the battlefield camera pitch and painted back-to-front with Lambert shading.
 */

export interface V3 {
  f: number;
  s: number;
  z: number;
}

export const v = (f: number, s: number, z: number): V3 => ({ f, s, z });

/** Camera elevation: sin = ground squash (matches the default tilt), cos = height factor. */
const SIN_E = 0.65;
const COS_E = Math.sqrt(1 - SIN_E * SIN_E);
/** Light from the north-west and above, in world X (east), Y (south), Z (up). */
const LIGHT = normalize({ x: -0.45, y: -0.55, z: 0.75 });

interface W3 {
  x: number;
  y: number;
  z: number;
}

function normalize(p: W3): W3 {
  const l = Math.hypot(p.x, p.y, p.z) || 1;
  return { x: p.x / l, y: p.y / l, z: p.z / l };
}

export type Part =
  | { kind: 'box'; c: V3; h: V3; color: number; pitch?: number; yaw?: number; roll?: number; emissive?: boolean; outline?: boolean }
  | { kind: 'limb'; a: V3; b: V3; r: number; color: number }
  | { kind: 'ball'; c: V3; r: number; color: number; emissive?: boolean; squash?: number }
  | { kind: 'glow'; c: V3; r: number; color: number };

/** Whole-figure transform applied before yaw (death falls, lean, bob). */
export interface Pose {
  /** Rotation about the side axis through the feet (+ = falls backward). */
  fall?: number;
  /** Rotation about the forward axis (+ = rolls right). */
  roll?: number;
  lift?: number;
}

function rotLocal(p: V3, pitch = 0, yaw = 0, roll = 0): V3 {
  let { f, s, z } = p;
  if (pitch) {
    const c = Math.cos(pitch);
    const n = Math.sin(pitch);
    [f, z] = [f * c - z * n, f * n + z * c];
  }
  if (roll) {
    const c = Math.cos(roll);
    const n = Math.sin(roll);
    [s, z] = [s * c - z * n, s * n + z * c];
  }
  if (yaw) {
    const c = Math.cos(yaw);
    const n = Math.sin(yaw);
    [f, s] = [f * c - s * n, f * n + s * c];
  }
  return { f, s, z };
}

export class PuppetRenderer {
  private cos = 1;
  private sin = 0;
  private pose: Pose = {};

  constructor(private ctx: CanvasRenderingContext2D, private ox: number, private oy: number, facing: number) {
    this.cos = Math.cos(facing);
    this.sin = Math.sin(facing);
  }

  setPose(p: Pose): void {
    this.pose = p;
  }

  /** Local model point → world (x east, y south, z up) after pose and facing. */
  private world(p: V3): W3 {
    let q = rotLocal(p, 0, 0, this.pose.roll ?? 0);
    if (this.pose.fall) {
      const c = Math.cos(this.pose.fall);
      const n = Math.sin(this.pose.fall);
      q = { f: q.f * c - q.z * n, s: q.s, z: q.f * n + q.z * c };
    }
    const z = q.z + (this.pose.lift ?? 0);
    return { x: q.f * this.cos - q.s * this.sin, y: q.f * this.sin + q.s * this.cos, z };
  }

  private worldDir(p: V3): W3 {
    const a = this.world(p);
    const o = this.world(v(0, 0, 0));
    return normalize({ x: a.x - o.x, y: a.y - o.y, z: a.z - o.z });
  }

  private screen(w: W3): { x: number; y: number } {
    return { x: this.ox + w.x, y: this.oy + w.y * SIN_E - w.z * COS_E };
  }

  private depth(w: W3): number {
    return w.y * COS_E + w.z * SIN_E;
  }

  /** Paints parts back-to-front. */
  draw(parts: Part[]): void {
    const items = parts.map((p) => {
      const c = p.kind === 'limb' ? v((p.a.f + p.b.f) / 2, (p.a.s + p.b.s) / 2, (p.a.z + p.b.z) / 2) : p.c;
      return { p, d: this.depth(this.world(c)) };
    });
    items.sort((a, b) => a.d - b.d);
    for (const { p } of items) {
      if (p.kind === 'box') this.box(p);
      else if (p.kind === 'limb') this.limb(p.a, p.b, p.r, p.color);
      else if (p.kind === 'ball') this.ball(p.c, p.r, p.color, p.emissive ?? false, p.squash ?? 1);
      else this.glowAt(p.c, p.r, p.color);
    }
  }

  private lit(n: W3): number {
    return 0.34 + 0.78 * Math.max(0, n.x * LIGHT.x + n.y * LIGHT.y + n.z * LIGHT.z);
  }

  private box(b: Extract<Part, { kind: 'box' }>): void {
    const ctx = this.ctx;
    const corner = (sf: number, ss: number, sz: number): { x: number; y: number } => {
      const l = rotLocal(v(b.h.f * sf, b.h.s * ss, b.h.z * sz), b.pitch, b.yaw, b.roll);
      return this.screen(this.world(v(b.c.f + l.f, b.c.s + l.s, b.c.z + l.z)));
    };
    const faces: [V3, [number, number, number][]][] = [
      [v(1, 0, 0), [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]],
      [v(-1, 0, 0), [[-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, -1, 1]]],
      [v(0, 1, 0), [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]]],
      [v(0, -1, 0), [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]],
      [v(0, 0, 1), [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
      [v(0, 0, -1), [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]]],
    ];
    for (const [nLocal, quad] of faces) {
      const n = this.worldDir(rotLocal(nLocal, b.pitch, b.yaw, b.roll));
      if (n.y * COS_E + n.z * SIN_E <= 0.01) continue;
      const pts = quad.map(([a, c, d]) => corner(a, c, d));
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = rgb(b.emissive ? b.color : shade(b.color, this.lit(n)));
      ctx.fill();
      if (b.outline !== false) {
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }
  }

  private limb(a: V3, b: V3, r: number, color: number): void {
    const ctx = this.ctx;
    const pa = this.screen(this.world(a));
    const pb = this.screen(this.world(b));
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = r * 2 + 1.2;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
    ctx.strokeStyle = rgb(shade(color, 0.75));
    ctx.lineWidth = r * 2;
    ctx.stroke();
    ctx.strokeStyle = rgb(shade(color, 1.25), 0.75);
    ctx.lineWidth = Math.max(0.8, r * 0.8);
    ctx.beginPath();
    ctx.moveTo(pa.x - r * 0.35, pa.y - r * 0.35);
    ctx.lineTo(pb.x - r * 0.35, pb.y - r * 0.35);
    ctx.stroke();
  }

  private ball(c: V3, r: number, color: number, emissive: boolean, squash: number): void {
    const ctx = this.ctx;
    const p = this.screen(this.world(c));
    if (emissive) {
      this.glowAt(c, r * 2.6, color);
      ctx.fillStyle = rgb(shade(color, 1.4));
    } else {
      const g = ctx.createRadialGradient(p.x - r * 0.4, p.y - r * 0.45, r * 0.1, p.x, p.y, r * 1.05);
      g.addColorStop(0, rgb(shade(color, 1.45)));
      g.addColorStop(0.55, rgb(color));
      g.addColorStop(1, rgb(shade(color, 0.45)));
      ctx.fillStyle = g;
    }
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * squash, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!emissive) {
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }

  private glowAt(c: V3, r: number, color: number): void {
    const ctx = this.ctx;
    const p = this.screen(this.world(c));
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, rgb(color, 0.75));
    g.addColorStop(1, rgb(color, 0));
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = prev;
  }
}
