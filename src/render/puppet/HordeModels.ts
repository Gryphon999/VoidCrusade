import { Part, V3, v } from './Puppet3D';
import { AnimName, DEATH_FALL, UnitModel, walkPhase } from './Models';

const CHITIN = 0x5a1f4e;
const CHITIN_D = 0x2c0c26;
const FLESH = 0x7a2a48;
const BONE = 0xdcd0b0;
const EYES = 0x9dff5a;
const EYES_B = 0xd060ff;

function add(a: V3, b: V3): V3 {
  return v(a.f + b.f, a.s + b.s, a.z + b.z);
}

function crawler(anim: AnimName, frame: number): { parts: Part[]; pose: { fall?: number; roll?: number; lift?: number } } {
  const k = 1.65;
  const S = (f: number, s: number, z: number): V3 => v(f * k, s * k, z * k);
  const parts: Part[] = [];
  const ph = anim === 'walk' ? walkPhase(frame) : anim === 'idle' ? frame * 0.6 : 0;
  const lunge = anim === 'attack' ? (frame === 1 ? 3 : 1) : 0;
  const bob = anim === 'walk' ? Math.abs(Math.sin(ph)) * 0.8 : anim === 'idle' && frame === 1 ? 0.4 : 0;
  const dead = anim === 'death';
  const curl = dead ? frame / 3 : 0;
  // Six legs in two alternating tripods.
  [-2.5, 0.5, 3.5].forEach((f, i) => {
    for (const side of [-1, 1]) {
      const tri = (i % 2 === 0) === side > 0 ? 0 : Math.PI;
      const stride = anim === 'walk' ? Math.sin(ph + tri) * 3.2 : 0;
      const raise = anim === 'walk' ? Math.max(0, Math.cos(ph + tri)) * 2 : 0;
      const hip = S(f, side * 3, 8 + bob);
      const knee = S(f + stride * 0.5 + (i - 1) * 1.5, side * (9 - curl * 4), 12 + raise - curl * 2);
      const foot = S(f + stride + (i - 1) * 3, side * (12 - curl * 7), raise + curl * 9);
      parts.push({ kind: 'limb', a: hip, b: knee, r: 1.1 * k, color: CHITIN_D });
      parts.push({ kind: 'limb', a: knee, b: foot, r: 0.8 * k, color: BONE });
    }
  });
  const z = 8 + bob;
  parts.push({ kind: 'ball', c: S(-6.5, 0, z - 0.5), r: 5.8 * k, color: CHITIN, squash: 0.78 });
  parts.push({ kind: 'ball', c: S(0, 0, z + 0.5), r: 4.6 * k, color: FLESH, squash: 0.85 });
  const head = S(5.5 + lunge, 0, z + 0.8);
  parts.push({ kind: 'ball', c: head, r: 3.6 * k, color: CHITIN_D });
  const open = anim === 'attack' ? 1.4 : 0.5;
  for (const side of [-1, 1]) {
    parts.push({ kind: 'limb', a: add(head, S(2, side * 1.6, -0.6)), b: add(head, S(5.4, side * open, -1.2)), r: 0.75 * k, color: BONE });
    parts.push({ kind: 'ball', c: add(head, S(2.6, side * 1.6, 0.9)), r: 0.95 * k, color: EYES, emissive: true });
  }
  if (anim === 'attack' && frame === 1) parts.push({ kind: 'glow', c: add(head, S(6, 0, -0.5)), r: 7 * k, color: 0x80ff40 });
  // Dorsal bone spines.
  for (const [f0, zz, f1, z1] of [[-9, 10, -12, 13], [-6, 12, -8, 17], [-2, 12, -3, 16], [1.5, 11, 1, 14]]) {
    parts.push({ kind: 'limb', a: S(f0, 0, zz + bob), b: S(f1, 0, z1 + bob), r: 0.9 * k, color: BONE });
  }
  const pose = dead ? { roll: frame >= 2 ? Math.PI * 0.85 * ((frame - 1) / 2) : 0, lift: -curl * 2 } : anim === 'hit' ? { fall: 0.15 } : {};
  return { parts, pose };
}

