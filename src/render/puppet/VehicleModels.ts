import { Part, V3, v } from './Puppet3D';
import { AnimName, UnitModel, walkPhase } from './Models';
import { shade } from '../CanvasUtil';

/**
 * Vehicles and war-beasts for the puppet rasteriser. Death frames char the colours and
 * the last one is the wreck/carcass that stays on the field.
 */

type Built = { parts: Part[]; pose: { fall?: number; roll?: number; lift?: number } };

const STEEL = 0x6c7684;
const STEEL_D = 0x383d45;
const TEAM = 0x2f63c8;
const BRASS = 0xc9a044;
const TREAD = 0x1a1a1c;
const LAMP = 0xfff0b0;

const CHITIN = 0x5a1f4e;
const CHITIN_D = 0x2c0c26;
const FLESH = 0x7a2a48;
const BONE = 0xdcd0b0;
const EYES = 0x9dff5a;
const PSY = 0xd060ff;

function add(a: V3, b: V3): V3 {
  return v(a.f + b.f, a.s + b.s, a.z + b.z);
}

/** Darkens every colour for burning / wrecked frames (0 = intact, 1 = charred). */
function charred(parts: Part[], f: number): Part[] {
  if (f <= 0) return parts;
  return parts.map((p) => {
    if (p.kind === 'glow') return p;
    const color = shade(p.color, 1 - f * 0.62);
    return p.kind === 'box' || p.kind === 'ball' ? { ...p, color, emissive: false } : { ...p, color };
  });
}

/** Burning debris glows for death frames 1..2. */
function fires(parts: Part[], S: (f: number, s: number, z: number) => V3, anim: AnimName, frame: number, spots: [number, number, number][]): void {
  if (anim !== 'death' || frame < 1 || frame > 2) return;
  for (const [f, s, z] of spots) parts.push({ kind: 'glow', c: S(f, s, z + frame * 2), r: (10 - frame * 2) * 1.6, color: frame === 1 ? 0xffa040 : 0xff6020 });
}

/** Tracked running gear: side skirts plus tread links that crawl with the walk phase. */
function tracks(parts: Part[], S: (f: number, s: number, z: number) => V3, len: number, half: number, h: number, phase: number): void {
  for (const side of [-1, 1]) {
    parts.push({ kind: 'box', c: S(0, side * half, h / 2), h: S(len / 2, 1.9, h / 2), color: TREAD });
    const n = Math.round(len / 2.6);
    for (let i = 0; i < n; i++) {
      const f = -len / 2 + (((i + phase) % n) / n) * len;
      parts.push({ kind: 'box', c: S(f, side * (half + 1.3), h / 2), h: S(0.5, 0.3, h / 2 + 0.2), color: 0x3a3a3c, outline: false });
    }
    for (const f of [-len * 0.35, 0, len * 0.35]) parts.push({ kind: 'ball', c: S(f, side * (half + 1.6), h * 0.45), r: h * 0.28 * 1.6, color: 0x2a2a2c, squash: 1 });
  }
}

function wheel(parts: Part[], c: V3, r: number, spin: number): void {
  parts.push({ kind: 'ball', c, r, color: TREAD, squash: 1 });
  const d = v(Math.cos(spin) * r * 0.7, 0, Math.sin(spin) * r * 0.7);
  parts.push({ kind: 'limb', a: add(c, v(-d.f, 0, -d.z)), b: add(c, d), r: r * 0.18, color: 0x6a6a6a });
  parts.push({ kind: 'ball', c, r: r * 0.35, color: 0x8a8a8a });
}

function deathFrac(anim: AnimName, frame: number): number {
  return anim === 'death' ? Math.min(1, (frame + 1) / 3) : 0;
}

// ---------------------------------------------------------------- Iron Void

