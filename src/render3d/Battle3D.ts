import * as THREE from 'three';
import Phaser from 'phaser';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Projection } from '../render/Projection';
import { GraphicsQuality, Settings } from '../systems/Settings';
import { Stage3D } from './Stage3D';
import { Terrain3D } from './Terrain3D';
import { HEIGHT_SCALE, Units3D } from './Units3D';
import { FpsOverlay } from './FpsOverlay';
import { AtmosPreset, atmosFor } from './Atmos';
import { PropInstance, Props3D } from './Props3D';
import { Env3D } from './Env3D';
import { Buildings3D } from './Buildings3D';
import { World3D } from './World3D';
import { Lights3D, Spot } from './Lights3D';
import { Fog3D } from './Fog3D';
import { Fx3D } from './Fx3D';
import { Decals3D } from './Decals3D';
import { finishPass, fogPass, gradePass } from './Post3D';
import { surfaceDetail } from './Materials3D';
import { FOG, GFX3D, TILE_SIZE } from '../config';
import type { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { biomeForMap } from '../render/Biomes';
import { PROPS_CHANGED } from '../render/PropSystem';
import type { BattleScene } from '../scenes/BattleScene';
import type { BattleRenderer } from './Renderer';

const TIERS: GraphicsQuality[] = ['low', 'medium', 'high', 'ultra'];

/**
 * The 3D battlefield renderer. It owns no gameplay state: every frame it reads the simulation
 * (units, terrain) and the Phaser battle camera, and draws.
 *
 * Camera: an orthographic camera tilted so that its projection equals the 2D oblique view
 * (ground squashed by `tilt`, heights scaled by cos(asin(tilt))). Scroll and zoom stay owned
 * by CameraSystem, so picking, the minimap and every 2D overlay (bars, rings, fog, markers)
 * stay pixel-aligned with the 3D scene.
 */
export class Battle3D implements BattleRenderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 20000);
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private sun: THREE.DirectionalLight;
  private sunDir: THREE.Vector3;
  private atmos: AtmosPreset;
  private terrain: Terrain3D;
  private units: Units3D;
  private props: Props3D;
  private env: Env3D;
  private buildings: Buildings3D;
  private world: World3D;
  private lights: Lights3D;
  private fog: Fog3D;
  private fx: Fx3D;
  private decals: Decals3D;
  private decalList: Phaser.GameObjects.Image[] = [];
  private finish: ShaderPass;
  private fogFx: ShaderPass;
  private fogTex: THREE.CanvasTexture | null = null;
  private fogVersion = -1;
  private statics: Spot[] = [];
  private clock = 0;
  private refreshProps: () => void = () => undefined;
  private barrelCount = -1;
  private fps: FpsOverlay;
  private tierName: GraphicsQuality;
  private lowFor = 0;
  private onPost = (): void => this.render();

  constructor(private battle: BattleScene) {
    this.renderer = Stage3D.attach(battle.game, this);
    this.tierName = Settings.get().graphics;
    const tier = GFX3D[this.tierName];
    this.atmos = atmosFor(battle.map.def.id);
    const at = this.atmos;
    this.renderer.toneMappingExposure = at.exposure;
    this.scene.background = new THREE.Color(at.haze);
    this.scene.fog = null;
    // Lights: the map's key sun plus a sky/ground hemisphere fill.
    this.scene.add(new THREE.HemisphereLight(at.skyColor, at.groundColor, at.ambient));
    this.sun = new THREE.DirectionalLight(at.sunColor, at.sunIntensity);
    this.sunDir = new THREE.Vector3(...at.sunDir).normalize();
    this.sun.castShadow = tier.shadows;
    this.sun.shadow.mapSize.set(tier.shadowMap, tier.shadowMap);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 1.2;
    this.scene.add(this.sun, this.sun.target);
    this.renderer.shadowMap.enabled = tier.shadows;
    this.terrain = new Terrain3D(battle.map, this.renderer.capabilities.getMaxAnisotropy());
    this.scene.add(this.terrain.mesh);
    const biome = biomeForMap(battle.map.def.id);
    this.env = new Env3D(this.scene, (x, y) => this.terrain.heightAt(x, y), biome.cliffTop[1], battle.map.def.id.length * 131, tier.shadows);
    this.units = new Units3D(this.scene, tier.modelDetail, tier.shadows);
    this.props = new Props3D(this.scene, tier.shadows);
    this.buildings = new Buildings3D(this.scene, tier.shadows);
    this.renderer.localClippingEnabled = true;
    this.lights = new Lights3D(this.scene, tier.pointLights);
    this.lights.budget = tier.pointLights;
    this.fog = new Fog3D(this.scene, at.fogColor, at.fog);
    // Smoke is lit by the mix of sun and sky at this map's time of day.
    const smokeLight = new THREE.Color(at.sunColor).multiplyScalar(at.sunIntensity * 0.16).add(new THREE.Color(at.skyColor).multiplyScalar(at.ambient * 0.3));
    this.fx = new Fx3D(this.scene, (x, y) => this.terrain.heightAt(x, y), smokeLight, tier.modelDetail >= 1 ? 1 : 0.6);
    battle.effects.attach3D(this.fx);
    this.decals = new Decals3D(this.scene, battle.textures, new THREE.Color(at.sunColor).multiplyScalar(at.sunIntensity * 0.12).add(new THREE.Color(at.skyColor).multiplyScalar(at.ambient * 0.45)));
    this.world = new World3D(this.scene, battle.capture.points, (x, y) => this.terrain.heightAt(x, y), tier.shadows);
    const refreshProps = (): void => {
      const barrels = battle.world.barrelSpots().map((p, i) => ({ kind: 'barrels' as PropInstance['kind'], variant: i, x: p.x, y: p.y, rot: i * 1.7, scale: 1 }));
      this.props.set([...battle.props.list(), ...barrels], (x, y) => this.terrain.heightAt(x, y));
    };
    this.refreshProps = refreshProps;
    refreshProps();
    battle.events.on(PROPS_CHANGED, refreshProps);
    HEIGHT_SCALE.value = 1 / this.cosE();
    const size = Stage3D.bufferSize();
    // Scene target with a depth texture (fog of war reads world positions from it) and MSAA.
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: tier.antialias ? 4 : 0 });
    rt.depthTexture = new THREE.DepthTexture(size.x, size.y);
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.fogFx = fogPass(surfaceDetail());
    this.composer.addPass(this.fogFx);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), at.bloom, 0.45, 0.9);
    this.bloom.enabled = tier.bloom;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(gradePass(battle.map.def.id));
    this.finish = finishPass(at.vignette, at.grain);
    this.composer.addPass(this.finish);
    this.fps = new FpsOverlay();
    battle.game.events.on(Phaser.Core.Events.POST_RENDER, this.onPost);
    // Compile every shader up front (in parallel where the driver allows) so the opening
    // camera move does not hitch on first use.
    this.syncCamera();
    this.renderer.compileAsync(this.scene, this.camera).catch(() => undefined);
  }

  private cosE(): number {
    return Math.sqrt(1 - Projection.tilt * Projection.tilt);
  }

  /** Terrain height (px, 3D units) at a logical point. */
  heightAt(x: number, y: number): number {
    return this.terrain.heightAt(x, y);
  }

  /** Orthographic camera matching the Phaser battle camera's view rectangle. */
  private syncCamera(): void {
    const v = this.battle.cameras.main.worldView;
    const sinE = Projection.tilt;
    const cosE = this.cosE();
    const up = new THREE.Vector3(0, cosE, -sinE);
    const back = new THREE.Vector3(0, sinE, cosE);
    const D = 8000;
    this.camera.position.copy(back).multiplyScalar(D);
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), up, back);
    this.camera.quaternion.setFromRotationMatrix(m);
    this.camera.left = v.x;
    this.camera.right = v.x + v.width;
    this.camera.top = -v.y;
    this.camera.bottom = -(v.y + v.height);
    this.camera.near = 10;
    this.camera.far = D * 2;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    // Sun and its shadow frustum follow the ground point at the centre of the view.
    const cx = v.centerX;
    const cy = Projection.groundY(v.centerY);
    const span = Math.max(v.width, v.height / sinE) * 0.62 + 200;
    this.sun.target.position.set(cx, 0, cy);
    this.sun.position.set(cx + this.sunDir.x * 1800, this.sunDir.y * 1800, cy + this.sunDir.z * 1800);
    const sc = this.sun.shadow.camera;
    sc.left = -span;
    sc.right = span;
    sc.top = span;
    sc.bottom = -span;
    sc.near = 100;
    sc.far = 4200;
    sc.updateProjectionMatrix();
  }

  /** Feeds the fog-of-war canvas and the inverse camera matrix to the fog pass. */
  private syncFog(): void {
    const fog = this.battle.fog;
    const u = this.fogFx.uniforms;
    u.uOn.value = fog && fog.enabled ? 1 : 0;
    if (!fog) return;
    if (!this.fogTex) {
      this.fogTex = new THREE.CanvasTexture(fog.canvas);
      this.fogTex.flipY = false;
      this.fogTex.minFilter = this.fogTex.magFilter = THREE.LinearFilter;
      this.fogTex.wrapS = this.fogTex.wrapT = THREE.ClampToEdgeWrapping;
      const texel = (FOG.cellTiles * TILE_SIZE) / 2;
      u.uFogOrigin.value.set(-texel, -texel);
      u.uFogSize.value.set(fog.canvas.width * texel, fog.canvas.height * texel);
      u.uTexel.value.set(1 / fog.canvas.width, 1 / fog.canvas.height);
      u.tFog.value = this.fogTex;
    }
    if (fog.version !== this.fogVersion) {
      this.fogVersion = fog.version;
      this.fogTex.needsUpdate = true;
    }
    u.uInvPV.value.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse).invert();
    u.uTime.value = this.clock;
    // RenderPass draws into the composer's read buffer; its depth is what the fog pass reads.
    u.tDepth.value = this.composer.readBuffer.depthTexture;
  }

  /** Applies a quality tier live (adaptive quality or a settings change). */
  applyTier(name: GraphicsQuality): void {
    this.tierName = name;
    const t = GFX3D[name];
    this.bloom.enabled = t.bloom;
    this.lights.budget = t.pointLights;
    if (this.renderer.shadowMap.enabled !== t.shadows) {
      this.renderer.shadowMap.enabled = t.shadows;
      this.sun.castShadow = t.shadows;
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m) m.needsUpdate = true;
      });
    }
    if (this.sun.shadow.mapSize.x !== t.shadowMap) {
      this.sun.shadow.mapSize.set(t.shadowMap, t.shadowMap);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  /** Adaptive quality: after 6 s under 40 FPS, step down one tier (and remember it). */
  private adapt(dt: number): void {
    if (Settings.get().adaptiveQuality === false) return;
    const fps = this.battle.game.loop.actualFps;
    this.lowFor = fps < 40 ? this.lowFor + dt : 0;
    const i = TIERS.indexOf(this.tierName);
    if (this.lowFor > 6 && i > 0) {
      this.lowFor = 0;
      const next = TIERS[i - 1];
      Settings.set({ graphics: next });
      this.applyTier(next);
    }
  }

  /** Last frame's cost: CPU ms spent in this renderer (scene sync + submit) and GPU work counters. */
  readonly stats = { cpuMs: 0, calls: 0, tris: 0 };

  private render(): void {
    const t0 = performance.now();
    if (!this.battle.sys.isActive() && !this.battle.sys.isPaused()) return;
    const dt = this.battle.game.loop.delta / 1000;
    if (Stage3D.fit()) {
      const s = Stage3D.bufferSize();
      this.composer.setSize(s.x / this.renderer.getPixelRatio(), s.y / this.renderer.getPixelRatio());
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
    }
    HEIGHT_SCALE.value = 1 / this.cosE();
    this.syncCamera();
    // Barrels blow up during play: rebuild props when their count changes.
    const bc = this.battle.world.barrelSpots().length;
    if (bc !== this.barrelCount) {
      this.barrelCount = bc;
      this.refreshProps();
    }
    const all = this.battle.units.squads.flatMap((s) => s.units);
    const hAt = (x: number, y: number): number => this.terrain.heightAt(x, y);
    this.battle.effects.corpses.pruneBodies();
    this.units.update(all, this.battle.effects.corpses.bodies, this.battle.time.now, hAt);
    this.world.update(dt, this.battle.world.derelictSpots(), hAt);
    this.clock += dt;
    this.statics.length = 0;
    this.buildings.lightSpots(this.statics);
    this.world.lightSpots(this.statics);
    this.lights.update(this.battle.effects.lights.sources(), this.statics, this.battle.cameras.main.worldView, hAt);
    this.fog.update(this.clock);
    const mood = this.battle.map.def.id === 'veyra' ? 'dust' : this.battle.map.def.id === 'khorvan' ? 'night' : 'ash';
    this.fx.ambient(dt, mood, this.battle.cameras.main.worldView, mood === 'dust' ? 5 : 22 * GFX3D[this.tierName].modelDetail);
    this.fx.update(dt);
    this.decalList.length = 0;
    this.decalList.push(...this.battle.effects.blood.decalImages, ...this.battle.effects.trackImages);
    this.decals.update(this.decalList, hAt);
    this.finish.uniforms.uTime.value = this.clock;
    this.syncFog();
    this.buildings.update(this.battle.buildings.buildings, this.battle.wrecks.ruins, hAt, dt);
    this.renderer.info.autoReset = false;
    this.renderer.info.reset();
    this.composer.render();
    const cpu = performance.now() - t0;
    this.stats.cpuMs = this.stats.cpuMs * 0.9 + cpu * 0.1;
    this.stats.calls = this.renderer.info.render.calls;
    this.stats.tris = this.renderer.info.render.triangles;
    this.fps.update(this.battle.game.loop.actualFps, `3D · ${this.tierName} · ${this.stats.calls} calls · ${(this.stats.tris / 1000).toFixed(0)}k tris`);
    this.adapt(dt);
  }

  dispose(): void {
    this.battle.game.events.off(Phaser.Core.Events.POST_RENDER, this.onPost);
    this.units.dispose();
    this.props.dispose();
    this.buildings.dispose();
    this.world.dispose();
    this.fog.dispose();
    this.battle.effects.attach3D(null);
    this.fx.dispose();
    this.fogTex?.dispose();
    this.decals.dispose();
    this.env.dispose();
    this.terrain.dispose();
    this.composer.dispose();
    this.fps.destroy();
    Stage3D.hide(this);
  }
}
