import Phaser from 'phaser';
import { makeCanvas } from './CanvasUtil';
import { ValueNoise } from './Noise';

const SIZE = 512;

/**
 * Painted planet: fBm continents over dark seas of ash, glowing fault lines, a lit terminator
 * from the upper-left and an atmospheric rim. Painted at 512px and stretched smoothly.
 */
export function createPlanetArt(scene: Phaser.Scene): void {
  if (scene.textures.exists('planet')) return;
  const { canvas, ctx } = makeCanvas(SIZE, SIZE);
  const img = ctx.createImageData(SIZE, SIZE);
  const n = new ValueNoise(4242);
  const R = SIZE / 2 - 2;
  const L = { x: -0.55, y: -0.5, z: 0.67 };
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const dx = (px - SIZE / 2) / R;
      const dy = (py - SIZE / 2) / R;
      const d2 = dx * dx + dy * dy;
      const i = (py * SIZE + px) * 4;
      if (d2 > 1) continue;
      const dz = Math.sqrt(1 - d2);
      // Sphere-mapped noise so features wrap convincingly toward the limb.
      const u = Math.atan2(dx, dz) * 2.2 + 3;
      const v = Math.asin(dy) * 2.2 + 3;
      const land = n.fbm(u * 2.2, v * 2.2, 5);
      const ridge = 1 - Math.abs(n.fbm(u * 4 + 9, v * 4 + 9, 4) - 0.5) * 2;
      let r: number;
      let g: number;
      let b: number;
      if (land > 0.52) {
        const t = (land - 0.52) * 3;
        r = 92 + t * 60;
        g = 70 + t * 40;
        b = 56 + t * 24;
      } else {
        r = 34 + land * 30;
        g = 30 + land * 26;
        b = 40 + land * 34;
      }
      const lit = Math.max(0, dx * L.x + dy * L.y + dz * L.z);
      const shadeF = 0.12 + 0.95 * lit;
      r *= shadeF;
      g *= shadeF;
      b *= shadeF;
      // Glowing magma fault lines, brighter on the night side.
      if (ridge > 0.93 && land > 0.45) {
        const glow = (ridge - 0.93) / 0.07;
        r += 230 * glow * (0.6 + (1 - lit) * 0.6);
        g += 70 * glow;
        b += 10 * glow;
      }
      // Atmospheric haze at the limb.
      const limb = Math.pow(1 - dz, 3);
      r += limb * 90 * (0.3 + lit);
      g += limb * 60 * (0.3 + lit);
      b += limb * 140 * (0.3 + lit);
      img.data[i] = Math.min(255, r);
      img.data[i + 1] = Math.min(255, g);
      img.data[i + 2] = Math.min(255, b);
      // Anti-aliased limb.
      img.data[i + 3] = Math.round(255 * Math.min(1, (1 - Math.sqrt(d2)) * R / 1.5));
    }
  }
  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas('planet', canvas);
  const a = makeCanvas(SIZE, SIZE);
  const grad = a.ctx.createRadialGradient(SIZE / 2, SIZE / 2, R * 0.9, SIZE / 2, SIZE / 2, SIZE / 2);
  grad.addColorStop(0, 'rgba(120,150,255,0)');
  grad.addColorStop(0.35, 'rgba(120,150,255,0.55)');
  grad.addColorStop(1, 'rgba(60,40,140,0)');
  a.ctx.fillStyle = grad;
  a.ctx.fillRect(0, 0, SIZE, SIZE);
  scene.textures.addCanvas('planet_atmo', a.canvas);
}

/** Adds planet + atmosphere at (x, y) with the given on-screen radius. */
export function addPlanet(scene: Phaser.Scene, x: number, y: number, radius: number): Phaser.GameObjects.Image {
  const s = (radius * 2) / (SIZE - 4);
  scene.add.image(x, y, 'planet_atmo').setScale(s * 1.18).setBlendMode(Phaser.BlendModes.ADD);
  return scene.add.image(x, y, 'planet').setScale(s);
}
