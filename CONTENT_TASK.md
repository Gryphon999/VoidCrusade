# CONTENT_TASK.md — More buildings, infantry, vehicles, tutorial and new mechanics

Follow-up to `GRAPHICS_TASK.md` (done). Read `README.md`, `TASK.md`, `GRAPHICS_TASK.md` and skim `src/units/UnitDefs.ts`,
`src/buildings/BuildingDefs.ts`, `src/systems/ProductionSystem.ts`, `ResearchSystem.ts`, `src/ai/*`, `src/campaign/*` before starting.

Goal: turn VoidCrusade from a small prototype (5 unit types, 12 buildings, one unit per production building, no tutorial)
into a game with real choices: a tech tree, several infantry roles, vehicles, defensive/support buildings, active abilities,
a tutorial, and smarter AI. Inspiration: Dawn of War – Dark Crusade (squads, cover, morale, wargear, requisition/power, strategic points),
but keep our own lore and names (no trademarked names).

## 0. Rules for this task
- Same stack and constraints as before: Phaser 3 + TypeScript + Vite, client only, **everything procedural** (no image/audio files),
  60 FPS on integrated graphics, `npm run build` must pass before every push.
- **Every new thing must be finished end to end**: rules + procedural art (same quality bar as GRAPHICS_TASK: 8 facings / animations for units,
  volumetric buildings, icons, projectiles, sounds) + Russian and English strings (i18n) + voice lines (VoiceSystem) + AI support + entry in the in-game Encyclopedia.
  No placeholder squares.
- Data-driven: add content by adding entries to defs files, not by hard-coding in scenes. Keep the defs readable.
- Balance may change now (new content requires it), but keep the old units recognisable. Document the tables in `docs/balance.md`.
- Keep the game playable after every phase. One commit per phase, push after each phase to the current branch (`claude/zen-brown-1mby9l`).
  PR #1 stays open and simply grows; update its description at the end. Do not open a second PR.
- No new heavy dependencies. Do not break saves/settings (campaign state must migrate or reset cleanly).

## 1. Phases

### C0 — Foundations (do first, small but important)
1. **Production buildings can produce several units** (`produces: UnitId[]` already exists — make UI, queue and AI actually use it).
   Production queue: up to 5 items per building, cancel with refund, repeat toggle, **rally point** (right-click on ground with the building selected).
2. **Damage types and armor classes.** Damage types: `bullet`, `explosive`, `melee`, `acid`, `flame`. Armor classes: `light`, `heavy`, `vehicle`, `monster`, `building`.
   A multiplier table in one file (e.g. bullet vs light 1.0, vs heavy 0.7, vs vehicle 0.35; explosive vs vehicle 1.2, vs building 1.5; acid vs vehicle 1.3; flame vs light 1.4, etc.).
   Show damage/armor type in the selection panel and Encyclopedia. Wire it into `CombatSystem`.
3. **Tech tiers.** Tier 1 (basic), Tier 2, Tier 3. Buildings and units declare `tier` and `requires`. The build toolbar and production buttons show locked entries with a tooltip
   explaining what is missing.
4. **Squad cap** becomes supply-based: each unit has a `supply` cost; Supply buildings raise the cap (start 10, hard max 40). Show it in the top bar.
5. **Command upgrades:** attack-move (A + click), stance per squad (Hold / Defend / Aggressive / Retreat), shift-queue waypoints, control groups (Ctrl+1..9, double tap centers camera),
   idle-squad cycling (period key), select all of type (double-click). Add these to the tutorial and Encyclopedia.

### C1 — Infantry roles (target: 5 infantry squads per faction incl. existing ones)
Give each squad a clear role and counter. Suggested roster (rename freely, keep lore):
**Iron Void**
- Void Riflemen (existing): cheap line infantry.
- Iron Guard (existing): heavy weapons, slow, strong vs vehicles/heavy.
- **Rangers**: fast scouts, long range, low HP, reveal fog more, can capture points quickly.
- **Breachers**: flamers/shotguns, short range, high damage vs light infantry and buildings in cover; can clear garrisons.
- **Marksmen**: 2–3 snipers, very long range, kill squad members selectively, weak up close.
- **Field Engineers** (support): repair vehicles/buildings, build mines and barricades, lay *Listening Posts* on capture points, no strong weapon.
- Void Commander (hero, existing): see abilities and wargear below.
**Null Horde**
- Void Crawlers (existing): fast swarm.
- Null Behemoth (existing): monster brute.
- **Spitters**: ranged acid squad, good vs vehicles (acid), fragile.
- **Leapers**: jump to target, strong on first strike, drop in a fight if not supported.
- **Burrowers**: move underground (invisible, slow), ambush from fog; revealed by sensor buildings/Rangers.
- **Brood-shamans** (support): heal nearby swarm, buff speed, low combat power.
- Null Overlord (hero): see abilities below.
Each squad: hp, damage type, armor class, range, speed, sight, supply, cost, train time, tier, abilities, veterancy stats. Update `UnitDefs.ts`, textures, icons, voice lines, i18n, Encyclopedia.

