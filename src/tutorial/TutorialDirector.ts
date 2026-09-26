import { EV } from '../events';
import { dyn, t } from '../i18n';
import { TILE_SIZE } from '../config';
import { Building } from '../buildings/Building';
import { BUILDING_DEFS, BUILD_CATEGORIES, BuildingId, buildList, defForRole } from '../buildings/BuildingDefs';
import { GRID_KEYS } from '../ui/CommandGrid';
import { Squad } from '../units/Squad';
import { UNIT_DEFS, UnitId } from '../units/UnitDefs';
import { Voice } from '../systems/VoiceSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { buildingName, unitName } from '../i18n/names';
import { Resources } from '../systems/ResourceSystem';
import type { BattleScene } from '../scenes/BattleScene';

/** Where a step's highlight points: a command-grid key, a HUD area, or a spot on the battlefield. */
export type TutorialTarget =
  | { kind: 'grid'; key: string }
  | { kind: 'minimap' }
  | { kind: 'panel' }
  | { kind: 'topbar' }
  | { kind: 'world'; x: number; y: number }
  | { kind: 'none' };

export interface TutorialStep {
  id: string;
  target: () => TutorialTarget;
  /** Live line under the step text: what is blocking the step right now, or null. */
  status?: () => string | null;
  /** Runs once when the step starts (spawn enemies, grant resources…). */
  enter?: () => void;
  /** True once the player has done what the step asks. */
  done: () => boolean;
}

/** Next thing the player must do to get a building: target + explanation. */
interface Need {
  target: TutorialTarget;
  status: string | null;
}

/**
 * Scripted tutorial on the Proving Grounds. Each step listens to game events or polls state;
 * the HUD draws the step list, the highlight, the dimming and a live status line.
 *
 * Steps never dead-end: `need()` walks a building's prerequisites (tier, power, barracks…),
 * highlights the next missing one, says "wait" while something is under construction, and
 * tops up resources the player cannot afford.
 */
export class TutorialDirector {
  readonly steps: TutorialStep[];
  index = 0;
  finished = false;
  private flags = new Set<string>();
  private cam0 = { x: 0, y: 0, zoom: 1 };
  private spawnedAt = 0;
  private attackers: Squad[] = [];

