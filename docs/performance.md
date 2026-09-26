# Performance (A9)

## Test scene and hardware

**Heavy test scene.** Ashfall, first Nexus point, 1280×720 viewport, camera zoom 1, fog off.
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
| Classic 2D | 306 ms | 357 ms | – | – | – |
| 3D Low | 717 ms | 815 ms | 7.8 | 125 | 0.33 M |
| 3D Medium | 1657 ms | 2080 ms | 28.7 | 251 | 0.85 M |
| 3D High | 1939 ms | 2376 ms | 34.6 | 245 | 0.92 M |
| 3D Ultra | 2181 ms | 2668 ms | 43.1 | 257 | 1.20 M |

Before the A9 optimisations, Medium drew 1.36 M triangles in 2053 ms per frame and Ultra
1.76 M triangles.

## How to read the numbers

- **Low:** about 2.3× the cost of Classic 2D. It has no shadow pass, no bloom and no MSAA, and
  draws 125 calls and 0.33 M triangles, which is trivial for any GPU from the last ten years.
- **Medium:** about 5.4× the cost of 2D under SwiftShader, mostly from fill-rate work that a real
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
  | Medium | 2K | on | 4× | 1.5 | 8 | 0.8 |
  | High | 2K | on | 4× | 2 | 12 | 1.0 |
  | Ultra | 4K | on | 4× | 3 | 16 | 1.25 |

- **Loading:** first load stays as before (procedural bake with a progress bar and tips), plus
  about 50 KB of baked LUTs. The 3D models build lazily on first use and are cached.

## Not done or not verified

- **Real-GPU FPS** (see the caveat above).
- **Buildings are not instanced.** Each one is 2–3 draw calls; 63 buildings account for about
  150 of the ~250 calls.
- **No IndexedDB caching** of generated textures between sessions.
- **No texture compression.** All textures are procedural canvases.
