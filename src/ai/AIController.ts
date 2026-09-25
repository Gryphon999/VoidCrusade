import Phaser from 'phaser';
import { AI, Difficulty, SUPPLY } from '../config';
import { BuildingRole, defForRole } from '../buildings/BuildingDefs';
import { Building } from '../buildings/Building';
import { Squad } from '../units/Squad';
import { CapturePoint } from '../systems/CapturePoint';
import { UNIT_DEFS, UnitId } from '../units/UnitDefs';
import { damageMult } from '../units/Damage';
import { researchAt } from '../systems/ResearchSystem';
import { DROPPABLE } from '../systems/DropSystem';
import { Owner, opponent } from '../types';
import { AIBuilder } from './AIBuilder';
import { AIMemory } from './AIMemory';
import { SKILL, STYLE, SkillProfile, Style } from './AIProfile';
import { Personality, pickPersonality } from './Personality';
import { EV } from '../events';
import { dyn, t } from '../i18n';
import type { BattleScene } from '../scenes/BattleScene';

type Pt = { x: number; y: number };
type Role = 'home' | 'army' | 'harass' | 'scout';
type Target = { pt: Pt; hq: boolean; point?: CapturePoint };

const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
const power = (s: Squad): number => Math.max(1, s.def.supply) * (s.hp / Math.max(1, s.maxHp));

/**
 * Skirmish opponent. Skill (difficulty) decides how fast and how cleverly it plays; the
 * personality decides what it likes to do. It only knows what it has scouted (AIMemory).
 *
 * Each think tick: macro (supply, tier, build order, reactive builds, training with counter-picks,
 * research, reinforcing) → army (roles, retreats, focus fire, home and point defence, drop
 * response, attack waves, harassment, scouting, garrisons, own drops).
 */
export class AIController {
  readonly skill: SkillProfile;
  readonly style: Style;
  readonly personality: Personality;
  readonly memory: AIMemory;
  private builder: AIBuilder;
  private thinkTimer = 0;
  private waveTimer: number;
  private buildIndex = 0;
  private lastBuild = -99;
  private wave: { target: Pt; hq: boolean; since: number; point?: CapturePoint } | null = null;
  private maxedSince = 0;
  private retargetAt = new Map<Squad, number>();
  private orders = new Map<Squad, Pt>();
  private healing = new Set<Squad>();
  private scoutGoal: Pt | null = null;
  private alerts: { x: number; y: number; until: number }[] = [];
  rushing = false;
  /** Off in the tutorial (the outpost just defends itself). */
  enabled = true;

  constructor(private battle: BattleScene, difficulty: Difficulty, personality?: string, readonly owner: Owner = 'enemy') {
    this.skill = SKILL[difficulty];
    this.personality = pickPersonality(personality);
    this.style = STYLE[this.personality];
    this.builder = new AIBuilder(battle, owner);
    this.memory = new AIMemory(battle, owner);
    this.waveTimer = this.skill.waveEvery * this.style.waveMult + 30;
    battle.events.on(EV.dropIncoming, (o: Owner, x: number, y: number) => {
      if (o !== owner && this.skill.reactive) this.alerts.push({ x, y, until: battle.elapsed + 20 });
    });
  }

  /** Announces the personality once the HUD is up. */
  announce(): void {
    if (!this.enabled || !this.battle.buildings.getHQ(this.owner)) return;
    this.battle.events.emit(EV.message, 'note.aiStyle', { p: t(dyn(`ai.${this.personality}`)) });
  }

  update(dt: number): void {
    if (!this.enabled) return;
    this.waveTimer -= dt;
    this.thinkTimer -= dt;
    if (this.thinkTimer > 0) return;
    this.thinkTimer = this.skill.think;
    if (!this.hq) return;
    this.memory.update();
    this.alerts = this.alerts.filter((a) => a.until > this.battle.elapsed);
    for (const m of [this.orders, this.retargetAt]) for (const k of m.keys()) if (!k.alive) m.delete(k);
    for (const k of this.healing) if (!k.alive) this.healing.delete(k);
    this.build();
    this.train();
    this.research();
    this.reinforce();
    this.assignRoles();
    this.micro();
    this.defendHome();
    this.defendPoints();
    this.attackWaves();
    this.harass();
    this.scout();
    this.expand();
    this.garrison();
    this.dropIn();
    this.fortify();
  }

