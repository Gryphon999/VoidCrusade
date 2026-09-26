import { Part, V3, v } from './Puppet3D';
import { AnimName, DEATH_FALL, UnitModel, walkPhase } from './Models';

const CHITIN = 0x5a1f4e;
const CHITIN_D = 0x2c0c26;
const FLESH = 0x7a2a48;
const BONE = 0xdcd0b0;
const EYES = 0x9dff5a;
const EYES_B = 0xd060ff;
const ACID_GLOW = 0xc0ff60;

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

type Built = { parts: Part[]; pose: { fall?: number; roll?: number; lift?: number } };

/** Spitter: four-legged beast with a glowing acid sac and a long neck that lobs bile. */
function spitter(anim: AnimName, frame: number): Built {
  const k = 1.55;
  const S = (f: number, s: number, z: number): V3 => v(f * k, s * k, z * k);
  const parts: Part[] = [];
  const ph = anim === 'walk' ? walkPhase(frame) : frame * 0.7;
  const bob = anim === 'walk' ? Math.abs(Math.sin(ph)) * 0.8 : anim === 'idle' && frame === 1 ? 0.5 : 0;
  const heave = anim === 'attack' ? (frame === 1 ? 2.2 : -1.2) : 0;
  for (const [f, side, off] of [[3, -1, 0], [3, 1, Math.PI], [-4, -1, Math.PI], [-4, 1, 0]] as [number, number, number][]) {
    const stride = anim === 'walk' ? Math.sin(ph + off) * 3 : 0;
    const raise = anim === 'walk' ? Math.max(0, Math.cos(ph + off)) * 2 : 0;
    const hip = S(f, side * 3.5, 7 + bob);
    const knee = S(f + stride * 0.4, side * 7.5, 8.5 + raise);
    const ankle = S(f + stride * 0.8, side * 9.5, 2 + raise * 0.6);
    const foot = S(f + stride + 1.2, side * 9.8, raise * 0.3);
    parts.push({ kind: 'limb', a: hip, b: knee, r: 1.3 * k, color: CHITIN_D });
    parts.push({ kind: 'limb', a: knee, b: ankle, r: 1 * k, color: CHITIN });
    parts.push({ kind: 'limb', a: ankle, b: foot, r: 0.7 * k, color: BONE });
  }
  const z = 7 + bob;
  parts.push({ kind: 'ball', c: S(-2, 0, z + 1), r: 5.2 * k, color: CHITIN, squash: 0.8 });
  // Translucent acid sac on the back.
  parts.push({ kind: 'ball', c: S(-4, 0, z + 6 + heave * 0.3), r: 4.6 * k, color: 0x6ac030, squash: 0.9 });
  parts.push({ kind: 'ball', c: S(-4.5, -1, z + 7.5 + heave * 0.3), r: 1.8 * k, color: ACID_GLOW, emissive: true });
  // Neck and head rear back, then snap forward to spit.
  const neckTop = S(4 + heave, 0, z + 9 - heave * 0.6);
  parts.push({ kind: 'limb', a: S(2, 0, z + 2), b: neckTop, r: 2 * k, color: FLESH });
  parts.push({ kind: 'ball', c: neckTop, r: 2.8 * k, color: CHITIN_D });
  for (const side of [-1, 1]) parts.push({ kind: 'ball', c: add(neckTop, S(1.8, side * 1.2, 0.8)), r: 0.8 * k, color: EYES, emissive: true });
  parts.push({ kind: 'limb', a: add(neckTop, S(1.5, 0, -1)), b: add(neckTop, S(4, 0, -2 + heave * 0.4)), r: 1 * k, color: BONE });
  if (anim === 'attack' && frame === 1) parts.push({ kind: 'glow', c: add(neckTop, S(5.5, 0, -1.5)), r: 8 * k, color: 0x90ff40 });
  for (const [f0, f1] of [[-6, -8], [-2, -3], [1, 1.5]]) parts.push({ kind: 'limb', a: S(f0, 0, z + 4), b: S(f1, 0, z + 8), r: 0.7 * k, color: BONE });
  const dead = anim === 'death';
  const pose = dead ? { roll: Math.PI * 0.8 * Math.min(1, frame / 2), lift: -frame * 0.8 } : anim === 'hit' ? { fall: 0.15 } : {};
  return { parts, pose };
}

