import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SUPPLY } from '../config';
import { CampaignSave, CampaignState, DEFENCE_ENEMY_SCRIP } from '../campaign/CampaignState';
import { TERRITORIES, TerritoryRules, getTerritory } from '../campaign/CampaignData';
import { getCard } from '../campaign/UpgradeCards';
import { describeEffect, getEvent } from '../campaign/CampaignEvents';
import { CampaignMapView, TerritoryStatus } from '../ui/CampaignMapView';
import { showCardPicker } from '../ui/CardPicker';
import { Button } from '../ui/Button';
import { drawPanel, textStyle } from '../ui/uiStyle';
import { BattleData, BattleResult } from './BattleTypes';
import { Settings } from '../systems/Settings';
import { WargearPicker } from '../ui/WargearPicker';
import { defaultPick } from '../campaign/Wargear';
import { Voice } from '../systems/VoiceSystem';
import { Ambience } from '../systems/Ambience';
import { dyn, headingFont, onLanguageChange, t } from '../i18n';
import { bonusText, cardName, territoryName } from '../i18n/names';

/** Territory-conquest strategic layer: conquer territories one battle at a time, hold them against counterattacks. */
export class CampaignScene extends Phaser.Scene {
  private save!: CampaignSave;
  private view!: CampaignMapView;
  private info!: Phaser.GameObjects.Text;
  private summary!: Phaser.GameObjects.Text;
  private dialog: Phaser.GameObjects.Container | null = null;
  private modal = false;

  constructor() {
    super('CampaignScene');
  }