function buggy(anim: AnimName, frame: number): Built {
  const k = 1.45;
  const S = (f: number, s: number, z: number): V3 => v(f * k, s * k, z * k);
  const parts: Part[] = [];
  const moving = anim === 'walk';
  const spin = moving ? walkPhase(frame) * 2 : 0;
  const bounce = moving ? Math.abs(Math.sin(walkPhase(frame) * 2)) * 0.6 : 0;
  const dead = anim === 'death';
  for (const [f, s] of [[7, -6.5], [7, 6.5], [-7, -6.5], [-7, 6.5]]) wheel(parts, S(f, s, 3), 3 * k, spin + f);
  const z = 4.5 + bounce;
  parts.push({ kind: 'box', c: S(0, 0, z), h: S(10, 5, 1.6), color: STEEL });
  parts.push({ kind: 'box', c: S(7.5, 0, z + 1.8), h: S(3, 4.2, 1.2), color: STEEL, pitch: -0.25 });
  parts.push({ kind: 'box', c: S(-1, 0, z + 1.8), h: S(5, 4.6, 0.4), color: TEAM });
  parts.push({ kind: 'box', c: S(-8, 0, z + 2.4), h: S(2.2, 4, 1.4), color: STEEL_D });
  // Roll cage.
  for (const s of [-4, 4]) {
    parts.push({ kind: 'limb', a: S(2, s, z + 1.6), b: S(0, s, z + 7.5), r: 0.5 * k, color: 0x3a3a3a });
    parts.push({ kind: 'limb', a: S(-5, s, z + 1.6), b: S(-3, s, z + 7.5), r: 0.5 * k, color: 0x3a3a3a });
  }
  parts.push({ kind: 'limb', a: S(0, -4, z + 7.5), b: S(0, 4, z + 7.5), r: 0.5 * k, color: 0x3a3a3a });
  parts.push({ kind: 'limb', a: S(-3, -4, z + 7.5), b: S(-3, 4, z + 7.5), r: 0.5 * k, color: 0x3a3a3a });
  if (!dead) {
    // Driver and gunner.
    parts.push({ kind: 'ball', c: S(1.5, -1.8, z + 4.5), r: 1.9 * k, color: 0x5b6574 });
    parts.push({ kind: 'box', c: S(3, -1.8, z + 4.6), h: S(0.4, 1.2, 0.4), color: 0x7ff0ff, emissive: true });
    parts.push({ kind: 'ball', c: S(-3, 1.5, z + 5.3), r: 1.9 * k, color: 0x5b6574 });
  }
  // Twin autoguns on a pintle.
  const rf = anim === 'attack' && frame === 1 ? -0.8 : 0;
  for (const s of [0.9, 2.1]) parts.push({ kind: 'limb', a: S(-2 + rf, s, z + 6), b: S(5 + rf, s, z + 6.2), r: 0.55 * k, color: 0x151515 });
  parts.push({ kind: 'box', c: S(-2.5, 1.5, z + 6), h: S(1.4, 1.4, 1), color: BRASS });
  if (anim === 'attack') parts.push({ kind: 'glow', c: S(7, frame ? 2.1 : 0.9, z + 6.2), r: 7 * k, color: 0xffd070 });
  for (const s of [-3, 3]) parts.push({ kind: 'ball', c: S(10, s, z + 1), r: 0.8 * k, color: LAMP, emissive: !dead });
  fires(parts, S, anim, frame, [[2, 0, z + 3], [-6, 2, z + 3]]);
  return { parts: charred(parts, deathFrac(anim, frame)), pose: dead ? { roll: Math.min(3, frame) * 0.12 } : anim === 'hit' ? { roll: 0.06 } : {} };
}

