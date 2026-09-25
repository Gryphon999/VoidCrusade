import Phaser from 'phaser';
import type { BattleScene } from '../scenes/BattleScene';
import { Squad } from '../units/Squad';
import { Building } from '../buildings/Building';
import { UNIT_DEFS } from '../units/UnitDefs';
import { portraitKey as unitTextureKey } from '../render/puppet/UnitAtlas';
import { buildingTextureKey } from '../assets/BuildingTextures';
import { RESEARCH_DEFS } from '../systems/ResearchSystem';
import { Button } from './Button';
import { drawPanel, textStyle } from './uiStyle';
import { Resources } from '../systems/ResourceSystem';

export const PANEL = { x: 8, y: 584, w: 1052, h: 128 };
const INFO_X = PANEL.x + 130;
const BTN_X = PANEL.x + 470;

function costText(c: Resources): string {
  if (!c.scrip && !c.flux) return 'free';
  return `${c.scrip}${c.flux ? `/${c.flux}f` : ''}`;
}

function orderText(s: Squad): string {
  if (s.pendingReinforce > 0) return 'Reinforcing…';
  if (s.order === 'hold') return 'Holding position';
  if (s.engaged) return 'Engaging!';
  if (s.isMoving()) return s.order === 'attackMove' ? 'Attack-moving' : 'Moving';
  return 'Awaiting orders';
}

