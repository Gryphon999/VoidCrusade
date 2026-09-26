import * as THREE from 'three';
import type { PropKind } from '../render/PropArt';
import { Kit } from './Kit';

export const PROP_VARIANTS_3D = 3;

/** One placed prop, as scattered by PropSystem (same positions in 2D and 3D). */
export interface PropInstance {
  kind: PropKind;
  variant: number;
  x: number;
  y: number;
  /** Yaw (radians) and uniform scale. */
  rot: number;
  scale: number;
}

const BARK = 0x2b241f;
const BONE = 0xd6ccb4;
const STONE = 0x7d7a74;
const STONE_DARK = 0x4d4a46;
const RUST = 0x5a3322;
const CHAR = 0x1e1b19;
const CLOTH = 0x7a1a18;
const GOLD = 0xb8923a;
const WOOD = 0x5a4632;
const IRON = 0x3a3d42;

/** Builds one prop model (px units, feet at the origin). */
function build(kind: PropKind, v: number): Kit {
  const k = new Kit();
  const r = (i: number): number => {
    const s = Math.sin((v + 1) * 91.7 + i * 17.3) * 43758.5453;
    return s - Math.floor(s);
  };
  switch (kind) {
    case 'tree': {
      // Dead, gnarled tree: tapered trunk in two bent segments, crooked branches.
      const h = 62 + v * 10;
      k.cyl(3.2, 5.5, h * 0.55, BARK, [0, h * 0.27, 0], [0, 0, 0.08], 7);
      k.cyl(2, 3.2, h * 0.5, BARK, [1.8, h * 0.74, 0.4], [0.05, 0, -0.14], 6);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + r(i);
        const y = h * (0.5 + r(i + 7) * 0.4);
        const len = 16 + r(i + 3) * 16;
        k.cyl(0.6, 1.6, len, BARK, [Math.cos(a) * len * 0.35, y + len * 0.2, Math.sin(a) * len * 0.35], [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9], 5);
      }
      k.rock(6, 0x3a3029, [0, 1, 0], v + 3, 0.35);
      break;
    }
    case 'skulls': {
      // Trophy pole with a skull, a bone crossbar and a pile of skulls at its foot.
      k.cyl(1.4, 1.8, 46, WOOD, [0, 23, 0], undefined, 6);
      k.box(22, 2.4, 2.4, BONE, [0, 36, 0], [0, 0, 0.12]);
      k.sphere(4.6, BONE, [0, 49, 0], [1, 1.05, 1.1]);
      k.box(5, 2.6, 5, BONE, [0, 45, 1.2]);
      for (let i = 0; i < 5 + v; i++) {
        const a = r(i) * Math.PI * 2;
        const d = 3 + r(i + 5) * 8;
        k.sphere(3.4, BONE, [Math.cos(a) * d, 3 + (i % 2) * 3, Math.sin(a) * d], [1, 1, 1.1], 6);
      }
      break;
    }
    case 'banner': {
      // Tall standard: pole, crossbar, heavy tattered cloth with a gold trim, and a finial.
      const h = 92;
      k.cyl(1.6, 2.2, h, IRON, [0, h / 2, 0], undefined, 6);
      k.box(30, 2.2, 2.2, GOLD, [0, h - 8, 0]);
      k.cone(3, 8, GOLD, [0, h + 4, 0], undefined, 6);
      const cloth = new THREE.PlaneGeometry(26, 44, 6, 10);
      const p = cloth.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const x = p.getX(i);
        // Hanging folds and a ragged bottom edge.
        p.setZ(i, Math.sin(x * 0.35 + v) * 1.6 + Math.sin(y * 0.2) * 1.2);
        if (y < -18) p.setY(i, y + (Math.sin(x * 1.3 + v * 2) + 1) * 3);
      }
      cloth.computeVertexNormals();
      k.custom(cloth, CLOTH, [0, h - 32, 1.4]);
      k.box(26, 3, 1.2, GOLD, [0, h - 11, 1.6]);
      k.rock(5, STONE_DARK, [0, 1, 0], v, 0.4);
      break;
    }
    case 'wreck': {
      // Burnt-out battle tank: tilted hull, twisted gun, a thrown track and scattered plates.
      const tilt = -0.12 + r(1) * 0.24;
      k.box(58, 16, 32, CHAR, [0, 10, 0], [tilt, 0.2 * v, 0.08]);
      k.box(46, 6, 36, RUST, [0, 3, 0], [tilt, 0.2 * v, 0.08]);
      k.box(24, 12, 20, CHAR, [-4, 23, 0], [0, 0.6 + v, 0.15]);
      k.cyl(2, 2.6, 36, IRON, [18, 25, 4], [0, 0.6 + v, Math.PI / 2 - 0.35], 6);
      k.box(50, 4, 7, IRON, [2, 2, 22], [0, 0.35, 0]);
      for (let i = 0; i < 4; i++) k.box(8 + r(i) * 8, 1.5, 6 + r(i + 1) * 6, RUST, [-30 + r(i + 2) * 60, 1, -24 + r(i + 3) * 48], [0, r(i) * 3, 0.2]);
      break;
    }
    case 'rocks': {
      const n = 3 + v;
      for (let i = 0; i < n; i++) {
        const a = r(i) * Math.PI * 2;
        const d = i === 0 ? 0 : 8 + r(i + 4) * 12;
        const s = i === 0 ? 14 + v * 3 : 5 + r(i + 8) * 8;
        k.rock(s, i % 2 ? STONE : STONE_DARK, [Math.cos(a) * d, s * 0.35, Math.sin(a) * d], v * 13 + i, 0.72);
      }
      break;
    }
    case 'wall': {
      // Ruined gothic wall: two piers, a pointed arch, a jagged broken top and a buttress.
      const w = 60;
      const h = 58 + v * 8;
      k.box(12, h, 12, STONE, [-w / 2 + 6, h / 2, 0]);
      k.box(12, h * 0.8, 12, STONE, [w / 2 - 6, (h * 0.8) / 2, 0]);
      k.torus(18, 4.5, STONE, [0, h * 0.52, 0], [0, 0, 0], Math.PI);
      k.box(w - 24, h * 0.32, 10, STONE, [0, h * 0.84, 0]);
      for (let i = 0; i < 5; i++) k.box(6 + r(i) * 6, 6 + r(i + 1) * 10, 10, STONE_DARK, [-w / 2 + 8 + i * 11, h + 2 - r(i + 2) * 12, 0], [0, 0, (r(i + 3) - 0.5) * 0.5]);
      k.box(10, h * 0.6, 18, STONE_DARK, [-w / 2 - 2, h * 0.3, -8], [0.18, 0, 0]);
      for (let i = 0; i < 6; i++) k.rock(3 + r(i + 5) * 5, STONE_DARK, [-w / 2 + r(i) * w, 2, 10 + r(i + 9) * 12], v * 7 + i, 0.6);
      break;
    }
    case 'pillar': {
      // Broken column: plinth, fluted shaft cut at an angle, capital lying at its foot.
      const h = 48 + v * 10;
      k.box(18, 6, 18, STONE_DARK, [0, 3, 0]);
      k.cyl(6.5, 7.2, h, STONE, [0, 6 + h / 2, 0], undefined, 10);
      k.cyl(6.5, 6.5, 8, STONE, [0, 6 + h + 2, 0], [0.35, 0, 0.2], 10);
      k.box(16, 7, 16, STONE, [14, 3.5, 10], [0.2, 0.7, 0.4]);
      k.cyl(6.5, 6.5, 22, STONE, [-15, 6.5, 8], [0, 0.5, Math.PI / 2], 10);
      break;
    }
    case 'barrels' as PropKind: {
      // Fuel drums: rusted, with a hazard band and a leaking puddle.
      const spots: [number, number][] = [[-8, -4], [7, -6], [0, 8], [12, 7]];
      spots.slice(0, 3 + (v % 2)).forEach(([x, z], i) => {
        k.cyl(7, 7, 19, i % 2 ? 0x8a3a1a : 0x6e2e18, [x, 9.5, z], undefined, 12);
        k.cyl(7.3, 7.3, 3, 0xc9a032, [x, 13, z], undefined, 12);
        k.cyl(7.2, 7.2, 1.2, 0x2a2420, [x, 19.2, z], undefined, 12);
      });
      k.cyl(16, 16, 0.6, 0x15110e, [2, 0.3, 2], undefined, 14);
      break;
    }
    case 'crates': {
      // Supply crates with iron bands, a barrel beside them.
      const n = 2 + (v % 2);
      for (let i = 0; i < n; i++) {
        const y = i < 2 ? 7 : 21;
        const x = i < 2 ? i * 16 - 8 : 0;
        k.box(14, 14, 14, WOOD, [x, y, 0], [0, r(i) * 0.4, 0]);
        k.box(14.6, 2, 14.6, IRON, [x, y + 4, 0], [0, r(i) * 0.4, 0]);
        k.box(14.6, 2, 14.6, IRON, [x, y - 4, 0], [0, r(i) * 0.4, 0]);
      }
      k.cyl(6, 6, 16, RUST, [18, 8, 8], undefined, 10);
      k.torus(6.1, 0.8, IRON, [18, 12, 8], [Math.PI / 2, 0, 0]);
      break;
    }
  }
  return k;
}

