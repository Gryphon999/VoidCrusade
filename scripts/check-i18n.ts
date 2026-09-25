/**
 * Localisation check: npm run check:i18n
 * - every key used in code (t('…'), plural(n, '…'), 'err.*' reasons, dynamic data keys) exists in en.ts and ru.ts
 * - no Russian value is left identical to English (likely untranslated)
 * - flags UI literals passed straight to text()/label: instead of t()
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../src/i18n/en';
import { ru } from '../src/i18n/ru';
import { UNIT_DEFS } from '../src/units/UnitDefs';
import { BUILDING_DEFS } from '../src/buildings/BuildingDefs';
import { RESEARCH_DEFS } from '../src/systems/ResearchSystem';
import { TERRITORIES } from '../src/campaign/CampaignData';
import { CARDS } from '../src/campaign/UpgradeCards';
import { MAP_BUILDERS } from '../src/maps';
import { ABILITIES } from '../src/units/Abilities';
import { WARGEAR } from '../src/campaign/Wargear';
import { PERSONALITIES } from '../src/ai/Personality';
import { ENC_TRAITS, HINT_IDS, MECHANICS, TUTORIAL_STEP_IDS } from '../src/tutorial/data';

const files: string[] = [];
const walk = (d: string): void => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.ts') && !p.includes(join('src', 'i18n'))) files.push(p);
  }
};
walk('src');

const used = new Set<string>();
const literals: string[] = [];
const keyRe = /(?:\bt|plural\([^,]+,|reason:|EV\.message,|showMessage\()\s*\(?\s*'([a-z][a-zA-Z0-9]*\.[a-zA-Z0-9.]+)'/g;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(keyRe)) used.add(m[1]);
  for (const m of src.matchAll(/'((?:err|note|vo|tip|load|order|cmd|hud|camp|end|pause|menu|settings|diff|gfx|common)\.[a-zA-Z0-9.]+)'/g)) used.add(m[1]);
  for (const m of src.matchAll(/(?:label:\s*|add\.text\([^,]+,[^,]+,\s*)'([A-Za-z][^']*[a-z][^']*)'/g)) {
    if (!['VOIDCRUSADE', 'English'].includes(m[1])) literals.push(`${f}: '${m[1]}'`);
  }
}
// Keys built from game data.
const dyn: string[] = [];
for (const u of Object.values(UNIT_DEFS)) {
  dyn.push(`unit.${u.id}`, `unit.${u.id}.desc`);
  if (u.faction === 'ironvoid') dyn.push(`vo.select.${u.id}`);
}
for (const d of Object.values(BUILDING_DEFS)) dyn.push(`bld.${d.id}`, `bld.${d.id}.desc`, `role.${d.role}`);
for (const r of RESEARCH_DEFS) dyn.push(`res.${r.id}`, `res.${r.id}.desc`);
for (const tr of TERRITORIES) dyn.push(`terr.${tr.id}`, `bonus.${tr.bonus}`);
for (const c of CARDS) dyn.push(`card.${c.id}`, `card.${c.id}.desc`);
for (const b of MAP_BUILDERS) dyn.push(`map.${b().id}`);
for (const d of ['easy', 'normal', 'hard', 'brutal']) dyn.push(`diff.${d}`, `diff.${d}.desc`);
for (const a of Object.keys(ABILITIES)) dyn.push(`ab.${a}`, `ab.${a}.desc`);
for (const w of WARGEAR) dyn.push(`wg.${w.id}`, `wg.${w.id}.desc`);
for (const m of ['annihilation', 'control', 'survival']) dyn.push(`mode.${m}`, `mode.${m}.desc`);
for (const p of ['random', ...PERSONALITIES]) dyn.push(`ai.${p}`);
for (const p of PERSONALITIES) dyn.push(`ai.${p}.desc`);
for (const s of ['weapon', 'armor', 'relic']) dyn.push(`wargear.slot.${s}`);
for (const q of ['low', 'medium', 'high']) dyn.push(`gfx.${q}`);
for (const id of TUTORIAL_STEP_IDS) dyn.push(`tut.${id}.title`, `tut.${id}.text`, `tut.${id}.vo`);
for (const id of MECHANICS) dyn.push(`enc.m.${id}.title`, `enc.m.${id}.text`);
for (const id of HINT_IDS) dyn.push(`hint.${id}`);
for (const id of ENC_TRAITS) dyn.push(`enc.t.${id}`);
for (const k of ['units', 'buildings', 'abilities', 'mechanics']) dyn.push(`enc.tab.${k}`);
for (const k of ['ironvoid', 'nullhorde']) dyn.push(`enc.faction.${k}`);
for (const k of ['infantry', 'vehicle', 'monster', 'hero']) dyn.push(`enc.cat.${k}`);
for (const k of ['none', 'point', 'enemy', 'building']) dyn.push(`enc.target.${k}`);
dyn.forEach((k) => used.add(k));

const E = en as Record<string, string>;
const R = ru as Record<string, string>;
const missingEn = [...used].filter((k) => !(k in E)).sort();
const missingRu = [...used].filter((k) => !(k in R)).sort();
const same = Object.keys(E).filter((k) => R[k] === E[k] && /[a-z]{3}/i.test(E[k]) && !/^\{/.test(E[k]));
const report = (title: string, list: string[]): void => {
  console.log(`${title}: ${list.length}`);
  for (const x of list) console.log(`  - ${x}`);
};
report('Keys used in code but missing from en.ts', missingEn);
report('Keys used in code but missing from ru.ts', missingRu);
report('Russian values identical to English', same);
report('Hard-coded UI literals', literals);
console.log(`Checked ${used.size} keys across ${files.length} files.`);
process.exit(missingEn.length || missingRu.length || literals.length ? 1 : 0);