/** Leaper: raptor-like biped with digitigrade legs, a whip tail and two bone scythes. */
function leaper(anim: AnimName, frame: number): Built {
  const k = 1.7;
  const S = (f: number, s: number, z: number): V3 => v(f * k, s * k, z * k);
  const parts: Part[] = [];
  const ph = anim === 'walk' ? walkPhase(frame) : 0;
  const bound = anim === 'walk' ? Math.max(0, Math.sin(ph * 2)) * 2.4 : 0;
  const crouch = anim === 'attack' && frame === 0 ? -2.5 : anim === 'idle' && frame === 1 ? -0.6 : 0;
  const z = 15 + bound + crouch;
  for (const side of [-1, 1]) {
    const sw = anim === 'walk' ? Math.sin(ph) * 0.6 * side : 0;
    const hip = S(-1, side * 3, z);
    const knee = add(hip, S(4 + Math.sin(sw) * 4, side * 0.8, -6 - crouch * 0.3));
    const ankle = add(knee, S(-5 + Math.sin(sw) * 2, 0, -5.5 - crouch * 0.4));
    const foot = S(ankle.f / k + 2.5, side * 3.4, 0);
    parts.push({ kind: 'limb', a: hip, b: knee, r: 2 * k, color: FLESH });
    parts.push({ kind: 'limb', a: knee, b: ankle, r: 1.2 * k, color: CHITIN_D });
    parts.push({ kind: 'limb', a: ankle, b: foot, r: 1 * k, color: BONE });
  }
  // Tail counterbalance.
  let prev = S(-3, 0, z + 1);
  for (let i = 1; i <= 4; i++) {
    const nxt = S(-3 - i * 3.2, Math.sin(ph + i) * 0.8, z + 1 - i * 0.6 + (anim === 'attack' ? i * 0.4 : 0));
    parts.push({ kind: 'limb', a: prev, b: nxt, r: (1.6 - i * 0.3) * k, color: i % 2 ? CHITIN : CHITIN_D });
    prev = nxt;
  }
  parts.push({ kind: 'ball', c: S(0, 0, z + 2), r: 4.2 * k, color: CHITIN, squash: 0.78 });
  parts.push({ kind: 'ball', c: S(3.5, 0, z + 3.5), r: 3.4 * k, color: FLESH, squash: 0.85 });
  const head = S(7 + (anim === 'attack' && frame === 1 ? 2 : 0), 0, z + 5.5);
  parts.push({ kind: 'ball', c: head, r: 2.4 * k, color: CHITIN_D });
  parts.push({ kind: 'limb', a: head, b: add(head, S(-2.5, 0, 3)), r: 0.8 * k, color: BONE });
  for (const side of [-1, 1]) {
    parts.push({ kind: 'ball', c: add(head, S(1.6, side * 1, 0.4)), r: 0.7 * k, color: EYES_B, emissive: true });
    // Scythe arms: raised back to strike, slash forward.
    const sh = S(4, side * 3.4, z + 4);
    const raised = anim === 'attack' && frame === 0;
    const slash = anim === 'attack' && frame === 1;
    const el = add(sh, raised ? S(-1, side * 1.5, 5) : slash ? S(4, side * 1, -1) : S(2, side * 1.5, -1.5));
    const tip = add(el, raised ? S(4, 0, 5) : slash ? S(7, -side * 1.2, -3) : S(5, 0, -3));
    parts.push({ kind: 'limb', a: sh, b: el, r: 1.1 * k, color: FLESH });
    parts.push({ kind: 'limb', a: el, b: tip, r: 0.8 * k, color: BONE });
  }
  if (anim === 'attack' && frame === 1) parts.push({ kind: 'glow', c: S(12, 0, z + 1), r: 7 * k, color: 0xd060ff });
  const pose = anim === 'death' ? { fall: -DEATH_FALL[frame] * 0.9, roll: frame * 0.2 } : anim === 'hit' ? { fall: 0.18 } : {};
  return { parts, pose };
}

