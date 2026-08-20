# VM Training Production Reconciliation v1.6.1-R1

Date: 2026-08-20

Production project: `vm-training-prod` (`inghftngeritrsezwxnm`)

Mode: dry-run; zero Production writes

## Migration history before

| Local version | Local name | Remote version | Remote name | Semantic match |
| --- | --- | --- | --- | --- |
| `202608190001` | `initial_schema` | `20260820115107` | `202608190001_initial_schema` | YES |
| `202608190002` | `domain_functions` | `20260820115210` | `202608190002_domain_functions` | YES |
| `202608190003` | `cardio_integrity` | `20260820115219` | `202608190003_cardio_integrity` | YES |
| `202608190004` | `session_rls_fix` | `20260820115225` | `202608190004_session_rls_fix` | YES |
| `202608190005` | `media_invariant` | `20260820115235` | `202608190005_media_invariant` | YES |
| `202608200001` | `media_library_v11` | `20260820115325` | `202608200001_media_library_v11` | YES |
| `202608200002` | `media_discovery_v12` | `20260820115346` | `202608200002_media_discovery_v12` | YES |
| `202608200003` | `authenticated_grants` | `20260820115355` | `202608200003_authenticated_grants` | YES |
| `202608200004` | `media_operations_v13` | `20260820115421` | `202608200004_media_operations_v13` | YES |
| `202608200005` | `media_publish_v13` | `20260820115438` | `202608200005_media_publish_v13` | YES |
| `202608200006` | `media_service_grants_v13` | `20260820115444` | `202608200006_media_service_grants_v13` | YES |
| `202608200007` | `server_only_approval_v13` | `20260820115453` | `202608200007_server_only_approval_v13` | YES |
| `202608200008` | `production_readiness_v14` | `20260820115512` | `202608200008_production_readiness_v14` | YES |
| `202608200009` | `onboarding_preferences_v14` | `20260820115525` | `202608200009_onboarding_preferences_v14` | YES |
| `202608200010` | `release_reporting_grants_v14` | `20260820115532` | `202608200010_release_reporting_grants_v14` | YES |
| `202608200011` | `production_security_hardening_v141` | `20260820135700` | `202608200011_production_security_hardening_v141` | YES |
| `20260820154916` | `gif_first_media_invariant_v16` | — | — | PENDING |

The CLI compares migration timestamps, not semantic names. It consequently reports all 16 historical local versions as missing remotely and all 16 artificial remote versions as missing locally.

### Proposed history repair — do not run yet

These commands are the exact history-only operations that would align the timestamps. They are blocked because the schema comparison found material grant drift.

```powershell
corepack pnpm exec supabase migration repair --linked --project-ref inghftngeritrsezwxnm --status reverted 20260820115107 20260820115210 20260820115219 20260820115225 20260820115235 20260820115325 20260820115346 20260820115355 20260820115421 20260820115438 20260820115444 20260820115453 20260820115512 20260820115525 20260820115532 20260820135700

corepack pnpm exec supabase migration repair --linked --project-ref inghftngeritrsezwxnm --status applied 202608190001 202608190002 202608190003 202608190004 202608190005 202608200001 202608200002 202608200003 202608200004 202608200005 202608200006 202608200007 202608200008 202608200009 202608200010 202608200011
```

Expected history after a future safe repair: the 16 canonical local versions aligned on both sides, with only `20260820154916` pending.

## Schema comparison

The local database was reset to `202608200011` and compared read-only to Production across `public`, `private`, and Storage policies.

| Object class | Local | Remote | Result |
| --- | ---: | ---: | --- |
| Columns | 242 | 242 | MATCH |
| Constraints | 108 | 108 | MATCH |
| Functions | 24 | 24 | MATCH |
| Indexes | 64 | 64 | MATCH |
| Policies | 51 | 51 | MATCH |
| RLS-enabled table state | 22 | 22 | MATCH |
| Triggers | 28 | 28 | MATCH |
| Table grants | 272 | 462 | **DRIFT** |

Normalized fingerprints match for columns, constraints, functions, indexes, policies, RLS, and triggers. Table grants do not match. Production currently reports full table privileges across all 22 inspected tables for `anon`, `authenticated`, and `service_role`, while the canonical local hardening grants are restricted by role and table. The CLI diff also reports default-privilege drift.

This is material security drift. Migration history repair is **not safe** until grants/default privileges are reconciled and the same comparison is clean.

## Canonical media dataset

- Canonical identities: 40
- Production identities: 40
- Matching: 23
- Missing canonical: 17
- Unexpected Production: 17

Identity is `exercise.slug + canonical sourceUrl`; UUIDs and `originalFileUrl` query parameters are not semantic identity.

### Missing canonical

