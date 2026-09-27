# Performance

## Measured on a real integrated GPU

`npx tsx scripts/screenshots-models.ts --fps` plays a fight on Ashfall in a visible Chrome window
on the machine's own graphics card and times real frames for 10 seconds, on every tier.

**Hardware:** AMD Radeon 860M (integrated), 1920×1200 panel at 125 % scaling, Chrome, Direct3D 11.
**Scene:** 27 squads fighting at the first Nexus point with three tanks, 25 buildings behind
them, HUD on, camera zoom 0.7. About 65 to 70 soldiers are alive while frames are timed, so this
is a normal large fight, lighter than the 153-unit stress scene further down.

| Tier | 1280×720 | 1920×1080 | This laptop, browser maximised (1536×864 at 1.25×) |
|---|---|---|---|
| Low | 172 fps (1 % low 57) | 123 fps (1 % low 69) | 139 fps (1 % low 74) |
| Medium | 71 fps (1 % low 43) | 43 fps (1 % low 27) | 57 fps (1 % low 37) |
| High | 59 fps (1 % low 33) | 37 fps (1 % low 25) | 50 fps (1 % low 37) |
| Ultra | 40 fps (1 % low 20) | 33 fps (1 % low 19) | 47 fps (1 % low 32) |

- Every tier holds the 45 fps target on the laptop's own screen in this scene. At a full
  1920×1080 canvas Medium sits just under it (43 fps): the resolution scale setting or the Low
  tier closes the gap, and adaptive quality drops a tier by itself after 6 s under 40 fps.
- **Medium now renders at one pixel per CSS pixel** (`maxDpr` 1.5 → 1). On a scaled laptop panel
  that is about a third fewer pixels for every full-screen pass; 4× anti-aliasing keeps edges clean.
- Single runs vary by a few frames per second (the fight is not identical each time), so treat
  differences under 10 % as noise.
- Not measured: the 153-unit stress scene on real hardware, other GPUs, and battery power.

## After the larger maps and the layered ground

Same scene, same laptop, on Ashfall Ridge at its new size (96×72 tiles). The display refreshes at
60 Hz and this run was capped by it, so Low reads 60 where the first table shows the uncapped rate.

| Tier | 1280×720 | 1920×1080 | This laptop, browser maximised (1536×864 at 1.25×) |
|---|---|---|---|
| Low | 59 fps (1 % low 54) | 60 fps (1 % low 51) | 60 fps (1 % low 35) |
| Medium | 59 fps (1 % low 31) | 40 fps (1 % low 18) | 52 fps (1 % low 24) |
| High | 54 fps (1 % low 30) | 33 fps (1 % low 13) | 44 fps (1 % low 20) |
| Ultra | 50 fps (1 % low 29) | 32 fps (1 % low 17) | 43 fps (1 % low 22) |

- **The new ground costs about a tenth of the frame rate** on Medium and above (57 → 52 fps on
  this laptop). High and Ultra now sit just under the 45 fps target on this screen; Medium holds it.
- **The ground is drawn in chunks** of 16×16 tiles, so only what is in view and in the shadow map
  is sent to the GPU: about 120 000 fewer triangles in this scene than as one mesh. It did not
  raise the frame rate, which says the cost is in the pixels (texture samples), not the triangles.
- **Low takes one sample of each ground material** where the other tiers take two.
- **1 % lows are worse than before** (24 against 37 on Medium). Another Chrome window with the
  game was open during this run and shares the GPU, so part of that is the measurement.
- Not measured: the two largest maps in a fight, and a clean run with nothing else on the GPU.

# Software-rasteriser measurements (A9)

## Test scene and hardware

**Heavy test scene.** Ashfall, first Nexus point, 1280×720 viewport, camera zoom 0.6 so that everything is on screen, fog off.
The scene holds:
- 63 buildings;
- 153 units in a fight, with tanks and a Behemoth;
- muzzle flashes, projectiles, blood and smoke.

Headless Chromium drove the dev build and measured three things:
- frame times over 12 s with `requestAnimationFrame`;
- the 3D renderer's own CPU cost per frame, `Battle3D.stats.cpuMs` (scene sync plus submit);
- the GPU work counters from `renderer.info`.

**Hardware: important caveat.** This environment has no GPU. Chromium renders with **SwiftShader**,
a CPU software rasteriser that is around 100× slower than any integrated GPU and is fill-rate bound.
So the absolute frame times below say nothing about real FPS. Only these tell you anything:
- the **relative** cost between tiers;
- the **GPU work counters** (draw calls, triangles), which are hardware-independent;
- the **CPU ms**, which is real JavaScript time on this machine but includes SwiftShader's
  submission overhead.

