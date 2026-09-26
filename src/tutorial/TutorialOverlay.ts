import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { dyn, t } from '../i18n';
import { HUD } from '../ui/HudArt';
import { GRID_COLS, GRID_KEYS, GRID_ROWS } from '../ui/CommandGrid';
import { Button } from '../ui/Button';
import { textStyle } from '../ui/uiStyle';
import { TutorialDirector, TutorialTarget } from './TutorialDirector';
import type { BattleScene } from '../scenes/BattleScene';

const PANEL = { x: 12, y: 48, w: 380 };

/** HUD layer for the tutorial: step card, checklist, pulsing highlight with an arrow, dimmed HUD. */
export class TutorialOverlay {
  private card: Phaser.GameObjects.Graphics;
  private header: Phaser.GameObjects.Text;
  private title: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Text;
  /** Live line: what blocks the step right now (construction, prerequisites…). */
  private status: Phaser.GameObjects.Text;
  private statusText = '';
  private list: Phaser.GameObjects.Text;
  private listBg: Phaser.GameObjects.Graphics;
  private hi: Phaser.GameObjects.Graphics;
  private dim: Phaser.GameObjects.Graphics;
  private skip: Button;
  private exit: Button;
  private shown = -1;
  private pulse = 0;

  constructor(scene: Phaser.Scene, private battle: BattleScene, private director: TutorialDirector) {
    this.dim = scene.add.graphics().setDepth(150);
    this.hi = scene.add.graphics().setDepth(151);
    this.card = scene.add.graphics().setDepth(152);
    this.header = scene.add.text(PANEL.x + 14, PANEL.y + 10, '', textStyle(12, '#c9a044')).setDepth(153);
    this.title = scene.add.text(PANEL.x + 14, PANEL.y + 28, '', textStyle(17, HUD.goldHi)).setDepth(153).setStroke('#000', 3);
    this.body = scene.add.text(PANEL.x + 14, PANEL.y + 54, '', { ...textStyle(13, '#e8e0c8'), wordWrap: { width: PANEL.w - 28 }, lineSpacing: 3 })
      .setDepth(153);
    this.status = scene.add.text(PANEL.x + 14, 0, '', { ...textStyle(13, '#ffb050'), wordWrap: { width: PANEL.w - 28 }, lineSpacing: 2 })
      .setDepth(153).setStroke('#000', 2);
    this.skip = new Button(scene, { x: PANEL.x + PANEL.w - 190, y: 0, w: 130, h: 28, label: t('tut.skip'), onClick: () => director.skip() });
    this.exit = new Button(scene, { x: PANEL.x + PANEL.w - 66, y: 0, w: 100, h: 28, label: t('tut.exit'), onClick: () => battle.scene.start('MenuScene') });
    this.skip.container.setDepth(154);
    this.exit.container.setDepth(154);
    this.listBg = scene.add.graphics().setDepth(152);
    this.list = scene.add.text(GAME_WIDTH - 250, 56, '', { ...textStyle(12, '#bcb4a0'), lineSpacing: 4 }).setDepth(153);
  }

  /** Blocks the world under the step card and checklist. */
  contains(x: number, y: number): boolean {
    const h = this.cardHeight();
    return (x >= PANEL.x && x <= PANEL.x + PANEL.w && y >= PANEL.y && y <= PANEL.y + h)
      || (x >= GAME_WIDTH - 262 && y >= 48 && y <= 48 + this.list.height + 16);
  }

  private cardHeight(): number {
    return 54 + this.body.height + (this.statusText ? this.status.height + 8 : 0) + 48;
  }

  update(dt: number): void {
    const d = this.director;
    const st = d.current?.status?.() ?? '';
    if (d.index !== this.shown || st !== this.statusText) {
      this.statusText = st;
      this.relayout();
    }
    this.pulse += dt;
    const step = d.current;
    this.drawTarget(step ? step.target() : { kind: 'none' });
  }

  private relayout(): void {
    const d = this.director;
    this.shown = d.index;
    const step = d.current;
    this.header.setText(t('tut.header', { n: Math.min(d.index + 1, d.steps.length), max: d.steps.length }));
    this.title.setText(step ? t(dyn(`tut.${step.id}.title`)) : t('tut.done'));
    this.body.setText(step ? t(dyn(`tut.${step.id}.text`)) : t('tut.done.text'));
    this.status.setText(this.statusText ? `▸ ${this.statusText}` : '').setY(PANEL.y + 54 + this.body.height + 6);
    const h = this.cardHeight();
    const g = this.card.clear();
    g.fillStyle(0x0c0b10, 0.92).fillRect(PANEL.x, PANEL.y, PANEL.w, h);
    g.lineStyle(2, 0xc9a044, 1).strokeRect(PANEL.x + 0.5, PANEL.y + 0.5, PANEL.w - 1, h - 1);
    g.lineStyle(1, 0xc9a044, 0.35).strokeRect(PANEL.x + 4.5, PANEL.y + 4.5, PANEL.w - 9, h - 9);
    this.skip.container.setY(PANEL.y + h - 24).setVisible(!!step);
    this.exit.container.setY(PANEL.y + h - 24);
    const lines = d.steps.map((s, i) => `${i < d.index ? '✔' : i === d.index ? '➤' : '·'} ${t(dyn(`tut.${s.id}.title`))}`);
    this.list.setText(lines.join('\n'));
    this.listBg.clear().fillStyle(0x0c0b10, 0.7).fillRect(GAME_WIDTH - 262, 48, 252, this.list.height + 16);
  }

