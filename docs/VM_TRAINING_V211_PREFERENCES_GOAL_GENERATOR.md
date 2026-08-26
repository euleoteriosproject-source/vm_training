# VM Training v2.1.1 — Preferences & Goal Generator

## Scope

The default preferences and onboarding experience no longer asks users to
inventory individual gym machines. The application assumes
`STANDARD_COMMERCIAL_GYM` and keeps the existing equipment tables for
substitutions, historical compatibility, coarse presets, and permanent user
exceptions.

The primary generator context is centralized on the server and includes the
goal, experience, weekly frequency, session duration, cardio preference, gym
capabilities, movement attention, recent exercise history, and explicit
equipment exceptions.

## Plan lifecycle

Saving preferences is atomic and does not modify the active plan. A meaningful
change exposes `Atualizar meu treino`, which creates a validated v2.1.1 draft.
The previous plan is archived only after the user explicitly confirms the
preview. Workout sessions, loads, repetitions, body data, and prior plan
history are preserved.

The activation gate recalculates media readiness, equipment compatibility,
eligibility, diversity for the standard 3-day plan, and actual goal alignment.
It does not infer alignment from the stored goal label.

## Database

Migration:
`20260826130800_v211_preferences_goal_generator.sql`

The migration is additive and includes:

- `training_preferences.gym_profile` with a non-destructive existing-user
  backfill;
- `workout_plans.goal_code`;
- capability mappings and coarse gym presets with RLS and least-privilege
  grants;
- an atomic preferences RPC;
- a server-validated preview RPC;
- an ownership-checked activation RPC;
- goal-alignment validation based on generated workout characteristics.

No equipment rows, workout history, plans, sessions, performance, or body data
are deleted.

## Verification baseline

- Clean local migration reset: PASS.
- Lint: PASS.
- Typecheck: PASS.
- Unit/component tests: 85/85 PASS.
- pgTAP: 185/185 PASS.
- E2E: 39/39 PASS across mobile Chromium, mobile WebKit, and desktop Chrome.
- Production build and media preflight: PASS.
- Active-plan media preflight: 14/14.
- Trackable-file secret format scan: 0 findings.

## Production database promotion

- Hosted project: `inghftngeritrsezwxnm`.
- Dry-run: exactly one pending migration, no seed or role writes.
- Applied migration: `20260826130800_v211_preferences_goal_generator.sql`.
- Local/remote migration history: reconciled.
- Users/profiles/preferences: 1/1/1, preserved.
- Plans/active plans/workout sessions: 4/1/2, preserved.
- Active/media-ready/eligible exercise catalog: 60/36/36.
- Capability mappings/preset entries: 23/25.
- Authenticated v2.1.1 RPCs: 3.
- Production reset: not performed.

The local E2E bootstrap creates disposable, synthetic media fixtures for a
diverse 18-exercise catalog. It is guarded to local Supabase and never writes
those fixtures to Hosted Production.

## Cost

Additional monthly cost: `R$ 0`.
