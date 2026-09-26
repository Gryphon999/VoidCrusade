import * as THREE from 'three';
import type Phaser from 'phaser';
import { GFX3D } from '../config';
import { GraphicsQuality, Settings } from '../systems/Settings';

/**
 * The WebGL2 canvas that holds the 3D battlefield. It sits directly under Phaser's (transparent)
 * canvas, covers exactly the same rectangle, and renders at the display's native resolution
 * (devicePixelRatio, capped per quality tier, times the resolution-scale setting).
 */
class Stage3DImpl {
  renderer: THREE.WebGLRenderer | null = null;
  private game: Phaser.Game | null = null;
  private rect = { x: 0, y: 0, w: 0, h: 0, dpr: 0 };
  private antialias = true;
  /** Whoever attached last owns the canvas; only the owner may hide it. */
  private owner: object | null = null;

  /** True when this browser can run the 3D battlefield. */
  get supported(): boolean {
    try {
      const c = document.createElement('canvas');
      return !!c.getContext('webgl2');
    } catch {
      return false;
    }
  }

  /** Whether battles should use the 3D renderer (setting + capability). */
  wanted(): boolean {
    const r = Settings.get().renderer ?? 'auto';
    if (r === '2d') return false;
    return this.supported;
  }

  tier(): (typeof GFX3D)[GraphicsQuality] {
    return GFX3D[Settings.get().graphics];
  }

  /** Creates (or re-creates after an antialias change) the renderer under the Phaser canvas. */
  attach(game: Phaser.Game, owner: object | null = null): THREE.WebGLRenderer {
    this.game = game;
    this.owner = owner;
    const aa = this.tier().antialias;
    if (this.renderer && aa !== this.antialias) this.dispose();
    if (!this.renderer) {
      this.antialias = aa;
      const r = new THREE.WebGLRenderer({ antialias: aa, powerPreference: 'high-performance', alpha: false });
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.shadowMap.type = THREE.PCFShadowMap;
      const el = r.domElement;
      el.style.position = 'absolute';
      el.style.left = '0';
      el.style.top = '0';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '0';
      const parent = game.canvas.parentElement as HTMLElement;
      parent.style.position = 'relative';
      parent.insertBefore(el, game.canvas);
      game.canvas.style.position = game.canvas.style.position || 'relative';
      game.canvas.style.zIndex = '1';
      this.renderer = r;
      this.rect = { x: 0, y: 0, w: 0, h: 0, dpr: 0 };
    }
    this.renderer.domElement.style.display = 'block';
    this.fit();
    return this.renderer;
  }

  /** Keeps the 3D canvas exactly under Phaser's canvas; returns true if the size changed. */
  fit(): boolean {
    const r = this.renderer;
    const g = this.game;
    if (!r || !g) return false;
    const c = g.canvas;
    const parent = c.parentElement as HTMLElement;
    const cr = c.getBoundingClientRect();
    const pr = parent.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, this.tier().maxDpr) * (Settings.get().resolutionScale ?? 1);
    const x = cr.left - pr.left;
    const y = cr.top - pr.top;
    const next = { x, y, w: Math.round(cr.width), h: Math.round(cr.height), dpr };
    const o = this.rect;
    if (o.x === next.x && o.y === next.y && o.w === next.w && o.h === next.h && o.dpr === next.dpr) return false;
    this.rect = next;
    r.domElement.style.left = `${x}px`;
    r.domElement.style.top = `${y}px`;
    r.setPixelRatio(dpr);
    r.setSize(next.w, next.h, true);
    return true;
  }

  /** Size of the drawing buffer in device pixels. */
  bufferSize(): THREE.Vector2 {
    return this.renderer ? this.renderer.getDrawingBufferSize(new THREE.Vector2()) : new THREE.Vector2(1, 1);
  }

  /** Hides the canvas (ignored when `owner` is given and another user has attached since). */
  hide(owner: object | null = null): void {
    if (owner && this.owner && owner !== this.owner) return;
    if (this.renderer) this.renderer.domElement.style.display = 'none';
  }

  dispose(): void {
    if (!this.renderer) return;
    this.renderer.domElement.remove();
    this.renderer.dispose();
    this.renderer = null;
  }
}

export const Stage3D = new Stage3DImpl();
