# Terrain tiles and new maps (stage A2) — design

Date: 2026-10-07. Follows the owner's choice "D: new tiles and biomes first, elevation later (A4)".

## Goal

Maps stop feeling alike: four new **gameplay** tiles with their own rules and looks, and three new
hand-made maps built around them. Every rule is data (`TERRAIN` in `config.ts`); systems read the
table, never the tile ids.

## Tiles

| tile | id | infantry | vehicles | speed | cover | line of sight | buildable | other |
|------|----|----------|----------|-------|-------|---------------|-----------|-------|
| Ground / Road / Ruins / Cliff | 0–3 | as today | as today | 1 | as today | as today | yes | — |
| **Water** (shallows) | 4 | wade | **no** | ×0.6 | none | clear | no | fords and bridges are the only vehicle crossings |
| **Lava** (magma field) | 5 | yes | yes | ×0.8 | none | clear | no | **8 % of max HP per second** to every unit on it; path cost ×6 so routes avoid it unless the shortcut is worth it |
| **Scrub** (fungal thicket) | 6 | yes | yes | ×0.8 | **cover** (like ruins) | **blocks** shots across it (not into or out of its own tile) | no | **conceals** squads inside: invisible to the enemy unless a detector is in range, an enemy stands within 110 px, or the squad fired in the last 1.5 s |
| **Ice** (frozen lake) | 7 | yes | yes | **×1.25** | **never** (cliff edges give no cover here) | clear | yes | open killing ground |

`TERRAIN: Record<TileType, { speed; vehicles; buildable; cover: 'none' | 'cover' | 'normal'; conceals; losBlock; damage; pathCost }>`.

## Systems

- `MapSystem`: `rule(tx, ty)`, `isVehicleTerrain`, `isBuildable`, `speedAt(wx, wy)`; `isTerrainPassable`
  stays "not a cliff" (infantry).
- `Pathfinder`: vehicle queries (`wide`) require `isVehicleTerrain`, in A* and in `hasLine` smoothing
  (`this.wide` set per query like `this.owner`); step cost × `pathCost` of the entered tile.
- `Squad.speedMult` × `map.speedAt(centre)`.
- `UnitSystem.update`: units on a damaging tile take `damage × maxHp × dt` (no attacker, no armour
  table); a hint toast the first time a player unit burns.
- `SupportSystem.detection` handles both burrowed and **concealed** squads (`Squad.concealed`: centre tile
  conceals and `lastShotAt` older than 1.5 s). `Squad.hiddenFrom` returns true for a concealed, undetected
  squad. `CombatSystem` stamps `lastShotAt` when a unit fires.
- `CoverSystem`: rebuild uses the table (`cover`/`normal`/`none`); `blockPoint` stops at `losBlock` tiles.
- `BuildingSystem.validate` uses `isBuildable`. Props: none on water/lava/ice, dense trees on scrub.
  Decals: none on water/lava/ice.

## Looks

- 2D painter: a seamless texture per new tile (`TerrainTextures`: water, lava, scrub, ice), painted with
  the same ragged-edge `surface()` as roads; water and ice get a soft highlight, lava a glow.
- 3D terrain: the height field dips on water (−14 px) and lava (−6 px). A second mask texture
  (R water, G lava, B scrub, A ice) feeds the shader: water = biome water colour, wet roughness;
  lava = dark crust with full emissive glow; scrub = biome scrub colour with heavier relief; ice = pale
  biome ice colour, low roughness. Biomes gain optional `water`, `scrub`, `ice` colours and minimap
  entries for the four tiles (defaults in `Biomes.ts`).
- Minimap: four new palette entries.

## Maps

| id | name | size | points | built around |
|----|------|------|--------|--------------|
| delta | Sunken Delta | 112×84 | 11 | two river arms (water) crossed by fords and plated bridges; vehicles funnel through four crossings, infantry wade |
| ignis | Ignis Flats | 96×72 | 9 | lava rivers and lakes between obsidian spires; infantry can cut across at a price, vehicles must go round |
| frost | Frostmark | 112×84 | 11 | a frozen lake in the middle (fast, no cover) ringed by fungal thickets (concealment) and rock |

Each has an `Atmos` preset, a `Grade` (LUT baked by `npm run bake`), a biome, English and Russian
names, and passes the existing map tests (symmetry, open bases, infantry **and vehicle** reachability,
which now proves the fords exist).

## Testing

- `tests/terrain.test.ts`: the table covers every tile; water blocks vehicles but not infantry in the
  pathfinder; lava is avoided when a detour exists; speed and buildability lookups.
- `tests/maps.test.ts`: eight maps; vehicle reachability on the new ones.
- Headless screenshots of each new map (2D and 3D) checked by eye before the PR.

## Out of scope

Elevation (A4), mission objectives (A3), campaign use of the new maps, random generation.
