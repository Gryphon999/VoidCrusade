import Phaser from 'phaser';
import { EV } from '../events';
import { Owner, opponent } from '../types';
import { UnitId } from '../units/UnitDefs';
import { WinMode } from '../scenes/BattleTypes';
import type { BattleScene } from '../scenes/BattleScene';

/** Control Points: hold all but one point for this long. */
export const CONTROL_HOLD = 120;
/** Survival: seconds between waves and the number of waves to win. */
export const WAVE_EVERY = 45;
export const SURVIVAL_WAVES = 15;

/**
 * Skirmish victory conditions.
 * - Annihilation: destroy the enemy headquarters (handled by BattleScene).
 * - Control Points: hold N-1 of N points for 120 s without a break.
 * - Survival: the Horde has no base; ever larger waves pour in; survive 15 to win. Score = waves + kills.
 */
export class VictorySystem {
  readonly mode: WinMode;
  /** Seconds each side has continuously held enough points. */
  readonly hold: Record<Owner, number> = { player: 0, enemy: 0 };
  wave = 0;
  private nextWave = 25;

  constructor(private battle: BattleScene, mode: WinMode | undefined) {
    this.mode = mode ?? 'annihilation';
  }

  get needed(): number {
    return Math.max(1, this.battle.capture.points.length - 1);
  }

  /** Seconds until the next survival wave. */
  get waveIn(): number {
    return Math.max(0, this.nextWave - this.battle.elapsed);
  }

  update(dt: number): void {
    const b = this.battle;
    if (b.ended) return;
    if (this.mode === 'control') {
      for (const o of ['player', 'enemy'] as Owner[]) {
        if (b.capture.countOwned(o) >= this.needed) {
          const before = this.hold[o];
          this.hold[o] += dt;
          if (o === 'player' && Math.floor(before / 30) !== Math.floor(this.hold[o] / 30)) {
            b.events.emit(EV.message, 'note.controlLeft', { n: Math.ceil(CONTROL_HOLD - this.hold[o]) });
          }
          if (this.hold[o] >= CONTROL_HOLD) b.endBattle(o);
        } else {
          this.hold[o] = 0;
        }
      }
    } else if (this.mode === 'survival') {
      if (b.elapsed >= this.nextWave) this.spawnWave();
    }
  }

  /** Wave n: a growing mix of swarm, then heavier beasts from wave 5 and titans late. */
  private spawnWave(): void {
    const b = this.battle;
    this.wave++;
    this.nextWave = b.elapsed + WAVE_EVERY;
    if (this.wave > SURVIVAL_WAVES) {
      b.endBattle('player');
      return;
    }
    const owner: Owner = 'enemy';
    const n = this.wave;
    const pool: UnitId[] = ['crawler', 'crawler', 'spitter'];
    if (n >= 3) pool.push('leaper', 'shaman');
    if (n >= 5) pool.push('behemoth', 'burrower', 'skimmer');
    if (n >= 8) pool.push('carrier', 'siegebeast');
    const count = 2 + Math.floor(n * 0.8);
    const base = b.map.def.enemyBase;
    const hq = b.buildings.getHQ(opponent(owner));
    for (let i = 0; i < count; i++) {
      const id = pool[Math.floor(Math.random() * pool.length)];
      const x = (base.tx + 2) * 64 + Phaser.Math.Between(-200, 200);
      const y = (base.ty + 2) * 64 + Phaser.Math.Between(-200, 200);
      const s = b.units.spawnSquad(id, owner, x, y);
      s.stance = 'aggressive';
      if (hq) s.moveTo(hq.x + Phaser.Math.Between(-150, 150), hq.y + Phaser.Math.Between(-150, 150), true);
    }
    if (n === 12) {
      const s = b.units.spawnSquad('titan', owner, (base.tx + 2) * 64, (base.ty + 2) * 64);
      if (hq) s.moveTo(hq.x, hq.y, true);
    }
    b.events.emit(EV.message, 'note.wave', { n });
  }

  /** Survival score shown on the end screen. */
  get score(): number {
    return this.wave * 100 + this.battle.stats.kills * 5;
  }
}