- `bike` → `Man_on_an_Exercise_Bike_GIF_Animation_Loop.gif`
- `calf-raise` → `Rocking-standing-calf-raise-1.gif`
- `calf-raise` → `Rocking-standing-calf-raise-2.gif`
- `calf-raise` → `Seated-calf-raise-1.gif`
- `calf-raise` → `Standing-barbell-calf-raise-1.gif`
- `calf-raise` → `Standing-barbell-calf-raise-2.gif`
- `incline-machine-press` → `Chest_press-CDC_strength_training_for_older_adults.gif`
- `incline-machine-press` → `Incline_press_-_exercise_demonstration_video.webm`
- `incline-machine-press` → `Muscle_Strengthening_at_the_Gym_-_Chest_Press.webm`
- `lat-pulldown` → `How_to_properly_leg_press.webm`
- `lat-pulldown` → `Wide-grip-lat-pull-down-1.gif`
- `lat-pulldown` → `Wide-grip-lat-pull-down-2.gif`
- `machine-chest-press` → `Chest_press-CDC_strength_training_for_older_adults.gif`
- `machine-shoulder-press` → `How_To_Properly_Dumbbell_Shoulder_Press.webm`
- `machine-shoulder-press` → `Shoulder_press_-_exercise_demonstration_video.webm`
- `thoracic-extension` → `Chest_stretch-CDC_strength_training_for_older_adults.gif`
- `thoracic-extension` → `Hamstring_stretch-CDC_strength_training_for_older_adults.gif`

### Unexpected Production

All 17 are `SAFE_TO_REPLACE`:

- `bike` → `Man_on_an_Exercise_Bike.webm`
- `calf-raise` → `Donkey_Calf_Raise.webm`
- `calf-raise` → `Rocking_Standing_Calf_Raise.webm`
- `calf-raise` → `Seated_Calf_Raise.webm`
- `calf-raise` → `Single_Leg_Calf_Raise.webm`
- `calf-raise` → `Smith_Machine_Calf_Raise.webm`
- `incline-machine-press` → `Incline_Bench_Press.webm`
- `incline-machine-press` → `Incline_Dumbbell_Press.webm`
- `incline-machine-press` → `Incline_Press_-_Exercise_Demonstration.webm`
- `lat-pulldown` → `Close-grip_Lat_Pull_Down.webm`
- `lat-pulldown` → `Close-Grip_Pulldown_-_Exercise_Demonstration.webm`
- `lat-pulldown` → `Wide-grip_Lat_Pull_Down.webm`
- `machine-chest-press` → `Bench_Press_-_Exercise_Demonstration.webm`
- `machine-shoulder-press` → `Shoulder_Press_-_Exercise_Demonstration.webm`
- `machine-shoulder-press` → `Shoulder_Press.webm`
- `thoracic-extension` → `Muscle_Strengthening_at_Home_-_Chest_Stretch.webm`
- `thoracic-extension` → `Upper_back_extension-CDC_strength_training_for_older_adults.gif`

Every unexpected row was verified as:

- `status = pending`
- `media_role IS NULL`
- `storage_path IS NULL`
- `poster_path IS NULL`
- `reviewed_at IS NULL`
- `approved_at IS NULL`
- `processed_at IS NULL`
- `is_primary = false`
- related `media_review_events = 0`

The only foreign key referencing `exercise_media` is `media_review_events.media_id` with `ON DELETE CASCADE`; no unexpected row has a related event. Manual review required: 0.

### Proposed future media reconciliation

One server-side transaction, after explicit approval:

1. `BEGIN`.
2. Insert/upsert the 17 missing canonical candidates using every field from the versioned artifact.
3. Assert 40/40 canonical identities exist.
4. Delete only the 17 rows classified `SAFE_TO_REPLACE`.
5. Assert total rows = 40 and canonical identity match = 40/40.
6. `COMMIT`; otherwise `ROLLBACK`.

No validation status, media processing, Storage upload, publication, or exercise activation belongs in that transaction.

## Bike

- Canonical: `Man_on_an_Exercise_Bike_GIF_Animation_Loop.gif`
- Current Production: `Man_on_an_Exercise_Bike.webm`
- Future resolution: insert the canonical GIF candidate, verify 40/40 identities, then remove the unused pending WebM row inside the atomic reconciliation transaction.

## Manifest integrity

The existing seven poster files were not replaced. Their SHA-256 values were calculated and recorded in both canonical artifacts.

- GIF hashes: 7/7 match
- Processing poster hashes vs files: 7/7 match
- Manifest poster hashes vs files: 7/7 match
- Processing vs manifest poster hashes: 7/7 match
- `MANIFEST_MISSING_POSTER_HASH`: 0
- `POSTER_HASH_MISMATCH`: 0

The processing pipeline now persists `posterHash`, and manifest verification validates it when local artifacts are available.

## Production writes

- Migration repair: 0
- Migration push: 0
- Database inserts: 0
- Database updates: 0
- Database deletes: 0
- Storage writes: 0
- Media publications: 0
- Exercise activations: 0

## Verification

- lint: PASS
- typecheck: PASS
- unit tests: PASS (45/45)
- pgTAP: PASS (40/40)
- build: PASS
- media integrity: PASS (7 approved PRIMARY, 14 Storage files, 7/7 GIF and poster hashes)

## Gate

`BLOCKED`

Reason: material Production grant/default-privilege drift must be reconciled and revalidated before migration history repair. Media replacement is safe by row classification but remains intentionally unexecuted.
