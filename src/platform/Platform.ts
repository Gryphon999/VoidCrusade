/**
 * The game's side of a web games portal: loading/gameplay markup, holds (ads, the portal's pause, focus
 * loss), fullscreen ads and cloud saves. One build serves every portal; `init()` picks the backend that
 * fits the page (VK by its launch parameters, Yandex by its SDK) and off-portal every call is a no-op,
 * leaving the game on localStorage alone.
 */
import type { Backend, CloudSave } from './Backend';

/** Every localStorage key the game owns starts with this; the cloud copy holds them all. */
const PREFIX = 'voidcrusade.';
const SAVED_AT = `${PREFIX}savedAt`;
const INIT_TIMEOUT_MS = 4000;
const PUSH_DELAY_MS = 1500;

let backend: Backend | null = null;
let readySent = false;
/** The game wants gameplay marked as running (a battle is live and not on the pause menu). */
let wantGameplay = false;
let gameplayOn = false;
/** Why the game is held right now: 'ad', 'platform' (the portal's pause), 'hidden' (tab or window lost). */
const holds = new Set<string>();
const holdListeners: ((h: Hold) => void)[] = [];
let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** What a hold means for the game: losing focus only silences it; an ad or a portal pause freezes it too. */
export interface Hold {
  mute: boolean;
  freeze: boolean;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

function syncGameplay(): void {
  const on = wantGameplay && holds.size === 0;
  if (on === gameplayOn) return;
  gameplayOn = on;
  try {
    backend?.gameplay(on);
  } catch {
    /* markup is best-effort */
  }
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
  const cloud = backend ? await withTimeout(backend.loadSave(), INIT_TIMEOUT_MS).catch(() => null) : null;
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
  if (!backend || !store) return;
  const keys: Record<string, string> = {};
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && k.startsWith(PREFIX) && k !== SAVED_AT) keys[k] = store.getItem(k) ?? '';
  }
  const save: CloudSave = { savedAt: Number(store.getItem(SAVED_AT) ?? Date.now()), keys };
  backend.storeSave(save).catch(() => undefined);
}

/** VK opens a mini app with signed `vk_*` launch parameters in the query string. */
function isVk(): boolean {
  return /[?&]vk_app_id=/.test(window.location.search);
}

export const Platform = {
  /** 'yandex', 'vk', or null off-portal. */
  get name(): string | null {
    return backend?.name ?? null;
  },

  /** The portal's language code (e.g. 'ru', 'en'), when it tells us. */
  get language(): string | null {
    return backend?.language ?? null;
  },

  /** Starts the portal SDK and pulls the cloud save; call before the game reads any settings or saves. */
  async init(): Promise<void> {
    // Sound stops whenever the player leaves the tab or the window (Yandex 1.3).
    const onVisibility = (): void => setHold('hidden', document.hidden || !document.hasFocus());
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onVisibility);
    window.addEventListener('focus', onVisibility);
    // Context menu off the canvas too (the canvas itself is handled by Phaser).
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    const pause = (on: boolean): void => setHold('platform', on);
    try {
      if (isVk()) {
        const { createVkBackend } = await import('./VkBackend');
        backend = await withTimeout(createVkBackend(pause), INIT_TIMEOUT_MS);
      } else if (typeof window.YaGames?.init === 'function') {
        const { createYandexBackend } = await import('./YandexBackend');
        backend = await withTimeout(createYandexBackend(pause), INIT_TIMEOUT_MS);
      }
    } catch {
      backend = null;
    }
    if (backend) await pullCloudSave();
  },

  /** The main menu is up and playable: hides the portal's loading screen (once). */
  ready(): void {
    if (readySent) return;
    readySent = true;
    try {
      backend?.ready();
    } catch {
      /* best-effort */
    }
  },

  /** A battle is live (true) or not: on the pause menu, over, or left (false). */
  setGameplay(on: boolean): void {
    wantGameplay = on;
    syncGameplay();
  },

  /** Called whenever the mute/freeze state changes (ad, portal pause, focus lost and back). */
  onHold(fn: (h: Hold) => void): void {
    holdListeners.push(fn);
  },

  get hold(): Hold {
    return currentHold();
  },

  /** A fullscreen ad between screens (never during a battle); resolves once it is closed or skipped. */
  async showInterstitial(): Promise<void> {
    if (!backend) return;
    try {
      await backend.showInterstitial(() => setHold('ad', true));
    } catch {
      /* no ad this time */
    } finally {
      setHold('ad', false);
    }
  },

  /** Any saved progress changed: stamp it and copy everything to the cloud shortly after. */
  saved(): void {
    storage()?.setItem(SAVED_AT, String(Date.now()));
    if (!backend) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, PUSH_DELAY_MS);
  },

  /** Posts a score to a portal leaderboard, where the portal has one. */
  async submitScore(board: string, score: number): Promise<void> {
    try {
      await backend?.submitScore?.(board, score);
    } catch {
      /* not signed in, or the board is not set up */
    }
  },
};
