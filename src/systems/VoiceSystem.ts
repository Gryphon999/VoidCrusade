import { MessageKey, getLanguage, onLanguageChange, t } from '../i18n';
import { Settings } from './Settings';
import { Speaker, VoiceManifest, voiceFile, voiceHash, voiceId } from './VoiceCast';

export type { Speaker };

/** Priority categories: higher interrupts lower; each has its own cooldown. */
export type VoiceCategory = 'chatter' | 'ack' | 'event' | 'alert';

/** Pitch and rate for the speech-synthesis fallback, so heroes sound deep and slow, troopers clipped. */
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
const PRIORITY: Record<VoiceCategory, number> = { chatter: 0, ack: 1, event: 2, alert: 3 };
const COOLDOWN_MS: Record<VoiceCategory, number> = { chatter: 3500, ack: 900, event: 2500, alert: 6000 };
/** Battle chatter: the same shout never repeats within this window. */
const CHATTER_REPEAT_MS = 9000;
/** Every take plays a little higher or lower (and faster or slower), so repeats do not sound canned. */
const PITCH_SPREAD = 0.07;
/** Voice names that are usually male, per language (heuristic). */
const MALE_HINTS = /male|pavel|dmitr|yuri|maxim|aleksandr|alexander|ivan|david|mark|guy|daniel|alex|fred|george|ryan|thomas|james|artem|boris/i;
const FEMALE_HINTS = /female|irina|svetlana|milena|elena|katya|anna|zira|susan|samantha|victoria|karen|moira|tessa|hazel|catherine/i;

interface Line {
  key: string;
  variant: number;
  text: string;
  speaker: Speaker;
  category: VoiceCategory;
  subtitle: boolean;
}

type Listener = (text: string | null, speaker: Speaker) => void;

/**
 * Voice-over. Lines are recorded files (`voice/<lang>/<speaker>/<key>.<n>.mp3`, made by
 * `npm run voice`); a line without a current recording is spoken by the browser's
 * speechSynthesis instead, and shown as a subtitle when that is missing too.
 * At most one line plays at a time; higher-priority lines cancel lower ones,
 * and every category has a cooldown so alerts are never spammed.
 */
class VoiceEngine {
  private synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  private voices: SpeechSynthesisVoice[] = [];
  private chosen = new Map<string, SpeechSynthesisVoice | null>();
  private manifest: VoiceManifest | null = null;
  private clips = new Map<string, HTMLAudioElement>();
  private playing: HTMLAudioElement | null = null;
  private current: Line | null = null;
  private queued: Line | null = null;
  private lastAt: Record<VoiceCategory, number> = { chatter: 0, ack: 0, event: 0, alert: 0 };
  private lastText = new Map<string, number>();
  private lastVariant = new Map<string, number>();
  private subtitleListeners = new Set<Listener>();
  private duckListeners = new Set<(speaking: boolean) => void>();
  private paused = false;

  constructor() {
    if (typeof window === 'undefined') return;
    void this.loadManifest();
    onLanguageChange(() => this.stop());
    window.addEventListener('blur', () => this.stop());
    Settings.onChange(() => {
      if (this.playing) this.playing.volume = this.volume();
    });
    if (!this.synth) return;
    const load = (): void => {
      this.voices = this.synth?.getVoices() ?? [];
      this.chosen.clear();
    };
    load();
    this.synth.addEventListener?.('voiceschanged', load);
  }

  private async loadManifest(): Promise<void> {
    try {
      const res = await fetch('voice/manifest.json');
      if (res.ok) this.manifest = (await res.json()) as VoiceManifest;
    } catch {
      /* no voice pack: speech synthesis and subtitles remain */
    }
  }

  private volume(): number {
    const s = Settings.get();
    return Math.max(0, Math.min(1, s.voiceVolume * s.masterVolume));
  }

  /** Path of the recording for this exact text, or null when there is none (or it is out of date). */
  private recording(speaker: Speaker, key: string, variant: number, text: string): string | null {
    const lang = getLanguage();
    const hash = this.manifest?.[lang]?.[voiceId(speaker, key)]?.[variant];
    return hash && hash === voiceHash(text) ? voiceFile(lang, speaker, key, variant) : null;
  }

  private clip(url: string): HTMLAudioElement {
    let a = this.clips.get(url);
    if (!a) {
      a = new Audio(url);
      a.preload = 'auto';
      this.clips.set(url, a);
    }
    return a;
  }

  /** Fetches a speaker's recordings ahead of time so the first order is answered without a delay. */
  preload(speaker: Speaker, keys: MessageKey[]): void {
    for (const key of keys) {
      t(key).split('|').forEach((text, i) => {
        const url = this.recording(speaker, key, i, text);
        if (url) this.clip(url).load();
      });
    }
  }