/** Burrower: armoured segmented borer with drill mandibles; undulates as it moves. */
function burrower(anim: AnimName, frame: number): Built {
  const k = 1.7;
  const S = (f: number, s: number, z: number): V3 => v(f * k, s * k, z * k);
  const parts: Part[] = [];
  const ph = anim === 'walk' ? walkPhase(frame) : frame * 0.5;
  const rear = anim === 'attack' ? (frame === 0 ? 7 : 3) : anim === 'idle' ? 2 + (frame === 1 ? 0.8 : 0) : 1.5;
  const segs = 6;
  for (let i = segs - 1; i >= 0; i--) {
    const f = 6 - i * 3.4;
    const wave = Math.sin(ph - i * 0.9) * 1.4;
    const zz = 4 + (i === 0 ? rear : i === 1 ? rear * 0.5 : 0) + Math.max(0, Math.sin(ph - i)) * 0.8;
    const r = (4.6 - i * 0.45) * k;
    parts.push({ kind: 'ball', c: S(f, wave, zz), r, color: i % 2 ? CHITIN : 0x3a2436, squash: 0.85 });
    // Armour ridge plate on each segment.
    parts.push({ kind: 'box', c: S(f, wave, zz + r / k * 0.8), h: S(1.2, (3.6 - i * 0.35), 0.6), color: 0x6a5a78, pitch: -0.2 });
    // Little legs.
    if (i > 0 && i < segs - 1) {
      for (const side of [-1, 1]) {
        parts.push({ kind: 'limb', a: S(f, wave + side * 3, zz - 1), b: S(f + Math.sin(ph + i) * 1.2, wave + side * 5.5, 0), r: 0.6 * k, color: BONE });
      }
    }
  }
  const head = S(9, Math.sin(ph) * 1.4, 4 + rear + 1);
  parts.push({ kind: 'ball', c: head, r: 3.4 * k, color: CHITIN_D });
  const open = anim === 'attack' ? 1.8 : 0.9;
  for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
    const sp = Math.cos(a) * open;
    const zp = Math.sin(a) * open;
    parts.push({ kind: 'limb', a: add(head, S(1.5, sp, zp)), b: add(head, S(5, sp * 1.6, zp * 1.6)), r: 0.8 * k, color: BONE });
  }
  parts.push({ kind: 'ball', c: add(head, S(1.2, 0, 1.8)), r: 0.9 * k, color: EYES, emissive: true });
  if (anim === 'attack' && frame === 1) parts.push({ kind: 'glow', c: add(head, S(5, 0, 0)), r: 8 * k, color: 0xd060ff });
  const pose = anim === 'death' ? { roll: Math.PI * 0.9 * Math.min(1, frame / 2.5), lift: -frame } : anim === 'hit' ? { fall: 0.12 } : {};
  return { parts, pose };
}

