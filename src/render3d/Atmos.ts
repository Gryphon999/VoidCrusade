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
}

const PRESETS: Record<string, AtmosPreset> = {
  // Ashfall: a dying dusk under smoke; low orange sun from the west, long shadows.
  ashfall: {
    id: 'dusk', sunDir: [-1, 0.7, -0.25], sunColor: 0xffb07a, sunIntensity: 3.1,
    skyColor: 0x9a90a8, groundColor: 0x44301e, ambient: 1.35, exposure: 1.6, bloom: 0.6, haze: 0x2a1c16,
  },
  // Veyra: harsh hazy midday over the dust plains; high white sun, short shadows, bright fill.
  veyra: {
    id: 'noon', sunDir: [0.35, 1.3, 0.45], sunColor: 0xfff1d8, sunIntensity: 3.1,
    skyColor: 0xcabfa6, groundColor: 0x6a5238, ambient: 1.15, exposure: 1.2, bloom: 0.35, haze: 0x5a4a38,
  },
  // Khorvan: cold night; blue moonlight from the north-east, fires and energy carry the scene.
  khorvan: {
    id: 'night', sunDir: [0.7, 0.9, -0.8], sunColor: 0x9cb8ff, sunIntensity: 1.5,
    skyColor: 0x33406a, groundColor: 0x10141c, ambient: 0.85, exposure: 1.75, bloom: 0.8, haze: 0x0c1018,
  },
  // Proving Grounds (tutorial): readable, gentle dusk.
  proving: {
    id: 'dusk-soft', sunDir: [-0.8, 0.9, -0.4], sunColor: 0xffc08a, sunIntensity: 2.6,
    skyColor: 0x8a8090, groundColor: 0x40301f, ambient: 1.2, exposure: 1.4, bloom: 0.45, haze: 0x241a14,
  },
};

export function atmosFor(mapId: string): AtmosPreset {
  return PRESETS[mapId] ?? PRESETS.ashfall;
}
