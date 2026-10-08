/** Survival records: table order, cap, rank, keys and storage round-trip. Runs in Node without Phaser. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECORDS_MAX, RecordEntry, addRecord, bestRecords, loadRecords, recordKey, recordRun, saveRecords } from '../src/battle/Records';

const entry = (score: number, waves = 1, time = 100): RecordEntry => ({ score, waves, time, modifiers: [], date: '2026-10-07' });

/** An in-memory stand-in for localStorage. */
function fakeStore(): { getItem(k: string): string | null; setItem(k: string, v: string): void; data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

test('the table is best first, capped, and ranks a new run', () => {
  let table: RecordEntry[] = [];
  for (let i = 1; i <= 12; i++) table = addRecord(table, entry(i * 100)).table;
  assert.equal(table.length, RECORDS_MAX);
  assert.equal(table[0].score, 1200);
  assert.equal(table[RECORDS_MAX - 1].score, 300);
  const { rank } = addRecord(table, entry(650));
  assert.equal(rank, 7, 'behind 1200…700');
  assert.equal(addRecord(table, entry(10)).rank, null, 'too low to enter');
  // Ties: more waves first, then the faster run.
  const tie = addRecord([entry(500, 5, 300)], entry(500, 5, 200));
  assert.equal(tie.rank, 1);
});

test('keys separate maps, difficulties and modifier sets, whatever the modifier order', () => {
  assert.equal(recordKey('ashfall', 'hard', ['night', 'storms']), recordKey('ashfall', 'hard', ['storms', 'night']));
  assert.notEqual(recordKey('ashfall', 'hard'), recordKey('ashfall', 'normal'));
  assert.notEqual(recordKey('ashfall', 'hard'), recordKey('ashfall', 'hard', ['night']));
  assert.notEqual(recordKey('ashfall', 'hard'), recordKey('veyra', 'hard'));
});

test('runs are stored and read back; the best of each table is listed best first', () => {
  const store = fakeStore();
  assert.deepEqual(loadRecords(store), {});
  const a = recordRun('ashfall', 'hard', [], { score: 900, waves: 9, time: 400 }, store);
  assert.equal(a.rank, 1);
  const b = recordRun('ashfall', 'hard', [], { score: 1500, waves: 14, time: 700 }, store);
  assert.equal(b.rank, 1);
  const c = recordRun('veyra', 'normal', ['night'], { score: 300, waves: 3, time: 120 }, store);
  assert.equal(c.rank, 1);
  const book = loadRecords(store);
  assert.equal(book[recordKey('ashfall', 'hard')].length, 2);
  assert.equal(book[recordKey('ashfall', 'hard')][0].score, 1500);
  const best = bestRecords(book);
  assert.deepEqual(best.map((x) => x.mapId), ['ashfall', 'veyra']);
  assert.deepEqual(best[1].modifiers, ['night']);
  saveRecords({}, store);
  assert.deepEqual(loadRecords(store), {});
  assert.deepEqual(loadRecords(null), {}, 'no storage, no records, no crash');
});
