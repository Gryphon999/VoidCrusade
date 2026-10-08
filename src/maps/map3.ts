import { TILE } from '../config';
import { MapBuilder, MapDef, PointKind } from './MapBuilder';

/** "Khorvan Deep" — a mining canyon: cliffs everywhere, fighting funnels through three passes. */
export function buildMap3(): MapDef {
  // Drawn on a 64×48 sheet, built one and a half times larger.
  const b = new MapBuilder(TILE.CLIFF, 96, 72, 1.5);
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
  // Side chambers for the outer points, each with one way in.
  b.ellipse(12, 24, 4, 3.5, GROUND);
  b.ellipse(5, 6, 3.5, 3.5, GROUND);
  b.line(6, 8, 9, 12, GROUND, 3);
  b.ellipse(44, 43, 4, 3, GROUND);
  b.line(36, 40, 42, 42, GROUND, 3);

  // Mine tracks.
  b.line(8, 38, 26, 38, ROAD, 2);
  b.line(10, 34, 10, 16, ROAD, 2);
  b.line(26, 38, 32, 26, ROAD, 2, GROUND);

  // Collapsed mine buildings for cover.
  b.rect(20, 36, 2, 2, RUINS).rect(8, 22, 2, 2, RUINS).rect(28, 22, 2, 3, RUINS).rect(22, 27, 2, 2, RUINS).rect(35, 30, 2, 2, RUINS);
  b.rect(14, 25, 1.5, 1.5, RUINS).rect(41, 41, 1.5, 1.5, RUINS);

  b.rect(3, 36, 9, 9, GROUND);

  // Galleries: two side chambers sit a level above the canyon floor, each reached only up the ramp
  // of its single entrance, so a point taken there is held from above.
  b.raiseEllipse(44, 43, 4, 3);
  b.ramp(39, 40.5, 3, 2.5);
  b.raiseEllipse(5, 6, 3.5, 3.5);
  b.ramp(6, 8.5, 3, 2.5);

  const centre: [number, number, PointKind?][] = [[32, 24]];
  const half: [number, number, PointKind?][] = [[28, 40], [10, 14], [12, 24], [44, 43]];
  b.pads(centre).pads(half).border(TILE.CLIFF).mirror();

  const playerBase = b.tile(4, 40);
  return {
    id: 'khorvan',
    name: 'Khorvan Deep',
    w: b.w,
    h: b.h,
    tiles: b.build(),
    levels: b.buildLevels(),
    playerBase,
    enemyBase: b.mirrorTile(playerBase, 4),
    capturePoints: b.points(centre, half),
  };
}
