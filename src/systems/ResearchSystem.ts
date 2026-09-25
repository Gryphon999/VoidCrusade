import { EV } from '../events';
import { researchName } from '../i18n/names';
import { Building } from '../buildings/Building';
import { Resources } from './ResourceSystem';
import { Modifiers } from './Modifiers';
import { Owner } from '../types';
import type { BuildingRole } from '../buildings/BuildingDefs';
import type { Faction } from '../units/UnitDefs';
import type { BattleScene } from '../scenes/BattleScene';

export type ResearchId =
  | 'plasma' | 'ceramite' | 'overcharge' | 'fabrication' | 'conscription' | 'carapace' | 'servos'
  | 'adrenal' | 'chitin' | 'spines' | 'accelerated' | 'broodmind' | 'musculature' | 'hardened';

export interface ResearchDef {
  id: ResearchId;
  name: string;
  faction: Faction;
  /** Building role that researches it. */
  at: BuildingRole;
  cost: Resources;
  time: number;
  description: string;
  apply: (m: Modifiers) => void;
}

const IV = { faction: 'ironvoid' as Faction, at: 'research' as BuildingRole };
const NH = { faction: 'nullhorde' as Faction, at: 'research' as BuildingRole };

export const RESEARCH_DEFS: ResearchDef[] = [
  { id: 'plasma', name: 'Plasma Rounds', ...IV, cost: { scrip: 150, flux: 100 }, time: 30,
    description: '+20% damage for all squads.', apply: (m) => (m.damageMult *= 1.2) },
  { id: 'ceramite', name: 'Ceramite Plating', ...IV, cost: { scrip: 150, flux: 100 }, time: 30,
    description: '+20% soldier HP.', apply: (m) => (m.hpMult *= 1.2) },
  { id: 'overcharge', name: 'Turret Overcharge', ...IV, cost: { scrip: 100, flux: 100 }, time: 20,
    description: '+30% turret damage.', apply: (m) => (m.turretDamageMult *= 1.3) },
  { id: 'fabrication', name: 'Rapid Fabrication', ...IV, cost: { scrip: 100, flux: 50 }, time: 20,
    description: '+50% construction speed.', apply: (m) => (m.buildSpeedMult *= 1.5) },
  { id: 'conscription', name: 'Mass Conscription', ...IV, cost: { scrip: 200, flux: 50 }, time: 25,
    description: '+6 supply.', apply: (m) => (m.supplyBonus += 6) },
  { id: 'carapace', name: 'Plasteel Carapace', faction: 'ironvoid', at: 'armoury', cost: { scrip: 150, flux: 100 }, time: 30,
    description: 'Infantry take 15% less damage.', apply: (m) => (m.infantryArmorMult *= 0.85) },
  { id: 'servos', name: 'Servo Greaves', faction: 'ironvoid', at: 'armoury', cost: { scrip: 120, flux: 60 }, time: 25,
    description: 'Infantry move 12% faster.', apply: (m) => (m.infantrySpeedMult *= 1.12) },
  { id: 'adrenal', name: 'Adrenal Glands', ...NH, cost: { scrip: 150, flux: 100 }, time: 30,
    description: '+20% damage for all beasts.', apply: (m) => (m.damageMult *= 1.2) },
  { id: 'chitin', name: 'Thickened Chitin', ...NH, cost: { scrip: 150, flux: 100 }, time: 30,
    description: '+20% HP for all beasts.', apply: (m) => (m.hpMult *= 1.2) },
  { id: 'spines', name: 'Barbed Spines', ...NH, cost: { scrip: 100, flux: 100 }, time: 20,
    description: '+30% tower damage.', apply: (m) => (m.turretDamageMult *= 1.3) },
  { id: 'accelerated', name: 'Accelerated Growth', ...NH, cost: { scrip: 100, flux: 50 }, time: 20,
    description: '+50% growth (construction) speed.', apply: (m) => (m.buildSpeedMult *= 1.5) },
  { id: 'broodmind', name: 'Brood Mind', ...NH, cost: { scrip: 200, flux: 50 }, time: 25,
    description: '+6 supply.', apply: (m) => (m.supplyBonus += 6) },
  { id: 'musculature', name: 'Hyper Musculature', ...NH, cost: { scrip: 120, flux: 60 }, time: 25,
    description: 'Swarm infantry move 12% faster.', apply: (m) => (m.infantrySpeedMult *= 1.12) },
  { id: 'hardened', name: 'Hardened Carapace', ...NH, cost: { scrip: 150, flux: 100 }, time: 30,
    description: 'Swarm infantry take 15% less damage.', apply: (m) => (m.infantryArmorMult *= 0.85) },
];

/** Research a building offers (by its role and faction). */
export function researchAt(faction: Faction, role: BuildingRole): ResearchDef[] {
  return RESEARCH_DEFS.filter((r) => r.faction === faction && r.at === role);
}

interface Active {
  id: ResearchId;
  t: number;
}

/** Upgrades researched at the Void Foundry. */
export class ResearchSystem {
  private done: Record<Owner, Set<ResearchId>> = { player: new Set(), enemy: new Set() };
  private active = new Map<Building, Active>();

  constructor(private battle: BattleScene) {}

  isDone(owner: Owner, id: ResearchId): boolean {
    return this.done[owner].has(id);
  }

  isResearching(owner: Owner, id: ResearchId): boolean {
    for (const [b, a] of this.active) if (b.owner === owner && a.id === id) return true;
    return false;
  }

  activeAt(b: Building): { def: ResearchDef; frac: number } | null {
    const a = this.active.get(b);
    if (!a) return null;
    const def = RESEARCH_DEFS.find((d) => d.id === a.id) as ResearchDef;
    return { def, frac: a.t / def.time };
  }

  start(b: Building, id: ResearchId): boolean {
    const def = RESEARCH_DEFS.find((d) => d.id === id);
    if (!def || !b.isReady || b.def.role !== def.at || b.def.faction !== def.faction || this.active.has(b)) return false;
    if (this.isDone(b.owner, id) || this.isResearching(b.owner, id)) return false;
    if (!this.battle.resources.trySpend(b.owner, def.cost)) {
      this.battle.events.emit(EV.message, 'err.resources');
      return false;
    }
    this.active.set(b, { id, t: 0 });
    return true;
  }

  update(dt: number): void {
    for (const [b, a] of this.active) {
      if (!b.alive) {
        this.active.delete(b);
        continue;
      }
      a.t += dt;
      const def = RESEARCH_DEFS.find((d) => d.id === a.id) as ResearchDef;
      if (a.t >= def.time) {
        this.active.delete(b);
        this.complete(b.owner, def);
      }
    }
  }

  complete(owner: Owner, def: ResearchDef): void {
    this.done[owner].add(def.id);
    const mods = this.battle.modifiers[owner];
    const oldHp = mods.hpMult;
    def.apply(mods);
    if (mods.hpMult !== oldHp) {
      const ratio = mods.hpMult / oldHp;
      for (const s of this.battle.units.getSquads(owner)) {
        for (const u of s.units) {
          u.maxHp *= ratio;
          u.hp *= ratio;
        }
      }
    }
    this.battle.buildings.buildSpeed[owner] = mods.buildSpeedMult;
    this.battle.events.emit(EV.researchDone, owner, def);
    if (owner === 'player') this.battle.events.emit(EV.message, 'note.research', { name: researchName(def.id) });
  }
}
