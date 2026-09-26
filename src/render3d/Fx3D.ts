import * as THREE from 'three';
import { Projection } from '../render/Projection';
import { surfaceDetail } from './Materials3D';
import { HEIGHT_SCALE } from './Units3D';

/** One particle burst recipe. Units: px, seconds. Colours are linear RGB (additive may exceed 1). */
interface Burst {
  n: number;
  /** Speed range and emission cone: `up` 0 = horizontal ring, 1 = straight up; `spread` jitter. */
  speed: [number, number];
  up: number;
  spread: number;
  life: [number, number];
  size: [number, number];
  color: [number, number, number];
  color2: [number, number, number];
  alpha: number;
  gravity: number;
  drag: number;
  /** Velocity-aligned stretch (sparks). */
  stretch?: number;
  /** Random start offset radius. */
  jitter?: number;
  additive: boolean;
}

const FIRE: Burst = { n: 22, speed: [30, 170], up: 0.45, spread: 1, life: [0.4, 0.8], size: [12, 40], color: [3.2, 1.3, 0.35], color2: [0.9, 0.12, 0.03], alpha: 1, gravity: -40, drag: 3.2, jitter: 6, additive: true };
const CORE: Burst = { n: 2, speed: [0, 10], up: 1, spread: 0.2, life: [0.1, 0.18], size: [30, 70], color: [4, 3, 1.8], color2: [2, 0.8, 0.2], alpha: 1, gravity: 0, drag: 0, additive: true };
const SPARKS: Burst = { n: 18, speed: [160, 460], up: 0.55, spread: 1, life: [0.3, 0.75], size: [2.4, 1], color: [6, 3.6, 1.4], color2: [3, 0.9, 0.2], alpha: 1, gravity: 520, drag: 1.2, stretch: 0.05, additive: true };
const DEBRIS: Burst = { n: 12, speed: [120, 330], up: 0.7, spread: 1, life: [0.8, 1.4], size: [4.5, 4], color: [0.09, 0.08, 0.07], color2: [0.05, 0.045, 0.04], alpha: 1, gravity: 620, drag: 0.4, additive: false };
const SMOKE: Burst = { n: 12, speed: [10, 50], up: 0.8, spread: 0.6, life: [1.8, 3.2], size: [22, 80], color: [0.05, 0.047, 0.045], color2: [0.1, 0.095, 0.09], alpha: 0.6, gravity: -26, drag: 0.9, jitter: 18, additive: false };
const PUFF: Burst = { n: 1, speed: [8, 22], up: 1, spread: 0.3, life: [2, 3], size: [10, 46], color: [0.14, 0.13, 0.12], color2: [0.22, 0.21, 0.2], alpha: 0.4, gravity: -12, drag: 0.3, jitter: 3, additive: false };
const DUST: Burst = { n: 4, speed: [15, 50], up: 0.35, spread: 1, life: [0.5, 0.9], size: [6, 22], color: [0.3, 0.25, 0.19], color2: [0.34, 0.3, 0.24], alpha: 0.5, gravity: 30, drag: 2, additive: false };
const MUZZLE: Burst = { n: 1, speed: [0, 0], up: 0, spread: 0, life: [0.05, 0.075], size: [16, 8], color: [7, 5, 2.4], color2: [3, 1.4, 0.4], alpha: 1, gravity: 0, drag: 0, additive: true };

const KIND_COLOR: Record<string, [number, number, number]> = {
  bullet: [5, 3.6, 1.6], shell: [5, 2.6, 0.9], spit: [1.6, 4.5, 0.8], spine: [2.6, 2.4, 2], flame: [5, 2, 0.5], sniper: [3.6, 4.4, 5.5],
  psy: [3.6, 1.2, 5], lob: [5, 2.8, 1.2], acidlob: [1.6, 4.5, 0.8], cannon: [5.5, 4, 1.8], rocket: [5.5, 4.5, 2.5],
};

