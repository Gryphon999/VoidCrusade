# Battle modifiers (stage A1) — design

Date: 2026-10-07. Decided with the owner before implementation.

## Goal

Make every skirmish feel different without new content: the player picks any set of ten
**battle modifiers** in the skirmish setup. Each modifier changes a rule for **both** sides
(a modifier is never a cheat). Modifiers combine freely except two mutually exclusive pairs.

## Modifiers

| id | name (en) | effect | hook |
|----|-----------|--------|------|
| storms | Ash storms | existing: periodic storms cut vision and slow projectiles | `WorldSystem.storms` |
| night | Night | every unit sees 40 % less; night lighting on any map | `Modifiers.sightMult` both sides, `BattleScene.lookId = 'khorvan'` |
| plenty | Plenty | all income ×2 | `ResourceSystem.scaleIncome` |
| scarcity | Scarcity | all income ×0.5 | `ResourceSystem.scaleIncome` |
| noDefense | No fortifications | the Defense build category is locked for both sides; the AI stops trying | `TechSystem.lockedCategories` |
| smallWar | Small war | supply cap 20 | `BattleScene.supplyHardMax` |
| bigWar | Big war | supply cap 60 (experimental: performance) | `BattleScene.supplyHardMax` |
| veterans | Veterans | every squad spawns at rank 2 | `BattleScene.spawnRank` |
| glassCannon | Glass cannon | damage ×2, HP ×0.5 for everyone | `Modifiers.damageMult/hpMult` |
| blitz | Blitzkrieg | buildings go up ×2 faster, attrition starts at 5:00 instead of 8:00 | `Modifiers.buildSpeedMult`, `BattleScene.attritionStart` |

Exclusive pairs: plenty ↔ scarcity, smallWar ↔ bigWar. Turning one on turns the other off.

## Architecture

`src/battle/BattleModifiers.ts` is the registry: `MODIFIER_IDS`, `ModifierDef { id, icon, excludes?, apply(battle) }`,
`MODIFIERS`, `isModifierId`, `normalizeModifiers(ids)` (drops unknown ids and resolves exclusions, keeping the later pick).

Rule: **a modifier only sets parameters of systems when the battle starts** (`applyModifiers(battle)` runs
after every system exists and before the headquarters spawn). Systems never ask "is modifier X on"; they read
their own parameters (`supplyHardMax`, `attritionStart`, `lockedCategories`, `sightMult` …). That keeps the
registry the single place to extend, and lets later stages (campaign territories, survival waves) reuse it.

### Data

- `BattleData.modifiers?: ModifierId[]` replaces `ashStorms?: boolean`.
- `GameSettings.skirmishModifiers?: ModifierId[]` replaces `skirmishStorms`. On load, a saved
  `skirmishStorms: true` migrates to `['storms']`.
- Localised names/descriptions: `mod.<id>`, `mod.<id>.desc` in `content.en.ts` / `content.ru.ts`;
  `check-i18n` derives these keys from `MODIFIER_IDS`.
- Icons: `icon_mod_<id>`, 24×24, baked in `UITextures.ts`.

### System parameters added

- `ResourceSystem.scaleIncome(owner, mult)` multiplies the existing per-owner multiplier (so a future
  difficulty multiplier and a modifier compose).
- `TechSystem.lockedCategories: Set<BuildCategory>`; `lockReason(owner, tier, requires, category?)` returns
  `lock.modifier` when the category is locked. Build pages, the engineers' field page and the AI's `tryBuild`
  pass the category.
- `BattleScene.supplyHardMax` (default `SUPPLY.hardMax`), read by `UnitSystem.supplyCap` and the AI.
- `BattleScene.spawnRank` (default 0): `UnitSystem.spawnSquad` sets `squad.rank` to it.
- `BattleScene.attritionStart` (default `ATTRITION.start`), read by `VictorySystem.attrition`.
- `BattleScene.lookId` (default map id): `Atmos`, `Post3D` LUT, `Battle3D` ambient mood and the 2D
  `Atmosphere` grade read it instead of the map id.
- `WorldSystem.storms` becomes a public field set by the modifier (constructor no longer takes it).
- `BattleScene.fogVisibleFor` multiplies the AI's sight by its own `sightMult` (was ignored).

## UI

- Skirmish setup: the "Ash storms" row becomes **Modifiers…** (button like "Choose wargear…") with a
  counter "N on" next to it. The row's position and size do not change.
- `ModifierPicker` (new, modelled on `WargearPicker`): a two-column list of ten cards, each with icon,
  name, description and an on/off look; clicking toggles and applies exclusions; **Confirm** returns the list.
- In battle: active modifier icons in the top bar to the right of the tier text; hovering shows name +
  description in the tooltip.
- End screen: a line "Modifiers: A, B, C" when any are on. Survival score is reported separately as
  "(modified)" so modified runs are not confused with plain ones.

## Testing

`tests/modifiers.test.ts` (Node, no Phaser):
- ids unique, every def has an icon and localisation in en and ru;
- exclusions symmetric; `normalizeModifiers` resolves conflicts and drops unknown ids;
- `apply` on a minimal fake battle: plenty/scarcity scale income, smallWar/bigWar set the cap, noDefense
  locks the category, veterans/glassCannon/blitz/night set the expected parameters.
Existing suites (`npm test`, `check:i18n`, `build`) stay green.

## Out of scope

Campaign use of modifiers, random "daily" modifiers, per-side modifiers, new content. Later stages.
