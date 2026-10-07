import Phaser from 'phaser';
import { ATTRITION } from '../config';
import { EV } from '../events';
import { Owner, opponent } from '../types';
import { UnitId } from '../units/UnitDefs';
import { WinMode } from '../scenes/BattleTypes';
import { Building } from '../buildings/Building';
import type { Squad } from '../units/Squad';
import {
  EVAC_ARRIVAL, EVAC_LOAD, EVAC_ZONE, HOLD_TIME, KOTH_GOAL, NEST_FIRST_SPAWN, NEST_HP, NEST_SPAWN_EVERY, NEST_TIME_LIMIT, SURVIVAL_MILESTONE,
  evacReady, evacStep, holdStep, kothStep, nestPool, pickNestPoints,
} from '../battle/Objectives';
import { bossFor, nestBuildingFor, wavePool } from '../battle/Factions';
import type { BattleScene } from '../scenes/BattleScene';

/** Control Points: hold two thirds of the points for this long. */
export const CONTROL_HOLD = 120;
/** Survival: seconds between waves and the number of waves to win. */
export const WAVE_EVERY = 45;
export const SURVIVAL_WAVES = 15;

/**
 * Skirmish victory conditions.
 * - Annihilation: destroy the enemy headquarters (handled by BattleScene).
 * - Control Points: hold two thirds of the points (all but one on a small map) for 120 s without a break.
 * - Survival: the Horde has no base; ever larger waves pour in; survive 15 to win. Score = waves + kills.
 * - Hold the Line: own the centre point for HOLD_TIME in all (the meter drains under the Horde).
 * - Burn the Nests: no Horde base; destroy every Brood Nest before NEST_TIME_LIMIT.
 * - Evacuation: survive until the transport arrives, then board the Commander and EVAC_SQUADS squads
 *   at the centre; the Commander's death loses the battle.
 * The rules themselves are pure functions in battle/Objectives.ts.
 */
export class VictorySystem {
  readonly mode: WinMode;
  /** Seconds each side has continuously held enough points. */
  readonly hold: Record<Owner, number> = { player: 0, enemy: 0 };
  wave = 0;
  private nextWave = 25;
  /** Hold the Line: seconds of ownership banked. */
  holdProgress = 0;
  /** Burn the Nests. */
  readonly nests: Building[] = [];
  private nextNestSpawn = NEST_FIRST_SPAWN;
  /** Evacuation: boarding meter and whether the transport has landed. */
  evacLoad = 0;
  evacArrived = false;
  private commanderLost = false;
  /** King of the Hill: points scored by each side. */
  koth: { player: number; enemy: number } = { player: 0, enemy: 0 };

  constructor(private battle: BattleScene, mode: WinMode | undefined) {
    this.mode = mode ?? 'annihilation';
  }

  /** Modes without a Horde stronghold (waves or nests come instead). */
  get noEnemyBase(): boolean {
    return this.mode === 'survival' || this.mode === 'nests';
  }

  get needed(): number {
    const n = this.battle.capture.points.length;
    return Math.max(1, Math.min(n - 1, Math.ceil((n * 2) / 3)));
  }

  /** Seconds until the next survival wave. */
  get waveIn(): number {
    return Math.max(0, this.nextWave - this.battle.elapsed);
  }

  /** The centre point: the position to hold, or the landing zone. */
  get centre(): { x: number; y: number; owner: Owner | null } {
    const p = this.battle.capture.points[0];
    return p ? { x: p.x, y: p.y, owner: p.owner } : { x: 0, y: 0, owner: null };
  }

  get nestsLeft(): number {
    return this.nests.filter((n) => n.alive).length;
  }

  /** Seconds left before the nests mission is lost. */
  get nestTimeLeft(): number {
    return Math.max(0, NEST_TIME_LIMIT - this.battle.elapsed);
  }

  get evacIn(): number {
    return Math.max(0, EVAC_ARRIVAL - this.battle.elapsed);
  }

  /** Runs once the headquarters and the AI exist: places the nests, watches the Commander. */
  start(): void {
    const b = this.battle;
    if (this.mode === 'nests') {
      const corner = { x: b.map.def.enemyBase.tx + 2, y: b.map.def.enemyBase.ty + 2 };
      for (const p of pickNestPoints(b.map.def.capturePoints, corner)) {
        const nest = b.buildings.spawn(nestBuildingFor(b.factions.enemy), 'enemy', Math.round(p.x) - 1, Math.round(p.y) - 1, true);
        nest.maxHp = NEST_HP;
        nest.hp = NEST_HP;
        this.nests.push(nest);
      }
      b.events.on(EV.buildingDestroyed, (d: Building) => {
        if (!this.nests.includes(d) || b.ended) return;
        const left = this.nestsLeft;
        if (left === 0) b.endBattle('player');
        else b.events.emit(EV.message, 'note.nestDown', { n: left });
      });
    }
    if (this.mode === 'evac') {
      b.events.on(EV.squadDestroyed, (s: Squad) => {
        if (s.owner !== 'player' || !s.def.isHero || b.ended) return;
        this.commanderLost = true;
        b.events.emit(EV.message, 'note.commanderLost');
        b.endBattle('enemy');
      });
    }
  }

