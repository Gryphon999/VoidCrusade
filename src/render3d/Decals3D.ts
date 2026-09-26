import * as THREE from 'three';
import type Phaser from 'phaser';
import { Projection } from '../render/Projection';

interface Batch {
  mesh: THREE.InstancedMesh;
  alpha: THREE.InstancedBufferAttribute;
  used: number;
}

const CAP = 256;

/**
 * Ground decals in 3D (blood pools, scorch marks, tread marks). They reuse the baked 2D decal
 * textures and follow the 2D decal lists (placement, fading, recycling stay in the effect
 * systems), but lie on the 3D terrain under units, buildings and rubble instead of being drawn
 * over them.
 */
export class Decals3D {
  private batches = new Map<string, Batch>();
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(private scene: THREE.Scene, private textures: Phaser.Textures.TextureManager, private light: THREE.Color) {}

  private batch(key: string): Batch | null {
    let b = this.batches.get(key);
    if (b) return b;
    if (!this.textures.exists(key)) return null;
    const src = this.textures.get(key).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
    const tex = new THREE.Texture(src);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const alpha = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1);
    alpha.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iAlpha', alpha);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
      uniforms: { map: { value: tex }, uLight: { value: this.light } },
      vertexShader: `attribute float iAlpha; varying vec2 vUv; varying float vA;
        void main() { vUv = uv; vA = iAlpha; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 uLight; varying vec2 vUv; varying float vA;
        void main() { vec4 c = texture2D(map, vUv); c.rgb = pow(c.rgb, vec3(2.2)) * uLight; gl_FragColor = vec4(c.rgb, c.a * vA); if (gl_FragColor.a < 0.01) discard;
        #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, CAP);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.count = 0;
    this.scene.add(mesh);
    b = { mesh, alpha, used: 0 };
    this.batches.set(key, b);
    return b;
  }

  /** Rebuilds decal instances from the 2D decal images (view-space position, squashed scale). */
  update(images: Phaser.GameObjects.Image[], heightAt: (x: number, y: number) => number): void {
    for (const b of this.batches.values()) b.used = 0;
    const tilt = Projection.tilt;
    for (const img of images) {
      if (!img.visible || img.alpha <= 0.01) continue;
      const b = this.batch(img.texture.key);
      if (!b || b.used >= CAP) continue;
      const x = img.x;
      const y = Projection.groundY(img.y);
      // A tread mark is rotated in view space: recover its heading on the ground.
      const rot = img.rotation ? Math.atan2(Math.sin(img.rotation) / tilt, Math.cos(img.rotation)) : 0;
      const w = img.width * Math.abs(img.scaleX) * (img.flipX ? -1 : 1);
      const d = img.rotation ? img.height * img.scaleY : (img.height * img.scaleY) / tilt;
      this.p.set(x, heightAt(x, y) + 0.8, y);
      this.q.setFromAxisAngle(this.up, -rot);
      this.s.set(w, 1, d);
      this.m4.compose(this.p, this.q, this.s);
      b.mesh.setMatrixAt(b.used, this.m4);
      b.alpha.setX(b.used, img.alpha);
      b.used++;
    }
    for (const b of this.batches.values()) {
      b.mesh.count = b.used;
      b.mesh.instanceMatrix.needsUpdate = true;
      b.alpha.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const b of this.batches.values()) {
      b.mesh.removeFromParent();
      b.mesh.geometry.dispose();
      const m = b.mesh.material as THREE.ShaderMaterial;
      (m.uniforms.map.value as THREE.Texture).dispose();
      m.dispose();
    }
  }
}