  private get hq(): Building | null {
    return this.battle.buildings.getHQ(this.owner) ?? null;
  }

  private get foe(): Owner {
    return opponent(this.owner);
  }

  private get squads(): Squad[] {
    return this.battle.units.getSquads(this.owner).filter((s) => !s.embarked);
  }

  /** Move order that is skipped when the squad is already heading to about the same spot (re-pathing every tick stalls it). */
  private send(s: Squad, x: number, y: number, attack = true): void {
    const last = this.orders.get(s);
    if (last && s.isMoving() && Math.hypot(last.x - x, last.y - y) < 160) return;
    this.orders.set(s, { x, y });
    s.moveTo(x, y, attack);
  }

  private role(s: Squad): Role {
    return (s.role || 'army') as Role;
  }

  private visibleFoes(): Squad[] {
    const b = this.battle;
    return b.units.getSquads(this.foe).filter((s) => !s.hiddenFrom(this.owner) && b.fogVisibleFor(this.owner, s.center.x, s.center.y));
  }

  // ---- Economy ------------------------------------------------------------

  private build(): void {
    const b = this.battle;
    const bs = b.buildings;
    const res = b.resources.getResources(this.owner);
    const building = bs.buildings.filter((q) => q.owner === this.owner && q.state === 'constructing').length;
    // Skilled AIs build in parallel when the bank allows it.
    const parallel = this.skill.queue >= 2 ? 1 + Math.min(this.skill.queue - 1, Math.floor(res.scrip / 500)) : 1;
    if (building >= parallel) return;
    if (b.elapsed - this.lastBuild < this.skill.buildDelay) return;
    // An army first: with fewer than three fighting squads, only build when there is spare money.
    const fighters = this.squads.filter((s) => !s.def.isHero && !s.def.repairRate).length;
    if (fighters < 3 && bs.hasRole(this.owner, 'infantry') && res.scrip < 300) return;
    // Supply before the army hits the cap.
    const cap = b.units.supplyCap(this.owner);
    if (cap < SUPPLY.hardMax && b.production.supplyUsed(this.owner) + 5 > cap && this.tryBuild('supply')) return;
    // Tier 3 as soon as the requirements stand (hard+: whenever affordable with a margin).
    const up = b.tech.next(this.owner);
    if (up && b.tech.checkAdvance(this.owner) === null && (this.skill.queue >= 3 || b.tech.tierOf(this.owner) >= 2) && res.scrip > up.cost.scrip + 150) {
      b.tech.advance(this.owner);
      return;
    }
    const order = this.style.order;
    if (this.buildIndex < order.length) {
      if (this.tryBuild(order[this.buildIndex])) this.buildIndex++;
      else if (!defForRole(b.factions[this.owner], order[this.buildIndex])) this.buildIndex++;
      return;
    }
    // After the opening: rebuild lost production, add production when rich, towers per personality.
    for (const r of ['infantry', 'heavy', 'vehicles', 'power'] as BuildingRole[]) {
      if (!bs.hasRole(this.owner, r, false) && this.tryBuild(r)) return;
    }
    const towers = bs.getOwned(this.owner).filter((q) => q.def.role === 'defense').length;
    if (towers < 2 + this.style.towers * 2 && res.scrip > 300 && this.tryBuild('defense')) return;
    if (res.scrip > 700) {
      const prod = bs.getOwned(this.owner).filter((q) => q.def.role === 'infantry').length;
      if (prod < 2) this.tryBuild('infantry');
      else this.tryBuild(Math.random() < 0.5 ? 'vehicles' : 'defense');
    }
  }

