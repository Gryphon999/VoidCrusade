import { Settings } from './Settings';

type Ctx = AudioContext;

/**
 * Procedural sound engine: every sound is synthesised with Web Audio nodes.
 * SFX go through `sfxBus`, ambience/music through `musicBus`; both follow the settings sliders.
 */
class AudioEngine {
  ctx: Ctx | null = null;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  private master!: DynamicsCompressorNode;
  private masterGain!: GainNode;
  private noise!: AudioBuffer;
  private lastPlayed = new Map<string, number>();
  private listeners: (() => void)[] = [];

  /** Creates/resumes the context; must run from a user gesture the first time. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createDynamicsCompressor();
      this.master.threshold.value = -12;
      this.masterGain = ctx.createGain();
      this.master.connect(this.masterGain).connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      Settings.onChange(() => this.applyVolumes());
      for (const l of this.listeners) l();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Runs `fn` once the context exists (immediately if it already does). */
  onReady(fn: () => void): void {
    if (this.ctx) fn();
    else this.listeners.push(fn);
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const s = Settings.get();
    const t = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(s.masterVolume, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfxVolume, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.musicVolume * 0.6, t, 0.05);
  }

  /** Per-sound rate limiter so 60 rifles don't clip the mix. */
  private allow(key: string, minGapMs: number): boolean {
    const now = performance.now();
    const last = this.lastPlayed.get(key) ?? 0;
    if (now - last < minGapMs) return false;
    this.lastPlayed.set(key, now);
    return true;
  }

