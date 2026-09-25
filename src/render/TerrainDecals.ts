import { TILE, TILE_SIZE } from '../config';
import { makeRng } from '../utils/rng';
import type { MapSystem } from '../systems/MapSystem';

export type DecalKind = 'crater' | 'scorch' | 'cracks' | 'bones' | 'stain';

export interface TerrainDecal {
  kind: DecalKind;
  x: number;
  y: number;
  r: number;
  rot: number;
  seed: number;
}

/** Deterministic scatter of ground decals for a map (logical coordinates). */
export function scatterDecals(map: MapSystem, seed: number): TerrainDecal[] {
  const rnd = makeRng(seed);
  const out: TerrainDecal[] = [];
  const kinds: [DecalKind, number, number, number][] = [
    // kind, chance per ground tile, min r, max r
    ['crater', 0.018, 14, 34],
    ['scorch', 0.025, 20, 50],
    ['cracks', 0.03, 18, 36],
    ['bones', 0.012, 6, 10],
    ['stain', 0.03, 16, 40],
  ];
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const t = map.getTile(tx, ty);
      if (t === TILE.CLIFF) continue;
      for (const [kind, chance, r0, r1] of kinds) {
        if (rnd() > chance) continue;
        if (t === TILE.ROAD && kind !== 'scorch' && kind !== 'stain') continue;
        out.push({
          kind,
          x: (tx + rnd()) * TILE_SIZE,
          y: (ty + rnd()) * TILE_SIZE,
          r: r0 + rnd() * (r1 - r0),
          rot: rnd() * Math.PI * 2,
          seed: Math.floor(rnd() * 1e9),
        });
      }
    }
  }
  return out;
}

/** Paints one decal in logical (unsquashed) coordinates. */
export function paintDecal(ctx: CanvasRenderingContext2D, d: TerrainDecal): void {
  const rnd = makeRng(d.seed);
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.rot);
  switch (d.kind) {
    case 'crater': {
      const g = ctx.createRadialGradient(0, 0, d.r * 0.2, 0, 0, d.r);
      g.addColorStop(0, 'rgba(0,0,0,0.65)');
      g.addColorStop(0.6, 'rgba(10,8,6,0.45)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, d.r, d.r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      // Raised rim: lit on the far side from the light (top-left), shadowed inside.
      ctx.lineWidth = d.r * 0.18;
      ctx.strokeStyle = 'rgba(255,235,210,0.10)';
      ctx.beginPath();
      ctx.arc(0, 0, d.r * 0.8, -0.2, Math.PI * 0.9);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, d.r * 0.8, Math.PI, Math.PI * 1.8);
      ctx.stroke();
      break;
    }
    case 'scorch': {
      for (let i = 0; i < 5; i++) {
        const ox = (rnd() - 0.5) * d.r * 0.6;
        const oy = (rnd() - 0.5) * d.r * 0.6;
        const r = d.r * (0.4 + rnd() * 0.6);
        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
        g.addColorStop(0, 'rgba(8,6,5,0.45)');
        g.addColorStop(1, 'rgba(8,6,5,0)');
        ctx.fillStyle = g;
        ctx.fillRect(ox - r, oy - r, r * 2, r * 2);
      }
      break;
    }
    case 'cracks': {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineCap = 'round';
      for (let b = 0; b < 4; b++) {
        let x = 0;
        let y = 0;
        let a = rnd() * Math.PI * 2;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        for (let s = 0; s < 5; s++) {
          x += Math.cos(a) * d.r * 0.22;
          y += Math.sin(a) * d.r * 0.22;
          a += (rnd() - 0.5) * 1.2;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'bones': {
      ctx.fillStyle = 'rgba(210,200,170,0.85)';
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate((rnd() - 0.5) * d.r * 2, (rnd() - 0.5) * d.r * 2);
        ctx.rotate(rnd() * Math.PI);
        ctx.fillRect(-d.r * 0.6, -1, d.r * 1.2, 2);
        ctx.beginPath();
        ctx.arc(-d.r * 0.6, 0, 1.8, 0, Math.PI * 2);
        ctx.arc(d.r * 0.6, 0, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // A skull.
      ctx.fillStyle = 'rgba(225,215,185,0.95)';
      ctx.beginPath();
      ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(-2, -0.5, 1.5, 1.5);
      ctx.fillRect(0.6, -0.5, 1.5, 1.5);
      break;
    }
    case 'stain': {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, d.r);
      g.addColorStop(0, rnd() < 0.5 ? 'rgba(60,40,20,0.25)' : 'rgba(20,24,20,0.25)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-d.r, -d.r, d.r * 2, d.r * 2);
      break;
    }
  }
  ctx.restore();
}
