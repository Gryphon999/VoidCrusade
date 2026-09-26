import { UNITS } from '../config';
import { EV } from '../events';
import type { MessageKey } from '../i18n';
import { Building } from '../buildings/Building';
import { UNIT_DEFS, UnitId } from '../units/UnitDefs';
import { Squad } from '../units/Squad';
import type { BattleScene } from '../scenes/BattleScene';
import { Owner } from '../types';

/**
 * Unit training queues on production buildings: up to 5 items each, cancel with full refund,
 * optional repeat (the finished item is queued again if affordable), rally point per building.
 */
export class ProductionSystem {
  constructor(private battle: BattleScene) {}

  private queuedCount(owner: Owner, predicate: (id: UnitId) => boolean): number {
    let n = 0;
    for (const b of this.battle.buildings.getOwned(owner)) n += b.queue.filter(predicate).length;
    return n;
  }

  /** Supply of everything queued but not yet trained. */
  queuedSupply(owner: Owner): number {
    let n = 0;
    for (const b of this.battle.buildings.getOwned(owner)) for (const q of b.queue) n += UNIT_DEFS[q].supply;
    return n;
  }

  /** Supply in use including the queues (what the top bar shows). */
  supplyUsed(owner: Owner): number {
    return this.battle.units.supplyUsed(owner) + this.queuedSupply(owner);
  }

  /** Localised "why is this locked" text (tier / missing buildings), or null. */
  lockReason(b: Building, id: UnitId): string | null {
    const d = UNIT_DEFS[id];
    return this.battle.tech.lockReason(b.owner, d.tier, d.requires);
  }

  /** Returns an error message, or null if the unit can be queued. */
  checkEnqueue(b: Building, id: UnitId): MessageKey | null {
    const def = UNIT_DEFS[id];
    if (!b.isReady) return 'err.notReady';
    if (!b.def.produces.includes(id)) return 'err.cannotTrain';
    if (this.lockReason(b, id)) return this.battle.tech.tierOf(b.owner) < def.tier ? 'err.tier' : 'err.requires';
    if (b.queue.length >= UNITS.queueMax) return 'err.queueFull';
    if (def.limit !== undefined) {
      const alive = this.battle.units.getSquads(b.owner).filter((s) => s.def.id === id).length;
      if (alive + this.queuedCount(b.owner, (q) => q === id) >= def.limit) return 'err.limit';
    }
    if (def.isHero) {
      const alive = this.battle.units.getSquads(b.owner).some((s) => s.def.id === id);
      if (alive || this.queuedCount(b.owner, (q) => q === id) > 0) return 'err.heroDeployed';
    } else if (this.supplyUsed(b.owner) + def.supply > this.battle.units.supplyCap(b.owner)) {
      return 'err.supply';
    }
    if (!this.battle.resources.canAfford(b.owner, def.cost)) return 'err.resources';
    return null;
  }

  enqueue(b: Building, id: UnitId, silent = false): boolean {
    const err = this.checkEnqueue(b, id);
    if (err) {
      if (b.owner === 'player' && !silent) this.battle.events.emit(EV.message, err);
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

  /** Refunds the whole queue (building destroyed or sold). */
  cancelAll(b: Building): void {
    while (b.queue.length) this.cancel(b, b.queue.length - 1);
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
        if (b.repeat && !UNIT_DEFS[id].isHero) this.enqueue(b, id, true);
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
