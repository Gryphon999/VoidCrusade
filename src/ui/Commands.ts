import type { BattleScene } from '../scenes/BattleScene';
import { Building } from '../buildings/Building';
import { BUILDING_DEFS, BuildCategory, BUILD_CATEGORIES, buildList } from '../buildings/BuildingDefs';
import { buildingIconKey } from '../render/buildings/BuildingArt';
import { portraitKey } from '../render/puppet/UnitAtlas';
import { UNIT_DEFS, UnitId } from '../units/UnitDefs';
import { researchAt } from '../systems/ResearchSystem';
import { ABILITIES, AbilityId } from '../units/Abilities';
import { DROP, DROPPABLE } from '../systems/DropSystem';
import { Squad } from '../units/Squad';
import { Command, slotOf } from './CommandGrid';
import { GLYPH, researchGlyph } from './GlyphIcons';
import { dyn, t } from '../i18n';
import { buildingDesc, buildingName, costText, researchDesc, researchName, unitDesc, unitName } from '../i18n/names';
import { strongVs, weakVs } from '../units/Damage';

/** Which build-menu page is shown: an HQ category, the engineers' field page, or null (root commands). */
export type CommandPage = BuildCategory | 'field' | null;
export interface CommandUI {
  page: CommandPage;
  setPage(p: CommandPage): void;
}

const armorName = (a: string): string => t(dyn(`armor.${a}`));
const dmgName = (d: string): string => t(dyn(`dmg.${d}`));

/** Multi-line stats block for a unit type (tooltips, encyclopedia). */
export function unitStatsText(id: UnitId): string {
  const d = UNIT_DEFS[id];
  const lines = [
    t('cmd.unitStats', { n: d.squadSize, hp: d.hp, dmg: d.damage, type: dmgName(d.damageType), range: d.range }),
    t('cmd.unitClass', { armor: armorName(d.armor), s: d.supply, tier: d.tier }),
  ];
  const strong = strongVs(d.damageType);
  const weak = weakVs(d.damageType);
  if (strong.length) lines.push(t('cmd.strong', { list: strong.map(armorName).join(', ') }));
  if (weak.length) lines.push(t('cmd.weak', { list: weak.map(armorName).join(', ') }));
  return lines.join('\n');
}

/** Engineers' field page: fortifications they can raise anywhere (they walk over and build them). */
function fieldPage(b: BattleScene, squads: Squad[], ui: CommandUI): Command[] {
  const builders = squads.filter((s) => s.def.repairRate);
  const ids = buildList(b.factions.player).filter((id) => BUILDING_DEFS[id].fieldBuild);
  const out: Command[] = ids.map((id) => {
    const d = BUILDING_DEFS[id];
    return {
      icon: buildingIconKey(id), title: buildingName(id),
      body: () => `${t('cost.time', { cost: costText(d.cost), t: d.buildTime })}\n${buildingDesc(id)}\n${t('cmd.fieldHint')}`,
      locked: () => b.tech.lockReason('player', d.tier, d.requires),
      onClick: () => {
        if (!b.resources.canAfford('player', d.cost)) b.hud.showMessage('err.resources');
        else b.placement.start(id, builders);
      },
      enabled: () => b.resources.canAfford('player', d.cost),
      active: () => b.placement.activeId === id,
    };
  });
  out.push({ slot: slotOf('J'), icon: GLYPH.back, title: t('cmd.back'), body: () => t('cmd.back.desc'), onClick: () => ui.setPage(null) });
  return out;
}