const VERT = `
attribute vec3 iPos;
attribute vec3 iVel;
attribute vec4 iTime;   // birth, life, size0, size1
attribute vec4 iColA;   // rgb0, alpha
attribute vec3 iColB;   // rgb1
attribute vec4 iPhys;   // gravity, drag, stretch, floor
uniform float uTime;
varying vec2 vUv;
varying vec4 vCol;
varying float vSeed;
varying float vAge;
void main() {
  float t = uTime - iTime.x;
  float a = t / iTime.y;
  if (t < 0.0 || a >= 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float d = iPhys.y;
  float tt = d > 0.001 ? (1.0 - exp(-d * t)) / d : t;
  vec3 p = iPos + iVel * tt;
  p.y -= 0.5 * iPhys.x * t * t;
  vec3 v = iVel * exp(-d * t) - vec3(0.0, iPhys.x * t, 0.0);
  if (p.y < iPhys.w) { p.y = iPhys.w; v = vec3(0.0); }
  float size = mix(iTime.z, iTime.w, a);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vec2 corner = position.xy;
  if (iPhys.z > 0.0) {
    // Stretch along the screen-space velocity (sparks, tracers).
    vec2 sv = (viewMatrix * vec4(v, 0.0)).xy;
    float len = length(sv);
    vec2 dir = len > 0.001 ? sv / len : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    corner = dir * corner.x * (1.0 + len * iPhys.z) + nrm * corner.y;
  }
  mv.xy += corner * size;
  // Pull towards the camera a little so particles are not clipped by the surface they spawn on.
  mv.z += size * 0.5;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy + 0.5;
  vCol = vec4(mix(iColA.rgb, iColB, a), iColA.a * (1.0 - a) * (iTime.y < 0.1 ? 1.0 : smoothstep(0.0, 0.08, a + 0.02)));
  vSeed = fract(iTime.x * 13.37 + iPos.x * 0.011);
  vAge = a;
}`;

