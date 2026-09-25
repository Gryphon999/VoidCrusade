# Balance notes

Numbers in this file come from `npm run simulate` (`scripts/simulate.ts`): headless AI-vs-AI
matches, Iron Void AI (player side) against Null Horde AI (enemy side), Hard vs Hard, on all three
maps, cycling both personalities, seed 1, a 15-minute cap (a match still running then counts as a
draw). `Math.random` is seeded and the game is stepped at a fixed 20 Hz, so the same seed replays
the same matches. The raw per-match data of the final run is in `docs/balance-sim.json`.

`dmg/100` is damage dealt per 100 resources (Scrip + Flux) spent training that unit type. It
ignores healing, auras, capture and detection, so support units (Brood-shamans, engineers,
transports) look worse than they are.

## Reproduce

```
npm run simulate -- --matches=9 --max=900 --parallel=3 --seed=1
npm run simulate -- --diff=easy --pdiff=hard     # difficulty spread
```

## Tuning history

| Run | Change | Iron Void wins | Horde wins | Draws | Points held (IV / Horde) |
|---|---|---|---|---|---|
| 0 | C6 AI, C1–C4 numbers (3 matches) | 0 | 3 | 0 | 1.07 / 3.13 |
| 1 | Crawler dmg 10→8, cost 70→75; Spitter dmg 15→13, range 240→230; Breacher hp 100→115, range 95→120; Iron Guard range 150→180 | 0 | 5 | 4 | 1.18 / 2.87 |
| 2 | Spitter dmg 12, cost 90; Rifleman hp 80→90; Buggy dmg 13→16; APC hp 750→850, dmg 10→14; Tank reload 3.0→2.6 s | 1 | 5 | 3 | 1.19 / 2.89 |
| 3 | Breacher supply 3→2, speed 84→92; Rifleman speed 90→100; Crawler dmg 8→7 | 0 | 3 | 6 | 1.28 / 2.96 |
| 4 | AI counter-picks weigh cost; at most one support-aura squad | 1 | 3 | 5 | 1.38 / 2.89 |
| 5 | Spitter range 220; Leaper cost 100→110; AI keeps one transport | 1 | 3 | 5 | 1.54 / 2.78 |
| 6 | Turtler opening builds an army before towers | 1 | 2 | 6 | 1.60 / 2.79 |

## Final run (run 6)

- Iron Void 1 win, Null Horde 2 wins, 6 draws; decided games last 4½ minutes on average.
- Horde personality vs balanced Iron Void: 0/3 Horde wins; vs rusher 1/3; vs turtler 1/3.

```
unit          trained   spent   damage   kills   dmg/100
spitter           213   23430   206437     917       881
leaper            192   24960    92914     598       372
crawler           183   13725   190841     989      1390
breacher          153   22950   284759    2945      1241
shaman            134   20100    14333      48        71
heavy              79   12640    55868     494       442
ranger             71    7100    12675      86       179
marksman           56    8400    39754     509       473
rifleman           47    3760   119067     803      3167
behemoth           41    9020    33768     207       374
skimmer            38    6460    39711     143       615
overlord           35       0    47707     227         0
engineer           33    2310     2849      22       123
apc                19    4560     8308      37       182
commander          17       0    31212     233         0
burrower           15    2700     8498      64       315
buggy              14    2520     6116      40       243
carrier             9    2070      676       5        33
```

## Reasoning

- **Supply is the real currency.** Capture income (25 Scrip/s per point) is large, so both AIs sit
  at the 40-supply cap after two to three minutes; fights are decided by value per supply, not per
  Scrip. That is why Breachers dropped to 2 supply and why speed buffs mattered more than cost cuts.
- **Crawlers were strictly better than Riflemen** (same health pool, more damage, faster, cheaper)
  and returned 5 200 damage per 100 resources in run 0. Now Riflemen are the most cost-efficient
  unit (they are cheap line troops by design) and Crawlers stay the Horde's efficient swarm unit.
- **Spitters out-ranged everything at Tier 1.** They still have the longest Tier 1 reach (220 vs
  Rifleman 200), which is the Horde's identity, but trade less efficiently.
- **The counter table works:** Breachers (flame) are picked against the Horde's light infantry and
  top the kill column; acid melts Iron Void vehicles, so the AI keeps vehicles to a minority.
- **Map control is the remaining gap.** The Horde still holds about 1.2 more points on average: its
  squads are faster and more numerous per supply. It shows up as draws rather than losses: both
  bases hold behind towers, regenerating Horde structures and the shield. The next levers, if
  playtests agree, are Horde building regeneration and Spore Node strength.
- **AI difficulty spread** (6 matches each, Iron Void AI on Hard, same seed):

  | Horde difficulty | Iron Void wins | Horde wins | Draws | Decided games |
  |---|---|---|---|---|
  | Easy | 3 | 2 | 1 | 7 min 16 s |
  | Hard | 1 of 9 | 2 of 9 | 6 of 9 | 4 min 24 s |
  | Brutal | 0 | 3 | 3 | 3 min 44 s |

  Skill, not income, separates the levels: Easy thinks every 2.5 s, queues one unit at a time,
  never retreats or counter-picks; Brutal thinks every 0.6 s, keeps four-deep queues, scouts,
  harasses and drops. Even Easy Horde still holds more points than Hard Iron Void, which is the
  same map-control gap described above.

## Tests

- `npm test`: damage table sanity, production queue (limit 5, refunds, tier locks, money),
  supply cap including queued units and the hard maximum, pathing clearance (infantry through
  one-tile gaps, vehicles need two, no crossing sealed walls).
- `npm run check:i18n`: every key used in code exists in English and Russian.
- `npm run check:assets`: every unit, building, ability and research has art, sounds and (for
  the player faction) voice lines.
