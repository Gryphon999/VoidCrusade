/**
 * Survival records: a top-10 table per map, difficulty and modifier set, kept in localStorage.
 * Pure table logic with an injectable storage so the tests run in Node.
 */
export interface RecordEntry {
  score: number;
  waves: number;
  /** Battle time in seconds. */
  time: number;
  modifiers: string[];
  /** ISO date of the run. */
  date: string;
}

export type RecordTable = RecordEntry[];
export type RecordBook = Record<string, RecordTable>;

export const RECORDS_KEY = 'voidcrusade.records.v1';
export const RECORDS_MAX = 10;

/** One table per map, difficulty and (sorted) modifier set. */
export function recordKey(mapId: string, difficulty: string, modifiers: readonly string[] = []): string {
  const mods = [...modifiers].sort().join('+');
  return `${mapId}|${difficulty}${mods ? `|${mods}` : ''}`;
}

/** Inserts an entry into a table (best first, at most RECORDS_MAX); returns the new table and the 1-based rank, or null. */
export function addRecord(table: RecordTable, entry: RecordEntry): { table: RecordTable; rank: number | null } {
  const out = [...table, entry].sort((a, b) => b.score - a.score || b.waves - a.waves || a.time - b.time).slice(0, RECORDS_MAX);
  const rank = out.indexOf(entry);
  return { table: out, rank: rank >= 0 ? rank + 1 : null };
}

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function storage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadRecords(store: StorageLike | null = storage()): RecordBook {
  try {
    const raw = store?.getItem(RECORDS_KEY);
    if (!raw) return {};
    const book = JSON.parse(raw) as RecordBook;
    return book && typeof book === 'object' ? book : {};
  } catch {
    return {};
  }
}

export function saveRecords(book: RecordBook, store: StorageLike | null = storage()): void {
  try {
    store?.setItem(RECORDS_KEY, JSON.stringify(book));
  } catch {
    /* storage unavailable: records last for this session only */
  }
}

/** Records a finished survival run: returns its rank in the table (1-based) or null if it did not enter it. */
export function recordRun(mapId: string, difficulty: string, modifiers: readonly string[], entry: Omit<RecordEntry, 'date' | 'modifiers'>, store: StorageLike | null = storage()): { rank: number | null; table: RecordTable } {
  const book = loadRecords(store);
  const key = recordKey(mapId, difficulty, modifiers);
  const full: RecordEntry = { ...entry, modifiers: [...modifiers].sort(), date: new Date().toISOString().slice(0, 10) };
  const { table, rank } = addRecord(book[key] ?? [], full);
  book[key] = table;
  saveRecords(book, store);
  submitYandex(entry.score);
  return { rank, table };
}

/** Best entry of every table, for the records panel. */
export function bestRecords(book: RecordBook): { key: string; mapId: string; difficulty: string; modifiers: string[]; best: RecordEntry }[] {
  return Object.entries(book)
    .filter(([, t]) => t.length)
    .map(([key, t]) => {
      const [mapId, difficulty, mods] = key.split('|');
      return { key, mapId, difficulty, modifiers: mods ? mods.split('+') : [], best: t[0] };
    })
    .sort((a, b) => b.best.score - a.best.score);
}

/** Yandex Games leaderboard, when the SDK is on the page (best effort). */
function submitYandex(score: number): void {
  try {
    const sdk = (window as unknown as { ysdk?: { getLeaderboards?: () => Promise<{ setLeaderboardScore(name: string, score: number): Promise<void> }> } }).ysdk;
    sdk?.getLeaderboards?.().then((lb) => lb.setLeaderboardScore('survival', Math.round(score))).catch(() => undefined);
  } catch {
    /* no SDK */
  }
}
