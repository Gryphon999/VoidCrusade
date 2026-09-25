import { AudioSystem } from './AudioSystem';
import { Music } from './Music';

interface Voice {
  stop: () => void;
}

/** Looping ambience: distant battle rumble and the capture tone; the score itself lives in Music. */
class AmbienceEngine {
  private rumble: Voice | null = null;
  private capture: { gain: GainNode; stop: () => void } | null = null;
  private capturing = false;

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
    });
    Music.play('menu');
  }

  campaign(): void {
    this.menu();
    Music.play('campaign');
  }

  battle(): void {
    AudioSystem.onReady(() => this.startRumble());
    Music.play('battle');
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
