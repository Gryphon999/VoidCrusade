import { TILE } from '../config';
import { MapBuilder, MapDef, PointKind } from './MapBuilder';

/**
 * "Frostmark" — a frozen lake in the middle of the tundra: fast, open and without a scrap of
 * cover, ringed by frost-bitten thickets where squads lie unseen. Eleven points.
 */
export function buildMap8(): MapDef {
  const b = new MapBuilder(TILE.GROUND, 112, 84);
  const { CLIFF, ROAD, RUINS, GROUND, ICE, SCRUB } = TILE;

  // The lake (centred, so its mirror is itself) and smaller ponds.
  b.ellipse(56, 42, 20, 11, ICE);
  b.ellipse(22, 60, 5, 3, ICE).ellipse(14, 24, 4, 2.5, ICE);
  // Thickets ringing the lake and along the approaches.
  for (const [x, y, rx, ry] of [[34, 54, 6, 3], [40, 30, 5, 3], [16, 34, 4, 3], [48, 66, 5, 3], [26, 14, 5, 2.5], [70, 76, 5, 3], [30, 42, 3, 2.5], [8, 50, 3, 2.5], [44, 12, 4, 2.5], [60, 72, 3, 2]]) {
    b.ellipse(x, y, rx, ry, SCRUB);
  }
  // Ridges and boulders.
  b.line(4, 46, 22, 44, CLIFF, 2);
  b.line(30, 70, 46, 76, CLIFF, 2);
  b.line(52, 56, 62, 60, CLIFF, 2);
  for (const [x, y, rx, ry] of [[24, 76, 3, 2.5], [36, 64, 2.5, 2.5], [10, 12, 3, 2], [34, 22, 2.5, 2.5], [52, 20, 2.5, 2], [66, 66, 2.5, 2.5], [4, 32, 2, 3]]) {
    b.ellipse(x, y, rx, ry, CLIFF);
  }

  // Roads: base -> points -> the lake shore.
  b.line(12, 70, 24, 72, ROAD, 2);
  b.line(10, 64, 12, 46, ROAD, 2, GROUND);
  b.line(12, 46, 16, 14, ROAD, 2, GROUND);
  b.line(24, 72, 36, 56, ROAD, 2, GROUND);
  b.line(36, 56, 44, 48, ROAD, 2, GROUND);
  b.line(24, 72, 56, 76, ROAD, 2, GROUND);
  b.line(16, 14, 38, 26, ROAD, 2, GROUND);
  b.line(38, 26, 46, 34, ROAD, 2, GROUND);

  // Frozen hamlets.
  b.rect(20, 66, 3, 2, RUINS).rect(32, 50, 2, 3, RUINS).rect(8, 38, 2, 3, RUINS).rect(16, 16, 3, 2, RUINS);
  b.rect(46, 44, 2, 2, RUINS).rect(54, 74, 2, 3, RUINS).rect(34, 30, 3, 2, RUINS).rect(26, 24, 2, 2, RUINS);

  b.rect(3, 64, 14, 14, GROUND);

  // A raised shelf north of the base overlooks the western approach and the point at 12,46; ramps
  // lead down to the base and east toward the lake.
  b.raiseEllipse(14, 46, 9, 5);
  b.ramp(12, 51, 3, 2);
  b.ramp(23, 44, 2, 3);

  const centre: [number, number, PointKind?][] = [[56, 42]];
  const half: [number, number, PointKind?][] = [[24, 72], [12, 46], [36, 56], [16, 14], [56, 76]];
  b.pads(centre).pads(half).border(CLIFF).mirror();

  const playerBase = b.tile(6, 70);
  return {
    id: 'frost',
    name: 'Frostmark',
    w: b.w,
    h: b.h,
    tiles: b.build(),
    levels: b.buildLevels(),
    playerBase,
    enemyBase: b.mirrorTile(playerBase, 4),
    capturePoints: b.points(centre, half),
  };
}