  constructor(private battle: BattleScene) {
    const b = battle;
    const ev = b.events;
    ev.on(EV.groupRecalled, () => this.flags.add('recalled'));
    ev.on(EV.orderGiven, () => this.flags.add('ordered'));
    ev.on(EV.message, (k: string) => k === 'note.group' && this.flags.add('grouped'));
    ev.on(EV.abilityUsed, (s: Squad) => s.owner === 'player' && this.flags.add('ability'));
    ev.on(EV.squadSpawned, (s: Squad) => {
      if (s.owner !== 'player') return;
      this.flags.add(`spawn:${s.def.id}`);
      if (s.def.category === 'vehicle') this.flags.add('vehicle');
      if (b.elapsed > this.spawnedAt) this.flags.add('trained');
    });
    const home = (): { x: number; y: number } => {
      const hq = b.buildings.getHQ('player');
      return hq ? { x: hq.x, y: hq.y } : { x: 400, y: 1900 };
    };
    const squads = (): Squad[] => b.units.getSquads('player').filter((s) => !s.def.isHero && s.alive);
    const has = (...ids: string[]): boolean => b.buildings.buildings.some((q) => q.owner === 'player' && ids.includes(q.def.id) && q.isReady);
    const point = b.capture.points[0];
    const ruin = { x: 23.5 * TILE_SIZE, y: 26 * TILE_SIZE };
    const noSquad = (): Need | null => (squads().length ? null : this.trainNeed('rifleman'));
    const needOr = (n: Need | null, t0: TutorialTarget): TutorialTarget => (n ? n.target : t0);
    this.steps = [
      {
        id: 'camera', target: () => ({ kind: 'minimap' }),
        enter: () => {
          const c = b.cameras.main;
          this.cam0 = { x: c.scrollX, y: c.scrollY, zoom: c.zoom };
        },
        done: () => {
          const c = b.cameras.main;
          return Math.hypot(c.scrollX - this.cam0.x, c.scrollY - this.cam0.y) > 200 && Math.abs(c.zoom - this.cam0.zoom) > 0.05;
        },
      },
      {
        // Point at the riflemen themselves (they stand at the rally point, not in the Bastion).
        id: 'select', target: () => {
          const list = squads();
          if (!list.length) return { kind: 'world', ...home() };
          const x = list.reduce((a, s) => a + s.center.x, 0) / list.length;
          const y = list.reduce((a, s) => a + s.center.y, 0) / list.length;
          return { kind: 'world', x, y };
        },
        enter: () => this.flags.delete('ordered'),
        done: () => this.flags.has('ordered'),
      },
      {
        id: 'group', target: () => ({ kind: 'panel' }),
        status: () => (b.selection.squads.length ? null : t('tut.st.selectFirst')),
        done: () => this.flags.has('grouped') && this.flags.has('recalled'),
      },
      {
        id: 'capture', target: () => ({ kind: 'world', x: point.x, y: point.y }),
        status: () => {
          if (point.contested) return t('tut.st.contested');
          if (point.claimant === 'player' && point.progress > 0) return t('tut.st.capturing', { p: Math.floor(point.progress * 100) });
          return null;
        },
        done: () => point.owner === 'player',
      },
      {
        id: 'conduit', target: () => this.need('generator')?.target ?? { kind: 'none' },
        status: () => this.need('generator')?.status ?? null,
        done: () => has('generator'),
      },
      {
        id: 'barracks', target: () => this.need('barracks')?.target ?? { kind: 'none' },
        status: () => this.need('barracks')?.status ?? null,
        done: () => has('barracks'),
      },
      {
        id: 'train', target: () => this.trainNeed('rifleman')?.target ?? { kind: 'none' },
        status: () => this.trainNeed('rifleman')?.status ?? null,
        enter: () => {
          this.spawnedAt = b.elapsed;
          this.flags.delete('trained');
        },
        done: () => this.flags.has('trained'),
      },
      {
        id: 'cover', target: () => needOr(noSquad(), { kind: 'world', ...ruin }),
        status: () => noSquad()?.status ?? null,
        done: () => b.units.getSquads('player').some((s) => s.order === 'hold' && s.units.filter((u) => u.inCover).length >= s.units.length / 2),
      },
      {
        id: 'retreat', target: () => needOr(noSquad(), { kind: 'grid', key: b.selection.hasSquads ? 'T' : 'none' }),
        status: () => noSquad()?.status ?? (b.selection.hasSquads ? null : t('tut.st.selectFirst')),
        enter: () => {
          const hq = home();
          this.attackers = [0, 1].map((i) => {
            const s = b.units.spawnSquad('crawler', 'enemy', 30 * TILE_SIZE, (18 + i * 6) * TILE_SIZE, 4);
            s.moveTo(hq.x + 300, hq.y - 150, true);
            return s;
          });
        },
        done: () => b.units.getSquads('player').some((s) => s.retreating),
      },
      {
        // Frag grenades belong to riflemen: without any, train some first.
        id: 'ability', target: () => {
          const n = this.abilityNeed();
          if (n) return n.target;
          return { kind: 'grid', key: b.selection.squads.some((s) => s.def.abilities?.includes('frag')) ? 'Q' : 'none' };
        },
        status: () => this.abilityNeed()?.status ?? null,
        enter: () => this.topUp({ scrip: 100, flux: 0 }),
        done: () => this.flags.has('ability'),
      },
      {
        id: 'defense', target: () => (has('turret', 'bunker', 'wall') ? { kind: 'none' } : this.need('turret')?.target ?? { kind: 'none' }),
        status: () => (has('turret', 'bunker', 'wall') ? null : this.need('turret')?.status ?? null),
        done: () => has('turret', 'bunker', 'wall'),
      },
      {
        id: 'vehicle', target: () => this.trainNeed('buggy')?.target ?? { kind: 'none' },
        status: () => this.trainNeed('buggy')?.status ?? null,
        enter: () => {
          b.tech.speed = 5;
        },
        done: () => this.flags.has('vehicle'),
      },
      {
        id: 'assault', target: () => {
          const tg = b.buildings.getOwned('enemy')[0];
          return tg ? { kind: 'world', x: tg.x, y: tg.y } : { kind: 'none' };
        },
        status: () => t('tut.st.left', { n: b.buildings.getOwned('enemy').length }),
        enter: () => this.topUp({ scrip: 300, flux: 100 }),
        done: () => b.buildings.getOwned('enemy').length === 0,
      },
    ];
  }

