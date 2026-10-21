import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { t, touchKey } from '../i18n';
import { isTouchDevice } from '../platform/Touch';
import { HUD } from '../ui/HudArt';
import { GRID_COLS, GRID_KEYS, GRID_ROWS } from '../ui/CommandGrid';
import { Button } from '../ui/Button';
import { textStyle } from '../ui/uiStyle';
import { TutorialDirector, TutorialTarget } from './TutorialDirector';
import type { BattleScene } from '../scenes/BattleScene';

/** Phones shrink the 1280×720 screen about two times: the banner text and buttons grow to stay readable. */
const K = isTouchDevice() ? 1.35 : 1;
const sz = (n: number): number => Math.round(n * K);
/** Task banner: top centre, under the resource bar. */
const PANEL = { x: (GAME_WIDTH - sz(640)) / 2, y: 46, w: sz(640) };
const PAD = 14;
/** Room for the header row (step counter, progress) above the order line, and for the button row below. */
const HEAD = sz(30);
const FOOT = sz(34);

/**
 * HUD layer for the tutorial: a short task banner (one order per step, details behind "?"),
 * a progress bar, a "well done" beat after each step, and a pulsing highlight with an arrow.
 */
export class TutorialOverlay {
  private card: Phaser.GameObjects.Graphics;
  private header: Phaser.GameObjects.Text;
  /** The one-line order for the step (or the praise). */
  private goal: Phaser.GameObjects.Text;
  /** Longer explanation, shown only after "?". */
  private details: Phaser.GameObjects.Text;
  /** Live line: what blocks the step right now (construction, prerequisites…). */
  private status: Phaser.GameObjects.Text;
  private statusText = '';
  private hi: Phaser.GameObjects.Graphics;
  private dim: Phaser.GameObjects.Graphics;
  private help: Button;
  private skip: Button;
  private exit: Button;
  private showDetails = false;
  private shown = -1;
  private praising = false;
  private pulse = 0;

  constructor(scene: Phaser.Scene, private battle: BattleScene, private director: TutorialDirector) {
    this.dim = scene.add.graphics().setDepth(150);
    this.hi = scene.add.graphics().setDepth(151);
    this.card = scene.add.graphics().setDepth(152);
    this.header = scene.add.text(PANEL.x + PAD, PANEL.y + 10, '', textStyle(sz(12), '#c9a044')).setDepth(153);
    this.goal = scene.add.text(PANEL.x + PAD, PANEL.y + HEAD, '', { ...textStyle(sz(19), HUD.goldHi), wordWrap: { width: PANEL.w - PAD * 2 } })
      .setDepth(153).setStroke('#000', 3);
    this.details = scene.add.text(PANEL.x + PAD, 0, '', { ...textStyle(sz(13), '#e8e0c8'), wordWrap: { width: PANEL.w - PAD * 2 }, lineSpacing: 3 })
      .setDepth(153);
    this.status = scene.add.text(PANEL.x + PAD, 0, '', { ...textStyle(sz(13), '#ffb050'), wordWrap: { width: PANEL.w - PAD * 2 }, lineSpacing: 2 })
      .setDepth(153).setStroke('#000', 2);
    const right = PANEL.x + PANEL.w;
    this.help = new Button(scene, { x: right - sz(236), y: 0, w: sz(36), h: sz(26), label: '?', onClick: () => {
      this.showDetails = !this.showDetails;
      this.relayout();
    } });
    this.skip = new Button(scene, { x: right - sz(152), y: 0, w: sz(120), h: sz(26), label: t('tut.skip'), onClick: () => director.skip() });
    this.exit = new Button(scene, { x: right - sz(52), y: 0, w: sz(76), h: sz(26), label: t('tut.exit'), onClick: () => battle.scene.start('MenuScene') });
    for (const b of [this.help, this.skip, this.exit]) b.container.setDepth(154);
  }

  /** Blocks the world under the banner. */
  contains(x: number, y: number): boolean {
    return x >= PANEL.x && x <= PANEL.x + PANEL.w && y >= PANEL.y && y <= PANEL.y + this.cardHeight();
  }

  private cardHeight(): number {
    let h = HEAD + this.goal.height + 8;
    if (this.details.visible) h += this.details.height + 6;
    if (this.statusText) h += this.status.height + 6;
    return h + FOOT;
  }

  update(dt: number): void {
    const d = this.director;
    const st = d.praise > 0 ? '' : d.current?.status?.() ?? '';
    const praising = d.praise > 0;
    if (d.index !== this.shown || st !== this.statusText || praising !== this.praising) {
      if (d.index !== this.shown) this.showDetails = false;
      this.statusText = st;
      this.praising = praising;
      this.relayout();
    }
    this.pulse += dt;
    const step = d.current;
    this.drawTarget(step && !praising ? step.target() : { kind: 'none' });
  }

  private relayout(): void {
    const d = this.director;
    this.shown = d.index;
    const step = d.current;
    const n = Math.min(d.index + 1, d.steps.length);
    this.header.setText(t('tut.header', { lesson: d.lesson, n, max: d.steps.length }));
    if (this.praising) this.goal.setText(`✔ ${t('tut.praise')}`).setColor('#8fe07a');
    else this.goal.setText(step ? t(touchKey(`tut.${step.id}.goal`)) : t('tut.done')).setColor(HUD.goldHi);
    let y = PANEL.y + HEAD + this.goal.height + 8;
    this.details.setText(step ? t(touchKey(`tut.${step.id}.text`)) : '').setVisible(this.showDetails && !this.praising && !!step).setY(y);
    if (this.details.visible) y += this.details.height + 6;
    this.status.setText(this.statusText ? `▸ ${this.statusText}` : '').setY(y);
    const h = this.cardHeight();
    const g = this.card.clear();
    g.fillStyle(0x0c0b10, 0.9).fillRect(PANEL.x, PANEL.y, PANEL.w, h);
    g.lineStyle(2, 0xc9a044, 1).strokeRect(PANEL.x + 0.5, PANEL.y + 0.5, PANEL.w - 1, h - 1);
    g.lineStyle(1, 0xc9a044, 0.35).strokeRect(PANEL.x + 4.5, PANEL.y + 4.5, PANEL.w - 9, h - 9);
    // Progress: one segment per step, done ones filled (the praise beat already counts the step).
    const segs = d.steps.length;
    const done = d.index + (this.praising ? 1 : 0);
    const bw = sz(220);
    const bx = PANEL.x + PANEL.w - PAD - bw;
    const sw = (bw - (segs - 1) * 4) / segs;
    for (let i = 0; i < segs; i++) {
      g.fillStyle(i < done ? 0xc9a044 : i === done ? 0x6a5a30 : 0x2a2618, 1).fillRect(bx + i * (sw + 4), PANEL.y + 14, sw, sz(6));
    }
    const by = PANEL.y + h - sz(20);
    this.help.container.setY(by).setVisible(!!step && !this.praising);
    this.skip.container.setY(by).setVisible(!!step && !this.praising);
    this.exit.container.setY(by);
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
    for (const o of [this.card, this.header, this.goal, this.details, this.status, this.hi, this.dim]) o.destroy();
    this.help.destroy();
    this.skip.destroy();
    this.exit.destroy();
  }
}
