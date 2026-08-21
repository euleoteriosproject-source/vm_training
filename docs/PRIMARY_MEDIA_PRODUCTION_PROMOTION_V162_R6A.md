# VM Training Primary Media Production Promotion v1.6.2-R6A

Status: `BLOCKED`

Production project: `inghftngeritrsezwxnm`

R6A Production writes performed: **0**.

## Blocking precondition

Section 8 of the R6A specification requires all seven target candidates to have `reviewed_at IS NULL` and instructs the operation to abort if any candidate differs. The read-only Production preflight returned:

| Check | Expected | Actual |
| --- | ---: | ---: |
| Target candidates | 7 | 7 |
| `status = reviewing` | 7 | 7 |
| `reviewed_by IS NULL` | 7 | 7 |
| `reviewed_at IS NULL` | 7 | 0 |
| `approved_at/approved_by IS NULL` | 7 | 7 |
| `storage_path/poster_path IS NULL` | 7 | 7 |
| `media_role IS NULL`, `is_primary = false` | 7 | 7 |

All seven candidates have a non-null `reviewed_at`. A second SELECT-only audit established that this is the R5 validation synchronization state, not a fabricated human review:

- 7/7 have Validation v1.5 `APPROVE` metadata;
- 7/7 have R5 v1.5 review notes;
- 7/7 have `reviewed_by IS NULL`;
- 24 R5 reconciliation events remain present;
- 0 R6A processing events exist.

The R6A document also instructs the operation to preserve current R5 metadata. Clearing `reviewed_at` would therefore conflict with the preservation requirement and would erase an existing audit timestamp. R6A was aborted before Storage upload or DB mutation.

Recommended resolution: explicitly permit the R5 automated `reviewed_at` value while continuing to require `reviewed_by IS NULL`, then preserve both fields through R6A. If the intended resolution is instead to clear `reviewed_at`, that requires a separately authorized corrective transaction.

## Preflight

| Check | Actual |
| --- | ---: |
| Candidates | 41 |
| Target candidates | 7 |
| Target status | 7 reviewing |
| Pending | 19 |
| Rejected | 15 |
| Processed | 0 |
| Approved | 0 |
| PRIMARY | 0 |
| PRIMARY_DEMO | 0 |
| Active exercises | 0 |
| Storage objects before | 0 |
| Existing R6A events | 0 |
| Auth users | 0 |
| Profiles | 0 |
| Admin profiles | 0 |
| Bucket exists/private | 1/1 |
| Migration history | 18 |
| Non-target candidates | 34 |

Non-target preflight fingerprint: `d4d955e9e97963f98cbed78aac9cd141`.

## Local canonical artifacts

All three authority artifacts agree for the exact seven candidates:

- `data/media/media-validation-v15.json`;
- `data/media/media-processing-v16.json`;
- `data/media/primary-media-manifest.json`.

| Check | Result |
| --- | --- |
| Local GIF hashes | PASS — 7/7 |
| Local poster hashes | PASS — 7/7 |
| GIF codec | PASS — 7/7 GIF89a / FFprobe GIF |
| Animated | PASS — 7/7, frame count greater than 1 |
| Loop | PASS — 7/7 |
| Positive FPS | PASS — 7/7 at 12.5 FPS |
| Dimensions | PASS — 7/7 valid |
| Duration | PASS — 7/7 valid |
| Posters | PASS — 7/7 WebP |
| License validation evidence | PASS — 7/7 |

Actual binary size:

| Asset | Bytes | MiB |
| --- | ---: | ---: |
| 7 GIFs | 25,335,119 | 24.161452 |
| 7 posters | 94,086 | 0.089727 |
| Total | 25,429,205 | 24.251180 |

Cost: **NO ADDITIONAL COST identified**. No resource, bucket, project, or plan upgrade was created or requested.

## Storage

| Operation | Actual |
| --- | ---: |
| GIF uploaded | 0/7 |
| Posters uploaded | 0/7 |
| Reused identical | 0 |
| Storage objects final | 0 |
| Remote GIF hash checks | Not run — preflight aborted |
| Remote poster hash checks | Not run — preflight aborted |

## Processing

| Operation | Actual |
| --- | ---: |
| `reviewing -> processing` | 0/7 |
| `processing -> processed` | 0/7 |
| New processing events | 0 |

No upload, processing, cleanup, ad-hoc repair, approval, publication, PRIMARY assignment, activation, or Auth operation was attempted.

## Final candidate state

Production remained unchanged:

| Status | Actual |
| --- | ---: |
| Total | 41 |
| Processed | 0 |
| Rejected | 15 |
| Pending | 19 |
| Reviewing | 7 |
| Approved | 0 |
| PRIMARY | 0 |
| PRIMARY_DEMO | 0 |
| Active | 0 |

## Auth

| Check | Expected | Actual |
| --- | ---: | ---: |
| `auth.users` | 0 | 0 |
| Profiles | 0 | 0 |
| Admin profiles | 0 | 0 |

No fake admin, Auth user, profile, invite, password, UUID, `reviewed_by`, or `approved_by` was created.

## Integrity and tests

| Check | Result |
| --- | --- |
| DB references to missing R6A files | 0 — all target paths remain null |
| R6A files without DB references | 0 — no files uploaded |
| Local hash mismatches | 0 |
| GIF single frame | 0 |
| Static PRIMARY | 0 |
| Duplicate PRIMARY | 0 |
| Active without animated PRIMARY | 0 |
| Lint | PASS |
| Typecheck | PASS |
| Unit | PASS — 45/45 |
| Media manifest integrity | PASS — 7/7 GIF and poster hashes |

Remote hash reconciliation is intentionally not reported as complete because no object was uploaded.

## Security

- migration history: 18/18 baseline retained;
- ACL: 81 / diff 0 baseline retained;
- RLS: unchanged;
- Security Advisor: 0 findings at the preceding R5 gate;
- bucket `exercise-media`: private;
- Storage policies: unchanged.

R6A performed no operation capable of changing schema, ACL, RLS, Auth, bucket configuration, or Storage policies.

## Production writes

| Scope | Writes |
| --- | ---: |
| Storage | 0 |
| `exercise_media` processing | 0 |
| Processing events | 0 |
| Approvals | 0 |
| PRIMARY | 0 |
| Exercise activation | 0 |
| Auth | 0 |

## Gate

`BLOCKED`

Required input: authorize preserving the seven existing R5 `reviewed_at` timestamps during R6A, or explicitly authorize a corrective transaction that clears them. Do not create a user or publish media.