  private out(gain: number, pan = 0): GainNode | null {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return null;
    const g = ctx.createGain();
    g.gain.value = gain;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p).connect(this.sfxBus);
    } else {
      g.connect(this.sfxBus);
    }
    return g;
  }

  noiseSource(loop = false): AudioBufferSourceNode | null {
    if (!this.ctx) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = loop;
    return src;
  }

  private burst(dest: AudioNode, dur: number, filter: BiquadFilterType, freq: number, q = 1, freqEnd?: number, delay = 0): void {
    const ctx = this.ctx as Ctx;
    const src = this.noiseSource() as AudioBufferSourceNode;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const t = ctx.currentTime + delay;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(1, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(env).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private tone(dest: AudioNode, type: OscillatorType, f0: number, f1: number, dur: number, delay = 0, peak = 1): void {
    const ctx = this.ctx as Ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(env).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // ---- Sound library ------------------------------------------------------

  /** Bolter-like rifle: sharp crack, mid-range bark and a low thump. */
  rifleShot(vol = 1, pan = 0): void {
    if (!this.allow('rifle', 35)) return;
    const o = this.out(0.35 * vol, pan);
    if (!o) return;
    this.burst(o, 0.02 + Math.random() * 0.02, 'bandpass', 1800 + Math.random() * 800, 0.8);
    this.burst(o, 0.05, 'highpass', 3000, 0.5);
    this.burst(o, 0.09, 'lowpass', 700, 1, 180);
    this.tone(o, 'sine', 120 + Math.random() * 30, 55, 0.08, 0, 0.5);
  }

  /** Heavy weapon: a double 'chug' with a sub-bass kick. */
  heavyShot(vol = 1, pan = 0): void {
    if (!this.allow('heavy', 70)) return;
    const o = this.out(0.5 * vol, pan);
    if (!o) return;
    for (const d of [0, 0.07]) {
      this.burst(o, 0.1, 'lowpass', 1400, 0.7, 220, d);
      this.tone(o, 'sine', 150, 45, 0.16, d);
    }
    this.burst(o, 0.04, 'highpass', 2500, 0.6);
  }

  spit(vol = 1, pan = 0): void {
    if (!this.allow('spit', 45)) return;
    const o = this.out(0.3 * vol, pan);
    if (!o) return;
    this.burst(o, 0.08, 'bandpass', 900, 4, 2400);
  }

  /** Flamer: a roaring whoosh of burning promethium. */
  flamer(vol = 1, pan = 0): void {
    if (!this.allow('flame', 110)) return;
    const o = this.out(0.32 * vol, pan);
    if (!o) return;
    this.burst(o, 0.28, 'lowpass', 1400, 0.6, 500);
    this.burst(o, 0.18, 'bandpass', 2600, 0.8, 900);
  }

  /** Sniper rifle: a hard supersonic crack with a long echo. */
  sniperShot(vol = 1, pan = 0): void {
    if (!this.allow('sniper', 120)) return;
    const o = this.out(0.5 * vol, pan);
    if (!o) return;
    this.burst(o, 0.03, 'highpass', 3500, 0.6);
    this.burst(o, 0.12, 'bandpass', 1200, 1.2, 400);
    this.tone(o, 'sine', 180, 60, 0.12, 0, 0.6);
    this.burst(o, 0.5, 'bandpass', 900, 3, 300, 0.12);
  }

  /** Psychic bolt: a warbling rising hiss. */
  psychic(vol = 1, pan = 0): void {
    if (!this.allow('psy', 120)) return;
    const o = this.out(0.28 * vol, pan);
    if (!o) return;
    this.tone(o, 'sawtooth', 220, 660, 0.22, 0, 0.35);
    this.tone(o, 'sine', 330, 990, 0.26, 0.02, 0.3);
    this.burst(o, 0.2, 'bandpass', 3000, 4, 5000);
  }

  melee(vol = 1, pan = 0): void {
    if (!this.allow('melee', 90)) return;
    const o = this.out(0.5 * vol, pan);
    if (!o) return;
    this.burst(o, 0.1, 'lowpass', 600, 1);
    this.tone(o, 'square', 90, 40, 0.1, 0, 0.4);
  }

  /** Punchy blast with a long low rumble tail. */
  explosion(vol = 1, pan = 0): void {
    const o = this.out(0.9 * vol, pan);
    if (!o) return;
    this.burst(o, 0.5, 'lowpass', 900, 0.8, 80);
    this.burst(o, 0.25, 'bandpass', 400, 0.6);
    this.burst(o, 1.6, 'lowpass', 160, 0.7, 40);
    this.tone(o, 'sine', 70, 28, 0.55, 0, 1);
    this.tone(o, 'sine', 45, 22, 1.4, 0.05, 0.6);
  }

  /** Heavy footfall (Iron Guard, Commander, Behemoth). */
  footstep(vol = 1, pan = 0, huge = false): void {
    if (!this.allow('step', huge ? 220 : 160)) return;
    const o = this.out((huge ? 0.5 : 0.25) * vol, pan);
    if (!o) return;
    this.tone(o, 'sine', huge ? 70 : 110, huge ? 30 : 50, huge ? 0.25 : 0.12, 0, 0.8);
    this.burst(o, 0.05, 'lowpass', huge ? 400 : 900, 1);
  }

  /** Diesel engine growl for a moving vehicle; `heavy` = tank/walker. */
  engine(vol = 1, pan = 0, heavy = false): void {
    if (!this.allow('engine', 300)) return;
    const o = this.out((heavy ? 0.22 : 0.14) * vol, pan);
    if (!o) return;
    const f = heavy ? 42 : 70;
    this.tone(o, 'sawtooth', f, f * 0.95, 0.34, 0, 0.35);
    this.tone(o, 'square', f * 2, f * 1.9, 0.3, 0.02, 0.12);
    this.burst(o, 0.3, 'lowpass', heavy ? 300 : 500, 0.7);
  }

  /** Metallic construction clank. */
  clank(vol = 1, pan = 0): void {
    if (!this.allow('clank', 350)) return;
    const o = this.out(0.18 * vol, pan);
    if (!o) return;
    const f = 600 + Math.random() * 500;
    this.tone(o, 'square', f, f * 0.98, 0.18, 0, 0.5);
    this.tone(o, 'triangle', f * 2.7, f * 2.6, 0.25, 0, 0.3);
    this.burst(o, 0.03, 'highpass', 4000, 1);
  }

  /** Soft tick when hovering a button. */
  uiHover(): void {
    if (!this.allow('hover', 40)) return;
    const o = this.out(0.08);
    if (!o) return;
    this.tone(o, 'sine', 2200, 1800, 0.025, 0, 0.6);
  }

  /** Low war-horn stab for 'under attack'. */
  horn(): void {
    const o = this.out(0.3);
    if (!o) return;
    for (const d of [0, 7]) this.tone(o, 'sawtooth', 110 * Math.pow(2, d / 12), 108 * Math.pow(2, d / 12), 0.9, 0, 0.5);
  }

  unitDeath(vol = 1, pan = 0): void {
    if (!this.allow('death', 60)) return;
    const o = this.out(0.45 * vol, pan);
    if (!o) return;
    this.burst(o, 0.06, 'bandpass', 700 + Math.random() * 400, 2);
    this.tone(o, 'square', 180, 60, 0.07, 0.01, 0.25);
  }

  buildingComplete(): void {
    const o = this.out(0.25);
    if (!o) return;
    [261.6, 329.6, 392, 523.3].forEach((f, i) => this.tone(o, 'triangle', f, f, 0.6, i * 0.09, 0.7));
  }

  captureChime(owner: 'player' | 'enemy'): void {
    const o = this.out(0.3);
    if (!o) return;
    const base = owner === 'player' ? [523.3, 659.3, 784] : [293.7, 277.2, 220];
    base.forEach((f, i) => this.tone(o, 'sine', f, f * 1.01, 0.9, i * 0.12, 0.6));
  }

  uiClick(): void {
    if (!this.allow('click', 30)) return;
    const o = this.out(0.25);
    if (!o) return;
    this.tone(o, 'square', 1400, 700, 0.03, 0, 0.5);
  }

  /** Low synthetic grunt used as a unit acknowledgement "voice line". */
  grunt(pitch = 1): void {
    if (!this.allow('grunt', 250)) return;
    const ctx = this.ctx;
    const o = this.out(0.35);
    if (!ctx || !o) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const f0 = (95 + Math.random() * 30) * pitch;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.linearRampToValueAtTime(f0 * 1.15, t + 0.06);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.7, t + 0.28);
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(500 + Math.random() * 200, t);
    formant.frequency.linearRampToValueAtTime(350, t + 0.28);
    formant.Q.value = 3;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(formant).connect(env).connect(o);
    osc.start(t);
    osc.stop(t + 0.32);
  }
}

export const AudioSystem = new AudioEngine();
