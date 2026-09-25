import { TILE_SIZE } from '../config';
import { makeRng } from '../utils/rng';
import { makeCanvas } from './CanvasUtil';

/** Top-down (unprojected) tile images painted with Canvas 2D; the terrain renderer squashes them. */
export interface TileArtSet {
  ground: HTMLCanvasElement[];
  road: HTMLCanvasElement[];
  ruins: HTMLCanvasElement[];
  cliffTop: HTMLCanvasElement[];
  cliffFront: HTMLCanvasElement[];
}

const S = TILE_SIZE;

function speckle(ctx: CanvasRenderingContext2D, rnd: () => number, n: number, colors: string[], maxW = 3): void {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    ctx.fillRect(Math.floor(rnd() * S), Math.floor(rnd() * S), 1 + Math.floor(rnd() * maxW), 1 + Math.floor(rnd() * 2));
  }
}

function ground(seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(S, S);
  const rnd = makeRng(seed);
  ctx.fillStyle = '#2d2d2d';
  ctx.fillRect(0, 0, S, S);
  speckle(ctx, rnd, 40, ['#353535', '#262626']);
  return canvas;
}

function road(seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(S, S);
  const rnd = makeRng(seed);
  ctx.fillStyle = '#4a4238';
  ctx.fillRect(0, 0, S, S);
  speckle(ctx, rnd, 50, ['#544b40', '#3f382f'], 2);
  return canvas;
}

function ruins(seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(S, S);
  const rnd = makeRng(seed);
  ctx.fillStyle = '#2a2826';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 14; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const w = 4 + rnd() * 12;
    const h = 3 + rnd() * 8;
    ctx.fillStyle = rnd() < 0.5 ? '#55504a' : '#46413c';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#1c1a18';
    ctx.fillRect(x, y + h, w, 2);
  }
  return canvas;
}

function cliffTop(seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(S, S);
  const rnd = makeRng(seed);
  ctx.fillStyle = '#2a1d10';
  ctx.fillRect(0, 0, S, S);
  speckle(ctx, rnd, 90, ['#3a2812', '#1a1108', '#453018']);
  return canvas;
}

function cliffFront(seed: number): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(S, 32);
  const rnd = makeRng(seed);
  const g = ctx.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, '#1d140a');
  g.addColorStop(1, '#0b0704');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, 32);
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(Math.floor(rnd() * S), 0, 1 + Math.floor(rnd() * 2), 32);
  }
  return canvas;
}

export function createTileArt(): TileArtSet {
  return {
    ground: [ground(11)],
    road: [road(37)],
    ruins: [ruins(51)],
    cliffTop: [cliffTop(23)],
    cliffFront: [cliffFront(29)],
  };
}
