import { Oblique } from './Oblique';

export interface Anchor {
  x: number;
  y: number;
  z: number;
}

/** Runtime attachment points (in footprint-local coords) returned by a painter. */
export interface BuildingAnchors {
  smoke: Anchor[];
  lights: Anchor[];
  /** Where a turret's gun sits. */
  gun?: Anchor;
}

export type BuildingPainter = (o: Oblique, S: number, H: number, rnd: () => number, a: BuildingAnchors) => void;

export const STEEL = 0x55606e;
export const STEEL_D = 0x2c3139;
export const STONE = 0x6a6258;
export const STONE_D = 0x3c3731;
export const BRASS = 0xc9a044;
export const WARM = '#ffb45a';

export function crenels(o: Oblique, x: number, y: number, z: number, w: number, col: number): void {
  for (let i = 0; i < w - 6; i += 12) o.box(x + i, y, z, 7, 5, 6, col);
}

export function banner(o: Oblique, x: number, y: number, z: number, h: number): void {
  const c = o.ctx;
  const X = o.sx(x);
  const Y = o.sy(y, z);
  c.fillStyle = '#1a1a1a';
  c.fillRect(X - 1, Y - 3, 12, 3);
  const g = c.createLinearGradient(X, 0, X + 10, 0);
  g.addColorStop(0, '#3a70d8');
  g.addColorStop(1, '#16306a');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(X, Y);
  c.lineTo(X + 10, Y);
  c.lineTo(X + 10, Y + h);
  c.lineTo(X + 5, Y + h - 5);
  c.lineTo(X, Y + h);
  c.closePath();
  c.fill();
  c.fillStyle = '#c9a044';
  c.fillRect(X + 3, Y + h * 0.3, 4, 4);
}

