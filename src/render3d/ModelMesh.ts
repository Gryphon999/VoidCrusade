import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Part, Pose, V3 } from '../render/puppet/Puppet3D';

/**
 * Converts the procedural puppet parts (the same model definitions that feed the 2D sprite
 * atlases) into real 3D geometry.
 *
 * Axes: puppet local f (forward) → +X, s (right) → +Z, z (up) → +Y, so a figure built facing
 * east stands on the XZ ground plane. World placement maps logical (x east, y south) to
 * Three (X, Z) and a facing angle `a` to `rotation.y = -a`.
 */

export interface ModelGeometry {
  /** Lit parts (vertex colours, standard PBR material). */
  solid: THREE.BufferGeometry;
  /** Self-lit parts (lenses, muzzle flash, energy cores) for the bloom pass. */
  glow: THREE.BufferGeometry | null;
}

const tmpM = new THREE.Matrix4();

/** Puppet local point → Three local vector. */
function p3(p: V3): THREE.Vector3 {
  return new THREE.Vector3(p.f, p.z, p.s);
}

/** Puppet rotation order: pitch (f/z), then roll (s/z), then yaw (f/s). */
function partRotation(pitch = 0, yaw = 0, roll = 0): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  m.makeRotationY(-yaw);
  m.multiply(tmpM.makeRotationX(-roll));
  m.multiply(new THREE.Matrix4().makeRotationZ(pitch));
  return m;
}

function paint(g: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  // mergeGeometries needs identical attribute sets.
  if (g.index) return g.toNonIndexed();
  return g;
}

/** Builds merged geometry for one pose of a puppet model. */
export function buildModelGeometry(parts: Part[], detail = 1, pose: Pose = {}): ModelGeometry {
  const solid: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  // Units are ~30-60 px tall on screen: keep tessellation modest (portraits pass a higher detail).
  const seg = Math.max(4, Math.round(6 * detail));
  for (const p of parts) {
    if (p.kind === 'box') {
      // Bevelled plates catch a highlight on every edge, like painted miniatures.
      const w = p.h.f * 2;
      const hh = p.h.z * 2;
      const d = p.h.s * 2;
      const r = Math.min(w, hh, d) * 0.22;
      const g = detail >= 0.8 && r > 0.15 && !p.emissive ? new RoundedBoxGeometry(w, hh, d, 1, r) : new THREE.BoxGeometry(w, hh, d);
      g.applyMatrix4(partRotation(p.pitch, p.yaw, p.roll));
      const c = p3(p.c);
      g.translate(c.x, c.y, c.z);
      (p.emissive ? glow : solid).push(paint(g, p.color));
    } else if (p.kind === 'limb') {
      const a = p3(p.a);
      const b = p3(p.b);
      const len = a.distanceTo(b);
      const g = new THREE.CapsuleGeometry(p.r, Math.max(0.01, len), detail > 1 ? 2 : 1, seg);
      const dir = b.clone().sub(a).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      g.applyQuaternion(q);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      g.translate(mid.x, mid.y, mid.z);
      solid.push(paint(g, p.color));
    } else if (p.kind === 'ball') {
      const g = new THREE.SphereGeometry(p.r, seg + 1, Math.max(3, seg - 2));
      g.scale(1, p.squash ?? 1, 1);
      const c = p3(p.c);
      g.translate(c.x, c.y, c.z);
      (p.emissive ? glow : solid).push(paint(g, p.color));
    } else {
      // Glow: a small bright core; the bloom pass turns it into a halo.
      const g = new THREE.SphereGeometry(Math.max(0.6, p.r * 0.28), 6, 4);
      const c = p3(p.c);
      g.translate(c.x, c.y, c.z);
      glow.push(paint(g, p.color));
    }
  }
  const merged = solid.length ? mergeGeometries(solid) : new THREE.BufferGeometry();
  const glowG = glow.length ? mergeGeometries(glow) : null;
  // Whole-figure pose (same order as the 2D rasteriser): roll, then fall about the feet, then lift.
  if (pose.roll || pose.fall || pose.lift) {
    const m = new THREE.Matrix4().makeTranslation(0, pose.lift ?? 0, 0);
    m.multiply(new THREE.Matrix4().makeRotationZ(pose.fall ?? 0));
    m.multiply(new THREE.Matrix4().makeRotationX(-(pose.roll ?? 0)));
    merged.applyMatrix4(m);
    glowG?.applyMatrix4(m);
  }
  merged.computeBoundingSphere();
  return { solid: merged, glow: glowG };
}
