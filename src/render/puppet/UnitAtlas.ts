import Phaser from 'phaser';
import { makeCanvas } from '../CanvasUtil';
import { PuppetRenderer } from './Puppet3D';
import { ANIMS, ANIM_FRAMES, AnimName, UnitModel } from './Models';
import { BREACHER_MODEL, COMMANDER_MODEL, ENGINEER_MODEL, HEAVY_MODEL, MARKSMAN_MODEL, RANGER_MODEL, RIFLEMAN_MODEL } from './IronVoidModels';
import { BEHEMOTH_MODEL, BURROWER_MODEL, CRAWLER_MODEL, LEAPER_MODEL, OVERLORD_MODEL, SHAMAN_MODEL, SPITTER_MODEL } from './HordeModels';
import type { UnitId } from '../../units/UnitDefs';

export const DIRECTIONS = 8;

export const UNIT_MODELS: Record<UnitId, UnitModel> = {
  rifleman: RIFLEMAN_MODEL,
  ranger: RANGER_MODEL,
  breacher: BREACHER_MODEL,
  marksman: MARKSMAN_MODEL,
  engineer: ENGINEER_MODEL,
  heavy: HEAVY_MODEL,
  commander: COMMANDER_MODEL,
  crawler: CRAWLER_MODEL,
  spitter: SPITTER_MODEL,
  leaper: LEAPER_MODEL,
  burrower: BURROWER_MODEL,
  shaman: SHAMAN_MODEL,
  behemoth: BEHEMOTH_MODEL,
  overlord: OVERLORD_MODEL,
};

/** Approximate on-screen height of each model (px at zoom 1) — for picking, bars and aim points. */
export const MODEL_HEIGHT: Record<UnitId, number> = {
  rifleman: 34, ranger: 33, breacher: 40, marksman: 32, engineer: 36, heavy: 44, commander: 64,
  crawler: 24, spitter: 30, leaper: 34, burrower: 22, shaman: 44, behemoth: 80, overlord: 74,
};

export function atlasKey(id: UnitId): string {
  return `units_${id}`;
}

export function frameName(anim: AnimName, frame: number, dir: number): string {
  return `${anim}${frame}_${dir}`;
}

export function portraitKey(id: UnitId): string {
  return `portrait_${id}`;
}

/** 8 facings: 0 = east, 2 = south (toward camera), 4 = west, 6 = north. */
export function dirFromAngle(a: number): number {
  return ((Math.round(a / (Math.PI / 4)) % DIRECTIONS) + DIRECTIONS) % DIRECTIONS;
}

/** Bakes every animation frame in 8 directions into one atlas texture per unit type. */
export function createUnitAtlases(scene: Phaser.Scene): void {
  for (const [id, m] of Object.entries(UNIT_MODELS) as [UnitId, UnitModel][]) {
    const key = atlasKey(id);
    if (scene.textures.exists(key)) continue;
    const cols = ANIMS.reduce((n, a) => n + ANIM_FRAMES[a], 0);
    const { canvas, ctx } = makeCanvas(cols * m.cellW, DIRECTIONS * m.cellH);
    const frames: [string, number, number][] = [];
    for (let dir = 0; dir < DIRECTIONS; dir++) {
      let col = 0;
      for (const anim of ANIMS) {
        for (let f = 0; f < ANIM_FRAMES[anim]; f++, col++) {
          const x = col * m.cellW;
          const y = dir * m.cellH;
          const r = new PuppetRenderer(ctx, x + m.anchorX, y + m.anchorY, (dir * Math.PI) / 4);
          const { parts, pose } = m.build(anim, f);
          r.setPose(pose);
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, m.cellW, m.cellH);
          ctx.clip();
          r.draw(parts);
          ctx.restore();
          frames.push([frameName(anim, f, dir), x, y]);
        }
      }
    }
    const tex = scene.textures.addCanvas(key, canvas);
    if (!tex) continue;
    for (const [name, x, y] of frames) tex.add(name, 0, x, y, m.cellW, m.cellH);
    // HUD portrait: three-quarter view, idle pose.
    const p = makeCanvas(m.cellW, m.cellH);
    const r = new PuppetRenderer(p.ctx, m.anchorX, m.anchorY, Math.PI * 0.35);
    const { parts, pose } = m.build('idle', 0);
    r.setPose(pose);
    r.draw(parts);
    scene.textures.addCanvas(portraitKey(id), trim(p.canvas));
  }
}

/** Crops a canvas to its opaque pixels (plus a small margin). */
function trim(src: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = src.getContext('2d') as CanvasRenderingContext2D;
  const { width: w, height: h } = src;
  const data = ctx.getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 20) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) return src;
  const m = 2;
  const out = makeCanvas(x1 - x0 + 1 + m * 2, y1 - y0 + 1 + m * 2);
  out.ctx.drawImage(src, x0, y0, x1 - x0 + 1, y1 - y0 + 1, m, m, x1 - x0 + 1, y1 - y0 + 1);
  return out.canvas;
}
