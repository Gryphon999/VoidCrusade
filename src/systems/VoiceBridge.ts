import Phaser from 'phaser';
import { EV } from '../events';
import { MessageKey, dyn } from '../i18n';
import { Voice, Speaker } from './VoiceSystem';
import { Squad } from '../units/Squad';
import { UnitId } from '../units/UnitDefs';
import { Building } from '../buildings/Building';
import { Unit } from '../units/Unit';
import { CapturePoint } from './CapturePoint';
import { BattleResult } from '../scenes/BattleTypes';
import { Owner } from '../types';
import { Settings } from './Settings';
import type { BattleScene } from '../scenes/BattleScene';

const SPEAKERS: Partial<Record<UnitId, Speaker>> = {
  commander: 'commander', heavy: 'heavy', ranger: 'ranger', breacher: 'breacher', marksman: 'marksman', engineer: 'engineer',
  buggy: 'crew', apc: 'crew', tank: 'crew', artillery: 'crew',
};

export function speakerFor(s: Squad): Speaker {
  return SPEAKERS[s.def.id] ?? 'rifleman';
}

/** Hooks battle events to voice lines (announcer alerts and squad acknowledgements). */
export class VoiceBridge {
  private lastAlarm = -1e9;

  constructor(private battle: BattleScene) {
    const ev = battle.events;
    ev.on(EV.squadDestroyed, (s: Squad) => s.owner === 'player' && Voice.say('vo.squadLost', 'announcer', 'alert'));
    ev.on(EV.pointCaptured, (_p: CapturePoint, owner: Owner, old: Owner | null) => {
      if (owner === 'player') Voice.say('vo.captured', 'announcer', 'event');
      else if (old === 'player') Voice.say('vo.pointLost', 'announcer', 'alert');
    });
    ev.on(EV.buildingComplete, (b: Building) => b.owner === 'player' && Voice.say('vo.buildDone', 'announcer', 'event'));
    ev.on(EV.unitHit, (_x: number, _y: number, u: Unit) => u.owner === 'player' && this.alarm());
    ev.on(EV.buildingDamaged, (b: Building) => b.owner === 'player' && this.alarm());
    ev.on(EV.message, (key: MessageKey) => {
      if (key === 'err.resources') Voice.say('vo.noResources', 'announcer', 'event');
      else if (key === 'err.squadCap' || key === 'err.supply') Voice.say('vo.squadCap', 'announcer', 'event');
      else if (key === 'note.reinforced') Voice.say('vo.reinforced', 'announcer', 'event', true);
    });
    ev.on(EV.tierUp, (o: Owner) => o === 'player' && Voice.say('vo.tierUp', 'announcer', 'event'));
    ev.on(EV.battleEnded, (r: BattleResult) => {
      Voice.stop();
      Voice.say(r.winner === 'player' ? 'vo.victory' : 'vo.defeat', 'commander', 'alert');
    });
    battle.time.delayedCall(1500, () => Voice.say('vo.battleStart', 'commander', 'event'));
    battle.events.once(Phaser.Scenes.Events.SHUTDOWN, () => Voice.stop());
  }

  private alarm(): void {
    const now = this.battle.time.now;
    if (now - this.lastAlarm < 20000) return;
    this.lastAlarm = now;
    Voice.say('vo.underAttack', 'announcer', 'alert');
  }

  static repair(s: Squad): boolean {
    if (!Settings.get().voiceEnabled || !Voice.hasVoice()) return false;
    return Voice.say('vo.repair', speakerFor(s), 'ack', false);
  }

  static retreat(s: Squad): void {
    Voice.say('vo.retreat', speakerFor(s), 'ack', true);
  }

  /** Squad acknowledgement: select / move / attack / capture. Returns true if a line was spoken. */
  static acknowledge(s: Squad, kind: 'select' | 'move' | 'attack' | 'capture'): boolean {
    if (!Settings.get().voiceEnabled || !Voice.hasVoice()) return false;
    const key = kind === 'select' ? dyn(`vo.select.${s.def.id}`) : kind === 'attack' ? 'vo.attack' : kind === 'capture' ? 'vo.capture' : 'vo.move';
    return Voice.say(key, speakerFor(s), 'ack', false);
  }
}
