import { Resources } from '../systems/ResourceSystem';

export type UnitId = 'rifleman' | 'heavy' | 'commander' | 'crawler' | 'behemoth';
export type Faction = 'ironvoid' | 'nullhorde';

export interface UnitDef {
  id: UnitId;
  name: string;
  faction: Faction;
  squadSize: number;
  hp: number;
  damage: number;
  range: number;
  speed: number;
  cost: Resources;
  /** Seconds between shots per soldier. */
  cooldown: number;
  trainTime: number;
  /** Visual radius of one soldier in px. */
  size: number;
  projectile: 'bullet' | 'shell' | 'spit' | 'melee';
  isHero?: boolean;
  description: string;
}

export const UNIT_DEFS: Record<UnitId, UnitDef> = {
  rifleman: {
    id: 'rifleman', name: 'Void Riflemen', faction: 'ironvoid', squadSize: 6, hp: 80, damage: 12, range: 200,
    speed: 90, cost: { scrip: 80, flux: 0 }, cooldown: 1.0, trainTime: 8, size: 7, projectile: 'bullet',
    description: 'Line infantry. Cheap, reliable, expendable.',
  },
  heavy: {
    id: 'heavy', name: 'Iron Guard', faction: 'ironvoid', squadSize: 4, hp: 150, damage: 30, range: 150,
    speed: 60, cost: { scrip: 120, flux: 40 }, cooldown: 1.6, trainTime: 12, size: 9, projectile: 'shell',
    description: 'Armoured heavy weapons team.',
  },
  commander: {
    id: 'commander', name: 'Void Commander', faction: 'ironvoid', squadSize: 1, hp: 400, damage: 50, range: 180,
    speed: 80, cost: { scrip: 0, flux: 0 }, cooldown: 1.2, trainTime: 30, size: 12, projectile: 'shell',
    isHero: true, description: 'Hero of the crusade. Inspires nearby troops.',
  },
  crawler: {
    id: 'crawler', name: 'Void Crawler', faction: 'nullhorde', squadSize: 8, hp: 60, damage: 10, range: 120,
    speed: 120, cost: { scrip: 70, flux: 0 }, cooldown: 0.8, trainTime: 7, size: 6, projectile: 'spit',
    description: 'Fast chitinous swarm-beasts.',
  },
  behemoth: {
    id: 'behemoth', name: 'Null Behemoth', faction: 'nullhorde', squadSize: 2, hp: 300, damage: 60, range: 100,
    speed: 45, cost: { scrip: 160, flux: 60 }, cooldown: 2.0, trainTime: 14, size: 14, projectile: 'melee',
    description: 'Hulking bio-titan. Crushes armour and bone alike.',
  },
};
