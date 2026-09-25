import { BuildingPainter } from './BuildingPainters';
import { Oblique } from './Oblique';

const FLESH = 0x6a2040;
const FLESH_D = 0x2e0c1e;
const CHITIN = 0x4a1a3a;
const BONE = 0xdcd0b0;
const GLOW = 0xc050ff;
const ACID = 0x90ff50;

function tendrils(o: Oblique, cx: number, cy: number, n: number, r: number, rnd: () => number): void {
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 + rnd() * 0.4;
    const x1 = cx + Math.cos(t) * r;
    const y1 = cy + Math.sin(t) * r;
    o.strut(cx + Math.cos(t) * r * 0.5, cy + Math.sin(t) * r * 0.5, 10, x1, y1, 0, 5, FLESH_D);
  }
}

function spike(o: Oblique, x: number, y: number, z: number, dx: number, dz: number, w: number): void {
  o.strut(x, y, z, x + dx, y, z + dz, w, BONE);
}

const hive: BuildingPainter = (o, S, H, rnd, a) => {
  o.groundShadow(0, 0, S, S);
  tendrils(o, S / 2, S / 2, 9, S * 0.5, rnd);
  for (let i = 0; i < 7; i++) {
    const t = (i / 7) * Math.PI * 2;
    o.blob(S / 2 + Math.cos(t) * 60, S / 2 + Math.sin(t) * 50, 20, 34, 26, i % 2 ? FLESH : CHITIN);
  }
  o.blob(S / 2, S / 2, 46, 70, H * 0.55, FLESH);
  o.blob(S / 2 - 20, S / 2 - 10, H - 14, 36, 26, CHITIN);
  for (let i = 0; i < 12; i++) o.blob(S / 2 + (rnd() - 0.5) * 110, S / 2 + (rnd() - 0.3) * 80, 30 + rnd() * 50, 5 + rnd() * 6, 5, 0x9a3a60);
  // Gaping maw with glowing core.
  o.blob(S / 2, S / 2 + 40, 30, 26, 18, 0x14040c);
  o.light(S / 2, S / 2 + 40, 30, 8, GLOW);
  for (const [x, dz] of [[-40, 30], [-10, 40], [22, 34], [48, 26]]) spike(o, S / 2 + x, S / 2 - 20, H - 20, x * 0.2, dz, 5);
  a.lights.push({ x: S / 2, y: S / 2 + 40, z: 30 });
  a.smoke.push({ x: S / 2 - 20, y: S / 2 - 10, z: H + 6 });
};

const spire: BuildingPainter = (o, S, H, rnd, a) => {
  o.groundShadow(0, 0, S, S);
  tendrils(o, S / 2, S / 2, 6, S * 0.45, rnd);
  o.blob(S / 2, S / 2, 14, 44, 20, FLESH_D);
  for (let i = 0; i < 8; i++) {
    const z = 16 + i * ((H - 10) / 8);
    const w = 22 * (1 - i / 9);
    o.blob(S / 2 + Math.sin(i * 1.3) * 5, S / 2, z, w, 10, i % 2 ? BONE : 0xb8ab8c);
  }
  o.strut(S / 2, S / 2, H - 6, S / 2 + 3, S / 2, H + 26, 4, BONE);
  for (let i = 0; i < 4; i++) o.light(S / 2 + Math.sin(i * 1.3) * 5, S / 2 + 12, 24 + i * 18, 2.4, GLOW);
  a.lights.push({ x: S / 2, y: S / 2 + 12, z: 42 });
};

const brood: BuildingPainter = (o, S, H, rnd, a) => {
  o.groundShadow(0, 0, S, S);
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    o.blob(S / 2 + Math.cos(t) * 74, S / 2 + Math.sin(t) * 66, 10, 20, 14, i % 2 ? FLESH : CHITIN);
  }
  o.blob(S / 2, S / 2, 4, 64, 22, 0x12040a);
  for (let i = 0; i < 9; i++) {
    const x = S / 2 + (rnd() - 0.5) * 90;
    const y = S / 2 + (rnd() - 0.5) * 60;
    o.blob(x, y, 10, 9, 12, 0xb8a060);
    o.light(x - 2, y + 4, 12, 1.4, ACID);
  }
  a.smoke.push({ x: S / 2, y: S / 2, z: H });
  a.lights.push({ x: S / 2, y: S / 2, z: 14 });
};

