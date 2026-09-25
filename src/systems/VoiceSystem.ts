import { MessageKey, getLanguage, onLanguageChange, t } from '../i18n';
import { Settings } from './Settings';

/** Who is speaking: sets pitch/rate so heroes sound deep and slow, troopers clipped. */
export type Speaker = 'rifleman' | 'heavy' | 'commander' | 'announcer' | 'ranger' | 'breacher' | 'marksman' | 'engineer' | 'crew';

/** Priority categories: higher interrupts lower; each has its own cooldown. */
export type VoiceCategory = 'ack' | 'event' | 'alert';

const PROFILE: Record<Speaker, { pitch: number; rate: number }> = {
  rifleman: { pitch: 0.85, rate: 1.02 },
  heavy: { pitch: 0.7, rate: 0.92 },
  commander: { pitch: 0.55, rate: 0.84 },
  announcer: { pitch: 0.75, rate: 0.95 },
  ranger: { pitch: 0.95, rate: 1.1 },
  breacher: { pitch: 0.62, rate: 0.96 },
  marksman: { pitch: 0.8, rate: 0.86 },
  engineer: { pitch: 0.9, rate: 1.0 },
  crew: { pitch: 0.72, rate: 1.04 },
};
const PRIORITY: Record<VoiceCategory, number> = { ack: 1, event: 2, alert: 3 };
const COOLDOWN_MS: Record<VoiceCategory, number> = { ack: 900, event: 2500, alert: 6000 };
/** Voice names that are usually male, per language (heuristic). */
const MALE_HINTS = /male|pavel|dmitr|yuri|maxim|aleksandr|alexander|ivan|david|mark|guy|daniel|alex|fred|george|ryan|thomas|james|artem|boris/i;
const FEMALE_HINTS = /female|irina|svetlana|milena|elena|katya|anna|zira|susan|samantha|victoria|karen|moira|tessa|hazel|catherine/i;

interface Line {
  text: string;
  speaker: Speaker;
  category: VoiceCategory;
  subtitle: boolean;
}

type Listener = (text: string | null, speaker: Speaker) => void;

/**
 * Voice-over through the browser's built-in speechSynthesis (no audio files).
 * At most one line plays at a time; higher-priority lines cancel lower ones,
 * and every category has a cooldown so alerts are never spammed.
 */
class VoiceEngine {
  private synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  private voices: SpeechSynthesisVoice[] = [];
  private chosen = new Map<string, SpeechSynthesisVoice | null>();
  private current: Line | null = null;
  private queued: Line | null = null;
  private lastAt: Record<VoiceCategory, number> = { ack: 0, event: 0, alert: 0 };
  private lastText = new Map<string, number>();
  private subtitleListeners = new Set<Listener>();
  private duckListeners = new Set<(speaking: boolean) => void>();
  private paused = false;

  constructor() {
    if (!this.synth) return;
    const load = (): void => {
      this.voices = this.synth?.getVoices() ?? [];
      this.chosen.clear();
    };
    load();
    this.synth.addEventListener?.('voiceschanged', load);
    onLanguageChange(() => this.stop());
    window.addEventListener('blur', () => this.stop());
  }

  get supported(): boolean {
    return !!this.synth;
  }

  /** Best voice for the current language: prefer a local male voice, cached per language. */
  voiceFor(lang = getLanguage()): SpeechSynthesisVoice | null {
    if (this.chosen.has(lang)) return this.chosen.get(lang) ?? null;
    const code = lang === 'ru' ? 'ru' : 'en';
    const all = this.voices.filter((v) => v.lang.toLowerCase().startsWith(code));
    const score = (v: SpeechSynthesisVoice): number =>
      (MALE_HINTS.test(v.name) ? 4 : 0) - (FEMALE_HINTS.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0)
      + (lang === 'en' && /en-(us|gb)/i.test(v.lang) ? 1 : 0);
    const best = all.sort((a, b) => score(b) - score(a))[0] ?? null;
    if (this.voices.length) this.chosen.set(lang, best);
    return best;
  }

  /** True when a voice for the current language exists (voices may still be loading). */
  hasVoice(): boolean {
    return !!this.voiceFor();
  }

  /** Whether subtitles should show: explicit setting, otherwise only when we cannot speak. */
  subtitlesOn(): boolean {
    const s = Settings.get();
    return s.subtitles ?? (!s.voiceEnabled || !this.hasVoice());
  }

  onSubtitle(fn: Listener): () => void {
    this.subtitleListeners.add(fn);
    return () => this.subtitleListeners.delete(fn);
  }

  /** Music ducking hook: called with true when a line starts and false when it ends. */
  onSpeaking(fn: (speaking: boolean) => void): void {
    this.duckListeners.add(fn);
  }

  /** Says a (random variant of a) voice line. Returns false if skipped by cooldown/priority. */
  say(key: MessageKey, speaker: Speaker = 'announcer', category: VoiceCategory = 'event', subtitle = category !== 'ack'): boolean {
    const variants = t(key).split('|');
    const text = variants[Math.floor(Math.random() * variants.length)];
    const now = performance.now();
    if (now - this.lastAt[category] < COOLDOWN_MS[category]) return false;
    // The same alert never repeats within 15 s.
    if (category !== 'ack' && now - (this.lastText.get(key) ?? -1e9) < 15000) return false;
    const line: Line = { text, speaker, category, subtitle };
    if (this.current) {
      if (PRIORITY[category] > PRIORITY[this.current.category]) {
        this.queued = null;
        this.synth?.cancel();
        this.current = null;
      } else {
        if (category !== 'ack' && (!this.queued || PRIORITY[category] >= PRIORITY[this.queued.category])) this.queued = line;
        return false;
      }
    }
    this.lastAt[category] = now;
    this.lastText.set(key, now);
    this.play(line);
    return true;
  }

  private play(line: Line): void {
    this.current = line;
    const s = Settings.get();
    if (line.subtitle || this.subtitlesOn()) for (const fn of this.subtitleListeners) fn(line.text, line.speaker);
    const voice = this.voiceFor();
    if (!this.synth || !s.voiceEnabled || !voice || this.paused) {
      // No speech: keep the subtitle up for a readable time, then continue the queue.
      window.setTimeout(() => this.finish(line), 1200 + line.text.length * 45);
      return;
    }
    const u = new SpeechSynthesisUtterance(line.text);
    const p = PROFILE[line.speaker];
    u.voice = voice;
    u.lang = voice.lang;
    u.pitch = p.pitch;
    u.rate = p.rate;
    u.volume = Math.max(0, Math.min(1, s.voiceVolume));
    u.onstart = () => this.duck(true);
    u.onend = () => this.finish(line);
    u.onerror = () => this.finish(line);
    this.synth.speak(u);
  }

  private finish(line: Line): void {
    if (this.current !== line) return;
    this.current = null;
    this.duck(false);
    for (const fn of this.subtitleListeners) fn(null, line.speaker);
    const next = this.queued;
    this.queued = null;
    if (next) this.play(next);
  }

  private duck(on: boolean): void {
    for (const fn of this.duckListeners) fn(on);
  }

  /** Silences everything (game paused, window blurred, language changed). */
  stop(): void {
    this.queued = null;
    const cur = this.current;
    this.current = null;
    this.synth?.cancel();
    this.duck(false);
    if (cur) for (const fn of this.subtitleListeners) fn(null, cur.speaker);
  }

  setPaused(p: boolean): void {
    this.paused = p;
    if (p) this.stop();
  }
}

export const Voice = new VoiceEngine();
