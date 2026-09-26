import { TILE } from '../config';
import { MapBuilder, MapDef } from './MapBuilder';

/**
 * "Proving Grounds" — the tutorial map: a sheltered base valley in the west, a Void-Nexus
 * behind a ruined wall, and a small Horde outpost across a ridge in the east. Not symmetric.
 */
export function buildTutorialMap(): MapDef {
  const b = new MapBuilder(TILE.CLIFF);
  const { CLIFF, ROAD, RUINS, GROUND } = TILE;
  // Playable area: a wide valley in the middle of the map.
  b.rect(2, 8, 60, 32, GROUND);
  b.ellipse(12, 24, 10, 12, GROUND);
  b.ellipse(50, 22, 10, 11, GROUND);
  // Ridge splitting the valley, crossed by two passes.
  b.line(34, 8, 34, 39, CLIFF, 2);
  b.rect(34, 14, 2, 3, GROUND).rect(34, 29, 2, 3, GROUND);
  b.ellipse(24, 12, 3, 2, CLIFF).ellipse(22, 35, 3, 2, CLIFF);
  // Roads.
  b.line(10, 30, 26, 22, ROAD, 2);
  b.line(26, 22, 34, 15, ROAD, 2);
  b.line(34, 15, 48, 18, ROAD, 2);
  // Ruins for the cover lesson, right next to the Nexus.
  b.rect(22, 25, 3, 2, RUINS).rect(28, 18, 2, 2, RUINS).rect(19, 19, 2, 2, RUINS);
  b.rect(4, 26, 10, 10, GROUND);
  b.border(CLIFF);
  return {
    id: 'proving',
    name: 'Proving Grounds',
    tiles: b.build(),
    playerBase: { tx: 6, ty: 28 },
    enemyBase: { tx: 52, ty: 18 },
    capturePoints: [{ x: 26, y: 22, kind: 'strategic' }, { x: 44, y: 30, kind: 'strategic' }],
  };
}
