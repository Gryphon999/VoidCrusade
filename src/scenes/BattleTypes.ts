import { Difficulty } from '../config';
import { CampaignBonuses } from '../campaign/CampaignState';
import { Owner } from '../types';
import type { WargearPick } from '../campaign/Wargear';

export type WinMode = 'annihilation' | 'control' | 'survival';

export interface BattleData {
  mapIndex?: number;
  difficulty?: Difficulty;
  mode?: 'skirmish' | 'campaign' | 'tutorial';
  /** Skirmish victory condition. */
  winMode?: WinMode;
  /** Optional ash storms map modifier. */
  ashStorms?: boolean;
  /** Commander wargear picked before the battle. */
  wargear?: WargearPick;
  /** AI personality (skirmish setup; random if omitted). */
  personality?: string;
  territoryId?: string;
  bonuses?: CampaignBonuses;
  enemyBonusScrip?: number;
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
