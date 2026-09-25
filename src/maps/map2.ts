import { TILE } from '../config';
import { MapBuilder, MapDef, mirrorPoint, mirrorTile } from './MapBuilder';

/** "Veyra Wastes" — open dunes, scattered rock pillars and wide flanks. */
export function buildMap2(): MapDef {
  const b = new MapBuilder(TILE.GROUND);
  const { CLIFF, ROAD, RUINS, GROUND } = TILE;

  // Rock pillars.
  for (const [x, y, rx, ry] of [[14, 30, 2, 2], [22, 26, 1.5, 3], [10, 16, 3, 1.5], [28, 34, 2, 1.5], [18, 12, 2, 2], [30, 20, 1.5, 1.5]]) {
    b.ellipse(x, y, rx, ry, CLIFF);
  }
  // Long ridge guarding the south flank.
  b.line(20, 44, 34, 40, CLIFF, 2);

  // Caravan roads.
  b.line(8, 40, 14, 36, ROAD, 2);
  b.line(14, 36, 26, 30, ROAD, 2);
  b.line(26, 30, 32, 24, ROAD, 2);
  b.line(6, 38, 6, 20, ROAD, 2);
  b.line(6, 20, 16, 8, ROAD, 2);

  // Ruined waystations.
  b.rect(24, 32, 2, 2, RUINS).rect(4, 26, 2, 3, RUINS).rect(12, 22, 2, 2, RUINS).rect(30, 27, 3, 2, RUINS);
  b.rect(34, 22, 2, 2, RUINS).rect(18, 40, 2, 2, RUINS);

  b.rect(3, 36, 9, 9, GROUND);
  b.border(CLIFF).mirror();

  const playerBase = { tx: 4, ty: 40 };
  const side = [
    { x: 26, y: 36 },
    { x: 8, y: 18 },
  ];
  return {
    id: 'veyra',
    name: 'Veyra Wastes',
    tiles: b.build(),
    playerBase,
    enemyBase: mirrorTile(playerBase, 4),
    capturePoints: [{ x: 32, y: 24 }, ...side, ...side.map(mirrorPoint)],
  };
}
