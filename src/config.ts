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