/** Brood-shaman: hunched robed biped with a bone crest, staff and floating spirit orbs. */
function shaman(anim: AnimName, frame: number): Built {
  const k = 1.5;
  const S = (f: number, s: number, z: number): V3 => v(f * k, s * k, z * k);
  const parts: Part[] = [];
  const ph = anim === 'walk' ? walkPhase(frame) : 0;
  const bob = anim === 'walk' ? Math.abs(Math.cos(ph)) * 0.7 : anim === 'idle' && frame === 1 ? 0.4 : 0;
  for (const side of [-1, 1]) {
    const sw = anim === 'walk' ? Math.sin(ph) * 0.45 * side : 0;
    const hip = S(-1, side * 2.8, 12 + bob);
    const knee = add(hip, S(3 + Math.sin(sw) * 4, 0, -5.5));
    const foot = add(knee, S(-2 + Math.sin(sw) * 3, 0, -6.5));
    parts.push({ kind: 'limb', a: hip, b: knee, r: 1.7 * k, color: FLESH });
    parts.push({ kind: 'limb', a: knee, b: foot, r: 1.2 * k, color: CHITIN_D });
  }
  const z = bob;
  // Ragged robe of skin.
  parts.push({ kind: 'box', c: S(-1, 0, 13 + z), h: S(3.6, 4.2, 5), color: 0x4a2a3a, pitch: 0.15 });
  parts.push({ kind: 'ball', c: S(0, 0, 18 + z), r: 4.4 * k, color: CHITIN, squash: 0.85 });
  parts.push({ kind: 'ball', c: S(2.5, 0, 22.5 + z), r: 3 * k, color: FLESH });
  const head = S(4.5, 0, 25 + z);
  parts.push({ kind: 'ball', c: head, r: 2.6 * k, color: CHITIN_D });
  for (const [f, s2, zz] of [[-2, -2.5, 4], [-2.5, 0, 5], [-2, 2.5, 4], [-3, -1.3, 3], [-3, 1.3, 3]]) {
    parts.push({ kind: 'limb', a: head, b: add(head, S(f, s2, zz)), r: 0.6 * k, color: BONE });
  }
  for (const side of [-1, 1]) parts.push({ kind: 'ball', c: add(head, S(1.8, side * 1, 0.3)), r: 0.7 * k, color: EYES_B, emissive: true });
  // Staff raised when casting.
  const cast = anim === 'attack';
  const hand = cast ? S(5, 4, 26 + z) : S(5, 4, 17 + z);
  parts.push({ kind: 'limb', a: S(1, 3.8, 21 + z), b: hand, r: 1 * k, color: FLESH });
  const top = add(hand, S(0.5, 0, cast ? 12 : 10));
  parts.push({ kind: 'limb', a: add(hand, S(0, 0, -8)), b: top, r: 0.7 * k, color: BONE });
  parts.push({ kind: 'ball', c: top, r: 1.6 * k, color: 0xd070ff, emissive: true });
  if (cast && frame === 1) parts.push({ kind: 'glow', c: top, r: 14 * k, color: 0xc050ff });
  // Orbiting spirit motes.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + frame * 0.9;
    parts.push({ kind: 'glow', c: S(Math.cos(a) * 7, Math.sin(a) * 7, 22 + z + Math.sin(a * 2) * 2), r: 3 * k, color: 0x90ff60 });
  }
  const pose = anim === 'death' ? { fall: -DEATH_FALL[frame] } : anim === 'hit' ? { fall: 0.15 } : {};
  return { parts, pose };
}

