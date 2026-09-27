import { MapDef } from './MapBuilder';
import { buildMap1 } from './map1';
import { buildMap2 } from './map2';
import { buildMap3 } from './map3';
import { buildMap4 } from './map4';
import { buildMap5 } from './map5';

export const MAP_BUILDERS: (() => MapDef)[] = [buildMap1, buildMap2, buildMap3, buildMap4, buildMap5];

export function getMap(index: number): MapDef {
  return MAP_BUILDERS[((index % MAP_BUILDERS.length) + MAP_BUILDERS.length) % MAP_BUILDERS.length]();
}