function behemoth(anim: AnimName, frame: number): { parts: Part[]; pose: { fall?: number; roll?: number; lift?: number } } {
  const k = 2.15;
  const S = (f: number, s: number, z: number): V3 => v(f * k, s * k, z * k);
  const parts: Part[] = [];
  const ph = anim === 'walk' ? walkPhase(frame) : 0;
  const swing = anim === 'walk' ? Math.sin(ph) * 0.35 : 0;
  const bob = anim === 'walk' ? Math.abs(Math.cos(ph)) * 1.4 : anim === 'idle' && frame === 1 ? 0.7 : 0;
  for (const side of [-1, 1]) {
    const sw = swing * side;
    const hip = S(-2, side * 6, 16 + bob);
    const knee = S(1 + Math.sin(sw) * 6, side * 7.5, 8 + bob * 0.5);
    const foot = S(-1 + Math.sin(sw) * 9, side * 7.5, 0);
    parts.push({ kind: 'limb', a: hip, b: knee, r: 4.2 * k, color: FLESH });
    parts.push({ kind: 'limb', a: knee, b: foot, r: 3.4 * k, color: CHITIN });
    for (const t of [-1, 0, 1]) parts.push({ kind: 'limb', a: add(foot, S(1, t * 1.5, 0.8)), b: add(foot, S(4, t * 2, 0)), r: 0.8 * k, color: BONE });
  }
  const z = bob;
  parts.push({ kind: 'ball', c: S(-2, 0, 18 + z), r: 7.5 * k, color: CHITIN, squash: 0.85 });
  parts.push({ kind: 'ball', c: S(3, 0, 26 + z), r: 10 * k, color: FLESH, squash: 0.9 });
  parts.push({ kind: 'ball', c: S(-3, 0, 31 + z), r: 7.2 * k, color: CHITIN, squash: 0.8 });
  // Chitin armour plates over the back.
  for (const [f, zz] of [[-6, 29], [-1, 33], [4, 33]]) {
    parts.push({ kind: 'box', c: S(f, 0, zz + z), h: S(3, 6.5, 1.2), color: CHITIN_D, pitch: -0.3 });
  }
  const head = S(12, 0, 26 + z);
  parts.push({ kind: 'ball', c: head, r: 4.6 * k, color: CHITIN_D });
  parts.push({ kind: 'box', c: add(head, S(2.5, 0, -2.8)), h: S(2.4, 2.6, 1), color: BONE });
  for (const side of [-1, 1]) {
    parts.push({ kind: 'ball', c: add(head, S(2.8, side * 1.9, 1.2)), r: 1.2 * k, color: EYES_B, emissive: true });
    parts.push({ kind: 'limb', a: add(head, S(0, side * 3, 2)), b: add(head, S(-3, side * 5, 6)), r: 1 * k, color: BONE });
  }
  // Arms ending in bone scythes; raised then slammed down when attacking.
  const up = anim === 'attack' && frame === 0;
  const slam = anim === 'attack' && frame === 1;
  for (const side of [-1, 1]) {
    const sh = S(4, side * 10, 29 + z);
    const hand = up ? S(6, side * 11, 42) : slam ? S(20, side * 8, 5) : S(12 + swing * side * 3, side * 12, 11 + z);
    const elbow = v((sh.f + hand.f) / 2 - 2 * k, sh.s + side * 3 * k, (sh.z + hand.z) / 2);
    parts.push({ kind: 'limb', a: sh, b: elbow, r: 3.4 * k, color: FLESH });
    parts.push({ kind: 'limb', a: elbow, b: hand, r: 2.8 * k, color: CHITIN });
    const tip = add(hand, up ? S(4, 0, 12) : slam ? S(9, 0, -3) : S(8, 0, -9));
    parts.push({ kind: 'limb', a: hand, b: tip, r: 1.3 * k, color: BONE });
  }
  if (slam) parts.push({ kind: 'glow', c: S(24, 0, 3), r: 14 * k, color: 0xd060ff });
  for (const [f, zz, h] of [[-8, 34, 8], [-3, 37, 9], [2, 36, 7], [-11, 28, 6]]) {
    parts.push({ kind: 'limb', a: S(f, 0, zz + z), b: S(f - 3, 0, zz + h + z), r: 1.2 * k, color: BONE });
  }
  const pose = anim === 'death' ? { fall: -DEATH_FALL[frame] * 0.95 } : anim === 'hit' ? { fall: 0.12 } : {};
  return { parts, pose };
}

export const CRAWLER_MODEL: UnitModel = { cellW: 96, cellH: 72, anchorX: 48, anchorY: 48, build: crawler };
export const BEHEMOTH_MODEL: UnitModel = { cellW: 210, cellH: 205, anchorX: 105, anchorY: 118, build: behemoth };
