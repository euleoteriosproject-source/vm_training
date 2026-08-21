# VM Training Production Migration History Repair v1.6.1-R4

Date: 2026-08-21

Production project: `vm-training-prod` (`inghftngeritrsezwxnm`)

Scope: migration-history metadata only. No migration SQL, application data,
ACL, Auth, Storage, media, or exercise state was changed.

The operation used the official `supabase migration repair` command. Supabase
documents that `applied` inserts a migration-history record and `reverted`
removes a history record without applying or reverting the migration SQL:
<https://supabase.com/docs/reference/cli/supabase-projects#supabase-migration-repair>.

## Preconditions

- CLI: `2.115.0`
- linked project ref: `inghftngeritrsezwxnm`
- local canonical migrations: 18
- semantic mapping of artificial names to local files: 16/16
- GIF-first SHA-256:
  `c9dcef99158b22b57f54eafb719e35c652f3dd19b17aabde2e32bf54f828b912`
- ACL R3 SHA-256:
  `b68e162f9870d21de57014df6f3b8ce134016c4be18f1b26ee2a60aaa6d3d6d5`
- GIF-first materialized: five columns, three constraints, exact functions and
  validator grants
- ACL materialized: 81 table grants, 25 functions, 19 function grants, zero
  sequence grants, zero canonical diff
- Production data: 40 candidates, 0 approved, 0 PRIMARY, 0 active exercises,
  0 Storage objects

## BEFORE — 16 artificial entries

| Artificial version | Remote name | Canonical version | Local file |
| --- | --- | --- | --- |
| `20260820115107` | `202608190001_initial_schema` | `202608190001` | `202608190001_initial_schema.sql` |
| `20260820115210` | `202608190002_domain_functions` | `202608190002` | `202608190002_domain_functions.sql` |
| `20260820115219` | `202608190003_cardio_integrity` | `202608190003` | `202608190003_cardio_integrity.sql` |
| `20260820115225` | `202608190004_session_rls_fix` | `202608190004` | `202608190004_session_rls_fix.sql` |
| `20260820115235` | `202608190005_media_invariant` | `202608190005` | `202608190005_media_invariant.sql` |
| `20260820115325` | `202608200001_media_library_v11` | `202608200001` | `202608200001_media_library_v11.sql` |
| `20260820115346` | `202608200002_media_discovery_v12` | `202608200002` | `202608200002_media_discovery_v12.sql` |
| `20260820115355` | `202608200003_authenticated_grants` | `202608200003` | `202608200003_authenticated_grants.sql` |
| `20260820115421` | `202608200004_media_operations_v13` | `202608200004` | `202608200004_media_operations_v13.sql` |
| `20260820115438` | `202608200005_media_publish_v13` | `202608200005` | `202608200005_media_publish_v13.sql` |
| `20260820115444` | `202608200006_media_service_grants_v13` | `202608200006` | `202608200006_media_service_grants_v13.sql` |
| `20260820115453` | `202608200007_server_only_approval_v13` | `202608200007` | `202608200007_server_only_approval_v13.sql` |
| `20260820115512` | `202608200008_production_readiness_v14` | `202608200008` | `202608200008_production_readiness_v14.sql` |
| `20260820115525` | `202608200009_onboarding_preferences_v14` | `202608200009` | `202608200009_onboarding_preferences_v14.sql` |
| `20260820115532` | `202608200010_release_reporting_grants_v14` | `202608200010` | `202608200010_release_reporting_grants_v14.sql` |
| `20260820135700` | `202608200011_production_security_hardening_v141` | `202608200011` | `202608200011_production_security_hardening_v141.sql` |

## INTERMEDIATE — 34 entries

Step A marked all 18 canonical versions `applied` before removing any existing
record. The intermediate history was the exact union of the 16 BEFORE entries
above and these 18 canonical entries:

| Canonical version | Canonical remote name |
| --- | --- |
| `202608190001` | `initial_schema` |
| `202608190002` | `domain_functions` |
| `202608190003` | `cardio_integrity` |
| `202608190004` | `session_rls_fix` |
| `202608190005` | `media_invariant` |
| `202608200001` | `media_library_v11` |
| `202608200002` | `media_discovery_v12` |
| `202608200003` | `authenticated_grants` |
| `202608200004` | `media_operations_v13` |
| `202608200005` | `media_publish_v13` |
| `202608200006` | `media_service_grants_v13` |
| `202608200007` | `server_only_approval_v13` |
| `202608200008` | `production_readiness_v14` |
| `202608200009` | `onboarding_preferences_v14` |
| `202608200010` | `release_reporting_grants_v14` |
| `202608200011` | `production_security_hardening_v141` |
| `20260820154916` | `gif_first_media_invariant_v16` |
| `20260820202509` | `production_grant_reconciliation_v161_r3` |

Checkpoint result: 34 total, 18/18 canonical names correct, 16 artificial
entries still present.

## AFTER — 18 canonical entries

Step C marked exactly the 16 BEFORE versions `reverted`. The final remote
history is exactly the 18-row canonical table shown above. No artificial entry
remains.

`supabase migration list --linked --project-ref inghftngeritrsezwxnm`
reported:

- aligned local/remote: 18/18
- local-only: 0
- remote-only: 0
- pending: 0

## Preservation evidence

| Check | Before | After | Result |
| --- | ---: | ---: | --- |
| GIF-first columns | 5 | 5 | PASS |
| GIF-first constraints | 3 | 3 | PASS |
| Table grants | 81 | 81 | PASS |
| Function inventory/grants | 25/19 | 25/19 | PASS |
| Sequence grants | 0 | 0 | PASS |
| Platform defaults | 36 | 36 | PASS |
| Canonical ACL diff | 0 | 0 | PASS |
| Public RLS tables | 22 | 22 | PASS |
| Public policies | 47 | 47 | PASS |
| Candidates | 40 | 40 | PASS |
| Approved media | 0 | 0 | PASS |
| PRIMARY media | 0 | 0 | PASS |
| Active exercises | 0 | 0 | PASS |
| Storage objects | 0 | 0 | PASS |
| Security Advisor findings | 0 | 0 | PASS |

Direct column ACL remains exactly `service_role UPDATE(active)` on
`public.exercises`. Auth Hook execute remains restricted to
`supabase_auth_admin`; the GIF validator remains executable only by
`authenticated` and `service_role`.

## Writes performed

- migration-history rows inserted: 18 canonical
- migration-history rows removed: 16 artificial
- migration SQL executions: 0
- application table writes: 0
- Auth user writes: 0
- Storage writes: 0
- media writes/publications: 0
- exercise activations: 0

Gate: `READY_FOR_MEDIA_DATASET_RECONCILIATION`

No media reconciliation was started.