function apc(anim: AnimName, frame: number): Built {
  const k = 1.5;
  const S = (f: number, s: number, z: number): V3 => v(f * k, s * k, z * k);
  const parts: Part[] = [];
  const dead = anim === 'death';
  const phase = anim === 'walk' ? frame : 0;
  const bob = anim === 'walk' ? (frame % 2) * 0.25 : 0;
  tracks(parts, S, 20, 6.4, 4.2, phase);
  const z = 4 + bob;
  parts.push({ kind: 'box', c: S(-0.5, 0, z + 3.2), h: S(9.5, 5.6, 3.2), color: STEEL });
  parts.push({ kind: 'box', c: S(9.5, 0, z + 2.5), h: S(2.2, 5.4, 2.4), color: STEEL, pitch: -0.55 });
  parts.push({ kind: 'box', c: S(-1, 0, z + 6.6), h: S(7, 4.6, 0.4), color: STEEL_D });
  // Team panels, brass trim and hazard chevrons.
  for (const side of [-1, 1]) {
    parts.push({ kind: 'box', c: S(0, side * 5.7, z + 3.4), h: S(5, 0.2, 1.6), color: TEAM });
    parts.push({ kind: 'box', c: S(0, side * 5.75, z + 3.4), h: S(1.2, 0.2, 0.9), color: BRASS, emissive: false });
  }
  parts.push({ kind: 'box', c: S(-10, 0, z + 3), h: S(0.4, 5, 2.4), color: 0x3a3a3a });
  // Hatch and pintle gun.
  parts.push({ kind: 'ball', c: S(1, 0, z + 7.2), r: 1.8 * k, color: STEEL_D, squash: 0.6 });
  const rf = anim === 'attack' && frame === 1 ? -0.7 : 0;
  parts.push({ kind: 'limb', a: S(0.5 + rf, 0, z + 8), b: S(6 + rf, 0, z + 8.3), r: 0.55 * k, color: 0x151515 });
  if (anim === 'attack') parts.push({ kind: 'glow', c: S(7.5, 0, z + 8.3), r: 6 * k, color: 0xffd070 });
  for (const s of [-1, 1]) {
    parts.push({ kind: 'limb', a: S(-8, s * 3.6, z + 6.5), b: S(-8.5, s * 3.6, z + 10.5), r: 0.8 * k, color: 0x2a2a2a });
    parts.push({ kind: 'ball', c: S(11, s * 4, z + 3.2), r: 0.8 * k, color: LAMP, emissive: !dead });
  }
  fires(parts, S, anim, frame, [[0, 0, z + 7], [-6, -2, z + 6]]);
  return { parts: charred(parts, deathFrac(anim, frame)), pose: dead ? { roll: Math.min(2, frame) * 0.06 } : {} };
}

function tankHull(anim: AnimName, frame: number): Built {
  const k = 1.6;
  const S = (f: number, s: number, z: number): V3 => v(f * k, s * k, z * k);
  const parts: Part[] = [];
  const dead = anim === 'death';
  tracks(parts, S, 24, 7.6, 5, anim === 'walk' ? frame : 0);
  const z = 4.6 + (anim === 'walk' ? (frame % 2) * 0.2 : 0);
  parts.push({ kind: 'box', c: S(0, 0, z + 2.6), h: S(11.5, 6.4, 2.6), color: STEEL });
  parts.push({ kind: 'box', c: S(11.8, 0, z + 1.8), h: S(1.8, 6.2, 1.8), color: STEEL, pitch: -0.6 });
  parts.push({ kind: 'box', c: S(0, 0, z + 5.4), h: S(9, 5.5, 0.3), color: STEEL_D });
  for (const side of [-1, 1]) {
    parts.push({ kind: 'box', c: S(0, side * 8.8, z + 1.6), h: S(11.5, 0.5, 1.8), color: 0x3e4652 });
    parts.push({ kind: 'box', c: S(-2, side * 9.35, z + 1.8), h: S(3.5, 0.2, 1), color: TEAM });
    parts.push({ kind: 'ball', c: S(12.5, side * 4.5, z + 2.5), r: 0.9 * k, color: LAMP, emissive: !dead });
    parts.push({ kind: 'limb', a: S(-11, side * 4, z + 4.5), b: S(-11.5, side * 4, z + 8), r: 0.9 * k, color: 0x2a2a2a });
  }
  if (dead) {
    // Blown-off turret lying askew on the wreck.
    parts.push({ kind: 'box', c: S(-2, 1.5, z + 7.2), h: S(5, 4.2, 1.8), color: STEEL, yaw: 0.5, roll: 0.3 });
    parts.push({ kind: 'limb', a: S(1, 3, z + 7.5), b: S(10, 7, z + 5.5), r: 0.9 * k, color: 0x2a2e34 });
  }
  fires(parts, S, anim, frame, [[0, 0, z + 7], [-7, 3, z + 6], [6, -3, z + 5]]);
  return { parts: charred(parts, deathFrac(anim, frame)), pose: dead ? { roll: Math.min(2, frame) * 0.05 } : {} };
}