  get current(): TutorialStep | null {
    return this.finished ? null : this.steps[this.index] ?? null;
  }

  start(): void {
    this.enterStep();
  }

  // ---- Prerequisite resolver -----------------------------------------------------------

  /** Grants whatever is missing to afford `cost` (the tutorial never stalls on money). */
  private topUp(cost: Resources): void {
    const r = this.battle.resources.getResources('player');
    if (r.scrip < cost.scrip) this.battle.resources.grant('player', 'scrip', cost.scrip - r.scrip + 20);
    if (r.flux < cost.flux) this.battle.resources.grant('player', 'flux', cost.flux - r.flux + 20);
  }

  private site(id: BuildingId): Building | undefined {
    return this.battle.buildings.buildings.find((q) => q.owner === 'player' && q.def.id === id && q.alive);
  }

  /** Grid key leading to `id` from the HQ: its category page first, then its slot on that page. */
  private hqKey(id: BuildingId): string {
    const b = this.battle;
    if (b.selection.building?.def.role !== 'hq') return 'none';
    const cat = BUILDING_DEFS[id].category;
    if (b.hud.pageIs(cat)) {
      const i = buildList(b.factions.player).filter((q) => BUILDING_DEFS[q].category === cat).indexOf(id);
      return b.placement.isActive ? 'none' : GRID_KEYS[i] ?? 'none';
    }
    return b.hud.pageIs(null) ? GRID_KEYS[7 + BUILD_CATEGORIES.indexOf(cat)] : 'J';
  }

  /**
   * What stands between the player and a finished `id`: a lower tier, a missing or unfinished
   * prerequisite, or the building itself (to place, or to wait for). Null once it is ready.
   */
  need(id: BuildingId): Need | null {
    const b = this.battle;
    const def = BUILDING_DEFS[id];
    const name = buildingName(id);
    const site = this.site(id);
    if (site?.isReady) return null;
    if (site) return { target: { kind: 'world', x: site.x, y: site.y }, status: t('tut.st.building', { what: name, p: Math.floor(site.progress * 100) }) };
    for (const role of def.requires) {
      const pre = defForRole(b.factions.player, role);
      if (pre && !b.buildings.hasRole('player', role)) {
        const n = this.need(pre.id);
        if (n) return { target: n.target, status: `${t('tut.st.first', { what: name, pre: buildingName(pre.id) })} ${n.status ?? ''}`.trim() };
      }
    }
    if (b.tech.tierOf('player') < def.tier) {
      const up = b.tech.next('player');
      if (up) this.topUp(up.cost);
      const p = b.tech.progress('player');
      if (p !== null) return { target: { kind: 'topbar' }, status: t('tut.st.tierBusy', { n: def.tier, p: Math.floor(p * 100) }) };
      const onHq = b.selection.building?.def.role === 'hq' && b.hud.pageIs(null);
      return { target: { kind: 'grid', key: onHq ? 'Y' : 'none' }, status: t('tut.st.tier', { what: name, n: def.tier }) };
    }
    this.topUp(def.cost);
    const onHq = b.selection.building?.def.role === 'hq';
    return { target: { kind: 'grid', key: this.hqKey(id) }, status: onHq ? t('tut.st.place', { what: name }) : t('tut.st.selectHq', { what: name }) };
  }

  /** How to train `unit`: get its production building first, then select it and press its key. */
  trainNeed(unit: UnitId): Need | null {
    const b = this.battle;
    const producer = (Object.keys(BUILDING_DEFS) as BuildingId[]).find((id) => BUILDING_DEFS[id].faction === 'ironvoid' && BUILDING_DEFS[id].produces.includes(unit));
    if (!producer) return null;
    const pre = this.need(producer);
    if (pre) return pre;
    const bld = this.site(producer) as Building;
    const d = UNIT_DEFS[unit];
    this.topUp(d.cost);
    if (b.tech.tierOf('player') < d.tier) {
      const p = b.tech.progress('player');
      if (p !== null) return { target: { kind: 'topbar' }, status: t('tut.st.tierBusy', { n: d.tier, p: Math.floor(p * 100) }) };
      const onHq = b.selection.building?.def.role === 'hq' && b.hud.pageIs(null);
      return { target: { kind: 'grid', key: onHq ? 'Y' : 'none' }, status: t('tut.st.tier', { what: unitName(unit), n: d.tier }) };
    }
    if (bld.queue.includes(unit)) return { target: { kind: 'world', x: bld.x, y: bld.y }, status: t('tut.st.training', { what: unitName(unit), p: Math.floor(bld.productionFraction() * 100) }) };
    if (b.selection.building !== bld) return { target: { kind: 'world', x: bld.x, y: bld.y }, status: t('tut.st.selectBld', { what: buildingName(producer), unit: unitName(unit) }) };
    const key = GRID_KEYS[bld.def.produces.indexOf(unit)] ?? 'Q';
    return { target: { kind: 'grid', key }, status: null };
  }

