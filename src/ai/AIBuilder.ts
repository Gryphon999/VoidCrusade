import Phaser from 'phaser';
import { BUILD, TILE_SIZE } from '../config';
import { Owner } from '../types';
import { BuildingId } from '../buildings/BuildingDefs';
import type { BattleScene } from '../scenes/BattleScene';

/** Finds legal build sites for the AI around its base. */
export class AIBuilder {
  constructor(private battle: BattleScene, private owner: Owner) {}

  /** Fortifies a captured point with an outpost (Listening Post / Spore Node). */
  placeOnPoint(id: BuildingId, px: number, py: number): boolean {
    const bs = this.battle.buildings;
    const c = { tx: Math.floor(px / TILE_SIZE), ty: Math.floor(py / TILE_SIZE) };
    for (let dy = -2; dy <= 1; dy++) {
      for (let dx = -2; dx <= 1; dx++) {
        if (bs.validate(this.owner, id, c.tx + dx, c.ty + dy).ok) return !!bs.tryPlace(this.owner, id, c.tx + dx, c.ty + dy);
      }
    }
    return false;
  }

  /** Places a building at the best valid site. `forward` prefers sites toward the enemy. */
  place(id: BuildingId, forward: boolean): boolean {
    const bs = this.battle.buildings;
    const hq = bs.getHQ(this.owner);
    if (!hq) return false;
    const foe = bs.getHQ(this.owner === 'enemy' ? 'player' : 'enemy');
    const sites: { tx: number; ty: number; score: number }[] = [];
    const range = 14;
    const hx = Math.floor(hq.tx / BUILD.snap);
    const hy = Math.floor(hq.ty / BUILD.snap);
    const cells = Math.ceil(range / BUILD.snap);
    for (let cy = hy - cells; cy <= hy + cells; cy++) {
      for (let cx = hx - cells; cx <= hx + cells; cx++) {
        const wx = (cx * BUILD.snap + 1) * TILE_SIZE;
        const wy = (cy * BUILD.snap + 1) * TILE_SIZE;
        const { tx, ty } = bs.snap(wx, wy, id);
        if (!bs.validate(this.owner, id, tx, ty).ok) continue;
        const px = (tx + 1) * TILE_SIZE;
        const py = (ty + 1) * TILE_SIZE;
        let score = Phaser.Math.Distance.Between(px, py, hq.x, hq.y);
        if (forward && foe) score = Phaser.Math.Distance.Between(px, py, foe.x, foe.y) * 0.6 + score * 0.4;
        sites.push({ tx, ty, score: score + Math.random() * 60 });
      }
    }
    if (sites.length === 0) return false;
    sites.sort((a, b) => a.score - b.score);
    return !!bs.tryPlace(this.owner, id, sites[0].tx, sites[0].ty);
  }
}
