import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, MINIMAP, TILE, TILE_SIZE } from '../config';
import { EV } from '../events';
import { ownerColor } from '../systems/CapturePoint';
import type { BattleScene } from '../scenes/BattleScene';

const TERRAIN_COLORS: Record<number, number> = {
  [TILE.GROUND]: 0x3a3a3e,
  [TILE.CLIFF]: 0x0c0804,
  [TILE.ROAD]: 0x5a5246,
  [TILE.RUINS]: 0x4c4640,
};

/** Bottom-right overview map: terrain, unit/building dots, camera viewport, click-to-scroll. */
export class MiniMap {
  readonly bounds: Phaser.Geom.Rectangle;
  private terrain: Phaser.GameObjects.Graphics;
  private dots: Phaser.GameObjects.Graphics;
  private view: Phaser.GameObjects.Graphics;
  private fogLayer: Phaser.GameObjects.Graphics;
  private sx: number;
  private sy: number;
  private timer: Phaser.Time.TimerEvent;
  private dragging = false;

  constructor(scene: Phaser.Scene, private battle: BattleScene) {
    const { width: w, height: h, margin: m } = MINIMAP;
    const x = GAME_WIDTH - w - m;
    const y = GAME_HEIGHT - h - m;
    this.bounds = new Phaser.Geom.Rectangle(x, y, w, h);
    this.sx = w / battle.map.worldWidth;
    this.sy = h / battle.map.worldHeight;
    const frame = scene.add.graphics();
    frame.fillStyle(0x05050a, 0.75).fillRect(x - 4, y - 4, w + 8, h + 8);
    frame.lineStyle(2, COLORS.uiBorder, 1).strokeRect(x - 4, y - 4, w + 8, h + 8);
    this.terrain = scene.add.graphics({ x, y }).setAlpha(0.85);
    this.fogLayer = scene.add.graphics({ x, y });
    this.dots = scene.add.graphics({ x, y });
    this.view = scene.add.graphics({ x, y });
    this.drawTerrain();
    this.drawDots();
    this.timer = scene.time.addEvent({ delay: MINIMAP.refreshMs, loop: true, callback: () => this.drawDots() });

    const zone = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive();
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!p.leftButtonDown()) return;
      this.dragging = true;
      this.jump(p);
    });
    zone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragging && p.leftButtonDown()) this.jump(p);
    });
    scene.input.on('pointerup', () => (this.dragging = false));
    const redraw = (): void => this.drawTerrain();
    battle.events.on(EV.buildingDestroyed, redraw);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      battle.events.off(EV.buildingDestroyed, redraw);
      this.timer.remove();
    });
  }

  private jump(p: Phaser.Input.Pointer): void {
    const wx = (p.x - this.bounds.x) / this.sx;
    const wy = (p.y - this.bounds.y) / this.sy;
    this.battle.cameraSystem.centerOn(wx, wy);
  }

  private drawTerrain(): void {
    const g = this.terrain.clear();
    const tiles = this.battle.map.getTiles();
    const tw = TILE_SIZE * this.sx;
    const th = TILE_SIZE * this.sy;
    for (let ty = 0; ty < tiles.length; ty++) {
      for (let tx = 0; tx < tiles[ty].length; tx++) {
        g.fillStyle(TERRAIN_COLORS[tiles[ty][tx]] ?? 0x333333, 1).fillRect(tx * tw, ty * th, Math.ceil(tw), Math.ceil(th));
      }
    }
  }

  /** Redraws dots; runs every 500 ms. */
  drawDots(): void {
    const g = this.dots.clear();
    const fog = this.battle.fog;
    for (const b of this.battle.buildings.buildings) {
      if (!b.alive) continue;
      if (b.owner === 'enemy' && fog && !b.discovered) continue;
      const s = b.def.size * TILE_SIZE;
      g.fillStyle(ownerColor(b.owner), 1).fillRect((b.x - s / 2) * this.sx, (b.y - s / 2) * this.sy, s * this.sx, s * this.sy);
    }
    for (const p of this.battle.capture.points) {
      const col = p.owner ? ownerColor(p.owner) : 0xffd040;
      g.fillStyle(0x000000, 1).fillCircle(p.x * this.sx, p.y * this.sy, 4.5);
      g.fillStyle(col, 1).fillCircle(p.x * this.sx, p.y * this.sy, 3.2);
    }
    for (const s of this.battle.units.squads) {
      if (!s.alive) continue;
      const col = s.owner === 'player' ? 0x6ab0ff : 0xff5050;
      g.fillStyle(col, 1);
      for (const u of s.units) {
        if (s.owner === 'enemy' && !u.isShown) continue;
        g.fillRect(u.x * this.sx - 1, u.y * this.sy - 1, 2, 2);
      }
    }
    this.drawFog();
  }

  private drawFog(): void {
    const g = this.fogLayer.clear();
    const fog = this.battle.fog;
    if (!fog) return;
    fog.forEachCell((x, y, w, h, alpha) => {
      if (alpha > 0) g.fillStyle(0x000000, alpha).fillRect(x * this.sx, y * this.sy, w * this.sx + 0.5, h * this.sy + 0.5);
    });
  }

  /** Per-frame: camera viewport rectangle. */
  update(): void {
    const v = this.battle.cameraSystem.visibleWorldRect();
    this.view.clear().lineStyle(1, 0xffffff, 0.9).strokeRect(v.x * this.sx, v.y * this.sy, v.width * this.sx, v.height * this.sy);
  }
}
