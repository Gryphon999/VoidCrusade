import { TILE } from '../config';
import { MapBuilder, MapDef, PointKind } from './MapBuilder';

/**
 * "Ignis Flats" — black glass plains over a living magma field. Two lava rivers and a few lakes
 * divide the ground; basalt causeways and cooled fords are the safe crossings, and anyone in a hurry
 * can wade the fire and pay for it. Nine points.
 */
export function buildMap7(): MapDef {
  const b = new MapBuilder(TILE.GROUND, 96, 72);
  const { CLIFF, ROAD, RUINS, GROUND, LAVA } = TILE;

  // Northern lava river: from the north edge down to the centre.
  b.line(10, 0, 22, 18, LAVA, 3);
  b.line(22, 18, 40, 30, LAVA, 3);
  b.line(40, 30, 46, 36, LAVA, 3);
  // Southern lava river: across the base's eastern approach.
  b.line(30, 72, 44, 58, LAVA, 3);
  b.line(44, 58, 62, 54, LAVA, 3);
  // Lakes.
  b.ellipse(20, 40, 5, 3, LAVA).ellipse(60, 66, 4, 2.5, LAVA).ellipse(6, 20, 2.5, 2, LAVA);
  // The centre itself is cooled rock: the relic point stands on solid ground between the rivers.
  b.ellipse(48, 36, 4.5, 3.5, GROUND);

  // Causeways (plating over the fire) and a cooled ford.
  b.line(32, 20, 32, 32, ROAD, 2);
  b.line(52, 50, 52, 62, ROAD, 2);
  b.rect(44, 32, 4, 8, GROUND);

  // Basalt spires.
  for (const [x, y, rx, ry] of [[30, 60, 3, 3], [14, 46, 3, 2.5], [44, 48, 2.5, 3], [26, 30, 2.5, 2.5], [8, 16, 3, 2], [36, 8, 3, 2], [56, 62, 3, 2.5], [40, 42, 2, 2]]) {
    b.ellipse(x, y, rx, ry, CLIFF);
  }
  b.line(2, 36, 10, 34, CLIFF, 2);

  // Roads: base -> points -> crossings -> centre.
  b.line(12, 62, 24, 60, ROAD, 2);
  b.line(10, 56, 10, 30, ROAD, 2, GROUND);
  b.line(10, 30, 12, 16, ROAD, 2, GROUND);
  b.line(16, 50, 34, 46, ROAD, 2, GROUND);
  b.line(34, 46, 46, 38, ROAD, 2, GROUND);
  b.line(24, 60, 52, 62, ROAD, 2, GROUND);
  b.line(52, 50, 48, 36, ROAD, 2, GROUND);
  b.line(12, 16, 32, 20, ROAD, 2, GROUND);
  b.line(32, 32, 46, 36, ROAD, 2, GROUND);

  // Burnt works.
  b.rect(16, 54, 3, 2, RUINS).rect(28, 42, 2, 3, RUINS).rect(6, 42, 2, 2, RUINS).rect(18, 12, 3, 2, RUINS);
  b.rect(38, 50, 2, 2, RUINS).rect(54, 44, 2, 3, RUINS).rect(26, 22, 2, 2, RUINS).rect(46, 28, 2, 2, RUINS);

  b.rect(3, 54, 12, 12, GROUND);

  const centre: [number, number, PointKind?][] = [[48, 36]];
  const half: [number, number, PointKind?][] = [[16, 50], [10, 28], [34, 46], [12, 14]];
  b.pads(centre).pads(half).border(CLIFF).mirror();

  const playerBase = b.tile(5, 58);
  return {
    id: 'ignis',
    name: 'Ignis Flats',
    w: b.w,
    h: b.h,
    tiles: b.build(),
    playerBase,
    enemyBase: b.mirrorTile(playerBase, 4),
    capturePoints: b.points(centre, half),
  };
}