  update(dt: number): void {
    const b = this.battle;
    if (b.ended) return;
    if (!this.noEnemyBase && !b.tutorial) this.attrition();
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
    } else if (this.mode === 'hold') {
      this.holdProgress = holdStep(this.holdProgress, this.centre.owner, dt);
      if (this.holdProgress >= HOLD_TIME) b.endBattle('player');
    } else if (this.mode === 'nests') {
      if (b.elapsed >= this.nextNestSpawn) this.spawnBroods();
      if (b.elapsed >= NEST_TIME_LIMIT) {
        b.events.emit(EV.message, 'note.nestTimeout');
        b.endBattle('enemy');
      }
    } else if (this.mode === 'evac') {
      this.evacuation(dt);
    } else if (this.mode === 'koth') {
      this.koth = kothStep(this.koth, this.centre.owner, dt);
      if (this.koth.player >= KOTH_GOAL) b.endBattle('player');
      else if (this.koth.enemy >= KOTH_GOAL) b.endBattle('enemy');
    }
  }

  /** After a long fight every structure takes more and more damage, so no siege lasts forever. */
  private attrition(): void {
    const b = this.battle;
    const over = b.elapsed - b.attritionStart;
    if (over < 0) return;
    if (b.buildings.wear === 1) b.events.emit(EV.message, 'note.attrition');
    b.buildings.wear = 1 + Math.min(ATTRITION.max, ATTRITION.perMinute * (1 + over / 60));
  }

  /** Wave n: a growing mix of swarm, then heavier beasts from wave 5 and titans late. */
  private spawnWave(): void {
    const b = this.battle;
    this.wave++;
    this.nextWave = b.elapsed + WAVE_EVERY;
    // Survival is endless: the first tide is a milestone, the score is the record.
    if (this.wave === SURVIVAL_MILESTONE + 1) b.events.emit(EV.message, 'note.tide');
    const owner: Owner = 'enemy';
    const n = this.wave;
    const pool: UnitId[] = wavePool(b.factions.enemy, n);
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
    if (n % 12 === 0) {
      const s = b.units.spawnSquad(bossFor(b.factions.enemy), owner, (base.tx + 2) * 64, (base.ty + 2) * 64);
      if (hq) s.moveTo(hq.x, hq.y, true);
    }
    b.events.emit(EV.message, 'note.wave', { n });
  }

  /** Every living nest releases one brood squad, sent at the player's headquarters. */
  private spawnBroods(): void {
    const b = this.battle;
    this.nextNestSpawn = b.elapsed + NEST_SPAWN_EVERY;
    const pool = nestPool(b.elapsed, b.factions.enemy);
    const hq = b.buildings.getHQ('player');
    for (const nest of this.nests) {
      if (!nest.alive) continue;
      const id = pool[Math.floor(Math.random() * pool.length)];
      const s = b.units.spawnSquad(id, 'enemy', nest.x + Phaser.Math.Between(-120, 120), nest.y + 110);
      s.stance = 'aggressive';
      if (hq) s.moveTo(hq.x + Phaser.Math.Between(-150, 150), hq.y + Phaser.Math.Between(-150, 150), true);
    }
  }

  /** Who of the player's squads stands in the landing zone. */
  evacParty(): { commander: boolean; others: number } {
    const c = this.centre;
    let commander = false;
    let others = 0;
    for (const s of this.battle.units.squads) {
      if (s.owner !== 'player' || !s.alive || s.embarked) continue;
      if (Math.hypot(s.center.x - c.x, s.center.y - c.y) > EVAC_ZONE) continue;
      if (s.def.isHero) commander = true;
      else others++;
    }
    return { commander, others };
  }

  private evacuation(dt: number): void {
    const b = this.battle;
    if (this.commanderLost) return;
    if (!this.evacArrived) {
      if (b.elapsed < EVAC_ARRIVAL) return;
      this.evacArrived = true;
      b.events.emit(EV.message, 'note.evacArrived');
      b.events.emit(EV.mapEvent, 'evac', true);
      b.capture.points[0]?.pulse();
      return;
    }
    const party = this.evacParty();
    this.evacLoad = evacStep(this.evacLoad, evacReady(party.commander, party.others), dt);
    if (this.evacLoad >= EVAC_LOAD) b.endBattle('player');
  }

  /** Survival score shown on the end screen. */
  get score(): number {
    return this.wave * 100 + this.battle.stats.kills * 5;
  }
}
