import Phaser from 'phaser';
import { EV } from '../events';
import { AudioSystem } from './AudioSystem';
import { Ambience } from './Ambience';
import { Building } from '../buildings/Building';
import { CapturePoint } from './CapturePoint';
import { Owner } from '../types';
import type { BattleScene } from '../scenes/BattleScene';
import { Music } from './Music';
import { BattleResult } from '../scenes/BattleTypes';

/** Connects battle events to procedural sounds, with distance attenuation and stereo panning. */
export class AudioBridge {
  /** Timestamps (ms) of recent shots, for the combat-music intensity. */
  private shots: number[] = [];
  private tick = 0;

  constructor(private battle: BattleScene) {
    const ev = battle.events;
    ev.on(EV.unitFired, (x: number, y: number, kind: string) => {
      this.shots.push(battle.time.now);
      this.shot(x, y, kind);
    });
    ev.on(EV.battleEnded, (r: BattleResult) => Music.stinger(r.winner === 'player'));
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

  update(dt = 0): void {
    Ambience.setCapturing(!this.battle.ended && this.battle.capture.playerCapturing());
    this.tick -= dt;
    if (this.tick > 0 || this.battle.ended) return;
    this.tick = 0.35;
    // Combat intensity from the last 4 s of gunfire; Horde layer swells when the AI rushes.
    const now = this.battle.time.now;
    while (this.shots.length && now - this.shots[0] > 4000) this.shots.shift();
    Music.setIntensity(this.shots.length / 30, this.battle.ai.rushing ? 1 : 0);
    const view = this.battle.cameraSystem.visibleWorldRect();
    // Footfalls of heavy units and clanks from construction sites on screen.
    for (const sq of this.battle.units.squads) {
      if (sq.def.id !== 'heavy' && sq.def.id !== 'commander' && sq.def.id !== 'behemoth') continue;
      const u = sq.units.find((q) => Math.hypot(q.vx, q.vy) > 12 && view.contains(q.x, q.y) && q.isShown);
      if (u) {
        this.spatial(u.x, u.y, (v, p) => AudioSystem.footstep(v, p, sq.def.id === 'behemoth'));
        break;
      }
    }
    const site = this.battle.buildings.buildings.find((b) => b.state === 'constructing' && view.contains(b.x, b.y));
    if (site) this.spatial(site.x, site.y, (v, p) => AudioSystem.clank(v, p));
  }
}
