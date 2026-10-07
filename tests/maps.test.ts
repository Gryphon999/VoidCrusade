/**
 * Map tests: every battle map is fair (point-symmetric) and playable (both strongholds and
 * every capture point stand on open ground and can be reached on foot and by vehicle).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP_BUILDERS } from '../src/maps';
import { buildTutorialMap } from '../src/maps/tutorialMap';
import { MapDef } from '../src/maps/MapBuilder';
import { Pathfinder } from '../src/systems/Pathfinder';
import { CAPTURE, TERRAIN, TILE, TILE_SIZE, TerrainRule, TileType } from '../src/config';

const HQ = 4;

/** The part of MapSystem the pathfinder needs, with both strongholds standing. */
function mapOf(def: MapDef) {
  const inHq = (x: number, y: number): boolean => [def.playerBase, def.enemyBase].some((b) => x >= b.tx && x < b.tx + HQ && y >= b.ty && y < b.ty + HQ);
  const open = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < def.w && y < def.h && def.tiles[y][x] !== TILE.CLIFF;
  const isPassable = (x: number, y: number): boolean => open(x, y) && !inHq(x, y);
  const rule = (x: number, y: number): TerrainRule => TERRAIN[(open(x, y) ? def.tiles[y][x] : TILE.CLIFF) as TileType];
  return {
    width: def.w,
    height: def.h,
    open,
    isPassable,
    rule,
    isVehicleTerrain: (x: number, y: number) => open(x, y) && rule(x, y).vehicles,
    isPassableWorld: (wx: number, wy: number) => isPassable(Math.floor(wx / TILE_SIZE), Math.floor(wy / TILE_SIZE)),
    worldToTile: (wx: number, wy: number) => ({ tx: Math.floor(wx / TILE_SIZE), ty: Math.floor(wy / TILE_SIZE) }),
    tileToWorld: (tx: number, ty: number) => ({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE }),
  };
}

const battleMaps = MAP_BUILDERS.map((b) => b());

test('there are eight battle maps, each larger than the old 64×48 field', () => {
  assert.equal(battleMaps.length, 8);
  assert.equal(new Set(battleMaps.map((m) => m.id)).size, 8);
  for (const m of battleMaps) {
    assert.ok(m.w >= 96 && m.h >= 72, `${m.id} is ${m.w}×${m.h}`);
    assert.equal(m.tiles.length, m.h);
    assert.ok(m.tiles.every((r) => r.length === m.w));
    assert.ok(m.capturePoints.length >= 9, `${m.id} has ${m.capturePoints.length} points`);
  }
});

test('battle maps are point-symmetric: terrain, strongholds and capture points', () => {
  for (const m of battleMaps) {
    let diff = 0;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.tiles[y][x] !== m.tiles[m.h - 1 - y][m.w - 1 - x]) diff++;
    // The diagonal itself is copied one way only; a handful of tiles on it may differ.
    assert.ok(diff <= m.w, `${m.id}: ${diff} tiles break the symmetry`);
    assert.deepEqual(m.enemyBase, { tx: m.w - m.playerBase.tx - HQ, ty: m.h - m.playerBase.ty - HQ });
    for (const p of m.capturePoints) {
      assert.ok(m.capturePoints.some((q) => Math.abs(q.x - (m.w - p.x)) < 0.01 && Math.abs(q.y - (m.h - p.y)) < 0.01), `${m.id}: point ${p.x},${p.y} has no twin`);
    }
  }
});

test('strongholds and capture zones stand on open ground, apart from each other', () => {
  for (const m of [...battleMaps, buildTutorialMap()]) {
    const map = mapOf(m);
    for (const b of [m.playerBase, m.enemyBase]) {
      for (let y = b.ty - 1; y < b.ty + HQ + 1; y++) for (let x = b.tx - 1; x < b.tx + HQ + 1; x++) assert.ok(map.open(x, y), `${m.id}: rock at the stronghold (${x},${y})`);
    }
    m.capturePoints.forEach((p, i) => {
      const r = CAPTURE.zoneHalfTiles;
      for (let y = Math.floor(p.y - r); y < Math.ceil(p.y + r); y++) for (let x = Math.floor(p.x - r); x < Math.ceil(p.x + r); x++) assert.ok(map.open(x, y), `${m.id}: rock in the zone of point ${i} (${x},${y})`);
      for (const q of m.capturePoints.slice(i + 1)) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= 10, `${m.id}: points ${p.x},${p.y} and ${q.x},${q.y} are too close`);
      for (const b of [m.playerBase, m.enemyBase]) assert.ok(Math.hypot(p.x - (b.tx + 2), p.y - (b.ty + 2)) >= 9, `${m.id}: point ${i} is inside a base`);
    });
  }
});

test('every capture point and the enemy stronghold can be reached on foot and by vehicle', () => {
  for (const m of [...battleMaps, buildTutorialMap()]) {
    const map = mapOf(m);
    const pf = new Pathfinder(map as never);
    const from = map.tileToWorld(m.playerBase.tx + HQ + 1, m.playerBase.ty + 1);
    const goals = [...m.capturePoints.map((p) => ({ x: p.x * TILE_SIZE, y: p.y * TILE_SIZE, name: `point ${p.x},${p.y}` })),
      { ...map.tileToWorld(m.enemyBase.tx - 2, m.enemyBase.ty + 1), name: 'enemy stronghold' }];
    for (const g of goals) {
      for (const wide of [false, true]) {
        const path = pf.find(from.x, from.y, g.x, g.y, wide);
        const end = path[path.length - 1];
        assert.ok(path.length > 0 && Math.hypot(end.x - g.x, end.y - g.y) < TILE_SIZE * 2.5, `${m.id}: ${wide ? 'vehicles' : 'infantry'} cannot reach ${g.name}`);
      }
    }
  }
});
