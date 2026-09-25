import Phaser from 'phaser';
import { MECHANICS } from '../tutorial/data';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { dyn, headingFont, t } from '../i18n';
import { buildingDesc, buildingName, costText, roleName, unitDesc, unitName } from '../i18n/names';
import { UNIT_DEFS, UnitId } from '../units/UnitDefs';
import { BUILDING_DEFS, BuildingId } from '../buildings/BuildingDefs';
import { ABILITIES, AbilityId } from '../units/Abilities';
import { ARMOR_CLASSES, DAMAGE_TABLE, DAMAGE_TYPES } from '../units/Damage';
import { ANIM_FRAMES } from '../render/puppet/Models';
import { atlasKey, frameName, turretKey } from '../render/puppet/UnitAtlas';
import { buildingIconKey } from '../render/buildings/BuildingArt';
import { unitStatsText } from '../ui/Commands';
import { Button } from '../ui/Button';
import { drawPanel, textStyle } from '../ui/uiStyle';

type Tab = 'units' | 'buildings' | 'abilities' | 'mechanics';
const TABS: Tab[] = ['units', 'buildings', 'abilities', 'mechanics'];

/** Mechanics articles (title/text keys enc.m.<id>.title / .text); 'damage' also draws the table. */

interface Entry {
  key: string;
  name: string;
  group: string;
}

const PANEL = { x: 40, y: 30, w: GAME_WIDTH - 80, h: GAME_HEIGHT - 60 };
const LIST = { x: PANEL.x + 20, y: PANEL.y + 120, w: 300, rowH: 26, rows: 17 };
const DETAIL = { x: LIST.x + LIST.w + 30, y: PANEL.y + 110 };

/**
 * Encyclopedia (menu, pause menu and F1 in battle): units, buildings, abilities and game
 * mechanics with stats, costs, tiers, damage/armour, counters and the real sprites. Searchable.
 */
export class EncyclopediaScene extends Phaser.Scene {
  private tab: Tab = 'units';
  private search = '';
  private scroll = 0;
  private selected = '';
  private onClose?: () => void;
  private listLayer!: Phaser.GameObjects.Container;
  private detail!: Phaser.GameObjects.Container;
  private searchText!: Phaser.GameObjects.Text;
  private tabButtons: Button[] = [];
  private preview: { img: Phaser.GameObjects.Image; turret?: Phaser.GameObjects.Image; id: UnitId; t: number } | null = null;

  constructor() {
    super('EncyclopediaScene');
  }

  init(data: { onClose?: () => void; tab?: Tab }): void {
    this.onClose = data.onClose;
    this.tab = data.tab ?? 'units';
    this.search = '';
    this.scroll = 0;
    this.selected = '';
    this.tabButtons = [];
    this.preview = null;
  }

