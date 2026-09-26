import * as THREE from 'three';
import type { BuildingId } from '../buildings/BuildingDefs';
import { Kit } from './Kit';

/**
 * Kit-bashed 3D models for every structure. Units: px; origin at the footprint centre on the
 * ground; X east, Y up, Z south (the camera looks from the south). `S` is the footprint edge,
 * `H` the model height (the 2D sprite height scaled to the 3D camera).
 *
 * Iron Void: gothic-industrial ferrocrete and dark steel, gold trim, blue team accents, lit
 * windows. Null Horde: chitin plates, bone spikes, wet biomass, glowing veins and orifices.
 */

export interface BuildingModel {
  kit: Kit;
  /** Turret pivot (px above ground) when the structure has a rotating gun. */
  gunHeight?: number;
}

const STEEL = 0x3b4048;
const STEEL_DARK = 0x24272c;
const FERRO = 0x8c8a86;
const FERRO_DARK = 0x5f5d5a;
const GOLD = 0xc9a044;
const WIN = 0xffc46e;
const CYAN = 0x6ff0ff;
const RED_LIGHT = 0xff4a2a;
const CHITIN = 0x3a1830;
const CHITIN_LIGHT = 0x6a2a52;
const FLESH = 0x8a2a4a;
const BONE = 0xd8ccb0;
const VEIN = 0xb040ff;
const ACID = 0x9aff4a;

/** Darkens a self-lit colour: large glowing surfaces must stay under the bloom budget. */
const dim = (c: number, f: number): number => new THREE.Color(c).multiplyScalar(f).getHex();
const glowBox = (w: number, h: number, d: number): THREE.BufferGeometry => new THREE.BoxGeometry(w, h, d);
const glowBall = (r: number): THREE.BufferGeometry => new THREE.SphereGeometry(r, 10, 8);
const glowCyl = (r: number, h: number): THREE.BufferGeometry => new THREE.CylinderGeometry(r, r, h, 14);

/** Gothic tower: body, trim ring, conical roof, lit slit windows. */
function tower(k: Kit, x: number, z: number, r: number, h: number, team: number): void {
  k.cyl(r, r * 1.12, h, FERRO, [x, h / 2, z], undefined, 10);
  k.cyl(r * 1.18, r * 1.18, 4, GOLD, [x, h, z], undefined, 10);
  k.cone(r * 1.25, h * 0.45, STEEL_DARK, [x, h + h * 0.22, z], undefined, 10);
  k.cyl(0.8, 0.8, h * 0.25, GOLD, [x, h + h * 0.55, z], undefined, 4);
  k.glow(glowBox(3, 9, 1.5), WIN, [x, h * 0.62, z + r + 0.2]);
  k.glow(glowBox(3, 9, 1.5), WIN, [x, h * 0.35, z + r + 0.2]);
  k.box(r * 0.9, 12, 1.2, team, [x, h * 0.82, z + r + 0.6]);
}

/** Row of lit gothic windows on a south face. */
function windows(k: Kit, x0: number, x1: number, y: number, z: number, n: number, h = 14): void {
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
    k.glow(glowBox(5, h, 1.2), WIN, [x, y, z]);
    k.cone(3.2, 5, FERRO_DARK, [x, y + h / 2 + 2.2, z - 0.4], undefined, 4);
  }
}

/** Chitin mound: stacked squashed spheres with ridge plates and spikes. */
function mound(k: Kit, x: number, z: number, r: number, h: number, seed: number): void {
  k.sphere(r, CHITIN, [x, h * 0.35, z], [1, (h * 0.8) / r, 1], 12);
  k.sphere(r * 0.72, CHITIN_LIGHT, [x, h * 0.62, z], [1, (h * 0.6) / r, 1], 10);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + seed;
    const rr = r * 0.85;
    k.cone(r * 0.12, h * 0.55, BONE, [x + Math.cos(a) * rr, h * 0.45, z + Math.sin(a) * rr], [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6], 5);
    k.box(r * 0.3, h * 0.5, 2.5, CHITIN_LIGHT, [x + Math.cos(a + 0.4) * r * 0.9, h * 0.35, z + Math.sin(a + 0.4) * r * 0.9], [0, -a, 0.35]);
  }
}