/** Separate turret atlas: frame 0 = at rest, 1 = firing (barrel recoil + flash). */
function tankTurret(frame: number): Built {
  const k = 1.6;
  const S = (f: number, s: number, z: number): V3 => v(f * k, s * k, z * k);
  const parts: Part[] = [];
  const z = 10.2;
  const rf = frame === 1 ? -2 : 0;
  parts.push({ kind: 'box', c: S(-0.5, 0, z + 1.9), h: S(5.2, 4.4, 1.9), color: STEEL });
  parts.push({ kind: 'box', c: S(-5.5, 0, z + 1.9), h: S(1.2, 3.6, 1.5), color: STEEL_D });
  parts.push({ kind: 'box', c: S(4.8, 0, z + 1.9), h: S(0.8, 2.2, 1.4), color: 0x3a4250 });
  parts.push({ kind: 'box', c: S(-1, 0, z + 4), h: S(3, 3, 0.3), color: TEAM });
  parts.push({ kind: 'ball', c: S(-2, -2.5, z + 4.3), r: 1.2 * k, color: STEEL_D, squash: 0.7 });
  parts.push({ kind: 'limb', a: S(5 + rf, 0, z + 2), b: S(17 + rf, 0, z + 2.2), r: 1 * k, color: 0x2a2e34 });
  parts.push({ kind: 'limb', a: S(15.5 + rf, 0, z + 2.2), b: S(18 + rf, 0, z + 2.2), r: 1.35 * k, color: 0x1a1c20 });
  parts.push({ kind: 'box', c: S(0, 2.8, z + 4.2), h: S(1, 0.6, 0.6), color: BRASS });
  if (frame === 1) parts.push({ kind: 'glow', c: S(20.5, 0, z + 2.2), r: 12 * k, color: 0xffb050 });
  return { parts, pose: {} };
}

function artillery(anim: AnimName, frame: number): Built {
  const k = 1.5;
  const S = (f: number, s: number, z: number): V3 => v(f * k, s * k, z * k);
  const parts: Part[] = [];
  const dead = anim === 'death';
  // attack = deployed: legs splayed, body lowered, tube raised.
  const deployed = anim === 'attack';
  const ph = anim === 'walk' ? walkPhase(frame) : 0;
  const body = deployed ? 9 : 12 + (anim === 'walk' ? Math.abs(Math.sin(ph)) * 0.6 : 0);
  for (const [f, s, off] of [[6, -1, 0], [6, 1, Math.PI], [-6, -1, Math.PI], [-6, 1, 0]] as [number, number, number][]) {
    const stride = anim === 'walk' ? Math.sin(ph + off) * 3.2 : 0;
    const lift = anim === 'walk' ? Math.max(0, Math.cos(ph + off)) * 2.2 : 0;
    const hip = S(f * 0.6, s * 4, body);
    const spread = deployed ? 1.5 : 1;
    const knee = S(f * 0.9 + stride * 0.5, s * 8 * spread, body + 3 + lift);
    const foot = S(f * 1.1 + stride, s * 10 * spread, lift);
    parts.push({ kind: 'limb', a: hip, b: knee, r: 1.2 * k, color: STEEL_D });
    parts.push({ kind: 'limb', a: knee, b: foot, r: 1 * k, color: STEEL });
    parts.push({ kind: 'box', c: add(foot, S(0, 0, 0.4)), h: S(1.6, 1.4, 0.4), color: 0x2a2a2a });
    parts.push({ kind: 'ball', c: knee, r: 1.1 * k, color: BRASS });
  }
  parts.push({ kind: 'box', c: S(0, 0, body + 1.5), h: S(7, 5, 2.4), color: STEEL });
  parts.push({ kind: 'box', c: S(-5.5, 0, body + 2.5), h: S(2, 4, 2.2), color: STEEL_D });
  parts.push({ kind: 'box', c: S(0, 0, body + 4.1), h: S(4.2, 3.4, 0.3), color: TEAM });
  // Mortar tube: low when marching, raised when deployed; recoils when firing.
  const pitch = deployed ? -0.95 : -0.25;
  const rf = deployed && frame === 1 ? -1.5 : 0;
  const base = S(1.5, 0, body + 4.5);
  const dir = v(Math.cos(-pitch), 0, Math.sin(-pitch));
  const muzzle = add(base, v(dir.f * (13 + rf) * k, 0, dir.z * (13 + rf) * k));
  parts.push({ kind: 'limb', a: base, b: muzzle, r: 2.1 * k, color: 0x2a2e34 });
  parts.push({ kind: 'limb', a: add(base, v(dir.f * 3 * k, 0, dir.z * 3 * k)), b: add(base, v(dir.f * 6 * k, 0, dir.z * 6 * k)), r: 2.5 * k, color: BRASS });
  if (deployed && frame === 1) parts.push({ kind: 'glow', c: add(muzzle, v(dir.f * 3, 0, dir.z * 3)), r: 14 * k, color: 0xffb050 });
  if (!dead) parts.push({ kind: 'box', c: S(5.5, 0, body + 2), h: S(0.4, 2.4, 0.6), color: 0x7ff0ff, emissive: true });
  fires(parts, S, anim, frame, [[0, 0, body + 4], [-5, 2, body + 3]]);
  const pose = dead ? { fall: Math.min(2, frame) * 0.12, roll: frame * 0.18, lift: -frame * 2 } : {};
  return { parts: charred(parts, deathFrac(anim, frame)), pose };
}

