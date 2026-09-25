import { EV } from '../events';
import { dyn } from '../i18n';
import { TILE_SIZE } from '../config';
import { Building } from '../buildings/Building';
import { BUILDING_DEFS, BUILD_CATEGORIES, BuildingId, buildList } from '../buildings/BuildingDefs';
import { GRID_KEYS } from '../ui/CommandGrid';
import { Squad } from '../units/Squad';
import { Voice } from '../systems/VoiceSystem';
import { AudioSystem } from '../systems/AudioSystem';
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
  /** Runs once when the step starts (spawn enemies, grant resources…). */
  enter?: () => void;
  /** True once the player has done what the step asks. */
  done: () => boolean;
}

/**
 * Scripted tutorial on the Proving Grounds. Each step listens to game events or polls state;
 * the HUD draws the step list, the highlight and the dimming. Steps can be skipped; the whole
 * tutorial can be left at any time and replayed from the menu.
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
    const has = (id: string): boolean => b.buildings.buildings.some((q) => q.owner === 'player' && q.def.id === id && q.isReady);
    /** Grid key leading to `id` from the HQ: its category page first, then its slot on that page. */
    const hqKey = (id: BuildingId): string => {
      if (b.selection.building?.def.role !== 'hq') return 'none';
      const cat = BUILDING_DEFS[id].category;
      if (b.hud.pageIs(cat)) {
        const i = buildList(b.factions.player).filter((q) => BUILDING_DEFS[q].category === cat).indexOf(id);
        return b.placement.isActive ? 'none' : GRID_KEYS[i] ?? 'none';
      }
      return b.hud.pageIs(null) ? GRID_KEYS[7 + BUILD_CATEGORIES.indexOf(cat)] : 'J';
    };
    const point = b.capture.points[0];
    const ruin = { x: 23.5 * TILE_SIZE, y: 26 * TILE_SIZE };
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
        id: 'select', target: () => ({ kind: 'world', ...home() }),
        enter: () => this.flags.delete('ordered'),
        done: () => this.flags.has('ordered'),
      },
      {
        id: 'group', target: () => ({ kind: 'panel' }),
        done: () => this.flags.has('grouped') && this.flags.has('recalled'),
      },
      {
        id: 'capture', target: () => ({ kind: 'world', x: point.x, y: point.y }),
        done: () => point.owner === 'player',
      },
      {
        id: 'conduit', target: () => ({ kind: 'grid', key: hqKey('generator') }),
        enter: () => b.resources.grant('player', 'scrip', 400),
        done: () => has('generator'),
      },
      {
        id: 'barracks', target: () => ({ kind: 'grid', key: hqKey('barracks') }),
        enter: () => b.resources.grant('player', 'scrip', 200),
        done: () => has('barracks'),
      },
      {
        id: 'train', target: () => ({ kind: 'grid', key: b.selection.building?.def.id === 'barracks' ? 'Q' : 'none' }),
        enter: () => {
          this.spawnedAt = b.elapsed;
          this.flags.delete('trained');
        },
        done: () => this.flags.has('trained'),
      },
      {
        id: 'cover', target: () => ({ kind: 'world', ...ruin }),
        done: () => b.units.getSquads('player').some((s) => s.order === 'hold' && s.units.filter((u) => u.inCover).length >= s.units.length / 2),
      },
      {
        id: 'retreat', target: () => ({ kind: 'grid', key: b.selection.hasSquads ? 'T' : 'none' }),
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
        id: 'ability', target: () => ({ kind: 'grid', key: b.selection.hasSquads ? 'Q' : 'none' }),
        enter: () => b.resources.grant('player', 'scrip', 100),
        done: () => this.flags.has('ability'),
      },
      {
        id: 'defense', target: () => ({ kind: 'grid', key: hqKey('turret') }),
        enter: () => b.resources.grant('player', 'scrip', 250),
        done: () => has('turret') || has('bunker') || has('wall'),
      },
      {
        id: 'vehicle', target: () => {
          const sel = b.selection.building;
          if (sel?.def.role === 'vehicles') return { kind: 'grid', key: 'Q' };
          if (b.tech.tierOf('player') < 2) return { kind: 'grid', key: sel?.def.role === 'hq' && b.hud.pageIs(null) ? 'Y' : 'none' };
          return { kind: 'grid', key: hqKey('foundry') };
        },
        enter: () => {
          b.resources.grant('player', 'scrip', 900);
          b.resources.grant('player', 'flux', 500);
          b.tech.speed = 5;
        },
        done: () => this.flags.has('vehicle'),
      },
      {
        id: 'assault', target: () => {
          const t = b.buildings.getOwned('enemy')[0];
          return t ? { kind: 'world', x: t.x, y: t.y } : { kind: 'none' };
        },
        enter: () => b.resources.grant('player', 'scrip', 300),
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

  private enterStep(): void {
    const s = this.current;
    if (!s) return;
    s.enter?.();
    AudioSystem.hint();
    Voice.say(dyn(`tut.${s.id}.vo`), 'commander', 'event', true);
    this.battle.events.emit(EV.tutorialStep, this.index);
  }

  skip(): void {
    this.advance();
  }

  private advance(): void {
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
    // Tutorial attackers that lose their target just go for the base.
    for (const a of this.attackers) if (a.alive && !a.engaged && !a.isMoving()) a.stance = 'aggressive';
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
