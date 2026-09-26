import { Difficulty, PROJECTION } from '../config';
import type { Lang } from '../i18n';
import type { WargearPick } from '../campaign/Wargear';

const KEY = 'voidcrusade.settings.v1';

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';
/** Battlefield renderer: auto = 3D when WebGL2 is available, else the classic 2D view. */
export type RendererChoice = 'auto' | '3d' | '2d';

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  difficulty: Difficulty;
  /** Camera tilt (ground squash) for battles. */
  tilt: number;
  graphics: GraphicsQuality;
  renderer?: RendererChoice;
  /** 3D render resolution scale (0.5–1). */
  resolutionScale?: number;
  showFps?: boolean;
  /** Lower the tier automatically when the frame rate stays low. */
  adaptiveQuality?: boolean;
  screenShake: boolean;
  voiceVolume: number;
  voiceEnabled: boolean;
  /** Subtitles for voice lines; undefined = automatic (on when no voice is installed). */
  subtitles?: boolean;
  /** UI language; undefined until chosen (then auto-detected). */
  language?: Lang;
  /** Last skirmish setup choices. */
  skirmishMode?: string;
  skirmishPersonality?: string;
  skirmishStorms?: boolean;
  /** Last commander wargear loadout. */
  wargear?: WargearPick;
  /** Contextual hint toasts (C5). */
  hints?: boolean;
  /** Hint ids already shown once. */
  hintsSeen?: string[];
  /** First-run tutorial prompt already shown. */
  tutorialPrompted?: boolean;
}

const DEFAULTS: GameSettings = { masterVolume: 0.85, musicVolume: 0.5, sfxVolume: 0.7, difficulty: 'normal', tilt: PROJECTION.defaultTilt, graphics: 'medium', screenShake: true, voiceVolume: 0.85, voiceEnabled: true };

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
    if (!['easy', 'normal', 'hard', 'brutal'].includes(current.difficulty)) current.difficulty = 'normal';
    if (current.language !== undefined && current.language !== 'en' && current.language !== 'ru') current.language = undefined;
    if (!['low', 'medium', 'high', 'ultra'].includes(current.graphics)) current.graphics = 'medium';
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
