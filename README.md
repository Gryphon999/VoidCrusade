# VoidCrusade

A real-time strategy web game inspired by Warhammer 40,000: Dark Crusade.

> **Different name, same savage soul.** Two factions clash on a war-torn planet — build your base, raise your armies, capture the Void-Nexus points, and crush the enemy stronghold.

Built with **Phaser 3 + TypeScript + Vite**. Everything — art, maps, sounds — is generated procedurally at runtime; there are no asset files and no backend.

## Quick Start

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build

```bash
npm run build          # type-check + production bundle in dist/
npm run preview        # serve dist/ locally
npm run zip            # build and package dist/ as voidcrusade.zip (e.g. for Yandex Games)
npm test               # unit tests: damage table, production queue, supply cap, pathing clearance
npm run check:i18n     # every key used in code exists in English and Russian
npm run check:assets   # every unit/building/ability/research has art, sounds and voice lines
npm run simulate -- --matches=9 --diff=hard      # headless AI-vs-AI balance runs (see docs/balance.md)
npm run screenshots -- final --langs=en,ru --sizes=1280x720,1920x1080
npm run screenshots:content                      # tutorial/encyclopedia/tech/vehicles/bunker/drops JPEGs
```

`npm run zip` uses a small Node script (`scripts/zip.mjs`, `node:zlib`), so packaging works on Windows
as well as macOS/Linux — no `zip` CLI needed. The screenshot, asset-check and simulation scripts start a
Vite dev server and drive headless Chromium via `playwright-core` (set `CHROMIUM_PATH` if Playwright's
browsers are not installed).

`dist/` uses relative paths (`base: './'`), so it can be hosted from any sub-folder.

## Controls

New players: **Tutorial** in the main menu (offered on first launch, replayable any time) teaches all of
this in 13 interactive steps. **F1** opens the Encyclopedia everywhere.

| Input | Action |
|-------|--------|
| Arrow keys / screen edge / middle-mouse drag | Scroll camera |
| Mouse wheel | Zoom |
| Left click / drag box | Select · **Shift** adds/removes · double-click selects all of that type |
| Right click | Move · attack · capture · enter bunker/transport · set rally point (production building) |
| **Shift** + right click | Queue waypoints |
| **Q W E R T Y U / A S D F G H J** | Command grid, by position (abilities on Q/W/E, Retreat T, Attack-move A, Stop S, Defend D, Aggressive F, Unload G, Hold H, Move J) |
| **B** | Select the Command Bastion (build menu: A Economy · S Military · D Defense · F Tech · Y tier up) |
| **Ctrl/Alt + 1–9** · **1–9** · **Shift + 1–9** | Bind group · recall (twice centres) · add to group |
| **Ctrl + A** · **.** | Select whole army · cycle idle squads |
| **Space** | Centre camera on selection |
| **Esc** | Cancel order / placement, close a build page |
| **P** / F10 | Pause menu (Resume, Settings, Encyclopedia, Tutorial, Leave) |
| **F1** | Encyclopedia (pauses the battle) |

Production buildings queue up to five units (click a queued unit in the unit panel to cancel it with a full refund, **U** toggles repeat).
Every button has a tooltip with cost, time, counters and, if locked, the reason (tier or missing
building). Hint toasts explain each mechanic the first time it happens; turn them off or reset them in
Settings.

## Graphics

The battlefield is drawn in a Dawn-of-War-style **2.5D oblique projection**: gameplay runs on a flat
top-down grid, the view squashes the ground by the camera tilt and raises everything with height
(units, buildings, cliffs). All art is generated at load time:

- **Terrain** — seamless noise textures blended per biome (ash, dust, rock), roads and ruins, raised lit
  cliffs, baked into 1024 px chunks; decals (craters, cracks, bones) and scattered props with shadows.
- **Units** — every soldier is a small 3D puppet rasterised into 8-direction atlases with idle, walk,
  attack, hit and death animations, team colours and drop shadows. Bodies stay on the field.
- **Buildings** — painted in oblique projection with lit windows, smoke, construction scaffolding and ruins.
- **Effects** — pooled projectiles with trails, muzzle flashes, additive dynamic lights, blood (red for
  humans, violet ichor for the Horde), gibs, debris, scorch marks, fire.