const maw: BuildingPainter = (o, S, H, rnd, a) => {
  o.groundShadow(0, 0, S, S);
  tendrils(o, S / 2, S / 2, 8, S * 0.48, rnd);
  o.blob(S / 2, S / 2, 30, 82, H * 0.55, FLESH);
  o.blob(S / 2, S / 2 + 30, 28, 44, 28, 0x10020a);
  for (let i = 0; i < 14; i++) {
    const t = Math.PI + (i / 13) * Math.PI;
    const x = S / 2 + Math.cos(t) * 40;
    const z = 28 + Math.sin(t) * -24;
    spike(o, x, S / 2 + 34, z, -Math.cos(t) * 8, z > 28 ? -10 : 10, 3);
  }
  o.light(S / 2, S / 2 + 30, 24, 7, 0xff3050);
  a.lights.push({ x: S / 2, y: S / 2 + 30, z: 24 });
};

const spine: BuildingPainter = (o, S, H, rnd, a) => {
  o.groundShadow(0, 0, S, S);
  o.blob(S / 2, S / 2, 14, 42, 18, FLESH_D);
  o.blob(S / 2, S / 2, 28, 30, 22, CHITIN);
  for (let i = 0; i < 7; i++) {
    const t = (i / 7) * Math.PI * 2;
    spike(o, S / 2 + Math.cos(t) * 18, S / 2 + Math.sin(t) * 14, 24, Math.cos(t) * 26, 18 + rnd() * 12, 4);
  }
  o.light(S / 2, S / 2 + 16, 34, 3, GLOW);
  a.gun = { x: S / 2, y: S / 2, z: H - 6 };
};

/** Brood Nest: a clutch of glowing eggs in a ring of fleshy ribs. */
const nest: BuildingPainter = (o, S, H, rnd, a) => {
  o.groundShadow(0, 0, S, S);
  tendrils(o, S / 2, S / 2, 6, S * 0.46, rnd);
  o.blob(S / 2, S / 2, 6, 48, 12, FLESH_D);
  for (let i = 0; i < 7; i++) {
    const t = (i / 7) * Math.PI * 2;
    const x = S / 2 + Math.cos(t) * 22;
    const y = S / 2 + Math.sin(t) * 18;
    o.blob(x, y, 14, 11, 16, i % 2 ? 0xc8b078 : 0xb09a60);
    o.light(x - 2, y + 5, 16, 1.6, ACID);
  }
  o.blob(S / 2, S / 2, 20, 14, 20, 0xd0bc88);
  o.light(S / 2, S / 2 + 6, 22, 3, ACID);
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2 + 0.3;
    spike(o, S / 2 + Math.cos(t) * 40, S / 2 + Math.sin(t) * 34, 8, -Math.cos(t) * 14, H - 12, 3);
  }
  a.lights.push({ x: S / 2, y: S / 2 + 6, z: 22 });
};

/** Gestation Vat: a ribbed flesh cauldron brimming with glowing fluid and a half-formed beast. */
const vat: BuildingPainter = (o, S, H, rnd, a) => {
  o.groundShadow(0, 0, S, S);
  tendrils(o, S / 2, S / 2, 10, S * 0.5, rnd);
  for (let i = 0; i < 14; i++) {
    const t = (i / 14) * Math.PI * 2;
    o.blob(S / 2 + Math.cos(t) * 88, S / 2 + Math.sin(t) * 76, 14, 24, 26, i % 2 ? FLESH : CHITIN);
  }
  // The pool itself: glowing acid with something curled up inside.
  o.blob(S / 2, S / 2, 20, 80, 10, 0x2a4a10);
  o.blob(S / 2, S / 2, 26, 70, 6, 0x6ab030);
  o.blob(S / 2 - 10, S / 2 + 4, 30, 30, 14, 0x5a2a48);
  o.light(S / 2, S / 2, 30, 10, ACID);
  // Ribs arching over the vat.
  for (let i = 0; i < 5; i++) {
    const x = S / 2 - 70 + i * 35;
    spike(o, x, S / 2 - 50, 30, (S / 2 - x) * 0.35, H - 20, 5);
    spike(o, x, S / 2 + 50, 30, (S / 2 - x) * 0.35, H - 26, 5);
  }
  for (let i = 0; i < 6; i++) o.light(S / 2 + (rnd() - 0.5) * 120, S / 2 + (rnd() - 0.5) * 90, 28, 1.6, ACID);
  a.lights.push({ x: S / 2, y: S / 2, z: 30 });
  a.smoke.push({ x: S / 2 + 20, y: S / 2, z: 40 });
};

