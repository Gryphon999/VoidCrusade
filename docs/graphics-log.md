# Graphics log (AAA pass)

One entry per phase: what changed, before/after screenshots in `docs/screens/aaa/`, and an
honest critique of what is still weak.

## A0: technology spike

- Built the same test scene in Phaser Light2D and in Three.js; decision and numbers are in
  [graphics-decision.md](graphics-decision.md). Chosen: hybrid (Three.js battlefield, Phaser HUD).
- Screens: `a0-phaser.jpg`, `a0-three.jpg`.

**Self-critique.** The 3D spike proves the technology, not the art. The Bastion is a stack of
untextured primitives and reads as a white placeholder. The ground is blocky per-vertex colour
with a noise detail map that looks like carpet. The cliffs are soft lumps with no rock faces.
The units are tiny at this zoom and their capsule limbs look like toys. The lighting is too
orange and flat outside the point lights. None of this is acceptable as final; A2–A5 exist to
fix it. What *is* already better than the 2D game: contact shadows and cast shadows from
every object, real light falloff, and specular on armour.

## A1: renderer architecture

- `src/render3d/`: `Stage3D` (the WebGL2 canvas under Phaser's transparent canvas, matched to
  its rectangle at native resolution: devicePixelRatio capped per tier × resolution scale),
  `Battle3D` (the battlefield renderer), `Terrain3D`, `Units3D`, `ModelMesh`, `FpsOverlay`,
  `hide2D`, and the `BattleRenderer` contract.
- **Camera.** An orthographic camera tilted so its projection equals the 2D oblique view.
  `CameraSystem` still owns scroll and zoom, so picking, the minimap, the fog and every 2D overlay
  (bars, rings, markers, tutorial arrows) stay pixel-aligned with the 3D scene without being
  rewritten.
- **Simulation independence.** Battle3D only reads state (units' animation, frame, facing,
  lift, visibility; the map). Gameplay objects keep their 2D sprites for frames and hit tests;
  in 3D mode those sprites are hidden from the battle camera (`hide2D`).
- **Quality infrastructure.** Tiers Low/Medium/High/Ultra (`GFX3D`: shadows, shadow-map size,
  bloom, antialiasing, DPR cap, model detail); a Graphics panel in Settings (renderer
  Auto/3D/Classic 2D, 3D resolution scale, FPS counter, adaptive quality); the tier drops
  automatically after 6 s under 40 FPS; the renderer falls back to 2D when WebGL2 is missing or
  context creation fails.
- **Assets** are generated at load (terrain albedo from the biome's seamless textures, unit
  geometry from the procedural models). There is nothing to bake yet; `npm run bake` arrives
  with the first baked asset (colour-grading LUTs in A5).
- Verified: skirmish on every map, Classic 2D still works, and the whole tutorial completes with
  real mouse and keyboard input under the 3D renderer. The tutorial fix found here: the retreat
  lesson's raiders now withdraw, because in one run they razed the barracks.
- Screen: `a1-fight.jpg`.

**Self-critique.**
- **Split scene.** Buildings, props, capture pylons, wrecks and corpses are still 2D sprites
  drawn *over* the 3D layer. A soldier in front of a building is hidden by the sprite, and the
  sprite buildings have no 3D shadows.
- **Units.** Too small and too dark at the default zoom. Their colours were tuned for flat
  sprites, and the capsule limbs look like toys up close. Animation still steps through the
  baked frames instead of blending poses.
- **Terrain.** It reads as a texture on a height field, not as rock. Cliff walls are stretched,
  there are no normal maps, and roads are flat patches with no edges.
- **Lighting.** Exposure and the sun are not tuned, and there is no colour grading yet.
- **Performance** can only be judged relatively here: under the software GPU the tutorial had
  to run on Low to keep input responsive.

## A2: terrain and environment

- **Terrain shader** (`Terrain3D`, standard PBR + `onBeforeCompile`):
  - world-space detail grain at two scales and a derivative-based bump, so the ground holds up
    close;
  - triplanar layered rock on steep faces and on plateaus, instead of a top texture stretched
    down the walls;
  - a macro tint so wide views vary.
- **Shapes:** cliffs are 105 px rock blocks with noise-displaced, organic outlines (within about
  0.2 tile of the gameplay boundary), rough tops and lower shelves. The ground rolls, roads are
  flat, and 26 shell craters (dents with raised lips and scorched floors) sit on open ground.
- **Outlands:** an 8-tile ring of mountains around every map, so the view never shows a void.
- **Materials** (`Materials3D`): a tileable detail map, layered rock with strata and fractures,
  and road plating as staggered plates with seams, bolt heads, rust streaks and scratches.
  Roads and rubble get ragged, eroded edges.
- **Props in 3D** (`Kit`, `Props3D`): the 2D prop scatter (same positions) is now kit-bashed
  models, instanced with shadows. Dead gnarled trees, skull totems, tattered standards, burnt tank
  wrecks, rock clusters, ruined gothic walls with pointed arches and buttresses, broken columns,
  crate stacks, and fuel-barrel clusters that disappear when they explode.
- `Env3D`: boulders and scree at the foot of cliffs.
- **Atmosphere per map** (`Atmos`): Ashfall is a smoky dusk with a low orange sun and long
  shadows; Veyra a hazy desert noon with short shadows; Khorvan a cold moonlit night; the tutorial
  a softer dusk.
- **Fix:** the 2D culler was re-enabling sprites the 3D renderer had hidden (cliff occluders
  showed as floating grey slabs).
- Screens: `a2-map0-wide.jpg`, `a2-map1-wide.jpg`, `a2-map2-wide.jpg`, `a2-map0-close.jpg`.

**Self-critique.**
- **Materials:** the ground still looks like one printed texture, because the albedo is baked
  per map. The rubble layer's pebbles read as 2D dots, not 3D stones.
- **Rock:** cliff rock is convincing from above but monotone brown; it needs colour variation,
  darker cracks and lighter weathered rims.
- **Props:** plain and a bit small: flat single colours with no wear, no emissive details, no
  banners moving. Trees are thin sticks.
- **Environment gaps:** still missing are ground fog, ash drift, embers, dust (A5/A6), lava or
  acid pools in the outlands (A5/A6), and Horde biomass growth around their buildings (A4).
- **Night map:** Khorvan relies on fires and energy lights that do not exist yet (A5). Until
  then it is dim.
- **Mixed rendering:** buildings are still 2D sprites and look pasted onto the 3D ground. That
  is the most visible inconsistency now, so A4 comes next, together with A3 units.
