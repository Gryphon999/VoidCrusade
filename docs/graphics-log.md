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

## A6 — Visual effects

**Done.**
- **GPU particles in 3D** (`Fx3D`): two ring-buffered instanced pools (additive glow and lit
  soft). Motion is analytic in the vertex shader (drag, gravity, ground stop), so there is no
  per-particle CPU work. Sparks and tracers stretch along their screen-space velocity; smoke
  is noise-shaped and lit from above by the map's sun and sky mix.
- **Placement:** every 2D effect call (view-space point) is ray-cast onto the 3D terrain, so
  effects appear exactly where the 2D effects did. They now have depth: buildings occlude
  them, smoke really rises, and debris falls and stops on the ground.
- **Explosions:** white-hot core, fireball, sparks, bouncing debris, a smoke burst and a slow
  second smoke column. Shell blasts are a smaller version. Burning ruins emit flames and smoke
  from the 3D rubble.
- **Projectiles:** each shot is a 3D streak along a 3D chord. The view projection is linear,
  so the chord lands exactly on the 2D path and gameplay timing is untouched. Trails per
  weapon: shell smoke, rocket flame plus smoke, acid droplets, flame licks, the sniper's white
  line, psy motes. Acid, flame and psy shots splash on arrival.
- **Muzzle flashes:** coloured per weapon at the real gun height, together with the point
  lights from A5. Exhaust, welding sparks, shield hits and dust are also in 3D.
- **Ground decals in 3D** (`Decals3D`): blood pools, scorch marks and tread marks reuse the
  baked 2D decal textures but lie on the terrain under units, buildings and rubble. Before,
  they were drawn over them, and a scorch mark hid the 3D ruin.
- **Ambient motes:** falling ash and rising embers on Ashfall, drifting dust on Veyra, cold
  specks on Khorvan.
- Screens: `a6-fight.jpg`, `a6-explosion.jpg`.

**Self-critique.**
- **Explosions:** they read as soft blobs. No flipbook fire texture, no heat distortion, no
  ground shockwave ring in 3D (the 2D one was removed because it drew over models).
- **Blood and gore:** still the 2D particle emitters (mist, drops, chunks), drawn over
  everything and not depth-aware. They are small and short-lived, but noticeable on close
  zoom.
- **Ability effects:** smoke clouds, acid clouds, shield domes and target markers are still
  2D overlays. They are acceptable because they are ground-hugging UI-like effects.
- **Ground haze:** the A5 haze makes close-ups look a little dirty. Its density should fall
  off with camera zoom.

## A5+ — Fog of war restyle

- The fog of war is now a post effect in the 3D pipeline, where before it was a 2D overlay drawn
  over the 3D image.
- **How it works:** world positions are rebuilt from the depth buffer and looked up in the fog
  grid, with bilinear filtering plus a 4-tap blur.
- **Edges:** drifting smoke noise pushes the boundary in and out, so there are no hard cell edges.
- **Explored areas** turn cold and desaturated; unexplored ground sinks into dark smoke.
  Plateaus and building tops are fogged by their true position.
- **Anti-aliasing:** the scene now renders into a multisampled half-float target (4× MSAA on
  Medium and above). Before this, the post-processing chain had no anti-aliasing at all.

## A7 — Front end, HUD, portraits

**Done.**
- **Space3D** (menu and campaign map): a live 3D planet. Procedural continents, ash seas with a
  specular glint, glowing lava faults, night-side fires and hive lights, a drifting cloud layer,
  atmospheric scattering and an atmosphere rim. Behind it, a nebula sky with twinkling stars and a
  gothic warship group gliding past with lit ports and engine glow. The campaign hexes sit on the
  real rotating planet.
- **Portraits and previews** (`ModelSnap`): HUD portraits are studio renders of the real 3D models
  (key, fill and a faction-coloured rim light) with an idle animation strip, a backlight and
  scanline glass. Buildings show a slow turntable. The Encyclopedia shows the real models on a
  turntable: units walk in place while turning, buildings rotate.
- **HUD material:** the frame is lit steel, shaded per pixel from a height field (edge bevels,
  plate seams, scratches, hammered mottling, specular highlights). The panel wells are recessed
  dark glass with an inner shadow, a faint hex lattice and a cold glint.
- **Cinematics:** a battle fly-in (a high shot over the base swoops down) and a final shot that
  pushes in on the fallen stronghold. Both can be switched off with `cinematics: false`. The
  tutorial has no fly-in, because its first lesson is moving the camera.
