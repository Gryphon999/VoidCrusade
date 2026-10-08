/** Everything the game keeps, as one cloud record: all `voidcrusade.*` localStorage keys and when they changed. */
export interface CloudSave {
  savedAt: number;
  keys: Record<string, string>;
}

/** One games portal (Yandex Games, VK Games) behind `Platform`. */
export interface Backend {
  name: string;
  /** The portal's language code, if it tells us. */
  language: string | null;
  /** Loading is over; the player can play. */
  ready(): void;
  /** Gameplay starts (true) or stops (false). */
  gameplay(on: boolean): void;
  /** Shows a fullscreen ad; calls `opened` once it covers the game; resolves when it is gone (or never came). */
  showInterstitial(opened: () => void): Promise<void>;
  loadSave(): Promise<CloudSave | null>;
  storeSave(save: CloudSave): Promise<void>;
  submitScore?(board: string, score: number): Promise<void>;
}

/** The portal asks the game to pause (true) or go on (false). */
export type PauseHandler = (paused: boolean) => void;
