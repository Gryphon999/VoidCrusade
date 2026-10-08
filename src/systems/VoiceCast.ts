import { UNIT_DEFS, UnitId } from '../units/UnitDefs';

/** Who is speaking. Every speaker is a separate recorded "actor". */
export type Speaker = 'rifleman' | 'heavy' | 'commander' | 'announcer' | 'ranger' | 'breacher' | 'marksman' | 'engineer' | 'crew';

export type VoiceLang = 'en' | 'ru';

const UNIT_SPEAKERS: Partial<Record<UnitId, Speaker>> = {
  commander: 'commander', heavy: 'heavy', ranger: 'ranger', breacher: 'breacher', marksman: 'marksman', engineer: 'engineer',
  buggy: 'crew', apc: 'crew', tank: 'crew', artillery: 'crew',
};

/** Abilities whose use gets a battle cry. */
export const SHOUTS = ['frag', 'smoke', 'rally', 'barrage', 'sprint', 'smite', 'overcharge'];

/** Acknowledgements any squad can give. */
const SQUAD_LINES = ['vo.move', 'vo.attack', 'vo.capture', 'vo.retreat', 'vo.repair', 'vo.broken', 'vo.underFire', 'vo.manDown', 'vo.enemyDown'];
/** Lines spoken by the Commander rather than the announcer. */
const COMMANDER_LINES = ['vo.battleStart', 'vo.victory', 'vo.defeat', 'vo.territory', 'vo.test'];

export function speakerOfUnit(id: UnitId): Speaker {
  return UNIT_SPEAKERS[id] ?? 'rifleman';
}

const playerUnits = (): UnitId[] => (Object.keys(UNIT_DEFS) as UnitId[]).filter((id) => UNIT_DEFS[id].faction === 'ironvoid');
const unique = (list: Speaker[]): Speaker[] => [...new Set(list)];

/** True for keys that are voice lines (battle lines and the tutorial narration). */
export function isVoiceKey(key: string): boolean {
  return key.startsWith('vo.') || /^tut\..+\.vo$/.test(key);
}

/** Every speaker that can say this line in the game; recordings are made for exactly these. */
export function speakersFor(key: string): Speaker[] {
  if (key.startsWith('vo.select.')) return [speakerOfUnit(key.slice('vo.select.'.length) as UnitId)];
  if (key.startsWith('vo.ab.')) {
    const ability = key.slice('vo.ab.'.length);
    return unique(playerUnits().filter((id) => (UNIT_DEFS[id].abilities as string[] | undefined)?.includes(ability)).map(speakerOfUnit));
  }
  if (SQUAD_LINES.includes(key)) return unique(playerUnits().map(speakerOfUnit));
  if (COMMANDER_LINES.includes(key) || key.startsWith('tut.')) return ['commander'];
  return ['announcer'];
}

/** FNV-1a hash of a line's text: a recording is only used while the text it was made from is unchanged. */
export function voiceHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Path of a recording, relative to the site root. */
export function voiceFile(lang: VoiceLang, speaker: Speaker, key: string, variant: number): string {
  return `voice/${lang}/${speaker}/${key}.${variant}.mp3`;
}

/** Manifest entry id: one per (speaker, line); its value lists the text hash of every variant. */
export function voiceId(speaker: Speaker, key: string): string {
  return `${speaker}/${key}`;
}

/** `voice/manifest.json`: for each language, the recorded lines and the hashes of their variants. */
export type VoiceManifest = Record<VoiceLang, Record<string, string[]>>;
