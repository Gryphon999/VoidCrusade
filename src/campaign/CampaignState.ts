import { START_TERRITORY, THRONE, TERRITORIES, getTerritory, neighbors } from './CampaignData';
import { CardId, CardDef, drawCards } from './UpgradeCards';

const KEY = 'voidcrusade.campaign.v1';

export interface CampaignSave {
  owned: string[];
  cards: CardId[];
  /** Cards offered but not yet chosen (after a victory). */
  offer: CardId[];
  battles: number;
  won: boolean;
}

/** Battle-start bonuses derived from territories and cards. */
export interface CampaignBonuses {
  startScrip: number;
  startFlux: number;
  squadSizeBonus: number;
  maxSquadsBonus: number;
  hpMult: number;
  damageMult: number;
  turretDamageMult: number;
  buildSpeedMult: number;
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export class CampaignState {
  static load(): CampaignSave | null {
    try {
      const raw = safeStorage()?.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as CampaignSave;
      return Array.isArray(s.owned) ? s : null;
    } catch {
      return null;
    }
  }

  static save(s: CampaignSave): void {
    try {
      safeStorage()?.setItem(KEY, JSON.stringify(s));
    } catch {
      /* storage unavailable — campaign lasts for this session only */
    }
  }

  static newCampaign(): CampaignSave {
    const s: CampaignSave = { owned: [START_TERRITORY], cards: [], offer: [], battles: 0, won: false };
    CampaignState.save(s);
    return s;
  }

  /** Enemy territories adjacent to any owned territory. */
  static attackable(s: CampaignSave): string[] {
    const out = new Set<string>();
    for (const id of s.owned) for (const n of neighbors(id)) if (!s.owned.includes(n.id)) out.add(n.id);
    return [...out];
  }

  static recordVictory(s: CampaignSave, territoryId: string): CardDef[] {
    if (!s.owned.includes(territoryId)) s.owned.push(territoryId);
    s.battles++;
    if (territoryId === THRONE || s.owned.length === TERRITORIES.length) s.won = true;
    const cards = drawCards(3);
    s.offer = cards.map((c) => c.id);
    CampaignState.save(s);
    return cards;
  }

  static chooseCard(s: CampaignSave, id: CardId): void {
    s.cards.push(id);
    s.offer = [];
    CampaignState.save(s);
  }

  static bonuses(s: CampaignSave): CampaignBonuses {
    const b: CampaignBonuses = {
      startScrip: 0, startFlux: 0, squadSizeBonus: 0, maxSquadsBonus: 0,
      hpMult: 1, damageMult: 1, turretDamageMult: 1, buildSpeedMult: 1,
    };
    for (const id of s.owned) {
      switch (getTerritory(id).bonus) {
        case 'scrip': b.startScrip += 50; break;
        case 'flux': b.startFlux += 75; break;
        case 'squadSlot': b.maxSquadsBonus += 1; break;
        case 'hp': b.hpMult *= 1.15; break;
        case 'damage': b.damageMult *= 1.1; break;
        case 'build': b.buildSpeedMult *= 1.25; break;
        case 'turret': b.turretDamageMult *= 1.2; break;
        case 'throne': break;
      }
    }
    for (const c of s.cards) {
      switch (c) {
        case 'veterans': b.squadSizeBonus += 2; break;
        case 'turrets': b.turretDamageMult *= 1.2; break;
        case 'warchest': b.startScrip += 300; break;
        case 'munitions': b.damageMult *= 1.1; break;
        case 'ceramite': b.hpMult *= 1.1; break;
        case 'deploy': b.buildSpeedMult *= 1.25; break;
        case 'slot': b.maxSquadsBonus += 1; break;
        case 'fluxres': b.startFlux += 150; break;
      }
    }
    return b;
  }
}
