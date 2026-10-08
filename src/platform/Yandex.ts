/**
 * Yandex Games integration: SDK start-up, the loading/gameplay markup, pausing on the platform's request
 * and on focus loss, fullscreen ads, and cloud saves. index.html includes `/sdk.js`; off Yandex (dev server,
 * GitHub Pages) it is missing, every call quietly does nothing and the game runs on localStorage alone.
 */

interface YPlayer {
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
}

interface YSDK {
  environment?: { i18n?: { lang?: string } };
  features?: {
    LoadingAPI?: { ready(): void };
    GameplayAPI?: { start(): void; stop(): void };
  };
  adv?: {
    showFullscreenAdv(opts: { callbacks: {
      onOpen?: () => void;
      onClose?: (wasShown: boolean) => void;
      onError?: (e: unknown) => void;
      onOffline?: () => void;
    } }): void;
  };
  leaderboards?: { setScore(name: string, score: number): Promise<void> };
  getLeaderboards?: () => Promise<{ setLeaderboardScore(name: string, score: number): Promise<void> }>;
  getPlayer?(opts?: { scopes?: boolean }): Promise<YPlayer>;
  on?(event: string, fn: () => void): void;
}

declare global {
  interface Window {
    YaGames?: { init(): Promise<YSDK> };
    ysdk?: YSDK;
  }
}

/** Every localStorage key the game owns starts with this; the cloud copy holds them all. */
const PREFIX = 'voidcrusade.';
const SAVED_AT = `${PREFIX}savedAt`;
const CLOUD_KEY = 'save';
const SDK_TIMEOUT_MS = 4000;
const PUSH_DELAY_MS = 1500;

let sdk: YSDK | null = null;
let player: YPlayer | null = null;
let readySent = false;
/** The game wants gameplay marked as running (a battle is live and not on the pause menu). */
let wantGameplay = false;
let gameplayOn = false;
/** Why the game is held right now: 'ad', 'platform' (game_api_pause), 'hidden' (tab or window lost). */
const holds = new Set<string>();
const holdListeners: ((h: Hold) => void)[] = [];
let pushTimer: ReturnType<typeof setTimeout> | null = null;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

function syncGameplay(): void {
  const on = wantGameplay && holds.size === 0;
  if (on === gameplayOn) return;
  gameplayOn = on;
  try {
    if (on) sdk?.features?.GameplayAPI?.start();
    else sdk?.features?.GameplayAPI?.stop();
  } catch {
    /* markup is best-effort */
  }
}

/** What a hold means for the game: losing focus only silences it; an ad or a platform pause freezes it too. */
export interface Hold {
  mute: boolean;
  freeze: boolean;
}

function currentHold(): Hold {
  return { mute: holds.size > 0, freeze: holds.has('ad') || holds.has('platform') };
}

function setHold(reason: string, on: boolean): void {
  const before = currentHold();
  if (on) holds.add(reason);
  else holds.delete(reason);
  const after = currentHold();
  syncGameplay();
  if (before.mute !== after.mute || before.freeze !== after.freeze) for (const fn of holdListeners) fn(after);
}

/** Cloud copy wins only when it is newer than this device's (another device, or a cleared browser). */
async function pullCloudSave(): Promise<void> {
  if (!player) return;
  const data = await withTimeout(player.getData([CLOUD_KEY]), SDK_TIMEOUT_MS);
  const cloud = data?.[CLOUD_KEY] as { savedAt?: number; keys?: Record<string, string> } | undefined;
  const store = storage();
  if (!cloud?.keys || !store) return;
  const localAt = Number(store.getItem(SAVED_AT) ?? 0);
  if ((cloud.savedAt ?? 0) <= localAt) return;
  for (const [k, v] of Object.entries(cloud.keys)) if (k.startsWith(PREFIX)) store.setItem(k, v);
  store.setItem(SAVED_AT, String(cloud.savedAt));
}

function pushNow(): void {
  pushTimer = null;
  const store = storage();
  if (!player || !store) return;
  const keys: Record<string, string> = {};
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && k.startsWith(PREFIX) && k !== SAVED_AT) keys[k] = store.getItem(k) ?? '';
  }
  const savedAt = Number(store.getItem(SAVED_AT) ?? Date.now());
  player.setData({ [CLOUD_KEY]: { savedAt, keys } }, true).catch(() => undefined);
}

export const Platform = {
  get isYandex(): boolean {
    return sdk !== null;
  },

  /** Starts the SDK and pulls the cloud save; call before the game reads any settings or saves. */
  async init(): Promise<void> {
    // Sound and gameplay stop whenever the player leaves the tab or the window (requirement 1.3).
    const onVisibility = (): void => setHold('hidden', document.hidden || !document.hasFocus());
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onVisibility);
    window.addEventListener('focus', onVisibility);

    // Context menu off the canvas too (the canvas itself is handled by Phaser).
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    if (typeof window.YaGames?.init !== 'function') return;
    sdk = await withTimeout(window.YaGames.init(), SDK_TIMEOUT_MS).catch(() => null);
    if (!sdk) return;
    window.ysdk = sdk;
    sdk.on?.('game_api_pause', () => setHold('platform', true));
    sdk.on?.('game_api_resume', () => setHold('platform', false));
    try {
      player = (await withTimeout(sdk.getPlayer?.({ scopes: false }) ?? Promise.resolve(null), SDK_TIMEOUT_MS)) ?? null;
      await pullCloudSave();
    } catch {
      player = null;
    }
  },

  /** The main menu is up and playable: hides the platform's loading screen (once). */
  ready(): void {
    if (readySent) return;
    readySent = true;
    try {
      sdk?.features?.LoadingAPI?.ready();
    } catch {
      /* not on Yandex */
    }
  },

  /** A battle is live (true) or not: on the pause menu, over, or left (false). */
  setGameplay(on: boolean): void {
    wantGameplay = on;
    syncGameplay();
  },

  /** Called whenever the mute/freeze state changes (ad, platform pause, focus lost and back). */
  onHold(fn: (h: Hold) => void): void {
    holdListeners.push(fn);
  },

  get hold(): Hold {
    return currentHold();
  },

  /** A fullscreen ad between screens (never during a battle); resolves once it is closed or skipped. */
  showInterstitial(): Promise<void> {
    const adv = sdk?.adv;
    if (!adv) return Promise.resolve();
    return new Promise((resolve) => {
      const done = (): void => {
        setHold('ad', false);
        resolve();
      };
      try {
        adv.showFullscreenAdv({ callbacks: {
          onOpen: () => setHold('ad', true),
          onClose: done,
          onError: done,
          onOffline: done,
        } });
      } catch {
        done();
      }
    });
  },

  /** Any saved progress changed: stamp it and copy everything to the cloud shortly after. */
  saved(): void {
    storage()?.setItem(SAVED_AT, String(Date.now()));
    if (!player) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, PUSH_DELAY_MS);
  },

  /** Posts a score to a leaderboard (new `leaderboards` API, or the older `getLeaderboards`). */
  async submitScore(board: string, score: number): Promise<void> {
    if (!sdk) return;
    try {
      if (sdk.leaderboards) await sdk.leaderboards.setScore(board, score);
      else if (sdk.getLeaderboards) await (await sdk.getLeaderboards()).setLeaderboardScore(board, score);
    } catch {
      /* not signed in, or the board is not set up in the console */
    }
  },
};
