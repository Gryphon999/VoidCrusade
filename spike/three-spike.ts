/**
 * A0 spike, option 2/3: the battlefield in real 3D with Three.js.
 * Same content as the Phaser spike: map terrain with raised cliffs, a squad and N units,
 * a building, an explosion, three point lights, soft directional shadows, bloom + ACES tone map.
 * URL params: ?units=100&shadows=1&bloom=1&scale=1
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { getMap } from '../src/maps';
import { MAP_H, MAP_W, TILE, TILE_SIZE } from '../src/config';
import { UNIT_MODELS } from '../src/render/puppet/UnitAtlas';
import { ANIM_FRAMES } from '../src/render/puppet/Models';
import { buildModelGeometry, ModelGeometry } from '../src/render3d/ModelMesh';
import { UnitId } from '../src/units/UnitDefs';

const q = new URLSearchParams(location.search);
const N = Number(q.get('units') ?? 100);
const SHADOWS = q.get('shadows') !== '0';
const BLOOM = q.get('bloom') !== '0';
const SCALE = Number(q.get('scale') ?? 1);

const W = window.innerWidth;
const H = window.innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio) * SCALE);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
renderer.shadowMap.enabled = SHADOWS;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1512);
scene.fog = new THREE.Fog(0x2a2018, 1400, 3200);

// ---- Camera: tilted perspective looking at a battle area -------------------------------
const focus = new THREE.Vector3(17 * TILE_SIZE, 0, 25 * TILE_SIZE);
const camera = new THREE.PerspectiveCamera(32, W / H, 20, 6000);
const pitch = THREE.MathUtils.degToRad(52);
const dist = 1300;
camera.position.set(focus.x, Math.sin(pitch) * dist, focus.z + Math.cos(pitch) * dist);
camera.lookAt(focus);

// ---- Lights --------------------------------------------------------------------------------
scene.add(new THREE.HemisphereLight(0xb0bcd8, 0x4a3a2c, 1.1));
const sun = new THREE.DirectionalLight(0xffd7a8, 2.6);
sun.position.set(focus.x - 700, 1100, focus.z - 500);
sun.target.position.copy(focus);
scene.add(sun, sun.target);
sun.castShadow = SHADOWS;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera as THREE.OrthographicCamera;
sc.left = -1100; sc.right = 1100; sc.top = 900; sc.bottom = -900; sc.near = 100; sc.far = 3000;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 1.5;
const pl = [
  { c: 0xff7a2a, x: 17, y: 24, i: 90000 },
  { c: 0x40d0ff, x: 24, y: 29, i: 60000 },
  { c: 0xffd060, x: 26, y: 22, i: 50000 },
].map((d) => {
  const l = new THREE.PointLight(d.c, d.i, 700, 2);
  l.position.set(d.x * TILE_SIZE, 90, d.y * TILE_SIZE);
  scene.add(l);
  return l;
});

// ---- Terrain -------------------------------------------------------------------------------
const map = getMap(0);
const SUB = 4;
const tg = new THREE.PlaneGeometry(MAP_W * TILE_SIZE, MAP_H * TILE_SIZE, MAP_W * SUB, MAP_H * SUB);
tg.rotateX(-Math.PI / 2);
tg.translate((MAP_W * TILE_SIZE) / 2, 0, (MAP_H * TILE_SIZE) / 2);
const pos = tg.getAttribute('position') as THREE.BufferAttribute;
const col = new Float32Array(pos.count * 3);
const tileAt = (x: number, z: number): number => {
  const tx = Math.min(MAP_W - 1, Math.max(0, Math.floor(x / TILE_SIZE)));
  const ty = Math.min(MAP_H - 1, Math.max(0, Math.floor(z / TILE_SIZE)));
  return map.tiles[ty][tx];
};
const hash = (x: number, y: number): number => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const noise = (x: number, y: number): number => {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
};
const cliffH = (x: number, z: number): number => {
  // Smoothly raised cliff blocks: average cliffness in a small neighbourhood.
  let n = 0;
  for (const [dx, dz] of [[0, 0], [20, 0], [-20, 0], [0, 20], [0, -20]]) n += tileAt(x + dx, z + dz) === TILE.CLIFF ? 1 : 0;
  return (n / 5) * 90;
};
const base = { g: new THREE.Color(0x5a4a3a), r: new THREE.Color(0x4a4a4e), c: new THREE.Color(0x3c342e), u: new THREE.Color(0x55504a) };
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i);
  const z = pos.getZ(i);
  const t = tileAt(x, z);
  const n1 = noise(x / 90, z / 90);
  const n2 = noise(x / 23, z / 23);
  let h = cliffH(x, z) + (n1 - 0.5) * 14 + (n2 - 0.5) * 4;
  if (t === TILE.ROAD) h *= 0.3;
  pos.setY(i, h);
  const c = (t === TILE.CLIFF ? base.c : t === TILE.ROAD ? base.r : t === TILE.RUINS ? base.u : base.g).clone();
  c.multiplyScalar(0.75 + n1 * 0.35 + n2 * 0.15);
  if (t === TILE.GROUND && n2 > 0.72) c.lerp(new THREE.Color(0x2a221c), 0.5); // scorch
  col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
}
tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
tg.computeVertexNormals();
// Detail texture so the ground never reads as flat vertex colour.
const detail = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
  const img = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const v = 180 + (noise(x / 6, y / 6) - 0.5) * 90 + (noise(x / 1.5, y / 1.5) - 0.5) * 50;
    const k = (y * 256 + x) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(MAP_W / 2, MAP_H / 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();
const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.95, metalness: 0 }));
terrain.receiveShadow = true;
scene.add(terrain);

// ---- Units: instanced per (type, walk frame) ------------------------------------------------
const matSolid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.55 });
const matGlow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const geoCache = new Map<string, ModelGeometry>();
const geo = (id: UnitId, anim: 'walk' | 'idle' | 'attack', f: number): ModelGeometry => {
  const k = `${id}:${anim}:${f}`;
  let g = geoCache.get(k);
  if (!g) {
    const { parts } = UNIT_MODELS[id].build(anim, f);
    g = buildModelGeometry(parts);
    // Glow colours are pushed above 1 so bloom picks them up.
    const gc = g.glow?.getAttribute('color');
    if (gc) for (let i = 0; i < gc.count * 3; i++) (gc.array as Float32Array)[i] *= 4;
    geoCache.set(k, g);
  }
  return g;
};
const types: UnitId[] = ['rifleman', 'breacher', 'heavy', 'crawler', 'spitter', 'leaper'];
interface U { type: UnitId; x: number; z: number; a: number; phase: number; team: number }
const units: U[] = [];
for (let i = 0; i < N; i++) {
  const team = i % 2;
  const type = types[(i % 3) + team * 3];
  const row = Math.floor(i / 20);
  units.push({ type, x: (14 + (i % 20) * 0.55 + team * 1.2) * TILE_SIZE, z: (22 + row * 1.3) * TILE_SIZE, a: team ? Math.PI : 0, phase: Math.random() * 6, team });
}
const WALK = ANIM_FRAMES.walk;
interface Batch { solid: THREE.InstancedMesh; glow: THREE.InstancedMesh | null }
const batches = new Map<string, Batch>();
for (const t of types) {
  for (let f = 0; f < WALK; f++) {
    const g = geo(t, 'walk', f);
    const solid = new THREE.InstancedMesh(g.solid, matSolid, N);
    solid.castShadow = true;
    solid.receiveShadow = true;
    solid.count = 0;
    scene.add(solid);
    let glow: THREE.InstancedMesh | null = null;
    if (g.glow) {
      glow = new THREE.InstancedMesh(g.glow, matGlow, N);
      glow.count = 0;
      scene.add(glow);
    }
    batches.set(`${t}:${f}`, { solid, glow });
  }
}
const m4 = new THREE.Matrix4();
const qy = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const one = new THREE.Vector3(1, 1, 1);
const vpos = new THREE.Vector3();
const heightAt = (x: number, z: number): number => cliffH(x, z) + (noise(x / 90, z / 90) - 0.5) * 14;
function updateUnits(t: number): void {
  for (const b of batches.values()) {
    b.solid.count = 0;
    if (b.glow) b.glow.count = 0;
  }
  for (const u of units) {
    u.x += Math.cos(u.a) * 0.4;
    if (u.x > 30 * TILE_SIZE) u.a = Math.PI;
    if (u.x < 12 * TILE_SIZE) u.a = 0;
    const f = Math.floor(t * 8 + u.phase) % WALK;
    const b = batches.get(`${u.type}:${f}`) as Batch;
    qy.setFromAxisAngle(up, -u.a);
    vpos.set(u.x, heightAt(u.x, u.z), u.z);
    m4.compose(vpos, qy, one);
    b.solid.setMatrixAt(b.solid.count++, m4);
    if (b.glow) b.glow.setMatrixAt(b.glow.count++, m4);
  }
  for (const b of batches.values()) {
    b.solid.instanceMatrix.needsUpdate = true;
    if (b.glow) b.glow.instanceMatrix.needsUpdate = true;
  }
}

// ---- Building: kit-bashed bastion ---------------------------------------------------------
const bastion = new THREE.Group();
const stone = new THREE.MeshStandardMaterial({ color: 0x8a8a90, roughness: 0.8, metalness: 0.2 });
const metal = new THREE.MeshStandardMaterial({ color: 0x3a3f48, roughness: 0.4, metalness: 0.85 });
const gold = new THREE.MeshStandardMaterial({ color: 0xc9a044, roughness: 0.35, metalness: 1 });
const win = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc870).multiplyScalar(3), toneMapped: false });
const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  bastion.add(mesh);
  return mesh;
};
add(new THREE.BoxGeometry(170, 110, 130), stone, 0, 55, 0);
add(new THREE.BoxGeometry(180, 14, 140), metal, 0, 116, 0);
for (const [x, z] of [[-95, -70], [95, -70], [-95, 70], [95, 70]]) {
  add(new THREE.CylinderGeometry(30, 34, 170, 12), stone, x, 85, z);
  add(new THREE.ConeGeometry(38, 60, 12), metal, x, 200, z);
  add(new THREE.SphereGeometry(6, 8, 6), win, x, 150, z + (z > 0 ? 31 : -31));
}
for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(14, 30, 2), win, -45 + i * 30, 60, 66);
add(new THREE.TorusGeometry(26, 4, 8, 24), gold, 0, 95, 66);
bastion.position.set(10 * TILE_SIZE, 0, 25 * TILE_SIZE);
scene.add(bastion);

// ---- Explosion: flash light + additive particles ------------------------------------------
const pCount = 300;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(pCount * 3);
const pVel = new Float32Array(pCount * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const spriteTex = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.35, 'rgba(255,140,40,0.8)'); g.addColorStop(1, 'rgba(80,20,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
})();
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 40, map: spriteTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: new THREE.Color(2, 1.4, 0.8) }));
scene.add(pts);
const boomLight = new THREE.PointLight(0xffa040, 0, 900, 2);
scene.add(boomLight);
let boomT = 99;
const boomAt = new THREE.Vector3(22 * TILE_SIZE, 20, 25 * TILE_SIZE);
function boom(): void {
  boomT = 0;
  for (let i = 0; i < pCount; i++) {
    pPos.set([boomAt.x, boomAt.y, boomAt.z], i * 3);
    const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2, s = 150 + Math.random() * 350;
    pVel.set([Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 80, Math.sin(a) * Math.cos(e) * s], i * 3);
  }
  boomLight.position.copy(boomAt).setY(80);
}
function updateBoom(dt: number): void {
  boomT += dt;
  if (boomT > 2.5) boom();
  boomLight.intensity = Math.max(0, 1 - boomT * 2) * 400000;
  for (let i = 0; i < pCount; i++) {
    pVel[i * 3 + 1] -= 300 * dt;
    for (let k = 0; k < 3; k++) pPos[i * 3 + k] += pVel[i * 3 + k] * dt;
  }
  (pts.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - boomT / 1.4);
  pGeo.getAttribute('position').needsUpdate = true;
}

// ---- Post-processing ------------------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
if (BLOOM) composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.7, 0.5, 0.85));
composer.addPass(new OutputPass());

// ---- Loop + FPS probe ----------------------------------------------------------------------
renderer.info.autoReset = false;
const stats = { frames: 0, t0: performance.now(), fps: 0, cpu: 0, calls: 0, tris: 0 };
(window as unknown as { spike: unknown }).spike = { stats, renderer };
const clock = new THREE.Timer();
function frame(): void {
  clock.update();
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.getElapsed();
  const c0 = performance.now();
  updateUnits(t);
  updateBoom(dt);
  pl[0].intensity = 90000 * (0.85 + Math.sin(t * 17) * 0.1 + Math.sin(t * 7) * 0.05);
  renderer.info.reset();
  composer.render();
  stats.calls = renderer.info.render.calls;
  stats.tris = renderer.info.render.triangles;
  stats.cpu = stats.cpu * 0.9 + (performance.now() - c0) * 0.1;
  stats.frames++;
  const now = performance.now();
  if (now - stats.t0 > 1000) {
    stats.fps = (stats.frames * 1000) / (now - stats.t0);
    stats.frames = 0;
    stats.t0 = now;
  }
  requestAnimationFrame(frame);
}
boom();
frame();
