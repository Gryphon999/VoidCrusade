import type { CampaignBonuses } from './CampaignState';
import type { CardId } from './UpgradeCards';

/**
 * Events between campaign battles: a situation and two ways to answer it, each with a price.
 * Texts live in i18n under `ev.<id>.title`, `ev.<id>.text`, `ev.<id>.a`, `ev.<id>.b`.
 */
export interface EventEffect {
  /** Bonuses for the next battle only (added to / multiplied into the campaign bonuses). */
  nextBattle?: Partial<CampaignBonuses>;
  /** A boon card gained for good. */
  card?: CardId;
  /** Lose one random boon card (nothing happens without cards). */
  loseCard?: boolean;
  /** Extra Horde Scrip in the next battle. */
  enemyScrip?: number;
  /** Change (±) to this turn's counterattack chance. */
  counterattack?: number;
}

export interface EventDef {
  id: string;
  options: [EventEffect, EventEffect];
}

export const EVENT_CHANCE = 0.6;

export const EVENTS: EventDef[] = [
  { id: 'salvage', options: [{ nextBattle: { startScrip: 300 } }, { nextBattle: { startFlux: 150 } }] },
  { id: 'relic', options: [{ nextBattle: { startFlux: 150 }, counterattack: 0.2 }, { counterattack: -0.15 }] },
  { id: 'plague', options: [{ nextBattle: { hpMult: 0.9 } }, { loseCard: true, nextBattle: { startScrip: -150 } }] },
  { id: 'tithe', options: [{ nextBattle: { startScrip: 400 }, enemyScrip: 250 }, {}] },
  { id: 'veterans', options: [{ nextBattle: { squadSizeBonus: 2 } }, { nextBattle: { maxSquadsBonus: 1 } }] },
  { id: 'stirs', options: [{ counterattack: -0.3, nextBattle: { damageMult: 0.95 } }, { nextBattle: { turretDamageMult: 1.3 }, counterattack: 0.2 }] },
  { id: 'supply', options: [{ nextBattle: { buildSpeedMult: 0.8 } }, { nextBattle: { startScrip: 200, hpMult: 0.95 } }] },
  { id: 'pilgrims', options: [{ card: 'slot', counterattack: 0.15 }, { nextBattle: { startScrip: 150 } }] },
];

export function getEvent(id: string): EventDef {
  const e = EVENTS.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown event ${id}`);
  return e;
}

/** Draws an event (never the previous one), or null when no event happens this turn. */
export function drawEvent(lastId: string | null | undefined, rng: () => number = Math.random): EventDef | null {
  if (rng() >= EVENT_CHANCE) return null;
  const pool = EVENTS.filter((e) => e.id !== lastId);
  return pool[Math.floor(rng() * pool.length)];
}

/** Human-readable effect parts for the UI (keys into i18n with params). */
export function describeEffect(e: EventEffect): { key: string; params?: Record<string, number> }[] {
  const out: { key: string; params?: Record<string, number> }[] = [];
  const n = e.nextBattle ?? {};
  if (n.startScrip) out.push({ key: n.startScrip > 0 ? 'ev.fx.scrip' : 'ev.fx.scripLoss', params: { n: Math.abs(n.startScrip) } });
  if (n.startFlux) out.push({ key: 'ev.fx.flux', params: { n: n.startFlux } });
  if (n.squadSizeBonus) out.push({ key: 'ev.fx.squadSize', params: { n: n.squadSizeBonus } });
  if (n.maxSquadsBonus) out.push({ key: 'ev.fx.slot', params: { n: n.maxSquadsBonus } });
  if (n.hpMult && n.hpMult !== 1) out.push({ key: 'ev.fx.hp', params: { n: Math.round((n.hpMult - 1) * 100) } });
  if (n.damageMult && n.damageMult !== 1) out.push({ key: 'ev.fx.damage', params: { n: Math.round((n.damageMult - 1) * 100) } });
  if (n.turretDamageMult && n.turretDamageMult !== 1) out.push({ key: 'ev.fx.turrets', params: { n: Math.round((n.turretDamageMult - 1) * 100) } });
  if (n.buildSpeedMult && n.buildSpeedMult !== 1) out.push({ key: 'ev.fx.build', params: { n: Math.round((n.buildSpeedMult - 1) * 100) } });
  if (e.card) out.push({ key: 'ev.fx.card' });
  if (e.loseCard) out.push({ key: 'ev.fx.loseCard' });
  if (e.enemyScrip) out.push({ key: 'ev.fx.enemy', params: { n: e.enemyScrip } });
  if (e.counterattack) out.push({ key: e.counterattack > 0 ? 'ev.fx.counterUp' : 'ev.fx.counterDown', params: { n: Math.round(Math.abs(e.counterattack) * 100) } });
  if (!out.length) out.push({ key: 'ev.fx.nothing' });
  return out;
}
