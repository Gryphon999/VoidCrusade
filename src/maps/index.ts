import { MapDef } from './MapBuilder';
import { buildMap1 } from './map1';

export const MAP_BUILDERS: (() => MapDef)[] = [buildMap1];

export function getMap(index: number): MapDef {
  return MAP_BUILDERS[((index % MAP_BUILDERS.length) + MAP_BUILDERS.length) % MAP_BUILDERS.length]();
}