function squadCommands(b: BattleScene, squads: Squad[], ui: CommandUI): Command[] {
  if (ui.page === 'field') return fieldPage(b, squads, ui);
  const units = b.units;
  const ic = b.inputController;
  const reinforceable = (): Squad[] => squads.filter((s) => s.alive && units.canReinforce(s));
  const cost = (): number => reinforceable().reduce((a, s) => a + units.reinforceCost(s).scrip, 0);
  const all = (st: Squad['stance']): boolean => squads.every((s) => s.stance === st);
  const canEverReinforce = squads.some((s) => !s.def.isHero && s.def.category !== 'vehicle');
  const cmds: Command[] = [
    { slot: slotOf('R'), icon: GLYPH.reinforce, title: t('cmd.reinforce'),
      body: () => `${t('cmd.reinforce.desc')}${reinforceable().length ? `\n${t('cmd.reinforce.cost', { n: cost() })}` : ''}`,
      onClick: () => ic.reinforceSelected(), enabled: () => reinforceable().length > 0 && b.resources.getResources('player').scrip >= cost(),
      badge: () => (reinforceable().length ? `${cost()}` : '') },
    { slot: slotOf('T'), icon: GLYPH.retreat, title: t('cmd.retreat'), body: () => t('cmd.retreat.desc'),
      onClick: () => ic.retreatSelected(), active: () => squads.every((s) => s.retreating) },
    { slot: slotOf('A'), icon: GLYPH.attack, title: t('cmd.attackMove'), body: () => t('cmd.attackMove.desc'),
      onClick: () => ic.setMode('attackMove'), active: () => ic.mode === 'attackMove' },
    { slot: slotOf('S'), icon: GLYPH.stop, title: t('cmd.stop'), body: () => t('cmd.stop.desc'), onClick: () => squads.forEach((s) => s.stop()) },
    { slot: slotOf('D'), icon: GLYPH.defend, title: t('cmd.defend'), body: () => t('cmd.defend.desc'),
      onClick: () => squads.forEach((s) => s.setStance('defend')), active: () => all('defend') },
    { slot: slotOf('F'), icon: GLYPH.aggressive, title: t('cmd.aggressive'), body: () => t('cmd.aggressive.desc'),
      onClick: () => squads.forEach((s) => s.setStance('aggressive')), active: () => all('aggressive') },
    { slot: slotOf('H'), icon: GLYPH.hold, title: t('cmd.hold'), body: () => t('cmd.hold.desc'),
      onClick: () => squads.forEach((s) => s.hold()), active: () => all('hold') },
    { slot: slotOf('J'), icon: GLYPH.move, title: t('cmd.move'), body: () => t('cmd.move.desc'),
      onClick: () => ic.setMode('move'), active: () => ic.mode === 'move' },
    ...vehicleCommands(b, squads),
  ];
  cmds.push(...abilityCommands(b, squads));
  if (squads.some((s) => s.def.repairRate)) {
    cmds.push({ slot: slotOf('Y'), icon: GLYPH.build, title: t('cmd.fieldBuild'), body: () => t('cmd.fieldBuild.desc'), onClick: () => ui.setPage('field') });
  }
  // Vehicles and heroes are repaired or respawned, never reinforced.
  return canEverReinforce ? cmds : cmds.filter((c) => c.icon !== GLYPH.reinforce);
}

/** Active abilities of the selection on Q / W / E (with cooldown sweeps). */
function abilityCommands(b: BattleScene, squads: Squad[]): Command[] {
  const ids: AbilityId[] = [];
  for (const s of squads) for (const id of s.def.abilities ?? []) if (!ids.includes(id)) ids.push(id);
  const ab = b.abilities;
  return ids.slice(0, 3).map((id, i) => {
    const d = ABILITIES[id];
    const casters = (): Squad[] => squads.filter((s) => s.alive && s.def.abilities?.includes(id));
    return {
      slot: slotOf('Q') + i, icon: d.icon, title: t(dyn(`ab.${id}`)),
      body: () => {
        const lines = [t(dyn(`ab.${id}.desc`))];
        const parts: string[] = [t('ab.cooldown', { n: d.cooldown })];
        if (d.cost) parts.unshift(costText(d.cost));
        if (d.range) parts.push(t('ab.range', { n: d.range }));
        lines.push(parts.join(' · '));
        return lines.join('\n');
      },
      locked: () => ab.lockReason('player', id),
      onClick: () => b.inputController.useAbility(id),
      enabled: () => casters().some((s) => ab.check(s, id) === null),
      active: () => b.inputController.targeting?.kind === 'ability' && b.inputController.targeting.id === id,
      progress: () => {
        const c = casters();
        if (!c.length) return null;
        const left = Math.min(...c.map((s) => ab.cooldownLeft(s, id)));
        return left > 0 ? 1 - left / d.cooldown : null;
      },
    };
  });
}

