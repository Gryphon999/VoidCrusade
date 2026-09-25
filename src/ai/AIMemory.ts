import { AI } from '../config';
import { Owner, opponent } from '../types';
import { ArmorClass, DamageType } from '../units/Damage';
import { Squad } from '../units/Squad';
import { Building } from '../buildings/Building';
import type { BattleScene } from '../scenes/BattleScene';

export interface Sighting {
  x: number;
  y: number;
  /** Battle time of the last sighting. */
  t: number;
  supply: number;
  armor: ArmorClass;
  damage: DamageType;
}

/**
 * What the AI has actually seen of its opponent (no map hacks): enemy squads and structures
 * within its own vision, remembered for a while. Counter-picks, attack targets and harassment
 * are chosen from this.
 */
export class AIMemory {
  readonly squads = new Map<Squad, Sighting>();
  readonly buildings = new Map<Building, { x: number; y: number; t: number; defense: boolean }>();

  constructor(private battle: BattleScene, private owner: Owner) {}

  update(): void {
    const b = this.battle;
    const now = b.elapsed;
    const foe = opponent(this.owner);
    for (const s of b.units.getSquads(foe)) {
      if (s.hiddenFrom(this.owner)) continue;
      const c = s.center;
      if (!b.fogVisibleFor(this.owner, c.x, c.y)) continue;
      this.squads.set(s, { x: c.x, y: c.y, t: now, supply: Math.max(1, s.def.supply) * (s.hp / Math.max(1, s.maxHp)), armor: s.def.armor, damage: s.def.damageType });
    }
    for (const bl of b.buildings.getOwned(foe)) {
      if (this.buildings.has(bl) || !b.fogVisibleFor(this.owner, bl.x, bl.y)) continue;
      this.buildings.set(bl, { x: bl.x, y: bl.y, t: now, defense: !!bl.def.attack });
    }
    for (const [s, v] of this.squads) if (!s.alive || now - v.t > AI.memory) this.squads.delete(s);
    for (const bl of this.buildings.keys()) if (!bl.alive) this.buildings.delete(bl);
  }

  /** Remembered enemy supply around a point (squads, plus towers as 3 each). */
  strengthNear(x: number, y: number, r: number): number {
    let n = 0;
    for (const v of this.squads.values()) if (Math.hypot(v.x - x, v.y - y) <= r) n += v.supply;
    for (const v of this.buildings.values()) if (v.defense && Math.hypot(v.x - x, v.y - y) <= r) n += 3;
    return n;
  }

  get totalSupply(): number {
    let n = 0;
    for (const v of this.squads.values()) n += v.supply;
    return n;
  }

  /** Share of remembered enemy supply per armour class and per damage type. */
  mix(): { armor: Partial<Record<ArmorClass, number>>; damage: Partial<Record<DamageType, number>>; total: number } {
    const armor: Partial<Record<ArmorClass, number>> = {};
    const damage: Partial<Record<DamageType, number>> = {};
    let total = 0;
    for (const v of this.squads.values()) {
      armor[v.armor] = (armor[v.armor] ?? 0) + v.supply;
      damage[v.damage] = (damage[v.damage] ?? 0) + v.supply;
      total += v.supply;
    }
    for (const v of this.buildings.values()) {
      if (!v.defense) continue;
      armor.building = (armor.building ?? 0) + 1.5;
      total += 1.5;
    }
    if (total > 0) {
      for (const k of Object.keys(armor) as ArmorClass[]) armor[k] = (armor[k] ?? 0) / total;
      for (const k of Object.keys(damage) as DamageType[]) damage[k] = (damage[k] ?? 0) / total;
    }
    return { armor, damage, total };
  }
}
