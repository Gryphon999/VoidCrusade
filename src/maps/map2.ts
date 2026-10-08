import { TILE } from '../config';
import { MapBuilder, MapDef, PointKind } from './MapBuilder';

/** "Veyra Wastes" — open dunes, scattered rock pillars and wide flanks. */
export function buildMap2(): MapDef {
  // Drawn on a 64×48 sheet, built one and a half times larger.
  const b = new MapBuilder(TILE.GROUND, 96, 72, 1.5);
  const { CLIFF, ROAD, RUINS, GROUND } = TILE;

  // Rock pillars.
  for (const [x, y, rx, ry] of [[14, 30, 2, 2], [22, 26, 1.5, 3], [10, 16, 3, 1.5], [28, 34, 2, 1.5], [18, 12, 2, 2], [30, 20, 1.5, 1.5],
    [34, 45, 2, 1], [3, 12, 1.5, 2], [16, 42, 1.5, 1.5], [24, 39, 1.2, 1.2]]) {
    b.ellipse(x, y, rx, ry, CLIFF);
  }
  // Long ridge guarding the south flank.
  b.line(20, 44, 30, 41, CLIFF, 2);

  // Caravan roads.
  b.line(8, 40, 14, 36, ROAD, 2);
  b.line(14, 36, 26, 30, ROAD, 2);
  b.line(26, 30, 32, 24, ROAD, 2);
  b.line(6, 38, 6, 20, ROAD, 2);
  b.line(6, 20, 16, 8, ROAD, 2);
  b.line(6, 20, 5, 8, ROAD, 1.4);
  b.line(26, 36, 39, 44, ROAD, 1.4, GROUND);

  // Ruined waystations.
  b.rect(24, 32, 2, 2, RUINS).rect(4, 26, 2, 3, RUINS).rect(12, 22, 2, 2, RUINS).rect(30, 27, 3, 2, RUINS);
  b.rect(34, 22, 2, 2, RUINS).rect(18, 40, 2, 2, RUINS);
  b.rect(8, 6, 2, 1.5, RUINS).rect(36, 41, 1.5, 2, RUINS).rect(20, 18, 1.5, 1.5, RUINS);

  b.rect(3, 36, 9, 9, GROUND);

  // Mesas: the point at 8,18 and the point at 26,36 each stand on a flat-topped rise with two ramps,
  // so whoever holds the top overlooks the caravan roads below.
  b.raiseEllipse(8, 18, 5, 3.5);
  b.ramp(7, 21.5, 3, 2);
  b.ramp(12.5, 17, 2, 3);
  b.raiseEllipse(26, 36, 4, 3);
  b.ramp(22, 35, 2, 3);
  b.ramp(29.5, 37, 2, 3);

  const centre: [number, number, PointKind?][] = [[32, 24]];
  const half: [number, number, PointKind?][] = [[26, 36], [8, 18], [5, 7], [40, 44]];
  b.pads(centre).pads(half).border(CLIFF).mirror();

  const playerBase = b.tile(4, 40);
  return {
    id: 'veyra',
    name: 'Veyra Wastes',
    w: b.w,
    h: b.h,
    tiles: b.build(),
    levels: b.buildLevels(),
    playerBase,
    enemyBase: b.mirrorTile(playerBase, 4),
    capturePoints: b.points(centre, half),
  };
}
