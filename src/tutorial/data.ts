/** Data shared by the tutorial, the hints and the encyclopedia (kept Phaser-free for scripts). */
export const TUTORIAL_STEP_IDS = [
  'camera', 'select', 'group', 'capture', 'conduit', 'barracks', 'train', 'cover', 'retreat', 'ability', 'defense', 'vehicle', 'assault',
] as const;

export const MECHANICS = [
  'controls', 'tiers', 'supply', 'damage', 'stances', 'groups', 'cover', 'suppression', 'morale', 'veterancy',
  'garrison', 'points', 'abilities', 'research', 'wargear', 'drops', 'vehicles', 'stealth', 'events', 'modes',
] as const;

export const HINT_IDS = [
  'suppression', 'broken', 'vehicle', 'supply', 'power', 'burrowed', 'wreck', 'tier', 'rank', 'garrison', 'drop', 'storm',
] as const;
export type HintId = (typeof HINT_IDS)[number];

export const ENC_TRAITS = [
  'capture', 'detector', 'cover', 'precision', 'repair', 'leap', 'burrow', 'aura', 'transport', 'crush', 'indirect', 'deploy', 'flying', 'regen', 'limit', 'nocapture',
] as const;