  private tryBuild(role: BuildingRole): boolean {
    const b = this.battle;
    const def = defForRole(b.factions[this.owner], role);
    if (!def) return false;
    if (b.tech.tierOf(this.owner) < def.tier) {
      if (b.tech.checkAdvance(this.owner) === null) b.tech.advance(this.owner);
      return false;
    }
    if (!b.resources.canAfford(this.owner, def.cost)) return false;
    const ok = this.builder.place(def.id, role === 'defense' || role === 'longrange');
    if (ok) this.lastBuild = b.elapsed;
    return ok;
  }

  /** Scrip held back for the next opening building or tier. */
  private reserve(): number {
    const b = this.battle;
    if (this.squads.filter((s) => !s.def.isHero && !s.def.repairRate).length < 3) return 0;
    const role = this.style.order[this.buildIndex];
    if (!role) return 0;
    const def = defForRole(b.factions[this.owner], role);
    if (!def) return 0;
    const up = b.tech.next(this.owner);
    if (def.tier > b.tech.tierOf(this.owner) && up && b.tech.progress(this.owner) === null) return up.cost.scrip;
    return Math.min(200, def.cost.scrip);
  }

  /**
   * Picks units across all production buildings at once, so a free supply slot goes to the best
   * counter (a tank or a titan) instead of whichever barracks happened to be idle first.
   */
  private train(): void {
    const b = this.battle;
    const reserve = this.reserve();
    const producers = b.buildings.getOwned(this.owner).filter((q) => q.isReady && q.def.produces.length > 0);
    for (let n = 0; n < 4; n++) {
      if (b.resources.getResources(this.owner).scrip < reserve + 60) return;
      const open = producers.filter((q) => q.queue.length < this.skill.queue);
      if (!open.length) return;
      const best = this.pick(open);
      if (!best || !b.production.enqueue(best.at, best.id)) return;
    }
  }

  /**
   * Counter-pick: score each option by the damage it deals to the scouted enemy armour mix and
   * how well its armour takes the enemy's damage types; skill blends this with a random pick.
   */
  private pick(producers: Building[]): { id: UnitId; at: Building } | null {
    const b = this.battle;
    const mine = this.squads;
    const options: { id: UnitId; at: Building }[] = [];
    for (const at of producers) {
      for (const u of at.def.produces) {
        if (b.production.checkEnqueue(at, u) !== null) continue;
        const d = UNIT_DEFS[u];
        const have = mine.filter((s) => s.def.id === u).length + producers.reduce((a, q) => a + q.queue.filter((x) => x === u).length, 0);
        if (d.repairRate && (have >= 1 || b.elapsed < 180)) continue;
        if (d.aura && (have >= 1 || b.elapsed < 150)) continue;
        // Transports only earn their keep with infantry aboard; one is enough.
        if (d.transport && have >= 1) continue;
        options.push({ id: u, at });
      }
    }
    if (!options.length) return null;
    const mix = this.memory.mix();
    const heavySupply = mine.filter((s) => s.def.category !== 'infantry' && !s.def.isHero).reduce((a, s) => a + s.def.supply, 0);
    const total = mine.reduce((a, s) => a + s.def.supply, 0) || 1;
    const wantHeavy = heavySupply / total < this.style.heavyShare;
    const scored = options.map((o) => {
      const d = UNIT_DEFS[o.id];
      if (d.isHero) return { o, s: 10 };
      let off = 1;
      let def = 1;
      if (mix.total > 0) {
        off = 0;
        for (const [a, w] of Object.entries(mix.armor)) off += (w ?? 0) * damageMult(d.damageType, a as keyof typeof mix.armor);
        def = 0;
        for (const [k, w] of Object.entries(mix.damage)) def += (w ?? 0) / damageMult(k as keyof typeof mix.damage, d.armor);
        def /= 1.4;
      }
      // Cheap units that trade well are worth more per resource spent.
      let s = (off + def * 0.5) * (1.2 - Math.min(0.55, (d.cost.scrip + d.cost.flux) / 500));
      if (wantHeavy && d.category !== 'infantry') s += 0.6;
      // Variety: less of what it already has plenty of.
      s -= mine.filter((q) => q.def.id === o.id).length * 0.06;
      return { o, s: this.skill.counter * s + (1 - this.skill.counter) * Math.random() * 1.5 + (wantHeavy && d.category !== 'infantry' ? 0.3 : 0) };
    });
    scored.sort((p, q) => q.s - p.s);
    return scored[0].o;
  }

