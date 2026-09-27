import { TILE } from '../config';
import { MapBuilder, MapDef, PointKind } from './MapBuilder';

/** "Ashfall Ridge" — two ridges funnel fighting through the ruined city center. */
export function buildMap1(): MapDef {
  // Drawn on a 64×48 sheet, built one and a half times larger.
  const b = new MapBuilder(TILE.GROUND, 96, 72, 1.5);
  const { CLIFF, ROAD, RUINS, GROUND } = TILE;

  // Ridges on the player half (mirrored later).
  b.line(4, 30, 16, 26, CLIFF, 2);
  b.line(22, 34, 26, 44, CLIFF, 2);
  b.ellipse(24, 18, 4, 3, CLIFF);
  b.ellipse(14, 12, 3, 2, CLIFF);
  b.line(30, 36, 38, 32, CLIFF, 2);
  // Outcrops that break up the wider flanks.
  b.ellipse(36, 44, 2.5, 1.5, CLIFF).ellipse(3, 16, 1.5, 3, CLIFF).ellipse(18, 5, 3, 1.5, CLIFF);

  // Roads: base -> side points -> center, and out to the flank points.
  b.line(10, 40, 20, 38, ROAD, 2);
  b.line(8, 38, 10, 22, ROAD, 2);
  b.line(20, 38, 32, 24, ROAD, 2);
  b.line(10, 22, 32, 24, ROAD, 2);
  b.line(10, 22, 7, 10, ROAD, 1.4);
  b.line(12, 43, 31, 42, ROAD, 1.4, GROUND);

  // Ruined districts give cover.
  b.rect(18, 20, 3, 2, RUINS).rect(28, 28, 2, 3, RUINS).rect(6, 18, 2, 2, RUINS);
  b.rect(22, 40, 2, 2, RUINS).rect(29, 21, 2, 2, RUINS).rect(34, 20, 2, 2, RUINS);
  b.rect(9, 8, 2, 1.5, RUINS).rect(33, 39, 1.5, 2, RUINS).rect(14, 33, 2, 1.5, RUINS);

  // Keep base clear.
  b.rect(3, 36, 9, 9, GROUND);

  const centre: [number, number, PointKind?][] = [[32, 24]];
  const half: [number, number, PointKind?][] = [[20, 38], [10, 22], [6, 10], [31, 42]];
  b.pads(centre).pads(half).border(CLIFF).mirror();

  const playerBase = b.tile(4, 40);
  return {
    id: 'ashfall',
    name: 'Ashfall Ridge',
    w: b.w,
    h: b.h,
    tiles: b.build(),
    playerBase,
    enemyBase: b.mirrorTile(playerBase, 4),
    capturePoints: b.points(centre, half),
  };
}
