import { TILE } from '../config';
import { MapBuilder, MapDef, PointKind } from './MapBuilder';

/**
 * "Mourngate Fens" — a drowned lowland: rock islands stand in the mire, and the dry causeways
 * between them decide where armies can walk. Eleven points, three lanes to the centre.
 */
export function buildMap4(): MapDef {
  const b = new MapBuilder(TILE.GROUND, 112, 84);
  const { CLIFF, ROAD, RUINS, GROUND } = TILE;

  // Rock islands.
  for (const [x, y, rx, ry] of [[30, 60, 5, 4], [18, 40, 4, 6], [44, 70, 6, 3], [40, 44, 5, 5], [12, 20, 5, 3], [28, 24, 4, 4],
    [52, 56, 3, 5], [24, 8, 5, 2.5], [6, 58, 3, 2], [62, 74, 4, 2.5], [38, 80, 5, 2], [4, 32, 2.5, 4], [26, 49, 2, 2]]) {
    b.ellipse(x, y, rx, ry, CLIFF);
  }
  // The old dyke north of the base, breached in two places.
  b.line(2, 52, 22, 50, CLIFF, 3);
  b.rect(8, 49, 5, 6, GROUND);
  // A spur that shields the southern lane.
  b.line(34, 66, 46, 62, CLIFF, 2);

  // Causeways: base -> natural -> centre; base -> west lane -> far corner; south lane.
  b.line(12, 72, 24, 72, ROAD, 2);
  b.line(24, 72, 36, 54, ROAD, 2, GROUND);
  b.line(36, 54, 56, 42, ROAD, 2, GROUND);
  b.line(10, 68, 10, 46, ROAD, 2, GROUND);
  b.line(10, 46, 14, 14, ROAD, 2, GROUND);
  b.line(24, 74, 52, 77, ROAD, 2, GROUND);
  b.line(14, 14, 36, 32, ROAD, 2, GROUND);

  // Sunken villages.
  b.rect(20, 66, 3, 2, RUINS).rect(32, 50, 2, 3, RUINS).rect(8, 38, 2, 3, RUINS).rect(16, 16, 3, 2, RUINS);
  b.rect(46, 50, 2, 2, RUINS).rect(54, 72, 2, 3, RUINS).rect(34, 28, 3, 2, RUINS).rect(48, 38, 3, 2, RUINS);
  b.rect(22, 30, 2, 2, RUINS).rect(58, 46, 2, 2, RUINS);

  b.rect(3, 64, 14, 14, GROUND);

  const centre: [number, number, PointKind?][] = [[56, 42]];
  const half: [number, number, PointKind?][] = [[24, 72], [10, 46], [35, 53], [14, 14], [52, 77]];
  b.pads(centre).pads(half).border(CLIFF).mirror();

  const playerBase = b.tile(6, 70);
  return {
    id: 'mourngate',
    name: 'Mourngate Fens',
    w: b.w,
    h: b.h,
    tiles: b.build(),
    playerBase,
    enemyBase: b.mirrorTile(playerBase, 4),
    capturePoints: b.points(centre, half),
  };
}
