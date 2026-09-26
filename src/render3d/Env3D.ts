import * as THREE from 'three';
import { MAP_H, MAP_W, TILE_SIZE } from '../config';
import { Kit } from './Kit';
import { CLIFF_3D } from './Terrain3D';

/**
 * Environment dressing that follows the terrain shape rather than gameplay tiles: boulders and
 * scree piled at the feet of cliffs, so rock walls meet the ground naturally.
 */
export class Env3D {
  private meshes: THREE.InstancedMesh[] = [];

  constructor(scene: THREE.Scene, heightAt: (x: number, y: number) => number, rockColor: number, seed: number, shadows: boolean) {
    const variants = [0, 1, 2, 3].map((v) => new Kit().rock(10 + v * 3, rockColor, [0, 0, 0], seed + v * 17, 0.62).build().solid);
    const spots: THREE.Matrix4[][] = variants.map(() => []);
    let s = seed;
    const rnd = (): number => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    const step = 30;
    const q = new THREE.Quaternion();
    for (let y = step; y < MAP_H * TILE_SIZE - step; y += step) {
      for (let x = step; x < MAP_W * TILE_SIZE - step; x += step) {
        const jx = x + (rnd() - 0.5) * step;
        const jy = y + (rnd() - 0.5) * step;
        const h = heightAt(jx, jy);
        if (h > CLIFF_3D * 0.25) continue;
        const around = Math.max(heightAt(jx + 36, jy), heightAt(jx - 36, jy), heightAt(jx, jy + 36), heightAt(jx, jy - 36));
        // Only at the foot of a wall.
        if (around < CLIFF_3D * 0.6 || rnd() > 0.55) continue;
        const k = 0.45 + rnd() * 1.1;
        q.setFromEuler(new THREE.Euler(rnd() * 0.6, rnd() * Math.PI * 2, rnd() * 0.6));
        const m = new THREE.Matrix4().compose(new THREE.Vector3(jx, h + 2 * k, jy), q, new THREE.Vector3(k, k, k));
        spots[Math.floor(rnd() * variants.length)].push(m);
      }
    }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.02, flatShading: true });
    variants.forEach((g, i) => {
      const list = spots[i];
      if (!list.length) return;
      const im = new THREE.InstancedMesh(g, mat, list.length);
      list.forEach((m, j) => im.setMatrixAt(j, m));
      im.castShadow = shadows;
      im.receiveShadow = shadows;
      im.computeBoundingSphere();
      scene.add(im);
      this.meshes.push(im);
    });
  }

  dispose(): void {
    for (const m of this.meshes) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }
}
