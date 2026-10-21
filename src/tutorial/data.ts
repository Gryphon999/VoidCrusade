/** Data shared by the tutorial, the hints and the encyclopedia (kept Phaser-free for scripts). */
export const TUTORIAL_STEP_IDS = [
  'camera', 'select', 'group', 'capture', 'conduit', 'barracks', 'train', 'cover', 'retreat', 'ability', 'defense', 'vehicle', 'assault',
] as const;
export type TutorialStepId = (typeof TUTORIAL_STEP_IDS)[number];

/**
 * Two short lessons instead of one long one (VK moderation: learn by playing, easy first levels).
 * Lesson 1 — fighting with the squads you have; lesson 2 — the base, new troops and the assault.
 */
export const TUTORIAL_LESSONS: Record<1 | 2, readonly TutorialStepId[]> = {
  1: ['camera', 'select', 'capture', 'cover', 'retreat', 'ability'],
  2: ['conduit', 'barracks', 'train', 'group', 'defense', 'vehicle', 'assault'],
};
export type TutorialLesson = keyof typeof TUTORIAL_LESSONS;

export const MECHANICS = [
  'controls', 'tiers', 'supply', 'damage', 'stances', 'groups', 'cover', 'suppression', 'morale', 'veterancy',
  'garrison', 'points', 'abilities', 'research', 'wargear', 'drops', 'vehicles', 'stealth', 'events', 'modes', 'terrain',
] as const;

export const HINT_IDS = [
  'suppression', 'broken', 'vehicle', 'supply', 'power', 'burrowed', 'wreck', 'tier', 'rank', 'garrison', 'drop', 'storm', 'lava',
] as const;
export type HintId = (typeof HINT_IDS)[number];

export const ENC_TRAITS = [
  'capture', 'detector', 'cover', 'precision', 'repair', 'leap', 'burrow', 'aura', 'transport', 'crush', 'indirect', 'deploy', 'flying', 'regen', 'limit', 'nocapture',
] as const;
