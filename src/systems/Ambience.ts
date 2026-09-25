import { AudioSystem } from './AudioSystem';

interface Voice {
  stop: () => void;
}

/** Looping ambience on the music bus: battle rumble, dark drone pad, and the capture tone. */
class AmbienceEngine {
  private rumble: Voice | null = null;
  private drone: Voice | null = null;
  private capture: { gain: GainNode; stop: () => void } | null = null;
  private capturing = false;

  private startDrone(): void {
    const ctx = AudioSystem.ctx;
    if (!ctx || this.drone) return;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 3);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 4;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(filter.frequency);
    filter.connect(out).connect(AudioSystem.musicBus);
    const oscs = [55, 55.4, 82.4, 110.2].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i < 2 ? 'sawtooth' : 'triangle';
      o.frequency.value = f;
      o.connect(filter);
      o.start();
      return o;
    });
    lfo.start();
    const roots = [1, 0.891, 0.794, 0.944];
    let step = 0;
    const timer = window.setInterval(() => {
      step = (step + 1) % roots.length;
      const t = ctx.currentTime;
      oscs.forEach((o, i) => o.frequency.setTargetAtTime([55, 55.4, 82.4, 110.2][i] * roots[step], t, 1.5));
    }, 8000);
    this.drone = {
      stop: (): void => {
        window.clearInterval(timer);
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(0, t, 0.4);
        [...oscs, lfo].forEach((o) => o.stop(t + 2));
      },
    };
  }

  private startRumble(): void {
    const ctx = AudioSystem.ctx;
    if (!ctx || this.rumble) return;
    const src = AudioSystem.noiseSource(true);
    if (!src) return;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 110;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    g.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 2);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(lp).connect(g).connect(AudioSystem.musicBus);
    src.start();
    lfo.start();
    this.rumble = {
      stop: (): void => {
        const t = ctx.currentTime;
        g.gain.setTargetAtTime(0, t, 0.3);
        src.stop(t + 1.5);
        lfo.stop(t + 1.5);
      },
    };
  }

  menu(): void {
    AudioSystem.onReady(() => {
      this.rumble?.stop();
      this.rumble = null;
      this.startDrone();
    });
  }

  battle(): void {
    AudioSystem.onReady(() => {
      this.startDrone();
      this.startRumble();
    });
  }

  stopBattle(): void {
    this.rumble?.stop();
    this.rumble = null;
    this.setCapturing(false);
  }

  /** Ethereal looping tone while the player is filling a capture bar. */
  setCapturing(on: boolean): void {
    if (on === this.capturing) return;
    this.capturing = on;
    const ctx = AudioSystem.ctx;
    if (!ctx) return;
    if (on) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(0.12, ctx.currentTime, 0.3);
      const trem = ctx.createGain();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.4;
      lfo.connect(lfoGain).connect(trem.gain);
      trem.connect(gain).connect(AudioSystem.sfxBus);
      const oscs = [660, 663.5, 990].map((f) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        o.connect(trem);
        o.start();
        return o;
      });
      lfo.start();
      this.capture = {
        gain,
        stop: (): void => {
          const t = ctx.currentTime;
          gain.gain.setTargetAtTime(0, t, 0.2);
          [...oscs, lfo].forEach((o) => o.stop(t + 1));
        },
      };
    } else {
      this.capture?.stop();
      this.capture = null;
    }
  }
}

export const Ambience = new AmbienceEngine();