interface Batch {
  solid: THREE.InstancedMesh;
  glow: THREE.InstancedMesh | null;
}

/** Instanced 3D props: one batch per (kind, variant). */
export class Props3D {
  private batches = new Map<string, Batch>();
  private mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.08, flatShading: false });
  private glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

  constructor(private scene: THREE.Scene, private shadows: boolean) {}

  /** Rebuilds all prop instances (props only change when a building clears its footprint). */
  set(list: PropInstance[], heightAt: (x: number, y: number) => number): void {
    const groups = new Map<string, PropInstance[]>();
    for (const p of list) {
      const key = `${p.kind}:${p.variant % PROP_VARIANTS_3D}`;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = []));
      g.push(p);
    }
    for (const [key, b] of this.batches) {
      if (!groups.has(key)) {
        b.solid.count = 0;
        if (b.glow) b.glow.count = 0;
      }
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [key, items] of groups) {
      let b = this.batches.get(key);
      if (!b || b.solid.instanceMatrix.count < items.length) {
        if (b) this.scene.remove(b.solid);
        const [kind, v] = key.split(':');
        const geo = build(kind as PropKind, Number(v)).build();
        const solid = new THREE.InstancedMesh(geo.solid, this.mat, items.length + 8);
        solid.castShadow = this.shadows;
        solid.receiveShadow = this.shadows;
        this.scene.add(solid);
        let glow: THREE.InstancedMesh | null = null;
        if (geo.glow) {
          glow = new THREE.InstancedMesh(geo.glow, this.glowMat, items.length + 8);
          this.scene.add(glow);
        }
        b = { solid, glow };
        this.batches.set(key, b);
      }
      items.forEach((p, i) => {
        q.setFromAxisAngle(up, p.rot);
        m.compose(new THREE.Vector3(p.x, heightAt(p.x, p.y) - 1, p.y), q, new THREE.Vector3(p.scale, p.scale, p.scale));
        b.solid.setMatrixAt(i, m);
        b.glow?.setMatrixAt(i, m);
      });
      b.solid.count = items.length;
      b.solid.instanceMatrix.needsUpdate = true;
      b.solid.computeBoundingSphere();
      if (b.glow) {
        b.glow.count = items.length;
        b.glow.instanceMatrix.needsUpdate = true;
        b.glow.computeBoundingSphere();
      }
    }
  }

  dispose(): void {
    for (const b of this.batches.values()) {
      b.solid.geometry.dispose();
      b.glow?.geometry.dispose();
    }
    this.mat.dispose();
    this.glowMat.dispose();
  }
}
