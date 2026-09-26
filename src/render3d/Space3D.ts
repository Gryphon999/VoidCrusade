import * as THREE from 'three';
import Phaser from 'phaser';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Stage3D } from './Stage3D';
import { Kit } from './Kit';
import { finishPass } from './Post3D';

/** GLSL value noise + fBm on the sphere (no textures: resolution-independent at any zoom). */
const NOISE = `
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * vn(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
float ridge(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * (1.0 - abs(vn(p) * 2.0 - 1.0)); p = p * 2.1 + 3.1; a *= 0.5; } return s; }
`;

const SUN = new THREE.Vector3(-0.62, 0.55, 0.56).normalize();

export interface SpaceOptions {
  /** Planet centre and radius in game (screen) px. */
  planet: { x: number; y: number; r: number };
  /** Spin speed (radians/s) and tilt of the planet's axis. */
  spin?: number;
  /** Ships crossing the view. */
  fleet?: boolean;
  /** Axis tilt towards the viewer (radians; negative shows more of the southern latitudes). */
  tilt?: number;
  /** Extra darkening of the planet surface (campaign map: hexes must read on top). */
  dim?: number;
}

/**
 * Live 3D backdrop for the menu and the campaign map: a procedural war-torn planet (continents,
 * glowing fault lines, night-side fires, a drifting cloud layer, an atmosphere rim), a nebula
 * sky with parallax stars, and a fleet of warships gliding past with glowing engines.
 * Drawn with an orthographic camera in screen px, so it lines up with the 2D UI on top.
 */
export class Space3D {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(0, GAME_WIDTH, 0, -GAME_HEIGHT, 0.1, 10000);
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private planetMat: THREE.ShaderMaterial;
  private cloudMat: THREE.ShaderMaterial;
  private skyMat: THREE.ShaderMaterial;
  private planet: THREE.Group;
  private stars: THREE.Points;
  private ships: { g: THREE.Group; speed: number; y: number; z: number }[] = [];
  private finish;
  private time = 0;
  private onPost = (): void => this.render();