/** Bottom HUD panel describing the current selection with action buttons. */
export class SelectionPanel {
  readonly container: Phaser.GameObjects.Container;
  readonly bounds = new Phaser.Geom.Rectangle(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
  private content: Phaser.GameObjects.Container;
  private hpBar: Phaser.GameObjects.Graphics;
  private updater: (() => void) | null = null;

  constructor(private scene: Phaser.Scene, private battle: BattleScene, private tip: (t: string | null, x: number, y: number) => void) {
    const g = scene.add.graphics();
    drawPanel(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    this.content = scene.add.container(0, 0);
    this.hpBar = scene.add.graphics();
    this.container = scene.add.container(0, 0, [g, this.content, this.hpBar]).setVisible(false);
  }

  get visible(): boolean {
    return this.container.visible;
  }

  refresh(): void {
    this.content.removeAll(true);
    this.hpBar.clear();
    this.updater = null;
    this.tip(null, 0, 0);
    const sel = this.battle.selection;
    if (sel.squads.length) this.buildSquads(sel.squads);
    else if (sel.building) this.buildBuilding(sel.building);
    this.container.setVisible(!!this.updater);
  }

  update(): void {
    this.updater?.();
  }

  private addButton(i: number, label: string, icon: string | undefined, hotkey: string | undefined, onClick: () => void, tooltip?: () => string): Button {
    const b = new Button(this.scene, { x: BTN_X + 36 + i * 76, y: PANEL.y + PANEL.h / 2, w: 70, h: 96, label, icon, hotkey, onClick, tooltip });
    b.onHover = this.tip;
    this.content.add(b.container);
    return b;
  }

  private portrait(key: string): void {
    const frame = this.scene.add.rectangle(PANEL.x + 64, PANEL.y + PANEL.h / 2, 108, 108, 0x05050c).setStrokeStyle(2, 0x3a8dff);
    const img = this.scene.add.image(frame.x, frame.y, key);
    img.setScale(Math.min(96 / img.width, 96 / img.height, 4));
    this.content.add([frame, img]);
  }

  private drawBar(x: number, y: number, w: number, frac: number, color?: number): void {
    const f = Phaser.Math.Clamp(frac, 0, 1);
    const col = color ?? (f > 0.6 ? 0x40d040 : f > 0.3 ? 0xe0c020 : 0xe03020);
    this.hpBar.fillStyle(0x000000, 0.8).fillRect(x - 1, y - 1, w + 2, 12);
    this.hpBar.fillStyle(col, 1).fillRect(x, y, w * f, 10);
  }

  private buildSquads(squads: Squad[]): void {
    const first = squads[0];
    this.portrait(unitTextureKey(first.def.id));
    const title = squads.length === 1 ? first.def.name : `${squads.length} squads`;
    const name = this.scene.add.text(INFO_X, PANEL.y + 14, title, textStyle(18));
    const info = this.scene.add.text(INFO_X, PANEL.y + 60, '', textStyle(14, '#bcc'));
    const state = this.scene.add.text(INFO_X, PANEL.y + 84, '', textStyle(14, '#8f8'));
    this.content.add([name, info, state]);
    const units = this.battle.units;
    const reinforce = this.addButton(0, 'Reinforce', undefined, 'R', () => this.battle.inputController.reinforceSelected(),
      () => 'Replenish fallen soldiers over time.\nCosts half price per missing soldier.');
    const move = this.addButton(1, 'Move', 'move_marker', 'M', () => this.battle.inputController.setMode('move'), () => 'Move (right-click also moves)');
    const atk = this.addButton(2, 'Attack\nmove', 'move_marker', 'G', () => this.battle.inputController.setMode('attackMove'),
      () => 'Move, engaging any enemy on the way');
    this.addButton(3, 'Hold', 'icon_cover', 'H', () => squads.forEach((s) => s.hold()), () => 'Hold position; soldiers seek nearby cover');
    this.addButton(4, 'Stop', undefined, 'X', () => squads.forEach((s) => s.stop()));
    this.updater = (): void => {
      this.hpBar.clear();
      const alive = squads.filter((s) => s.alive);
      const hp = alive.reduce((a, s) => a + s.hp, 0);
      const max = alive.reduce((a, s) => a + s.maxHp, 0) || 1;
      this.drawBar(INFO_X, PANEL.y + 42, 300, hp / max);
      const men = alive.reduce((a, s) => a + s.units.length, 0);
      const cap = alive.reduce((a, s) => a + s.maxSize, 0);
      info.setText(`Soldiers ${men}/${cap}   ·   Army ${units.armyCount('player')}/${units.maxSquads('player')}`);
      state.setText(alive.length === 1 ? orderText(alive[0]) : '');
      const canR = alive.filter((s) => units.canReinforce(s));
      const cost = canR.reduce((a, s) => a + units.reinforceCost(s).scrip, 0);
      reinforce.setEnabled(canR.length > 0 && this.battle.resources.getResources('player').scrip >= cost);
      reinforce.setLabel(canR.length ? `Reinforce\n${cost}` : 'Reinforce');
      const mode = this.battle.inputController.mode;
      move.setActive(mode === 'move');
      atk.setActive(mode === 'attackMove');
    };
  }

  private buildBuilding(b: Building): void {
    this.portrait(buildingTextureKey(b.def.id));
    const name = this.scene.add.text(INFO_X, PANEL.y + 14, b.def.name, textStyle(18));
    const info = this.scene.add.text(INFO_X, PANEL.y + 60, '', textStyle(14, '#bcc'));
    const desc = this.scene.add.text(INFO_X, PANEL.y + 84, b.def.description, { ...textStyle(12, '#99a'), wordWrap: { width: 320 } });
    this.content.add([name, info, desc]);
    const prod = this.battle.production;
    const buttons: { btn: Button; check: () => boolean }[] = [];
    let i = 0;
    for (const id of b.def.produces) {
      const d = UNIT_DEFS[id];
      const btn = this.addButton(i++, costText(d.cost), unitTextureKey(id), undefined, () => prod.enqueue(b, id),
        () => `${d.name}\n${costText(d.cost)} · ${d.trainTime}s\n${d.description}`);
      buttons.push({ btn, check: () => prod.checkEnqueue(b, id) === null });
    }
    if (b.def.role === 'research') {
      const rs = this.battle.research;
      for (const r of RESEARCH_DEFS) {
        const btn = this.addButton(i++, r.name.split(' ')[0], 'icon_flux', undefined, () => rs.start(b, r.id),
          () => `${r.name}\n${costText(r.cost)} · ${r.time}s\n${r.description}${rs.isDone('player', r.id) ? '\n(RESEARCHED)' : ''}`);
        buttons.push({ btn, check: () => !rs.isDone('player', r.id) && !rs.isResearching('player', r.id) && !rs.activeAt(b)
          && this.battle.resources.canAfford('player', r.cost) });
      }
    }
    const queueIcons = this.scene.add.container(0, 0);
    this.content.add(queueIcons);
    let lastQueue = '';
    this.updater = (): void => {
      this.hpBar.clear();
      this.drawBar(INFO_X, PANEL.y + 42, 300, b.hp / b.maxHp);
      let status = `HP ${Math.ceil(b.hp)}/${b.maxHp}`;
      if (b.state === 'constructing') status += `   ·   Constructing ${Math.floor(b.progress * 100)}%`;
      if (b.def.fluxGen) status += `   ·   +${b.def.fluxGen} flux/s`;
      const res = this.battle.research?.activeAt(b);
      if (res) status += `   ·   ${res.def.name} ${Math.floor(res.frac * 100)}%`;
      info.setText(status);
      for (const x of buttons) x.btn.setEnabled(x.check());
      const key = b.queue.join(',');
      if (key !== lastQueue) {
        lastQueue = key;
        queueIcons.removeAll(true);
        b.queue.forEach((q, qi) => {
          const qx = PANEL.x + PANEL.w - 30 - (UNIT_QUEUE_MAX - 1 - qi) * 42;
          const box = this.scene.add.rectangle(qx, PANEL.y + 30, 38, 38, 0x05050c).setStrokeStyle(1, 0x5a5a7a);
          const img = this.scene.add.image(qx, PANEL.y + 30, unitTextureKey(q));
          img.setScale(34 / Math.max(img.width, img.height));
          box.setInteractive({ useHandCursor: true }).on('pointerdown', () => prod.cancel(b, qi));
          queueIcons.add([box, img]);
        });
      }
      if (b.queue.length) {
        const qx = PANEL.x + PANEL.w - 30 - (UNIT_QUEUE_MAX - 1) * 42 - 19;
        this.drawBar(qx, PANEL.y + 56, 38, b.productionFraction(), 0x40c0ff);
      }
    };
  }
}

const UNIT_QUEUE_MAX = 5;
