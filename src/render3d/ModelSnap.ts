import * as THREE from 'three';
import type Phaser from 'phaser';
import { UNIT_MODELS } from '../render/puppet/UnitAtlas';
import { ANIM_FRAMES } from '../render/puppet/Models';
import { UNIT_DEFS, UnitId } from '../units/UnitDefs';
import { BUILDING_DEFS, BuildingId } from '../buildings/BuildingDefs';
import { TILE_SIZE } from '../config';
import { buildModelGeometry } from './ModelMesh';
import { buildingModel, gunModel } from './BuildingModels';
import { surfaceMaterial } from './Materials3D';
import { Stage3D } from './Stage3D';

/**
 * Studio renders of the real 3D models for the UI: HUD portraits (with an idle animation strip)
 * and Encyclopedia previews (a turntable strip). Rendered once per model into a small offscreen
 * WebGL canvas with a key, fill and rim light, then handed to Phaser as a texture with frames.
 */
class ModelSnapImpl {
  private renderer: THREE.WebGLRenderer | null = null;
  private failed = false;

  get available(): boolean {
    return !this.failed && Stage3D.wanted();
  }

  private gl(size: number): THREE.WebGLRenderer | null {
    if (this.failed) return null;
    try {
      if (!this.renderer) {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.35;
        this.renderer.setClearColor(0x000000, 0);
      }
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(size, size, false);
      return this.renderer;
    } catch {
      this.failed = true;
      return null;
    }
  }

  private studio(scene: THREE.Scene, horde: boolean): void {
    const key = new THREE.DirectionalLight(0xfff0dc, 3.2);
    key.position.set(-1, 1.4, 1.2);
    const rim = new THREE.DirectionalLight(horde ? 0xc060ff : 0x60a0ff, 3.5);
    rim.position.set(1.2, 0.8, -1.4);
    scene.add(key, rim, new THREE.HemisphereLight(0x9aa4c0, 0x2a2018, 1.1));
  }

