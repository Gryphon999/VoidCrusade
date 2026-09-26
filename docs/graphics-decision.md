# A0: Rendering technology decision

**Decision: option 3, hybrid.** The battlefield (terrain, units, buildings, lights, shadows,
effects, post-processing) moves to real 3D with **Three.js**. The simulation stays exactly as
it is, and Phaser keeps the HUD, menus, campaign screen, tutorial overlay and Encyclopedia,
drawn over a transparent canvas above the 3D view.

## What was compared

The same scene was built twice, from the same map data and the same procedural unit models:
terrain from map 1 with its cliffs, 100 walking units across six unit types, the Command
Bastion, a repeating explosion, three coloured point lights and a sun.

| | Option 1: Phaser 2D + Light2D + normal maps | Options 2/3: Three.js 3D |
|---|---|---|
| Prototype | `spike/phaser.html` | `spike/three.html` |
| Units | Existing sprite atlases; normal maps generated from sprite luminance (Sobel) | The **same procedural models**, converted from sprite parts to real geometry (`src/render3d/ModelMesh.ts`), instanced per unit type and walk frame |
| Shadows | None cast; painted blob ellipses | Real directional shadow map: every unit, building and cliff casts shadows on terrain and on other units |
| Lights | Per-pixel lights against fake normals; everything looks embossed | Physically-based lights against real surfaces; specular on metal; light falloff over real height |
| Terrain | Flat image | Height field (cliffs raised by 90 px) with lit slopes |
| Post | None | Bloom + ACES filmic tone mapping |
| Camera | Fixed 2D squash | Real perspective; tilt, zoom and rotation are free |
| **FPS on this machine** | **16.3** | **3.0** (5.3 without shadows and bloom, 5.7 at half resolution) |
| JS cost per frame | ≈ 2 ms | 4.6 ms at 100 units, 7.4 ms at 300 units |
| Draw calls / triangles | ≈ 110 / tiny | ≈ 150 / 430 k (100 units); 1.2 M at 300 units |
| Added bundle | 0 | ≈ 190 KB gzipped (three + post-processing) |

Screenshots: [`docs/screens/aaa/a0-phaser.jpg`](screens/aaa/a0-phaser.jpg) and
[`docs/screens/aaa/a0-three.jpg`](screens/aaa/a0-three.jpg). For the current game, see
[`docs/screens/content/vehicles-en.jpg`](screens/content/vehicles-en.jpg).

## The measurement caveat

This machine has **no GPU**. It is a 4-core Intel Xeon at 2.1 GHz, and headless Chromium
renders WebGL 2.0 through **SwiftShader**, a CPU software rasteriser. SwiftShader is typically two
to three orders of magnitude slower than any real GPU for fragment work. For comparison, the
current 2D game runs at 5.4–5.7 FPS here with 160 units, a scene that real players have run at
60 FPS. So only the **ratios** above mean something:

- Full 3D (shadows, bloom, antialiasing) costs about **1.8×** the current 2D game's frame time
  here; 3D without shadows and bloom costs the same as the current game.
- The JavaScript side (instancing updates, culling) stays under 5 ms for 100 units and scales
  linearly. At 1.2 M triangles (300 units) the models need level-of-detail work, planned in A9.

For the target hardware (Radeon 860M-class integrated graphics, 1080p, Medium), the prototype's
load is modest by modern standards: about 150 draw calls, under 0.5 M triangles, one 2048² shadow
map and a half-resolution bloom. It should reach the 45 FPS budget. **That is an estimate that
could not be verified here.** The plan protects it anyway:

- quality tiers (shadow map 1024 → 4096, bloom and other post effects off on Low, antialiasing
  on or off);
- a resolution-scale slider and adaptive quality that lowers the tier when FPS stays low;
- level of detail for models (fewer segments at distance), instancing everywhere, a hard cap on
  particle and light counts.

`docs/performance.md` (A9) will record the software-renderer numbers per tier, plus the
checklist for measuring on real hardware.

## Why 3D wins

1. **Real shadows and lighting** are the single biggest gap between the current look and
   Dawn of War III or Company of Heroes. 2D Light2D cannot cast shadows; faking them per sprite
   and per facing is a dead end.
2. **The models already exist in 3D.** The puppet rig that bakes the sprite atlases is made of
   boxes, capsules and spheres in 3D coordinates, so all 22 units carry over on the first day.
   A3 then upgrades them: more parts, materials, and animation from the hierarchy instead of baked
   frames.
3. **Camera freedom**: zoom with tilt change, cinematic fly-ins and victory shots (A7/A8) are
   natural in 3D and nearly impossible in the 2D squash.
4. **The cost is predictable**: Three.js is mature, tree-shakeable (≈ 190 KB gz) and WebGL2 with
   a WebGL1 fallback. The task's bias ("if 3D reaches the budget, choose 3D") applies.

## Why hybrid rather than full 3D

The simulation (units, combat, AI, pathfinding, fog, capture, tutorial) is independent of
drawing except in a few places: sprite handles on units and buildings, effects called from
gameplay code, and screen↔world conversion. Keeping Phaser for the HUD and screens preserves
everything built in C0–C8 (tutorial overlay, Encyclopedia, tooltips, RU/EN text layout, voice
subtitles). Only the battlefield layer is replaced, behind a `Renderer` interface (A1). The
2D battlefield stays as the **Low/compatibility renderer** for machines without WebGL2.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| FPS on integrated GPUs unverified here | Tiers, resolution scale, adaptive quality, LOD, instancing; FPS overlay so the owner can check on real hardware |
| Two canvases (3D below, Phaser HUD above) | Phaser game with `transparent: true` on top; input goes to Phaser and is forwarded to a single screen↔world mapper that raycasts the 3D camera |
| Gameplay code calls 2D effects directly | Effects become events or renderer calls; the 2D renderer keeps implementing them |
| Model detail vs triangle budget | Segment count per tier; merged geometry per pose; instancing |
| Tutorial and Encyclopedia previews reference 2D sprite keys | Previews rendered from 3D models into textures (A7); the 2D atlases stay available meanwhile |
