import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { BUILDING_DEFS, BuildingId, PLAYER_BUILD_LIST } from '../buildings/BuildingDefs';
import { buildingIconKey as buildingTextureKey } from '../render/buildings/BuildingArt';
import type { BattleScene } from '../scenes/BattleScene';
import { drawPanel, textStyle } from './uiStyle';
import { TOP_BAR_H } from './TopBar';

const BTN = 64;
const GAP = 8;
export const TOOLBAR_W = BTN + 24;
const KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];

interface ToolButton {
  id: BuildingId;
  bg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
}

/** Vertical build menu on the right edge, shown while the Stronghold is selected. */
export class BuildToolbar {
  readonly container: Phaser.GameObjects.Container;
  readonly bounds: Phaser.Geom.Rectangle;
  private buttons: ToolButton[] = [];
  private tooltip: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, private battle: BattleScene) {
    const x0 = GAME_WIDTH - TOOLBAR_W;
    const y0 = TOP_BAR_H + 10;
    const h = PLAYER_BUILD_LIST.length * (BTN + GAP) + 34;
    this.bounds = new Phaser.Geom.Rectangle(x0, y0, TOOLBAR_W, h);
    const g = scene.add.graphics();
    drawPanel(g, x0, y0, TOOLBAR_W, h);
    const title = scene.add.text(x0 + TOOLBAR_W / 2, y0 + 14, 'BUILD', textStyle(13, '#9ab')).setOrigin(0.5);
    this.container = scene.add.container(0, 0, [g, title]);
    this.tooltip = scene.add.text(0, 0, '', { ...textStyle(13), backgroundColor: '#10101cee', padding: { x: 8, y: 6 } });
    this.tooltip.setOrigin(1, 0).setVisible(false).setDepth(50);

    PLAYER_BUILD_LIST.forEach((id, i) => {
      const cx = x0 + TOOLBAR_W / 2;
      const cy = y0 + 30 + i * (BTN + GAP) + BTN / 2;
      const bg = scene.add.rectangle(cx, cy, BTN, BTN, 0x22222e).setStrokeStyle(2, 0x5a5a7a);
      const icon = scene.add.image(cx, cy, buildingTextureKey(id));
      icon.setScale((BTN - 8) / Math.max(icon.width, icon.height));
      const key = scene.add.text(cx - BTN / 2 + 3, cy - BTN / 2 + 1, `${i + 1}`, textStyle(11, '#ccc'));
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => this.showTip(id, cy));
      bg.on('pointerout', () => this.tooltip.setVisible(false));
      bg.on('pointerdown', () => this.pick(id));
      this.container.add([bg, icon, key]);
      this.buttons.push({ id, bg, icon });
    });
    KEYS.forEach((k, i) => {
      scene.input.keyboard?.on(`keydown-${k}`, () => {
        if (this.container.visible) this.pick(PLAYER_BUILD_LIST[i]);
      });
    });
  }

  private pick(id: BuildingId): void {
    const check = this.battle.buildings.validate('player', id, -99, -99);
    if (check.reason === 'Not enough resources' || check.reason?.startsWith('Requires')) {
      this.battle.hud.showMessage(check.reason);
      return;
    }
    this.battle.placement.start(id);
  }

  private showTip(id: BuildingId, y: number): void {
    const d = BUILDING_DEFS[id];
    const cost = `${d.cost.scrip} scrip${d.cost.flux ? `, ${d.cost.flux} flux` : ''}`;
    const req = d.requires.length ? `\nRequires: ${d.requires.join(', ')}` : '';
    this.tooltip.setText(`${d.name}\n${cost}  ·  ${d.buildTime}s\n${d.description}${req}`);
    this.tooltip.setPosition(GAME_WIDTH - TOOLBAR_W - 6, y - 30).setVisible(true);
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v);
    if (!v) this.tooltip.setVisible(false);
  }

  update(): void {
    if (!this.container.visible) return;
    const bs = this.battle.buildings;
    for (const btn of this.buttons) {
      const d = BUILDING_DEFS[btn.id];
      const ok = this.battle.resources.canAfford('player', d.cost) && d.requires.every((r) => bs.hasRole('player', r));
      btn.icon.setAlpha(ok ? 1 : 0.35);
      const active = this.battle.placement.activeId === btn.id;
      btn.bg.setStrokeStyle(2, active ? 0x30ff60 : 0x5a5a7a);
    }
  }
}