/** Thorn Wall: a tangle of bone spikes rooted in a ridge of flesh. */
const thornwall: BuildingPainter = (o, S, H, rnd) => {
  o.groundShadow(0, 0, S, S);
  o.blob(S / 2, S / 2, 4, S * 0.46, 10, FLESH_D);
  for (let i = 0; i < 7; i++) {
    const x = 6 + rnd() * (S - 12);
    spike(o, x, S / 2 + (rnd() - 0.5) * 16, 8, (rnd() - 0.5) * 16, H - 6 - rnd() * 10, 3);
  }
  o.blob(S / 2, S / 2, 10, S * 0.3, 8, CHITIN);
};

/** Spore Node: a bulbous pod on a root cluster with pores venting spores. */
const sporenode: BuildingPainter = (o, S, H, rnd, a) => {
  o.groundShadow(0, 0, S, S);
  tendrils(o, S / 2, S / 2, 7, S * 0.48, rnd);
  o.blob(S / 2, S / 2, 10, 30, 14, FLESH_D);
  o.blob(S / 2, S / 2, 26, 26, H * 0.45, FLESH);
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2;
    o.light(S / 2 + Math.cos(t) * 16, S / 2 + Math.sin(t) * 12 + 8, 30 + Math.sin(t) * 8, 1.6, ACID);
  }
  spike(o, S / 2, S / 2, H - 16, 4, 20, 4);
  a.smoke.push({ x: S / 2, y: S / 2, z: H });
  a.lights.push({ x: S / 2, y: S / 2 + 12, z: 34 });
  a.gun = { x: S / 2, y: S / 2, z: H - 10 };
};

/** Spore Mine: a half-buried pulsing pod. */
const sporemine: BuildingPainter = (o, S, _H, rnd, a) => {
  for (let i = 0; i < 2; i++) {
    const x = S / 2 + (rnd() - 0.5) * 24;
    const y = S / 2 + (rnd() - 0.5) * 20;
    o.blob(x, y, 1, 12, 4, 0x2a1020);
    o.blob(x, y, 4, 9, 8, 0x6a2a50);
    o.light(x, y + 3, 8, 1.4, ACID);
    a.lights.push({ x, y: y + 3, z: 8 });
  }
};

/** Evolution Pit: a steaming crater ringed with ribs where mutated organs float in ichor. */
const evolution: BuildingPainter = (o, S, H, rnd, a) => {
  o.groundShadow(0, 0, S, S);
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    o.blob(S / 2 + Math.cos(t) * 70, S / 2 + Math.sin(t) * 62, 12, 20, 18, i % 2 ? FLESH : CHITIN);
  }
  o.blob(S / 2, S / 2, 6, 60, 8, 0x1a0418);
  o.blob(S / 2, S / 2, 10, 50, 5, 0x6a2a8a);
  o.light(S / 2, S / 2, 14, 9, GLOW);
  for (let i = 0; i < 5; i++) o.blob(S / 2 + (rnd() - 0.5) * 60, S / 2 + (rnd() - 0.5) * 40, 16 + rnd() * 10, 7, 7, 0xb05a90);
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2;
    spike(o, S / 2 + Math.cos(t) * 56, S / 2 + Math.sin(t) * 50, 22, -Math.cos(t) * 30, H - 10, 4);
  }
  a.smoke.push({ x: S / 2, y: S / 2, z: 30 });
  a.lights.push({ x: S / 2, y: S / 2, z: 14 });
};

