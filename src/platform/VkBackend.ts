/**
 * VK Games (a VK mini app): VK Bridge. VK has no loading/gameplay markup; it hides and restores the app
 * view, shows interstitials through VKWebAppShowNativeAds, and keeps per-user key-value storage
 * (values up to 4096 bytes), so the cloud save is split across numbered keys.
 */
import bridge from '@vkontakte/vk-bridge';
import type { Backend, CloudSave, PauseHandler } from './Backend';

const KEY_COUNT = 'save_n';
const KEY_PART = 'save_';
/** Characters per stored part: 1000 UTF-16 units never exceed VK's 4096-byte value limit. */
const PART = 1000;
/** Parts read at most (~40 KB of save). */
const MAX_PARTS = 40;

export function splitSave(json: string): string[] {
  const parts: string[] = [];
  for (let i = 0; i < json.length; i += PART) parts.push(json.slice(i, i + PART));
  return parts;
}

export async function createVkBackend(pause: PauseHandler): Promise<Backend> {
  await bridge.send('VKWebAppInit');
  bridge.subscribe((e) => {
    if (e.detail.type === 'VKWebAppViewHide') pause(true);
    else if (e.detail.type === 'VKWebAppViewRestore') pause(false);
  });
  const lang = new URLSearchParams(window.location.search).get('vk_language');

  return {
    name: 'vk',
    language: lang,
    ready: () => undefined,
    gameplay: () => undefined,
    showInterstitial: async (opened) => {
      const check = await bridge.send('VKWebAppCheckNativeAds', { ad_format: 'interstitial' }).catch(() => null);
      if (!check?.result) return;
      opened();
      await bridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' }).catch(() => null);
    },
    loadSave: async () => {
      const head = await bridge.send('VKWebAppStorageGet', { keys: [KEY_COUNT] });
      const n = Math.min(MAX_PARTS, Number(head.keys.find((k) => k.key === KEY_COUNT)?.value ?? 0));
      if (!n) return null;
      const keys = Array.from({ length: n }, (_, i) => `${KEY_PART}${i}`);
      const res = await bridge.send('VKWebAppStorageGet', { keys });
      const byKey = new Map(res.keys.map((k) => [k.key, k.value]));
      const json = keys.map((k) => byKey.get(k) ?? '').join('');
      try {
        return JSON.parse(json) as CloudSave;
      } catch {
        return null;
      }
    },
    storeSave: async (save) => {
      const parts = splitSave(JSON.stringify(save));
      if (parts.length > MAX_PARTS) return;
      // Parts first, the count last: a reader never sees a count ahead of its parts.
      for (let i = 0; i < parts.length; i++) await bridge.send('VKWebAppStorageSet', { key: `${KEY_PART}${i}`, value: parts[i] });
      await bridge.send('VKWebAppStorageSet', { key: KEY_COUNT, value: String(parts.length) });
    },
  };
}
