import { Difficulty } from '../config';
import { CampaignBonuses } from '../campaign/CampaignState';
import { Owner } from '../types';
import type { WargearPick } from '../campaign/Wargear';
import type { ModifierId } from '../battle/BattleModifiers';
import type { Faction } from '../units/UnitDefs';

export type WinMode = 'annihilation' | 'control' | 'survival' | 'hold' | 'nests' | 'evac' | 'koth';
/** Every skirmish victory condition, in menu order. */
export const WIN_MODES: readonly WinMode[] = ['annihilation', 'control', 'survival', 'hold', 'nests', 'evac', 'koth'];

export interface BattleData {
  /** The player's faction (skirmish); the campaign and the tutorial are Iron Void. */
  faction?: Faction;
  mapIndex?: number;
  difficulty?: Difficulty;
  mode?: 'skirmish' | 'campaign' | 'tutorial';
  /** Skirmish victory condition. */
  winMode?: WinMode;
  /** Battle modifiers switched on in the skirmish setup (see BattleModifiers). */
  modifiers?: ModifierId[];
  /** Commander wargear picked before the battle. */
  wargear?: WargearPick;
  /** AI personality (skirmish setup; random if omitted). */
  personality?: string;
  territoryId?: string;
  bonuses?: CampaignBonuses;
  enemyBonusScrip?: number;
  /** Campaign: defending a held territory against a Horde counterattack. */
  defense?: boolean;
}

export interface BattleStats {
  kills: number;
  losses: number;
  buildingsLost: number;
  buildingsDestroyed: number;
}

export interface BattleResult {
  winner: Owner;
  time: number;
  stats: BattleStats;
  data: BattleData;
}
