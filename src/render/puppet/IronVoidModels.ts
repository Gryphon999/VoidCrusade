import { Part, V3, v } from './Puppet3D';
import { AnimName, DEATH_FALL, UnitModel, walkPhase } from './Models';

interface Style {
  sc: number;
  bulk: number;
  pad: number;
  armor: number;
  dark: number;
  team: number;
  trim: number;
  visor: number;
  weapon: 'rifle' | 'heavy' | 'sword' | 'longrifle' | 'flamer' | 'sniper' | 'tool';
  crest?: number;
  cape?: number;
  banner?: boolean;
  /** Cloth hood instead of a helmet crest (scouts, snipers). */
  hood?: number;
  /** Rebreather mask and twin fuel tanks (flamer troops). */
  tanks?: boolean;
  /** Servo-arm over the shoulder (engineers). */
  servo?: boolean;
  /** Kneels to fire (snipers). */
  kneel?: boolean;
}

const IRON = { armor: 0x5b6574, dark: 0x262a31, team: 0x2f63c8, trim: 0xc9a044, visor: 0x7ff0ff };

function add(a: V3, b: V3): V3 {
  return v(a.f + b.f, a.s + b.s, a.z + b.z);
}

/** Builds an armoured humanoid for a given animation frame. */
function humanoid(st: Style, anim: AnimName, frame: number): { parts: Part[]; pose: { fall?: number; lift?: number } } {
  const k = st.sc;
  const S = (f: number, s: number, z: number): V3 => v(f * k, s * k, z * k);
  const parts: Part[] = [];
  const B = st.bulk;
  let swing = 0;
  let bob = 0;
  let lookYaw = 0;
  let breathe = 0;
  let fall = 0;
  let recoil = 0;
  let flash = false;
  if (anim === 'walk') {
    const ph = walkPhase(frame);
    swing = Math.sin(ph) * 0.55;
    bob = Math.abs(Math.cos(ph)) * 0.9;
  } else if (anim === 'idle') {
    breathe = frame === 1 ? 0.5 : 0;
    lookYaw = frame === 2 ? 0.7 : 0;
  } else if (anim === 'attack') {
    recoil = frame === 1 ? -1.6 : 0;
    flash = frame === 1;
    if (st.weapon === 'flamer') recoil *= 0.3;
  } else if (anim === 'hit') {
    fall = 0.2;
  } else if (anim === 'death') {
    fall = DEATH_FALL[frame];
    swing = -0.15 * frame;
  }
  const kneeling = !!st.kneel && anim === 'attack';
  const lift = bob + breathe * 0.4 - (kneeling ? 4.5 : 0);
  // Legs.
  for (const side of [-1, 1]) {
    const sw = swing * side;
    const hip = S(0, side * 3.1 * B, 14 + (kneeling ? -4.5 : 0));
    // Kneeling: right knee down, left leg planted forward.
    const kneeSw = kneeling ? (side > 0 ? -1.2 : 1.1) : sw;
    const knee = add(hip, S(Math.sin(kneeSw) * 7, 0, -Math.cos(kneeSw) * 7 * (kneeling ? 0.55 : 1)));
    const bend = kneeling ? (side > 0 ? 2.4 : 1.6) : Math.max(0, -sw) * 1.1 + 0.12;
    const foot = add(knee, S(Math.sin(kneeSw - bend) * 7, 0, -Math.cos(kneeSw - bend) * 7 * (kneeling ? 0.5 : 1)));
    parts.push({ kind: 'limb', a: hip, b: knee, r: 2.5 * k * B, color: st.armor });
    parts.push({ kind: 'limb', a: knee, b: foot, r: 2.3 * k * B, color: st.dark });
    parts.push({ kind: 'box', c: add(foot, S(1.2, 0, 1.2)), h: S(2.8, 1.7, 1.3), color: st.dark });
    parts.push({ kind: 'ball', c: knee, r: 1.9 * k * B, color: st.team });
  }
  const up = (z: number): number => z + lift;
  parts.push({ kind: 'box', c: S(0, 0, up(14.6)), h: S(2.6, 4.4 * B, 2), color: st.dark });
  parts.push({ kind: 'box', c: S(0, 0, up(15.9)), h: S(3.9 * B, 5.2 * B, 0.8), color: st.trim });
  // Torso, chest plate and emblem.
  parts.push({ kind: 'box', c: S(0, 0, up(21.5)), h: S(3.7 * B, 5.3 * B, 5.6), color: st.armor });
  parts.push({ kind: 'box', c: S(3.8 * B, 0, up(22.4)), h: S(0.5, 3.6 * B, 3.8), color: st.team });
  parts.push({ kind: 'box', c: S(4.35 * B, 0, up(23.6)), h: S(0.25, 1.9, 1), color: st.trim, emissive: true });
  // Backpack with exhausts.
  parts.push({ kind: 'box', c: S(-5.4 * B, 0, up(22.5)), h: S(2.4, 4.4 * B, 4.8), color: st.dark });
  for (const side of [-1, 1]) {
    parts.push({ kind: 'limb', a: S(-6.2 * B, side * 2.5, up(26)), b: S(-6.8 * B, side * 2.5, up(30)), r: 1 * k, color: 0x3a3a3a });
  }
  if (st.tanks) {
    for (const side of [-1, 1]) {
      parts.push({ kind: 'limb', a: S(-6.3 * B, side * 2.3, up(17.5)), b: S(-6.3 * B, side * 2.3, up(27.5)), r: 2.2 * k, color: 0x6a2a1a });
      parts.push({ kind: 'ball', c: S(-6.3 * B, side * 2.3, up(28)), r: 1.9 * k, color: 0x8a3a22 });
    }
    parts.push({ kind: 'limb', a: S(-5.5 * B, 2.5, up(18)), b: S(4, 3.5, up(17.5)), r: 0.7 * k, color: 0x1a1a1a });
  }
  if (st.servo) {
    const sh = S(-5.6 * B, -2.4, up(27));
    const el = S(-3, -6.5, up(35 + (anim === 'attack' ? 2 : 0)));
    const claw = S(5 + (anim === 'attack' ? 3 : 0), -6.5, up(31));
    parts.push({ kind: 'limb', a: sh, b: el, r: 1.1 * k, color: 0x3a3a3a });
    parts.push({ kind: 'limb', a: el, b: claw, r: 0.95 * k, color: st.trim });
    parts.push({ kind: 'ball', c: el, r: 1.3 * k, color: 0xd8b030 });
    parts.push({ kind: 'limb', a: claw, b: add(claw, S(2, -0.8, -1.5)), r: 0.5 * k, color: 0x9a9a9a });
    parts.push({ kind: 'limb', a: claw, b: add(claw, S(2, 0.8, -1.5)), r: 0.5 * k, color: 0x9a9a9a });
    if (flash) parts.push({ kind: 'glow', c: add(claw, S(2.5, 0, -1.8)), r: 6 * k, color: 0xfff0a0 });
  }
  if (st.cape) {
    parts.push({ kind: 'box', c: S(-4.2 * B, 0, up(16.5)), h: S(0.7, 6.4 * B, 10), color: st.cape, pitch: -0.18 + swing * 0.1 });
  }
  if (st.banner) {
    parts.push({ kind: 'limb', a: S(-6.5, -3, up(18)), b: S(-6.5, -3, up(47)), r: 0.8 * k, color: 0x2a2420 });
    parts.push({ kind: 'box', c: S(-6.5, -6.8, up(41)), h: S(0.3, 3.6, 4.6), color: st.team });
    parts.push({ kind: 'box', c: S(-6.5, -6.8, up(41.5)), h: S(0.35, 1.2, 1.6), color: st.trim, emissive: true });
  }
  // Head: helmet, glowing visor, optional crest.
  const neck = S(0.6, 0, up(29.6));
  parts.push({ kind: 'ball', c: neck, r: 3.4 * k, color: st.armor });
  const visorOff = { f: Math.cos(lookYaw) * 2.8, s: Math.sin(lookYaw) * 2.8 };
  parts.push({ kind: 'box', c: add(neck, S(visorOff.f, visorOff.s, 0.1)), h: S(0.6, 2.2, 0.7), color: st.visor, emissive: true, yaw: lookYaw });
  if (st.crest) parts.push({ kind: 'box', c: add(neck, S(-0.3, 0, 3.4)), h: S(3.4, 0.6, 1.3), color: st.crest });
  if (st.hood) {
    parts.push({ kind: 'ball', c: add(neck, S(-0.8, 0, 0.8)), r: 3.9 * k, color: st.hood, squash: 0.95 });
    parts.push({ kind: 'box', c: add(neck, S(-3, 0, -2.5)), h: S(1.2, 4.2, 3), color: st.hood });
  }
  if (st.tanks) parts.push({ kind: 'box', c: add(neck, S(3, 0, -1.3)), h: S(1, 1.4, 1.1), color: 0x2a2a2a });
  // Shoulder pads with brass rims.
  for (const side of [-1, 1]) {
    parts.push({ kind: 'ball', c: S(0.2, side * 6.2 * B, up(26.3)), r: 3.9 * k * st.pad, color: st.team, squash: 0.85 });
    parts.push({ kind: 'box', c: S(0.2, side * 6.6 * B, up(23.9)), h: S(3.3 * st.pad, 1.0, 0.55), color: st.trim });
  }
  // Arms and weapon.
  const shoulder = (side: number): V3 => S(0.5, side * 5.3 * B, up(25));
  const arm = (side: number, hand: V3): void => {
    const sh = shoulder(side);
    const elbow = v((sh.f + hand.f) / 2 - 1 * k, (sh.s + hand.s) / 2 + side * 1.4 * k, (sh.z + hand.z) / 2 - 2.6 * k);
    parts.push({ kind: 'limb', a: sh, b: elbow, r: 2.1 * k * B, color: st.armor });
    parts.push({ kind: 'limb', a: elbow, b: hand, r: 1.9 * k * B, color: st.dark });
    parts.push({ kind: 'ball', c: hand, r: 1.7 * k * B, color: st.dark });
  };
  const rf = recoil;
  if (st.weapon === 'rifle') {
    arm(1, S(5 + rf, 2.2, up(19.5)));
    arm(-1, S(10 + rf, -0.6, up(21)));
    parts.push({ kind: 'box', c: S(9.5 + rf, 1, up(20.6)), h: S(7.6, 1.15, 1.7), color: 0x1c1e22 });
    parts.push({ kind: 'box', c: S(8.4 + rf, 1, up(18.2)), h: S(1.2, 0.9, 1.5), color: st.trim });
    parts.push({ kind: 'limb', a: S(17 + rf, 1, up(20.9)), b: S(20 + rf, 1, up(20.9)), r: 0.9 * k, color: 0x101010 });
    if (flash) parts.push({ kind: 'glow', c: S(22.5, 1, up(20.9)), r: 7 * k, color: 0xffd070 });
  } else if (st.weapon === 'heavy') {
    arm(1, S(4.5 + rf, 4.6, up(17.2)));
    arm(-1, S(9 + rf, 1.6, up(19)));
    parts.push({ kind: 'box', c: S(9.5 + rf, 3.2, up(17.6)), h: S(8.2, 2.3, 2.7), color: 0x24272c });
    parts.push({ kind: 'box', c: S(3.8 + rf, 5.2, up(16)), h: S(2.6, 1.6, 2.6), color: st.trim });
    for (const o of [-1, 1]) {
      parts.push({ kind: 'limb', a: S(17 + rf, 3.2 + o * 1.1, up(17.9)), b: S(22 + rf, 3.2 + o * 1.1, up(17.9)), r: 1.1 * k, color: 0x101010 });
    }
    if (flash) parts.push({ kind: 'glow', c: S(24.5, 3.2, up(17.9)), r: 10 * k, color: 0xffa040 });
  } else if (st.weapon === 'longrifle' || st.weapon === 'sniper') {
    // Long rifle with a scope; snipers aim from a kneel.
    const long = st.weapon === 'sniper' ? 1.35 : 1.12;
    arm(1, S(4.5 + rf, 2.2, up(20.5)));
    arm(-1, S(11 + rf, -0.5, up(21.5)));
    parts.push({ kind: 'box', c: S(10 + rf, 1, up(21)), h: S(8.4 * long, 1, 1.4), color: 0x2a2620 });
    parts.push({ kind: 'box', c: S(5 + rf, 1, up(20)), h: S(2.2, 0.9, 1.9), color: 0x5a4020 });
    parts.push({ kind: 'box', c: S(9 + rf, 1, up(23)), h: S(2.4, 0.6, 0.6), color: 0x101010 });
    parts.push({ kind: 'ball', c: S(11.4 + rf, 1, up(23)), r: 0.6 * k, color: 0x80e0ff, emissive: true });
    const tip = 10 + 8.4 * long;
    parts.push({ kind: 'limb', a: S(tip + rf, 1, up(21.2)), b: S(tip + 3.5 + rf, 1, up(21.2)), r: 0.6 * k, color: 0x101010 });
    if (flash) parts.push({ kind: 'glow', c: S(tip + 5.5, 1, up(21.2)), r: (st.weapon === 'sniper' ? 9 : 6) * k, color: 0xfff0c0 });
  } else if (st.weapon === 'flamer') {
    arm(1, S(4.5 + rf, 3.6, up(18)));
    arm(-1, S(9.5 + rf, 1.2, up(19.5)));
    parts.push({ kind: 'box', c: S(8.5 + rf, 2.4, up(18.8)), h: S(6.5, 1.5, 1.8), color: 0x3a3430 });
    parts.push({ kind: 'box', c: S(5 + rf, 2.4, up(17.2)), h: S(2, 1.6, 1.6), color: 0x8a3a22 });
    parts.push({ kind: 'limb', a: S(14.5 + rf, 2.4, up(19)), b: S(17.5 + rf, 2.4, up(19.2)), r: 1 * k, color: 0x1a1a1a });
    parts.push({ kind: 'ball', c: S(17.8 + rf, 2.4, up(19.2)), r: 0.7 * k, color: 0x60c0ff, emissive: true });
    if (anim === 'attack') {
      const len = frame === 1 ? 1 : 0.55;
      parts.push({ kind: 'glow', c: S(22, 2.4, up(19)), r: 8 * k * len, color: 0xffa030 });
      parts.push({ kind: 'glow', c: S(27, 2.4, up(18.5)), r: 10 * k * len, color: 0xff6010 });
    }
  } else if (st.weapon === 'tool') {
    // Laspistol in the left hand, cutter in the right.
    arm(1, S(7 + rf, 5, up(18.5)));
    parts.push({ kind: 'box', c: S(10 + rf, 5, up(18.5)), h: S(3.2, 0.8, 0.9), color: 0x9a9a9a });
    parts.push({ kind: 'box', c: S(8 + rf, 5, up(18.5)), h: S(1.4, 1.2, 1.4), color: 0xd8b030 });
    arm(-1, S(8, -4.5, up(21)));
    parts.push({ kind: 'box', c: S(10.5, -4.5, up(21.2)), h: S(3, 0.9, 1.1), color: 0x1c1e22 });
    if (flash) parts.push({ kind: 'glow', c: S(13.5, 5, up(18.5)), r: 7 * k, color: 0xfff0a0 });
  } else {
    // Power sword in the right hand, bolt pistol in the left.
    const a = anim === 'attack' ? (frame === 0 ? 1.9 : -0.55) : anim === 'death' ? -1.2 : 0.55;
    const hand = anim === 'attack' && frame === 0 ? S(2, 6, up(31)) : S(7, 5.6, up(18.5));
    arm(1, hand);
    const dir = v(Math.cos(a), 0, Math.sin(a));
    const blade = add(hand, v(dir.f * 13 * k, 0, dir.z * 13 * k));
    parts.push({ kind: 'box', c: blade, h: S(12, 0.5, 1.3), color: 0xb8c4d8, pitch: a });
    parts.push({ kind: 'box', c: add(blade, v(-dir.z * 1.1 * k, 0, dir.f * 1.1 * k)), h: S(12, 0.25, 0.3), color: 0x80e0ff, pitch: a, emissive: true });
    parts.push({ kind: 'box', c: hand, h: S(0.8, 2.6, 0.8), color: st.trim, pitch: a });
    parts.push({ kind: 'glow', c: blade, r: 9 * k, color: 0x60c8ff });
    arm(-1, S(8, -4.5, up(21)));
    parts.push({ kind: 'box', c: S(10.5, -4.5, up(21.2)), h: S(3, 0.9, 1.1), color: 0x1c1e22 });
  }
  return { parts, pose: { fall, lift: 0 } };
}