const FRAG = `
uniform sampler2D uNoise;
uniform vec3 uLight;
uniform float uLit;
varying vec2 vUv;
varying vec4 vCol;
varying float vSeed;
varying float vAge;
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  float n = texture2D(uNoise, vUv * 0.45 + vSeed * 7.0 + vAge * 0.15).r;
  float shape = smoothstep(1.0, 0.25 + n * 0.3, r + (n - 0.5) * 0.5 * uLit);
  float a = shape * vCol.a;
  if (a < 0.004) discard;
  // Smoke: lit from above by the scene light, darker at the bottom edge.
  vec3 col = mix(vCol.rgb, vCol.rgb * uLight * (0.7 + 0.6 * (0.5 - c.y) + n * 0.3), uLit);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

class Pool {
  readonly mesh: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private next = 0;
  private lo = Infinity;
  private hi = -1;
  private attrs: Record<string, THREE.InstancedBufferAttribute> = {};

  constructor(private cap: number, readonly mat: THREE.ShaderMaterial) {
    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.getAttribute('position'));
    const add = (name: string, size: number): void => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * size), size);
      a.setUsage(THREE.DynamicDrawUsage);
      this.geo.setAttribute(name, a);
      this.attrs[name] = a;
    };
    add('iPos', 3);
    add('iVel', 3);
    add('iTime', 4);
    add('iColA', 4);
    add('iColB', 3);
    add('iPhys', 4);
    // Everything starts dead (birth far in the past).
    (this.attrs.iTime.array as Float32Array).fill(-1e6);
    for (let i = 0; i < cap; i++) (this.attrs.iTime.array as Float32Array)[i * 4 + 1] = 1;
    this.geo.instanceCount = cap;
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
  }

  spawn(p: THREE.Vector3, v: THREE.Vector3, birth: number, life: number, s0: number, s1: number, c0: number[], alpha: number, c1: number[], grav: number, drag: number, stretch: number, floor: number): void {
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    const A = this.attrs;
    (A.iPos.array as Float32Array).set([p.x, p.y, p.z], i * 3);
    (A.iVel.array as Float32Array).set([v.x, v.y, v.z], i * 3);
    (A.iTime.array as Float32Array).set([birth, life, s0, s1], i * 4);
    (A.iColA.array as Float32Array).set([c0[0], c0[1], c0[2], alpha], i * 4);
    (A.iColB.array as Float32Array).set([c1[0], c1[1], c1[2]], i * 3);
    (A.iPhys.array as Float32Array).set([grav, drag, stretch, floor], i * 4);
    this.lo = Math.min(this.lo, i);
    this.hi = Math.max(this.hi, i);
  }

  flush(): void {
    if (this.hi < 0) return;
    for (const [name, a] of Object.entries(this.attrs)) {
      const size = name === 'iPos' || name === 'iVel' || name === 'iColB' ? 3 : 4;
      a.clearUpdateRanges();
      a.addUpdateRange(this.lo * size, (this.hi - this.lo + 1) * size);
      a.needsUpdate = true;
    }
    this.lo = Infinity;
    this.hi = -1;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/**
 * GPU particles for the 3D battlefield: fireballs, sparks, debris that bounces on the ground,
 * smoke columns lit by the scene light, dust, muzzle flashes, projectile heads and trails.
 * Motion is analytic in the vertex shader (no per-frame CPU work per particle); emission
 * writes into ring buffers. Effects keep the exact screen placement of the 2D effects they
 * replace (view-space points are ray-cast onto the 3D terrain), but gain depth, occlusion and
 * real vertical motion.
 */
export class Fx3D {
  private glow: Pool;
  private soft: Pool;
  private time = 0;
  private detail: number;
  private p = new THREE.Vector3();
  private v = new THREE.Vector3();

  constructor(scene: THREE.Scene, private heightAt: (x: number, y: number) => number, light: THREE.Color, detail: number) {
    this.detail = detail;
    const noise = surfaceDetail();
    const mk = (additive: boolean): THREE.ShaderMaterial => new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uTime: { value: 0 }, uNoise: { value: noise }, uLight: { value: light }, uLit: { value: additive ? 0 : 1 } },
    });
    this.soft = new Pool(Math.round(3000 * detail), mk(false));
    this.glow = new Pool(Math.round(4000 * detail), mk(true));
    this.soft.mesh.renderOrder = 8;
    this.glow.mesh.renderOrder = 9;
    scene.add(this.soft.mesh, this.glow.mesh);
  }

  /** 3D point seen at view (vx, vy) standing `h` px (2D units) above the terrain there. */
  at(vx: number, vy: number, h = 0, out = this.p): THREE.Vector3 {
    const tilt = Projection.tilt;
    const cosE = Math.sqrt(1 - tilt * tilt);
    const hs = HEIGHT_SCALE.value;
    let z = (vy + h * hs * cosE) / tilt;
    for (let i = 0; i < 4; i++) z = (vy + (this.heightAt(vx, z) + h * hs) * cosE) / tilt;
    return out.set(vx, this.heightAt(vx, z) + h * hs, z);
  }

  private burst(b: Burst, at: THREE.Vector3, scale = 1, count = b.n): void {
    const pool = b.additive ? this.glow : this.soft;
    const n = Math.max(1, Math.round(count * this.detail));
    const floor = this.heightAt(at.x, at.z) + 1;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.min(1, Math.max(-0.2, b.up + (Math.random() - 0.5) * b.spread));
      const sp = (b.speed[0] + Math.random() * (b.speed[1] - b.speed[0])) * Math.sqrt(scale);
      const horiz = Math.sqrt(Math.max(0, 1 - up * up));
      this.v.set(Math.cos(a) * horiz * sp, up * sp, Math.sin(a) * horiz * sp);
      const j = (b.jitter ?? 0) * scale;
      const p = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * j, Math.random() * j * 0.5, (Math.random() - 0.5) * j));
      const life = b.life[0] + Math.random() * (b.life[1] - b.life[0]);
      pool.spawn(p, this.v, this.time + Math.random() * 0.03, life, b.size[0] * scale, b.size[1] * scale, b.color, b.alpha, b.color2, b.gravity, b.drag, b.stretch ?? 0, floor);
    }
  }

  /** Building / vehicle explosion: `groundY` logical, `lift` in 2D px. */
  explode(x: number, groundY: number, radius: number, lift: number): void {
    const s = Math.max(0.6, radius / 60);
    const g = this.heightAt(x, groundY);
    this.p.set(x, g + lift * HEIGHT_SCALE.value, groundY);
    const c = this.p.clone();
    this.burst(CORE, c, s);
    this.burst(FIRE, c, s);
    this.burst(SPARKS, c, s);
    this.burst(DEBRIS, c, s, DEBRIS.n + radius / 8);
    this.burst(SMOKE, c, s);
    // A second, delayed column of smoke keeps rising after the fireball.
    this.burst({ ...SMOKE, life: [3, 4.5], gravity: -40 }, c.setY(g + 10), s, 8);
  }

  /** Shell blast at a view-space ground point. */
  blast(vx: number, vy: number, size = 1): void {
    const c = this.at(vx, vy, 3).clone();
    this.burst(CORE, c, 0.5 * size, 1);
    this.burst(FIRE, c, 0.5 * size, 6 + 6 * size);
    this.burst(SPARKS, c, 0.6, 6 * size);
    this.burst(DEBRIS, c, 0.6, 3 + 3 * size);
    this.burst(SMOKE, c, 0.45 * size, 4);
  }

  impact(vx: number, vy: number): void {
    this.burst(SPARKS, this.at(vx, vy, 6), 0.4, 3);
  }

  dust(vx: number, vy: number): void {
    this.burst(DUST, this.at(vx, vy, 2), 1);
  }

  puff(vx: number, vy: number): void {
    this.burst(PUFF, this.at(vx, vy, 0), 1);
  }

  exhaust(vx: number, vy: number): void {
    this.burst({ ...PUFF, life: [0.6, 1], size: [5, 18], alpha: 0.35 }, this.at(vx, vy, 4), 1);
  }

  sparks(vx: number, vy: number, color?: [number, number, number]): void {
    this.burst(color ? { ...SPARKS, color, color2: color } : SPARKS, this.at(vx, vy, 4), 0.35, 4);
  }

  /** Flames and smoke from a burning ruin (call repeatedly while it burns). */
  burnTick(x: number, groundY: number, radius: number): void {
    const g = this.heightAt(x, groundY);
    this.p.set(x + (Math.random() - 0.5) * radius, g + 4, groundY + (Math.random() - 0.5) * radius * 0.6);
    this.burst({ ...FIRE, n: 1, speed: [20, 50], up: 1, spread: 0.3, life: [0.4, 0.8], size: [14, 4], gravity: -60, drag: 0.5 }, this.p, 1, 1);
    if (Math.random() < 0.4) this.burst({ ...SMOKE, n: 1, life: [2.4, 3.4], size: [18, 80], gravity: -30 }, this.p.setY(g + 20), 1, 1);
  }

  /** Muzzle flash at a view-space gun tip (2D lift ~14 px). */
  muzzle(vx: number, vy: number, kind: string): void {
    const c = this.at(vx, vy, 14);
    const col = KIND_COLOR[kind] ?? KIND_COLOR.bullet;
    this.burst({ ...MUZZLE, color: col, color2: col }, c, kind === 'shell' || kind === 'cannon' ? 1.8 : kind === 'flame' ? 1.4 : 1, 1);
  }

  /** Trail particle for a projectile at a 3D point. */
  trail(kind: string, p: THREE.Vector3): void {
    switch (kind) {
      case 'shell': case 'lob': case 'cannon': case 'rocket':
        this.burst({ ...PUFF, life: [0.5, 0.9], size: [4, 16], alpha: 0.45, gravity: -8, jitter: 1 }, p, 1, 1);
        if (kind === 'rocket') this.burst({ ...FIRE, n: 1, speed: [0, 10], life: [0.08, 0.14], size: [8, 3], color: [6, 4, 2] }, p, 1, 1);
        break;
      case 'spit': case 'acidlob':
        this.burst({ ...SPARKS, n: 1, speed: [5, 20], life: [0.25, 0.35], size: [3, 0.5], color: [1.2, 3.6, 0.6], color2: [0.4, 1.4, 0.2], gravity: 90 }, p, 1, 1);
        break;
      case 'flame':
        this.burst({ ...FIRE, n: 1, speed: [5, 30], life: [0.18, 0.32], size: [5, 14], gravity: -40 }, p, 1, 1);
        break;
      case 'sniper':
        this.burst({ ...MUZZLE, life: [0.22, 0.26], size: [2.2, 0.4], color: [2, 2.6, 3.4], color2: [0.6, 0.9, 1.4] }, p, 1, 1);
        break;
      case 'psy':
        this.burst({ ...SPARKS, n: 1, speed: [5, 15], life: [0.3, 0.4], size: [4, 0], color: [3, 1, 4.5], color2: [1.4, 0.4, 2.8], gravity: 0 }, p, 1, 1);
        break;
    }
  }

  /** Arrival splash for non-explosive projectiles. */
  splash(kind: string, vx: number, vy: number): void {
    const c = this.at(vx, vy, 4);
    if (kind === 'acidlob') this.burst({ ...SPARKS, speed: [60, 180], color: [1.2, 3.6, 0.6], color2: [0.3, 1, 0.2], gravity: 400 }, c, 0.8, 18);
    else if (kind === 'flame') this.burst({ ...FIRE, speed: [10, 60] }, c, 0.35, 4);
    else if (kind === 'psy') this.burst({ ...SPARKS, speed: [40, 120], color: [3, 1, 4.5], color2: [1, 0.3, 2], gravity: 0 }, c, 0.6, 6);
  }

  /** A projectile head this frame: a bright streak along its motion (drawn for one frame). */
  head(kind: string, p: THREE.Vector3, v: THREE.Vector3, scale: number): void {
    const col = KIND_COLOR[kind] ?? KIND_COLOR.bullet;
    const straight = kind === 'bullet' || kind === 'sniper' || kind === 'shell' || kind === 'cannon';
    const size = (kind === 'spit' || kind === 'acidlob' || kind === 'psy' ? 5 : kind === 'flame' ? 7 : 3) * scale;
    this.glow.spawn(p, v, this.time, 0.02, size, size, col, 1, col, 0, 0, straight ? 0.03 : 0.012, -1e6);
  }

  private ambientT = 0;

  /**
   * Weather motes around the view: falling ash and rising embers (dusk), drifting dust (desert),
   * cold drifting specks (night). `rate` scales with the quality tier.
   */
  ambient(dt: number, kind: 'ash' | 'dust' | 'night', view: { x: number; y: number; width: number; height: number }, rate: number): void {
    this.ambientT += dt * rate * (view.width * view.height) / (1280 * 720);
    const n = Math.floor(this.ambientT);
    this.ambientT -= n;
    for (let i = 0; i < n; i++) {
      const vx = view.x + Math.random() * view.width;
      const vy = view.y + Math.random() * view.height;
      const p = this.at(vx, vy, 20 + Math.random() * 90);
      if (kind === 'ash') {
        if (Math.random() < 0.25) {
          this.v.set(10 + Math.random() * 20, 25 + Math.random() * 30, (Math.random() - 0.5) * 20);
          this.glow.spawn(p, this.v, this.time, 2.5 + Math.random() * 2, 1.6, 0.4, [3.5, 1.2, 0.3], 1, [1.2, 0.2, 0.05], -4, 0.2, 0.02, -1e6);
        } else {
          this.v.set(18 + Math.random() * 14, -14 - Math.random() * 10, (Math.random() - 0.5) * 14);
          this.soft.spawn(p, this.v, this.time, 5 + Math.random() * 3, 2.2, 1.6, [0.35, 0.33, 0.32], 0.7, [0.25, 0.24, 0.23], 0, 0, 0, -1e6);
        }
      } else if (kind === 'dust') {
        this.v.set(40 + Math.random() * 30, (Math.random() - 0.3) * 8, (Math.random() - 0.5) * 20);
        this.soft.spawn(p.setY(p.y - 15), this.v, this.time, 3 + Math.random() * 2, 14, 40, [0.45, 0.38, 0.28], 0.12, [0.45, 0.38, 0.28], 0, 0.1, 0, -1e6);
      } else {
        this.v.set(6 + Math.random() * 8, -6 - Math.random() * 6, (Math.random() - 0.5) * 8);
        this.glow.spawn(p, this.v, this.time, 5 + Math.random() * 3, 1.3, 1.1, [0.25, 0.32, 0.45], 1, [0.1, 0.12, 0.18], 0, 0, 0, -1e6);
      }
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.glow.mat.uniforms.uTime.value = this.time;
    this.soft.mat.uniforms.uTime.value = this.time;
    this.glow.flush();
    this.soft.flush();
  }

  dispose(): void {
    this.glow.mesh.removeFromParent();
    this.soft.mesh.removeFromParent();
    this.glow.dispose();
    this.soft.dispose();
  }
}