  /** The ability step needs riflemen (they carry the grenades). */
  private abilityNeed(): Need | null {
    const b = this.battle;
    const frag = b.units.getSquads('player').filter((s) => s.def.abilities?.includes('frag'));
    if (!frag.length) {
      const n = this.trainNeed('rifleman');
      return n ?? null;
    }
    if (!b.selection.squads.some((s) => s.def.abilities?.includes('frag'))) {
      const c = frag[0].center;
      return { target: { kind: 'world', x: c.x, y: c.y }, status: t('tut.st.selectRifles') };
    }
    return null;
  }

  // ---- Flow --------------------------------------------------------------------------------

  private enterStep(): void {
    const s = this.current;
    if (!s) return;
    s.enter?.();
    AudioSystem.hint();
    Voice.say(dyn(`tut.${s.id}.vo`), 'commander', 'event', true);
    this.battle.events.emit(EV.tutorialStep, this.index);
    // Bring a battlefield target into the clear middle of the screen (the step card and the
    // checklist cover the top corners).
    const tg = s.target();
    if (tg.kind === 'world') {
      const p = this.battle.cameraSystem.worldToScreen(tg.x, tg.y);
      if (p.x < 420 || p.x > 980 || p.y < 120 || p.y > 500) this.battle.cameraSystem.centerOn(tg.x, tg.y);
    }
  }

  skip(): void {
    this.advance();
  }

  private advance(): void {
    // The retreat lesson's raiders withdraw once it is over, so they cannot raze the base.
    if (this.current?.id === 'retreat') this.withdrawAttackers();
    this.index++;
    if (this.index >= this.steps.length) {
      this.finished = true;
      this.battle.events.emit(EV.tutorialStep, this.index);
      this.battle.endBattle('player');
      return;
    }
    this.enterStep();
  }

  update(): void {
    const s = this.current;
    if (s && s.done()) this.advance();
    const b = this.battle;
    for (const a of this.attackers) {
      if (!a.alive) continue;
      if (this.withdrawn) {
        const base = b.map.def.enemyBase;
        if (!a.isMoving()) a.moveTo((base.tx + 2) * TILE_SIZE, (base.ty + 6) * TILE_SIZE, false);
        if (b.elapsed > this.withdrawAt + 12 || !b.fogVisibleFor('player', a.center.x, a.center.y)) a.destroy();
      } else if (!a.engaged && !a.isMoving()) {
        // Tutorial attackers that lose their target just go for the base.
        a.stance = 'aggressive';
      }
    }
    this.attackers = this.attackers.filter((a) => a.alive);
  }

  private withdrawn = false;
  private withdrawAt = 0;

  private withdrawAttackers(): void {
    this.withdrawn = true;
    this.withdrawAt = this.battle.elapsed;
    const base = this.battle.map.def.enemyBase;
    for (const a of this.attackers) if (a.alive) {
      a.stance = 'hold';
      a.moveTo((base.tx + 2) * TILE_SIZE, (base.ty + 6) * TILE_SIZE, false);
    }
  }

  /** Builds the enemy outpost the tutorial ends on. */
  static setupOutpost(b: BattleScene): Building[] {
    const base = b.map.def.enemyBase;
    const out = [
      b.buildings.spawn('spine', 'enemy', base.tx, base.ty + 4, true),
      b.buildings.spawn('brood', 'enemy', base.tx + 3, base.ty, true),
      b.buildings.spawn('nest', 'enemy', base.tx, base.ty, true),
    ];
    const guard = b.units.spawnSquad('crawler', 'enemy', (base.tx + 2) * TILE_SIZE, (base.ty + 7) * TILE_SIZE, 5);
    guard.hold();
    return out;
  }
}