  private research(): void {
    const b = this.battle;
    if (!this.skill.research || b.resources.getResources(this.owner).scrip < 350 + this.reserve()) return;
    for (const bl of b.buildings.getOwned(this.owner)) {
      if (!bl.isReady || b.research.activeAt(bl)) continue;
      const list = researchAt(b.factions[this.owner], bl.def.role)
        .filter((r) => !b.research.isDone(this.owner, r.id) && !b.research.isResearching(this.owner, r.id) && !b.research.lockReason(this.owner, r.id)
          && b.resources.canAfford(this.owner, r.cost));
      if (list.length) {
        b.research.start(bl, list[Math.floor(Math.random() * list.length)].id);
        return;
      }
    }
  }

  /** Tops up worn squads that are back home and out of combat. */
  private reinforce(): void {
    const b = this.battle;
    const hq = this.hq;
    if (!hq || this.skill.retreatHp === 0) return;
    for (const s of this.squads) {
      if (s.engaged || !b.units.canReinforce(s) || dist(s.center, hq) > 650) continue;
      if (s.units.length + s.pendingReinforce >= s.maxSize || b.resources.getResources(this.owner).scrip < 150 + this.reserve()) continue;
      b.units.reinforce(s);
    }
  }

  /** Roots an outpost into each held point that lacks one. */
  private fortify(): void {
    const b = this.battle;
    const def = defForRole(b.factions[this.owner], 'outpost');
    if (!def || b.resources.getResources(this.owner).scrip < def.cost.scrip + 150 + this.reserve()) return;
    for (const p of b.capture.points) {
      if (p.owner !== this.owner || b.structures.fortified(p.x, p.y, this.owner)) continue;
      if (b.buildings.buildings.some((q) => q.alive && q.def.onPoint && Phaser.Math.Distance.Between(q.x, q.y, p.x, p.y) < 192)) continue;
      if (this.builder.placeOnPoint(def.id, p.x, p.y)) return;
    }
  }

  // ---- Army ---------------------------------------------------------------

  private assignRoles(): void {
    const all = this.squads.filter((s) => !s.def.repairRate);
    const count = (r: Role): number => all.filter((s) => this.role(s) === r).length;
    for (const s of all) {
      if (s.role) continue;
      const fast = s.def.speed >= 120 && !s.def.isHero;
      if (this.skill.scout && count('scout') === 0 && fast && s.def.category === 'infantry' && this.battle.elapsed > 20) s.role = 'scout';
      else if (this.skill.harass && count('harass') < (this.personality === 'rusher' ? 2 : 1) && fast && this.battle.elapsed > 150) s.role = 'harass';
      else if (count('home') < this.style.homeGuard && all.filter((q) => this.role(q) === 'army' && !q.def.isHero).length >= 3 && !s.def.isHero && s.def.category === 'infantry') s.role = 'home';
      else s.role = 'army';
    }
  }

