// Centralized game constants and tuning values.

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const TILE_SIZE = 64;
export const MAP_W = 64;
export const MAP_H = 48;
export const WORLD_W = TILE_SIZE * MAP_W;
export const WORLD_H = TILE_SIZE * MAP_H;

export const COLORS = {
  background: '#1a1a2e',
  player: 0x3a8dff,
  enemy: 0xe0303a,
  neutral: 0x9a9a9a,
  uiPanel: 0x10101c,
  uiBorder: 0x5a5a7a,
  uiText: '#e8e8f0',
  scrip: 0xf0c040,
  flux: 0x40e0ff,
} as const;

export const FONT_FAMILY = '"Trebuchet MS", Verdana, sans-serif';
export const GOTHIC_FONT = '"UnifrakturMaguntia", "Old English Text MT", "Blackletter", Georgia, serif';

export const TILE = {
  GROUND: 0,
  CLIFF: 1,
  ROAD: 2,
  RUINS: 3,
} as const;
export type TileType = (typeof TILE)[keyof typeof TILE];

export const CAMERA = {
  scrollSpeed: 900, // px/sec at zoom 1
  edgeSize: 20,
  minZoom: 0.5,
  maxZoom: 2,
  zoomStep: 0.1,
} as const;

// Render depths (world layer ordering).
export const DEPTH = {
  terrain: 0,
  decals: 5,
  capture: 8,
  buildings: 10,
  selection: 15,
  units: 20,
  projectiles: 30,
  effects: 40,
  fog: 100,
  overlay: 110,
} as const;

export const RESOURCES = {
  startScrip: 400,
  startFlux: 100,
  /** Trickle income from the Stronghold so a player is never fully stalled. */
  baseScripIncome: 4,
  captureScripPerSec: 25,
} as const;

export const BUILD = {
  /** Buildings snap to a grid of this many tiles. */
  snap: 4,
  /** Default distance (tiles) from a friendly building within which new ones may be placed. */
  radius: 10,
  /** Fraction of max HP a building starts with while under construction. */
  startHpFraction: 0.25,
  refundOnCancel: 0.75,
} as const;

export const UNITS = {
  formationSpacing: 24,
  separationRadius: 16,
  separationForce: 140,
  /** Extra px beyond weapon range at which idle squads notice enemies. */
  acquireBonus: 80,
  reinforceInterval: 1.2,
  /** Reinforcing costs this fraction of the per-soldier price. */
  reinforceCostFactor: 0.5,
  maxSquads: 10,
  queueMax: 5,
  repathInterval: 1.0,
  retargetInterval: 0.35,
  commanderRespawn: 30,
  projectileSpeed: 700,
  visionRadius: 300,
} as const;

export const BUILDING_VISION = 200;
