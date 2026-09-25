import type { BattleScene } from '../scenes/BattleScene';
import { Building } from '../buildings/Building';
import { BUILDING_DEFS, PLAYER_BUILD_LIST } from '../buildings/BuildingDefs';
import { buildingIconKey } from '../render/buildings/BuildingArt';
import { portraitKey } from '../render/puppet/UnitAtlas';
import { UNIT_DEFS } from '../units/UnitDefs';
import { RESEARCH_DEFS } from '../systems/ResearchSystem';
import { Squad } from '../units/Squad';
import { Command } from './CommandGrid';
import { GLYPH, researchGlyph } from './GlyphIcons';
import { t } from '../i18n';
import { buildingDesc, buildingName, costText, researchDesc, researchName, roleName, unitDesc, unitName } from '../i18n/names';


function squadCommands(b: BattleScene, squads: Squad[]): Command[] {
  const units = b.units;
  const ic = b.inputController;
  const reinforceable = (): Squad[] => squads.filter((s) => s.alive && units.canReinforce(s));
  const cost = (): number => reinforceable().reduce((a, s) => a + units.reinforceCost(s).scrip, 0);
  return [
    { icon: GLYPH.reinforce, hotkey: 'R', title: t('cmd.reinforce'), body: () => `${t('cmd.reinforce.desc')}${reinforceable().length ? `\n${t('cmd.reinforce.cost', { n: cost() })}` : ''}`,
      onClick: () => ic.reinforceSelected(), enabled: () => reinforceable().length > 0 && b.resources.getResources('player').scrip >= cost(),
      badge: () => (reinforceable().length ? `${cost()}` : '') },
    { icon: GLYPH.move, hotkey: 'M', title: t('cmd.move'), body: () => t('cmd.move.desc'), onClick: () => ic.setMode('move'), active: () => ic.mode === 'move' },
    { icon: GLYPH.attack, hotkey: 'G', title: t('cmd.attackMove'), body: () => t('cmd.attackMove.desc'), onClick: () => ic.setMode('attackMove'), active: () => ic.mode === 'attackMove' },
    { icon: GLYPH.hold, hotkey: 'H', title: t('cmd.hold'), body: () => t('cmd.hold.desc'), onClick: () => squads.forEach((s) => s.hold()), active: () => squads.every((s) => s.order === 'hold') },
    { icon: GLYPH.stop, hotkey: 'X', title: t('cmd.stop'), body: () => t('cmd.stop.desc'), onClick: () => squads.forEach((s) => s.stop()) },
  ];
}

function buildCommands(b: BattleScene): Command[] {
  return PLAYER_BUILD_LIST.map((id, i) => {
    const d = BUILDING_DEFS[id];
    return {
      icon: buildingIconKey(id), hotkey: `${i + 1}`, key: `Digit${i + 1}`, title: buildingName(id),
      body: () => `${t('cost.time', { cost: costText(d.cost), t: d.buildTime })}\n${buildingDesc(id)}${d.requires.length
        ? `\n${t('cmd.requires', { what: d.requires.map(roleName).join(', ') })}` : ''}`,
      onClick: () => {
        const check = b.buildings.validate('player', id, -99, -99);
        if (check.reason === 'err.resources' || check.reason === 'err.requires') b.hud.showMessage(check.reason, check.params);
        else b.placement.start(id);
      },
      enabled: () => b.resources.canAfford('player', d.cost) && d.requires.every((r) => b.buildings.hasRole('player', r)),
      active: () => b.placement.activeId === id,
    };
  });
}

function buildingCommands(b: BattleScene, bld: Building): Command[] {
  const out: Command[] = [];
  if (bld.def.role === 'hq') out.push(...buildCommands(b));
  const prod = b.production;
  bld.def.produces.forEach((id, i) => {
    const d = UNIT_DEFS[id];
    out.push({
      icon: portraitKey(id), hotkey: i === 0 ? 'T' : '', key: i === 0 ? 'KeyT' : undefined, title: unitName(id),
      body: () => `${t('cost.time', { cost: costText(d.cost), t: d.trainTime })}\n${unitDesc(id)}\n${t('cmd.squadStats', { n: d.squadSize, hp: d.hp, dmg: d.damage })}`,
      onClick: () => prod.enqueue(bld, id), enabled: () => prod.checkEnqueue(bld, id) === null,
      progress: () => (bld.queue[0] === id ? bld.productionFraction() : null),
      badge: () => {
        const n = bld.queue.filter((q) => q === id).length;
        return n ? `${n}` : '';
      },
    });
  });
  if (bld.def.role === 'research') {
    const rs = b.research;
    for (const r of RESEARCH_DEFS) {
      out.push({
        icon: researchGlyph(r.id), title: researchName(r.id),
        body: () => `${t('cost.time', { cost: costText(r.cost), t: r.time })}\n${researchDesc(r.id)}${rs.isDone('player', r.id) ? `\n${t('cmd.researched')}` : ''}`,
        onClick: () => rs.start(bld, r.id),
        enabled: () => !rs.isDone('player', r.id) && !rs.isResearching('player', r.id) && !rs.activeAt(bld) && b.resources.canAfford('player', r.cost),
        active: () => rs.isDone('player', r.id),
        progress: () => {
          const a = rs.activeAt(bld);
          return a && a.def.id === r.id ? a.frac : null;
        },
      });
    }
  }
  return out;
}

/** Commands for the current selection (empty when nothing is selected). */
export function commandsFor(b: BattleScene): Command[] {
  const sel = b.selection;
  if (sel.squads.length) return squadCommands(b, sel.squads);
  if (sel.building) return buildingCommands(b, sel.building);
  return [];
}