/** Deploy / pack up (artillery, Q) and unload (transports, G). */
function vehicleCommands(b: BattleScene, squads: Squad[]): Command[] {
  const out: Command[] = [];
  const arty = squads.filter((s) => s.def.deploy);
  if (arty.length) {
    out.push({
      slot: slotOf('Q'), icon: GLYPH.deploy, title: t('cmd.deploy'),
      body: () => t('cmd.deploy.desc', { t: arty[0].def.deploy?.time ?? 0, r: arty[0].def.deploy?.rangeBonus ?? 0 }),
      onClick: () => arty.forEach((s) => b.vehicles.toggleDeploy(s)),
      active: () => arty.every((s) => s.deployState === 'deployed'),
      progress: () => {
        const s = arty[0];
        const d = s.def.deploy;
        if (!d || (s.deployState !== 'deploying' && s.deployState !== 'packing')) return null;
        return s.deployT / (s.deployState === 'deploying' ? d.time : d.time * 0.6);
      },
    });
  }
  const carriers = squads.filter((s) => s.def.transport);
  if (carriers.length) {
    out.push({
      slot: slotOf('G'), icon: GLYPH.unload, title: t('cmd.unload'),
      body: () => {
        const names = carriers.flatMap((c) => c.cargo.map((s) => unitName(s.def.id)));
        return `${t('cmd.unload.desc')}${names.length ? `\n${t('cmd.cargo', { list: names.join(', ') })}` : ''}`;
      },
      onClick: () => carriers.forEach((c) => b.vehicles.unload(c)),
      enabled: () => carriers.some((c) => c.cargo.length > 0),
      badge: () => {
        const n = carriers.reduce((a, c) => a + c.cargo.length, 0);
        return n ? `${n}` : '';
      },
    });
  }
  return out;
}

const CATEGORY_GLYPH: Record<BuildCategory, string> = {
  economy: GLYPH.economy, military: GLYPH.military, defense: GLYPH.defense, tech: GLYPH.tech,
};

/** A build-menu page: every structure of one category, plus Back on J. */
function buildPage(b: BattleScene, cat: BuildCategory, ui: CommandUI): Command[] {
  const ids = buildList(b.factions.player).filter((id) => BUILDING_DEFS[id].category === cat);
  const out: Command[] = ids.map((id) => {
    const d = BUILDING_DEFS[id];
    return {
      icon: buildingIconKey(id), title: buildingName(id),
      body: () => `${t('cost.time', { cost: costText(d.cost), t: d.buildTime })}\n${buildingDesc(id)}`,
      locked: () => b.tech.lockReason('player', d.tier, d.requires),
      onClick: () => {
        const check = b.buildings.validate('player', id, -99, -99);
        if (check.reason === 'err.resources') b.hud.showMessage(check.reason, check.params);
        else b.placement.start(id);
      },
      enabled: () => b.resources.canAfford('player', d.cost),
      active: () => b.placement.activeId === id,
    };
  });
  out.push({ slot: slotOf('J'), icon: GLYPH.back, title: t('cmd.back'), body: () => t('cmd.back.desc'), onClick: () => ui.setPage(null) });
  return out;
}

function productionCommands(b: BattleScene, bld: Building): Command[] {
  const prod = b.production;
  return bld.def.produces.map((id) => {
    const d = UNIT_DEFS[id];
    return {
      icon: portraitKey(id), title: unitName(id),
      body: () => `${t('cost.time', { cost: costText(d.cost), t: d.trainTime })}\n${unitDesc(id)}\n${unitStatsText(id)}\n${t('cmd.rallyHint')}`,
      locked: () => prod.lockReason(bld, id),
      onClick: () => prod.enqueue(bld, id), enabled: () => prod.checkEnqueue(bld, id) === null,
      progress: () => (bld.queue[0] === id ? bld.productionFraction() : null),
      badge: () => {
        const n = bld.queue.filter((q) => q === id).length;
        return n ? `${n}` : '';
      },
    };
  });
}

