/** Yandex Games: `/sdk.js` (in index.html) provides `YaGames`. */
import type { Backend, CloudSave, PauseHandler } from './Backend';

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
  }
}

const CLOUD_KEY = 'save';

export async function createYandexBackend(pause: PauseHandler): Promise<Backend> {
  const sdk = await window.YaGames!.init();
  sdk.on?.('game_api_pause', () => pause(true));
  sdk.on?.('game_api_resume', () => pause(false));
  const player = await sdk.getPlayer?.({ scopes: false }).catch(() => null) ?? null;

  return {
    name: 'yandex',
    language: sdk.environment?.i18n?.lang ?? null,
    ready: () => sdk.features?.LoadingAPI?.ready(),
    gameplay: (on) => (on ? sdk.features?.GameplayAPI?.start() : sdk.features?.GameplayAPI?.stop()),
    showInterstitial: (opened) => new Promise((resolve) => {
      if (!sdk.adv) return resolve();
      sdk.adv.showFullscreenAdv({ callbacks: {
        onOpen: opened,
        onClose: () => resolve(),
        onError: () => resolve(),
        onOffline: () => resolve(),
      } });
    }),
    loadSave: async () => {
      if (!player) return null;
      const data = await player.getData([CLOUD_KEY]);
      return (data?.[CLOUD_KEY] as CloudSave | undefined) ?? null;
    },
    storeSave: async (save) => {
      await player?.setData({ [CLOUD_KEY]: save }, true);
    },
    submitScore: async (board, score) => {
      if (sdk.leaderboards) await sdk.leaderboards.setScore(board, score);
      else if (sdk.getLeaderboards) await (await sdk.getLeaderboards()).setLeaderboardScore(board, score);
    },
  };
}
