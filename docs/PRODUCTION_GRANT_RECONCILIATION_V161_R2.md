# VM Training Production Grant Reconciliation v1.6.1-R2

Date: 2026-08-20

Production project: `vm-training-prod` (`inghftngeritrsezwxnm`)

Mode: analysis and local simulation; **zero Production writes**

## Root cause

The drift is systematic. For the three Data API roles, Production has all seven
table privileges on every application table:

- 22 tables
- `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, `UPDATE`
- `anon`, `authenticated`, `service_role`
- `22 × 7 × 3 = 462` grants

There is one separate, legitimate grant:
`supabase_auth_admin SELECT public.allowed_signup_emails`. The complete matrix
therefore contains 463 table grants.

The local reset has 272 grants for the three Data API roles and the same Auth
Hook grant, for 273 total. The exact raw diff is 190 Production-only grants.

The Hosted `postgres/public` default ACL grants all table privileges, all
sequence privileges, and function `EXECUTE` to each Data API role. Reproducing
those defaults and existing table grants locally produced an exact match:

| Object class       | Hosted simulation | Production | Difference |
| ------------------ | ----------------: | ---------: | ---------: |
| Table grants       |               463 |        463 |          0 |
| Sequence grants    |                 0 |          0 |          0 |
| Schema grants      |                 5 |          5 |          0 |
| Default privileges |                72 |         72 |          0 |

The two additional local function grants and one additional local function are
the expected GIF-first migration `20260820154916`, which is not yet installed
in Production.

RLS is not the cause and does not compensate for the ACL. RLS filters rows only
after PostgreSQL allows the operation. The [Supabase Data API security guide](https://supabase.com/docs/guides/api/securing-your-api)
documents this separation. Supabase has also documented the transition from
automatic Data API grants to explicit opt-in grants for new objects in its
[2026 platform changelog](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

## Local ACL model

The raw local reset is narrower than Hosted but is not a safe canonical target.
It inherits `REFERENCES`, `TRIGGER`, and `TRUNCATE` on all 22 tables for
`anon`, `authenticated`, and `service_role`. This accounts for 198 unnecessary
grants locally. The proposed canonical matrix removes those inherited grants
and derives the remaining operations from application calls, RPCs, RLS, media
jobs, and release reporting.

Exact artifacts:

- `data/security/grant-matrix-local.json`: reset baseline, before simulation
- `data/security/grant-matrix-production.json`: read-only Hosted capture
- `data/security/grant-matrix-local-hosted-simulation.json`: reproduced drift
- `data/security/grant-matrix-proposed-v161-r2.json`: proposed canonical result
- `data/security/grant-diff-v161-r2.json`: raw and proposed exact diffs

## Tables

Every Production table has RLS enabled. `P` below means the current Production
set `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` for each of
the three Data API roles. The JSON artifact contains the unabridged per-role
arrays, including matching, extra, and missing entries.

| Table                       | Intent      | anon canonical | authenticated canonical        | service_role canonical           | Other                        |
| --------------------------- | ----------- | -------------- | ------------------------------ | -------------------------------- | ---------------------------- |
| `allowed_signup_emails`     | ADMIN_ONLY  | none           | SELECT, INSERT, UPDATE         | SELECT                           | Auth Hook SELECT             |
| `profiles`                  | USER_OWNED  | none           | SELECT, UPDATE                 | SELECT                           | —                            |
| `equipment`                 | GLOBAL_READ | none           | SELECT, INSERT, UPDATE         | SELECT                           | writes limited by admin RLS  |
| `exercises`                 | GLOBAL_READ | none           | SELECT, INSERT, UPDATE         | SELECT + `UPDATE(active)` column | writes limited by admin RLS  |
| `exercise_equipment`        | GLOBAL_READ | none           | SELECT                         | SELECT                           | —                            |
| `exercise_media`            | GLOBAL_READ | none           | SELECT                         | SELECT, INSERT, UPDATE, DELETE   | approval remains server-only |
| `exercise_substitutions`    | GLOBAL_READ | none           | SELECT                         | none                             | —                            |
| `training_preferences`      | USER_OWNED  | none           | SELECT, INSERT, UPDATE, DELETE | none                             | own-row RLS                  |
| `user_goals`                | USER_OWNED  | none           | SELECT, INSERT, UPDATE, DELETE | none                             | own-row RLS                  |
| `user_equipment`            | USER_OWNED  | none           | SELECT, INSERT, UPDATE, DELETE | none                             | own-row RLS                  |
| `user_exercise_preferences` | USER_OWNED  | none           | SELECT, INSERT, UPDATE, DELETE | none                             | own-row RLS                  |
| `body_measurements`         | USER_OWNED  | none           | SELECT, INSERT, UPDATE, DELETE | none                             | own-row RLS                  |
| `workout_plans`             | USER_OWNED  | none           | SELECT, INSERT, UPDATE, DELETE | SELECT                           | own-row RLS                  |
| `workout_days`              | USER_OWNED  | none           | SELECT, INSERT, UPDATE, DELETE | SELECT                           | ownership helper RLS         |
| `workout_day_exercises`     | USER_OWNED  | none           | SELECT, INSERT, UPDATE, DELETE | SELECT                           | ownership helper RLS         |
| `workout_sessions`          | USER_OWNED  | none           | SELECT, INSERT, UPDATE, DELETE | none                             | own-row RLS                  |
| `workout_session_exercises` | USER_OWNED  | none           | SELECT, INSERT, UPDATE, DELETE | none                             | ownership helper RLS         |
| `set_logs`                  | USER_OWNED  | none           | SELECT, INSERT, UPDATE, DELETE | none                             | own-row RLS                  |
| `cardio_logs`               | USER_OWNED  | none           | SELECT, INSERT, UPDATE, DELETE | none                             | own-row RLS                  |
| `exercise_aliases`          | SERVER_ONLY | none           | none                           | SELECT                           | media jobs                   |
| `media_licenses`            | SERVER_ONLY | none           | none                           | SELECT                           | media jobs                   |
| `media_review_events`       | SERVER_ONLY | none           | none                           | SELECT, INSERT, UPDATE, DELETE   | media jobs                   |

Proposed final table grants:

- `anon`: 0
- `authenticated`: 62
- `service_role`: 18 table-level grants plus one column-level update
- `supabase_auth_admin`: 1
- total table-level grants: 81
- current Production-only grants versus proposed: 382
- missing Production table grants versus proposed: 0

`anon` needs Auth API access, not direct access to application tables. It keeps
`USAGE` on `public` for Data API compatibility but receives no table or function
privilege in `public` or `private`.

## Functions

| Class                     | Functions                                                                                                                  | Canonical EXECUTE                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| AUTH_HOOK                 | `public.hook_restrict_signup(jsonb)`                                                                                       | `supabase_auth_admin` only                               |
| SERVICE_ONLY              | `public.publish_exercise_media(uuid,uuid)`                                                                                 | `service_role` only                                      |
| APP_RPC                   | `complete_onboarding`, `activate_plan`, `finish_workout`, `delete_own_account_data`, `get_plan_readiness`, `start_workout` | `authenticated` only                                     |
| RLS_INTERNAL              | five ownership/admin helpers in `private`                                                                                  | `authenticated` only; schema is not exposed by PostgREST |
| INTERNAL_VALIDATION       | `exercise_has_approved_primary`, `is_valid_primary_checklist`                                                              | `authenticated`, `service_role`                          |
| GIF_FIRST_INTERNAL        | `is_valid_animated_primary`                                                                                                | `authenticated`, `service_role`; pending migration       |
| TRIGGER_ONLY / OWNER_ONLY | nine public trigger/readiness helpers                                                                                      | no Data API role                                         |

Production has 24 application functions and 17 effective function grants. Local
has 25 functions and 19 grants. The only diff is the pending GIF-first function
and its two intended grants. Existing Auth Hook, server media publisher, app RPC,
and private helper grants match exactly. The proposal reconciles functions
individually and performs no blanket function revoke.

## Sequences and schemas

There are no `public` or `private` sequences and no current sequence grants.
The schema grants match exactly (5/5): `public USAGE` for all four inspected
roles and `private USAGE` only for `authenticated`.

The proposal removes `CREATE` from Data API/Auth Hook roles, preserves the
required `public USAGE`, and keeps `private` unavailable to `anon`,
`service_role`, and `supabase_auth_admin`.

## Default privileges

| Owner/schema            | Local reset | Production |       Proposed |
| ----------------------- | ----------: | ---------: | -------------: |
| `postgres/public`       |          15 |         36 |              0 |
| `supabase_admin/public` |          36 |         36 | 36 (untouched) |
| Total in scope          |          51 |         72 |             36 |

Production has 21 `postgres/public` defaults beyond the local reset. More
importantly, both environments retain unsafe automatic privileges for future
objects. The proposal revokes all table and sequence privileges and function
`EXECUTE` from `PUBLIC`, `anon`, `authenticated`, and `service_role` for future
objects owned by `postgres` in `public`. Future migrations must grant required
access explicitly.

Defaults owned by `supabase_admin` and `supabase_auth_admin`, and defaults in
`auth`, `storage`, `extensions`, `graphql`, `graphql_public`, and `realtime`, are
outside the patch and remain untouched.

## Proposed SQL and simulation

Proposal: `ops/production/proposed-grant-reconciliation-v161-r2.sql`

It is deliberately outside `supabase/migrations`, is transaction-wrapped,
object-explicit, and semantically idempotent. It was executed twice against the
local Hosted-drift simulation with the same final matrix.

Simulation result:

- Hosted table/default drift reproduced exactly: YES
- Proposed SQL syntax validated locally: YES
- Second execution preserves the same ACL: YES
- Proposed canonical table ACL reached: YES (81 grants)
- `postgres/public` application defaults remaining: 0
- Remaining table/sequence/schema diff against the proposed target after local application: 0
- Expected function diff: pending GIF-first function only
- Production execution: NO

The proposal intentionally does **not** restore the unsafe inherited local
grants. The raw reset was retained as evidence, while the canonical target is
the least-privilege matrix proven by the grant contract and application tests.

## Security and application verification

| Check                                                                      | Result                                                            |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Grant contract (`tests/database/grants.test.sql`, after local proposal)    | PASS, 13/13                                                       |
| Full pgTAP after local proposal (contract + RLS/media/readiness/Auth Hook) | PASS, 53/53                                                       |
| Unit tests                                                                 | PASS, 45/45                                                       |
| Playwright isolated build                                                  | PASS, 14/14 (mobile + desktop)                                    |
| Login and private routing                                                  | PASS                                                              |
| Onboarding RPC/local account preparation                                   | PASS                                                              |
| Workout plan and session                                                   | PASS                                                              |
| Set/cardio logging authorization                                           | PASS (pgTAP/RLS)                                                  |
| History/progress route                                                     | PASS                                                              |
| Admin media route                                                          | PASS                                                              |
| Release readiness/reporting                                                | PASS                                                              |
| Server-only media processing/publication                                   | PASS, 7/7                                                         |
| Media integrity                                                            | PASS, 40 candidates, 7 PRIMARY, 7/7 GIF hashes, 7/7 poster hashes |
| Lint                                                                       | PASS                                                              |
| Typecheck                                                                  | PASS                                                              |
| Build                                                                      | PASS                                                              |

The E2E runner now uses an isolated production build on port 3100, so it cannot
silently reuse the user's long-running development server on port 3000 with a
stale environment. The existing port 3000 process was not interrupted.

## Advisors

Production advisors were run read-only with `type=all`, `level=info`, and
`fail-on=none`:

- Security findings: 0
- Performance warnings/errors: 0
- Performance informational findings: 26 unused-index observations

The unused-index observations are expected to be low-signal before real traffic
and were not acted on. A clean Security Advisor does not imply a least-privilege
ACL; the exact grant contract is a separate control.

## Risks and next gate

- Applying the proposal changes 382 current Production table grants and 36
  `postgres/public` default-privilege entries. It requires a separately approved
  maintenance step, fresh preflight, transaction monitoring, and immediate
  post-apply matrix/application verification.
- The pending GIF-first migration remains the only expected function/schema
  difference.
- No migration history repair, GIF-first migration, Storage upload, candidate
  reconciliation, media publication, or exercise activation occurred here.
- Migration history repair is safe **only after** the grant reconciliation is
  applied and a fresh read-only comparison proves the expected ACL. The R1
  semantic timestamp mapping remains the proposed history-only repair.

Gate: `READY_FOR_GRANT_RECONCILIATION`

This gate authorizes review of the SQL only. It does not authorize Production
execution.
