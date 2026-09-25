import type { BattleScene } from '../scenes/BattleScene';
import { Building } from '../buildings/Building';
import { BUILDING_DEFS, PLAYER_BUILD_LIST } from '../buildings/BuildingDefs';
import { buildingIconKey } from '../render/buildings/BuildingArt';
import { portraitKey } from '../render/puppet/UnitAtlas';
import { UNIT_DEFS } from '../units/UnitDefs';
import { RESEARCH_DEFS } from '../systems/ResearchSystem';
import { Resources } from '../systems/ResourceSystem';
import { Squad } from '../units/Squad';
import { Command } from './CommandGrid';
import { GLYPH, researchGlyph } from './GlyphIcons';

export function costText(c: Resources): string {
  if (!c.scrip && !c.flux) return 'Free';
  return `${c.scrip} Scrip${c.flux ? ` · ${c.flux} Flux` : ''}`;
}

function squadCommands(b: BattleScene, squads: Squad[]): Command[] {
  const units = b.units;
  const ic = b.inputController;
  const reinforceable = (): Squad[] => squads.filter((s) => s.alive && units.canReinforce(s));
  const cost = (): number => reinforceable().reduce((a, s) => a + units.reinforceCost(s).scrip, 0);
  return [
    { icon: GLYPH.reinforce, hotkey: 'R', title: 'Reinforce', body: () => `Replenish fallen soldiers over time.\nHalf price per missing soldier.${reinforceable().length ? `\nCost: ${cost()} Scrip` : ''}`,
      onClick: () => ic.reinforceSelected(), enabled: () => reinforceable().length > 0 && b.resources.getResources('player').scrip >= cost(),
      badge: () => (reinforceable().length ? `${cost()}` : '') },
    { icon: GLYPH.move, hotkey: 'M', title: 'Move', body: () => 'Move without stopping to fight.\n(Right-click also moves.)', onClick: () => ic.setMode('move'), active: () => ic.mode === 'move' },
    { icon: GLYPH.attack, hotkey: 'G', title: 'Attack-move', body: () => 'Advance, engaging every enemy on the way.', onClick: () => ic.setMode('attackMove'), active: () => ic.mode === 'attackMove' },
    { icon: GLYPH.hold, hotkey: 'H', title: 'Hold position', body: () => 'Stand ground; soldiers seek nearby cover.', onClick: () => squads.forEach((s) => s.hold()), active: () => squads.every((s) => s.order === 'hold') },
    { icon: GLYPH.stop, hotkey: 'X', title: 'Stop', body: () => 'Cancel current orders.', onClick: () => squads.forEach((s) => s.stop()) },
  ];
}

function buildCommands(b: BattleScene): Command[] {
  return PLAYER_BUILD_LIST.map((id, i) => {
    const d = BUILDING_DEFS[id];
    return {
      icon: buildingIconKey(id), hotkey: `${i + 1}`, key: `Digit${i + 1}`, title: d.name,
      body: () => `${costText(d.cost)} · ${d.buildTime}s\n${d.description}${d.requires.length ? `\nRequires: ${d.requires.join(', ')}` : ''}`,
      onClick: () => {
        const check = b.buildings.validate('player', id, -99, -99);
        if (check.reason === 'Not enough resources' || check.reason?.startsWith('Requires')) b.hud.showMessage(check.reason);
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
      icon: portraitKey(id), hotkey: i === 0 ? 'T' : '', key: i === 0 ? 'KeyT' : undefined, title: d.name,
      body: () => `${costText(d.cost)} · ${d.trainTime}s\n${d.description}\nSquad of ${d.squadSize} · HP ${d.hp} · Dmg ${d.damage}`,
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
        icon: researchGlyph(r.id), title: r.name,
        body: () => `${costText(r.cost)} · ${r.time}s\n${r.description}${rs.isDone('player', r.id) ? '\n— Researched —' : ''}`,
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