/** Null Overlord: towering armoured tyrant with a horned crown, bone wings and psychic fire. */
function overlord(anim: AnimName, frame: number): Built {
  const k = 1.95;
  const S = (f: number, s: number, z: number): V3 => v(f * k, s * k, z * k);
  const parts: Part[] = [];
  const ph = anim === 'walk' ? walkPhase(frame) : 0;
  const swing = anim === 'walk' ? Math.sin(ph) * 0.5 : 0;
  const bob = anim === 'walk' ? Math.abs(Math.cos(ph)) * 1 : anim === 'idle' && frame === 1 ? 0.5 : 0;
  for (const side of [-1, 1]) {
    const sw = swing * side;
    const hip = S(0, side * 3.8, 15 + bob);
    const knee = add(hip, S(Math.sin(sw) * 7 + 1, side * 0.4, -7.5));
    const foot = add(knee, S(Math.sin(sw - 0.4) * 6 - 1, 0, -7.5));
    parts.push({ kind: 'limb', a: hip, b: knee, r: 2.8 * k, color: FLESH });
    parts.push({ kind: 'limb', a: knee, b: foot, r: 2.2 * k, color: CHITIN });
    parts.push({ kind: 'box', c: add(foot, S(1.6, 0, 0.8)), h: S(3, 1.8, 1), color: CHITIN_D });
    parts.push({ kind: 'ball', c: knee, r: 2 * k, color: CHITIN_D });
  }
  const z = bob;
  parts.push({ kind: 'ball', c: S(0, 0, 18 + z), r: 4.8 * k, color: CHITIN_D, squash: 0.9 });
  parts.push({ kind: 'ball', c: S(0.5, 0, 24 + z), r: 6.2 * k, color: CHITIN, squash: 0.9 });
  // Chest carapace with a glowing core.
  parts.push({ kind: 'box', c: S(4.2, 0, 24.5 + z), h: S(0.8, 4.4, 4), color: 0x6a3a78 });
  parts.push({ kind: 'ball', c: S(5.2, 0, 25 + z), r: 1.4 * k, color: 0xe080ff, emissive: true });
  // Bone wings.
  const flap = anim === 'walk' ? Math.sin(ph) * 0.15 : anim === 'attack' ? 0.35 : 0;
  for (const side of [-1, 1]) {
    const root = S(-3.5, side * 3.5, 28 + z);
    const mid = add(root, S(-4, side * 8, 7 + flap * 10));
    const tip = add(mid, S(-2, side * 6, 5 + flap * 6));
    parts.push({ kind: 'limb', a: root, b: mid, r: 1.1 * k, color: BONE });
    parts.push({ kind: 'limb', a: mid, b: tip, r: 0.8 * k, color: BONE });
    parts.push({ kind: 'box', c: add(root, S(-3.5, side * 7, 2 + flap * 5)), h: S(0.3, 6.5, 4.5), color: 0x3a1430, roll: side * (0.35 + flap) });
  }
  // Head with horned crown.
  const head = S(2, 0, 33 + z);
  parts.push({ kind: 'ball', c: head, r: 3.4 * k, color: CHITIN_D });
  for (const [f, s2, zz] of [[-1, -2.5, 5], [0.5, -1.2, 6], [0.5, 1.2, 6], [-1, 2.5, 5], [-2.5, 0, 5.5]]) {
    parts.push({ kind: 'limb', a: add(head, S(0, s2 * 0.4, 1.5)), b: add(head, S(f, s2, zz)), r: 0.7 * k, color: BONE });
  }
  for (const side of [-1, 1]) parts.push({ kind: 'ball', c: add(head, S(2.6, side * 1.3, 0.4)), r: 0.9 * k, color: EYES_B, emissive: true });
  // Arms: a bone scythe and a hand wreathed in psychic fire.
  const cast = anim === 'attack';
  const shR = S(1, 6.8, 27 + z);
  const handR = cast && frame === 0 ? S(2, 8, 38 + z) : cast ? S(12, 6, 26 + z) : S(6, 8, 18 + z);
  parts.push({ kind: 'limb', a: shR, b: handR, r: 2 * k, color: FLESH });
  parts.push({ kind: 'limb', a: handR, b: add(handR, cast && frame === 0 ? S(5, 0, 9) : S(8, 0, -6)), r: 1.2 * k, color: BONE });
  const shL = S(1, -6.8, 27 + z);
  const handL = cast ? S(11, -5, 27 + z) : S(6, -8, 19 + z);
  parts.push({ kind: 'limb', a: shL, b: handL, r: 2 * k, color: FLESH });
  parts.push({ kind: 'glow', c: handL, r: (cast && frame === 1 ? 16 : 7) * k, color: 0xc050ff });
  parts.push({ kind: 'ball', c: handL, r: 1.3 * k, color: 0xf0c0ff, emissive: true });
  const pose = anim === 'death' ? { fall: -DEATH_FALL[frame] * 0.95 } : anim === 'hit' ? { fall: 0.12 } : {};
  return { parts, pose };
}

export const SPITTER_MODEL: UnitModel = { cellW: 104, cellH: 96, anchorX: 52, anchorY: 58, build: spitter };
export const LEAPER_MODEL: UnitModel = { cellW: 128, cellH: 104, anchorX: 64, anchorY: 66, build: leaper };
export const BURROWER_MODEL: UnitModel = { cellW: 124, cellH: 90, anchorX: 62, anchorY: 56, build: burrower };
export const SHAMAN_MODEL: UnitModel = { cellW: 104, cellH: 124, anchorX: 52, anchorY: 74, build: shaman };
export const OVERLORD_MODEL: UnitModel = { cellW: 180, cellH: 196, anchorX: 90, anchorY: 120, build: overlord };

export const CRAWLER_MODEL: UnitModel = { cellW: 96, cellH: 72, anchorX: 48, anchorY: 48, build: crawler };
export const BEHEMOTH_MODEL: UnitModel = { cellW: 210, cellH: 205, anchorX: 105, anchorY: 118, build: behemoth };
