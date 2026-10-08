/** Visual palettes per battle map (no gameplay effect). */
export interface Biome {
  id: string;
  /** Three blended ground materials: [dark, light] colour pairs. */
  ground: [number, number][];
  plating: [number, number];
  rubble: [number, number];
  cliffTop: [number, number];
  cliffFace: [number, number];
  /** Ember/ash specks sprinkled on the ground. */
  specks: number;
  minimap: { ground: number; cliff: number; road: number; ruins: number; water: number; lava: number; scrub: number; ice: number };
  /** Standing water in the hollows of the ground, 0 (dry) to 1 (3D view only). */
  wet?: number;
  /** Colour of the glow inside the cracks of the ground, for volcanic fields (3D view only). */
  lava?: number;
  /** Colours of the special tiles: shallows, magma, thicket growth, ice (defaults below). */
  water?: [number, number];
  magma?: [number, number];
  scrub?: [number, number];
  ice?: [number, number];
}

/** Colours of the special tiles when a biome names none. */
export const TILE_COLORS = {
  water: [0x0a1620, 0x3a7080] as [number, number],
  magma: [0x1a0806, 0xff6a1c] as [number, number],
  scrub: [0x14241a, 0x3e6a3c] as [number, number],
  ice: [0x9fb8c6, 0xe2f0f6] as [number, number],
  minimap: { water: 0x1a3a48, lava: 0xc24a10, scrub: 0x1e3a22, ice: 0x9fb6c4 },
};

const MM = TILE_COLORS.minimap;

const ASH: Biome = {
  id: 'ash',
  ground: [[0x2e2a27, 0x4f4841], [0x221e1c, 0x3a332e], [0x3f3226, 0x65513d]],
  plating: [0x34373b, 0x5c6168],
  rubble: [0x2f2c29, 0x5a544c],
  cliffTop: [0x2c2420, 0x4e433a],
  cliffFace: [0x120d0a, 0x33281f],
  specks: 0xff7a30,
  minimap: { ground: 0x3c3834, cliff: 0x0e0a08, road: 0x55585c, ruins: 0x4a4540, ...MM },
};

const DUST: Biome = {
  id: 'dust',
  ground: [[0x4a3c2c, 0x76624a], [0x5a4c3c, 0x8a7a64], [0x33291f, 0x4d3f30]],
  plating: [0x3e3a34, 0x68625a],
  rubble: [0x4a3e30, 0x7a6a56],
  cliffTop: [0x5a4430, 0x86684a],
  cliffFace: [0x24170e, 0x4a3522],
  specks: 0xe0b070,
  minimap: { ground: 0x5e4e3a, cliff: 0x1c130b, road: 0x5c574e, ruins: 0x5a4c3c, ...MM },
};

const ROCK: Biome = {
  id: 'rock',
  ground: [[0x26292e, 0x42464d], [0x302a25, 0x4c433a], [0x1f242b, 0x363e48]],
  plating: [0x2e3136, 0x575c64],
  rubble: [0x2a2c30, 0x50545a],
  cliffTop: [0x2a2d33, 0x4a4f58],
  cliffFace: [0x0d0e11, 0x2a2d33],
  specks: 0x70c0ff,
  minimap: { ground: 0x34373c, cliff: 0x0b0c0e, road: 0x4e5258, ruins: 0x40434a, ...MM },
};

const FEN: Biome = {
  id: 'fen',
  ground: [[0x232a22, 0x3f4a38], [0x1a211c, 0x2f3a30], [0x3a3a26, 0x5c5a3c]],
  plating: [0x2c322e, 0x525a54],
  rubble: [0x2a2e28, 0x525648],
  cliffTop: [0x2a3028, 0x4c5444],
  cliffFace: [0x0c100c, 0x2a3026],
  specks: 0x9adf70,
  wet: 0.7,
  minimap: { ground: 0x343c30, cliff: 0x0a0d0a, road: 0x4c524c, ruins: 0x44483e, ...MM },
};

const CINDER: Biome = {
  id: 'cinder',
  ground: [[0x201e1e, 0x3e3a38], [0x2a221e, 0x4a3e36], [0x161516, 0x2e2c2e]],
  plating: [0x2a2a2e, 0x505058],
  rubble: [0x241e1c, 0x4a403a],
  cliffTop: [0x1a1718, 0x36302e],
  cliffFace: [0x080606, 0x241a18],
  specks: 0xff4a1a,
  lava: 0xff5a1a,
  minimap: { ground: 0x2c2624, cliff: 0x080606, road: 0x48484e, ruins: 0x3c3432, ...MM },
};

/** Sunken Delta: silt and reeds, brown water, mossy rock. */
const DELTA: Biome = {
  id: 'delta',
  ground: [[0x2c2a1e, 0x4e4a34], [0x242a20, 0x3c4a36], [0x3a3024, 0x5c4e3a]],
  plating: [0x2e3230, 0x565c58],
  rubble: [0x2c2e26, 0x545648],
  cliffTop: [0x2e3026, 0x50543e],
  cliffFace: [0x0e100c, 0x2c3024],
  specks: 0xa0c070,
  wet: 0.35,
  water: [0x0a1820, 0x3f7c86],
  minimap: { ground: 0x3c3a2c, cliff: 0x0c0d0a, road: 0x4e524e, ruins: 0x46483c, ...MM, water: 0x27493f },
};

/** Ignis Flats: black glass and ash over a living magma field. */
const IGNIS: Biome = {
  id: 'ignis',
  ground: [[0x1c1a1a, 0x3a3634], [0x261e1c, 0x463834], [0x141214, 0x2a2628]],
  plating: [0x2a2a2e, 0x4e4e56],
  rubble: [0x221c1a, 0x463c36],
  cliffTop: [0x161416, 0x302c2e],
  cliffFace: [0x060404, 0x201816],
  specks: 0xff5a20,
  lava: 0xff6020,
  magma: [0x1c0a06, 0xff7a24],
  minimap: { ground: 0x282222, cliff: 0x060404, road: 0x46464c, ruins: 0x383030, ...MM, lava: 0xd85a14 },
};

/** Frostmark: frozen tundra, blue ice, dark frost-bitten growth. */
const FROST: Biome = {
  id: 'frost',
  ground: [[0x3a3e44, 0x6a7078], [0x2e343c, 0x56606a], [0x444240, 0x74706a]],
  plating: [0x363a40, 0x62686e],
  rubble: [0x363a3e, 0x62666a],
  cliffTop: [0x3c424a, 0x6a7480],
  cliffFace: [0x121418, 0x343a44],
  specks: 0xd8ecff,
  ice: [0xa8c0cc, 0xe6f2f8],
  scrub: [0x16221c, 0x3c5a44],
  minimap: { ground: 0x4a5058, cliff: 0x101216, road: 0x5c6268, ruins: 0x565a60, ...MM, ice: 0xb4cad6, scrub: 0x213829 },
};

const BY_MAP: Record<string, Biome> = { ashfall: ASH, veyra: DUST, khorvan: ROCK, mourngate: FEN, cinder: CINDER, delta: DELTA, ignis: IGNIS, frost: FROST };

export function biomeForMap(mapId: string): Biome {
  return BY_MAP[mapId] ?? ASH;
}