// ---------------------------------------------------------------- Null Horde

function skimmer(anim: AnimName, frame: number): Built {
  const k = 1.9;
  const S = (f: number, s: number, z: number): V3 => v(f * k, s * k, z * k);
  const parts: Part[] = [];
  const dead = anim === 'death';
  const flap = dead ? -0.4 : Math.sin((frame / 6) * Math.PI * 2 + (anim === 'walk' ? 0 : 1)) * (anim === 'walk' ? 0.55 : 0.3);
  const z = 4;
  // Two pairs of membranous wings.
  for (const side of [-1, 1]) {
    for (const [f, len, off] of [[1.5, 11, 0], [-2.5, 9, 0.5]]) {
      const a = flap * (off ? 0.7 : 1);
      const root = S(f, side * 2.5, z + 3);
      const tip = add(root, S(-2, side * len * Math.cos(a), len * Math.sin(a) + 1));
      parts.push({ kind: 'limb', a: root, b: tip, r: 0.5 * k, color: BONE });
      parts.push({ kind: 'box', c: S(f - 1.5, side * (2.5 + len * 0.5 * Math.cos(a)), z + 3.5 + len * 0.5 * Math.sin(a)), h: S(1.8, len * 0.5, 0.25),
        color: 0x5a2a5a, roll: side * a, outline: false });
    }
  }
  parts.push({ kind: 'ball', c: S(0, 0, z + 2.5), r: 3.6 * k, color: CHITIN, squash: 0.7 });
  parts.push({ kind: 'ball', c: S(-4.5, 0, z + 2), r: 2.6 * k, color: FLESH, squash: 0.75 });
  let prev = S(-6.5, 0, z + 2);
  for (let i = 1; i <= 3; i++) {
    const nxt = S(-6.5 - i * 2.6, Math.sin(frame + i) * 0.8, z + 2 - i * 0.4);
    parts.push({ kind: 'limb', a: prev, b: nxt, r: (1.1 - i * 0.22) * k, color: CHITIN_D });
    prev = nxt;
  }
  const head = S(4.5, 0, z + 2.8);
  parts.push({ kind: 'ball', c: head, r: 2.2 * k, color: CHITIN_D });
  for (const side of [-1, 1]) {
    parts.push({ kind: 'ball', c: add(head, S(1.5, side * 1, 0.5)), r: 0.7 * k, color: EYES, emissive: !dead });
    parts.push({ kind: 'limb', a: add(head, S(1, side * 0.8, -1)), b: add(head, S(3.5, side * 0.5, -2)), r: 0.5 * k, color: BONE });
  }
  if (anim === 'attack' && frame === 1) parts.push({ kind: 'glow', c: add(head, S(4, 0, -1.5)), r: 7 * k, color: 0x90ff40 });
  const pose = dead ? { roll: Math.min(3, frame) * 0.7, lift: -frame * 1.5 } : anim === 'hit' ? { roll: 0.2 } : {};
  return { parts: charred(parts, dead ? frame / 4 : 0), pose };
}