function veins(k: Kit, x: number, z: number, r: number, y: number, n: number, color = VEIN): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    k.glow(glowBox(r * 0.6, 1.5, 1.5), color, [x + Math.cos(a) * r * 0.8, y, z + Math.sin(a) * r * 0.8], [0, -a, 0.2]);
  }
}

export function buildingModel(id: BuildingId, S: number, H: number, team: number): BuildingModel {
  const k = new Kit();
  const h = S / 2;
  let gunHeight: number | undefined;
  switch (id) {
    // ---------------------------------------------------------------- Iron Void
    case 'stronghold': {
      k.box(S * 0.92, 10, S * 0.92, FERRO_DARK, [0, 5, 0]);
      k.box(S * 0.56, H * 0.7, S * 0.5, FERRO, [0, H * 0.35 + 8, 0]);
      k.box(S * 0.6, 6, S * 0.54, STEEL_DARK, [0, H * 0.7 + 8, 0]);
      k.box(S * 0.62, 2.5, 2.5, GOLD, [0, H * 0.7 + 9.5, S * 0.27]);
      k.box(S * 0.62, 2.5, 2.5, GOLD, [0, H * 0.7 + 9.5, -S * 0.27]);
      for (let i = 0; i < 7; i++) k.box(8, 9, 8, FERRO, [-S * 0.27 + i * S * 0.09, H * 0.7 + 15, S * 0.25]);
      k.box(S * 0.3, H * 0.45, S * 0.3, FERRO_DARK, [0, H * 0.7 + H * 0.22 + 8, -8]);
      k.cone(S * 0.2, H * 0.45, STEEL_DARK, [0, H * 1.15 + 16, -8], undefined, 4);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tower(k, x * S * 0.33, z * S * 0.3, S * 0.09, H * 0.95, team);
      windows(k, -S * 0.24, S * 0.24, H * 0.42, S * 0.25 + 0.3, 5, 18);
      k.box(26, 34, 3, STEEL_DARK, [0, 17 + 8, S * 0.25 + 1]);
      k.torus(14, 2.5, GOLD, [0, H * 0.62, S * 0.25 + 1.5]);
      k.box(4, 30, 1.5, team, [-20, H * 0.5, S * 0.25 + 1]);
      k.box(4, 30, 1.5, team, [20, H * 0.5, S * 0.25 + 1]);
      break;
    }
    case 'generator': {
      k.cyl(h * 0.85, h * 0.95, 10, FERRO_DARK, [0, 5, 0], undefined, 16);
      k.cyl(h * 0.45, h * 0.55, H * 0.8, STEEL, [0, H * 0.4 + 8, 0], undefined, 14);
      for (let i = 0; i < 4; i++) {
        k.torus(h * 0.5, 2.2, GOLD, [0, 18 + i * H * 0.18, 0], [Math.PI / 2, 0, 0]);
        k.glow(glowCyl(h * 0.47, 3), dim(CYAN, 0.35), [0, 24 + i * H * 0.18, 0]);
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        k.box(3, H * 0.55, h * 0.3, STEEL_DARK, [Math.cos(a) * h * 0.62, H * 0.3, Math.sin(a) * h * 0.62], [0, -a, 0]);
      }
      k.glow(glowBall(h * 0.22), dim(CYAN, 0.35), [0, H * 0.85 + 8, 0]);
      k.cyl(3, 3, h * 0.9, STEEL_DARK, [h * 0.7, 12, 0], [0, 0, Math.PI / 2]);
      break;
    }
    case 'depot': {
      k.box(S * 0.8, H * 0.55, S * 0.55, STEEL, [0, H * 0.28, -6]);
      k.cyl(S * 0.28, S * 0.28, S * 0.8, FERRO_DARK, [0, H * 0.55, -6], [0, 0, Math.PI / 2], 12);
      k.box(S * 0.3, H * 0.3, S * 0.25, 0x5a4632, [-S * 0.2, H * 0.15, S * 0.3]);
      k.box(S * 0.25, H * 0.2, S * 0.2, 0x4a3a2a, [S * 0.22, H * 0.1, S * 0.3]);
      k.box(S * 0.3, 3, 2, team, [0, H * 0.35, S * 0.22 - 5]);
      k.glow(glowBox(4, 4, 4), RED_LIGHT, [S * 0.38, H * 0.6, S * 0.22]);
      break;
    }
    case 'barracks': {
      k.box(S * 0.84, H * 0.55, S * 0.6, FERRO, [0, H * 0.28, 0]);
      // Pitched roof: two slanted slabs.
      k.box(S * 0.88, 5, S * 0.4, STEEL_DARK, [0, H * 0.7, -S * 0.12], [-0.55, 0, 0]);
      k.box(S * 0.88, 5, S * 0.4, STEEL_DARK, [0, H * 0.7, S * 0.12], [0.55, 0, 0]);
      for (let i = 0; i < 4; i++) k.box(8, H * 0.5, 10, FERRO_DARK, [-S * 0.36 + i * S * 0.24, H * 0.25, S * 0.32], [0.25, 0, 0]);
      windows(k, -S * 0.3, S * 0.3, H * 0.35, S * 0.3 + 0.3, 4);
      k.box(22, 28, 3, STEEL_DARK, [0, 14, S * 0.3 + 1]);
      k.cyl(5, 6, H * 0.5, FERRO_DARK, [S * 0.3, H * 0.75, -S * 0.15], undefined, 8);
      k.box(10, 26, 1.5, team, [-S * 0.2, H * 0.62, S * 0.3 + 1.5]);
      break;
    }
    case 'mechanis': {
      k.box(S * 0.8, H * 0.5, S * 0.7, STEEL, [0, H * 0.25, 0]);
      k.box(S * 0.84, 6, S * 0.74, GOLD, [0, H * 0.5, 0]);
      // Crane: mast, jib, hook.
      k.box(8, H * 1.1, 8, STEEL_DARK, [-S * 0.3, H * 0.55 + H * 0.3, -S * 0.25]);
      k.box(S * 0.7, 5, 5, STEEL_DARK, [0, H * 1.35, -S * 0.25]);
      k.cyl(0.6, 0.6, H * 0.5, STEEL_DARK, [S * 0.3, H * 1.1, -S * 0.25], undefined, 4);
      k.torus(11, 3, GOLD, [S * 0.1, H * 0.62, S * 0.2], [0, 0, 0]);
      k.box(28, H * 0.4, 3, STEEL_DARK, [0, H * 0.2, S * 0.35 + 1]);
      k.glow(glowBox(22, 3, 1), CYAN, [0, H * 0.42, S * 0.35 + 2.5]);
      break;
    }
    case 'foundry': {
      k.box(S * 0.86, H * 0.6, S * 0.66, FERRO, [0, H * 0.3, 0]);
      k.cyl(S * 0.33, S * 0.33, S * 0.86, STEEL_DARK, [0, H * 0.6, 0], [0, 0, Math.PI / 2], 14);
      k.box(S * 0.46, H * 0.5, 4, STEEL_DARK, [0, H * 0.25, S * 0.33 + 1]);
      for (let i = 0; i < 6; i++) k.box(S * 0.46, 1.5, 1.5, 0xc9a020, [0, 6 + i * H * 0.08, S * 0.33 + 3.2], [0, 0, 0.05]);
      for (const x of [-S * 0.3, S * 0.3]) {
        k.cyl(8, 10, H * 1.1, FERRO_DARK, [x, H * 0.75, -S * 0.2], undefined, 10);
        k.glow(glowCyl(7, 3), 0xff8a3a, [x, H * 1.31, -S * 0.2]);
      }
      k.box(S * 0.2, 12, 1.5, team, [0, H * 0.62, S * 0.33 + 2]);
      break;
    }
    case 'turret':
    case 'derelict': {
      const rust = id === 'derelict';
      k.cyl(h * 0.75, h * 0.9, H * 0.45, rust ? 0x5a3a2a : FERRO, [0, H * 0.22, 0], undefined, 10);
      k.cyl(h * 0.8, h * 0.8, 4, rust ? 0x3a2a20 : GOLD, [0, H * 0.46, 0], undefined, 10);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        k.box(6, H * 0.4, 4, rust ? 0x3a2a20 : STEEL_DARK, [Math.cos(a) * h * 0.82, H * 0.2, Math.sin(a) * h * 0.82], [0, -a, 0]);
      }
      gunHeight = H * 0.5;
      break;
    }
    case 'relay': {
      k.box(S * 0.5, 12, S * 0.5, FERRO_DARK, [0, 6, 0]);
      k.cyl(3, 6, H * 1.1, STEEL, [0, H * 0.55 + 10, 0], undefined, 6);
      for (let i = 0; i < 3; i++) k.box(S * 0.4 - i * 8, 2, 2, STEEL_DARK, [0, H * 0.5 + i * H * 0.22, 0]);
      k.sphere(10, STEEL_DARK, [0, H * 1.18, 6], [1, 1, 0.4], 12);
      k.glow(glowBall(3), RED_LIGHT, [0, H * 1.2 + 12, 0]);
      k.glow(glowBall(2), CYAN, [S * 0.18, H * 0.72, 0]);
      k.box(10, 16, 1.2, team, [0, 24, S * 0.25 + 0.7]);
      break;
    }
    case 'research': {
      k.box(S * 0.76, H * 0.45, S * 0.66, FERRO, [0, H * 0.22, 0]);
      k.sphere(S * 0.3, STEEL, [0, H * 0.45, 0], [1, 0.75, 1], 16);
      k.glow(glowCyl(S * 0.302, 3), dim(CYAN, 0.35), [0, H * 0.5, 0]);
      k.cyl(2, 4, H * 0.6, GOLD, [0, H * 0.95, 0], undefined, 6);
      k.glow(glowBall(4), CYAN, [0, H * 1.27, 0]);
      windows(k, -S * 0.3, S * 0.3, H * 0.2, S * 0.33 + 0.3, 5, 10);
      for (const x of [-S * 0.34, S * 0.34]) tower(k, x, -S * 0.25, S * 0.07, H * 0.8, team);
      break;
    }
    case 'wall': {
      k.box(S * 0.95, H * 0.85, S * 0.5, FERRO_DARK, [0, H * 0.42, 0]);
      k.box(S * 0.98, 4, S * 0.55, STEEL, [0, H * 0.85, 0]);
      for (let i = 0; i < 3; i++) k.cone(2, 9, STEEL_DARK, [-S * 0.3 + i * S * 0.3, H * 0.85 + 6, 0], undefined, 4);
      k.box(S * 0.8, 3, 1.2, 0xc9a020, [0, H * 0.3, S * 0.25 + 0.3]);
      break;
    }
    case 'gate': {
      for (const x of [-S * 0.38, S * 0.38]) {
        k.box(S * 0.2, H * 1.1, S * 0.4, FERRO, [x, H * 0.55, 0]);
        k.cone(S * 0.12, 14, STEEL_DARK, [x, H * 1.1 + 7, 0], undefined, 4);
        k.glow(glowBox(3, 3, 3), RED_LIGHT, [x, H * 0.95, S * 0.2 + 1]);
      }
      k.box(S * 0.6, 8, S * 0.3, STEEL_DARK, [0, H * 1.02, 0]);
      break;
    }
    case 'listening': {
      k.cyl(h * 0.6, h * 0.75, 10, FERRO_DARK, [0, 5, 0], undefined, 8);
      k.box(S * 0.3, H * 0.9, S * 0.3, STEEL, [0, H * 0.45 + 8, 0]);
      k.box(S * 0.42, 8, S * 0.42, FERRO, [0, H * 0.92, 0]);
      for (let i = 0; i < 2; i++) k.cyl(0.6, 0.6, 26, STEEL_DARK, [-6 + i * 12, H * 0.92 + 16, 0], undefined, 4);
      k.glow(glowBox(8, 3, 1), CYAN, [0, H * 0.7, S * 0.15 + 0.5]);
      k.box(S * 0.28, 12, 1, team, [0, H * 0.4, S * 0.15 + 0.4]);
      break;
    }
    case 'minefield': {
      for (let i = 0; i < 4; i++) {
        const x = (i % 2 ? 1 : -1) * S * 0.2;
        const z = (i < 2 ? -1 : 1) * S * 0.2;
        k.cyl(5, 6, 3, STEEL_DARK, [x, 1.5, z], undefined, 10);
        k.glow(glowBall(1.2), RED_LIGHT, [x, 3.5, z]);
      }
      break;
    }
    case 'bunker': {
      k.box(S * 0.8, H * 0.6, S * 0.7, FERRO_DARK, [0, H * 0.3, 0]);
      k.box(S * 0.9, H * 0.25, S * 0.8, FERRO, [0, H * 0.72, 0]);
      k.box(S * 0.6, 5, 2, 0x0a0a0a, [0, H * 0.5, S * 0.35 + 1]);
      for (let i = 0; i < 8; i++) k.sphere(7, 0x6a5a40, [-S * 0.45 + i * S * 0.13, 5, S * 0.45], [1.4, 0.6, 0.9], 6);
      k.box(S * 0.3, 8, 1.2, team, [0, H * 0.72, S * 0.4 + 0.5]);
      break;
    }
    case 'armoury': {
      k.box(S * 0.84, H * 0.7, S * 0.6, STEEL, [0, H * 0.35, 0]);
      k.box(S * 0.88, 6, S * 0.64, GOLD, [0, H * 0.7, 0]);
      for (let i = 0; i < 5; i++) {
        k.cyl(1.4, 1.4, H * 0.45, STEEL_DARK, [-S * 0.3 + i * S * 0.15, H * 0.3, S * 0.31], undefined, 5);
      }
      k.box(S * 0.84, 3, 6, STEEL_DARK, [0, H * 0.55, S * 0.33]);
      tower(k, S * 0.34, -S * 0.2, S * 0.07, H * 1.2, team);
      break;
    }
    case 'hospital': {
      k.box(S * 0.84, H * 0.6, S * 0.64, 0xb8b4ac, [0, H * 0.3, 0]);
      k.box(S * 0.88, 6, S * 0.68, FERRO_DARK, [0, H * 0.6, 0]);
      k.box(S * 0.32, 8, 8, 0xc03028, [0, H * 0.4, S * 0.32 + 4]);
      k.box(8, S * 0.32, 8, 0xc03028, [0, H * 0.4, S * 0.32 + 4], [Math.PI / 2, 0, 0]);
      windows(k, -S * 0.34, S * 0.34, H * 0.2, S * 0.32 + 0.3, 6, 8);
      k.glow(glowBox(6, 6, 6), 0x7aff9a, [S * 0.35, H * 0.7, 0]);
      break;
    }
    case 'sensor': {
      k.box(S * 0.5, 14, S * 0.5, FERRO_DARK, [0, 7, 0]);
      k.cyl(4, 7, H * 0.7, STEEL, [0, H * 0.35 + 12, 0], undefined, 8);
      k.sphere(S * 0.35, STEEL, [0, H * 0.82, 0], [1, 0.35, 1], 16);
      k.cyl(1, 1, 22, GOLD, [0, H * 0.9 + 11, 0], undefined, 5);
      k.glow(glowBall(3), CYAN, [0, H * 0.9 + 23, 0]);
      break;
    }
    case 'shield': {
      k.box(S * 0.6, 10, S * 0.6, FERRO_DARK, [0, 5, 0]);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        k.box(6, H * 0.8, 6, STEEL, [Math.cos(a) * S * 0.22, H * 0.4 + 8, Math.sin(a) * S * 0.22], [Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15]);
      }
      k.glow(glowBall(S * 0.14), dim(0x7ad0ff, 0.6), [0, H * 0.9, 0]);
      k.torus(S * 0.2, 2, GOLD, [0, H * 0.9, 0], [Math.PI / 2, 0, 0]);
      break;
    }
    case 'missile': {
      k.box(S * 0.7, H * 0.35, S * 0.7, FERRO_DARK, [0, H * 0.17, 0]);
      k.box(S * 0.55, H * 0.45, S * 0.45, STEEL, [0, H * 0.55, 0], [-0.45, 0, 0]);
      for (let i = 0; i < 6; i++) k.cyl(3.5, 3.5, 2, 0x111111, [-S * 0.14 + (i % 3) * S * 0.14, H * 0.66 + Math.floor(i / 3) * 10, S * 0.13 + Math.floor(i / 3) * 4], [1.1, 0, 0], 8);
      k.box(S * 0.2, 6, 1.2, team, [0, H * 0.25, S * 0.35 + 0.5]);
      break;
    }
    case 'beacon': {
      k.cyl(h * 0.7, h * 0.8, 16, FERRO_DARK, [0, 8, 0], undefined, 8);
      k.cyl(h * 0.18, h * 0.3, H * 1.1, FERRO, [0, H * 0.55 + 16, 0], undefined, 8);
      for (let i = 0; i < 3; i++) k.torus(h * 0.28 - i * 3, 2, GOLD, [0, H * 0.4 + i * H * 0.25, 0], [Math.PI / 2, 0, 0]);
      k.cone(h * 0.2, 24, STEEL_DARK, [0, H * 1.1 + 28, 0], undefined, 8);
      k.glow(glowBall(6), 0x9ad8ff, [0, H * 1.1 + 18, 0]);
      for (const x of [-1, 1]) tower(k, x * S * 0.3, S * 0.2, S * 0.06, H * 0.55, team);
      break;
    }
    // ---------------------------------------------------------------- Null Horde
    case 'hive': {
      mound(k, 0, 0, S * 0.42, H * 1.1, 0.2);
      for (const [x, z, s] of [[-0.3, -0.25, 0.8], [0.3, -0.2, 0.7], [0.25, 0.28, 0.6], [-0.28, 0.25, 0.65]] as [number, number, number][]) {
        k.cone(S * 0.07 * s, H * 1.1 * s, BONE, [x * S, H * 0.55 * s + H * 0.2, z * S], [x * 0.3, 0, -z * 0.3], 6);
        k.sphere(S * 0.12 * s, FLESH, [x * S, H * 0.28, z * S], [1, 0.8, 1], 8);
      }
      veins(k, 0, 0, S * 0.42, H * 0.5, 8);
      k.glow(glowBall(S * 0.07), ACID, [0, H * 0.55, S * 0.36]);
      k.glow(glowBall(S * 0.05), VEIN, [0, H * 1.05, 0]);
      break;
    }
    case 'spire': {
      k.sphere(h * 0.7, CHITIN, [0, 10, 0], [1, 0.5, 1], 10);
      for (let i = 0; i < 5; i++) {
        const s = 1 - i * 0.16;
        k.cyl(h * 0.28 * s, h * 0.34 * s, H * 0.22, i % 2 ? CHITIN_LIGHT : CHITIN, [Math.sin(i) * 4, 16 + i * H * 0.2, Math.cos(i) * 3], [0.08 * Math.sin(i), 0, 0.08 * Math.cos(i)], 8);
      }
      k.glow(glowBall(h * 0.14), VEIN, [0, H * 1.12, 0]);
      veins(k, 0, 0, h * 0.5, H * 0.35, 5);
      break;
    }
    case 'nest': {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        k.sphere(h * 0.32, i % 2 ? FLESH : CHITIN_LIGHT, [Math.cos(a) * h * 0.45, H * 0.3, Math.sin(a) * h * 0.45], [1, 1.3, 1], 10);
      }
      k.sphere(h * 0.4, FLESH, [0, H * 0.5, 0], [1, 1.4, 1], 12);
      k.glow(glowBall(h * 0.12), ACID, [0, H * 0.85, 0]);
      break;
    }
    case 'brood': {
      k.torus(h * 0.65, h * 0.2, CHITIN, [0, 6, 0], [Math.PI / 2, 0, 0]);
      k.cyl(h * 0.55, h * 0.4, 6, 0x1a0a14, [0, 2, 0], undefined, 16);
      k.glow(glowCyl(h * 0.45, 1), dim(0x7a30c0, 0.4), [0, 4, 0]);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        k.cone(h * 0.08, H * 1.2, BONE, [Math.cos(a) * h * 0.78, H * 0.5, Math.sin(a) * h * 0.78], [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5], 5);
      }
      break;
    }
    case 'maw': {
      mound(k, 0, -S * 0.08, S * 0.36, H * 0.9, 1.1);
      k.torus(S * 0.18, 5, FLESH, [0, H * 0.4, S * 0.24], [0, 0, 0]);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        k.cone(2.5, 12, BONE, [Math.cos(a) * S * 0.16, H * 0.4 + Math.sin(a) * S * 0.16, S * 0.26], [Math.PI / 2 + Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6], 4);
      }
      k.glow(glowBall(S * 0.07), 0xff5a30, [0, H * 0.4, S * 0.22]);
      break;
    }
    case 'vat': {
      k.cyl(S * 0.4, S * 0.44, H * 0.35, CHITIN, [0, H * 0.17, 0], undefined, 16);
      k.sphere(S * 0.34, 0x4a7a3a, [0, H * 0.5, 0], [1, 0.8, 1], 16);
      k.glow(glowBall(S * 0.2), dim(ACID, 0.45), [0, H * 0.55, 0]);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        k.cone(S * 0.04, H * 0.9, BONE, [Math.cos(a) * S * 0.4, H * 0.55, Math.sin(a) * S * 0.4], [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35], 5);
      }
      break;
    }
    case 'spine': {
      k.sphere(h * 0.55, CHITIN, [0, 8, 0], [1, 0.6, 1], 10);
      k.cyl(h * 0.12, h * 0.3, H * 0.9, CHITIN_LIGHT, [0, H * 0.45 + 6, 0], undefined, 7);
      k.sphere(h * 0.26, FLESH, [0, H * 0.95, 0], [1, 1.2, 1], 10);
      gunHeight = H * 0.95;
      veins(k, 0, 0, h * 0.4, 14, 4);
      break;
    }
    case 'thornwall': {
      for (let i = 0; i < 5; i++) {
        const x = -S * 0.36 + i * S * 0.18;
        k.cone(4, H * (0.8 + (i % 2) * 0.3), BONE, [x, H * 0.4, (i % 2) * 5 - 2.5], [(i % 2 ? 0.25 : -0.25), 0, (i - 2) * 0.1], 5);
      }
      k.box(S * 0.9, H * 0.3, S * 0.4, CHITIN, [0, H * 0.15, 0]);
      break;
    }
    case 'sporenode': {
      k.cyl(h * 0.12, h * 0.2, H * 0.7, CHITIN_LIGHT, [0, H * 0.35, 0], undefined, 7);
      k.sphere(h * 0.55, FLESH, [0, H * 0.8, 0], [1, 0.45, 1], 12);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        k.glow(glowBall(2), ACID, [Math.cos(a) * h * 0.4, H * 0.76, Math.sin(a) * h * 0.4]);
      }
      k.sphere(h * 0.5, CHITIN, [0, 6, 0], [1, 0.4, 1], 10);
      break;
    }
    case 'sporemine': {
      k.sphere(S * 0.2, FLESH, [0, 3, 0], [1, 0.5, 1], 10);
      k.glow(glowBall(2), ACID, [0, 6, 0]);
      break;
    }
    case 'evolution': {
      k.torus(h * 0.62, h * 0.22, CHITIN, [0, 8, 0], [Math.PI / 2, 0, 0]);
      k.glow(glowCyl(h * 0.52, 2), dim(0x6a3aff, 0.35), [0, 6, 0]);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        k.cyl(h * 0.06, h * 0.12, H * 0.9, CHITIN_LIGHT, [Math.cos(a) * h * 0.72, H * 0.45, Math.sin(a) * h * 0.72], [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3], 6);
        k.glow(glowBall(4), VEIN, [Math.cos(a) * h * 0.82, H * 0.92, Math.sin(a) * h * 0.82]);
      }
      break;
    }
    case 'pool': {
      k.torus(h * 0.66, h * 0.18, CHITIN_LIGHT, [0, 6, 0], [Math.PI / 2, 0, 0]);
      k.glow(glowCyl(h * 0.58, 2), dim(0x6aff9a, 0.3), [0, 5, 0]);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        k.sphere(h * 0.14, FLESH, [Math.cos(a) * h * 0.72, 12, Math.sin(a) * h * 0.72], [1, 1.3, 1], 8);
      }
      break;
    }
    case 'organ': {
      k.sphere(h * 0.45, CHITIN, [0, 8, 0], [1, 0.5, 1], 10);
      k.cyl(h * 0.08, h * 0.16, H * 0.85, FLESH, [0, H * 0.42 + 4, 0], [0.08, 0, 0.1], 7);
      k.sphere(h * 0.28, BONE, [2, H * 0.92, 2], [1, 1, 1], 14);
      k.glow(glowBall(h * 0.13), 0xff3a3a, [2, H * 0.92, 2 + h * 0.22]);
      break;
    }
    case 'acidspire': {
      k.sphere(h * 0.55, CHITIN, [0, 8, 0], [1, 0.6, 1], 10);
      k.cyl(h * 0.15, h * 0.35, H * 0.8, CHITIN_LIGHT, [0, H * 0.4 + 6, 0], undefined, 8);
      k.sphere(h * 0.32, 0x4a7a3a, [0, H * 0.85, 0], [1, 1.3, 1], 12);
      k.glow(glowBall(h * 0.2), dim(ACID, 0.6), [0, H * 0.88, 0]);
      break;
    }
    case 'portal': {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        k.cone(h * 0.1, H * 1.1, BONE, [Math.cos(a) * h * 0.72, H * 0.5, Math.sin(a) * h * 0.72], [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5], 6);
      }
      k.torus(h * 0.62, h * 0.1, CHITIN, [0, 6, 0], [Math.PI / 2, 0, 0]);
      k.glow(glowCyl(h * 0.52, 1.5), dim(0xd060ff, 0.35), [0, 5, 0]);
      k.glow(glowBall(h * 0.12), 0xd060ff, [0, H * 0.75, 0]);
      break;
    }
    default: {
      k.box(S * 0.7, H * 0.6, S * 0.7, FERRO, [0, H * 0.3, 0]);
    }
  }
  return { kit: k, gunHeight };
}

/** Rotating gun for turrets (Iron Void autocannon, Horde spine launcher). Points along +X. */
export function gunModel(horde: boolean, rust = false): Kit {
  const k = new Kit();
  if (horde) {
    k.sphere(9, FLESH, [0, 0, 0], [1.2, 0.9, 1], 10);
    k.cone(4, 22, BONE, [14, 0, 0], [0, 0, -Math.PI / 2], 6);
  } else {
    const body = rust ? 0x5a3a2a : STEEL;
    k.box(22, 12, 18, body, [2, 0, 0]);
    k.box(10, 4, 14, rust ? 0x3a2a20 : GOLD, [2, 7, 0]);
    k.cyl(2.2, 2.6, 30, STEEL_DARK, [24, 0, -4], [0, 0, Math.PI / 2], 8);
    k.cyl(2.2, 2.6, 30, STEEL_DARK, [24, 0, 4], [0, 0, Math.PI / 2], 8);
    k.glow(new THREE.BoxGeometry(2, 2, 6), RED_LIGHT, [-9, 3, 0]);
  }
  return k;
}
