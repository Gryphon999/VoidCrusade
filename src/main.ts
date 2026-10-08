import Phaser from 'phaser';
import '@fontsource/cinzel-decorative/latin-900.css';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { CampaignScene } from './scenes/CampaignScene';
import { BattleScene } from './scenes/BattleScene';
import { HudScene } from './scenes/HudScene';
import { SettingsScene } from './scenes/SettingsScene';
import { SubtitleScene } from './scenes/SubtitleScene';
import { EncyclopediaScene } from './scenes/EncyclopediaScene';
import { AudioSystem } from './systems/AudioSystem';
import { Settings } from './systems/Settings';
import { detectLanguage, setLanguage } from './i18n';
import { Platform } from './platform/Platform';
import { Voice } from './systems/VoiceSystem';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.background,
  // Transparent so the 3D battlefield canvas underneath shows through.
  transparent: true,
  pixelArt: false,
  antialias: true,
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  disableContextMenu: true,
  scene: [BootScene, PreloadScene, MenuScene, CampaignScene, BattleScene, HudScene, SettingsScene, EncyclopediaScene, SubtitleScene],
};

// Canvas text does not wait for web fonts: load the title font first, but never hold the game on it.
const titleFont = Promise.race([
  document.fonts.load('900 64px "Cinzel Decorative"', 'VOIDCRUSADE'),
  new Promise((resolve) => setTimeout(resolve, 3000)),
]).catch(() => undefined);

// The Yandex SDK (when present) may bring a newer cloud save, so it goes first, then settings are read.
void Promise.all([titleFont, Platform.init().catch(() => undefined)]).then(() => {
  Settings.reload();
  // Language: saved choice, else Yandex Games SDK / browser language.
  setLanguage(Settings.get().language ?? detectLanguage());
  Settings.onChange((s) => setLanguage(s.language ?? detectLanguage()));

  const game = new Phaser.Game(config);
  if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;

  // Ads and the platform's pause freeze the whole game; any hold (also a lost focus) silences it.
  Platform.onHold(({ mute, freeze }) => {
    AudioSystem.setMuted(mute);
    Voice.setHeld(mute);
    if (freeze) game.loop.sleep();
    else game.loop.wake();
  });
});

// Browsers only allow audio after a user gesture.
const unlock = (): void => AudioSystem.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);