function buildingCommands(b: BattleScene, bld: Building, ui: CommandUI): Command[] {
  if (bld.def.role === 'hq' && ui.page && ui.page !== 'field') return buildPage(b, ui.page, ui);
  const out: Command[] = productionCommands(b, bld);
  if (bld.def.produces.some((id) => !UNIT_DEFS[id].isHero)) {
    out.push({ slot: slotOf('U'), icon: GLYPH.repeat, title: t('cmd.repeat'), body: () => t('cmd.repeat.desc'),
      onClick: () => (bld.repeat = !bld.repeat), active: () => bld.repeat });
  }
  if (bld.def.role === 'hq') {
    const tech = b.tech;
    out.push({
      slot: slotOf('Y'), icon: GLYPH.tierUp,
      title: t('cmd.tierUp', { n: Math.min(3, tech.tierOf('player') + 1) }),
      body: () => {
        const up = tech.next('player');
        if (!up) return t('err.maxTier');
        return `${t('cost.time', { cost: costText(up.cost), t: up.time })}\n${t('cmd.tierUp.desc', { n: up.to })}`;
      },
      locked: () => {
        const up = tech.next('player');
        return up ? tech.lockReason('player', 1, up.requires) : null;
      },
      onClick: () => tech.advance('player'),
      enabled: () => tech.checkAdvance('player') === null,
      progress: () => tech.progress('player'),
      active: () => tech.progress('player') !== null,
    });
    BUILD_CATEGORIES.forEach((cat, i) => {
      out.push({ slot: slotOf('A') + i, icon: CATEGORY_GLYPH[cat], title: t(dyn(`cmd.cat.${cat}`)),
        body: () => t(dyn(`cmd.cat.${cat}.desc`)), onClick: () => ui.setPage(cat) });
    });
  }
  if (bld.def.garrison) {
    const st = b.structures;
    out.push({
      slot: slotOf('G'), icon: GLYPH.unload, title: t('cmd.unload'),
      body: () => `${t('cmd.garrison.desc')}${bld.garrison.length ? `\n${t('cmd.cargo', { list: bld.garrison.map((s) => unitName(s.def.id)).join(', ') })}` : ''}`,
      onClick: () => st.ejectAll(bld), enabled: () => bld.garrison.length > 0, badge: () => (bld.garrison.length ? `${bld.garrison.length}` : ''),
    });
  }
  if (bld.def.role === 'beacon') {
    DROPPABLE[bld.def.faction].forEach((id, i) => {
      const d = UNIT_DEFS[id];
      out.push({
        slot: slotOf('Q') + i, icon: portraitKey(id), title: t('cmd.drop', { name: unitName(id) }),
        body: () => `${costText(b.drops.cost(id))}\n${t('cmd.drop.desc', { t: DROP.warning, cd: DROP.cooldown })}\n${unitStatsText(id)}`,
        locked: () => b.tech.lockReason('player', d.tier, d.requires),
        onClick: () => b.inputController.startDrop(bld, id),
        enabled: () => b.drops.check(bld, id) === null,
        progress: () => (b.elapsed < bld.dropReady ? 1 - (bld.dropReady - b.elapsed) / DROP.cooldown : null),
      });
    });
  }
  if (bld.def.fluxGen > 0 || (bld.def.attack && !bld.def.neutral)) {
    const st = b.structures;
    out.push({
      slot: slotOf('Q'), icon: GLYPH.overcharge, title: t('cmd.overcharge'),
      body: () => t(bld.def.fluxGen ? 'cmd.overcharge.flux' : 'cmd.overcharge.gun'),
      onClick: () => st.overcharge(bld), enabled: () => st.canOvercharge(bld),
      active: () => bld.overchargeUntil > b.elapsed,
      progress: () => (b.elapsed < bld.overchargeReady ? 1 - (bld.overchargeReady - b.elapsed) / 60 : null),
    });
  }
  const sh = bld.def.shield;
  if (sh) {
    const st = b.structures;
    out.push({
      slot: slotOf('Q'), icon: GLYPH.shield, title: t('cmd.shield'),
      body: () => t('cmd.shield.desc', { cost: sh.cost, t: sh.duration, cd: sh.cooldown }),
      onClick: () => st.raiseShield(bld), enabled: () => st.canRaiseShield(bld),
      active: () => bld.shieldUntil > b.elapsed,
      progress: () => (b.elapsed < bld.shieldReady ? 1 - (bld.shieldReady - b.elapsed) / sh.cooldown : null),
    });
  }
  const research = researchAt(bld.def.faction, bld.def.role);
  if (research.length) {
    out.push({ slot: slotOf('U'), icon: GLYPH.tree, title: t('cmd.tree'), body: () => t('cmd.tree.desc'), onClick: () => b.hud.openTree(bld) });
    const rs = b.research;
    research.forEach((r, i) => {
      out.push({
        slot: slotOf('A') + i, icon: researchGlyph(r.id), title: researchName(r.id),
        body: () => `${t('cost.time', { cost: costText(r.cost), t: r.time })}\n${researchDesc(r.id)}${rs.isDone('player', r.id) ? `\n${t('cmd.researched')}` : ''}`,
        onClick: () => rs.start(bld, r.id),
        locked: () => (rs.isDone('player', r.id) ? null : rs.lockReason('player', r.id)),
        enabled: () => !rs.isDone('player', r.id) && !rs.isResearching('player', r.id) && !rs.activeAt(bld) && b.resources.canAfford('player', r.cost),
        active: () => rs.isDone('player', r.id),
        progress: () => {
          const a = rs.activeAt(bld);
          return a && a.def.id === r.id ? a.frac : null;
        },
      });
    });
  }
  return out;
}

/** Commands for the current selection (empty when nothing is selected). */
export function commandsFor(b: BattleScene, ui: CommandUI): Command[] {
  const sel = b.selection;
  if (sel.squads.length) return squadCommands(b, sel.squads, ui);
  if (sel.building) return buildingCommands(b, sel.building, ui);
  return [];
}
