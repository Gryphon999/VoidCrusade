import Phaser from 'phaser';
import { GAME_HEIGHT } from '../config';
import { HUD } from './HudArt';
import { portraitKey } from '../render/puppet/UnitAtlas';
import { ModelSnap } from '../render3d/ModelSnap';
import { unitName } from '../i18n/names';
import { t } from '../i18n';
import { Squad } from '../units/Squad';
import type { BattleScene } from '../scenes/BattleScene';
import type { Tooltip } from './Tooltip';

const CARD = 44;
const GAP = 4;
const X0 = 8;
const Y0 = HUD.topH + 40;
/** Cards per column before the roster wraps to the next column. */
const PER_COLUMN = Math.floor((GAME_HEIGHT - HUD.bottomH - Y0 - 8) / (CARD + GAP));

interface Card {
  squad: Squad;
  root: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
  bar: Phaser.GameObjects.Graphics;
  portrait: Phaser.GameObjects.Image;
  zone: Phaser.GameObjects.Zone;
}

/**
 * Roster of the player's squads down the left edge of the battlefield: a portrait with a health bar
 * per squad. Click selects it (Shift adds to the selection); clicking the squad that is already the
 * selection centres the camera on it. A squad under fire flashes red.
 */
export class SquadRoster {
  private cards: Card[] = [];
  private pool = new Map<Squad, Card>();
  private t = 0;

  constructor(private scene: Phaser.Scene, private battle: BattleScene, private tooltip: Tooltip) {}

  /** Screen rectangle the roster currently covers (for the HUD input blockers). */
  get rect(): Phaser.Geom.Rectangle {
    const cols = Math.max(1, Math.ceil(this.cards.length / PER_COLUMN));
    const rows = Math.min(PER_COLUMN, this.cards.length);
    return new Phaser.Geom.Rectangle(X0 - 2, Y0 - 2, cols * (CARD + GAP) + 4, rows * (CARD + GAP) + 4);
  }

  update(dt: number): void {
    this.t += dt;
    const squads = this.battle.units.getSquads('player').filter((s) => s.alive && !s.embarked);
    // Add cards for new squads, drop cards of squads that are gone; keep a stable order.
    for (const s of squads) if (!this.pool.has(s)) this.pool.set(s, this.makeCard(s));
    for (const [s, c] of this.pool) {
      if (!squads.includes(s)) {
        c.root.destroy();
        this.pool.delete(s);
      }
    }
    this.cards = squads.map((s) => this.pool.get(s) as Card);
    const selected = this.battle.selection.squads;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 10);
    this.cards.forEach((c, i) => {
      const col = Math.floor(i / PER_COLUMN);
      const row = i % PER_COLUMN;
      c.root.setPosition(X0 + col * (CARD + GAP), Y0 + row * (CARD + GAP));
      const s = c.squad;
      const on = selected.includes(s);
      const underFire = !!s.engaged || s.suppression > 20;
      c.frame.clear();
      c.frame.fillStyle(on ? 0x3a3020 : 0x121216, 0.9).fillRect(0, 0, CARD, CARD);
      const border = on ? 0xffd060 : underFire ? Phaser.Display.Color.GetColor(255, 60 + pulse * 60, 40) : 0x5a5040;
      c.frame.lineStyle(on ? 2 : 1.5, border, 1).strokeRect(0.5, 0.5, CARD - 1, CARD - 1);
      // Health bar along the bottom edge.
      const hp = s.maxHp > 0 ? Math.max(0, Math.min(1, s.hp / s.maxHp)) : 0;
      c.bar.clear();
      c.bar.fillStyle(0x000000, 0.8).fillRect(3, CARD - 7, CARD - 6, 4);
      c.bar.fillStyle(hp > 0.6 ? 0x50d070 : hp > 0.3 ? 0xe0b030 : 0xe04040, 1).fillRect(3, CARD - 7, (CARD - 6) * hp, 4);
      c.portrait.setAlpha(s.def.isHero ? 1 : 0.92);
    });
  }

  private makeCard(s: Squad): Card {
    const scene = this.scene;
    const root = scene.add.container(0, 0).setDepth(60);
    const frame = scene.add.graphics();
    // The 3D studio render when the 3D renderer is up, else the 2D atlas portrait, else nothing.
    const live = ModelSnap.unitPortrait(scene, s.def.id);
    const key = live ?? (scene.textures.exists(portraitKey(s.def.id)) ? portraitKey(s.def.id) : '__DEFAULT');
    const portrait = scene.add.image(CARD / 2, CARD / 2 - 3, key, live ? 0 : undefined);
    const fit = (CARD - 8) / Math.max(portrait.width, portrait.height);
    portrait.setScale(Math.min(fit, 2));
    if (key === '__DEFAULT') portrait.setVisible(false);
    const bar = scene.add.graphics();
    const zone = scene.add.zone(0, 0, CARD, CARD).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!s.alive) return;
      const sel = this.battle.selection;
      const only = sel.squads.length === 1 && sel.squads[0] === s;
      if (p.event.shiftKey) sel.toggleSquad(s);
      else if (only) this.battle.cameraSystem.centerOn(s.center.x, s.center.y);
      else sel.selectSquads([s]);
    });
    zone.on('pointerover', () => this.tooltip.show(unitName(s.def.id), t('roster.hint', { n: s.units.length, max: s.maxSize }), root.x + CARD + 8, root.y + 8));
    zone.on('pointerout', () => this.tooltip.hide());
    root.add([frame, portrait, bar, zone]);
    return { squad: s, root, frame, bar, portrait, zone };
  }

  destroy(): void {
    for (const c of this.pool.values()) c.root.destroy();
    this.pool.clear();
    this.cards = [];
  }
}
