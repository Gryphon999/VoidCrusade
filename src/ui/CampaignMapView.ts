import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { BONUS_ICON, TERRITORIES, TerritoryDef, adjacencyPairs, getTerritory } from '../campaign/CampaignData';
import { makeRng } from '../utils/rng';
import { textStyle } from './uiStyle';
import { addPlanet } from '../render/PlanetArt';

const HEX = 72;
const CX = 700;
const CY = 300;

export type TerritoryStatus = 'owned' | 'attackable' | 'enemy';

interface HexView {
  def: TerritoryDef;
  x: number;
  y: number;
  poly: Phaser.Geom.Polygon;
}

function hexCenter(t: TerritoryDef): { x: number; y: number } {
  return { x: CX + HEX * Math.sqrt(3) * (t.q + t.r / 2), y: CY + HEX * 1.5 * t.r };
}

function hexPoints(x: number, y: number, size: number): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(new Phaser.Math.Vector2(x + size * Math.cos(a), y + size * Math.sin(a)));
  }
  return pts;
}

/** Draws the stylised planet, territory hexes and pulsing supply lines. */
export class CampaignMapView {
  private hexes: HexView[] = [];
  private fills: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.Graphics;
  private lines: Phaser.GameObjects.Graphics;
  private hovered: string | null = null;
  private flags = new Map<string, Phaser.GameObjects.Image>();
  private swords = new Map<string, Phaser.GameObjects.Image>();
  private t = 0;
  onHover?: (id: string | null) => void;
  onClick?: (id: string) => void;
  status: (id: string) => TerritoryStatus = () => 'enemy';

  constructor(private scene: Phaser.Scene) {
    this.drawBackground();
    this.lines = scene.add.graphics();
    this.fills = scene.add.graphics();
    this.glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    for (const def of TERRITORIES) {
      const c = hexCenter(def);
      const poly = new Phaser.Geom.Polygon(hexPoints(c.x, c.y, HEX - 3));
      this.hexes.push({ def, x: c.x, y: c.y, poly });
    }
    for (const h of this.hexes) {
      const flag = scene.add.image(h.x + 30, h.y - 34, 'pylon_flag').setOrigin(0, 0).setScale(0.55);
      this.flags.set(h.def.id, flag);
      const swords = scene.add.image(h.x - 34, h.y - 32, 'glyph_attack').setScale(0.55).setVisible(false);
      scene.tweens.add({ targets: swords, scale: 0.68, duration: 600, yoyo: true, repeat: -1 });
      this.swords.set(h.def.id, swords);
      scene.add.image(h.x, h.y - 16, BONUS_ICON[h.def.bonus]).setScale(1.4);
      scene.add.text(h.x, h.y + 18, h.def.name, { ...textStyle(13), align: 'center', wordWrap: { width: HEX * 1.5 } })
        .setOrigin(0.5).setStroke('#000', 3);
    }
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => this.setHover(this.hit(p.x, p.y)));
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const id = this.hit(p.x, p.y);
      if (id && p.leftButtonDown()) this.onClick?.(id);
    });
  }

  private hit(x: number, y: number): string | null {
    return this.hexes.find((h) => Phaser.Geom.Polygon.Contains(h.poly, x, y))?.def.id ?? null;
  }

  private setHover(id: string | null): void {
    if (id === this.hovered) return;
    this.hovered = id;
    this.onHover?.(id);
    this.scene.input.setDefaultCursor(id && this.status(id) === 'attackable' ? 'pointer' : 'default');
  }

  private drawBackground(): void {
    const s = this.scene;
    const bg = s.add.graphics();
    for (let i = 0; i < 24; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x05030c), Phaser.Display.Color.ValueToColor(0x140a26), 24, i);
      bg.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(0, (GAME_HEIGHT / 24) * i, GAME_WIDTH, GAME_HEIGHT / 24 + 1);
    }
    const rnd = makeRng(1337);
    for (let i = 0; i < 14; i++) {
      const tint = [0x6020a0, 0x2040a0, 0xa02060, 0x3060c0][i % 4];
      s.add.image(rnd() * GAME_WIDTH, rnd() * GAME_HEIGHT, 'aura').setScale(3 + rnd() * 5).setTint(tint)
        .setAlpha(0.18 + rnd() * 0.2).setBlendMode(Phaser.BlendModes.ADD);
    }
    const stars = s.add.graphics();
    for (let i = 0; i < 260; i++) {
      stars.fillStyle(0xffffff, 0.3 + rnd() * 0.7).fillCircle(rnd() * GAME_WIDTH, rnd() * GAME_HEIGHT, rnd() < 0.9 ? 0.8 : 1.6);
    }
    // Painted planet Kronus-like world under the territory hexes.
    addPlanet(s, CX + 40, CY + 110, 340);
    // Darken the planet a touch so hex colours read.
    s.add.circle(CX + 40, CY + 110, 342, 0x000000, 0.25);
  }

  update(dt: number): void {
    this.t += dt;
    const g = this.fills.clear();
    const glow = this.glow.clear();
    for (const h of this.hexes) {
      const st = this.status(h.def.id);
      this.flags.get(h.def.id)?.setTint(st === 'owned' ? 0x3a70d8 : 0x9a1a2a);
      this.swords.get(h.def.id)?.setVisible(st === 'attackable');
      const fill = st === 'owned' ? 0x1e4a9a : 0x6a1420;
      g.fillStyle(fill, st === 'owned' ? 0.8 : 0.7).fillPoints(h.poly.points, true);
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
      let border = st === 'owned' ? 0x6ab0ff : 0xc04050;
      let width = 2;
      if (h.def.bonus === 'throne') {
        border = 0xb08820;
        width = 4;
      }
      if (st === 'attackable') {
        border = 0x50ff90;
        width = 2 + pulse * 3;
      }
      g.lineStyle(width, border, 1).strokePoints(h.poly.points, true);
      if (h.def.id === this.hovered) {
        glow.fillStyle(0xffffff, 0.12).fillPoints(h.poly.points, true);
        glow.lineStyle(8, border, 0.35 + pulse * 0.25).strokePoints(h.poly.points, true);
      }
    }
    this.drawLines();
  }

  private drawLines(): void {
    const g = this.lines.clear();
    for (const [a, b] of adjacencyPairs()) {
      const pa = hexCenter(getTerritory(a));
      const pb = hexCenter(getTerritory(b));
      const owned = this.status(a) === 'owned' && this.status(b) === 'owned';
      const col = owned ? 0x6ab0ff : 0xa0a0c0;
      g.lineStyle(2, col, 0.25).lineBetween(pa.x, pa.y, pb.x, pb.y);
      for (let k = 0; k < 3; k++) {
        const f = (this.t * 0.35 + k / 3 + (a.length + b.length) * 0.07) % 1;
        const x = pa.x + (pb.x - pa.x) * f;
        const y = pa.y + (pb.y - pa.y) * f;
        const alpha = Math.sin(f * Math.PI);
        g.fillStyle(col, alpha).fillCircle(x, y, 2.5);
      }
    }
  }
}
