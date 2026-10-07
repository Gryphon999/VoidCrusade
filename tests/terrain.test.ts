/**
 * Terrain rules: the table covers every tile, and the pathfinder honours it (water stops vehicles,
 * lava is avoided when a detour exists). Runs in Node without Phaser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TERRAIN, TILE, TILE_SIZE, TerrainRule, TileType } from '../src/config';
import { Pathfinder } from '../src/systems/Pathfinder';

test('every tile has a rule and the rules are sane', () => {
  for (const t of Object.values(TILE)) {
    const r = TERRAIN[t];
    assert.ok(r, `tile ${t} has no rule`);
    assert.ok(r.speed > 0 && r.speed <= 2, `tile ${t} speed`);
    assert.ok(r.pathCost > 0, `tile ${t} path cost`);
    assert.ok(r.damage >= 0 && r.damage < 1, `tile ${t} damage`);
  }
  assert.equal(TERRAIN[TILE.WATER].vehicles, false);
  assert.ok(TERRAIN[TILE.WATER].speed < 1 && TERRAIN[TILE.ICE].speed > 1);
  assert.ok(TERRAIN[TILE.LAVA].damage > 0 && TERRAIN[TILE.LAVA].pathCost > 3);
  assert.ok(TERRAIN[TILE.SCRUB].conceals && TERRAIN[TILE.SCRUB].losBlock && TERRAIN[TILE.SCRUB].cover === 'cover');
  assert.equal(TERRAIN[TILE.ICE].cover, 'none');
  for (const t of [TILE.WATER, TILE.LAVA, TILE.SCRUB]) assert.equal(TERRAIN[t].buildable, false, `tile ${t} buildable`);
  assert.ok(TERRAIN[TILE.GROUND].buildable && TERRAIN[TILE.ICE].buildable);
});

/** A small grid map with the parts of MapSystem the pathfinder uses. */
function gridMap(rows: string[]) {
  const glyph: Record<string, TileType> = { '.': TILE.GROUND, '#': TILE.CLIFF, '~': TILE.WATER, 'L': TILE.LAVA, 'S': TILE.SCRUB, 'I': TILE.ICE, '=': TILE.ROAD };
  const tiles = rows.map((r) => [...r].map((c) => glyph[c]));
  const w = tiles[0].length;
  const h = tiles.length;
  const tile = (x: number, y: number): TileType => (x >= 0 && y >= 0 && x < w && y < h ? tiles[y][x] : TILE.CLIFF);
  const rule = (x: number, y: number): TerrainRule => TERRAIN[tile(x, y)];
  const isPassable = (x: number, y: number): boolean => tile(x, y) !== TILE.CLIFF;
  return {
    width: w,
    height: h,
    rule,
    isPassable,
    isVehicleTerrain: (x: number, y: number) => isPassable(x, y) && rule(x, y).vehicles,
    isPassableWorld: (wx: number, wy: number) => isPassable(Math.floor(wx / TILE_SIZE), Math.floor(wy / TILE_SIZE)),
    worldToTile: (wx: number, wy: number) => ({ tx: Math.floor(wx / TILE_SIZE), ty: Math.floor(wy / TILE_SIZE) }),
    tileToWorld: (tx: number, ty: number) => ({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE }),
  };
}

const at = (tx: number, ty: number): { x: number; y: number } => ({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE });

test('a river stops vehicles but not infantry; a bridge lets vehicles across', () => {
  const map = gridMap([
    '..........',
    '..........',
    '~~~~~~~~~~',
    '~~~~~~~~~~',
    '..........',
    '..........',
  ]);
  const pf = new Pathfinder(map as never);
  const a = at(1, 0);
  const b = at(1, 5);
  const foot = pf.find(a.x, a.y, b.x, b.y, false);
  assert.ok(foot.length && Math.hypot(foot[foot.length - 1].x - b.x, foot[foot.length - 1].y - b.y) < TILE_SIZE, 'infantry wades across');
  const wheels = pf.find(a.x, a.y, b.x, b.y, true);
  const end = wheels[wheels.length - 1] ?? a;
  assert.ok(Math.hypot(end.x - b.x, end.y - b.y) > TILE_SIZE * 2, 'vehicles are stopped by the river');

  const bridged = gridMap([
    '..........',
    '..........',
    '~~~~==~~~~',
    '~~~~==~~~~',
    '..........',
    '..........',
  ]);
  const pf2 = new Pathfinder(bridged as never);
  const over = pf2.find(a.x, a.y, b.x, b.y, true);
  const e2 = over[over.length - 1];
  assert.ok(over.length && Math.hypot(e2.x - b.x, e2.y - b.y) < TILE_SIZE, 'vehicles cross on the bridge');
});

test('routes go round a lava field when the detour is short, and through it when it is not', () => {
  const map = gridMap([
    '........',
    '..LLL...',
    '..LLL...',
    '..LLL...',
    '........',
  ]);
  const pf = new Pathfinder(map as never);
  const a = at(0, 2);
  const b = at(7, 2);
  const path = [{ x: a.x, y: a.y }, ...pf.find(a.x, a.y, b.x, b.y, false)];
  // Sample the path finely and make sure it never steps on lava.
  let onLava = false;
  for (let i = 1; i < path.length; i++) {
    const p = path[i - 1];
    const q = path[i];
    const n = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 8);
    for (let s = 0; s <= n; s++) {
      const t = map.worldToTile(p.x + ((q.x - p.x) * s) / n, p.y + ((q.y - p.y) * s) / n);
      if (map.rule(t.tx, t.ty).damage > 0) onLava = true;
    }
  }
  assert.equal(onLava, false, 'the path crosses the lava');

  const walled = gridMap([
    '###L####',
    '...L....',
    '...L....',
    '...L....',
    '###L####',
  ]);
  const pf2 = new Pathfinder(walled as never);
  const c = at(0, 2);
  const d = at(7, 2);
  const through = pf2.find(c.x, c.y, d.x, d.y, false);
  const e = through[through.length - 1];
  assert.ok(through.length && Math.hypot(e.x - d.x, e.y - d.y) < TILE_SIZE, 'with no way round, the path wades the lava');
});
