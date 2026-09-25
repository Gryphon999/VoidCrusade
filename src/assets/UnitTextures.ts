import Phaser from 'phaser';
import { bakeTexture } from './TileTextures';
import { UnitId } from '../units/UnitDefs';

type G = Phaser.GameObjects.Graphics;

/** Each unit texture faces right (+x) and is centered. */
const UNIT_TEX: Record<UnitId, { size: number; draw: (g: G, c: number) => void }> = {
  rifleman: {
    size: 24,
    draw: (g, c) => {
      g.fillStyle(0x1b2a44, 1).fillCircle(c, c, 8);
      g.fillStyle(0x3a6ac0, 1).fillCircle(c, c, 6.5);
      g.fillStyle(0x222222, 1).fillRect(c + 2, c + 1, 10, 3);
      g.fillStyle(0x9ab0d0, 1).fillCircle(c - 1, c, 3.5);
    },
  },
  heavy: {
    size: 30,
    draw: (g, c) => {
      g.fillStyle(0x1b2a44, 1).fillCircle(c, c, 10);
      g.fillStyle(0x2c5aa8, 1).fillCircle(c, c, 8.5);
      g.fillStyle(0x6a7890, 1).fillRect(c - 7, c - 11, 8, 6).fillRect(c - 7, c + 5, 8, 6);
      g.fillStyle(0x1a1a1a, 1).fillRect(c + 2, c - 3, 13, 6);
      g.fillStyle(0xffa020, 1).fillRect(c + 13, c - 2, 2, 4);
      g.fillStyle(0xb0c0d8, 1).fillCircle(c - 1, c, 4);
    },
  },
  commander: {
    size: 36,
    draw: (g, c) => {
      g.fillStyle(0x8a1010, 1).fillTriangle(c - 14, c - 10, c - 14, c + 10, c + 2, c);
      g.fillStyle(0xc8a030, 1).fillCircle(c, c, 12);
      g.fillStyle(0x2a58b0, 1).fillCircle(c, c, 9.5);
      g.fillStyle(0xf0d060, 1).fillRect(c - 8, c - 14, 9, 7).fillRect(c - 8, c + 7, 9, 7);
      g.fillStyle(0xd0d8e8, 1).fillRect(c + 4, c - 2, 14, 4);
      g.fillStyle(0xf0f0ff, 1).fillCircle(c, c, 4.5);
    },
  },
  crawler: {
    size: 24,
    draw: (g, c) => {
      g.lineStyle(2, 0x3a0a14, 1);
      for (const s of [-1, 1]) {
        g.lineBetween(c - 3, c, c - 8, c + s * 8).lineBetween(c + 1, c, c - 1, c + s * 9).lineBetween(c + 4, c, c + 6, c + s * 8);
      }
      g.fillStyle(0x7a1a2a, 1).fillEllipse(c, c, 14, 9);
      g.fillStyle(0xb03048, 1).fillEllipse(c + 4, c, 7, 6);
      g.fillStyle(0xe8d8a0, 1).fillTriangle(c + 7, c - 3, c + 7, c - 1, c + 11, c - 3).fillTriangle(c + 7, c + 3, c + 7, c + 1, c + 11, c + 3);
    },
  },
  behemoth: {
    size: 44,
    draw: (g, c) => {
      g.fillStyle(0x2e0c16, 1).fillEllipse(c, c, 34, 28);
      g.fillStyle(0x6a1a30, 1).fillEllipse(c, c, 30, 24);
      g.fillStyle(0x8a3448, 1).fillCircle(c - 5, c - 6, 5).fillCircle(c - 5, c + 6, 5).fillCircle(c - 11, c, 4);
      g.fillStyle(0x9a2a3a, 1).fillEllipse(c + 10, c, 12, 12);
      g.fillStyle(0xe8dcb0, 1).fillTriangle(c + 12, c - 6, c + 14, c - 3, c + 21, c - 11).fillTriangle(c + 12, c + 6, c + 14, c + 3, c + 21, c + 11);
      g.fillStyle(0xff4040, 1).fillCircle(c + 13, c - 2, 1.5).fillCircle(c + 13, c + 2, 1.5);
    },
  },
};

export function unitTextureKey(id: UnitId): string {
  return `unit_${id}`;
}

export function createUnitTextures(scene: Phaser.Scene): void {
  for (const [id, t] of Object.entries(UNIT_TEX) as [UnitId, (typeof UNIT_TEX)[UnitId]][]) {
    bakeTexture(scene, unitTextureKey(id), t.size, t.size, (g) => t.draw(g, t.size / 2));
  }
  bakeTexture(scene, 'sel_ring', 32, 32, (g) => {
    g.lineStyle(2, 0x40ff60, 1).strokeCircle(16, 16, 14);
  });
  bakeTexture(scene, 'proj_bullet', 12, 4, (g) => {
    g.fillStyle(0xfff0a0, 1).fillRect(0, 1, 12, 2);
    g.fillStyle(0xffffff, 1).fillRect(8, 1, 4, 2);
  });
  bakeTexture(scene, 'proj_shell', 10, 10, (g) => {
    g.fillStyle(0xff8020, 0.6).fillCircle(5, 5, 5);
    g.fillStyle(0xffe070, 1).fillCircle(5, 5, 3);
  });
  bakeTexture(scene, 'proj_spit', 10, 10, (g) => {
    g.fillStyle(0x80ff40, 0.5).fillCircle(5, 5, 5);
    g.fillStyle(0xd0ff80, 1).fillCircle(5, 5, 2.5);
  });
  bakeTexture(scene, 'proj_spine', 16, 6, (g) => {
    g.fillStyle(0xe8dcb0, 1).fillTriangle(0, 0, 0, 6, 16, 3);
  });
  bakeTexture(scene, 'fx_slash', 24, 24, (g) => {
    g.lineStyle(3, 0xffffff, 0.9).beginPath().arc(12, 12, 9, -1.2, 1.2).strokePath();
  });
  bakeTexture(scene, 'move_marker', 32, 32, (g) => {
    g.lineStyle(2, 0x40ff60, 1).strokeCircle(16, 16, 12);
    g.lineBetween(16, 2, 16, 8).lineBetween(16, 24, 16, 30).lineBetween(2, 16, 8, 16).lineBetween(24, 16, 30, 16);
  });
}
