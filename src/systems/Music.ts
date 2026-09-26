import { AudioSystem } from './AudioSystem';
import { Voice } from './VoiceSystem';
import { brass, choir, drum, hordeDrone, pad, snare } from './MusicInstruments';

export type Theme = 'menu' | 'campaign' | 'battle';

// Chords as MIDI notes (D minor world: i, VI, VII, V, iv...).
const Dm = [50, 53, 57];
const Bb = [46, 50, 53];
const Gm = [43, 46, 50];
const A = [45, 49, 52];
const F = [41, 45, 48];
const C = [48, 52, 55];

interface ThemeSpec {
  bpm: number;
  chords: number[][];
  bar: (m: MusicEngine, t: number, beat: number, chord: number[], i: number, l: Layers) => void;
}

interface Layers {
  calm: GainNode;
  combat: GainNode;
  horde: GainNode;
}

interface Playing {
  theme: Theme;
  out: GainNode;
  layers: Layers;
  next: number;
  bar: number;
}

const SPECS: Record<Theme, ThemeSpec> = {
  menu: {
    bpm: 56,
    chords: [Dm, Bb, Gm, A],
    bar: (m, t, b, ch, i, l) => {
      pad(m.ctx, l.calm, ch, t, b * 4.1, 0.5, 800);
      if (i % 2 === 0) choir(m.ctx, l.calm, ch.map((n) => n + 12), t + b * 0.5, b * 3.5, 0.3);
      if (i % 4 === 0) brass(m.ctx, l.calm, ch[0] - 12, t, b * 3, 0.16);
      if (i % 2 === 0) drum(m.ctx, l.calm, t, 0.45, 50);
    },
  },
  campaign: {
    bpm: 64,
    chords: [Dm, F, C, Gm],
    bar: (m, t, b, ch, _i, l) => {
      pad(m.ctx, l.calm, ch, t, b * 4.1, 0.38, 1000);
      for (let k = 0; k < 4; k++) brass(m.ctx, l.calm, ch[0] - 24, t + k * b, b * 0.8, 0.12);
      drum(m.ctx, l.calm, t, 0.3, 55);
      drum(m.ctx, l.calm, t + b * 2, 0.22, 60);
    },
  },
  battle: {
    bpm: 96,
    chords: [Dm, Bb, C, A],
    bar: (m, t, b, ch, i, l) => {
      // Calm layer: brooding pad, distant drum.
      pad(m.ctx, l.calm, ch, t, b * 4.1, 0.34, 700);
      if (i % 2 === 0) choir(m.ctx, l.calm, ch.map((n) => n + 12), t, b * 4, 0.14);
      drum(m.ctx, l.calm, t, 0.28, 48);
      // Combat layer: war drums, snare rolls, brass stabs, full choir.
      for (let k = 0; k < 4; k++) drum(m.ctx, l.combat, t + k * b, k === 0 ? 0.7 : 0.45, k === 0 ? 55 : 75);
      drum(m.ctx, l.combat, t + b * 2.5, 0.4, 90);
      for (let k = 0; k < 4; k++) snare(m.ctx, l.combat, t + b * 3 + k * b * 0.25, 0.12 + k * 0.05);
      brass(m.ctx, l.combat, ch[0] - 12, t, b * 0.45, 0.26);
      brass(m.ctx, l.combat, ch[0] - 12, t + b * 2.5, b * 0.45, 0.22);
      choir(m.ctx, l.combat, ch.map((n) => n + 12), t, b * 4, 0.3);
      // Null Horde layer: dissonant growl and clicks.
      hordeDrone(m.ctx, l.horde, ch[0] - 24, t, b * 4, 0.22);
    },
  },
};

/** Look-ahead music sequencer with crossfaded themes and intensity-driven layers. */
class MusicEngine {
  ctx!: AudioContext;
  private current: Playing | null = null;
  private timer = 0;
  private duck!: GainNode;
  private intensity = 0;
  private threat = 0;
  private wanted: Theme | null = null;

  private init(): boolean {
    if (this.ctx) return true;
    const ctx = AudioSystem.ctx;
    if (!ctx) return false;
    this.ctx = ctx;
    this.duck = ctx.createGain();
    this.duck.connect(AudioSystem.musicBus);
    // Duck the score while a voice line plays.
    Voice.onSpeaking((on) => this.duck.gain.setTargetAtTime(on ? 0.45 : 1, ctx.currentTime, 0.15));
    this.timer = window.setInterval(() => this.tick(), 120);
    return true;
  }

