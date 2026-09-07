# VM Training v2.2.1 — Programming-quality baseline

Read-only comparison captured on 2026-09-06 for the Production admin profile. No plan was persisted, archived or activated during either preview.

## Input held constant

- Goal: `posture`
- Frequency: 3 sessions/week
- Duration: 60 minutes
- Experience: returning
- Environment: `STANDARD_COMMERCIAL_GYM`
- Style: `gym_first`
- Catalog: Production, with 100% metadata completeness for active candidates

## Before: v2.2.0 behavior

- 18 selected slots, 15 unique exercises
- 3 corrective slots selected automatically
- 2 bodyweight/floor slots
- 10 machine/cable slots and 6 free-weight slots
- `Superman` appeared as a floor-based secondary pull despite valid commercial-gym alternatives
- The fixed sixth slot was retained on every day, independently of incremental programming value
- Media coverage: 100%

## After: v2.2.1 read-only preview

- 17 selected slots, 15 unique exercises
- Session shape: 6 / 5 / 6 exercises
- 1 optional low-value slot pruned
- 0 filler slots and 0 unjustified corrective slots
- 2 justified mobility/corrective slots; neither displaced an exact-pattern commercial-gym alternative
- 8 machine/cable slots, 7 free-weight slots and 2 floor mobility slots
- 9 movement patterns; maximum exact-exercise frequency of 2
- Estimated programming time: 43 / 38 / 43 minutes
- Goal alignment, functional coverage, weekly balance, ordering, session efficiency, environment fit and overall program quality: `PASS`
- Media coverage: 100%

The v2.2.1 result remains resistance-based for posture: 15 of 17 slots are resistance exercises. Pulling, posterior-chain and trunk functions provide structural coverage; the two mobility slots remain only because the weekly mobility need is not yet covered, while the redundant scapular-control slot is pruned.

Human UAT remains mandatory before the final release gate can be declared complete.