  /** Renders `frames` views into a horizontal strip; `setup(i)` poses the scene for frame i. */
  private strip(size: number, frames: number, build: (scene: THREE.Scene, i: number) => THREE.Object3D, horde: boolean,
    frame: (obj: THREE.Object3D) => { center: THREE.Vector3; radius: number }, yaw: (i: number) => number, pitch = 0.42): HTMLCanvasElement | null {
    const r = this.gl(size);
    if (!r) return null;
    const out = document.createElement('canvas');
    out.width = size * frames;
    out.height = size;
    const ctx = out.getContext('2d') as CanvasRenderingContext2D;
    let fit: { center: THREE.Vector3; radius: number } | null = null;
    for (let i = 0; i < frames; i++) {
      const scene = new THREE.Scene();
      this.studio(scene, horde);
      const obj = build(scene, i);
      obj.rotation.y = yaw(i);
      scene.add(obj);
      // Fit the camera once (on frame 0) so the animation does not jitter the framing.
      if (!fit) fit = frame(obj);
      const cam = new THREE.OrthographicCamera(-fit.radius, fit.radius, fit.radius, -fit.radius, 1, 5000);
      const dir = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));
      cam.position.copy(fit.center).addScaledVector(dir, 1500);
      cam.lookAt(fit.center);
      r.render(scene, cam);
      ctx.drawImage(r.domElement, i * size, 0);
      scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
    return out;
  }

  private addStrip(tex: Phaser.Textures.TextureManager, key: string, canvas: HTMLCanvasElement, size: number, frames: number): void {
    const t = tex.addCanvas(key, canvas);
    if (!t) return;
    for (let i = 0; i < frames; i++) t.add(i, 0, i * size, 0, size, size);
  }

  private unitMats = {
    iron: surfaceMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.55 }), 'metal', 5, 0.35),
    horde: surfaceMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.1 }), 'organic', 18, 0.5),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  };

  private unitObject(id: UnitId, anim: 'idle' | 'walk', f: number): THREE.Object3D {
    const m = UNIT_MODELS[id];
    const horde = UNIT_DEFS[id].faction === 'nullhorde';
    const g = new THREE.Group();
    const add = (parts: ReturnType<typeof m.build>): void => {
      const geo = buildModelGeometry(parts.parts, 1.4, parts.pose);
      g.add(new THREE.Mesh(geo.solid, horde ? this.unitMats.horde : this.unitMats.iron));
      if (geo.glow) g.add(new THREE.Mesh(geo.glow, this.unitMats.glow));
    };
    add(m.build(anim, f));
    const t = m.turret?.(0);
    if (t) add(t);
    return g;
  }

  private fitBox(obj: THREE.Object3D, pad = 1.08): { center: THREE.Vector3; radius: number } {
    const box = new THREE.Box3().setFromObject(obj);
    const s = box.getSize(new THREE.Vector3());
    return { center: box.getCenter(new THREE.Vector3()), radius: (Math.max(s.x, s.y, s.z) / 2) * pad };
  }

  /** Portrait strip for a unit type: idle frames, three-quarter view. Returns the texture key. */
  unitPortrait(scene: Phaser.Scene, id: UnitId): string | null {
    const key = `p3d_${id}`;
    if (scene.textures.exists(key)) return key;
    if (!this.available) return null;
    const frames = ANIM_FRAMES.idle;
    const size = 160;
    const horde = UNIT_DEFS[id].faction === 'nullhorde';
    const c = this.strip(size, frames, (_s, i) => this.unitObject(id, 'idle', i), horde, (o) => this.fitBox(o, 0.95), () => -Math.PI * 0.72, 0.28);
    if (!c) return null;
    this.addStrip(scene.textures, key, c, size, frames);
    return key;
  }

  /** Encyclopedia turntable for a unit type (walk cycle while turning). */
  unitTurntable(scene: Phaser.Scene, id: UnitId): string | null {
    const key = `tt_${id}`;
    if (scene.textures.exists(key)) return key;
    if (!this.available) return null;
    const frames = 24;
    const size = 256;
    const horde = UNIT_DEFS[id].faction === 'nullhorde';
    const walk = ANIM_FRAMES.walk;
    const c = this.strip(size, frames, (_s, i) => this.unitObject(id, 'walk', i % walk), horde, (o) => this.fitBox(o, 1.25), (i) => -Math.PI / 2 + (i / frames) * Math.PI * 2, 0.35);
    if (!c) return null;
    this.addStrip(scene.textures, key, c, size, frames);
    return key;
  }

  /** Portrait / preview of a building (slow turntable). */
  buildingTurntable(scene: Phaser.Scene, id: BuildingId, frames = 16): string | null {
    const key = `bt_${id}_${frames}`;
    if (scene.textures.exists(key)) return key;
    if (!this.available) return null;
    const def = BUILDING_DEFS[id];
    const horde = def.faction === 'nullhorde';
    const size = 200;
    const mat = surfaceMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: horde ? 0.5 : 0.62, metalness: horde ? 0.1 : 0.35 }), horde ? 'organic' : 'metal', 16);
    const c = this.strip(size, frames, () => {
      const g = new THREE.Group();
      const bm = buildingModel(id, def.size * TILE_SIZE, def.height * 1.3, 0x2f6fe8);
      const b = bm.kit.build();
      g.add(new THREE.Mesh(b.solid, mat));
      if (b.glow) g.add(new THREE.Mesh(b.glow, this.unitMats.glow));
      if (bm.gunHeight !== undefined) {
        const gun = gunModel(horde, id === 'derelict').build();
        const m = new THREE.Mesh(gun.solid, mat);
        m.position.y = bm.gunHeight;
        g.add(m);
      }
      return g;
    }, horde, (o) => this.fitBox(o, 1.05), (i) => -0.6 + (i / frames) * Math.PI * 2, 0.5);
    if (!c) return null;
    this.addStrip(scene.textures, key, c, size, frames);
    return key;
  }
}

export const ModelSnap = new ModelSnapImpl();
