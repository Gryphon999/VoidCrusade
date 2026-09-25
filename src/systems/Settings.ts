import { Difficulty } from '../config';

const KEY = 'voidcrusade.settings.v1';

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  difficulty: Difficulty;
}

const DEFAULTS: GameSettings = { musicVolume: 0.5, sfxVolume: 0.7, difficulty: 'normal' };

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
