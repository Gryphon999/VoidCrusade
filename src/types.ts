export type Owner = 'player' | 'enemy';
export type ResourceType = 'scrip' | 'flux';

export const OWNERS: readonly Owner[] = ['player', 'enemy'];

export function opponent(o: Owner): Owner {
  return o === 'player' ? 'enemy' : 'player';
}
