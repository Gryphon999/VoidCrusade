import Phaser from 'phaser';
import { AI, AI_DIFFICULTY, Difficulty, DifficultyProfile, SUPPLY } from '../config';
import { BuildingRole, defForRole } from '../buildings/BuildingDefs';
import { Building } from '../buildings/Building';
import { Squad } from '../units/Squad';
import { AIBuilder } from './AIBuilder';
import { EV } from '../events';
import type { BattleScene } from '../scenes/BattleScene';

const OWNER = 'enemy';

/** Initial build order (roles), executed first 60s then continued as funds allow. */
const BUILD_ORDER: BuildingRole[] = [
  'power', 'power', 'infantry', 'supply', 'defense', 'power', 'supply', 'heavy', 'defense', 'research', 'vehicles', 'supply',
  'hospital', 'infantry', 'longrange', 'defense', 'sensor', 'supply',
];

/**
 * Null Horde opponent. Behaviours, in priority order:
 * build → rush (if winning) → raid (on a timer) → defend (always keep 2 squads home) → expand to free points.
 */
export class AIController {
  readonly profile: DifficultyProfile;
  private builder: AIBuilder;
  private thinkTimer = 0;
  private raidTimer: number;
  private buildIndex = 0;
  private trained = 0;
  rushing = false;

  constructor(private battle: BattleScene, difficulty: Difficulty) {
    this.profile = AI_DIFFICULTY[difficulty];
    battle.resources.setIncomeMultiplier(OWNER, this.profile.incomeMult);
    this.builder = new AIBuilder(battle, OWNER);
    this.raidTimer = this.profile.raidInterval + AI.buildPhase * 0.5;
  }

  /** Off in the tutorial (the outpost just defends itself). */
  enabled = true;

  update(dt: number): void {
    if (!this.enabled) return;
    this.raidTimer -= dt;
    this.thinkTimer -= dt;
    if (this.thinkTimer > 0) return;
    this.thinkTimer = AI.thinkInterval;
    if (!this.battle.buildings.getHQ(OWNER)) return;
    this.build();
    this.train();
    this.assignRoles();
    if (this.shouldRush()) this.rush();
    else if (this.raidTimer <= 0) this.raid();
    this.defend();
    this.expand();
    this.fortify();
  }

  /** Roots an outpost into each held point that lacks one. */
  private fortify(): void {
    const def = defForRole(this.battle.factions[OWNER], 'outpost');
    if (!def || this.battle.resources.getResources(OWNER).scrip < def.cost.scrip + 150) return;
    for (const p of this.battle.capture.points) {
      if (p.owner !== OWNER || this.battle.structures.fortified(p.x, p.y, OWNER)) continue;
      if (this.battle.buildings.buildings.some((b) => b.alive && b.def.onPoint && Phaser.Math.Distance.Between(b.x, b.y, p.x, p.y) < 192)) continue;
      if (this.builder.placeOnPoint(def.id, p.x, p.y)) return;
    }
  }

  private get hq(): Building {
    return this.battle.buildings.getHQ(OWNER) as Building;
  }

  private get squads(): Squad[] {
    return this.battle.units.getSquads(OWNER);
  }

  // ---- Economy ------------------------------------------------------------

  private build(): void {
    const bs = this.battle.buildings;
    if (bs.buildings.some((b) => b.owner === OWNER && b.state === 'constructing')) return;
    // Supply first when the army is about to hit the cap.
    const cap = this.battle.units.supplyCap(OWNER);
    if (cap < SUPPLY.hardMax && this.battle.production.supplyUsed(OWNER) + 4 > cap && this.tryBuild('supply')) return;
    const inBuildPhase = this.battle.elapsed < AI.buildPhase;
    // Push for Tier 3 once the vehicle factory stands.
    if (this.battle.tech.tierOf(OWNER) < 3 && bs.hasRole(OWNER, 'vehicles') && this.battle.tech.checkAdvance(OWNER) === null) {
      this.battle.tech.advance(OWNER);
    }
    if (this.buildIndex >= BUILD_ORDER.length) {
      // Late game: rebuild lost production and add defenses when rich.
      if (!bs.hasRole(OWNER, 'infantry', false)) this.buildIndex = BUILD_ORDER.indexOf('infantry');
      else if (this.battle.resources.getResources(OWNER).scrip > 600) this.tryBuild('defense');
      return;
    }
    if (!inBuildPhase && this.battle.resources.getResources(OWNER).scrip < 250) return;
    if (this.tryBuild(BUILD_ORDER[this.buildIndex])) this.buildIndex++;
  }

  private tryBuild(role: BuildingRole): boolean {
    const def = defForRole(this.battle.factions[OWNER], role);
    if (!def) return false;
    // Tech up when the next structure needs a higher tier.
    if (this.battle.tech.tierOf(OWNER) < def.tier) {
      this.battle.tech.advance(OWNER);
      return false;
    }
    if (!this.battle.resources.canAfford(OWNER, def.cost)) return false;
    return this.builder.place(def.id, role === 'defense');
  }

