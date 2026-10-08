/** Per-map lighting mood for the 3D battlefield (time of day, colours, exposure). */
export interface AtmosPreset {
  id: string;
  /** Direction the sunlight comes FROM, relative to the view centre (x east, y up, z south). */
  sunDir: [number, number, number];
  sunColor: number;
  sunIntensity: number;
  skyColor: number;
  groundColor: number;
  ambient: number;
  exposure: number;
  bloom: number;
  /** Tint of the void beyond the outlands and of the fog layer. */
  haze: number;
  /** Ground haze colour and opacity (0 = none). */
  fogColor: number;
  fog: number;
  /** Lens finish. */
  vignette: number;
  grain: number;
}

const PRESETS: Record<string, AtmosPreset> = {
  // Ashfall: a dying dusk under smoke; low orange sun from the west, long shadows.
  ashfall: {
    id: 'dusk', sunDir: [-1, 0.7, -0.25], sunColor: 0xffb07a, sunIntensity: 3.1,
    skyColor: 0x9a90a8, groundColor: 0x44301e, ambient: 1.35, exposure: 1.6, bloom: 0.6, haze: 0x2a1c16, fogColor: 0x8a6a58, fog: 0.13, vignette: 0.42, grain: 0.035,
  },
  // Veyra: harsh hazy midday over the dust plains; high white sun, short shadows, bright fill.
  veyra: {
    id: 'noon', sunDir: [0.35, 1.3, 0.45], sunColor: 0xfff1d8, sunIntensity: 3.1,
    skyColor: 0xcabfa6, groundColor: 0x6a5238, ambient: 1.15, exposure: 1.2, bloom: 0.35, haze: 0x5a4a38, fogColor: 0xc8b090, fog: 0.1, vignette: 0.3, grain: 0.03,
  },
  // Khorvan: cold night; blue moonlight from the north-east, fires and energy carry the scene.
  khorvan: {
    id: 'night', sunDir: [0.7, 0.9, -0.8], sunColor: 0x9cb8ff, sunIntensity: 1.5,
    skyColor: 0x33406a, groundColor: 0x10141c, ambient: 0.85, exposure: 1.75, bloom: 0.8, haze: 0x0c1018, fogColor: 0x5a6a88, fog: 0.14, vignette: 0.5, grain: 0.045,
  },
  // Mourngate: an overcast dawn over the fens; pale green-grey light from the east, heavy mist.
  mourngate: {
    id: 'dawn', sunDir: [0.9, 0.75, 0.3], sunColor: 0xdfe8c8, sunIntensity: 2.4,
    skyColor: 0x8fa69a, groundColor: 0x2a3424, ambient: 1.3, exposure: 1.45, bloom: 0.45, haze: 0x1c241e, fogColor: 0x8aa08a, fog: 0.09, vignette: 0.4, grain: 0.035,
  },
  // Cinder Spires: the sun is gone behind the smoke; a deep red glow from the south-west.
  cinder: {
    id: 'ember', sunDir: [-0.8, 0.6, 0.5], sunColor: 0xffc090, sunIntensity: 3,
    skyColor: 0x8a8690, groundColor: 0x2a2220, ambient: 1.45, exposure: 1.8, bloom: 0.75, haze: 0x1a0c0a, fogColor: 0x6a5450, fog: 0.08, vignette: 0.48, grain: 0.04,
  },
  // Sunken Delta: humid morning haze over brown water; low warm sun from the east, soft mist.
  delta: {
    id: 'morning', sunDir: [0.9, 0.8, 0.35], sunColor: 0xffd8a8, sunIntensity: 2.7,
    skyColor: 0x9aa8a0, groundColor: 0x2e3424, ambient: 1.3, exposure: 1.5, bloom: 0.5, haze: 0x1e241c, fogColor: 0x9aa894, fog: 0.11, vignette: 0.4, grain: 0.035,
  },
  // Ignis Flats: no sun to speak of, only the glow from below and a dull red sky.
  ignis: {
    id: 'furnace', sunDir: [-0.5, 0.5, 0.7], sunColor: 0xff8a50, sunIntensity: 2.2,
    skyColor: 0x6a4038, groundColor: 0x3a1a10, ambient: 1.5, exposure: 1.85, bloom: 0.9, haze: 0x1a0806, fogColor: 0x5a2c20, fog: 0.09, vignette: 0.5, grain: 0.045,
  },
  // Frostmark: hard pale winter noon, blue shadows, crisp air.
  frost: {
    id: 'winter', sunDir: [0.4, 1.1, -0.5], sunColor: 0xeaf2ff, sunIntensity: 3,
    skyColor: 0xb8c8dc, groundColor: 0x3a4250, ambient: 1.2, exposure: 1.3, bloom: 0.4, haze: 0x2a3240, fogColor: 0xc4d2e0, fog: 0.1, vignette: 0.34, grain: 0.03,
  },
  // Proving Grounds (tutorial): readable, gentle dusk.
  proving: {
    id: 'dusk-soft', sunDir: [-0.8, 0.9, -0.4], sunColor: 0xffc08a, sunIntensity: 2.6,
    skyColor: 0x8a8090, groundColor: 0x40301f, ambient: 1.2, exposure: 1.4, bloom: 0.45, haze: 0x241a14, fogColor: 0x8a7060, fog: 0.08, vignette: 0.32, grain: 0.03,
  },
};

export function atmosFor(mapId: string): AtmosPreset {
  return PRESETS[mapId] ?? PRESETS.ashfall;
}
