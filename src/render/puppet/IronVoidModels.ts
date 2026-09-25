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
  weapon: 'rifle' | 'heavy' | 'sword';
  crest?: number;
  cape?: number;
  banner?: boolean;
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
  } else if (anim === 'hit') {
    fall = 0.2;
  } else if (anim === 'death') {
    fall = DEATH_FALL[frame];
    swing = -0.15 * frame;
  }
  const lift = bob + breathe * 0.4;
  // Legs.
  for (const side of [-1, 1]) {
    const sw = swing * side;
    const hip = S(0, side * 3.1 * B, 14);
    const knee = add(hip, S(Math.sin(sw) * 7, 0, -Math.cos(sw) * 7));
    const bend = Math.max(0, -sw) * 1.1 + 0.12;
    const foot = add(knee, S(Math.sin(sw - bend) * 7, 0, -Math.cos(sw - bend) * 7));
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

export const RIFLEMAN_MODEL = model({ sc: 1.3, bulk: 1, pad: 1, ...IRON, weapon: 'rifle' }, 104, 76, 54);
export const HEAVY_MODEL = model({ sc: 1.55, bulk: 1.15, pad: 1.2, ...IRON, weapon: 'heavy', crest: 0x8a1a1a }, 128, 92, 66);
export const COMMANDER_MODEL = model({
  sc: 1.95, bulk: 1.1, pad: 1.3, ...IRON, armor: 0x6a7282, team: 0x274fa8, trim: 0xe0b848, weapon: 'sword',
  crest: 0xb02020, cape: 0x6e1216, banner: true,
}, 170, 150, 104);
