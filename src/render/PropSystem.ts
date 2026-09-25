import Phaser from 'phaser';
import { DEPTH, TILE, TILE_SIZE } from '../config';
import { EV } from '../events';
import { makeRng } from '../utils/rng';
import { Projection } from './Projection';
import { Culler } from './Culler';
import { PROP_VARIANTS, PropKind, propBase, propKey } from './PropArt';
import { Building } from '../buildings/Building';
import type { BattleScene } from '../scenes/BattleScene';

interface Prop {
  x: number;
  y: number;
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
}

/** Decorative, gameplay-free props scattered over the battlefield and Y-sorted with units. */
export class PropSystem {
  private props: Prop[] = [];

  constructor(private battle: BattleScene, seed: number) {
    const map = battle.map;
    const rnd = makeRng(seed);
    const bases = [map.def.playerBase, map.def.enemyBase].map((b) => ({ x: b.tx + 2, y: b.ty + 2 }));
    const nearCliff = (tx: number, ty: number): boolean => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (map.getTile(tx + dx, ty + dy) === TILE.CLIFF) return true;
      return false;
    };
    const open: PropKind[] = ['tree', 'skulls', 'banner', 'wreck', 'rocks', 'crates', 'tree', 'rocks'];
    for (let ty = 1; ty < map.height - 1; ty++) {
      for (let tx = 1; tx < map.width - 1; tx++) {
        const t = map.getTile(tx, ty);
        if (t === TILE.CLIFF || t === TILE.ROAD) continue;
        if (bases.some((b) => Math.hypot(b.x - tx, b.y - ty) < 9)) continue;
        if (battle.buildings.reserved.has(ty * map.width + tx)) continue;
        let kind: PropKind | null = null;
        const r = rnd();
        if (t === TILE.RUINS) kind = r < 0.35 ? 'wall' : r < 0.55 ? 'pillar' : null;
        else if (nearCliff(tx, ty)) kind = r < 0.1 ? (rnd() < 0.6 ? 'rocks' : 'tree') : null;
        else if (r < 0.028) kind = open[Math.floor(rnd() * open.length)];
        if (kind) this.add(kind, (tx + 0.2 + rnd() * 0.6) * TILE_SIZE, (ty + 0.3 + rnd() * 0.5) * TILE_SIZE, rnd);
      }
    }
    const onPlaced = (b: Building): void => this.clearFootprint(b);
    battle.events.on(EV.buildingPlaced, onPlaced);
  }

  private add(kind: PropKind, x: number, y: number, rnd: () => number): void {
    const key = propKey(kind, Math.floor(rnd() * PROP_VARIANTS));
    const vy = Projection.vy(y);
    const img = this.battle.add.image(x, vy, key).setOrigin(0.5, propBase(kind)).setDepth(Projection.depth(y));
    if (rnd() < 0.5) img.setFlipX(true);
    const w = img.width;
    const shadow = this.battle.add.image(x + w * 0.18, vy + 2, 'fx_soft').setTint(0x000000).setAlpha(0.45)
      .setScale((w * 1.1) / 32, (w * 0.5 * Projection.tilt) / 32).setDepth(DEPTH.shadows);
    const culler = Culler.for(this.battle);
    culler.add(img, x, vy);
    culler.add(shadow, x, vy);
    this.props.push({ x, y, img, shadow });
  }

  /** Removes props that a newly placed building would stand on. */
  private clearFootprint(b: Building): void {
    const r = b.radius + TILE_SIZE * 0.4;
    this.props = this.props.filter((p) => {
      if (Math.abs(p.x - b.x) > r || Math.abs(p.y - b.y) > r) return true;
      p.img.destroy();
      p.shadow.destroy();
      return false;
    });
  }
}
