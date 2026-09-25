import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, GOTHIC_FONT } from '../config';
import { createTileTextures } from '../assets/TileTextures';
import { createUITextures } from '../assets/UITextures';
import { createBuildingTextures } from '../assets/BuildingTextures';
import { createUnitTextures } from '../assets/UnitTextures';
import { createFxTextures } from '../assets/FxTextures';
import { createCaptureTextures } from '../assets/CaptureTextures';
import { getCursors } from '../assets/Cursors';
import { createPropTextures } from '../render/PropArt';
import { createHudArt } from '../ui/HudArt';
import { createPlanetArt } from '../render/PlanetArt';
import { createGlyphIcons } from '../ui/GlyphIcons';
import { createCaptureArt } from '../render/CaptureArt';
import { createBuildingIcons, ensureBuildingArt } from '../render/buildings/BuildingArt';
import { Projection } from '../render/Projection';
import { Settings } from '../systems/Settings';
import { createUnitAtlases } from '../render/puppet/UnitAtlas';
import { MAP_BUILDERS } from '../maps';
import { textStyle } from '../ui/uiStyle';

const TIPS = [
  'Hold Void-Nexus points: each one pours 25 Scrip per second into your coffers.',
  'Order squads to Hold (H) near ruins or cliff edges — cover halves incoming damage.',
  'Cliffs block line of sight. Flank around them.',
  'Reinforce (R) battered squads instead of training new ones.',
  'Press B to select your Command Bastion and open the build menu.',
];

/** Loading screen: generates every procedural texture step by step with a progress bar. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add.text(cx, cy - 110, 'VOIDCRUSADE', { fontFamily: GOTHIC_FONT, fontSize: '64px', color: '#c8a060' }).setOrigin(0.5);
    const label = this.add.text(cx, cy + 40, '', textStyle(16, '#aab')).setOrigin(0.5);
    this.add.text(cx, cy + 120, Phaser.Utils.Array.GetRandom(TIPS) as string, { ...textStyle(15, '#778'), fontStyle: 'italic' }).setOrigin(0.5);
    const w = 520;
    const frame = this.add.graphics();
    frame.lineStyle(2, 0x5a5a7a, 1).strokeRect(cx - w / 2 - 4, cy - 14, w + 8, 28);
    const bar = this.add.graphics();

    const steps: [string, () => void][] = [
      ['Surveying terrain', () => createTileTextures(this)],
      ['Forging icons', () => {
        createUITextures(this);
        createHudArt(this);
        createGlyphIcons(this);
        createPlanetArt(this);
      }],
      ['Raising fortifications', () => {
        createBuildingTextures(this);
        createBuildingIcons(this, 0.65);
        Projection.setTilt(Settings.get().tilt);
        ensureBuildingArt(this, Projection.tilt);
      }],
      ['Mustering the Iron Void', () => createUnitTextures(this)],
      ['Breeding the Null Horde', () => createUnitAtlases(this)],
      ['Distilling blood and fire', () => createFxTextures(this)],
      ['Charging Void-Nexus obelisks', () => {
        createCaptureTextures(this);
        createCaptureArt(this);
      }],
      ['Scattering the debris of war', () => createPropTextures(this)],
      ['Charting battlefields', () => MAP_BUILDERS.forEach((b) => b())],
      ['Calibrating targeting reticles', () => getCursors()],
    ];
    let i = 0;
    const next = (): void => {
      if (i >= steps.length) {
        label.setText('Ready');
        this.time.delayedCall(250, () => this.scene.start('MenuScene'));
        return;
      }
      const [text, fn] = steps[i];
      label.setText(`${text}…`);
      fn();
      i++;
      bar.clear().fillStyle(0xb08830, 1).fillRect(cx - w / 2, cy - 10, (w * i) / steps.length, 20);
      bar.fillStyle(0xffe0a0, 0.5).fillRect(cx - w / 2, cy - 10, (w * i) / steps.length, 4);
      this.time.delayedCall(70, next);
    };
    next();
  }
}
