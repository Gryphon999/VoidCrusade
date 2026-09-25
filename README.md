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
npm run build      # type-check + production bundle in dist/
npm run preview    # serve dist/ locally
npm run zip        # build and package dist/ as voidcrusade.zip (e.g. for Yandex Games)
npm run check:i18n # every English key has a Russian translation and vice versa
npm run screenshots -- final --langs=en,ru --sizes=1280x720,1920x1080
```

`npm run zip` uses a small Node script (`scripts/zip.mjs`, `node:zlib`), so packaging works on Windows
as well as macOS/Linux — no `zip` CLI needed. `npm run screenshots` starts a Vite server and drives
Chromium via `playwright-core` (set `CHROMIUM_PATH` if Playwright's browsers are not installed); the PNGs
land in `docs/screens/<set>/`.

`dist/` uses relative paths (`base: './'`), so it can be hosted from any sub-folder.

## Controls

| Input | Action |
|-------|--------|
| WASD / arrow keys / screen edge | Scroll camera |
| Middle-mouse drag | Pan |
| Mouse wheel | Zoom (0.5×–2×) |
| Left click / drag box | Select squad(s) or building · **Shift** adds/removes |
| Right click | Move · attack enemy under cursor · set rally point (production building) |
| **B** | Select Command Bastion (opens build menu) · **1–6** pick a building |
| **R** | Reinforce selected squads |
| **M** / **G** | Move / attack-move mode |
| **H** | Hold position (soldiers seek nearby cover) |
| **X** | Stop |
| **Q** | Select whole army |
| **Space** | Centre camera on selection |
| **Esc** / right click | Cancel placement or order mode |
| **P** / F10 | Pause menu |

The HUD command grid (bottom right) mirrors the hotkeys; hover a button for its tooltip (cost, time,
requirements). The cursor changes with context: move, attack (over a visible enemy), capture (over a
Void-Nexus you don't own) and build (while placing).

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

Two factions: **Iron Void** (human militarists, playable) vs **Null Horde** (alien swarm, AI).

- **Resources** — *Scrip* from held Void-Nexus points (+25/s each) and *Flux* from Flux Conduits (+10/s each).
- **Base building** — seven Iron Void structures on a 4-tile grid, placed within range of existing buildings; they construct over time, can be destroyed, and leave rubble that serves as cover.
- **Squads** — Void Riflemen, Iron Guard and the Void Commander hero; formation movement with A* pathing, auto-targeting, projectiles, reinforcement.
- **Research** — the Void Foundry unlocks damage, HP, turret, construction-speed and squad-cap upgrades.
- **Void-Nexus capture points** — 5 per map; fill the bar with squads in the zone, contested by enemies.
- **Cover & line of sight** — ruins and cliff edges halve damage; cliffs block projectiles.
- **Fog of war** — unexplored, explored and visible areas.
- **AI** — builds, raids on a timer, expands to free points, defends its Hive and rushes when winning. Easy / Normal / Hard.
- **Blood and fire** — directional blood sprays, gibs and lasting pools, building explosions that leave burning ruins.
- **Campaign** — ten hex territories on a planet map; each conquest grants a permanent bonus and a choice of one of three upgrade cards. Take the Iron Void Throne to win.
- **Audio** — all sound effects, ambience and music are synthesised with the Web Audio API.

## Project Layout

```
src/
  main.ts, config.ts (all tuning numbers), events.ts, types.ts
  scenes/     Boot, Preload (loading bar), Menu, Campaign, Battle, Hud, Settings, Subtitle
  maps/       MapBuilder + three point-symmetric battle maps
  systems/    Map, Camera, Resource, Selection, Input, Pathfinder, Production, Research,
              CapturePoint, FogOfWar, Cover, Audio, Ambience, Music, Voice, Settings
  buildings/  BuildingDefs, Building, BuildingView, BuildingSystem, BuildingPlacementUI
  units/      UnitDefs, Unit, Squad, UnitSystem, CombatSystem
  ai/         AIController, AIBuilder
  effects/    Blood, Explosion, Light, Projectile, Corpse systems (EffectsSystem ties them together)
  render/     Projection, terrain chunks & textures, props, culling, atmosphere, planet art,
              puppet/ (3D unit puppets → sprite atlases), buildings/ (oblique building painters)
  i18n/       t(), plural rules, en.ts, ru.ts
  campaign/   CampaignData, CampaignState (localStorage), UpgradeCards
  ui/         HUD frame, TopBar, SelectionPanel, CommandGrid, Tooltip, MiniMap, EndScreen, PauseMenu, …
  assets/     procedural texture and cursor generators
scripts/preview-maps.ts   ASCII map preview + connectivity check (npm run preview-maps)
scripts/screenshots.ts    reference screenshots into docs/screens/
scripts/check-i18n.ts     translation completeness check
scripts/zip.mjs           cross-platform packaging
docs/screens/             before / after-g7 / final screenshots
```

See [TASK.md](TASK.md) for the original specification and [GRAPHICS_TASK.md](GRAPHICS_TASK.md) for the graphics overhaul.
