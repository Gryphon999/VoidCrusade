# New modes and records (stage D) — design

Date: 2026-10-07. Agreed direction: Survival with a record and a table (good for Yandex Games
retention), King of the Hill; co-op deferred (no backend).

## Survival with records

- Survival becomes **endless**: waves keep coming and growing; wave 15 is a milestone ("the Horde's
  first tide is broken") but not the end. Score = waves survived × 100 + kills × 5 (unchanged).
- **Records** (`src/battle/Records.ts`, pure, injectable storage): a top-10 table per map,
  difficulty and modifier set, kept in `localStorage` (`voidcrusade.records.v1`). An entry holds score,
  waves, time, modifiers and the date. `addRecord` returns the rank (1-based) or null.
- The end screen shows "New record — #n" when the run enters the table and the top five of that
  table under the stats. A **Records** button in the main menu opens a panel listing, per map and
  difficulty, the best entries.
- Yandex Games: when `window.ysdk` is present the score is also sent to a leaderboard named
  `survival` (best effort, errors ignored). Nothing else changes for the web build.

## King of the Hill (`koth`)

- Both sides have bases and play normally. The centre point is **the hill**: whoever owns it scores
  `KOTH_RATE` = 1 point per second; the first side to `KOTH_GOAL` = 300 wins. A neutral hill scores
  for nobody. Destroying the enemy headquarters still wins as usual.
- HUD: "Hill: you 120 · Horde 85 → 300" and who holds it; end screen line on a win.
- Rules in `src/battle/Objectives.ts` (`kothStep`), wiring in `VictorySystem`.

## Testing

`tests/records.test.ts`: table sorting, cap at ten, rank, key by map/difficulty/modifiers, storage
round-trip with a fake storage. `tests/objectives.test.ts`: `kothStep` scores only the owner, reaches
the goal, neutral scores nobody. Localisation of the new mode.

## Out of scope

Co-op (needs a backend), global leaderboards outside Yandex, replays.
