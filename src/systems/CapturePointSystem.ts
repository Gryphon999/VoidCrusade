import { CAPTURE, RESOURCES, TILE_SIZE } from '../config';
import { EV } from '../events';
import { Owner } from '../types';
import { CapturePoint } from './CapturePoint';
import type { BattleScene } from '../scenes/BattleScene';

/** Void-Nexus points: squads standing in a zone fill its bar; ownership grants Scrip income. */
export class CapturePointSystem {
  readonly points: CapturePoint[] = [];

  constructor(private battle: BattleScene) {
    battle.map.def.capturePoints.forEach((c, i) => {
      const p = new CapturePoint(battle, i, c.x * TILE_SIZE, c.y * TILE_SIZE);
      this.points.push(p);
      const r = CAPTURE.zoneHalfTiles + CAPTURE.reserveTiles;
      for (let ty = Math.floor(c.y - r); ty < Math.ceil(c.y + r); ty++) {
        for (let tx = Math.floor(c.x - r); tx < Math.ceil(c.x + r); tx++) {
          battle.buildings.reserved.add(ty * battle.map.width + tx);
        }
      }
    });
  }

  countOwned(owner: Owner): number {
    return this.points.filter((p) => p.owner === owner).length;
  }

  /** Number of squads of each side inside a point's zone. */
  presence(p: CapturePoint): Record<Owner, number> {
    const out: Record<Owner, number> = { player: 0, enemy: 0 };
    for (const s of this.battle.units.squads) {
      if (s.alive && s.units.some((u) => p.contains(u.x, u.y))) out[s.owner]++;
    }
    return out;
  }

  /** True if any player squad is currently filling a bar (for the capture sound). */
  playerCapturing(): boolean {
    return this.points.some((p) => p.claimant === 'player' && p.owner !== 'player' && p.progress > 0 && !p.contested
      && this.presence(p).player > 0);
  }

  update(dt: number): void {
    const rate = dt / CAPTURE.captureTime;
    for (const p of this.points) {
      const n = this.presence(p);
      const present: Owner[] = (['player', 'enemy'] as Owner[]).filter((o) => n[o] > 0);
      p.contested = present.length === 2;
      const before = p.progress;
      if (present.length === 1) {
        const side = present[0];
        if (p.owner === side && (p.claimant === side || p.progress <= 0)) {
          p.claimant = side;
          p.progress = Math.min(1, p.progress + rate);
        } else if (p.claimant === null || p.claimant === side) {
          p.claimant = side;
          p.progress = Math.min(1, p.progress + rate);
          if (p.progress >= 1) this.setOwner(p, side);
        } else {
          // Push the other side's bar back first.
          p.progress = Math.max(0, p.progress - rate);
          if (p.progress <= 0) p.claimant = side;
        }
      } else if (p.contested) {
        p.progress = Math.max(0, p.progress - rate * 0.5);
      } else if (p.claimant !== p.owner) {
        // Abandoned partial capture decays.
        p.progress = Math.max(0, p.progress - rate * 0.25);
        if (p.progress <= 0) {
          p.claimant = p.owner;
          p.progress = p.owner ? 1 : 0;
        }
      }
      if (p.progress !== before || p.contested) p.drawBar();
    }
  }

  private setOwner(p: CapturePoint, owner: Owner): void {
    const old = p.owner;
    if (old === owner) return;
    const res = this.battle.resources;
    if (old) res.removeIncome(old, 'scrip', RESOURCES.captureScripPerSec);
    res.addIncome(owner, 'scrip', RESOURCES.captureScripPerSec);
    p.owner = owner;
    p.claimant = owner;
    p.progress = 1;
    p.refresh();
    this.battle.events.emit(EV.pointCaptured, p, owner, old);
    if (owner === 'player') this.battle.events.emit(EV.message, 'Void-Nexus captured!');
    else if (old === 'player') this.battle.events.emit(EV.message, 'A Void-Nexus has fallen to the enemy!');
  }
}