- **Atmosphere** — colour grading, vignette, drifting ash and embers, ground fog, film grain, bloom.

**Settings → Graphics** picks a quality level:

| Level | Lights | Ash / fog | Grading & grain | Bloom | Particles |
|-------|--------|-----------|-----------------|-------|-----------|
| Low | 8 | off | off | off | ×0.5 |
| Medium (default) | 24 | on | on | off | ×1 |
| High | 48 | dense | on | on | ×1.3 |

**Camera tilt** (0.55–0.8) and **screen shake** are separate settings. Static off-screen sprites (props,
cliff occluders, corpses, blood decals, ruins) are culled, and decals, lights and projectiles are pooled;
Medium is the target for 60 FPS on integrated graphics.

## Languages & voice

- **English and Russian** — the whole UI, tooltips, campaign text and notifications. The language is
  detected from the Yandex Games SDK or the browser and can be switched any time in **Settings → Language**
  (scenes rebuild in place; a paused battle stays paused).
- **Voice-over** uses the browser's `speechSynthesis` with a Russian or English voice: unit
  acknowledgements, alerts and battle events, with a priority queue and cooldowns so it never babbles.
  Voice quality depends on the voices installed in the OS/browser. When no matching voice exists (or voice
  is disabled) the lines are shown as **subtitles**; subtitles can also be forced on. Volume, on/off and a
  test button are in Settings. See [docs/voice.md](docs/voice.md).
- **Music** is a procedural Web Audio score (menu, campaign and battle themes) whose intensity follows the
  fighting, with win/lose stingers; it ducks under voice lines.

## Game Overview

Two factions: **Iron Void** (human militarists, playable) vs **Null Horde** (alien swarm, AI). All
numbers live in data definitions (`UnitDefs`, `BuildingDefs`, `Abilities`, `ResearchSystem`, `Wargear`,
`config.ts`).

**Roster**

| | Iron Void | Null Horde |
|---|---|---|
| Infantry | Void Riflemen, Void Rangers (scouts, fast capture, detect), Breacher Squad (flamers), Void Marksmen (snipers), Field Engineers (build, repair, salvage), Iron Guard | Void Crawlers, Acid Spitters, Void Leapers (pounce), Burrowers (burrow, ambush), Brood-shamans (healing aura) |
| Vehicles / monsters | Scout Buggy (detects), Rhino APC (transport), Iron Tyrant Tank (turret, crushes), Thunder Mortar (deploys, indirect) | Null Behemoth, Void Skimmer (flying), Carrier Beast (transport), Siege Beast, Titan |
| Heroes | Void Commander (Rally, Orbital Barrage) | Null Overlord |
| Buildings | 20: Bastion, Flux Conduit, Supply Depot, Barracks, Mechanis Bay, Vehicle Foundry, Void Turret, Signal Relay, Void Foundry (research), Barricade, Blast Gate, Listening Post, Tank Mines, Bunker, Armoury, Field Hospital, Sensor Array, Shield Projector, Missile Battery, Orbital Beacon | 15: Hive, Flux Spire, Brood Nest, Brood Pit, Gestation Maw, Gestation Vat, Spine Tower, Thorn Wall, Spore Node, Spore Mine, Evolution Pit, Healing Pool, Sensory Organ, Acid Spire, Hive Portal |

**Mechanics**

