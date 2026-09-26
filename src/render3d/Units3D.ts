import * as THREE from 'three';
import { UNIT_MODELS } from '../render/puppet/UnitAtlas';
import { AnimName } from '../render/puppet/Models';
import { UnitId } from '../units/UnitDefs';
import type { Unit } from '../units/Unit';
import { buildModelGeometry, ModelGeometry } from './ModelMesh';

/** Maps logical ground (x east, y south) and a height to Three space (X, Y up, Z south). */
export const HEIGHT_SCALE = { value: 1 };

interface Batch {
  solid: THREE.InstancedMesh;
  glow: THREE.InstancedMesh | null;
  used: number;
}

/**
 * Draws every soldier and vehicle as instanced meshes, one batch per (unit type, animation,
 * frame). Poses come from the same procedural models that baked the 2D atlases, so the 3D
 * animation matches the sprite animation frame for frame; facing is a rotation per instance.
 */
export class Units3D {
  private geos = new Map<string, ModelGeometry>();
  private batches = new Map<string, Batch>();
  private solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.5 });
  private glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);

  constructor(private scene: THREE.Scene, private detail: number, private shadows: boolean) {}

  private geometry(id: UnitId, anim: AnimName | 'turret', frame: number): ModelGeometry {
    const key = `${id}:${anim}:${frame}`;
    let g = this.geos.get(key);
    if (!g) {
      const m = UNIT_MODELS[id];
      const built = anim === 'turret' ? m.turret?.(frame) : m.build(anim, frame);
      g = built ? buildModelGeometry(built.parts, this.detail, built.pose) : { solid: new THREE.BufferGeometry(), glow: null };
      // Self-lit colours above 1.0 so the bloom pass catches them.
      const gc = g.glow?.getAttribute('color');
      if (gc) {
        const a = gc.array as Float32Array;
        for (let i = 0; i < a.length; i++) a[i] *= 3.5;
      }
      this.geos.set(key, g);
    }
    return g;
  }

  private batch(key: string, g: ModelGeometry, need: number): Batch {
    let b = this.batches.get(key);
    if (b && b.solid.instanceMatrix.count >= need) return b;
    const cap = Math.max(16, need * 2);
    if (b) {
      this.scene.remove(b.solid);
      b.solid.dispose();
      if (b.glow) {
        this.scene.remove(b.glow);
        b.glow.dispose();
      }
    }
    const solid = new THREE.InstancedMesh(g.solid, this.solidMat, cap);
    solid.castShadow = this.shadows;
    solid.receiveShadow = this.shadows;
    solid.frustumCulled = false;
    this.scene.add(solid);
    let glow: THREE.InstancedMesh | null = null;
    if (g.glow) {
      glow = new THREE.InstancedMesh(g.glow, this.glowMat, cap);
      glow.frustumCulled = false;
      this.scene.add(glow);
    }
    b = { solid, glow, used: 0 };
    this.batches.set(key, b);
    return b;
  }

  /** Rebuilds all instance matrices from the simulation (cheap: one matrix per unit). */
  update(units: Unit[], heightAt: (x: number, y: number) => number): void {
    for (const b of this.batches.values()) b.used = 0;
    // Count first so each batch is allocated once with enough room.
    const want = new Map<string, number>();
    const keyOf = (u: Unit): string => `${u.def.id}:${u.anim}:${u.animFrame}`;
    for (const u of units) {
      if (!u.alive || !u.sprite.visible) continue;
      want.set(keyOf(u), (want.get(keyOf(u)) ?? 0) + 1);
      if (u.def.turret) {
        const tk = `${u.def.id}:turret:${u.turretFire}`;
        want.set(tk, (want.get(tk) ?? 0) + 1);
      }
    }
    for (const u of units) {
      if (!u.alive || !u.sprite.visible) continue;
      const key = keyOf(u);
      const b = this.batch(key, this.geometry(u.def.id, u.anim, u.animFrame), want.get(key) ?? 1);
      const h = heightAt(u.x, u.y) + u.lift * HEIGHT_SCALE.value;
      this.p.set(u.x, h, u.y);
      this.q.setFromAxisAngle(this.up, -u.angle);
      this.m4.compose(this.p, this.q, this.s);
      b.solid.setMatrixAt(b.used, this.m4);
      b.glow?.setMatrixAt(b.used, this.m4);
      b.used++;
      if (u.def.turret) {
        const tk = `${u.def.id}:turret:${u.turretFire}`;
        const tb = this.batch(tk, this.geometry(u.def.id, 'turret', u.turretFire), want.get(tk) ?? 1);
        this.q.setFromAxisAngle(this.up, -u.turretAngle);
        this.m4.compose(this.p, this.q, this.s);
        tb.solid.setMatrixAt(tb.used, this.m4);
        tb.glow?.setMatrixAt(tb.used, this.m4);
        tb.used++;
      }
    }
    for (const b of this.batches.values()) {
      b.solid.count = b.used;
      b.solid.instanceMatrix.needsUpdate = true;
      if (b.glow) {
        b.glow.count = b.used;
        b.glow.instanceMatrix.needsUpdate = true;
      }
    }
  }

  dispose(): void {
    for (const b of this.batches.values()) {
      b.solid.dispose();
      b.glow?.dispose();
    }
    for (const g of this.geos.values()) {
      g.solid.dispose();
      g.glow?.dispose();
    }
    this.solidMat.dispose();
    this.glowMat.dispose();
  }
}
