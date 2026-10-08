# Campaign with consequences (stage B) — design

Date: 2026-10-07. Agreed direction: events between battles (a choice of two), Horde counterattacks on
held territories, territory rules that reuse the battle modifiers (A1) and mission objectives (A3).

## Goal

The campaign stops being a chain of identical battles: each territory fights by its own rules, the
Horde strikes back at what you hold, and between battles the crusade faces choices with a price.

## Territory rules

`TerritoryDef.rules?: { modifiers?: ModifierId[]; winMode?: WinMode }`. The assault dialog lists
them; `launch()` passes them into `BattleData`. Three territories move to the new maps.

| territory | map | rules |
|-----------|-----|-------|
| Forge of Ascalon (start) | Ashfall | — |
| Veyra Wastes | Veyra | Ash storms |
| Khorvan Deep | Khorvan | Night |
| The Ossuary | **Sunken Delta** | Burn the Nests |
| Mourngate | Mourngate | Ash storms |
| Cinder Spires | Cinder | Blitzkrieg |
| Halcyon Ruin | Ashfall | Hold the Line |
| Nadir Rift | **Ignis Flats** | No fortifications |
| Hollow Spire | **Frostmark** | Night, Veterans |
| Iron Void Throne | Cinder | Big war |

## Events between battles

After a victory and the boon pick, with probability `EVENT_CHANCE` = 0.6, one of eight events
(`src/campaign/CampaignEvents.ts`) is drawn, never the same one twice in a row. Each has two options;
an option's effects are: bonuses for the **next battle only** (`save.nextBattle`, merged into
`bonuses()` and cleared when that battle ends), a permanent boon card gained or a random one lost,
extra Horde Scrip in the next battle, and a change to this turn's counterattack chance.

## Counterattacks

After every battle (and after the event choice, so events can tilt it) the Horde may counterattack:
chance `COUNTER_BASE` 0.3 + 0.05 × battles won, capped at 0.6, plus the event's delta. The target is
a random held territory that borders Horde land, never the start territory. While a territory is
under attack it is the only place the player can fight (the map pulses it red, the dialog says
"Defend"). The defence is fought on that territory's map with its rules but the objective **Hold the
Line**, the Horde with +100 extra Scrip. Losing the defence loses the territory (and its bonus);
winning keeps it and still pays a boon. Losing an assault never loses land.

## Save

`CampaignSave` gains `nextBattle`, `eventId`, `lastEventId`, `underAttack`, `counterMod`, `lost`.
Old saves load with these absent (defaults). All logic lives in `CampaignState` / `CampaignEvents`
as pure functions taking an `rng` so `tests/campaign.test.ts` covers them in Node.

## UI

- Assault dialog: a "Rules:" line (modifier names, mission name).
- Defend dialog: title "Defend {name}", the same rules line, "Hold the line".
- Event dialog: title, story text, two option buttons with their effects spelled out.
- Sidebar: "Next battle:" bonuses when any, "Territories lost: n" when any.
- Banners: counterattack announced, territory lost.

## Out of scope

Branching story, more than one attack at a time, Horde capturing land without a battle.