- **Resources** — *Scrip* from held points (+25/s each), *Flux* from conduits/spires and relic points.
- **Tech tiers** — the HQ advances to Tier 2 (needs a barracks) and Tier 3 (heavy + vehicle factory); locked items show why.
- **Supply** — every squad costs supply; the HQ gives 10, each depot/nest 8, hard cap 40; queued units count.
- **Damage types vs armour** — bullet, explosive, melee, acid, flame against light, heavy, vehicle, monster, building; one table decides every counter (shown in tooltips and the Encyclopedia).
- **Active abilities** — 14 (frag, smoke, sprint, rally, barrage, smite, overcharge, frenzy, pounce, burrow, acid cloud, regenerate, scream, spawn brood) with cooldown sweeps.
- **Suppression and morale** — sustained fire slows and pins squads; losses break them and they flee until rallied.
- **Veterancy** — three ranks from damage and kills.
- **Garrisons and transports** — bunkers, ruins, APCs and carriers; flamers burn garrisons out.
- **Points** — strategic, relic (Flux) and forward (reinforce and build there); outposts fortify them.
- **Drops** — Orbital Beacon / Hive Portal drop squads onto visible ground after a warning.
- **Research tree** and **commander wargear** (weapon, armour, relic).
- **Vehicles** — wide pathing, crushing, wrecks that block paths, give cover and can be salvaged.
- **Stealth and detection**, **cover and line of sight**, **fog of war**, **map events** (explosive barrels, derelict turrets, ash storms).
- **Stances** — hold, defend, aggressive, plus retreat.

**Modes** — Campaign (ten hex territories with bonuses and upgrade cards), Skirmish (Annihilation,
Control, Survival; map, difficulty, AI personality, ash storms, wargear), Tutorial.

**AI** — Easy, Normal, Hard, Brutal scale *skill*, never income: think rate, queue depth, counter-picks
from what it has actually scouted, ability use, retreats, focus fire, garrisons, harassment, point and
drop defence, its own drops, and sieges. Personalities **Rusher**, **Turtler** and **Balanced** are
chosen (or randomised) in setup and announced at the start of the battle. Balance results are in
[docs/balance.md](docs/balance.md).

**Performance** — with 163 units and 63 buildings in view the game logic costs about 1.6 ms per
frame (0.2 ms in an empty battle), a tenth of a 60 FPS frame; in the software-rendered test browser the
frame rate drops by only about 5 % against an empty battle. Rendering cost on a real GPU was not
measured in this environment.

**Screenshots** — [docs/screens/content/](docs/screens/content/) (tutorial, encyclopedia, research tree,
vehicles, bunker fight, drop pods; English and Russian).

## Project Layout

```
src/
  main.ts, config.ts (all tuning numbers), events.ts, types.ts
  scenes/     Boot, Preload, Menu, Campaign, Battle, Hud, Settings, Subtitle, Encyclopedia
  maps/       MapBuilder, three battle maps and the tutorial's Proving Grounds
  systems/    Map, Camera, Resource, Selection, Input, Pathfinder, Production, Research, Tech,
              CapturePoint, FogOfWar, Cover, Drop, Victory, World (events), Audio, Music, Voice, Settings
  buildings/  BuildingDefs, Building, BuildingView, BuildingSystem, StructureSystem, placement UI
  units/      UnitDefs, Damage, Abilities, Unit, Squad, Unit/Combat/Support/Vehicle/Wreck/Morale/Ability systems
  ai/         AIController, AIProfile (skill + personality), AIMemory (scouting), AIBuilder, Personality
  tutorial/   TutorialDirector (steps), TutorialOverlay (highlights), data (step/mechanic/hint ids)
  effects/    blood, explosions, lights, projectiles, corpses, smoke, shields, tread marks
  render/     projection, terrain, props, atmosphere, unit puppets → atlases, vehicle and building painters
  i18n/       t(), plurals, en.ts / ru.ts and content.en.ts / content.ru.ts
  campaign/   CampaignData, CampaignState, UpgradeCards, Wargear
  ui/         HUD, TopBar, SelectionPanel, CommandGrid, Commands, Tooltip, MiniMap, HintToast,
              ResearchTree, WargearPicker, SkirmishSetup, EndScreen, PauseMenu, …
tests/core.test.ts           unit tests (node:test via tsx)
scripts/simulate.ts          seeded headless AI-vs-AI balance simulation
scripts/check-assets.ts      art/sound/voice completeness
scripts/check-i18n.ts        translation completeness
scripts/screenshots*.ts      reference screenshots
docs/balance.md              balance notes and simulation results
```

See [TASK.md](TASK.md), [GRAPHICS_TASK.md](GRAPHICS_TASK.md) and [CONTENT_TASK.md](CONTENT_TASK.md) for the specifications.
