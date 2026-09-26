import { makeRng } from '../utils/rng';
import { makeCanvas, mix, rgb, shade } from './CanvasUtil';
import { ValueNoise } from './Noise';
import type { Biome } from './Biomes';

/** Seamless material textures for one biome (painted once at load). */
export interface TerrainTextures {
  ground: HTMLCanvasElement[];
  plating: HTMLCanvasElement;
  rubble: HTMLCanvasElement;
  cliffTop: HTMLCanvasElement;
  cliffFace: HTMLCanvasElement;
}

/** Fills a canvas pixel-by-pixel with tileable fBm noise between two colours. */
function noiseFill(ctx: CanvasRenderingContext2D, w: number, h: number, dark: number, light: number, seed: number,
  scale: number, contrast = 1.4): void {
  const n = new ValueNoise(seed);
  const img = ctx.createImageData(w, h);
  // A whole number of lattice cells per tile, or the wrap would seam.
  const period = Math.max(1, Math.round(w / scale));
  scale = w / period;
  const rnd = makeRng(seed + 7);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = n.fbm(x / scale, y / scale, 5, period);
      v = Math.min(1, Math.max(0, (v - 0.5) * contrast + 0.5 + (rnd() - 0.5) * 0.08));
      const c = mix(dark, light, v);
      const i = (y * w + x) * 4;
      img.data[i] = (c >> 16) & 255;
      img.data[i + 1] = (c >> 8) & 255;
      img.data[i + 2] = c & 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Draws `fn` at (x, y) and at its wrapped copies so features cross tile edges seamlessly. */
function wrapDraw(size: number, x: number, y: number, r: number, fn: (x: number, y: number) => void): void {
  for (const dx of [-size, 0, size]) {
    for (const dy of [-size, 0, size]) {
      if (x + dx + r < 0 || y + dy + r < 0 || x + dx - r > size || y + dy - r > size) continue;
      fn(x + dx, y + dy);
    }
  }
}

function pebbles(ctx: CanvasRenderingContext2D, size: number, rnd: () => number, n: number, base: number): void {
  for (let i = 0; i < n; i++) {
    const r = 1 + rnd() * rnd() * 5;
    const col = shade(base, 0.7 + rnd() * 0.6);
    wrapDraw(size, rnd() * size, rnd() * size, r + 2, (x, y) => {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(x + r * 0.4, y + r * 0.4, r, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgb(col);
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,240,220,0.12)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.5, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function cracks(ctx: CanvasRenderingContext2D, size: number, rnd: () => number, n: number, alpha: number): void {
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    let x = rnd() * size;
    let y = rnd() * size;
    let a = rnd() * Math.PI * 2;
    const steps = 4 + Math.floor(rnd() * 8);
    ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
    ctx.lineWidth = 0.8 + rnd() * 1.2;
    for (let s = 0; s < steps; s++) {
      const nx = x + Math.cos(a) * (4 + rnd() * 8);
      const ny = y + Math.sin(a) * (4 + rnd() * 8);
      const x0 = x;
      const y0 = y;
      wrapDraw(size, x0, y0, 14, (px, py) => {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + nx - x0, py + ny - y0);
        ctx.stroke();
      });
      x = nx;
      y = ny;
      a += (rnd() - 0.5) * 1.3;
    }
  }
}

function groundTexture(dark: number, light: number, seed: number, specks: number): HTMLCanvasElement {
  const S = 256;
  const { canvas, ctx } = makeCanvas(S, S);
  noiseFill(ctx, S, S, dark, light, seed, 32);
  const rnd = makeRng(seed + 1);
  cracks(ctx, S, rnd, 5, 0.35);
  pebbles(ctx, S, rnd, 70, light);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = rgb(specks, 0.05 + rnd() * 0.12);
    ctx.fillRect(rnd() * S, rnd() * S, 1, 1);
  }
  return canvas;
}

function platingTexture(dark: number, light: number, seed: number): HTMLCanvasElement {
  const S = 128;
  const { canvas, ctx } = makeCanvas(S, S);
  noiseFill(ctx, S, S, dark, light, seed, 16, 0.8);
  const rnd = makeRng(seed + 3);
  // Rust and grime stains.
  for (let i = 0; i < 10; i++) {
    const r = 6 + rnd() * 16;
    wrapDraw(S, rnd() * S, rnd() * S, r, (x, y) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgb(rnd() < 0.5 ? 0x5a3018 : 0x141210, 0.45));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
  }
  // Plate seams with bevels and rivets.
  // Seams deliberately off the 64px tile grid so the road never shows the tile layout.
  for (const p of [22, 86]) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(p, 0, 2, S);
    ctx.fillRect(0, p, S, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(p + 2, 0, 1, S);
    ctx.fillRect(0, p + 2, S, 1);
    for (let t = 6; t < S; t += 12) {
      for (const [x, y] of [[p + 6, t], [t, p + 6]]) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.arc(x + 0.8, y + 0.8, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgb(shade(light, 1.25));
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Scratches.
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 30; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 20, y + (rnd() - 0.5) * 6);
    ctx.stroke();
  }
  return canvas;
}

function rubbleTexture(dark: number, light: number, seed: number): HTMLCanvasElement {
  const S = 256;
  const { canvas, ctx } = makeCanvas(S, S);
  noiseFill(ctx, S, S, shade(dark, 0.8), dark, seed, 24);
  const rnd = makeRng(seed + 5);
  for (let i = 0; i < 90; i++) {
    const r = 2 + rnd() * 9;
    const col = mix(dark, light, 0.3 + rnd() * 0.7);
    const sides = 4 + Math.floor(rnd() * 3);
    const rot = rnd() * Math.PI;
    wrapDraw(S, rnd() * S, rnd() * S, r + 3, (x, y) => {
      const pts: [number, number][] = [];
      for (let s = 0; s < sides; s++) {
        const a = rot + (s / sides) * Math.PI * 2;
        const rr = r * (0.7 + rnd() * 0.4);
        pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8]);
      }
      const poly = (dx: number, dy: number): void => {
        ctx.beginPath();
        pts.forEach(([px, py], j) => (j ? ctx.lineTo(px + dx, py + dy) : ctx.moveTo(px + dx, py + dy)));
        ctx.closePath();
      };
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      poly(r * 0.35, r * 0.35);
      ctx.fill();
      ctx.fillStyle = rgb(col);
      poly(0, 0);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,245,230,0.10)';
      poly(-r * 0.15, -r * 0.2);
      ctx.fill();
    });
  }
  cracks(ctx, S, rnd, 4, 0.4);
  return canvas;
}

