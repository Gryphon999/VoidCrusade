import * as THREE from 'three';
import { MAP_H, MAP_W, TILE_SIZE } from '../config';
import { surfaceDetail } from './Materials3D';

/**
 * Low-lying ground haze: two slow-drifting noise layers just above the ground. Lowlands sit in
 * the murk while plateaus and tall structures rise out of it.
 */
export class Fog3D {
  private layers: THREE.Mesh[] = [];
  private mats: THREE.ShaderMaterial[] = [];

  constructor(scene: THREE.Scene, color: number, density: number) {
    if (density <= 0) return;
    const pad = 12 * TILE_SIZE;
    const w = MAP_W * TILE_SIZE + pad * 2;
    const h = MAP_H * TILE_SIZE + pad * 2;
    const tex = surfaceDetail();
    [[14, 1, 0.6], [34, 0.6, -0.4]].forEach(([y, k, dir], i) => {
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTex: { value: tex },
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(color) },
          uDensity: { value: density * k },
          uDir: { value: new THREE.Vector2(dir, 0.3) },
          uScale: { value: 2600 + i * 1400 },
        },
        vertexShader: `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `
          uniform sampler2D uTex; uniform float uTime; uniform vec3 uColor; uniform float uDensity; uniform vec2 uDir; uniform float uScale;
          varying vec3 vW;
          void main() {
            vec2 p = vW.xz / uScale + uDir * uTime * 0.004;
            float n = texture2D(uTex, p).r * 0.6 + texture2D(uTex, p * 2.7 - uDir * uTime * 0.003).r * 0.4;
            float a = (0.35 + 0.65 * smoothstep(0.3, 0.75, n)) * uDensity;
            gl_FragColor = vec4(uColor, a);
            #include <colorspace_fragment>
          }`,
      });
      const geo = new THREE.PlaneGeometry(w, h);
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(MAP_W * TILE_SIZE / 2, y, MAP_H * TILE_SIZE / 2);
      m.renderOrder = 5;
      scene.add(m);
      this.layers.push(m);
      this.mats.push(mat);
    });
  }

  update(t: number): void {
    for (const m of this.mats) m.uniforms.uTime.value = t;
  }

  dispose(): void {
    for (const m of this.layers) {
      m.geometry.dispose();
      m.removeFromParent();
    }
    for (const m of this.mats) m.dispose();
  }
}
