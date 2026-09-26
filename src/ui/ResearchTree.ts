import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { headingFont, t } from '../i18n';
import { EV } from '../events';
import { costText, researchDesc, researchName } from '../i18n/names';
import { RESEARCH_DEFS, ResearchDef } from '../systems/ResearchSystem';
import { researchGlyph } from './GlyphIcons';
import { Button } from './Button';
import { drawPanel, textStyle } from './uiStyle';
import type { Building } from '../buildings/Building';
import type { BattleScene } from '../scenes/BattleScene';

const W = 1000;
const H = 470;
const NODE_W = 280;
const NODE_H = 60;
const COL_GAP = 310;

/**
 * Research tree overlay: every upgrade of the player's faction laid out by tier (columns)
 * with lines to prerequisites, costs, progress and lock reasons. Click a node to start it.
 */
export class ResearchTree {
  private root: Phaser.GameObjects.Container | null = null;
  private refreshers: (() => void)[] = [];

  constructor(private scene: Phaser.Scene, private battle: BattleScene) {}

  get isOpen(): boolean {
    return this.root !== null;
  }

  open(from?: Building): void {
    this.close();
    const b = this.battle;
    const faction = b.factions.player;
    const defs = RESEARCH_DEFS.filter((r) => r.faction === faction);
    const x0 = (GAME_WIDTH - W) / 2;
    const y0 = (GAME_HEIGHT - 172 - H) / 2 + 20;
    const root = this.scene.add.container(0, 0).setDepth(320);
    const dim = this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT - 172, 0x000000, 0.5).setOrigin(0).setInteractive();
    const g = this.scene.add.graphics();
    drawPanel(g, x0, y0, W, H);
    const title = this.scene.add.text(x0 + W / 2, y0 + 30, t('tree.title'), { fontFamily: headingFont(), fontSize: '30px', color: '#ffd060' }).setOrigin(0.5);
    root.add([dim, g, title]);
    for (let tier = 1; tier <= 3; tier++) {
      root.add(this.scene.add.text(x0 + 45 + (tier - 1) * COL_GAP + NODE_W / 2, y0 + 64, t('hud.tier', { n: tier }), textStyle(14, '#c9a044')).setOrigin(0.5));
    }
    // Column per tier, stacked rows.
    const pos = new Map<string, { x: number; y: number }>();
    const rows = [0, 0, 0];
    for (const d of defs) {
      const col = (d.tier ?? 1) - 1;
      pos.set(d.id, { x: x0 + 45 + col * COL_GAP, y: y0 + 84 + rows[col] * (NODE_H + 8) });
      rows[col]++;
    }
    const lines = this.scene.add.graphics();
    root.add(lines);
    for (const d of defs) {
      const p = pos.get(d.id);
      if (!p) continue;
      for (const pre of d.after ?? []) {
        const q = pos.get(pre);
        if (!q) continue;
        lines.lineStyle(2, 0xc9a044, 0.6).lineBetween(q.x + NODE_W, q.y + NODE_H / 2, p.x, p.y + NODE_H / 2);
      }
    }
    this.refreshers = [];
    for (const d of defs) {
      const p = pos.get(d.id);
      if (p) root.add(this.node(d, p.x, p.y, from));
    }
    const close = new Button(this.scene, { x: x0 + W - 80, y: y0 + H - 30, w: 120, h: 34, label: t('common.close'), onClick: () => this.close() });
    root.add(close.container);
    this.root = root;
  }

  private node(d: ResearchDef, x: number, y: number, from?: Building): Phaser.GameObjects.Container {
    const b = this.battle;
    const rs = b.research;
    const bg = this.scene.add.graphics();
    const icon = this.scene.add.image(x + 26, y + NODE_H / 2, researchGlyph(d.id)).setScale(0.85);
    const name = this.scene.add.text(x + 52, y + 6, researchName(d.id), textStyle(13, '#f0d27a'));
    const info = this.scene.add.text(x + 52, y + 24, '', { ...textStyle(10, '#bcb4a0'), wordWrap: { width: NODE_W - 58 } });
    const zone = this.scene.add.zone(x, y, NODE_W, NODE_H).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      const site = [from, ...b.buildings.getOwned('player')].find((q) => q && q.isReady && q.def.role === d.at && q.def.faction === d.faction && !rs.activeAt(q));
      if (!site) {
        b.events.emit(EV.message, 'err.noSite');
        return;
      }
      rs.start(site, d.id);
      this.refresh();
    });
    const c = this.scene.add.container(0, 0, [bg, icon, name, info, zone]);
    const draw = (): void => {
      const done = rs.isDone('player', d.id);
      const running = rs.isResearching('player', d.id);
      const lock = done ? null : rs.lockReason('player', d.id);
      const col = done ? 0x3a6a3a : running ? 0x2a4a6a : lock ? 0x3a2020 : 0x2a2620;
      bg.clear().fillStyle(col, 0.95).fillRect(x, y, NODE_W, NODE_H);
      bg.lineStyle(1.5, done ? 0x80e080 : lock ? 0x8a4040 : 0xc9a044, 1).strokeRect(x + 0.5, y + 0.5, NODE_W - 1, NODE_H - 1);
      const where = t(d.at === 'armoury' ? 'tree.atArmoury' : 'tree.atLab');
      info.setText(done ? `${t('cmd.researched')}\n${researchDesc(d.id)}` : lock ? `${lock}\n${researchDesc(d.id)}`
        : `${costText(d.cost)} · ${d.time}s · ${where}\n${researchDesc(d.id)}`);
      info.setColor(lock ? '#ff8060' : '#bcb4a0');
      icon.setAlpha(lock ? 0.5 : 1);
    };
    draw();
    this.refreshers.push(draw);
    return c;
  }

  refresh(): void {
    for (const r of this.refreshers) r();
  }

  close(): void {
    this.root?.destroy();
    this.root = null;
    this.refreshers = [];
  }
}

