/**
 * Mission objectives: the pure rules behind Hold the Line, Burn the Nests and Evacuation.
 * Runs in Node without Phaser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVAC_ARRIVAL, EVAC_LOAD, EVAC_SQUADS, HOLD_DRAIN, HOLD_TIME, NEST_COUNT, NEST_SPAWN_EVERY, NEST_TIME_LIMIT,
  evacReady, evacStep, holdStep, nestPool, pickNestPoints,
} from '../src/battle/Objectives';
import { UNIT_DEFS } from '../src/units/UnitDefs';
import { MAP_BUILDERS } from '../src/maps';
import { WIN_MODES } from '../src/scenes/BattleTypes';
import { en } from '../src/i18n/en';
import { ru } from '../src/i18n/ru';

test('the hold meter fills under the player, drains faster under the enemy and freezes when neutral', () => {
  let p = 0;
  for (let i = 0; i < 10; i++) p = holdStep(p, 'player', 1);
  assert.equal(p, 10);
  p = holdStep(p, null, 5);
  assert.equal(p, 10, 'neutral freezes');
  p = holdStep(p, 'enemy', 2);
  assert.equal(p, 10 - 2 * HOLD_DRAIN);
  p = holdStep(p, 'enemy', 100);
  assert.equal(p, 0, 'never below zero');
  p = holdStep(HOLD_TIME - 0.5, 'player', 5);
  assert.equal(p, HOLD_TIME, 'never above the goal');
});

test('the nest brood grows with time and only spawns real Horde units', () => {
  const early = nestPool(0);
  const mid = nestPool(200);
  const late = nestPool(400);
  assert.ok(early.length < mid.length && mid.length < late.length);
  for (const id of late) assert.equal(UNIT_DEFS[id].faction, 'nullhorde', id);
  assert.ok(late.includes('behemoth') && !early.includes('behemoth'));
  assert.ok(NEST_SPAWN_EVERY > 0 && NEST_TIME_LIMIT > 600);
});

test('nests stand on the points nearest the Horde corner, never the centre', () => {
  for (const build of MAP_BUILDERS) {
    const m = build();
    const corner = { x: m.enemyBase.tx + 2, y: m.enemyBase.ty + 2 };
    const picked = pickNestPoints(m.capturePoints, corner);
    assert.equal(picked.length, NEST_COUNT, m.id);
    assert.ok(!picked.includes(m.capturePoints[0]), `${m.id}: the centre is not a nest`);
    const far = Math.max(...picked.map((p) => Math.hypot(p.x - corner.x, p.y - corner.y)));
    const rest = m.capturePoints.slice(1).filter((p) => !picked.includes(p));
    for (const p of rest) assert.ok(Math.hypot(p.x - corner.x, p.y - corner.y) >= far - 1e-9, `${m.id}: a nearer point was skipped`);
  }
});

test('boarding needs the Commander and enough squads, fills while they stay and drains when they leave', () => {
  assert.equal(evacReady(false, 10), false);
  assert.equal(evacReady(true, EVAC_SQUADS - 1), false);
  assert.equal(evacReady(true, EVAC_SQUADS), true);
  let load = 0;
  for (let i = 0; i < 4; i++) load = evacStep(load, true, 1);
  assert.equal(load, 4);
  load = evacStep(load, false, 1.5);
  assert.equal(load, 2.5);
  load = evacStep(load, true, 100);
  assert.equal(load, EVAC_LOAD);
  assert.ok(EVAC_ARRIVAL > 60);
});

test('every win mode is localised in both languages', () => {
  for (const m of WIN_MODES) {
    for (const dict of [en, ru] as Record<string, string>[]) {
      assert.ok(dict[`mode.${m}`], `${m} name`);
      assert.ok(dict[`mode.${m}.desc`], `${m} description`);
    }
  }
});
