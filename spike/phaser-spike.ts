/**
 * A0 spike, option 1: Phaser 2D + Light2D with normal maps generated from the baked sprites.
 * Same content as the Three.js spike: N units walking, a building sprite, 3 lights + a flash.
 * Light2D has no cast shadows, so units get painted blob shadows. ?units=100
 */
import Phaser from 'phaser';
import { createUnitAtlases, atlasKey, frameName } from '../src/render/puppet/UnitAtlas';
import { buildingArt } from '../src/render/buildings/BuildingArt';
import { UnitId } from '../src/units/UnitDefs';

const N = Number(new URLSearchParams(location.search).get('units') ?? 100);

/** Normal map from a sprite's luminance (Sobel), alpha kept. */
function normalMap(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const s = (src.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d') as CanvasRenderingContext2D;
  const img = ctx.createImageData(w, h);
  const L = (x: number, y: number): number => {
    x = Math.max(0, Math.min(w - 1, x));
    y = Math.max(0, Math.min(h - 1, y));
    const k = (y * w + x) * 4;
    return ((s[k] + s[k + 1] + s[k + 2]) / 765) * (s[k + 3] / 255);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1)) - (L(x - 1, y - 1) + 2 * L(x - 1, y) + L(x - 1, y + 1));
      const dy = (L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1)) - (L(x - 1, y - 1) + 2 * L(x, y - 1) + L(x + 1, y - 1));
      const nx = -dx * 2;
      const ny = -dy * 2;
      const l = Math.hypot(nx, ny, 1);
      const k = (y * w + x) * 4;
      img.data[k] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[k + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[k + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      img.data[k + 3] = s[k + 3];
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

class Spike extends Phaser.Scene {
  private units: { s: Phaser.GameObjects.Sprite; sh: Phaser.GameObjects.Ellipse; type: UnitId; dir: number; ph: number }[] = [];
  private flash!: Phaser.GameObjects.Light;
  private fire!: Phaser.GameObjects.Light;
  private t = 0;
  stats = { fps: 0 };

  create(): void {
    createUnitAtlases(this);
    const types: UnitId[] = ['rifleman', 'breacher', 'heavy', 'crawler', 'spitter', 'leaper'];
    for (const t of types) {
      const tex = this.textures.get(atlasKey(t));
      tex.setDataSource(normalMap(tex.getSourceImage() as HTMLCanvasElement));
    }
    // Ground: a noise canvas with a generated normal map.
    const g = document.createElement('canvas');
    g.width = 1280;
    g.height = 720;
    const gc = g.getContext('2d') as CanvasRenderingContext2D;
    const img = gc.createImageData(1280, 720);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 70 + Math.random() * 30;
      img.data[i] = v * 1.1;
      img.data[i + 1] = v * 0.9;
      img.data[i + 2] = v * 0.7;
      img.data[i + 3] = 255;
    }
    gc.putImageData(img, 0, 0);
    const gt = this.textures.addCanvas('ground', g);
    gt?.setDataSource(normalMap(g));
    this.add.image(0, 0, 'ground').setOrigin(0).setPipeline('Light2D');
    const art = buildingArt(this, 'stronghold', 1);
    const bt = this.textures.get(art.body);
    bt.setDataSource(normalMap(bt.getSourceImage() as HTMLCanvasElement));
    this.add.image(170, 380, art.body).setOrigin(art.originX, art.originY).setPipeline('Light2D').setDepth(380);
    for (let i = 0; i < N; i++) {
      const team = i % 2;
      const type = types[(i % 3) + team * 3];
      const x = 330 + (i % 20) * 34 + team * 60;
      const y = 200 + Math.floor(i / 20) * 70;
      const sh = this.add.ellipse(x, y, 26, 10, 0x000000, 0.45).setDepth(y - 1);
      const s = this.add.sprite(x, y, atlasKey(type), frameName('walk', 0, team ? 4 : 0)).setPipeline('Light2D').setDepth(y);
      this.units.push({ s, sh, type, dir: team ? 4 : 0, ph: Math.random() * 6 });
    }
    this.lights.enable().setAmbientColor(0x505060);
    this.fire = this.lights.addLight(260, 330, 320, 0xff7a2a, 2.2);
    this.lights.addLight(760, 460, 300, 0x40d0ff, 1.6);
    this.lights.addLight(900, 250, 280, 0xffd060, 1.4);
    this.lights.addLight(640, -200, 1400, 0xffd7a8, 1.1);
    this.flash = this.lights.addLight(700, 330, 360, 0xffa040, 0);
    (window as unknown as { spike: unknown }).spike = { stats: this.stats, game: this.game };
  }

  update(_t: number, dms: number): void {
    const dt = dms / 1000;
    this.t += dt;
    this.stats.fps = this.game.loop.actualFps;
    for (const u of this.units) {
      const dx = u.dir === 0 ? 0.4 : -0.4;
      u.s.x += dx;
      u.sh.x += dx;
      if (u.s.x > 1100) u.dir = 4;
      if (u.s.x < 250) u.dir = 0;
      const f = Math.floor(this.t * 8 + u.ph) % 6;
      u.s.setFrame(frameName('walk', f, u.dir));
    }
    const k = this.t % 2.5;
    this.flash.intensity = Math.max(0, 1 - k * 2) * 4;
    this.fire.intensity = 2.2 * (0.85 + Math.sin(this.t * 17) * 0.1);
  }
}

new Phaser.Game({
  type: Phaser.WEBGL,
  width: 1280,
  height: 720,
  backgroundColor: '#1a1512',
  scene: Spike,
});