  private train(): void {
    const res = this.battle.resources.getResources(OWNER);
    let reserve = this.buildIndex < BUILD_ORDER.length ? AI.buildReserve : 0;
    // Save up for the tier upgrade the build order is waiting on.
    const nextRole = BUILD_ORDER[this.buildIndex];
    const nextDef = nextRole && defForRole(this.battle.factions[OWNER], nextRole);
    const up = this.battle.tech.next(OWNER);
    if (nextDef && up && nextDef.tier > this.battle.tech.tierOf(OWNER) && this.battle.tech.progress(OWNER) === null) {
      reserve = Math.max(reserve, up.cost.scrip);
    }
    for (const b of this.battle.buildings.getOwned(OWNER)) {
      if (!b.isReady || b.queue.length > 0 || b.def.produces.length === 0) continue;
      const options = b.def.produces.filter((u) => this.battle.production.checkEnqueue(b, u) === null);
      if (!options.length) continue;
      const id = options[Math.floor(Math.random() * options.length)];
      if (res.scrip - reserve < 0) continue;
      if (this.battle.production.enqueue(b, id)) this.trained++;
    }
  }

  // ---- Army ---------------------------------------------------------------

  private assignRoles(): void {
    const defenders = this.squads.filter((s) => s.role === 'defend');
    for (const s of this.squads) {
      if (s.role) continue;
      if (defenders.length < AI.defendSquads) {
        s.role = 'defend';
        defenders.push(s);
      } else {
        s.role = 'army';
      }
    }
  }

  private shouldRush(): boolean {
    if (!this.profile.rush) return false;
    const army = this.squads.filter((s) => s.role === 'army');
    return this.battle.capture.countOwned(OWNER) >= AI.rushPoints && army.length >= AI.rushSquads;
  }

  private rush(): void {
    const target = this.battle.buildings.getHQ('player');
    if (!target) return;
    if (!this.rushing) this.battle.events.emit(EV.message, 'note.rush');
    this.rushing = true;
    for (const s of this.squads) {
      if (s.role === 'defend') continue;
      if (s.order !== 'attack' || s.target !== target) s.attack(target);
    }
  }

  private raid(): void {
    this.rushing = false;
    const jitter = 1 + Phaser.Math.FloatBetween(-AI.raidJitter, AI.raidJitter);
    this.raidTimer = this.profile.raidInterval * jitter;
    const wave = this.squads.filter((s) => s.role === 'army' && !s.engaged);
    if (wave.length === 0) return;
    const target = this.pickRaidTarget();
    if (!target) return;
    wave.forEach((s, i) => s.moveTo(target.x + (i % 3) * 40 - 40, target.y + Math.floor(i / 3) * 40, true));
  }

  /** Nearest player capture point or squad; hard AI prefers the weakest-defended objective. */
  private pickRaidTarget(): { x: number; y: number } | null {
    const hq = this.hq;
    const points = this.battle.capture.points.filter((p) => p.owner === 'player');
    const squads = this.battle.units.getSquads('player');
    const options = [...points.map((p) => ({ x: p.x, y: p.y })), ...squads.map((s) => s.center)];
    if (options.length === 0) {
      const phq = this.battle.buildings.getHQ('player');
      return phq ? { x: phq.x, y: phq.y } : null;
    }
    const score = (o: { x: number; y: number }): number => {
      const d = Phaser.Math.Distance.Between(hq.x, hq.y, o.x, o.y);
      if (!this.profile.smartTargeting) return d;
      const guards = squads.filter((s) => Phaser.Math.Distance.Between(s.center.x, s.center.y, o.x, o.y) < 400).length;
      return d * 0.5 + guards * 600;
    };
    return options.sort((a, b) => score(a) - score(b))[0];
  }

  private defend(): void {
    const hq = this.hq;
    const intruder = this.battle.units.getSquads('player').find((s) =>
      Phaser.Math.Distance.Between(s.center.x, s.center.y, hq.x, hq.y) < AI.defendRadius);
    for (const s of this.squads.filter((q) => q.role === 'defend')) {
      if (intruder) {
        if (s.target !== intruder) s.attack(intruder);
        continue;
      }
      const d = Phaser.Math.Distance.Between(s.center.x, s.center.y, hq.x, hq.y);
      if (d > 320 && !s.isMoving() && !s.engaged) s.moveTo(hq.x - 150 + Math.random() * 60, hq.y + 180, true);
    }
  }

  /** Idle army squads walk to the nearest point the Horde does not own. */
  private expand(): void {
    if (this.rushing) return;
    const free = this.battle.capture.points.filter((p) => p.owner !== OWNER);
    if (free.length === 0) return;
    for (const s of this.squads) {
      if (s.role !== 'army' || s.isMoving() || s.engaged || s.order === 'attack') continue;
      const c = s.center;
      const here = free.find((p) => p.contains(c.x, c.y));
      if (here) continue;
      const p = free.slice().sort((a, b) =>
        Phaser.Math.Distance.Between(c.x, c.y, a.x, a.y) - Phaser.Math.Distance.Between(c.x, c.y, b.x, b.y))[0];
      s.moveTo(p.x + Phaser.Math.Between(-30, 30), p.y + Phaser.Math.Between(-30, 30), true);
    }
  }
}
