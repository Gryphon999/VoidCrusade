import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, GOTHIC_FONT } from '../config';
import { CampaignSave, CampaignState } from '../campaign/CampaignState';
import { TERRITORIES, getTerritory } from '../campaign/CampaignData';
import { getCard } from '../campaign/UpgradeCards';
import { CampaignMapView, TerritoryStatus } from '../ui/CampaignMapView';
import { showCardPicker } from '../ui/CardPicker';
import { Button } from '../ui/Button';
import { drawPanel, textStyle } from '../ui/uiStyle';
import { BattleData, BattleResult } from './BattleTypes';
import { Settings } from '../systems/Settings';

/** Dark Crusade-style strategic layer: conquer territories one battle at a time. */
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
    this.handleResult(data.result);
  }

  private statusOf(id: string): TerritoryStatus {
    if (this.save.owned.includes(id)) return 'owned';
    return CampaignState.attackable(this.save).includes(id) ? 'attackable' : 'enemy';
  }

  private buildSidebar(): void {
    const g = this.add.graphics();
    drawPanel(g, 12, 12, 300, GAME_HEIGHT - 24, 0.85);
    this.add.text(162, 50, 'The Crusade', { fontFamily: GOTHIC_FONT, fontSize: '40px', color: '#ffd060' }).setOrigin(0.5);
    this.summary = this.add.text(32, 90, '', { ...textStyle(14, '#ccd'), wordWrap: { width: 262 }, lineSpacing: 4 });
    this.info = this.add.text(GAME_WIDTH / 2 + 160, GAME_HEIGHT - 60, '', { ...textStyle(16), align: 'center' })
      .setOrigin(0.5).setStroke('#000', 4);
    new Button(this, { x: 162, y: GAME_HEIGHT - 50, w: 240, h: 40, label: 'Main Menu', onClick: () => this.scene.start('MenuScene') });
    this.refreshSummary();
  }

  private refreshSummary(): void {
    const b = CampaignState.bonuses(this.save);
    const lines = [
      `Territories held: ${this.save.owned.length}/${TERRITORIES.length}`,
      `Battles won: ${this.save.battles}`,
      '',
      'Active bonuses:',
      `  Starting Scrip +${b.startScrip}   Flux +${b.startFlux}`,
      `  Squad cap +${b.maxSquadsBonus}   Squad size +${b.squadSizeBonus}`,
      `  HP ×${b.hpMult.toFixed(2)}   Damage ×${b.damageMult.toFixed(2)}`,
      `  Turrets ×${b.turretDamageMult.toFixed(2)}   Build ×${b.buildSpeedMult.toFixed(2)}`,
      '',
      'Boons:',
      ...(this.save.cards.length ? this.save.cards.map((c) => `  • ${getCard(c).name}`) : ['  (none yet)']),
      '',
      'Click a glowing territory adjacent to',
      'your lands to launch an assault.',
    ];
    this.summary.setText(lines.join('\n'));
  }

  private showInfo(id: string | null): void {
    if (!id) {
      this.info.setText('');
      return;
    }
    const t = getTerritory(id);
    const st = this.statusOf(id);
    const status = st === 'owned' ? 'Held by the Iron Void' : st === 'attackable' ? 'Click to attack' : 'Null Horde territory';
    this.info.setText(`${t.name} — ${t.bonusText}\n${status}`);
  }

  private clickTerritory(id: string): void {
    if (this.modal || this.statusOf(id) !== 'attackable') return;
    const t = getTerritory(id);
    const root = this.add.container(0, 0).setDepth(300);
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    drawPanel(g, GAME_WIDTH / 2 - 230, GAME_HEIGHT / 2 - 120, 460, 240);
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, `Assault ${t.name}?`, textStyle(26, '#ffd060')).setOrigin(0.5);
    const threat = t.enemyBonus >= 400 ? 'Extreme' : t.enemyBonus >= 200 ? 'High' : t.enemyBonus >= 100 ? 'Moderate' : 'Low';
    const body = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, `Reward: ${t.bonusText}\nHorde resistance: ${threat}`,
      { ...textStyle(17, '#ccd'), align: 'center' }).setOrigin(0.5);
    const go = new Button(this, { x: GAME_WIDTH / 2 - 100, y: GAME_HEIGHT / 2 + 70, w: 180, h: 44, label: 'Launch Assault', onClick: () => this.launch(id) });
    const cancel = new Button(this, { x: GAME_WIDTH / 2 + 100, y: GAME_HEIGHT / 2 + 70, w: 180, h: 44, label: 'Cancel', onClick: () => this.closeDialog() });
    root.add([dim, g, title, body, go.container, cancel.container]);
    this.dialog = root;
    this.modal = true;
  }

  private closeDialog(): void {
    this.dialog?.destroy();
    this.dialog = null;
    this.modal = false;
  }

  private launch(id: string): void {
    const t = getTerritory(id);
    const data: BattleData = {
      mode: 'campaign',
      territoryId: id,
      mapIndex: t.mapIndex,
      difficulty: Settings.get().difficulty,
      bonuses: CampaignState.bonuses(this.save),
      enemyBonusScrip: t.enemyBonus,
    };
    this.scene.start('BattleScene', data);
  }

  private handleResult(result?: BattleResult): void {
    const pending = this.save.offer;
    if (result && result.data.territoryId) {
      if (result.winner === 'player') {
        const cards = CampaignState.recordVictory(this.save, result.data.territoryId);
        this.refreshSummary();
        this.banner(`${getTerritory(result.data.territoryId).name} is ours!`, '#8fc0ff');
        this.time.delayedCall(900, () => this.pickCards(cards.map((c) => c.id)));
        return;
      }
      this.banner('Assault repelled. Regroup and strike again.', '#ff8080');
    }
    if (pending.length) this.pickCards(pending);
    else if (this.save.won) this.showCampaignVictory();
  }

  private pickCards(ids: string[]): void {
    this.modal = true;
    showCardPicker(this, ids.map((id) => getCard(id as Parameters<typeof getCard>[0])), (c) => {
      CampaignState.chooseCard(this.save, c.id);
      this.modal = false;
      this.refreshSummary();
      if (this.save.won) this.showCampaignVictory();
    });
  }

  private banner(text: string, color: string): void {
    const t = this.add.text(GAME_WIDTH / 2 + 160, 40, text, textStyle(24, color)).setOrigin(0.5).setStroke('#000', 5).setDepth(200);
    this.tweens.add({ targets: t, alpha: 0, delay: 3000, duration: 800, onComplete: () => t.destroy() });
  }

  private showCampaignVictory(): void {
    this.modal = true;
    const root = this.add.container(0, 0).setDepth(500);
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8).setOrigin(0).setInteractive();
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'The Throne Is Yours', {
      fontFamily: GOTHIC_FONT, fontSize: '72px', color: '#ffd060', stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5).setScale(0.5).setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 900, ease: 'Back.easeOut' });
    const sub = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, 'The Null Horde is purged from this world.\nIn the void between stars, only iron survives.',
      { ...textStyle(20, '#dde'), align: 'center' }).setOrigin(0.5);
    const btn = new Button(this, { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 120, w: 220, h: 46, label: 'Return to Menu', onClick: () => this.scene.start('MenuScene') });
    root.add([dim, title, sub, btn.container]);
  }

  update(_t: number, delta: number): void {
    this.view.update(delta / 1000);
  }
}
