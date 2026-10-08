import { TILE } from '../config';
import { MapBuilder, MapDef, PointKind } from './MapBuilder';

/**
 * "Sunken Delta" — a drowned lowland where two river arms cross the field. Infantry wades, but
 * vehicles only get across at the fords and the plated bridges, so every crossing is a choke.
 * Eleven points.
 */
export function buildMap6(): MapDef {
  const b = new MapBuilder(TILE.GROUND, 112, 84);
  const { CLIFF, ROAD, RUINS, GROUND, WATER } = TILE;

  // River arm A: cuts the base corner off from the centre.
  b.line(0, 50, 20, 58, WATER, 4);
  b.line(20, 58, 44, 66, WATER, 4);
  b.line(44, 66, 70, 76, WATER, 4);
  b.line(70, 76, 90, 84, WATER, 4);
  // River arm B: from the west edge towards the centre, ending in marsh pools.
  b.line(0, 22, 18, 28, WATER, 3);
  b.line(18, 28, 34, 34, WATER, 3);
  b.line(34, 34, 46, 38, WATER, 3);
  b.ellipse(49, 40, 3, 2, WATER);
  // Marsh pools.
  b.ellipse(30, 12, 4, 2.5, WATER).ellipse(60, 72, 3, 2, WATER).ellipse(8, 40, 2.5, 2, WATER).ellipse(26, 46, 3, 2, WATER);

  // Fords: open gravel across arm A and arm B.
  b.rect(12, 52, 4, 9, GROUND);
  b.rect(10, 22, 4, 8, GROUND);
  // Bridges: plating laid across the water.
  b.line(40, 60, 40, 70, ROAD, 2);
  b.line(66, 70, 66, 80, ROAD, 2);
  b.line(28, 28, 28, 38, ROAD, 2);

  // Rock islands and old levees.
  for (const [x, y, rx, ry] of [[20, 70, 3, 2.5], [34, 46, 3, 3], [48, 56, 3, 2.5], [14, 36, 3, 2], [40, 20, 3, 2.5], [22, 8, 3, 2], [58, 62, 2.5, 2.5], [6, 10, 2, 3]]) {
    b.ellipse(x, y, rx, ry, CLIFF);
  }
  b.line(30, 76, 38, 80, CLIFF, 2);
  b.line(2, 60, 8, 62, CLIFF, 2);

  // Causeways: base -> fords/bridges -> points -> centre.
  b.line(12, 70, 22, 72, ROAD, 2);
  b.line(14, 62, 14, 52, ROAD, 2, GROUND);
  b.line(14, 50, 12, 42, ROAD, 2, GROUND);
  b.line(12, 42, 12, 30, ROAD, 2, GROUND);
  b.line(12, 22, 16, 12, ROAD, 2, GROUND);
  b.line(22, 72, 40, 70, ROAD, 2, GROUND);
  b.line(40, 60, 36, 56, ROAD, 2, GROUND);
  b.line(36, 56, 52, 44, ROAD, 2, GROUND);
  b.line(28, 38, 28, 28, ROAD, 2, GROUND);
  b.line(28, 28, 44, 24, ROAD, 2, GROUND);
  b.line(40, 70, 58, 78, ROAD, 2, GROUND);
  b.line(66, 70, 60, 54, ROAD, 2, GROUND);

  // Drowned hamlets.
  b.rect(18, 66, 3, 2, RUINS).rect(30, 54, 2, 3, RUINS).rect(8, 34, 2, 2, RUINS).rect(18, 14, 3, 2, RUINS);
  b.rect(44, 48, 2, 2, RUINS).rect(54, 74, 2, 3, RUINS).rect(32, 24, 3, 2, RUINS).rect(50, 30, 2, 2, RUINS);
  b.rect(60, 50, 2, 2, RUINS).rect(24, 40, 2, 2, RUINS);

  b.rect(3, 64, 14, 14, GROUND);

  const centre: [number, number, PointKind?][] = [[56, 42]];
  const half: [number, number, PointKind?][] = [[22, 72], [12, 42], [36, 56], [16, 12], [58, 78]];
  b.pads(centre).pads(half).border(CLIFF).mirror();

  const playerBase = b.tile(6, 70);
  return {
    id: 'delta',
    name: 'Sunken Delta',
    w: b.w,
    h: b.h,
    tiles: b.build(),
    playerBase,
    enemyBase: b.mirrorTile(playerBase, 4),
    capturePoints: b.points(centre, half),
  };
}
