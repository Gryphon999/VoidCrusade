import { UNITS } from '../config';
import { EV } from '../events';
import { Building } from '../buildings/Building';
import { UNIT_DEFS, UnitId } from '../units/UnitDefs';
import { Squad } from '../units/Squad';
import type { BattleScene } from '../scenes/BattleScene';
import { Owner } from '../types';

/** Unit training queues on production buildings. */
export class ProductionSystem {
  constructor(private battle: BattleScene) {}

  private queuedCount(owner: Owner, predicate: (id: UnitId) => boolean): number {
    let n = 0;
    for (const b of this.battle.buildings.getOwned(owner)) n += b.queue.filter(predicate).length;
    return n;
  }

  /** Returns an error message, or null if the unit can be queued. */
  checkEnqueue(b: Building, id: UnitId): string | null {
    const def = UNIT_DEFS[id];
    if (!b.isReady) return 'Building not ready';
    if (!b.def.produces.includes(id)) return 'Cannot train here';
    if (b.queue.length >= UNITS.queueMax) return 'Queue full';
    if (def.isHero) {
      const alive = this.battle.units.getSquads(b.owner).some((s) => s.def.id === id);
      if (alive || this.queuedCount(b.owner, (q) => q === id) > 0) return 'Commander already deployed';
    } else {
      const army = this.battle.units.armyCount(b.owner) + this.queuedCount(b.owner, (q) => !UNIT_DEFS[q].isHero);
      if (army >= this.battle.units.maxSquads(b.owner)) return 'Squad cap reached';
    }
    if (!this.battle.resources.canAfford(b.owner, def.cost)) return 'Not enough resources';
    return null;
  }

  enqueue(b: Building, id: UnitId): boolean {
    const err = this.checkEnqueue(b, id);
    if (err) {
      if (b.owner === 'player') this.battle.events.emit(EV.message, err);
      return false;
    }
    this.battle.resources.spend(b.owner, UNIT_DEFS[id].cost);
    b.queue.push(id);
    b.refreshVisual();
    return true;
  }

  cancel(b: Building, index: number): void {
    const id = b.queue[index];
    if (!id) return;
    b.queue.splice(index, 1);
    if (index === 0) b.queueTime = 0;
    this.battle.resources.refund(b.owner, UNIT_DEFS[id].cost);
    b.refreshVisual();
  }

  update(dt: number): void {
    for (const b of this.battle.buildings.buildings) {
      if (!b.isReady || b.queue.length === 0) continue;
      b.queueTime += dt;
      const id = b.queue[0];
      if (b.queueTime >= UNIT_DEFS[id].trainTime) {
        b.queue.shift();
        b.queueTime = 0;
        this.spawnFrom(b, id);
      }
      b.refreshVisual();
    }
  }

  /** Spawns a squad at the building's exit and sends it to the rally point. */
  spawnFrom(b: Building, id: UnitId): Squad {
    const exitY = b.y + b.radius + 24;
    const s = this.battle.units.spawnSquad(id, b.owner, b.x, exitY);
    s.moveTo(b.rally.x, b.rally.y);
    return s;
  }
}
