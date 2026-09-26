/**
 * Light unit tests for core rules: npm test
 * (damage table, production queue, supply cap, pathing clearance). Runs in Node without Phaser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAMAGE_TABLE, DAMAGE_TYPES, ARMOR_CLASSES, damageMult, strongVs, weakVs } from '../src/units/Damage';
import { UNIT_DEFS, UnitId } from '../src/units/UnitDefs';
import { BUILDING_DEFS } from '../src/buildings/BuildingDefs';
import { ProductionSystem } from '../src/systems/ProductionSystem';
import { ResourceSystem } from '../src/systems/ResourceSystem';
import { Pathfinder } from '../src/systems/Pathfinder';
import { SUPPLY, TILE_SIZE, UNITS } from '../src/config';

test('damage table covers every pair with sane multipliers', () => {
  for (const d of DAMAGE_TYPES) {
    for (const a of ARMOR_CLASSES) {
      const m = DAMAGE_TABLE[d][a];
      assert.ok(m >= 0.25 && m <= 2, `${d} vs ${a} = ${m}`);
    }
  }
  assert.ok(damageMult('explosive', 'vehicle') > damageMult('bullet', 'vehicle'), 'explosives beat bullets on vehicles');
  assert.ok(damageMult('flame', 'light') > damageMult('flame', 'vehicle'), 'flame is for infantry');
  assert.ok(strongVs('explosive').includes('building'));
  assert.ok(weakVs('bullet').includes('vehicle'));
});

test('every damage type has a full-damage target and every armour has a weakness', () => {
  for (const d of DAMAGE_TYPES) assert.ok(ARMOR_CLASSES.some((a) => DAMAGE_TABLE[d][a] >= 1), `${d} is good against nothing`);
  for (const a of ARMOR_CLASSES.filter((x) => x !== 'building')) {
    assert.ok(DAMAGE_TYPES.some((d) => DAMAGE_TABLE[d][a] >= 1), `${a} has no counter`);
  }
});

// ---- Production and supply with a minimal fake battle ------------------------------------

interface FakeBuilding { owner: 'player' | 'enemy'; isReady: boolean; def: { produces: UnitId[]; supply?: number }; queue: UnitId[]; refreshVisual(): void }

function fakeBattle(opts: { tier?: number; scrip?: number; flux?: number; squads?: UnitId[]; depots?: number } = {}) {
  const resources = new ResourceSystem({ player: { scrip: opts.scrip ?? 5000, flux: opts.flux ?? 5000 } });
  const barracks: FakeBuilding = { owner: 'player', isReady: true, def: BUILDING_DEFS.barracks as never, queue: [], refreshVisual: () => undefined };
  const hq: FakeBuilding = { owner: 'player', isReady: true, def: BUILDING_DEFS.stronghold as never, queue: [], refreshVisual: () => undefined };
  const buildings = [hq, barracks];
  for (let i = 0; i < (opts.depots ?? 0); i++) buildings.push({ owner: 'player', isReady: true, def: BUILDING_DEFS.depot as never, queue: [], refreshVisual: () => undefined });
  const squads = (opts.squads ?? []).map((id) => ({ owner: 'player', alive: true, def: UNIT_DEFS[id] }));
  const battle = {
    resources,
    events: { emit: () => undefined },
    tech: { lockReason: (_o: string, tier: number) => (tier > (opts.tier ?? 3) ? 'locked' : null), tierOf: () => opts.tier ?? 3 },
    buildings: { buildings, getOwned: (o: string) => buildings.filter((b) => b.owner === o) },
    units: {
      getSquads: (o: string) => squads.filter((s) => s.owner === o),
      supplyUsed: (o: string) => squads.filter((s) => s.owner === o).reduce((a, s) => a + s.def.supply, 0),
      supplyCap: (o: string) => Math.min(SUPPLY.hardMax, buildings.filter((b) => b.owner === o && b.isReady).reduce((a, b) => a + (b.def.supply ?? 0), 0)),
    },
  };
  return { prod: new ProductionSystem(battle as never), barracks: barracks as never, resources };
}

test('production queue holds five and refunds on cancel', () => {
  const { prod, barracks, resources } = fakeBattle({ depots: 3 });
  const before = resources.getResources('player').scrip;
  for (let i = 0; i < UNITS.queueMax; i++) assert.equal(prod.enqueue(barracks, 'rifleman'), true);
  assert.equal(prod.checkEnqueue(barracks, 'rifleman'), 'err.queueFull');
  assert.equal(resources.getResources('player').scrip, before - UNITS.queueMax * UNIT_DEFS.rifleman.cost.scrip);
  prod.cancel(barracks, 0);
  assert.equal((barracks as unknown as FakeBuilding).queue.length, UNITS.queueMax - 1);
  assert.equal(resources.getResources('player').scrip, before - (UNITS.queueMax - 1) * UNIT_DEFS.rifleman.cost.scrip);
});

test('queue rejects units a building cannot train, locked tiers and missing money', () => {
  assert.equal(fakeBattle().prod.checkEnqueue(fakeBattle().barracks, 'tank'), 'err.cannotTrain');
  const t1 = fakeBattle({ tier: 1, depots: 2 });
  assert.equal(t1.prod.checkEnqueue(t1.barracks, 'marksman'), 'err.tier');
  const poor = fakeBattle({ scrip: 10, depots: 2 });
  assert.equal(poor.prod.checkEnqueue(poor.barracks, 'rifleman'), 'err.resources');
});

test('supply cap counts queued units and never exceeds the hard maximum', () => {
  // HQ alone: 10 supply; five riflemen (2 each) fill it exactly.
  const { prod, barracks } = fakeBattle({ squads: ['rifleman', 'rifleman', 'rifleman'] });
  assert.equal(prod.supplyUsed('player'), 6);
  assert.equal(prod.enqueue(barracks, 'rifleman'), true);
  assert.equal(prod.enqueue(barracks, 'rifleman'), true);
  assert.equal(prod.supplyUsed('player'), 10);
  assert.equal(prod.checkEnqueue(barracks, 'rifleman'), 'err.supply');
  const rich = fakeBattle({ depots: 20 });
  assert.equal(rich.prod.checkEnqueue(rich.barracks, 'rifleman'), null);
  const cap = (rich.prod as unknown as { battle: { units: { supplyCap(o: string): number } } }).battle.units.supplyCap('player');
  assert.equal(cap, SUPPLY.hardMax);
});

// ---- Pathing clearance -----------------------------------------------------------------------

function fakeMap(w: number, h: number, blocked: (x: number, y: number) => boolean) {
  const isPassable = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && !blocked(x, y);
  return {
    width: w,
    height: h,
    isPassable,
    isPassableWorld: (wx: number, wy: number) => isPassable(Math.floor(wx / TILE_SIZE), Math.floor(wy / TILE_SIZE)),
    worldToTile: (wx: number, wy: number) => ({ tx: Math.floor(wx / TILE_SIZE), ty: Math.floor(wy / TILE_SIZE) }),
    tileToWorld: (tx: number, ty: number) => ({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE }),
  };
}

test('infantry fit through a one-tile gap, vehicles need two tiles', () => {
  // A wall at x=10 with a single open tile at y=5, and a two-tile opening at y=15..16.
  const map = fakeMap(21, 21, (x, y) => x === 10 && y !== 5 && y !== 15 && y !== 16);
  const pf = new Pathfinder(map as never);
  const from = map.tileToWorld(3, 5);
  const to = map.tileToWorld(17, 5);
  const foot = pf.find(from.x, from.y, to.x, to.y, false);
  assert.ok(foot.length > 0, 'infantry path exists');
  const maxYFoot = Math.max(...foot.map((p) => p.y / TILE_SIZE));
  assert.ok(maxYFoot < 10, 'infantry take the short one-tile gap');
  const wide = pf.find(from.x, from.y, to.x, to.y, true);
  assert.ok(wide.length > 0, 'vehicle path exists');
  assert.ok(wide.some((p) => p.y / TILE_SIZE > 12), 'vehicles detour through the wide opening');
});

test('no path when the goal is sealed off', () => {
  const map = fakeMap(21, 21, (x) => x === 10);
  const pf = new Pathfinder(map as never);
  const a = map.tileToWorld(3, 5);
  const b = map.tileToWorld(17, 5);
  const path = pf.find(a.x, a.y, b.x, b.y, false);
  assert.ok(path.length === 0 || Math.floor(path[path.length - 1].x / TILE_SIZE) < 10, 'must not cross a solid wall');
});