  /** Retreats hurt squads and (hard+) focuses fire on the weakest target it counters. */
  private micro(): void {
    const b = this.battle;
    const now = b.elapsed;
    const foes = this.skill.focusFire ? this.visibleFoes() : [];
    for (const s of this.squads) {
      const frac = s.hp / Math.max(1, s.maxHp);
      if (this.healing.has(s)) {
        if (!s.retreating && (frac > 0.75 || s.units.length >= s.maxSize) && !s.engaged) this.healing.delete(s);
        continue;
      }
      if (this.skill.retreatHp > 0 && s.engaged && !s.retreating && frac < this.skill.retreatHp && s.role !== 'home') {
        s.retreat();
        this.healing.add(s);
        continue;
      }
      if (!foes.length || !s.engaged || s.retreating || (this.retargetAt.get(s) ?? 0) > now) continue;
      const c = s.center;
      const inReach = foes.filter((f) => dist(f.center, c) <= s.range + 80);
      if (inReach.length < 2) continue;
      const score = (f: Squad): number => f.hp / damageMult(s.def.damageType, f.def.armor) * (f.def.isHero ? 0.6 : 1);
      const best = inReach.sort((p, q) => score(p) - score(q))[0];
      if (s.target !== best) s.attack(best);
      this.retargetAt.set(s, now + 3);
    }
  }

  private defendHome(): void {
    const hq = this.hq;
    if (!hq) return;
    const intruders = this.visibleFoes().filter((s) => dist(s.center, hq) < AI.defendRadius);
    const threat = intruders.reduce((a, s) => a + power(s), 0);
    const home = this.squads.filter((s) => this.role(s) === 'home' && !this.healing.has(s));
    if (intruders.length) {
      const first = intruders.sort((p, q) => dist(p.center, hq) - dist(q.center, hq))[0];
      for (const s of home) if (!s.engaged) this.send(s, first.center.x, first.center.y, true);
      // Reactive AIs call the army back when the base is really in danger.
      if (this.skill.reactive && threat > home.reduce((a, s) => a + power(s), 0) * 0.8) {
        for (const s of this.squads) {
          if (this.role(s) === 'army' && !s.engaged && !this.healing.has(s) && dist(s.center, hq) < 2200) this.send(s, first.center.x, first.center.y, true);
        }
        this.wave = null;
      }
      return;
    }
    for (const a of this.alerts) {
      if (dist(a, hq) > 1100) continue;
      for (const s of home) if (!s.engaged) this.send(s, a.x, a.y, true);
    }
    for (const s of home) {
      if (s.isMoving() || s.engaged || s.holdOnArrival || s.order === 'hold') continue;
      if (dist(s.center, hq) > 380) this.send(s, hq.x - 140 + Math.random() * 80, hq.y + 170, true);
    }
  }

  /** Sends the nearest free army squads to held points under attack and to drop sites. */
  private defendPoints(): void {
    if (!this.skill.reactive) return;
    const b = this.battle;
    const foes = this.visibleFoes();
    const spots: { x: number; y: number; need: number }[] = [];
    for (const p of b.capture.points) {
      if (p.owner !== this.owner && p.claimant !== this.owner) continue;
      const near = foes.filter((f) => dist(f.center, p) < 380);
      if (near.length) spots.push({ x: p.x, y: p.y, need: near.reduce((a, s) => a + power(s), 0) * 1.3 });
    }
    for (const a of this.alerts) spots.push({ x: a.x, y: a.y, need: 4 });
    for (const sp of spots) {
      const free = this.squads.filter((s) => this.role(s) === 'army' && !s.engaged && !this.healing.has(s) && !s.retreating)
        .sort((p, q) => dist(p.center, sp) - dist(q.center, sp));
      let sent = 0;
      for (const s of free) {
        if (sent >= sp.need || dist(s.center, sp) > 2400) break;
        this.send(s, sp.x + Phaser.Math.Between(-40, 40), sp.y + Phaser.Math.Between(-40, 40), true);
        sent += power(s);
      }
    }
  }

