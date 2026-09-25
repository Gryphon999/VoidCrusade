# VoidCrusade

A real-time strategy web game inspired by Warhammer 40,000: Dark Crusade.

> **Different name, same savage soul.** Two factions clash on a war-torn planet — build your base, raise your armies, capture the void-nexus points, and crush the enemy stronghold.

## Tech Stack

- **Phaser 3** (game engine, 2D top-down)
- **TypeScript** (type safety)
- **Vite** (bundler + dev server)

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`

## Build

```bash
npm run build
```

Output in `/dist`

## Game Overview

Two factions: **Iron Void** (human militarists) vs **Null Horde** (alien swarm)

### Core Loop
1. Capture Void-Nexus points to gain resources
2. Build and expand your base
3. Train squads and upgrade them
4. Destroy the enemy Stronghold

### Mechanics
- Base building with tech tree
- Squad reinforcement system
- Two resources: **Scrip** (command points) and **Flux** (energy)
- Fog of war
- Blood particle effects on unit death
- Cover system (units behind obstacles take less damage)
- Commander hero unit
- AI opponent with three difficulty levels
- Campaign map with territory conquest (Dark Crusade style)

## Factions

### Iron Void (playable)
Heavy armor, mechanized infantry, turret emplacements

### Null Horde (enemy AI)
Zerg-like swarm: fast but fragile units, regenerating structures

## Project Status

Built by cloud Claude Code agent — see [TASK.md](TASK.md) for the full specification.
