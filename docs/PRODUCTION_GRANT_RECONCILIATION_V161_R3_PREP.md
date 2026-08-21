# VM Training Canonical ACL Migration v1.6.1-R3 PREP

Date: 2026-08-21

Production project: `vm-training-prod` (`inghftngeritrsezwxnm`)

Mode: local preparation and optional Production read-only verification; zero
Production writes.

## Migration

- file: `supabase/migrations/20260820202509_production_grant_reconciliation_v161_r3.sql`
- version: `20260820202509`
- SHA-256: `b68e162f9870d21de57014df6f3b8ce134016c4be18f1b26ee2a60aaa6d3d6d5`
- order: `20260820154916_gif_first_media_invariant_v16.sql` then R3
- clean reset: PASS; reset itself applied GIF-first, R3, and seed in order
- manual post-reset ACL patch: NO

The semantic SQL is identical to the validated R2 proposal. The only change is
the non-executable header:

- OLD: R2 review-only proposal warning outside the migration chain.
- NEW: R3 canonical migration header, R2 provenance, and explicit-grant rule.
- REASON: make the tested policy part of every fresh database while retaining
  the R2 proposal as historical evidence.

## Canonical ACL

The fresh matrix is `data/security/grant-matrix-canonical-r3.json`. Exact tuple
comparison against the R2 proposed matrix returned zero missing and zero extra
entries in every category.

Table grants total 81:

- `anon`: 0
- `authenticated`: 62
- `service_role`: 18 table grants, plus the existing column-level
  `UPDATE(active)` on `exercises`
- `supabase_auth_admin`: 1 (`SELECT` on the signup allowlist)

No Data API role has unintended `TRUNCATE`, `TRIGGER`, or `REFERENCES`.

Function inventory is 25 with 19 grants:

- Auth Hook: `supabase_auth_admin` only
- media publish: `service_role` only
- app RPCs: six intentional `authenticated` grants
- private RLS helpers: five `authenticated` grants; the schema is not exposed
  by PostgREST
- primary-media validation: four intentional grants split across
  `authenticated` and `service_role`
- trigger/owner-only helpers: no direct Data API execution

There are no application sequences and no sequence grants. Schema grants are
five: `public USAGE` for the four inspected roles and `private USAGE` only for
`authenticated`; Data API/Auth Hook roles have no `CREATE` grant.

`postgres/public` contributes zero future Data API default privileges. The 36
remaining defaults are the exact platform-owned `supabase_admin` model and were
not modified.

## Validation

| Check | Result |
| --- | --- |
| Clean `supabase db reset --local` | PASS; R3 applied automatically |
| Exact ACL diff vs R2 proposal | PASS, 0 |
| Grant contract | PASS, 22/22 |
| Full pgTAP | PASS, 62/62 |
| Lint | PASS |
| Typecheck | PASS |
| Unit | PASS, 45/45 |
| Playwright | PASS, 14/14 mobile + desktop |
| Production build | PASS |
| Login/onboarding/plan/session | PASS |
| Catalog/progress/admin/release routes | PASS |
| Set/cardio authorization | PASS through pgTAP/RLS contract |
| Server-only media processing/publication | PASS locally, 7/7 |
| Media integrity | PASS, 40 candidates, 7 GIFs, 7 posters |
| Local advisors | PASS; 0 security/warning/error findings, 25 informational unused-index findings |

The browser CLI supplied by the verification skill was unavailable, so the
repository's Playwright production-build suite was used as the browser fallback.
It exercised authentication through the same-origin Supabase proxy and passed
all required mobile and desktop cases.

## Media

The existing decisions and binary assets were not regenerated or changed.
Local processing confirmed seven approved animated `PRIMARY_DEMO` entries,
seven GIF hashes, and seven poster hashes. Production media remains outside
this operation.

## Production plan and history

The future reviewed procedure is
`ops/production/production-acl-r3-execution-plan.md`. It requires a fresh
before-capture, the GIF-first prerequisite, exact hash-verified R3 execution,
post-apply inspection, zero ACL diff, advisors, smoke tests, and STOP.

Only after zero diff and passing smoke tests may the R1 timestamp mapping be
repaired and the actually executed GIF-first/R3 versions be recorded
canonically. `db push`, `--include-all`, migration repair, media reconciliation,
and Production Storage are forbidden during PREP.

Production writes performed by this task: **0**.

The final optional read-only capture confirmed the unchanged pre-R3 hosted
state: 463 table grants (`anon` 154, `authenticated` 154, `service_role` 154,
`supabase_auth_admin` 1), 17 function grants, no sequence grants, five schema
grants, and 72 defaults. The captured project ref was exactly
`inghftngeritrsezwxnm`; the temporary evidence remains ignored under `.tmp`.

## Future migration contract

Every future application migration follows:

`CREATE OBJECT -> REVOKE/default-secure -> GRANT only required roles`

Hosted defaults are never treated as an application authorization policy.
