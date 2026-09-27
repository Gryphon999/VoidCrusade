/**
 * Voice pack tests: every voice line has a speaker and an up-to-date recording. Runs in Node.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../src/i18n/en';
import { ru } from '../src/i18n/ru';
import { UNIT_DEFS, UnitId } from '../src/units/UnitDefs';
import { SHOUTS, VoiceLang, VoiceManifest, isVoiceKey, speakerOfUnit, speakersFor, voiceFile, voiceHash, voiceId } from '../src/systems/VoiceCast';

const DICTS: Record<VoiceLang, Record<string, string>> = { en, ru };
const voiceKeys = Object.keys(en).filter(isVoiceKey);

test('every voice line has at least one speaker and no empty variant', () => {
  assert.ok(voiceKeys.length > 40);
  for (const key of voiceKeys) {
    assert.ok(speakersFor(key).length > 0, `${key} has no speaker`);
    for (const lang of ['en', 'ru'] as VoiceLang[]) {
      for (const text of DICTS[lang][key].split('|')) assert.ok(text.trim().length > 1, `${lang} ${key} has an empty variant`);
    }
  }
});

test('squads answer in their own voice and shout their own abilities', () => {
  for (const id of Object.keys(UNIT_DEFS) as UnitId[]) {
    const def = UNIT_DEFS[id];
    if (def.faction !== 'ironvoid') continue;
    const speaker = speakerOfUnit(id);
    assert.deepEqual(speakersFor(`vo.select.${id}`), [speaker]);
    assert.ok(speakersFor('vo.move').includes(speaker));
    for (const ability of def.abilities ?? []) {
      if (SHOUTS.includes(ability)) assert.ok(speakersFor(`vo.ab.${ability}`).includes(speaker), `${id} cannot shout ${ability}`);
    }
  }
});

test('the hash changes with the text', () => {
  assert.equal(voiceHash('Огонь!'), voiceHash('Огонь!'));
  assert.notEqual(voiceHash('Огонь!'), voiceHash('Огонь.'));
  assert.match(voiceHash(''), /^[0-9a-f]{8}$/);
});

test('the recorded pack covers every line in both languages', () => {
  const manifest = JSON.parse(readFileSync(join('public', 'voice', 'manifest.json'), 'utf8')) as VoiceManifest;
  const gaps: string[] = [];
  for (const lang of ['en', 'ru'] as VoiceLang[]) {
    for (const key of voiceKeys) {
      DICTS[lang][key].split('|').forEach((text, i) => {
        for (const speaker of speakersFor(key)) {
          const file = join('public', voiceFile(lang, speaker, key, i));
          const current = manifest[lang][voiceId(speaker, key)]?.[i] === voiceHash(text);
          if (!current || !existsSync(file) || statSync(file).size < 1500) gaps.push(`${lang}/${speaker}/${key}.${i}`);
        }
      });
    }
  }
  assert.deepEqual(gaps, [], 'run `npm run voice` to record the missing lines');
});
