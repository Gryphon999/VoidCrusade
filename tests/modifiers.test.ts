/**
 * Battle modifiers: registry sanity, exclusions, and what each modifier sets on a minimal fake battle.
 * Runs in Node without Phaser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLITZ_ATTRITION_START, MODIFIERS, MODIFIER_IDS, ModifierBattle, NIGHT_SIGHT, SUPPLY_BIG, SUPPLY_SMALL,
  applyModifiers, defaultBattleParams, getModifier, isModifierId, normalizeModifiers, toggleModifier,
} from '../src/battle/BattleModifiers';
import { defaultModifiers } from '../src/systems/Modifiers';
import { ResourceSystem } from '../src/systems/ResourceSystem';
import { ATTRITION, SUPPLY } from '../src/config';
import { en } from '../src/i18n/en';
import { ru } from '../src/i18n/ru';

test('every modifier is defined once, with an icon and both translations', () => {
  assert.equal(new Set(MODIFIER_IDS).size, MODIFIER_IDS.length);
  assert.deepEqual(MODIFIERS.map((m) => m.id), [...MODIFIER_IDS], 'registry order equals id order');
  for (const m of MODIFIERS) {
    assert.ok(m.icon.startsWith('icon_mod_'), `${m.id} icon`);
    for (const dict of [en, ru] as Record<string, string>[]) {
      assert.ok(dict[`mod.${m.id}`], `${m.id} name`);
      assert.ok(dict[`mod.${m.id}.desc`], `${m.id} description`);
    }
  }
  assert.ok(isModifierId('night') && !isModifierId('cheat'));
});

test('exclusions are symmetric and resolved in favour of the later pick', () => {
  for (const m of MODIFIERS) {
    for (const e of m.excludes ?? []) assert.ok(getModifier(e).excludes?.includes(m.id), `${e} should exclude ${m.id}`);
  }
  assert.deepEqual(normalizeModifiers(['plenty', 'scarcity']), ['scarcity']);
  assert.deepEqual(normalizeModifiers(['scarcity', 'plenty']), ['plenty']);
  assert.deepEqual(normalizeModifiers(['bigWar', 'night', 'smallWar', 'bogus', 'night']), ['night', 'smallWar']);
  assert.deepEqual(toggleModifier(['night'], 'night'), []);
  assert.deepEqual(toggleModifier(['smallWar'], 'bigWar'), ['bigWar']);
});

function fakeBattle(): ModifierBattle & { locked: Set<string>; storms: boolean } {
  const locked = new Set<string>();
  const resources = new ResourceSystem();
  resources.addIncome('player', 'scrip', 10);
  resources.addIncome('enemy', 'scrip', 10);
  const b = {
    modifiers: { player: defaultModifiers(), enemy: defaultModifiers() },
    resources,
    tech: { lockedCategories: locked } as unknown as ModifierBattle['tech'],
    world: { storms: false } as unknown as ModifierBattle['world'],
    lookId: 'ashfall',
    locked,
    storms: false,
    ...defaultBattleParams(),
  };
  return b;
}

test('defaults match the plain game', () => {
  const d = defaultBattleParams();
  assert.equal(d.supplyHardMax, SUPPLY.hardMax);
  assert.equal(d.spawnRank, 0);
  assert.equal(d.attritionStart, ATTRITION.start);
});

test('economy modifiers scale income for both sides', () => {
  const b = fakeBattle();
  applyModifiers(b, ['plenty']);
  assert.equal(b.resources.getIncome('player').scrip, 20);
  assert.equal(b.resources.getIncome('enemy').scrip, 20);
  const c = fakeBattle();
  applyModifiers(c, ['scarcity']);
  assert.equal(c.resources.getIncome('enemy').scrip, 5);
});

test('army size, veterans, no fortifications, storms', () => {
  const b = fakeBattle();
  applyModifiers(b, ['smallWar', 'veterans', 'noDefense', 'storms']);
  assert.equal(b.supplyHardMax, SUPPLY_SMALL);
  assert.equal(b.spawnRank, 2);
  assert.ok(b.locked.has('defense'));
  assert.equal(b.world.storms, true);
  const c = fakeBattle();
  applyModifiers(c, ['bigWar']);
  assert.equal(c.supplyHardMax, SUPPLY_BIG);
});

test('night, glass cannon and blitzkrieg set multipliers on both sides', () => {
  const b = fakeBattle();
  applyModifiers(b, ['night', 'glassCannon', 'blitz']);
  for (const o of ['player', 'enemy'] as const) {
    const m = b.modifiers[o];
    assert.equal(m.sightMult, NIGHT_SIGHT);
    assert.equal(m.damageMult, 2);
    assert.equal(m.hpMult, 0.5);
    assert.equal(m.buildSpeedMult, 2);
  }
  assert.equal(b.lookId, 'khorvan');
  assert.equal(b.attritionStart, BLITZ_ATTRITION_START);
});

test('no modifiers leaves everything untouched', () => {
  const b = fakeBattle();
  applyModifiers(b, undefined);
  assert.deepEqual(b.modifiers.player, defaultModifiers());
  assert.equal(b.resources.getIncome('player').scrip, 10);
  assert.equal(b.supplyHardMax, SUPPLY.hardMax);
  assert.equal(b.lookId, 'ashfall');
});
