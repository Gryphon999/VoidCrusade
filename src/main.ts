import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { CampaignScene } from './scenes/CampaignScene';
import { BattleScene } from './scenes/BattleScene';
import { HudScene } from './scenes/HudScene';
import { SettingsScene } from './scenes/SettingsScene';
import { AudioSystem } from './systems/AudioSystem';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.background,
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  disableContextMenu: true,
  scene: [BootScene, PreloadScene, MenuScene, CampaignScene, BattleScene, HudScene, SettingsScene],
};

const game = new Phaser.Game(config);
if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;

// Browsers only allow audio after a user gesture.
const unlock = (): void => AudioSystem.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);
