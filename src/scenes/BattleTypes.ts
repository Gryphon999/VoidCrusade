import { Difficulty } from '../config';
import { CampaignBonuses } from '../campaign/CampaignState';
import { Owner } from '../types';

export interface BattleData {
  mapIndex?: number;
  difficulty?: Difficulty;
  mode?: 'skirmish' | 'campaign';
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
