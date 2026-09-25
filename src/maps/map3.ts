import { TILE } from '../config';
import { MapBuilder, MapDef, mirrorPoint, mirrorTile } from './MapBuilder';

/** "Khorvan Deep" — a mining canyon: cliffs everywhere, fighting funnels through three passes. */
export function buildMap3(): MapDef {
  const b = new MapBuilder(TILE.CLIFF);
  const { ROAD, RUINS, GROUND } = TILE;

  // Carve the player's plateau and canyons out of solid rock.
  b.rect(2, 32, 16, 14, GROUND);
  b.line(10, 32, 10, 14, GROUND, 5);
  b.line(16, 38, 36, 38, GROUND, 5);
  b.line(12, 14, 30, 20, GROUND, 5);
  b.line(34, 38, 34, 26, GROUND, 5);
  b.ellipse(32, 24, 7, 6, GROUND);
  b.ellipse(10, 14, 5, 4, GROUND);
  b.ellipse(28, 40, 4, 4, GROUND);
  b.line(18, 30, 26, 26, GROUND, 3);

  // Mine tracks.
  b.line(8, 38, 26, 38, ROAD, 2);
  b.line(10, 34, 10, 16, ROAD, 2);
  b.line(26, 38, 32, 26, ROAD, 2, GROUND);

  // Collapsed mine buildings for cover.
  b.rect(20, 36, 2, 2, RUINS).rect(8, 22, 2, 2, RUINS).rect(28, 22, 2, 3, RUINS).rect(22, 27, 2, 2, RUINS).rect(35, 30, 2, 2, RUINS);

  b.rect(3, 36, 9, 9, GROUND);
  b.border(TILE.CLIFF).mirror();

  const playerBase = { tx: 4, ty: 40 };
  const side = [
    { x: 28, y: 40 },
    { x: 10, y: 14 },
  ];
  return {
    id: 'khorvan',
    name: 'Khorvan Deep',
    tiles: b.build(),
    playerBase,
    enemyBase: mirrorTile(playerBase, 4),
    capturePoints: [{ x: 32, y: 24 }, ...side, ...side.map(mirrorPoint)],
  };
}