function carrier(anim: AnimName, frame: number): Built {
  const k = 1.8;
  const S = (f: number, s: number, z: number): V3 => v(f * k, s * k, z * k);
  const parts: Part[] = [];
  const dead = anim === 'death';
  const ph = anim === 'walk' ? walkPhase(frame) : 0;
  const bob = anim === 'walk' ? Math.abs(Math.sin(ph)) * 0.5 : anim === 'idle' && frame === 1 ? 0.3 : 0;
  [-5, 0, 5].forEach((f, i) => {
    for (const side of [-1, 1]) {
      const tri = (i % 2 === 0) === side > 0 ? 0 : Math.PI;
      const stride = anim === 'walk' ? Math.sin(ph + tri) * 2.6 : 0;
      const raise = anim === 'walk' ? Math.max(0, Math.cos(ph + tri)) * 1.8 : 0;
      const hip = S(f, side * 5, 7 + bob);
      const knee = S(f + stride * 0.5, side * 10.5, 9 + raise - (dead ? 4 : 0));
      const foot = S(f + stride, side * 12, raise);
      parts.push({ kind: 'limb', a: hip, b: knee, r: 1.4 * k, color: CHITIN_D });
      parts.push({ kind: 'limb', a: knee, b: foot, r: 1 * k, color: BONE });
    }
  });
  const z = 7 + bob - (dead ? 3 : 0);
  // Belly pouch glowing with the brood inside.
  parts.push({ kind: 'ball', c: S(-1, 0, z), r: 6.2 * k, color: 0x8a3a58, squash: 0.7 });
  parts.push({ kind: 'ball', c: S(-1, 0, z - 0.5), r: 2.4 * k, color: 0xc050a0, emissive: !dead });
  // Armoured shell plates.
  for (const [f, w] of [[-7, 5], [-3, 6.5], [1.5, 6.5], [5.5, 5]]) {
    parts.push({ kind: 'box', c: S(f, 0, z + 4.2), h: S(2.2, w, 1.4), color: f % 2 ? CHITIN : 0x4a1840, pitch: f * 0.04 });
  }
  const head = S(10, 0, z + 1.5);
  parts.push({ kind: 'ball', c: head, r: 3.2 * k, color: CHITIN_D });
  for (const side of [-1, 1]) {
    parts.push({ kind: 'ball', c: add(head, S(2.2, side * 1.5, 0.8)), r: 0.8 * k, color: EYES, emissive: !dead });
    const bite = anim === 'attack' && frame === 1 ? 0.4 : 1.2;
    parts.push({ kind: 'limb', a: add(head, S(1.5, side * 1.8, -1)), b: add(head, S(5, side * bite, -1.8)), r: 0.8 * k, color: BONE });
  }
  for (const [f, h] of [[-6, 4], [-2, 5], [2, 4.5]]) parts.push({ kind: 'limb', a: S(f, 0, z + 5.5), b: S(f - 1.5, 0, z + 5.5 + h), r: 0.7 * k, color: BONE });
  const pose = dead ? { roll: Math.min(2, frame) * 0.2 } : anim === 'hit' ? { roll: 0.08 } : {};
  return { parts: charred(parts, dead ? frame / 4 : 0), pose };
}

