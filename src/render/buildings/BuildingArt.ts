import Phaser from 'phaser';
import { TILE_SIZE } from '../../config';
import { BUILDING_DEFS, BuildingDef, BuildingId } from '../../buildings/BuildingDefs';
import { makeRng } from '../../utils/rng';
import { makeCanvas } from '../CanvasUtil';
import { Oblique } from './Oblique';
import { Anchor, BuildingAnchors, BuildingPainter, IRON_PAINTERS } from './BuildingPainters';
import { HORDE_PAINTERS } from './HordePainters';

const MARGIN = 26;
const HEADROOM = 56;

/** Baked art for one building at one tilt. Offsets are view px relative to the footprint's bottom-centre. */
export interface BuildingArtInfo {
  body: string;
  glow: string;
  originX: number;
  originY: number;
  width: number;
  height: number;
  smoke: { x: number; y: number }[];
  lights: { x: number; y: number }[];
  gun?: { x: number; y: number };
}

const cache = new Map<string, BuildingArtInfo>();

function painterFor(def: BuildingDef): BuildingPainter {
  return (def.faction === 'ironvoid' ? IRON_PAINTERS : HORDE_PAINTERS)[def.id];
}

function paint(def: BuildingDef, k: number): { body: HTMLCanvasElement; glow: HTMLCanvasElement; info: Omit<BuildingArtInfo, 'body' | 'glow'> } {
  const S = def.size * TILE_SIZE;
  const top = def.height + HEADROOM;
  const w = S + MARGIN * 2;
  const h = Math.ceil(top + S * k + 12);
  const body = makeCanvas(w, h);
  const glow = makeCanvas(w, h);
  const o = new Oblique(body.ctx, MARGIN, top, k, glow.ctx);
  const anchors: BuildingAnchors = { smoke: [], lights: [] };
  painterFor(def)(o, S, def.height, makeRng(def.id.length * 131 + 7), anchors);
  const bx = MARGIN + S / 2;
  const by = top + S * k;
  const rel = (p: Anchor): { x: number; y: number } => ({ x: o.sx(p.x) - bx, y: o.sy(p.y, p.z) - by });
  return {
    body: body.canvas,
    glow: glow.canvas,
    info: {
      originX: bx / w, originY: by / h, width: w, height: h,
      smoke: anchors.smoke.map(rel), lights: anchors.lights.map(rel), gun: anchors.gun && rel(anchors.gun),
    },
  };
}

/** Returns (baking on first use) the building art for a tilt. */
export function buildingArt(scene: Phaser.Scene, id: BuildingId, k: number): BuildingArtInfo {
  const key = `${id}_${Math.round(k * 100)}`;
  const hit = cache.get(key);
  if (hit && scene.textures.exists(hit.body)) return hit;
  const { body, glow, info } = paint(BUILDING_DEFS[id], k);
  const art: BuildingArtInfo = { ...info, body: `bldv_${key}`, glow: `bldg_${key}` };
  if (!scene.textures.exists(art.body)) scene.textures.addCanvas(art.body, body);
  if (!scene.textures.exists(art.glow)) scene.textures.addCanvas(art.glow, glow);
  cache.set(key, art);
  return art;
}

export function ensureBuildingArt(scene: Phaser.Scene, k: number): void {
  for (const id of Object.keys(BUILDING_DEFS) as BuildingId[]) buildingArt(scene, id, k);
}

export function buildingIconKey(id: BuildingId): string {
  return `bldicon_${id}`;
}

/** Scaffolding lattice for a footprint size (tilt-specific), drawn over buildings under construction. */
export function scaffoldKey(scene: Phaser.Scene, size: number, height: number, k: number): string {
  const key = `scaffold_${size}_${height}_${Math.round(k * 100)}`;
  if (scene.textures.exists(key)) return key;
  const S = size * TILE_SIZE;
  const { canvas, ctx } = makeCanvas(S + 8, height + S * k + 8);
  const o = new Oblique(ctx, 4, height + 4, k);
  for (const y of [4, S - 4]) {
    for (let x = 4; x <= S - 4; x += Math.max(24, S / 5)) o.strut(x, y, 0, x, y, height, 2, 0x8a6a3a);
    for (let z = 12; z < height; z += 16) {
      o.strut(4, y, z, S - 4, y, z, 1.6, 0x9a7a44);
      o.strut(4, y, z, S - 4, y, z + 14, 1, 0x6a5230);
    }
  }
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** Burnt-out ruin sprite (broken walls on a rubble heap) for destroyed buildings. */
export function ruinKey(scene: Phaser.Scene, size: number, k: number, horde: boolean): string {
  const key = `ruin_${size}_${horde ? 'h' : 'i'}_${Math.round(k * 100)}`;
  if (scene.textures.exists(key)) return key;
  const S = size * TILE_SIZE;
  const hgt = 44;
  const { canvas, ctx } = makeCanvas(S + 8, hgt + S * k + 8);
  const o = new Oblique(ctx, 4, hgt + 4, k);
  const rnd = makeRng(size * 17 + (horde ? 5 : 0));
  for (let i = 0; i < 18; i++) {
    o.blob(8 + rnd() * (S - 16), 8 + rnd() * (S - 16), 4, 8 + rnd() * 12, 5 + rnd() * 5, horde ? 0x3a1428 : 0x3a3530);
  }
  for (let i = 0; i < 4; i++) {
    const x = 10 + rnd() * (S - 40);
    const y = 10 + rnd() * (S - 30);
    if (horde) o.strut(x, y, 0, x + (rnd() - 0.5) * 20, y, 16 + rnd() * 20, 4, 0x9a9078);
    else o.box(x, y, 0, 12 + rnd() * 18, 6, 10 + rnd() * 26, 0x4a443e);
  }
  const g = ctx.createRadialGradient(o.sx(S / 2), o.sy(S / 2), 0, o.sx(S / 2), o.sy(S / 2), S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  scene.textures.addCanvas(key, canvas);
  return key;
}

/** HUD icons: the default-tilt body art. */
export function createBuildingIcons(scene: Phaser.Scene, k: number): void {
  for (const id of Object.keys(BUILDING_DEFS) as BuildingId[]) {
    const key = buildingIconKey(id);
    if (scene.textures.exists(key)) continue;
    scene.textures.addCanvas(key, paint(BUILDING_DEFS[id], k).body);
  }
}
