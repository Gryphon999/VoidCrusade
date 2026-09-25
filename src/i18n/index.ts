import { en, MessageKey } from './en';
import { ru } from './ru';

export type Lang = 'en' | 'ru';
export type { MessageKey };

const DICTS: Record<Lang, Record<MessageKey, string>> = { en, ru };
/** Languages that default to Russian (CIS region). */
const RU_REGION = ['ru', 'uk', 'be', 'kk', 'uz', 'ky', 'tg', 'hy', 'az', 'tk', 'mo'];

let current: Lang = 'en';
const listeners = new Set<(l: Lang) => void>();

interface YandexEnv {
  ysdk?: { environment?: { i18n?: { lang?: string } } };
}

/** Yandex Games SDK language if present, else the browser language; CIS languages map to Russian. */
export function detectLanguage(): Lang {
  let code = '';
  try {
    code = (window as unknown as YandexEnv).ysdk?.environment?.i18n?.lang ?? '';
  } catch {
    code = '';
  }
  if (!code) code = navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
  const base = code.toLowerCase().split(/[-_]/)[0];
  return RU_REGION.includes(base) ? 'ru' : 'en';
}

export function getLanguage(): Lang {
  return current;
}

export function setLanguage(l: Lang): void {
  if (l === current) return;
  current = l;
  document.documentElement.lang = l;
  for (const fn of listeners) fn(l);
}

/** Subscribes to language changes; returns an unsubscribe function. */
export function onLanguageChange(fn: (l: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Translates a key, filling `{name}` placeholders. Falls back to English, then to the key. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let s = DICTS[current][key] ?? en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Picks a plural form: English "one|other", Russian "one|few|many" (1 отряд / 2 отряда / 5 отрядов). */
export function plural(n: number, key: MessageKey): string {
  const forms = t(key).split('|');
  let i: number;
  if (current === 'ru') {
    const m10 = n % 10;
    const m100 = n % 100;
    i = m10 === 1 && m100 !== 11 ? 0 : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 1 : 2;
  } else {
    i = n === 1 ? 0 : 1;
  }
  return `${n} ${forms[Math.min(i, forms.length - 1)]}`;
}

/** Heading font: blackletter for Latin text, a Cyrillic-capable serif for Russian. */
export function headingFont(): string {
  return current === 'ru'
    ? 'Georgia, "Times New Roman", "PT Serif", serif'
    : '"UnifrakturMaguntia", "Old English Text MT", "Blackletter", Georgia, serif';
}

/** Returns `key` if it exists in the dictionary (for dynamic keys like unit names). */
export function dyn(key: string): MessageKey {
  return key as MessageKey;
}
