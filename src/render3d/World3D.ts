import * as THREE from 'three';
import type { CapturePoint } from '../systems/CapturePoint';
import { ownerColor } from '../systems/CapturePoint';
import { buildingModel } from './BuildingModels';
import { Kit } from './Kit';
import { surfaceMaterial } from './Materials3D';
import { HEIGHT_SCALE } from './Units3D';
import type { Spot } from './Lights3D';

const BUILD_SCALE = 1.3;

interface Pylon {
  p: CapturePoint;
  group: THREE.Group;
  runes: THREE.MeshBasicMaterial;
  flag: THREE.Mesh;
  flagMat: THREE.MeshStandardMaterial;
  badge?: THREE.Mesh;
  owner: string | null;
}

/**
 * Map fixtures in 3D: the Void-Nexus obelisks of the capture points (runes and standard in the
 * holder's colour, the standard swaying) and derelict turret hulks waiting to be claimed.
 */
export class World3D {
  private pylons: Pylon[] = [];
  private hulks = new Map<string, THREE.Mesh>();
  private stone = surfaceMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.25 }), 'metal', 14);
  private rust = surfaceMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.3, color: 0x8a6a5a }), 'metal', 10);
  private hulkGeo: THREE.BufferGeometry | null = null;
  private time = 0;

  constructor(private scene: THREE.Scene, points: CapturePoint[], heightAt: (x: number, y: number) => number, private shadows: boolean) {
    const body = new Kit();
    // Stepped plinth, tapering obelisk, gold bands and a crown.
    body.cyl(30, 34, 8, 0x3a3a40, [0, 4, 0], undefined, 8);
    body.cyl(22, 26, 8, 0x4a4a52, [0, 12, 0], undefined, 8);
    body.box(18, 110, 18, 0x2e2f36, [0, 70, 0], [0, Math.PI / 4, 0]);
    body.box(15, 18, 15, 0x3a3b44, [0, 130, 0], [0, Math.PI / 4, 0]);
    body.cone(11, 22, 0x2a2b30, [0, 150, 0], [0, Math.PI / 4, 0], 4);
    for (const y of [30, 70, 112]) body.box(21, 3, 21, 0xc9a044, [0, y, 0], [0, Math.PI / 4, 0]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      body.box(6, 26, 10, 0x3a3a40, [Math.cos(a) * 24, 18, Math.sin(a) * 24], [0, -a, 0.35]);
    }
    body.cyl(1.2, 1.2, 60, 0x2a2a2a, [12, 150, 0], undefined, 5);
    const bodyGeo = body.build().solid;
    const runeKit = new Kit();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      for (const y of [48, 90]) runeKit.box(3, 22, 1, 0xffffff, [Math.cos(a) * 12.9, y, Math.sin(a) * 12.9], [0, -a + Math.PI / 2, 0]);
    }
    const runeGeo = runeKit.build().solid;
    const flagGeo = new THREE.BoxGeometry(30, 18, 0.8, 6, 1, 1);
    flagGeo.translate(15, 0, 0);
    for (const p of points) {
      const group = new THREE.Group();
      const m = new THREE.Mesh(bodyGeo, this.stone);
      m.castShadow = shadows;
      m.receiveShadow = shadows;
      const runes = new THREE.MeshBasicMaterial({ toneMapped: false });
      const flagMat = new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide });
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(12, 170, 0);
      flag.castShadow = shadows;
      group.add(m, new THREE.Mesh(runeGeo, runes), flag);
      let badge: THREE.Mesh | undefined;
      if (p.kind !== 'strategic') {
        badge = new THREE.Mesh(new THREE.OctahedronGeometry(9), new THREE.MeshBasicMaterial({ color: new THREE.Color(p.kind === 'relic' ? 0xffc850 : 0x9ad8ff).multiplyScalar(1.8), toneMapped: false }));
        badge.position.y = 190;
        group.add(badge);
      }
      group.position.set(p.x, heightAt(p.x, p.y), p.y);
      scene.add(group);
      this.pylons.push({ p, group, runes, flag, flagMat, badge, owner: 'x' });
    }
  }

  update(dt: number, derelicts: { x: number; y: number; visible: boolean }[], heightAt: (x: number, y: number) => number): void {
    this.time += dt;
    const ys = HEIGHT_SCALE.value / BUILD_SCALE;
    for (const py of this.pylons) {
      py.group.scale.y = ys;
      if (py.owner !== py.p.owner) {
        py.owner = py.p.owner;
        const c = new THREE.Color(py.p.kind === 'relic' && !py.p.owner ? 0xffc850 : ownerColor(py.p.owner));
        py.runes.color.copy(c).multiplyScalar(1.5);
        py.flagMat.color.copy(c);
      }
      py.flag.rotation.y = Math.sin(this.time * 2.3 + py.p.index) * 0.35;
      if (py.badge) {
        py.badge.rotation.y += dt * 1.2;
        py.badge.position.y = 190 + Math.sin(this.time * 2) * 4;
      }
    }
    if (!this.hulkGeo) {
      const k = buildingModel('derelict', 64, 44 * BUILD_SCALE, 0x5a4a40).kit;
      // A toppled barrel and scattered plates: the hulk is broken until engineers claim it.
      k.cyl(2.2, 2.6, 30, 0x2a2420, [18, 6, 10], [0.3, 0.6, Math.PI / 2 + 0.4], 6);
      k.box(12, 2, 9, 0x3a2e28, [-22, 1, 16], [0, 0.7, 0.1]);
      this.hulkGeo = k.build().solid;
    }
    for (const d of derelicts) {
      const key = `${d.x}:${d.y}`;
      let m = this.hulks.get(key);
      if (!m) {
        m = new THREE.Mesh(this.hulkGeo, this.rust);
        m.position.set(d.x, heightAt(d.x, d.y), d.y);
        m.rotation.set(0.05, 0.4, -0.06);
        m.castShadow = this.shadows;
        m.receiveShadow = this.shadows;
        this.scene.add(m);
        this.hulks.set(key, m);
      }
      m.visible = d.visible;
      m.scale.y = ys;
    }
  }

  /** Rune glow of the obelisks. */
  lightSpots(out: Spot[]): void {
    for (const py of this.pylons) {
      out.push({ x: py.p.x, y: py.p.y + 8, h: 60, radius: 90, color: py.runes.color.getHex() || 0xffc850, strength: 0.5 + 0.1 * Math.sin(this.time * 3 + py.p.index), dynamic: false });
    }
  }

  dispose(): void {
    for (const p of this.pylons) this.scene.remove(p.group);
    for (const m of this.hulks.values()) this.scene.remove(m);
    this.hulkGeo?.dispose();
    this.stone.dispose();
    this.rust.dispose();
  }
}