function siegebeast(anim: AnimName, frame: number): Built {
  const k = 1.85;
  const S = (f: number, s: number, z: number): V3 => v(f * k, s * k, z * k);
  const parts: Part[] = [];
  const dead = anim === 'death';
  const ph = anim === 'walk' ? walkPhase(frame) : 0;
  const bob = anim === 'walk' ? Math.abs(Math.cos(ph)) * 0.8 : 0;
  for (const [f, side, off] of [[5, -1, 0], [5, 1, Math.PI], [-5, -1, Math.PI], [-5, 1, 0]] as [number, number, number][]) {
    const sw = anim === 'walk' ? Math.sin(ph + off) * 0.4 : 0;
    const hip = S(f, side * 5.5, 11 + bob);
    const knee = add(hip, S(Math.sin(sw) * 4, side * 1.5, -5.5));
    const foot = S(f + Math.sin(sw) * 5, side * 7, 0);
    parts.push({ kind: 'limb', a: hip, b: knee, r: 2.4 * k, color: FLESH });
    parts.push({ kind: 'limb', a: knee, b: foot, r: 1.9 * k, color: CHITIN });
  }
  const z = 11 + bob - (dead ? 6 : 0);
  parts.push({ kind: 'ball', c: S(0, 0, z + 1), r: 7 * k, color: CHITIN, squash: 0.75 });
  // Swollen acid sac that contracts when it fires.
  const squeeze = anim === 'attack' ? (frame === 1 ? 0.75 : 1.1) : 1 + (anim === 'idle' && frame === 1 ? 0.05 : 0);
  parts.push({ kind: 'ball', c: S(-3, 0, z + 7), r: 5.6 * k * squeeze, color: 0x6ab030, squash: 0.9 });
  parts.push({ kind: 'ball', c: S(-3.5, -1.5, z + 8.5), r: 2.2 * k * squeeze, color: 0xc8ff70, emissive: !dead });
  // Mortar-like throat tube.
  const tube = S(6, 0, z + 9);
  parts.push({ kind: 'limb', a: S(3, 0, z + 3), b: tube, r: 2.3 * k, color: FLESH });
  parts.push({ kind: 'ball', c: tube, r: 2.6 * k, color: CHITIN_D });
  if (anim === 'attack' && frame === 1) parts.push({ kind: 'glow', c: add(tube, S(1, 0, 3)), r: 12 * k, color: 0x90ff40 });
  const head = S(8.5, 0, z + 1);
  parts.push({ kind: 'ball', c: head, r: 3 * k, color: CHITIN_D });
  for (const side of [-1, 1]) parts.push({ kind: 'ball', c: add(head, S(2, side * 1.4, 0.6)), r: 0.8 * k, color: EYES, emissive: !dead });
  for (const [f, h] of [[-8, 5], [-4, 6], [1, 5]]) parts.push({ kind: 'limb', a: S(f, 0, z + 4), b: S(f - 2, 0, z + 4 + h), r: 0.8 * k, color: BONE });
  const pose = dead ? { roll: Math.min(2, frame) * 0.35 } : anim === 'hit' ? { fall: 0.08 } : {};
  return { parts: charred(parts, dead ? frame / 4 : 0), pose };
}