  private attackWaves(): void {
    const b = this.battle;
    const army = this.squads.filter((s) => this.role(s) === 'army' && !this.healing.has(s));
    const supply = army.reduce((a, s) => a + power(s), 0);
    // Maxed out with money in the bank: losses are replaced at once, so it is time to siege.
    const maxed = b.production.supplyUsed(this.owner) >= b.units.supplyCap(this.owner) - 3 && b.resources.getResources(this.owner).scrip > 2500;
    if (!maxed) this.maxedSince = b.elapsed;
    if (this.wave) {
      const w = this.wave;
      const local = this.memory.strengthNear(w.target.x, w.target.y, 600);
      // Pull back a broken wave (skilled AIs only), or move on once the target is taken.
      if (this.skill.retreatHp > 0 && supply < local * 0.5 && b.elapsed - w.since > 15) {
        for (const s of army) if (s.engaged) s.retreat();
        this.wave = null;
        this.rushing = false;
        return;
      }
      const foeHq = b.buildings.getHQ(this.foe);
      const done = w.point ? w.point.owner === this.owner : !foeHq;
      if (done || b.elapsed - w.since > 180 || army.length === 0) {
        this.wave = null;
        this.rushing = false;
      } else {
        for (const s of army) {
          if (s.engaged) continue;
          const d = dist(s.center, w.target);
          if (w.hq && foeHq && d < 520) {
            if (s.target !== foeHq) s.attack(foeHq);
          } else if (d > 220) this.send(s, w.target.x, w.target.y, true);
        }
        return;
      }
    }
    const siege = b.elapsed - this.maxedSince > (this.skill.counter > 0 ? 45 : 120);
    if (!siege && (this.waveTimer > 0 || supply < this.style.waveSupply * this.skill.waveSize)) return;
    this.waveTimer = this.skill.waveEvery * this.style.waveMult * Phaser.Math.FloatBetween(0.8, 1.2);
    const target = siege ? this.siegeTarget() : this.pickTarget(supply);
    if (!target) return;
    this.maxedSince = b.elapsed;
    this.wave = { target: { x: target.pt.x, y: target.pt.y }, hq: target.hq, since: b.elapsed, point: target.point };
    if (target.hq && !this.rushing) b.events.emit(EV.message, 'note.rush');
    this.rushing = target.hq;
    army.forEach((s, i) => this.send(s, target.pt.x + (i % 3) * 50 - 50, target.pt.y + Math.floor(i / 3) * 50, true));
  }

  private siegeTarget(): Target | null {
    const foeHq = this.battle.buildings.getHQ(this.foe);
    return foeHq ? { pt: { x: foeHq.x, y: foeHq.y + foeHq.radius + 60 }, hq: true } : null;
  }

  /** Weakest known enemy point (by scouted defenders); the HQ when far ahead and the style allows. */
  private pickTarget(supply: number): Target | null {
    const b = this.battle;
    const hq = this.hq as Building;
    if (this.style.allIn && supply > Math.max(12, this.memory.totalSupply * 1.8) && b.elapsed > 240) return this.siegeTarget();
    const points = b.capture.points.filter((p) => p.owner === this.foe);
    if (!points.length) {
      const free = b.capture.points.filter((p) => p.owner !== this.owner);
      if (free.length) {
        const p = free.sort((a, c) => dist(a, hq) - dist(c, hq))[0];
        return { pt: { x: p.x, y: p.y }, hq: false, point: p };
      }
      return this.siegeTarget();
    }
    const smart = this.skill.counter >= 0.5;
    const score = (p: Pt): number => dist(p, hq) * (smart ? 0.4 : 1) + (smart ? this.memory.strengthNear(p.x, p.y, 500) * 250 : 0);
    const p = points.sort((a, c) => score(a) - score(c))[0];
    return { pt: { x: p.x, y: p.y }, hq: false, point: p };
  }

  /** Fast squads hit enemy points nobody has been seen guarding, and run when caught. */
  private harass(): void {
    const b = this.battle;
    for (const s of this.squads.filter((q) => this.role(q) === 'harass')) {
      if (this.healing.has(s) || s.retreating) continue;
      if (s.engaged && s.hp < s.maxHp * 0.55) {
        s.retreat();
        this.healing.add(s);
        continue;
      }
      if (s.engaged || s.isMoving()) continue;
      const targets = b.capture.points.filter((p) => p.owner === this.foe && this.memory.strengthNear(p.x, p.y, 500) < power(s) * 0.6);
      if (!targets.length) {
        s.role = 'army';
        continue;
      }
      const p = targets[Math.floor(Math.random() * targets.length)];
      this.send(s, p.x, p.y, true);
    }
  }

