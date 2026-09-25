/** AI personalities for skirmish (shown in the setup screen). */
export type Personality = 'rusher' | 'turtler' | 'balanced';
export const PERSONALITIES: Personality[] = ['rusher', 'turtler', 'balanced'];

export function pickPersonality(requested?: string): Personality {
  if (requested && (PERSONALITIES as string[]).includes(requested)) return requested as Personality;
  return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
}
