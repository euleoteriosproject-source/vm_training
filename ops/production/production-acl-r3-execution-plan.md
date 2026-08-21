# VM Training Production ACL R3 Execution Plan

Status: review-only plan. This document does not authorize execution.

Target project: `vm-training-prod` (`inghftngeritrsezwxnm`)

Canonical evidence:

- migration: `supabase/migrations/20260820202509_production_grant_reconciliation_v161_r3.sql`
- migration SHA-256: `b68e162f9870d21de57014df6f3b8ce134016c4be18f1b26ee2a60aaa6d3d6d5`
- matrix: `data/security/grant-matrix-canonical-r3.json`
- historical proposal: `ops/production/proposed-grant-reconciliation-v161-r2.sql`

## Hard gates

Abort before every write unless all of these remain true:

1. The resolved Supabase URL and CLI target both identify project ref
   `inghftngeritrsezwxnm`.
2. A fresh read-only capture still reports the known pre-R3 state.
3. The migration file hash matches the value above.
4. The 16 historical migrations remain semantic matches despite their remote
   timestamp mismatch.
5. The GIF-first schema migration is executed before R3. It may be applied in
   its own approved atomic schema step, but no media rows or Storage objects are
   reconciled with it.
6. A rollback operator and application smoke-test operator are available.

Do not use `supabase db push`, `--include-all`, or force migrations 001-018.

## Future operation

### A. Capture before

Capture table, column, function, function inventory, sequence, schema, default
privilege, RLS, policy, and migration-history state read-only. Preserve it as a
timestamped audit artifact. Expected table grants before execution are 463:
154 each for `anon`, `authenticated`, and `service_role`, plus the single Auth
Hook allowlist `SELECT` for `supabase_auth_admin`.

### B. Satisfy the GIF-first prerequisite

If `20260820154916_gif_first_media_invariant_v16.sql` is still absent, execute
that exact versioned SQL first under a separately approved transaction. Do not
upload GIFs/posters, reconcile the 17 media rows, publish media, or activate
exercises. Verify its one function and two intended grants before proceeding.

### C. Apply exact R3 SQL atomically

Use a client configured to stop on the first SQL error. Execute the exact,
hash-verified R3 migration. The migration owns its `BEGIN` and `COMMIT`; do not
edit, concatenate, or partially replay statements. If any statement fails, the
transaction must end in `ROLLBACK` and the operation stops.

### D. Inspect immediately

Capture the same matrix again and verify exact tuples, not totals alone:

- table grants: 81 (`authenticated` 62, `service_role` 18,
  `supabase_auth_admin` 1, `anon` 0)
- function grants: 19 across 25 application functions
- sequence grants: 0
- schema grants: 5
- `postgres/public` Data API defaults: 0
- platform-owned defaults: 36, unchanged
- column grant: only the intended `service_role UPDATE(active)` on `exercises`

### E. Require zero diff

Compare Production with `data/security/grant-matrix-canonical-r3.json`. Every
captured category must have zero missing and zero extra entries. A non-zero
diff is a failed operation: stop, preserve evidence, and use a separately
approved corrective/rollback procedure. Never compensate with blanket grants.

### F. Security Advisor

Run Security Advisor and database advisors read-only. Any new RLS,
`SECURITY DEFINER`, function-exposure, or private-schema finding blocks the
operation.

### G. Smoke tests

Run login, onboarding, catalog, plan generation, workout/session, set and
cardio logging, history/progress, admin media, server-only media publication,
release reporting, and mobile/desktop application checks. No test may reconcile
Production media or write to Production Storage.

### H. Stop

Stop after evidence capture and smoke tests. Do not combine media
reconciliation, Storage upload, publication, or exercise activation with the
ACL transaction.

## Migration-history repair after ACL approval

History repair remains forbidden until the post-ACL matrix is exactly zero-diff
and smoke tests pass. Then, in a distinct approved history-only operation:

1. Replace the 16 artificial hosted timestamps with the canonical 001-011
   versions using the exact R1 semantic mapping.
2. Record `20260820154916` as applied only after its SQL has been verified.
3. Record `20260820202509` as applied only after its exact hash and zero-diff
   ACL result have been verified.
4. Re-list local/remote history and require exact canonical alignment.

No migration repair command is executed by this PREP task.