  /** One scout walks enemy points and the enemy base to feed the memory; it avoids fights. */
  private scout(): void {
    const b = this.battle;
    const s = this.squads.find((q) => this.role(q) === 'scout');
    if (!s) return;
    if (s.engaged && !s.retreating) {
      s.retreat();
      this.scoutGoal = null;
      return;
    }
    if (s.retreating || (s.isMoving() && this.scoutGoal)) return;
    const foeHq = b.buildings.getHQ(this.foe);
    const goals: Pt[] = b.capture.points.filter((p) => p.owner !== this.owner).map((p) => ({ x: p.x, y: p.y }));
    if (foeHq) goals.push({ x: foeHq.x + 350, y: foeHq.y + 250 });
    if (!goals.length) return;
    this.scoutGoal = goals[Math.floor(Math.random() * goals.length)];
    this.send(s, this.scoutGoal.x, this.scoutGoal.y, false);
  }

  /** Idle army squads walk to the nearest point the AI does not own. */
  private expand(): void {
    if (this.wave) return;
    const free = this.battle.capture.points.filter((p) => p.owner !== this.owner);
    if (free.length === 0) return;
    for (const s of this.squads) {
      if (this.role(s) !== 'army' || s.isMoving() || s.engaged || s.order === 'attack' || this.healing.has(s) || !s.def.canCapture) continue;
      const c = s.center;
      if (free.some((p) => p.contains(c.x, c.y))) continue;
      const p = free.slice().sort((a, b) => dist(c, a) - dist(c, b))[0];
      this.send(s, p.x + Phaser.Math.Between(-30, 30), p.y + Phaser.Math.Between(-30, 30), true);
    }
  }

  /** Home guards dig into a bunker or nearby ruins; one squad holds cover at each far point (turtlers). */
  private garrison(): void {
    if (!this.skill.garrison) return;
    const b = this.battle;
    const hq = this.hq as Building;
    const bunkers = b.buildings.getOwned(this.owner).filter((q) => q.isReady && !!q.def.garrison && q.garrison.length < (q.def.garrison ?? 0));
    for (const s of this.squads.filter((q) => this.role(q) === 'home')) {
      if (s.engaged || s.isMoving() || s.garrisonIn || s.order === 'hold' || s.def.category !== 'infantry') continue;
      const bunker = bunkers.find((q) => dist(q, hq) < 900);
      if (bunker) {
        s.enterBunker(bunker);
        continue;
      }
      const ruin = b.wrecks.ruins.filter((r) => r.alive && dist(r, hq) < 800).sort((p, q) => dist(p, hq) - dist(q, hq))[0];
      if (ruin) {
        this.send(s, ruin.x, ruin.y + 10, false);
        s.holdOnArrival = true;
      }
    }
  }

  /** Portal / Beacon drops onto undefended enemy points it can see. */
  private dropIn(): void {
    if (!this.skill.drops) return;
    const b = this.battle;
    const beacon = b.buildings.getOwned(this.owner).find((q) => q.def.role === 'beacon' && q.isReady && b.elapsed >= q.dropReady);
    if (!beacon) return;
    const spots = b.capture.points.filter((p) => p.owner === this.foe && b.fogVisibleFor(this.owner, p.x, p.y) && this.memory.strengthNear(p.x, p.y, 450) < 3);
    if (!spots.length) return;
    const ids = DROPPABLE[b.factions[this.owner]].filter((id) => b.drops.check(beacon, id) === null);
    if (!ids.length) return;
    const p = spots[0];
    b.drops.order(beacon, ids[ids.length - 1], p.x + 40, p.y + 40);
  }
}
