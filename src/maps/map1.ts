import { TILE } from '../config';
import { MapBuilder, MapDef, mirrorPoint, mirrorTile } from './MapBuilder';

/** "Ashfall Ridge" — two ridges funnel fighting through the ruined city center. */
export function buildMap1(): MapDef {
  const b = new MapBuilder(TILE.GROUND);
  const { CLIFF, ROAD, RUINS, GROUND } = TILE;

  // Ridges on the player half (mirrored later).
  b.line(4, 30, 16, 26, CLIFF, 2);
  b.line(22, 34, 26, 44, CLIFF, 2);
  b.ellipse(24, 18, 4, 3, CLIFF);
  b.ellipse(14, 12, 3, 2, CLIFF);
  b.line(30, 36, 38, 32, CLIFF, 2);

  // Roads: base -> side points -> center.
  b.line(10, 40, 20, 38, ROAD, 2);
  b.line(8, 38, 10, 22, ROAD, 2);
  b.line(20, 38, 32, 24, ROAD, 2);
  b.line(10, 22, 32, 24, ROAD, 2);

  // Ruined districts give cover.
  b.rect(18, 20, 3, 2, RUINS).rect(28, 28, 2, 3, RUINS).rect(6, 18, 2, 2, RUINS);
  b.rect(22, 40, 2, 2, RUINS).rect(29, 21, 2, 2, RUINS).rect(34, 20, 2, 2, RUINS);

  // Keep base clear.
  b.rect(3, 36, 9, 9, GROUND);

  b.border(CLIFF).mirror();

  const playerBase = { tx: 4, ty: 40 };
  const side = [
    { x: 20, y: 38 },
    { x: 10, y: 22 },
  ];
  return {
    id: 'ashfall',
    name: 'Ashfall Ridge',
    tiles: b.build(),
    playerBase,
    enemyBase: mirrorTile(playerBase, 4),
    capturePoints: [{ x: 32, y: 24 }, ...side, ...side.map(mirrorPoint)],
  };
}
