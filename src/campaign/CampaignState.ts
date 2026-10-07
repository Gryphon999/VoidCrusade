import { START_TERRITORY, THRONE, TERRITORIES, getTerritory, neighbors } from './CampaignData';
import { CardId, CardDef, drawCards } from './UpgradeCards';
import { EventEffect, drawEvent, getEvent } from './CampaignEvents';

const KEY = 'voidcrusade.campaign.v1';

export interface CampaignSave {
  owned: string[];
  cards: CardId[];
  /** Cards offered but not yet chosen (after a victory). */
  offer: CardId[];
  battles: number;
  won: boolean;
  /** Bonuses for the next battle only (from an event). */
  nextBattle?: Partial<CampaignBonuses>;
  /** Extra Horde Scrip in the next battle (from an event). */
  enemyScrip?: number;
  /** An event waiting for the player's answer, and the last one shown. */
  eventId?: string | null;
  lastEventId?: string | null;
  /** A held territory the Horde is attacking: the only battle available until it is fought. */
  underAttack?: string | null;
  /** This turn's change to the counterattack chance (from an event). */
  counterMod?: number;
  /** Territories lost to counterattacks. */
  lost?: number;
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

/** Counterattack chance: base plus a little per battle won, capped. */
export const COUNTER_BASE = 0.3;
export const COUNTER_PER_BATTLE = 0.05;
export const COUNTER_MAX = 0.6;
/** Extra Horde Scrip when it attacks a held territory. */
export const DEFENCE_ENEMY_SCRIP = 100;

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

  /** Territories the player may fight for now: the one under attack, or any Horde land next to the player's. */
  static attackable(s: CampaignSave): string[] {
    if (s.underAttack) return [s.underAttack];
    const out = new Set<string>();
    for (const id of s.owned) for (const n of neighbors(id)) if (!s.owned.includes(n.id)) out.add(n.id);
    return [...out];
  }

  /** Held territories the Horde could strike: bordering Horde land, never the start. */
  static exposed(s: CampaignSave): string[] {
    return s.owned.filter((id) => id !== START_TERRITORY && neighbors(id).some((n) => !s.owned.includes(n.id)));
  }

  /** Chance of a counterattack this turn. */
  static counterChance(s: CampaignSave): number {
    return Math.max(0, Math.min(COUNTER_MAX, COUNTER_BASE + COUNTER_PER_BATTLE * s.battles) + (s.counterMod ?? 0));
  }

  /**
   * A battle won: a conquest adds the territory (a defence keeps it); boons are offered, the next-battle
   * bonuses are spent, and an event may be drawn. The counterattack roll follows the event (or now).
   */
  static recordVictory(s: CampaignSave, territoryId: string, rng: () => number = Math.random): CardDef[] {
    if (!s.owned.includes(territoryId)) s.owned.push(territoryId);
    s.battles++;
    s.underAttack = null;
    s.nextBattle = undefined;
    s.enemyScrip = undefined;
    if (territoryId === THRONE || s.owned.length === TERRITORIES.length) s.won = true;
    const cards = drawCards(3);
    s.offer = cards.map((c) => c.id);
    if (!s.won) {
      const ev = drawEvent(s.lastEventId, rng);
      s.eventId = ev ? ev.id : null;
      if (ev) s.lastEventId = ev.id;
      else CampaignState.rollCounterattack(s, rng);
    }
    CampaignState.save(s);
    return cards;
  }

  /** A battle lost: a failed defence loses the territory; a failed assault loses nothing but the next-battle bonuses. */
  static recordDefeat(s: CampaignSave, territoryId: string, defending: boolean, rng: () => number = Math.random): boolean {
    let lost = false;
    if (defending && s.owned.includes(territoryId) && territoryId !== START_TERRITORY) {
      s.owned = s.owned.filter((id) => id !== territoryId);
      s.lost = (s.lost ?? 0) + 1;
      lost = true;
    }
    s.underAttack = null;
    s.nextBattle = undefined;
    s.enemyScrip = undefined;
    CampaignState.rollCounterattack(s, rng);
    CampaignState.save(s);
    return lost;
  }

  static chooseCard(s: CampaignSave, id: CardId): void {
    s.cards.push(id);
    s.offer = [];
    CampaignState.save(s);
  }

  /** Answers the pending event with option 0 or 1, then rolls the counterattack. Returns the effect applied. */
  static answerEvent(s: CampaignSave, option: 0 | 1, rng: () => number = Math.random): EventEffect {
    const ev = getEvent(s.eventId ?? '');
    const fx = ev.options[option];
    CampaignState.applyEffect(s, fx, rng);
    s.eventId = null;
    CampaignState.rollCounterattack(s, rng);
    CampaignState.save(s);
    return fx;
  }

  static applyEffect(s: CampaignSave, fx: EventEffect, rng: () => number = Math.random): void {
    if (fx.nextBattle) {
      const n = { ...(s.nextBattle ?? {}) };
      for (const [k, v] of Object.entries(fx.nextBattle) as [keyof CampaignBonuses, number][]) {
        const mult = k.endsWith('Mult');
        n[k] = mult ? (n[k] ?? 1) * v : (n[k] ?? 0) + v;
      }
      s.nextBattle = n;
    }
    if (fx.card) s.cards.push(fx.card);
    if (fx.loseCard && s.cards.length) s.cards.splice(Math.floor(rng() * s.cards.length), 1);
    if (fx.enemyScrip) s.enemyScrip = (s.enemyScrip ?? 0) + fx.enemyScrip;
    if (fx.counterattack) s.counterMod = (s.counterMod ?? 0) + fx.counterattack;
  }

  /** Rolls the Horde's counterattack for this turn; the event's modifier is spent either way. */
  static rollCounterattack(s: CampaignSave, rng: () => number = Math.random): string | null {
    const chance = CampaignState.counterChance(s);
    s.counterMod = 0;
    const targets = CampaignState.exposed(s);
    if (s.won || !targets.length || rng() >= chance) {
      s.underAttack = null;
      return null;
    }
    s.underAttack = targets[Math.floor(rng() * targets.length)];
    return s.underAttack;
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
    // The next battle's one-off bonuses from an event.
    for (const [k, v] of Object.entries(s.nextBattle ?? {}) as [keyof CampaignBonuses, number][]) {
      if (k.endsWith('Mult')) b[k] *= v;
      else b[k] += v;
    }
    b.startScrip = Math.max(0, b.startScrip);
    b.startFlux = Math.max(0, b.startFlux);
    return b;
  }
}