  /** Crossfades to a theme (starts once audio is unlocked). */
  play(theme: Theme): void {
    this.wanted = theme;
    AudioSystem.onReady(() => {
      if (!this.init() || this.wanted !== theme || this.current?.theme === theme) return;
      const t = this.ctx.currentTime;
      if (this.current) this.fadeOut(this.current, 2.5);
      const out = this.ctx.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(1, t + 2.5);
      out.connect(this.duck);
      const mk = (v: number): GainNode => {
        const g = this.ctx.createGain();
        g.gain.value = v;
        g.connect(out);
        return g;
      };
      this.current = { theme, out, layers: { calm: mk(1), combat: mk(0), horde: mk(0) }, next: t + 0.1, bar: 0 };
      this.applyMix();
    });
  }

  stop(fade = 2): void {
    this.wanted = null;
    if (this.current) this.fadeOut(this.current, fade);
    this.current = null;
  }

  private fadeOut(p: Playing, secs: number): void {
    const t = this.ctx.currentTime;
    p.out.gain.cancelScheduledValues(t);
    p.out.gain.setValueAtTime(Math.max(0.0001, p.out.gain.value), t);
    p.out.gain.exponentialRampToValueAtTime(0.0001, t + secs);
    window.setTimeout(() => p.out.disconnect(), (secs + 6) * 1000);
  }

  /** 0 = calm, 1 = full combat; smoothed crossfade between the battle layers. */
  setIntensity(v: number, hordeThreat = 0): void {
    this.intensity = Math.max(0, Math.min(1, v));
    this.threat = Math.max(0, Math.min(1, hordeThreat));
    this.applyMix();
  }

  private applyMix(): void {
    const p = this.current;
    if (!p || p.theme !== 'battle') return;
    const t = this.ctx.currentTime;
    p.layers.calm.gain.setTargetAtTime(1 - this.intensity * 0.6, t, 1.2);
    p.layers.combat.gain.setTargetAtTime(this.intensity, t, 1.2);
    p.layers.horde.gain.setTargetAtTime(Math.max(this.threat, this.intensity * 0.4), t, 1.5);
  }

  private tick(): void {
    const p = this.current;
    if (!p || this.ctx.state !== 'running') return;
    const spec = SPECS[p.theme];
    const beat = 60 / spec.bpm;
    while (p.next < this.ctx.currentTime + 0.6) {
      spec.bar(this, p.next, beat, spec.chords[p.bar % spec.chords.length], p.bar, p.layers);
      p.next += beat * 4;
      p.bar++;
    }
  }

  /** Short rising brass call when a new tech tier comes online (music keeps playing). */
  tierStinger(horde = false): void {
    AudioSystem.onReady(() => {
      if (!this.init()) return;
      const out = this.ctx.createGain();
      out.gain.value = 0.8;
      out.connect(this.duck);
      const t = this.ctx.currentTime + 0.05;
      const notes = horde ? [45, 46, 50] : [55, 62, 67];
      notes.forEach((n, i) => brass(this.ctx, out, n, t + i * 0.18, i === 2 ? 1.4 : 0.2, 0.26));
      drum(this.ctx, out, t + 0.36, 0.5, horde ? 38 : 48);
    });
  }

  /** Victory fanfare or defeat lament, then silence. */
  stinger(win: boolean): void {
    AudioSystem.onReady(() => {
      if (!this.init()) return;
      this.stop(1.2);
      const out = this.ctx.createGain();
      out.connect(this.duck);
      const t = this.ctx.currentTime + 0.3;
      if (win) {
        [62, 66, 69, 74].forEach((n, i) => brass(this.ctx, out, n - 12, t + i * 0.28, i === 3 ? 2.6 : 0.3, 0.3));
        pad(this.ctx, out, [50, 54, 57, 62], t + 0.84, 4.5, 0.5, 1400);
        choir(this.ctx, out, [62, 66, 69], t + 0.84, 4.2, 0.35);
        for (const k of [0, 0.84, 1.1]) drum(this.ctx, out, t + k, 0.7, 50);
      } else {
        [50, 49, 46, 45].forEach((n, i) => brass(this.ctx, out, n - 12, t + i * 0.9, 1.1, 0.24));
        hordeDrone(this.ctx, out, 26, t, 5, 0.3);
        pad(this.ctx, out, [45, 48, 52], t + 2.7, 3.5, 0.4, 600);
        drum(this.ctx, out, t + 3.6, 0.6, 40);
      }
    });
  }

  dispose(): void {
    window.clearInterval(this.timer);
  }
}

export const Music = new MusicEngine();