/** Winged-skull crest in brass (original design). */
export function crest(o: Oblique, x: number, y: number, z: number, s: number): void {
  const c = o.ctx;
  const X = o.sx(x);
  const Y = o.sy(y, z);
  c.fillStyle = '#c9a044';
  for (const d of [-1, 1]) {
    c.beginPath();
    c.moveTo(X + d * s * 0.3, Y);
    c.lineTo(X + d * s * 1.6, Y - s * 0.6);
    c.lineTo(X + d * s * 1.3, Y + s * 0.1);
    c.lineTo(X + d * s * 1.5, Y + s * 0.3);
    c.lineTo(X + d * s * 0.4, Y + s * 0.5);
    c.closePath();
    c.fill();
  }
  c.fillStyle = '#e8dcc0';
  c.beginPath();
  c.arc(X, Y, s * 0.55, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#140c08';
  c.fillRect(X - s * 0.3, Y - s * 0.05, s * 0.2, s * 0.2);
  c.fillRect(X + s * 0.1, Y - s * 0.05, s * 0.2, s * 0.2);
}

const stronghold: BuildingPainter = (o, S, H, _r, a) => {
  o.groundShadow(0, 0, S, S);
  o.box(4, 4, 0, S - 8, S - 8, 30, STONE);
  crenels(o, 8, 8, 30, S - 16, STONE);
  // Keep.
  o.box(56, 50, 30, S - 112, S - 110, H - 30, STEEL);
  crenels(o, 60, 50, H, S - 120, STEEL);
  for (let i = 0; i < 4; i++) o.lancet(70 + i * 30, S - 60, 44, 10, 26, WARM);
  crest(o, S / 2, S - 60, H - 12, 12);
  // Corner towers with conical roofs, banners and warning lights.
  for (const [cx, cy] of [[26, 26], [S - 26, 26], [26, S - 30], [S - 26, S - 30]]) {
    o.cylinder(cx, cy, 0, 22, H - 10, STONE_D, STONE);
    o.lancet(cx - 3, cy + 22, 30, 6, 16, WARM);
    o.cone(cx, cy, H - 10, 24, 34, 0x3a2a24);
    o.light(cx, cy, H + 26, 2.2, 0xff3020);
    a.lights.push({ x: cx, y: cy, z: H + 26 });
  }
  // Gatehouse.
  o.box(S / 2 - 34, S - 20, 0, 68, 14, 42, STONE);
  o.frontRect(S / 2 - 18, S - 6, 0, 36, 30, '#0a0808');
  for (let i = 0; i < 5; i++) o.frontRect(S / 2 - 16 + i * 8, S - 6, 2, 2, 26, 'rgba(90,90,90,0.8)');
  banner(o, S / 2 - 46, S - 6, 40, 30);
  banner(o, S / 2 + 36, S - 6, 40, 30);
  a.smoke.push({ x: 70, y: 60, z: H + 14 }, { x: S - 74, y: 60, z: H + 14 });
  o.box(64, 56, H, 10, 8, 14, STEEL_D);
  o.box(S - 80, 56, H, 10, 8, 14, STEEL_D);
};

const generator: BuildingPainter = (o, S, H, _r, a) => {
  o.groundShadow(0, 0, S, S);
  o.box(8, 8, 0, S - 16, S - 16, 12, STEEL_D);
  for (const [px, py] of [[22, 22], [S - 22, 22], [22, S - 24], [S - 22, S - 24]]) {
    o.cylinder(px, py, 12, 8, H - 18, STEEL);
    o.light(px, py, H - 2, 2.4, 0x60e8ff);
  }
  o.strut(22, 22, H - 12, S / 2, S / 2, H - 8, 2.5, 0x3a4048);
  o.strut(S - 22, 22, H - 12, S / 2, S / 2, H - 8, 2.5, 0x3a4048);
  o.cylinder(S / 2, S / 2, 12, 36, H - 22, STEEL, 0x40484f);
  // Glowing core ring and vents.
  o.cylinder(S / 2, S / 2, H - 10, 20, 8, 0x1a3a44, 0x60f0ff);
  o.light(S / 2, S / 2, H - 2, 6, 0x60f0ff);
  for (let i = 0; i < 3; i++) o.lancet(S / 2 - 22 + i * 16, S / 2 + 36, 22, 8, 14, '#6ff0ff');
  a.lights.push({ x: S / 2, y: S / 2, z: H - 2 });
};

const barracks: BuildingPainter = (o, S, H, _r, a) => {
  o.groundShadow(0, 0, S, S);
  o.box(6, 20, 0, S - 12, S - 34, H - 22, STONE);
  // Pitched roof as stepped slabs.
  for (let i = 0; i < 4; i++) o.box(10 + i * 4, 22 + i * 10, H - 22 + i * 6, S - 20 - i * 8, S - 38 - i * 20, 6, 0x3a3230);
  for (let i = 0; i < 4; i++) {
    o.box(14 + i * 46, S - 18, 0, 8, 6, H - 26, STONE_D);
    if (i < 3) o.lancet(28 + i * 46, S - 14, 14, 12, 22, WARM);
  }
  o.frontRect(S / 2 - 14, S - 14, 0, 28, 24, '#0c0a09');
  banner(o, S / 2 - 6, S - 14, 44, 26);
  o.box(S - 44, 26, H - 10, 12, 10, 26, STEEL_D);
  a.smoke.push({ x: S - 38, y: 30, z: H + 16 });
  a.lights.push({ x: S / 2, y: S - 14, z: 30 });
};

const mechanis: BuildingPainter = (o, S, H, _r, a) => {
  o.groundShadow(0, 0, S, S);
  o.box(6, 10, 0, S - 12, S - 20, H - 30, STEEL);
  // Barrel-vaulted roof.
  for (let i = 0; i < 6; i++) {
    const t = Math.sin((i / 5) * Math.PI);
    o.box(10, 12 + i * 22, H - 30, S - 20, 22, 8 + t * 22, i % 2 ? 0x4a525c : 0x565f6a);
  }
  o.frontRect(24, S - 10, 0, S - 48, H - 42, '#141414');
  for (let i = 0; i < 9; i++) o.frontRect(26 + i * 16, S - 10, H - 46, 8, 5, i % 2 ? '#1a1a1a' : '#d8b030');
  crest(o, S / 2, S - 10, H - 34, 10);
  // Gear emblem.
  const c = o.ctx;
  c.strokeStyle = '#c9a044';
  c.lineWidth = 5;
  c.beginPath();
  c.arc(o.sx(S / 2), o.sy(S - 10, H - 20), 11, 0, Math.PI * 2);
  c.stroke();
  // Crane.
  o.strut(S - 20, 20, H, S - 20, 20, H + 40, 3, BRASS);
  o.strut(S - 20, 20, H + 40, S - 70, 30, H + 34, 2.5, BRASS);
  a.lights.push({ x: S - 20, y: 20, z: H + 42 });
  a.smoke.push({ x: 24, y: 24, z: H + 10 });
};

const turret: BuildingPainter = (o, S, H, _r, a) => {
  o.groundShadow(0, 0, S, S);
  for (let i = 0; i < 10; i++) {
    const t = (i / 10) * Math.PI * 2;
    o.blob(S / 2 + Math.cos(t) * 50, S / 2 + Math.sin(t) * 50, 5, 11, 7, 0x6a5a40);
  }
  o.box(18, 18, 0, S - 36, S - 36, H - 6, STONE);
  o.frontRect(30, S - 18, H - 22, S - 60, 5, '#0a0808');
  for (let i = 0; i < 5; i++) o.frontRect(22 + i * 18, S - 18, 4, 10, 4, i % 2 ? '#1a1a1a' : '#d8b030');
  o.cylinder(S / 2, S / 2, H - 6, 26, 8, STEEL, 0x464e58);
  a.gun = { x: S / 2, y: S / 2, z: H + 4 };
};

const relay: BuildingPainter = (o, S, H, _r, a) => {
  o.groundShadow(0, 0, S, S);
  o.box(20, 20, 0, S - 40, S - 40, 14, STEEL_D);
  const legs: [number, number][] = [[28, 28], [S - 28, 28], [28, S - 28], [S - 28, S - 28]];
  for (const [x, y] of legs) o.strut(x, y, 14, S / 2, S / 2, H, 3, STEEL);
  for (let z = 30; z < H; z += 16) {
    const f = 1 - (z - 14) / (H - 14);
    o.strut(S / 2 - 36 * f, S / 2 + 36 * f, z, S / 2 + 36 * f, S / 2 - 36 * f, z + 12, 1.4, 0x707a88);
  }
  o.cylinder(S / 2, S / 2, H - 4, 5, 10, STEEL);
  // Dish.
  const c = o.ctx;
  c.fillStyle = '#8a94a2';
  c.beginPath();
  c.ellipse(o.sx(S / 2 + 10), o.sy(S / 2, H + 12), 18, 10, -0.5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#4a525c';
  c.beginPath();
  c.ellipse(o.sx(S / 2 + 12), o.sy(S / 2, H + 12), 13, 7, -0.5, 0, Math.PI * 2);
  c.fill();
  o.light(S / 2, S / 2, H + 22, 2.5, 0xff3020);
  a.lights.push({ x: S / 2, y: S / 2, z: H + 22 });
};

const research: BuildingPainter = (o, S, H, _r, a) => {
  o.groundShadow(0, 0, S, S);
  o.box(8, 24, 0, S - 16, S - 34, H - 32, STONE_D);
  o.box(12, 28, H - 32, S - 24, S - 42, 6, 0x3a3230);
  for (const x of [26, S - 50]) {
    o.cylinder(x + 12, 36, H - 26, 11, 54, STEEL_D, 0x201a18);
    a.smoke.push({ x: x + 12, y: 36, z: H + 30 });
  }
  // Furnace mouth and molten windows.
  o.frontRect(S / 2 - 22, S - 10, 0, 44, 30, '#1a0a04');
  o.lancet(S / 2 - 18, S - 10, 2, 36, 24, '#ff7020');
  for (const x of [20, S - 32]) o.lancet(x, S - 10, 16, 10, 20, '#ff9a40');
  // Central spire.
  o.box(S / 2 - 12, 40, H - 26, 24, 20, 24, STONE);
  o.cone(S / 2, 50, H - 2, 14, 40, 0x3a2a24);
  crest(o, S / 2, 60, H - 10, 7);
  a.lights.push({ x: S / 2, y: S - 10, z: 14 });
};

/** Supply Depot: armoured bunker-shed with stacked crates, fuel drums and a loading crane. */
const depot: BuildingPainter = (o, S, H, rnd, a) => {
  o.groundShadow(0, 0, S, S);
  o.box(6, 10, 0, S - 12, S - 22, 10, STONE_D);
  // Main shed with a slanted roof.
  o.box(10, 14, 10, S - 44, S - 36, H - 26, STONE);
  for (let i = 0; i < 3; i++) o.box(12 + i * 2, 16 + i * 8, H - 16 + i * 4, S - 48 - i * 4, S - 40 - i * 16, 5, 0x3a3230);
  o.frontRect(18, S - 22, 10, 30, 22, '#0c0a09');
  for (let i = 0; i < 4; i++) o.frontRect(19, S - 22, 12 + i * 5, 28, 2, 'rgba(120,110,90,0.8)');
  // Crate stacks and drums in the yard.
  for (const [x, y, z] of [[S - 30, 18, 10], [S - 30, 32, 10], [S - 30, 18, 24], [S - 22, S - 30, 10]]) {
    o.box(x, y, z, 16, 13, 14, rnd() < 0.5 ? 0x6a5a3a : 0x5a4c30);
    o.frontRect(x + 3, y + 13, z + 5, 10, 2, '#c9a044');
  }
  for (const x of [S - 40, S - 30]) {
    o.cylinder(x, S - 12, 10, 5, 12, 0x5a2a20, 0x7a3a28);
    o.frontRect(x - 5, S - 7, 17, 10, 2, '#d8b030');
  }
  banner(o, 50, S - 22, H - 22, 18);
  o.light(14, S - 22, H - 12, 2, 0xffb050);
  a.lights.push({ x: 14, y: S - 22, z: H - 12 });
  a.smoke.push({ x: 20, y: 22, z: H + 4 });
};

export const IRON_PAINTERS: Record<string, BuildingPainter> = {
  stronghold, generator, depot, barracks, mechanis, turret, relay, research,
};
