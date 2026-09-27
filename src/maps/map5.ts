import { TILE } from '../config';
import { MapBuilder, MapDef, PointKind } from './MapBuilder';

/**
 * "Cinder Spires" — the largest field: a volcanic plain cut by two lava-rock walls with narrow
 * gates, and basalt spires everywhere between them. Thirteen points.
 */
export function buildMap5(): MapDef {
  const b = new MapBuilder(TILE.GROUND, 128, 96);
  const { CLIFF, ROAD, RUINS, GROUND } = TILE;

  // Inner wall around the base quarter, with a west and a south gate.
  b.line(2, 60, 30, 56, CLIFF, 3);
  b.line(30, 56, 44, 72, CLIFF, 3);
  b.line(44, 72, 46, 94, CLIFF, 3);
  b.rect(10, 55, 6, 8, GROUND);
  b.rect(35, 60, 6, 7, GROUND);
  b.rect(42, 80, 8, 5, GROUND);
  // Outer wall halfway to the centre, open at both ends and in the middle.
  b.line(16, 36, 40, 40, CLIFF, 3);
  b.line(40, 40, 58, 62, CLIFF, 3);
  b.line(58, 62, 72, 92, CLIFF, 3);
  b.rect(26, 35, 6, 8, GROUND);
  b.rect(46, 46, 7, 8, GROUND);
  b.rect(62, 72, 8, 6, GROUND);

  // Basalt spires.
  for (const [x, y, rx, ry] of [[22, 74, 3, 3], [20, 46, 3.5, 3], [34, 48, 3, 4], [54, 76, 3.5, 3], [10, 26, 4, 3], [28, 22, 3, 3],
    [50, 34, 3, 3], [6, 44, 2.5, 3], [36, 88, 3, 2.5], [60, 50, 2.5, 2.5], [16, 8, 4, 2.5], [40, 28, 2.5, 3.5], [76, 84, 3, 2.5]]) {
    b.ellipse(x, y, rx, ry, CLIFF);
  }

  // Roads through the gates.
  b.line(14, 84, 24, 86, ROAD, 2);
  b.line(24, 86, 45, 82, ROAD, 2, GROUND);
  b.line(45, 82, 62, 84, ROAD, 2, GROUND);
  b.line(12, 80, 12, 58, ROAD, 2, GROUND);
  b.line(12, 58, 12, 32, ROAD, 2, GROUND);
  b.line(16, 78, 38, 63, ROAD, 2, GROUND);
  b.line(38, 63, 49, 50, ROAD, 2, GROUND);
  b.line(49, 50, 64, 48, ROAD, 2, GROUND);
  b.line(12, 32, 29, 39, ROAD, 2, GROUND);

  // Burnt-out works.
  b.rect(18, 80, 3, 2, RUINS).rect(30, 64, 2, 3, RUINS).rect(8, 64, 2, 3, RUINS).rect(52, 84, 3, 2, RUINS);
  b.rect(30, 44, 2, 2, RUINS).rect(44, 56, 3, 2, RUINS).rect(14, 28, 3, 2, RUINS).rect(56, 44, 2, 3, RUINS);
  b.rect(66, 80, 2, 3, RUINS).rect(24, 30, 2, 2, RUINS).rect(60, 56, 2, 2, RUINS).rect(4, 12, 3, 2, RUINS);

  b.rect(3, 76, 14, 14, GROUND);

  const centre: [number, number, PointKind?][] = [[64, 48]];
  const half: [number, number, PointKind?][] = [[24, 86], [10, 66], [36, 66], [62, 84], [12, 32], [34, 44]];
  b.pads(centre).pads(half).border(CLIFF).mirror();

  const playerBase = b.tile(6, 82);
  return {
    id: 'cinder',
    name: 'Cinder Spires',
    w: b.w,
    h: b.h,
    tiles: b.build(),
    playerBase,
    enemyBase: b.mirrorTile(playerBase, 4),
    capturePoints: b.points(centre, half),
  };
}
