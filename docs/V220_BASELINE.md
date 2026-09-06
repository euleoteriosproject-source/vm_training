# VM Training v2.2.0 — Baseline

Captured read-only on 2026-09-06 before implementation.

## Source and validation baseline

- Branch: `main`
- Commit: `d6d7a216e636ee97d9a80ab0e663b1e18f196c6a`
- Generator: `v2.1.5`
- Unit tests: 104/104
- Lint: PASS
- Typecheck: PASS
- Production migrations: local and remote aligned through `20260902193000`

## Production catalog

- Active exercises: 60
- Media-ready exercises: 36
- Eligible exercises for the admin profile: 31
- Incomplete v2.1.5 metadata: 0
- Storage bucket `exercise-media`: private

## Admin profile and active plan

- Primary goal: `posture`
- Frequency: 3 sessions/week
- Duration: 60 minutes
- Gym profile: `STANDARD_COMMERCIAL_GYM`
- Style: `gym_first`
- Experience: `returning`
- Active plan generator: `v2.1.5`
- Active plan: 18 slots, 15 unique exercises, 100% media coverage
- Equipment distribution: 55.6% gym / 44.4% bodyweight; this is a posture plan, so the muscle-gain gym hard gate does not apply.

## Production integrity counts

- Auth users: 2
- Profiles: 2
- Active plans: 2
- Archived plans: 21
- Draft plans: 1
- Workout sessions: 4
- Completed sessions: 1
- In-progress sessions: 2
- Body measurements: 2
- Substitution events: 0

No Production plan was generated, activated, archived, or modified while collecting this baseline.
