import Phaser from 'phaser';
import type { BattleScene } from '../scenes/BattleScene';
import { Squad } from '../units/Squad';
import { Building } from '../buildings/Building';
import { portraitKey } from '../render/puppet/UnitAtlas';
import { buildingIconKey } from '../render/buildings/BuildingArt';
import { RESEARCH_DEFS } from '../systems/ResearchSystem';
import { HUD } from './HudArt';
import { researchGlyph } from './GlyphIcons';
import { textStyle } from './uiStyle';
import { dyn, plural, t } from '../i18n';
import { buildingDesc, buildingName, researchName, unitName } from '../i18n/names';

const P = HUD.center;
const INFO_X = P.x + 132;

function orderText(s: Squad): string {
  if (s.retreating) return t('order.retreat');
  if (s.pendingReinforce > 0) return t('order.reinforcing');
  if (s.order === 'hold') return t('order.hold');
  if (s.engaged) return t('order.engaging');
  if (s.waypoints.length) return t('order.waypoints', { n: s.waypoints.length + 1 });
  if (s.isMoving()) return s.order === 'attackMove' ? t('order.attackMove') : t('order.move');
  return t('order.idle');
}

/** Centre HUD panel describing the current selection. */
export class SelectionPanel {
  private content: Phaser.GameObjects.Container;
  private bars: Phaser.GameObjects.Graphics;
  private updater: (() => void) | null = null;
  private empty: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene, private battle: BattleScene) {
    this.content = scene.add.container(0, 0);
    this.bars = scene.add.graphics();
    this.empty = scene.add.text(P.x + P.w / 2, P.y + P.h / 2, t('hud.empty'),
      { ...textStyle(14, '#8a8478'), align: 'center' }).setOrigin(0.5);
  }

  refresh(): void {
    this.content.removeAll(true);
    this.bars.clear();
    this.updater = null;
    const sel = this.battle.selection;
    if (sel.squads.length) this.buildSquads(sel.squads);
    else if (sel.building) this.buildBuilding(sel.building);
    this.empty.setVisible(!this.updater);
  }

  update(): void {
    this.updater?.();
  }

  private portrait(key: string, gold: boolean): void {
    const x = P.x + 64;
    const y = P.y + P.h / 2;
    const bg = this.scene.add.graphics();
    const g = bg.fillGradientStyle(0x1a2030, 0x1a2030, 0x07080c, 0x07080c, 1);
    g.fillRect(x - 56, y - 64, 112, 128);
    g.lineStyle(2, gold ? 0xf0d27a : 0xc9a044, 1).strokeRect(x - 56, y - 64, 112, 128);
    const img = this.scene.add.image(x, y + 4, key);
    img.setScale(Math.min(100 / img.width, 116 / img.height, 3));
    this.content.add([bg, img]);
  }

  private bar(x: number, y: number, w: number, h: number, frac: number, color?: number): void {
    const f = Phaser.Math.Clamp(frac, 0, 1);
    const col = color ?? (f > 0.6 ? 0x48d848 : f > 0.3 ? 0xe0c020 : 0xe03020);
    this.bars.fillStyle(0x000000, 0.85).fillRect(x - 1, y - 1, w + 2, h + 2);
    this.bars.fillStyle(col, 1).fillRect(x, y, w * f, h);
    this.bars.fillStyle(0xffffff, 0.15).fillRect(x, y, w * f, Math.max(1, h / 3));
  }

  private upgrades(y: number): void {
    const done = RESEARCH_DEFS.filter((r) => this.battle.research.isDone('player', r.id));
    done.forEach((r, i) => {
      const img = this.scene.add.image(INFO_X + 8 + i * 26, y, researchGlyph(r.id)).setScale(0.5);
      this.content.add(img);
    });
  }

  private buildSquads(squads: Squad[]): void {
    const first = squads[0];
    this.portrait(portraitKey(first.def.id), !!first.def.isHero);
    const title = squads.length === 1 ? unitName(first.def.id) : plural(squads.length, 'hud.squads');
    const name = this.scene.add.text(INFO_X, P.y + 10, title, textStyle(19, HUD.goldHi)).setStroke('#000', 3);
    const state = this.scene.add.text(INFO_X, P.y + 52, '', textStyle(13, '#9fe09f'));
    const info = this.scene.add.text(P.x + P.w - 12, P.y + 12, '', textStyle(13, '#bcb4a0')).setOrigin(1, 0);
    const d = first.def;
    const statsText = squads.every((s) => s.def.id === d.id)
      ? t('hud.stats', { dmg: t(dyn(`dmg.${d.damageType}`)), armor: t(dyn(`armor.${d.armor}`)), s: d.supply }) : '';
    const stats = this.scene.add.text(P.x + P.w - 12, P.y + 54, statsText, textStyle(12, '#a8a090')).setOrigin(1, 0);
    this.content.add([name, state, info, stats]);
    const cards = this.scene.add.container(0, 0);
    this.content.add(cards);
    this.upgrades(P.y + P.h - 14);
    const units = this.battle.units;
    let lastKey = '';
    this.updater = (): void => {
      this.bars.clear();
      const alive = squads.filter((s) => s.alive);
      const hp = alive.reduce((a, s) => a + s.hp, 0);
      const max = alive.reduce((a, s) => a + s.maxHp, 0) || 1;
      this.bar(INFO_X, P.y + 38, 280, 9, hp / max);
      info.setText(t('hud.supply', { n: this.battle.production.supplyUsed('player'), max: units.supplyCap('player') }));
      const st = alive[0]?.stance;
      state.setText(alive.length === 1 ? `${orderText(alive[0])} · ${t(dyn(`stance.${st}`))}`
        : alive.every((s) => s.stance === st) ? t('hud.stance', { s: t(dyn(`stance.${st}`)) }) : '');
      // Cards: one per soldier for a single squad, one per squad otherwise.
      const single = alive.length === 1;
      const items = single ? alive[0].units.map((u) => ({ key: portraitKey(u.def.id), f: u.hp / u.maxHp, n: '' }))
        : alive.map((s) => ({ key: portraitKey(s.def.id), f: s.hp / s.maxHp, n: `${s.units.length}` }));
      const sig = `${single}:${items.length}`;
      if (sig !== lastKey) {
        lastKey = sig;
        cards.removeAll(true);
        items.slice(0, 12).forEach((it, i) => {
          const x = INFO_X + i * 34;
          const y = P.y + 72;
          const frame = this.scene.add.rectangle(x + 15, y + 17, 30, 34, 0x0a0c12).setStrokeStyle(1, 0x7a6030);
          const img = this.scene.add.image(x + 15, y + 17, it.key);
          img.setScale(Math.min(28 / img.width, 32 / img.height));
          const n = this.scene.add.text(x + 28, y + 33, it.n, textStyle(10, '#fff')).setOrigin(1, 1).setStroke('#000', 3);
          cards.add([frame, img, n]);
        });
      }
      items.slice(0, 12).forEach((it, i) => this.bar(INFO_X + i * 34 + 1, P.y + 108, 28, 3, it.f));
    };
  }

  private buildBuilding(b: Building): void {
    this.portrait(buildingIconKey(b.def.id), b.def.role === 'hq');
    const name = this.scene.add.text(INFO_X, P.y + 10, buildingName(b.def.id), textStyle(19, HUD.goldHi)).setStroke('#000', 3);
    const info = this.scene.add.text(INFO_X, P.y + 52, '', textStyle(13, '#bcb4a0'));
    const desc = this.scene.add.text(INFO_X, P.y + 74, buildingDesc(b.def.id), { ...textStyle(12, '#8a8478'), wordWrap: { width: 300 } });
    this.content.add([name, info, desc]);
    const queue = this.scene.add.container(0, 0);
    this.content.add(queue);
    this.upgrades(P.y + P.h - 14);
    let lastQueue = '';
    this.updater = (): void => {
      this.bars.clear();
      this.bar(INFO_X, P.y + 38, 280, 9, b.hp / b.maxHp);
      let status = t('hud.hp', { hp: Math.ceil(b.hp), max: b.maxHp });
      if (b.state === 'constructing') status += `  ·  ${t('hud.constructing', { p: Math.floor(b.progress * 100) })}`;
      if (b.def.fluxGen) status += `  ·  ${t('hud.fluxGen', { n: b.def.fluxGen })}`;
      if (b.def.supply) status += `  ·  ${t('hud.supplyGen', { n: b.def.supply })}`;
      const adv = b.def.role === 'hq' ? this.battle.tech.progress(b.owner) : null;
      if (adv !== null) status += `  ·  ${t('hud.advancing', { n: this.battle.tech.tierOf(b.owner) + 1, p: Math.floor(adv * 100) })}`;
      if (b.repeat) status += `  ·  ${t('hud.repeat')}`;
      const res = this.battle.research.activeAt(b);
      if (res) status += `  ·  ${t('hud.researching', { name: researchName(res.def.id), p: Math.floor(res.frac * 100) })}`;
      info.setText(status);
      const key = b.queue.join(',');
      if (key !== lastQueue) {
        lastQueue = key;
        queue.removeAll(true);
        if (b.queue.length) queue.add(this.scene.add.text(P.x + P.w - 12, P.y + 138, t('hud.queueHint'), textStyle(10, '#8a8478')).setOrigin(1, 0.5));
        b.queue.forEach((q, qi) => {
          const x = P.x + P.w - 30 - qi * 40;
          const y = P.y + 106;
          const box = this.scene.add.rectangle(x, y, 36, 40, 0x0a0c12).setStrokeStyle(1, 0xc9a044);
          const img = this.scene.add.image(x, y, portraitKey(q));
          img.setScale(Math.min(32 / img.width, 36 / img.height));
          box.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.battle.production.cancel(b, qi));
          queue.add([box, img]);
        });
      }
      if (b.queue.length) this.bar(P.x + P.w - 48, P.y + 130, 36, 4, b.productionFraction(), 0x40c0ff);
    };
  }
}
