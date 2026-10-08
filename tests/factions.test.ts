/** Both factions can be played: start kits, waves, nests and tier requirements exist on each side. Runs in Node. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACTIONS, bossFor, nestBuildingFor, opponentFaction, startKitFor, wavePool } from '../src/battle/Factions';
import { nestPool } from '../src/battle/Objectives';
import { BUILDING_DEFS, defForRole } from '../src/buildings/BuildingDefs';
import { UNIT_DEFS } from '../src/units/UnitDefs';
import { TIER_UPGRADES } from '../src/systems/TechSystem';
import { RESEARCH_DEFS } from '../src/systems/ResearchSystem';
import { en } from '../src/i18n/en';
import { ru } from '../src/i18n/ru';

test('each faction has a headquarters, a hero and a first squad of its own', () => {
  for (const f of FACTIONS) {
    const kit = startKitFor(f);
    assert.equal(BUILDING_DEFS[kit.hq].faction, f);
    assert.equal(BUILDING_DEFS[kit.hq].role, 'hq');
    assert.equal(UNIT_DEFS[kit.hero].faction, f);
    assert.ok(UNIT_DEFS[kit.hero].isHero);
    assert.equal(UNIT_DEFS[kit.squad].faction, f);
    assert.ok(BUILDING_DEFS[kit.hq].produces.includes(kit.hero), `${f}: the headquarters trains the hero`);
    assert.equal(opponentFaction(opponentFaction(f)), f);
    for (const dict of [en, ru] as Record<string, string>[]) assert.ok(dict[`faction.${f}`], `${f} name`);
  }
});

test('waves, bosses and nests of each faction are made of its own units and buildings', () => {
  for (const f of FACTIONS) {
    for (const stage of [1, 3, 5, 8, 20]) {
      const pool = wavePool(f, stage);
      assert.ok(pool.length >= 3);
      for (const id of pool) assert.equal(UNIT_DEFS[id].faction, f, `${f} wave ${stage}: ${id}`);
    }
    assert.ok(wavePool(f, 20).length > wavePool(f, 1).length, `${f}: waves grow`);
    assert.equal(UNIT_DEFS[bossFor(f)].faction, f);
    assert.equal(BUILDING_DEFS[nestBuildingFor(f)].faction, f);
    for (const id of nestPool(400, f)) assert.equal(UNIT_DEFS[id].faction, f);
  }
});

test('both factions can climb every tier and research something', () => {
  for (const f of FACTIONS) {
    for (const up of Object.values(TIER_UPGRADES)) {
      for (const role of up.requires) assert.ok(defForRole(f, role), `${f} has no ${role} building for tier ${up.to}`);
    }
    assert.ok(RESEARCH_DEFS.some((r) => r.faction === f), `${f} has research`);
  }
});