function titan(anim: AnimName, frame: number): Built {
  const k = 2.35;
  const S = (f: number, s: number, z: number): V3 => v(f * k, s * k, z * k);
  const parts: Part[] = [];
  const dead = anim === 'death';
  const ph = anim === 'walk' ? walkPhase(frame) : 0;
  const swing = anim === 'walk' ? Math.sin(ph) * 0.3 : 0;
  const bob = anim === 'walk' ? Math.abs(Math.cos(ph)) * 1.2 : anim === 'idle' && frame === 1 ? 0.6 : 0;
  for (const side of [-1, 1]) {
    const sw = swing * side;
    const hip = S(-2, side * 6.5, 18 + bob);
    const knee = S(2 + Math.sin(sw) * 6, side * 8, 9 + bob * 0.5);
    const foot = S(Math.sin(sw) * 9, side * 8, 0);
    parts.push({ kind: 'limb', a: hip, b: knee, r: 4.4 * k, color: FLESH });
    parts.push({ kind: 'limb', a: knee, b: foot, r: 3.6 * k, color: CHITIN });
    for (const t of [-1, 0, 1]) parts.push({ kind: 'limb', a: add(foot, S(1, t * 1.6, 0.8)), b: add(foot, S(4.5, t * 2.2, 0)), r: 0.9 * k, color: BONE });
  }
  const z = bob;
  parts.push({ kind: 'ball', c: S(-2, 0, 20 + z), r: 8 * k, color: CHITIN, squash: 0.85 });
  parts.push({ kind: 'ball', c: S(3, 0, 29 + z), r: 10.5 * k, color: FLESH, squash: 0.9 });
  parts.push({ kind: 'ball', c: S(-3, 0, 34 + z), r: 8 * k, color: CHITIN, squash: 0.8 });
  for (const [f, zz] of [[-7, 32], [-2, 37], [3, 36], [-9, 27]]) parts.push({ kind: 'box', c: S(f, 0, zz + z), h: S(3.2, 7.5, 1.3), color: CHITIN_D, pitch: -0.3 });
  // Crest of dorsal spines glowing with psychic fire.
  for (const [f, zz, h] of [[-9, 37, 11], [-4, 40, 13], [1, 39, 11], [-12, 31, 8], [5, 36, 8]]) {
    parts.push({ kind: 'limb', a: S(f, 0, zz + z), b: S(f - 3, 0, zz + h + z), r: 1.3 * k, color: BONE });
  }
  const head = S(13, 0, 29 + z);
  parts.push({ kind: 'ball', c: head, r: 5 * k, color: CHITIN_D });
  parts.push({ kind: 'box', c: add(head, S(3, 0, -3)), h: S(2.6, 3, 1.2), color: BONE });
  for (const side of [-1, 1]) {
    parts.push({ kind: 'ball', c: add(head, S(3, side * 2, 1.4)), r: 1.3 * k, color: PSY, emissive: !dead });
    parts.push({ kind: 'limb', a: add(head, S(0, side * 3.4, 2)), b: add(head, S(-4, side * 6, 8)), r: 1.2 * k, color: BONE });
  }
  // Four scythe arms: the upper pair rises and the lower pair sweeps when striking.
  const up = anim === 'attack' && frame === 0;
  const slam = anim === 'attack' && frame === 1;
  for (const [lvl, zz] of [[0, 31], [1, 23]] as [number, number][]) {
    for (const side of [-1, 1]) {
      const sh = S(5, side * 11, zz + z);
      const hand = up && lvl === 0 ? S(7, side * 12, 46) : slam ? S(22 - lvl * 4, side * (9 + lvl * 3), 6 + lvl * 3) : S(12 + swing * side * 3, side * (13 + lvl * 2), 12 + z - lvl * 3);
      const elbow = v((sh.f + hand.f) / 2 - 2 * k, sh.s + side * 3 * k, (sh.z + hand.z) / 2);
      parts.push({ kind: 'limb', a: sh, b: elbow, r: (3.4 - lvl * 0.8) * k, color: FLESH });
      parts.push({ kind: 'limb', a: elbow, b: hand, r: (2.8 - lvl * 0.7) * k, color: CHITIN });
      const tip = add(hand, up && lvl === 0 ? S(4, 0, 12) : slam ? S(9, 0, -3) : S(8, 0, -9));
      parts.push({ kind: 'limb', a: hand, b: tip, r: (1.4 - lvl * 0.3) * k, color: BONE });
    }
  }
  if (slam) parts.push({ kind: 'glow', c: S(26, 0, 4), r: 18 * k, color: PSY });
  const pose = dead ? { fall: -Math.min(1.5, frame * 0.5), roll: frame * 0.1 } : anim === 'hit' ? { fall: 0.06 } : {};
  return { parts: charred(parts, dead ? frame / 4 : 0), pose };
}

export const BUGGY_MODEL: UnitModel = { cellW: 120, cellH: 96, anchorX: 60, anchorY: 60, build: buggy };
export const APC_MODEL: UnitModel = { cellW: 140, cellH: 104, anchorX: 70, anchorY: 64, build: apc };
export const TANK_MODEL: UnitModel = {
  cellW: 176, cellH: 120, anchorX: 88, anchorY: 72, build: tankHull, turret: tankTurret,
};
export const ARTILLERY_MODEL: UnitModel = { cellW: 150, cellH: 140, anchorX: 75, anchorY: 88, build: artillery };
export const SKIMMER_MODEL: UnitModel = { cellW: 160, cellH: 124, anchorX: 80, anchorY: 72, build: skimmer };
export const CARRIER_MODEL: UnitModel = { cellW: 180, cellH: 130, anchorX: 90, anchorY: 80, build: carrier };
export const SIEGEBEAST_MODEL: UnitModel = { cellW: 180, cellH: 170, anchorX: 90, anchorY: 108, build: siegebeast };
export const TITAN_MODEL: UnitModel = { cellW: 250, cellH: 290, anchorX: 125, anchorY: 170, build: titan };
