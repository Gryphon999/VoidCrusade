import Phaser from 'phaser';
import { GAME_WIDTH, SUPPLY } from '../config';
import { EV } from '../events';
import { dyn, t } from '../i18n';
import { HUD } from './HudArt';
import { textStyle } from './uiStyle';
import { Settings } from '../systems/Settings';
import { AudioSystem } from '../systems/AudioSystem';
import { HintId } from '../tutorial/data';
import type { BattleScene } from '../scenes/BattleScene';
import type { Squad } from '../units/Squad';
import type { Building } from '../buildings/Building';

const W = 440;
const SHOW = 8;

/**
 * First-time tips: each hint appears once per profile the first time its mechanic comes up
 * (suppression, a broken squad, the first vehicle, supply cap…). Off switch and reset in Settings.
 */
export class HintToast {
  private root: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Text;
  private foot: Phaser.GameObjects.Text;
  private queue: HintId[] = [];
  private age = -1;
  private poll = 0;
  private off: (() => void)[] = [];

  constructor(private scene: Phaser.Scene, private battle: BattleScene) {
    this.bg = scene.add.graphics();
    this.title = scene.add.text(14, 10, t('hint.title'), textStyle(13, HUD.goldHi)).setStroke('#000', 3);
    this.body = scene.add.text(14, 30, '', { ...textStyle(13, '#e8e0c8'), wordWrap: { width: W - 28 }, lineSpacing: 2 });
    this.foot = scene.add.text(W - 14, 0, t('hint.off'), textStyle(10, '#8a8474')).setOrigin(1, 0);
    this.root = scene.add.container((GAME_WIDTH - W) / 2, HUD.topH + 14, [this.bg, this.title, this.body, this.foot]).setDepth(149).setVisible(false);
    if (battle.tutorial) return;
    const ev = battle.events;
    const on = (e: string, fn: (...a: never[]) => void): void => {
      ev.on(e, fn);
      this.off.push(() => ev.off(e, fn));
    };
    on(EV.squadBroken, (s: Squad) => s.owner === 'player' && this.show('broken'));
    on(EV.squadRankUp, (s: Squad) => s.owner === 'player' && this.show('rank'));
    on(EV.squadSpawned, (s: Squad) => s.owner === 'player' && s.isVehicle && this.show('vehicle'));
    on(EV.tierUp, (o: string) => o === 'player' && this.show('tier'));
    on(EV.dropIncoming, () => this.show('drop'));
    on(EV.mapEvent, (kind: string, start: boolean) => kind === 'storm' && start && this.show('storm'));
    on(EV.wreckChanged, () => this.show('wreck'));
    on(EV.buildingComplete, (b: Building) => b.owner === 'player' && !!b.def.garrison && this.show('garrison'));
    on(EV.message, (k: string) => {
      if (k === 'err.supply') this.show('supply');
      if (k === 'err.resources' && battle.resources.getResources('player').flux < 60) this.show('power');
    });
  }

  private seen(): string[] {
    return Settings.get().hintsSeen ?? [];
  }

  show(id: HintId): void {
    if (Settings.get().hints === false || this.seen().includes(id) || this.queue.includes(id)) return;
    Settings.set({ hintsSeen: [...this.seen(), id] });
    this.queue.push(id);
    if (this.age < 0) this.next();
  }

  private next(): void {
    const id = this.queue[0];
    if (!id) {
      this.age = -1;
      this.root.setVisible(false);
      return;
    }
    this.body.setText(t(dyn(`hint.${id}`)));
    const h = 30 + this.body.height + 26;
    this.foot.setY(h - 20);
    this.bg.clear().fillStyle(0x0c0b10, 0.9).fillRect(0, 0, W, h).lineStyle(2, 0xc9a044, 0.9).strokeRect(0.5, 0.5, W - 1, h - 1);
    this.bg.fillStyle(0xc9a044, 1).fillRect(0, 0, 4, h);
    this.root.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 250 });
    AudioSystem.hint();
    this.age = 0;
  }

  update(dt: number): void {
    if (this.age >= 0) {
      this.age += dt;
      if (this.age > SHOW - 0.6) this.root.setAlpha(Math.max(0, (SHOW - this.age) / 0.6));
      if (this.age > SHOW) {
        this.queue.shift();
        this.next();
      }
    }
    // Cheap polling for state-based hints, twice a second.
    this.poll -= dt;
    if (this.poll > 0 || this.battle.tutorial) return;
    this.poll = 0.5;
    const b = this.battle;
    const mine = b.units.getSquads('player');
    if (mine.some((s) => s.suppression >= 50)) this.show('suppression');
    const cap = b.units.supplyCap('player');
    if (cap < SUPPLY.hardMax && b.production.supplyUsed('player') >= cap - 1) this.show('supply');
    if (b.units.getSquads('enemy').some((s) => s.burrowed && s.alive && b.fogVisibleFor('player', s.center.x, s.center.y))) this.show('burrowed');
  }

  destroy(): void {
    this.off.forEach((f) => f());
    this.root.destroy();
  }
}