function cliffTopTexture(dark: number, light: number, seed: number): HTMLCanvasElement {
  const S = 256;
  const { canvas, ctx } = makeCanvas(S, S);
  noiseFill(ctx, S, S, dark, light, seed, 20, 1.8);
  const rnd = makeRng(seed + 9);
  cracks(ctx, S, rnd, 16, 0.55);
  pebbles(ctx, S, rnd, 40, light);
  return canvas;
}

function cliffFaceTexture(dark: number, light: number, seed: number): HTMLCanvasElement {
  const W = 256;
  const H = 64;
  const { canvas, ctx } = makeCanvas(W, H);
  const n = new ValueNoise(seed);
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Vertical fracture columns + horizontal strata.
      const col = n.fbm(x / 8, y / 40, 4, W / 8);
      const strata = 0.5 + 0.5 * Math.sin(y * 0.45 + n.noise(x / 32, y / 8, W / 32) * 3);
      const v = Math.min(1, Math.max(0, col * 0.8 + strata * 0.25 - (y / H) * 0.35));
      const c = mix(dark, light, v);
      const i = (y * W + x) * 4;
      img.data[i] = (c >> 16) & 255;
      img.data[i + 1] = (c >> 8) & 255;
      img.data[i + 2] = c & 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const rnd = makeRng(seed + 2);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, 0, 1 + rnd() * 2, H * (0.4 + rnd() * 0.6));
    ctx.fillStyle = 'rgba(255,230,200,0.08)';
    ctx.fillRect(x - 1, 0, 1, H * 0.5);
  }
  return canvas;
}

export function createTerrainTextures(b: Biome, seed: number): TerrainTextures {
  return {
    ground: b.ground.map(([d, l], i) => groundTexture(d, l, seed + i * 101, b.specks)),
    plating: platingTexture(b.plating[0], b.plating[1], seed + 500),
    rubble: rubbleTexture(b.rubble[0], b.rubble[1], seed + 600),
    cliffTop: cliffTopTexture(b.cliffTop[0], b.cliffTop[1], seed + 700),
    cliffFace: cliffFaceTexture(b.cliffFace[0], b.cliffFace[1], seed + 800),
  };
}
