# Mission objectives (stage A3) — design

Date: 2026-10-07. The owner picked "A, C, D" from the proposed objectives: hold a position, destroy
the nests, evacuation.

## Goal

Three new skirmish victory conditions next to Annihilation, Control and Survival. Each changes what
the player is doing for the whole battle, not just how it ends. The rules live in a pure module
(`src/battle/Objectives.ts`: constants and small step functions) so they are unit-tested in Node;
`VictorySystem` wires them to the battle.

## Modes

### Hold the Line (`hold`)
- The map's centre point (`capture.points[0]`, the relic) is **the position**. The Horde has its base
  and plays normally.
- A hold meter fills while the player owns the point (`HOLD_TIME` = 240 s of ownership in all) and
  **drains twice as fast** while the Horde owns it; a neutral point freezes it. Victory when full.
- Defeat as usual: the player's headquarters falls. The HUD shows the meter as a countdown and who
  holds the position.

### Burn the Nests (`nests`)
- No Horde base and no Horde AI. `NEST_COUNT` = 4 **Brood Nests** stand on the four capture points
  nearest the Horde's corner (never the centre), with `NEST_HP` = 2000 and no production queue.
- Every `NEST_SPAWN_EVERY` = 40 s each living nest spawns a squad from a pool that grows with time
  (crawlers and spitters; leapers and shamans after 3 min; behemoths and burrowers after 6 min), set
  aggressive and sent at the player's headquarters. The first spawn comes after a 60 s grace.
- Victory when every nest is destroyed. Defeat when the headquarters falls or the clock reaches
  `NEST_TIME_LIMIT` = 15:00 (the HUD counts down). Each nest's fall is announced.

### Evacuation (`evac`)
- The Horde has its base and plays normally. Phase 1: **hold out** until the transport arrives at
  `EVAC_ARRIVAL` = 300 s. Phase 2: the **landing zone** is the centre point; bring the Commander and
  at least `EVAC_SQUADS` = 3 other squads (any non-hero squads, vehicles included) inside
  `EVAC_ZONE` = 190 px of it and keep them there for `EVAC_LOAD` = 10 s (the meter drains when the
  condition breaks). Victory when loaded.
- **Defeat the moment the Commander dies**, in either phase (he can normally be re-trained; here the
  mission is about him), or when the headquarters falls.
- The landing zone pulses on arrival; the HUD shows the phase, the countdown and the loading meter.

## Wiring

- `WinMode` gains the three ids; `WIN_MODES` is the single list used by the skirmish setup and the
  localisation check.
- `VictorySystem`: `noEnemyBase` (survival, nests) replaces the survival-only branch in
  `BattleScene`; `start()` runs after the headquarters and the AI exist to place nests. Survival score
  is unchanged.
- HUD `objectiveText` and the end screen get a line per mode; `enc.m.modes` and the README mention
  the new modes.

## Testing

`tests/objectives.test.ts`: hold meter fills, drains and freezes; nest pool grows with time and the
nest points are the four nearest the Horde corner excluding the centre; evacuation loading fills,
drains and completes; constants are sane. The existing suites stay green; a headless AI-vs-AI run
(`simulate --mode`) is not available, so the three modes are smoke-tested in a headless battle by
starting each and stepping the simulation (no errors).

## Out of scope

Campaign use of the modes, scripted events inside missions, new units or buildings.