### C2 — Vehicles and monsters (target: 3–4 per faction)
**Iron Void:** Scout Buggy (fast, light armor, reveals map), **APC / Transport** (carries 1 infantry squad, protects it, unload button, can be garrison for repair), 
Battle Tank (heavy gun, strong armor, crushes light infantry when moving), **Artillery / Siege Walker** (long-range indirect fire, min range, must deploy), optional Walker (Dreadnought-like hero-vehicle).
**Null Horde:** Skimmer (fast flying-ish unit, ignores terrain/cliffs, hit-and-run), Siege Beast (long-range acid lob, slow), Carrier Beast (transports a squad, regenerates), Titan (Tier 3 monster, huge).
Rules: vehicles cannot capture points, have armor class `vehicle` (Null Horde monsters use `monster`), leave **wrecks** that block movement and give cover briefly (and
Engineers/salvage them for a little Scrip), can be repaired (Iron Void) or regenerate slowly (Null Horde), show engine sound/exhaust particles, tread marks on the ground (fade).
Vehicle pathfinding respects a bigger radius: add a second navigation layer or radius-aware pathing so tanks do not squeeze through 1-tile gaps.
All need 8-facing procedural art (turret rotation independent of hull for tanks), shadows, and death explosions.

### C3 — New buildings (target: ~12 per faction, tiers 1–3)
**Iron Void**
- Tier 1: Flux Conduit, Assault Barracks, **Supply Depot** (+supply), **Barricade / Wall segments and Gate** (cheap, block movement, gate opens for own units), **Listening Post** (built by Engineers on capture points, protects and speeds capture income).
- Tier 2: Mechanis Bay (heavy infantry), **Vehicle Foundry** (vehicles), **Armoury** (wargear/upgrades for infantry), **Bunker** (garrison 1 squad, big cover bonus, can be repaired), **Field Hospital** (heals infantry around, slowly revives some fallen members for Scrip), Void Foundry (research).
- Tier 3: **Sensor Array** (map-wide detection radius, reveals Burrowers, extends minimap vision), **Shield Projector** (protects an area from ranged shots for N seconds, needs Flux upkeep), **Missile Battery** (long-range defense), **Orbital Beacon** (unlocks hero ability *Void Barrage* and reinforcement drop-pods).
**Null Horde** — equivalents with organic look and regeneration: Brood Pit, Flux Spire, **Nest** (+supply), **Thorn Wall**, **Spore Node** (like Listening Post), Maw (heavy), **Vehicle-equivalent "Gestation Vat"** (skimmers/beasts), **Evolution Pit** (upgrades), **Healing Pool**, **Spore Mines** (traps), **Sensory Organ** (detection), **Acid Spire** (defense), **Hive Portal** (drop-pod style reinforcements).
Rules: each building has role/tier/requires, buildable area rules stay, destroyed buildings leave ruins (existing) — garrisoned units eject, production is cancelled with refund.
Toolbar: group by category (Economy / Military / Defense / Tech) with hotkeys and tooltips; the toolbar must fit at 1280x720.

### C4 — New mechanics
Implement these one by one, each with UI feedback and tutorial/Encyclopedia text.
1. **Active abilities** with cooldown/cost and targeting UI (cursor, range circle, hotkeys Q/W/E/R shown on the command grid):
   Iron Void: *Frag Grenade* (Riflemen), *Sprint* (Rangers), *Smoke Screen* (blocks LOS), *Repair/Overcharge* (Engineers), *Deploy* (Artillery, +range, immobile), *Smite Shot* (Marksmen).
   Null Horde: *Frenzy* (Crawlers +speed/attack), *Leap*, *Burrow/Unburrow*, *Acid Cloud*, *Regenerate* (Shaman).
   Heroes (one per faction, more wargear slots): Void Commander — *Rally* (morale/attack aura), *Void Barrage* (delayed artillery strike, needs Orbital Beacon).
   Null Overlord — *Psychic Scream* (stuns/suppresses), *Spawn Brood* (free small squad, long cooldown).
2. **Suppression and morale:** sustained fire suppresses a squad (slower, worse accuracy, can be pinned in the open); low morale makes a squad retreat toward the nearest friendly building
   and return when recovered; heroes/banners/Chaplain-like buffs raise morale; Null Horde is fearless but takes extra damage when its shaman/overlord dies. Show morale bar (extend existing if any).
