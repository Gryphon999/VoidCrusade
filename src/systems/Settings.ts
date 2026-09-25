import { Difficulty, PROJECTION } from '../config';
import type { Lang } from '../i18n';

const KEY = 'voidcrusade.settings.v1';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  difficulty: Difficulty;
  /** Camera tilt (ground squash) for battles. */
  tilt: number;
  graphics: GraphicsQuality;
  screenShake: boolean;
  voiceVolume: number;
  voiceEnabled: boolean;
  /** Subtitles for voice lines; undefined = automatic (on when no voice is installed). */
  subtitles?: boolean;
  /** UI language; undefined until chosen (then auto-detected). */
  language?: Lang;
}

const DEFAULTS: GameSettings = { musicVolume: 0.5, sfxVolume: 0.7, difficulty: 'normal', tilt: PROJECTION.defaultTilt, graphics: 'medium', screenShake: true, voiceVolume: 0.85, voiceEnabled: true };

let current: GameSettings | null = null;
const listeners: ((s: GameSettings) => void)[] = [];

/** Player settings persisted in localStorage. */
export const Settings = {
  get(): GameSettings {
    if (current) return current;
    let loaded: Partial<GameSettings> = {};
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) loaded = JSON.parse(raw) as Partial<GameSettings>;
    } catch {
      /* storage unavailable */
    }
    current = { ...DEFAULTS, ...loaded };
    if (!['easy', 'normal', 'hard'].includes(current.difficulty)) current.difficulty = 'normal';
    if (current.language !== undefined && current.language !== 'en' && current.language !== 'ru') current.language = undefined;
    if (!['low', 'medium', 'high'].includes(current.graphics)) current.graphics = 'medium';
    if (typeof current.tilt !== 'number' || !Number.isFinite(current.tilt)) current.tilt = PROJECTION.defaultTilt;
    return current;
  },

  set(patch: Partial<GameSettings>): void {
    current = { ...Settings.get(), ...patch };
    try {
      window.localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      /* storage unavailable */
    }
    for (const l of listeners) l(current);
  },

  onChange(fn: (s: GameSettings) => void): void {
    listeners.push(fn);
  },
};