function model(style: Style, cellW: number, cellH: number, anchorY: number): UnitModel {
  return { cellW, cellH, anchorX: cellW / 2, anchorY, build: (anim, frame) => humanoid(style, anim, frame) };
}

/** Hazard-striped engineer and camouflaged scout palettes. */
const RANGER = { armor: 0x4a5244, dark: 0x22261e, team: 0x2f63c8, trim: 0x8a7a50, visor: 0xa0ff90 };
const ENGINEER = { armor: 0x5b6574, dark: 0x262a31, team: 0x2f63c8, trim: 0xd8b030, visor: 0xffd070 };

export const RANGER_MODEL = model({ sc: 1.28, bulk: 0.9, pad: 0.75, ...RANGER, weapon: 'longrifle', hood: 0x3a4232, cape: 0x3a4232 }, 108, 76, 54);
export const BREACHER_MODEL = model({ sc: 1.42, bulk: 1.12, pad: 1.1, ...IRON, armor: 0x626058, trim: 0xb08a3a, weapon: 'flamer', tanks: true, crest: 0x3a3a3a }, 124, 86, 62);
export const MARKSMAN_MODEL = model({ sc: 1.28, bulk: 0.9, pad: 0.7, ...RANGER, armor: 0x44483c, weapon: 'sniper', hood: 0x2e3428, cape: 0x4a5236, kneel: true }, 120, 76, 54);
export const ENGINEER_MODEL = model({ sc: 1.3, bulk: 1, pad: 0.9, ...ENGINEER, weapon: 'tool', servo: true }, 108, 84, 60);

export const RIFLEMAN_MODEL = model({ sc: 1.3, bulk: 1, pad: 1, ...IRON, weapon: 'rifle' }, 104, 76, 54);
export const HEAVY_MODEL = model({ sc: 1.55, bulk: 1.15, pad: 1.2, ...IRON, weapon: 'heavy', crest: 0x8a1a1a }, 128, 92, 66);
export const COMMANDER_MODEL = model({
  sc: 1.95, bulk: 1.1, pad: 1.3, ...IRON, armor: 0x6a7282, team: 0x274fa8, trim: 0xe0b848, weapon: 'sword',
  crest: 0xb02020, cape: 0x6e1216, banner: true,
}, 170, 150, 104);