- **Shader precompile** (`compileAsync`) so the opening shot does not hitch.
- Screens: see `final/` (A10).

**Self-critique.**
- **No UI scale slider:** the HUD is a fixed 1280×720 layout scaled to the window. A real
  UI-scale option needs anchored layouts, which were not done.
- **Menu:** the logo is still the 2D text treatment, and the menu has no music sync.
- **Campaign map:** the planet is live 3D, but the territory hexes and fleets on it are 2D.
  There are no animated borders and no fly-in transition into battle.
- **No new art:** no mission briefing art and no new loading-screen art. The loading screen
  keeps its progress bar and lore tips.

## A8 — Camera and feel

- **Scrolling** has inertia: it accelerates, then glides to a stop.
- **Zoom** is smoothed and eases toward the target while the point under the cursor stays put.
  Zoom set by scripts or focus-on-event is adopted instead of being fought.
- **Scripted camera moves** (`flyTo`, ease in-out) ignore player input while they play.
- **Not done:** a tilt that changes with zoom. The 2D overlay layer (bars, rings, picking) is
  built for one fixed oblique angle, so changing the 3D pitch would break alignment. Camera
  rotation is not done for the same reason.

## A10 — QA, comparison, honest verdict

**QA pass.**
- **Screenshots** (`npm run screenshots:aaa`, JPEG, `docs/screens/aaa/final/`, 22 files, 4.6 MB):
  - menu and battle HUD in EN and RU at 1280×720, 1920×1080 and 2560×1440;
  - the campaign map in both languages;
  - all three battle maps at the start;
  - a big fight;
  - both faction rosters and both building line-ups.
- **Tutorial:** played end to end in 3D with real mouse and keyboard input, all 13 steps to
  victory.
- **Checks:** `npm test`, `npm run check:i18n` and `npm run build` pass. `npm run bake` is
  deterministic (byte-identical LUTs on every run).
- **Bug found by QA:** the 3D battle renderer was never disposed when a battle ended. Phaser reuses
  the scene object on "play again" and for the next campaign battle, so the old renderer kept
  drawing its stale world over the new one and cost an extra frame. It is now disposed on scene
  shutdown, and its props listener is unhooked.
- **Also found:** the screenshot tool left an orphaned dev server behind. Because it had no file
  watcher, it served stale modules to later runs. The tool now stops its whole process tree.

**Verdict against the goal ("looks like a different, much more expensive game").**
- **Mostly achieved on the battlefield:**
  - real 3D terrain with cliffs, real shadows and per-map time of day;
  - dynamic lights, colour grading and a fog of war that breathes;
  - 3D effects with depth;
  - construction, destruction and turrets that are alive.
- **Mostly achieved on the front end:** the live 3D planet in the menu and on the campaign map.
- Side by side with the 2D version (Settings → Graphics… → Renderer → Classic 2D), the difference
  is obvious.
- **Not yet at the level of the reference games:** model quality. Units and several Iron Void
  buildings are primitive kit-bashes.

**Remaining weaknesses, ranked by what would improve quality most next.**
1. **Unit models.** They are still the 64-px puppet designs as 3D primitives. Sculpted
   pauldrons, backpacks, weapons and Horde carapace ridges would be the biggest single gain,
   along with blended animation instead of 6–8 stepped frames.
2. **Iron Void roofs and silhouettes.** Mid-size buildings (workshop, armoury, depot, research)
   have flat, bright roofs that read as boxes from the RTS camera. They need layered gothic
   roofs, buttresses, pipes, vents and antennas.
3. **Horde biomass.** The creep under Horde structures is still the 2D overlay. It needs 3D
   creep with tendrils, and liquid shading (ripples, fresnel) on the acid and void pools, which
   are flat discs.
4. **Explosions.** They need flipbook fire and smoke textures, a ground shockwave ring in 3D,
   and heat distortion.
5. **Ambient occlusion.** GTAO on High and Ultra, if the real-GPU budget allows.
6. **Blood and gore.** The mist, drops and chunks are still 2D particles over the 3D scene.
7. **UI.** A UI-scale slider (needs anchored HUD layouts), animated campaign borders and fleets,
   and a fly-in transition from the campaign map into battle.
8. **Performance.** Measure on real hardware. Instance static buildings, which are 2–3 draw
   calls each.