  constructor(private phaser: Phaser.Scene, private opts: SpaceOptions) {
    this.renderer = Stage3D.attach(phaser.game, this);
    this.renderer.toneMappingExposure = 1.0;
    const { x, y, r } = opts.planet;
    // Sky: nebula gradient quad behind everything.
    this.skyMat = new THREE.ShaderMaterial({
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `${NOISE}
        uniform float uTime; varying vec2 vUv;
        void main() {
          vec3 p = vec3(vUv * vec2(3.2, 1.8), uTime * 0.004);
          float n = fbm(p + fbm(p * 1.7) * 0.8);
          float m = smoothstep(0.35, 0.85, n);
          vec3 base = mix(vec3(0.004, 0.003, 0.012), vec3(0.03, 0.008, 0.02), vUv.y);
          vec3 neb = mix(vec3(0.16, 0.03, 0.22), vec3(0.35, 0.05, 0.08), fbm(p * 2.0 + 5.0));
          vec3 c = base + neb * m * 0.6 + vec3(0.05, 0.08, 0.2) * pow(smoothstep(0.55, 0.9, fbm(p * 0.6 + 9.0)), 2.0) * 0.5;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(GAME_WIDTH, GAME_HEIGHT), this.skyMat);
    sky.position.set(GAME_WIDTH / 2, -GAME_HEIGHT / 2, -4000);
    this.scene.add(sky);
    // Stars: three depth layers, twinkling, drifting slowly.
    const n = 2200;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = Math.random() * GAME_WIDTH * 1.4;
      pos[i * 3 + 1] = -Math.random() * GAME_HEIGHT;
      pos[i * 3 + 2] = -3000 + Math.random() * 100;
      const k = Math.random();
      const b = 0.25 + Math.pow(Math.random(), 4) * 1.4;
      col.set(k < 0.2 ? [b, b * 0.8, b * 0.6] : k < 0.35 ? [b * 0.7, b * 0.8, b] : [b, b, b], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.4, vertexColors: true, sizeAttenuation: false, toneMapped: false, transparent: true, depthWrite: false }));
    this.scene.add(this.stars);
    // Planet.
    this.planet = new THREE.Group();
    this.planet.position.set(x, -y, 0);
    this.planet.rotation.set(opts.tilt ?? 0.25, 0, 0.18);
    this.scene.add(this.planet);
    const sun = { value: SUN };
    this.planetMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSun: sun, uDim: { value: opts.dim ?? 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vView;
        void main() { vP = position; vN = normalize(mat3(modelMatrix) * normal); vView = vec3(0.0, 0.0, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `${NOISE}
        uniform float uTime; uniform vec3 uSun; uniform float uDim;
        varying vec3 vN; varying vec3 vP; varying vec3 vView;
        void main() {
          vec3 p = normalize(vP);
          float land = fbm(p * 2.6 + 1.3);
          float r = ridge(p * 5.5 + 7.0);
          float detail = fbm(p * 18.0);
          vec3 sea = mix(vec3(0.015, 0.018, 0.03), vec3(0.04, 0.035, 0.05), detail);
          vec3 ground = mix(vec3(0.14, 0.1, 0.075), vec3(0.3, 0.22, 0.15), smoothstep(0.52, 0.8, land)) * (0.75 + detail * 0.5);
          ground = mix(ground, vec3(0.42, 0.4, 0.38), smoothstep(0.78, 0.92, r) * 0.4);
          float isLand = smoothstep(0.5, 0.53, land);
          vec3 albedo = mix(sea, ground, isLand);
          // Poles of ash and ice.
          albedo = mix(albedo, vec3(0.5, 0.5, 0.55), smoothstep(0.86, 0.97, abs(p.y)) * 0.45);
          float ndl = dot(normalize(vN), uSun);
          float day = smoothstep(-0.08, 0.35, ndl);
          vec3 lit = albedo * (0.015 + 1.15 * max(ndl, 0.0)) * vec3(1.0, 0.92, 0.85);
          // Glowing fault lines (lava) on land, fires and hive-city lights on the night side.
          float fault = smoothstep(0.9, 0.97, r) * isLand;
          float fires = smoothstep(0.72, 0.8, fbm(p * 30.0 + 3.0)) * isLand * smoothstep(0.55, 0.6, land);
          vec3 glow = vec3(1.6, 0.45, 0.08) * fault * (0.35 + 0.65 * (1.0 - day));
          glow += vec3(1.8, 0.7, 0.2) * fires * (1.0 - day) * (0.7 + 0.3 * sin(uTime * 3.0 + p.x * 40.0));
          vec3 c = lit + glow;
          // Specular glint on the ash seas.
          vec3 h = normalize(uSun + vView);
          c += vec3(0.5, 0.45, 0.4) * pow(max(dot(normalize(vN), h), 0.0), 60.0) * (1.0 - isLand) * day;
          // Atmospheric scattering towards the limb.
          float fres = pow(1.0 - max(dot(normalize(vN), vView), 0.0), 3.0);
          c = mix(c, vec3(0.25, 0.35, 0.85) * (0.1 + 0.6 * day), fres * 0.5);
          c *= 1.0 - uDim;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const segs = 128;
    this.planet.add(new THREE.Mesh(new THREE.SphereGeometry(r, segs, segs / 2), this.planetMat));
    // Clouds: a slightly larger shell with drifting fBm, shading and shadows faked by the sun term.
    this.cloudMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uSun: sun, uDim: { value: opts.dim ?? 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vP; void main() { vP = position; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `${NOISE}
        uniform float uTime; uniform vec3 uSun; uniform float uDim; varying vec3 vN; varying vec3 vP;
        void main() {
          vec3 p = normalize(vP);
          float c = fbm(p * 3.5 + vec3(uTime * 0.01, 0.0, uTime * 0.006) + fbm(p * 7.0) * 0.6);
          float a = smoothstep(0.58, 0.78, c) * 0.7;
          float ndl = dot(normalize(vN), uSun);
          vec3 col = vec3(0.7, 0.66, 0.62) * (0.02 + 0.9 * max(ndl, 0.0));
          gl_FragColor = vec4(col * (1.0 - uDim), a * (1.0 - uDim * 0.5));
          #include <colorspace_fragment>
        }`,
    });
    this.planet.add(new THREE.Mesh(new THREE.SphereGeometry(r * 1.012, segs, segs / 2), this.cloudMat));
    // Atmosphere halo: back-faced shell, additive fresnel.
    const atmo = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uSun: sun },
      vertexShader: `varying vec3 vN; varying vec3 vView; void main() { vN = normalize(mat3(modelMatrix) * normal); vView = vec3(0.0, 0.0, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vView;
        void main() {
          float rim = pow(max(0.0, 1.0 - abs(dot(vN, vView))), 2.0);
          float i = pow(rim, 1.8) * 1.1;
          float lit = 0.35 + 0.65 * smoothstep(-0.4, 0.6, dot(-vN, uSun));
          gl_FragColor = vec4(vec3(0.3, 0.45, 1.2) * i * lit, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.planet.add(new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 96, 48), atmo));
    if (opts.fleet) this.buildFleet();
    const size = Stage3D.bufferSize();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.5, 0.88));
    this.composer.addPass(new OutputPass());
    this.finish = finishPass(0.45, 0.03);
    this.composer.addPass(this.finish);
    this.camera.position.set(0, 0, 1000);
    phaser.game.events.on(Phaser.Core.Events.POST_RENDER, this.onPost);
    phaser.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
  }

  /** A strike group of gothic warships: long prows, spine towers, rows of lit ports, engine glow. */
  private buildFleet(): void {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.5 });
    const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const hot = (g: THREE.BufferGeometry | null): THREE.BufferGeometry | null => {
      const c = g?.getAttribute('color');
      if (c) for (let i = 0; i < c.array.length; i++) (c.array as Float32Array)[i] *= 3;
      return g;
    };
    const ship = (len: number): { solid: THREE.BufferGeometry; glow: THREE.BufferGeometry | null } => {
      const k = new Kit();
      k.box(len, len * 0.12, len * 0.16, 0x3a3a44, [0, 0, 0]);
      k.cone(len * 0.08, len * 0.3, 0x2a2a30, [len * 0.62, 0, 0], [0, 0, -Math.PI / 2], 4);
      k.box(len * 0.3, len * 0.18, len * 0.08, 0x44444e, [-len * 0.15, len * 0.14, 0]);
      k.box(len * 0.08, len * 0.3, len * 0.05, 0x55555e, [-len * 0.22, len * 0.3, 0]);
      k.box(len * 0.5, len * 0.03, len * 0.26, 0x2a2a30, [-len * 0.05, -len * 0.02, 0]);
      for (let i = 0; i < 8; i++) k.glow(new THREE.BoxGeometry(len * 0.02, len * 0.012, 0.5), 0xffc070, [-len * 0.3 + i * len * 0.08, len * 0.02, len * 0.081]);
      for (const z of [-len * 0.05, len * 0.05]) k.glow(new THREE.SphereGeometry(len * 0.045, 8, 6), 0x70b0ff, [-len * 0.52, 0, z]);
      const b = k.build();
      return { solid: b.solid, glow: hot(b.glow) };
    };
    const light = new THREE.DirectionalLight(0xffe0c0, 2.2);
    light.position.copy(SUN).multiplyScalar(1000);
    this.scene.add(light, new THREE.AmbientLight(0x404a70, 0.6));
    const specs = [[90, 170, 300, 12], [60, 230, 250, 16], [48, 120, 200, 18], [130, 300, 400, 9], [36, 360, 150, 22]];
    for (const [len, y, z, speed] of specs) {
      const s = ship(len);
      const g = new THREE.Group();
      g.add(new THREE.Mesh(s.solid, mat));
      if (s.glow) g.add(new THREE.Mesh(s.glow, glow));
      g.rotation.set(0.35, -0.25, 0.05);
      g.position.set(Math.random() * GAME_WIDTH, -y, z);
      this.scene.add(g);
      this.ships.push({ g, speed, y, z });
    }
  }

  private render(): void {
    if (!this.phaser.sys.isActive() && !this.phaser.sys.isPaused()) return;
    const dt = this.phaser.game.loop.delta / 1000;
    this.time += dt;
    if (Stage3D.fit()) {
      const pr = this.renderer.getPixelRatio();
      const s = Stage3D.bufferSize();
      this.composer.setPixelRatio(pr);
      this.composer.setSize(s.x / pr, s.y / pr);
    }
    this.planet.rotation.y += dt * (this.opts.spin ?? 0.02);
    this.planetMat.uniforms.uTime.value = this.time;
    this.cloudMat.uniforms.uTime.value = this.time;
    this.skyMat.uniforms.uTime.value = this.time;
    this.stars.position.x = -((this.time * 6) % (GAME_WIDTH * 0.4));
    for (const sh of this.ships) {
      sh.g.position.x += sh.speed * dt;
      if (sh.g.position.x > GAME_WIDTH + 200) sh.g.position.x = -200;
    }
    this.finish.uniforms.uTime.value = this.time;
    this.composer.render();
  }

  dispose(): void {
    this.phaser.game.events.off(Phaser.Core.Events.POST_RENDER, this.onPost);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose?.();
    });
    this.composer.dispose();
    Stage3D.hide(this);
  }
}