  /** Pulsing frame + arrow at the target; for HUD targets the rest of the bottom frame is dimmed. */
  private drawTarget(tg: TutorialTarget): void {
    const hi = this.hi.clear();
    const dim = this.dim.clear();
    const a = 0.55 + Math.sin(this.pulse * 6) * 0.35;
    let r: Phaser.Geom.Rectangle | null = null;
    if (tg.kind === 'grid') {
      const i = GRID_KEYS.indexOf(tg.key);
      if (i >= 0) {
        const g = HUD.grid;
        const cell = 62;
        const x0 = g.x + (g.w - GRID_COLS * cell) / 2;
        const y0 = g.y + (g.h - GRID_ROWS * cell) / 2;
        r = new Phaser.Geom.Rectangle(x0 + (i % GRID_COLS) * cell + 1, y0 + Math.floor(i / GRID_COLS) * cell + 1, cell - 2, cell - 2);
      }
    } else if (tg.kind === 'minimap') {
      const m = HUD.minimap;
      r = new Phaser.Geom.Rectangle(m.x - 4, m.y - 4, m.w + 8, m.h + 8);
    } else if (tg.kind === 'panel') {
      const c = HUD.center;
      r = new Phaser.Geom.Rectangle(c.x, c.y, c.w, c.h);
    } else if (tg.kind === 'topbar') {
      r = new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, HUD.topH);
    }
    if (r) {
      // Dim the bottom frame around the highlighted control.
      if (r.y >= GAME_HEIGHT - HUD.bottomH - 10) {
        const top = GAME_HEIGHT - HUD.bottomH;
        dim.fillStyle(0x000000, 0.62);
        dim.fillRect(0, top, GAME_WIDTH, r.y - top);
        dim.fillRect(0, r.bottom, GAME_WIDTH, GAME_HEIGHT - r.bottom);
        dim.fillRect(0, r.y, r.x, r.height);
        dim.fillRect(r.right, r.y, GAME_WIDTH - r.right, r.height);
      }
      hi.lineStyle(3, 0xffd060, a).strokeRect(r.x, r.y, r.width, r.height);
      const bob = Math.sin(this.pulse * 5) * 5;
      // Grid cells get the arrow from the left (above would cover the top row); the rest from above.
      if (tg.kind === 'grid') this.arrow(r.x - 6 - bob, r.centerY, 0, a);
      else this.arrow(r.centerX, r.y - 8 - bob, Math.PI / 2, a);
      return;
    }
    if (tg.kind === 'world') {
      const p = this.battle.cameraSystem.worldToScreen(tg.x, tg.y);
      const inside = p.x > 20 && p.x < GAME_WIDTH - 20 && p.y > HUD.topH + 20 && p.y < GAME_HEIGHT - HUD.bottomH - 20;
      if (inside) {
        hi.lineStyle(3, 0xffd060, a).strokeEllipse(p.x, p.y, 110, 70);
        this.arrow(p.x, p.y - 60 - Math.sin(this.pulse * 5) * 8, Math.PI / 2, a);
      } else {
        // Off screen: arrow at the edge pointing the way.
        const cx = GAME_WIDTH / 2;
        const cy = (GAME_HEIGHT - HUD.bottomH) / 2;
        const ang = Math.atan2(p.y - cy, p.x - cx);
        const ex = Phaser.Math.Clamp(cx + Math.cos(ang) * 1000, 40, GAME_WIDTH - 40);
        const ey = Phaser.Math.Clamp(cy + Math.sin(ang) * 1000, HUD.topH + 40, GAME_HEIGHT - HUD.bottomH - 40);
        this.arrow(ex, ey, ang, a);
      }
    }
  }

  /** Gold arrow whose tip is at (x, y), pointing along `ang`. */
  private arrow(x: number, y: number, ang: number, alpha: number): void {
    const g = this.hi;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const pt = (f: number, side: number): Phaser.Math.Vector2 => new Phaser.Math.Vector2(x - c * f - s * side, y - s * f + c * side);
    const p = [pt(0, 0), pt(22, 14), pt(22, 5), pt(46, 5), pt(46, -5), pt(22, -5), pt(22, -14)];
    g.fillStyle(0xffd060, alpha).fillPoints(p, true);
    g.lineStyle(2, 0x000000, 0.8).strokePoints(p, true);
  }

  destroy(): void {
    for (const o of [this.card, this.header, this.title, this.body, this.status, this.list, this.listBg, this.hi, this.dim]) o.destroy();
    this.skip.destroy();
    this.exit.destroy();
  }
}