  /** True when recorded lines exist for the current language. */
  hasRecordings(): boolean {
    return !!this.manifest && Object.keys(this.manifest[getLanguage()] ?? {}).length > 0;
  }

  get supported(): boolean {
    return !!this.synth || this.hasRecordings();
  }

  /** Best synthesis voice for the current language: prefer a local male voice, cached per language. */
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

  /** True when the current language can be spoken: by recordings or by a synthesis voice. */
  hasVoice(): boolean {
    return this.hasRecordings() || !!this.voiceFor();
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

  /** A random variant, never the one this speaker used for this line last time. */
  private pick(id: string, count: number): number {
    const last = this.lastVariant.get(id);
    let i = Math.floor(Math.random() * count);
    if (count > 1 && i === last) i = (i + 1 + Math.floor(Math.random() * (count - 1))) % count;
    this.lastVariant.set(id, i);
    return i;
  }

  /** Says a (random variant of a) voice line. Returns false if skipped by cooldown/priority. */
  say(key: MessageKey, speaker: Speaker = 'announcer', category: VoiceCategory = 'event', subtitle = category !== 'ack'): boolean {
    const text = t(key);
    // A line without text (e.g. a Horde unit, which has no recorded lines) is silence, not its key read aloud.
    if (text === key) return false;
    const variants = text.split('|');
    const now = performance.now();
    if (now - this.lastAt[category] < COOLDOWN_MS[category]) return false;
    // The same alert never repeats within 15 s.
    if (category !== 'ack' && now - (this.lastText.get(key) ?? -1e9) < (category === 'chatter' ? CHATTER_REPEAT_MS : 15000)) return false;
    // Chatter only fills silence: it never interrupts or queues behind another line.
    if (category === 'chatter' && this.current) return false;
    const variant = this.pick(voiceId(speaker, key), variants.length);
    const line: Line = { key, variant, text: variants[variant], speaker, category, subtitle };
    if (this.current) {
      if (PRIORITY[category] > PRIORITY[this.current.category]) {
        this.queued = null;
        this.silence();
        this.current = null;
      } else {
        if (category !== 'ack' && category !== 'chatter' && (!this.queued || PRIORITY[category] >= PRIORITY[this.queued.category])) this.queued = line;
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
    if (!s.voiceEnabled || this.paused) return this.readOnly(line);
    const url = this.recording(line.speaker, line.key, line.variant, line.text);
    if (url) this.playClip(line, url);
    else this.speak(line);
  }

  /** No speech: keep the subtitle up for a readable time, then continue the queue. */
  private readOnly(line: Line): void {
    window.setTimeout(() => this.finish(line), 1200 + line.text.length * 45);
  }

  private playClip(line: Line, url: string): void {
    const a = this.clip(url);
    this.playing = a;
    a.volume = this.volume();
    a.currentTime = 0;
    a.preservesPitch = false;
    a.playbackRate = 1 + (Math.random() * 2 - 1) * PITCH_SPREAD;
    a.onplaying = () => this.duck(true);
    a.onended = () => this.finish(line);
    // A file that fails to load or play is spoken by the synthesiser instead.
    a.onerror = () => this.fallback(line, a);
    a.play().catch(() => this.fallback(line, a));
  }

  private fallback(line: Line, a: HTMLAudioElement): void {
    if (this.playing === a) this.playing = null;
    if (this.current === line) this.speak(line);
  }

  private speak(line: Line): void {
    const voice = this.voiceFor();
    if (!this.synth || !voice) return this.readOnly(line);
    const u = new SpeechSynthesisUtterance(line.text);
    const p = PROFILE[line.speaker];
    u.voice = voice;
    u.lang = voice.lang;
    u.pitch = p.pitch;
    u.rate = p.rate;
    u.volume = Math.max(0, Math.min(1, Settings.get().voiceVolume));
    u.onstart = () => this.duck(true);
    u.onend = () => this.finish(line);
    u.onerror = () => this.finish(line);
    this.synth.speak(u);
  }

  private silence(): void {
    const a = this.playing;
    this.playing = null;
    if (a) {
      a.onended = null;
      a.onerror = null;
      a.onplaying = null;
      a.pause();
    }
    this.synth?.cancel();
  }

  private finish(line: Line): void {
    if (this.current !== line) return;
    this.current = null;
    this.playing = null;
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
    this.silence();
    this.duck(false);
    if (cur) for (const fn of this.subtitleListeners) fn(null, cur.speaker);
  }

  setPaused(p: boolean): void {
    this.paused = p;
    if (p) this.stop();
  }
}

export const Voice = new VoiceEngine();
