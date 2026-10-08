import { ATTRITION, SUPPLY } from '../config';
import type { BattleScene } from '../scenes/BattleScene';

/**
 * Battle modifiers: optional rules the player switches on in the skirmish setup. Every modifier
 * changes the game for both sides (it is never a cheat), and only by setting parameters of the
 * systems once, when the battle starts: no system asks "is modifier X on".
 */
export const MODIFIER_IDS = ['storms', 'night', 'plenty', 'scarcity', 'noDefense', 'smallWar', 'bigWar', 'veterans', 'glassCannon', 'blitz'] as const;
export type ModifierId = (typeof MODIFIER_IDS)[number];

export interface ModifierDef {
  id: ModifierId;
  /** Texture key of the 24×24 icon (baked in UITextures). */
  icon: string;
  /** Modifiers this one cannot be combined with; switching one on switches the other off. */
  excludes?: ModifierId[];
  /** Applied once, after every system exists and before the headquarters spawn. */
  apply(battle: ModifierBattle): void;
}

/** The subset of the battle scene a modifier touches (what the tests fake). */
export type ModifierBattle = Pick<BattleScene, 'modifiers' | 'resources' | 'tech' | 'world' | 'supplyHardMax' | 'spawnRank' | 'attritionStart' | 'lookId'>;

/** Supply cap under Small war / Big war. */
export const SUPPLY_SMALL = 20;
export const SUPPLY_BIG = 60;
/** Night: every unit sees this much of its usual range. */
export const NIGHT_SIGHT = 0.6;
/** Blitzkrieg: attrition starts this many seconds in. */
export const BLITZ_ATTRITION_START = 300;

const both = (b: ModifierBattle, f: (m: BattleScene['modifiers']['player']) => void): void => {
  f(b.modifiers.player);
  f(b.modifiers.enemy);
};

export const MODIFIERS: readonly ModifierDef[] = [
  { id: 'storms', icon: 'icon_mod_storms', apply: (b) => { b.world.storms = true; } },
  { id: 'night', icon: 'icon_mod_night', apply: (b) => {
    both(b, (m) => (m.sightMult *= NIGHT_SIGHT));
    b.lookId = 'khorvan';
  } },
  { id: 'plenty', icon: 'icon_mod_plenty', excludes: ['scarcity'], apply: (b) => {
    b.resources.scaleIncome('player', 2);
    b.resources.scaleIncome('enemy', 2);
  } },
  { id: 'scarcity', icon: 'icon_mod_scarcity', excludes: ['plenty'], apply: (b) => {
    b.resources.scaleIncome('player', 0.5);
    b.resources.scaleIncome('enemy', 0.5);
  } },
  { id: 'noDefense', icon: 'icon_mod_noDefense', apply: (b) => { b.tech.lockedCategories.add('defense'); } },
  { id: 'smallWar', icon: 'icon_mod_smallWar', excludes: ['bigWar'], apply: (b) => { b.supplyHardMax = SUPPLY_SMALL; } },
  { id: 'bigWar', icon: 'icon_mod_bigWar', excludes: ['smallWar'], apply: (b) => { b.supplyHardMax = SUPPLY_BIG; } },
  { id: 'veterans', icon: 'icon_mod_veterans', apply: (b) => { b.spawnRank = 2; } },
  { id: 'glassCannon', icon: 'icon_mod_glassCannon', apply: (b) => {
    both(b, (m) => {
      m.damageMult *= 2;
      m.hpMult *= 0.5;
    });
  } },
  { id: 'blitz', icon: 'icon_mod_blitz', apply: (b) => {
    both(b, (m) => (m.buildSpeedMult *= 2));
    b.attritionStart = BLITZ_ATTRITION_START;
  } },
];

export function isModifierId(s: string): s is ModifierId {
  return (MODIFIER_IDS as readonly string[]).includes(s);
}

export function getModifier(id: ModifierId): ModifierDef {
  const d = MODIFIERS.find((m) => m.id === id);
  if (!d) throw new Error(`Unknown modifier ${id}`);
  return d;
}

/**
 * A clean list in registry order: unknown ids dropped, duplicates removed, and of two exclusive
 * modifiers the one picked later wins (the input order is the order of picking).
 */
export function normalizeModifiers(ids: readonly string[]): ModifierId[] {
  const picked: ModifierId[] = [];
  for (const raw of ids) {
    if (!isModifierId(raw)) continue;
    const ex = getModifier(raw).excludes ?? [];
    for (const e of ex) {
      const i = picked.indexOf(e);
      if (i >= 0) picked.splice(i, 1);
    }
    if (!picked.includes(raw)) picked.push(raw);
  }
  return MODIFIER_IDS.filter((id) => picked.includes(id));
}

/** Toggles one modifier in a list, honouring exclusions. */
export function toggleModifier(ids: readonly ModifierId[], id: ModifierId): ModifierId[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : normalizeModifiers([...ids, id]);
}

/** Defaults every modifier may change; the battle scene starts from these each time. */
export function defaultBattleParams(): Pick<ModifierBattle, 'supplyHardMax' | 'spawnRank' | 'attritionStart'> {
  return { supplyHardMax: SUPPLY.hardMax, spawnRank: 0, attritionStart: ATTRITION.start };
}

export function applyModifiers(battle: ModifierBattle, ids: readonly ModifierId[] | undefined): void {
  for (const id of normalizeModifiers(ids ?? [])) getModifier(id).apply(battle);
}
