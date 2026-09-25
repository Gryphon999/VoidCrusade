/** Scene-level event names emitted on BattleScene.events. */
export const EV = {
  buildingPlaced: 'building-placed',
  buildingComplete: 'building-complete',
  buildingDestroyed: 'building-destroyed',
  buildingDamaged: 'building-damaged',
  unitDied: 'unit-died',
  unitHit: 'unit-hit',
  unitFired: 'unit-fired',
  squadSpawned: 'squad-spawned',
  squadDestroyed: 'squad-destroyed',
  selectionChanged: 'selection-changed',
  pointCaptured: 'point-captured',
  capturing: 'capturing',
  battleEnded: 'battle-ended',
  researchDone: 'research-done',
  message: 'hud-message',
} as const;
