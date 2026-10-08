# Playable Null Horde (stage C) — design

Date: 2026-10-07. The last agreed stage: play the other faction.

## Goal

In Skirmish the player picks a faction: **Iron Void** or **Null Horde**. The Horde side gets the same
systems the AI already uses for it (buildings, units, abilities, research, wargear, drops), the Iron
Void becomes the AI opponent. The campaign and the tutorial stay Iron Void.

## What already works per faction

Build lists, production, tiers (by building role), research (`faction` on every def), abilities,
hero wargear, drops (`DROPPABLE`), 3D models, icons, encyclopedia and the AI (`AIController` takes an
owner and reads `battle.factions[owner]`; the simulation already plays Iron Void as an AI).

## Changes

- `src/battle/Factions.ts` (pure): `opponentFaction`, `startKitFor(faction)` = headquarters id, hero id,
  first squad id (from the data: role `hq`, `isHero`, `DROPPABLE[faction][0]`), `wavePool(faction,
  wave)` and `bossFor(faction)` for Survival waves of either faction, `nestBuildingFor(faction)` for
  Burn the Nests (Brood Nest / Barracks).
- `BattleData.faction` (default `ironvoid`); `BattleScene.create` sets `factions` before any system,
  spawns each side's start kit from the data; Survival waves and nests use the enemy's faction.
- Skirmish setup: a **Faction** row; the wargear picker follows the choice; `Settings.skirmishFaction`.
- Voice: the Horde has no recorded lines. `Voice.say` ignores a key without text, and squad chatter
  (select, under fire, man down, enemy down, broken, ability shouts) is only emitted for Iron Void
  squads; announcer and commander lines (battle start, captured, build done, victory) stay as the
  player's command voice.
- Morale: unchanged (only Iron Void infantry feel fear, so the Horde player is immune as the AI is).
- `simulate --faction=nullhorde` plays the Horde as the "player" AI for balance checks.

## Testing

`tests/factions.test.ts`: both start kits exist and belong to their faction; wave pools and bosses are
real units of that faction; nest buildings exist; the tier upgrades' required roles exist for both
factions. Headless: a Horde skirmish starts (Hive, Overlord, crawlers for the player; Stronghold,
Commander, riflemen for the AI) and runs 120 s without errors; Survival as the Horde spawns Iron Void
waves.

## Out of scope

Recorded Horde voice lines, a Horde campaign, Horde-specific tutorial.
