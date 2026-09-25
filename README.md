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
npm run zip        # build and package dist/ as voidcrusade.zip (e.g. for Yandex Games; needs the `zip` CLI)
```

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
- **Blood and fire** — per-death blood particles with permanent decals, building explosions with screen shake.
- **Campaign** — ten hex territories on a planet map; each conquest grants a permanent bonus and a choice of one of three upgrade cards. Take the Iron Void Throne to win.
- **Audio** — all sound effects and ambience are synthesised with the Web Audio API.

## Project Layout

```
src/
  main.ts, config.ts (all tuning numbers), events.ts, types.ts
  scenes/     Boot, Preload (loading bar), Menu, Campaign, Battle, Hud, Settings
  maps/       MapBuilder + three point-symmetric battle maps
  systems/    Map, Camera, Resource, Selection, Input, Pathfinder, Production, Research,
              CapturePoint, FogOfWar, Cover, Audio, Ambience, Settings
  buildings/  BuildingDefs, Building, BuildingSystem, BuildingPlacementUI
  units/      UnitDefs, Unit, Squad, UnitSystem, CombatSystem
  ai/         AIController, AIBuilder
  effects/    BloodEffect, ExplosionEffect, EffectsSystem
  campaign/   CampaignData, CampaignState (localStorage), UpgradeCards
  ui/         TopBar, SelectionPanel, BuildToolbar, MiniMap, EndScreen, PauseMenu, …
  assets/     procedural texture and cursor generators
scripts/preview-maps.ts   ASCII map preview + connectivity check (npm run preview-maps)
```

See [TASK.md](TASK.md) for the original specification.
