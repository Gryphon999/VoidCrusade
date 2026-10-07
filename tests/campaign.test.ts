/**
 * Campaign consequences: territory rules, events between battles, counterattacks and lost land.
 * Runs in Node without Phaser (the save falls back to memory when there is no localStorage).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CampaignState, COUNTER_BASE, COUNTER_MAX } from '../src/campaign/CampaignState';
import { EVENTS, EVENT_CHANCE, describeEffect, drawEvent, getEvent } from '../src/campaign/CampaignEvents';
import { START_TERRITORY, TERRITORIES, neighbors } from '../src/campaign/CampaignData';
import { MAP_BUILDERS } from '../src/maps';
import { MODIFIER_IDS } from '../src/battle/BattleModifiers';
import { WIN_MODES } from '../src/scenes/BattleTypes';
import { en } from '../src/i18n/en';
import { ru } from '../src/i18n/ru';

/** A deterministic rng from a list of values. */
const seq = (...vals: number[]): (() => number) => {
  let i = 0;
  return () => vals[Math.min(i++, vals.length - 1)];
};

test('territory rules name real maps, modifiers and win modes', () => {
  for (const tr of TERRITORIES) {
    assert.ok(tr.mapIndex >= 0 && tr.mapIndex < MAP_BUILDERS.length, `${tr.id} map`);
    for (const m of tr.rules?.modifiers ?? []) assert.ok((MODIFIER_IDS as readonly string[]).includes(m), `${tr.id}: ${m}`);
    if (tr.rules?.winMode) assert.ok(WIN_MODES.includes(tr.rules.winMode), `${tr.id}: ${tr.rules.winMode}`);
  }
  assert.ok(TERRITORIES.filter((t) => t.rules).length >= 8, 'most territories have rules');
});

test('every event is localised and describes its effects', () => {
  for (const e of EVENTS) {
    for (const dict of [en, ru] as Record<string, string>[]) {
      for (const k of ['title', 'text', 'a', 'b']) assert.ok(dict[`ev.${e.id}.${k}`], `${e.id} ${k}`);
    }
    for (const fx of e.options) {
      const parts = describeEffect(fx);
      assert.ok(parts.length > 0);
      for (const p of parts) assert.ok((en as Record<string, string>)[p.key] && (ru as Record<string, string>)[p.key], p.key);
    }
  }
  assert.equal(drawEvent(null, seq(EVENT_CHANCE)), null, 'no event when the roll misses');
  const first = drawEvent(null, seq(0, 0));
  assert.ok(first);
  const next = drawEvent(first.id, seq(0, 0));
  assert.ok(next && next.id !== first.id, 'never the same event twice in a row');
});

test('a victory conquers, offers boons, may draw an event; next-battle bonuses are one-off', () => {
  const s = CampaignState.newCampaign();
  const cards = CampaignState.recordVictory(s, 'veyra', seq(0.99, 0.99));
  assert.equal(cards.length, 3);
  assert.ok(s.owned.includes('veyra'));
  assert.equal(s.battles, 1);
  assert.equal(s.eventId, null, 'no event on a high roll');
  assert.equal(s.underAttack, null, 'no counterattack on a high roll');

  const s2 = CampaignState.newCampaign();
  CampaignState.recordVictory(s2, 'veyra', seq(0, 0));
  assert.ok(s2.eventId, 'an event on a low roll');
  const ev = getEvent(s2.eventId as string);
  const before = CampaignState.bonuses(s2);
  const fx = CampaignState.answerEvent(s2, 0, seq(0.99));
  assert.equal(fx, ev.options[0]);
  assert.equal(s2.eventId, null);
  const after = CampaignState.bonuses(s2);
  if (fx.nextBattle?.startScrip) assert.equal(after.startScrip, before.startScrip + fx.nextBattle.startScrip);
  // The next battle spends them.
  CampaignState.recordVictory(s2, 'khorvan', seq(0.99, 0.99));
  assert.equal(s2.nextBattle, undefined);
  assert.equal(CampaignState.bonuses(s2).startScrip, 50 * 1 + 0, 'back to territory bonuses only');
});

test('effects stack and never push starting resources below zero', () => {
  const s = CampaignState.newCampaign();
  CampaignState.applyEffect(s, { nextBattle: { startScrip: -500, hpMult: 0.9 } });
  CampaignState.applyEffect(s, { nextBattle: { hpMult: 0.9, squadSizeBonus: 2 } });
  const b = CampaignState.bonuses(s);
  assert.equal(b.startScrip, 0);
  assert.ok(Math.abs(b.hpMult - 0.81) < 1e-9);
  assert.equal(b.squadSizeBonus, 2);
  CampaignState.applyEffect(s, { card: 'slot' });
  assert.deepEqual(s.cards, ['slot']);
  CampaignState.applyEffect(s, { loseCard: true }, seq(0));
  assert.deepEqual(s.cards, []);
});

test('counterattacks target held land on the frontier, never the start, and a lost defence loses the territory', () => {
  const s = CampaignState.newCampaign();
  s.owned = ['ascalon', 'veyra', 'khorvan'];
  s.battles = 2;
  assert.ok(Math.abs(CampaignState.counterChance(s) - (COUNTER_BASE + 0.1)) < 1e-9);
  s.battles = 100;
  assert.equal(CampaignState.counterChance(s), COUNTER_MAX);
  s.counterMod = -1;
  assert.equal(CampaignState.counterChance(s), 0);
  s.counterMod = 0;
  const exposed = CampaignState.exposed(s);
  assert.ok(!exposed.includes(START_TERRITORY));
  for (const id of exposed) assert.ok(neighbors(id).some((n) => !s.owned.includes(n.id)), `${id} borders the Horde`);
  const target = CampaignState.rollCounterattack(s, seq(0, 0));
  assert.ok(target && exposed.includes(target));
  assert.deepEqual(CampaignState.attackable(s), [target], 'only the defence is available');
  assert.equal(CampaignState.recordDefeat(s, target as string, true, seq(0.99)), true);
  assert.ok(!s.owned.includes(target as string));
  assert.equal(s.lost, 1);
  assert.equal(s.underAttack, null);
  // A failed assault loses nothing.
  assert.equal(CampaignState.recordDefeat(s, 'ossuary', false, seq(0.99)), false);
  assert.equal(s.lost, 1);
  // Winning a defence keeps the land.
  s.underAttack = 'veyra';
  CampaignState.recordVictory(s, 'veyra', seq(0.99, 0.99));
  assert.ok(s.owned.includes('veyra'));
  assert.equal(s.underAttack, null);
});
