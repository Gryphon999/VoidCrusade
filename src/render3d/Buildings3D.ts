import * as THREE from 'three';
import { TILE_SIZE } from '../config';
import type { Building } from '../buildings/Building';
import type { Ruin } from '../units/WreckSystem';
import { buildingModel, gunModel } from './BuildingModels';
import { Kit } from './Kit';
import { surfaceMaterial } from './Materials3D';
import { HEIGHT_SCALE } from './Units3D';
import type { Spot } from './Lights3D';

/** Models are built at this height scale; live tilt changes rescale them on Y. */
const BUILD_SCALE = 1.3;
const TEAM = { player: 0x2f6fe8, enemy: 0xc8302a };

interface Model {
  solid: THREE.BufferGeometry;
  glow: THREE.BufferGeometry | null;
  gunHeight?: number;
}

interface Entry {
  b: Building;
  group: THREE.Group;
  solid: THREE.Mesh;
  glow: THREE.Mesh | null;
  mat: THREE.MeshStandardMaterial;
  clip: THREE.Plane;
  gun?: THREE.Group;
  door?: THREE.Mesh;
  doorY: number;
  scaffold?: THREE.Mesh;
  weld?: THREE.Mesh;
  /** Destruction: seconds since the building was removed (collapse animation). */
  dying: number;
  tilt: THREE.Vector3;
}

/** Lifts vertex colours of self-lit parts above 1.0 so the bloom pass catches them. */
function hot(g: THREE.BufferGeometry | null, k = 2.2): THREE.BufferGeometry | null {
  const c = g?.getAttribute('color');
  if (c) {
    const a = c.array as Float32Array;
    for (let i = 0; i < a.length; i++) a[i] *= k;
  }
  return g;
}

/**
 * Every structure as a 3D model: Iron Void buildings rise inside scaffolding (a clipping plane
 * sweeps up with a welding seam), Horde structures swell out of the ground; hurt buildings
 * darken and smoulder, turret guns track their targets, gates lift for friendly troops, and a
 * destroyed building slumps and sinks before its rubble (also 3D) takes its place.
 */