  create(data: { result?: BattleResult; fresh?: boolean }): void {
    this.dialog = null;
    this.modal = false;
    this.save = (data.fresh ? null : CampaignState.load()) ?? CampaignState.newCampaign();
    this.view = new CampaignMapView(this);
    this.view.status = (id): TerritoryStatus => this.statusOf(id);
    this.view.onHover = (id): void => this.showInfo(id);
    this.view.onClick = (id): void => this.clickTerritory(id);
    this.buildSidebar();
    Ambience.campaign();
    this.handleResult(data.result);
    // Switching language rebuilds the map; the save is already persisted.
    const off = onLanguageChange(() => this.scene.restart({}));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  private statusOf(id: string): TerritoryStatus {
    if (this.save.underAttack === id) return 'underAttack';
    if (this.save.owned.includes(id)) return 'owned';
    return CampaignState.attackable(this.save).includes(id) ? 'attackable' : 'enemy';
  }

  private buildSidebar(): void {
    const g = this.add.graphics();
    drawPanel(g, 12, 12, 300, GAME_HEIGHT - 24, 0.85);
    this.add.text(162, 50, t('camp.title'), { fontFamily: headingFont(), fontSize: '40px', color: '#ffd060' }).setOrigin(0.5);
    this.summary = this.add.text(32, 90, '', { ...textStyle(14, '#ccd'), wordWrap: { width: 262 }, lineSpacing: 4 });
    this.info = this.add.text(GAME_WIDTH / 2 + 160, GAME_HEIGHT - 60, '', { ...textStyle(16), align: 'center' })
      .setOrigin(0.5).setStroke('#000', 4);
    new Button(this, { x: 162, y: GAME_HEIGHT - 50, w: 240, h: 40, label: t('end.menu'), onClick: () => this.scene.start('MenuScene') });
    this.refreshSummary();
  }

  private refreshSummary(): void {
    const b = CampaignState.bonuses(this.save);
    const lines = [
      t('camp.held', { n: this.save.owned.length, max: TERRITORIES.length }),
      t('camp.battles', { n: this.save.battles }),
      ...(this.save.lost ? [t('camp.lost', { n: this.save.lost })] : []),
      '',
      t('camp.bonuses'),
      t('camp.bonus.res', { s: b.startScrip, f: b.startFlux }),
      t('camp.bonus.squads', { c: b.maxSquadsBonus * SUPPLY.perSquadSlot, z: b.squadSizeBonus }),
      t('camp.bonus.stats', { hp: b.hpMult.toFixed(2), dmg: b.damageMult.toFixed(2) }),
      t('camp.bonus.build', { t: b.turretDamageMult.toFixed(2), b: b.buildSpeedMult.toFixed(2) }),
      '',
      t('camp.boons'),
      ...(this.save.cards.length ? this.save.cards.map((c) => `  • ${cardName(c)}`) : [t('camp.noBoons')]),
    ];
    // One-off effects of the last event.
    const next = describeEffect({ nextBattle: this.save.nextBattle, enemyScrip: this.save.enemyScrip });
    if (this.save.nextBattle || this.save.enemyScrip) {
      lines.push('', t('camp.next'), ...next.map((p) => `  • ${t(dyn(p.key), p.params)}`));
    }
    lines.push('', t('camp.help'));
    this.summary.setText(lines.join('\n'));
  }

  /** The rules line of a territory: its modifiers and mission, or "standard battle". */
  private rulesText(rules: TerritoryRules | undefined, defence = false): string {
    const parts = (rules?.modifiers ?? []).map((m) => t(dyn(`mod.${m}`)));
    if (!defence && rules?.winMode) parts.push(t(dyn(`mode.${rules.winMode}`)));
    return parts.length ? t('camp.rules', { list: parts.join(', ') }) : t('camp.rules.none');
  }

  private showInfo(id: string | null): void {
    if (!id) {
      this.info.setText('');
      return;
    }
    const tr = getTerritory(id);
    const st = this.statusOf(id);
    const status = t(st === 'owned' ? 'camp.status.owned' : st === 'attackable' ? 'camp.status.attackable' : st === 'underAttack' ? 'camp.status.underAttack' : 'camp.status.enemy');
    this.info.setText(`${territoryName(id)} — ${bonusText(tr.bonus)}\n${status}`);
  }

  private clickTerritory(id: string): void {
    const st = this.statusOf(id);
    if (this.modal || (st !== 'attackable' && st !== 'underAttack')) return;
    const tr = getTerritory(id);
    const defence = st === 'underAttack';
    const root = this.add.container(0, 0).setDepth(300);
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    drawPanel(g, GAME_WIDTH / 2 - 250, GAME_HEIGHT / 2 - 140, 500, 280);
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100, t(defence ? 'camp.defend' : 'camp.assault', { name: territoryName(id) }), textStyle(24, defence ? '#ff8080' : '#f0d27a')).setOrigin(0.5);
    const threat = t(tr.enemyBonus >= 400 ? 'camp.threat.extreme' : tr.enemyBonus >= 200 ? 'camp.threat.high' : tr.enemyBonus >= 100 ? 'camp.threat.moderate' : 'camp.threat.low');
    const rules = this.rulesText(tr.rules, defence);
    const text = defence ? t('camp.defendBody', { rules }) : `${t('camp.reward', { bonus: bonusText(tr.bonus), threat })}\n${rules}`;
    const body = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 25, text, { ...textStyle(16, '#ccd'), align: 'center', wordWrap: { width: 450 } }).setOrigin(0.5);
    const go = new Button(this, { x: GAME_WIDTH / 2 - 110, y: GAME_HEIGHT / 2 + 90, w: 200, h: 44, label: t(defence ? 'camp.defendGo' : 'camp.launch'), onClick: () => this.launch(id, defence) });
    const cancel = new Button(this, { x: GAME_WIDTH / 2 + 110, y: GAME_HEIGHT / 2 + 90, w: 180, h: 44, label: t('common.cancel'), onClick: () => this.closeDialog() });
    root.add([dim, g, title, body, go.container, cancel.container]);
    this.dialog = root;
    this.modal = true;
  }

  private closeDialog(): void {
    this.dialog?.destroy();
    this.dialog = null;
    this.modal = false;
  }

  private launch(id: string, defence: boolean): void {
    const tr = getTerritory(id);
    const data: BattleData = {
      mode: 'campaign',
      territoryId: id,
      mapIndex: tr.mapIndex,
      difficulty: Settings.get().difficulty,
      bonuses: CampaignState.bonuses(this.save),
      enemyBonusScrip: tr.enemyBonus + (this.save.enemyScrip ?? 0) + (defence ? DEFENCE_ENEMY_SCRIP : 0),
      modifiers: tr.rules?.modifiers,
      // A defence is always Hold the Line; an assault fights by the territory's mission, if any.
      winMode: defence ? 'hold' : tr.rules?.winMode,
      defense: defence,
    };
    // Arm the Commander before every battle.
    this.modal = true;
    new WargearPicker(this, 'ironvoid', Settings.get().wargear ?? defaultPick('ironvoid'), (pick) => {
      Settings.set({ wargear: pick });
      this.scene.start('BattleScene', { ...data, wargear: pick });
    });
  }

  private handleResult(result?: BattleResult): void {
    if (result && result.data.territoryId) {
      const id = result.data.territoryId;
      const defence = !!result.data.defense;
      if (result.winner === 'player') {
        const cards = CampaignState.recordVictory(this.save, id);
        Voice.say('vo.territory', 'commander', 'event');
        this.refreshSummary();
        this.banner(t(defence ? 'camp.held2' : 'camp.ours', { name: territoryName(id) }), '#8fc0ff');
        this.time.delayedCall(900, () => this.pickCards(cards.map((c) => c.id)));
        return;
      }
      const lost = CampaignState.recordDefeat(this.save, id, defence);
      this.refreshSummary();
      this.banner(lost ? t('camp.lostLand', { name: territoryName(id) }) : t('camp.repelled'), '#ff8080');
      this.time.delayedCall(1200, () => this.afterTurn());
      return;
    }
    if (this.save.offer.length) this.pickCards(this.save.offer);
    else if (this.save.eventId) this.showEvent();
    else if (this.save.won) this.showCampaignVictory();
    else this.afterTurn();
  }

  private pickCards(ids: string[]): void {
    this.modal = true;
    showCardPicker(this, ids.map((id) => getCard(id as Parameters<typeof getCard>[0])), (c) => {
      CampaignState.chooseCard(this.save, c.id);
      this.modal = false;
      this.refreshSummary();
      if (this.save.won) this.showCampaignVictory();
      else if (this.save.eventId) this.showEvent();
      else this.afterTurn();
    });
  }

  /** Between-battle event: a situation and two answers, each with its price spelled out. */
  private showEvent(): void {
    const ev = getEvent(this.save.eventId ?? '');
    this.modal = true;
    const root = this.add.container(0, 0).setDepth(400);
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setOrigin(0).setInteractive();
    const w = 760;
    const h = 460;
    const x0 = (GAME_WIDTH - w) / 2;
    const y0 = (GAME_HEIGHT - h) / 2;
    const g = this.add.graphics();
    drawPanel(g, x0, y0, w, h);
    const kicker = this.add.text(GAME_WIDTH / 2, y0 + 34, t('ev.title'), textStyle(14, '#9a9280')).setOrigin(0.5);
    const title = this.add.text(GAME_WIDTH / 2, y0 + 72, t(dyn(`ev.${ev.id}.title`)), { fontFamily: headingFont(), fontSize: '36px', color: '#ffd060' }).setOrigin(0.5);
    const text = this.add.text(GAME_WIDTH / 2, y0 + 150, t(dyn(`ev.${ev.id}.text`)), { ...textStyle(17, '#ccd'), align: 'center', wordWrap: { width: w - 100 } }).setOrigin(0.5);
    root.add([dim, g, kicker, title, text]);
    ev.options.forEach((fx, i) => {
      const cx = x0 + 40 + i * (w / 2);
      const cy = y0 + 230;
      const card = this.add.graphics();
      card.fillStyle(0x1a1814, 0.95).fillRect(cx, cy, w / 2 - 60, 170);
      card.lineStyle(1, 0x6a5a38, 1).strokeRect(cx + 0.5, cy + 0.5, w / 2 - 61, 169);
      const label = this.add.text(cx + 16, cy + 14, t(dyn(`ev.${ev.id}.${i === 0 ? 'a' : 'b'}`)), { ...textStyle(17, '#f0d27a'), wordWrap: { width: w / 2 - 92 } });
      const fxText = describeEffect(fx).map((p) => `• ${t(dyn(p.key), p.params)}`).join('\n');
      const desc = this.add.text(cx + 16, cy + 62, fxText, { ...textStyle(13, '#bcb4a0'), wordWrap: { width: w / 2 - 92 }, lineSpacing: 3 });
      const zone = this.add.zone(cx, cy, w / 2 - 60, 170).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => card.clear().fillStyle(0x3a3020, 0.95).fillRect(cx, cy, w / 2 - 60, 170).lineStyle(2, 0xffd060, 1).strokeRect(cx + 0.5, cy + 0.5, w / 2 - 61, 169));
      zone.on('pointerout', () => card.clear().fillStyle(0x1a1814, 0.95).fillRect(cx, cy, w / 2 - 60, 170).lineStyle(1, 0x6a5a38, 1).strokeRect(cx + 0.5, cy + 0.5, w / 2 - 61, 169));
      zone.on('pointerdown', () => {
        root.destroy();
        CampaignState.answerEvent(this.save, i as 0 | 1);
        this.modal = false;
        this.refreshSummary();
        this.afterTurn();
      });
      root.add([card, label, desc, zone]);
    });
  }

  /** The turn's last word: a counterattack, if the Horde rolled one. */
  private afterTurn(): void {
    if (this.save.underAttack) {
      this.banner(t('camp.counterattack', { name: territoryName(this.save.underAttack) }), '#ff6060');
      Voice.say('vo.underAttack', 'announcer', 'alert');
    }
  }

  private banner(text: string, color: string): void {
    const t = this.add.text(GAME_WIDTH / 2 + 160, 40, text, textStyle(24, color)).setOrigin(0.5).setStroke('#000', 5).setDepth(200);
    this.tweens.add({ targets: t, alpha: 0, delay: 3000, duration: 800, onComplete: () => t.destroy() });
  }

  private showCampaignVictory(): void {
    this.modal = true;
    const root = this.add.container(0, 0).setDepth(500);
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8).setOrigin(0).setInteractive();
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, t('camp.won.title'), {
      fontFamily: headingFont(), fontSize: '72px', color: '#ffd060', stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5).setScale(0.5).setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 900, ease: 'Back.easeOut' });
    const sub = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, t('camp.won.sub'),
      { ...textStyle(20, '#dde'), align: 'center' }).setOrigin(0.5);
    const btn = new Button(this, { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 120, w: 220, h: 46, label: t('camp.won.menu'), onClick: () => this.scene.start('MenuScene') });
    root.add([dim, title, sub, btn.container]);
  }

  update(_t: number, delta: number): void {
    this.view.update(delta / 1000);
  }
}
