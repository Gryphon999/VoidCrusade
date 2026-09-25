import { dyn, t } from './index';
import type { UnitId } from '../units/UnitDefs';
import type { BuildingId, BuildingRole } from '../buildings/BuildingDefs';
import type { Resources } from '../systems/ResourceSystem';

/** Localised names/descriptions for game data (defs keep English text only as documentation). */
export const unitName = (id: UnitId): string => t(dyn(`unit.${id}`));
export const unitDesc = (id: UnitId): string => t(dyn(`unit.${id}.desc`));
export const buildingName = (id: BuildingId): string => t(dyn(`bld.${id}`));
export const buildingDesc = (id: BuildingId): string => t(dyn(`bld.${id}.desc`));
export const researchName = (id: string): string => t(dyn(`res.${id}`));
export const researchDesc = (id: string): string => t(dyn(`res.${id}.desc`));
export const territoryName = (id: string): string => t(dyn(`terr.${id}`));
export const bonusText = (bonus: string): string => t(dyn(`bonus.${bonus}`));
export const cardName = (id: string): string => t(dyn(`card.${id}`));
export const cardDesc = (id: string): string => t(dyn(`card.${id}.desc`));
export const mapName = (id: string): string => t(dyn(`map.${id}`));
export const roleName = (r: BuildingRole): string => t(dyn(`role.${r}`));

export function costText(c: Resources): string {
  if (!c.scrip && !c.flux) return t('common.free');
  return `${c.scrip} ${t('common.scrip')}${c.flux ? ` · ${c.flux} ${t('common.flux')}` : ''}`;
}
