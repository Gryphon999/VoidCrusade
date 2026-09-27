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
    // Thigh plate, knee cop and a greave that flares over the boot.
    parts.push({ kind: 'limb', a: hip, b: knee, r: 2.7 * k * B, r2: 2.2 * k * B, color: st.dark });
    parts.push({ kind: 'wedge', c: v((hip.f + knee.f) / 2 + 1.5 * k * B, (hip.s + knee.s) / 2 + side * 0.6 * k, (hip.z + knee.z) / 2), h: S(1.1, 2.1 * B, 3), taper: 1, taperS: 1.25, color: st.armor, pitch: -kneeSw });
    parts.push({ kind: 'cyl', a: add(knee, S(0, 0, -0.6)), b: add(foot, S(0, 0, 1.6)), r: 1.9 * k * B, r2: 2.7 * k * B, color: st.armor });
    parts.push({ kind: 'box', c: v((knee.f + foot.f) / 2 + 2.2 * k * B, (knee.s + foot.s) / 2, (knee.z + foot.z) / 2 + 0.4 * k), h: S(0.4, 1, 2.4), color: st.team });
    parts.push({ kind: 'wedge', c: add(foot, S(1.4, 0, 1)), h: S(3.2, 1.9 * B, 1.2), taper: 0.7, taperS: 0.85, color: st.dark });
    parts.push({ kind: 'box', c: add(foot, S(3.9, 0, 0.7)), h: S(0.8, 1.7 * B, 0.7), color: st.armor });
    parts.push({ kind: 'shell', c: add(knee, S(-0.4, 0, -0.3)), r: 2.6 * k * B, n: v(1, side * 0.2, 0.35), arc: 1.25, color: st.team });
    parts.push({ kind: 'ball', c: add(knee, S(2.2 * B, side * 0.4, 0.6)), r: 0.6 * k, color: st.trim });
  }
  const up = (z: number): number => z + lift;
  // Pelvis, belt with buckle and pouches, and a tabard in the team colour.
  parts.push({ kind: 'wedge', c: S(0, 0, up(14.4)), h: S(2.7 * B, 4.3 * B, 2), taper: 1.15, taperS: 1.12, color: st.dark });
  parts.push({ kind: 'box', c: S(0, 0, up(16)), h: S(3.9 * B, 5.2 * B, 0.75), color: st.trim });
  parts.push({ kind: 'box', c: S(4 * B, 0, up(16)), h: S(0.35, 1.3, 1.1), color: st.armor });
  for (const side of [-1, 1]) {
    parts.push({ kind: 'box', c: S(0.6, side * 5.4 * B, up(14.6)), h: S(1.5, 0.9, 1.3), color: 0x3a2e22 });
    parts.push({ kind: 'box', c: S(-2.4, side * 5 * B, up(14.4)), h: S(1.1, 0.8, 1.6), color: 0x2e261c });
  }
  parts.push({ kind: 'wedge', c: S(3.6 * B, 0, up(10.8)), h: S(0.35, 2.3 * B, 4.4), taper: 1, taperS: 1.3, color: st.team, pitch: 0.12 + swing * 0.12 });
  parts.push({ kind: 'box', c: S(3.9 * B, 0, up(7.2)), h: S(0.4, 1.9 * B, 0.5), color: st.trim, pitch: 0.12 + swing * 0.12 });
  // Torso: ribbed abdomen, a plastron that broadens to the shoulders, gorget and sigil.
  parts.push({ kind: 'cyl', a: S(0, 0, up(16.4)), b: S(0, 0, up(20.4)), r: 4.1 * k * B, r2: 4.5 * k * B, color: st.dark });
  for (const zz of [17.6, 19.2]) parts.push({ kind: 'box', c: S(3.4 * B, 0, up(zz)), h: S(0.7, 3.3 * B, 0.55), color: st.armor });
  parts.push({ kind: 'wedge', c: S(0.2, 0, up(23.6)), h: S(3.5 * B, 4.7 * B, 3.6), taper: 1.12, taperS: 1.2, color: st.armor });
  parts.push({ kind: 'shell', c: S(1 * B, 0, up(23.4)), r: 4.6 * k * B, n: v(1, 0, 0.25), arc: 1.05, color: st.armor, squash: 0.8 });
  parts.push({ kind: 'wedge', c: S(4.7 * B, 0, up(23.8)), h: S(0.4, 2.4 * B, 2.1), taper: 1, taperS: 0.35, color: st.team, roll: Math.PI });
  parts.push({ kind: 'box', c: S(5.15 * B, 0, up(24.4)), h: S(0.25, 0.9, 0.9), color: st.trim, emissive: true, roll: Math.PI / 4 });
  parts.push({ kind: 'cyl', a: S(0.4, 0, up(27)), b: S(0.4, 0, up(28.7)), r: 3.7 * k, r2: 3 * k, color: st.trim });
  // Power pack: reactor housing, a domed cap and two angled exhaust stacks that glow.
  parts.push({ kind: 'wedge', c: S(-5.6 * B, 0, up(22.4)), h: S(2.5, 4.5 * B, 4.6), taper: 0.8, taperS: 0.9, color: st.dark });
  parts.push({ kind: 'shell', c: S(-5.6 * B, 0, up(25.6)), r: 3.6 * k * B, n: v(-0.2, 0, 1), arc: 1.3, color: st.armor, squash: 0.7 });
  parts.push({ kind: 'box', c: S(-8.2 * B, 0, up(22)), h: S(0.3, 2.6, 2.4), color: st.trim });
  for (const side of [-1, 1]) {
    const foot0 = S(-6.4 * B, side * 3 * B, up(25.5));
    const top = S(-7.6 * B, side * 3.9 * B, up(30));
    parts.push({ kind: 'cyl', a: foot0, b: top, r: 1 * k, r2: 1.2 * k, color: 0x2e3036 });
    parts.push({ kind: 'cyl', a: top, b: add(top, S(-0.25, side * 0.2, 0.9)), r: 1.45 * k, r2: 1.3 * k, color: 0x17181b });
    parts.push({ kind: 'cyl', a: add(top, S(-0.25, side * 0.2, 0.9)), b: add(top, S(-0.27, side * 0.22, 1)), r: 0.8 * k, r2: 0.8 * k, color: 0xff7a30, emissive: true });
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
  // The head turns as one piece: every helmet part is placed through `face`.
  const face = (f: number, s: number, z: number): V3 => {
    const c = Math.cos(lookYaw);
    const n = Math.sin(lookYaw);
    return add(neck, S(f * c - s * n, f * n + s * c, z));
  };
  parts.push({ kind: 'ball', c: neck, r: 3.3 * k, color: st.armor, squash: 0.96 });
  // Helmet: brow ridge, a snout-like faceplate with a vox grille, cheek guards and ear cups.
  parts.push({ kind: 'shell', c: face(-0.2, 0, 0.3), r: 3.65 * k, n: v(-0.15, 0, 1), arc: 1.35, color: st.armor });
  parts.push({ kind: 'box', c: face(2.5, 0, 1.3), h: S(0.9, 2.7, 0.45), color: st.armor, yaw: lookYaw, pitch: -0.2 });
  parts.push({ kind: 'box', c: face(2.95, 0, 0.35), h: S(0.45, 2.1, 0.55), color: st.visor, emissive: true, yaw: lookYaw });
  parts.push({ kind: 'wedge', c: face(2.9, 0, -1.6), h: S(1.1, 1.7, 1.2), taper: 0.75, taperS: 1.35, color: st.dark, yaw: lookYaw, roll: Math.PI });
  for (const o of [-0.6, 0.6]) parts.push({ kind: 'box', c: face(4, o, -1.7), h: S(0.2, 0.22, 0.75), color: st.trim, yaw: lookYaw });
  for (const side of [-1, 1]) {
    parts.push({ kind: 'box', c: face(1.4, side * 2.7, -1.2), h: S(1.5, 0.5, 1.3), color: st.armor, yaw: lookYaw });
    parts.push({ kind: 'cyl', a: face(-0.2, side * 2.9, 0), b: face(-0.2, side * 3.7, 0), r: 1.25 * k, r2: 1 * k, color: st.dark });
  }
  if (st.crest) {
    // Transverse-ridged crest running front to back.
    parts.push({ kind: 'wedge', c: face(-0.4, 0, 4), h: S(3.6, 0.55, 1.5), taper: 0.7, taperS: 0.4, color: st.crest, yaw: lookYaw });
    parts.push({ kind: 'box', c: face(-0.4, 0, 3), h: S(3.7, 0.8, 0.35), color: st.trim, yaw: lookYaw });
  } else if (!st.hood) {
    parts.push({ kind: 'box', c: face(-0.3, 0, 3.4), h: S(2.8, 0.45, 0.4), color: st.trim, yaw: lookYaw });
  }
  if (st.hood) {
    parts.push({ kind: 'ball', c: add(neck, S(-0.8, 0, 0.8)), r: 3.9 * k, color: st.hood, squash: 0.95 });
    parts.push({ kind: 'box', c: add(neck, S(-3, 0, -2.5)), h: S(1.2, 4.2, 3), color: st.hood });
  }
  if (st.tanks) parts.push({ kind: 'box', c: add(neck, S(3, 0, -1.3)), h: S(1, 1.4, 1.1), color: 0x2a2a2a });
  // Shoulder pads with brass rims.
  for (const side of [-1, 1]) {
    // Pauldron: a deep curved shell over a brass rim, with a rivet and an under-plate.
    const pc = S(0.2, side * 5.9 * B, up(24.6));
    const out = v(0, side * 0.62, 0.78);
    const pr = 3.7 * k * st.pad;
    parts.push({ kind: 'ball', c: add(pc, S(0, 0, 0.4)), r: 2.7 * k * st.pad, color: st.dark, squash: 0.8 });
    // Two lames under the main plate, each a little wider, so the shoulder reads as layered armour.
    parts.push({ kind: 'shell', c: add(pc, S(0, side * 0.9, -1.5)), r: pr * 1.02, n: out, arc: 1.3, color: st.armor, squash: 0.62 });
    parts.push({ kind: 'shell', c: pc, r: pr, n: out, arc: 1.25, color: st.team, squash: 0.7 });
    parts.push({ kind: 'cyl', a: add(pc, v(out.f * pr * 0.2, out.s * pr * 0.2, out.z * pr * 0.2)), b: add(pc, v(out.f * pr * 0.32, out.s * pr * 0.32, out.z * pr * 0.32)), r: pr * 0.98, r2: pr * 0.95, color: st.trim });
    // Unit marking: a raised bar across the plate.
    parts.push({ kind: 'box', c: add(pc, v(out.f * pr * 0.7, out.s * pr * 0.7, out.z * pr * 0.7)), h: S(2 * st.pad, 0.5, 0.3), color: side > 0 ? st.trim : st.armor, roll: side * -0.65 });
  }
  // Arms and weapon.
  const shoulder = (side: number): V3 => S(0.5, side * 5.3 * B, up(25));
  const arm = (side: number, hand: V3): void => {
    const sh = shoulder(side);
    const elbow = v((sh.f + hand.f) / 2 - 1 * k, (sh.s + hand.s) / 2 + side * 1.4 * k, (sh.z + hand.z) / 2 - 2.6 * k);
    // Upper arm, elbow cop, a vambrace that widens to the wrist, gauntlet.
    parts.push({ kind: 'limb', a: sh, b: elbow, r: 2.1 * k * B, r2: 1.8 * k * B, color: st.dark });
    parts.push({ kind: 'ball', c: elbow, r: 2.05 * k * B, color: st.armor });
    parts.push({ kind: 'cyl', a: elbow, b: hand, r: 1.7 * k * B, r2: 2.2 * k * B, color: st.armor });
    parts.push({ kind: 'cyl', a: v(hand.f * 0.8 + elbow.f * 0.2, hand.s * 0.8 + elbow.s * 0.2, hand.z * 0.8 + elbow.z * 0.2), b: v(hand.f * 0.9 + elbow.f * 0.1, hand.s * 0.9 + elbow.s * 0.1, hand.z * 0.9 + elbow.z * 0.1), r: 2.35 * k * B, r2: 2.35 * k * B, color: st.trim });
    parts.push({ kind: 'ball', c: hand, r: 1.8 * k * B, color: st.dark });
  };
  /** A gun barrel with a muzzle brake, from the breech to the tip. */
  const barrel = (from: V3, to: V3, r: number, color = 0x15161a): void => {
    parts.push({ kind: 'cyl', a: from, b: to, r: r * k, r2: r * k, color });
    parts.push({ kind: 'cyl', a: v(to.f - 1.6 * k, to.s, to.z), b: to, r: r * 1.7 * k, r2: r * 1.7 * k, color: 0x2a2c30 });
  };
  const rf = recoil;
  if (st.weapon === 'rifle') {
    arm(1, S(5 + rf, 2.2, up(19.5)));
    arm(-1, S(10 + rf, -0.6, up(21)));
    // Void rifle: boxy receiver with a casing, curved magazine, stock, sight rail and lamp.
    parts.push({ kind: 'box', c: S(8.6 + rf, 1, up(20.6)), h: S(5.6, 1.2, 1.75), color: 0x1c1e22 });
    parts.push({ kind: 'box', c: S(9.4 + rf, 1, up(21.1)), h: S(3.2, 1.4, 0.9), color: st.armor });
    parts.push({ kind: 'wedge', c: S(1.6 + rf, 1, up(20.2)), h: S(2, 0.9, 1.5), taper: 1, taperS: 1, color: 0x2a2620, pitch: 0.12 });
    parts.push({ kind: 'box', c: S(8.4 + rf, 1, up(17.9)), h: S(1.2, 0.85, 1.9), color: st.trim, pitch: -0.25 });
    parts.push({ kind: 'box', c: S(9 + rf, 1, up(22.7)), h: S(2.6, 0.35, 0.35), color: 0x101010 });
    parts.push({ kind: 'box', c: S(11.4 + rf, 1, up(23.1)), h: S(0.5, 0.45, 0.6), color: st.trim });
    parts.push({ kind: 'cyl', a: S(12 + rf, 1, up(19.3)), b: S(15.5 + rf, 1, up(19.3)), r: 0.75 * k, r2: 0.75 * k, color: 0x2a2c30 });
    barrel(S(14 + rf, 1, up(20.9)), S(20.5 + rf, 1, up(20.9)), 0.8);
    if (flash) parts.push({ kind: 'glow', c: S(22.5, 1, up(20.9)), r: 7 * k, color: 0xffd070 });
  } else if (st.weapon === 'heavy') {
    arm(1, S(4.5 + rf, 4.6, up(17.2)));
    arm(-1, S(9 + rf, 1.6, up(19)));
    // Heavy autocannon: cooling shroud, drum magazine, carrying handle, belt feed to the pack.
    parts.push({ kind: 'box', c: S(8 + rf, 3.2, up(17.6)), h: S(6.4, 2.2, 2.6), color: 0x24272c });
    parts.push({ kind: 'cyl', a: S(12 + rf, 3.2, up(17.9)), b: S(17.5 + rf, 3.2, up(17.9)), r: 2.5 * k, r2: 2.2 * k, color: 0x3a3d44 });
    for (const f of [13.2, 14.8, 16.4]) parts.push({ kind: 'cyl', a: S(f + rf, 3.2, up(17.9)), b: S(f + 0.5 + rf, 3.2, up(17.9)), r: 2.75 * k, r2: 2.75 * k, color: 0x17181b });
    parts.push({ kind: 'cyl', a: S(5.5 + rf, 5.2, up(14.2)), b: S(5.5 + rf, 5.2, up(17)), r: 2.6 * k, r2: 2.6 * k, color: st.trim });
    parts.push({ kind: 'box', c: S(8 + rf, 3.2, up(21.2)), h: S(2.6, 0.4, 0.4), color: 0x101010 });
    for (const f of [6, 10]) parts.push({ kind: 'box', c: S(f + rf, 3.2, up(20.5)), h: S(0.4, 0.4, 0.6), color: 0x101010 });
    parts.push({ kind: 'limb', a: S(3 + rf, 4.6, up(18.5)), b: S(-4.5 * B, 3.6, up(20)), r: 0.9 * k, color: 0x8a7a40 });
    for (const o of [-1, 1]) barrel(S(17 + rf, 3.2 + o * 1.1, up(17.9)), S(23 + rf, 3.2 + o * 1.1, up(17.9)), 1);
    if (flash) parts.push({ kind: 'glow', c: S(24.5, 3.2, up(17.9)), r: 10 * k, color: 0xffa040 });
  } else if (st.weapon === 'longrifle' || st.weapon === 'sniper') {
    // Long rifle with a scope; snipers aim from a kneel.
    const long = st.weapon === 'sniper' ? 1.35 : 1.12;
    arm(1, S(4.5 + rf, 2.2, up(20.5)));
    arm(-1, S(11 + rf, -0.5, up(21.5)));
    // Slim receiver, wooden stock and fore-end, a tube scope on two rings, a long fluted barrel.
    parts.push({ kind: 'box', c: S(8 + rf, 1, up(21)), h: S(4.6, 0.95, 1.35), color: 0x2a2620 });
    parts.push({ kind: 'wedge', c: S(2 + rf, 1, up(20.2)), h: S(2.6, 0.85, 1.7), taper: 0.85, taperS: 1, color: 0x5a4020, pitch: 0.15 });
    parts.push({ kind: 'box', c: S(13.5 + rf, 1, up(20.5)), h: S(2.6, 0.8, 0.8), color: 0x5a4020 });
    parts.push({ kind: 'box', c: S(7.6 + rf, 1, up(19)), h: S(0.9, 0.7, 1.2), color: 0x17181b, pitch: -0.2 });
    parts.push({ kind: 'cyl', a: S(6 + rf, 1, up(23.2)), b: S(12 + rf, 1, up(23.2)), r: 0.75 * k, r2: 0.95 * k, color: 0x101010 });
    for (const f of [7.4, 10.4]) parts.push({ kind: 'box', c: S(f + rf, 1, up(22.5)), h: S(0.35, 0.5, 0.5), color: 0x2a2c30 });
    parts.push({ kind: 'ball', c: S(12.1 + rf, 1, up(23.2)), r: 0.7 * k, color: 0x80e0ff, emissive: true });
    const tip = 10 + 8.4 * long;
    barrel(S(12.5 + rf, 1, up(21.2)), S(tip + 3.5 + rf, 1, up(21.2)), 0.55);
    if (st.weapon === 'sniper') {
      // Folded bipod under the barrel.
      for (const o of [-1, 1]) parts.push({ kind: 'limb', a: S(tip - 1 + rf, 1, up(20.7)), b: S(tip - 4 + rf, 1 + o * 1.2, up(19.4)), r: 0.3 * k, color: 0x2a2c30 });
    }
    if (flash) parts.push({ kind: 'glow', c: S(tip + 5.5, 1, up(21.2)), r: (st.weapon === 'sniper' ? 9 : 6) * k, color: 0xfff0c0 });
  } else if (st.weapon === 'flamer') {
    arm(1, S(4.5 + rf, 3.6, up(18)));
    arm(-1, S(9.5 + rf, 1.2, up(19.5)));
    // Flamer: fuel cylinder under a vented heat shield, flared nozzle with a pilot light.
    parts.push({ kind: 'box', c: S(7.5 + rf, 2.4, up(18.8)), h: S(5.5, 1.4, 1.7), color: 0x3a3430 });
    parts.push({ kind: 'cyl', a: S(3.5 + rf, 2.4, up(16.9)), b: S(9.5 + rf, 2.4, up(16.9)), r: 1.5 * k, r2: 1.5 * k, color: 0x8a3a22 });
    parts.push({ kind: 'shell', c: S(10.5 + rf, 2.4, up(18.9)), r: 2.6 * k, n: v(0, 0, 1), arc: 1.2, color: st.armor, squash: 0.7 });
    for (const f of [9.5, 11.5]) parts.push({ kind: 'box', c: S(f + rf, 2.4, up(20.7)), h: S(0.35, 1.2, 0.2), color: 0x101010 });
    parts.push({ kind: 'cyl', a: S(13 + rf, 2.4, up(19)), b: S(16.5 + rf, 2.4, up(19.1)), r: 0.9 * k, r2: 0.9 * k, color: 0x1a1a1a });
    parts.push({ kind: 'cyl', a: S(16.5 + rf, 2.4, up(19.1)), b: S(18.6 + rf, 2.4, up(19.2)), r: 1 * k, r2: 1.9 * k, color: 0x2a2c30 });
    parts.push({ kind: 'ball', c: S(18.4 + rf, 2.4, up(20.9)), r: 0.6 * k, color: 0x60c0ff, emissive: true });
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
    // Power sword: a fullered blade that narrows to a point, energy edge, winged crossguard, pommel.
    parts.push({ kind: 'wedge', c: blade, h: S(1.5, 0.45, 12), taper: 0.12, taperS: 0.6, color: 0xb8c4d8, pitch: a - Math.PI / 2 });
    parts.push({ kind: 'box', c: blade, h: S(10, 0.6, 0.35), color: 0x80e0ff, pitch: a, emissive: true });
    parts.push({ kind: 'wedge', c: add(hand, v(dir.f * 1.4 * k, 0, dir.z * 1.4 * k)), h: S(0.7, 3.2, 0.7), taper: 1, taperS: 1.5, color: st.trim, pitch: a - Math.PI / 2 });
    parts.push({ kind: 'ball', c: add(hand, v(-dir.f * 2.2 * k, 0, -dir.z * 2.2 * k)), r: 1 * k, color: st.trim });
    parts.push({ kind: 'glow', c: blade, r: 9 * k, color: 0x60c8ff });
    // Heavy pistol in the off hand.
    arm(-1, S(8, -4.5, up(21)));
    parts.push({ kind: 'box', c: S(10.5, -4.5, up(21.2)), h: S(3, 0.9, 1.1), color: 0x1c1e22 });
    parts.push({ kind: 'box', c: S(9.6, -4.5, up(19.4)), h: S(0.8, 0.7, 1.2), color: st.trim, pitch: -0.2 });
    barrel(S(12.5, -4.5, up(21.5)), S(15.5, -4.5, up(21.5)), 0.7);
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