  create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    drawPanel(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    this.add.text(PANEL.x + PANEL.w / 2, PANEL.y + 34, t('enc.title'), { fontFamily: headingFont(), fontSize: '36px', color: '#ffd060' }).setOrigin(0.5);
    TABS.forEach((tb, i) => {
      const b = new Button(this, { x: PANEL.x + 120 + i * 170, y: PANEL.y + 82, w: 160, h: 34, label: t(dyn(`enc.tab.${tb}`)), onClick: () => this.setTab(tb) });
      this.tabButtons.push(b);
    });
    new Button(this, { x: PANEL.x + PANEL.w - 70, y: PANEL.y + 34, w: 110, h: 34, label: t('common.close'), onClick: () => this.close() });
    this.searchText = this.add.text(PANEL.x + PANEL.w - 360, PANEL.y + 82, '', textStyle(15, '#e8e0c8')).setOrigin(0, 0.5);
    const sg = this.add.graphics();
    sg.fillStyle(0x0a0a0c, 0.9).fillRect(PANEL.x + PANEL.w - 370, PANEL.y + 66, 330, 32);
    sg.lineStyle(1, 0xc9a044, 0.8).strokeRect(PANEL.x + PANEL.w - 370, PANEL.y + 66, 330, 32);
    this.children.bringToTop(this.searchText);
    this.listLayer = this.add.container(0, 0);
    this.detail = this.add.container(0, 0);
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.scroll = Phaser.Math.Clamp(this.scroll + Math.sign(dy) * 3, 0, Math.max(0, this.entries().length - LIST.rows));
      this.drawList();
    });
    this.setTab(this.tab);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' || e.key === 'F1') {
      e.preventDefault();
      this.close();
      return;
    }
    if (e.key === 'Backspace') this.search = this.search.slice(0, -1);
    else if (e.key.length === 1 && this.search.length < 24 && /[\p{L}\p{N} -]/u.test(e.key)) this.search += e.key;
    else return;
    this.scroll = 0;
    this.drawList();
  }

  private close(): void {
    this.onClose?.();
    this.scene.stop();
  }

  private setTab(tb: Tab): void {
    this.tab = tb;
    this.scroll = 0;
    this.tabButtons.forEach((b, i) => b.setActive(TABS[i] === tb));
    const first = this.entries()[0];
    this.selected = first?.key ?? '';
    this.drawList();
    this.drawDetail();
  }

  private entries(): Entry[] {
    let all: Entry[];
    if (this.tab === 'units') {
      all = (Object.keys(UNIT_DEFS) as UnitId[]).map((id) => ({ key: id, name: unitName(id), group: t(dyn(`enc.faction.${UNIT_DEFS[id].faction}`)) }));
    } else if (this.tab === 'buildings') {
      all = (Object.keys(BUILDING_DEFS) as BuildingId[]).map((id) => ({ key: id, name: buildingName(id), group: t(dyn(`enc.faction.${BUILDING_DEFS[id].faction}`)) }));
    } else if (this.tab === 'abilities') {
      all = (Object.keys(ABILITIES) as AbilityId[]).map((id) => ({ key: id, name: t(dyn(`ab.${id}`)), group: '' }));
    } else {
      all = MECHANICS.map((id) => ({ key: id, name: t(dyn(`enc.m.${id}.title`)), group: '' }));
    }
    const q = this.search.toLowerCase();
    return q ? all.filter((e) => e.name.toLowerCase().includes(q)) : all;
  }

  private drawList(): void {
    this.searchText.setText((this.search ? `${this.search}${Math.floor(this.time.now / 500) % 2 ? '_' : ' '}` : t('enc.search')));
    const L = this.listLayer;
    L.removeAll(true);
    const list = this.entries();
    list.slice(this.scroll, this.scroll + LIST.rows).forEach((e, i) => {
      const y = LIST.y + i * LIST.rowH;
      const on = e.key === this.selected;
      const bg = this.add.rectangle(LIST.x, y, LIST.w, LIST.rowH - 2, on ? 0x3a3020 : 0x14120e, 0.9).setOrigin(0).setStrokeStyle(1, on ? 0xffd060 : 0x3a3020);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.selected = e.key;
        this.drawList();
        this.drawDetail();
      });
      const txt = this.add.text(LIST.x + 10, y + LIST.rowH / 2 - 1, e.name, textStyle(13, on ? '#ffd060' : '#d8d0c0')).setOrigin(0, 0.5);
      const grp = this.add.text(LIST.x + LIST.w - 8, y + LIST.rowH / 2 - 1, e.group, textStyle(10, '#8a8270')).setOrigin(1, 0.5);
      L.add([bg, txt, grp]);
    });
    if (!list.length) L.add(this.add.text(LIST.x + 10, LIST.y + 6, t('enc.none'), textStyle(13, '#8a8270')));
    else if (list.length > LIST.rows) {
      L.add(this.add.text(LIST.x + LIST.w / 2, LIST.y + LIST.rows * LIST.rowH + 6, t('enc.scroll', { a: this.scroll + 1, b: Math.min(list.length, this.scroll + LIST.rows), n: list.length }),
        textStyle(11, '#8a8270')).setOrigin(0.5, 0));
    }
  }

  private drawDetail(): void {
    const D = this.detail;
    D.removeAll(true);
    this.preview = null;
    const key = this.selected;
    if (!key) return;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      D.add(o);
      return o;
    };
    const x = DETAIL.x;
    const y = DETAIL.y;
    const frame = this.add.graphics();
    frame.fillStyle(0x0a0c12, 0.9).fillRect(x, y, 260, 240).lineStyle(1.5, 0xc9a044, 1).strokeRect(x, y, 260, 240);
    add(frame);
    const textX = x + 290;
    const W = PANEL.x + PANEL.w - textX - 30;
    const heading = (s: string): void => {
      add(this.add.text(textX, y, s, { fontFamily: headingFont(), fontSize: '28px', color: '#ffd060' }));
    };
    const para = (s: string, yy: number, color = '#d8d0c0', size = 14): Phaser.GameObjects.Text =>
      add(this.add.text(textX, yy, s, { ...textStyle(size, color), wordWrap: { width: W }, lineSpacing: 4 }));
    if (this.tab === 'units') {
      const id = key as UnitId;
      const d = UNIT_DEFS[id];
      const img = add(this.add.image(x + 130, y + 170, atlasKey(id), frameName('idle', 0, 2)));
      const s = Math.min(d.category === 'infantry' || d.category === 'hero' ? 2.6 : 1.6, 200 / Math.max(img.width, img.height) * 1.4);
      img.setScale(s).setOrigin(0.5, 0.75);
      let turret: Phaser.GameObjects.Image | undefined;
      if (d.turret) turret = add(this.add.image(x + 130, y + 170, turretKey(id), 'turret0_2').setScale(s).setOrigin(0.5, 0.75));
      this.preview = { img, turret, id, t: 0 };
      heading(unitName(id));
      const meta = [t(dyn(`enc.faction.${d.faction}`)), t('hud.tier', { n: d.tier }), t(dyn(`enc.cat.${d.category}`))].join(' · ');
      para(meta, y + 38, '#c9a044', 13);
      const desc = para(unitDesc(id), y + 62);
      const lines = [
        `${t('enc.cost')}: ${costText(d.cost)} · ${d.trainTime}s · ${t('enc.supplyN', { n: d.supply })}`,
        unitStatsText(id),
        t('enc.speedSight', { s: d.speed, v: d.sight }),
      ];
      if (d.requires.length) lines.push(t('cmd.requires', { what: d.requires.map(roleName).join(', ') }));
      const traits = this.traits(id);
      if (traits.length) lines.push(`${t('enc.traits')}: ${traits.join('; ')}`);
      if (d.abilities?.length) lines.push(`${t('enc.abilities')}: ${d.abilities.map((a) => t(dyn(`ab.${a}`))).join(', ')}`);
      const where = Object.values(BUILDING_DEFS).filter((b) => b.produces.includes(id)).map((b) => buildingName(b.id));
      if (where.length) lines.push(`${t('enc.trainedAt')}: ${where.join(', ')}`);
      para(lines.join('\n'), desc.y + desc.height + 14, '#bcb4a0', 13);
    } else if (this.tab === 'buildings') {
      const id = key as BuildingId;
      const d = BUILDING_DEFS[id];
      const img = add(this.add.image(x + 130, y + 120, buildingIconKey(id)));
      img.setScale(Math.min(1, 230 / img.width, 220 / img.height));
      heading(buildingName(id));
      para([t(dyn(`enc.faction.${d.faction}`)), t('hud.tier', { n: d.tier }), t(dyn(`cmd.cat.${d.category}`))].join(' · '), y + 38, '#c9a044', 13);
      const desc = para(buildingDesc(id), y + 62);
      const lines = [
        `${t('enc.cost')}: ${costText(d.cost)} · ${d.buildTime}s · ${t('hud.hp', { hp: d.hp, max: d.hp })}`,
      ];
      if (d.requires.length) lines.push(t('cmd.requires', { what: d.requires.map(roleName).join(', ') }));
      if (d.produces.length) lines.push(`${t('enc.trains')}: ${d.produces.map(unitName).join(', ')}`);
      if (d.supply) lines.push(t('hud.supplyGen', { n: d.supply }));
      if (d.fluxGen) lines.push(t('hud.fluxGen', { n: d.fluxGen }));
      if (d.attack) lines.push(t('enc.attack', { dmg: d.attack.damage, type: t(dyn(`dmg.${d.attack.damageType}`)), r: d.attack.range }));
      if (d.regen) lines.push(t('enc.regen', { n: d.regen }));
      para(lines.join('\n'), desc.y + desc.height + 14, '#bcb4a0', 13);
    } else if (this.tab === 'abilities') {
      const id = key as AbilityId;
      const d = ABILITIES[id];
      add(this.add.image(x + 130, y + 120, d.icon).setScale(3));
      heading(t(dyn(`ab.${id}`)));
      const users = (Object.keys(UNIT_DEFS) as UnitId[]).filter((u) => UNIT_DEFS[u].abilities?.includes(id)).map(unitName);
      para(users.join(', '), y + 38, '#c9a044', 13);
      const desc = para(t(dyn(`ab.${id}.desc`)), y + 62);
      const lines = [t('ab.cooldown', { n: d.cooldown })];
      if (d.range) lines.push(t('ab.range', { n: d.range }));
      if (d.radius) lines.push(t('enc.radius', { n: d.radius }));
      if (d.cost) lines.push(`${t('enc.cost')}: ${costText(d.cost)}`);
      if (d.requires) lines.push(t('cmd.requires', { what: d.requires.map(roleName).join(', ') }));
      lines.push(t(dyn(`enc.target.${d.targeting}`)));
      para(lines.join('\n'), desc.y + desc.height + 14, '#bcb4a0', 13);
    } else {
      add(this.add.image(x + 130, y + 120, 'glyph_tech').setScale(3));
      heading(t(dyn(`enc.m.${key}.title`)));
      const text = para(t(dyn(`enc.m.${key}.text`)), y + 44);
      if (key === 'damage') this.damageTable(textX, text.y + text.height + 16, D);
    }
  }

  /** Short trait summaries from the role passives. */
  private traits(id: UnitId): string[] {
    const d = UNIT_DEFS[id];
    const out: string[] = [];
    if (d.captureRate) out.push(t('enc.t.capture'));
    if (d.detector) out.push(t('enc.t.detector'));
    if (d.ignoresCover) out.push(t('enc.t.cover'));
    if (d.precision) out.push(t('enc.t.precision'));
    if (d.repairRate) out.push(t('enc.t.repair'));
    if (d.leap) out.push(t('enc.t.leap'));
    if (d.burrow) out.push(t('enc.t.burrow'));
    if (d.aura) out.push(t('enc.t.aura'));
    if (d.transport) out.push(t('enc.t.transport'));
    if (d.crush) out.push(t('enc.t.crush'));
    if (d.indirect) out.push(t('enc.t.indirect'));
    if (d.deploy) out.push(t('enc.t.deploy'));
    if (d.flying) out.push(t('enc.t.flying'));
    if (d.regen) out.push(t('enc.t.regen'));
    if (d.limit) out.push(t('enc.t.limit'));
    if (!d.canCapture) out.push(t('enc.t.nocapture'));
    return out;
  }

  private damageTable(x: number, y: number, D: Phaser.GameObjects.Container): void {
    const cw = 92;
    const rh = 24;
    ARMOR_CLASSES.forEach((a, i) => D.add(this.add.text(x + 110 + i * cw, y, t(dyn(`armor.${a}`)), textStyle(12, '#c9a044')).setOrigin(0.5, 0)));
    DAMAGE_TYPES.forEach((dt, r) => {
      const yy = y + 22 + r * rh;
      D.add(this.add.text(x, yy, t(dyn(`dmg.${dt}`)), textStyle(12, '#c9a044')));
      ARMOR_CLASSES.forEach((a, i) => {
        const v = DAMAGE_TABLE[dt][a];
        const col = v >= 1.1 ? '#80ff80' : v <= 0.6 ? '#ff7060' : '#e8e0c8';
        D.add(this.add.text(x + 110 + i * cw, yy, `×${v.toFixed(2)}`, textStyle(13, col)).setOrigin(0.5, 0));
      });
    });
  }

  update(_time: number, delta: number): void {
    this.searchText?.setText((this.search ? `${this.search}${Math.floor(this.time.now / 500) % 2 ? '_' : ' '}` : t('enc.search')));
    const p = this.preview;
    if (!p) return;
    // Walk the model around in a circle of facings, with the odd attack.
    p.t += delta / 1000;
    const dir = Math.floor(p.t / 1.2) % 8;
    const cycle = p.t % 4.8;
    const anim = cycle > 3.6 ? 'attack' : 'walk';
    const f = anim === 'walk' ? Math.floor(p.t * 9) % ANIM_FRAMES.walk : Math.floor(p.t * 4) % 2;
    p.img.setFrame(frameName(anim, f, dir));
    p.turret?.setFrame(`turret${anim === 'attack' && f === 1 ? 1 : 0}_${dir}`);
  }
}
