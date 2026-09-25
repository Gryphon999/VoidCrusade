# GRAPHICS_TASK.md — Visual, camera, audio & localization overhaul

Read `README.md` and `TASK.md` first. This file is a follow-up to the 15 finished phases.
Goal: make VoidCrusade *look, sound and feel* like **Warhammer 40,000: Dawn of War – Dark Crusade** (Relic, 2006),
add **Russian language** and **Russian voice-over**, and tilt the camera like the original.

Current state (see the owner's screenshot): flat top-down grey tiles, tiny blue-dot units, boxy building icons,
almost no lighting, sprites without shadows. It reads as a prototype, not as a grimdark RTS.

Work in phases G1..G11 below, in order. One commit per phase, push after each, run `npm run build` before each push.
Keep the game playable after every phase (no half-broken states on the branch).

---

## 0. Constraints and decisions

- Stack stays: Phaser 3 + TypeScript + Vite, client only.
- **Keep everything procedural** (Phaser Graphics / RenderTextures / Canvas 2D / Web Audio). No image or audio files.
  Exception, only if a phase says so: the browser's built-in `speechSynthesis` (not a file).
- Yandex Games target: small bundle, 60 FPS on a mid laptop / integrated GPU (AMD Radeon 860M class). Bake textures once at load,
  never redraw static art per frame. Add a "Graphics: Low / Medium / High" setting that turns post-effects and particle counts down.
- Keep the loading screen; it may take longer, but show progress and stay under ~10 s on a mid laptop.
- Do not change game rules or balance in this task. Visuals, camera, audio, UI, localization only.
- The camera decision (G1) is the biggest one. Do the **2.5D approach** described there. Do NOT rewrite the game in Three.js/Babylon.
  If you believe a true 3D engine is required, stop and write your reasoning in `docs/camera-decision.md` instead of starting it.

---

## 1. Reference: what Dark Crusade looks like (research summary)

Sources: Wikipedia, StrategyWiki, Dawn of War wiki, GameSpot and other reviews. Where a detail below is from general knowledge
rather than a source, it is marked "(approx.)".

**Camera and view.** Real-time 3D scene with a perspective camera looking down at the battlefield at a steep tilt
(approx. 55–65° pitch, not straight down). The player can zoom and rotate (limited). Units are 3D models that cast shadows.
Depth is readable: tall buildings and cliffs occlude what is behind them.

**Look and feel.** "Grimdark / gothic / industrial". Desaturated, dirty base palette (ash, rust, stone, dark metal)
with a few saturated accents: faction colors, glowing energy (blue/green/orange), fire and blood.
Warm firelight against cold ambient light. Every unit is always doing something: idle animations, weapon sway,
breathing, looking around; combat has recoil, muzzle flashes, tracers, debris, corpses that stay, blood decals.
Reviews single out unit animation and the amount of life on screen as the game's visual strength.

**Units.** Squads of several models (3–10) that move as a group; a squad has a shared HP/morale bar and members die one by one.
Heroes/commanders are larger and have unique wargear. Infantry, heavy infantry, vehicles (bigger, tracked/walkers).
Squad caps limit army size. Wargear upgrades change a hero's look.

**Factions in Dark Crusade (7).** Space Marines, Chaos, Eldar, Orks, Imperial Guard, Tau Empire (strong at range, weak in melee, allied Kroot),
Necrons (units cost only Power; units can reassemble and revive). Each has a clear silhouette and color language:
Marines = bulky blue/gold armor with heavy weapons; Chaos = spikes, red/black, horns; Eldar = sleek, curved, bright;
Orks = crude, scrap metal, green; Guard = brown/khaki, tanks; Tau = clean white/orange; Necrons = green energy, metallic skeletons.

**Our factions** keep their own lore (do not copy trademarks): **Iron Void** (human, armored, blue/steel + brass, gothic-military)
plays like Space Marines/Imperial Guard; **Null Horde** (alien swarm, purple/green/bone, chitin and glowing eyes) plays like Necrons/Tyranids.

**Economy and map (for visual/UI needs).** Requisition (from strategic points) and Power (generators). Strategic points have a flag/capture
ring and can be fortified with a listening post; critical locations are bigger. Campaign = turn-based world map of territories
(planet Kronus) + real-time battles, garrisons persist between battles. Our equivalents: Scrip, Flux, capture points, campaign map — already implemented.

**Sound and music.** Orchestral, heavy choir/chant, war drums, low brass, per-faction themes (e.g. an Ork theme, victory songs per faction),
calm exploration music vs. combat music. Weapons: heavy, punchy, layered (bolter chug, lasguns zap, explosions with low rumble).
Units talk: selection/confirm/attack acknowledgements, "under attack" alerts, base/point-captured announcements. (Composer credited on Wikipedia for Dark Crusade: Inon Zur.)

**UI.** Large HUD frame at the bottom of the screen: minimap on one corner, selected squad portrait/health/morale in the middle,
command buttons on the other side; resources at the top. Ornate gothic metal/parchment frames, gold trim, faction emblem, skull/aquila motifs.
The screenshot from the owner shows the current HUD: thin top bar, small minimap, no bottom panel.

---

## 2. Phases

### G1 — Camera tilt and projection (2.5D)
Make the battlefield look tilted like Dark Crusade using an **oblique / 3-quarter projection**, staying in Phaser 2D:
- Render the world with a vertical squash of about 0.62–0.70 (equivalent of ~55–60° pitch). Keep input, pathfinding, fog and selection in
  logical top-down world coordinates; add clean conversion helpers `worldToScreen` / `screenToWorld` in `CameraSystem` and use them everywhere
  (selection box, click orders, placement ghost, minimap click, fog of war, capture zones).
- Depth sorting: everything with height (units, buildings, cliffs, trees/props) sorts by its ground Y so that things in front cover things behind.
- Add a `height` (in px) to buildings and cliffs so they are drawn as extruded volumes: visible front face + lit top + darker side, and they
  occlude units behind them. Units behind an occluder show a faint silhouette outline (like DoW).
- Zoom stays; optionally allow a small tilt slider in Settings (0.55–0.8). Camera scroll/edge-scroll keep working.
- Acceptance: build from the screenshot state, select a squad and right-click move: the squad goes exactly where you clicked; box selection matches what you see;
  placing a building shows the ghost under the cursor; minimap click moves the camera to the right place.

### G2 — Terrain art
Replace the flat 4-tile set in `assets/TileTextures.ts` with a real tileset (still baked procedurally):
- 3–4 ground variants per biome (ash wasteland, dark rock, cracked plating, dirt), with noise-based shading (multi-octave value noise), cracks, pebbles,
  scorch marks, small craters, faint color variation; random flips/rotations to hide repetition.
- Auto-tiling / blending on tile edges (ground ↔ road, ground ↔ ruins) so borders are not a hard grid. **Hide the visible grid lines.**
- Cliffs: proper height (uses G1 extrusion) with rocky faces, highlights on top edges, deep contact shadow on the ground.
- Roads/metal plating with rivets, warning stripes, grates; ruins with broken walls, rubble piles, pillars, gothic arches.
- Scattered props (rocks, wrecked vehicles, bones, skulls on spikes, dead trees, banners) placed by the map generator, no gameplay effect except where cliffs already block.
- Out-of-map area: dark void with drifting dust/fog, not pure black.
- Acceptance: a screenshot of map 1 must show no obvious repeated tile pattern and no hard grid.

### G3 — Units and characters (biggest visual task)
Redo `assets/UnitTextures.ts` and `assets/HordeTextures.ts`. Make characters read like Dawn of War models from the tilted camera:
- Bigger models (infantry ≈ 28–36 px tall on screen at default zoom; heavy ≈ 44 px; vehicles/monsters 60–90 px; heroes larger and with a glow/aura).
- Layered procedural sprites: body, armor plates with highlights and shadows, shoulder pads, helmet with visor glow, weapon, banner/backpack.
  Faction color on armor trim; **team color** area so player vs. enemy is readable at a glance.
- **8 facing directions** (or 4 + mirror), pre-baked at load. Attack pose and death pose frames.
- Animation: idle (breathing/sway), walk cycle (4–6 frames, bob and leg/arm swing), attack (recoil, weapon flash), hit reaction, death (fall/collapse, then corpse stays as a decal; some units gib).
  "Every unit is always doing something": add randomised idle fidgets.
- Ground shadow under every unit (soft ellipse scaled by the projection); selection ring elliptical (in perspective), squad bracket and HP+morale bars styled like the HUD.
- Squads visibly move as formations (line/wedge) with individual small offsets; members die one at a time.
- Iron Void: bulky armored soldiers in blue/steel with brass trim, bolter-like rifles, heavy weapon troopers, a walking tank/walker, a hero with a huge sword or cannon.
- Null Horde: chitin crawlers, spitters, big brute, flying/leaping unit, a huge monster; purple/green glowing eyes and biomass, bone spikes.
- Acceptance: at default zoom the two factions are immediately distinguishable, unit types are readable by silhouette, and animations are smooth at 60 FPS with 100+ units.

### G4 — Buildings
Redo `assets/BuildingTextures.ts`:
- Real volumes (G1 height): stone/metal base, roof, towers, gothic details, banners, exhaust pipes with smoke, blinking lights, glowing energy cores.
- Construction animation: scaffolding that rises as HP/progress increases, sparks/welding flashes; destroyed buildings leave a burning ruin.
- Clearly different silhouettes per building type (command bastion, generators, barracks, turret, relay, foundry, listening post). Iron Void gothic-industrial, Null Horde organic hive structures.
- Capture points: tall pylon/banner with a glowing ring; capture ring color changes with owner; pulse effect on capture.
- Acceptance: the command building from the screenshot must look like a fortress, not a square icon.

### G5 — Lighting, atmosphere, post-processing
- Global "dusk" lighting with a warm key light direction (shadows all cast the same direction), cold ambient tint; vignette; subtle film grain (Low setting: off).
- Dynamic lights (Phaser Lights2D or cheap additive sprites) from muzzle flashes, explosions, burning ruins, energy cores, capture points. Limit light count for performance.
- Ambient particles: drifting ash/dust/embers, low ground fog layer, occasional lightning/glow in the sky on the menu.
- Bloom on emissive elements via Phaser postFX (`preFX/postFX` bloom/glow) with Low/Medium/High switch.
- Fog of war restyled: dark smoky edge, explored-but-not-visible area desaturated, not a hard black square.

### G6 — Combat effects and blood
Polish `effects/*` and `assets/FxTextures.ts`:
- Projectiles by weapon type (tracers, glowing bolts, plasma, acid spit, artillery arcs) with trails and impact sparks/dust.
- Muzzle flashes, shell casings, screen shake on big explosions (optional setting), shockwave rings, flying debris, scorch decals.
- Blood: layered splatter, arterial sprays on hits, persistent pools/decals (cap the decal count and fade the oldest), alien blood in other color for Null Horde.
- Corpses and wreckage stay for a while (cap and recycle).
- Acceptance: a 20 vs 20 fight is chaotic but readable; FPS stays ≥ 50 on Medium.

### G7 — HUD and menus (Dawn of War layout)
Rebuild `ui/*` with a gothic style:
- Bottom HUD frame across the screen: minimap bottom-left in an ornate frame, center = selected squad panel (portrait, unit list with HP/morale, upgrades),
  right = command grid (build/produce/research/abilities with icons and hotkeys, tooltips with cost/time). Top bar: Scrip, Flux, squad cap, timer — styled, with icons.
- Ornate frames: metal + parchment texture, gold trim, corner ornaments, skull/aquila-like emblem (original artwork, no trademarks), faction crest.
- Procedural icons for every unit, building, upgrade and ability (drawn with shapes, consistent style). Hover/pressed/disabled states, cooldown sweeps.
- Cursors: contextual (move, attack, capture, build) in the same gothic style.
- Main menu and campaign map: painted-looking planet with atmosphere glow, animated starfield, nicer buttons, hex territories with faction banners and battle markers.
- Notifications bar ("Point captured", "Under attack", "Squad lost") with icons.
- Acceptance: the screen no longer looks like a prototype; layout works at 1280×720 and 1920×1080.

### G8 — Localization: Russian + English
- Add a small i18n layer: `src/i18n/index.ts` with `t(key, params?)`, dictionaries `en.ts` and `ru.ts`, missing-key fallback to English, plural forms for Russian (1 отряд / 2 отряда / 5 отрядов).
- Move **every** user-visible string into dictionaries: menus, HUD, unit/building/upgrade names and descriptions, tooltips, campaign text and territory names, end screens, settings, notifications, loading tips, README-like help hints.
- Language auto-detect: Yandex Games SDK (`ysdk.environment.i18n.lang`) if present, else `navigator.language`; default ru for ru/uk/be/kk/uz etc., otherwise en. Manual switch in Settings, remembered in localStorage (wrap in try/catch).
- Fonts: make sure the gothic/serif fonts and fallback stacks render Cyrillic correctly (the current "blackletter if the system has one" font may lack Cyrillic — fall back to a serif for Russian text and keep the blackletter only for the logo and Latin text). Check that no text overflows buttons in Russian (it is longer than English).
- Russian text quality: natural military-fantasy tone, consistent terminology. Suggested glossary: Scrip — «Скрип», Flux — «Флюкс», squad — «отряд», capture point — «точка захвата», Iron Void — «Железная Пустота», Null Horde — «Орда Ничто» (owner may rename), campaign — «кампания», skirmish — «схватка», reinforcements — «подкрепление», pause — «пауза».
- Acceptance: switching language changes the whole UI immediately without reload; no English strings remain in Russian mode (add a dev check that lists keys used in code but missing from `ru.ts`).

### G9 — Russian voice-over (озвучка)
No audio files. Use the browser `speechSynthesis` API (built-in voices, `lang: 'ru-RU'`) and shape it to sound military/gritty:
- `src/systems/VoiceSystem.ts`: picks the best available `ru-RU` voice (prefer a male voice if present; cache the choice), sets rate/pitch per faction/unit type
  (low pitch and slower rate for Iron Void heroes; higher/odd pitch for Null Horde speakers where they speak at all), queues lines with priority so alerts are not spammed
  (per-category cooldowns), never overlaps more than one line, and cancels lower-priority lines.
- Optional "radio" effect: if the voice can be routed through Web Audio (it usually cannot in browsers), apply a light distortion/filter; otherwise skip — do not fake it with hacks.
- Lines (Russian) for at least: unit selected (per unit type, 3 variants), move/attack/capture confirmations, "отряд уничтожен", "нас атакуют", "точка захвата под контролем", "точка потеряна",
  "строительство завершено", "недостаточно ресурсов", "достигнут лимит отрядов", "подкрепление прибыло", battle start, victory, defeat, campaign territory captured. English variants for English mode (`lang: 'en-US'`).
- Settings: voice volume slider, on/off toggle, "voice test" button, a note when no Russian voice is installed (then fall back to subtitles).
- Subtitles for important lines (always available; on by default when no voice exists).
- Robustness: `speechSynthesis` voices load asynchronously (`voiceschanged`); handle browsers with no voices; Yandex Browser / Chrome / Edge should work; pause voice when the game is paused/blurred.
- Note for the owner in `docs/voice.md`: quality depends on voices installed in the OS/browser; if better quality is wanted later, pre-generated audio files can be added as an optional pack (would break the "no assets" rule and grow the bundle, so it is not part of this task).

### G10 — Music and sound design
Improve `systems/AudioSystem.ts` and `systems/Ambience.ts` (Web Audio, procedural):
- Music: layered orchestral-style score built from synth pads, low brass-like saws, choir-like formants (filtered noise + detuned oscillators), war drums and percussion, slow minor progressions.
  Separate themes: main menu, campaign map, calm battle, combat (intensity rises when fighting), victory, defeat; a different tone per faction (Iron Void = heavy brass/choir; Null Horde = dissonant drones/clicks).
- Smooth crossfades between calm ↔ combat, ducking of music when voice lines play.
- SFX: layered weapon sounds per weapon type, punchy explosions with low rumble, footsteps for heavy units, building construction/completion, capture start/finish, UI clicks/hover, alerts.
- Settings: master / music / SFX / voice sliders.

### G11 — Performance, quality pass and proof
- Profile with 100+ units and effects; ensure ≥ 50 FPS on Medium on integrated graphics. Object pooling for particles/decals/projectiles; cull off-screen sprites.
- Add `scripts/screenshots.ts` (or extend `scripts/preview-maps.ts`) that renders/saves screenshots of: main menu, campaign map, battle start, big fight, HUD at 1280×720 and 1920×1080, in RU and EN. Commit them to `docs/screens/`.
- Update `README.md`: controls, graphics settings, languages, voice-over notes, how to run and how to package (`npm run zip` needs the `zip` command, which Windows does not have by default — replace it with a Node script using a small dependency or the built-in `node:zlib`, so packaging works on Windows).
- Final report in the PR description: what changed per phase, before/after screenshots, known limitations.

---

## 3. Definition of done
- Tilted camera, readable depth, correct input mapping.
- Units and buildings that look like a grimdark RTS and animate.
- Terrain without visible tile grid; atmosphere and lighting.
- Gothic bottom HUD, all icons procedural.
- Full Russian localization with a language switch; Russian voice lines via speechSynthesis with subtitles fallback.
- Music and SFX noticeably richer; volume sliders for master/music/SFX/voice.
- `npm run build` passes with no type errors; game boots and is playable start to finish in both languages.
