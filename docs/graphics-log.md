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

## A4 — Buildings

**Done.**
- **Models** (`BuildingModels`): all 36 structures, kit-bashed from primitives.
  - Iron Void (gothic-industrial ferrocrete, dark steel, gold trim, blue team banners, lit
    slit windows): corner-towered keep, flux conduit with glowing coil rings, pitched-roof
    barracks, crane workshop, chimneyed foundry, turrets and more.
  - Null Horde (chitin plates, bone spikes, wet flesh, violet veins, acid orifices): mounds,
    brood pods, maws ringed with teeth, spore stalks, pools.
- **Surface shader** (`surfaceMaterial`, shared with props and ruins): model-space panel seams
  with per-panel tone variation, rain streaks on vertical faces, grime, wet mottled skin with
  glossy ridges for the Horde, a micro bump, and contact darkening at the base.
- **Construction:**
  - Iron Void buildings rise inside a steel scaffolding cage (poles, rails, walk boards,
    braces); a clipping plane sweeps up with a flickering welding seam, and the cut shell
    renders double-sided.
  - Horde buildings swell out of the ground from a small pulsing bud.
- **Damage:** below 60 % health the structure darkens towards scorched. Below 30 % its lights
  flicker. The 2D smoke and fire effects stay on top.
- **Turrets:** guns track their target in 3D; the view records the aim yaw.
- **Gates:** blast-gate leaves slide up like a shutter when friendly troops come near.
- **Destruction:** the building tilts, slumps and sinks for about 1.2 s. Rubble then takes its
  place as a 3D heap: slabs, bent beams and charred rocks, or burst chitin and bones. Stripped
  ruins flatten.
- Health bars, the selection ring, picking and fog are unchanged and stay 2D. Building heights
  match the 2D sprites, so every overlay stays aligned.
- Screens: `a4-iv-close.jpg`, `a4-iv-construction.jpg`, `a4-horde.jpg`.

**Self-critique.**
- **Silhouettes:** too primitive. From the high camera, roofs dominate and many roofs are
  flat boxes. The keep reads well, but mid-size Iron Void buildings (depot, workshop,
  research) look like cardboard blocks with details. They need layered roofs, buttresses,
  pipes, vents and antenna clutter.
- **Horde:** the structures read as blobby spheres. They need tendrils, ribbing and biomass
  creep under them; the creep is still the 2D overlay.
- **Pools:** acid and void pools are flat emissive discs. They need a liquid shader with
  ripples and a fresnel rim (A5/A6).
- **Seams:** the panel seam grid is uniform and CG-looking on large walls. It should vary
  its scale per part.
- **No interior light spill:** windows glow, but nothing lights the ground in front of them.
  Point lights come in A5.
- **Leftover 2D effects:** smoke, sparks and ruin fires are still the 2D particle effects.
  They float slightly off the 3D volumes (A6).

## A3 — Units, bodies and map fixtures

**Done.**
- **Units** are instanced 3D figures built from the procedural puppet models: one batch per
  (type, animation, frame), so the 3D animation matches the 2D atlases frame for frame.
  - Materials split by faction: Iron Void ceramite and steel with fine plate seams, the Horde
    wet chitin with glossy mottling.
  - Self-lit parts (visors, lenses, bio-lamps) now glow at about half the A1 strength. Squads
    no longer drown in their own halo.
- **Bodies:** the death animation plays in 3D. Settled bodies turn into dusty husks and sink
  into the ground as they fade. Vehicle wrecks are the vehicle's own model, burnt, and stay
  until salvaged or expired.
- **Capture points** are 3D Void-Nexus obelisks: stepped plinth, gold bands, buttresses and
  rune strips in the holder's colour. Each has a standard that sways; relics and forward bases
  get a spinning emblem.
- **Derelict turrets** are rusted 3D hulks with a toppled barrel until engineers claim them.
- Screens: `a3-units-close.jpg`, `a3-units-mid.jpg`.

**Self-critique.**
- **Silhouettes:** still the weak point. The puppet models were designed for 64-px sprites:
  helmets are balls and limbs are capsules. At the default zoom they read fine, but close up
  they look like toys, not AAA miniatures. Real sculpted pauldrons, backpacks, weapon detail
  and Horde carapace ridges are the next big step for units.
- **Animation:** discrete 6–8 frame cycles, identical in 3D and 2D, with no blending. Walk
  cycles step visibly when zoomed in.
- **2D combat effects dominate:** at close zoom the 2D combat particles (blood mist, spit,
  sparks) are the busiest thing on screen and are not depth-aware. A6 replaces them.
- **Team colour:** it is only on helmets and shoulders, which is too little at a distance.
- The obelisk is thin for its height.

## A5 — Lighting, atmosphere and grading

**Done.**
- **Dynamic point lights** (`Lights3D`): a fixed pool sized by the tier (4/8/12/16 lights).
  Each frame the pool goes to the strongest sources in view: muzzle flashes, explosions and
  burning ruins (bridged from the 2D `LightSystem`, whose additive sprites are hidden in 3D),
  light spilling from building windows, cores and orifices (cyan for power, warm amber for
  Iron Void, violet for the Horde), and capture obelisk runes. Damaged buildings' lights
  flicker. Unused lights stay in the scene at zero intensity, so the light count never changes
  and shaders never recompile mid-battle.
- **Colour grading:** `npm run bake` (`scripts/bake.ts`) turns per-map grade recipes
  (`Grades.ts`: saturation, split toning, S-curve, lift/gain) into 16³ LUT strips
  (`src/assets/baked/lut-*.png`, about 12 KB each, byte-identical on every run). A `LUTPass`
  applies them after tone mapping.
  - Ashfall: teal shadows, amber highlights.
  - Veyra: bleached warm dust with milky blacks.
  - Khorvan: blue moonlit shadows.
- **Lens finish:** a soft vignette and fine animated film grain, set per map.
- **Ground haze** (`Fog3D`): two slow-drifting noise layers just above the ground. Lowlands sit
  in the murk while plateaus and buildings rise out of it: smoky brown on Ashfall, dust on
  Veyra, cold mist on Khorvan.
- **Shadows:** a PCF shadow map follows the view (1K/2K/2K/4K by tier), with the sun direction
  and colour set per map.
- Screens: `a5-ashfall-dusk.jpg`, `a5-veyra-noon.jpg`, `a5-khorvan-night.jpg`.

**Self-critique.**
- **No ambient occlusion:** contact darkening is baked into the surface shader only. GTAO on
  Ultra is the obvious next step if the budget allows (A9 measures it).
- **No shadows from point lights:** fires do not cast flickering shadows, which would be too
  expensive on the target GPU.
- **Flat haze:** the haze is a flat layer. It does not pool in craters or roll around
  obstacles, and no light shafts cut through it.
- **Night readability:** on Khorvan the enemy is hard to spot outside lit areas. The haze may
  need to thin near the player's units.
- **Pale grading on Veyra:** the image is washed out and would benefit from a touch more local
  contrast.