/** Healing Pool: a shallow basin of glowing green fluid fed by veined tubes. */
const pool: BuildingPainter = (o, S, H, rnd, a) => {
  o.groundShadow(0, 0, S, S);
  tendrils(o, S / 2, S / 2, 8, S * 0.5, rnd);
  for (let i = 0; i < 14; i++) {
    const t = (i / 14) * Math.PI * 2;
    o.blob(S / 2 + Math.cos(t) * 74, S / 2 + Math.sin(t) * 64, 8, 18, 14, i % 2 ? FLESH : CHITIN);
  }
  o.blob(S / 2, S / 2, 8, 68, 6, 0x2a5a18);
  o.blob(S / 2, S / 2, 12, 58, 3, 0x7ad040);
  o.light(S / 2, S / 2, 14, 10, 0x90ff60);
  for (let i = 0; i < 4; i++) o.blob(S / 2 + (rnd() - 0.5) * 70, S / 2 + (rnd() - 0.5) * 50, 14, 6, 4, 0xc0ff90);
  spike(o, S / 2 + 50, S / 2 - 30, 20, -10, H, 5);
  a.lights.push({ x: S / 2, y: S / 2, z: 14 });
};

/** Sensory Organ: a tall stalk of flesh topped by a great staring eye. */
const organ: BuildingPainter = (o, S, H, rnd, a) => {
  o.groundShadow(0, 0, S, S);
  tendrils(o, S / 2, S / 2, 6, S * 0.46, rnd);
  o.blob(S / 2, S / 2, 10, 30, 14, FLESH_D);
  for (let i = 0; i < 7; i++) o.blob(S / 2 + Math.sin(i * 0.9) * 4, S / 2, 20 + i * ((H - 40) / 7), 13 - i * 0.8, 9, i % 2 ? FLESH : CHITIN);
  o.blob(S / 2, S / 2, H - 10, 20, 16, 0xe8dcc0);
  o.blob(S / 2 + 2, S / 2 + 10, H - 8, 10, 9, 0xc03060);
  o.light(S / 2 + 3, S / 2 + 14, H - 8, 4, 0xff4080);
  a.lights.push({ x: S / 2 + 3, y: S / 2 + 14, z: H - 8 });
};

/** Acid Spire: a twisted chitin tower whose tip is a swollen acid sac. */
const acidspire: BuildingPainter = (o, S, H, rnd, a) => {
  o.groundShadow(0, 0, S, S);
  tendrils(o, S / 2, S / 2, 6, S * 0.46, rnd);
  o.blob(S / 2, S / 2, 12, 34, 16, FLESH_D);
  for (let i = 0; i < 6; i++) o.blob(S / 2 + Math.sin(i * 1.4) * 6, S / 2, 22 + i * ((H - 50) / 6), 16 - i, 10, i % 2 ? CHITIN : 0x3a1030);
  o.blob(S / 2, S / 2, H - 20, 20, 18, 0x5aa028);
  o.light(S / 2, S / 2 + 10, H - 16, 6, ACID);
  for (let i = 0; i < 4; i++) spike(o, S / 2 + (i - 1.5) * 12, S / 2, H - 30, (i - 1.5) * 6, 16, 2.5);
  a.lights.push({ x: S / 2, y: S / 2 + 10, z: H - 16 });
};

/** Hive Portal: a ring of bone arches around a swirling violet rift. */
const portal: BuildingPainter = (o, S, H, rnd, a) => {
  o.groundShadow(0, 0, S, S);
  tendrils(o, S / 2, S / 2, 10, S * 0.5, rnd);
  o.blob(S / 2, S / 2, 6, 70, 10, FLESH_D);
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2;
    const x = S / 2 + Math.cos(t) * 56;
    const y = S / 2 + Math.sin(t) * 48;
    spike(o, x, y, 8, -Math.cos(t) * 40, H - 8, 6);
  }
  const g = o.glow;
  const c = o.ctx;
  const X = o.sx(S / 2);
  const Y = o.sy(S / 2, H * 0.45);
  for (const ctx of [c, g]) {
    if (!ctx) continue;
    const grad = ctx.createRadialGradient(X, Y, 2, X, Y, 40);
    grad.addColorStop(0, 'rgba(255,220,255,0.95)');
    grad.addColorStop(0.4, 'rgba(200,80,255,0.8)');
    grad.addColorStop(1, 'rgba(60,0,80,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(X, Y, 34, 40, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  a.lights.push({ x: S / 2, y: S / 2, z: H * 0.45 });
};

export const HORDE_PAINTERS: Record<string, BuildingPainter> = {
  hive, spire, nest, brood, maw, vat, spine, thornwall, sporenode, sporemine, evolution, pool, organ, acidspire, portal,
};
