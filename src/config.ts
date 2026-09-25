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

// Render depths (world layer ordering). Upright objects use depthForY() so that
// whatever stands further south (larger ground Y) is drawn in front.
export const DEPTH = {
  terrain: 0,
  decals: 5,
  capture: 8,
  groundFx: 9,
  selection: 10,
  shadows: 11,
  /** Base for Y-sorted objects: depth = sorted + groundY (ground Y is at most ~3100). */
  sorted: 1000,
  projectiles: 5000,
  effects: 5100,
  bars: 8000,
  silhouettes: 8100,
  fog: 9000,
  overlay: 9500,
} as const;

export const PROJECTION = {
  /** Vertical squash of the ground plane (~0.65 is a 55-60 degree camera pitch). */
  defaultTilt: 0.65,
  minTilt: 0.55,
  maxTilt: 0.8,
  /** Height of cliff walls in screen px. */
  cliffHeight: 26,
} as const;

export const RESOURCES = {
  startScrip: 500,
  startFlux: 100,
  /** Trickle income from the Stronghold so a player is never fully stalled. */
  baseScripIncome: 4,
  captureScripPerSec: 25,
  /** Extra Flux from holding the relic. */
  relicFluxPerSec: 5,
  /** Build radius (tiles) around a held forward-base point. */
  forwardBuildRadius: 8,
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
  queueMax: 5,
  repathInterval: 1.0,
  retargetInterval: 0.35,
  commanderRespawn: 30,
  projectileSpeed: 700,
  visionRadius: 300,
} as const;

/** Population cap: every squad costs supply; HQ and supply buildings provide it. */
export const SUPPLY = {
  hardMax: 40,
  /** Campaign "extra squad slot" bonuses are converted to this much supply. */
  perSquadSlot: 3,
} as const;

export const BUILDING_VISION = 200;

export const FX = {
  maxDecals: 100,
  maxCorpses: 140,
  decalAlpha: 0.7,
  shakeDuration: 300,
  shakeIntensity: 0.02,
} as const;

export const CAPTURE = {
  /** Half-size of the square capture zone, in tiles (3x3 zone). */
  zoneHalfTiles: 1.5,
  captureTime: 5,
  /** No-build margin around the zone, in tiles. */
  reserveTiles: 2,
} as const;

export type Difficulty = 'easy' | 'normal' | 'hard' | 'brutal';
export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'brutal'];

/** Shared AI tuning; per-difficulty skill lives in src/ai/AIProfile.ts. */
export const AI = {
  /** Enemy squads within this distance of the HQ trigger a defensive response. */
  defendRadius: 700,
  /** Seconds a sighting stays in the AI's scouting memory. */
  memory: 90,
} as const;

export const MINIMAP = {
  width: 200,
  height: 150,
  margin: 8,
  refreshMs: 500,
} as const;

export const FOG = {
  /** Fog cell size in tiles. */
  cellTiles: 2,
  updateMs: 200,
  unitVision: 300,
  buildingVision: 200,
  hqVision: 420,
  exploredAlpha: 0.5,
  unexploredAlpha: 0.97,
} as const;

export const COVER = {
  damageMult: 0.5,
  updateInterval: 0.25,
  /** Radius (tiles) searched for cover when a squad holds position. */
  seekRadius: 4,
  losStep: 16,
} as const;

/** Per graphics-quality budgets (visual only). */
export const GFX = {
  low: { lights: 8, ash: 0, fogPatches: 0, bloom: false, grade: false, grain: false, particleMult: 0.5 },
  medium: { lights: 24, ash: 6, fogPatches: 28, bloom: false, grade: true, grain: true, particleMult: 1 },
  high: { lights: 48, ash: 14, fogPatches: 44, bloom: true, grade: true, grain: true, particleMult: 1.3 },
} as const;