3. **Veterancy:** squads earn XP from kills; 3 ranks with small bonuses and a rank chevron on the HUD/unit; heroes gain ability points.
4. **Garrisons and cover:** infantry can enter bunkers and capture buildings' ruins; cover gives damage reduction and suppression resistance (extend existing CoverSystem), vehicle wrecks and barricades count as cover.
5. **Capture-point types:** Strategic point (Scrip, existing), **Relic** (one per map, grants a permanent bonus while held: +hero XP or +Flux), **Forward Base point** (allows building there, extends build radius).
6. **Reinforcement drops:** drop-pods land with a short warning marker (needs Orbital Beacon / Hive Portal); cost Scrip/Flux, limited by supply.
7. **Map events / neutral elements:** capturable neutral turrets, explosive barrels/fuel tanks that chain-explode, occasional ash storms (reduced vision, slower projectiles) as an optional map modifier with a warning in the notification bar.
8. **Research tree** (Void Foundry / Evolution Pit + Armoury): armor, weapon, speed, sight, ability upgrades; shown as a tree UI with costs and prerequisites; commander **wargear slots** (weapon, armor, relic) with a small choose-one-of-three picker before a battle and in the campaign.
9. **Economy depth (light):** salvage from wrecks/ruins, one optional "overcharge" for Flux Conduits (short boost, then cooldown); no micro-heavy upkeep.
10. **Difficulty options and skirmish modes:** Annihilation (default), Control Points (hold N of M points for T seconds), Survival (waves of Null Horde, scoring), optional *Play as Null Horde* (needs AI for Iron Void — stretch goal, only after everything else is done).

### C5 — Tutorial and onboarding
- **Interactive tutorial mission** (menu: "Tutorial") on a dedicated small map, scripted steps with a highlight/arrow overlay, greyed-out everything else, a step list, and optional voice lines:
  camera (WASD, edge scroll, zoom, minimap) → select and move → box select and control groups → capture a strategic point → build a Flux Conduit → build Barracks → train and rally a squad →
  cover and suppression → combat and retreat → use an ability → build a Supply Depot/Bunker → tech up and produce a vehicle → destroy an enemy outpost (win). Each step detects the action (event-based), can be skipped,
  and the whole tutorial can be exited anytime and replayed.
- **First-run prompt** ("New to VoidCrusade? Play the tutorial") once (localStorage, wrapped in try/catch); a "Tutorial" button in the main menu and pause menu.
- **Contextual hint toasts** for the first time the player meets a mechanic (first suppression, first vehicle, low supply, no power, etc.), each can be disabled in Settings.
- **Encyclopedia** screen (menu + `F1` in battle): tabs Units / Buildings / Abilities / Mechanics; stats, costs, tier, damage/armor types, counters ("strong vs / weak vs"), art preview drawn with the real sprite; searchable; RU/EN.
- Tooltips everywhere with cost, build time, hotkey, requirements; unit panel shows abilities with cooldown sweep.

### C6 — AI upgrade
- The AI uses the new content: build orders per difficulty, expands supply, teches, builds a mixed army, **counter-picks** by scouting what the player has (armor/damage table),
  uses abilities and retreats damaged squads, garrisons bunkers, defends capture points, harasses undefended points, defends against drops. Different personalities (Rusher, Turtler, Balanced) picked randomly per skirmish and shown in the setup screen.
- Difficulty must scale by skill, not by cheating: Easy (slow build, few abilities), Normal, Hard (fast macro, good micro), Brutal (still no resource cheat; more aggression and scouting). Keep the frame cost of AI low.

### C7 — Balance and tests
- Add a **headless simulation script** (`scripts/simulate.ts`, run with `tsx`) that plays AI vs AI matches with a fixed seed and prints win rates, average duration, unit cost-efficiency, most/least used units.
  Use it to tune the numbers so no unit or strategy dominates; write results and reasoning to `docs/balance.md`.
- Add a few unit tests for the damage table, production queue, supply cap, pathing radius (Vitest or plain tsx assertions; keep it light).
- Verify RU/EN completeness (no missing i18n keys), and that every unit/building/ability has an icon, sound, and voice line where applicable.

### C8 — Polish and proof
- Update visuals/audio for new content to the same standard as before: new music layers or stingers for tier-ups and victory, sounds for vehicles, abilities, garrison, drop-pods; effects for suppression, smoke, shields, wrecks, tread marks.
- Performance pass: 150+ units and 60+ buildings ≥ 50 FPS on Medium; pool new effects; cull off-screen.
- Screenshots into `docs/screens/content/` (tutorial step, encyclopedia, tech tree, vehicles, bunker fight, drop pods) in RU and EN.
- Update `README.md` (roster, mechanics, controls incl. new hotkeys, skirmish modes) and the PR description with a per-phase summary and known limitations.

## 2. Definition of done
- Both factions have several infantry roles, vehicles/monsters, and about a dozen buildings each with a tech tree; each production building offers several units.
- Damage/armor classes, supply, suppression/morale, veterancy, abilities, garrisons, relic points, drops are working and visible in the UI.
- A playable interactive tutorial, first-run prompt, hints and an Encyclopedia in RU and EN.
- AI uses the new content with 3 personalities and 4 difficulties without cheating.
- `docs/balance.md` with simulation results; `npm run build` passes; the game is playable start to finish (campaign and skirmish) in both languages.
