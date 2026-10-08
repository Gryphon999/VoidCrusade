# Elevation (stage A4) — design

Date: 2026-10-07. The owner chose "high ground as a mechanic: plateaus and lowlands with ramps; from
above you see and shoot further, from below you cannot see up, a ramp is a bottleneck".

## Goal

Two ground levels. A map may raise regions to **high ground** (level 1); everything else is low
ground (level 0). The only way between levels is a **ramp** tile. High ground sees and shoots further;
low ground cannot see what stands on high ground. The rules are small and pure
(`src/battle/Elevation.ts`); systems read a tile's level from `MapSystem`.

## Rules

| rule | value |
|------|-------|
| sight of a unit on high ground | × 1.25 |
| weapon range of a squad on high ground | + 40 px |
| low ground sees a high-ground squad only within | 90 px (melee contact) |
| moving between levels | only through a ramp tile (both for infantry and vehicles); the pathfinder refuses any other level change, and so does straight-line smoothing |
| ramps | tile `RAMP` (8): plain ground that counts as high ground, not buildable |
| buildings | stand where built; a building on high ground reveals high ground |

**Visibility.** A squad on high ground is hidden from an enemy unless that enemy has a squad on high
ground (or a ramp) within its sight of it, a building on high ground within its vision of it, or any
squad within 90 px. This applies to the player's fog (units on low ground do not reveal high cells),
to the AI's `fogVisibleFor`, and to target acquisition (`Squad.hiddenFrom`).

## Data

- `MapDef.levels?: number[][]` (0/1), built by `MapBuilder.raise(rect | ellipse)` and `ramp(rect)`;
  `mirror()` mirrors levels too. `MapSystem.level(tx, ty)`, `levelAt(wx, wy)`, `isRamp`, `canStep(a, b)`.
- `Squad.level` is the level under its centre.

## Looks

- 3D: the height field adds `PLATEAU_3D` = 56 px × a sharpened level field (walls as steep as cliff
  blocks; a ramp tile is 0.5 so the slope lies on the ramp). Units, buildings, props and effects already
  sample `heightAt`, so they ride up.
- 2D: high tiles get a light wash and a dark rim on the low side; ramps get hatching.
- Minimap: high ground lighter.

## Maps

Plateaus and ramps are added to four existing maps so they play differently: Ashfall Ridge (the two
ridges become overlooks with ramps), Veyra Wastes (mesas), Khorvan Deep (canyon rims), Frostmark (a
raised shelf over the lake). Every ramp is at least two tiles wide so vehicles pass. The map tests
still prove every point and the enemy stronghold are reachable on foot and by vehicle.

## Testing

`tests/terrain.test.ts` gains: level change blocked without a ramp, allowed through one, vehicles
need a two-wide ramp; `src/battle/Elevation.ts` pure checks (sight, range, low-sees-high rule).
`tests/maps.test.ts`: levels grid matches the map size, symmetric, ramps border both levels.
Headless screenshot of a plateau in 3D checked by eye.

## Out of scope

More than two levels, cliffs that are climbable, artillery arcs, campaign changes.
