# VM Training Primary Media Production Promotion v1.6.2-R6A

Status: `READY_FOR_PRODUCTION_ADMIN_BOOTSTRAP`

Production project: `inghftngeritrsezwxnm`

Execution date: 2026-08-21

R6A completed the authorized binary promotion and automated processing only. It did not approve or publish media, assign a primary role, activate exercises, or create an Auth user/profile.

## Authorized review timestamp semantics

R5 intentionally populated the seven `reviewed_at` values during automated Validation v1.5 reconciliation. The R6A unblock authorized preserving those timestamps while continuing to interpret `reviewed_by IS NULL` as evidence that no final human Production review has occurred.

All seven candidates had the same R5 timestamp before R6A. All seven retained that exact value after R6A.

## Preflight

| Check | Result |
| --- | ---: |
| CLI linked project | `inghftngeritrsezwxnm` |
| CLI authentication | PASS |
| Project health | `ACTIVE_HEALTHY` |
| Candidates | 41 |
| Exact target identities | 7/7 |
| Targets in `reviewing` | 7/7 |
| `reviewed_at` from R5 present | 7/7 |
| `reviewed_by IS NULL` | 7/7 |
| Approval metadata null | 7/7 |
| `media_role IS NULL`, `is_primary = false` | 7/7 |
| Storage paths null | 7/7 |
| Processing timestamps/errors null | 7/7 |
| `ready_for_processing = false` | 7/7 |
| Storage objects before | 0 |
| Bucket exists/private | PASS |
| R5 events | 24 |
| Existing R6A events | 0 |
| Migration history | 18/18 |
| ACL | 81 grants / diff 0 |
| RLS | PASS — 22/22 public tables |
| Security Advisor | 0 findings |
| Auth users/profiles/admins | 0/0/0 |

The Production target was established through the authenticated CLI link, not through the LAN/local Supabase URLs used by the development web app.

The exact candidate identity gate used `exercise slug + canonical source_url`. A pre-existing R5 `original_file_url` variant for `seated-leg-curl` was deliberately preserved, as required; it was not rewritten during binary processing. Exact source, license, review evidence, and execution-quality preservation was enforced by a before/after fingerprint.

## Local binary gate

| Check | Result |
| --- | ---: |
| Canonical GIF files | 7/7 |
| Canonical WebP posters | 7/7 |
| GIF SHA-256 | 7/7 |
| Poster SHA-256 | 7/7 |
| Animated GIF | 7/7 |
| Frame count greater than one | 7/7 |
| Loop enabled | 7/7 |
| Positive FPS | 7/7 |
| Valid dimensions/duration | 7/7 |
| Static/single-frame GIF | 0 |

Actual binary volume:

- GIF: 25,335,119 bytes
- Posters: 94,086 bytes
- Total: 25,429,205 bytes (24.251180 MiB)

No binary was regenerated, recompressed, replaced, or uploaded from an original WebM source.

## Storage

| Check | Result |
| --- | ---: |
| GIF uploaded | 7/7 |
| Posters uploaded | 7/7 |
| Reused identical | 0 |
| Final objects | 14 |
| Final bytes | 25,429,205 |
| GIF MIME `image/gif` | 7/7 |
| Poster MIME `image/webp` | 7/7 |
| Immutable cache-control | 14/14 |
| Remote GIF SHA-256 | 7/7 |
| Remote poster SHA-256 | 7/7 |
| Bucket private | YES |

The 14 objects were downloaded again from the private Production bucket and hashed locally before any database row was allowed to reference them.

## Processing

| Operation | Result |
| --- | ---: |
| `reviewing -> processing` | 7/7 |
| `processing -> processed` | 7/7 |
| `processing_started` events | 7/7 |
| `processed` events | 7/7 |
| Total R6A events | 14/14 |
| R5 events preserved | 24/24 |
| Final media-review event total | 38 |
| Automated event `admin_user_id IS NULL` | 14/14 |

The transaction synchronized only canonical v1.6 processing fields: GIF type, Storage paths, content hash, file size, dimensions, duration, frame count, FPS, animation flags, processing timestamps/log, null fallback/error, and completed readiness state.

## Review metadata preservation

| Check | Result |
| --- | ---: |
| `reviewed_at` unchanged from R5 | 7/7 |
| `reviewed_by` remains null | 7/7 |
| `approved_at` remains null | 7/7 |
| `approved_by` remains null | 7/7 |
| `media_role` remains null | 7/7 |
| `is_primary` remains false | 7/7 |
| Source/license/R5 metadata fingerprint unchanged | PASS |
| Other 34 candidates unchanged | PASS |

The before/after non-target fingerprint remained `d4d955e9e97963f98cbed78aac9cd141`. This also preserves the 17 Production-only candidates.

## Final candidate state

| State | Count |
| --- | ---: |
| Total | 41 |
| Processed | 7 |
| Rejected | 15 |
| Pending | 19 |
| Reviewing | 0 |
| Approved | 0 |
| PRIMARY | 0 |
| PRIMARY_DEMO | 0 |
| Active exercises | 0 |

## Auth

| State | Count |
| --- | ---: |
| `auth.users` | 0 |
| Profiles | 0 |
| Admin profiles | 0 |

No fake administrator, invite, password, Auth user, profile, or reviewer UUID was created.

## Integrity reconciliation

| Check | Result |
| --- | ---: |
| `DB_WITHOUT_FILE` | 0 |
| `FILE_WITHOUT_DB` | 0 |
| `HASH_MISMATCH` | 0 |
| `GIF_SINGLE_FRAME` | 0 |
| `APPROVED_WITHOUT_POSTER` | 0 |
| `PRIMARY_STATIC_IMAGE` | 0 |
| `DUPLICATE_PRIMARY` | 0 |
| `ACTIVE_WITHOUT_ANIMATED_PRIMARY` | 0 |

## Security

| Check | Result |
| --- | ---: |
| Migration history | 18/18 |
| ACL table grants | 81 |
| ACL diff from canonical | 0 |
| ACL before/after artifact | unchanged |
| RLS | PASS — 22/22 public tables |
| Security Advisor | 0 findings |
| Storage policy fingerprint | unchanged |
| Bucket private | YES |

## Verification

| Command/check | Result |
| --- | --- |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — 45/45 |
| Primary manifest integrity | PASS — 7/7 GIF and 7/7 posters |
| Direct FFprobe/binary validation | PASS |
| Production reconciliation query | PASS |

Full browser E2E was intentionally not run because Production still has no real Auth user and no approved/published PRIMARY media.

## Production writes

| Scope | Writes |
| --- | ---: |
| Storage objects | 14 |
| `exercise_media` candidates processed | 7 |
| Processing events | 14 |
| Approvals | 0 |
| PRIMARY assignments | 0 |
| Exercise activations | 0 |
| Auth/profile writes | 0 |
| Schema/migration/ACL/RLS/policy changes | 0 |

No paid resource, project, bucket, or plan upgrade was created. Cost gate: `NO ADDITIONAL COST`.

## Future R6B contract

R6B may replace the automated R5 `reviewed_at` only when a real Production administrator actually performs final media review. At that time it must set `reviewed_by` to the real admin user ID and `reviewed_at` to the real administrative review timestamp. That operation was not performed or authorized in R6A.

## Gate

`READY_FOR_PRODUCTION_ADMIN_BOOTSTRAP`

Stop after this gate. Do not create a user and do not publish media as part of R6A.
