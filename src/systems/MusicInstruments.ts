import { AudioSystem } from './AudioSystem';

/** Procedural orchestral-ish instruments, scheduled at an AudioContext time `t`. */

export const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

function env(ctx: AudioContext, dest: AudioNode, t: number, a: number, d: number, peak: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + Math.max(a, d - a * 1.5));
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  g.connect(dest);
  return g;
}

/** Warm string/synth pad: three detuned saws per note through a soft low-pass. */
export function pad(ctx: AudioContext, out: AudioNode, notes: number[], t: number, dur: number, gain: number, bright = 900): void {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(bright * 0.6, t);
  lp.frequency.linearRampToValueAtTime(bright, t + dur * 0.5);
  lp.frequency.linearRampToValueAtTime(bright * 0.6, t + dur);
  const g = env(ctx, out, t, Math.min(1.5, dur * 0.35), dur, gain / notes.length);
  lp.connect(g);
  for (const n of notes) {
    for (const d of [-7, 0, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(n);
      o.detune.value = d;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
}

/** Formant "choir" singing an 'ah' vowel. */
export function choir(ctx: AudioContext, out: AudioNode, notes: number[], t: number, dur: number, gain: number): void {
  const g = env(ctx, out, t, Math.min(1.2, dur * 0.4), dur, gain / notes.length);
  const formants: [number, number, number][] = [[800, 8, 1], [1150, 10, 0.5], [2900, 14, 0.25]];
  const mixIn = ctx.createGain();
  for (const [f, q, lvl] of formants) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    const lg = ctx.createGain();
    lg.gain.value = lvl * 3;
    mixIn.connect(bp).connect(lg).connect(g);
  }
  for (const n of notes) {
    for (const d of [-12, 5, 14]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(n);
      o.detune.value = d;
      // Slow vibrato like a section of voices.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4.5 + Math.random();
      const lg = ctx.createGain();
      lg.gain.value = 6;
      lfo.connect(lg).connect(o.detune);
      o.connect(mixIn);
      o.start(t);
      lfo.start(t);
      o.stop(t + dur + 0.05);
      lfo.stop(t + dur + 0.05);
    }
  }
}

/** Low brass: saw + square with an opening filter envelope. */
export function brass(ctx: AudioContext, out: AudioNode, note: number, t: number, dur: number, gain: number): void {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 2;
  lp.frequency.setValueAtTime(200, t);
  lp.frequency.exponentialRampToValueAtTime(1600, t + 0.12);
  lp.frequency.exponentialRampToValueAtTime(700, t + dur);
  const g = env(ctx, out, t, 0.06, dur, gain);
  lp.connect(g);
  for (const [type, det] of [['sawtooth', 0], ['square', 8], ['sawtooth', -10]] as [OscillatorType, number][]) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = midi(note);
    o.detune.value = det;
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

/** War drum: pitch-dropping sine body + noise skin. */
export function drum(ctx: AudioContext, out: AudioNode, t: number, gain: number, pitch = 70): void {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(pitch * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(pitch * 0.6, t + 0.35);
  const g = env(ctx, out, t, 0.004, 0.6, gain);
  o.connect(g);
  o.start(t);
  o.stop(t + 0.65);
  const n = AudioSystem.noiseSource();
  if (!n) return;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  const ng = env(ctx, out, t, 0.002, 0.18, gain * 0.35);
  n.connect(lp).connect(ng);
  n.start(t, Math.random() * 0.5);
  n.stop(t + 0.2);
}

/** Snare/field drum hit. */
export function snare(ctx: AudioContext, out: AudioNode, t: number, gain: number): void {
  const n = AudioSystem.noiseSource();
  if (!n) return;
  const hp = ctx.createBiquadFilter();
  hp.type = 'bandpass';
  hp.frequency.value = 1800;
  hp.Q.value = 0.8;
  const g = env(ctx, out, t, 0.002, 0.14, gain);
  n.connect(hp).connect(g);
  n.start(t, Math.random() * 0.5);
  n.stop(t + 0.16);
}

/** Null Horde layer: a tritone drone growling through a resonant filter, plus chitin clicks. */
export function hordeDrone(ctx: AudioContext, out: AudioNode, root: number, t: number, dur: number, gain: number): void {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 9;
  lp.frequency.setValueAtTime(180, t);
  lp.frequency.linearRampToValueAtTime(520, t + dur * 0.5);
  lp.frequency.linearRampToValueAtTime(160, t + dur);
  const g = env(ctx, out, t, dur * 0.3, dur, gain);
  lp.connect(g);
  for (const n of [root, root + 6, root + 13]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = midi(n);
    o.detune.value = (Math.random() - 0.5) * 30;
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  for (let i = 0; i < 6; i++) {
    const n = AudioSystem.noiseSource();
    if (!n) break;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3000 + Math.random() * 3000;
    bp.Q.value = 12;
    const tt = t + Math.random() * dur;
    const cg = env(ctx, out, tt, 0.001, 0.03, gain * 1.5);
    n.connect(bp).connect(cg);
    n.start(tt, Math.random() * 0.5);
    n.stop(tt + 0.04);
  }
}
