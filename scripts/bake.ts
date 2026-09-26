/**
 * Build-time bake: colour-grading LUTs for the 3D renderer (one per map mood).
 * Output: src/assets/baked/lut-<id>.png, a 16×16×16 LUT laid out as a 256×16 strip
 * (x = r + b·16, y = g). Deterministic: the same code always writes the same bytes.
 *
 *   npm run bake
 */
import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { GRADES, Grade } from '../src/render3d/Grades';

const SIZE = 16;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/baked');

type RGB = [number, number, number];
const lum = (c: RGB): number => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
const clamp = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (v: number): number => v * v * (3 - 2 * v);

/** Display-referred grade: saturation, split toning, S-curve contrast, lift and gain. */
function grade(c: RGB, g: Grade): RGB {
  let l = lum(c);
  let o = c.map((v) => l + (v - l) * g.saturation) as RGB;
  l = lum(o);
  const sh = (1 - l) * (1 - l);
  const hi = l * l;
  o = o.map((v, i) => v + g.shadowTint[i] * sh * g.split + g.highTint[i] * hi * g.split) as RGB;
  o = o.map((v) => {
    const x = clamp(v);
    return x + (smooth(x) - x) * g.contrast;
  }) as RGB;
  return o.map((v, i) => clamp(g.lift[i] + v * (g.gain[i] - g.lift[i]))) as RGB;
}

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w: number, h: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let i = 0; i < w * 3; i++) raw[y * (w * 3 + 1) + 1 + i] = rgb[y * w * 3 + i];
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(OUT, { recursive: true });
for (const [id, g] of Object.entries(GRADES)) {
  const w = SIZE * SIZE;
  const px = new Uint8Array(w * SIZE * 3);
  for (let b = 0; b < SIZE; b++) {
    for (let gg = 0; gg < SIZE; gg++) {
      for (let r = 0; r < SIZE; r++) {
        const o = grade([r / (SIZE - 1), gg / (SIZE - 1), b / (SIZE - 1)], g);
        const i = (gg * w + b * SIZE + r) * 3;
        px[i] = Math.round(o[0] * 255);
        px[i + 1] = Math.round(o[1] * 255);
        px[i + 2] = Math.round(o[2] * 255);
      }
    }
  }
  const file = join(OUT, `lut-${id}.png`);
  writeFileSync(file, png(w, SIZE, px));
  console.log('baked', file);
}
