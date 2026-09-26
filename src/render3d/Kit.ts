import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Tiny kit-bashing helper: primitives with a colour, placed and rotated, merged into one
 * vertex-coloured geometry. Coordinates in px: X east, Y up, Z south.
 */
export class Kit {
  private parts: THREE.BufferGeometry[] = [];
  private glowParts: THREE.BufferGeometry[] = [];

  private push(g: THREE.BufferGeometry, color: number, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], glow = false): this {
    g.rotateX(rot[0]);
    g.rotateY(rot[1]);
    g.rotateZ(rot[2]);
    g.translate(pos[0], pos[1], pos[2]);
    const geo = g.index ? g.toNonIndexed() : g;
    const c = new THREE.Color(color);
    const n = geo.getAttribute('position').count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      a[i * 3] = c.r;
      a[i * 3 + 1] = c.g;
      a[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    if (!geo.getAttribute('uv')) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    (glow ? this.glowParts : this.parts).push(geo);
    return this;
  }

  /** Any custom geometry (cloth, extrusions). */
  custom(g: THREE.BufferGeometry, color: number, pos: [number, number, number], rot?: [number, number, number]): this {
    return this.push(g, color, pos, rot);
  }

  box(w: number, h: number, d: number, color: number, pos: [number, number, number], rot?: [number, number, number]): this {
    return this.push(new THREE.BoxGeometry(w, h, d), color, pos, rot);
  }

  cyl(rTop: number, rBottom: number, h: number, color: number, pos: [number, number, number], rot?: [number, number, number], seg = 8): this {
    return this.push(new THREE.CylinderGeometry(rTop, rBottom, h, seg), color, pos, rot);
  }

  cone(r: number, h: number, color: number, pos: [number, number, number], rot?: [number, number, number], seg = 8): this {
    return this.push(new THREE.ConeGeometry(r, h, seg), color, pos, rot);
  }

  sphere(r: number, color: number, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], seg = 8): this {
    const g = new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2));
    g.scale(scale[0], scale[1], scale[2]);
    return this.push(g, color, pos);
  }

  torus(r: number, tube: number, color: number, pos: [number, number, number], rot?: [number, number, number], arc = Math.PI * 2): this {
    return this.push(new THREE.TorusGeometry(r, tube, 6, 16, arc), color, pos, rot);
  }

  /** Irregular rock: an icosahedron with each vertex pushed by a seeded amount. */
  rock(r: number, color: number, pos: [number, number, number], seed: number, squash = 0.7): this {
    const g = new THREE.IcosahedronGeometry(r, 1);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    // Same displacement for vertices that share a position, so the rock stays closed.
    const cache = new Map<string, number>();
    let s = seed * 9301 + 49297;
    const rnd = (): number => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      let k = cache.get(key);
      if (k === undefined) {
        k = 0.72 + rnd() * 0.5;
        cache.set(key, k);
      }
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * squash, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return this.push(g, color, pos);
  }

  /** Self-lit part (window, ember, lens) for the bloom pass. */
  glow(g: THREE.BufferGeometry, color: number, pos: [number, number, number], rot?: [number, number, number]): this {
    return this.push(g, color, pos, rot, true);
  }

  build(): { solid: THREE.BufferGeometry; glow: THREE.BufferGeometry | null } {
    const solid = mergeGeometries(this.parts.map((g) => g.index ? g.toNonIndexed() : g));
    solid.computeBoundingSphere();
    const glow = this.glowParts.length ? mergeGeometries(this.glowParts) : null;
    return { solid, glow };
  }
}
