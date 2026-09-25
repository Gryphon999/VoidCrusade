import Phaser from 'phaser';
import { EV } from '../events';
import { AudioSystem } from './AudioSystem';
import { Ambience } from './Ambience';
import { Building } from '../buildings/Building';
import { CapturePoint } from './CapturePoint';
import { Owner } from '../types';
import type { BattleScene } from '../scenes/BattleScene';

/** Connects battle events to procedural sounds, with distance attenuation and stereo panning. */
export class AudioBridge {
  constructor(private battle: BattleScene) {
    const ev = battle.events;
    ev.on(EV.unitFired, (x: number, y: number, kind: string) => this.shot(x, y, kind));
    ev.on(EV.unitDied, (x: number, y: number) => this.spatial(x, y, (v, p) => AudioSystem.unitDeath(v, p)));
    ev.on(EV.buildingDestroyed, (b: Building) => this.spatial(b.x, b.y, (v, p) => AudioSystem.explosion(v, p), 2600));
    ev.on(EV.buildingComplete, (b: Building) => {
      if (b.owner === 'player') AudioSystem.buildingComplete();
    });
    ev.on(EV.pointCaptured, (_p: CapturePoint, owner: Owner) => AudioSystem.captureChime(owner));
    Ambience.battle();
    battle.events.once(Phaser.Scenes.Events.SHUTDOWN, () => Ambience.stopBattle());
  }

  private spatial(x: number, y: number, play: (vol: number, pan: number) => void, range = 1500): void {
    const cam = this.battle.cameras.main;
    const v = this.battle.cameraSystem.visibleWorldRect();
    const cx = v.centerX;
    const cy = v.centerY;
    const d = Phaser.Math.Distance.Between(x, y, cx, cy);
    const vol = Phaser.Math.Clamp(1 - d / range, 0, 1) * Phaser.Math.Clamp(cam.zoom, 0.6, 1.2);
    if (vol < 0.05) return;
    play(vol, Phaser.Math.Clamp((x - cx) / (v.width / 2), -1, 1) * 0.7);
  }

  private shot(x: number, y: number, kind: string): void {
    this.spatial(x, y, (v, p) => {
      if (kind === 'bullet') AudioSystem.rifleShot(v, p);
      else if (kind === 'shell') AudioSystem.heavyShot(v, p);
      else if (kind === 'melee') AudioSystem.melee(v, p);
      else AudioSystem.spit(v, p);
    });
  }

  update(): void {
    Ambience.setCapturing(!this.battle.ended && this.battle.capture.playerCapturing());
  }
}
