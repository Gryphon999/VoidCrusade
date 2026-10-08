/**
 * Portal glue that runs without a browser: VK's cloud save is split into parts under its 4096-byte limit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSave } from '../src/platform/VkBackend';

test('a VK cloud save splits into parts that fit the storage limit and join back losslessly', () => {
  const save = JSON.stringify({ savedAt: 1, keys: { 'voidcrusade.settings.v1': 'Ж'.repeat(2500), 'voidcrusade.campaign.v1': '{"owned":["ascalon"]}' } });
  const parts = splitSave(save);
  assert.ok(parts.length >= 3);
  for (const p of parts) assert.ok(Buffer.byteLength(p, 'utf8') <= 4096);
  assert.equal(parts.join(''), save);
  assert.deepEqual(splitSave(''), []);
});