**The 45/60 FPS targets on a Radeon 860M-class iGPU still need a check on real hardware.** The
in-game FPS counter (Settings → Graphics… → Show FPS) shows FPS, tier, draw calls and triangles for
exactly that.

## Results (heavy scene)

| Renderer / tier | Frame (SwiftShader) | p95 | 3D CPU ms | Draw calls | Triangles |
|---|---|---|---|---|---|
| Classic 2D | 333 ms | 386 ms | – | – | – |
| 3D Low | 886 ms | 1061 ms | 11.4 | 293 | 0.36 M |
| 3D Medium | 1998 ms | 2434 ms | 31.6 | 463 | 0.90 M |
| 3D High | 2191 ms | 2675 ms | 41.6 | 469 | 0.96 M |
| 3D Ultra | 2488 ms | 3067 ms | 50.7 | 454 | 1.25 M |

- **All 63 buildings on screen.** An earlier run had most of them off-screen because of a
  tile-size bug in the benchmark script.
- **Building cost:** with the buildings in view they add about 210 draw calls (2–3 per building
  plus their shadows) but few triangles.
- **Before the A9 optimisations** (earlier layout, fewer buildings in view): Medium drew 1.36 M
  triangles and Ultra 1.76 M.

## How to read the numbers

- **Low:** about 2.7× the cost of Classic 2D. It has no shadow pass, no bloom and no MSAA, and
  draws 293 calls and 0.36 M triangles, which is light for any GPU from the last ten years.
- **Medium:** about 6× the cost of 2D under SwiftShader, mostly from fill-rate work that a real
  GPU does almost for free on this scene:
  - the shadow pass (2K map), which roughly doubles the triangles;
  - 4× MSAA;
  - half-resolution bloom;
  - two full-screen passes: fog of war, then grade plus lens.
- **What decides real FPS:** on an integrated GPU the limiting factor at 1080p is fill rate
  (full-screen passes × pixel ratio). The main levers are:
  - the pixel-ratio cap per tier (1 / 1.5 / 2 / 3);
  - the **resolution scale** setting;
  - **adaptive quality**, which drops a tier after 6 s under 40 FPS.
- **Triangle budget:** under 1 M on Medium and High in the worst case. Roughly half of it is the
  shadow pass.

## What was done for performance

- **Instancing:**
  - units: one batch per (type, animation, frame), capacity grows ×2;
  - props and scree: one batch per kind and variant;
  - particles: two instanced pools for all of them;
  - decals: one instanced batch per decal texture;
  - point lights: a fixed pool with no shader recompiles.
- **Analytic particles:** particle motion runs in the vertex shader. There is no per-particle CPU
  update; emission writes into ring buffers with ranged uploads.
- **Model LOD by tier:** unit tessellation scales with the tier's model detail. For A9 it was
  lowered further: 1-segment bevels, lighter capsules and spheres. That took **−38 % triangles on
  Medium** and brought the 3D CPU time from 41 ms to 29 ms under SwiftShader.
- **Post chain:**
  - bloom at half resolution, and off on Low;
  - grade (LUT) and lens finish merged into one pass;
  - MSAA only from Medium up.
- **Shadows:** the shadow frustum follows the view, so the map resolution is spent on screen.
- **Startup:** shaders are precompiled at battle start (`compileAsync`). Geometry and material
  caches are reused by every entity of a kind.
- **Tiers:**

  | Tier | Shadows | Bloom | MSAA | Max pixel ratio | Point lights | Model detail |
  |---|---|---|---|---|---|---|
  | Low | off | off | off | 1 | 4 | 0.6 |
  | Medium | 2K | on | 4× | 1 | 8 | 0.8 |
  | High | 2K | on | 4× | 2 | 12 | 1.0 |
  | Ultra | 4K | on | 4× | 3 | 16 | 1.25 |

- **Loading:** first load stays as before (procedural bake with a progress bar and tips), plus
  about 50 KB of baked LUTs. The 3D models build lazily on first use and are cached.

## Not done or not verified

- **Buildings are not instanced.** Each one is 2–3 draw calls plus shadows; 63 buildings account
  for about 210 of the ~460 calls on Medium. Instancing ready buildings per model is the next
  CPU-side win.
- **No IndexedDB caching** of generated textures between sessions.
- **No texture compression.** All textures are procedural canvases.
