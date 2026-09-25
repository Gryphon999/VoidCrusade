import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { headingFont, t } from '../i18n';
import type { BattleScene } from '../scenes/BattleScene';
import { Button } from './Button';
import { drawPanel } from './uiStyle';

/** Pause overlay: resume, settings, leave battle. */
export class PauseMenu {
  private root: Phaser.GameObjects.Container | null = null;

  constructor(private scene: Phaser.Scene, private battle: BattleScene) {}

  get isOpen(): boolean {
    return this.root !== null;
  }

  toggle(): void {
    if (this.root) this.close();
    else this.open();
  }

  /** Opens the menu; `alreadyPaused` when rebuilding the HUD over a paused battle. */
  open(alreadyPaused = false): void {
    if (this.root || this.battle.ended) return;
    if (!alreadyPaused) this.battle.scene.pause();
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const root = this.scene.add.container(0, 0).setDepth(450);
    const dim = this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0).setInteractive();
    const g = this.scene.add.graphics();
    drawPanel(g, cx - 170, cy - 150, 340, 300);
    const title = this.scene.add.text(cx, cy - 105, t('pause.title'), { fontFamily: headingFont(), fontSize: '48px', color: '#ffd060' }).setOrigin(0.5);
    root.add([dim, g, title]);
    const campaign = this.battle.battleData.mode === 'campaign';
    const items: [string, () => void][] = [
      [t('pause.resume'), () => this.close()],
      [t('menu.settings'), () => {
        this.scene.scene.launch('SettingsScene', {});
        this.scene.scene.bringToTop('SettingsScene');
      }],
      [campaign ? t('pause.retreat') : t('pause.quit'), () => this.quit(campaign)],
    ];
    items.forEach(([label, fn], i) => {
      root.add(new Button(this.scene, { x: cx, y: cy - 30 + i * 60, w: 240, h: 44, label, onClick: fn }).container);
    });
    this.root = root;
  }

  close(): void {
    this.root?.destroy();
    this.root = null;
    this.battle.scene.resume();
  }

  private quit(campaign: boolean): void {
    this.root?.destroy();
    this.root = null;
    this.battle.scene.resume();
    this.battle.scene.start(campaign ? 'CampaignScene' : 'MenuScene', {});
  }
}