export class Buildings3D {
  private models = new Map<string, Model>();
  private entries = new Map<number, Entry>();
  private ruins = new Map<Ruin, THREE.Mesh>();
  private glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  private weldMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.9, 0.35), toneMapped: false });
  private scaffoldMat = surfaceMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.6 }), 'metal', 8);
  private ruinMat = surfaceMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.05, flatShading: true }), 'stone');
  private gunGeos = new Map<string, { solid: THREE.BufferGeometry; glow: THREE.BufferGeometry | null }>();
  private scaffolds = new Map<string, THREE.BufferGeometry>();
  private ruinGeos = new Map<string, THREE.BufferGeometry>();
  private time = 0;

  constructor(private scene: THREE.Scene, private shadows: boolean) {}

  private model(b: Building): Model {
    const team = b.def.neutral ? 0x6a6a6a : TEAM[b.owner];
    const key = `${b.def.id}:${team}`;
    let m = this.models.get(key);
    if (!m) {
      const S = b.def.size * TILE_SIZE;
      const bm = buildingModel(b.def.id, S, b.def.height * BUILD_SCALE, team);
      const built = bm.kit.build();
      m = { solid: built.solid, glow: hot(built.glow), gunHeight: bm.gunHeight };
      this.models.set(key, m);
    }
    return m;
  }

  private gun(horde: boolean, rust: boolean): { solid: THREE.BufferGeometry; glow: THREE.BufferGeometry | null } {
    const key = `${horde}:${rust}`;
    let g = this.gunGeos.get(key);
    if (!g) {
      const built = gunModel(horde, rust).build();
      g = { solid: built.solid, glow: hot(built.glow) };
      this.gunGeos.set(key, g);
    }
    return g;
  }

  /** Steel scaffolding cage: poles, rails every 16 px and cross braces, per footprint and height. */
  private scaffold(size: number, height: number): THREE.BufferGeometry {
    const key = `${size}:${height}`;
    let g = this.scaffolds.get(key);
    if (g) return g;
    const k = new Kit();
    const S = size * TILE_SIZE * 0.98;
    const H = height * BUILD_SCALE * 1.08;
    const h = S / 2;
    const poles = Math.max(2, size + 1);
    const pole = 0x5a5f66;
    const rail = 0x8a6a2a;
    for (let i = 0; i < poles; i++) {
      const t = -h + (S * i) / (poles - 1);
      for (const [x, z] of [[t, -h], [t, h], [-h, t], [h, t]]) k.box(2, H, 2, pole, [x, H / 2, z]);
    }
    for (let y = 14; y < H; y += 16) {
      k.box(S, 1.6, 1.6, rail, [0, y, h]);
      k.box(S, 1.6, 1.6, rail, [0, y, -h]);
      k.box(1.6, 1.6, S, rail, [h, y, 0]);
      k.box(1.6, 1.6, S, rail, [-h, y, 0]);
      // Walk boards on the south face.
      k.box(S, 1, 6, 0x6a5238, [0, y - 1, h + 3]);
    }
    // Diagonal braces on the visible faces.
    const len = Math.hypot(S / (poles - 1), 16);
    const ang = Math.atan2(16, S / (poles - 1));
    for (let y = 14; y + 16 < H; y += 32) {
      for (let i = 0; i < poles - 1; i++) {
        const x = -h + (S * (i + 0.5)) / (poles - 1);
        k.box(len, 1.2, 1.2, pole, [x, y + 8, h + 0.5], [0, 0, (i % 2 ? 1 : -1) * ang]);
      }
    }
    g = k.build().solid;
    this.scaffolds.set(key, g);
    return g;
  }

  /** Rubble heap: broken slabs, beams and scorched rocks (Iron Void) or burst chitin (Horde). */
  private ruinGeo(r: Ruin, horde: boolean, variant: number): THREE.BufferGeometry {
    const size = Math.round((r.radius * 2) / TILE_SIZE);
    const key = `${size}:${horde}:${variant}`;
    let g = this.ruinGeos.get(key);
    if (g) return g;
    const k = new Kit();
    const R = r.radius * 0.95;
    let s = variant * 7919 + size * 31;
    const rnd = (): number => {
      s = (s * 16807) % 2147483647;
      return (s % 10000) / 10000;
    };
    const base = horde ? 0x2a1424 : 0x3a3633;
    const light = horde ? 0x5a2a48 : 0x6a6560;
    const charred = 0x161413;
    k.rock(R * 0.55, base, [0, 0, 0], variant + 1, 0.32);
    const n = 6 + size * 4;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * R * 0.8;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      const pick = rnd();
      if (horde) {
        if (pick < 0.4) k.cone(3 + rnd() * 3, 12 + rnd() * 18, 0xcfc2a4, [x, 4, z], [rnd() - 0.5, 0, rnd() - 0.5], 5);
        else k.sphere(5 + rnd() * 8, pick < 0.7 ? light : base, [x, 2, z], [1, 0.45, 1], 7);
      } else if (pick < 0.35) {
        // A toppled wall slab.
        k.box(10 + rnd() * 18, 4 + rnd() * 4, 8 + rnd() * 12, pick < 0.2 ? light : base, [x, 4 + rnd() * 6, z], [rnd() * 0.8 - 0.4, rnd() * 3, rnd() * 0.8 - 0.4]);
      } else if (pick < 0.55) {
        // Bent steel beam sticking out.
        k.box(2.5, 18 + rnd() * 20, 2.5, 0x2a2c30, [x, 10, z], [rnd() * 1.2 - 0.6, 0, rnd() * 1.2 - 0.6]);
      } else {
        k.rock(4 + rnd() * 7, rnd() < 0.5 ? charred : base, [x, 2, z], i + variant * 13, 0.6);
      }
    }
    // A surviving corner of wall for silhouette.
    if (!horde && size >= 2) k.box(R * 0.35, 20 + size * 8, 6, light, [-R * 0.45, 10 + size * 4, -R * 0.3], [0, 0.3, 0.12]);
    g = k.build().solid;
    this.ruinGeos.set(key, g);
    return g;
  }

  private create(b: Building): Entry {
    const m = this.model(b);
    const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
    const horde = b.def.faction === 'nullhorde';
    const mat = surfaceMaterial(new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: horde ? 0.5 : 0.62, metalness: horde ? 0.1 : 0.35,
      clippingPlanes: [clip], clipShadows: true,
    }), horde ? 'organic' : 'metal', 16);
    if (b.def.stealth) {
      mat.transparent = true;
      mat.opacity = 0.55;
    }
    const group = new THREE.Group();
    const solid = new THREE.Mesh(m.solid, mat);
    solid.castShadow = this.shadows;
    solid.receiveShadow = this.shadows;
    group.add(solid);
    const glow = m.glow ? new THREE.Mesh(m.glow, this.glowMat) : null;
    if (glow) group.add(glow);
    const e: Entry = { b, group, solid, glow, mat, clip, doorY: 0, dying: -1, tilt: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize() };
    if (b.def.attack && b.def.attack.projectile !== 'rocket' && b.def.attack.projectile !== 'acidlob') {
      const gg = this.gun(b.def.faction === 'nullhorde', b.def.id === 'derelict');
      const gun = new THREE.Group();
      const gs = new THREE.Mesh(gg.solid, mat);
      gs.castShadow = this.shadows;
      gun.add(gs);
      if (gg.glow) gun.add(new THREE.Mesh(gg.glow, this.glowMat));
      gun.position.y = m.gunHeight ?? b.def.height * BUILD_SCALE * 0.9;
      const s = b.def.size >= 2 ? 1.25 : 1;
      gun.scale.setScalar(s);
      group.add(gun);
      e.gun = gun;
    }
    if (b.def.gate) {
      const S = b.def.size * TILE_SIZE;
      const H = b.def.height * BUILD_SCALE;
      const k = new Kit();
      k.box(S * 0.56, H * 0.92, 5, 0x4a5058, [0, H * 0.46, 0]);
      for (let i = 0; i < 5; i++) k.box(S * 0.56, 2, 6, 0x2a2e34, [0, 8 + i * H * 0.18, 0]);
      for (let i = 0; i < 7; i++) k.box(S * 0.08, 5, 6.2, i % 2 ? 0x1a1a1a : 0xd8b030, [-S * 0.24 + i * S * 0.08, 3, 0]);
      const door = new THREE.Mesh(k.build().solid, mat);
      door.castShadow = this.shadows;
      group.add(door);
      e.door = door;
    }
    this.scene.add(group);
    return e;
  }

  private place(e: Entry, heightAt: (x: number, y: number) => number): void {
    const b = e.b;
    const r = b.radius * 0.7;
    // Sit on the lowest corner so no part floats over a slope.
    const y = Math.min(heightAt(b.x, b.y), heightAt(b.x - r, b.y - r), heightAt(b.x + r, b.y - r), heightAt(b.x - r, b.y + r), heightAt(b.x + r, b.y + r));
    e.group.position.set(b.x, y, b.y);
  }

  private updateEntry(e: Entry, dt: number): void {
    const b = e.b;
    const view = b.view;
    e.group.visible = view.isShown;
    const ys = HEIGHT_SCALE.value / BUILD_SCALE;
    const horde = b.def.faction === 'nullhorde';
    const H = b.def.height * BUILD_SCALE * ys;
    const base = e.group.position.y;
    if (b.state === 'constructing') {
      const p = b.progress;
      if (horde) {
        // Grows: swells from a small wet bud, pulsing.
        const g = 0.3 + 0.7 * p + Math.sin(this.time * 5) * 0.02;
        e.group.scale.set(g, g * ys, g);
        e.clip.constant = 1e6;
        e.mat.color.setRGB(1.25, 0.85, 1.05);
      } else {
        e.group.scale.set(1, ys, 1);
        const cut = 4 + (H - 4) * (0.08 + 0.92 * p);
        e.clip.constant = base + cut;
        e.mat.color.setRGB(0.9, 0.9, 0.95);
        if (!e.scaffold) {
          // Show the inner walls of the cut so the half-built shell reads as solid.
          e.mat.side = THREE.DoubleSide;
          e.mat.needsUpdate = true;
          e.scaffold = new THREE.Mesh(this.scaffold(b.def.size, b.def.height), this.scaffoldMat);
          e.scaffold.castShadow = this.shadows;
          e.group.add(e.scaffold);
          const S = b.def.size * TILE_SIZE * 0.9;
          const ring = new Kit();
          for (const [w, d, x, z] of [[S, 0.8, 0, S / 2], [S, 0.8, 0, -S / 2], [0.8, S, S / 2, 0], [0.8, S, -S / 2, 0]]) ring.box(w, 0.8, d, 0xffffff, [x, 0, z]);
          e.weld = new THREE.Mesh(ring.build().solid, this.weldMat);
          e.group.add(e.weld);
        }
        if (e.weld) {
          e.weld.position.y = cut / ys;
          e.weld.visible = Math.sin(this.time * 31 + b.uid) > -0.3;
        }
      }
      if (e.glow) e.glow.visible = false;
    } else {
      if (e.scaffold) {
        e.mat.side = THREE.FrontSide;
        e.mat.needsUpdate = true;
        e.group.remove(e.scaffold);
        e.scaffold = undefined;
        if (e.weld) {
          e.weld.geometry.dispose();
          e.group.remove(e.weld);
          e.weld = undefined;
        }
      }
      e.clip.constant = 1e6;
      e.group.scale.set(1, ys, 1);
      if (e.glow) e.glow.visible = true;
      // Damage: scorched and dimmed below 60% health, flickering power below 30%.
      const frac = b.hp / b.maxHp;
      const d = frac > 0.6 ? 1 : 0.55 + 0.45 * (frac / 0.6);
      e.mat.color.setRGB(d, d * 0.96, d * 0.93);
      if (e.glow) e.glow.visible = frac > 0.3 || Math.sin(this.time * 17 + b.uid * 3) > 0.2;
    }
    if (e.gun) {
      const target = -view.gunYaw;
      let diff = target - e.gun.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      e.gun.rotation.y += diff * Math.min(1, dt * 14);
      e.gun.visible = b.state !== 'constructing' || b.progress > 0.9;
    }
    if (e.door) {
      // Opens by sliding up into the lintel (squashing like a shutter).
      const H0 = b.def.height * BUILD_SCALE;
      e.doorY += ((view.isDoorOpen ? 1 : 0) - e.doorY) * Math.min(1, dt * 7);
      e.door.scale.y = 1 - 0.78 * e.doorY;
      e.door.position.y = H0 * 0.92 * (1 - e.door.scale.y);
    }
  }

  /** Collapse: tilts, sinks into the ground and is removed after ~1.2 s. */
  private updateDying(e: Entry, dt: number): boolean {
    e.dying += dt;
    const t = e.dying / 1.2;
    const ys = HEIGHT_SCALE.value / BUILD_SCALE;
    e.group.scale.set(1 + t * 0.12, ys * Math.max(0.02, 1 - t * t), 1 + t * 0.12);
    e.group.rotation.set(e.tilt.z * t * 0.35, 0, -e.tilt.x * t * 0.35);
    e.mat.color.setRGB(0.4 - t * 0.25, 0.36 - t * 0.22, 0.34 - t * 0.2);
    if (e.glow) e.glow.visible = false;
    if (e.gun) e.gun.position.x += dt * 30 * e.tilt.x;
    return t < 1;
  }

  private drop(e: Entry): void {
    this.scene.remove(e.group);
    e.mat.dispose();
  }

  update(buildings: Building[], ruins: Ruin[], heightAt: (x: number, y: number) => number, dt: number): void {
    this.time += dt;
    const seen = new Set<number>();
    for (const b of buildings) {
      seen.add(b.uid);
      let e = this.entries.get(b.uid);
      if (!e) {
        e = this.create(b);
        this.place(e, heightAt);
        this.entries.set(b.uid, e);
      }
      if (b.alive) this.updateEntry(e, dt);
    }
    for (const [uid, e] of this.entries) {
      if (seen.has(uid) && e.b.alive) continue;
      if (e.dying < 0) e.dying = 0;
      if (!this.updateDying(e, dt)) {
        this.drop(e);
        this.entries.delete(uid);
      }
    }
    for (const r of ruins) {
      if (this.ruins.has(r)) continue;
      const m = new THREE.Mesh(this.ruinGeo(r, r.horde, this.ruins.size % 3), this.ruinMat);
      m.position.set(r.x, heightAt(r.x, r.y), r.y);
      m.rotation.y = (this.ruins.size * 2.3) % (Math.PI * 2);
      m.castShadow = this.shadows;
      m.receiveShadow = this.shadows;
      this.scene.add(m);
      this.ruins.set(r, m);
    }
    for (const [r, m] of this.ruins) {
      m.scale.y = HEIGHT_SCALE.value / BUILD_SCALE * (r.alive ? 1 : 0.6);
    }
  }

  /** Light spilling from windows, cores and orifices of finished, visible buildings. */
  lightSpots(out: Spot[]): void {
    for (const e of this.entries.values()) {
      const b = e.b;
      if (!b.alive || !b.isReady || !e.glow || !e.group.visible || b.def.wall || b.def.mine) continue;
      const horde = b.def.faction === 'nullhorde';
      const flicker = b.hp / b.maxHp < 0.3 ? 0.5 + 0.5 * Math.sin(this.time * 17 + b.uid * 3) : 1;
      out.push({
        x: b.x, y: b.y + b.radius * 0.7, h: b.def.height * 0.5, radius: b.radius * 1.6 + 30,
        color: b.def.id === 'generator' || b.def.id === 'shield' ? 0x6ff0ff : horde ? 0xb050ff : 0xffb060,
        strength: 0.55 * flicker, dynamic: false,
      });
    }
  }

  dispose(): void {
    for (const e of this.entries.values()) this.drop(e);
    for (const m of this.ruins.values()) this.scene.remove(m);
    for (const m of this.models.values()) {
      m.solid.dispose();
      m.glow?.dispose();
    }
    for (const g of this.gunGeos.values()) {
      g.solid.dispose();
      g.glow?.dispose();
    }
    for (const g of [...this.scaffolds.values(), ...this.ruinGeos.values()]) g.dispose();
    for (const m of [this.glowMat, this.weldMat, this.scaffoldMat, this.ruinMat]) m.dispose();
  }
}
